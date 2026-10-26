require('dotenv').config();
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const CHANNEL_ID = process.env.CHANNEL_ID;

let videoList = [];

bot.on('channel_post', async (msg) => {
  console.log("--> Post detected in Channel ID:", msg.chat.id);
  
  // Check if Chat ID matches
  if (msg.chat.id.toString() !== CHANNEL_ID.toString()) {
    console.log("⚠️ Chat ID does not match .env CHANNEL_ID");
    return;
  }

  // Find any media object (video, document, animation, or video_note)
  const mediaObj = msg.video || msg.document || msg.animation || msg.video_note;

  if (!mediaObj) {
    console.log("⚠️ Received post, but it was not a video or file (maybe pure text or photo).");
    return;
  }

  const fileId = mediaObj.file_id;
  const caption = msg.caption || 'VIP Vault Video';

  try {
    // 1. Get the main video/file path
    const file = await bot.getFile(fileId);
    const videoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // 2. Automatically extract thumbnail URL if available from Telegram
    let thumbnailUrl = '';
    if (mediaObj.thumb && mediaObj.thumb.file_id) {
      try {
        const thumbFile = await bot.getFile(mediaObj.thumb.file_id);
        thumbnailUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${thumbFile.file_path}`;
      } catch (thumbErr) {
        console.log("⚠️ Could not fetch thumbnail file path:", thumbErr.message);
      }
    }

    const exists = videoList.some(v => v.fileId === fileId);
    if (!exists) {
      videoList.unshift({
        id: msg.message_id,
        title: caption,
        fileId: fileId,
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl, // Pass the auto-extracted thumbnail link here
        createdAt: new Date()
      });
      console.log('✅ SUCCESS! Video & Auto-Thumbnail synced to Mini App:', caption);
    }
  } catch (err) {
    console.error('❌ Telegram File Download Error (File might be larger than 20MB):', err.message);
  }
});

app.get('/api/videos', (req, res) => {
  res.json({ success: true, videos: videoList });
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
  res.send('VIP Vault Backend is Running and Active! 🚀');
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
