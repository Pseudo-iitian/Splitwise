const loadEnv = require('./config/loadEnv');
loadEnv();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const wishlistRoutes = require('./routes/wishlist');
const chatRoutes     = require('./routes/chat');
const aiAssistRoutes = require('./routes/aiAssist');
const { startReminderScheduler } = require('./utils/reminderScheduler');

const app = express();

// ─────────────────────────────────────────────────────────
// ✅ CORS CONFIG
// ─────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:5173',
      'https://splitwise-tres.vercel.app',
      'https://splitwise-five-phi.vercel.app',
      'https://splitwise-27cq.onrender.com'
    ];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// ─────────────────────────────────────────────────────────
// ✅ MongoDB Connection (Render-ready)
// ─────────────────────────────────────────────────────────

let cachedConn = null;

const connectDB = async () => {
  try {
    if (cachedConn && mongoose.connection.readyState === 1) {
      return cachedConn;
    }

    mongoose.set('bufferCommands', false);

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
      maxIdleTimeMS: 10000,
    });

    cachedConn = conn;
    console.log('✅ MongoDB connected');
    return conn;

  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────
// ✅ Routes
// ─────────────────────────────────────────────────────────

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/expenses',    require('./routes/expenses'));
app.use('/api/settlements', require('./routes/settlements'));
app.use('/api/reminders',   require('./routes/reminders'));
app.use('/api/wishlist',    wishlistRoutes);
app.use('/api/groups',      require('./routes/groups'));
app.use('/api/groups/:groupId/ai-assist', aiAssistRoutes);


// Root route
app.get('/', (req, res) => {
  res.json({ msg: 'Splitwise API running ✅' });
});

// Health check (important for Render)
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// ─────────────────────────────────────────────────────────
// ✅ Start Server (IMPORTANT for Render)
// ─────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌱 Environment: ${process.env.APP_ENV} (${process.env.LOADED_ENV_FILE})`);
      startReminderScheduler();
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start server:", err);
  });

// Export (optional, safe to keep)
module.exports = app;
