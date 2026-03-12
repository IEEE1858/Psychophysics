const AWS = require("aws-sdk");
const cors = require("cors");
const express = require("express");

const app = express();
const PORT = Number(process.env.PORT || 5001);
const CACHE_TTL_MS = 5 * 60 * 1000;
const S3_REGION = "us-east-1";
const S3_BUCKET = "psychophysics-images";
const S3_PUBLIC_BASE_URL = "https://psychophysics-images.s3.us-east-1.amazonaws.com";

const s3 = new AWS.S3({
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
  let marker;

  do {
    const request = {
      Bucket: S3_BUCKET,
      Prefix: prefix,
      Marker: marker,
    };

    const response = await s3.listObjects(request).promise();

    for (const item of response.Contents || []) {
      if (item.Key && item.Key.toLowerCase().endsWith(".jpg")) {
        keys.push(item.Key);
      }
    }

    const lastKey = response.Contents?.at(-1)?.Key;
    marker = response.IsTruncated ? response.NextMarker || lastKey : undefined;
  } while (marker);

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

app.listen(PORT, () => {
  console.log(`Interface test server listening on http://localhost:${PORT}`);
});