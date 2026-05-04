const express     = require('express');
const router = express.Router({ mergeParams: true }); // CRITICAL FIX
const Pusher      = require('pusher');
const auth        = require('../middleware/auth');
const ChatMessage = require('../models/ChatMessage');
// Init Pusher — env vars se aayega

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});


// ─── GET messages for a group (last 50) ──────────────────────────────────────
router.get('/', auth, async (req, res) => { 
  try {
    const messages = await ChatMessage.find({ groupId: req.params.groupId })
      .populate('sender', 'name email')
      .sort({ createdAt: 1 })
      .limit(50);
    res.json(messages);
  } catch (err) {
        console.error("CHAT_ERROR:", err); // Yeh aapke terminal mein asli wajah batayega
        res.status(500).json({ error: err.message }); 
    }
});

// ─── POST send a message ──────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });

    const chatMsg = await ChatMessage.create({
      groupId: req.params.groupId, // mergeParams ki wajah se ye mil jayega
      sender:  req.user.id,
      message: message.trim(),
    });

    const populated = await ChatMessage.findById(chatMsg._id).populate('sender', 'name email');

    await pusher.trigger(`group-${req.params.groupId}`, 'new-message', {
        _id:       populated._id,
        message:   populated.message,
        sender:    populated.sender,
        createdAt: populated.createdAt,
    });

    res.status(201).json(populated);
  } catch (err) {
        console.error("CHAT_ERROR:", err); // Yeh aapke terminal mein asli wajah batayega
        res.status(500).json({ error: err.message }); 
    }
});

// ─── DELETE a message (only sender can delete) ────────────────────────────────
router.delete('/:messageId', auth, async (req, res) => { // <-- Prefix hataya gaya hai
  try {
    const msg = await ChatMessage.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    if (msg.sender.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await msg.deleteOne();

    await pusher.trigger(`group-${req.params.groupId}`, 'delete-message', { 
        messageId: req.params.messageId 
    });

    res.json({ message: 'Deleted' });
  } catch (err) {
        console.error("CHAT_ERROR:", err); // Yeh aapke terminal mein asli wajah batayega
        res.status(500).json({ error: err.message }); 
    }
});

module.exports = router;