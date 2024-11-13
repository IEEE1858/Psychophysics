import cv2
import numpy as np
from process_raw import DngFile
from wand.image import Image

# Download raw.dng for test:
# wget https://github.com/yl-data/yl-data.github.io/raw/master/2201.process_raw/raw-12bit-GBRG.dng
hdr_dng_path = 'images/HDR/'
hdr_processed_images = 'processed_images/HDR/'
hdr_image_file = 'a0304-dgw_137.dng'

sharpness_dng_path = 'images/HDR/'
sharpness_processed_images = 'processed_images/sharpness/'
hdr_image_file = 'a0304-dgw_137.dng'
image_file = hdr_image_file

dng = DngFile.read(hdr_dng_path + image_file)
raw = dng.raw  # np.uint16
raw_8bit = np.uint8(raw >> (dng.bit-8))
cv2.imwrite(hdr_processed_images + image_file +".png", raw_8bit)

rgb1 = dng.postprocess()  # demosaicing by rawpy
output_path=hdr_processed_images+ image_file +".jpg"
cv2.imwrite(output_path, rgb1[:, :, ::-1])

#process with wand
with Image(filename = output_path) as image:
     with image.clone() as sharpen:
          # Invoke sharpen function with radius 50 and sigma 40
        sharpen.sharpen(50, 40)
        # Save the image
        sharpen.save(filename =output_path+'sharpen1.jpg')