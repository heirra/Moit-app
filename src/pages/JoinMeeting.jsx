import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getMeeting, saveResponse } from '../lib/storage'
import { generateId, formatDate } from '../lib/utils'
import { useToast, ToastPortal } from '../components/Toast'
import Calendar from '../components/Calendar'
import Layout from '../components/Layout'

const TIME_BLOCKS = [
  { key: 'morning',   label: '오전', sub: '6–12시' },
  { key: 'afternoon', label: '오후', sub: '12–18시' },
  { key: 'evening',   label: '저녁', sub: '18–24시' },
]

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M1 1l10 10M11 1L1 11" />
    </svg>
  )
}

export default function JoinMeeting() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { msg, show } = useToast()
  const meeting = getMeeting(id)

  const [name, setName]             = useState('')
  const [area, setArea]             = useState('')
  const [selectedDates, setDates]   = useState([])
  const [dateSettings, setSettings] = useState({})  // { [date]: { mode, blocks[] } }
  const [submitted, setSubmitted]   = useState(false)

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

  function toggleDate(dateStr) {
    if (selectedDates.includes(dateStr)) {
      setDates(prev => prev.filter(d => d !== dateStr))
      setSettings(s => { const n = { ...s }; delete n[dateStr]; return n })
    } else {
      setDates(prev => [...prev, dateStr].sort())
      setSettings(s => ({ ...s, [dateStr]: s[dateStr] || { mode: 'anytime', blocks: [] } }))
    }
  }

  function removeDate(dateStr) {
    setDates(prev => prev.filter(d => d !== dateStr))
    setSettings(s => { const n = { ...s }; delete n[dateStr]; return n })
  }

  function setMode(date, mode) {
    setSettings(s => ({ ...s, [date]: { ...s[date], mode, blocks: mode === 'anytime' ? [] : (s[date]?.blocks || []) } }))
  }

  function toggleBlock(date, key) {
    setSettings(s => {
      const cur    = s[date]?.blocks || []
      const blocks = cur.includes(key) ? cur.filter(b => b !== key) : [...cur, key]
      return { ...s, [date]: { ...s[date], blocks } }
    })
  }

  function handleSubmit() {
    if (!name.trim())           { show('이름을 입력해주세요');         return }
    if (selectedDates.length === 0) { show('가능한 날짜를 선택해주세요'); return }

    saveResponse(id, {
      id: generateId(),
      name: name.trim(),
      area: area.trim(),
      dates: selectedDates.map(d => ({
        date:   d,
        mode:   dateSettings[d]?.mode   || 'anytime',
        blocks: dateSettings[d]?.blocks || [],
      })),
      submittedAt: new Date().toISOString(),
    })
    setSubmitted(true)
  }

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
            <button className="btn btn-primary" style={{ width: 'auto', marginTop: 12 }} onClick={() => navigate(`/meeting/${id}/result`)}>
              결과 보기
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Layout title={meeting.name} onBack={() => navigate('/')}>
      <div className="page-content">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
          가능한 날짜와 시간을 선택해주세요.
        </p>

        {/* Name */}
        <div className="form-group">
          <label className="form-label">이름</label>
          <input className="form-input" placeholder="예) 김모잇"
            value={name} onChange={e => setName(e.target.value)} maxLength={20} />
        </div>

        {/* Area — only for middle-place mode */}
        {meeting.placeMode === 'middle' && (
          <div className="form-group">
            <label className="form-label">출발 지역 <span>(선택)</span></label>
            <input className="form-input" placeholder="예) 종로·광화문"
              value={area} onChange={e => setArea(e.target.value)} maxLength={30} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>중간 장소 추천에 활용돼요.</div>
          </div>
        )}

        {/* Calendar */}
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

        {/* Per-date time settings */}
        {selectedDates.length > 0 && (
          <div className="section">
            <div className="section-title">날짜별 가능 시간</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedDates.map(d => {
                const s = dateSettings[d] || { mode: 'anytime', blocks: [] }
                return (
                  <div key={d} className="card">
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{formatDate(d)}</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: s.mode === 'time' ? 12 : 0 }}>
                      <button className={`chip-pill${s.mode === 'anytime' ? ' selected' : ''}`}
                        onClick={() => setMode(d, 'anytime')}>하루 아무 때나</button>
                      <button className={`chip-pill${s.mode === 'time' ? ' selected' : ''}`}
                        onClick={() => setMode(d, 'time')}>시간 선택</button>
                    </div>
                    {s.mode === 'time' && (
                      <div className="time-blocks">
                        {TIME_BLOCKS.map(b => (
                          <button key={b.key}
                            className={`time-block-btn${s.blocks.includes(b.key) ? ' selected' : ''}`}
                            onClick={() => toggleBlock(d, b.key)}>
                            {b.label}
                            <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, opacity: .7 }}>{b.sub}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="page-footer">
        <button className="btn btn-primary" onClick={handleSubmit}
          disabled={!name.trim() || selectedDates.length === 0}>
          선택 완료
        </button>
      </div>

      <ToastPortal msg={msg} />
    </Layout>
  )
}
