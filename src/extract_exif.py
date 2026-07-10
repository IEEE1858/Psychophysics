#!/usr/bin/env python3
"""Extract a capture-summary EXIF sidecar from the original DNG files (issue #37).

The processed JPEGs uploaded to S3 carry no EXIF (opencv/Wand strip it), so the
imagerank [i] button reads source-image metadata from a sidecar produced here.

The sidecar is keyed by *base image id* — the DNG filename without its extension,
which is exactly the baseId the server parses out of each JPEG filename (e.g.
`a0020-jmac_MG_6225.dng` -> `a0020-jmac_MG_6225`).

Usage:
    python3 extract_exif.py OUTPUT.json DNG_DIR [DNG_DIR ...]

Example:
    python3 extract_exif.py exif.json ./sharpness_dng ./hdr_dng
    aws s3 cp exif.json s3://psychophysics-images/images/metadata/exif.json

Requires exiftool on PATH:
    macOS:  brew install exiftool
    Ubuntu: sudo apt-get install libimage-exiftool-perl
"""

import json
import os
import shutil
import subprocess
import sys


# exiftool tags we read (human-readable values, not -n), mapped to sidecar keys.
def summarize(tags):
    """Map one exiftool record to the standard capture summary the UI shows."""
    make = tags.get("Make")
    model = tags.get("Model")
    # exiftool often prefixes the model with the make; avoid "Canon Canon EOS…".
    if make and model and model.startswith(make + " "):
        model = model[len(make) + 1:]

    def first(*keys):
        for key in keys:
            value = tags.get(key)
            if value not in (None, ""):
                return value
        return None

    fnumber = first("FNumber", "Aperture")
    iso = first("ISO", "ISOSpeed")
    width = first("ImageWidth", "ExifImageWidth")
    height = first("ImageHeight", "ExifImageHeight")

    summary = {
        "make": make,
        "model": model,
        "lens": first("LensModel", "LensID", "Lens"),
        "focalLength": first("FocalLength"),
        "fNumber": f"f/{fnumber}" if fnumber is not None else None,
        "exposureTime": first("ExposureTime", "ShutterSpeed"),
        "iso": int(iso) if isinstance(iso, (int, float)) else iso,
        "dateTaken": first("DateTimeOriginal", "CreateDate"),
        "width": int(width) if isinstance(width, (int, float)) else width,
        "height": int(height) if isinstance(height, (int, float)) else height,
    }
    # Drop empty fields so the sidecar stays compact; the UI only shows present ones.
    return {key: value for key, value in summary.items() if value not in (None, "")}


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 1
    if not shutil.which("exiftool"):
        print("error: exiftool not found on PATH (see the header for install steps).", file=sys.stderr)
        return 2

    output_path, *dng_dirs = argv[1:]

    images = {}
    for dng_dir in dng_dirs:
        if not os.path.isdir(dng_dir):
            print(f"warning: not a directory, skipping: {dng_dir}", file=sys.stderr)
            continue

        # One exiftool call per directory returns a JSON array of records.
        result = subprocess.run(
            ["exiftool", "-json", "-ext", "dng",
             "-Make", "-Model", "-LensModel", "-LensID", "-Lens",
             "-FocalLength", "-FNumber", "-Aperture",
             "-ExposureTime", "-ShutterSpeed", "-ISO", "-ISOSpeed",
             "-DateTimeOriginal", "-CreateDate",
             "-ImageWidth", "-ImageHeight", "-ExifImageWidth", "-ExifImageHeight",
             dng_dir],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            print(f"exiftool error for {dng_dir}: {result.stderr.strip()}", file=sys.stderr)
            continue

        for record in json.loads(result.stdout or "[]"):
            source = record.get("SourceFile", "")
            base_id = os.path.splitext(os.path.basename(source))[0]
            if base_id:
                images[base_id] = summarize(record)

    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump({"images": images}, handle, indent=2)

    print(f"Wrote {len(images)} image(s) to {output_path}")
    if images:
        sample_id = next(iter(images))
        print(f"Sample — {sample_id}: {json.dumps(images[sample_id])}")
    print("\nNext: upload it so the server can read it:")
    print("  aws s3 cp", output_path, "s3://psychophysics-images/images/metadata/exif.json")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
