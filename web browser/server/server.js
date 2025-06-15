require("dotenv").config(); // Load environment variables

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// PostgreSQL Database Connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }, 
});

pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL database."))
  .catch(err => console.error("❌ Error connecting to database:", err));

// Serve static files
app.use("/images", express.static(path.join(__dirname, "../images")));

const imageMap = {
  "images/a0304-dgw_137.dng.jpg": [
    "images/a0304-dgw_137.dng.jpg_sharpen_20.jpg",
    "images/a0304-dgw_137.dng.jpg_sharpen_40.jpg",
    "images/a0304-dgw_137.dng.jpg_sharpen_60.jpg",
    "images/a0304-dgw_137.dng.jpg_sharpen_80.jpg",
    "images/a0304-dgw_137.dng.jpg_sharpen_100.jpg",
  ],
  "images/a0020-jmac_MG_6225.dng.jpg": [
    "images/a0020-jmac_MG_6225.dng.jpg_sharpen_20.jpg",
    "images/a0020-jmac_MG_6225.dng.jpg_sharpen_40.jpg",
    "images/a0020-jmac_MG_6225.dng.jpg_sharpen_60.jpg",
    "images/a0020-jmac_MG_6225.dng.jpg_sharpen_80.jpg",
    "images/a0020-jmac_MG_6225.dng.jpg_sharpen_100.jpg",
  ],
  "images/a0410-jmac_DSC2754.dng.jpg": [
    "images/a0410-jmac_DSC2754.dng.jpg_sharpen_20.jpg",
    "images/a0410-jmac_DSC2754.dng.jpg_sharpen_40.jpg",
    "images/a0410-jmac_DSC2754.dng.jpg_sharpen_60.jpg",
    "images/a0410-jmac_DSC2754.dng.jpg_sharpen_80.jpg",
    "images/a0410-jmac_DSC2754.dng.jpg_sharpen_100.jpg",
  ],
  "images/a0568-_MG_1090.dng.jpg": [
    "images/a0568-_MG_1090.dng.jpg_sharpen_20.jpg",
    "images/a0568-_MG_1090.dng.jpg_sharpen_40.jpg",
    "images/a0568-_MG_1090.dng.jpg_sharpen_60.jpg",
    "images/a0568-_MG_1090.dng.jpg_sharpen_80.jpg",
    "images/a0568-_MG_1090.dng.jpg_sharpen_100.jpg",
  ],
  "images/a1781-LS051026_day_10_LL003.dng.jpg": [
    "images/a1781-LS051026_day_10_LL003.dng.jpg_sharpen_20.jpg",
    "images/a1781-LS051026_day_10_LL003.dng.jpg_sharpen_40.jpg",
    "images/a1781-LS051026_day_10_LL003.dng.jpg_sharpen_60.jpg",
    "images/a1781-LS051026_day_10_LL003.dng.jpg_sharpen_80.jpg",
    "images/a1781-LS051026_day_10_LL003.dng.jpg_sharpen_100.jpg",
  ],
};

// Route to fetch images
app.get("/image", (req, res) => {
  const references = Object.keys(imageMap);
  const randomReference = references[Math.floor(Math.random() * references.length)];
  const evaluatedImages = imageMap[randomReference];
  const randomEvaluated = evaluatedImages[Math.floor(Math.random() * evaluatedImages.length)];

  res.json({
    reference: randomReference,
    evaluated: randomEvaluated,
  });
});

// Route to submit ratings and store them in the database
app.post("/submit-rating", async (req, res) => {
  const { imageUrl, ratings, demographics } = req.body;

  // Extract sharpeningLevel from imageUrl
  const sharpeningLevelMatch = imageUrl.match(/sharpen_(\d+)/);
  const sharpeningLevel = sharpeningLevelMatch ? parseInt(sharpeningLevelMatch[1], 10) : null;

  // Validate input
  if (
    !imageUrl ||
    !ratings ||
    ratings.realism == null ||
    ratings.quality == null ||
    sharpeningLevel == null ||
    !demographics ||
    !demographics.age ||
    !demographics.gender ||
    !demographics.email
  ) {
    return res.status(400).json({ error: "Missing required fields including demographics" });
  }

  try {
    const query = `
      INSERT INTO ratings (
        image_url, realism, quality, sharpening_level, age, gender, email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await pool.query(query, [
      imageUrl,
      ratings.realism,
      ratings.quality,
      sharpeningLevel,
      demographics.age,
      demographics.gender,
      demographics.email,
    ]);

    res.status(200).json({ message: "Final rating submitted successfully." });
  } catch (error) {
    console.error("❌ Error saving rating:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// Route to fetch ratings for images (without user info)
app.get("/image-ratings", async (req, res) => {
  try {
    // Query to get ratings data from the database
    const result = await pool.query(
      `SELECT image_url, sharpening_level, quality, realism 
       FROM ratings`
    );

    // Structure the response data
    const imageRatings = {};

    result.rows.forEach((row) => {
      if (!imageRatings[row.image_url]) {
        imageRatings[row.image_url] = {
          image: row.image_url,
          results: [],
        };
      }

      // Add sharpening results
      imageRatings[row.image_url].results.push({
        sharpen_level: row.sharpening_level,
        quality: row.quality,
        realism: row.realism,
      });
    });

    // Convert object to array format
    const responseData = Object.values(imageRatings);

    res.json(responseData);
  } catch (error) {
    console.error("❌ Error fetching image ratings:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});


// psql -h database-2.cy9wkqygejc4.us-east-1.rds.amazonaws.com -U postgres -d testname
// pass: Coganglen1909