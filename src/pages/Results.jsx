import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  getMeeting, getResponses, clearResponses, deleteMeeting, getOwnerToken,
} from '../lib/storage'
import { copyToClipboard, formatDate, formatDateShort, getDatesBetween } from '../lib/utils'
import { useToast, ToastPortal } from '../components/Toast'
import Calendar from '../components/Calendar'
import Layout from '../components/Layout'

const BLOCK_LABELS = { morning: '오전', afternoon: '오후', evening: '저녁' }

/* ── helpers ──────────────────────────────────────────────── */
function computeRecs(responses, meeting) {
  const total = responses.length
  if (!total) return []
  const dates = getDatesBetween(meeting.dateRange.start, meeting.dateRange.end)
  const scores = {}
  for (const d of dates) {
    const count = responses.filter(r => r.dates.some(x => x.date === d)).length
    if (count) scores[d] = count
  }
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([date, count]) => {
      const blockCounts = {}
      for (const r of responses) {
        const rd = r.dates.find(x => x.date === date)
        if (!rd) continue
        const keys = rd.mode === 'anytime' ? ['morning', 'afternoon', 'evening'] : rd.blocks
        keys.forEach(k => { blockCounts[k] = (blockCounts[k] || 0) + 1 })
      }
      const best = Object.entries(blockCounts).sort((a, b) => b[1] - a[1])[0]
      return { date, count, total, bestBlock: best?.[0] || null }
    })
}

function buildColors(responses, meeting) {
  const total = responses.length
  if (!total) return {}
  const dates = getDatesBetween(meeting.dateRange.start, meeting.dateRange.end)
  const out = {}
  for (const d of dates) {
    const count = responses.filter(r => r.dates.some(x => x.date === d)).length
    if (!count) continue
    const ratio = count / total
    out[d] = ratio === 1 ? '#bbf7d0' : ratio >= 0.5 ? '#d1fae5' : '#ecfdf5'
  }
  return out
}

/* ── Icons ────────────────────────────────────────────────── */
function ShareIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
}
function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
}
function LinkIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
}
function RefreshIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
}
function TrashIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
}
function InfoIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
}
function ChevronDown() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l4 4 4-4"/></svg>
}

/* ── Main component ───────────────────────────────────────── */
export default function Results() {
  const { id }          = useParams()
  const navigate        = useNavigate()
  const [params]        = useSearchParams()
  const token           = params.get('token') || ''
  const { msg, show }   = useToast()
  const [tab, setTab]   = useState('summary')
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
  const recs       = computeRecs(responses, meeting)
  const colors     = buildColors(responses, meeting)

  function handleCopy() {
    copyToClipboard(joinUrl).then(() => show('링크가 복사됐어요!'))
  }

  function handleClear() {
    if (!window.confirm('모든 응답을 초기화할까요? 되돌릴 수 없어요.')) return
    clearResponses(id)
    show('응답이 초기화됐어요')
    window.location.reload()
  }

  function handleDelete() {
    if (!window.confirm(`"${meeting.name}" 약속을 삭제할까요? 되돌릴 수 없어요.`)) return
    deleteMeeting(id)
    navigate('/')
  }

  const rightSlot = (
    <button className="topbar-action" onClick={handleCopy} aria-label="공유">
      <ShareIcon />
    </button>
  )

  return (
    <Layout title="결과 보기" rightSlot={rightSlot}>
      {/* Tabs */}
      <div className="tabs">
        <button className={`tab${tab === 'summary' ? ' active' : ''}`} onClick={() => setTab('summary')}>요약 보기</button>
        <button className={`tab${tab === 'friend'  ? ' active' : ''}`} onClick={() => setTab('friend')}>친구별 보기</button>
      </div>

      <div className="page-content-flush">
        {/* Meeting header */}
        <div style={{ padding: '20px 20px 0' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{meeting.name}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {formatDateShort(meeting.dateRange.start)} ~ {formatDateShort(meeting.dateRange.end)} · {meeting.type} · {meeting.duration}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-muted)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            <InfoIcon /> 결과는 참여자에게만 표시돼요.
          </div>
        </div>

        {tab === 'summary' && <SummaryTab meeting={meeting} responses={responses} recs={recs} colors={colors} />}
        {tab === 'friend'  && <FriendTab  meeting={meeting} responses={responses} colors={colors} />}

        {/* Owner menu */}
        {isOwner && (
          <div style={{ padding: '0 20px 24px' }}>
            <button
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', padding: '8px 0', fontFamily: 'var(--font)' }}
              onClick={() => setOwnerOpen(o => !o)}
            >
              <InfoIcon />
              소유자 메뉴
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

/* ── Summary tab ──────────────────────────────────────────── */
function SummaryTab({ meeting, responses, recs, colors }) {
  const total = responses.length

  return (
    <div style={{ padding: '0 20px' }}>
      {/* Calendar */}
      <div className="section">
        <div className="section-title">캘린더로 보기</div>
        <div className="calendar-wrapper">
          <Calendar
            selectedDates={[]}
            rangeStart={meeting.dateRange.start}
            rangeEnd={meeting.dateRange.end}
            dateColors={colors}
          />
        </div>
        {total > 0 && (
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
            {[['#bbf7d0','모두 가능'],['#d1fae5','일부 가능'],['var(--border)','불가']].map(([bg,label]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: bg, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Top 3 */}
      <div className="section">
        <div className="section-title">추천 시간 TOP {recs.length || 3}</div>
        {!total ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>아직 응답이 없어요.</div>
        ) : !recs.length ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>겹치는 날짜가 없어요.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recs.map((rec, i) => (
              <div key={rec.date} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: i === 0 ? 'var(--primary)' : 'var(--text-muted)', width: 24, flexShrink: 0, textAlign: 'center' }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                    {formatDate(rec.date)}
                    {rec.bestBlock && (
                      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6 }}>
                        {BLOCK_LABELS[rec.bestBlock]} 추천
                      </span>
                    )}
                  </div>
                  <div className="result-bar-wrap">
                    <div className="result-bar" style={{ width: `${(rec.count / rec.total) * 100}%` }} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                  {rec.count}/{rec.total}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Participants */}
      <div className="section">
        <div className="section-title">참여자 {total}명</div>
        {!total ? (
          <div style={{ fontSize: 14, color: 'var(--text-muted)', padding: '8px 0' }}>아직 응답한 친구가 없어요.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {responses.map(r => (
              <span key={r.id} style={{ padding: '5px 12px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                {r.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Friend tab ───────────────────────────────────────────── */
function FriendTab({ meeting, responses, colors }) {
  const total = responses.length
  if (!total) {
    return <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>아직 응답이 없어요.</div>
  }

  // Show only dates that at least one person responded on
  const dates = getDatesBetween(meeting.dateRange.start, meeting.dateRange.end)
    .filter(d => colors[d])
    .slice(0, 7)

  return (
    <div style={{ padding: '0 20px' }}>
      {/* Dot grid table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: dates.length * 50 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 8px 8px 0', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'left', width: 80, whiteSpace: 'nowrap' }}>참여자</th>
              {dates.map(d => (
                <th key={d} style={{ padding: '8px 4px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'center', minWidth: 40 }}>
                  {new Date(d + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                  <br />
                  <span style={{ fontWeight: 400, fontSize: 10 }}>
                    {['일','월','화','수','목','금','토'][new Date(d + 'T00:00:00').getDay()]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {responses.map(r => (
              <tr key={r.id}>
                <td style={{ padding: '7px 8px 7px 0', fontSize: 13, fontWeight: 600 }}>{r.name}</td>
                {dates.map(d => {
                  const rd    = r.dates.find(x => x.date === d)
                  const state = !rd ? 'none' : rd.mode === 'anytime' ? 'full' : rd.blocks.length ? 'partial' : 'none'
                  return (
                    <td key={d} style={{ textAlign: 'center', padding: '7px 4px' }}>
                      <span className={`avail-dot avail-${state}`} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
        {[['full','가능'],['partial','일부 가능'],['none','불가']].map(([k,l]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className={`avail-dot avail-${k}`} /> {l}
          </span>
        ))}
      </div>

      {/* Per-person detail cards */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
        {responses.map(r => (
          <div key={r.id} className="card">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              {r.name}
              {r.area && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>({r.area})</span>}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>{r.dates.length}일 응답</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {r.dates.map(d => (
                <span key={d.date} style={{
                  padding: '4px 10px',
                  background: d.mode === 'anytime' ? 'var(--success-bg)' : 'var(--secondary-bg)',
                  border: `1px solid ${d.mode === 'anytime' ? '#bbf7d0' : 'var(--secondary-border)'}`,
                  borderRadius: 20, fontSize: 12, fontWeight: 600,
                  color: d.mode === 'anytime' ? 'var(--primary)' : 'var(--secondary-text)',
                }}>
                  {formatDateShort(d.date)}
                  {d.mode === 'time' && d.blocks.length > 0 && (
                    <span style={{ fontWeight: 400, marginLeft: 4 }}>
                      {d.blocks.map(b => BLOCK_LABELS[b]).join('·')}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
