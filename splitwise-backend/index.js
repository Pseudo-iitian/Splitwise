require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'https://splitwise-tres.vercel.app','https://splitwise-five-phi.vercel.app'],
  credentials: true
}));
app.use(express.json());

// DB connection
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  const conn = await mongoose.connect(process.env.MONGO_URI);
  isConnected = conn.connections[0].readyState;
  console.log('✅ MongoDB connected');
};

connectDB();

// Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/groups',      require('./routes/groups'));
app.use('/api/expenses',    require('./routes/expenses'));
app.use('/api/settlements', require('./routes/settlements'));

app.get('/', (req, res) => {
  res.json({ msg: 'Splitwise API running ✅' });
});

// ✅ Local development mein listen karo, Vercel pe nahi
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;