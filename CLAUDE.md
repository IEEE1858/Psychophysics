# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a psychophysics research project studying human perception of image sharpness and HDR tone mapping. It contains two web applications and Python image-processing scripts.

### Study Purpose

The study measures the perceptual effects of **sharpening** and **HDR image processing**. Each participant reviews an image at different levels of processing, then selects two things:

- the image that is their **favorite**, and
- the image that looks **most realistic**.

A key premise is that the favorite and the most-realistic image may *not* be at the same level of processing — so the two selections are recorded independently.

To keep viewing conditions consistent, participants are asked to use a **desktop or laptop computer in indoor lighting conditions**. The `imagerank` app enforces this expectation: its home page blocks participation on mobile devices and directs the visitor to reopen the study on a desktop/laptop.

## Project Structure

- **`src/`** — Python scripts for image processing (DNG/RAW files, sharpness, HDR tone mapping). These are standalone scripts, not a package.
- **`imagerank/`** — **Primary app** (active development). React + Vite frontend, Express backend. Live at https://imagerank.imatest.com.
- **`webapp/`** — **Legacy app** (being migrated away from). React (CRA) frontend, Express + PostgreSQL backend.
- **`hdr/`** — HDR-specific processing scripts (some are duplicates/snapshots of `src/` files).
- **`test/`** — Manual test scripts for HDR and DNG processing.

## Running the Apps

### imagerank (primary, S3-backed) — https://imagerank.imatest.com

```bash
cd imagerank
npm install
npm run dev          # starts Express API on :5001 + Vite client on :5173
```

Requires AWS credentials (env or `~/.aws/`) with `s3:ListBucket` on the test-image bucket:
- **Bucket:** `psychophysics-images` (region: `us-east-1`)
- **Public base URL:** `https://psychophysics-images.s3.us-east-1.amazonaws.com`

**Deploy:** `rsync` or `scp` changes to `root@atlas:/vhosts/psychophysics/imagerank/`, then restart the server process running `/root/.nvm/versions/node/v26.3.0/bin/node index.js`. Deploy the client build (`npm run build` → `client/dist/`) alongside the server.

### webapp (PostgreSQL-backed)

```bash
# Backend
cd webapp/server
npm install
node server.js       # or: nodemon server  (dev)

# Frontend
cd webapp/client
npm install
npm start            # CRA dev server on :3000
```

Backend requires DB env vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (PostgreSQL on AWS RDS).

## imagerank Architecture

The UI walks participants through every image in a collection (Sharpness or HDR). For each image, a slider moves through discrete processing levels. Two key constraints:

- **Exploration gate**: the participant must move the slider at least one level past the start before "Next" is accepted (`hasExploredEnough` in `App.jsx`, issues #35/#36). A favorite/most-realistic selection is *not* required to advance.
- **Slider markers**: `R` = Most Realistic selection, `F` = Favorite selection. These are saved per-image in `imageStates` (React state, not persisted).

The backend (`imagerank/server/index.js`) lists S3 objects and parses filenames into structured variants. Filename conventions:
- Sharpness: `<baseId>_L<NN>_s<sigma>_a<amount>.jpg`
- HDR: `<baseId>_L<NN>_g<gamma>_s<saturation>.jpg`

The library is cached in memory for 5 minutes (`CACHE_TTL_MS`).

## webapp Architecture

Uses a PostgreSQL database. Schema is in `webapp/schema.sql` — three tables: `users`, `ratings`, `image_ratings`. The backend hardcodes an `imageMap` mapping base images to their sharpening variants. The frontend proxies API calls to `:5000`.

## Python Image Processing

Scripts in `src/` process camera RAW (DNG) files:

- `process_dng_with_clahe.py` — loads DNG via `process_raw`, applies CLAHE, exports JPEG
- `sharpness_run_final.py` / `sharpness_*.py` — iterates over sharpness parameter ranges (sigma, amount), saves output to S3-uploadable directory structure
- `HDR_*.py` — HDR tone mapping pipeline (gamma, saturation sweeps)
- `find_*_param_range.py` — parameter-range exploration scripts

Dependencies: `process_raw`, `opencv-python`, `Wand` (ImageMagick binding), `PiDNG`. Install with:
```bash
pip install https://github.com/wgprojects/PiDNG.git
pip install process_raw opencv-python Wand
```
