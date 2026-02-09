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
app.use("/images/images-for-web-browser", express.static(path.join("../../images/images-for-web-browser")));

const imageMap = {
  "images/images-for-web-browser/a0304-dgw_137.dng.jpg": [
    "images/images-for-web-browser/a0304-dgw_137.dng.jpg_sharpen_20.jpg",
    // "images/images-for-web-browser/a0304-dgw_137.dng.jpg_sharpen_40.jpg",
    "images/images-for-web-browser/a0304-dgw_137.dng.jpg_sharpen_60.jpg",
    // "images/images-for-web-browser/a0304-dgw_137.dng.jpg_sharpen_80.jpg",
    "images/images-for-web-browser/a0304-dgw_137.dng.jpg_sharpen_100.jpg",
  ],
  "images/images-for-web-browser/a0020-jmac_MG_6225.dng.jpg": [
    "images/images-for-web-browser/a0020-jmac_MG_6225.dng.jpg_sharpen_20.jpg",
    // "images/images-for-web-browser/a0020-jmac_MG_6225.dng.jpg_sharpen_40.jpg",
    "images/images-for-web-browser/a0020-jmac_MG_6225.dng.jpg_sharpen_60.jpg",
    // "images/images-for-web-browser/a0020-jmac_MG_6225.dng.jpg_sharpen_80.jpg",
    "images/images-for-web-browser/a0020-jmac_MG_6225.dng.jpg_sharpen_100.jpg",
  ],
  "images/images-for-web-browser/a0410-jmac_DSC2754.dng.jpg": [
    "images/images-for-web-browser/a0410-jmac_DSC2754.dng.jpg_sharpen_20.jpg",
    // "images/images-for-web-browser/a0410-jmac_DSC2754.dng.jpg_sharpen_40.jpg",
    "images/images-for-web-browser/a0410-jmac_DSC2754.dng.jpg_sharpen_60.jpg",
    // "images/images-for-web-browser/a0410-jmac_DSC2754.dng.jpg_sharpen_80.jpg",
    "images/images-for-web-browser/a0410-jmac_DSC2754.dng.jpg_sharpen_100.jpg",
  ],
  "images/images-for-web-browser/a0568-_MG_1090.dng.jpg": [
    "images/images-for-web-browser/a0568-_MG_1090.dng.jpg_sharpen_20.jpg",
    // "images/images-for-web-browser/a0568-_MG_1090.dng.jpg_sharpen_40.jpg",
    "images/images-for-web-browser/a0568-_MG_1090.dng.jpg_sharpen_60.jpg",
    // "images/images-for-web-browser/a0568-_MG_1090.dng.jpg_sharpen_80.jpg",
    "images/images-for-web-browser/a0568-_MG_1090.dng.jpg_sharpen_100.jpg",
  ],
  "images/images-for-web-browser/a1781-LS051026_day_10_LL003.dng.jpg": [
    "images/images-for-web-browser/a1781-LS051026_day_10_LL003.dng.jpg_sharpen_20.jpg",
    // "images/images-for-web-browser/a1781-LS051026_day_10_LL003.dng.jpg_sharpen_40.jpg",
    "images/images-for-web-browser/a1781-LS051026_day_10_LL003.dng.jpg_sharpen_60.jpg",
    // "images/images-for-web-browser/a1781-LS051026_day_10_LL003.dng.jpg_sharpen_80.jpg",
    "images/images-for-web-browser/a1781-LS051026_day_10_LL003.dng.jpg_sharpen_100.jpg",
  ],
};

// New: Route to expose the full imageMap to the frontend
app.get("/image-map", (req, res) => {
  res.json(imageMap);
});

// Route to fetch a random image pair 
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

  const sharpeningLevelMatch = imageUrl.match(/sharpen_(\d+)/);
  const sharpeningLevel = sharpeningLevelMatch ? parseInt(sharpeningLevelMatch[1], 10) : null;

  if (
    !imageUrl ||
    !ratings || ratings.realism == null || ratings.quality == null ||
    !demographics || !demographics.age || !demographics.gender || !demographics.email ||
    sharpeningLevel == null
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Insert or get existing user
    const userResult = await client.query(
      `INSERT INTO users (
          email, gender, age,
          self_description, vision_status, vision_details,
          color_blind, country_of_origin, display_type, lighting
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (email) DO UPDATE SET
          gender = EXCLUDED.gender,
          age = EXCLUDED.age,
          self_description = EXCLUDED.self_description,
          vision_status = EXCLUDED.vision_status,
          vision_details = EXCLUDED.vision_details,
          color_blind = EXCLUDED.color_blind,
          country_of_origin = EXCLUDED.country_of_origin,
          display_type = EXCLUDED.display_type,
          lighting = EXCLUDED.lighting
      RETURNING id`,
      [
        demographics.email,
        demographics.gender,
        demographics.age,
        demographics.selfDescription,
        demographics.visionStatus,
        demographics.visionDetails || null,
        demographics.colorBlind === "Yes",
        demographics.countryOfOrigin,
        demographics.displayType,
        demographics.lighting,
      ]
    );
    const userId = userResult.rows[0].id;

    // Insert rating
    await client.query(
      `INSERT INTO image_ratings (user_id, image_url, sharpening_level, realism, quality)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, imageUrl, sharpeningLevel, ratings.realism, ratings.quality]
    );

    await client.query("COMMIT");
    res.status(200).json({ message: "Rating submitted successfully." });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Transaction error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Route to fetch ratings for images (without user info)
app.get("/image-ratings", async (req, res) => {
  try {
    // Query to get ratings data from the database
    const result = await pool.query(
      `SELECT image_url, sharpening_level, quality, realism 
       FROM image_ratings`
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

    res.json(Object.values(imageRatings));
  } catch (error) {
    console.error("❌ Error fetching image ratings:", error);
    res.status(500).json({ error: "Database error" });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
