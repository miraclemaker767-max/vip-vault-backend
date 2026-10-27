require('dotenv').config();
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const CHANNEL_ID = process.env.CHANNEL_ID;

// MongoDB Connection Setup
const mongoUri = process.env.MONGO_URI;
let db, videosCollection;

async function connectDB() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db('vip_vault_db');
    videosCollection = db.collection('videos');
    console.log('✅ Connected successfully to MongoDB Atlas');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
  }
}
connectDB();

// Handle incoming Telegram channel posts
bot.on('channel_post', async (msg) => {
  console.log("--> Post detected in Channel ID:", msg.chat.id);
  
  if (msg.chat.id.toString() !== CHANNEL_ID.toString()) {
    console.log("⚠️ Chat ID does not match .env CHANNEL_ID");
    return;
  }

  const mediaObj = msg.video || msg.document || msg.animation || msg.video_note;

  if (!mediaObj) {
    console.log("⚠️ Received post, but it was not a video or file.");
    return;
  }

  const fileId = mediaObj.file_id;
  const caption = msg.caption || 'VIP Vault Video';

  try {
    const file = await bot.getFile(fileId);
    const videoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    let thumbnailUrl = '';
    if (mediaObj.thumb && mediaObj.thumb.file_id) {
      try {
        const thumbFile = await bot.getFile(mediaObj.thumb.file_id);
        thumbnailUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${thumbFile.file_path}`;
      } catch (thumbErr) {
        console.log("⚠️ Could not fetch thumbnail file path:", thumbErr.message);
      }
    }

    if (videosCollection) {
      const existing = await videosCollection.findOne({ fileId: fileId });
      if (!existing) {
        const videoDoc = {
          id: msg.message_id,
          title: caption,
          fileId: fileId,
          videoUrl: videoUrl,
          thumbnailUrl: thumbnailUrl,
          createdAt: new Date()
        };

        await videosCollection.insertOne(videoDoc);
        console.log('✅ SUCCESS! Video saved permanently to MongoDB:', caption);
      }
    }
  } catch (err) {
    console.error('❌ Telegram File Download Error:', err.message);
  }
});

// API endpoint to fetch videos from MongoDB
app.get('/api/videos', async (req, res) => {
  try {
    if (!videosCollection) {
      return res.json({ success: true, videos: [] });
    }
    const videos = await videosCollection.find({}).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, videos });
  } catch (err) {
    console.error('Failed to fetch from DB:', err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => {
  res.send('VIP Vault Backend with MongoDB is Running! 🚀');
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
