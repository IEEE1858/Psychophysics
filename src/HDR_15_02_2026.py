import logging
import numpy as np
import cv2
import rawpy
from pathlib import Path
from typing import Optional, Tuple
from bm3d import bm3d, BM3DStages
from skimage.restoration import estimate_sigma

# GPU acceleration with CuPy (falls back to NumPy if not available)
GPU_AVAILABLE = False
cp = None
try:
    import cupy as cp
    # Test actual GPU operation to verify CUDA runtime is available
    test_array = cp.zeros((10, 10), dtype=cp.float32)
    _ = cp.power(test_array + 0.5, 2.0)  # This will fail if nvrtc is missing
    del test_array
    GPU_AVAILABLE = True
    gpu_name = cp.cuda.runtime.getDeviceProperties(0)['name'].decode()
    print(f"GPU acceleration enabled: {gpu_name}")
except ImportError:
    print("CuPy not installed, using CPU only")
except Exception as e:
    print(f"CuPy GPU acceleration not available ({type(e).__name__}), using CPU only")
    GPU_AVAILABLE = False
    cp = None 


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
        self.output_dir_full_png = self.output_dir / "full_res_png"
        self.output_dir_full_jpg = self.output_dir / "full_res_jpg"
        self.output_dir_small = self.output_dir / "small_jpg"
        self.output_dir_full_png.mkdir(parents=True, exist_ok=True)
        self.output_dir_full_jpg.mkdir(parents=True, exist_ok=True)
        self.output_dir_small.mkdir(parents=True, exist_ok=True)
        
        # Monotonic increasing sequence of (power_GF, blend_weight, strong_clahe_blend) tuples
        # - power_GF: guided filter detail strength
        # - blend_weight: blend between no-CLAHE and CLAHE (0=none, 1=full)
        # - strong_clahe_blend: blend between CLAHE(clip=15) and CLAHE(clip=80) (0=normal, 1=strong)
        self.processing_sequence = [
            (0.0, 0.0, 0.0),       # 1. Both zero
            (0.1, 0.025, 0.0),     # 2. Interpolated
            (0.15, 0.05, 0.0),     # 3. Very subtle
            (0.2, 0.075, 0.0),     # 4. Very subtle
            (0.25, 0.1, 0.0),      # 5. Subtle
            (0.3, 0.15, 0.0),      # 6. Subtle
            (0.35, 0.2, 0.0),      # 7. Start increasing (CLAHE faster)
            (0.4, 0.25, 0.0),      # 8. Interpolated
            (0.5, 0.3, 0.0),       # 9. Interpolated
            (0.6, 0.4, 0.0),       # 10.
            (0.7, 0.5, 0.0),       # 11. Interpolated
            (0.8, 0.6, 0.0),       # 12.
            (0.9, 0.7, 0.0),       # 13. Interpolated
            (1.1, 0.8, 0.0),       # 14.
            (1.2, 0.9, 0.0),       # 15. Interpolated
            (1.3, 1.0, 0.0),       # 16. CLAHE(15) reaches maximum
            # Extended: blend between CLAHE(clip=15) and CLAHE(clip=80)
            (1.5, 1.0, 0.3),       # 17. 30% strong CLAHE(80)
            (1.7, 1.0, 0.65),      # 18. 65% strong CLAHE(80)
            (2.0, 1.0, 1.0),       # 19. 100% strong CLAHE(80)
        ]
        
        # CLAHE parameters
        self.clahe_clip_limit = 15.0          # Normal CLAHE clip limit
        self.clahe_strong_clip_limit = 80.0   # Strong CLAHE clip limit for extended range
        self.clahe_grid_size = 8              # Grid size for local adaptation (same for both)
        
        # Image standardization — all images → same target size
        # Target: 3:2 landscape at smallest width (no upscaling)
        self.target_width = 2348       # Smallest original width in dataset
        self.target_height = 1565      # = round(2348 / 1.5), 3:2 landscape AR
        
        # Portrait images: ROI center Y for vertical cropping (landscape region from portrait)
        # Values derived from MATLAB imcrop: roi_center_y = y_start + crop_height / 2
        self.portrait_roi_center_y = {
            'a0003-NKIM_MG_8178': 2479,
            'a0089-jn_20080509_245': 1574,
            'a0142-IMG_2048': 1291,
            'a0418-07-11-19-at-13h26m20s-_MG_5018': 2419,
            'a1745-NKIM_MG_6667': 3047,
            'a3998-dgw_041': 2791,
        }
        
        # Track processing results
        self.processed_files = 0
        self.failed_files = 0
        
        logger.info(f"Initialized DNG CLAHE Processor")
        logger.info(f"Input directory: {self.input_dir}")
        logger.info(f"Output directory (full PNG): {self.output_dir_full_png}")
        logger.info(f"Output directory (full JPG): {self.output_dir_full_jpg}")
        logger.info(f"Output directory (small JPG): {self.output_dir_small}")
        logger.info(f"Target image size: {self.target_width}x{self.target_height} (3:2 landscape)")
        logger.info(f"Portrait ROI crops: {list(self.portrait_roi_center_y.keys())}")
        logger.info(f"CLAHE settings: clip_limit={self.clahe_clip_limit}, strong_clip_limit={self.clahe_strong_clip_limit}, grid_size={self.clahe_grid_size}")
        logger.info(f"Processing sequence (power_GF, blend_weight, strong_blend): {self.processing_sequence}")
        logger.info(f"Total variations per image: {len(self.processing_sequence)}")
    
    def _standardize_image(self, image: np.ndarray, dng_path: Path) -> np.ndarray:
        """
        Standardize image to target_width × target_height.
        
        - Portrait images: crop a landscape region centered on user-defined ROI, then downscale
        - Landscape images: downscale to target width only (no height crop)
        - Never upscales
        
        Args:
            image: Raw demosaiced 16-bit image
            dng_path: Path to source file (for ROI lookup)
            
        Returns:
            Standardized image at target_width × target_height
        """
        h, w = image.shape[:2]
        stem = dng_path.stem
        is_portrait = h > w
        
        logger.info(f"  Standardizing: {w}x{h} ({'portrait' if is_portrait else 'landscape'}) -> target {self.target_width}x{self.target_height}")
        
        if is_portrait:
            # Compute crop height that will give target_height after downscaling
            # After crop: w_orig × crop_h → scale to target_width → height = crop_h * target_width / w_orig
            # We want height = target_height, so: crop_h = target_height * w_orig / target_width
            crop_h = int(round(self.target_height * w / self.target_width))
            
            # Get ROI center from lookup - all portraits must have user-defined ROI
            if stem in self.portrait_roi_center_y:
                roi_center = self.portrait_roi_center_y[stem]
                logger.info(f"    Portrait ROI center: y={roi_center}, required crop_h={crop_h}")
            else:
                logger.error(f"    No ROI defined for portrait '{stem}' - SKIPPING (add ROI to portrait_roi_center_y)")
                return image  # Return uncropped - will be wrong size but won't crash
            
            # Center the crop on ROI, clamp to image bounds
            y_start = roi_center - crop_h // 2
            y_start = max(0, min(y_start, h - crop_h))
            y_end = y_start + crop_h
            
            image = image[y_start:y_end, :, :]
            logger.info(f"    Portrait crop: y=[{y_start}:{y_end}] -> {image.shape[1]}x{image.shape[0]}")
            h, w = image.shape[:2]
        
        # Downscale to target width (never upscale)
        if w > self.target_width:
            scale = self.target_width / w
            new_h = int(round(h * scale))
            image = cv2.resize(image, (self.target_width, new_h), interpolation=cv2.INTER_AREA)
            logger.info(f"    Downscaled: {w}x{h} -> {self.target_width}x{new_h} (scale={scale:.4f})")
            h, w = image.shape[:2]
        elif w < self.target_width:
            logger.warning(f"    Width {w} < target {self.target_width} - keeping as-is (no upscale)")
        
        # No height cropping for landscape - keep whatever height results from downscale
        # For portrait, height should be very close to target after ROI crop + downscale (maybe +/-1px rounding)
        if h != self.target_height:
            logger.info(f"    Note: height={h} vs target={self.target_height} (diff={h - self.target_height}px)")
        
        logger.info(f"    Final standardized size: {image.shape[1]}x{image.shape[0]}")
        return image
    
    def _load_dng_linear(self, dng_path: Path) -> Optional[np.ndarray]:
        """
        Load DNG file in LINEAR space (no gamma, no tone mapping).
        
        Args:
            dng_path: Path to the DNG file
            
        Returns:
            Linear RGB image array (16-bit, 0-65535, float representation) or None
        """
        try:
            logger.info(f"Loading DNG file in LINEAR space: {dng_path}")
            
            # Load the RAW file in linear space
            with rawpy.imread(str(dng_path)) as raw:
                # Get linear RGB with auto exposure to determine proper scaling
                # First get a reference with auto exposure
                rgb_ref = raw.postprocess(
                    use_camera_wb=True,
                    output_bps=16,
                    output_color=rawpy.ColorSpace.sRGB,
                    gamma=(2.222, 4.5),
                    no_auto_bright=False,
                    bright=1.0,
                    demosaic_algorithm=rawpy.DemosaicAlgorithm.AHD
                )
                
                # Now get linear version
                rgb_linear = raw.postprocess(
                    use_camera_wb=True,
                    output_bps=16,
                    output_color=rawpy.ColorSpace.sRGB,
                    gamma=(1, 1),            # Linear: no gamma
                    no_auto_bright=True,     # No auto exposure in linear
                    bright=1.0,
                    demosaic_algorithm=rawpy.DemosaicAlgorithm.AHD
                )
                
                # Calculate auto exposure scaling from reference
                # Find the scale factor that was applied
                ref_max = np.percentile(rgb_ref, 99.9)
                linear_max = np.percentile(rgb_linear, 99.9)
                
                if linear_max > 0:
                    exposure_scale = ref_max / linear_max
                else:
                    exposure_scale = 1.0
                
                # Apply exposure scaling to linear image
                rgb_linear = np.clip(rgb_linear.astype(np.float32) * exposure_scale, 0, 65535).astype(np.uint16)
                
                logger.info(f"  Successfully loaded LINEAR image")
                logger.info(f"  Shape: {rgb_linear.shape}, dtype: {rgb_linear.dtype}")
                logger.info(f"  Intensity range: [{rgb_linear.min()}, {rgb_linear.max()}]")
                logger.info(f"  Applied exposure scale: {exposure_scale:.3f}")
                
                return rgb_linear
                
        except Exception as e:
            logger.error(f"Error loading LINEAR DNG file {dng_path}: {str(e)}")
            return None
    
    def _guided_filter(self, guide: np.ndarray, src: np.ndarray, radius: int, eps: float) -> np.ndarray:
        """
        Manual implementation of guided filter.
        Uses GPU acceleration with CuPy if available.
        
        Args:
            guide: Guide image (single channel, float32)
            src: Source image to filter (single channel, float32)
            radius: Filter radius
            eps: Regularization parameter
            
        Returns:
            Filtered image (same size as src)
        """
        if GPU_AVAILABLE:
            return self._guided_filter_gpu(guide, src, radius, eps)
        else:
            return self._guided_filter_cpu(guide, src, radius, eps)
    
    def _guided_filter_cpu(self, guide: np.ndarray, src: np.ndarray, radius: int, eps: float) -> np.ndarray:
        """CPU implementation of guided filter using OpenCV boxFilter."""
        mean_I = cv2.boxFilter(guide, cv2.CV_32F, (radius, radius))
        mean_p = cv2.boxFilter(src, cv2.CV_32F, (radius, radius))
        mean_Ip = cv2.boxFilter(guide * src, cv2.CV_32F, (radius, radius))
        cov_Ip = mean_Ip - mean_I * mean_p
        
        mean_II = cv2.boxFilter(guide * guide, cv2.CV_32F, (radius, radius))
        var_I = mean_II - mean_I * mean_I
        
        a = cov_Ip / (var_I + eps)
        b = mean_p - a * mean_I
        
        mean_a = cv2.boxFilter(a, cv2.CV_32F, (radius, radius))
        mean_b = cv2.boxFilter(b, cv2.CV_32F, (radius, radius))
        
        return mean_a * guide + mean_b
    
    def _box_filter_gpu(self, img: 'cp.ndarray', radius: int) -> 'cp.ndarray':
        """GPU box filter using CuPy convolution."""
        kernel_size = radius
        kernel = cp.ones((kernel_size, kernel_size), dtype=cp.float32) / (kernel_size * kernel_size)
        
        # Use separable filter for efficiency (2 1D convolutions instead of 1 2D)
        kernel_1d = cp.ones(kernel_size, dtype=cp.float32) / kernel_size
        
        # Pad image for 'same' output
        pad = kernel_size // 2
        img_padded = cp.pad(img, pad, mode='reflect')
        
        # Horizontal convolution
        from cupyx.scipy.ndimage import convolve1d
        temp = convolve1d(img_padded, kernel_1d, axis=1, mode='constant')
        # Vertical convolution
        result = convolve1d(temp, kernel_1d, axis=0, mode='constant')
        
        # Crop to original size
        return result[pad:-pad if pad > 0 else None, pad:-pad if pad > 0 else None]
    
    def _guided_filter_gpu(self, guide: np.ndarray, src: np.ndarray, radius: int, eps: float) -> np.ndarray:
        """GPU implementation of guided filter using CuPy."""
        # Transfer to GPU
        guide_gpu = cp.asarray(guide.astype(np.float32))
        src_gpu = cp.asarray(src.astype(np.float32))
        
        # Box filter operations on GPU
        mean_I = self._box_filter_gpu(guide_gpu, radius)
        mean_p = self._box_filter_gpu(src_gpu, radius)
        mean_Ip = self._box_filter_gpu(guide_gpu * src_gpu, radius)
        cov_Ip = mean_Ip - mean_I * mean_p
        
        mean_II = self._box_filter_gpu(guide_gpu * guide_gpu, radius)
        var_I = mean_II - mean_I * mean_I
        
        a = cov_Ip / (var_I + eps)
        b = mean_p - a * mean_I
        
        mean_a = self._box_filter_gpu(a, radius)
        mean_b = self._box_filter_gpu(b, radius)
        
        result_gpu = mean_a * guide_gpu + mean_b
        
        # Transfer back to CPU
        return cp.asnumpy(result_gpu)
    
    def _extract_details_linear(self, linear_image: np.ndarray, radius: int = 16, eps: float = 0.01) -> Tuple[np.ndarray, np.ndarray]:
        """
        Extract details from linear image using guided filter.
        Details are computed as: details = (input - guided(input)) / (eps + guided(input))
        This gives relative/multiplicative details.
        
        Args:
            linear_image: Input 16-bit linear RGB image (0-65535)
            radius: Guided filter radius (default: 16)
            eps: Regularization parameter to prevent division by zero (default: 0.01)
            
        Returns:
            Tuple of (base_layer, detail_layer) - base is original, details are float32 relative details
        """
        try:
            logger.info(f"  Extracting details in linear space using guided filter")
            logger.info(f"    Guided filter: radius={radius}, eps={eps}")
            
            # Convert to float [0, 1]
            image_float = linear_image.astype(np.float32) / 65535.0
            
            # Extract luminance channel (weighted average of RGB)
            # Use Rec. 709 luminance weights
            luma = 0.2126 * image_float[:, :, 0] + 0.7152 * image_float[:, :, 1] + 0.0722 * image_float[:, :, 2]
            
            # Apply guided filter to luminance
            guided_luma = self._guided_filter(
                guide=luma.astype(np.float32),
                src=luma.astype(np.float32),
                radius=radius,
                eps=eps
            )
            
            # Compute relative details: details = (input - guided) / (eps + guided)
            # This gives multiplicative details that preserve edge information
            detail_layer = (luma - guided_luma) / (eps + guided_luma)
            
            # Store details as float32 (can be negative)
            # We'll apply these details later in perceptual space
            logger.info(f"    Details extracted. Range: [{detail_layer.min():.4f}, {detail_layer.max():.4f}]")
            
            # Return original image as base, and details as separate layer
            base_layer = linear_image
            
            return base_layer, detail_layer
            
        except Exception as e:
            logger.error(f"    Error in details extraction: {str(e)}")
            # Return zeros as fallback
            return linear_image, np.zeros((linear_image.shape[0], linear_image.shape[1]), dtype=np.float32)
    
    def _apply_global_tone_mapping(self, linear_image: np.ndarray, gamma: Tuple[float, float] = (2.0, 4.5)) -> np.ndarray:
        """
        Apply Global Tone Mapping (GTM) and gamma correction to convert from linear to perceptual space.
        Uses GPU acceleration with CuPy if available.
        
        Args:
            linear_image: Input 16-bit linear RGB image (0-65535)
            gamma: Tuple of (gamma_power, toe_slope) for sRGB encoding
            
        Returns:
            Perceptual (gamma-corrected) 16-bit RGB image (0-65535)
        """
        try:
            logger.info(f"  Applying Global Tone Mapping (GTM) and gamma correction")
            logger.info(f"    Gamma: {gamma[0]:.3f}")
            
            gamma_power = gamma[0]
            
            if GPU_AVAILABLE:
                # GPU accelerated version
                linear_gpu = cp.asarray(linear_image.astype(np.float32)) / 65535.0
                perceptual_gpu = cp.power(cp.clip(linear_gpu, 0, 1), 1.0 / gamma_power)
                perceptual_gpu = cp.clip(perceptual_gpu * 65535.0, 0, 65535).astype(cp.uint16)
                perceptual = cp.asnumpy(perceptual_gpu)
            else:
                # CPU version
                linear_float = linear_image.astype(np.float32) / 65535.0
                perceptual_float = np.power(np.clip(linear_float, 0, 1), 1.0 / gamma_power)
                perceptual = np.clip(perceptual_float * 65535.0, 0, 65535).astype(np.uint16)
            
            logger.info(f"    GTM complete. Output range: [{perceptual.min()}, {perceptual.max()}]")
            
            return perceptual
            
        except Exception as e:
            logger.error(f"    Error applying GTM: {str(e)}")
            return linear_image
    
    def _boost_global_contrast(self, image: np.ndarray, boost_factor: float = 1.3) -> np.ndarray:
        """
        Boost global contrast using power curve.
        Uses GPU acceleration with CuPy if available.
        
        Args:
            image: Input 16-bit RGB image (0-65535)
            boost_factor: Contrast boost factor (>1.0 increases contrast)
            
        Returns:
            Contrast-boosted 16-bit RGB image (0-65535)
        """
        try:
            logger.info(f"  Boosting global contrast (factor={boost_factor:.2f})")
            
            if GPU_AVAILABLE:
                # GPU accelerated version
                image_gpu = cp.asarray(image.astype(np.float32)) / 65535.0
                centered = image_gpu - 0.5
                sign = cp.sign(centered)
                magnitude = cp.abs(centered)
                boosted_magnitude = cp.power(magnitude * 2.0, 1.0 / boost_factor) / 2.0
                boosted_gpu = sign * boosted_magnitude + 0.5
                boosted_gpu = cp.clip(boosted_gpu, 0, 1)
                boosted_gpu = (boosted_gpu * 65535.0).astype(cp.uint16)
                boosted = cp.asnumpy(boosted_gpu)
            else:
                # CPU version
                image_float = image.astype(np.float32) / 65535.0
                centered = image_float - 0.5
                sign = np.sign(centered)
                magnitude = np.abs(centered)
                boosted_magnitude = np.power(magnitude * 2.0, 1.0 / boost_factor) / 2.0
                boosted_float = sign * boosted_magnitude + 0.5
                boosted_float = np.clip(boosted_float, 0, 1)
                boosted = (boosted_float * 65535.0).astype(np.uint16)
            
            logger.info(f"    Contrast boost complete. Output range: [{boosted.min()}, {boosted.max()}]")
            
            return boosted
            
        except Exception as e:
            logger.error(f"    Error boosting contrast: {str(e)}")
            return image
    
    def _add_details_perceptual(self, perceptual_image: np.ndarray, detail_layer: np.ndarray, power_GF: float = 0.5) -> np.ndarray:
        """
        Add details (extracted in linear space) to perceptual image.
        Uses GPU acceleration with CuPy if available.
        Formula: rgb_out = rgb_in * (1 + power_GF * details)
        
        Args:
            perceptual_image: Input 16-bit perceptual RGB image (0-65535)
            detail_layer: Detail layer from linear space (float32, single channel)
            power_GF: Strength of detail enhancement (default: 0.5)
            
        Returns:
            Enhanced 16-bit perceptual RGB image (0-65535)
        """
        try:
            logger.info(f"  Adding details in perceptual space")
            logger.info(f"    Detail power (power_GF): {power_GF}")
            
            # Check if details are empty (zeros)
            if np.allclose(detail_layer, 0):
                logger.info(f"    No details to add (detail layer is zero)")
                return perceptual_image
            
            if GPU_AVAILABLE:
                # GPU accelerated version
                image_gpu = cp.asarray(perceptual_image.astype(np.float32)) / 65535.0
                detail_gpu = cp.asarray(detail_layer)
                
                # Apply multiplicative details
                detail_multiplier = 1.0 + power_GF * detail_gpu
                # Expand to 3 channels
                detail_multiplier_3ch = cp.stack([detail_multiplier] * 3, axis=2)
                
                enhanced_gpu = image_gpu * detail_multiplier_3ch
                enhanced_gpu = cp.clip(enhanced_gpu, 0, 1)
                enhanced_gpu = (enhanced_gpu * 65535.0).astype(cp.uint16)
                enhanced = cp.asnumpy(enhanced_gpu)
            else:
                # CPU version
                image_float = perceptual_image.astype(np.float32) / 65535.0
                detail_multiplier = 1.0 + power_GF * detail_layer
                detail_multiplier_3ch = np.stack([detail_multiplier] * 3, axis=2)
                enhanced_float = image_float * detail_multiplier_3ch
                enhanced_float = np.clip(enhanced_float, 0, 1)
                enhanced = (enhanced_float * 65535.0).astype(np.uint16)
            
            logger.info(f"    Details added. Output range: [{enhanced.min()}, {enhanced.max()}]")
            
            return enhanced
            
        except Exception as e:
            logger.error(f"    Error adding details: {str(e)}")
            return perceptual_image
    
    def _apply_bm3d_linear_adaptive(self, linear_image: np.ndarray, 
                                      sigma_dark: float = 0.1, 
                                      blend_power: float = 0.5) -> np.ndarray:
        """
        Apply BM3D denoising in LINEAR space with luminance-adaptive sigma.
        
        OPTIMIZED VERSION: Runs BM3D only ONCE with the strong (dark) sigma,
        then blends between the denoised result and the original based on
        luminance. Dark areas get the full denoised version, bright areas
        stay closer to the original (which has low noise anyway).
        
        Uses only the first BM3D stage (Hard Thresholding) for ~40% speedup
        with minimal quality loss.
        
        Combined speedup: ~70% faster than the 2-pass full BM3D version.
        
        The blend mask is: blend = Y^blend_power
        - blend_power < 1: more pixels get the strong (dark) treatment
        - blend_power = 1: linear blend proportional to luminance
        - blend_power > 1: more pixels get the light (bright) treatment
        
        Args:
            linear_image: Input 16-bit linear RGB image (0-65535)
            sigma_dark: BM3D sigma for the single denoising pass (strong)
            blend_power: Power curve for luminance-to-blend mapping (no hard thresholds)
            
        Returns:
            Denoised 16-bit linear RGB image
        """
        try:
            logger.info(f"  Applying BM3D adaptive denoising in LINEAR space (OPTIMIZED: 1 pass + stage 1 only)...")
            logger.info(f"    sigma_dark={sigma_dark}, blend_power={blend_power}")
            logger.info(f"    Strategy: BM3D once with sigma={sigma_dark}, blend with original using luminance mask")
            
            # Convert to float32 normalized to [0, 1]
            image_float = linear_image.astype(np.float32) / 65535.0
            
            # Compute luminance for adaptive blending (Rec.709)
            Y = 0.2126 * image_float[:, :, 0] + 0.7152 * image_float[:, :, 1] + 0.0722 * image_float[:, :, 2]
            
            # Smooth blend mask using power function — NO hard thresholds
            # 0 = full denoised (dark areas), 1 = full original (bright areas)
            blend_mask = np.power(np.clip(Y, 0, 1), blend_power)
            
            logger.info(f"    Luminance stats: min={Y.min():.4f}, median={np.median(Y):.4f}, max={Y.max():.4f}")
            logger.info(f"    Blend mask stats: min={blend_mask.min():.4f}, median={np.median(blend_mask):.4f}, max={blend_mask.max():.4f}")
            # Effective behavior at median luminance
            median_blend = np.median(blend_mask)
            logger.info(f"    At median luminance: {median_blend:.3f} original + {1-median_blend:.3f} denoised")
            
            # Run BM3D ONCE with strong sigma, stage 1 only (Hard Thresholding)
            # This is ~70% faster than 2-pass full BM3D
            logger.info(f"    Running BM3D (single pass, stage=HARD_THRESHOLDING, sigma={sigma_dark})...")
            denoised_channels = []
            for ch in range(3):
                denoised_ch = bm3d(image_float[:, :, ch], sigma_psd=sigma_dark,
                                   stage_arg=BM3DStages.HARD_THRESHOLDING)
                denoised_channels.append(denoised_ch)
            denoised_strong = np.stack(denoised_channels, axis=2)
            
            # Blend: dark areas → denoised, bright areas → original
            # blend_mask=0 (dark) → denoised, blend_mask=1 (bright) → original
            blend_mask_3ch = blend_mask[:, :, np.newaxis]  # (H, W, 1)
            denoised_float = denoised_strong * (1.0 - blend_mask_3ch) + image_float * blend_mask_3ch
            
            # Convert back to 16-bit
            denoised = np.clip(denoised_float * 65535.0, 0, 65535).astype(np.uint16)
            
            logger.info(f"    BM3D adaptive denoising complete (optimized)")
            logger.info(f"    Denoised intensity range: [{denoised.min()}, {denoised.max()}]")
            
            return denoised
            
        except Exception as e:
            logger.error(f"    Error in BM3D adaptive denoising: {str(e)}")
            logger.info(f"    Returning original image without denoising")
            return linear_image

    def _apply_bm3d_post(self, perceptual_image: np.ndarray, sigma_psd: float = 0.008) -> np.ndarray:
        """
        Apply light BM3D denoising as post-processing in perceptual space.
        
        This is a gentle cleanup pass after tone mapping, contrast boost, CLAHE,
        and detail addition. Uses a low sigma to avoid over-smoothing.
        
        OPTIMIZED: Uses only stage 1 (Hard Thresholding) for speed.
        
        Args:
            perceptual_image: Input 16-bit perceptual RGB image (0-65535)
            sigma_psd: BM3D sigma (low = gentle cleanup)
            
        Returns:
            Denoised 16-bit perceptual RGB image
        """
        try:
            logger.info(f"  Applying BM3D post-processing (sigma={sigma_psd}, stage=HARD_THRESHOLDING)...")
            
            # Convert to float32 normalized to [0, 1]
            image_float = perceptual_image.astype(np.float32) / 65535.0
            
            # Apply BM3D to each channel (stage 1 only for speed)
            denoised_channels = []
            for ch in range(3):
                denoised_ch = bm3d(image_float[:, :, ch], sigma_psd=sigma_psd,
                                   stage_arg=BM3DStages.HARD_THRESHOLDING)
                denoised_channels.append(denoised_ch)
            
            denoised_float = np.stack(denoised_channels, axis=2)
            denoised = np.clip(denoised_float * 65535.0, 0, 65535).astype(np.uint16)
            
            logger.info(f"    BM3D post-processing complete")
            logger.info(f"    Denoised intensity range: [{denoised.min()}, {denoised.max()}]")
            
            return denoised
            
        except Exception as e:
            logger.error(f"    Error in BM3D post-processing: {str(e)}")
            logger.info(f"    Returning original image")
            return perceptual_image
    
    def _apply_clahe_full(self, image: np.ndarray, clip_limit: Optional[float] = None) -> np.ndarray:
        """
        Apply CLAHE via luminance gain — no LAB conversion needed.
        
        Method: Compute Y (Rec.709 luminance) → CLAHE on Y → gain = CLAHE(Y)/Y → RGB * gain
        This preserves color ratios perfectly and stays in 16-bit throughout.
        
        Args:
            image: Input 16-bit RGB image (0-65535)
            clip_limit: Override clip limit (defaults to self.clahe_clip_limit)
            
        Returns:
            CLAHE-processed 16-bit RGB image (full strength)
        """
        try:
            if clip_limit is None:
                clip_limit = self.clahe_clip_limit
            logger.info(f"    Applying CLAHE via luminance gain (16-bit) with clip_limit={clip_limit}, grid_size={self.clahe_grid_size}x{self.clahe_grid_size}")
            
            # Step 1: Compute luminance Y in 16-bit (Rec.709 weights)
            image_float = image.astype(np.float32)
            Y = 0.2126 * image_float[:, :, 0] + 0.7152 * image_float[:, :, 1] + 0.0722 * image_float[:, :, 2]
            Y_16bit = np.clip(Y, 0, 65535).astype(np.uint16)
            
            # Step 2: Apply CLAHE to 16-bit luminance
            clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(self.clahe_grid_size, self.clahe_grid_size))
            Y_clahe_16bit = clahe.apply(Y_16bit)
            
            # Step 3: Compute gain = CLAHE(Y) / Y  (with epsilon to avoid division by zero)
            eps = 1.0  # 1 out of 65535 — negligible
            gain = Y_clahe_16bit.astype(np.float32) / (Y + eps)
            
            # Step 4: Apply gain to all RGB channels: RGB_out = RGB_in * gain
            gain_3ch = gain[:, :, np.newaxis]  # (H, W, 1) for broadcasting
            rgb_clahe_float = image_float * gain_3ch
            rgb_clahe = np.clip(rgb_clahe_float, 0, 65535).astype(np.uint16)
            
            logger.info(f"    CLAHE (luminance gain) complete. Gain range: [{gain.min():.3f}, {gain.max():.3f}]")
            logger.info(f"    Output intensity range: [{rgb_clahe.min()}, {rgb_clahe.max()}]")
            
            return rgb_clahe
            
        except Exception as e:
            logger.error(f"    Error applying CLAHE: {str(e)}")
            return image
    
    def _blend_images(self, original: np.ndarray, processed: np.ndarray, weight: float) -> np.ndarray:
        """
        Blend between original and processed image.
        Uses GPU acceleration with CuPy if available.
        
        Args:
            original: Original 16-bit RGB image
            processed: Processed (CLAHE) 16-bit RGB image
            weight: Blend weight (0.0 = original only, 1.0 = processed only)
            
        Returns:
            Blended 16-bit RGB image
        """
        try:
            if GPU_AVAILABLE:
                # GPU accelerated version
                original_gpu = cp.asarray(original.astype(np.float32))
                processed_gpu = cp.asarray(processed.astype(np.float32))
                blended_gpu = (1.0 - weight) * original_gpu + weight * processed_gpu
                blended_gpu = cp.clip(blended_gpu, 0, 65535).astype(cp.uint16)
                blended = cp.asnumpy(blended_gpu)
            else:
                # CPU version
                original_float = original.astype(np.float32)
                processed_float = processed.astype(np.float32)
                blended_float = (1.0 - weight) * original_float + weight * processed_float
                blended = np.clip(blended_float, 0, 65535).astype(np.uint16)
            
            logger.info(f"    Blended with weight={weight:.1f} (CLAHE contribution: {weight*100:.0f}%)")
            
            return blended
            
        except Exception as e:
            logger.error(f"    Error blending images: {str(e)}")
            return original
    
    def _save_png_full_resolution(self, image: np.ndarray, output_path: Path):
        """
        Save 16-bit image as 8-bit PNG at full resolution.
        
        Args:
            image: Input 16-bit RGB image
            output_path: Path to save the PNG file
        """
        try:
            # Convert 16-bit to 8-bit
            image_8bit = (image / 256).astype(np.uint8)
            
            # Convert RGB to BGR for OpenCV
            image_bgr = cv2.cvtColor(image_8bit, cv2.COLOR_RGB2BGR)
            
            # Save as PNG with compression
            cv2.imwrite(str(output_path), image_bgr, [cv2.IMWRITE_PNG_COMPRESSION, 6])
            
            logger.info(f"      Saved full PNG: {output_path.name}")
            
        except Exception as e:
            logger.error(f"      Error saving PNG: {str(e)}")
    
    def _save_jpeg_small(self, image: np.ndarray, output_path: Path, max_size: int = 1000):
        """
        Save 16-bit image as small JPEG (max dimension 1000px).
        
        Args:
            image: Input 16-bit RGB image
            output_path: Path to save the JPEG file
            max_size: Maximum dimension size in pixels
        """
        try:
            # Convert 16-bit to 8-bit
            image_8bit = (image / 256).astype(np.uint8)
            
            # Resize if needed
            height, width = image_8bit.shape[:2]
            if height > width:
                new_height = min(max_size, height)
                new_width = int((width * new_height) / height)
            else:
                new_width = min(max_size, width)
                new_height = int((height * new_width) / width)
            
            if new_width != width or new_height != height:
                image_resized = cv2.resize(image_8bit, (new_width, new_height), 
                                         interpolation=cv2.INTER_AREA)
            else:
                image_resized = image_8bit
            
            # Convert RGB to BGR for OpenCV
            image_bgr = cv2.cvtColor(image_resized, cv2.COLOR_RGB2BGR)
            
            # Save as JPEG
            cv2.imwrite(str(output_path), image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 70])
            
            logger.info(f"      Saved small JPEG: {output_path.name}")
            
        except Exception as e:
            logger.error(f"      Error saving JPEG: {str(e)}")
    
    def _save_jpeg_full_resolution(self, image: np.ndarray, output_path: Path):
        """
        Save 16-bit image as full resolution JPEG with maximum quality (no resize).
        """
        try:
            image_8bit = (image / 256).astype(np.uint8)
            image_bgr = cv2.cvtColor(image_8bit, cv2.COLOR_RGB2BGR)
            cv2.imwrite(str(output_path), image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 100])
            logger.info(f"      Saved full JPG: {output_path.name}")
        except Exception as e:
            logger.error(f"      Error saving full JPG: {str(e)}")
    
    def process_single_dng(self, dng_path: Path):
        """
        Process a single DNG file with multiple CLAHE strengths.
        
        Args:
            dng_path: Path to the DNG file
        """
        try:
            logger.info(f"\n{'='*60}")
            logger.info(f"Processing: {dng_path.name}")
            logger.info(f"{'='*60}")
            
            # ===== PIPELINE STAGES =====
            # Step 1: Load DNG in LINEAR space
            rgb_linear = self._load_dng_linear(dng_path)
            
            if rgb_linear is None:
                logger.error(f"Failed to load DNG file: {dng_path}")
                self.failed_files += 1
                return
            
            # Step 1.5: Standardize image size (crop portrait→landscape, downscale to target)
            rgb_linear = self._standardize_image(rgb_linear, dng_path)
            
            # Step 2: Extract details in LINEAR space using guided filter
            base_linear, details_linear = self._extract_details_linear(rgb_linear, radius=16, eps=0.01)
            
            # Step 2.5: Apply BM3D adaptive denoising in LINEAR space (OPTIMIZED)
            # Single BM3D pass with strong sigma, blended with original using luminance mask
            # Dark areas get full denoising, bright areas stay close to original
            base_linear_denoised = self._apply_bm3d_linear_adaptive(
                base_linear,
                sigma_dark=0.1,        # Strong denoise for darks — darks amplified ~10-16x by gamma
                blend_power=0.5        # <1 = more pixels get strong treatment (smooth, no hard thresholds)
            )
            
            # Step 3: Apply GTM + Gamma to base layer → PERCEPTUAL space
            rgb_perceptual = self._apply_global_tone_mapping(base_linear_denoised, gamma=(2.0, 4.5))
            
            # Step 3.5: Boost global contrast
            rgb_contrast = self._boost_global_contrast(rgb_perceptual, boost_factor=1.3)
            
            # Step 3.7: Apply BM3D post-processing (light cleanup after tone mapping, stage 1 only)
            rgb_contrast = self._apply_bm3d_post(rgb_contrast, sigma_psd=0.008)
            
            # Step 4: Apply CLAHE ONCE on base image (before details)
            rgb_clahe_base = self._apply_clahe_full(rgb_contrast)
            
            # Step 4b: Apply strong CLAHE for extended range
            rgb_clahe_strong_base = self._apply_clahe_full(rgb_contrast, clip_limit=self.clahe_strong_clip_limit)
            
            # Get base filename (without extension)
            base_name = dng_path.stem
            
            # Calculate total number of operations
            total_operations = len(self.processing_sequence)
            
            # Process with monotonic increasing sequence: L0 = source (no HDR), L1..LN = increasing strength
            for idx, (power_gf, weight, strong_blend) in enumerate(self.processing_sequence, 1):
                level_label = f"L{idx-1}"
                logger.info(f"  [{idx}/{total_operations}] {level_label}: power_GF={power_gf:.1f}, blend_weight={weight:.1f}, strong_blend={strong_blend:.2f}...")
                
                # Step 5: Determine CLAHE base (blend between normal and strong if needed)
                if strong_blend > 0:
                    if strong_blend >= 1.0:
                        clahe_base_for_point = rgb_clahe_strong_base
                        logger.info(f"    Using 100% strong CLAHE (clip={self.clahe_strong_clip_limit})")
                    else:
                        clahe_base_for_point = self._blend_images(rgb_clahe_base, rgb_clahe_strong_base, strong_blend)
                        logger.info(f"    Blended CLAHE: {(1-strong_blend)*100:.0f}% clip={self.clahe_clip_limit} + {strong_blend*100:.0f}% clip={self.clahe_strong_clip_limit}")
                else:
                    clahe_base_for_point = rgb_clahe_base
                
                # Step 6: Add details to BOTH original and CLAHE versions
                rgb_with_details = self._add_details_perceptual(rgb_contrast, details_linear, power_GF=power_gf)
                rgb_clahe_with_details = self._add_details_perceptual(clahe_base_for_point, details_linear, power_GF=power_gf)
                
                # Blend between original+details and CLAHE+details
                if weight == 0.0:
                    # Original only
                    rgb_final = rgb_with_details
                    logger.info(f"    Original (no CLAHE blending)")
                elif weight == 1.0:
                    # Full CLAHE
                    rgb_final = rgb_clahe_with_details
                else:
                    # Blend
                    rgb_final = self._blend_images(rgb_with_details, rgb_clahe_with_details, weight)
                
                # Define output filenames: L-label before parameters
                suffix = f"_{level_label}_P{power_gf:.3f}_W{weight:.3f}_S{strong_blend:.3f}"
                output_name_base = f"{base_name}{suffix}"
                output_path_png = self.output_dir_full_png / f"{output_name_base}.png"
                output_path_full_jpg = self.output_dir_full_jpg / f"{output_name_base}.jpg"
                output_path_small_jpg = self.output_dir_small / f"{output_name_base}.jpg"
                
                # Save full resolution PNG (8-bit)
                self._save_png_full_resolution(rgb_final, output_path_png)
                
                # Save full resolution JPEG (quality=100, no resize)
                self._save_jpeg_full_resolution(rgb_final, output_path_full_jpg)
                
                # Save small JPEG (max 1000px)
                self._save_jpeg_small(rgb_final, output_path_small_jpg)
                
                # Progress
                progress = (idx / total_operations) * 100
                logger.info(f"    Progress: {progress:.1f}%")
            
            self.processed_files += 1
            logger.info(f"Successfully processed: {dng_path.name} with {len(self.processing_sequence)} variations (monotonic sequence)")
            
        except Exception as e:
            logger.error(f"Error processing {dng_path}: {str(e)}")
            self.failed_files += 1
    
    def process_all_dng_files(self, max_files: Optional[int] = None, start_from: Optional[str] = None):
        """
        Process all DNG files in the input directory.
        
        Args:
            max_files: Maximum number of files to process. If None, process all files.
            start_from: Filename prefix to start from (e.g. 'a0300'). Skips earlier files.
        """
        try:
            # Find all DNG files (use set to avoid duplicates on case-insensitive filesystems)
            dng_files = sorted(set(self.input_dir.glob("*.dng")) | set(self.input_dir.glob("*.DNG")))
            
            if not dng_files:
                logger.warning(f"No DNG files found in {self.input_dir}")
                return
            
            # Skip files before start_from
            if start_from is not None:
                original_count = len(dng_files)
                dng_files = [f for f in dng_files if f.stem >= start_from]
                skipped = original_count - len(dng_files)
                logger.info(f"Resuming from '{start_from}': skipped {skipped} files, {len(dng_files)} remaining")
            
            # Limit number of files if specified
            if max_files is not None:
                dng_files = dng_files[:max_files]
                logger.info(f"Limited to processing {max_files} files")
            
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
        variations_per_file = len(self.processing_sequence)
        return {
            'processed_files': self.processed_files,
            'failed_files': self.failed_files,
            'total_files': self.processed_files + self.failed_files,
            'variations_per_file': variations_per_file,
            'total_images_created': self.processed_files * variations_per_file * 3  # PNG + full JPG + small JPG
        }


def main():
    """Main function to run the DNG CLAHE processor."""
    
    # Configuration
    input_directory = r"F:\NN_and_other_projects\IEEE_HDR\code_and_images\images\HDR\DNG"
    output_directory = r"F:\NN_and_other_projects\IEEE_HDR\code_and_images\processed_images\final_output\HDR"
    
    # Create processor
    processor = DNGCLAHEProcessor(input_directory, output_directory)
    
    # Process all DNG files (set start_from=None to process all, or e.g. 'a0300' to resume)
    processor.process_all_dng_files(start_from=None)
    
    # Print summary
    summary = processor.get_processing_summary()
    print("\n" + "="*50)
    print("PROCESSING SUMMARY")
    print("="*50)
    print(f"Total files processed: {summary['processed_files']}")
    print(f"Failed files: {summary['failed_files']}")
    print(f"Variations per image: {summary['variations_per_file']}")
    print(f"Total images created: {summary['total_images_created']}")
    print("="*50)


if __name__ == "__main__":
    main()
