import { Joyride, EVENTS } from 'react-joyride'

// Guided "tour mode" that walks a participant through the image grading
// interface (issue #15). It auto-launches on their very first image and can be
// replayed from the top-bar [?] button. The steps come from buildTourSteps in
// ../lib/tourSteps.
//
// react-joyride v3 API notes: the event callback is `onEvent` (not `callback`),
// and presentation/behavior live in the `options` prop. `closeButtonAction:
// 'skip'` makes the corner [×] end the tour instead of its default of advancing
// to the next step.
function StudyTour({ run, steps, onClose }) {
  return (
    <Joyride
      run={run}
      steps={steps}
      continuous
      onEvent={(data) => {
        // TOUR_END fires whether the participant finished the last step, used
        // the skip button, or dismissed with the [×] (closeButtonAction:'skip').
        if (data.type === EVENTS.TOUR_END) {
          onClose()
        }
      }}
      locale={{ last: 'Done', skip: 'Skip tour' }}
      options={{
        showProgress: true,
        skipBeacon: true,
        skipScroll: true,
        closeButtonAction: 'skip',
        buttons: ['back', 'skip', 'primary'],
        primaryColor: '#287271',
        arrowColor: '#ffffff',
        backgroundColor: '#ffffff',
        textColor: '#1d3557',
        overlayColor: 'rgba(14, 22, 34, 0.7)',
        zIndex: 10000,
      }}
    />
  )
}

export default StudyTour
