import { Suspense, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { useTexture, Environment, Lightformer, OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'

const M = '/models'

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

    const N = 6
    const buckets = new Array(N).fill(null)
    pts.forEach((p) => {
      const ang = Math.atan2(p[a1] - c0[a1], p[a0] - c0[a0])
      const idx = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * N) % N
      const d = Math.hypot(p[a0] - c0[a0], p[a1] - c0[a1])
      if (!buckets[idx] || d > buckets[idx].d) buckets[idx] = { p: p.clone(), d }
    })
    const found = buckets
      .filter(Boolean)
      .map((b) => {
        // sit right on the track edge, nudged a touch toward the viewer so it reads on the surface
        const m = b.p.clone()
        m.z += 0.12
        return [m.x, m.y, m.z]
      })
    setMarkers(found.map((pos, i) => ({ pos, n: i + 1 })))
  }, [model])

  return (
    <>
      <group ref={groupRef} rotation={[-0.15, 0, 0]}>
        <primitive object={model} />
      </group>
      {mode === 'focus' &&
        markers.map((m) => (
          <Html key={m.n} position={m.pos} zIndexRange={[20, 0]}>
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
  return (
    <div className="track-3d">
      <Canvas
        camera={{ position: [0.4, 6.4, 8.6], fov: 34 }}
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
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.9}
          autoRotate
          autoRotateSpeed={0.6}
          minDistance={4}
          maxDistance={16}
        />
      </Canvas>
    </div>
  )
}
