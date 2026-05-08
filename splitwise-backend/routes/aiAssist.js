const express = require('express');
const router  = express.Router({ mergeParams: true });
const auth    = require('../middleware/auth');
const Group   = require('../models/Group');
const Groq    = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── POST /api/groups/:groupId/ai-assist ──────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const group = await Group.findById(req.params.groupId).populate('members', 'name _id');
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const memberList  = group.members.map(m => ({ id: m._id.toString(), name: m.name }));
    const memberNames = memberList.map(m => m.name).join(', ');

    const allMemberIds = memberList.map(m => m.id);

    const systemPrompt = `You are an expense parser for a group expense app. You MUST return ONLY valid JSON — no explanations, no questions in plain text.

Group members: ${JSON.stringify(memberList)}

CRITICAL RULES:
1. If description + amount + payer are clear → return ADD_EXPENSE immediately. DO NOT ask unnecessary questions.
2. DEFAULT BEHAVIOR: If no specific split is mentioned → split EQUALLY among ALL members (include every member ID in splitBetween).
3. "sabhi ne khaya", "sab pe split", "equally", or no split mentioned → use ALL member IDs in splitBetween.
4. IMPORTANT: The payer (paidBy) MUST ALWAYS be included in splitBetween. They also owe their share.
5. If payer is missing → ASK_USER for payer only.
6. If amount is missing → ASK_USER for amount only.
7. Match names loosely: "sahil"→Sahil, "abhi"→Abhishek, "vikas"→Vikas, "aish"→Aish, "yash"→Yash.
8. "maine" or "mujhe" = the current user (use first member as fallback).
9. If user has already answered a question in history, USE that answer — do not ask again.
10. Return ONLY raw JSON. No markdown. No text before or after JSON.

JSON formats:

Equal split among ALL (most common — use this when no specific split mentioned):
{"action":"ADD_EXPENSE","description":"Dinner","amount":1200,"paidBy":"MEMBER_ID","splitType":"equal","splitBetween":["id1","id2","id3","id4"]}

Percentage split (payer must be in splits too):
{"action":"ADD_EXPENSE","description":"Dinner","amount":1200,"paidBy":"MEMBER_ID","splitType":"percentage","splitBetween":[],"splits":[{"user":"id1","percentage":60},{"user":"id2","percentage":40}]}

Missing info (ONLY ask ONE thing at a time):
{"action":"ASK_USER","question":"Ye expense kisne pay kiya?"}`;

    // Build Groq messages with full history
    const groqMessages = [
      { role: 'system', content: systemPrompt },
      // Include previous conversation turns
      ...history.map(h => ({
        role:    h.role === 'user' ? 'user' : 'assistant',
        content: h.role === 'bot' ? (h.rawJson ? JSON.stringify(h.rawJson) : h.text) : h.text,
      })),
      { role: 'user', content: message },
    ];

    const completion = await groq.chat.completions.create({
      model:       'llama-3.1-8b-instant',
      messages:    groqMessages,
      temperature: 0.1,
      max_tokens:  400,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '';

    // Extract JSON — handle markdown code fences or raw JSON
    let jsonStr = text;
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback: ask user
      parsed = { action: 'ASK_USER', question: 'Thoda aur clearly batao — kisne kitna pay kiya?' };
    }

    // ── Backend safeguard: enforce payer is always in splitBetween ────────────
    if (parsed.action === 'ADD_EXPENSE') {
      // If equal split and splitBetween is empty/missing → default to ALL members
      if (parsed.splitType === 'equal' && (!parsed.splitBetween || parsed.splitBetween.length === 0)) {
        parsed.splitBetween = allMemberIds;
      }
      // Always ensure payer is included in splitBetween
      if (parsed.paidBy && Array.isArray(parsed.splitBetween) && !parsed.splitBetween.includes(parsed.paidBy)) {
        parsed.splitBetween = [parsed.paidBy, ...parsed.splitBetween];
      }
    }

    return res.json(parsed);
  } catch (err) {
    console.error('AI Assist error:', err.message);
    return res.status(500).json({ error: 'AI service failed', details: err.message });
  }
});

module.exports = router;
