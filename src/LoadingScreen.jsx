const A = import.meta.env.BASE_URL + 'assets'

export default function LoadingScreen({ onDone }) {
  return (
    <div className="intro">
      <video
        className="intro__video"
        src={`${A}/logo-animate.mp4`}
        autoPlay
        muted
        playsInline
        onEnded={onDone}
      />
    </div>
  )
}
