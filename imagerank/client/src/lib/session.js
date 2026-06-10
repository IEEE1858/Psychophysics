// Persistent study session helpers. Unlike sessionStorage, localStorage
// survives tab closes and browser restarts, so a participant who returns later
// resumes the same session (same participantId, demographics, and position).
const PARTICIPANT_KEY = 'participantId'
const DEMOGRAPHICS_KEY = 'demographics'
const POSITION_KEY = 'studyPosition'

export function getParticipantId() {
  return localStorage.getItem(PARTICIPANT_KEY)
}

export function setParticipantId(id) {
  localStorage.setItem(PARTICIPANT_KEY, String(id))
}

export function hasSession() {
  return Boolean(localStorage.getItem(PARTICIPANT_KEY))
}

export function getStoredDemographics() {
  try {
    return JSON.parse(localStorage.getItem(DEMOGRAPHICS_KEY) || 'null')
  } catch {
    return null
  }
}

export function setStoredDemographics(demographics) {
  localStorage.setItem(DEMOGRAPHICS_KEY, JSON.stringify(demographics))
}

export function getStudyPosition() {
  try {
    return JSON.parse(localStorage.getItem(POSITION_KEY) || 'null')
  } catch {
    return null
  }
}

export function setStudyPosition(position) {
  localStorage.setItem(POSITION_KEY, JSON.stringify(position))
}

// Map a server participant row (snake_case) into the demographics form shape.
export function demographicsFromServer(participant) {
  return {
    age: participant.age != null ? String(participant.age) : '',
    gender: participant.gender ?? '',
    email: participant.email ?? '',
    selfDescription: participant.self_description ?? '',
    visionStatus: participant.vision_status ?? '',
    visionDetails: participant.vision_details ?? '',
    colorBlind: participant.color_blind ?? '',
    countryOfOrigin: participant.country_of_origin ?? '',
    displayType: participant.display_type ?? '',
    lighting: participant.lighting ?? '',
  }
}
