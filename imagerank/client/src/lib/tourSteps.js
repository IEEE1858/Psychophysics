// Steps for the guided "tour mode" walkthrough of the grading interface
// (issue #15). Steps target elements by their `data-tour="…"` attribute (or a
// plain CSS selector) so they survive styling changes to class names.
//
// `isLastImage` drops the closing "Next image" step when that button is not on
// screen (the last image of the playlist shows Finish instead), since a step
// pointing at a missing target would stall the tour.
export function buildTourSteps({ isLastImage } = {}) {
  const steps = [
    {
      target: 'body',
      placement: 'center',
      title: 'Welcome to the image grading task',
      content:
        'First, set your browser to full screen so the image fills your display — press F11 on Windows, or Control + Command + F on a Mac.',
    },
    {
      target: 'body',
      placement: 'center',
      title: 'Check your lighting',
      content:
        'View the study in a room where you can clearly see your monitor. Avoid direct sunlight or bright glare on the screen.',
    },
    {
      target: '[data-tour="slider"]',
      placement: 'top',
      title: 'The processing slider',
      content:
        'This slider moves through the different levels of processing applied to the same image, from unprocessed on the left to heavily processed on the right.',
    },
    {
      target: '[data-tour="pick-realistic"]',
      placement: 'top',
      title: 'Most realistic',
      content:
        'The most realistic image is a true-to-life representation of the scene with accurate colors and tones — not exaggerated, not too blurry.',
    },
    {
      target: '[data-tour="pick-favorite"]',
      placement: 'top',
      title: 'Favorite image',
      content:
        'Your favorite image is simply the one you like the best — the version of the set that looks most pleasing to you.',
    },
    {
      target: '[data-tour="slider"]',
      placement: 'top',
      title: 'Explore the set',
      content:
        'Move the slider left and right until you find the image that looks most realistic, and the one that is your favorite. Tip: you can also use the ← and → arrow keys on your keyboard.',
    },
    {
      target: '[data-tour="zoom"]',
      placement: 'bottom',
      title: 'Inspect the details',
      content:
        'Zoom into the image to inspect fine details — use these controls, your mouse wheel, or double-click on the image. Use “Reset view” to zoom back out.',
    },
    {
      target: '.study-bottombar',
      placement: 'top',
      title: 'Record your choice',
      content:
        'Once you have found it, click “Pick Most Realistic” or “Pick Favorite Image” to record your selection. A marker appears on the slider showing the level you picked.',
    },
  ]

  if (!isLastImage) {
    steps.push({
      target: '[data-tour="next"]',
      placement: 'top',
      title: 'Move on',
      content:
        'When you are happy with the most realistic and favorite image you have selected, click “Next image” to continue.',
    })
  }

  return steps
}
