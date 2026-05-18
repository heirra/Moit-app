import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateId, toDateString, addDays } from '../lib/utils'
import { saveMeeting, saveOwnerToken, addMyMeeting } from '../lib/storage'
import Layout from '../components/Layout'

const TYPES = [
  { key: '식사',       icon: FoodIcon },
  { key: '카페',       icon: CafeIcon },
  { key: '영화',       icon: MovieIcon },
  { key: '데이트',     icon: HeartIcon },
  { key: '친구랑 놀기', icon: FriendsIcon },
  { key: '여행/나들이', icon: GlobeIcon },
  { key: '직접 설정',  icon: SettingsIcon },
]

const TYPE_DURATIONS = {
  '식사':       '2시간',
  '카페':       '1시간 30분',
  '영화':       '2시간',
  '데이트':     '3~4시간',
  '친구랑 놀기': '3~4시간',
  '여행/나들이': '반나절',
  '직접 설정':  '직접 설정',
}

const DURATIONS = ['1시간', '1시간 30분', '2시간', '3~4시간', '반나절', '하루', '직접 설정']

const todayStr   = toDateString(new Date())
const defaultEnd = addDays(todayStr, 30)

export default function CreateMeeting() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '', description: '',
    type: '식사', duration: '2시간',
    scheduleMode: 'flexible', placeMode: 'later',
    dateStart: todayStr, dateEnd: defaultEnd,
    maxParticipants: '',
  })

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function setType(key) {
    setForm(f => ({
      ...f,
      type: key,
      duration: TYPE_DURATIONS[key] ?? f.duration,
    }))
  }

  function canNext() {
    if (step === 1) return form.name.trim().length > 0
    return true
  }

  function handleNext() {
    if (step < 3) { setStep(s => s + 1); return }
    const id    = generateId(8)
    const token = generateId(16)
    saveMeeting({
      id,
      name:            form.name.trim(),
      description:     form.description.trim(),
      type:            form.type,
      duration:        form.duration,
      scheduleMode:    form.scheduleMode,
      placeMode:       form.placeMode,
      dateRange:       { start: form.dateStart, end: form.dateEnd },
      maxParticipants: form.maxParticipants || null,
      createdAt:       new Date().toISOString(),
    })
    saveOwnerToken(id, token)
    addMyMeeting(id)
    // Host enters their own availability before seeing the share screen
    navigate(`/join/${id}?host=true&token=${token}`)
  }

  return (
    <Layout title="약속 만들기" onBack={step > 1 ? () => setStep(s => s - 1) : undefined}>
      <div className="step-progress">
        {[1, 2, 3].map(s => (
          <div key={s} className={`step-bar${s <= step ? ' active' : ''}`} />
        ))}
      </div>

      <div className="page-content">
        {step === 1 && <Step1 form={form} set={set} />}
        {step === 2 && <Step2 form={form} set={set} setType={setType} />}
        {step === 3 && <Step3 form={form} set={set} />}
      </div>

      <div className="page-footer">
        <button className="btn btn-primary" onClick={handleNext} disabled={!canNext()}>
          {step === 3 ? '약속방 만들기' : '다음'}
        </button>
      </div>
    </Layout>
  )
}

/* ── Step 1: 약속 이름 + 시간 고르는 방식 ──────────────────── */
function Step1({ form, set }) {
  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3 }}>약속의 기본 방향을<br />정해볼까요?</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>이름과 시간 입력 방식을 먼저 설정해요</p>
      </div>

      {/* 약속 이름 */}
      <div className="form-group">
        <label className="form-label">약속 이름</label>
        <input
          className="form-input"
          placeholder="예) 친구들과 저녁 식사"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          maxLength={40}
        />
      </div>

      {/* 시간 고르는 방식 */}
      <div className="section">
        <div className="section-title" style={{ marginBottom: 4 }}>시간 고르는 방식</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          친구들이 시간을 어떻게 고르게 할까요?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            {
              val:  'exact',
              title: '정확한 시간으로 잡기',
              desc:  '시작·끝 시간이 중요한 약속',
              sub:   '예: 회의, 예약, 영화, 스터디',
            },
            {
              val:  'flexible',
              title: '여유 시간대로 잡기',
              desc:  '오전·오후·저녁처럼 넓게 맞추는 약속',
              sub:   '예: 밥, 카페, 주말 약속',
            },
          ].map(o => (
            <button
              key={o.val}
              className={`radio-card${form.scheduleMode === o.val ? ' selected' : ''}`}
              onClick={() => set('scheduleMode', o.val)}
            >
              <div className="radio-dot" />
              <div className="radio-card-text">
                <strong>{o.title}</strong>
                <span>{o.desc}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>{o.sub}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

/* ── Step 2: 약속 유형 + 예상 소요 시간 + 만날 장소 ──────────── */
function Step2({ form, set, setType }) {
  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3 }}>약속 유형을<br />선택해주세요</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>유형에 맞게 소요 시간을 자동 추천해드려요</p>
      </div>

      {/* 약속 유형 */}
      <div className="section">
        <div className="section-title">약속 유형</div>
        <div className="chip-grid">
          {TYPES.map(({ key, icon: Icon }) => (
            <button
              key={key}
              className={`chip${form.type === key ? ' selected' : ''}`}
              onClick={() => setType(key)}
            >
              <span style={{ color: form.type === key ? 'var(--primary)' : 'var(--text-muted)' }}>
                <Icon />
              </span>
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* 예상 소요 시간 */}
      <div className="section">
        <div className="section-title" style={{ marginBottom: 4 }}>예상 소요 시간</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>결과 추천에 사용할 약속 길이예요.</p>
        <div className="chip-row">
          {DURATIONS.map(d => (
            <button
              key={d}
              className={`chip-pill${form.duration === d ? ' selected' : ''}`}
              onClick={() => set('duration', d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* 만날 장소 */}
      <div className="section">
        <div className="section-title">만날 장소</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            {
              val:   'later',
              title: '나중에 정하기',
              desc:  '시간만 먼저 고르고, 장소는 나중에 정해요.',
            },
            {
              val:   'middle',
              title: '중간 장소 추천 받기',
              desc:  '참여자 출발 장소를 바탕으로 만나기 쉬운 후보를 추천해요.',
            },
          ].map(o => (
            <button
              key={o.val}
              className={`radio-card${form.placeMode === o.val ? ' selected' : ''}`}
              onClick={() => set('placeMode', o.val)}
            >
              <div className="radio-dot" />
              <div className="radio-card-text">
                <strong>{o.title}</strong>
                <span>{o.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

/* ── Step 3: 추가 설정 + 확인 ────────────────────────────── */
function Step3({ form, set }) {
  const modeLabel = form.scheduleMode === 'exact' ? '정확한 시간으로 잡기' : '여유 시간대로 잡기'
  const placeLabel = form.placeMode === 'later' ? '나중에 정하기' : '중간 장소 추천 받기'

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3 }}>마지막으로<br />날짜를 설정해요</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>언제 가능한지 범위를 알려주세요</p>
      </div>

      {/* 지금까지 설정 미리보기 */}
      <div style={{
        background: 'var(--bg-muted)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 14px', marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '.3px' }}>
          지금까지 설정한 내용
        </div>
        {[
          [form.name,  '약속 이름'],
          [modeLabel,  '시간 방식'],
          [form.type,  '약속 유형'],
          [form.duration, '소요 시간'],
          [placeLabel, '장소'],
        ].map(([val, label]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
          </div>
        ))}
      </div>

      {/* 가능 날짜 범위 */}
      <div className="form-group">
        <label className="form-label">가능 날짜 범위</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date" className="form-input" value={form.dateStart} min={todayStr}
            onChange={e => set('dateStart', e.target.value)}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 14, flexShrink: 0 }}>~</span>
          <input
            type="date" className="form-input" value={form.dateEnd} min={form.dateStart}
            onChange={e => set('dateEnd', e.target.value)}
          />
        </div>
      </div>

      {/* 설명 (선택) */}
      <div className="form-group">
        <label className="form-label">설명 <span>(선택)</span></label>
        <textarea
          className="form-textarea" placeholder="약속에 대한 간단한 설명을 입력해주세요." rows={3}
          value={form.description} onChange={e => set('description', e.target.value)} maxLength={80}
        />
        <div className="char-count">{form.description.length}/80</div>
      </div>

      {/* 참여자 제한 (선택) */}
      <div className="form-group">
        <label className="form-label">참여자 제한 <span>(선택)</span></label>
        <input
          type="number" className="form-input" placeholder="제한 없음"
          value={form.maxParticipants} min={2} max={50}
          onChange={e => set('maxParticipants', e.target.value)}
        />
      </div>
    </>
  )
}

/* ── Inline SVG icons ────────────────────────────────────── */
function FoodIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6h4l-1 7h-3"/></svg>
}
function CafeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>
}
function MovieIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="2.18"/><line x1="7" x2="7" y1="2" y2="22"/><line x1="17" x2="17" y1="2" y2="22"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="2" x2="7" y1="7" y2="7"/><line x1="2" x2="7" y1="17" y2="17"/><line x1="17" x2="22" y1="17" y2="17"/><line x1="17" x2="22" y1="7" y2="7"/></svg>
}
function HeartIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
}
function FriendsIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function GlobeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
}
function SettingsIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
