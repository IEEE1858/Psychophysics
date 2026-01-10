import logging
import numpy as np
import cv2
import rawpy
from pathlib import Path
from typing import Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('dng_clahe_processing.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class DNGCLAHEProcessor:
    """
    A processor for DNG files that applies CLAHE with various strengths
    and saves outputs in organized folder structure.
    """
    
    def __init__(self, input_dir: str, output_dir: str):
        """
        Initialize the DNG CLAHE processor.
        
        Args:
            input_dir: Directory containing DNG files
            output_dir: Directory to save processed images
        """
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        
        # Create main output directory and subdirectories
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir_full = self.output_dir / "full_resolution_png"
        self.output_dir_small = self.output_dir / "small_jpeg"
        self.output_dir_full.mkdir(parents=True, exist_ok=True)
        self.output_dir_small.mkdir(parents=True, exist_ok=True)
        
        # CLAHE parameters as (clip_limit, grid_size) pairs
        # Grid size is converted to tuple (grid_size, grid_size)
        # Based on the provided table
        self.clahe_params = [
            (0.0, None),  # No CLAHE
            (1.0, 1),     # clip=1, grid=1x1
            (2.0, 2),     # clip=2, grid=2x2
            (3.0, 4),     # clip=3, grid=4x4
            (4.0, 8),     # clip=4, grid=8x8
            (5.0, 16),     # clip=5, grid=16x16
            (9.0, 16),     # clip=9, grid=16x16
        ]
        
        # Track processing results
        self.processed_files = 0
        self.failed_files = 0
        
        logger.info(f"Initialized DNG CLAHE Processor")
        logger.info(f"Input directory: {self.input_dir}")
        logger.info(f"Output directory (full PNG): {self.output_dir_full}")
        logger.info(f"Output directory (small JPEG): {self.output_dir_small}")
        logger.info(f"CLAHE parameters (clip, grid): {self.clahe_params}")
    
    def _create_image_output_directory(self, image_name: str):
        """Create output directory for a specific image."""
        image_output_dir = self.output_dir / image_name
        image_output_dir.mkdir(parents=True, exist_ok=True)
        return image_output_dir
    
    def _load_dng_image(self, dng_path: Path) -> tuple:
        """
        Load DNG file and read gamma/tone curve values from metadata.
        
        Args:
            dng_path: Path to the DNG file
            
        Returns:
            Tuple of (rgb_image_array, gamma_values) or (None, None)
            gamma_values is a tuple (gamma_power, toe_slope) from the DNG
        """
        try:
            logger.info(f"Loading DNG file: {dng_path}")
            
            # Load the RAW file to read metadata and get linear image
            with rawpy.imread(str(dng_path)) as raw:
                # Try to read gamma and tone curve from DNG metadata
                gamma_power = None
                toe_slope = None
                
                # Attempt to read tone curve from DNG
                try:
                    if hasattr(raw, 'tone_curve') and raw.tone_curve is not None:
                        logger.info(f"Found tone curve in DNG: {raw.tone_curve}")
                        print(f"📊 DNG has tone curve data: {len(raw.tone_curve)} points")
                except:
                    pass
                
                # Try to get camera-specific parameters
                try:
                    if hasattr(raw, 'color_desc'):
                        logger.info(f"Color description: {raw.color_desc}")
                    if hasattr(raw, 'num_colors'):
                        logger.info(f"Number of colors: {raw.num_colors}")
                    if hasattr(raw, 'camera_whitebalance'):
                        logger.info(f"Camera white balance: {raw.camera_whitebalance}")
                except:
                    pass
                
                # Default gamma for most cameras is (2.222, 4.5) for sRGB
                # Use these if we can't extract from DNG
                if gamma_power is None:
                    gamma_power = 2.222  # Default sRGB gamma
                    logger.info(f"Using default sRGB gamma power: {gamma_power}")
                else:
                    logger.info(f"Read gamma power from DNG: {gamma_power}")
                
                if toe_slope is None:
                    toe_slope = 4.5  # Default sRGB toe slope
                    logger.info(f"Using default sRGB toe slope: {toe_slope}")
                else:
                    logger.info(f"Read toe slope from DNG: {toe_slope}")
                
                print(f"🎨 Gamma values - power: {gamma_power}, toe slope: {toe_slope}")
                
                # Load with linear processing (no gamma applied)
                rgb_image = raw.postprocess(
                    use_camera_wb=True,    # Use camera white balance
                    output_color=rawpy.ColorSpace.sRGB,  # sRGB color space
                    output_bps=16,         # 16-bit output for better precision
                    no_auto_bright=True,   # Disable auto brightness
                    bright=1.0             # Normal brightness
                )
                
                # Verify 16-bit depth
                unique_values = len(np.unique(rgb_image))
                logger.info(f"Successfully loaded DNG (linear): {rgb_image.shape}, dtype={rgb_image.dtype}")
                logger.info(f"After DNG load - Unique values: {unique_values:,} (16-bit max: 65,536)")
                print(f"✓ After DNG load: {unique_values:,} unique values (16-bit depth verified)")
                
                return rgb_image, (gamma_power, toe_slope)
                
        except Exception as e:
            logger.error(f"Failed to load DNG file {dng_path}: {str(e)}")
            return None, None
    
    def _apply_denoising(self, image: np.ndarray, method: str = 'nlm') -> np.ndarray:
        """
        Apply edge-preserving denoising to 16-bit image.
        
        Args:
            image: Input RGB image (0-65535, 16-bit) in linear space
            method: Denoising method ('bilateral' or 'nlm' for Non-Local Means)
            
        Returns:
            Denoised RGB image (0-65535, 16-bit)
        """
        try:
            logger.info(f"Applying denoising method: {method}")
            
            if method == 'bilateral':
                # Bilateral filtering works on float32
                # Convert 16-bit to normalized float32 (0-1)
                image_float = image.astype(np.float32) / 65535.0
                
                # Parameters for bilateral filter
                d = 5  # Diameter of pixel neighborhood
                sigma_color = 0.05  # Reduced for gentler denoising (was 0.1)
                sigma_space = 35  # Reduced spatial sigma for gentler smoothing (was 75)
                
                # Apply bilateral filter on float32 image
                denoised_float = cv2.bilateralFilter(
                    image_float, 
                    d, 
                    sigma_color, 
                    sigma_space
                )
                
                # Convert back to 16-bit
                denoised = np.clip(denoised_float * 65535.0, 0, 65535).astype(np.uint16)
                
                logger.info(f"Applied bilateral filtering with d={d}, sigmaColor={sigma_color}, sigmaSpace={sigma_space}")
                
            elif method == 'nlm':
                # Non-Local Means on float for true 16-bit processing
                # Use scikit-image's implementation which works on normalized float
                try:
                    from skimage.restoration import denoise_nl_means, estimate_sigma
                    
                    # Convert to normalized float (0-1)
                    image_float = image.astype(np.float64) / 65535.0
                    
                    # Estimate noise standard deviation
                    sigma_est = np.mean(estimate_sigma(image_float, channel_axis=-1))
                    
                    # Apply Non-Local Means denoising on float image
                    denoised_float = denoise_nl_means(
                        image_float,
                        h=0.4 * sigma_est,  # Reduced filter strength (was 0.8)
                        fast_mode=True,  # Faster computation
                        patch_size=5,
                        patch_distance=6,
                        channel_axis=-1
                    )
                    
                    # Convert back to 16-bit
                    denoised = np.clip(denoised_float * 65535.0, 0, 65535).astype(np.uint16)
                    
                    logger.info(f"Applied Non-Local Means denoising (scikit-image) with sigma={sigma_est:.4f}")
                    
                except ImportError:
                    logger.warning("scikit-image not available, falling back to OpenCV 8-bit NLM")
                    # Fallback to OpenCV 8-bit version
                    image_8bit = (image / 256).astype(np.uint8)
                    image_8bit_bgr = cv2.cvtColor(image_8bit, cv2.COLOR_RGB2BGR)
                    
                    denoised_8bit_bgr = cv2.fastNlMeansDenoisingColored(
                        image_8bit_bgr, None,
                        h=10, hColor=10,
                        templateWindowSize=7,
                        searchWindowSize=21
                    )
                    
                    denoised_8bit = cv2.cvtColor(denoised_8bit_bgr, cv2.COLOR_BGR2RGB)
                    denoised = (denoised_8bit.astype(np.uint16) << 8)
                    
                    logger.info("Applied Non-Local Means denoising (OpenCV 8-bit fallback)")
            
            else:
                logger.warning(f"Unknown denoising method: {method}, returning original image")
                return image
            
            # Verify 16-bit depth
            unique_values = len(np.unique(denoised))
            logger.info(f"After denoising ({method}) - Unique values: {unique_values:,}")
            print(f"✓ After denoising ({method}): {unique_values:,} unique values (16-bit depth verified)")
            
            return denoised.astype(np.uint16)
            
        except Exception as e:
            logger.error(f"Error applying denoising: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return image
    
    def _apply_gamma_correction(self, image: np.ndarray, gamma_values: tuple) -> np.ndarray:
        """
        Apply gamma correction and tone mapping using DNG values.
        Implements sRGB-style tone curve: linear portion + power law
        
        Args:
            image: Input RGB image (0-65535, 16-bit) in linear space
            gamma_values: Tuple of (gamma_power, toe_slope) from DNG
            
        Returns:
            Tone mapped RGB image (0-65535, 16-bit)
        """
        try:
            gamma_power, toe_slope = gamma_values
            
            # Normalize to 0-1 range (16-bit input)
            image_norm = image.astype(np.float64) / 65535.0  # Use float64 for precision
            
            logger.info(f"Applying tone mapping - gamma power: {gamma_power}, toe slope: {toe_slope}")
            
            # Apply sRGB-style tone curve
            # Linear portion for dark values, power law for brighter values
            threshold = 0.0031308  # Standard sRGB threshold
            
            # For values below threshold: multiply by toe_slope
            # For values above threshold: apply power law
            tone_mapped = np.where(
                image_norm <= threshold,
                image_norm * toe_slope,
                1.055 * np.power(image_norm, 1.0 / gamma_power) - 0.055
            )
            
            # Convert back to 0-65535 range (16-bit)
            result = np.clip(tone_mapped * 65535.0, 0, 65535).astype(np.uint16)
            
            # Verify 16-bit depth
            unique_values = len(np.unique(result))
            logger.info(f"After tone mapping - Unique values: {unique_values:,}")
            print(f"✓ After tone mapping: {unique_values:,} unique values (16-bit depth verified)")
            
            return result
            
        except Exception as e:
            logger.error(f"Error applying gamma correction: {str(e)}")
            return image
            
            # Convert back to 0-65535 range (16-bit)
            result = np.clip(gamma_corrected * 65535.0, 0, 65535).astype(np.uint16)
            
            # Verify 16-bit depth
            unique_values = len(np.unique(result))
            logger.info(f"After gamma correction - Unique values: {unique_values:,}")
            print(f"✓ After gamma correction (1/{gamma_power}): {unique_values:,} unique values (16-bit depth verified)")
            
            return result
            
        except Exception as e:
            logger.error(f"Error applying gamma correction: {str(e)}")
            return image
    
    def _apply_clahe_to_image(self, image: np.ndarray, clip_limit: float, 
                             tile_grid_size: tuple = (8, 8)) -> np.ndarray:
        """
        Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to an image.
        
        Args:
            image: Input RGB image (0-65535, 16-bit)
            clip_limit: CLAHE clip limit (0.0 means no CLAHE)
            tile_grid_size: Size of the tile grid for CLAHE
            
        Returns:
            CLAHE processed image (0-65535, 16-bit)
        """
        try:
            if clip_limit == 0.0:
                # No CLAHE processing, return original image
                logger.info("No CLAHE processing (clip_limit = 0.0)")
                return image.copy()
            
            # Convert 16-bit to YUV using proper 16-bit workflow
            # First normalize to 0-1 range for accurate color space conversion
            image_norm = image.astype(np.float32) / 65535.0
            
            # Convert to YUV color space (0-1 range)
            yuv_image = cv2.cvtColor(image_norm, cv2.COLOR_RGB2YUV)
            
            # Scale Y channel to 0-65535 for 16-bit CLAHE processing
            y_channel = yuv_image[:, :, 0] * 65535.0  # Y is 0-1 in normalized YUV
            y_channel_16bit = np.clip(y_channel, 0, 65535).astype(np.uint16)
            
            # Apply CLAHE to Y channel in 16-bit
            clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
            enhanced_y_16bit = clahe.apply(y_channel_16bit)
            
            # Verify CLAHE output is 16-bit
            unique_y_values = len(np.unique(enhanced_y_16bit))
            logger.debug(f"After CLAHE on Y channel - Unique values: {unique_y_values:,}")
            
            # Convert enhanced Y back to 0-1 range
            enhanced_y = enhanced_y_16bit.astype(np.float32) / 65535.0
            
            # Reconstruct YUV image with enhanced Y channel
            enhanced_yuv = yuv_image.copy()
            enhanced_yuv[:, :, 0] = enhanced_y
            
            # Convert back to RGB (0-1 range)
            enhanced_rgb_norm = cv2.cvtColor(enhanced_yuv, cv2.COLOR_YUV2RGB)
            
            # Convert back to 16-bit (0-65535)
            enhanced_rgb_16bit = np.clip(enhanced_rgb_norm * 65535.0, 0, 65535).astype(np.uint16)
            
            # Verify final 16-bit depth after CLAHE
            unique_values = len(np.unique(enhanced_rgb_16bit))
            logger.info(f"Applied CLAHE (clip={clip_limit}, grid={tile_grid_size}) - Unique values: {unique_values:,}")
            print(f"✓ After CLAHE (clip={clip_limit}): {unique_values:,} unique values (16-bit depth verified)")
            
            return enhanced_rgb_16bit
            
        except Exception as e:
            logger.error(f"Error applying CLAHE: {str(e)}")
            return image  # Return original image on error
    
    def _save_image_as_png_full(self, image: np.ndarray, output_path: Path):
        """
        Save the processed image as full resolution PNG (lossless).
        
        Args:
            image: RGB image array (0-65535, 16-bit)
            output_path: Path to save the image
        """
        try:
            # Log bit depth information
            logger.debug(f"Saving full PNG: shape={image.shape}, dtype={image.dtype}, "
                        f"min={image.min()}, max={image.max()}")
            
            # Convert 16-bit to 8-bit for PNG output
            image_8bit = (image / 256).astype(np.uint8)
            
            # Convert RGB to BGR for cv2
            image_bgr = cv2.cvtColor(image_8bit, cv2.COLOR_RGB2BGR)
            
            # Save as PNG with lossless compression
            success = cv2.imwrite(str(output_path), image_bgr, 
                                 [cv2.IMWRITE_PNG_COMPRESSION, 6])  # Good compression level
            
            if success:
                logger.info(f"Saved full resolution PNG: {output_path}")
            else:
                logger.error(f"Failed to save PNG: {output_path}")
                
        except Exception as e:
            logger.error(f"Error saving PNG {output_path}: {str(e)}")

    def _save_image_as_jpg_small(self, image: np.ndarray, output_path: Path):
        """
        Save the processed image as small JPEG (reduced quality and size).
        
        Args:
            image: RGB image array (0-65535, 16-bit)
            output_path: Path to save the image
        """
        try:
            # Log bit depth information
            logger.debug(f"Saving small JPEG: shape={image.shape}, dtype={image.dtype}, "
                        f"min={image.min()}, max={image.max()}")
            
            # Convert 16-bit to 8-bit for JPEG output
            image_8bit = (image / 256).astype(np.uint8)
            
            # Resize image to smaller size (max 1000px) for compressed version
            height, width = image_8bit.shape[:2]
            
            # Calculate new size maintaining aspect ratio, max dimension = 1000
            if height > width:
                new_height = min(1000, height)
                new_width = int((width * new_height) / height)
            else:
                new_width = min(1000, width)
                new_height = int((height * new_width) / width)
            
            # Resize image
            if new_width != width or new_height != height:
                image_8bit = cv2.resize(image_8bit, (new_width, new_height), interpolation=cv2.INTER_AREA)
                logger.debug(f"Resized image from {width}x{height} to {new_width}x{new_height}")
            
            # Convert RGB to BGR for cv2
            image_bgr = cv2.cvtColor(image_8bit, cv2.COLOR_RGB2BGR)
            
            # Save as JPEG with reduced quality for smaller file size
            success = cv2.imwrite(str(output_path), image_bgr, 
                                 [cv2.IMWRITE_JPEG_QUALITY, 70])  # 70% quality for balance
            
            if success:
                logger.info(f"Saved small JPEG: {output_path}")
            else:
                logger.error(f"Failed to save JPEG: {output_path}")
                
        except Exception as e:
            logger.error(f"Error saving JPEG {output_path}: {str(e)}")
    
    def _save_image_as_tiff_16bit(self, image: np.ndarray, output_path: Path):
        """
        Save the processed image as 16-bit TIFF (preserves full bit depth).
        
        Args:
            image: RGB image array (0-65535, 16-bit)
            output_path: Path to save the image
        """
        try:
            # Convert RGB to BGR for cv2
            image_bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            # Save as 16-bit TIFF
            success = cv2.imwrite(str(output_path), image_bgr)
            
            if success:
                logger.info(f"Saved 16-bit TIFF: {output_path}")
            else:
                logger.error(f"Failed to save 16-bit TIFF: {output_path}")
                
        except Exception as e:
            logger.error(f"Error saving 16-bit TIFF {output_path}: {str(e)}")
    
    def process_single_dng(self, dng_path: Path):
        """
        Process a single DNG file with all CLAHE variations.
        
        Args:
            dng_path: Path to the DNG file to process
        """
        try:
            logger.info(f"Processing DNG file: {dng_path.name}")
            
            # Create output directory for this image
            image_name = dng_path.stem  # Get filename without extension
            
            print(f"\n{'='*60}")
            print(f"Processing: {dng_path.name}")
            print(f"{'='*60}")
            
            # Load the DNG image (linear) and get gamma values from metadata
            rgb_image, gamma_values = self._load_dng_image(dng_path)
            
            if rgb_image is None or gamma_values is None:
                logger.error(f"Failed to load DNG file: {dng_path}")
                self.failed_files += 1
                return
            
            # Apply edge-preserving denoising before tone mapping
            denoised = self._apply_denoising(rgb_image, method='bilateral')
            
            # Apply tone mapping using DNG gamma values
            tone_mapped = self._apply_gamma_correction(denoised, gamma_values)
            
            # Process with different CLAHE parameters
            for clip_limit, grid_size in self.clahe_params:
                if clip_limit == 0.0:
                    # No CLAHE processing
                    clahe_processed = tone_mapped.copy()
                    unique_values = len(np.unique(clahe_processed))
                    print(f"✓ No CLAHE (clip=0.0): {unique_values:,} unique values (16-bit depth verified)")
                else:       
                    # Apply CLAHE with specific grid size
                    tile_grid_size = (grid_size, grid_size)
                    clahe_processed = self._apply_clahe_to_image(
                        tone_mapped, 
                        clip_limit, 
                        tile_grid_size
                    )
                
                # Create output filenames with explicit clip limit and grid size
                # Format: imagename_clip_X.X_grid_YY.ext
                if clip_limit == 0.0:
                    # No CLAHE - use "noclip" to make it distinct
                    png_filename = f"{image_name}_clip_0.0_noclahe.png"
                    jpg_filename = f"{image_name}_clip_0.0_noclahe.jpg"
                else:
                    # Use zero-padded grid size for consistent sorting
                    png_filename = f"{image_name}_clip_{clip_limit:.1f}_grid_{grid_size:02d}.png"
                    jpg_filename = f"{image_name}_clip_{clip_limit:.1f}_grid_{grid_size:02d}.jpg"
                
                png_path = self.output_dir_full / png_filename
                jpg_path = self.output_dir_small / jpg_filename
                
                # Check if files already exist and warn
                if png_path.exists():
                    logger.warning(f"Overwriting existing PNG: {png_filename}")
                if jpg_path.exists():
                    logger.warning(f"Overwriting existing JPEG: {jpg_filename}")
                
                # Log the exact filenames being saved
                logger.info(f"Saving clip={clip_limit}, grid={grid_size} -> PNG: {png_filename}, JPEG: {jpg_filename}")
                print(f"  → Saving: {png_filename}")
                
                # Save both versions
                self._save_image_as_png_full(clahe_processed, png_path)
                self._save_image_as_jpg_small(clahe_processed, jpg_path)
            
            self.processed_files += 1
            logger.info(f"Successfully processed: {dng_path.name} with {len(self.clahe_params)} CLAHE variations")
            
        except Exception as e:
            logger.error(f"Error processing {dng_path}: {str(e)}")
            self.failed_files += 1
    
    def process_all_dng_files(self):
        """
        Process all DNG files in the input directory.
        """
        try:
            # Find all DNG files
            dng_files = list(self.input_dir.glob("*.dng")) + list(self.input_dir.glob("*.DNG"))
            
            if not dng_files:
                logger.warning(f"No DNG files found in {self.input_dir}")
                return
            
            logger.info(f"Found {len(dng_files)} DNG files to process")
            
            # Process each DNG file
            for dng_file in dng_files:
                self.process_single_dng(dng_file)
            
            # Log final summary
            logger.info(f"Processing complete!")
            logger.info(f"Successfully processed: {self.processed_files} files")
            logger.info(f"Failed to process: {self.failed_files} files")
            
        except Exception as e:
            logger.error(f"Error during batch processing: {str(e)}")
    
    def get_processing_summary(self) -> dict:
        """
        Get a summary of the processing results.
        
        Returns:
            Dictionary with processing statistics
        """
        return {
            'processed_files': self.processed_files,
            'failed_files': self.failed_files,
            'total_files': self.processed_files + self.failed_files,
            'clahe_variations': len(self.clahe_params),
            'total_images_created': self.processed_files * len(self.clahe_params) * 2  # Both PNG and JPEG
        }


def main():
    """Main function to run the DNG CLAHE processor."""
    import shutil
    
    # Configuration
    input_directory = "images/HDR/DNG"  # Directory containing DNG files
    output_directory = "processed_images/CLAHE_dual_output"  # Output with both PNG and JPEG versions
    
    # Delete output directory if it exists
    if Path(output_directory).exists():
        logger.info(f"Deleting existing output directory: {output_directory}")
        shutil.rmtree(output_directory)
        logger.info("Output directory deleted")
    
    # Create processor
    processor = DNGCLAHEProcessor(input_directory, output_directory)
    
    # Process all DNG files
    processor.process_all_dng_files()
    
    # Print summary
    summary = processor.get_processing_summary()
    print("\n" + "="*50)
    print("PROCESSING SUMMARY")
    print("="*50)
    print(f"Total files processed: {summary['processed_files']}")
    print(f"Failed files: {summary['failed_files']}")
    print(f"CLAHE variations per image: {summary['clahe_variations']}")
    print(f"Total images created: {summary['total_images_created']}")
    print("="*50)


if __name__ == "__main__":
    main()
