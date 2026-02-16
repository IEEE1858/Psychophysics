import cv2
import numpy as np
import rawpy
import os
import glob
import shutil


def apply_srgb_gamma_float64(image_uint16: np.ndarray) -> np.ndarray:
    """
    Apply sRGB gamma curve in float64 to avoid quantization.
    
    The sRGB standard gamma is:
      - Linear region:  C_srgb = 12.92 * C_linear          for C_linear <= 0.0031308
      - Gamma region:   C_srgb = 1.055 * C_linear^(1/2.4) - 0.055  for C_linear > 0.0031308
    
    Args:
        image_uint16: Linear 16-bit RGB image from rawpy (0-65535)
        
    Returns:
        Gamma-corrected 16-bit RGB image (0-65535) with full 16-bit utilization
    """
    # Convert to float64 for maximum precision during gamma
    img = image_uint16.astype(np.float64) / 65535.0
    
    # Apply sRGB gamma curve
    mask = img <= 0.0031308
    out = np.empty_like(img)
    out[mask] = 12.92 * img[mask]
    out[~mask] = 1.055 * np.power(img[~mask], 1.0 / 2.4) - 0.055
    
    # Convert back to uint16
    result = np.clip(out * 65535.0, 0, 65535).astype(np.uint16)
    
    unique_vals = len(np.unique(result))
    print(f"  After float64 sRGB gamma: {unique_vals:,} unique values (dtype: {result.dtype})")
    
    return result


def apply_bilateral_denoising(image: np.ndarray) -> np.ndarray:
    """
    Apply edge-preserving bilateral denoising to 16-bit image.
    
    Args:
        image: Input RGB image (0-65535, 16-bit)
        
    Returns:
        Denoised RGB image (0-65535, 16-bit)
    """
    try:
        print(f"  Applying bilateral denoising...")
        
        # Bilateral filtering works on float32
        # Convert 16-bit to normalized float32 (0-1)
        image_float = image.astype(np.float32) / 65535.0
        
        # Verify input is 16-bit
        input_unique = len(np.unique(image))
        print(f"    Before denoising: {input_unique:,} unique values")
        
        # Parameters for bilateral filter
        d = 9  # Diameter of pixel neighborhood
        sigma_color = 0.05  # Reduced for gentler denoising
        sigma_space = 35  # Reduced spatial sigma for gentler smoothing
        
        # Apply bilateral filter on float32 image
        denoised_float = cv2.bilateralFilter(
            image_float, 
            d, 
            sigma_color, 
            sigma_space
        )
        
        # Convert back to 16-bit
        denoised = np.clip(denoised_float * 65535.0, 0, 65535).astype(np.uint16)
        
        # Verify 16-bit depth
        unique_values = len(np.unique(denoised))
        print(f"    After denoising: {unique_values:,} unique values (16-bit depth verified)")
        
        return denoised
        
    except Exception as e:
        print(f"    Error applying denoising: {str(e)}")
        return image


def soft_clip(values: np.ndarray, limit: float, softness: float = 0.8) -> np.ndarray:
    """
    Apply soft compression to values approaching the limit.
    Uses rational function x/(1+|x|/limit) instead of tanh to avoid
    posterization — preserves relative differences between edges even
    when values >> limit.
    
    Args:
        values: Input array to clip
        limit: Maximum absolute value before compression
        softness: Not used (kept for API compatibility)
        
    Returns:
        Soft-clipped array, asymptotically approaching ±limit
    """
    return values / (1.0 + np.abs(values) / (limit + 1e-10))


def apply_unsharp_mask_16bit(image: np.ndarray, sigma: float, amount: float, 
                              max_overshoot: float = 0.16, softness: float = 0.95) -> np.ndarray:
    """
    Apply unsharp mask sharpening to 16-bit image via luminance channel.
    Sharpening is applied on Y (Rec. 709 luminance) and transferred back to RGB
    via ratio, preserving color.
    
    Args:
        image: Input RGB image (0-65535, 16-bit)
        sigma: Standard deviation for Gaussian blur (in pixels)
        amount: Strength of sharpening effect
        max_overshoot: Maximum deviation in [0,1] space (~0.08 = ~5200 in 16-bit)
        softness: Soft clipping curve parameter (0.5-1.0). Higher = gentler compression
        
    Returns:
        Sharpened RGB image (0-65535, 16-bit)
    """
    # Convert to float64 for precision
    img_float = image.astype(np.float64) / 65535.0
    
    # Calculate luminance (Rec. 709) - sharpening in luminance domain
    luma = 0.2126 * img_float[:,:,0] + 0.7152 * img_float[:,:,1] + 0.0722 * img_float[:,:,2]
    luma_safe = np.clip(luma, 1e-6, 1.0)  # Protect from division by zero
    
    # Calculate kernel size from sigma (should be odd)
    kernel_size = int(2 * np.ceil(3 * sigma) + 1)
    
    # Apply unsharp mask on luminance
    luma_blurred = cv2.GaussianBlur(luma, (kernel_size, kernel_size), sigma)
    detail = luma - luma_blurred
    detail_ = detail * amount

    # Adaptive overshoot: reduce halos in dark regions where they're most visible.
    # Linear ramp from 50% in darkest areas to 100% in brightest areas.
    # Uses the already-computed blurred luminance as a smooth local brightness
    # reference — no extra computation needed and no edge artifacts.
    #   luma=0.0 (dark)  -> 0.5 * max_overshoot
    #   luma=0.5 (mid)   -> 0.75 * max_overshoot
    #   luma=1.0 (bright) -> 1.0 * max_overshoot
    adaptive_overshoot = max_overshoot * (0.5 + 0.5 * luma_blurred)
    detail_ = soft_clip(detail_, adaptive_overshoot, softness)
    
    # Apply sharpening on luminance
    luma_sharpened = luma + detail_
    luma_sharpened = np.clip(luma_sharpened, 0, 1)
    
    # Brightness preservation: limit mean luminance change to 5%
    mean_orig = np.mean(luma)
    mean_sharp = np.mean(luma_sharpened)
    if mean_orig > 1e-6:
        brightness_ratio = mean_sharp / mean_orig
        max_change = 0.05  # 5%
        if abs(brightness_ratio - 1.0) > max_change:
            target = (1.0 + max_change) if brightness_ratio > 1.0 else (1.0 - max_change)
            luma_sharpened = luma_sharpened * (target / brightness_ratio)
            luma_sharpened = np.clip(luma_sharpened, 0, 1)
    
    # Calculate ratio and apply to RGB - preserves color
    ratio = luma_sharpened / luma_safe
    ratio = ratio[:, :, np.newaxis]
    img_sharpened = img_float * ratio
    img_sharpened = np.clip(img_sharpened, 0, 1)
    
    return (img_sharpened * 65535.0).astype(np.uint16)


def crop_and_resize_to_landscape(image: np.ndarray, filename: str, 
                                  target_width: int, target_height: int,
                                  portrait_crops: dict) -> np.ndarray:
    """
    Crop portrait images to landscape, then resize all images to uniform size.
    
    For portrait images: crop a horizontal band (height crop only, full width kept),
    then resize to target dimensions.
    For landscape images: just resize to target dimensions.
    
    Args:
        image: Input RGB image (uint16, any orientation)
        filename: Base filename (without extension), used to look up portrait crop info
        target_width: Final output width in pixels
        target_height: Final output height in pixels
        portrait_crops: Dict mapping filename -> (y_start_fraction, y_end_fraction)
                        where fractions are relative to original image height
    
    Returns:
        Resized landscape RGB image (uint16) of shape (target_height, target_width, 3)
    """
    h, w = image.shape[:2]
    is_portrait = h > w
    
    if is_portrait and filename in portrait_crops:
        # Portrait image — crop a horizontal band (full width, partial height)
        y_start, y_end = portrait_crops[filename]
        cropped = image[y_start:y_end, :, :]
        print(f"  Portrait crop: y={y_start}..{y_end} (h={y_end-y_start}) from {w}x{h} -> {w}x{y_end-y_start}")
    elif is_portrait:
        print(f"  WARNING: Portrait image '{filename}' has no crop defined! Using center crop with 3:2 AR.")
        crop_h = round(w * 2 / 3)
        y_start = (h - crop_h) // 2
        cropped = image[y_start:y_start + crop_h, :, :]
    else:
        # Landscape — no crop needed
        cropped = image
    
    ch, cw = cropped.shape[:2]
    
    # Resize to target dimensions (using INTER_AREA for downscaling = best quality)
    if cw != target_width or ch != target_height:
        # Work in float32 for 16-bit resize quality
        cropped_f = cropped.astype(np.float32)
        resized_f = cv2.resize(cropped_f, (target_width, target_height), interpolation=cv2.INTER_AREA)
        resized = np.clip(resized_f, 0, 65535).astype(np.uint16)
        print(f"  Resize: {cw}x{ch} -> {target_width}x{target_height}")
    else:
        resized = cropped
        print(f"  No resize needed: already {target_width}x{target_height}")
    
    return resized


# ============================================================================
# Configuration
# ============================================================================
IMAGE_FORMAT = 'png'  # 'jpg' or 'png'
FILE_EXTENSION = f'.{IMAGE_FORMAT}'
PROCESS_SINGLE_IMAGE = False  # True: process only one image, False: process all images
SINGLE_IMAGE_NAME = 'a0020-jmac_MG_6225'  # Image to process if PROCESS_SINGLE_IMAGE is True

# Target output dimensions — all images will be resized to this size.
# Based on smallest landscape image in the dataset (a1832-kme_137: 1944x1296).
# Aspect ratio 3:2 (1.5:1).
TARGET_WIDTH  = 1944
TARGET_HEIGHT = 1296

# Portrait image crop definitions.
# These two images are in portrait orientation and need a landscape crop before resize.
# Crop coordinates are in FULL RESOLUTION pixels (not the small JPEG preview).
# Only Y (height) is cropped — full width is always kept.
#
# Coordinates were determined by user's interactive crop on small JPEG previews
# (1000px tall), then scaled to full resolution and adjusted to exact 3:2 AR.
#
# a0452-IMG_1646: original 2602w x 3906h (portrait)
#   Small JPEG was 666x1000, user selected y=445..901 (center ~672)
#   Full-res scale: 3906/1000 = 3.906
#   Full-res center_y = 672 * 3.906 = 2625
#   Full-res crop height for 3:2 = 2602 * 2/3 = 1735
#   y_start = 2625 - 1735//2 = 1758,  y_end = 1758 + 1735 = 3493
#
# a0470-_MG_7801: original 2920w x 4386h (portrait)
#   Small JPEG was 665x1000, user selected y=489..939 (center ~714)
#   Full-res scale: 4386/1000 = 4.386
#   Full-res center_y = 714 * 4.386 = 3132
#   Full-res crop height for 3:2 = 2920 * 2/3 = 1947
#   y_start = 3132 - 1947//2 = 2159,  y_end = 2159 + 1947 = 4106
#
PORTRAIT_CROPS = {
    'a0452-IMG_1646': (1758, 3493),   # y_start, y_end in full-res pixels
    'a0470-_MG_7801': (2159, 4106),   # y_start, y_end in full-res pixels
}

# Sharpening levels: (level, sigma, amount, max_overshoot)
#
#   level        - Sequential index (0 = no sharpening, 1+ = increasing sharpness)
#   sigma        - Gaussian blur sigma × 10 (20 → 2.0 pixels actual blur radius)
#   amount       - Unsharp mask strength multiplier (higher = more sharpening)
#   max_overshoot - Maximum allowed halo intensity in [0,1] normalized space.
#                   Controls how bright/dark the sharpening halos can get around edges.
#                   e.g. 0.09 = halos limited to ~9% of full range (~5900 in 16-bit)
#                        0.65 = halos can reach ~65% of full range (very aggressive)
#                   The soft_clip function compresses values approaching this limit
#                   so actual halos will be somewhat below this value.
#
# Level 0 is default (no sharpening)
sharpening_levels = [
    # level, sigma, amount, max_overshoot
    (0,  0,  0,     0),      # Default - no sharpening
    (1,  20, 1,   0.09),     # Very subtle sharpening
    (2,  20, 2,   0.11),
    (3,  20, 3,   0.13),
    (4,  20, 4,   0.15),
    (5,  20, 5,   0.17),
    (6,  20, 7,   0.19),
    (7,  20, 9,   0.21),
    (8,  20, 11,  0.23),
    (9,  20, 13,  0.25),
    (10, 20, 15,  0.27),
    (11, 20, 17,  0.29),
    (12, 20, 19,  0.31),
    (13, 20, 21,  0.35),
    (14, 20, 23,  0.40),
    (15, 20, 25,  0.45),
    (16, 20, 30,  0.50),
    (17, 20, 35,  0.55),
    (18, 20, 50,  0.80),     # Very aggressive sharpening
]

# ============================================================================
# Pipeline
# ============================================================================

# Get the script directory and build absolute paths
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = script_dir  # Script is already in code_and_images directory
sharpness_dng_path = os.path.join(project_root, 'images', 'Sharpness')
sharpness_processed_root = os.path.join(project_root, 'processed_images', 'sharpness_15_02_2026')


# Create output directory structure
full_resolution_png_root = os.path.join(sharpness_processed_root, 'full_resolution_png')
small_jpeg_root = os.path.join(sharpness_processed_root, 'small_jpeg')

# Do NOT delete existing directories — keep previous results for comparison
os.makedirs(full_resolution_png_root, exist_ok=True)
os.makedirs(small_jpeg_root, exist_ok=True)

# Select images based on configuration
if PROCESS_SINGLE_IMAGE:
    sharp_image_files = [SINGLE_IMAGE_NAME]
else:
    # Get all DNG files in the Sharpness directory
    dng_files = glob.glob(os.path.join(sharpness_dng_path, '*.dng'))
    # Extract just the filename without extension, keep original case
    sharp_image_files = [os.path.splitext(os.path.basename(file))[0] for file in dng_files]

# Check for potential name conflicts
if len(sharp_image_files) != len(set(sharp_image_files)):
    print("WARNING: Duplicate image names detected after removing extensions!")
    print("This may cause overwrites. Please check your DNG filenames.")
    from collections import Counter
    name_counts = Counter(sharp_image_files)
    duplicates = [name for name, count in name_counts.items() if count > 1]
    print(f"Duplicate names: {duplicates}")

print(f"Found {len(sharp_image_files)} DNG files to process:")
for file in sharp_image_files:
    print(f"  - {file}")
print(f"\nTarget output size: {TARGET_WIDTH}x{TARGET_HEIGHT} (AR={TARGET_WIDTH/TARGET_HEIGHT:.3f})")
print(f"Portrait images with crop: {list(PORTRAIT_CROPS.keys())}")

# Track processing results
processed_files = 0
failed_files = 0
total_images_created = 0

for sharp_image_file in sharp_image_files:
    print(f"\nProcessing: {sharp_image_file}")
    
    # Sanitize filename to avoid path issues (replace problematic characters)
    safe_filename = sharp_image_file.replace('/', '_').replace('\\', '_')
    
    try:
        dng_file_path = os.path.join(sharpness_dng_path, sharp_image_file + '.dng')
        
        # ---- Step 1: Demosaic (linear output) ----
        with rawpy.imread(dng_file_path) as raw_img:
            rgb_linear = raw_img.postprocess(
                use_camera_wb=True,        # Apply camera white balance
                output_bps=16,             # 16-bit output
                output_color=rawpy.ColorSpace.sRGB,  # sRGB color space
                gamma=(1, 1),              # LINEAR - no gamma (we do it in float64)
                no_auto_bright=False,      # Apply auto brightness/exposure
                bright=1.0,               # Normal brightness
                demosaic_algorithm=rawpy.DemosaicAlgorithm.AHD  # High quality demosaicing
            )
        
        unique_after_demosaic = len(np.unique(rgb_linear))
        print(f"  After demosaicing (linear): {unique_after_demosaic:,} unique values (dtype: {rgb_linear.dtype}, shape: {rgb_linear.shape})")
        
        # ---- Step 2: Apply sRGB gamma in float64 ----
        rgb_gamma = apply_srgb_gamma_float64(rgb_linear)
        
        unique_after_gamma = len(np.unique(rgb_gamma))
        print(f"  After float64 gamma total: {unique_after_gamma:,} unique values")
        
        # ---- Step 3: Crop portrait images (before denoise — no reason to denoise pixels we discard) ----
        rgb_cropped = crop_and_resize_to_landscape(
            rgb_gamma, sharp_image_file,
            target_width=TARGET_WIDTH, target_height=TARGET_HEIGHT,
            portrait_crops=PORTRAIT_CROPS
        )
        
        # ---- Step 4: Skip bilateral denoising (no_bf variant) ----
        rgb_denoised = rgb_cropped  # No denoising — use cropped image directly
        print(f"  Skipping bilateral denoising (no_bf mode)")
        print(f"  Image shape: {rgb_denoised.shape}")
        

        # ---- Step 5: Save base image (Level 0 = no sharpening) ----
        output_path_png = os.path.join(full_resolution_png_root, safe_filename + '_no_bf.png')
        output_path_jpg = os.path.join(small_jpeg_root, safe_filename + '_no_bf.jpg')
        
        # Convert denoised 16-bit to 8-bit for saving
        rgb_denoised_8bit = (rgb_denoised / 256).astype(np.uint8)
        
        # Save full resolution PNG (convert RGB to BGR for cv2)
        cv2.imwrite(output_path_png, rgb_denoised_8bit[:, :, ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 6])
        print(f"  Original full PNG saved to: {output_path_png}")
        
        # Create downscaled version for JPEG (max 1000px on longest side)
        height, width = rgb_denoised_8bit.shape[:2]
        if height > width:
            new_height = min(1000, height)
            new_width = int((width * new_height) / height)
        else:
            new_width = min(1000, width)
            new_height = int((height * new_width) / width)
        
        if new_width != width or new_height != height:
            rgb_denoised_small = cv2.resize(rgb_denoised_8bit, (new_width, new_height), interpolation=cv2.INTER_AREA)
        else:
            rgb_denoised_small = rgb_denoised_8bit
        
        # Save small JPEG (convert RGB to BGR for cv2)
        cv2.imwrite(output_path_jpg, rgb_denoised_small[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 70])
        print(f"  Original small JPEG saved to: {output_path_jpg}")

        # ---- Step 6: Apply sharpening levels ----
        total_operations = len(sharpening_levels)
        operation_count = 0
        
        for level, sigma, amount, overshoot in sharpening_levels:
            if level == 0:
                # Original image (no sharpening) - already saved above
                operation_count += 1
                progress = operation_count / total_operations * 100
                print(f"    Progress: {progress:.1f}% - Level {level}: Original (no sharpening)")
                continue
                
            try:
                # Convert sigma to actual pixel values: sigma/10 = pixels
                sigma_pixels = sigma / 10.0
                
                # Apply 16-bit unsharp mask on the denoised (and resized) image
                rgb_sharpened = apply_unsharp_mask_16bit(rgb_denoised, sigma_pixels, amount, max_overshoot=overshoot)
                
                # Verify 16-bit depth after sharpening
                unique_after_sharpen = len(np.unique(rgb_sharpened))
                print(f"      After sharpening L{level}: {unique_after_sharpen:,} unique values (dtype: {rgb_sharpened.dtype})")
                
                # Convert to 8-bit for saving
                rgb_sharpened_8bit = (rgb_sharpened / 256).astype(np.uint8)
                
                # Save full resolution PNG
                sharpened_output_png = os.path.join(full_resolution_png_root, 
                    f'{safe_filename}_L{level:02d}_s{sigma_pixels:.1f}_a{amount:.1f}_no_bf.png')
                cv2.imwrite(sharpened_output_png, rgb_sharpened_8bit[:, :, ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 6])
                
                # Create downscaled version for JPEG
                if new_width != width or new_height != height:
                    rgb_sharpened_small = cv2.resize(rgb_sharpened_8bit, (new_width, new_height), interpolation=cv2.INTER_AREA)
                else:
                    rgb_sharpened_small = rgb_sharpened_8bit
                
                # Save small JPEG
                sharpened_output_jpg = os.path.join(small_jpeg_root,
                    f'{safe_filename}_L{level:02d}_s{sigma_pixels:.1f}_a{amount:.1f}_no_bf.jpg')
                cv2.imwrite(sharpened_output_jpg, rgb_sharpened_small[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 70])
                        
                operation_count += 1
                progress = operation_count / total_operations * 100
                print(f"    Progress: {progress:.1f}% - Level {level}: Sigma: {sigma_pixels:.1f}px, Amount: {amount:.1f}")
                    
            except Exception as e:
                print(f"    Error processing level {level} (sigma {sigma}, amount {amount}): {str(e)}")
                operation_count += 1
                continue
                
        print(f"  Completed processing {sharp_image_file}")
        processed_files += 1
        total_images_created += len(sharpening_levels) * 2  # Each level creates 2 files (PNG and JPEG)
        
    except Exception as e:
        print(f"  Error processing {sharp_image_file}: {str(e)}")
        failed_files += 1
        continue

# Print summary
print("\n" + "="*50)
print("PROCESSING SUMMARY")
print("="*50)
print(f"Total files processed: {processed_files}")
print(f"Failed files: {failed_files}")
print(f"Sharpening variations per image: {len(sharpening_levels)}")
print(f"Total images created: {total_images_created}")
print(f"Output size: {TARGET_WIDTH}x{TARGET_HEIGHT} for all images")
print("="*50)
