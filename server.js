require('dotenv').config();
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

// Safely load mongoose so it never crashes Render if package.json misses it
let mongoose = null;
let Video = null;
try {
  mongoose = require('mongoose');
  const videoSchema = new mongoose.Schema({
    id: Number,
    title: String,
    fileId: { type: String, unique: true },
        videoUrl: String,
    thumbnailUrl: String,
    thumbnailFileId: String,
    createdAt: { type: Date, default: Date.now }
  });
  Video = mongoose.model('Video', videoSchema);
} catch (e) {
  console.log("⚠️ Mongoose not found, running in memory fallback mode.");
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let videoList = [];

// Connect to MongoDB if available and URI is set
if (mongoose && process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB successfully!'))
    .catch(err => console.error('MongoDB connection error:', err.message));
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const CHANNEL_ID = process.env.CHANNEL_ID;
// ==========================================
// 🚀 ADDED: /START COMMAND HANDLER WITH BUTTON
// ==========================================
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "👋 **Welcome to VIP Vault!**\n\nPlease join our channel below:", {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📢 Join Our Channel', url: 'https://t.me/+YOUR_INVITE_LINK' }]
            ]
        }
    });
});
// ==========================================
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
    const thumbnailObj = mediaObj.thumbnail || mediaObj.thumb || null;
    const thumbnailFileId = thumbnailObj?.file_id || '';

    if (thumbnailFileId) {
      try {
        const thumbFile = await bot.getFile(thumbnailFileId);
        thumbnailUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${thumbFile.file_path}`;
      } catch (thumbErr) {
        console.log("⚠️ Could not fetch thumbnail file path:", thumbErr.message);
      }
    } else {
      console.log("ℹ️ Telegram did not provide a thumbnail for:", caption);
    }

    const videoData = {
      id: msg.message_id,
      title: caption,
      fileId: fileId,
      videoUrl: videoUrl,
            thumbnailUrl: thumbnailUrl,
      thumbnailFileId: thumbnailFileId,
      createdAt: new Date()
    };

    // Save to MongoDB if active, otherwise use memory list
    if (Video && mongoose.connection.readyState === 1) {
      await Video.findOneAndUpdate({ fileId }, videoData, { upsert: true, new: true });
      console.log('✅ SUCCESS! Video saved permanently to MongoDB:', caption);
    } else {
      const exists = videoList.some(v => v.fileId === fileId);
      if (!exists) {
        videoList.unshift(videoData);
        console.log('✅ SUCCESS! Video saved to memory list:', caption);
      }
    }
  } catch (err) {
    console.error('❌ Telegram File Download Error:', err.message);
  }
});

app.get('/api/videos', async (req, res) => {
  try {
    if (Video && mongoose.connection.readyState === 1) {
      const videos = await Video.find().sort({ _id: -1 });
      return res.json({ success: true, videos });
    }
    res.json({ success: true, videos: videoList });
  } catch (err) {
    res.json({ success: true, videos: videoList });
  }
});

app.get('/api/thumbnail/:fileId', async (req, res) => {
  try {
    const file = await bot.getFile(req.params.fileId);
    const thumbnailUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    res.redirect(thumbnailUrl);
  } catch (err) {
    console.error('Thumbnail refresh failed:', err.message);
    res.status(404).json({ error: 'Thumbnail unavailable' });
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
