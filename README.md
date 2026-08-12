# Image Rank — IEEE 1858 Psychophysics Study

**Live at [imagerank.imatest.com](https://imagerank.imatest.com/)**

A web study that measures how **sharpening** and **HDR tone mapping** change the way people
perceive a photograph. Participants view one image rendered at a series of processing levels and
make two independent choices: the version that is their **favorite**, and the version that looks
**most realistic**.

The premise is that those two choices need not land on the same level — the most realistic
rendering is often not the most attractive one — so the study records them separately and measures
the gap. The results feed the work of the
[IEEE 1858 Camera Perceptual Image Quality](https://sagroups.ieee.org/1858/) working group, which
develops standards for measuring camera image quality the way real viewers experience it.

Because viewing conditions affect the judgement, participants are asked to use a desktop or laptop
in indoor lighting. The home page detects mobile devices and asks the visitor to reopen the study on
a larger screen rather than contributing data from a phone.

---

## Repository layout

| Path | What it is |
| ---- | ---------- |
| `imagerank/` | **The study application** — React + Vite client, Express + SQLite server. The actively developed app and the subject of this README. |
| `src/` | Python image-processing scripts that generate the stimulus images from camera RAW (DNG) files. |
| `hdr/` | HDR-specific processing scripts; some are snapshots of files in `src/`. |
| `test/` | Manual test scripts for the DNG and HDR pipelines. |
| `ieee/` | IEEE 1858 working-group documents (PAR submissions). |
| `marketing/` | Promotional artwork for the study. |

---

## How the study works

1. **Home** (`/`) — what the study is, example images from both collections, and who is running it.
   Mobile visitors are asked to switch to a desktop or laptop.
2. **Demographics** (`/demographics`) — age, gender, vision and color-vision status, country,
   display type, lighting, and **how many minutes the participant has** (15–45).
3. **Playlist** — the client builds a personal set of images sized to that time budget, using the
   running average grading time measured across all participants so far. Collections are drawn
   round-robin starting with the least-sampled one, which keeps Sharpness and HDR balanced. Images
   the participant already ranked are excluded, so a returning visitor never sees the same one
   twice.
4. **Grading** (`/study`) — one image at a time. A slider steps through the processing levels;
   arrow keys move it one level at a time, and the image can be zoomed and panned. The participant
   marks a **Favorite** (`F`) and a **Most Realistic** (`R`) level, which appear as markers on the
   slider track.
   - **Exploration gate**: "Next" is accepted only once the slider has moved at least one level past
     the start. A selection is *not* required to advance — a participant with no preference should
     be able to say so by moving on.
   - A guided tour runs on the first image and can be replayed from the `?` button.
5. **Review** (`/rankings`) — a gallery of everything ranked so far. Any image can be reopened and
   re-ranked; the revision is flagged and its grading time added to the original.
6. **Completion** — a thank-you screen offering more images if there is time left, opt-ins to be
   emailed about the results and about future studies, and links to share the study.

Alongside each ranking the server records how far the participant browsed, how long they spent, how
much of that time they were idle, and the peak zoom they reached — context for interpreting a
selection that a bare level number does not carry.

---

## Architecture

```
                 ┌─────────────────────────── imagerank.imatest.com ───────────────────────────┐
                 │                                                                             │
  Participant ──▶│  Apache (TLS, reverse proxy)                                                │
                 │      │                                                                      │
                 │      ├─ /            ──▶ client/dist          static React build (Vite)     │
                 │      └─ /api/*       ──▶ 127.0.0.1:5001       Express API ──▶ SQLite (WAL)  │
                 │                                                                             │
                 └──────────────────────────────────┬──────────────────────────────────────────┘
                                                    │ ListObjectsV2 (credentialed)
                                                    ▼
                             s3://psychophysics-images   ── full-res JPEGs, thumbnails,
                                                            EXIF sidecar. Image bytes are
                                                            served to the browser directly
                                                            from the bucket's public URL.
```

### Client (`imagerank/client`)

React 19 + Vite, MUI for controls, `react-zoom-pan-pinch` for the image stage, `react-joyride` for
the tour, and Plotly for the admin analytics charts. Routes:

| Route | Purpose |
| ----- | ------- |
| `/` | Home: study description, examples, mobile gate |
| `/preview/:collection`, `/preview/:collection/:image` | Browse the image sets before starting |
| `/demographics` | Questionnaire (also the "edit my answers" flow) |
| `/signin`, `/auth/complete` | Optional participant accounts (password or Google) |
| `/study` | The grading interface; `?rerank=collection:image` revises one image |
| `/rankings` | The participant's own ranked images |
| `/admin`, `/admin/analytics`, `/admin/images/:collection/:image` | Admin dashboard |

Study progress (participant id, playlist, position, demographics) lives in `localStorage`, so
closing the tab and coming back resumes the same session on the same device. Signing in is optional
and exists to move a session **between** devices: an account adopts prior anonymous participation
that used the same email address.

### Server (`imagerank/server`)

Express 5 on Node, with deliberately few dependencies — `node:sqlite` for the database and
`node:crypto` for password hashing (scrypt) and HMAC-signed session tokens, rather than an ORM,
`jsonwebtoken`, or `google-auth-library`.

- **Image library** — `GET /api/library` lists the S3 bucket, parses each filename into a structured
  variant, groups variants by base image, and attaches a thumbnail URL and the EXIF summary. The
  result is cached in memory for 5 minutes. Filenames are the schema:
  - Sharpness: `<baseId>_L<NN>_s<sigma>_a<amount>.jpg`
  - HDR: `<baseId>_L<NN>_P<p>_W<w>_S<s>.jpg`
  - `L00` (or a bare `<baseId>.jpg` in the sharpness set) is the unprocessed original.
- **EXIF** — the processed JPEGs have their metadata stripped, so source-camera details come from a
  sidecar (`images/metadata/exif.json`) generated by `src/extract_exif.py`. A missing or malformed
  sidecar degrades to "no metadata" rather than breaking the library.
- **Data collection** — participants, rankings (upserted per image, with a separate re-rank path
  that accumulates time rather than replacing it), completion, and contact opt-ins.
- **Admin** — HTTP Basic against the `admin_users` table, guarding submissions, per-image detail,
  analytics, contact lists, and admin-user management.

Selected endpoints:

| Endpoint | Notes |
| -------- | ----- |
| `GET /api/library` | Collections, images, variants, thumbnails, EXIF |
| `GET /api/stats/avg-grading-ms`, `/api/stats/collection-counts` | Inputs to playlist sizing and balancing |
| `POST /api/participants`, `PUT/GET /api/participants/:id` | Demographics; resume a session |
| `POST /api/rankings` | One image's selections, timings, and zoom |
| `POST /api/participants/:id/complete` | Marks the session finished (otherwise it is partial) |
| `POST /api/participants/:id/contact-preferences` | Results / future-studies opt-ins |
| `POST /api/auth/register`, `/login`, `/link`; `GET /api/auth/me`, `/google/start`, `/google/callback` | Optional participant accounts |
| `GET /api/export`, `/api/export.csv` | Full data export |
| `GET /api/admin/*` | Submissions, analytics, contact lists, admin users (Basic auth) |

### Database

SQLite in WAL mode, created and migrated on boot: `schema.sql` defines the tables, and a series of
idempotent `ALTER TABLE` statements bring older databases forward (each wrapped in a `try` whose
failure means "already applied"). Tables:

- `participants` — one row per session: demographics, time budget, user agent, completion time, and
  contact opt-ins.
- `image_rankings` — one row per image graded: chosen levels, furthest level browsed, grading and
  idle time, peak zoom, and whether it was revised. Unique per (participant, collection, image).
- `accounts` — optional participant accounts (scrypt password hash and/or Google subject id).
- `admin_users` — dashboard logins, same scrypt hashing.

---

## Running locally

```bash
cd imagerank
npm install                    # root: the concurrently runner
npm --prefix server install    # Express API
npm --prefix client install    # React client
npm run dev                    # Express API on :5001 + Vite client on :5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the API on port 5001.

**AWS credentials** are required for the image library — any credentials (environment or `~/.aws/`)
with `s3:ListBucket` on:

- Bucket `psychophysics-images`, region `us-east-1`
- Public base URL `https://psychophysics-images.s3.us-east-1.amazonaws.com`

**Configuration** — copy `server/.env.example` to `server/.env` (gitignored; the server loads it
automatically):

| Variable | Purpose |
| -------- | ------- |
| `ADMIN_SEED_USERNAME` / `ADMIN_SEED_PASSWORD` | Idempotently seeds an admin account on boot. Unset once the admin exists. |
| `AUTH_TOKEN_SECRET` | Signs participant session tokens. Required in production; a random ephemeral secret is used in dev, so sessions do not survive a restart. |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | Optional Google sign-in. Without them, email + password sign-in still works. |
| `DB_PATH` | SQLite location. Defaults to `server/data/psychophysics.db`. |
| `PORT` / `HOST` | Default `5001` and `127.0.0.1` (loopback only — the public interface is the reverse proxy). |
| `EXIF_METADATA_URL` | Override the EXIF sidecar location. |

Useful commands:

```bash
npm run build                       # production client build -> client/dist
npm --prefix client run lint        # ESLint
node server/make-thumbnails.js      # regenerate + upload 256px thumbnails after adding images
```

---

## Deployment

Production is a single Node process on **atlas**, behind Apache which terminates TLS for
`imagerank.imatest.com` and reverse-proxies `/api` to the app. The server binds to `127.0.0.1` by
design, so port 5001 is never reachable from outside the host.

```bash
# 1. Build the client
cd imagerank
npm run build

# 2. Copy the app (client build included) to the host
rsync -av --exclude node_modules --exclude server/data \
  ./ root@atlas:/vhosts/psychophysics/imagerank/

# 3. Restart the API on the host — the process running:
#    /root/.nvm/versions/node/v26.3.0/bin/node index.js
#    (run `npm install --omit=dev` in server/ first if dependencies changed)
```

Notes for a deploy:

- **Serve `client/dist`** — Apache serves the static build; the API only answers `/api`. Because the
  client is a single-page app, unknown paths must fall through to `index.html` or deep links such as
  `/rankings` will 404.
- **Do not overwrite `server/data/`** — that directory holds the SQLite database and its WAL files.
  It is gitignored, and the `rsync` above excludes it.
- **Migrations run themselves** on the first boot after a deploy; no separate step.
- **Environment** — production values live in the process environment (or `server/.env` on the
  host), not in the repository. `GOOGLE_OAUTH_REDIRECT_URI` must be the public URL
  (`https://imagerank.imatest.com/api/auth/google/callback`) and must match the authorized redirect
  URI registered with the Google OAuth client.
- **New images** land in S3 under the collection prefixes; the library cache picks them up within
  5 minutes. Run `make-thumbnails.js` so they have thumbnails, and refresh the EXIF sidecar if the
  source cameras changed.

---

## Generating the stimulus images

The image sets are produced from camera RAW files by the Python scripts in `src/`, then uploaded to
the `psychophysics-images` bucket in the directory layout the server expects.

- `sharpness_run_final.py` — sweeps unsharp-mask sigma/amount to produce the sharpness levels.
- `HDR_*.py` — the HDR tone-mapping pipeline and its parameter sweeps.
- `find_sharp_param_range.py`, `find_hdr_param_range.py` — explore usable parameter ranges before a
  full run.
- `process_dng_with_clahe.py` — DNG loading and CLAHE experiments.
- `extract_exif.py` — builds the EXIF sidecar consumed by the API.

Dependencies (Python 3.10 or newer):

```bash
pip install https://github.com/wgprojects/PiDNG.git   # pinned fork: avoids a build problem upstream
pip install process_raw opencv-python Wand            # DNG loading, image ops, ImageMagick binding
```

`Wand` requires a local ImageMagick installation.

---

## Image dataset

Study images derive from the [MIT-Adobe FiveK](https://data.csail.mit.edu/graphics/fivek/) dataset.
Per-image license terms (Adobe or Adobe–MIT) are surfaced in the app next to each image's metadata.
