import { Suspense, useMemo, useRef, useEffect } from 'react'
import { Canvas, useLoader, useFrame, useThree } from '@react-three/fiber'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { useTexture, Environment, Lightformer, OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'

const M = import.meta.env.BASE_URL + 'models'
// six manually-selected anchors, one per challenge location, given as fixed
// LOCAL coordinates in the track group's own space (i.e. before the group's
// [-0.15,0,0] rotation is applied). Each was found by inspecting the actual
// mesh — sampling real vertices and confirming, via rendered screenshots,
// that the point sits on the visible top edge of the ribbon — then reading
// off that point's coordinates once and hardcoding them here. Because these
// are real, static 3D points (not screen positions or a runtime raycast),
// rendering them as children of the same rotated group means they inherit
// its rotation/scale automatically and reproject correctly under any zoom,
// pan, or viewport size — nothing here depends on camera/canvas dimensions.
const MARKER_ANCHORS = [
  { id: 1, position: [-0.86466, 0.271292, -0.182173] }, // left diagonal segment
  { id: 2, position: [-0.075962, 0.176591, -1.625032] }, // top straight
  { id: 3, position: [1.485788, 0.018381, -1.659673] }, // top-right hairpin entry
  { id: 4, position: [0.928004, 0.164512, -0.844432] }, // mid connector below the hairpin
  { id: 5, position: [0.644997, 0.280013, 0.360728] }, // lower chicane
  { id: 6, position: [1.59952, -0.088357, 0.507678] }, // bottom-right end cap
]
// the same six anchors, pre-rotated into world space (forward-applying the
// group's fixed rotation), so CameraRig — which moves the actual camera in
// world space — can target them directly without needing a live group ref.
const GROUP_ROTATION_X = -0.15
const MARKERS_WORLD = MARKER_ANCHORS.map(({ id, position: [x, y, z] }) => {
  const cos = Math.cos(GROUP_ROTATION_X)
  const sin = Math.sin(GROUP_ROTATION_X)
  return { n: id, pos: [x, y * cos - z * sin, y * sin + z * cos] }
})
const DEFAULT_CAM_POS = new THREE.Vector3(0.3, 4.8, 6.45)
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0)
const TRANSITION_MS = 1500

// eases the camera into a close-up on the selected marker (or back out to the
// default framing) over a fixed, short transition, then lets go completely —
// after that OrbitControls owns the camera outright, so the user can freely
// spin/drag the track at any time without the rig fighting their input
function CameraRig({ selected, markers, controlsRef }) {
  const { camera } = useThree()
  const anim = useRef(null)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const marker = selected != null ? markers.find((m) => m.n === selected) : null
    let toPos, toTarget
    if (marker) {
      toTarget = new THREE.Vector3(...marker.pos)
      const dir = toTarget.clone().sub(DEFAULT_TARGET)
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1)
      dir.normalize()
      toPos = toTarget.clone().add(dir.multiplyScalar(2.4)).add(new THREE.Vector3(0, 1.1, 0))
    } else {
      toPos = DEFAULT_CAM_POS.clone()
      toTarget = DEFAULT_TARGET.clone()
    }
    anim.current = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos,
      toTarget,
      start: performance.now(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, markers])

  useFrame(() => {
    const controls = controlsRef.current
    const a = anim.current
    if (!controls || !a) return
    const t = Math.min(1, (performance.now() - a.start) / TRANSITION_MS)
    const e = 1 - Math.pow(1 - t, 3) // ease-out cubic
    camera.position.lerpVectors(a.fromPos, a.toPos, e)
    controls.target.lerpVectors(a.fromTarget, a.toTarget, e)
    controls.update()
    if (t >= 1) anim.current = null // transition done — hand full control back to OrbitControls
  })
  return null
}

function TrackModel({ mode, selected, onSelectPoint }) {
  const fbx = useLoader(FBXLoader, `${M}/track.fbx`)
  const [baseMap, metalMap, roughMap, normalMap, emisMap] = useTexture([
    `${M}/track_basecolor.png`,
    `${M}/track_metallic.png`,
    `${M}/track_roughness.png`,
    `${M}/track_normal.png`,
    `${M}/track_emission.png`,
  ])
  const groupRef = useRef()

  const model = useMemo(() => {
    baseMap.colorSpace = THREE.SRGBColorSpace
    emisMap.colorSpace = THREE.SRGBColorSpace
    ;[baseMap, metalMap, roughMap, normalMap, emisMap].forEach((t) => (t.anisotropy = 8))

    const mat = new THREE.MeshStandardMaterial({
      map: baseMap,
      metalnessMap: metalMap,
      roughnessMap: roughMap,
      normalMap: normalMap,
      emissiveMap: emisMap,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.5,
      metalness: 1,
      roughness: 0.92,
      envMapIntensity: 1.85,
    })

    const obj = fbx.clone(true)
    obj.traverse((c) => {
      if (c.isMesh) {
        c.material = mat
        c.castShadow = c.receiveShadow = false
      }
    })
    const box = new THREE.Box3().setFromObject(obj)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    obj.position.sub(center)
    obj.scale.setScalar(4.5 / Math.max(size.x, size.y, size.z))
    return obj
  }, [fbx, baseMap, metalMap, roughMap, normalMap, emisMap])

  return (
    <group ref={groupRef} rotation={[-0.15, 0, 0]}>
      <primitive object={model} />
      {mode === 'focus' &&
        MARKER_ANCHORS.map((m) => (
          <Html key={m.id} position={m.position} occlude={false} zIndexRange={[100, 90]}>
            <div className="focus-pt-wrap">
              <button
                className={'focus-pt' + (selected === m.id ? ' focus-pt--active' : '')}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectPoint(m.id)
                }}
              >
                <span className="focus-pt__label">{m.id}</span>
              </button>
            </div>
          </Html>
        ))}
    </group>
  )
}

export default function Track3D({ mode = 'default', selected = null, onSelectPoint = () => {} }) {
  const controlsRef = useRef()

  return (
    <div className="track-3d">
      <Canvas
        camera={{ position: [0.3, 4.8, 6.45], fov: 34 }}
        gl={{ alpha: true, antialias: true, toneMappingExposure: 1.25 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[6, 9, 6]} intensity={1.8} />
        <directionalLight position={[-6, 3, -4]} intensity={0.8} />
        <Suspense fallback={null}>
          <TrackModel mode={mode} selected={selected} onSelectPoint={onSelectPoint} />
          <Environment resolution={256}>
            <Lightformer intensity={2.4} position={[0, 6, -6]} scale={[12, 12, 1]} />
            <Lightformer intensity={1.1} position={[-6, 2, 2]} scale={[10, 3, 1]} />
            <Lightformer intensity={1.1} position={[6, 2, 2]} scale={[10, 3, 1]} />
            <Lightformer intensity={0.8} position={[0, -4, 3]} scale={[10, 4, 1]} />
          </Environment>
        </Suspense>
        <CameraRig selected={selected} markers={MARKERS_WORLD} controlsRef={controlsRef} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.9}
          autoRotate={selected == null}
          autoRotateSpeed={0.25}
          minDistance={2.4}
          maxDistance={16}
        />
      </Canvas>
    </div>
  )
}
