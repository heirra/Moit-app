import { useNavigate } from 'react-router-dom'

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.5 4.5L7 10l5.5 5.5" />
    </svg>
  )
}

export default function Layout({ title, onBack, noBack, rightSlot, children }) {
  const navigate = useNavigate()

  function handleBack() {
    if (onBack) onBack()
    else navigate(-1)
  }

  return (
    <div className="page">
      <div className="topbar">
        {noBack ? (
          <div style={{ width: 36 }} />
        ) : (
          <button className="topbar-back" onClick={handleBack} aria-label="뒤로">
            <BackIcon />
          </button>
        )}
        <span className="topbar-title">{title}</span>
        {rightSlot ?? <div style={{ width: 36 }} />}
      </div>
      {children}
    </div>
  )
}
