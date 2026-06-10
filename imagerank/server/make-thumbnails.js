// One-off script: generate 256px-wide thumbnails for all L0 (unprocessed) images
// and upload them to s3://psychophysics-images/images/thumbnails/<filename>
//
// Run: node make-thumbnails.js

const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3')
const sharp = require('sharp')
const path = require('path')

const BUCKET = 'psychophysics-images'
const THUMBNAIL_PREFIX = 'images/thumbnails/'
const THUMBNAIL_WIDTH = 256

const SOURCE_PREFIXES = [
  'images/HDR_final/full_res_jpg/',
  'images/sharpness_final/full_res_jpg/',
]

const s3 = new S3Client({ region: 'us-east-1' })

async function listAll(prefix) {
  const keys = []
  let token
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
    }))
    for (const obj of res.Contents ?? []) {
      keys.push(obj.Key)
    }
    token = res.IsTruncated ? res.NextContinuationToken : null
  } while (token)
  return keys
}

function isUnprocessed(key) {
  if (!key.endsWith('.jpg') && !key.endsWith('.jpeg') && !key.endsWith('.png')) return false
  // HDR: level 0 is marked _L0_ in the filename
  // Sharpness: unprocessed images have no _L<n>_ suffix at all
  return /_L0[_.]/.test(key) || !/_L\d+[_.]/.test(key)
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function thumbnailExists(destKey) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: destKey }))
    return true
  } catch {
    return false
  }
}

async function procesImage(key) {
  const filename = path.basename(key)
  const destKey = `${THUMBNAIL_PREFIX}${filename}`

  if (await thumbnailExists(destKey)) {
    console.log(`  skip (exists): ${filename}`)
    return
  }

  // Download
  const getRes = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const inputBuffer = await streamToBuffer(getRes.Body)

  // Resize to 256px wide, preserve aspect ratio
  const outputBuffer = await sharp(inputBuffer)
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  // Upload
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: destKey,
    Body: outputBuffer,
    ContentType: 'image/jpeg',
  }))

  console.log(`  done: ${filename}`)
}

async function main() {
  const allKeys = []
  for (const prefix of SOURCE_PREFIXES) {
    const keys = await listAll(prefix)
    allKeys.push(...keys.filter(isUnprocessed))
  }

  console.log(`Found ${allKeys.length} unprocessed (L0) images. Creating thumbnails…\n`)

  let ok = 0
  let failed = 0
  for (const key of allKeys) {
    try {
      await procesImage(key)
      ok++
    } catch (err) {
      console.error(`  ERROR: ${key} — ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone. ${ok} processed, ${failed} failed.`)
  console.log(`Thumbnails at: s3://${BUCKET}/${THUMBNAIL_PREFIX}`)
}

main()
