// Steps for the guided "tour mode" walkthrough of the grading interface
// (issue #15). Steps target elements by their `data-tour="…"` attribute (or a
// plain CSS selector) so they survive styling changes to class names.
//
// `isLastImage` drops the closing "Next image" step when that button is not on
// screen (the last image of the playlist shows Finish instead), since a step
// pointing at a missing target would stall the tour.
export function buildTourSteps(t, { isLastImage } = {}) {
  const steps = [
    {
      target: 'body',
      placement: 'center',
      title: t('tour.fullscreen.title'),
      content: t('tour.fullscreen.body'),
    },
    {
      target: 'body',
      placement: 'center',
      title: t('tour.lighting.title'),
      content: t('tour.lighting.body'),
    },
    {
      target: '[data-tour="slider"]',
      placement: 'top',
      title: t('tour.slider.title'),
      content: t('tour.slider.body'),
    },
    {
      target: '[data-tour="pick-realistic"]',
      placement: 'top',
      title: t('tour.realistic.title'),
      content: t('tour.realistic.body'),
    },
    {
      target: '[data-tour="pick-favorite"]',
      placement: 'top',
      title: t('tour.favorite.title'),
      content: t('tour.favorite.body'),
    },
    {
      target: '[data-tour="slider"]',
      placement: 'top',
      title: t('tour.explore.title'),
      content: t('tour.explore.body'),
    },
    {
      target: '[data-tour="zoom"]',
      placement: 'bottom',
      title: t('tour.zoom.title'),
      content: t('tour.zoom.body'),
    },
    {
      target: '.study-bottombar',
      placement: 'top',
      title: t('tour.record.title'),
      content: t('tour.record.body'),
    },
  ]

  if (!isLastImage) {
    steps.push({
      target: '[data-tour="next"]',
      placement: 'top',
      title: t('tour.next.title'),
      content: t('tour.next.body'),
    })
  }

  return steps
}
