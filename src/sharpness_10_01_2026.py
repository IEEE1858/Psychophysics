import cv2
import numpy as np
from process_raw import DngFile
from wand.image import Image
import os
import glob
import shutil


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


def apply_unsharp_mask_16bit(image: np.ndarray, sigma: float, amount: float) -> np.ndarray:
    """
    Apply unsharp mask sharpening to 16-bit image.
    
    Args:
        image: Input RGB image (0-65535, 16-bit)
        sigma: Standard deviation for Gaussian blur (in pixels)
        amount: Strength of sharpening effect
        
    Returns:
        Sharpened RGB image (0-65535, 16-bit)
    """
    # Convert to float32 for processing
    image_float = image.astype(np.float32)
    
    # Calculate kernel size from sigma (should be odd)
    kernel_size = int(2 * np.ceil(3 * sigma) + 1)
    
    # Create blurred version
    blurred = cv2.GaussianBlur(image_float, (kernel_size, kernel_size), sigma)
    
    # Calculate unsharp mask: original - blurred
    mask = image_float - blurred
    
    # Apply sharpening: original + amount * mask
    sharpened = image_float + amount * mask
    
    # Clip to valid range and convert back to uint16
    sharpened = np.clip(sharpened, 0, 65535).astype(np.uint16)
    
    return sharpened

# Configuration
IMAGE_FORMAT = 'png'  # 'jpg' or 'png'
FILE_EXTENSION = f'.{IMAGE_FORMAT}'
PROCESS_SINGLE_IMAGE = False  # True: process only one image, False: process all images
SINGLE_IMAGE_NAME = 'a0020-jmac_MG_6225'  # Image to process if PROCESS_SINGLE_IMAGE is True

# Sharpening levels: (level, sigma, amount)
# Level 0 is default (no sharpening)
sharpening_levels = [
    (0, 0, 0),      # Default - no sharpening
    (1, 10, 1.0),
    (2, 10, 1.7),
    (3, 15, 1.7),
    (4, 20, 1.7),
    (5, 25, 1.7),
    (6, 25, 2.5),
    (7, 30, 2.5),
    (8, 30, 3.5),
    (9, 40, 3.5),
    (10, 40, 4.5),
    (11, 50, 4.5),
    (12, 60, 4.5),
    (13, 70, 5.0),
    (14, 80, 6.0),
]

# Get the script directory and build absolute paths
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
sharpness_dng_path = os.path.join(project_root, 'images', 'Sharpness')
sharpness_processed_root = os.path.join(project_root, 'processed_images', 'Sharpness')

# Delete existing output directory if it exists
if os.path.exists(sharpness_processed_root):
    print(f"Deleting existing output directory: {sharpness_processed_root}")
    shutil.rmtree(sharpness_processed_root)
    print("Output directory deleted")

# Create fresh output directory with two main folders
full_resolution_png_root = os.path.join(sharpness_processed_root, 'full_resolution_png')
small_jpeg_root = os.path.join(sharpness_processed_root, 'small_jpeg')
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
    # Find duplicates
    from collections import Counter
    name_counts = Counter(sharp_image_files)
    duplicates = [name for name, count in name_counts.items() if count > 1]
    print(f"Duplicate names: {duplicates}")

print(f"Found {len(sharp_image_files)} DNG files to process:")
for file in sharp_image_files:
    print(f"  - {file}")

for sharp_image_file in sharp_image_files:
    print(f"\nProcessing: {sharp_image_file}")
    
    # Sanitize filename to avoid path issues (replace problematic characters)
    safe_filename = sharp_image_file.replace('/', '_').replace('\\', '_')
    
    # Create subdirectories for this image under each format folder
    full_resolution_png_dir = os.path.join(full_resolution_png_root, safe_filename)
    small_jpeg_dir = os.path.join(small_jpeg_root, safe_filename)
    
    # Check if directories already exist (shouldn't happen with fresh delete, but be safe)
    if os.path.exists(full_resolution_png_dir):
        print(f"  WARNING: Output directory already exists: {full_resolution_png_dir}")
    if os.path.exists(small_jpeg_dir):
        print(f"  WARNING: Output directory already exists: {small_jpeg_dir}")
    
    os.makedirs(full_resolution_png_dir, exist_ok=True)
    os.makedirs(small_jpeg_dir, exist_ok=True)
    
    try:
        dng_file_path = os.path.join(sharpness_dng_path, sharp_image_file + '.dng')
        dng = DngFile.read(dng_file_path)
        raw = dng.raw  # np.uint16
        raw_8bit = np.uint8(raw >> (dng.bit-8))
        
        # Use rawpy directly for better control over postprocessing
        # Ensure 16-bit output with proper WB, gamma, and tone mapping
        import rawpy
        with rawpy.imread(dng_file_path) as raw_img:
            rgb1 = raw_img.postprocess(
                use_camera_wb=True,        # Apply camera white balance
                output_bps=16,             # 16-bit output
                output_color=rawpy.ColorSpace.sRGB,  # sRGB color space
                gamma=(2.222, 4.5),        # sRGB gamma and toe slope
                no_auto_bright=False,      # Apply auto brightness/exposure
                bright=1.0,                # Normal brightness
                demosaic_algorithm=rawpy.DemosaicAlgorithm.AHD  # High quality demosaicing
            )
        
        # Verify 16-bit after demosaicing
        unique_after_demosaic = len(np.unique(rgb1))
        print(f"  After demosaicing with gamma/tone mapping: {unique_after_demosaic:,} unique values (dtype: {rgb1.dtype}, shape: {rgb1.shape})")
        
        # Apply bilateral denoising before sharpening
        rgb_denoised = apply_bilateral_denoising(rgb1)
        
        # Verify 16-bit after denoising
        unique_after_denoising = len(np.unique(rgb_denoised))
        print(f"  After denoising: {unique_after_denoising:,} unique values (dtype: {rgb_denoised.dtype}, shape: {rgb_denoised.shape})")
        

        # Define output paths for both formats (using safe_filename)
        output_path_png = os.path.join(full_resolution_png_dir, safe_filename + '.png')
        output_path_jpg = os.path.join(small_jpeg_dir, safe_filename + '.jpg')
        
        # Check if files already exist (shouldn't happen, but be safe)
        if os.path.exists(output_path_png):
            print(f"  WARNING: File already exists and will be overwritten: {output_path_png}")
        if os.path.exists(output_path_jpg):
            print(f"  WARNING: File already exists and will be overwritten: {output_path_jpg}")
        
        # Verify 16-bit after denoising
        unique_after_denoising = len(np.unique(rgb_denoised))
        print(f"  After denoising: {unique_after_denoising:,} unique values (dtype: {rgb_denoised.dtype}, shape: {rgb_denoised.shape})")
        

        # Define output paths for both formats
        output_path_png = os.path.join(full_resolution_png_dir, sharp_image_file + '.png')
        output_path_jpg = os.path.join(small_jpeg_dir, sharp_image_file + '.jpg')
        
        # Convert denoised 16-bit to 8-bit for full resolution PNG
        rgb_denoised_8bit = (rgb_denoised / 256).astype(np.uint8)
        
        # Save denoised original as full resolution PNG (convert RGB to BGR for cv2)
        cv2.imwrite(output_path_png, rgb_denoised_8bit[:, :, ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 6])
        print(f"  Original full PNG saved to: {output_path_png}")
        
        # Create downscaled version for JPEG (max 1000px)
        height, width = rgb_denoised_8bit.shape[:2]
        if height > width:
            new_height = min(1000, height)
            new_width = int((width * new_height) / height)
        else:
            new_width = min(1000, width)
            new_height = int((height * new_width) / width)
        
        # Resize if needed
        if new_width != width or new_height != height:
            rgb_denoised_small = cv2.resize(rgb_denoised_8bit, (new_width, new_height), interpolation=cv2.INTER_AREA)
        else:
            rgb_denoised_small = rgb_denoised_8bit
        
        # Save denoised original as small JPEG (convert RGB to BGR for cv2)
        cv2.imwrite(output_path_jpg, rgb_denoised_small[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 70])
        print(f"  Original small JPEG saved to: {output_path_jpg}")

        # Process with wand - apply sharpening based on levels to 16-bit image
        total_operations = len(sharpening_levels)
        operation_count = 0
        
        for level, sigma, amount in sharpening_levels:
            if level == 0:
                # Original image (no processing) - already saved above
                operation_count += 1
                progress = operation_count / total_operations * 100
                print(f"    Progress: {progress:.1f}% - Level {level}: Original (no sharpening)")
                continue
                
            # Apply sharpening with specific sigma and amount to the 16-bit denoised image
            try:
                # Convert sigma to actual pixel values: sigma/10 = pixels
                sigma_pixels = sigma / 10.0
                
                # Apply 16-bit unsharp mask directly on numpy array
                rgb_sharpened = apply_unsharp_mask_16bit(rgb_denoised, sigma_pixels, amount)
                
                # Verify 16-bit depth after sharpening
                unique_after_sharpen = len(np.unique(rgb_sharpened))
                print(f"      After sharpening L{level}: {unique_after_sharpen:,} unique values (dtype: {rgb_sharpened.dtype})")
                
                # Convert to 8-bit for saving
                rgb_sharpened_8bit = (rgb_sharpened / 256).astype(np.uint8)
                
                # Save full resolution PNG
                sharpened_output_png = os.path.join(full_resolution_png_dir, 
                    f'{safe_filename}_L{level:02d}_s{sigma_pixels:.1f}_a{amount:.1f}.png')
                cv2.imwrite(sharpened_output_png, rgb_sharpened_8bit[:, :, ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 6])
                
                # Create downscaled version for JPEG
                if new_width != width or new_height != height:
                    rgb_sharpened_small = cv2.resize(rgb_sharpened_8bit, (new_width, new_height), interpolation=cv2.INTER_AREA)
                else:
                    rgb_sharpened_small = rgb_sharpened_8bit
                
                # Save small JPEG
                sharpened_output_jpg = os.path.join(small_jpeg_dir,
                    f'{safe_filename}_L{level:02d}_s{sigma_pixels:.1f}_a{amount:.1f}.jpg')
                cv2.imwrite(sharpened_output_jpg, rgb_sharpened_small[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 70])
                        
                operation_count += 1
                progress = operation_count / total_operations * 100
                print(f"    Progress: {progress:.1f}% - Level {level}: Sigma: {sigma_pixels:.1f}px, Amount: {amount:.1f}")
                    
            except Exception as e:
                print(f"    Error processing level {level} (sigma {sigma}, amount {amount}): {str(e)}")
                operation_count += 1
                continue
                
        print(f"  Completed processing {sharp_image_file}")
        
    except Exception as e:
        print(f"  Error processing {sharp_image_file}: {str(e)}")
        continue

print(f"\nProcessing complete!")