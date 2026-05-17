const MEETINGS_KEY     = 'moit_meetings'
const RESPONSES_KEY    = 'moit_responses'
const OWNER_TOKENS_KEY = 'moit_owner_tokens'
const MY_MEETINGS_KEY  = 'moit_my_meetings'

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}
function write(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

// ── Meetings ────────────────────────────────────────────
export function getMeeting(id)      { return read(MEETINGS_KEY)[id] || null }
export function getMeetings()       { return read(MEETINGS_KEY) }

export function saveMeeting(meeting) {
  const all = read(MEETINGS_KEY)
  all[meeting.id] = meeting
  write(MEETINGS_KEY, all)
}

export function deleteMeeting(id) {
  const meetings = read(MEETINGS_KEY);  delete meetings[id];  write(MEETINGS_KEY, meetings)
  const responses = read(RESPONSES_KEY); delete responses[id]; write(RESPONSES_KEY, responses)
  write(MY_MEETINGS_KEY, getMyMeetingIds().filter(mid => mid !== id))
}

// ── Responses ───────────────────────────────────────────
export function getResponses(meetingId) { return read(RESPONSES_KEY)[meetingId] || [] }

export function saveResponse(meetingId, response) {
  const all = read(RESPONSES_KEY)
  if (!all[meetingId]) all[meetingId] = []
  const idx = all[meetingId].findIndex(r => r.id === response.id)
  if (idx >= 0) all[meetingId][idx] = response
  else all[meetingId].push(response)
  write(RESPONSES_KEY, all)
}

export function clearResponses(meetingId) {
  const all = read(RESPONSES_KEY)
  all[meetingId] = []
  write(RESPONSES_KEY, all)
}

// ── Owner tokens ─────────────────────────────────────────
export function saveOwnerToken(meetingId, token) {
  const all = read(OWNER_TOKENS_KEY)
  all[meetingId] = token
  write(OWNER_TOKENS_KEY, all)
}

export function getOwnerToken(meetingId) { return read(OWNER_TOKENS_KEY)[meetingId] || null }

// ── My meetings (home list) ──────────────────────────────
export function getMyMeetingIds() {
  try { return JSON.parse(localStorage.getItem(MY_MEETINGS_KEY) || '[]') } catch { return [] }
}

export function addMyMeeting(id) {
  const ids = getMyMeetingIds()
  if (!ids.includes(id)) ids.unshift(id)
  write(MY_MEETINGS_KEY, ids)
}
