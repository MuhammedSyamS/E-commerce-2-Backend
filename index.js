const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Product = require('./models/Product');

const app = express();
app.use(cors());
app.use(express.json());

// CONNECT TO DB
const MONGO_URI = 'mongodb://127.0.0.1:27017/miso_clone'; 
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// API ROUTES
app.get('/api/products', async (req, res) => {
  const { category } = req.query;
  let query = {};
  if (category && category !== 'All') query.category = category;
  
  try {
    const products = await Product.find(query);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));