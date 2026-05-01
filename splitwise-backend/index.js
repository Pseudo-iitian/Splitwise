require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB connection (only connect once)
if (!global.mongoose) {
  global.mongoose = mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection failed:', err.message));
}

// Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/groups',      require('./routes/groups'));
app.use('/api/expenses',    require('./routes/expenses'));
app.use('/api/settlements', require('./routes/settlements'));

app.get('/', (req, res) => {
  res.json({ msg: 'Splitwise API running ✅' });
});

// ❌ REMOVE THIS
// app.listen(PORT, ...);

// ✅ EXPORT THIS
module.exports = app;