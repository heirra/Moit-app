import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getMeeting } from '../lib/storage'
import { copyToClipboard } from '../lib/utils'
import { useToast, ToastPortal } from '../components/Toast'
import Layout from '../components/Layout'

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function MeetingCreated() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const { msg, show } = useToast()

  const meeting = getMeeting(id)
  if (!meeting) {
    return (
      <div className="page">
        <div className="page-content">
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>약속을 찾을 수 없어요.</p>
        </div>
      </div>
    )
  }

  const joinUrl = `${window.location.origin}/join/${id}`

  function handleCopy() {
    copyToClipboard(joinUrl).then(() => show('링크가 복사됐어요!'))
  }

  return (
    <Layout title="약속 완료" noBack>
      <div className="page-content">
        {/* Success card */}
        <div className="success-card">
          <div className="success-icon"><CheckIcon /></div>
          <h2>약속방이 만들어졌어요!</h2>
          <p>아래 링크를 친구들에게 공유해보세요.</p>
        </div>

        {/* Link */}
        <div className="section">
          <div className="section-title">참여자 링크</div>
          <div className="link-box">
            <span className="link-box-url">{joinUrl}</span>
            <button className="link-copy-btn" onClick={handleCopy}>복사</button>
          </div>
        </div>

        {/* How to */}
        <div className="section">
          <div className="section-title">참여 방법</div>
          <div className="how-steps">
            <div className="how-step"><div className="how-step-num">1</div><span>링크를 열고 이름을 입력해요</span></div>
            <div className="how-step"><div className="how-step-num">2</div><span>가능한 날짜와 시간을 선택해요</span></div>
            <div className="how-step"><div className="how-step-num">3</div><span>완료를 누르면 참여가 완료돼요</span></div>
          </div>
        </div>

        {/* Note */}
        <div style={{ fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg-muted)', padding: '12px 14px', borderRadius: 9, lineHeight: 1.6 }}>
          참고: 선택한 내용은 다른 참여자에게 이름과 함께 표시돼요.
        </div>
      </div>

      <div className="page-footer">
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate('/')}>목록으로</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate(`/meeting/${id}/result?token=${token}`)}>결과 보기</button>
      </div>

      <ToastPortal msg={msg} />
    </Layout>
  )
}
