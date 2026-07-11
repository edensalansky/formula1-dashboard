import { useState } from 'react'

const A = '/assets'

export default function LoadingScreen({ onDone }) {
  const [fading, setFading] = useState(false)

  const handleEnded = () => {
    setFading(true)
    setTimeout(onDone, 450)
  }

  return (
    <div className={'intro' + (fading ? ' intro--out' : '')}>
      <video
        className="intro__video"
        src={`${A}/logo-animate.mp4`}
        autoPlay
        muted
        playsInline
        onEnded={handleEnded}
      />
    </div>
  )
}
