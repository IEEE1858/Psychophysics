# Interface Test

This app lists full-resolution Sharpness and HDR image sets from the `psychophysics-images` S3 bucket and provides a review UI for stepping through processing levels.

## Run

1. `cd /Users/henrykoren/imatest/Psychophysics/github/interface_test`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:5173`

The root `dev` command starts:

- the Express API on `http://localhost:5001`
- the Vite client on `http://localhost:5173`

## Data Source

- The backend uses Amazon S3 `ListObjects` requests against bucket `psychophysics-images`.
- Sharpness prefix: `images/sharpness_final/full_res_jpg/`
- HDR prefix: `images/HDR_final/full_res_jpg/`
- Returned image URLs point directly at `https://psychophysics-images.s3.us-east-1.amazonaws.com/...`
- The backend requires AWS credentials with permission to list that bucket.

## Notes

- Left and right arrow keys move the processing slider by one level.
- The previous image button is hidden on the first image.
- Slider markers `R` and `Q` jump back to the saved Most Realistic and Highest Quality selections.
- A selection is blocked until the participant explores enough of the slider range or reaches the most heavily processed image.