const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// Serve static frontend files (like index.html) from this directory
app.use(express.static(__dirname));

// Connect to MongoDB using Render environment variables
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('VIP Vault Backend is running and connected to MongoDB!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Video Schema & Model
const videoSchema = new mongoose.Schema({
  fileId: String,
  caption: String,
  date: { type: Date, default: Date.now }
});
const Video = mongoose.model('Video', videoSchema);

// API: Get all videos as a clean array for your frontend
app.get('/api/videos', async (req, res) => {
  try {
    const videos = await Video.find().sort({ _id: -1 });
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Root route: Serves your index.html file to the browser / Telegram Mini App
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
