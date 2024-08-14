import cv2
import numpy as np
from process_raw import DngFile

# Download raw.dng for test:
# wget https://github.com/yl-data/yl-data.github.io/raw/master/2201.process_raw/raw-12bit-GBRG.dng
hdr_dng_path = 'images/HDR/'
hdr_processed_images = 'processed_images/HDR/'
image_file = 'a0304-dgw_137.dng'

dng = DngFile.read(hdr_dng_path + image_file)
raw = dng.raw  # np.uint16
raw_8bit = np.uint8(raw >> (dng.bit-8))
cv2.imwrite(hdr_processed_images + image_file".png", raw_8bit)

rgb1 = dng.postprocess()  # demosaicing by rawpy
cv2.imwrite(hdr_processed_images+ image_file+".jpg", rgb1[:, :, ::-1])
DngFile.save(dng_path + "-save.dng", dng.raw, bit=dng.bit, pattern=dng.pattern)