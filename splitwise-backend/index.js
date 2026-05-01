require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Serverless DB connection
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

// ❌ NO app.listen
module.exports = app;