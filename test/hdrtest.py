import cv2
import numpy as np
import matplotlib.pyplot as plt
from process_raw import DngFile

def reinhard_extended_hdr(image_path, intensity=0.0, light_adapt=1.0, color_adapt=0.0):
    """
    Applies the Reinhard Extended HDR tone mapping to an image.

    Parameters:
        image_path (str): Path to the HDR image.
        intensity (float): Adjusts the intensity of the tone mapping.
        light_adapt (float): Light adaptation factor (0 to 1).
        color_adapt (float): Color adaptation factor (0 to 1).

    Returns:
        np.ndarray: Tone-mapped image.
    """
    # Read the HDR image
    if (image_path.find(".dng") != -1):
        dng = DngFile.read(image_path)
        hdr = dng.raw  # np.uint16
        raw_8bit = np.uint8(hdr >> (dng.bit-8))
        plt.imshow(raw_8bit)
        plt.axis('off')
        plt.title('raw_8bit')
        plt.show()
    else:
        hdr = cv2.imread(image_path, -1)


    # Ensure the image is in the correct format
    if hdr is None:
        raise FileNotFoundError(f"Image at path '{image_path}' not found.")
    else:
        # Display the result
        plt.figure()
        plt.imshow(hdr, cv2.COLOR_BGR2RGB)
        plt.axis('off')
        plt.title('original image')
        plt.show()

    # Convert to floating point representation
    hdr = np.float32(hdr)

    # Create the Reinhard tone mapping object
    tonemap = cv2.createTonemapReinhard(intensity=intensity, light_adapt=light_adapt, color_adapt=color_adapt)


    # Apply tone mapping
    ldr = tonemap.process(hdr)

    # Convert to 8-bit image for display
    ldr = np.clip(ldr * 255, 0, 255).astype('uint8')

    return ldr

# Example usage
image_path = 'images\\HDR\\DNG\\a1662-jn_2007_05_06__346.dng'  # Replace with your HDR image path

try:

    
    tone_mapped_image = reinhard_extended_hdr(image_path, intensity=0.5, light_adapt=0.8, color_adapt=0.2)

    # Display the result
    plt.imshow(cv2.cvtColor(tone_mapped_image, cv2.COLOR_BGR2RGB))
    plt.axis('off')
    plt.title('Reinhard Extended HDR Tone Mapping')
    plt.show()

    # Save the result
    cv2.imwrite('tone_mapped_image.jpg', tone_mapped_image)
except FileNotFoundError as e:
    print(e)
