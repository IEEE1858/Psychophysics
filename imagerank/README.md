# Image Rank

The IEEE 1858 psychophysics study application — live at
[imagerank.imatest.com](https://imagerank.imatest.com/).

Purpose, architecture, local setup, and deployment are documented in the
[repository README](../README.md).

Quick start:

```bash
npm install && npm --prefix server install && npm --prefix client install
npm run dev     # Express API on :5001 + Vite client on :5173
```

Requires AWS credentials with `s3:ListBucket` on the `psychophysics-images` bucket
(`us-east-1`), and a `server/.env` copied from `server/.env.example`.
