import cv2
import numpy as np
from process_raw import DngFile
from wand.image import Image
import os
import glob

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
]

# Get the script directory and build absolute paths
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
sharpness_dng_path = os.path.join(project_root, 'images', 'Sharpness')
sharpness_processed_root = os.path.join(project_root, 'processed_images', 'Sharpness')

# Select images based on configuration
if PROCESS_SINGLE_IMAGE:
    sharp_image_files = [SINGLE_IMAGE_NAME]
else:
    # Get all DNG files in the Sharpness directory
    dng_files = glob.glob(os.path.join(sharpness_dng_path, '*.dng'))
    # Extract just the filename without extension
    sharp_image_files = [os.path.splitext(os.path.basename(file))[0] for file in dng_files]

print(f"Found {len(sharp_image_files)} DNG files to process:")
for file in sharp_image_files:
    print(f"  - {file}")

for sharp_image_file in sharp_image_files:
    print(f"\nProcessing: {sharp_image_file}")
    
    sharpness_processed_images = os.path.join(sharpness_processed_root, sharp_image_file)
    isExist = os.path.exists(sharpness_processed_images)
    if not isExist:
        os.makedirs(sharpness_processed_images, exist_ok=True)
    
    # Check if files already exist for this format
    output_path = os.path.join(sharpness_processed_images, sharp_image_file + FILE_EXTENSION)
    if os.path.exists(output_path):
        print(f"  Skipping {sharp_image_file} - files already exist in {IMAGE_FORMAT} format")
        continue
    
    try:
        dng_file_path = os.path.join(sharpness_dng_path, sharp_image_file + '.dng')
        dng = DngFile.read(dng_file_path)
        raw = dng.raw  # np.uint16
        raw_8bit = np.uint8(raw >> (dng.bit-8))
        rgb1 = dng.postprocess()  # demosaicing by rawpy
        
        # Save original as configured format
        cv2.imwrite(output_path, rgb1[:, :, ::-1])
        
        print(f"  Original saved to: {output_path}")

        # Process with wand - apply sharpening based on levels
        total_operations = len(sharpening_levels)
        operation_count = 0
        
        for level, sigma, amount in sharpening_levels:
            if level == 0:
                # Original image (no processing) - already saved above
                operation_count += 1
                progress = operation_count / total_operations * 100
                print(f"    Progress: {progress:.1f}% - Level {level}: Original (no sharpening)")
                continue
                
            # Apply sharpening with specific sigma and amount
            try:
                with Image(filename=output_path) as image:
                    with image.clone() as sharpen:
                        # Convert sigma to actual pixel values: sigma/10 = pixels
                        sigma_pixels = sigma / 10.0
                        # Radius should be about 3*sigma, but max 100 pixels
                        radius = min(sigma_pixels * 3, 100)
                        # Use unsharp_mask which supports amount parameter
                        sharpen.unsharp_mask(radius=radius, sigma=sigma_pixels, amount=amount, threshold=0)
                        # Save the sharpened image with level, sigma (in pixels), and amount in filename
                        sharpened_output = output_path.replace(FILE_EXTENSION, f'_L{level:02d}_s{sigma_pixels:.1f}_a{amount:.1f}{FILE_EXTENSION}')
                        sharpen.save(filename=sharpened_output)
                        
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
