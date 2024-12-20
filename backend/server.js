const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;
const mm = require("music-metadata");
const ffmpeg = require("fluent-ffmpeg");
const tmp = require("tmp");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const multer = require("multer");
const sharp = require("sharp");

const BLACKLISTED_SONGS = [
  "12 - Jingle - There's No Stopping Here.mp3",
  "12 - Jingle - There's No Going Back.mp3",
  "34 - Ringtone (Godot).mp3",
  "02 - Ringtone (Richard Wellington).mp3",
  "11 - Ringtone (Phoenix Wright).mp3",
  "13 - Jingle - There's No Sleeping Tonight.mp3",
];

const allowedOrigins = [
  "http://127.0.0.1:7689",
  "http://localhost:7689",
  "https://aceattorneyheardle.maxreinartz.me",
  "https://backend.aceattorneyheardle.maxreinartz.me",
];

const app = express();

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "username", "hashedpassword"],
  })
);

app.use(express.json());
app.use(express.static("public"));

let songs = [];

const audioCache = new Map();

const USERS_FILE = path.join(__dirname, "data", "users.json");
const SCORES_FILE = path.join(__dirname, "data", "scores.json");
const STATS_FILE = path.join(__dirname, "data", "stats.json");

async function initDataFiles() {
  try {
    await fs.mkdir(path.join(__dirname, "data"), { recursive: true });
    const files = {
      [USERS_FILE]: "{}",
      [SCORES_FILE]: "{}",
      [STATS_FILE]: "{}",
    };

    for (const [file, defaultContent] of Object.entries(files)) {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, defaultContent);
      }
    }
  } catch (error) {
    console.error("Error initializing data files:", error);
  }
}

async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function loadScores() {
  try {
    const data = await fs.readFile(SCORES_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveScores(scores) {
  await fs.writeFile(SCORES_FILE, JSON.stringify(scores, null, 2));
}

// Add new helper functions for stats
async function loadStats() {
  try {
    const data = await fs.readFile(STATS_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveStats(stats) {
  await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
}

async function loadSongs() {
  try {
    const songDir = path.join(__dirname, "songs");
    const files = await fs.readdir(songDir);
    const mp3Files = files.filter(
      (file) => file.endsWith(".mp3") && !BLACKLISTED_SONGS.includes(file)
    );

    songs = await Promise.all(
      mp3Files.map(async (file, index) => {
        const filePath = path.join(songDir, file);
        const metadata = await mm.parseFile(filePath);
        return {
          id: index + 1,
          title: metadata.common.title || file.replace(".mp3", ""),
          file: file,
          artist: metadata.common.artist || "Unknown",
          album: metadata.common.album || "Unknown",
        };
      })
    );

    console.log(
      `Loaded ${songs.length} songs (${BLACKLISTED_SONGS.length} blacklisted)`
    );
  } catch (error) {
    console.error("Error loading songs:", error);
  }
}

async function processAudio(filePath, duration) {
  const key = `${filePath}_${duration}`;
  if (audioCache.has(key)) {
    return audioCache.get(key);
  }

  const outputPath = tmp.fileSync({ postfix: ".mp3" }).name;

  await new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .setStartTime(0)
      .setDuration(duration)
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  const buffer = await fs.readFile(outputPath);
  audioCache.set(key, buffer);
  return buffer;
}

function getRandomSong() {
  const randomIndex = Math.floor(Math.random() * songs.length);
  return songs[randomIndex];
}

app.get("/api/random-song", async (req, res) => {
  const song = getRandomSong();
  if (!song) {
    return res.status(404).json({ error: "No songs available" });
  }

  const segments = await Promise.all(
    [1, 2, 4, 8, 16].map(async (duration) => {
      const buffer = await processAudio(
        path.join(__dirname, "songs", song.file),
        duration
      );
      return buffer.toString("base64");
    })
  );

  res.json({
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    file: song.file,
    segments,
  });
});

app.get("/api/songs", (req, res) => {
  res.json(
    songs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      file: song.file,
    }))
  );
});

app.use("/songs", express.static(path.join(__dirname, "songs")));

// Add static serving for profile pictures
app.use(
  "/profile-pics",
  express.static(path.join(__dirname, "assets", "profile"))
);

// Configure multer for profile picture uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// Add authentication middleware
async function authenticateUser(req, res, next) {
  const username = req.headers["username"];
  const hashedPassword = req.headers["hashedpassword"];

  if (!username || !hashedPassword) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const users = await loadUsers();
  const user = users[username];

  if (!user || hashedPassword !== user.hashedPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.authenticatedUser = username;
  next();
}

// Add new endpoints
app.post("/api/signup", async (req, res) => {
  const { username } = req.body;
  if (!username || username.length < 3) {
    return res.status(400).json({ error: "Invalid username" });
  }

  const users = await loadUsers();
  if (users[username]) {
    return res.status(400).json({ error: "Username already exists" });
  }

  // Generate random password
  const password = crypto.randomBytes(4).toString("hex");
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  users[username] = {
    hashedPassword,
    salt,
    createdAt: new Date().toISOString(),
    profilePic: 0, // Default profile picture
  };

  await saveUsers(users);

  // Initialize score
  const scores = await loadScores();
  scores[username] = 0;
  await saveScores(scores);

  res.json({
    username,
    password,
    profilePicUrl: "/profile-pics/0.png",
  });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const users = await loadUsers();
  const user = users[username];

  if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ username, hashedPassword: user.hashedPassword });
});

app.get("/api/leaderboard", async (req, res) => {
  const scores = await loadScores();
  const users = await loadUsers();

  const sortedScores = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([username, score]) => ({
      username,
      score,
      profilePic: users[username]?.profilePic
        ? `/uploads/${users[username].profilePic}`
        : null,
    }));

  res.json(sortedScores);
});

app.post("/api/score", authenticateUser, async (req, res) => {
  const { username, attempt, success } = req.body;
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  const scores = await loadScores();
  const stats = await loadStats();

  if (!stats[username]) {
    stats[username] = {
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      totalAttempts: 0,
      winStreak: 0,
      bestStreak: 0,
      averageAttempts: 0,
      distribution: [0, 0, 0, 0, 0],
      lastPlayed: null,
    };
  }

  // Update stats
  stats[username].gamesPlayed++;
  stats[username].totalAttempts += attempt;
  stats[username].averageAttempts =
    stats[username].totalAttempts / stats[username].gamesPlayed;
  stats[username].lastPlayed = new Date().toISOString();

  // Update score and win/loss stats
  if (!scores[username]) scores[username] = 0;

  if (success) {
    stats[username].gamesWon++;
    stats[username].winStreak++;
    stats[username].bestStreak = Math.max(
      stats[username].winStreak,
      stats[username].bestStreak
    );
    stats[username].distribution[attempt - 1]++;
    scores[username] += Math.max(6 - attempt, 0);
  } else {
    stats[username].gamesLost++; // Increment losses
    stats[username].winStreak = 0;
    scores[username] = Math.max(0, scores[username] - 3); // Always subtract 3 for any loss

    // Only update distribution for normal gameplay losses, not refreshes
    if (attempt < 5) {
      stats[username].distribution[attempt]++;
    }
  }

  await Promise.all([saveScores(scores), saveStats(stats)]);

  res.json({
    score: scores[username],
    stats: stats[username],
  });
});

app.get("/api/user-score/:username", authenticateUser, async (req, res) => {
  const scores = await loadScores();
  const score = scores[req.params.username] || 0;
  res.json({ score });
});

app.get("/api/stats/:username", authenticateUser, async (req, res) => {
  const stats = await loadStats();
  res.json(
    stats[req.params.username] || {
      gamesPlayed: 0,
      gamesWon: 0,
      totalAttempts: 0,
      winStreak: 0,
      bestStreak: 0,
      averageAttempts: 0,
      distribution: [0, 0, 0, 0, 0],
      lastPlayed: null,
    }
  );
});

app.delete("/api/delete-account", authenticateUser, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    const users = await loadUsers();
    const user = users[username];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const [scores, stats] = await Promise.all([loadScores(), loadStats()]);

    delete users[username];
    delete scores[username];
    delete stats[username];

    await Promise.all([saveUsers(users), saveScores(scores), saveStats(stats)]);

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// Add profile picture endpoint
app.post(
  "/api/profile-pic",
  authenticateUser,
  upload.single("profilePic"),
  async (req, res) => {
    const { username } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const users = await loadUsers();
      if (!users[username]) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if the uploaded file is an image
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Invalid file type" });
      }

      // Check if image size is less than 5MB
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "File size exceeds 5MB" });
      }

      // Check if the resolution is at least 256x256
      const image = sharp(req.file.buffer);
      const { width, height } = await image.metadata();
      if (width < 256 || height < 256) {
        return res.status(400).json({ error: "Image resolution too low" });
      }

      // Process image
      const processedImage = await sharp(req.file.buffer)
        .resize(256, 256, {
          // Make it square
          fit: "cover",
          position: "center",
        })
        .png()
        .toBuffer();

      // Save image
      const fileName = `${username}_${Date.now()}.png`;
      const filePath = path.join(__dirname, "public", "uploads", fileName);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, processedImage);

      // Update user profile
      users[username].profilePic = fileName;
      await saveUsers(users);

      res.json({
        success: true,
        profilePicUrl: `/uploads/${fileName}`,
      });
    } catch (error) {
      console.error("Error updating profile picture:", error);
      res.status(500).json({ error: "Failed to update profile picture" });
    }
  }
);

// Update verify endpoint to include full profile picture URL
app.post("/api/verify", async (req, res) => {
  const { username, hashedPassword } = req.body;
  if (!username || !hashedPassword) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const users = await loadUsers();
  const user = users[username];

  if (!user || hashedPassword !== user.hashedPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({
    verified: true,
    username,
    profilePicUrl: `/uploads/${user.profilePic || 0}`,
  });
});

app.get("/api/search-users", async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.json([]);
  }

  try {
    const [users, scores, stats] = await Promise.all([
      loadUsers(),
      loadScores(),
      loadStats(),
    ]);

    const matches = Object.keys(users)
      .filter((username) =>
        username.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 10)
      .map((username) => ({
        username,
        score: scores[username] || 0,
        stats: stats[username] || {
          gamesPlayed: 0,
          gamesWon: 0,
          winStreak: 0,
        },
        profilePic: users[username].profilePic
          ? `/uploads/${users[username].profilePic}`
          : null,
      }));

    res.json(matches);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Failed to search users" });
  }
});

const PORT = 7688;
app.listen(PORT, async () => {
  await initDataFiles();
  await loadSongs();
  console.log(`Server running on http://localhost:${PORT}`);
});
