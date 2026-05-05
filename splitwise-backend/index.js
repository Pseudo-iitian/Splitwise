require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const wishlistRoutes = require('./routes/wishlist');
const chatRoutes     = require('./routes/chat');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://splitwise-tres.vercel.app',
    'https://splitwise-five-phi.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());

// ─────────────────────────────────────────────────────────
// ✅ Optimized MongoDB connection (Vercel-friendly)
// ─────────────────────────────────────────────────────────

let cachedConn = null;

const connectDB = async () => {
  // already connected → reuse
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
};

// 🔥 important: connect once
const dbPromise = connectDB();

// middleware → ensure DB ready before any request
app.use(async (req, res, next) => {
  try {
    await dbPromise;
    next();
  } catch (err) {
    console.error('DB connection failed:', err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// ─────────────────────────────────────────────────────────
// Routes (unchanged)
// ─────────────────────────────────────────────────────────

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/expenses',    require('./routes/expenses'));
app.use('/api/settlements', require('./routes/settlements'));
app.use('/api/wishlist',    wishlistRoutes);
app.use('/api/groups',      require('./routes/groups'));

// root route fix (better than /:groupId conflict)
app.get('/', (req, res) => {
  res.json({ msg: 'Splitwise API running ✅' });
});

// ✅ health check (important for keep-alive)
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// ─────────────────────────────────────────────────────────
// Local dev only
// ─────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;