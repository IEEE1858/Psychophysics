# Security considerations

This study collects personally identifiable information (PII) — participant
email addresses and demographics — alongside their image rankings. The notes
below describe how that data and the project's secrets are protected, and what
still needs attention before a wider deployment.

## Stored data is never committed to the repository

Participant data lives in a SQLite database, and the admin/seed secrets live in
an environment file. Both are excluded from git so they can never be disclosed
in the repository:

- **Database** — `imagerank/server/data/psychophysics.db` (+ `-wal`/`-shm`).
  Ignored by `imagerank/server/.gitignore` (`data`) and, as defense-in-depth, by
  the root `.gitignore` (`*.db`, `*.db-wal`, `*.db-shm`, `*.sqlite*`, `data/`).
- **Secrets** — `imagerank/server/.env` (admin seed credentials, optional
  `DB_PATH`). Ignored everywhere; only the secret-free `.env.example` template is
  committed.

Verify nothing sensitive is tracked:

```bash
git ls-files | grep -iE '\.(db|sqlite|env)$|/data/'   # should print nothing sensitive
git check-ignore imagerank/server/.env imagerank/server/data/psychophysics.db
```

> **Note:** `.gitignore` does not untrack files that were already committed. If a
> database or a real secret is ever committed, remove it from the index
> (`git rm --cached <file>`), rotate the exposed secret, and consider scrubbing
> history (`git filter-repo`).

## Secrets management

- The admin account is seeded from `ADMIN_SEED_USERNAME` / `ADMIN_SEED_PASSWORD`
  (no password in source). In dev these come from the gitignored
  `imagerank/server/.env`; in production set them in the process environment.
- Admin passwords are stored only as salted **scrypt** hashes (`node:crypto`),
  never in plaintext.
- AWS credentials for the S3 image bucket are read from the environment /
  `~/.aws`, never from the repo.
- In production, set `DB_PATH` to a stable location **outside** the rsync'd
  deploy directory so deploys can't overwrite — or accidentally publish — the
  collected data.

## Transport

Serve the app over **HTTPS only**. The admin dashboard uses HTTP Basic auth, so
its credentials travel in a request header and must not cross plaintext HTTP.

## Known gaps to address before wider exposure

- **`GET /api/participants/:id` is unauthenticated and keyed by a sequential
  integer id.** Anyone who guesses an id can read that participant's email,
  demographics, and rankings. The resume/edit flows rely on this endpoint.
  Recommended fix: issue an unguessable per-session token at participant
  creation, store it client-side, and look sessions up by token instead of id
  (keep the integer id internal/admin-only).
- The legacy `webapp/client/.env.production` / `.env.devlopment` files are
  committed; they currently hold only public API URLs (no secrets), but new
  environment files should follow the gitignore rules above.
