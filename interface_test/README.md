# Interface Test

This app serves full-resolution Sharpness and HDR image sets from the psychophysics-images workspace folder and provides a review UI for stepping through processing levels.

## Run

1. `cd /Users/henrykoren/imatest/Psychophysics/github/interface_test`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:5173`

The root `dev` command starts:

- the Express API on `http://localhost:5001`
- the Vite client on `http://localhost:5173`

## Notes

- Left and right arrow keys move the processing slider by one level.
- The previous image button is hidden on the first image.
- Slider markers `R` and `Q` jump back to the saved Most Realistic and Highest Quality selections.
- A selection is blocked until the participant explores enough of the slider range or reaches the most heavily processed image.