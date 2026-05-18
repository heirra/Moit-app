import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  getMeeting, getResponses, clearResponses, deleteMeeting, getOwnerToken,
} from '../lib/storage'
import { copyToClipboard, toDateString, formatDate, formatDateShort, getDatesBetween } from '../lib/utils'
import { useToast, ToastPortal } from '../components/Toast'
import Layout from '../components/Layout'

/* ── Constants ───────────────────────────────────────────── */
const BLOCK_DEFS = [
  { key: 'morning',   label: '오전', timeStart: '09:00', timeEnd: '12:00' },
  { key: 'afternoon', label: '오후', timeStart: '12:00', timeEnd: '18:00' },
  { key: 'evening',   label: '저녁', timeStart: '18:00', timeEnd: '22:00' },
]
const BLOCK_LABELS = { morning: '오전', afternoon: '오후', evening: '저녁', allday: '하루 가능' }
const DOW_KR = ['일', '월', '화', '수', '목', '금', '토']

/* ── Display helpers ─────────────────────────────────────── */
function getHubDisplay(r) {
  if (r.startingHub) {
    if (r.startingHub === '직접 입력') return r.startingAreaDetail?.trim() || null
    return r.startingHub
  }
  // legacy: old responses used startingAreaCategory / area
  if (r.startingAreaCategory) {
    const detail = r.startingAreaDetail?.trim()
    return detail ? `${r.startingAreaCategory} / ${detail}` : r.startingAreaCategory
  }
  if (r.area?.trim()) return r.area.trim()
  return null
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? '오후' : '오전'
  const hr     = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${hr}:${String(m).padStart(2, '0')}`
}

/* ── Data computation ────────────────────────────────────── */
function computeAll(responses, meeting) {
  const total        = responses.length
  const scheduleMode = meeting.scheduleMode || 'flexible'
  const allDates     = getDatesBetween(meeting.dateRange.start, meeting.dateRange.end)

  // Per-date: how many participants can make it
  const dateCounts = {}
  for (const d of allDates) {
    const count = responses.filter(r => r.dates.some(x => x.date === d)).length
    if (count > 0) dateCounts[d] = { count, total }
  }
  const possibleDatesCount = Object.keys(dateCounts).length

  let blockSlots = [], bestSlots = [], recs = []

  if (scheduleMode === 'exact') {
    // Exact mode: find per-date time-range intersections
    const exactSlots = []
    for (const d of allDates) {
      const dateResps = responses.filter(r => r.dates.some(x => x.date === d))
      if (dateResps.length === 0) continue
      const count = dateResps.length

      let maxStart = '00:00', minEnd = '23:30', hasNonAnytime = false
      for (const r of dateResps) {
        const rd = r.dates.find(x => x.date === d)
        if (!rd || rd.mode === 'anytime') continue
        if (rd.timeStart && rd.timeEnd) {
          hasNonAnytime = true
          if (rd.timeStart > maxStart) maxStart = rd.timeStart
          if (rd.timeEnd   < minEnd)   minEnd   = rd.timeEnd
        }
      }
      const validRange = hasNonAnytime && maxStart < minEnd

      exactSlots.push({
        date: d, count, total,
        timeStart: validRange ? maxStart : null,
        timeEnd:   validRange ? minEnd   : null,
      })
    }
    exactSlots.sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))

    bestSlots  = exactSlots.filter(s => s.count === total)
    recs       = exactSlots.slice(0, 3).map(s => ({
      date: s.date, count: s.count, total: s.total,
      timeStart: s.timeStart, timeEnd: s.timeEnd, bestBlock: null,
    }))
    blockSlots = exactSlots
  } else {
    // Flexible mode: block-based computation
    if (total > 0) {
      for (const d of allDates) {
        const anyHere = responses.some(r => r.dates.some(x => x.date === d))
        if (!anyHere) continue
        for (const bd of BLOCK_DEFS) {
          let count = 0
          for (const r of responses) {
            const rd = r.dates.find(x => x.date === d)
            if (!rd) continue
            const blocks = rd.blocks || []
            if (rd.mode === 'anytime' || blocks.includes('allday')) { count++; continue }
            if (blocks.includes(bd.key)) { count++; continue }
            if (rd.timeStart && rd.timeEnd) {
              if (rd.timeStart < bd.timeEnd && rd.timeEnd > bd.timeStart) { count++; continue }
            }
          }
          if (count > 0) {
            blockSlots.push({
              date: d, block: bd.key, blockLabel: bd.label,
              timeStart: bd.timeStart, timeEnd: bd.timeEnd, count, total,
            })
          }
        }
      }
      blockSlots.sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))
    }

    bestSlots = total > 0 ? blockSlots.filter(s => s.count === total) : []

    recs = Object.entries(dateCounts)
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([date, { count }]) => {
        const blockCounts = {}
        for (const r of responses) {
          const rd = r.dates.find(x => x.date === date)
          if (!rd) continue
          const blocks = rd.blocks || []
          const keys = rd.mode === 'anytime' || blocks.includes('allday')
            ? ['morning', 'afternoon', 'evening']
            : blocks
          keys.forEach(k => { blockCounts[k] = (blockCounts[k] || 0) + 1 })
        }
        const best = Object.entries(blockCounts).sort((a, b) => b[1] - a[1])[0]
        return { date, count, total, bestBlock: best?.[0] || null, timeStart: null, timeEnd: null }
      })
  }

  return { total, allDates, dateCounts, possibleDatesCount, blockSlots, bestSlots, recs, scheduleMode }
}

/* ── Participant cell helpers ────────────────────────────── */
function getParticipantCell(r, date, scheduleMode) {
  const rd = r.dates.find(x => x.date === date)
  if (!rd) return { type: 'none' }

  if (scheduleMode === 'exact') {
    if (rd.mode === 'anytime') return { type: 'anytime' }
    if (rd.timeStart && rd.timeEnd) return { type: 'exact', timeStart: rd.timeStart, timeEnd: rd.timeEnd }
    return { type: 'anytime' }
  }

  // flexible
  const blocks = rd.blocks || []
  if (rd.mode === 'anytime') return { type: 'anytime' }
  if (blocks.includes('allday')) return { type: 'allday' }
  if (blocks.length > 0) return { type: 'blocks', blocks }
  if (rd.timeStart && rd.timeEnd) return { type: 'timeRange', timeStart: rd.timeStart, timeEnd: rd.timeEnd }
  return { type: 'anytime' }
}

function cellText(cell) {
  if (cell.type === 'none')      return '미입력'
  if (cell.type === 'anytime')   return '가능'
  if (cell.type === 'allday')    return '하루 가능'
  if (cell.type === 'exact')     return formatTime(cell.timeStart)
  if (cell.type === 'blocks') {
    if (cell.blocks.length === 1) return BLOCK_LABELS[cell.blocks[0]] || '가능'
    return cell.blocks.map(b => BLOCK_LABELS[b]).filter(Boolean).join('·')
  }
  if (cell.type === 'timeRange') return formatTime(cell.timeStart)
  return '가능'
}

function cellStyle(cell) {
  const base = { fontSize: 10, fontWeight: 600, borderRadius: 5, padding: '3px 5px', whiteSpace: 'nowrap' }
  if (cell.type === 'none')
    return { ...base, background: 'var(--bg-muted)', color: 'var(--text-muted)' }
  if (cell.type === 'anytime' || cell.type === 'allday')
    return { ...base, background: 'var(--success-bg)', color: 'var(--primary)' }
  return { ...base, background: 'var(--secondary-bg)', color: 'var(--secondary-text)', border: '1px solid var(--secondary-border)' }
}

/* ── Result calendar ─────────────────────────────────────── */
function ResultCalendar({ meeting, dateCounts, total }) {
  const rangeStart = meeting.dateRange.start
  const rangeEnd   = meeting.dateRange.end

  const [year,  setYear]  = useState(() => new Date(rangeStart + 'T00:00:00').getFullYear())
  const [month, setMonth] = useState(() => new Date(rangeStart + 'T00:00:00').getMonth())

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  const firstDow    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const canPrev = new Date(year, month, 1) > new Date(rangeStart + 'T00:00:00')
  const canNext = new Date(year, month + 1, 0) < new Date(rangeEnd + 'T00:00:00')

  function inRange(dateStr) {
    return dateStr >= rangeStart && dateStr <= rangeEnd
  }

  function getCellColors(dateStr) {
    const info = dateCounts[dateStr]
    if (!info || total === 0) return { bg: null, fg: null }
    const ratio = info.count / info.total
    if (ratio === 1)  return { bg: 'var(--primary)',     fg: '#ffffff' }
    if (ratio >= 0.5) return { bg: 'var(--success-bg)',  fg: 'var(--primary)' }
    return                   { bg: 'var(--secondary-bg)', fg: 'var(--secondary-text)' }
  }

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button className="calendar-nav" onClick={prevMonth} disabled={!canPrev}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3.5L6 8l4 4.5"/></svg>
        </button>
        <span className="calendar-month">{year}년 {month + 1}월</span>
        <button className="calendar-nav" onClick={nextMonth} disabled={!canNext}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5l4 4.5-4 4.5"/></svg>
        </button>
      </div>

      <div className="calendar-grid">
        {DOW_KR.map(d => <div key={d} className="calendar-dow">{d}</div>)}

        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />
          const dateStr = toDateString(new Date(year, month, day))
          const ok      = inRange(dateStr)
          const info    = dateCounts[dateStr]
          const { bg, fg } = getCellColors(dateStr)
          const col = idx % 7

          if (!ok) {
            return (
              <div key={dateStr} className="cal-day-wrap">
                <div style={{ width: 34, height: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: 'var(--border)' }}>
                  <span style={{ fontSize: 13 }}>{day}</span>
                </div>
              </div>
            )
          }

          const sunStyle = col === 0 ? { color: '#ef4444' } : col === 6 ? { color: '#3b82f6' } : {}

          return (
            <div key={dateStr} className="cal-day-wrap">
              <div style={{
                width: 36, height: 50,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8,
                background: bg || 'transparent',
                color: bg ? fg : (sunStyle.color || 'var(--text-primary)'),
                transition: 'background .15s',
              }}>
                <span style={{ fontSize: 13, fontWeight: bg ? 700 : 500, lineHeight: 1.2 }}>{day}</span>
                {info && total > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.2, marginTop: 2, opacity: 0.85 }}>
                    {info.count}/{info.total}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Icons ───────────────────────────────────────────────── */
function ShareIcon()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg> }
function PlusIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg> }
function LinkIcon()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> }
function RefreshIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> }
function TrashIcon()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> }
function InfoIcon()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> }
function ChevronDown() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l4 4 4-4"/></svg> }

/* ── Main component ──────────────────────────────────────── */
export default function Results() {
  const { id }        = useParams()
  const navigate      = useNavigate()
  const [params]      = useSearchParams()
  const token         = params.get('token') || ''
  const { msg, show } = useToast()
  const [tab, setTab] = useState('summary')
  const [ownerOpen, setOwnerOpen] = useState(false)

  const meeting   = getMeeting(id)
  const responses = getResponses(id)

  if (!meeting) {
    return (
      <div className="page">
        <div className="page-content">
          <div className="empty-state" style={{ minHeight: '80vh' }}>
            <h3>약속을 찾을 수 없어요</h3>
            <p>삭제됐거나 잘못된 링크예요.</p>
            <button className="btn btn-primary" style={{ width: 'auto', marginTop: 12 }} onClick={() => navigate('/')}>홈으로</button>
          </div>
        </div>
      </div>
    )
  }

  const ownerToken = getOwnerToken(id)
  const isOwner    = token && token === ownerToken
  const joinUrl    = `${window.location.origin}/join/${id}`
  const stats      = computeAll(responses, meeting)

  function handleCopy()  { copyToClipboard(joinUrl).then(() => show('링크가 복사됐어요!')) }
  function handleClear() {
    if (!window.confirm('모든 응답을 초기화할까요? 되돌릴 수 없어요.')) return
    clearResponses(id); show('응답이 초기화됐어요'); window.location.reload()
  }
  function handleDelete() {
    if (!window.confirm(`"${meeting.name}" 약속을 삭제할까요? 되돌릴 수 없어요.`)) return
    deleteMeeting(id); navigate('/')
  }

  const rightSlot = (
    <button className="topbar-action" onClick={handleCopy} aria-label="공유">
      <ShareIcon />
    </button>
  )

  return (
    <Layout title="결과 보기" rightSlot={rightSlot}>
      <div className="tabs">
        <button className={`tab${tab === 'summary' ? ' active' : ''}`} onClick={() => setTab('summary')}>요약 보기</button>
        <button className={`tab${tab === 'friend'  ? ' active' : ''}`} onClick={() => setTab('friend')}>친구별 보기</button>
      </div>

      <div className="page-content-flush">
        <div style={{ padding: '20px 20px 0' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{meeting.name}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {formatDateShort(meeting.dateRange.start)} ~ {formatDateShort(meeting.dateRange.end)} · {meeting.type} · {meeting.duration}
          </p>
        </div>

        {tab === 'summary' && <SummaryTab meeting={meeting} responses={responses} stats={stats} />}
        {tab === 'friend'  && <FriendTab  meeting={meeting} responses={responses} stats={stats} />}

        {isOwner && (
          <div style={{ padding: '0 20px 24px' }}>
            <button
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', padding: '8px 0', fontFamily: 'var(--font)' }}
              onClick={() => setOwnerOpen(o => !o)}
            >
              <InfoIcon /> 소유자 메뉴
              <span style={{ display: 'inline-flex', transform: ownerOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                <ChevronDown />
              </span>
            </button>
            {ownerOpen && (
              <div className="owner-actions">
                <button className="owner-action-btn" onClick={handleCopy}><LinkIcon /> 참여 링크 복사</button>
                <button className="owner-action-btn" onClick={handleClear}><RefreshIcon /> 응답 초기화</button>
                <button className="owner-action-btn danger" onClick={handleDelete}><TrashIcon /> 약속 삭제</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="page-footer">
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate(`/join/${id}`)}><PlusIcon /> 응답 추가</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCopy}>링크 복사</button>
      </div>

      <ToastPortal msg={msg} />
    </Layout>
  )
}

/* ── Summary tab ─────────────────────────────────────────── */
function SummaryTab({ meeting, responses, stats }) {
  const { total, allDates, dateCounts, possibleDatesCount, bestSlots, recs, scheduleMode } = stats

  const bestLabel = scheduleMode === 'exact' ? '모두 가능한 날짜' : '모두 가능한 시간'

  return (
    <div style={{ padding: '0 20px' }}>

      {/* ── Stat summary cards ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { label: '참여자',    value: `${total}명` },
          { label: '가능 날짜', value: `${possibleDatesCount}/${allDates.length}일` },
          { label: bestLabel,   value: `${bestSlots.length}개` },
        ].map(({ label, value }) => (
          <div key={label} style={{
            flex: 1, background: 'var(--bg-muted)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '12px 10px', textAlign: 'center', minWidth: 0,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 3 }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Best time highlight ── */}
      {total > 0 && (
        bestSlots.length > 0 ? (
          <div style={{
            background: 'var(--success-bg)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px', marginBottom: 24,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
              모두 가능한 최적 시간
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {bestSlots.slice(0, 3).map((s, i) => (
                <div key={`${s.date}-${s.block || 'exact'}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: i === 0 ? 'var(--primary)' : 'var(--bg-muted2)',
                    color: i === 0 ? 'white' : 'var(--primary)',
                    fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatDateShort(s.date)}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--primary)', marginLeft: 8 }}>
                      {s.blockLabel
                        ? `${s.blockLabel} (${formatTime(s.timeStart)} – ${formatTime(s.timeEnd)})`
                        : s.timeStart
                          ? `${formatTime(s.timeStart)} – ${formatTime(s.timeEnd)}`
                          : '하루 가능'
                      }
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                    {s.count}/{s.total}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 10, opacity: .7 }}>
              참여자 {total}명 모두 가능
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-muted)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px', marginBottom: 24,
            fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>아직 모두 가능한 시간이 없어요.</div>
            가장 많이 겹치는 시간을 아래에서 확인해 주세요.
          </div>
        )
      )}

      {/* ── Calendar with availability counts ── */}
      <div className="section">
        <div className="section-title">날짜별 가능 인원</div>
        <div className="calendar-wrapper">
          <ResultCalendar meeting={meeting} dateCounts={dateCounts} total={total} />
        </div>
        {total > 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            {[
              { bg: 'var(--primary)',      fg: 'white',                    label: '모두 가능' },
              { bg: 'var(--success-bg)',   fg: 'var(--primary)',            label: '절반 이상' },
              { bg: 'var(--secondary-bg)', fg: 'var(--secondary-text)',     label: '일부 가능' },
            ].map(({ bg, fg, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: bg, display: 'inline-block', flexShrink: 0 }} />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Top 3 recommendations ── */}
      <div className="section">
        <div className="section-title">추천 시간 TOP {Math.min(recs.length, 3) || 3}</div>
        {!total ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>아직 응답이 없어요.</div>
        ) : !recs.length ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>겹치는 날짜가 없어요.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recs.map((rec, i) => (
              <div key={rec.date} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: i === 0 ? 'var(--primary)' : 'var(--text-muted)', width: 22, flexShrink: 0, textAlign: 'center' }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                    {formatDate(rec.date)}
                    {rec.timeStart && rec.timeEnd ? (
                      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6 }}>
                        {formatTime(rec.timeStart)} – {formatTime(rec.timeEnd)}
                      </span>
                    ) : rec.bestBlock ? (
                      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6 }}>
                        {BLOCK_LABELS[rec.bestBlock]} 추천
                      </span>
                    ) : null}
                  </div>
                  <div className="result-bar-wrap">
                    <div className="result-bar" style={{ width: `${(rec.count / rec.total) * 100}%` }} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: rec.count === rec.total ? 'var(--primary)' : 'var(--text-secondary)', flexShrink: 0 }}>
                  {rec.count}/{rec.total}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Participant list ── */}
      <div className="section">
        <div className="section-title">참여자 {total}명</div>
        {!total ? (
          <div style={{ fontSize: 14, color: 'var(--text-muted)', padding: '8px 0' }}>아직 응답한 친구가 없어요.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {responses.map(r => {
              const hub = getHubDisplay(r)
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 10,
                }}>
                  {r.isHost && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: 6 }}>방장</span>
                  )}
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{r.name}</span>
                  {hub ? (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>· {hub}</span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· 출발 거점 미입력</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Friend tab ──────────────────────────────────────────── */
function FriendTab({ meeting, responses, stats }) {
  const { total, dateCounts, scheduleMode } = stats

  if (!total) {
    return <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>아직 응답이 없어요.</div>
  }

  const candidateDates = getDatesBetween(meeting.dateRange.start, meeting.dateRange.end)
    .filter(d => dateCounts[d])
    .slice(0, 14)

  return (
    <div style={{ padding: '0 20px' }}>

      {/* ── Grid table ── */}
      <div className="section">
        <div className="section-title">참여자별 가능 시간</div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: Math.max(candidateDates.length * 58, 200) }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 10px 6px 0', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'left', minWidth: 72, position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 1 }}>
                  이름
                </th>
                {candidateDates.map(d => {
                  const dt   = new Date(d + 'T00:00:00')
                  const info = dateCounts[d]
                  return (
                    <th key={d} style={{ padding: '6px 4px', textAlign: 'center', minWidth: 54, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>
                        {dt.getMonth() + 1}/{dt.getDate()}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {DOW_KR[dt.getDay()]}
                      </div>
                      {info && (
                        <div style={{ fontSize: 10, color: info.count === info.total ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                          {info.count}/{info.total}
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {responses.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '8px 10px 8px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 1 }}>
                    {r.name}
                    {r.isHost && <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--primary)', color: 'white', padding: '1px 4px', borderRadius: 4, marginLeft: 4 }}>방장</span>}
                  </td>
                  {candidateDates.map(d => {
                    const cell = getParticipantCell(r, d, scheduleMode)
                    return (
                      <td key={d} style={{ textAlign: 'center', padding: '8px 4px' }}>
                        <span style={cellStyle(cell)}>{cellText(cell)}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          {[
            { style: { background: 'var(--success-bg)', color: 'var(--primary)' }, label: '가능' },
            { style: { background: 'var(--secondary-bg)', color: 'var(--secondary-text)', border: '1px solid var(--secondary-border)' }, label: '시간대' },
            { style: { background: 'var(--bg-muted)', color: 'var(--text-muted)' }, label: '미입력' },
          ].map(({ style, label }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ ...style, fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Per-person detail cards ── */}
      <div className="section">
        <div className="section-title">친구별 상세 보기</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {responses.map(r => {
            const hub = getHubDisplay(r)
            return (
              <div key={r.id} className="card">
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    {r.isHost && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: 6 }}>방장</span>}
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{r.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>
                      {r.dates.length}일 응답
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: hub ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {hub ? `출발: ${hub}` : '출발 거점 미입력'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {r.dates.map(d => {
                    const blocks   = d.blocks || []
                    const isAllday = blocks.includes('allday')
                    const isAnytime = d.mode === 'anytime' || isAllday

                    let timeLabel = ''
                    if (scheduleMode === 'exact') {
                      timeLabel = d.mode !== 'anytime' && d.timeStart && d.timeEnd
                        ? `${formatTime(d.timeStart)} – ${formatTime(d.timeEnd)}`
                        : ''
                    } else {
                      if (isAllday) {
                        timeLabel = ''
                      } else if (d.timeStart && d.timeEnd) {
                        timeLabel = `${formatTime(d.timeStart)} – ${formatTime(d.timeEnd)}`
                      } else if (blocks.length > 0) {
                        timeLabel = blocks.map(b => BLOCK_LABELS[b]).filter(Boolean).join('·')
                      }
                    }

                    return (
                      <span key={d.date} style={{
                        padding: '4px 10px',
                        background: isAnytime ? 'var(--success-bg)' : 'var(--secondary-bg)',
                        border: `1px solid ${isAnytime ? 'var(--border)' : 'var(--secondary-border)'}`,
                        borderRadius: 20, fontSize: 12, fontWeight: 600,
                        color: isAnytime ? 'var(--primary)' : 'var(--secondary-text)',
                      }}>
                        {formatDateShort(d.date)}
                        {timeLabel && <span style={{ fontWeight: 400, marginLeft: 4 }}>{timeLabel}</span>}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
