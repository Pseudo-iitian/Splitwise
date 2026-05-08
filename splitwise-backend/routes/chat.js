const express     = require('express');
const router      = express.Router({ mergeParams: true });
const Pusher      = require('pusher');
const auth        = require('../middleware/auth');
const ChatMessage = require('../models/ChatMessage');
const { cloudinary, upload } = require('../utils/cloudinary');

// Init Pusher
const pusher = new Pusher({
  appId:   process.env.PUSHER_APP_ID,
  key:     process.env.PUSHER_KEY,
  secret:  process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS:  true,
});

// ─── Helper: broadcast a message via Pusher ──────────────────────────────────
const broadcast = async (groupId, eventName, payload) => {
  try {
    await pusher.trigger(`group-${groupId}`, eventName, payload);
  } catch (e) {
    console.error('Pusher error:', e.message);
  }
};

// ─── GET messages for a group (last 100) ─────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const messages = await ChatMessage.find({ groupId: req.params.groupId })
      .populate('sender', 'name email')
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    console.error('CHAT_ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST: send text message ─────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });

    const chatMsg = await ChatMessage.create({
      groupId: req.params.groupId,
      sender:  req.user.id,
      message: message.trim(),
      type:    'text',
    });

    const populated = await ChatMessage.findById(chatMsg._id).populate('sender', 'name email');

    await broadcast(req.params.groupId, 'new-message', populated);
    res.status(201).json(populated);
  } catch (err) {
    console.error('CHAT_ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST: send media/file (image, video, audio, file) ───────────────────────
router.post('/media', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mime = req.file.mimetype || '';
    let type = 'file';
    if (mime.startsWith('image/'))      type = 'image';
    else if (mime.startsWith('video/')) type = 'video';
    else if (mime.startsWith('audio/')) type = 'audio';

    const chatMsg = await ChatMessage.create({
      groupId:  req.params.groupId,
      sender:   req.user.id,
      message:  '',
      type,
      fileUrl:  req.file.path,          // Cloudinary secure URL
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: mime,
    });

    const populated = await ChatMessage.findById(chatMsg._id).populate('sender', 'name email');
    await broadcast(req.params.groupId, 'new-message', populated);
    res.status(201).json(populated);
  } catch (err) {
    console.error('CHAT_MEDIA_ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST: create poll ────────────────────────────────────────────────────────
router.post('/poll', auth, async (req, res) => {
  try {
    const { question, options, isAnonymous } = req.body;
    if (!question?.trim()) return res.status(400).json({ error: 'Poll question required' });
    if (!Array.isArray(options) || options.length < 2)
      return res.status(400).json({ error: 'At least 2 options required' });

    const chatMsg = await ChatMessage.create({
      groupId: req.params.groupId,
      sender:  req.user.id,
      message: '',
      type:    'poll',
      poll: {
        question: question.trim(),
        options:  options.map(o => ({ text: o.trim(), votes: [] })),
        isAnonymous: Boolean(isAnonymous),
      },
    });

    const populated = await ChatMessage.findById(chatMsg._id).populate('sender', 'name email');
    await broadcast(req.params.groupId, 'new-message', populated);
    res.status(201).json(populated);
  } catch (err) {
    console.error('CHAT_POLL_ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH: vote on a poll option ────────────────────────────────────────────
router.patch('/:messageId/vote', auth, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const msg = await ChatMessage.findById(req.params.messageId);
    if (!msg || msg.type !== 'poll') return res.status(404).json({ error: 'Poll not found' });
    if (optionIndex === undefined || optionIndex < 0 || optionIndex >= msg.poll.options.length)
      return res.status(400).json({ error: 'Invalid option' });

    const userId = req.user.id;

    // Remove user's previous vote from all options
    msg.poll.options.forEach(opt => {
      opt.votes = opt.votes.filter(v => v.toString() !== userId);
    });

    // Add vote to selected option
    msg.poll.options[optionIndex].votes.push(userId);
    await msg.save();

    const populated = await ChatMessage.findById(msg._id).populate('sender', 'name email');
    await broadcast(req.params.groupId, 'poll-update', populated);
    res.json(populated);
  } catch (err) {
    console.error('CHAT_VOTE_ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE a message (only sender can delete) ────────────────────────────────
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const msg = await ChatMessage.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    if (msg.sender.toString() !== req.user.id)
      return res.status(403).json({ error: 'Not authorized' });

    // Delete from Cloudinary too if media
    if (msg.fileUrl && ['image', 'video', 'audio', 'file'].includes(msg.type)) {
      try {
        // Extract public_id from URL
        const urlParts = msg.fileUrl.split('/');
        const filename = urlParts[urlParts.length - 1].split('.')[0];
        const folder   = urlParts.slice(-3, -1).join('/');
        const publicId = `${folder}/${filename}`;
        const resType  = msg.type === 'image' ? 'image' : 'video';
        await cloudinary.uploader.destroy(publicId, { resource_type: resType });
      } catch (e) {
        console.warn('Cloudinary delete failed (continuing):', e.message);
      }
    }

    await msg.deleteOne();
    await broadcast(req.params.groupId, 'delete-message', { messageId: req.params.messageId });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('CHAT_ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;