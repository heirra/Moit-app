import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getMeeting, saveResponse } from '../lib/storage'
import { generateId, formatDate } from '../lib/utils'
import { useToast, ToastPortal } from '../components/Toast'
import Calendar from '../components/Calendar'
import Layout from '../components/Layout'

/* ── Constants ───────────────────────────────────────────── */
const HUBS_POPULAR = ['강남/역삼', '홍대/신촌', '종로/을지로', '성수/건대', '잠실', '여의도/영등포', '서울역/용산', '사당/교대']
const HUBS_MORE    = ['왕십리', '혜화', '수원', '동탄', '분당/판교', '인천/부평']
const HUB_CUSTOM   = '직접 입력'

const FLEX_BLOCKS = [
  { key: 'morning',   label: '오전' },
  { key: 'afternoon', label: '오후' },
  { key: 'evening',   label: '저녁' },
  { key: 'allday',    label: '하루 가능' },
]

/* ── Helpers ─────────────────────────────────────────────── */
function buildTimeOptions() {
  const opts = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const val    = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const period = h >= 12 ? '오후' : '오전'
      const hr     = h === 0 ? 12 : h > 12 ? h - 12 : h
      const label  = `${period} ${hr}:${String(m).padStart(2, '0')}`
      opts.push({ val, label })
    }
  }
  return opts
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? '오후' : '오전'
  const hr     = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${hr}:${String(m).padStart(2, '0')}`
}

function emptyDateSetting(scheduleMode) {
  if (scheduleMode === 'exact') {
    return { mode: 'exact', timeStart: '09:00', timeEnd: '18:00', blocks: [] }
  }
  return { mode: 'flexible', blocks: [], timeStart: '', timeEnd: '' }
}

const TIME_OPTIONS = buildTimeOptions()

/* ── Icons ───────────────────────────────────────────────── */
function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M1 1l10 10M11 1L1 11" />
    </svg>
  )
}

/* ── Hub section (only when placeMode === 'middle') ──────── */
function HubSection({ startingHub, startingDetail, showMore, onSelectHub, onToggleMore, onChangeDetail }) {
  const displayed = showMore
    ? [...HUBS_POPULAR, ...HUBS_MORE, HUB_CUSTOM]
    : [...HUBS_POPULAR, HUB_CUSTOM]

  return (
    <div className="form-group" style={{ marginBottom: 24 }}>
      <label className="form-label">출발 거점 <span>(선택)</span></label>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
        중간 장소 추천을 원하면 출발 거점을 알려주세요.
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        건너뛰어도 참여할 수 있어요.
      </p>

      <div className="chip-row" style={{ marginBottom: 8 }}>
        {displayed.map(hub => (
          <button
            key={hub}
            className={`chip-pill${startingHub === hub ? ' selected' : ''}`}
            onClick={() => onSelectHub(hub)}
          >
            {hub}
          </button>
        ))}
      </div>

      {!showMore && (
        <button
          style={{
            fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none',
            cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--font)', textDecoration: 'underline',
          }}
          onClick={onToggleMore}
        >
          더 보기
        </button>
      )}

      {startingHub === HUB_CUSTOM && (
        <input
          className="form-input"
          style={{ marginTop: 8 }}
          placeholder="출발 지역을 직접 입력해주세요."
          value={startingDetail}
          onChange={e => onChangeDetail(e.target.value)}
          maxLength={40}
        />
      )}
    </div>
  )
}

/* ── Exact mode: per-date time pickers ───────────────────── */
function ExactDateCard({ d, s, onSetMode, onChangeStart, onChangeEnd }) {
  return (
    <div className="card">
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{formatDate(d)}</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: s.mode !== 'anytime' ? 14 : 0 }}>
        <button
          className={`chip-pill${s.mode === 'anytime' ? ' selected' : ''}`}
          onClick={() => onSetMode(d, 'anytime')}
        >
          하루 가능
        </button>
        <button
          className={`chip-pill${s.mode !== 'anytime' ? ' selected' : ''}`}
          onClick={() => onSetMode(d, 'exact')}
        >
          시간 선택
        </button>
      </div>

      {s.mode !== 'anytime' && (
        <div style={{ background: 'var(--bg-muted)', borderRadius: 9, padding: '14px 14px 12px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>시작</div>
              <select
                className="form-input"
                style={{ height: 40, fontSize: 14, paddingLeft: 10, cursor: 'pointer' }}
                value={s.timeStart}
                onChange={e => onChangeStart(d, e.target.value)}
              >
                {TIME_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 18, flexShrink: 0 }}>–</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>종료</div>
              <select
                className="form-input"
                style={{ height: 40, fontSize: 14, paddingLeft: 10, cursor: 'pointer' }}
                value={s.timeEnd}
                onChange={e => onChangeEnd(d, e.target.value)}
              >
                {TIME_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {s.timeStart && s.timeEnd && (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 12px', background: 'var(--success-bg)',
              borderRadius: 20, fontSize: 12, fontWeight: 700, color: 'var(--primary)',
            }}>
              {formatTime(s.timeStart)} – {formatTime(s.timeEnd)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Flexible mode: broad blocks + optional time ─────────── */
function FlexDateCard({ d, s, onToggleBlock, onChangeStart, onChangeEnd }) {
  const blocks   = s.blocks || []
  const isAllday = blocks.includes('allday')
  const hasBlocks = blocks.length > 0

  return (
    <div className="card">
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{formatDate(d)}</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: hasBlocks && !isAllday ? 14 : 0 }}>
        {FLEX_BLOCKS.map(b => (
          <button
            key={b.key}
            className={`chip-pill${blocks.includes(b.key) ? ' selected' : ''}`}
            onClick={() => onToggleBlock(d, b.key)}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Optional detailed time — shown only if non-allday blocks selected */}
      {hasBlocks && !isAllday && (
        <div style={{ background: 'var(--bg-muted)', borderRadius: 9, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>
            세부 시간 조정 (선택)
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>시작</div>
              <select
                className="form-input"
                style={{ height: 40, fontSize: 14, paddingLeft: 10, cursor: 'pointer' }}
                value={s.timeStart}
                onChange={e => onChangeStart(d, e.target.value)}
              >
                <option value="">선택 안 함</option>
                {TIME_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 18, flexShrink: 0 }}>–</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>종료</div>
              <select
                className="form-input"
                style={{ height: 40, fontSize: 14, paddingLeft: 10, cursor: 'pointer' }}
                value={s.timeEnd}
                onChange={e => onChangeEnd(d, e.target.value)}
              >
                <option value="">선택 안 함</option>
                {TIME_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main component ──────────────────────────────────────── */
export default function JoinMeeting() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { msg, show } = useToast()

  const isHost    = params.get('host') === 'true'
  const hostToken = params.get('token') || ''

  const meeting = getMeeting(id)

  const [name,           setName]           = useState('')
  const [startingHub,    setStartingHub]    = useState('')
  const [startingDetail, setStartingDetail] = useState('')
  const [showMoreHubs,   setShowMoreHubs]   = useState(false)
  const [selectedDates,  setDates]          = useState([])
  const [dateSettings,   setSettings]       = useState({})
  const [submitted,      setSubmitted]      = useState(false)

  if (!meeting) {
    return (
      <div className="page">
        <div className="page-content">
          <div className="empty-state" style={{ minHeight: '80vh' }}>
            <h3>약속을 찾을 수 없어요</h3>
            <p>링크가 만료됐거나 잘못됐어요.</p>
          </div>
        </div>
      </div>
    )
  }

  const scheduleMode = meeting.scheduleMode || 'flexible'
  const showArea     = meeting.placeMode === 'middle'

  /* ── Date selection ──────────────────────────────────────── */
  function toggleDate(dateStr) {
    if (selectedDates.includes(dateStr)) {
      setDates(prev => prev.filter(d => d !== dateStr))
      setSettings(s => { const n = { ...s }; delete n[dateStr]; return n })
    } else {
      setDates(prev => [...prev, dateStr].sort())
      setSettings(s => ({ ...s, [dateStr]: s[dateStr] || emptyDateSetting(scheduleMode) }))
    }
  }

  function removeDate(dateStr) {
    setDates(prev => prev.filter(d => d !== dateStr))
    setSettings(s => { const n = { ...s }; delete n[dateStr]; return n })
  }

  /* ── Exact mode: toggle anytime vs timed ────────────────── */
  function setExactMode(date, mode) {
    setSettings(s => ({
      ...s,
      [date]: { ...(s[date] || emptyDateSetting('exact')), mode },
    }))
  }

  /* ── Flexible mode: multi-select blocks ─────────────────── */
  function toggleFlexBlock(date, blockKey) {
    setSettings(s => {
      const cur    = s[date] || emptyDateSetting('flexible')
      const blocks = cur.blocks || []

      if (blockKey === 'allday') {
        const newBlocks = blocks.includes('allday') ? [] : ['allday']
        return { ...s, [date]: { ...cur, blocks: newBlocks, timeStart: '', timeEnd: '' } }
      }

      let newBlocks = blocks.filter(b => b !== 'allday')
      newBlocks = newBlocks.includes(blockKey)
        ? newBlocks.filter(b => b !== blockKey)
        : [...newBlocks, blockKey]
      return { ...s, [date]: { ...cur, blocks: newBlocks } }
    })
  }

  /* ── Time setters ────────────────────────────────────────── */
  function setTimeStart(date, val) {
    setSettings(s => ({ ...s, [date]: { ...s[date], timeStart: val } }))
  }
  function setTimeEnd(date, val) {
    setSettings(s => ({ ...s, [date]: { ...s[date], timeEnd: val } }))
  }

  /* ── Hub selection ───────────────────────────────────────── */
  function handleHubSelect(hub) {
    setStartingHub(prev => prev === hub ? '' : hub)
    if (hub !== HUB_CUSTOM) setStartingDetail('')
  }

  /* ── Submit ──────────────────────────────────────────────── */
  function handleSubmit() {
    if (!name.trim())               { show('이름을 입력해주세요');         return }
    if (selectedDates.length === 0) { show('가능한 날짜를 선택해주세요'); return }

    const areaDisplay = startingHub === HUB_CUSTOM
      ? startingDetail.trim()
      : startingHub || ''

    const responseId = isHost ? `host_${id}` : generateId()

    saveResponse(id, {
      id: responseId,
      name: name.trim(),
      isHost: isHost || undefined,
      startingHub: startingHub || null,
      startingAreaDetail: startingHub === HUB_CUSTOM ? startingDetail.trim() || null : null,
      area: areaDisplay,
      dates: selectedDates.map(d => {
        const s = dateSettings[d] || emptyDateSetting(scheduleMode)
        return {
          date:      d,
          mode:      s.mode,
          blocks:    s.blocks  || [],
          timeStart: s.timeStart || '',
          timeEnd:   s.timeEnd   || '',
        }
      }),
      submittedAt: new Date().toISOString(),
    })

    if (isHost) {
      navigate(`/meeting/${id}/created?token=${hostToken}`)
    } else {
      setSubmitted(true)
    }
  }

  /* ── Guest success screen ────────────────────────────────── */
  if (submitted) {
    return (
      <div className="page">
        <div className="page-content">
          <div className="empty-state" style={{ minHeight: 'calc(100vh - 60px)' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--success-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3>응답이 완료됐어요!</h3>
            <p>{name}님의 가능한 시간이<br />등록됐어요.</p>
            <button className="btn btn-primary" style={{ width: 'auto', marginTop: 12 }}
              onClick={() => navigate(`/meeting/${id}/result`)}>
              결과 보기
            </button>
          </div>
        </div>
      </div>
    )
  }

  const pageTitle   = isHost ? '내 가능 시간 입력' : meeting.name
  const helperText  = isHost
    ? '약속을 만든 사람도 가능한 시간을 먼저 입력해 주세요.'
    : '가능한 날짜와 시간을 선택해주세요.'
  const submitLabel = isHost ? '내 시간 저장하고 공유하기' : '선택 완료'

  return (
    <Layout title={pageTitle} onBack={isHost ? undefined : () => navigate('/')}>
      <div className="page-content">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
          {helperText}
        </p>

        {/* ── Name ─────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label">이름</label>
          <input className="form-input" placeholder="예) 김모잇"
            value={name} onChange={e => setName(e.target.value)} maxLength={20} />
        </div>

        {/* ── Starting hub (only for middle place mode) ─────── */}
        {showArea && (
          <HubSection
            startingHub={startingHub}
            startingDetail={startingDetail}
            showMore={showMoreHubs}
            onSelectHub={handleHubSelect}
            onToggleMore={() => setShowMoreHubs(true)}
            onChangeDetail={v => setStartingDetail(v)}
          />
        )}

        {/* ── Calendar ─────────────────────────────────────── */}
        <div className="section">
          <div className="section-title">
            날짜 선택
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>(복수 선택 가능)</span>
          </div>
          <div className="calendar-wrapper">
            <Calendar
              selectedDates={selectedDates}
              onToggleDate={toggleDate}
              rangeStart={meeting.dateRange.start}
              rangeEnd={meeting.dateRange.end}
            />
          </div>

          {selectedDates.length > 0 && (
            <div className="date-chips">
              {selectedDates.map(d => (
                <span key={d} className="date-chip">
                  {formatDate(d)}
                  <button className="date-chip-remove" onClick={() => removeDate(d)}><XIcon /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Per-date time settings ────────────────────────── */}
        {selectedDates.length > 0 && (
          <div className="section">
            <div className="section-title">날짜별 가능 시간</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedDates.map(d => {
                const s = dateSettings[d] || emptyDateSetting(scheduleMode)
                if (scheduleMode === 'exact') {
                  return (
                    <ExactDateCard key={d} d={d} s={s}
                      onSetMode={setExactMode}
                      onChangeStart={setTimeStart}
                      onChangeEnd={setTimeEnd}
                    />
                  )
                }
                return (
                  <FlexDateCard key={d} d={d} s={s}
                    onToggleBlock={toggleFlexBlock}
                    onChangeStart={setTimeStart}
                    onChangeEnd={setTimeEnd}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="page-footer">
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!name.trim() || selectedDates.length === 0}
        >
          {submitLabel}
        </button>
      </div>

      <ToastPortal msg={msg} />
    </Layout>
  )
}
