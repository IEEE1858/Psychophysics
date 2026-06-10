// Persistent study session helpers. Unlike sessionStorage, localStorage
// survives tab closes and browser restarts, so a participant who returns later
// resumes the same session (same participantId, demographics, and position).
const PARTICIPANT_KEY = 'participantId'
const DEMOGRAPHICS_KEY = 'demographics'
const POSITION_KEY = 'studyPosition'
const PLAYLIST_KEY = 'studyPlaylist'

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

// The position is the participant's index into their personal playlist (see
// below), so a returning participant resumes on the same image.
export function getStudyPosition() {
  const raw = Number(localStorage.getItem(POSITION_KEY))
  return Number.isFinite(raw) && raw >= 0 ? raw : 0
}

export function setStudyPosition(index) {
  localStorage.setItem(POSITION_KEY, String(index))
}

// The playlist is the ordered set of images this participant was assigned, sized
// to the time budget they reported and interleaved across collections. It is
// built once (after demographics) and persisted so the same set is shown on a
// return visit. Each entry is { collectionId, imageId }.
export function getStudyPlaylist() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || 'null')
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function setStudyPlaylist(playlist) {
  localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlist))
}

export function clearStudyPlaylist() {
  localStorage.removeItem(PLAYLIST_KEY)
  localStorage.removeItem(POSITION_KEY)
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
    timeBudgetMinutes: participant.time_budget_minutes ?? '',
  }
}
