import { useNavigate } from 'react-router-dom'
import { getMeeting, getMyMeetingIds, getResponses } from '../lib/storage'
import { formatDateShort } from '../lib/utils'

function CalendarIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2.5" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const myIds   = getMyMeetingIds()
  const meetings = myIds.map(id => getMeeting(id)).filter(Boolean)

  return (
    <div className="page">
      {/* Top bar */}
      <div className="topbar">
        <div style={{ width: 36 }} />
        <div className="home-logo" style={{ flex: 1, justifyContent: 'center' }}>
          <div className="home-logo-mark">M</div>
          <span className="home-logo-name">Moit</span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Content */}
      <div className="page-content" style={{ paddingBottom: meetings.length ? 100 : 32 }}>
        {meetings.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 'calc(100vh - 180px)' }}>
            <div className="empty-state-icon">
              <CalendarIcon size={28} />
            </div>
            <h3>아직 만든 약속이 없어요</h3>
            <p>새 약속을 만들어 친구들과<br />공유해보세요.</p>
            <button
              className="btn btn-primary"
              style={{ width: 'auto', marginTop: 8 }}
              onClick={() => navigate('/create')}
            >
              <PlusIcon />
              새 약속 만들기
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                내 약속 {meetings.length}개
              </span>
            </div>
            {meetings.map(m => {
              const cnt = getResponses(m.id).length
              return (
                <button
                  key={m.id}
                  className="meeting-item"
                  onClick={() => navigate(`/meeting/${m.id}/result`)}
                >
                  <div className="meeting-item-icon">
                    <CalendarIcon size={20} />
                  </div>
                  <div className="meeting-item-info">
                    <div className="meeting-item-name">{m.name}</div>
                    <div className="meeting-item-meta">
                      {formatDateShort(m.dateRange.start)} ~ {formatDateShort(m.dateRange.end)} · 응답 {cnt}명
                    </div>
                  </div>
                  <ChevronRight />
                </button>
              )
            })}
          </>
        )}
      </div>

      {meetings.length > 0 && (
        <div className="page-footer">
          <button className="btn btn-primary" onClick={() => navigate('/create')}>
            <PlusIcon />
            새 약속 만들기
          </button>
        </div>
      )}
    </div>
  )
}
