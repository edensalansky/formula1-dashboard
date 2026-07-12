import { useState, useEffect, useRef } from 'react'
import Track3D from './Track3D.jsx'
import LoadingScreen from './LoadingScreen.jsx'
import FaceIDLogin from './FaceIDLogin.jsx'
import './App.css'

/* ------------------------------------------------------------------ *
 *  Formula 1 — Driver Daily Schedule (iPad)
 *  Rebuilt from Figma frame 1413:10695 (1194 x 834) + interactivity
 * ------------------------------------------------------------------ */

const A = '/assets'

/* icon per session type: [src, size] */
const ICONS = {
  meal: [`${A}/icon-meal.svg`, 18],
  simulator: [`${A}/icon-simulator.svg`, 20],
  medical: [`${A}/icon-medical.svg`, 18],
  training: [`${A}/icon-training.svg`, 20],
  icebath: [`${A}/icon-icebath.svg`, 16],
  debrief: [`${A}/icon-debrief.svg`, 18],
}

/* presets offered in the "add schedule item" picker, grouped by category */
const SCHEDULE_TYPES = [
  { value: 'simulator-training', label: 'Simulator Training', icon: 'simulator', category: 'Training', location: 'Simulator Room N.1' },
  { value: 'physical-training', label: 'Physical Training', icon: 'training', category: 'Training', location: 'Performance Gym' },
  { value: 'cognitive-training', label: 'Cognitive Training', icon: 'training', category: 'Training', location: 'Performance Gym' },
  { value: 'reaction-training', label: 'Reaction Training', icon: 'training', category: 'Training', location: 'Performance Gym' },
  { value: 'neck-strength', label: 'Neck Strength', icon: 'medical', category: 'Training', location: 'Medical Room' },
  { value: 'media-training', label: 'Media Training', icon: 'debrief', category: 'Training', location: 'Class 2' },
  { value: 'breakfast', label: 'Breakfast', icon: 'meal', category: 'Break & Recovery', location: 'Dining Area' },
  { value: 'lunch', label: 'Lunch', icon: 'meal', category: 'Break & Recovery', location: 'Dining Area' },
  { value: 'dinner', label: 'Dinner', icon: 'meal', category: 'Break & Recovery', location: 'Dining Area' },
  { value: 'medical-checkup', label: 'Medical Check-Up', icon: 'medical', category: 'Break & Recovery', location: 'Medical Room' },
  { value: 'ice-bath', label: 'Ice Bath', icon: 'icebath', category: 'Break & Recovery', location: 'Performance Gym' },
  { value: 'recovery', label: 'Recovery', icon: 'icebath', category: 'Break & Recovery', location: 'Recovery Room' },
  { value: 'performance-debrief', label: 'Performance Debrief', icon: 'debrief', category: 'Break & Recovery', location: 'Class 2' },
]

/* preset locations offered in the location picker */
const SCHEDULE_LOCATIONS = [
  'Dining Area',
  'Simulator Room N.1',
  'Performance Gym',
  'Medical Room',
  'Class 2',
  'Recovery Room',
]

/* iPhone-style scrolling wheel column (hour / minute pickers) */
function WheelPicker({ options, value, onChange, format }) {
  const ref = useRef(null)
  const ITEM_H = 32
  const timer = useRef(null)
  const didInit = useRef(false)

  useEffect(() => {
    if (didInit.current || !ref.current) return
    didInit.current = true
    const idx = Math.max(0, options.indexOf(value))
    ref.current.scrollTop = idx * ITEM_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleScroll = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (!ref.current) return
      const idx = Math.max(0, Math.min(options.length - 1, Math.round(ref.current.scrollTop / ITEM_H)))
      ref.current.scrollTop = idx * ITEM_H
      if (options[idx] !== value) onChange(options[idx])
    }, 90)
  }

  return (
    <div className="wheel-col">
      <div className="wheel-highlight" />
      <div className="wheel" ref={ref} onScroll={handleScroll}>
        <div className="wheel-pad" />
        {options.map((o) => (
          <div key={o} className={'wheel-item' + (o === value ? ' wheel-item--sel' : '')}>
            {format ? format(o) : o}
          </div>
        ))}
        <div className="wheel-pad" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function ProgressDots({ score }) {
  const total = 60
  const filled = Math.round((score / 100) * total)
  return (
    <div className="dots">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={'dot' + (i < filled ? ' dot--on' : '')} />
      ))}
    </div>
  )
}

/* shared nav pill — switches between the dashboard and training screens */
function Nav({ active, onNav }) {
  const tabs = [
    ['dashboard', 'dashbord', `${A}/nav-dashbord.svg`],
    ['training', 'training', `${A}/nav-training.svg`],
  ]
  return (
    <div className="nav">
      {tabs.map(([screen, label, src]) => (
        <button
          key={screen}
          className={'nav__tab' + (active === screen ? ' nav__tab--active' : '')}
          onClick={() => onNav(screen)}
        >
          <img src={src} alt="" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

/* ================= SIMULATOR TRAINING (live) ================= */
const SESSION_SEC = 60 * 60 // 60 minute session
const RULER_MAX = 90 // timeline ruler runs 0..90 min
const HR_COLS = 90
const HR_ROWS = 11

// system-generated events (green) — driver physical/mental, with durations (min).
// some carry a coaching "goal" suggestion — those get a mark on the review timeline.
const SYS_EVENTS = [
  { start: 2, dur: 3, label: 'Warm-up', info: 'Activation & mobility · baseline HR 72 bpm' },
  { start: 6, dur: 4, label: 'Heart-rate ramp-up', info: 'Aerobic ramp · HR 110 → 155 bpm' },
  {
    start: 12,
    dur: 2,
    label: 'High cognitive load',
    info: 'Decision speed under stress · load 84%',
    goal: {
      title: 'Improve decision speed under stress',
      tagType: 'simulator',
      tagLabel: 'Simulator training',
      desc: 'High cognitive load detected during the braking phase.',
    },
  },
  {
    start: 16,
    dur: 5,
    label: 'Braking-zone focus',
    info: 'Visual focus across 6 heavy braking zones',
    goal: {
      title: 'Improve braking consistency',
      tagType: 'simulator',
      tagLabel: 'Simulator training',
      desc: 'Inconsistent braking points detected.',
    },
  },
  {
    start: 24,
    dur: 3,
    label: 'G-force neck load',
    info: 'Sustained lateral load · peak 4.2 G',
    goal: {
      title: 'Increase neck strength under sustained-G',
      tagType: 'training',
      tagLabel: 'Physical training',
      desc: 'Neck load peaked at 4.2G for an extended period.',
    },
  },
  { start: 30, dur: 4, label: 'Concentration peak', info: 'Sustained attention · 96% accuracy' },
  {
    start: 38,
    dur: 2,
    label: 'Reaction drill',
    info: 'Light-panel drill · avg reaction 210 ms',
    goal: {
      title: 'Sharpen reaction time',
      tagType: 'simulator',
      tagLabel: 'Simulator training',
      desc: 'Reaction time above target on the light-panel drill.',
    },
  },
  {
    start: 44,
    dur: 5,
    label: 'Sustained focus',
    info: 'Long-run focus · HR held at 162 bpm',
    goal: {
      title: 'Build sustained-attention endurance',
      tagType: 'training',
      tagLabel: 'Cognitive training',
      desc: 'Focus began drifting during the long run.',
    },
  },
  { start: 52, dur: 3, label: 'Recovery window', info: 'Active recovery · HR 155 → 120 bpm' },
  { start: 57, dur: 2, label: 'Cool-down', info: 'Parasympathetic recovery · HR 95 bpm' },
]

const HR_HIGH = 7 // column height at/above this = a heart-rate spike — flag it red

// a fresh, random-but-realistic ECG-ish trace — irregular beats, varying baseline,
// so every session looks different instead of the exact same fixed pattern
function genHRHeights() {
  const heights = []
  let nextBeat = 2 + Math.floor(Math.random() * 5)
  for (let c = 0; c < HR_COLS; c++) {
    let h
    if (c >= nextBeat) {
      h = 7 + Math.floor(Math.random() * 3) // spike: 7-9, lower/less dramatic (clears HR_HIGH)
      nextBeat = c + 7 + Math.floor(Math.random() * 9) // next beat 7-15 cols later
    } else {
      h = 3 + Math.floor(Math.random() * 4) // resting baseline: 3-6, averages ~5 with spikes
    }
    heights.push(Math.max(1, Math.min(HR_ROWS, h)))
  }
  return heights
}
const SIM_SPEED = 20 // fake acceleration: 1 real second = 20 sim seconds (60-min session ≈ 3 real min)

function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec))
  const p = (n) => String(n).padStart(2, '0')
  return `${p(Math.floor(sec / 3600))}:${p(Math.floor((sec % 3600) / 60))}:${p(sec % 60)}`
}
// same HH:MM:SS format, but from a minutes value (used by the review timeline ruler)
function fmtHMS(min) {
  return fmtClock(Math.round(min * 60))
}

function TrainingScreen({ onNav }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0) // seconds
  const [notes, setNotes] = useState([]) // {start, end, text}
  const [draft, setDraft] = useState(null) // {start}
  const [draftText, setDraftText] = useState('')
  const [zoom, setZoom] = useState(1) // timeline pinch-zoom (1 = fit)
  const [detail, setDetail] = useState(null) // clicked notification: {type,label,min,dur,info}
  const [scrollX, setScrollX] = useState(0) // timeline horizontal scroll offset
  const [finished, setFinished] = useState(false) // show the session review
  const [selNotif, setSelNotif] = useState(null) // review: selected timeline notification
  const [addedGoals, setAddedGoals] = useState({}) // review: goal ids marked "Added"
  const canvasRef = useRef(null)
  const viewportRef = useRef(null)
  const reviewViewportRef = useRef(null)
  const startRef = useRef(0)
  const rafRef = useRef(0)
  const startedRef = useRef(false) // has the driver ever pressed START this session?
  const hrHeightsRef = useRef(genHRHeights()) // random trace, regenerated each new session
  const elapsedRef = useRef(0)
  const dispRef = useRef(0)
  const zoomRef = useRef(1)
  zoomRef.current = zoom

  const curMin = Math.min(elapsed / 60, RULER_MAX)
  const minToPct = (m) => (m / RULER_MAX) * 100
  const zoomed = zoom > 1.05

  // review timeline: the FULL scripted session (not just what played out before an
  // early FINISH) so the coach can see how the whole session would have gone.
  const allEvents = [
    ...SYS_EVENTS.map((e, i) => ({
      id: 'sys' + i,
      type: 'sys',
      label: e.label,
      min: e.start,
      dur: e.dur,
      info: e.info,
      goal: e.goal,
    })),
    ...notes.map((n, i) => ({
      id: 'note' + i,
      type: 'user',
      label: n.text,
      min: n.start,
      dur: +(n.end - n.start).toFixed(1),
      info: 'Driver note',
    })),
  ].sort((a, b) => a.min - b.min)
  const goalEvents = allEvents.filter((e) => e.goal)
  const REVIEW_ZOOM = 13 // default review zoom — pills read as named tags, not bars

  const drawHR = (el) => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    const W = cv.width, H = cv.height
    const cw = W / HR_COLS, chh = H / HR_ROWS
    const r = Math.min(cw, chh) * 0.32
    ctx.clearRect(0, 0, W, H)
    // dots sit dark/off until the driver presses START. Once pressed, they reveal
    // one by one, column by column (bottom-up), tracking the timer — the leading
    // dot keeps pace with the red playhead — and stay lit once shown (sticky on pause).
    const heights = hrHeightsRef.current
    const started = startedRef.current
    const curMin = Math.min(el / 60, RULER_MAX)
    const fullCols = Math.floor(curMin)
    let reveal = 0
    for (let c = 0; c < fullCols && c < HR_COLS; c++) reveal += heights[c]
    if (fullCols < HR_COLS) reveal += Math.floor((curMin - fullCols) * heights[fullCols])
    let left = started ? reveal : 0
    for (let c = 0; c < HR_COLS; c++) {
      const litThisCol = Math.max(0, Math.min(left, heights[c]))
      const isHigh = heights[c] >= HR_HIGH // heart-rate spike — flag so the coach knows to stop
      for (let row = 0; row < HR_ROWS; row++) {
        ctx.beginPath()
        ctx.arc(c * cw + cw / 2, (HR_ROWS - 1 - row) * chh + chh / 2, r, 0, Math.PI * 2)
        ctx.fillStyle = row >= litThisCol ? '#2e2e2e' : isHigh ? '#ff3b30' : '#e6e6e6'
        ctx.fill()
      }
      left -= litThisCol
    }
  }

  useEffect(() => {
    drawHR(elapsedRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!running) return
    startRef.current = performance.now() - (elapsedRef.current / SIM_SPEED) * 1000
    const loop = (now) => {
      let el = ((now - startRef.current) / 1000) * SIM_SPEED
      if (el >= SESSION_SEC) el = SESSION_SEC
      elapsedRef.current = el
      drawHR(el)
      if (now - dispRef.current > 120) {
        setElapsed(el)
        dispRef.current = now
      }
      if (el >= SESSION_SEC) {
        setElapsed(SESSION_SEC)
        setRunning(false)
        return
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  // pinch-to-zoom (iPad Safari gesture events) + ctrl-wheel (trackpad pinch)
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const cl = (v) => Math.max(1, Math.min(20, v))
    let base = 1
    const gs = (e) => { e.preventDefault(); base = zoomRef.current }
    const gc = (e) => { e.preventDefault(); setZoom(cl(base * e.scale)) }
    const wl = (e) => { if (e.ctrlKey) { e.preventDefault(); setZoom((z) => cl(z * (1 - e.deltaY * 0.01))) } }
    vp.addEventListener('gesturestart', gs, { passive: false })
    vp.addEventListener('gesturechange', gc, { passive: false })
    vp.addEventListener('wheel', wl, { passive: false })
    return () => {
      vp.removeEventListener('gesturestart', gs)
      vp.removeEventListener('gesturechange', gc)
      vp.removeEventListener('wheel', wl)
    }
  }, [])

  // keep the red playhead in view while running & zoomed
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp || zoom <= 1) return
    const contentW = vp.clientWidth * zoom
    const playX = (curMin / RULER_MAX) * contentW
    const margin = 90
    if (playX > vp.scrollLeft + vp.clientWidth - margin) vp.scrollLeft = playX - vp.clientWidth + margin
    else if (playX < vp.scrollLeft + margin) vp.scrollLeft = Math.max(0, playX - margin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, zoom])

  // draw the full HR trace, and open the review already zoomed in on the
  // first suggested goal, once the review opens
  useEffect(() => {
    if (finished) {
      drawHR(RULER_MAX * 60) // review always shows the full trace, regardless of when FINISH was pressed
      setZoom(REVIEW_ZOOM)
      const first = goalEvents[0] || allEvents[0] || null
      setSelNotif(first)
      if (first) requestAnimationFrame(() => scrollToMin(first.min))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  const scrollToMin = (min) => {
    const vp = reviewViewportRef.current
    if (!vp) return
    const contentW = vp.clientWidth * REVIEW_ZOOM
    const x = (min / RULER_MAX) * contentW
    vp.scrollLeft = Math.max(0, x - vp.clientWidth / 2)
  }
  const selectNotif = (e) => {
    setSelNotif(e)
    requestAnimationFrame(() => scrollToMin(e.min))
  }
  const jumpGoal = (dir) => {
    if (!goalEvents.length) return
    const idx = selNotif ? goalEvents.findIndex((e) => e.id === selNotif.id) : -1
    const next = goalEvents[(idx === -1 ? 0 : idx + dir + goalEvents.length) % goalEvents.length]
    selectNotif(next)
  }
  const toggleAdded = (id) => setAddedGoals((a) => ({ ...a, [id]: !a[id] }))

  const onTrackClick = () => {
    if (detail) {
      setDetail(null)
      return
    }
    // note STARTS when the user clicks (records the current time)
    setDraft({ start: Math.min(elapsedRef.current / 60, RULER_MAX) })
    setDraftText('')
  }
  const VIEW_W = 1036 // MIN track viewport width (px, pre-scale)
  const addNote = () => {
    // note ENDS when the user sends — its length = typing duration
    if (draft && draftText.trim()) {
      const end = Math.min(elapsedRef.current / 60, RULER_MAX)
      setNotes([...notes, { start: draft.start, end: Math.max(draft.start, end), text: draftText.trim() }])
    }
    setDraft(null)
    setDraftText('')
  }

  // NEW SESSION (from the review) — back to a clean idle Simulator Mode
  const restart = () => {
    cancelAnimationFrame(rafRef.current)
    elapsedRef.current = 0
    dispRef.current = 0
    startedRef.current = false // back to black dots until START is pressed again
    hrHeightsRef.current = genHRHeights() // a fresh random trace for the next session
    setElapsed(0)
    setNotes([])
    setDraft(null)
    setDraftText('')
    setZoom(1)
    setDetail(null)
    setScrollX(0)
    setSelNotif(null)
    setAddedGoals({})
    setRunning(false)
    setFinished(false)
    drawHR(0)
  }

  // ===================== TRAINING REVIEW (after FINISH) =====================
  if (finished) {
    const finalMin = Math.min(elapsedRef.current / 60, RULER_MAX)
    const cols = Math.max(1, Math.round(finalMin))
    const heights = hrHeightsRef.current
    const meanH = heights.slice(0, cols).reduce((a, b) => a + b, 0) / cols
    const avgHR = Math.round(118 + meanH * 16)

    return (
      <>
        <img className="logo" src={`${A}/c1logo.svg`} alt="C1" />
        <div className="brand">TRAINING REVIEW</div>
        <Nav active="training" onNav={onNav} />
        <div className="sh-avatar">SH</div>

        <h1 className="sim-title">Training Review</h1>

        <div className="sum-panel">
          <button className="sim-btn sum-restart" onClick={restart}>NEXT TRAINING</button>

          <div className="sum-stats">
            <div className="sum-tile"><b>{fmtClock(elapsed).slice(3)}</b><span>Duration</span></div>
            <div className="sum-tile"><b>{SYS_EVENTS.length}</b><span>System alerts</span></div>
            <div className="sum-tile"><b>{notes.length}</b><span>Driver notes</span></div>
            <div className="sum-tile"><b>{avgHR}<i>bpm</i></b><span>Avg heart-rate</span></div>
          </div>

          <div className="sum-hr-label">HR</div>
          <canvas ref={canvasRef} className="sum-hr" width={HR_COLS * 24} height={HR_ROWS * 20} />

          <div className="sumtl-panel">
            <div className="sumtl-viewport" ref={reviewViewportRef}>
              <div className="sumtl-track" style={{ width: zoom * 100 + '%' }}>
                {/* the review always opens "zoomed in" (Figma 1699:1272) — fine
                    HH:MM:SS ruler every 30s so notification names read clearly */}
                {zoom > 2 && <div className="sec-grid" />}
                {Array.from({ length: Math.floor(RULER_MAX / 0.5) + 1 }).map((_, i) => {
                  const m = i * 0.5
                  return (
                    <div
                      key={'gl' + i}
                      className={'gridline' + (m % 10 === 0 ? ' gridline--major' : m % 5 === 0 ? ' gridline--mid' : '')}
                      style={{ left: minToPct(m) + '%' }}
                    />
                  )
                })}
                {Array.from({ length: Math.floor(RULER_MAX / 0.5) + 1 }).map((_, i) => {
                  const m = i * 0.5
                  return (
                    <span key={'tk' + i} className="tick tick--top" style={{ left: minToPct(m) + '%' }}>
                      {fmtHMS(m)}
                    </span>
                  )
                })}
                <div className="axis" />
                {allEvents.map((e) => (
                  <div
                    key={e.id}
                    className={
                      'notif notif--' + e.type +
                      (e.goal ? ' notif--hasgoal' : '') +
                      (selNotif?.id === e.id ? ' notif--sel' : '')
                    }
                    style={{ left: minToPct(e.min) + '%' }}
                    onClick={() => selectNotif(e)}
                  >
                    {e.label}
                  </div>
                ))}
                {selNotif && <div className="playhead" style={{ left: minToPct(selNotif.min) + '%' }} />}
              </div>
            </div>
          </div>

          <div className="sumbot">
            <div className="sumbot-detail">
              {selNotif ? (
                <>
                  <span className={'sumbot-detail__badge sumbot-detail__badge--' + selNotif.type}>
                    {selNotif.type === 'user' ? 'DRIVER NOTE' : 'SYSTEM'}
                  </span>
                  <div className="sumbot-detail__title">{selNotif.label}</div>
                  <div className="sumbot-detail__meta">
                    {fmtHMS(selNotif.min)}
                    {selNotif.dur ? ` · ${selNotif.dur} min` : ''}
                  </div>
                  <div className="sumbot-detail__info">{selNotif.info}</div>
                </>
              ) : (
                <div className="sumbot-detail__empty">Select a notification on the timeline.</div>
              )}
            </div>

            <div className="sumbot-goals">
              <div className="sumbot-goals__head">
                <span>Suggested Goals</span>
                {goalEvents.length > 0 && (
                  <div className="sumbot-jump">
                    <button onClick={() => jumpGoal(-1)} aria-label="Previous goal">‹</button>
                    <span>
                      {selNotif?.goal ? goalEvents.findIndex((e) => e.id === selNotif.id) + 1 : '–'}/{goalEvents.length}
                    </span>
                    <button onClick={() => jumpGoal(1)} aria-label="Next goal">›</button>
                  </div>
                )}
              </div>
              {selNotif?.goal ? (
                <div className="goal-card">
                  <div className="goal-card__title">{selNotif.goal.title}</div>
                  <div className="goal-card__tag">
                    <img src={ICONS[selNotif.goal.tagType][0]} alt="" />
                    {selNotif.goal.tagLabel}
                  </div>
                  <div className="goal-card__bottom">
                    <span className="goal-card__desc">{selNotif.goal.desc}</span>
                    <button
                      className={'goal-card__add' + (addedGoals[selNotif.id] ? ' goal-card__add--added' : '')}
                      onClick={() => toggleAdded(selNotif.id)}
                    >
                      {addedGoals[selNotif.id] ? 'Added ✓' : 'Add'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="sumbot-goals__empty">No suggested goal for this moment.</div>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <img className="logo" src={`${A}/c1logo.svg`} alt="C1" />
      <div className="brand">LIVE TRAINING</div>
      <Nav active="training" onNav={onNav} />
      <div className="sh-avatar">SH</div>

      <h1 className="sim-title">Simulator Mode</h1>

      <div className="sim-panel">
        <div className="sim-timer">{fmtClock(elapsed)}</div>
        <div className="sim-hr-label">HR</div>
        <canvas ref={canvasRef} className="sim-hr" width={HR_COLS * 24} height={HR_ROWS * 20} />

        <div className="sim-min">
          <div className="sim-min-label">MIN</div>
          <div className="sim-viewport" ref={viewportRef} onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}>
            <div className="sim-track" style={{ width: zoom * 100 + '%' }} onClick={onTrackClick}>
              {/* fine per-second grid lines (emerge as you zoom in) — the number
                  labels stay the same sparse 10/5-min ruler at every zoom level */}
              {zoom > 2 && <div className="sec-grid" />}
              {Array.from({ length: RULER_MAX + 1 }).map((_, m) => (
                <div
                  key={'m' + m}
                  className={'gridline' + (m % 10 === 0 ? ' gridline--major' : m % 5 === 0 ? ' gridline--mid' : '')}
                  style={{ left: minToPct(m) + '%' }}
                />
              ))}
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={'t' + i}
                  className="tick tick--top"
                  style={{
                    left: minToPct(i * 10) + '%',
                    transform: i === 0 ? 'translateX(0)' : i === 9 ? 'translateX(-100%)' : 'translateX(-50%)',
                  }}
                >
                  {String(i * 10).padStart(2, '0')}
                </span>
              ))}
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={'b' + i} className="tick tick--bot" style={{ left: minToPct(i * 10 + 5) + '%' }}>
                  {String(i * 10 + 5).padStart(2, '0')}
                </span>
              ))}
              <div className="axis" />

              {/* system notifications — appear only once the playhead reaches them */}
              {SYS_EVENTS.map((ev, i) => {
                if (curMin < ev.start) return null
                if (zoomed) {
                  return (
                    <div
                      key={'g' + i}
                      className="notif notif--sys"
                      style={{ left: minToPct(ev.start) + '%' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetail({ type: 'sys', label: ev.label, min: ev.start, dur: ev.dur, info: ev.info })
                      }}
                    >
                      {ev.label}
                    </div>
                  )
                }
                const end = Math.min(curMin, ev.start + ev.dur)
                return (
                  <div
                    key={'g' + i}
                    className="sys-bar"
                    title={ev.label}
                    style={{ left: minToPct(ev.start) + '%', width: minToPct(end - ev.start) + '%' }}
                  />
                )
              })}

              {/* user notes — a purple bar the length of the typing (start → send).
                  In zoom it takes the system pill look but keeps the SH acronym. */}
              {notes.map((n, i) =>
                zoomed ? (
                  <div
                    key={'n' + i}
                    className="notif notif--user"
                    style={{ left: minToPct(n.start) + '%', minWidth: minToPct(n.end - n.start) + '%' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setDetail({
                        type: 'user',
                        label: n.text,
                        min: n.start,
                        dur: +(n.end - n.start).toFixed(1),
                        info: 'Driver note',
                      })
                    }}
                  >
                    {n.text}
                  </div>
                ) : (
                  <div
                    key={'n' + i}
                    className="user-bar"
                    style={{ left: minToPct(n.start) + '%', width: minToPct(Math.max(0.4, n.end - n.start)) + '%' }}
                    title={n.text}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="user-bar__sh">SH</span>
                  </div>
                )
              )}

              {/* live draft bar — grows from click-time to now while typing */}
              {draft && (
                <div
                  className="user-bar user-bar--draft"
                  style={{ left: minToPct(draft.start) + '%', width: minToPct(Math.max(0, curMin - draft.start)) + '%' }}
                >
                  <span className="user-bar__sh">SH</span>
                </div>
              )}

              {/* future veil — everything right of the red line is "not yet" */}
              {elapsed > 0 && curMin < RULER_MAX && (
                <div className="future-veil" style={{ left: minToPct(curMin) + '%' }} />
              )}

              {elapsed > 0 && <div className="playhead" style={{ left: minToPct(curMin) + '%' }} />}
            </div>
          </div>

          {/* note input — rendered outside the clipped viewport so it's always on top */}
          {draft &&
            (() => {
              const startPx = (draft.start / RULER_MAX) * VIEW_W * zoom
              const left = Math.max(12, Math.min(1122 - 214, 64 + startPx - scrollX))
              return (
                <div className="note-draft" style={{ left }} onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={draftText}
                    placeholder="Add note…"
                    onChange={(e) => setDraftText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addNote()
                      if (e.key === 'Escape') setDraft(null)
                    }}
                    onBlur={addNote}
                  />
                </div>
              )
            })()}

          {detail &&
            (() => {
              const notifPx = (detail.min / RULER_MAX) * VIEW_W * zoom
              const cardW = 244
              const left = Math.max(12, Math.min(1122 - cardW - 12, 64 + notifPx - scrollX - cardW / 2))
              return (
                <div className="notif-detail" style={{ left, width: cardW }} onClick={(e) => e.stopPropagation()}>
                  <div className="notif-detail__head">
                    <span className={'notif-detail__badge notif-detail__badge--' + detail.type}>
                      {detail.type === 'user' ? 'DRIVER NOTE' : 'SYSTEM'}
                    </span>
                    <button className="notif-detail__close" onClick={() => setDetail(null)}>
                      ×
                    </button>
                  </div>
                  <div className="notif-detail__title">{detail.label}</div>
                  <div className="notif-detail__meta">
                    {fmtClock(detail.min * 60).slice(3)}
                    {detail.dur ? ` · ${detail.dur} min` : ''}
                  </div>
                  <div className="notif-detail__info">{detail.info}</div>
                </div>
              )
            })()}
        </div>

        {/* FINISH — appears once the session has been started; opens the Training Review */}
        {(running || elapsed > 0) && (
          <button
            className="sim-btn sim-finish"
            onClick={() => {
              setRunning(false)
              setFinished(true)
            }}
          >
            FINISH
          </button>
        )}
        <button
          className="sim-btn sim-start"
          onClick={() => {
            if (!running && elapsedRef.current >= SESSION_SEC) {
              elapsedRef.current = 0
              dispRef.current = 0
              hrHeightsRef.current = genHRHeights() // a fresh random trace for the next session
              setElapsed(0)
              setNotes([])
            }
            if (!running) {
              startedRef.current = true // dots go from black to lit the moment START is pressed
              drawHR(elapsedRef.current)
            }
            setRunning((r) => !r)
          }}
        >
          {running ? 'STOP' : elapsed > 0 && elapsed < SESSION_SEC ? 'PLAY' : 'START'}
        </button>
      </div>
    </>
  )
}

/* ================= DASHBOARD ================= */
// Mental-focus corners (Spa) — danger + the training goal to prepare the driver
const FOCUS_POINTS = [
  {
    name: 'Eau Rouge / Raidillon',
    danger: 'Blind uphill left-right-left taken near flat-out — huge vertical + lateral compression at ~290 km/h.',
    goal: 'Neck & core strength for sustained 4–5 G loading, and visual commitment training to stay flat over the blind crest.',
  },
  {
    name: 'Les Combes',
    danger: 'Heavy braking from top speed into a tight right-left after the Kemmel straight — a classic lock-up / overtaking spot.',
    goal: 'Braking-point consistency and reaction accuracy while heart-rate is still elevated from the straight.',
  },
  {
    name: 'Pouhon',
    danger: 'Fast downhill double-left held at high speed — long, sustained lateral load that fatigues the neck.',
    goal: 'Neck endurance and controlled breathing under prolonged lateral G to hold a precise line.',
  },
  {
    name: 'Rivage / Bruxelles',
    danger: 'Tight downhill hairpin with a blind entry — easy to run wide or lock the inside front.',
    goal: 'Trail-braking precision and patience on entry; smooth throttle pick-up to protect the front tyres.',
  },
  {
    name: 'Blanchimont',
    danger: 'Near-flat high-speed left with little run-off — one of the highest-risk corners on the calendar.',
    goal: 'Mental commitment and focus stability at high speed; steady heart-rate to avoid any hesitation.',
  },
  {
    name: 'Bus Stop Chicane',
    danger: 'Hard braking into a tight left-right over the kerbs to end the lap — high cognitive load and lock-up risk.',
    goal: 'Quick, precise direction change and cognitive-load management to nail the final braking zone every lap.',
  },
]

function DashboardScreen({ onNav }) {
  const [sel, setSel] = useState(null) // selected focus point (1..6)
  const [remain, setRemain] = useState(11 * 86400 + 2 * 3600 + 32 * 60 + 24) // Belgium GP countdown (sec)
  useEffect(() => {
    const id = setInterval(() => setRemain((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(id)
  }, [])
  const p2 = (n) => String(n).padStart(2, '0')
  const d = Math.floor(remain / 86400)
  const h = Math.floor((remain % 86400) / 3600)
  const m = Math.floor((remain % 3600) / 60)
  const s = remain % 60

  return (
    <>
      {/* 3D track model — centered in the frame, behind the UI */}
      <Track3D mode="focus" selected={sel} onSelectPoint={setSel} />

      <img className="logo" src={`${A}/c1logo.svg`} alt="C1" />
      <Nav active="dashboard" onNav={onNav} />
      <div className="sh-avatar">SH</div>

      <h1 className="dash-hi">Good morning Steve!</h1>
      <div className="dash-sub">Here's your dashboard for today</div>

      {/* driver status + next race — slide fully off-frame to the left when a
          track point is selected, so only the track and its close-up data show */}
      <div className={'dash-left-col' + (sel != null ? ' dash-left-col--hidden' : '')}>
        <div className="drv-section-title">Driver Status</div>

        {/* driver ID card (Figma 1844:280) */}
        <div className="drv2-card">
          <div className="drv2-name">Charles Leclerc</div>
          <img className="drv2-flag" src={`${A}/drv-flag.png`} alt="Monaco" />
          <div className="drv2-team">Monaco | Ferrari |</div>
          <div className="drv2-num">16</div>
          <div className="drv2-stats">
            <p>Age 27</p>
            <p>Weight 68kg</p>
            <p>Height 1.80m</p>
          </div>

          <div className="drv2-gauge">
            <img className="drv2-vec drv2-vec21" src={`${A}/drv-vec21.svg`} alt="" />
            <img className="drv2-vec drv2-vec22" src={`${A}/drv-vec22.svg`} alt="" />
            <img className="drv2-vec drv2-vec23" src={`${A}/drv-vec23.svg`} alt="" />
            <img className="drv2-vec drv2-vec24" src={`${A}/drv-vec24.svg`} alt="" />
            <div className="drv2-ring">
              <img className="drv2-ring-outer" src={`${A}/drv-ellipse-outer.svg`} alt="" />
              <img className="drv2-ring-iso" src={`${A}/drv-isolation.svg`} alt="" />
              <img className="drv2-ring-inner" src={`${A}/drv-ellipse-inner.svg`} alt="" />
              <div className="drv2-stable">Stable</div>
              <div className="drv2-pct">83 %</div>
            </div>
            <div className="drv2-lbl drv2-lbl-bpm">BPM</div>
            <div className="drv2-lbl drv2-lbl-hyd">Hydration</div>
            <div className="drv2-lbl drv2-lbl-focus">focus</div>
            <div className="drv2-lbl drv2-lbl-stress">stress</div>
          </div>
        </div>

        <div className="next-race-title">Next race</div>

        {/* next race card (Figma 1848:1276) */}
        <div className="race-card">
          <div className="race-track">SPA - FRANCORCHAMPS</div>
          <div className="race-date">belgium 17-19 Jul</div>
          <div className="race-countdown">{d}d : {p2(h)}h : {p2(m)}m : {p2(s)}s</div>
          <div className="race-lap">
            <div className="race-stat-lbl">Lap Length</div>
            <div className="race-stat-val">7.994 Km</div>
          </div>
          <div className="race-dist">
            <div className="race-stat-lbl">Race Distance</div>
            <div className="race-stat-val">308.052 Km</div>
          </div>
        </div>
      </div>

      {/* focus-point data card — sits off-frame to the left, slides in on selection */}
      <div className={'focus-panel' + (sel != null ? ' focus-panel--open' : '')}>
        {sel != null && (
          <>
            <div className="focus-panel__head">
              <span className="focus-panel__num">{sel}</span>
              <div className="focus-panel__name">{FOCUS_POINTS[sel - 1].name}</div>
              <button className="focus-panel__close" onClick={() => setSel(null)}>×</button>
            </div>
            <div className="focus-panel__lbl">Why it's dangerous</div>
            <div className="focus-panel__txt">{FOCUS_POINTS[sel - 1].danger}</div>
            <div className="focus-panel__lbl focus-panel__lbl--goal">Training goal</div>
            <div className="focus-panel__txt">{FOCUS_POINTS[sel - 1].goal}</div>
          </>
        )}
      </div>
    </>
  )
}

/* ================= SLIDE-IN SCHEDULE OVERLAY ================= */
const DEFAULT_SESSIONS = [
  { start: '08:00', title: 'Breakfast', type: 'meal', location: 'Dining Area', height: 109 },
  {
    start: '09:00',
    title: 'Simulator  Training',
    type: 'simulator',
    location: 'Simulator room N.1',
    light: true,
    height: 166,
    goal: { title: 'Focus under pressure', sub: 'Errors increase under cognitive load', score: 73 },
  },
  {
    start: '10:30',
    title: 'Physical Training      ',
    type: 'training',
    location: 'Performance Gym',
    height: 166,
    goal: { title: 'Increase neck stability', sub: 'Reduced G-force stability', score: 23 },
  },
  { start: '12:00', title: 'Lunch', type: 'meal', location: 'Dining Area', height: 109 },
  { start: '13:00', title: 'Medical Check-Up', type: 'medical', location: 'Medical Room', height: 109 },
  {
    start: '14:00',
    title: 'Cognitive training ',
    type: 'training',
    location: 'Performance Gym',
    height: 166,
    goal: { title: 'Focus under pressure', sub: 'Errors increase cognitive load.', score: 96 },
  },
  { start: '15:30', title: 'Neck Strength ', type: 'medical', location: 'Medical Room', height: 109 },
  { start: '16:30', title: 'Ice Bath', type: 'icebath', location: 'Performance Gym', height: 109 },
  { start: '17:30', title: 'Performance Debrief', type: 'debrief', location: 'Class 2', height: 109 },
  { start: '18:30', title: 'Dinner', type: 'meal', location: 'Dining Area' },
]

function ScheduleOverlay({ onClose }) {
  const OV_HH = 114
  const OV_PAD = 14
  const toH = (t) => t.split(':').map(Number).reduce((h, m) => h + m / 60)
  const top = (t) => OV_PAD + (t - 8) * OV_HH

  // sorts by start time and pushes any later item down so cards never overlap
  // (keeps a 5px gap) — this is what makes "add a new item" ripple through the rest
  const normalize = (list) => {
    const sorted = [...list].sort((a, b) => toH(a.start) - toH(b.start))
    let prevBottom = null
    return sorted.map((s) => {
      const height = s.height ?? (s.goal ? 179 : 113)
      let startH = toH(s.start)
      let topPx = top(startH)
      if (prevBottom != null && topPx < prevBottom + 5) {
        topPx = prevBottom + 5
        startH = 8 + (topPx - OV_PAD) / OV_HH
      }
      prevBottom = topPx + height
      const hh = Math.floor(startH)
      const mm = +((startH - hh) * 60).toFixed(2)
      return { ...s, start: `${hh}:${mm}`, height }
    })
  }

  const [sessions, setSessions] = useState(() => normalize(DEFAULT_SESSIONS))
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    typeValue: SCHEDULE_TYPES[0].value,
    location: SCHEDULE_TYPES[0].location,
    hour: 8,
    minute: 0,
  })

  const starts = sessions.map((s) => toH(s.start))
  const maxBottom = sessions.length
    ? Math.max(...sessions.map((s, i) => top(starts[i]) + s.height))
    : top(20)
  const maxHour = Math.max(20, Math.ceil((maxBottom - OV_PAD) / OV_HH + 8)) // "add more hours" if the schedule runs past 20:00
  const hours = Array.from({ length: maxHour - 8 + 1 }, (_, i) => 8 + i)
  const wheelHours = Array.from({ length: 17 }, (_, i) => 6 + i) // 06:00 – 22:00

  const submitAdd = (e) => {
    e.preventDefault()
    const opt = SCHEDULE_TYPES.find((t) => t.value === form.typeValue)
    if (!opt) return
    const start = `${form.hour}:${String(form.minute).padStart(2, '0')}`
    setSessions((prev) =>
      normalize([...prev, { start, title: opt.label, type: opt.icon, location: form.location }])
    )
    setAdding(false)
  }

  return (
    <div className="ov-inner-wrap">
      <div className="ov-head">
        <button className="ov-close" onClick={onClose}>×</button>
        <div className="ov-title">Daily Schedule</div>
        <div className="ov-goals">Goals&nbsp;&nbsp;0/3</div>
        <button className="ov-add" onClick={() => setAdding(true)}>+</button>
      </div>

      {adding && (
        <div className="ov-add-backdrop" onClick={() => setAdding(false)}>
          <form className="ov-add-form" onClick={(e) => e.stopPropagation()} onSubmit={submitAdd}>
            <div className="ov-add-title">New schedule item</div>

            <label className="ov-add-lbl">
              Type
              <select
                className="ov-add-input"
                value={form.typeValue}
                onChange={(e) => {
                  const v = e.target.value
                  const opt = SCHEDULE_TYPES.find((t) => t.value === v)
                  setForm((f) => ({ ...f, typeValue: v, location: opt ? opt.location : f.location }))
                }}
              >
                <optgroup label="Training">
                  {SCHEDULE_TYPES.filter((t) => t.category === 'Training').map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Break & Recovery">
                  {SCHEDULE_TYPES.filter((t) => t.category === 'Break & Recovery').map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
              </select>
            </label>

            <label className="ov-add-lbl">
              Location
              <select
                className="ov-add-input"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              >
                {SCHEDULE_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </label>

            <label className="ov-add-lbl">
              Time
              <div className="wheel-row">
                <WheelPicker
                  options={wheelHours}
                  value={form.hour}
                  onChange={(h) => setForm((f) => ({ ...f, hour: h }))}
                  format={(h) => String(h).padStart(2, '0')}
                />
                <div className="wheel-colon">:</div>
                <WheelPicker
                  options={[0, 30]}
                  value={form.minute}
                  onChange={(m) => setForm((f) => ({ ...f, minute: m }))}
                  format={(m) => String(m).padStart(2, '0')}
                />
              </div>
            </label>

            <div className="ov-add-actions">
              <button type="button" className="ov-add-cancel" onClick={() => setAdding(false)}>Cancel</button>
              <button type="submit" className="ov-add-submit">Add</button>
            </div>
          </form>
        </div>
      )}

      <div className="ov-scroll">
        <div className="ov-track" style={{ height: top(hours[hours.length - 1] + 1) }}>
          <div className="ov-rail" />
          {hours.map((h) => (
            <div key={h} className="ov-time" style={{ top: top(h) - 7 }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}

          {sessions.map((s, i) => {
            const [src, size] = ICONS[s.type]
            return (
              <div
                key={i}
                className={'ov-card' + (s.light ? ' ov-card--light' : '')}
                style={{ top: top(starts[i]), height: s.height }}
              >
                <div className="ov-card__row">
                  <img
                    className="ov-card__icon"
                    src={src}
                    alt=""
                    style={{ width: size, height: size }}
                  />
                  <span className="ov-card__title">{s.title}</span>
                </div>
                <div className="ov-card__sub">{s.location}</div>
                {s.goal && (
                  <div className={'ov-goal' + (s.light ? ' ov-goal--dark' : '')}>
                    <div className="ov-goal__title">{s.goal.title}</div>
                    <div className="ov-goal__sub">{s.goal.sub}</div>
                    <div className="ov-goal__score">
                      {s.goal.score} / 100 <span>Current score</span>
                    </div>
                    <ProgressDots score={s.goal.score} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const PANEL_W = 326
const clampV = (v, a, b) => Math.max(a, Math.min(b, v))

export default function App() {
  const [stage, setStage] = useState('intro') // 'intro' | 'login' | 'app'
  const [screen, setScreen] = useState(() => {
    const s = new URLSearchParams(window.location.search).get('screen')
    return s === 'training' ? s : 'dashboard'
  }) // 'training' | 'dashboard'

  // right-edge slide-in schedule overlay (works on every screen)
  const [ovOpen, setOvOpen] = useState(false)
  const [ovX, setOvX] = useState(null) // live drag translateX (screen px), null when idle
  const ovXRef = useRef(null)
  const ovOpenRef = useRef(false)
  const dragRef = useRef(null)
  ovOpenRef.current = ovOpen
  const setX = (v) => {
    ovXRef.current = v
    setOvX(v)
  }
  const scaleNow = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale')) || 1
  const onDragMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const dxv = e.clientX - d.startX
    const dyv = e.clientY - d.startY
    const dx = dxv / d.scale
    if (d.mode === 'open') {
      setX(clampV(PANEL_W + dx, 0, PANEL_W)) // drag left brings it in
    } else {
      if (!d.decided) {
        if (Math.abs(dxv) < 6 && Math.abs(dyv) < 6) return
        d.decided = true
        d.horiz = Math.abs(dxv) > Math.abs(dyv)
      }
      if (d.horiz) setX(clampV(dx, 0, PANEL_W)) // drag right pushes it out
    }
  }
  const onDragEnd = () => {
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragEnd)
    dragRef.current = null
    const cur = ovXRef.current
    if (cur != null) setOvOpen(cur < PANEL_W / 2)
    setX(null)
  }
  const beginOpen = (e) => {
    if (ovOpenRef.current) return
    dragRef.current = { mode: 'open', startX: e.clientX, startY: e.clientY, scale: scaleNow() }
    setX(PANEL_W)
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
  }
  const beginClose = (e) => {
    if (!ovOpenRef.current) return
    dragRef.current = { mode: 'close', startX: e.clientX, startY: e.clientY, scale: scaleNow(), decided: false, horiz: false }
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
  }

  // scale the fixed 1194x834 canvas to fit the iPad viewport
  useEffect(() => {
    const fit = () => {
      const s = Math.min(window.innerWidth / 1194, window.innerHeight / 834)
      document.documentElement.style.setProperty('--scale', s)
    }
    fit()
    window.addEventListener('resize', fit)
    window.addEventListener('orientationchange', fit)
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('orientationchange', fit)
    }
  }, [])

  return (
    <>
      {stage === 'intro' && <LoadingScreen onDone={() => setStage('login')} />}
      {stage === 'login' && <FaceIDLogin onDone={() => setStage('app')} />}
      <div className="stage">
      <div className="screen">
        {screen === 'training' ? (
          <TrainingScreen onNav={setScreen} />
        ) : (
          <DashboardScreen onNav={setScreen} />
        )}

        {/* right-edge slide-in schedule overlay (available on every screen) */}
        <div className="ov-edge" onPointerDown={beginOpen} />
        {(() => {
          const px = ovX != null ? ovX : ovOpen ? 0 : PANEL_W
          const frac = 1 - px / PANEL_W
          return (
            <>
              <div
                className="ov-backdrop"
                style={{
                  opacity: 0.5 * frac,
                  pointerEvents: frac > 0.02 ? 'auto' : 'none',
                  transition: ovX != null ? 'none' : 'opacity .3s ease',
                }}
                onClick={() => setOvOpen(false)}
              />
              <div
                className="ov-panel"
                style={{
                  transform: `translateX(${px}px)`,
                  transition: ovX != null ? 'none' : 'transform .3s cubic-bezier(.4, 0, .2, 1)',
                }}
                onPointerDown={beginClose}
              >
                <ScheduleOverlay onClose={() => setOvOpen(false)} />
              </div>
            </>
          )
        })()}
      </div>
      </div>
    </>
  )
}
