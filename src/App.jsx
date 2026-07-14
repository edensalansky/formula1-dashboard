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
const REVIEW_ZOOM = 13 // default review zoom — pills read as named tags, not bars
const HR_COLS = 90
const HR_ROWS = 11

// system-generated events (green) — driver physical/mental, with durations (min).
// some carry a coaching "goal" suggestion — those get a mark on the review timeline.
// each event's info line is written against the same BPM / Focus / Stress
// metrics shown on the Driver Status card, so the live timeline reads as
// the source of that data instead of an unrelated feed
const SYS_EVENTS = [
  { start: 2, dur: 3, label: 'Warm-up', info: 'BPM baseline check before load ramps up · 72 bpm' },
  { start: 6, dur: 4, label: 'Heart-rate ramp-up', info: 'BPM climbing into the training zone · 110 → 155 bpm' },
  {
    start: 12,
    dur: 2,
    label: 'High cognitive load',
    info: 'Focus under load · decision speed at 84%',
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
    info: 'Focus tested across 6 heavy braking zones',
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
    info: 'Stress on the neck under sustained lateral G · peak 4.2 G',
    goal: {
      title: 'Increase neck strength under sustained-G',
      tagType: 'training',
      tagLabel: 'Physical training',
      desc: 'Neck load peaked at 4.2G for an extended period.',
    },
  },
  { start: 30, dur: 4, label: 'Concentration peak', info: 'Focus holding steady · 96% accuracy' },
  {
    start: 38,
    dur: 2,
    label: 'Reaction drill',
    info: 'Focus + reaction speed drill · avg 210 ms',
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
    info: 'Focus under fatigue · BPM held at 162',
    goal: {
      title: 'Build sustained-attention endurance',
      tagType: 'training',
      tagLabel: 'Cognitive training',
      desc: 'Focus began drifting during the long run.',
    },
  },
  { start: 52, dur: 3, label: 'Recovery window', info: 'BPM easing back down · 155 → 120 bpm' },
  { start: 57, dur: 2, label: 'Cool-down', info: 'BPM and stress settling back to baseline · 95 bpm' },
]

// last 3 completed sessions, shown as a swipeable review carousel on the
// Training Review screen, laid out identically to "This Session" (same
// stats tiles, HR dot-matrix, notification timeline, goal panel) — names,
// notification labels, and goals reuse the same vocabulary as today's
// schedule (DEFAULT_SESSIONS) and SYS_EVENTS so the history reads as part
// of the same ongoing program, not invented one-offs
const PAST_TRAININGS = [
  {
    id: 'p1',
    title: 'Physical Training',
    date: 'Yesterday',
    time: '10:30',
    duration: '00:42',
    avgHR: 158,
    notes: 2,
    events: [
      { id: 'ph1', min: 2, dur: 3, label: 'Warm-up', info: 'BPM baseline check before load ramps up · 70 bpm' },
      {
        id: 'ph2',
        min: 10,
        dur: 4,
        label: 'G-force neck load',
        info: 'Stress on the neck under sustained lateral G · peak 4.5 G',
        goal: {
          title: 'Increase neck strength under sustained-G',
          tagType: 'training',
          tagLabel: 'Physical training',
          desc: 'Neck load peaked at 4.5G for an extended period.',
        },
      },
      { id: 'ph3', min: 18, dur: 3, label: 'Recovery window', info: 'BPM easing back down · 150 → 115 bpm' },
      {
        id: 'ph4',
        min: 25,
        dur: 4,
        label: 'G-force neck load',
        info: 'Second sustained-G set · peak 4.1 G',
        goal: {
          title: 'Increase neck strength under sustained-G',
          tagType: 'training',
          tagLabel: 'Physical training',
          desc: 'Neck load peaked at 4.1G on the second set.',
        },
      },
      { id: 'ph5', min: 34, dur: 2, label: 'Cool-down', info: 'BPM and stress settling back to baseline · 90 bpm' },
    ],
  },
  {
    id: 'p2',
    title: 'Simulator Training',
    date: '2 days ago',
    time: '09:00',
    duration: '01:12',
    avgHR: 172,
    notes: 3,
    events: [
      { id: 's1', min: 3, dur: 3, label: 'Warm-up', info: 'BPM baseline check before load ramps up · 74 bpm' },
      {
        id: 's2',
        min: 14,
        dur: 2,
        label: 'High cognitive load',
        info: 'Focus under load · decision speed at 79%',
        goal: {
          title: 'Improve decision speed under stress',
          tagType: 'simulator',
          tagLabel: 'Simulator training',
          desc: 'High cognitive load detected during the braking phase.',
        },
      },
      {
        id: 's3',
        min: 22,
        dur: 5,
        label: 'Braking-zone focus',
        info: 'Focus tested across 6 heavy braking zones',
        goal: {
          title: 'Improve braking consistency',
          tagType: 'simulator',
          tagLabel: 'Simulator training',
          desc: 'Inconsistent braking points detected.',
        },
      },
      { id: 's4', min: 40, dur: 4, label: 'Concentration peak', info: 'Focus holding steady · 93% accuracy' },
      {
        id: 's5',
        min: 55,
        dur: 2,
        label: 'Reaction drill',
        info: 'Focus + reaction speed drill · avg 225 ms',
        goal: {
          title: 'Sharpen reaction time',
          tagType: 'simulator',
          tagLabel: 'Simulator training',
          desc: 'Reaction time above target on the light-panel drill.',
        },
      },
      { id: 's6', min: 68, dur: 3, label: 'Cool-down', info: 'BPM and stress settling back to baseline · 98 bpm' },
    ],
  },
  {
    id: 'p3',
    title: 'Cognitive Training',
    date: '3 days ago',
    time: '14:00',
    duration: '00:35',
    avgHR: 149,
    notes: 1,
    events: [
      { id: 'c1', min: 2, dur: 3, label: 'Warm-up', info: 'BPM baseline check · 68 bpm' },
      {
        id: 'c2',
        min: 9,
        dur: 2,
        label: 'Reaction drill',
        info: 'Focus + reaction speed drill · avg 240 ms',
        goal: {
          title: 'Sharpen reaction time',
          tagType: 'simulator',
          tagLabel: 'Simulator training',
          desc: 'Reaction time above target on the light-panel drill.',
        },
      },
      {
        id: 'c3',
        min: 18,
        dur: 5,
        label: 'Sustained focus',
        info: 'Focus under fatigue · BPM held at 150',
        goal: {
          title: 'Build sustained-attention endurance',
          tagType: 'training',
          tagLabel: 'Cognitive training',
          desc: 'Focus began drifting during the long run.',
        },
      },
      { id: 'c4', min: 28, dur: 3, label: 'Recovery window', info: 'BPM easing back down · 140 → 105 bpm' },
      { id: 'c5', min: 33, dur: 2, label: 'Cool-down', info: 'BPM and stress settling back to baseline · 88 bpm' },
    ],
  },
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
// each past training gets its own realistic-looking HR trace, same generator
// the live session uses — fixed once at load, since these are completed runs
PAST_TRAININGS.forEach((p) => {
  p.hr = genHRHeights()
})

// draws a fully-revealed HR dot-matrix (every column already complete, unlike
// the live canvas which reveals column-by-column as the session plays out) —
// used for past-training reviews, which have no "in progress" state
function drawStaticHR(canvas, heights) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  const cols = heights.length
  const cw = W / cols, chh = H / HR_ROWS
  const r = Math.min(cw, chh) * 0.32
  ctx.clearRect(0, 0, W, H)
  for (let c = 0; c < cols; c++) {
    const isHigh = heights[c] >= HR_HIGH
    for (let row = 0; row < HR_ROWS; row++) {
      ctx.beginPath()
      ctx.arc(c * cw + cw / 2, (HR_ROWS - 1 - row) * chh + chh / 2, r, 0, Math.PI * 2)
      ctx.fillStyle = row >= heights[c] ? '#1c1c1c' : isHigh ? '#ff3b30' : '#e6e6e6'
      ctx.fill()
    }
  }
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

// one past-training review — laid out identically to the live session's
// review body (same sum-stats/sum-hr/sumtl-panel/sumbot classes, positioned
// via card-scoped CSS overrides so the exact same visual language applies),
// but fully self-contained: its own canvas, its own selected-notification/
// added-goals state, so browsing one past session never touches another's.
function PastTrainingCard({ p, active }) {
  const [selNotif, setSelNotif] = useState(null)
  const [addedGoals, setAddedGoals] = useState({})
  const canvasRef = useRef(null)
  const viewportRef = useRef(null)
  const goalEvents = p.events.filter((e) => e.goal)
  const minToPct = (m) => (m / RULER_MAX) * 100

  useEffect(() => {
    drawStaticHR(canvasRef.current, p.hr)
    const first = goalEvents[0] || p.events[0] || null
    setSelNotif(first)
    if (first) {
      requestAnimationFrame(() => {
        const vp = viewportRef.current
        if (!vp) return
        const contentW = vp.clientWidth * REVIEW_ZOOM
        const x = (first.min / RULER_MAX) * contentW
        vp.scrollLeft = Math.max(0, x - vp.clientWidth / 2)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id])

  const selectNotif = (e) => {
    setSelNotif(e)
    const vp = viewportRef.current
    if (!vp) return
    const contentW = vp.clientWidth * REVIEW_ZOOM
    const x = (e.min / RULER_MAX) * contentW
    requestAnimationFrame(() => {
      vp.scrollLeft = Math.max(0, x - vp.clientWidth / 2)
    })
  }
  const jumpGoal = (dir) => {
    if (!goalEvents.length) return
    const idx = selNotif ? goalEvents.findIndex((e) => e.id === selNotif.id) : -1
    const next = goalEvents[(idx === -1 ? 0 : idx + dir + goalEvents.length) % goalEvents.length]
    selectNotif(next)
  }
  const toggleAdded = (id) => setAddedGoals((a) => ({ ...a, [id]: !a[id] }))

  return (
    <div className="sumhist-card" aria-hidden={!active}>
      <div className="sum-stats">
        <div className="sum-tile"><b>{p.duration}</b><span>Duration</span></div>
        <div className="sum-tile"><b>{p.events.length}</b><span>System alerts</span></div>
        <div className="sum-tile"><b>{p.notes}</b><span>Coach notes</span></div>
        <div className="sum-tile"><b>{p.avgHR}<i>bpm</i></b><span>Avg heart-rate</span></div>
      </div>

      <div className="sum-hr-label">HR</div>
      <canvas ref={canvasRef} className="sum-hr" width={p.hr.length * 24} height={HR_ROWS * 20} />

      <div className="sumtl-panel">
        <div className="sumtl-viewport" ref={viewportRef}>
          <div className="sumtl-track" style={{ width: REVIEW_ZOOM * 100 + '%' }}>
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
            {p.events.map((e) => (
              <div
                key={e.id}
                className={'notif notif--sys' + (e.goal ? ' notif--hasgoal' : '') + (selNotif?.id === e.id ? ' notif--sel' : '')}
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
              <span className="sumbot-detail__badge sumbot-detail__badge--sys">SYSTEM</span>
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
                <button onClick={() => jumpGoal(-1)} aria-label="Previous goal"><span>‹</span></button>
                <span>
                  {selNotif?.goal ? goalEvents.findIndex((e) => e.id === selNotif.id) + 1 : '–'}/{goalEvents.length}
                </span>
                <button onClick={() => jumpGoal(1)} aria-label="Next goal"><span>›</span></button>
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
  )
}

function TrainingScreen({ onNav, onOpenCoach }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0) // seconds
  const [notes, setNotes] = useState([]) // {start, end, text}
  const [draft, setDraft] = useState(null) // {start}
  const [draftText, setDraftText] = useState('')
  const [zoom, setZoom] = useState(1) // timeline pinch-zoom (1 = fit)
  const [detail, setDetail] = useState(null) // clicked notification: {type,label,min,dur,info}
  const [scrollX, setScrollX] = useState(0) // timeline horizontal scroll offset
  const [finished, setFinished] = useState(false) // show the session review
  const [finishing, setFinishing] = useState(false) // brief "analyzing" loading state after FINISH, before the review
  const [reviewTab, setReviewTab] = useState('session') // review: 'session' (this run) | 'history' (last 3 trainings)
  const [histIdx, setHistIdx] = useState(0) // review: which past-training card is centered
  const histDragRef = useRef(null)
  const [histDragX, setHistDragX] = useState(null) // live drag offset (px), null when idle
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
      info: 'Coach note',
    })),
  ].sort((a, b) => a.min - b.min)
  const goalEvents = allEvents.filter((e) => e.goal)

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
        ctx.fillStyle = row >= litThisCol ? '#1c1c1c' : isHigh ? '#ff3b30' : '#e6e6e6'
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

  // pinch-to-zoom (iPad Safari gesture events) + ctrl-wheel (trackpad pinch) —
  // re-attached whenever `finished` flips, since that conditionally unmounts
  // the live view's .sim-viewport (swapping in the review screen) and mounts
  // a brand-new node when "NEXT TRAINING" returns to a fresh live session;
  // an empty dep array here would leave the new node with no listeners at all
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
  }, [finished])

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

  // brief "analyzing" beat between pressing FINISH and the review actually
  // appearing, so the numbers don't just snap into place instantly
  useEffect(() => {
    if (!finishing) return
    const t = setTimeout(() => {
      setFinishing(false)
      setFinished(true)
    }, 1600)
    return () => clearTimeout(t)
  }, [finishing])

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
    setFinishing(false)
    setReviewTab('session')
    setHistIdx(0)
    drawHR(0)
  }

  // ===== review: "Past Trainings" carousel drag (mirrors the schedule-panel drag pattern) =====
  const scaleNow = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale')) || 1
  const onHistDragMove = (e) => {
    const d = histDragRef.current
    if (!d) return
    const dx = (e.clientX - d.startX) / d.scale
    d.dx = dx
    setHistDragX(dx)
  }
  const onHistDragEnd = () => {
    window.removeEventListener('pointermove', onHistDragMove)
    window.removeEventListener('pointerup', onHistDragEnd)
    const dx = histDragRef.current?.dx ?? 0
    histDragRef.current = null
    setHistIdx((i) => {
      if (dx < -60 && i < PAST_TRAININGS.length - 1) return i + 1
      if (dx > 60 && i > 0) return i - 1
      return i
    })
    setHistDragX(null)
  }
  const beginHistDrag = (e) => {
    histDragRef.current = { startX: e.clientX, scale: scaleNow(), dx: 0 }
    setHistDragX(0)
    window.addEventListener('pointermove', onHistDragMove)
    window.addEventListener('pointerup', onHistDragEnd)
  }

  // ===================== ANALYZING (brief beat after FINISH, before the review) =====================
  if (finishing) {
    return (
      <>
        <img className="logo" src={`${A}/c1logo.svg`} alt="C1" />
        <div className="brand">TRAINING REVIEW</div>
        <Nav active="training" onNav={onNav} />
        <div className="sh-avatar" onClick={onOpenCoach}>SH</div>

        <h1 className="sim-title">Simulator Training</h1>

        <div className="sum-panel sum-panel--loading">
          <div className="sum-loading">
            <div className="sum-loading__ring" />
            <div className="sum-loading__text">Analyzing session…</div>
          </div>
        </div>
      </>
    )
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
        <div className="sh-avatar" onClick={onOpenCoach}>SH</div>

        <h1 className="sim-title">
          {reviewTab === 'history' ? PAST_TRAININGS[histIdx].title : 'Simulator Training'}
          {reviewTab === 'history' && (
            <span className="sim-title__meta">{PAST_TRAININGS[histIdx].date} · {PAST_TRAININGS[histIdx].time}</span>
          )}
        </h1>

        <div className="sum-panel">
          <button className="sim-btn sum-restart" onClick={restart}>NEXT TRAINING</button>

          <div className="sumtabs">
            <button
              className={'sumtabs__btn' + (reviewTab === 'session' ? ' sumtabs__btn--active' : '')}
              onClick={() => setReviewTab('session')}
            >
              This Session
            </button>
            <button
              className={'sumtabs__btn' + (reviewTab === 'history' ? ' sumtabs__btn--active' : '')}
              onClick={() => setReviewTab('history')}
            >
              Past Trainings
            </button>
          </div>

          {reviewTab === 'session' ? (
            <>
              <div className="sum-stats">
                <div className="sum-tile"><b>{fmtClock(elapsed).slice(3)}</b><span>Duration</span></div>
                <div className="sum-tile"><b>{SYS_EVENTS.length}</b><span>System alerts</span></div>
                <div className="sum-tile"><b>{notes.length}</b><span>Coach notes</span></div>
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
                        {selNotif.type === 'user' ? 'COACH NOTE' : 'SYSTEM'}
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
                        <button onClick={() => jumpGoal(-1)} aria-label="Previous goal"><span>‹</span></button>
                        <span>
                          {selNotif?.goal ? goalEvents.findIndex((e) => e.id === selNotif.id) + 1 : '–'}/{goalEvents.length}
                        </span>
                        <button onClick={() => jumpGoal(1)} aria-label="Next goal"><span>›</span></button>
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
            </>
          ) : (
            <div className="sumhist">
              <div className="sumhist-viewport">
                <div
                  className="sumhist-track"
                  style={{
                    transform: `translateX(calc(${-histIdx * 100}% + ${histDragX ?? 0}px))`,
                    transition: histDragX != null ? 'none' : 'transform .35s cubic-bezier(.4, 0, .2, 1)',
                  }}
                  onPointerDown={beginHistDrag}
                >
                  {PAST_TRAININGS.map((p, i) => (
                    <PastTrainingCard p={p} key={p.id} active={i === histIdx} />
                  ))}
                </div>
              </div>

              <div className="sumhist-nav">
                <button
                  className="sumhist-nav__btn"
                  disabled={histIdx === 0}
                  onClick={() => setHistIdx((i) => Math.max(0, i - 1))}
                  aria-label="Previous training"
                >
                  ‹
                </button>
                <div className="sumhist-dots">
                  {PAST_TRAININGS.map((p, i) => (
                    <span key={p.id} className={'sumhist-dot' + (i === histIdx ? ' sumhist-dot--active' : '')} />
                  ))}
                </div>
                <button
                  className="sumhist-nav__btn"
                  disabled={histIdx === PAST_TRAININGS.length - 1}
                  onClick={() => setHistIdx((i) => Math.min(PAST_TRAININGS.length - 1, i + 1))}
                  aria-label="Next training"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <img className="logo" src={`${A}/c1logo.svg`} alt="C1" />
      <div className="brand">LIVE TRAINING</div>
      <Nav active="training" onNav={onNav} />
      <div className="sh-avatar" onClick={onOpenCoach}>SH</div>

      <h1 className="sim-title">Simulator Training</h1>

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
                        info: 'Coach note',
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
                      {detail.type === 'user' ? 'COACH NOTE' : 'SYSTEM'}
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
              setFinishing(true)
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
// Mental-focus corners (Spa) — challenge + the training goal to prepare the driver.
// Each corner's training goal is written to match one of the two goal names
// that actually appear in today's schedule ("Focus under pressure" from
// Simulator/Cognitive training, "Increase neck stability" from Physical
// Training) — so the track view and the schedule read as one system, not
// two disconnected screens.
const FOCUS_POINTS = [
  {
    name: 'Heavy Braking Precision',
    danger: 'This section demands maximum braking performance while maintaining complete control. Small inconsistencies here affect the rhythm of the entire opening sector.',
    goal: 'Builds "Focus under pressure". Today\'s braking drills focus on precise brake modulation and controlled release under maximum deceleration, the same reaction-under-load skill Cognitive training is scoring today.',
  },
  {
    name: 'High-Speed Commitment',
    danger: 'The driver must remain fully committed while the car experiences rapid changes in load. Confidence and precise steering are critical to maintaining speed.',
    goal: 'Builds "Increase neck stability". The rapid load changes through this section are exactly what today\'s Physical Training session is preparing him for.',
  },
  {
    name: 'Corner Exit Acceleration',
    danger: 'Maximizing exit speed is essential for carrying momentum onto the following straight. Even small delays in throttle application reduce overall lap performance.',
    goal: 'Builds "Focus under pressure". Training focuses on earlier and smoother throttle application while maintaining rear grip, the same precision Cognitive training is built around.',
  },
  {
    name: 'Rapid Direction Changes',
    danger: 'This sequence requires quick transitions while maintaining an accurate racing line. Physical and mental workload increase significantly through this section.',
    goal: 'Builds "Focus under pressure". Cognitive training develops faster decision-making and more consistent steering inputs for exactly this kind of sequence.',
  },
  {
    name: 'Rear Tyre Management',
    danger: 'Maintaining rear grip through this section is essential for preserving tyre performance over longer race stints.',
    goal: 'Builds "Focus under pressure". Current sessions focus on smoother throttle and steering inputs to reduce tyre degradation, the same controlled precision Cognitive training targets.',
  },
  {
    name: 'Performance Under Fatigue',
    danger: 'Late in the lap, physical fatigue can reduce precision. Consistency here is critical for finishing the lap cleanly and starting the next one with maximum momentum.',
    goal: 'Builds "Increase neck stability". Endurance exercises in today\'s Physical Training prepare the driver to maintain peak physical performance throughout the race.',
  },
]

function DashboardScreen({ onNav, onOpenCoach, appVisible }) {
  const [sel, setSel] = useState(null) // selected focus point (1..6)
  const [remain, setRemain] = useState(11 * 86400 + 2 * 3600 + 32 * 60 + 24) // Belgium GP countdown (sec)
  useEffect(() => {
    const id = setInterval(() => setRemain((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(id)
  }, [])
  // on first mount the bracelet hasn't reported anything yet — show an empty
  // "collecting" state for 2s before the ring/stats reveal real numbers. This
  // screen mounts immediately at page load, hidden behind the intro video and
  // FaceID login overlay, so the timer must wait for appVisible (stage==='app')
  // instead of starting at mount — otherwise it finishes invisibly in the
  // background and the user never actually sees the collecting animation.
  const [collecting, setCollecting] = useState(true)
  useEffect(() => {
    if (!appVisible) return
    const t = setTimeout(() => setCollecting(false), 2000)
    return () => clearTimeout(t)
  }, [appVisible])
  // the whole readiness gauge is fed by a live bracelet — every reading drifts
  // by a small step on its own cadence instead of sitting frozen on one number
  const [bio, setBio] = useState({ pct: 83, bpm: 62, hydration: 92, focus: 81, stress: 'Low' })
  useEffect(() => {
    const step = (v, min, max) => Math.max(min, Math.min(max, v + (Math.random() < 0.5 ? -1 : 1)))
    const id = setInterval(() => {
      setBio((b) => {
        const focus = step(b.focus, 72, 88)
        return {
          pct: step(b.pct, 78, 90),
          bpm: step(b.bpm, 56, 74),
          hydration: step(b.hydration, 85, 96),
          focus,
          stress: focus > 85 ? 'Elevated' : 'Low',
        }
      })
    }, 2200)
    return () => clearInterval(id)
  }, [])
  const bioStatus = bio.pct >= 85 ? 'Stable' : bio.pct >= 80 ? 'Nominal' : 'Monitor'
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
      <div className="sh-avatar" onClick={onOpenCoach}>SH</div>

      {/* everything except the logo/nav/avatar slides fully off-frame to the left when a
          track point is selected, so only the track and its close-up data show */}
      <div className={'dash-left-col' + (sel != null ? ' dash-left-col--hidden' : '')}>
        <h1 className="dash-hi">Good morning Steve!</h1>
        <div className="dash-sub">Here's your dashboard for today</div>

        <div className="drv-section-title">Driver Status</div>

        {/* driver ID card (Figma 1844:280) */}
        <div className="drv2-card">
          <div className="drv2-name">Charles Leclerc</div>
          <img className="drv2-flag" src={`${A}/drv-flag.png`} alt="Monaco" />
          <div className="drv2-team">Monaco | Ferrari |</div>
          <div className="drv2-num">16</div>
          <div className="drv2-stats">
            <p>Age | 27</p>
            <p>Weight | 68kg</p>
            <p>Height | 1.80m</p>
          </div>

          <div className="drv2-gauge">
            <div className="drv2-ring">
              <div
                className={'drv2-ring-progress' + (collecting ? ' drv2-ring-progress--collecting' : '')}
                style={{ '--pct': collecting ? 0 : bio.pct }}
              />
              <div className="drv2-stable">{collecting ? 'Collecting' : bioStatus}</div>
              <div className="drv2-pct">{collecting ? '—' : `${bio.pct} %`}</div>
            </div>
            <div className="drv2-stats-grid">
              <div className="drv2-stat">
                <span className="drv2-stat__lbl">BPM</span>
                <span className="drv2-stat__val">{collecting ? '—' : bio.bpm}</span>
              </div>
              <div className="drv2-stat">
                <span className="drv2-stat__lbl">Hydration</span>
                <span className="drv2-stat__val">{collecting ? '—' : `${bio.hydration}%`}</span>
              </div>
              <div className="drv2-stat">
                <span className="drv2-stat__lbl">Focus</span>
                <span className="drv2-stat__val">{collecting ? '—' : `${bio.focus}%`}</span>
              </div>
              <div className="drv2-stat">
                <span className="drv2-stat__lbl">Stress</span>
                <span className={'drv2-stat__val' + (!collecting && bio.stress === 'Low' ? ' drv2-stat__val--good' : '')}>
                  {collecting ? '—' : bio.stress}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="next-race-title">Next race</div>

        {/* next race card (Figma 1848:1276) */}
        <div className="race-card">
          <div className="race-track">SPA - FRANCORCHAMPS</div>
          <div className="race-date">Belgium 17-19 Jul</div>
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
            <div className="focus-panel__lbl">Why it's challenging</div>
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
  // starts at the system time (9:04) and creeps forward in real time, so the
  // line visibly moves rather than sitting frozen on one spot
  const [nowTime, setNowTime] = useState(9 + 4 / 60)
  useEffect(() => {
    const id = setInterval(() => setNowTime((t) => t + 1 / 3600), 1000)
    return () => clearInterval(id)
  }, [])
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

  const nextId = useRef(0)
  const withId = (list) => list.map((s) => (s.id != null ? s : { ...s, id: nextId.current++ }))

  const [sessions, setSessions] = useState(() => normalize(withId(DEFAULT_SESSIONS)))
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null) // session/slot being changed or filled, or null when adding fresh
  const [actionId, setActionId] = useState(null) // card whose Change/Delete menu is open

  // long-press-and-drag reorder: hold a card ~450ms without moving to pick it
  // up, then drag it to a new time slot. A plain tap still opens the
  // Change/Delete menu — the timer + move threshold is what tells them apart.
  // Drag bookkeeping lives in a ref (not state) because the window listeners
  // are attached once per pointerdown and would otherwise close over stale
  // state from that render.
  const [dragId, setDragId] = useState(null)
  const [dragTop, setDragTop] = useState(0)
  const dragRef = useRef({ id: null, sessionId: null, startY: 0, startTop: 0, top: 0, moved: false, timer: null })
  const suppressClickRef = useRef(false)

  const onCardPointerMove = (e) => {
    const d = dragRef.current
    const dy = e.clientY - d.startY
    if (d.id == null && !d.moved && Math.abs(dy) > 6) {
      d.moved = true
      clearTimeout(d.timer) // real scroll/tap-drift, not a long-press — bail
    }
    if (d.id != null) {
      const trackH = top(hours[hours.length - 1] + 1)
      const s = sessions.find((x) => x.id === d.id)
      const h = s?.height ?? 109
      d.top = Math.max(OV_PAD, Math.min(trackH - h, d.startTop + dy))
      setDragTop(d.top)
    }
  }
  const onCardPointerUp = () => {
    window.removeEventListener('pointermove', onCardPointerMove)
    window.removeEventListener('pointerup', onCardPointerUp)
    const d = dragRef.current
    clearTimeout(d.timer)
    if (d.id != null) {
      suppressClickRef.current = true
      const newStartH = Math.max(8, 8 + (d.top - OV_PAD) / OV_HH)
      const snapped = Math.round(newStartH * 2) / 2 // snap to the nearest 30 min
      const hh = Math.floor(snapped)
      const mm = +((snapped - hh) * 60).toFixed(2)
      const draggedId = d.id
      setSessions((prev) =>
        normalize(prev.map((s) => (s.id === draggedId ? { ...s, start: `${hh}:${mm}` } : s)))
      )
      setDragId(null)
    } else if (d.moved) {
      suppressClickRef.current = true
    }
    dragRef.current = { id: null, sessionId: null, startY: 0, startTop: 0, top: 0, moved: false, timer: null }
  }
  const onCardPointerDown = (e, s) => {
    if (e.button != null && e.button !== 0) return
    const startTop = top(toH(s.start))
    dragRef.current = { id: null, sessionId: s.id, startY: e.clientY, startTop, top: startTop, moved: false, timer: null }
    dragRef.current.timer = setTimeout(() => {
      const d = dragRef.current
      if (d.moved || d.sessionId !== s.id) return
      d.id = s.id
      setDragId(s.id)
      setDragTop(startTop)
    }, 450)
    window.addEventListener('pointermove', onCardPointerMove)
    window.addEventListener('pointerup', onCardPointerUp)
  }
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

  const openAddForm = () => {
    setEditingId(null)
    setForm({ typeValue: SCHEDULE_TYPES[0].value, location: SCHEDULE_TYPES[0].location, hour: 8, minute: 0 })
    setAdding(true)
  }

  const openEditForm = (s) => {
    const opt = SCHEDULE_TYPES.find((t) => t.icon === s.type && t.label === s.title) || SCHEDULE_TYPES[0]
    const [hh, mm] = s.start.split(':').map(Number)
    setEditingId(s.id)
    setForm({ typeValue: opt.value, location: s.location, hour: hh, minute: mm >= 30 ? 30 : 0 })
    setAdding(true)
    setActionId(null)
  }

  const submitAdd = (e) => {
    e.preventDefault()
    const opt = SCHEDULE_TYPES.find((t) => t.value === form.typeValue)
    if (!opt) return
    const start = `${form.hour}:${String(form.minute).padStart(2, '0')}`
    setSessions((prev) => {
      const next =
        editingId != null
          ? prev.map((s) =>
              s.id === editingId
                ? { id: s.id, start, title: opt.label, type: opt.icon, location: form.location }
                : s
            )
          : [...prev, { id: nextId.current++, start, title: opt.label, type: opt.icon, location: form.location }]
      return normalize(next)
    })
    setAdding(false)
    setEditingId(null)
  }

  const deleteSession = (id) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { id: s.id, start: s.start, height: s.height, empty: true } : s))
    )
    setActionId(null)
  }

  // removes an empty slot entirely and pulls everything after it up to close the gap
  const collapseSlot = (id) => {
    setSessions((prev) => {
      const slot = prev.find((s) => s.id === id)
      if (!slot) return prev
      const gapHours = (slot.height + 5) / OV_HH
      const slotStart = toH(slot.start)
      const rest = prev
        .filter((s) => s.id !== id)
        .map((s) => {
          if (toH(s.start) <= slotStart) return s
          const t = toH(s.start) - gapHours
          const hh = Math.floor(t)
          const mm = +((t - hh) * 60).toFixed(2)
          return { ...s, start: `${hh}:${mm}` }
        })
      return normalize(rest)
    })
  }

  return (
    <div className="ov-inner-wrap">
      <div className="ov-head">
        <button className="ov-close" onClick={onClose}>×</button>
        <div className="ov-title">Daily Schedule</div>
        <div className="ov-goals">Goals&nbsp;&nbsp;0/3</div>
        <button className="ov-add" onClick={openAddForm}>+</button>
      </div>

      {adding && (
        <div className="ov-add-backdrop" onClick={() => { setAdding(false); setEditingId(null) }}>
          <form className="ov-add-form" onClick={(e) => e.stopPropagation()} onSubmit={submitAdd}>
            <div className="ov-add-title">{editingId != null ? 'Change schedule item' : 'New schedule item'}</div>

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

            {editingId == null && (
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
            )}

            <div className="ov-add-actions">
              <button type="button" className="ov-add-cancel" onClick={() => { setAdding(false); setEditingId(null) }}>Cancel</button>
              <button type="submit" className="ov-add-submit">{editingId != null ? 'Save' : 'Add'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="ov-scroll">
        <div className="ov-track" style={{ height: top(hours[hours.length - 1] + 1) }}>
          <div className="ov-rail" />
          <div className="ov-now" style={{ top: top(nowTime) - 7 }}>
            <div className="ov-now__dot" />
          </div>
          {hours.map((h) => (
            <div key={h} className="ov-time" style={{ top: top(h) - 7 }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
          {hours.map((h) => (
            <div key={'half' + h} className="ov-half-tick" style={{ top: top(h + 0.5) }} />
          ))}

          {sessions.map((s, i) => {
            if (s.empty) {
              return (
                <div key={s.id} className="ov-card ov-card--empty" style={{ top: top(starts[i]), height: s.height }}>
                  <button
                    type="button"
                    className="ov-empty-add"
                    onClick={() => openEditForm({ ...s, type: SCHEDULE_TYPES[0].icon, title: SCHEDULE_TYPES[0].label, location: SCHEDULE_TYPES[0].location })}
                  >
                    + Add here
                  </button>
                  <button type="button" className="ov-empty-collapse" onClick={() => collapseSlot(s.id)}>
                    Remove space ↑
                  </button>
                </div>
              )
            }
            const [src, size] = ICONS[s.type]
            const dragging = dragId === s.id
            return (
              <div
                key={s.id}
                className={'ov-card' + (s.light ? ' ov-card--light' : '') + (dragging ? ' ov-card--dragging' : '')}
                style={{ top: dragging ? dragTop : top(starts[i]), height: s.height }}
                onPointerDown={(e) => onCardPointerDown(e, s)}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false
                    return
                  }
                  setActionId(s.id)
                }}
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

      {actionId != null && (
        <div className="ov-add-backdrop" onClick={() => setActionId(null)}>
          <div className="ov-action-menu" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ov-action-btn"
              onClick={() => openEditForm(sessions.find((s) => s.id === actionId))}
            >
              Change
            </button>
            <button
              type="button"
              className="ov-action-btn ov-action-btn--danger"
              onClick={() => deleteSession(actionId)}
            >
              Delete
            </button>
            <button type="button" className="ov-action-btn ov-action-btn--cancel" onClick={() => setActionId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
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
  const [coachOpen, setCoachOpen] = useState(false)
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
      const vv = window.visualViewport
      const w = vv ? vv.width : window.innerWidth
      const h = vv ? vv.height : window.innerHeight
      const s = Math.min(w / 1300, h / 834)
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
          <TrainingScreen onNav={setScreen} onOpenCoach={() => setCoachOpen(true)} />
        ) : (
          <DashboardScreen onNav={setScreen} onOpenCoach={() => setCoachOpen(true)} appVisible={stage === 'app'} />
        )}

        {/* right-edge slide-in schedule overlay (available on every screen) */}
        <div className="ov-edge" onPointerDown={beginOpen} />
        {(() => {
          const px = ovX != null ? ovX : ovOpen ? 0 : PANEL_W
          return (
            <>
              {/* no backdrop pointer-capture here on purpose — the track behind the
                  panel needs to stay draggable while the schedule is open; closing
                  is via the × button instead of a click-outside-to-close overlay */}
              <div className="ov-backdrop" style={{ pointerEvents: 'none' }} />
              <div
                className="ov-panel-wrap"
                style={{
                  transform: `translateX(${px}px)`,
                  transition: ovX != null ? 'none' : 'transform .3s cubic-bezier(.4, 0, .2, 1)',
                }}
              >
                {/* stuck to the panel's own edge — slides in/out together with it,
                    rather than staying pinned to the static screen edge. Also a drag
                    handle itself: grab it and drag right to close, same as the panel. */}
                <span
                  className="ov-edge__hint"
                  onPointerDown={(e) => (ovOpenRef.current ? beginClose(e) : beginOpen(e))}
                >
                  ‹
                </span>
                <div className="ov-panel" onPointerDown={beginClose}>
                  <ScheduleOverlay onClose={() => setOvOpen(false)} />
                </div>
              </div>
            </>
          )
        })()}

        {/* Gmail-style account popup — compact dropdown anchored under the avatar */}
        <div
          className="coach-backdrop"
          style={{ pointerEvents: coachOpen ? 'auto' : 'none', opacity: coachOpen ? 1 : 0 }}
          onClick={() => setCoachOpen(false)}
        />
        <div className={'coach-panel' + (coachOpen ? ' coach-panel--open' : '')}>
          <div className="coach-avatar">SC</div>
          <div className="coach-name">Steve Carter</div>
          <div className="coach-email">s.carter@scuderiaferrari.com</div>
          <div className="coach-role">Head Performance Coach · Scuderia Ferrari</div>

          <div className="coach-divider" />

          <div className="coach-sec-title">Today's focus</div>
          <div className="coach-focus-row">
            <span className="coach-focus-tag">Increase neck stability</span>
            <span className="coach-focus-tag">Focus under pressure</span>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
