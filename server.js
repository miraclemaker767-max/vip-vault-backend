require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let videoList = []; // Fallback memory list so it never breaks

// Connect to MongoDB safely
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB!'))
    .catch(err => console.log('MongoDB connection skipped/error:', err.message));
}

const videoSchema = new mongoose.Schema({
  id: Number,
  title: String,
  fileId: { type: String, unique: true },
  videoUrl: String,
  thumbnailUrl: String,
  createdAt: { type: Date, default: Date.now }
});
const Video = mongoose.model('Video', videoSchema);

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const CHANNEL_ID = process.env.CHANNEL_ID;

bot.on('channel_post', async (msg) => {
  console.log("--> Post detected in Channel ID:", msg.chat.id);
  
  if (CHANNEL_ID && msg.chat.id.toString() !== CHANNEL_ID.toString()) {
    return;
  }

  const mediaObj = msg.video || msg.document || msg.animation || msg.video_note;
  if (!mediaObj) return;

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
      } catch (e) {}
    }

    const videoData = {
      id: msg.message_id,
      title: caption,
      fileId: fileId,
      videoUrl: videoUrl,
      thumbnailUrl: thumbnailUrl,
      createdAt: new Date()
    };

    // Save to DB if connected, otherwise keep in memory list
    if (mongoose.connection.readyState === 1) {
      await Video.findOneAndUpdate({ fileId }, videoData, { upsert: true, new: true });
      console.log('✅ Saved to MongoDB:', caption);
    } else {
      if (!videoList.some(v => v.fileId === fileId)) {
        videoList.unshift(videoData);
        console.log('✅ Saved to memory list:', caption);
      }
    }
  } catch (err) {
    console.error('❌ Error processing post:', err.message);
  }
});

app.get('/api/videos', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const videos = await Video.find().sort({ _id: -1 });
      return res.json({ success: true, videos });
    }
    res.json({ success: true, videos: videoList });
  } catch (err) {
    res.json({ success: true, videos: videoList });
  }
});

app.get('/api/stream/:fileId', async (req, res) => {
  try {
    const file = await bot.getFile(req.params.fileId);
    const videoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    res.redirect(videoUrl);
  } catch (err) {
    res.status(500).json({ error: 'Failed to stream video' });
  }
});

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
