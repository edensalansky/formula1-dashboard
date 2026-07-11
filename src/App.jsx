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
const HOUR_H = 105 // px per hour on the timeline rail
const PAD_TOP = 24 // top padding inside the scroll area
const CARD_GAP = 10 // gap between a card and the next slot
const TODAY = 6 // "today" in this July 2026 mock
const VISIBLE_UNTIL = TODAY + 1 // today + tomorrow are selectable; later days are locked

/* icon per session type: [src, size] */
const ICONS = {
  meal: [`${A}/icon-meal.svg`, 18],
  simulator: [`${A}/icon-simulator.svg`, 20],
  medical: [`${A}/icon-medical.svg`, 18],
  training: [`${A}/icon-training.svg`, 20],
  icebath: [`${A}/icon-icebath.svg`, 16],
  debrief: [`${A}/icon-debrief.svg`, 18],
}

/* activities offered by the "Change" / "Add" picker */
const ACTIVITIES = [
  { title: 'Simulator Training', type: 'simulator', location: 'Simulator Room N.1' },
  { title: 'Physical Training', type: 'training', location: 'Performance Gym' },
  { title: 'Neck Strength', type: 'training', location: 'Performance Gym' },
  { title: 'Cognitive Training', type: 'training', location: 'Performance Gym' },
  { title: 'Medical Check-Up', type: 'medical', location: 'Medical Room' },
  { title: 'Ice Bath', type: 'icebath', location: 'Recovery Zone' },
  { title: 'Strategy Debrief', type: 'debrief', location: 'Engineering Room' },
  { title: 'Meal', type: 'meal', location: 'Dining Area' },
]

/* ---- F1 training-day templates ----------------------------------- */
const RACE_PREP = [
  { start: '07:00', title: 'Breakfast', type: 'meal', location: 'Dining Area' },
  { start: '08:00', title: 'Physical Warm-Up', type: 'training', location: 'Performance Gym' },
  { start: '09:00', title: 'Simulator Training', type: 'simulator', location: 'Simulator Room N.1', goal: { title: 'Focus under pressure', sub: 'Errors increase under cognitive load', score: 73 } },
  { start: '10:30', title: 'Medical Check-Up', type: 'medical', location: 'Medical Room' },
  { start: '11:30', title: 'Neck Strength', type: 'training', location: 'Performance Gym', goal: { title: 'Increase neck stability', sub: 'Reduced stability under sustained G-force load', score: 81 } },
  { start: '13:00', title: 'Lunch', type: 'meal', location: 'Dining Area' },
  { start: '14:00', title: 'Strategy Debrief', type: 'debrief', location: 'Engineering Room' },
  { start: '15:00', title: 'Cognitive Training', type: 'training', location: 'Performance Gym', goal: { title: 'Reaction time', sub: 'Delayed response under sustained fatigue', score: 88 } },
  { start: '16:30', title: 'Reaction Drills', type: 'simulator', location: 'Simulator Room N.1' },
  { start: '17:30', title: 'Ice Bath', type: 'icebath', location: 'Recovery Zone' },
  { start: '18:30', title: 'Performance Debrief', type: 'debrief', location: 'Meeting Room' },
  { start: '19:30', title: 'Dinner', type: 'meal', location: 'Dining Area' },
]

const SIMULATOR_DAY = [
  { start: '07:30', title: 'Breakfast', type: 'meal', location: 'Dining Area' },
  { start: '08:30', title: 'Simulator Training', type: 'simulator', location: 'Simulator Room N.1', goal: { title: 'Concentration endurance', sub: 'Focus fades during long high-stress sessions', score: 76 } },
  { start: '10:00', title: 'Data Review', type: 'debrief', location: 'Engineering Room' },
  { start: '11:00', title: 'Physical Training', type: 'training', location: 'Performance Gym', goal: { title: 'Core endurance', sub: 'Fatigue building in the final stint', score: 84 } },
  { start: '12:30', title: 'Lunch', type: 'meal', location: 'Dining Area' },
  { start: '13:30', title: 'Simulator Training', type: 'simulator', location: 'Simulator Room N.1', goal: { title: 'Reaction consistency', sub: 'Response slows as fatigue builds', score: 79 } },
  { start: '15:00', title: 'Cognitive Training', type: 'training', location: 'Performance Gym' },
  { start: '16:00', title: 'Ice Bath', type: 'icebath', location: 'Recovery Zone' },
  { start: '17:00', title: 'Performance Debrief', type: 'debrief', location: 'Meeting Room' },
  { start: '18:00', title: 'Dinner', type: 'meal', location: 'Dining Area' },
]

const RECOVERY = [
  { start: '09:00', title: 'Breakfast', type: 'meal', location: 'Dining Area' },
  { start: '10:00', title: 'Physiotherapy', type: 'medical', location: 'Medical Room' },
  { start: '11:00', title: 'Light Mobility', type: 'training', location: 'Performance Gym', goal: { title: 'Restore range of motion', sub: 'Stiffness after sustained race load', score: 69 } },
  { start: '12:30', title: 'Lunch', type: 'meal', location: 'Dining Area' },
  { start: '13:30', title: 'Ice Bath', type: 'icebath', location: 'Recovery Zone' },
  { start: '14:30', title: 'Sponsor Media', type: 'debrief', location: 'Media Room' },
  { start: '15:30', title: 'Recovery Massage', type: 'medical', location: 'Medical Room' },
  { start: '16:30', title: 'Dinner', type: 'meal', location: 'Dining Area' },
]

const REST_DAY = [
  { start: '09:00', title: 'Breakfast', type: 'meal', location: 'Dining Area' },
  { start: '10:00', title: 'Light Walk', type: 'training', location: 'Outdoor Track' },
  { start: '11:00', title: 'Physiotherapy', type: 'medical', location: 'Medical Room' },
  { start: '12:00', title: 'Lunch', type: 'meal', location: 'Dining Area' },
  { start: '13:00', title: 'Team Meeting', type: 'debrief', location: 'Meeting Room' },
  { start: '14:00', title: 'Dinner', type: 'meal', location: 'Dining Area' },
]

const RED_DAYS = [24, 25, 26] // race weekend

function scheduleForDay(day) {
  if (RED_DAYS.includes(day)) return RACE_PREP // race weekend
  const dow = new Date(2026, 6, day).getDay() // 0 sun .. 6 sat
  if (dow === 0) return REST_DAY
  if (dow === 6) return RECOVERY
  return day % 2 === 0 ? SIMULATOR_DAY : RACE_PREP
}

function weekdayName(day) {
  return new Date(2026, 6, day).toLocaleDateString('en-US', { weekday: 'long' })
}

const toHours = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}
const hoursToHM = (t) => {
  const h = Math.floor(t + 1e-6)
  const m = Math.round((t - h) * 60)
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}

// status of a day relative to "today"
function dayStatus(day) {
  if (day < TODAY) return 'past'
  if (day === TODAY) return 'today'
  return 'future'
}

/* build an editable schedule (explicit start + duration) from a template */
function buildSchedule(template) {
  const items = template.map((s, i) => {
    const start = toHours(s.start)
    const next = i < template.length - 1 ? toHours(template[i + 1].start) : start + 1
    const { start: _s, ...rest } = s
    return { start, dur: next - start, ...rest }
  })
  return { items }
}

/* half-hour time options for the "add session" picker */
const TIME_OPTIONS = []
for (let t = 6; t <= 22; t += 0.5) TIME_OPTIONS.push(t)

/* ---- calendar grid (July 2026, 1st is Wednesday) ----------------- */
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const CAL_ROWS = [
  [null, null, null, 1, 2, 3, 4],
  [5, 6, 7, 8, 9, 10, 11],
  [12, 13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23, 24, 25],
  [26, 27, 28, 29, 30, 31, null],
]

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

function SessionCard({ s, time, top, height, done, editable, menuOpen, onOpen, onChange, onDelete }) {
  const expanded = !!s.goal
  const [src, size] = ICONS[s.type]
  const [hour, min] = time.split(':')
  return (
    <div
      className={'card' + (done ? ' card--done' : '') + (editable ? ' card--editable' : '')}
      style={{ top, height }}
      onClick={editable ? onOpen : undefined}
    >
      {done && <span className="card__check">✓</span>}
      <div className="card__time">
        <span className="card__hour">{hour}</span>
        <span className="card__min">{min}</span>
      </div>

      <div className="card__titleRow">
        <span className="card__title">{s.title}</span>
        <img className="card__icon" src={src} alt="" style={{ width: size, height: size }} />
      </div>

      <div className="card__loc">
        <span className="card__locLabel">Location</span>
        <span className="card__locTick" />
        <span className="card__locValue">{s.location}</span>
      </div>

      {expanded && (
        <div className="goal">
          <div className="goal__label">mAIN GOAL</div>
          <div className="goal__body">
            <div className="goal__title">{s.goal.title}</div>
            <div className="goal__sub">{s.goal.sub}</div>
            <div className="goal__scoreRow">
              <span className="goal__score">{s.goal.score} / 100</span>
              <span className="goal__scoreCaption">Current score</span>
            </div>
            <ProgressDots score={s.goal.score} />
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="card-menu" onClick={(e) => e.stopPropagation()}>
          <button className="menu-btn" onClick={onChange}>Change</button>
          <button className="menu-btn menu-btn--del" onClick={onDelete}>Delete</button>
        </div>
      )}
    </div>
  )
}

function EmptySlot({ time, top, height, onAdd, onRemove }) {
  return (
    <div className="empty-slot" style={{ top, height }}>
      <span className="empty-slot__time">{time}</span>
      <div className="empty-slot__actions">
        <button className="slot-btn slot-btn--add" title="Add activity" onClick={onAdd}>+</button>
        <button className="slot-btn slot-btn--rem" title="Remove this slot" onClick={onRemove}>−</button>
      </div>
      <span className="empty-slot__label">empty</span>
    </div>
  )
}

/* shared nav pill — switches between the schedule, dashboard and training screens */
function Nav({ active, onNav }) {
  const tabs = [
    ['schedule', 'schedule', `${A}/nav-schedule.svg`],
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
  const [view, setView] = useState('default') // track view: 'default' | 'focus'
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

  // live driver-state data — drifts continuously as new data comes in
  const [ready, setReady] = useState(84) // readiness %
  const [bpm, setBpm] = useState(50) // heart rate
  const [hydration, setHydration] = useState(85) // %
  useEffect(() => {
    const id = setInterval(() => {
      setReady((r) => Math.max(79, Math.min(90, r + Math.round((Math.random() - 0.5) * 3))))
      setBpm((b) => Math.max(46, Math.min(60, b + Math.round((Math.random() - 0.5) * 3))))
      setHydration((v) => Math.max(80, Math.min(92, v + Math.round((Math.random() - 0.5) * 2))))
    }, 1300)
    return () => clearInterval(id)
  }, [])
  const ARC = Math.PI * 76 // semicircle length for r=76

  return (
    <>
      {/* 3D track model — centered in the frame, behind the UI */}
      <Track3D mode={view} selected={sel} onSelectPoint={setSel} />

      <img className="logo" src={`${A}/c1logo.svg`} alt="C1" />
      <Nav active="dashboard" onNav={onNav} />
      <div className="sh-avatar">SH</div>

      <h1 className="dash-hi">Hi Steve</h1>
      <div className="dash-sub">Your Driver is Charles Leclerc</div>

      {/* driver ID card */}
      <div className="drv-card">
        <div className="drv-top">
          <img className="drv-badge" src={`${A}/ferrari.png`} alt="Ferrari" />
          <div>
            <div className="drv-name">Charles Leclerc</div>
            <div className="drv-team">Ferrari · #16</div>
            <div className="drv-meta">Monaco · 27 yrs · 8th season</div>
          </div>
        </div>

        <div className="drv-phys">
          <span>1.80 m</span>
          <i>·</i>
          <span>68 kg</span>
          <i>·</i>
          <span>BMI 21.0</span>
          <i>·</i>
          <span>8% BF</span>
        </div>

        <div className="drv-metrics">
          <div className="drv-m"><span>Resting HR</span><b>46<i>bpm</i></b></div>
          <div className="drv-m"><span>VO₂ Max</span><b>60<i>ml/kg</i></b></div>
          <div className="drv-m"><span>Neck strength</span><b>45<i>kg</i></b></div>
          <div className="drv-m"><span>Reaction</span><b>185<i>ms</i></b></div>
        </div>

        <div className="drv-season">
          <div className="drv-s"><b>P4</b><span>Championship</span></div>
          <div className="drv-s"><b>75</b><span>Points</span></div>
          <div className="drv-s"><b>4</b><span>Podiums</span></div>
        </div>

        <div className="drv-focus"><em>Coach focus</em> Neck &amp; sustained-G tolerance</div>
      </div>

      {/* driver status + readiness gauge */}
      <div className="status-card">
        <div className="status-title">Driver Status</div>
        <div className="gauge">
          <svg viewBox="0 0 200 124" className="gauge__svg">
            <defs>
              <linearGradient id="ready" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#8fbf00" />
                <stop offset="1" stopColor="#c6ff00" />
              </linearGradient>
            </defs>
            <path d="M20 96 A76 76 0 0 1 180 96" fill="none" stroke="#3a3a3a" strokeWidth="11" strokeLinecap="round" />
            <path
              d="M20 96 A76 76 0 0 1 180 96"
              fill="none"
              stroke="url(#ready)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={`${(ready / 100) * ARC} ${ARC}`}
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
            <text className="g-tick" x="100" y="13" textAnchor="middle">50</text>
            <text className="g-tick" x="14" y="114" textAnchor="middle">0</text>
            <text className="g-tick" x="186" y="114" textAnchor="middle">100</text>
            <text className="g-lbl" x="100" y="74" textAnchor="middle">Readiness</text>
            <text className="g-val" x="100" y="98" textAnchor="middle">{ready}%</text>
          </svg>
        </div>
        <div className="status-metrics">
          <div>
            <div className="sm-lbl">Time sleep</div>
            <div className="sm-val">7H 24M</div>
          </div>
          <div>
            <div className="sm-lbl">BPM</div>
            <div className="sm-val">{bpm}</div>
          </div>
          <div>
            <div className="sm-lbl">Hydration</div>
            <div className="sm-val">{hydration}%</div>
          </div>
        </div>
      </div>

      {/* Belgium GP countdown */}
      <div className="gp">
        <div className="gp-name">BELGIUM GP</div>
        <div className="gp-clock">
          <div><span>{p2(d)}</span><em>Days</em></div>
          <b>:</b>
          <div><span>{p2(h)}</span><em>Hours</em></div>
          <b>:</b>
          <div><span>{p2(m)}</span><em>Minutes</em></div>
          <b>:</b>
          <div><span>{p2(s)}</span><em>Seconds</em></div>
        </div>
        <div className="gp-bar" />
      </div>

      {/* length / distance */}
      <div className="ld">
        <div className="ld-item">
          <div className="ld-lbl">LENGTH</div>
          <div className="ld-bar" />
          <div className="ld-val">7.004 KM</div>
        </div>
        <div className="ld-item">
          <div className="ld-lbl">DISTANCE</div>
          <div className="ld-bar" />
          <div className="ld-val">308.176 KM</div>
        </div>
      </div>

      {/* focus-point explanation panel */}
      {view === 'focus' && sel != null && (
        <div className="focus-panel">
          <div className="focus-panel__head">
            <span className="focus-panel__num">{sel}</span>
            <div className="focus-panel__name">{FOCUS_POINTS[sel - 1].name}</div>
            <button className="focus-panel__close" onClick={() => setSel(null)}>×</button>
          </div>
          <div className="focus-panel__lbl">Why it's dangerous</div>
          <div className="focus-panel__txt">{FOCUS_POINTS[sel - 1].danger}</div>
          <div className="focus-panel__lbl focus-panel__lbl--goal">Training goal</div>
          <div className="focus-panel__txt">{FOCUS_POINTS[sel - 1].goal}</div>
        </div>
      )}

      {/* pill buttons — switch the track view */}
      <button
        className={'dash-pill dash-pill--1' + (view === 'focus' ? ' dash-pill--active' : '')}
        onClick={() => {
          setSel(null)
          setView((v) => (v === 'focus' ? 'default' : 'focus'))
        }}
      >
        Mental Focus Points
      </button>
      <button
        className={'dash-pill dash-pill--2' + (view === 'default' ? ' dash-pill--active' : '')}
        onClick={() => {
          setSel(null)
          setView('default')
        }}
      >
        Cognitive Load
      </button>
    </>
  )
}

/* ================= SLIDE-IN SCHEDULE OVERLAY ================= */
const OVERLAY_SESSIONS = [
  { start: '08:00', title: 'Breakfast', type: 'meal', location: 'Dining Area' },
  { start: '09:00', title: 'Simulator Training', type: 'simulator', location: 'Simulator Room N.1', goal: { title: 'Focus under pressure', sub: 'Errors increase under cognitive load', score: 73 } },
  { start: '11:00', title: 'Physical Training', type: 'training', location: 'Performance Gym', goal: { title: 'Increase neck stability', sub: 'Reduced stability under sustained G-force load', score: 81 } },
  { start: '13:00', title: 'Lunch', type: 'meal', location: 'Dining Area' },
  { start: '14:00', title: 'Medical Check-Up', type: 'medical', location: 'Medical Room' },
  { start: '15:00', title: 'Cognitive Training', type: 'training', location: 'Performance Gym' },
]

function ScheduleOverlay({ onClose }) {
  const OV_HH = 92
  const OV_PAD = 14
  const toH = (t) => t.split(':').map(Number).reduce((h, m) => h + m / 60)
  const top = (t) => OV_PAD + (t - 8) * OV_HH
  const now = 9.5
  const hours = [8, 9, 10, 11, 12, 13, 14, 15]

  return (
    <div className="ov-inner-wrap">
      <div className="ov-head">
        <button className="ov-close" onClick={onClose}>×</button>
        <div className="ov-title">
          Daily Schedule <b>Tuesday</b>
        </div>
        <div className="ov-goals">
          Daily goals <span>0/3</span>
        </div>
        <button className="ov-add">+</button>
      </div>

      <div className="ov-scroll">
        <div className="ov-track" style={{ height: top(16) }}>
          {hours.map((h) => (
            <div key={h} className="ov-time" style={{ top: top(h) - 7 }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
          <div className="ov-play" style={{ top: top(now) }} />

          {OVERLAY_SESSIONS.map((s, i) => {
            const [src, size] = ICONS[s.type]
            return (
              <div key={i} className="ov-card" style={{ top: top(toH(s.start)), height: s.goal ? 148 : 84 }}>
                <div className="ov-card__row">
                  <span className="ov-card__title">{s.title}</span>
                  <img className="ov-card__icon" src={src} alt="" style={{ width: size, height: size }} />
                </div>
                <div className="ov-card__sub">{s.location}</div>
                {s.goal && (
                  <div className="ov-goal">
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

const PANEL_W = 354
const clampV = (v, a, b) => Math.max(a, Math.min(b, v))

export default function App() {
  const [stage, setStage] = useState('intro') // 'intro' | 'login' | 'app'
  const [selectedDay, setSelectedDay] = useState(() => {
    const q = Number(new URLSearchParams(window.location.search).get('day'))
    return q >= 1 && q <= VISIBLE_UNTIL ? q : TODAY
  })
  const [edits, setEdits] = useState({}) // day -> { items }
  const [menu, setMenu] = useState(null) // open action menu: index
  const [picker, setPicker] = useState(null) // open activity picker: index | 'new'
  const [newTime, setNewTime] = useState(12) // chosen start time (hours) for a new session
  const [screen, setScreen] = useState(() => {
    const s = new URLSearchParams(window.location.search).get('screen')
    return s === 'training' || s === 'dashboard' ? s : 'schedule'
  }) // 'schedule' | 'training' | 'dashboard'

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

  const status = dayStatus(selectedDay)
  const isPast = status === 'past'
  const editable = !isPast
  const schedule = edits[selectedDay] || buildSchedule(scheduleForDay(selectedDay))

  const closeOverlays = () => {
    setMenu(null)
    setPicker(null)
  }
  const pickDay = (d) => {
    closeOverlays()
    setSelectedDay(d)
  }
  const items = schedule.items
  // store items always sorted by start time
  const commit = (next) =>
    setEdits({ ...edits, [selectedDay]: { items: [...next].sort((a, b) => a.start - b.start) } })

  const deleteItem = (i) => {
    commit(items.map((it, j) => (j === i ? { start: it.start, dur: it.dur, empty: true } : it)))
    setMenu(null)
  }
  // remove a slot and pull everything after it earlier -> the day finishes sooner
  const removeSlot = (i) => {
    const removed = items[i]
    commit(
      items
        .filter((_, j) => j !== i)
        .map((it) => (it.start > removed.start ? { ...it, start: it.start - removed.dur } : it))
    )
  }
  const setActivity = (target, act) => {
    let next
    if (target === 'new') {
      // insert at the chosen time: push everything at/after it later, so the day grows
      const D = 1
      next = items.map((it) => {
        if (it.start >= newTime) return { ...it, start: it.start + D } // pushed down
        if (it.start + it.dur > newTime) return { ...it, dur: newTime - it.start } // clip the one it splits
        return it
      })
      next.push({ start: newTime, dur: D, ...act })
    } else {
      next = items.map((it, j) => (j === target ? { start: it.start, dur: it.dur, ...act } : it))
    }
    commit(next)
    closeOverlays()
  }

  // time-aligned layout: position each item by its explicit start time
  const firstHour = items.length ? Math.floor(items[0].start) : 7
  let lastEnd = firstHour + 1
  const placed = items.map((it) => {
    lastEnd = Math.max(lastEnd, it.start + it.dur)
    return {
      it,
      start: it.start,
      top: PAD_TOP + (it.start - firstHour) * HOUR_H,
      height: Math.max(it.empty ? 64 : 90, it.dur * HOUR_H - CARD_GAP),
    }
  })
  const lastHour = Math.ceil(lastEnd)
  const railHours = []
  for (let h = firstHour; h <= lastHour; h++) railHours.push(h)
  const railTop = (h) => PAD_TOP + (h - firstHour) * HOUR_H
  const innerHeight = railTop(lastHour) + 30

  return (
    <>
      {stage === 'intro' && <LoadingScreen onDone={() => setStage('login')} />}
      {stage === 'login' && <FaceIDLogin onDone={() => setStage('app')} />}
      <div className="stage">
      <div className="screen">
        {screen === 'training' ? (
          <TrainingScreen onNav={setScreen} />
        ) : screen === 'dashboard' ? (
          <DashboardScreen onNav={setScreen} />
        ) : (
          <>
        {/* ================= HEADER ================= */}
        <img className="logo" src={`${A}/c1logo.svg`} alt="C1" />
        <div className="brand">Daily Overview</div>

        <Nav active="schedule" onNav={setScreen} />

        <div className="coach">C.STEVE CARTER</div>
        <img className="avatar" src={`${A}/avatar.png`} alt="Charles Leclerc" />

        <h1 className="title">July {selectedDay} / {weekdayName(selectedDay)}</h1>

        {/* ================= MAIN CONTENT ================= */}
        <div className="main">
          {/* ---- left timeline panel (scrollable) ---- */}
          <div className="timeline">
            {editable && (
              <button
                className="day-add"
                title="Add session"
                onClick={() => {
                  setNewTime(lastEnd <= 22 ? lastEnd : 22)
                  setPicker('new')
                }}
              >
                +
              </button>
            )}
            <div className="timeline__scroll">
              <div className="timeline__inner" style={{ height: innerHeight }}>
                {/* hour rail: full hour + a half-hour dash between hours */}
                {railHours.map((h) => (
                  <div key={'h' + h} className="rail-hour" style={{ top: railTop(h) - 7 }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
                {railHours.slice(0, -1).map((h) => (
                  <span key={'d' + h} className="rail-half" style={{ top: railTop(h) + HOUR_H / 2 }} />
                ))}

                {placed.map(({ it, start, top, height }, i) =>
                  it.empty ? (
                    <EmptySlot
                      key={i}
                      time={hoursToHM(start)}
                      top={top}
                      height={height}
                      onAdd={() => setPicker(i)}
                      onRemove={() => removeSlot(i)}
                    />
                  ) : (
                    <SessionCard
                      key={i}
                      s={it}
                      time={hoursToHM(start)}
                      top={top}
                      height={height}
                      done={isPast}
                      editable={editable}
                      menuOpen={menu === i}
                      onOpen={() => setMenu(menu === i ? null : i)}
                      onChange={() => { setMenu(null); setPicker(i) }}
                      onDelete={() => deleteItem(i)}
                    />
                  )
                )}

                {/* click-away layer to dismiss the action menu */}
                {menu !== null && <div className="edit-backdrop" onClick={() => setMenu(null)} />}
              </div>
            </div>

            {/* activity picker modal */}
            {picker !== null && (
              <div className="picker">
                <div className="picker__backdrop" onClick={() => setPicker(null)} />
                <div className="picker__panel">
                  <div className="picker__head">
                    {picker === 'new' ? 'Add session' : 'Choose activity'}
                  </div>
                  {picker === 'new' && (
                    <label className="picker__time">
                      <span>Time</span>
                      <select value={newTime} onChange={(e) => setNewTime(Number(e.target.value))}>
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {hoursToHM(t)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="picker__grid">
                    {ACTIVITIES.map((a) => {
                      const [src, size] = ICONS[a.type]
                      return (
                        <button key={a.title} className="picker__item" onClick={() => setActivity(picker, a)}>
                          <img src={src} alt="" style={{ width: size, height: size }} />
                          <span>{a.title}</span>
                        </button>
                      )
                    })}
                  </div>
                  <button className="picker__cancel" onClick={() => setPicker(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* ---- right calendar (clickable) ---- */}
          <div className="calendar">
            <div className="calendar__month">july</div>
            <div className="calendar__week">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="calendar__grid">
              {CAL_ROWS.map((row, ri) => (
                <div key={ri} className="calendar__row">
                  {row.map((d, ci) => {
                    if (!d) return <span key={ci} className="calendar__day calendar__day--empty" />
                    const locked = d > VISIBLE_UNTIL
                    return (
                      <button
                        key={ci}
                        disabled={locked}
                        className={
                          'calendar__day' +
                          ' calendar__day--' + dayStatus(d) +
                          (RED_DAYS.includes(d) && d !== selectedDay ? ' calendar__day--red' : '') +
                          (d === TODAY && d !== selectedDay ? ' calendar__day--today' : '') +
                          (d === selectedDay ? ' calendar__day--selected' : '') +
                          (locked ? ' calendar__day--locked' : '')
                        }
                        onClick={() => !locked && pickDay(d)}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

        </div>
          </>
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
