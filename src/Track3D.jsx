import { Suspense, useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react'
import { Canvas, useLoader, useFrame, useThree } from '@react-three/fiber'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { useTexture, Environment, Lightformer, OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'

const M = '/models'
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

function TrackModel({ mode, selected, onSelectPoint, onMarkers }) {
  const fbx = useLoader(FBXLoader, `${M}/track.fbx`)
  const [baseMap, metalMap, roughMap, normalMap, emisMap] = useTexture([
    `${M}/track_basecolor.png`,
    `${M}/track_metallic.png`,
    `${M}/track_roughness.png`,
    `${M}/track_normal.png`,
    `${M}/track_emission.png`,
  ])
  const groupRef = useRef()
  const [markers, setMarkers] = useState([])

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

  // compute marker points near the outer edge of the circuit (dangerous corners),
  // spread around the loop, offset slightly outward so they sit *near* the curve.
  useLayoutEffect(() => {
    const g = groupRef.current
    if (!g) return
    g.updateWorldMatrix(true, true)
    const pts = []
    const v = new THREE.Vector3()
    g.traverse((c) => {
      const pos = c.isMesh && c.geometry?.attributes?.position
      if (!pos) return
      const step = Math.max(1, Math.floor(pos.count / 1400))
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(c.matrixWorld)
        pts.push(v.clone())
      }
    })
    if (!pts.length) return
    const c0 = new THREE.Vector3()
    pts.forEach((p) => c0.add(p))
    c0.divideScalar(pts.length)
    const bb = new THREE.Box3()
    pts.forEach((p) => bb.expandByPoint(p))
    const sz = bb.getSize(new THREE.Vector3())
    const thin = sz.x <= sz.y && sz.x <= sz.z ? 'x' : sz.y <= sz.z ? 'y' : 'z'
    const [a0, a1] = ['x', 'y', 'z'].filter((a) => a !== thin)

    // the track mesh has real thickness (a wall/barrier cross-section), so picking
    // purely the outermost point per bucket can land on its side face instead of
    // the top — bias selection toward the top of the local cross-section too, so
    // the marker's anchor (and its dot) actually sits on the visible top surface
    let thinMin = Infinity
    let thinMax = -Infinity
    let maxD = 0
    pts.forEach((p) => {
      if (p[thin] < thinMin) thinMin = p[thin]
      if (p[thin] > thinMax) thinMax = p[thin]
      const d = Math.hypot(p[a0] - c0[a0], p[a1] - c0[a1])
      if (d > maxD) maxD = d
    })
    const thinRange = Math.max(1e-6, thinMax - thinMin)
    const heightWeight = maxD * 0.6

    const N = 6
    const buckets = new Array(N).fill(null)
    pts.forEach((p) => {
      const ang = Math.atan2(p[a1] - c0[a1], p[a0] - c0[a0])
      const idx = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * N) % N
      const d = Math.hypot(p[a0] - c0[a0], p[a1] - c0[a1])
      const heightNorm = (p[thin] - thinMin) / thinRange // 0 (bottom) .. 1 (top)
      const score = d + heightNorm * heightWeight
      if (!buckets[idx] || score > buckets[idx].score) buckets[idx] = { p: p.clone(), score }
    })
    const found = buckets
      .filter(Boolean)
      .map((b) => {
        // sit right on the track edge — nudge outward from the track's own center in
        // the ground plane (not a fixed world axis), plus a small lift along the thin
        // axis, so the dot hugs the surface from every angle instead of only the one
        // the fixed +Z nudge used to face
        const m = b.p.clone()
        const dx = m[a0] - c0[a0]
        const dy = m[a1] - c0[a1]
        const len = Math.hypot(dx, dy) || 1
        m[a0] += (dx / len) * 0.08
        m[a1] += (dy / len) * 0.08
        m[thin] += 0.04
        return [m.x, m.y, m.z]
      })
    // some neighboring buckets (1&6 across the angle wrap-around, 4&5 next to
    // each other) can end up very close together — nudge each pair apart along
    // the line between them. Kept small: too big a push moves a point clean off
    // the track surface since the mesh cross-section is thin.
    const pushApart = (i, j, push) => {
      if (found.length <= Math.max(i, j)) return
      const a = new THREE.Vector3(...found[i])
      const b = new THREE.Vector3(...found[j])
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const dir = a.clone().sub(b)
      if (dir.lengthSq() < 1e-6) return
      dir.normalize()
      const newA = mid.clone().add(dir.clone().multiplyScalar(push))
      const newB = mid.clone().sub(dir.clone().multiplyScalar(push))
      found[i] = [newA.x, newA.y, newA.z]
      found[j] = [newB.x, newB.y, newB.z]
    }
    pushApart(0, 5, 0.15) // markers 1 & 6
    pushApart(3, 4, 0.15) // markers 4 & 5
    const next = found.map((pos, i) => ({ pos, n: i + 1 }))
    setMarkers(next)
    onMarkers?.(next)
  }, [model])

  return (
    <>
      <group ref={groupRef} rotation={[-0.15, 0, 0]}>
        <primitive object={model} />
      </group>
      {mode === 'focus' &&
        markers.map((m) => (
          <Html key={m.n} position={m.pos} occlude={false} zIndexRange={[100, 90]}>
            <div className="focus-pt-wrap">
              <span className="focus-pt__dot" />
              <button
                className={'focus-pt' + (selected === m.n ? ' focus-pt--active' : '')}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectPoint(m.n)
                }}
              >
                <span className="focus-pt__label">{m.n}</span>
                <span className="focus-pt__stem" />
              </button>
            </div>
          </Html>
        ))}
    </>
  )
}

export default function Track3D({ mode = 'default', selected = null, onSelectPoint = () => {} }) {
  const controlsRef = useRef()
  const [markers, setMarkers] = useState([])

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
          <TrackModel mode={mode} selected={selected} onSelectPoint={onSelectPoint} onMarkers={setMarkers} />
          <Environment resolution={256}>
            <Lightformer intensity={2.4} position={[0, 6, -6]} scale={[12, 12, 1]} />
            <Lightformer intensity={1.1} position={[-6, 2, 2]} scale={[10, 3, 1]} />
            <Lightformer intensity={1.1} position={[6, 2, 2]} scale={[10, 3, 1]} />
            <Lightformer intensity={0.8} position={[0, -4, 3]} scale={[10, 4, 1]} />
          </Environment>
        </Suspense>
        <CameraRig selected={selected} markers={markers} controlsRef={controlsRef} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.9}
          autoRotate={selected == null}
          autoRotateSpeed={0.25}
          minDistance={2}
          maxDistance={16}
        />
      </Canvas>
    </div>
  )
}
