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

// Initialize Telegram Bot without polling (using webhook)
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

// Webhook endpoint to receive updates from Telegram channel posts
app.post(`/bot${BOT_TOKEN}`, async (req, res) => {
  try {
    const update = req.body;
    console.log('📥 Received update from Telegram:', JSON.stringify(update, null, 2));

    // Check if the update contains a channel post with a video or document
    const post = update.channel_post || update.edited_channel_post;
    if (post && (post.video || post.document)) {
      const mediaFile = post.video || post.document;
      const fileId = mediaFile.file_id;
      const caption = post.caption || 'Untitled Media';
      const fileUniqueId = mediaFile.file_unique_id;

      // Save media metadata to MongoDB Atlas
      if (mediaCollection) {
        await mediaCollection.updateOne(
          { fileUniqueId: fileUniqueId },
          { 
            $set: { 
              fileId: fileId, 
              fileUniqueId: fileUniqueId,
              caption: caption, 
              createdAt: new Date() 
            } 
          },
          { upsert: true }
        );
        console.log('💾 Successfully saved media to MongoDB:', caption);
      }
    }
  } catch (err) {
    console.error('❌ Error processing webhook update:', err);
  }
  
  // Always respond with 200 OK so Telegram knows the update was received
  res.sendStatus(200);
});

// API endpoint for your frontend to fetch the catalog
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
