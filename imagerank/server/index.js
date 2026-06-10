const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const cors = require("cors");
const express = require("express");
const {
  createParticipant,
  updateParticipant,
  markParticipantComplete,
  participantExists,
  recordRanking,
  getParticipantWithRankings,
  exportAll,
  exportRankingsFlat,
  verifyAdmin,
  adminUserExists,
  createAdminUser,
  listAdminUsers,
  listSubmissions,
  getSubmissionDetail,
} = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 5001);
const CACHE_TTL_MS = 5 * 60 * 1000;
const S3_REGION = "us-east-1";
const S3_BUCKET = "psychophysics-images";
const S3_PUBLIC_BASE_URL = "https://psychophysics-images.s3.us-east-1.amazonaws.com";

const s3 = new S3Client({
  region: S3_REGION,
});

const COLLECTIONS = [
  {
    id: "sharpness",
    label: "Sharpness",
    prefix: "images/sharpness_final/full_res_jpg/",
    publicBaseUrl: `${S3_PUBLIC_BASE_URL}/images/sharpness_final/full_res_jpg`,
    parser: parseSharpnessFile,
  },
  {
    id: "hdr",
    label: "HDR",
    prefix: "images/HDR_final/full_res_jpg/",
    publicBaseUrl: `${S3_PUBLIC_BASE_URL}/images/HDR_final/full_res_jpg`,
    parser: parseHdrFile,
  },
];

let libraryCache = {
  expiresAt: 0,
  data: null,
  promise: null,
};

app.use(cors());
app.use(express.json());

function formatLevel(level) {
  return `L${String(level).padStart(2, "0")}`;
}

function parseSharpnessFile(fileName) {
  const processedMatch = fileName.match(/^(.*)_L(\d+)_s([\d.]+)_a([\d.]+)\.jpg$/i);
  if (processedMatch) {
    const [, baseId, levelText, sigmaText, amountText] = processedMatch;
    const level = Number(levelText);

    return {
      baseId,
      level,
      fileName,
      shortLabel: formatLevel(level),
      description: `${formatLevel(level)}  sigma ${sigmaText}  amount ${amountText}`,
      params: {
        sigma: Number(sigmaText),
        amount: Number(amountText),
      },
    };
  }

  const originalMatch = fileName.match(/^(.*)\.jpg$/i);
  if (!originalMatch) {
    return null;
  }

  return {
    baseId: originalMatch[1],
    level: 0,
    fileName,
    shortLabel: "Original",
    description: "Original image",
    params: null,
  };
}

function parseHdrFile(fileName) {
  const match = fileName.match(/^(.*)_L(\d+)_P([\d.]+)_W([\d.]+)_S([\d.]+)\.jpg$/i);
  if (!match) {
    return null;
  }

  const [, baseId, levelText, pText, wText, sText] = match;
  const level = Number(levelText);

  return {
    baseId,
    level,
    fileName,
    shortLabel: level === 0 ? "Original" : formatLevel(level),
    description:
      level === 0
        ? "Original image"
        : `${formatLevel(level)}  P ${pText}  W ${wText}  S ${sText}`,
    params: {
      p: Number(pText),
      w: Number(wText),
      s: Number(sText),
    },
  };
}

async function listS3ObjectKeys(prefix) {
  const keys = [];
  let continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3.send(command);

    for (const item of response.Contents || []) {
      if (item.Key && item.Key.toLowerCase().endsWith(".jpg")) {
        keys.push(item.Key);
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

async function buildCollection({ id, label, prefix, publicBaseUrl, parser }) {
  const keys = await listS3ObjectKeys(prefix);

  const images = new Map();

  for (const key of keys) {
    const fileName = key.slice(prefix.length);
    const variant = parser(fileName);
    if (!variant) {
      continue;
    }

    const image = images.get(variant.baseId) || {
      id: variant.baseId,
      label: variant.baseId,
      variants: [],
    };

    image.variants.push({
      ...variant,
      url: `${publicBaseUrl}/${encodeURIComponent(fileName)}`,
    });

    images.set(variant.baseId, image);
  }

  const sortedImages = Array.from(images.values())
    .map((image) => {
      image.variants.sort((left, right) => left.level - right.level);
      image.maxLevel = image.variants.at(-1)?.level ?? 0;
      const baseVariant = image.variants[0];
      image.thumbnailUrl = baseVariant
        ? `${S3_PUBLIC_BASE_URL}/images/thumbnails/${encodeURIComponent(baseVariant.fileName)}`
        : null;
      return image;
    })
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));

  return {
    id,
    label,
    imageCount: sortedImages.length,
    images: sortedImages,
  };
}

async function buildLibrary() {
  return {
    generatedAt: new Date().toISOString(),
    collections: await Promise.all(COLLECTIONS.map((collection) => buildCollection(collection))),
  };
}

async function getLibrary() {
  if (libraryCache.data && Date.now() < libraryCache.expiresAt) {
    return libraryCache.data;
  }

  if (!libraryCache.promise) {
    libraryCache.promise = buildLibrary()
      .then((data) => {
        libraryCache = {
          data,
          expiresAt: Date.now() + CACHE_TTL_MS,
          promise: null,
        };

        return data;
      })
      .catch((error) => {
        libraryCache = {
          data: null,
          expiresAt: 0,
          promise: null,
        };

        throw error;
      });
  }

  return libraryCache.promise;
}

app.get("/api/library", async (req, res) => {
  try {
    res.json(await getLibrary());
  } catch (error) {
    console.error("Failed to build image library", error);
    res.status(500).json({ error: "Failed to read image list from S3." });
  }
});

// --- Study data collection -------------------------------------------------

// Create a participant from the demographics questionnaire. Returns the new id,
// which the client sends back with each image ranking.
app.post("/api/participants", (req, res) => {
  const demographics = req.body || {};

  if (!demographics.age && !demographics.email) {
    return res.status(400).json({ error: "Missing demographic data." });
  }

  try {
    const participantId = createParticipant(demographics, req.get("user-agent"));
    res.status(201).json({ participantId });
  } catch (error) {
    console.error("Failed to create participant", error);
    res.status(500).json({ error: "Failed to save demographics." });
  }
});

function parseLevel(value) {
  return value == null || value === "" ? null : Number(value);
}

// Record one image's ranking: the processing level judged most realistic and
// highest quality, how far the participant browsed, and how long they spent.
app.post("/api/rankings", (req, res) => {
  const {
    participantId,
    collectionId,
    imageId,
    maxLevel,
    furthestVisitedLevel,
    mostRealisticLevel,
    highestQualityLevel,
    gradingMs,
  } = req.body || {};

  if (participantId == null || !collectionId || !imageId) {
    return res.status(400).json({ error: "participantId, collectionId and imageId are required." });
  }

  if (!participantExists(Number(participantId))) {
    return res.status(404).json({ error: "Unknown participantId." });
  }

  if (maxLevel == null || furthestVisitedLevel == null) {
    return res.status(400).json({ error: "maxLevel and furthestVisitedLevel are required." });
  }

  try {
    recordRanking({
      participantId,
      collectionId,
      imageId,
      maxLevel: Number(maxLevel),
      furthestVisitedLevel: Number(furthestVisitedLevel),
      mostRealisticLevel: parseLevel(mostRealisticLevel),
      highestQualityLevel: parseLevel(highestQualityLevel),
      gradingMs: parseLevel(gradingMs),
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Failed to record ranking", error);
    res.status(500).json({ error: "Failed to save ranking." });
  }
});

// Retrieve a single participant and their rankings. Used to resume a session
// (restore progress) and to prefill the "edit demographics" form.
app.get("/api/participants/:id", (req, res) => {
  const record = getParticipantWithRankings(Number(req.params.id));
  if (!record) {
    return res.status(404).json({ error: "Participant not found." });
  }
  res.json(record);
});

// Update an existing participant's demographics (edit demographics flow).
app.put("/api/participants/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!participantExists(id)) {
    return res.status(404).json({ error: "Participant not found." });
  }
  try {
    updateParticipant(id, req.body || {});
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to update participant", error);
    res.status(500).json({ error: "Failed to update demographics." });
  }
});

// Mark the study as completed for this participant. Unmarked rows are partial.
app.post("/api/participants/:id/complete", (req, res) => {
  const id = Number(req.params.id);
  if (!participantExists(id)) {
    return res.status(404).json({ error: "Participant not found." });
  }
  try {
    markParticipantComplete(id);
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to mark participant complete", error);
    res.status(500).json({ error: "Failed to mark complete." });
  }
});

// Dump everything as JSON for analysis/export.
app.get("/api/export", (_req, res) => {
  res.json(exportAll());
});

function toCsvValue(value) {
  if (value == null) {
    return "";
  }
  const text = String(value);
  // Quote when the value contains a comma, quote, or newline; escape quotes.
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// One CSV row per ranking with the participant's demographics joined in.
app.get("/api/export.csv", (_req, res) => {
  const rows = exportRankingsFlat();
  const columns = [
    "ranking_id", "participant_id", "age", "gender", "email", "self_description",
    "vision_status", "vision_details", "color_blind", "country_of_origin",
    "display_type", "lighting", "collection_id", "image_id", "max_level",
    "furthest_visited_level", "most_realistic_level", "highest_quality_level",
    "grading_ms", "ranked_at", "participant_created_at", "user_agent",
  ];

  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => toCsvValue(row[column])).join(","));
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="imagerank-export.csv"');
  res.send(lines.join("\n"));
});

// --- Admin dashboard (HTTP Basic auth against admin_users) ------------------

function requireAdmin(req, res, next) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Basic\s+(.+)$/i);

  if (match) {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    const username = separatorIndex === -1 ? decoded : decoded.slice(0, separatorIndex);
    const password = separatorIndex === -1 ? "" : decoded.slice(separatorIndex + 1);

    if (verifyAdmin(username, password)) {
      req.adminUsername = username;
      return next();
    }
  }

  res.set("WWW-Authenticate", 'Basic realm="imagerank admin"');
  return res.status(401).json({ error: "Authentication required." });
}

// Lightweight endpoint the login form uses to validate credentials.
app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ username: req.adminUsername });
});

app.get("/api/admin/submissions", requireAdmin, (_req, res) => {
  res.json({ submissions: listSubmissions() });
});

app.get("/api/admin/submissions/:id", requireAdmin, (req, res) => {
  const detail = getSubmissionDetail(Number(req.params.id));
  if (!detail) {
    return res.status(404).json({ error: "Submission not found." });
  }
  res.json(detail);
});

// List existing admin accounts (never returns password hashes).
app.get("/api/admin/users", requireAdmin, (_req, res) => {
  res.json({ users: listAdminUsers() });
});

// Create a new admin account.
app.post("/api/admin/users", requireAdmin, (req, res) => {
  const username = (req.body?.username ?? "").trim();
  const password = req.body?.password ?? "";

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (adminUserExists(username)) {
    return res.status(409).json({ error: "That username already exists." });
  }

  try {
    createAdminUser(username, password);
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Failed to create admin user", error);
    res.status(500).json({ error: "Failed to create admin user." });
  }
});

// Bind to loopback only by default — the service sits behind the Apache reverse
// proxy, so port 5001 must not be reachable from outside the host. Override with
// HOST if the app is ever run without a fronting proxy.
const HOST = process.env.HOST || "127.0.0.1";
app.listen(PORT, HOST, () => {
  console.log(`Interface test server listening on http://${HOST}:${PORT}`);
});