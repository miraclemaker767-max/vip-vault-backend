const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;

// Initialize Telegram Bot without polling (using webhooks or basic API calls)
const bot = new TelegramBot(BOT_TOKEN);

let db, mediaCollection;

// Connect to MongoDB Atlas
MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db('vip_vault');
    mediaCollection = db.collection('media');
    console.log('✅ Connected successfully to MongoDB Atlas');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });

// Webhook endpoint to receive updates directly from Telegram
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// API endpoint for your frontend
app.get('/api/videos', async (req, res) => {
  try {
    if (!mediaCollection) {
      return res.status(500).json({ error: 'Database connection is still initializing' });
    }
    const videos = await mediaCollection.find({}).sort({ createdAt: -1 }).toArray();
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check root route
app.get('/', (req, res) => {
  res.send('VIP Vault Backend is running and connected to MongoDB!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
