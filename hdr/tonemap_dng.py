#!/usr/bin/env python3
# tonemap_dng.py
# Local tone mapping for 16-bit DNGs -> LDR sRGB output + batch processor.

import argparse
import os
import sys
import glob
import numpy as np
import rawpy
import cv2

EPS = 1e-8

def linear_to_srgb(x):
    a = 0.055
    return np.where(
        x <= 0.0031308,
        12.92 * x,
        (1 + a) * np.power(np.clip(x, 0.0, 1.0), 1 / 2.4) - a
    )

def read_dng_linear_rgb16(path, use_camera_wb=True):
    with rawpy.imread(path) as raw:
        rgb16 = raw.postprocess(
            no_auto_bright=True,
            output_bps=16,
            gamma=(1, 1),  # keep linear
            use_camera_wb=use_camera_wb,
            output_color=rawpy.ColorSpace.sRGB,
            demosaic_algorithm=rawpy.DemosaicAlgorithm.AHD,
            half_size=False,
            user_flip=0
        )
    return rgb16  # HxWx3 uint16

def compute_luminance_linear(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]

def bilateral_base(log_lum, sigma_space=16, sigma_color=0.1, downsample=1):
    L = log_lum.astype(np.float32)
    if downsample > 1:
        h, w = L.shape
        Ls = cv2.resize(L, (max(1, w // downsample), max(1, h // downsample)),
                        interpolation=cv2.INTER_AREA)
        Bs = cv2.bilateralFilter(Ls, d=0, sigmaColor=float(sigma_color), sigmaSpace=float(sigma_space))
        B = cv2.resize(Bs, (w, h), interpolation=cv2.INTER_CUBIC)
    else:
        B = cv2.bilateralFilter(L, d=0, sigmaColor=float(sigma_color), sigmaSpace=float(sigma_space))
    return B

def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / max(edge1 - edge0, 1e-8), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)

def tone_map(rgb16,
             stops=0.0,
             compression=0.6,
             detail_amp=1.0,
             shadow_gamma=1.15,
             sigma_space=16,
             sigma_color=0.1,
             downsample=2,
             # highlight protection
             hl_protect=0.75,
             hl_start=0.6,
             hl_end=0.9):
    """
    Local tone mapping with highlight contrast protection.
    """
    # Normalize to [0,1] linear
    rgb = (rgb16.astype(np.float32) / 65535.0)

    # Global exposure in stops
    if stops != 0.0:
        rgb = np.clip(rgb * (2.0 ** stops), 0.0, None)

    # Linear luminance
    Y = compute_luminance_linear(rgb) + EPS
    L = np.log(Y)

    # Base-detail decomposition
    if sigma_color <= 0:
        dyn = float(np.quantile(L, 0.99) - np.quantile(L, 0.01))
        sigma_color_eff = max(0.02, 0.1 * dyn)
    else:
        sigma_color_eff = sigma_color

    base = bilateral_base(L, sigma_space=sigma_space, sigma_color=sigma_color_eff, downsample=downsample)
    detail = L - base

    # Highlight-aware base compression
    p1, p99 = np.percentile(base, [1.0, 99.0])
    base_n = np.clip((base - p1) / max(p99 - p1, 1e-8), 0.0, 1.0)
    w_hi = smoothstep(hl_start, hl_end, base_n)
    comp_local = compression + (1.0 - compression) * (hl_protect * w_hi)

    L_out = base * comp_local + detail * detail_amp

    # Reconstruct, normalize, shadow lift
    Y_out = np.exp(L_out)
    Y_out = Y_out / (np.max(Y_out) + EPS)
    if shadow_gamma is not None and shadow_gamma > 0:
        Y_out = np.power(np.clip(Y_out, 0.0, 1.0), 1.0 / float(shadow_gamma))

    ratio = (Y_out + EPS) / (Y + EPS)
    rgb_local = np.clip(rgb * ratio[..., None], 0.0, 1.0)

    # Display transfer
    srgb = linear_to_srgb(rgb_local)
    return np.clip(srgb, 0.0, 1.0)

def save_jpeg(path, srgb, quality=95):
    """Write sRGB image to JPEG (8-bit)."""
    bgr8 = (np.clip(srgb * 255.0 + 0.5, 0, 255)).astype(np.uint8)[..., ::-1]
    # Make sure parent folder exists
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ok = cv2.imwrite(path, bgr8, [int(cv2.IMWRITE_JPEG_QUALITY), int(quality)])
    if not ok:
        raise RuntimeError(f"Failed to write {path}")

def derive_output_path(inp, out, out_bps):
    if out:
        return out
    root, _ = os.path.splitext(inp)
    ext = ".png" if out_bps == 16 else ".png"
    return f"{root}_tonemapped_{out_bps}bit{ext}"

# ---------------- Batch Processing ----------------

# ---------------- Batch Presets ----------------
# Each preset can optionally override:
#   'compression', 'detail_amp', 'hl_protect', 'hl_start', 'hl_end'
# If not provided, the global CLI/defaults are used.

PRESETS = [
    # 1) Minimally processed
    {
        "id": 1,
        "shadow_gamma": 1.0,
        "stops": 0.0,
        "compression": 1.0,   # no base compression
        "detail_amp": 1.0,    # no detail boost
        "hl_protect": 0.0     # disable highlight protection
    },
    # 2) shadow_gamma 1.15, stops 0.5
    {"id": 2, "shadow_gamma": 1.15, "stops": 0.5},
    # 3) shadow_gamma 1.25, stops 1.0
    {"id": 3, "shadow_gamma": 1.25, "stops": 1.0},
    # 4) shadow_gamma 1.5, stops 1.5
    {"id": 4, "shadow_gamma": 1.5, "stops": 1.5},
    # 5) shadow_gamma 1.75, stops 1.75
    {"id": 5, "shadow_gamma": 1.75, "stops": 1.75},
    # 6) shadow_gamma 2.0, stops 2.0
    {"id": 6, "shadow_gamma": 2.0, "stops": 2.0},
]

def slug_float(x):
    # Safe float string for filenames
    return f"{x:.2f}".rstrip('0').rstrip('.') if '.' in f"{x:.2f}" else f"{x:.2f}"

def process_folder_batch(
    in_glob="images/HDR/DNG/*.dng",
    out_dir="processed_images",
    use_camera_wb=True,
    compression=0.6,
    detail_amp=1.0,
    sigma_space=16,
    sigma_color=0.1,
    downsample=2,
    hl_protect=0.75,
    hl_start=0.6,
    hl_end=0.9,
    jpeg_quality=95
):
    """Process all DNGs in in_glob with the six requested presets (incl. minimal)."""
    files = sorted(glob.glob(in_glob))
    if not files:
        print(f"No DNG files found for pattern: {in_glob}", file=sys.stderr)
        return 1

    os.makedirs(out_dir, exist_ok=True)

    for f in files:
        try:
            rgb16 = read_dng_linear_rgb16(f, use_camera_wb=use_camera_wb)
        except Exception as e:
            print(f"[SKIP] Failed to read {f}: {e}", file=sys.stderr)
            continue

        base_name = os.path.splitext(os.path.basename(f))[0]

        for preset in PRESETS:
            pid = preset["id"]
            sg  = preset["shadow_gamma"]
            st  = preset["stops"]

            # Effective params = global defaults overridden by preset if provided
            eff_compression = preset.get("compression", compression)
            eff_detail_amp  = preset.get("detail_amp", detail_amp)
            eff_hl_protect  = preset.get("hl_protect", hl_protect)
            eff_hl_start    = preset.get("hl_start", hl_start)
            eff_hl_end      = preset.get("hl_end", hl_end)

            try:
                srgb = tone_map(
                    rgb16,
                    stops=st,
                    compression=eff_compression,
                    detail_amp=eff_detail_amp,
                    shadow_gamma=sg,
                    sigma_space=sigma_space,
                    sigma_color=sigma_color,
                    downsample=downsample,
                    hl_protect=eff_hl_protect,
                    hl_start=eff_hl_start,
                    hl_end=eff_hl_end
                )
                out_name = f"{base_name}__preset{pid}__sg-{slug_float(sg)}_st-{slug_float(st)}.jpg"
                out_path = os.path.join(out_dir, out_name)
                save_jpeg(out_path, srgb, quality=jpeg_quality)
                print(f"Wrote: {out_path}")
            except Exception as e:
                print(f"[SKIP] {f} (preset{pid}, sg={sg}, st={st}): {e}", file=sys.stderr)
                continue
    return 0

# ---------------- CLI ----------------

def main():
    p = argparse.ArgumentParser(description="Local tone map a 16-bit HDR DNG into an LDR sRGB image, with optional batch mode.")
    p.add_argument("input", nargs="?", help="Input .dng file (omit if using --batch)")
    p.add_argument("-o", "--output", default=None, help="Output image path (PNG/JPG/TIF) for single-file mode.")
    p.add_argument("--stops", type=float, default=0.0, help="Global exposure boost in stops (2**stops) [single-file mode]")
    p.add_argument("--compression", type=float, default=0.6, help="Base compression (<1 compresses DR)")
    p.add_argument("--detail", type=float, default=1.0, help="Detail amplification")
    p.add_argument("--shadow_gamma", type=float, default=1.15, help=">1 lifts shadows/mids (gentle) [single-file mode]")
    p.add_argument("--sigma_space", type=float, default=16.0, help="Bilateral spatial sigma (pixels)")
    p.add_argument("--sigma_color", type=float, default=0.1, help="Bilateral range sigma (log-luminance units). <=0 = auto")
    p.add_argument("--downsample", type=int, default=2, help="Speedup for base extraction (1=no downsample)")
    p.add_argument("--no_camera_wb", action="store_true", help="Ignore camera white balance")
    # highlight protection
    p.add_argument("--hl_protect", type=float, default=0.75, help="0..1 highlight contrast protection strength")
    p.add_argument("--hl_start", type=float, default=0.6, help="Start of highlight protection (normalized log-lum)")
    p.add_argument("--hl_end", type=float, default=0.9, help="End of highlight protection (normalized log-lum)")
    # batch
    p.add_argument("--batch", action="store_true", help="Process images/HDR/DNG/*.dng with 5 presets to processed_images/*.jpg")
    p.add_argument("--in_glob", default="images/HDR/DNG/*.dng", help="Glob for batch input")
    p.add_argument("--out_dir", default="processed_images", help="Output directory for batch mode")
    p.add_argument("--jpeg_quality", type=int, default=95, help="JPEG quality for outputs (batch or if output ends with .jpg)")

    args = p.parse_args()

    if args.batch:
        # Batch mode ignores single-file --stops / --shadow_gamma and uses presets
        rc = process_folder_batch(
            in_glob=args.in_glob,
            out_dir=args.out_dir,
            use_camera_wb=not args.no_camera_wb,
            compression=args.compression,
            detail_amp=args.detail,
            sigma_space=args.sigma_space,
            sigma_color=args.sigma_color,
            downsample=args.downsample,
            hl_protect=args.hl_protect,
            hl_start=args.hl_start,
            hl_end=args.hl_end,
            jpeg_quality=args.jpeg_quality
        )
        sys.exit(rc)

    # Single-file mode
    if not args.input:
        print("Error: provide an input file or use --batch", file=sys.stderr)
        sys.exit(2)

    if not os.path.isfile(args.input):
        print(f"Input not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    rgb16 = read_dng_linear_rgb16(args.input, use_camera_wb=not args.no_camera_wb)
    srgb = tone_map(
        rgb16,
        stops=args.stops,
        compression=args.compression,
        detail_amp=args.detail,
        shadow_gamma=args.shadow_gamma,
        sigma_space=args.sigma_space,
        sigma_color=args.sigma_color,
        downsample=args.downsample,
        hl_protect=args.hl_protect,
        hl_start=args.hl_start,
        hl_end=args.hl_end
    )

    # If user specified .jpg, write JPEG, else use OpenCV default by extension
    out_path = args.output
    if out_path is None:
        root, _ = os.path.splitext(args.input)
        out_path = f"{root}_tonemapped.jpg"

    if out_path.lower().endswith(".jpg") or out_path.lower().endswith(".jpeg"):
        save_jpeg(out_path, srgb, quality=args.jpeg_quality)
    else:
        # Fallback writer for non-JPEG single-file outputs
        bgr = (np.clip(srgb * 255.0 + 0.5, 0, 255)).astype(np.uint8)[..., ::-1]
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        if not cv2.imwrite(out_path, bgr):
            raise RuntimeError(f"Failed to write {out_path}")
    print(f"Wrote: {out_path}")

if __name__ == "__main__":
    main()
