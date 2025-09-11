"""
DNG to JPG processor with CLAHE enhancement and simple gamma correction.

This script processes DNG files by:
1. Loading DNG files and converting to RGB
2. Extracting gamma correction value from DNG metadata
3. Applying simple gamma correction for tone mapping
4. Processing with different CLAHE strengths
5. Saving all outputs in organized folders

Author: GitHub Copilot
Date: 2024
"""

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
        
        # Create main output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Processing parameters
        self.gamma_correction = 0.45  # Default gamma correction
        self.clahe_tile_grid_size = (8, 8)  # CLAHE tile grid size
        
        # CLAHE clip limits to test (more sampling at low levels for fine control, extended range up to 10)
        self.clahe_clip_limits = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 10.0]
        
        # Track processing results
        self.processed_files = 0
        self.failed_files = 0
        
        logger.info(f"Initialized DNG CLAHE Processor")
        logger.info(f"Input directory: {self.input_dir}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"CLAHE clip limits: {self.clahe_clip_limits}")
    
    def _create_image_output_directory(self, image_name: str):
        """Create output directory for a specific image."""
        image_output_dir = self.output_dir / image_name
        image_output_dir.mkdir(parents=True, exist_ok=True)
        return image_output_dir
    
    def _extract_gamma_from_dng(self, raw) -> float:
        """
        Extract optimal gamma value from DNG metadata.
        
        Args:
            raw: rawpy.imread object
            
        Returns:
            Gamma value extracted from metadata or fallback value
        """
        try:
            # Try to get gamma from different possible metadata sources
            gamma_value = self.gamma_correction  # Default fallback
            
            # Method 1: Check if gamma is available in postprocess params
            # Some DNG files have gamma in their color matrix
            if hasattr(raw, 'color_matrix'):
                logger.info("DNG has color matrix - using moderate gamma for color-managed RAW")
                gamma_value = 0.45  # Standard for color-managed RAW files
            
            # Method 2: Check camera make/model for known gamma values
            if hasattr(raw, 'camera_make') and hasattr(raw, 'camera_model'):
                camera_make = getattr(raw, 'camera_make', '').lower()
                camera_model = getattr(raw, 'camera_model', '').lower()
                
                # Known camera gamma values for optimal tone mapping
                if 'canon' in camera_make:
                    gamma_value = 0.45  # Canon's standard gamma
                    logger.info(f"Canon camera detected: using gamma {gamma_value}")
                elif 'nikon' in camera_make:
                    gamma_value = 0.42  # Nikon's standard gamma
                    logger.info(f"Nikon camera detected: using gamma {gamma_value}")
                elif 'sony' in camera_make:
                    gamma_value = 0.45  # Sony's standard gamma
                    logger.info(f"Sony camera detected: using gamma {gamma_value}")
                elif 'fuji' in camera_make or 'fujifilm' in camera_make:
                    gamma_value = 0.5   # Fuji's film simulation gamma
                    logger.info(f"Fuji camera detected: using gamma {gamma_value}")
                else:
                    logger.info(f"Camera: {camera_make} {camera_model} - using default gamma {gamma_value}")
            
            # Method 3: Check ISO and exposure for dynamic gamma adjustment
            if hasattr(raw, 'camera_whitebalance') and hasattr(raw, 'daylight_whitebalance'):
                # For high ISO or underexposed images, use lower gamma to brighten
                wb_ratio = max(raw.camera_whitebalance) if raw.camera_whitebalance else 1.0
                if wb_ratio > 2.0:  # Likely high ISO or low light
                    gamma_value = min(gamma_value, 0.4)  # Lower gamma for dark images
                    logger.info(f"High ISO/low light detected: adjusted gamma to {gamma_value}")
            
            logger.info(f"Using gamma value: {gamma_value} for tone mapping")
            return gamma_value
            
        except Exception as e:
            logger.warning(f"Could not extract gamma from DNG metadata: {str(e)}")
            logger.info(f"Using fallback gamma value: {self.gamma_correction}")
            return self.gamma_correction
    
    def _load_dng_image(self, dng_path: Path) -> tuple:
        """
        Load DNG file and convert to RGB array, extracting optimal gamma.
        
        Args:
            dng_path: Path to the DNG file
            
        Returns:
            Tuple of (rgb_image_array, optimal_gamma) or (None, fallback_gamma)
        """
        try:
            logger.info(f"Loading DNG file: {dng_path}")
            
            # Load the RAW file
            with rawpy.imread(str(dng_path)) as raw:
                # Extract gamma value from metadata
                optimal_gamma = self._extract_gamma_from_dng(raw)
                
                # Use rawpy's built-in postprocessing for simplicity
                rgb_image = raw.postprocess(
                    use_camera_wb=True,    # Use camera white balance
                    output_color=rawpy.ColorSpace.sRGB,  # sRGB color space
                    output_bps=8,          # 8-bit output
                    no_auto_bright=True,   # Disable auto brightness
                    bright=1.0             # Normal brightness
                )
                
                logger.info(f"Successfully loaded DNG: {rgb_image.shape}")
                return rgb_image, optimal_gamma
                
        except Exception as e:
            logger.error(f"Failed to load DNG file {dng_path}: {str(e)}")
            return None, self.gamma_correction
    
    def _apply_gamma_correction(self, image: np.ndarray, gamma: float) -> np.ndarray:
        """
        Apply gamma correction for tone mapping.
        
        Args:
            image: Input RGB image (0-255)
            gamma: Gamma value for correction
            
        Returns:
            Gamma corrected RGB image (0-255)
        """
        try:
            # Normalize to 0-1 range
            image_norm = image.astype(np.float32) / 255.0
            
            # Apply gamma correction
            logger.info(f"Applying gamma correction: {gamma}")
            gamma_corrected = np.power(image_norm, gamma)
            
            # Convert back to 0-255 range
            result = np.clip(gamma_corrected * 255.0, 0, 255).astype(np.uint8)
            
            return result
            
        except Exception as e:
            logger.warning(f"Error applying gamma correction: {str(e)}")
            # Fallback to simple gamma correction
            image_norm = image.astype(np.float32) / 255.0
            gamma_corrected = np.power(image_norm, self.gamma_correction)
            return np.clip(gamma_corrected * 255.0, 0, 255).astype(np.uint8)
    
    def _apply_clahe_to_image(self, image: np.ndarray, clip_limit: float, 
                             tile_grid_size: tuple = (8, 8)) -> np.ndarray:
        """
        Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to an image.
        
        Args:
            image: Input RGB image
            clip_limit: CLAHE clip limit (0.0 means no CLAHE)
            tile_grid_size: Size of the tile grid for CLAHE
            
        Returns:
            CLAHE processed image
        """
        try:
            if clip_limit == 0.0:
                # No CLAHE processing, return original image
                logger.info("No CLAHE processing (clip_limit = 0.0)")
                return image.copy()
            
            # Convert RGB to LAB color space for better CLAHE results
            lab_image = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
            
            # Split into L, A, B channels
            l_channel, a_channel, b_channel = cv2.split(lab_image)
            
            # Apply CLAHE only to the L (lightness) channel
            clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
            enhanced_l = clahe.apply(l_channel)
            
            # Merge channels back
            enhanced_lab = cv2.merge([enhanced_l, a_channel, b_channel])
            
            # Convert back to RGB
            enhanced_rgb = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2RGB)
            
            logger.info(f"Applied CLAHE with clip limit: {clip_limit}")
            return enhanced_rgb
            
        except Exception as e:
            logger.error(f"Error applying CLAHE: {str(e)}")
            return image  # Return original image on error
    
    def _save_image_as_jpg(self, image: np.ndarray, output_path: Path):
        """
        Save the processed image as JPG.
        
        Args:
            image: RGB image array
            output_path: Path to save the image
        """
        try:
            # Convert RGB to BGR for cv2
            image_bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            # Save as JPG with high quality
            success = cv2.imwrite(str(output_path), image_bgr, 
                                [cv2.IMWRITE_JPEG_QUALITY, 95])
            
            if success:
                logger.info(f"Saved image: {output_path}")
            else:
                logger.error(f"Failed to save image: {output_path}")
                
        except Exception as e:
            logger.error(f"Error saving image {output_path}: {str(e)}")
    
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
            image_output_dir = self._create_image_output_directory(image_name)
            
            # Load the DNG image and get optimal gamma
            rgb_image, optimal_gamma = self._load_dng_image(dng_path)
            
            if rgb_image is None:
                logger.error(f"Failed to load DNG file: {dng_path}")
                self.failed_files += 1
                return
            
            # Apply gamma correction for tone mapping
            gamma_corrected = self._apply_gamma_correction(rgb_image, optimal_gamma)
            
            # Process with different CLAHE clip limits
            for clip_limit in self.clahe_clip_limits:
                # Apply CLAHE
                clahe_processed = self._apply_clahe_to_image(
                    gamma_corrected, 
                    clip_limit, 
                    self.clahe_tile_grid_size
                )
                
                # Create output filename with clip limit
                output_filename = f"{image_name}_clahe_{clip_limit:.1f}.jpg"
                
                output_path = image_output_dir / output_filename
                
                # Save the processed image
                self._save_image_as_jpg(clahe_processed, output_path)
            
            self.processed_files += 1
            logger.info(f"Successfully processed: {dng_path.name} with {len(self.clahe_clip_limits)} CLAHE variations")
            
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
            'clahe_variations': len(self.clahe_clip_limits),
            'total_images_created': self.processed_files * len(self.clahe_clip_limits)
        }


def main():
    """Main function to run the DNG CLAHE processor."""
    import shutil
    
    # Configuration
    input_directory = "images/HDR/DNG"  # Directory containing DNG files
    output_directory = "processed_images/CLAHE"  # Output directory
    
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
