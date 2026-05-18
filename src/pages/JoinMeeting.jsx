import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getMeeting, saveResponse } from '../lib/storage'
import { generateId, formatDate } from '../lib/utils'
import { useToast, ToastPortal } from '../components/Toast'
import Calendar from '../components/Calendar'
import Layout from '../components/Layout'

/* ── Constants ───────────────────────────────────────────── */
const TIME_BLOCKS = [
  { key: 'morning',   label: '오전', start: '09:00', end: '12:00' },
  { key: 'afternoon', label: '오후', start: '12:00', end: '18:00' },
  { key: 'evening',   label: '저녁', start: '18:00', end: '22:00' },
]

const AREA_CATEGORIES = ['서울', '경기', '인천', '강원', '충청', '전라', '경상', '제주', '직접 입력']

const AREA_PLACEHOLDERS = {
  '서울':     '예: 강남역, 홍대입구, 종로',
  '경기':     '예: 수원역, 동탄, 성남',
  '인천':     '예: 부평역, 송도, 인천터미널',
  '강원':     '예: 춘천, 강릉, 원주',
  '충청':     '예: 대전, 천안, 청주',
  '전라':     '예: 광주, 전주, 목포',
  '경상':     '예: 부산, 대구, 경주',
  '제주':     '예: 제주시, 서귀포',
  '직접 입력': '출발 지역을 직접 입력해주세요.',
}

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

// dateSettings[date] = { mode, block, blocks, timeStart, timeEnd }
function emptyDateSetting() {
  return { mode: 'anytime', block: null, blocks: [], timeStart: '', timeEnd: '' }
}

// Computed once at module level — 48 options (00:00–23:30, every 30 min)
const TIME_OPTIONS = buildTimeOptions()

/* ── Icons ───────────────────────────────────────────────── */
function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M1 1l10 10M11 1L1 11" />
    </svg>
  )
}

/* ── Time range picker sub-component ────────────────────── */
function TimeRangePicker({ setting, onSelectBlock, onChangeStart, onChangeEnd }) {
  return (
    <div>
      {/* Quick block buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {TIME_BLOCKS.map(b => (
          <button
            key={b.key}
            className={`time-block-btn${setting.block === b.key ? ' selected' : ''}`}
            onClick={() => onSelectBlock(b)}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Detailed time adjustment — shown once a block is selected */}
      {setting.block && (
        <div style={{ background: 'var(--bg-muted)', borderRadius: 9, padding: '14px 14px 12px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            {/* Start time */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>시작</div>
              <select
                className="form-input"
                style={{ height: 40, fontSize: 14, paddingLeft: 10, cursor: 'pointer' }}
                value={setting.timeStart}
                onChange={e => onChangeStart(e.target.value)}
              >
                {TIME_OPTIONS.map(o => (
                  <option key={o.val} value={o.val}>{o.label}</option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 18, flexShrink: 0 }}>–</div>

            {/* End time */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>종료</div>
              <select
                className="form-input"
                style={{ height: 40, fontSize: 14, paddingLeft: 10, cursor: 'pointer' }}
                value={setting.timeEnd}
                onChange={e => onChangeEnd(e.target.value)}
              >
                {TIME_OPTIONS.map(o => (
                  <option key={o.val} value={o.val}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time summary chip */}
          {setting.timeStart && setting.timeEnd && (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 12px',
              background: 'var(--success-bg)',
              border: '1px solid #bbf7d0',
              borderRadius: 20,
              fontSize: 12, fontWeight: 700,
              color: 'var(--primary)',
            }}>
              {formatTime(setting.timeStart)} – {formatTime(setting.timeEnd)}
            </div>
          )}
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

  // Host mode: host enters their own availability right after creating the meeting
  const isHost    = params.get('host') === 'true'
  const hostToken = params.get('token') || ''

  const meeting = getMeeting(id)

  const [name,          setName]         = useState('')
  const [areaCategory,  setAreaCategory] = useState('')
  const [areaDetail,    setAreaDetail]   = useState('')
  const [selectedDates, setDates]        = useState([])
  const [dateSettings,  setSettings]     = useState({})
  const [submitted,     setSubmitted]    = useState(false)

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

  /* ── Date selection ──────────────────────────────────── */
  function toggleDate(dateStr) {
    if (selectedDates.includes(dateStr)) {
      setDates(prev => prev.filter(d => d !== dateStr))
      setSettings(s => { const n = { ...s }; delete n[dateStr]; return n })
    } else {
      setDates(prev => [...prev, dateStr].sort())
      setSettings(s => ({ ...s, [dateStr]: s[dateStr] || emptyDateSetting() }))
    }
  }

  function removeDate(dateStr) {
    setDates(prev => prev.filter(d => d !== dateStr))
    setSettings(s => { const n = { ...s }; delete n[dateStr]; return n })
  }

  /* ── Mode toggle ─────────────────────────────────────── */
  function setMode(date, mode) {
    setSettings(s => ({
      ...s,
      [date]: { ...(s[date] || emptyDateSetting()), mode, block: null, blocks: [], timeStart: '', timeEnd: '' },
    }))
  }

  /* ── Block selection (single) ────────────────────────── */
  function selectBlock(date, blockDef) {
    setSettings(s => {
      const cur = s[date] || emptyDateSetting()
      if (cur.block === blockDef.key) {
        return { ...s, [date]: { ...cur, block: null, blocks: [] } }
      }
      return {
        ...s,
        [date]: {
          ...cur,
          block:     blockDef.key,
          blocks:    [blockDef.key],
          timeStart: blockDef.start,
          timeEnd:   blockDef.end,
        },
      }
    })
  }

  /* ── Time range edit ─────────────────────────────────── */
  function setTimeStart(date, val) {
    setSettings(s => ({ ...s, [date]: { ...s[date], timeStart: val } }))
  }
  function setTimeEnd(date, val) {
    setSettings(s => ({ ...s, [date]: { ...s[date], timeEnd: val } }))
  }

  /* ── Area helpers ────────────────────────────────────── */
  function handleAreaCategory(cat) {
    setAreaCategory(prev => prev === cat ? '' : cat)
    setAreaDetail('')
  }

  /* ── Submit ──────────────────────────────────────────── */
  function handleSubmit() {
    if (!name.trim())               { show('이름을 입력해주세요');         return }
    if (selectedDates.length === 0) { show('가능한 날짜를 선택해주세요'); return }

    const areaString = areaCategory
      ? areaDetail.trim() ? `${areaCategory} / ${areaDetail.trim()}` : areaCategory
      : ''

    // For the host, use a stable response ID so re-submissions overwrite rather than stack.
    const responseId = isHost ? `host_${id}` : generateId()

    saveResponse(id, {
      id: responseId,
      name: name.trim(),
      isHost: isHost || undefined,
      startingAreaCategory: areaCategory || null,
      startingAreaDetail:   areaDetail.trim() || null,
      area: areaString,
      dates: selectedDates.map(d => {
        const s = dateSettings[d] || emptyDateSetting()
        return {
          date:      d,
          mode:      s.mode,
          block:     s.block   || null,
          blocks:    s.blocks  || [],
          timeStart: s.mode === 'time' ? (s.timeStart || '') : '',
          timeEnd:   s.mode === 'time' ? (s.timeEnd   || '') : '',
        }
      }),
      submittedAt: new Date().toISOString(),
    })

    if (isHost) {
      // Host → go to the share/completion screen
      navigate(`/meeting/${id}/created?token=${hostToken}`)
    } else {
      setSubmitted(true)
    }
  }

  /* ── Guest success screen ────────────────────────────── */
  if (submitted) {
    return (
      <div className="page">
        <div className="page-content">
          <div className="empty-state" style={{ minHeight: 'calc(100vh - 60px)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
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

  /* ── Page title and helper text ──────────────────────── */
  const pageTitle  = isHost ? '내 가능 시간 입력' : meeting.name
  const helperText = isHost
    ? '약속을 만든 사람도 가능한 시간을 먼저 입력해 주세요.'
    : '가능한 날짜와 시간을 선택해주세요.'
  const submitLabel = isHost ? '내 시간 저장하고 공유하기' : '선택 완료'

  /* ── Main form ───────────────────────────────────────── */
  return (
    <Layout title={pageTitle} onBack={isHost ? undefined : () => navigate('/')}>
      <div className="page-content">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
          {helperText}
        </p>

        {/* ── Name ─────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label">이름</label>
          <input className="form-input" placeholder="예) 김모잇"
            value={name} onChange={e => setName(e.target.value)} maxLength={20} />
        </div>

        {/* ── Starting area ────────────────────────────── */}
        <div className="form-group" style={{ marginBottom: 24 }}>
          <label className="form-label">
            출발 지역 <span>(선택)</span>
          </label>
          <div className="chip-row" style={{ marginBottom: areaCategory ? 10 : 0 }}>
            {AREA_CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`chip-pill${areaCategory === cat ? ' selected' : ''}`}
                onClick={() => handleAreaCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          {areaCategory && (
            <input
              className="form-input"
              style={{ marginTop: 6 }}
              placeholder={AREA_PLACEHOLDERS[areaCategory] || '출발 지역을 입력해주세요.'}
              value={areaDetail}
              onChange={e => setAreaDetail(e.target.value)}
              maxLength={40}
            />
          )}
          {meeting.placeMode === 'middle' && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              중간 장소 추천에 활용돼요.
            </div>
          )}
        </div>

        {/* ── Calendar ─────────────────────────────────── */}
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

        {/* ── Per-date time settings ────────────────────── */}
        {selectedDates.length > 0 && (
          <div className="section">
            <div className="section-title">날짜별 가능 시간</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedDates.map(d => {
                const s = dateSettings[d] || emptyDateSetting()
                return (
                  <div key={d} className="card">
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{formatDate(d)}</div>

                    {/* Mode toggle */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: s.mode === 'time' ? 14 : 0 }}>
                      <button
                        className={`chip-pill${s.mode === 'anytime' ? ' selected' : ''}`}
                        onClick={() => setMode(d, 'anytime')}
                      >
                        하루 아무 때나
                      </button>
                      <button
                        className={`chip-pill${s.mode === 'time' ? ' selected' : ''}`}
                        onClick={() => setMode(d, 'time')}
                      >
                        시간 선택
                      </button>
                    </div>

                    {/* Time detail */}
                    {s.mode === 'time' && (
                      <TimeRangePicker
                        setting={s}
                        onSelectBlock={blockDef => selectBlock(d, blockDef)}
                        onChangeStart={val => setTimeStart(d, val)}
                        onChangeEnd={val => setTimeEnd(d, val)}
                      />
                    )}
                  </div>
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
