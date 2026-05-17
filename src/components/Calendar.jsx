import { useState } from 'react'
import { toDateString } from '../lib/utils'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3.5L6 8l4 4.5" />
    </svg>
  )
}
function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5l4 4.5-4 4.5" />
    </svg>
  )
}

export default function Calendar({ selectedDates = [], onToggleDate, rangeStart, rangeEnd, dateColors }) {
  const todayStr = toDateString(new Date())

  const [year, setYear] = useState(() => {
    const base = rangeStart ? new Date(rangeStart + 'T00:00:00') : new Date()
    return base.getFullYear()
  })
  const [month, setMonth] = useState(() => {
    const base = rangeStart ? new Date(rangeStart + 'T00:00:00') : new Date()
    return base.getMonth()
  })

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function inRange(dateStr) {
    if (!rangeStart && !rangeEnd) return true
    if (rangeStart && dateStr < rangeStart) return false
    if (rangeEnd   && dateStr > rangeEnd)   return false
    return true
  }

  // Build grid: leading empties + days
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const canPrev = !rangeStart || new Date(year, month, 1) > new Date(rangeStart + 'T00:00:00')
  const canNext = !rangeEnd   || new Date(year, month + 1, 0) < new Date(rangeEnd + 'T00:00:00')

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button className="calendar-nav" onClick={prevMonth} disabled={!canPrev}><ChevronLeft /></button>
        <span className="calendar-month">{year}년 {month + 1}월</span>
        <button className="calendar-nav" onClick={nextMonth} disabled={!canNext}><ChevronRight /></button>
      </div>

      <div className="calendar-grid">
        {DOW.map(d => <div key={d} className="calendar-dow">{d}</div>)}

        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />

          const col    = idx % 7
          const dateStr = toDateString(new Date(year, month, day))
          const ok      = inRange(dateStr)
          const sel     = selectedDates.includes(dateStr)
          const isToday = dateStr === todayStr
          const color   = dateColors?.[dateStr]

          let cls = 'calendar-day'
          if (!ok)    cls += ' out-of-range'
          if (sel)    cls += ' selected'
          if (isToday && !sel) cls += ' today'
          if (!sel && ok) {
            if (col === 0) cls += ' sunday'
            if (col === 6) cls += ' saturday'
          }
          if (color && !sel) cls += ' has-color'

          const style = (color && !sel) ? { background: color, color: 'var(--primary)' } : {}

          return (
            <div key={dateStr} className="cal-day-wrap">
              <button
                className={cls}
                style={style}
                disabled={!ok}
                onClick={() => ok && onToggleDate?.(dateStr)}
              >
                {day}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
