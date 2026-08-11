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

### Deploying imagerank to production

Production host is `hkoren@atlas` (`hkoren` has passwordless sudo; the app itself runs as
the unprivileged `imagerank` user). Apache terminates TLS for
`imagerank.imatest.com` and:
- serves the SPA from `DocumentRoot /vhosts/psychophysics/imagerank/client/dist`
  (`FallbackResource /index.html`), and
- reverse-proxies `/api` and `/images` to the Node API on `127.0.0.1:5001`.

The API is a systemd unit, **not** a bare `node` process:
- **Unit:** `imagerank-api.service` (`Restart=always`, so it comes back on its own)
- **Node:** `/usr/local/lib/nodejs/v26.3.0/bin/node index.js`
- **Env:** `EnvironmentFile=/etc/imagerank/imagerank.env` (AWS creds, `DB_PATH`,
  admin seed, Google OAuth). There is no `.env` in the server directory.
- **DB:** SQLite at `/var/lib/imagerank/psychophysics.db` — the only writable path
  the hardened unit is granted (`ReadWritePaths=/var/lib/imagerank`).

Steps:

```bash
# 1. Build the client locally
cd imagerank/client && npm ci && npm run build

# 2. Push server sources (never overwrite node_modules, data/, or .env)
cd imagerank
rsync -av --delete --exclude node_modules --exclude data --exclude .env \
  server/ hkoren@atlas:/vhosts/psychophysics/imagerank/server/

# 3. Refresh server deps on the host (native modules must build there)
ssh hkoren@atlas 'cd /vhosts/psychophysics/imagerank/server && \
  PATH=/usr/local/lib/nodejs/v26.3.0/bin:$PATH npm install'

# 4. Back up the DB, then restart so migrations run
ssh hkoren@atlas 'sudo systemctl stop imagerank-api && \
  sudo cp /var/lib/imagerank/psychophysics.db{,-wal,-shm} /var/lib/imagerank/backups/ && \
  sudo systemctl start imagerank-api'

# 5. Publish the client build
rsync -av --delete client/dist/ hkoren@atlas:/vhosts/psychophysics/imagerank/client/dist/
```

Notes:
- **Schema changes need no manual migration.** `server/db.js` runs idempotent
  `ALTER TABLE`s in `try/catch` at startup, so restarting the service migrates the
  live DB. `schema.sql` uses `CREATE TABLE IF NOT EXISTS` and will *not* add columns
  to an existing database on its own.
- **Always back up before restarting**, since startup mutates the schema. Copy the
  `-wal` and `-shm` files too: the DB runs in WAL mode and is not checkpointed on
  shutdown, so the main `.db` alone can be missing recent writes.
- Run `npm install` (not `--omit=dev`) on the host: `sharp` is a devDependency but
  `make-thumbnails.js` needs it there.
- Deploy the server *before* the client so the new SPA never calls API endpoints
  that aren't live yet.
- Verify with `systemctl status imagerank-api`,
  `journalctl -u imagerank-api -n 50`, and a request to
  `https://imagerank.imatest.com/api/library`.

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
