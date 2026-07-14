import { useEffect, useState } from 'react'

const A = import.meta.env.BASE_URL + 'assets'
const NAME = 'Steve Carter'

/* simulated Face ID unlock — no real biometrics, just the iPad-style choreography */
export default function FaceIDLogin({ onDone }) {
  const [phase, setPhase] = useState('scan') // 'scan' | 'ok'
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('ok'), 1450)
    const t2 = setTimeout(() => setFading(true), 2050)
    const t3 = setTimeout(onDone, 2650)
    return () => [t1, t2, t3].forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={'faceid' + (fading ? ' faceid--out' : '')}>
      <div className="faceid__canvas">
        <img className="logo" src={`${A}/c1logo.svg`} alt="C1" />

        <div className="faceid__center">
          <div className={'faceid__frame' + (phase === 'ok' ? ' faceid__frame--ok' : '')}>
            <svg viewBox="0 0 120 120" className="faceid__brackets">
              <path d="M10 34 V20 Q10 10 20 10 H34" />
              <path d="M86 10 H100 Q110 10 110 20 V34" />
              <path d="M110 86 V100 Q110 110 100 110 H86" />
              <path d="M34 110 H20 Q10 110 10 100 V86" />
            </svg>

            {phase === 'scan' && <div className="faceid__scanline" />}

            <svg
              viewBox="0 0 120 120"
              className={'faceid__glyph faceid__glyph--scan' + (phase === 'ok' ? ' faceid__glyph--hide' : '')}
            >
              <circle cx="42" cy="52" r="4.5" />
              <circle cx="78" cy="52" r="4.5" />
              <path d="M40 74 Q60 88 80 74" />
            </svg>

            <svg
              viewBox="0 0 120 120"
              className={'faceid__glyph faceid__glyph--check' + (phase === 'ok' ? ' faceid__glyph--show' : '')}
            >
              <path d="M36 62 L54 78 L86 42" />
            </svg>
          </div>

          <div className="faceid__name">{NAME}</div>
          <div key={phase} className="faceid__status">
            {phase === 'scan' ? `Looking for ${NAME}` : 'Face ID Recognized'}
          </div>
        </div>
      </div>
    </div>
  )
}
