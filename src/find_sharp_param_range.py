import cv2
import numpy as np
from process_raw import DngFile
from wand.image import Image
import os
range_min = 5 #range  = 10 --> 1 pix
range_max = 300
range_step = 5

sharpness_dng_path = r'../images/Sharpness/'
sharpness_processed_root = r'../processed_images/'
sharp_image_files = (r'a0020-jmac_MG_6225',r'a1781-LS051026_day_10_LL003',r'a0410-jmac_DSC2754',r'a0568-_MG_1090')

for sharp_image_file in sharp_image_files:
    sharpness_processed_images = sharpness_processed_root + sharp_image_file + '/'
    isExist = os.path.exists(sharpness_processed_images)
    if not isExist:
        os.mkdir(sharpness_processed_images)
    dng = DngFile.read(sharpness_dng_path + sharp_image_file + '.dng')
    raw = dng.raw  # np.uint16
    raw_8bit = np.uint8(raw >> (dng.bit-8))
    rgb1 = dng.postprocess()  # demosaicing by rawpy
    output_path=sharpness_processed_images+ sharp_image_file +".jpg"
    cv2.imwrite(output_path, rgb1[:, :, ::-1])

    #process with wand
    for sigma in  range(range_min,range_max,range_step):
        with Image(filename = output_path) as image:
             with image.clone() as sharpen:
                  # Invoke sharpen function with radius = 5 * sigma
                sharpen.sharpen(min(round(sigma * 5 / 10),90), sigma / 10)
                # Save the image

                sharpen.save(filename =output_path+'_sharpen_' + str(sigma) + '.jpg')

