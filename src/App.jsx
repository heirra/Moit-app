import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CreateMeeting from './pages/CreateMeeting'
import MeetingCreated from './pages/MeetingCreated'
import JoinMeeting from './pages/JoinMeeting'
import Results from './pages/Results'

export default function App() {
  return (
    <div className="app-shell">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateMeeting />} />
          <Route path="/meeting/:id/created" element={<MeetingCreated />} />
          <Route path="/meeting/:id/result" element={<Results />} />
          <Route path="/join/:id" element={<JoinMeeting />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

function NotFound() {
  return (
    <div className="page">
      <div className="page-content">
        <div className="empty-state" style={{ minHeight: '100vh' }}>
          <h3>페이지를 찾을 수 없어요</h3>
          <p>주소를 다시 확인해주세요.</p>
          <a href="/" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" style={{ width: 'auto' }}>홈으로</button>
          </a>
        </div>
      </div>
    </div>
  )
}
