Tonemap DNG — Prompt List
=========================

1.  create a python script that reads a 16 bit high dynamic range DNG file and then processes it to bring details out of the dark increase the local contrast by applying a local tone mapping function to it, producing a low dynamic range image as output.
    
2.  update the function so that it maintains the contrast in the light areas, preventing them from getting washed out
    
3.  add a function that loops through \*.dng images in the images/HDR/DNG folder, and then processes them with the following settings
    1.  shaddow\_gamma 1.15 and stops 0.5
    2.  shaddow\_gamma 1.25 and stops 1.0
    3.  shaddow\_gamma 1.5 and stops 1.5
    4.  shaddow\_gamma 1.75 and stops 1.75
    5.  shaddow\_gamma 2.0 and stops 2.0  
    
    all of the processed images should be saved in jpeg format into the processed\_images folder (create if it doesn't exist) with the original file name and the above processing settings appended to the file name.
        
4.  update the batch processing scripts
    1.  minimally processed
    2.  shadow\_gamma 1.15 and stops 0.5
    3.  shadow\_gamma 1.25 and stops 1.0
    4.  shadow\_gamma 1.5 and stops 1.5
    5.  shadow\_gamma 1.75 and stops 1.75
    6.  shadow\_gamma 2.0 and stops 2.0  
    
    update the batch output file name so that after the original file name, include a preset# where # is one of the above presets before the sg and st parameters.