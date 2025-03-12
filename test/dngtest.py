import rawpy
import numpy as np
import matplotlib.pyplot as plt

def display_dng_image(file_path):
    """Reads a DNG file and displays it using matplotlib."""
    try:
        # Open the DNG file using rawpy
        with rawpy.imread(file_path) as raw:
            # Convert the raw image to a numpy array with post-processing
            rgb_image = raw.postprocess()
            bayer_raw = raw.raw_image_visible.copy()
        
        # Display the image using matplotlib
        plt.figure(figsize=(10, 7))
        plt.imshow(rgb_image)
        plt.axis('off')  # Hide axes for better viewing
        plt.title("DNG Image Display")
        plt.show()


        # Normalize to 0-1 for display
        bayer_normalized = bayer_raw.astype(np.float32)
        bayer_normalized /= np.max(bayer_normalized)
        plt.figure(figsize=(10, 7))
        plt.imshow(bayer_normalized, cmap='gray')
        plt.axis('off')  # Hide axes for better viewing
        plt.title("Bayer RAW Display")
        plt.show()

    except Exception as e:
        print(f"Error: {e}")

# Replace with the path to your DNG file
dng_file_path = 'images\\HDR\\DNG\\a1662-jn_2007_05_06__346.dng' 
display_dng_image(dng_file_path)