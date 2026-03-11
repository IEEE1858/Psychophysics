const fs = require("fs");
const path = require("path");

const cors = require("cors");
const express = require("express");

const app = express();
const PORT = Number(process.env.PORT || 5001);

const SHARPNESS_DIR = "/Users/henrykoren/imatest/Psychophysics/psychophysics-images/images/sharpness_final/full_res_jpg";
const HDR_DIR = "/Users/henrykoren/imatest/Psychophysics/psychophysics-images/images/HDR_final/full_res_jpg";

app.use(cors());

app.use("/images/sharpness", express.static(SHARPNESS_DIR));
app.use("/images/hdr", express.static(HDR_DIR));

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

function buildCollection({ id, label, directory, parser }) {
  const files = fs
    .readdirSync(directory)
    .filter((fileName) => fileName.toLowerCase().endsWith(".jpg"));

  const images = new Map();

  for (const fileName of files) {
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
      url: `/images/${id}/${encodeURIComponent(fileName)}`,
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

function buildLibrary() {
  return {
    generatedAt: new Date().toISOString(),
    collections: [
      buildCollection({
        id: "sharpness",
        label: "Sharpness",
        directory: SHARPNESS_DIR,
        parser: parseSharpnessFile,
      }),
      buildCollection({
        id: "hdr",
        label: "HDR",
        directory: HDR_DIR,
        parser: parseHdrFile,
      }),
    ],
  };
}

app.get("/api/library", (req, res) => {
  try {
    res.json(buildLibrary());
  } catch (error) {
    console.error("Failed to build image library", error);
    res.status(500).json({ error: "Failed to read image folders." });
  }
});

app.listen(PORT, () => {
  console.log(`Interface test server listening on http://localhost:${PORT}`);
});