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
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Initialize Telegram Bot (using polling to listen for channel posts)
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

let db, mediaCollection;

// Connect to MongoDB Atlas
MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db('vip_vault'); // Database name
    mediaCollection = db.collection('media'); // Collection name
    console.log('✅ Connected successfully to MongoDB Atlas');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });

// Listen for new posts in the Telegram channel/chat
bot.on('channel_post', async (msg) => {
  try {
    if (msg.video || msg.document) {
      const fileId = msg.video ? msg.video.file_id : msg.document.file_id;
      const caption = msg.caption || 'VIP Media';
      
      const mediaItem = {
        fileId,
        caption,
        messageId: msg.message_id,
        createdAt: new Date()
      };

      if (mediaCollection) {
        await mediaCollection.insertOne(mediaItem);
        console.log(`✅ Saved new media to MongoDB: "${caption}"`);
      }
    }
  } catch (err) {
    console.error('❌ Error saving channel post to database:', err);
  }
});

// API endpoint for your Telegram Mini App frontend to fetch videos
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

// Bind to Render's dynamic port
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
