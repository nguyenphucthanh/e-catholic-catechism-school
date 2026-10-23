import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { cn } from '~/lib/utils'

export type SceneTimeOfDay = 'day' | 'sunset' | 'night'
export type SceneCameraPreset = 'overview' | 'front' | 'towers' | 'grotto'

export interface TimePresetConfig {
  topColor: number
  horizonColor: number
  bottomColor: number
  fogColor: number
  sunColor: number
  sunIntensity: number
  sunPos: [number, number, number]
  hemiSky: number
  hemiGround: number
  hemiIntensity: number
  windowEmissive: number
  lanternIntensity: number
}

export const TIME_PRESETS: Record<SceneTimeOfDay, TimePresetConfig> = {
  day: {
    topColor: 0x3b9eff,
    horizonColor: 0xd9f2ff,
    bottomColor: 0x9bd688,
    fogColor: 0xbbe2ff,
    sunColor: 0xfff6e0,
    sunIntensity: 2.2,
    sunPos: [32, 42, 26],
    hemiSky: 0xdff4ff,
    hemiGround: 0x689f38,
    hemiIntensity: 0.85,
    windowEmissive: 0.4,
    lanternIntensity: 0.3,
  },
  sunset: {
    topColor: 0x3b2d6e,
    horizonColor: 0xff8a65,
    bottomColor: 0xffcc80,
    fogColor: 0xffab91,
    sunColor: 0xff9e40,
    sunIntensity: 2.0,
    sunPos: [-38, 16, -24],
    hemiSky: 0xffab91,
    hemiGround: 0x4e342e,
    hemiIntensity: 0.7,
    windowEmissive: 1.35,
    lanternIntensity: 1.8,
  },
  night: {
    topColor: 0x09122c,
    horizonColor: 0x1e2952,
    bottomColor: 0x0f172a,
    fogColor: 0x131c38,
    sunColor: 0x90caf9,
    sunIntensity: 0.55,
    sunPos: [-24, 38, -20],
    hemiSky: 0x1e293b,
    hemiGround: 0x0f172a,
    hemiIntensity: 0.4,
    windowEmissive: 2.4,
    lanternIntensity: 3.2,
  },
}

export const CAMERA_PRESETS: Record<
  SceneCameraPreset,
  { pos: [number, number, number]; look: [number, number, number] }
> = {
  overview: { pos: [21, 1.4, 34], look: [0, 10.5, 2] },
  front: { pos: [0, 1.5, 29], look: [0, 9.8, 3] },
  towers: { pos: [14, 17.5, 21], look: [0, 14.5, 4.5] },
  grotto: { pos: [-17.5, 3.8, 10.5], look: [-11.5, 1.8, 3.0] },
}

export interface ResponsiveCameraConfig {
  fov: number
  pos: [number, number, number]
  look: [number, number, number]
  useDesktopOffset: boolean
  mobileYOffsetRatio?: number
}

export function getResponsiveCameraConfig(
  width: number,
  height: number,
): ResponsiveCameraConfig {
  const aspect = width / Math.max(height, 1)
  if (width >= 1024) {
    return {
      fov: 45,
      pos: CAMERA_PRESETS.overview.pos,
      look: CAMERA_PRESETS.overview.look,
      useDesktopOffset: true,
      mobileYOffsetRatio: 0,
    }
  }
  if (width >= 640) {
    return {
      fov: 52,
      pos: [25, 2.4, 41],
      look: [0, 13.5, 1],
      useDesktopOffset: false,
      mobileYOffsetRatio: -0.16,
    }
  }
  // Mobile (< 640px): zoom out further and pan camera up so objects sit at the bottom of the scene
  const portraitScale = aspect < 0.65 ? 1.12 : 1.0
  return {
    fov: 58,
    pos: [
      Math.round(28 * portraitScale * 10) / 10,
      3.2,
      Math.round(47 * portraitScale * 10) / 10,
    ],
    look: [0, 15.5, 0],
    useDesktopOffset: false,
    mobileYOffsetRatio: -0.22,
  }
}

export function getTerrainHeight(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z)
  const plateau = Math.min(1, Math.max(0, (dist - 11) / 18))
  const gentleWaves =
    (Math.sin(x * 0.11) * Math.cos(z * 0.11) * 1.15 +
      Math.sin(x * 0.23 + z * 0.17) * 0.4) *
    plateau

  const streamCenterX = 14 + Math.sin(z * 0.12) * 3.5
  const distToStream = Math.abs(x - streamCenterX)
  let streamCut = 0
  if (distToStream < 2.8) {
    streamCut = -1.15 * Math.cos((distToStream / 2.8) * (Math.PI / 2))
  }

  let edgeDrop = 0
  if (dist > 34) {
    edgeDrop = -Math.pow((dist - 34) * 0.35, 1.6)
  }
  return gentleWaves + streamCut + edgeDrop
}

export function playCathedralBellChime(): void {
  if (typeof window === 'undefined') return
  try {
    const win = window as unknown as {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    const AudioCtx = win.AudioContext ?? win.webkitAudioContext
    if (!AudioCtx) return
    const audioCtx = new AudioCtx()
    const now = audioCtx.currentTime
    const freqs = [523.25, 659.25, 783.99, 1046.5]
    freqs.forEach((f, idx) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = idx === 0 ? 'sine' : 'triangle'
      osc.frequency.setValueAtTime(f, now)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.16 / (idx + 1), now + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0 - idx * 0.4)

      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(now)
      osc.stop(now + 3.1)
    })
  } catch {
    // Ignore audio context restriction errors
  }
}

function createMarseilleBrickTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#e5d4c0'
  ctx.fillRect(0, 0, 256, 256)

  const rows = 16
  const cols = 8
  const brickH = 256 / rows
  const brickW = 256 / cols
  const shades = ['#c85a3a', '#bf5233', '#d16343', '#b84c2e', '#cc5d3d']

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (brickW * 0.5)
    for (let c = -1; c <= cols; c++) {
      ctx.fillStyle = shades[(r * 3 + c + 10) % shades.length]
      ctx.fillRect(
        c * brickW + offset + 1.5,
        r * brickH + 1.5,
        brickW - 3,
        brickH - 3,
      )
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 3)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export interface BuiltCathedralScene {
  scene: THREE.Scene
  applyTimeOfDay: (mode: SceneTimeOfDay) => void
  stepAnimation: (elapsedTime: number) => void
  triggerBellRing: () => void
}

export function buildSaigonNotreDameScene(): BuiltCathedralScene {
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0xbbe2ff, 0.0085)

  // Sky Dome
  const skyGeo = new THREE.SphereGeometry(180, 32, 32)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x3b9eff) },
      horizonColor: { value: new THREE.Color(0xd9f2ff) },
      bottomColor: { value: new THREE.Color(0x9bd688) },
      offset: { value: 12.0 },
      exponent: { value: 0.65 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        vec3 col = mix(horizonColor, topColor, max(pow(max(h, 0.0), exponent), 0.0));
        if (h < 0.0) {
          col = mix(horizonColor, bottomColor, min(-h * 3.0, 1.0));
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
  scene.add(new THREE.Mesh(skyGeo, skyMat))

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0xdff4ff, 0x689f38, 0.85)
  hemiLight.position.set(0, 50, 0)
  scene.add(hemiLight)

  const sunLight = new THREE.DirectionalLight(0xfff6e0, 2.2)
  sunLight.position.set(32, 42, 26)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.width = 2048
  sunLight.shadow.mapSize.height = 2048
  sunLight.shadow.camera.near = 10
  sunLight.shadow.camera.far = 95
  const d = 32
  sunLight.shadow.camera.left = -d
  sunLight.shadow.camera.right = d
  sunLight.shadow.camera.top = d
  sunLight.shadow.camera.bottom = -d
  sunLight.shadow.bias = -0.00006
  sunLight.shadow.normalBias = 0.02
  scene.add(sunLight)

  const sunOrbMat = new THREE.MeshBasicMaterial({ color: 0xfff8b8 })
  const sunOrb = new THREE.Mesh(
    new THREE.SphereGeometry(4.5, 20, 20),
    sunOrbMat,
  )
  sunOrb.position.copy(sunLight.position).multiplyScalar(2.2)
  scene.add(sunOrb)

  // Shared Materials
  const marseilleBrickTex = createMarseilleBrickTexture()
  const mats = {
    redBrick: new THREE.MeshStandardMaterial({
      map: marseilleBrickTex,
      color: marseilleBrickTex ? 0xf7e6df : 0xc85a3a,
      roughness: 0.86,
    }),
    creamWall: new THREE.MeshStandardMaterial({
      color: 0xf6efe2,
      roughness: 0.82,
    }),
    warmStone: new THREE.MeshStandardMaterial({
      color: 0xebe0ce,
      roughness: 0.88,
    }),
    darkStone: new THREE.MeshStandardMaterial({
      color: 0x948b7f,
      roughness: 0.92,
    }),
    roofTile: new THREE.MeshStandardMaterial({
      color: 0xb9462c,
      roughness: 0.72,
    }),
    spireRoof: new THREE.MeshStandardMaterial({
      color: 0xf2ead9,
      roughness: 0.75,
      metalness: 0.05,
    }),
    louverSlate: new THREE.MeshStandardMaterial({
      color: 0x353f49,
      roughness: 0.7,
    }),
    oakWood: new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      roughness: 0.8,
    }),
    lightWood: new THREE.MeshStandardMaterial({
      color: 0x9c6b43,
      roughness: 0.8,
    }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xffcf40,
      metalness: 0.65,
      roughness: 0.25,
      emissive: 0xffaa00,
      emissiveIntensity: 0.25,
    }),
    iron: new THREE.MeshStandardMaterial({
      color: 0x2c3038,
      metalness: 0.6,
      roughness: 0.45,
    }),
    stainedGlass: new THREE.MeshStandardMaterial({
      color: 0xffe49e,
      emissive: 0xffae34,
      emissiveIntensity: 0.45,
      roughness: 0.2,
    }),
    stainedBlue: new THREE.MeshStandardMaterial({
      color: 0x7cc6fe,
      emissive: 0x3b82f6,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    }),
    stainedRose: new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    }),
    statueWhite: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.45,
    }),
    maryBlue: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.6,
    }),
    water: new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.86,
    }),
    cloud: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1.0,
    }),
  }

  function castAndReceive(obj: THREE.Object3D, cast = true, receive = true) {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = cast
        child.receiveShadow = receive
      }
    })
  }

  // Terrain & Meadow
  const terrainGroup = new THREE.Group()
  scene.add(terrainGroup)

  const groundRadius = 40
  const radialRings = 56
  const angularSegs = 84
  const cMeadow1 = new THREE.Color(0x7ccf5b)
  const cMeadow2 = new THREE.Color(0x63b846)
  const cStreamBed = new THREE.Color(0xc2b280)
  const cCliff = new THREE.Color(0x9e7b56)

  const topPositions: Array<number> = []
  const topColors: Array<number> = []
  const topIndices: Array<number> = []

  for (let rIdx = 0; rIdx <= radialRings; rIdx++) {
    const r = (rIdx / radialRings) * groundRadius
    for (let aIdx = 0; aIdx <= angularSegs; aIdx++) {
      const theta = (aIdx / angularSegs) * Math.PI * 2
      const vx = Math.cos(theta) * r
      const vz = Math.sin(theta) * r
      const vy = getTerrainHeight(vx, vz)
      topPositions.push(vx, vy, vz)

      const streamCenterX = 14 + Math.sin(vz * 0.12) * 3.5
      const distToStream = Math.abs(vx - streamCenterX)
      if (distToStream < 2.3) {
        topColors.push(cStreamBed.r, cStreamBed.g, cStreamBed.b)
      } else {
        const mixFactor = (Math.sin(vx * 0.25) + Math.cos(vz * 0.25) + 2) * 0.25
        const col = cMeadow1.clone().lerp(cMeadow2, mixFactor)
        topColors.push(col.r, col.g, col.b)
      }
    }
  }

  const stride = angularSegs + 1
  for (let rIdx = 0; rIdx < radialRings; rIdx++) {
    for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
      const a = rIdx * stride + aIdx
      const b = a + stride
      const c = b + 1
      const dIdx = a + 1
      topIndices.push(a, c, b)
      topIndices.push(a, dIdx, c)
    }
  }

  const groundGeo = new THREE.BufferGeometry()
  groundGeo.setIndex(topIndices)
  groundGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(topPositions, 3),
  )
  groundGeo.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(topColors, 3),
  )
  groundGeo.computeVertexNormals()

  const groundMesh = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
  )
  groundMesh.receiveShadow = true
  terrainGroup.add(groundMesh)

  const cliffGeo = new THREE.CylinderGeometry(
    groundRadius,
    groundRadius * 0.88,
    6.5,
    angularSegs,
    1,
    true,
  )
  const cliffPos = cliffGeo.attributes.position
  for (let i = 0; i < cliffPos.count; i++) {
    const vx = cliffPos.getX(i)
    const vy = cliffPos.getY(i)
    const vz = cliffPos.getZ(i)
    const rimH = getTerrainHeight(vx, vz)
    cliffPos.setY(i, vy > 0 ? rimH : rimH - 6.5)
  }
  cliffGeo.computeVertexNormals()
  terrainGroup.add(
    new THREE.Mesh(
      cliffGeo,
      new THREE.MeshStandardMaterial({ color: cCliff, roughness: 0.95 }),
    ),
  )

  // Stream water ribbon
  const streamShape = new THREE.Shape()
  streamShape.moveTo(-2.3, -34)
  for (let z = -34; z <= 34; z += 1) {
    const sx = 14 + Math.sin(z * 0.12) * 3.5
    streamShape.lineTo(sx - 2.1, z)
  }
  for (let z = 34; z >= -34; z -= 1) {
    const sx = 14 + Math.sin(z * 0.12) * 3.5
    streamShape.lineTo(sx + 2.1, z)
  }
  const streamGeo = new THREE.ExtrudeGeometry(streamShape, {
    depth: 0.15,
    bevelEnabled: false,
  })
  streamGeo.rotateX(Math.PI / 2)
  const streamMesh = new THREE.Mesh(streamGeo, mats.water)
  streamMesh.position.y = -0.35
  streamMesh.receiveShadow = true
  terrainGroup.add(streamMesh)

  // Cobblestone pathway & plaza
  const pathGroup = new THREE.Group()
  scene.add(pathGroup)

  const plazaMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(6.6, 6.8, 0.24, 40),
    mats.warmStone,
  )
  plazaMesh.position.set(0, -0.08, 11.8)
  plazaMesh.receiveShadow = true
  pathGroup.add(plazaMesh)

  for (let i = 0; i < 20; i++) {
    const t = i / 19
    const pz = 18.8 + t * 14.5
    const px = Math.sin(t * Math.PI * 1.2) * 1.8
    const py = getTerrainHeight(px, pz)

    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95 + (i % 3) * 0.15, 1.05, 0.24, 8),
      i % 2 === 0 ? mats.warmStone : mats.darkStone,
    )
    stone.position.set(px, py - 0.06, pz)
    stone.rotation.y = i * 0.7
    stone.scale.set(1.25, 1, 0.85)
    stone.receiveShadow = true
    pathGroup.add(stone)
  }

  for (let i = 0; i < 8; i++) {
    const t = i / 7
    const px = -2.5 - t * 8.0
    const pz = 9.0 - Math.sin(t * Math.PI) * 2.0 - t * 5.0
    const py = getTerrainHeight(px, pz)
    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.7, 0.22, 7),
      mats.warmStone,
    )
    stone.position.set(px, py - 0.06, pz)
    stone.receiveShadow = true
    pathGroup.add(stone)
  }

  // Arched wooden footbridge
  const bridgeGroup = new THREE.Group()
  const bridgeZ = 12
  const bridgeX = 14 + Math.sin(bridgeZ * 0.12) * 3.5
  bridgeGroup.position.set(bridgeX, 0, bridgeZ)
  for (let i = -6; i <= 6; i++) {
    const t = i / 6
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.14, 2.2),
      i % 2 === 0 ? mats.lightWood : mats.oakWood,
    )
    const archY = Math.cos(t * (Math.PI / 2)) * 0.75 - 0.1
    plank.position.set(i * 0.46, archY, 0)
    plank.rotation.z = -Math.sin(t * (Math.PI / 2)) * 0.22
    bridgeGroup.add(plank)
  }
  ;[-0.95, 0.95].forEach((zOff) => {
    ;[-2.6, 0, 2.6].forEach((xOff, idx) => {
      const postY = idx === 1 ? 0.65 : 0.05
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8),
        mats.oakWood,
      )
      post.position.set(xOff, postY + 0.45, zOff)
      bridgeGroup.add(post)
    })
    const rail1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.75, 8),
      mats.lightWood,
    )
    rail1.rotation.z = Math.PI / 2 - 0.22
    rail1.position.set(-1.3, 0.78, zOff)
    bridgeGroup.add(rail1)

    const rail2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.75, 8),
      mats.lightWood,
    )
    rail2.rotation.z = Math.PI / 2 + 0.22
    rail2.position.set(1.3, 0.78, zOff)
    bridgeGroup.add(rail2)
  })
  castAndReceive(bridgeGroup)
  scene.add(bridgeGroup)

  // --- Notre-Dame Cathedral Basilica of Saigon ---
  const church = new THREE.Group()
  church.position.set(0, 0, -2.0)
  scene.add(church)

  const bellPivots: Array<{ pivot: THREE.Group; phaseOffset: number }> = []

  function createPitchedRoof(
    width: number,
    length: number,
    height: number,
    thickness = 0.3,
    mat: THREE.Material = mats.roofTile,
  ) {
    const shape = new THREE.Shape()
    const hw = width / 2
    shape.moveTo(-hw - thickness, 0)
    shape.lineTo(0, height + thickness)
    shape.lineTo(hw + thickness, 0)
    shape.lineTo(hw, -thickness * 0.45)
    shape.lineTo(0, height)
    shape.lineTo(-hw, -thickness * 0.45)
    shape.closePath()

    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: length,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
    })
    geo.center()
    return new THREE.Mesh(geo, mat)
  }

  function createArchedWindow(
    w = 0.85,
    h = 2.15,
    glassMat: THREE.Material = mats.stainedGlass,
    frameMat: THREE.Material = mats.creamWall,
  ) {
    const winGroup = new THREE.Group()
    const frameShape = new THREE.Shape()
    const hw = w / 2
    const rectH = Math.max(0.1, h - hw)
    frameShape.moveTo(-hw, 0)
    frameShape.lineTo(-hw, rectH)
    frameShape.absarc(0, rectH, hw, Math.PI, 0, true)
    frameShape.lineTo(hw, 0)
    frameShape.closePath()

    const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.035,
    })
    frameGeo.translate(0, -h / 2, -0.11)
    winGroup.add(new THREE.Mesh(frameGeo, frameMat))

    const paneShape = new THREE.Shape()
    const pw = hw * 0.74
    paneShape.moveTo(-pw, 0.06)
    paneShape.lineTo(-pw, rectH)
    paneShape.absarc(0, rectH, pw, Math.PI, 0, true)
    paneShape.lineTo(pw, 0.06)
    paneShape.closePath()

    const paneGeo = new THREE.ExtrudeGeometry(paneShape, {
      depth: 0.26,
      bevelEnabled: false,
    })
    paneGeo.translate(0, -h / 2, -0.13)
    winGroup.add(new THREE.Mesh(paneGeo, glassMat))

    const vBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, h * 0.82, 0.28),
      frameMat,
    )
    winGroup.add(vBar)
    const hBar = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.72, 0.05, 0.28),
      frameMat,
    )
    hBar.position.y = 0.12
    winGroup.add(hBar)

    return winGroup
  }

  function createBiforaWindow(
    totalW = 1.35,
    h = 2.4,
    glassMat: THREE.Material = mats.stainedGlass,
  ) {
    const group = new THREE.Group()
    const subW = totalW * 0.44
    const leftW = createArchedWindow(subW, h, glassMat, mats.creamWall)
    leftW.position.x = -totalW * 0.25
    group.add(leftW)

    const rightW = createArchedWindow(subW, h, glassMat, mats.creamWall)
    rightW.position.x = totalW * 0.25
    group.add(rightW)

    const oculus = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.045, 10, 20),
      mats.creamWall,
    )
    oculus.position.set(0, h * 0.34, 0.1)
    group.add(oculus)

    return group
  }

  function createRomanesquePortal(w = 2.4, h = 3.5, depth = 0.55) {
    const portal = new THREE.Group()
    const surroundW = w + 0.7
    const surroundBody = new THREE.Mesh(
      new THREE.BoxGeometry(surroundW, h * 0.68, depth),
      mats.creamWall,
    )
    surroundBody.position.y = h * 0.34
    portal.add(surroundBody)

    const gable = createPitchedRoof(
      surroundW + 0.2,
      depth + 0.1,
      1.15,
      0.18,
      mats.creamWall,
    )
    gable.position.y = h * 0.68 + 0.52
    portal.add(gable)
    ;[1.0, 0.86, 0.72].forEach((scale, idx) => {
      const r = w * 0.48 * scale
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.08, 12, 28, Math.PI),
        idx % 2 === 0 ? mats.creamWall : mats.warmStone,
      )
      arch.position.set(0, h - w * 0.48, depth * 0.42 - idx * 0.06)
      portal.add(arch)
    })

    const tympR = w * 0.36
    const tymp = new THREE.Mesh(
      new THREE.CylinderGeometry(
        tympR,
        tympR,
        depth + 0.06,
        24,
        1,
        false,
        0,
        Math.PI,
      ),
      mats.statueWhite,
    )
    tymp.rotation.z = Math.PI / 2
    tymp.rotation.y = Math.PI / 2
    tymp.position.set(0, h - w * 0.48, 0.02)
    portal.add(tymp)

    const doorH = h - w * 0.48
    const doors = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.72, doorH, depth + 0.04),
      mats.oakWood,
    )
    doors.position.set(0, doorH / 2, 0)
    portal.add(doors)

    const split = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, doorH, depth + 0.08),
      mats.iron,
    )
    split.position.set(0, doorH / 2, 0)
    portal.add(split)
    ;[-0.16, 0.16].forEach((hx) => {
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.02, 8, 16),
        mats.gold,
      )
      handle.position.set(hx, doorH * 0.52, depth * 0.54)
      portal.add(handle)
    })

    return portal
  }

  function createCross(scale = 1, mat: THREE.Material = mats.gold) {
    const cross = new THREE.Group()
    const vBeam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.65, 0.18), mat)
    vBeam.position.y = 0.82
    cross.add(vBeam)

    const hBeam = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.18, 0.18), mat)
    hBeam.position.y = 1.15
    cross.add(hBeam)

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.035, 10, 24),
      mat,
    )
    halo.position.y = 1.15
    cross.add(halo)

    cross.scale.setScalar(scale)
    return cross
  }

  // Plinth & Steps
  const mainPlinth = new THREE.Mesh(
    new THREE.BoxGeometry(11.4, 1.15, 19.2),
    mats.darkStone,
  )
  mainPlinth.position.set(0, 0.275, -0.4)
  church.add(mainPlinth)

  const plinthTrim = new THREE.Mesh(
    new THREE.BoxGeometry(11.6, 0.18, 19.4),
    mats.warmStone,
  )
  plinthTrim.position.set(0, 0.85, -0.4)
  church.add(plinthTrim)

  for (let s = 0; s < 4; s++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(10.6 - s * 0.35, 0.26, 1.5 - s * 0.3),
      s % 2 === 0 ? mats.warmStone : mats.creamWall,
    )
    step.position.set(0, 0.05 + s * 0.19, 9.7 - s * 0.15)
    church.add(step)
  }

  // Basilica High Nave + Side Aisles
  const naveW = 5.4
  const naveH = 8.4
  const naveL = 15.0
  const naveZ = -1.2

  const highNave = new THREE.Mesh(
    new THREE.BoxGeometry(naveW, naveH, naveL),
    mats.redBrick,
  )
  highNave.position.set(0, 0.85 + naveH / 2, naveZ)
  church.add(highNave)

  const naveCornice = new THREE.Mesh(
    new THREE.BoxGeometry(naveW + 0.35, 0.28, naveL + 0.2),
    mats.creamWall,
  )
  naveCornice.position.set(0, 0.85 + naveH, naveZ)
  church.add(naveCornice)

  const highRoof = createPitchedRoof(
    naveW + 0.5,
    naveL + 0.4,
    2.5,
    0.28,
    mats.roofTile,
  )
  highRoof.position.set(0, 0.85 + naveH + 1.25, naveZ)
  church.add(highRoof)

  const aislesTotalW = 10.4
  const aisleH = 5.2
  const aisleL = 14.6
  const sideAisles = new THREE.Mesh(
    new THREE.BoxGeometry(aislesTotalW, aisleH, aisleL),
    mats.redBrick,
  )
  sideAisles.position.set(0, 0.85 + aisleH / 2, naveZ)
  church.add(sideAisles)

  const aisleCornice = new THREE.Mesh(
    new THREE.BoxGeometry(aislesTotalW + 0.35, 0.25, aisleL + 0.3),
    mats.creamWall,
  )
  aisleCornice.position.set(0, 0.85 + aisleH, naveZ)
  church.add(aisleCornice)
  ;[-1, 1].forEach((side) => {
    const leanRoof = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.24, aisleL + 0.3),
      mats.roofTile,
    )
    leanRoof.position.set(side * 3.85, 0.85 + aisleH + 0.65, naveZ)
    leanRoof.rotation.z = -side * 0.42
    church.add(leanRoof)
  })

  // Transept & Fleche
  const transW = 11.4
  const transH = 7.6
  const transL = 3.6
  const transept = new THREE.Mesh(
    new THREE.BoxGeometry(transW, transH, transL),
    mats.redBrick,
  )
  transept.position.set(0, 0.85 + transH / 2, -5.2)
  church.add(transept)

  const transCornice = new THREE.Mesh(
    new THREE.BoxGeometry(transW + 0.3, 0.26, transL + 0.3),
    mats.creamWall,
  )
  transCornice.position.set(0, 0.85 + transH, -5.2)
  church.add(transCornice)

  const transRoof = createPitchedRoof(
    transL + 0.4,
    transW + 0.4,
    2.1,
    0.25,
    mats.roofTile,
  )
  transRoof.rotation.y = Math.PI / 2
  transRoof.position.set(0, 0.85 + transH + 1.05, -5.2)
  church.add(transRoof)

  const flecheGroup = new THREE.Group()
  flecheGroup.position.set(0, 0.85 + naveH + 2.3, -5.2)
  const flecheBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.42, 1.2, 8),
    mats.spireRoof,
  )
  flecheBase.position.y = 0.6
  flecheGroup.add(flecheBase)
  const flecheSpire = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 2.6, 8),
    mats.spireRoof,
  )
  flecheSpire.position.y = 2.5
  flecheGroup.add(flecheSpire)
  const flecheCross = createCross(0.45, mats.gold)
  flecheCross.position.y = 3.75
  flecheGroup.add(flecheCross)
  church.add(flecheGroup)

  // Side Bays, Buttresses & Windows
  const bayZ = [4.0, 1.6, -0.8, -3.1, -7.4]
  const glassCycle = [mats.stainedGlass, mats.stainedBlue, mats.stainedRose]

  ;[-1, 1].forEach((side) => {
    ;[5.2, 2.8, 0.4, -2.0, -6.4, -8.4].forEach((bz) => {
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, aisleH, 0.55),
        mats.redBrick,
      )
      pier.position.set(side * (aislesTotalW / 2 + 0.2), 0.85 + aisleH / 2, bz)
      church.add(pier)

      const pierCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.22, 0.65),
        mats.creamWall,
      )
      pierCap.position.set(
        side * (aislesTotalW / 2 + 0.2),
        0.85 + aisleH + 0.05,
        bz,
      )
      church.add(pierCap)

      const upperPier = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 3.0, 0.48),
        mats.redBrick,
      )
      upperPier.position.set(side * (naveW / 2 + 0.18), 0.85 + aisleH + 1.5, bz)
      church.add(upperPier)
    })

    bayZ.forEach((wz, idx) => {
      const gMat = glassCycle[idx % glassCycle.length]
      const aisleWin = createBiforaWindow(1.25, 2.3, gMat)
      aisleWin.rotation.y = (side * Math.PI) / 2
      aisleWin.position.set(side * (aislesTotalW / 2 + 0.02), 3.35, wz)
      church.add(aisleWin)

      const clereWin = createArchedWindow(0.75, 1.45, gMat, mats.creamWall)
      clereWin.rotation.y = (side * Math.PI) / 2
      clereWin.position.set(side * (naveW / 2 + 0.02), 7.65, wz)
      church.add(clereWin)
    })

    const transWin = createBiforaWindow(1.75, 3.2, mats.stainedGlass)
    transWin.rotation.y = (side * Math.PI) / 2
    transWin.position.set(side * (transW / 2 + 0.02), 3.9, -5.2)
    church.add(transWin)

    const transOculus = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.12, 12, 24),
      mats.creamWall,
    )
    transOculus.rotation.y = (side * Math.PI) / 2
    transOculus.position.set(side * (transW / 2 + 0.08), 6.8, -5.2)
    church.add(transOculus)
  })

  // Rear Apse & Ambulatory
  const apseGroup = new THREE.Group()
  apseGroup.position.set(0, 0.85, -8.6)
  church.add(apseGroup)

  const highApse = new THREE.Mesh(
    new THREE.CylinderGeometry(
      2.65,
      2.7,
      7.8,
      16,
      1,
      false,
      Math.PI / 2,
      Math.PI,
    ),
    mats.redBrick,
  )
  highApse.position.y = 3.9
  apseGroup.add(highApse)

  const highApseRoof = new THREE.Mesh(
    new THREE.ConeGeometry(2.95, 2.4, 16, 1, false, Math.PI / 2, Math.PI),
    mats.roofTile,
  )
  highApseRoof.position.y = 9.0
  apseGroup.add(highApseRoof)

  const lowApse = new THREE.Mesh(
    new THREE.CylinderGeometry(
      4.6,
      4.7,
      4.6,
      18,
      1,
      false,
      Math.PI / 2,
      Math.PI,
    ),
    mats.redBrick,
  )
  lowApse.position.y = 2.3
  apseGroup.add(lowApse)

  const lowApseTrim = new THREE.Mesh(
    new THREE.CylinderGeometry(
      4.8,
      4.8,
      0.24,
      18,
      1,
      false,
      Math.PI / 2,
      Math.PI,
    ),
    mats.creamWall,
  )
  lowApseTrim.position.y = 4.6
  apseGroup.add(lowApseTrim)

  const lowApseRoof = new THREE.Mesh(
    new THREE.ConeGeometry(4.9, 1.9, 18, 1, false, Math.PI / 2, Math.PI),
    mats.roofTile,
  )
  lowApseRoof.position.y = 5.55
  apseGroup.add(lowApseRoof)

  // Central West Facade
  const facadeGroup = new THREE.Group()
  facadeGroup.position.set(0, 0.85, 6.4)
  church.add(facadeGroup)

  const centerFacadeWall = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 9.4, 1.6),
    mats.redBrick,
  )
  centerFacadeWall.position.set(0, 4.7, 0)
  facadeGroup.add(centerFacadeWall)
  ;[3.8, 7.4, 9.4].forEach((sy) => {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.24, 1.82),
      mats.creamWall,
    )
    band.position.set(0, sy, 0)
    facadeGroup.add(band)
  })

  const mainPortal = createRomanesquePortal(2.55, 3.65, 0.65)
  mainPortal.position.set(0, 0, 0.85)
  facadeGroup.add(mainPortal)

  // Rose Window
  const roseGroup = new THREE.Group()
  roseGroup.position.set(0, 5.65, 0.84)
  facadeGroup.add(roseGroup)

  roseGroup.add(
    new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.2, 16, 36), mats.creamWall),
  )

  const roseBack = new THREE.Mesh(
    new THREE.CylinderGeometry(1.44, 1.44, 0.14, 32),
    mats.stainedGlass,
  )
  roseBack.rotation.x = Math.PI / 2
  roseGroup.add(roseBack)

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 2.8, 0.22),
      mats.creamWall,
    )
    spoke.rotation.z = angle
    roseGroup.add(spoke)

    const petalMat =
      i % 3 === 0
        ? mats.stainedRose
        : i % 3 === 1
          ? mats.stainedBlue
          : mats.stainedGlass
    const petal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.18, 12),
      petalMat,
    )
    petal.rotation.x = Math.PI / 2
    petal.position.set(Math.cos(angle) * 0.9, Math.sin(angle) * 0.9, 0.02)
    roseGroup.add(petal)
  }
  const roseHub = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.09, 12, 24),
    mats.creamWall,
  )
  roseHub.position.z = 0.06
  roseGroup.add(roseHub)

  // Central Facade Clock above Rose Window
  const clockGroup = new THREE.Group()
  clockGroup.position.set(0, 8.4, 0.85)
  facadeGroup.add(clockGroup)

  clockGroup.add(
    new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.55, 0.25), mats.creamWall),
  )

  const clockDial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 0.18, 28),
    mats.statueWhite,
  )
  clockDial.rotation.x = Math.PI / 2
  clockDial.position.z = 0.08
  clockGroup.add(clockDial)

  const clockRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.065, 12, 28),
    mats.gold,
  )
  clockRim.position.z = 0.16
  clockGroup.add(clockRim)

  const minuteHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.42, 0.05),
    mats.iron,
  )
  minuteHand.position.set(0, 0.15, 0.19)
  clockGroup.add(minuteHand)

  const hourHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.05, 0.05),
    mats.iron,
  )
  hourHand.position.set(0.12, 0, 0.19)
  clockGroup.add(hourHand)

  const centerGable = createPitchedRoof(4.8, 1.55, 2.15, 0.26, mats.redBrick)
  centerGable.position.set(0, 10.45, 0)
  facadeGroup.add(centerGable)

  const centerGableTrim = createPitchedRoof(
    5.0,
    1.68,
    2.25,
    0.18,
    mats.creamWall,
  )
  centerGableTrim.position.set(0, 10.52, 0)
  facadeGroup.add(centerGableTrim)

  const facadeTopCross = createCross(0.75, mats.gold)
  facadeTopCross.position.set(0, 11.75, 0.2)
  facadeGroup.add(facadeTopCross)

  // Twin Symmetrical Red-Brick Bell Towers & Spires
  ;[-3.85, 3.85].forEach((tx, tIdx) => {
    const tower = new THREE.Group()
    tower.position.set(tx, 0.85, 6.55)
    church.add(tower)

    const tW = 3.25
    const tiers = [
      { h: 3.8, y: 1.9, w: tW },
      { h: 3.6, y: 5.6, w: tW - 0.08 },
      { h: 3.4, y: 9.1, w: tW - 0.16 },
      { h: 3.6, y: 12.6, w: tW - 0.22 },
    ]

    tiers.forEach(({ h, y, w }, tierIdx) => {
      if (tierIdx < 3) {
        const shaft = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, w),
          mats.redBrick,
        )
        shaft.position.y = y
        tower.add(shaft)
      }

      const pOff = w / 2 - 0.14
      ;[-pOff, pOff].forEach((px) => {
        ;[-pOff, pOff].forEach((pz) => {
          const pilaster = new THREE.Mesh(
            new THREE.BoxGeometry(0.36, h, 0.36),
            tierIdx === 3 ? mats.redBrick : mats.creamWall,
          )
          pilaster.position.set(px, y, pz)
          tower.add(pilaster)
        })
      })

      const cornice = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.36, 0.28, w + 0.36),
        mats.creamWall,
      )
      cornice.position.y = y + h / 2
      tower.add(cornice)
    })

    const sidePortal = createRomanesquePortal(1.65, 2.75, 0.45)
    sidePortal.position.set(0, 0, tW / 2 + 0.15)
    tower.add(sidePortal)
    ;[5.6, 9.1].forEach((wy, idx) => {
      const winH = idx === 0 ? 2.2 : 2.0
      const frontBifora = createBiforaWindow(1.35, winH, mats.stainedGlass)
      frontBifora.position.set(0, wy, (tW - idx * 0.08) / 2 + 0.02)
      tower.add(frontBifora)

      const sideSign = tx < 0 ? -1 : 1
      const sideBifora = createBiforaWindow(1.35, winH, mats.stainedBlue)
      sideBifora.rotation.y = (sideSign * Math.PI) / 2
      sideBifora.position.set(sideSign * ((tW - idx * 0.08) / 2 + 0.02), wy, 0)
      tower.add(sideBifora)
    })

    const belfryW = tW - 0.22
    const belfryCore = new THREE.Mesh(
      new THREE.BoxGeometry(belfryW * 0.62, 3.3, belfryW * 0.62),
      mats.louverSlate,
    )
    belfryCore.position.y = 12.6
    tower.add(belfryCore)

    for (let s = 0; s < 4; s++) {
      const bSide = new THREE.Group()
      bSide.rotation.y = (s * Math.PI) / 2
      bSide.position.y = 12.6

      const midCol = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 2.8, 12),
        mats.creamWall,
      )
      midCol.position.set(0, -0.1, belfryW / 2 - 0.12)
      bSide.add(midCol)
      ;[-0.48, 0.48].forEach((ax) => {
        const archHead = new THREE.Mesh(
          new THREE.TorusGeometry(0.44, 0.09, 10, 20, Math.PI),
          mats.creamWall,
        )
        archHead.position.set(ax, 1.1, belfryW / 2 - 0.08)
        bSide.add(archHead)
      })

      tower.add(bSide)
    }

    const bellPivot = new THREE.Group()
    bellPivot.position.set(0, 13.5, 0)
    tower.add(bellPivot)
    bellPivots.push({ pivot: bellPivot, phaseOffset: tIdx * 0.6 })

    bellPivot.add(
      new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.22), mats.oakWood),
    )
    const bellCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.54, 0.82, 18),
      mats.gold,
    )
    bellCone.position.y = -0.45
    bellPivot.add(bellCone)
    const clapper = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      mats.gold,
    )
    clapper.position.y = -0.9
    bellPivot.add(clapper)

    const pCorner = belfryW / 2 - 0.05
    ;[-pCorner, pCorner].forEach((px) => {
      ;[-pCorner, pCorner].forEach((pz) => {
        const pinBase = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.65, 0.42),
          mats.creamWall,
        )
        pinBase.position.set(px, 14.75, pz)
        tower.add(pinBase)

        const pinCap = new THREE.Mesh(
          new THREE.ConeGeometry(0.32, 1.05, 4),
          mats.spireRoof,
        )
        pinCap.rotation.y = Math.PI / 4
        pinCap.position.set(px, 15.6, pz)
        tower.add(pinCap)
      })
    })

    const spireH = 7.4
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(1.52, spireH, 8),
      mats.spireRoof,
    )
    spire.position.y = 14.4 + spireH / 2
    tower.add(spire)

    for (let dSide = 0; dSide < 4; dSide++) {
      const lucarne = new THREE.Group()
      lucarne.rotation.y = (dSide * Math.PI) / 2
      lucarne.position.y = 15.85

      const lucBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.85, 0.6),
        mats.creamWall,
      )
      lucBox.position.z = 1.05
      lucarne.add(lucBox)

      const lucRoof = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 0.65, 4),
        mats.spireRoof,
      )
      lucRoof.rotation.y = Math.PI / 4
      lucRoof.position.set(0, 0.72, 1.05)
      lucarne.add(lucRoof)

      tower.add(lucarne)
    }

    const spireCross = createCross(0.95, mats.gold)
    spireCross.position.y = 14.4 + spireH - 0.1
    tower.add(spireCross)
  })

  castAndReceive(church)

  // Forecourt Monument: Statue of Our Lady of Peace (Tượng Đức Mẹ Hòa Bình)
  const monumentGroup = new THREE.Group()
  const monZ = 12.2
  monumentGroup.position.set(0, getTerrainHeight(0, monZ) - 0.05, monZ)
  scene.add(monumentGroup)

  const curbOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(2.55, 2.65, 0.32, 32),
    mats.creamWall,
  )
  curbOuter.position.y = 0.12
  monumentGroup.add(curbOuter)

  const gardenSoil = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.3, 0.36, 32),
    new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.9 }),
  )
  gardenSoil.position.y = 0.14
  monumentGroup.add(gardenSoil)

  const monFlowerColors = [0xff5252, 0xffeb3b, 0xf48fb1, 0xffffff, 0xce93d8]
  for (let f = 0; f < 24; f++) {
    const ang = (f / 24) * Math.PI * 2
    const rad = f % 2 === 0 ? 1.85 : 1.35
    const fMat = new THREE.MeshStandardMaterial({
      color: monFlowerColors[f % monFlowerColors.length],
      roughness: 0.5,
    })
    const fl = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 1), fMat)
    fl.position.set(Math.cos(ang) * rad, 0.38, Math.sin(ang) * rad)
    monumentGroup.add(fl)
  }

  const pedStep1 = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.35, 1.7),
    mats.warmStone,
  )
  pedStep1.position.y = 0.42
  monumentGroup.add(pedStep1)

  const pedStep2 = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.3, 1.25),
    mats.creamWall,
  )
  pedStep2.position.y = 0.72
  monumentGroup.add(pedStep2)

  const tallPedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 2.45, 0.68),
    mats.statueWhite,
  )
  tallPedestal.position.y = 2.08
  monumentGroup.add(tallPedestal)

  const pedCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.18, 0.82),
    mats.creamWall,
  )
  pedCap.position.y = 3.35
  monumentGroup.add(pedCap)

  const reginaPacis = new THREE.Group()
  reginaPacis.position.y = 3.44
  monumentGroup.add(reginaPacis)

  const rpRobe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.28, 1.25, 16),
    mats.statueWhite,
  )
  rpRobe.position.y = 0.62
  reginaPacis.add(rpRobe)

  const rpVeil = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.15,
      0.3,
      1.15,
      16,
      1,
      false,
      -Math.PI * 0.65,
      Math.PI * 1.3,
    ),
    mats.statueWhite,
  )
  rpVeil.position.set(0, 0.68, -0.02)
  reginaPacis.add(rpVeil)

  const rpHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 16, 16),
    mats.statueWhite,
  )
  rpHead.position.set(0, 1.35, 0.02)
  reginaPacis.add(rpHead)

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 14, 14),
    mats.statueWhite,
  )
  globe.position.set(0, 0.92, 0.22)
  reginaPacis.add(globe)

  const globeCross = createCross(0.14, mats.gold)
  globeCross.position.set(0, 1.01, 0.22)
  reginaPacis.add(globeCross)

  const rpHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.02, 10, 24),
    mats.gold,
  )
  rpHalo.position.set(0, 1.4, -0.04)
  reginaPacis.add(rpHalo)

  castAndReceive(monumentGroup)

  // Marian Grotto Shrine on the Left
  const grottoGroup = new THREE.Group()
  const gx = -11.5
  const gz = 3.0
  grottoGroup.position.set(gx, getTerrainHeight(gx, gz) - 0.12, gz)
  grottoGroup.rotation.y = 0.55
  scene.add(grottoGroup)

  const boulderPositions: Array<[number, number, number, number]> = [
    [-1.5, 0.5, 0, 0.85],
    [-1.3, 1.4, -0.1, 0.75],
    [-0.8, 2.1, -0.1, 0.7],
    [0, 2.4, -0.1, 0.78],
    [0.8, 2.1, -0.1, 0.7],
    [1.3, 1.4, -0.1, 0.75],
    [1.5, 0.5, 0, 0.85],
    [0, 1.1, -0.7, 1.25],
  ]
  boulderPositions.forEach(([bx, by, bz, r]) => {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(r, 1),
      mats.darkStone,
    )
    rock.position.set(bx, by, bz)
    rock.rotation.set(bx, by, bz)
    grottoGroup.add(rock)
  })

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.55, 0.85, 12),
    mats.warmStone,
  )
  pedestal.position.set(0, 0.35, 0.1)
  grottoGroup.add(pedestal)

  const maryRobe = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 1.15, 16),
    mats.statueWhite,
  )
  maryRobe.position.set(0, 1.3, 0.1)
  grottoGroup.add(maryRobe)

  const maryMantle = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.18,
      0.34,
      0.95,
      16,
      1,
      false,
      -Math.PI * 0.65,
      Math.PI * 1.3,
    ),
    mats.maryBlue,
  )
  maryMantle.position.set(0, 1.35, 0.08)
  grottoGroup.add(maryMantle)

  const maryHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 16),
    mats.statueWhite,
  )
  maryHead.position.set(0, 1.92, 0.1)
  grottoGroup.add(maryHead)

  const maryHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.025, 10, 24),
    mats.gold,
  )
  maryHalo.position.set(0, 1.98, 0.02)
  grottoGroup.add(maryHalo)

  const grottoLight = new THREE.PointLight(0xffb74d, 1.6, 7)
  grottoLight.position.set(0, 1.2, 1.1)
  grottoGroup.add(grottoLight)
  castAndReceive(grottoGroup)

  // Benches & Lanterns
  const lanternLights: Array<THREE.PointLight> = []
  function createBench(x: number, z: number, rotY: number) {
    const bench = new THREE.Group()
    bench.position.set(x, getTerrainHeight(x, z) - 0.05, z)
    bench.rotation.y = rotY
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.12, 0.65),
      mats.lightWood,
    )
    seat.position.y = 0.52
    bench.add(seat)
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.5, 0.1),
      mats.lightWood,
    )
    back.position.set(0, 0.85, -0.26)
    back.rotation.x = -0.12
    bench.add(back)
    ;[-0.85, 0.85].forEach((lx) => {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.62, 0.58),
        mats.iron,
      )
      leg.position.set(lx, 0.23, 0)
      bench.add(leg)
    })
    castAndReceive(bench)
    scene.add(bench)
  }
  createBench(-5.6, 12.2, 0.55)
  createBench(5.6, 12.2, -0.55)
  createBench(-8.2, 5.2, 0.95)

  function createLantern(x: number, z: number) {
    const lamp = new THREE.Group()
    lamp.position.set(x, getTerrainHeight(x, z) - 0.08, z)
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.14, 3.35, 10),
      mats.iron,
    )
    pole.position.y = 1.55
    lamp.add(pole)

    const bulb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.18, 0.48, 6),
      mats.stainedGlass,
    )
    bulb.position.y = 3.35
    lamp.add(bulb)

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.28, 6), mats.iron)
    cap.position.y = 3.72
    lamp.add(cap)

    const pLight = new THREE.PointLight(0xffb74d, 0.5, 9)
    pLight.position.y = 3.35
    lamp.add(pLight)
    lanternLights.push(pLight)

    castAndReceive(lamp)
    scene.add(lamp)
  }
  createLantern(-4.6, 15.8)
  createLantern(4.6, 15.8)
  createLantern(-2.6, 21.5)
  createLantern(3.2, 25.5)

  // Trees, Bushes & Flowers
  const foliageGroup = new THREE.Group()
  scene.add(foliageGroup)

  const treePalettes = [
    new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x81c784, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0xf48fb1, roughness: 0.82 }),
  ]

  const animatedTrees: Array<{
    crown: THREE.Group
    phase: number
    speed: number
  }> = []

  function createPuffyTree(x: number, z: number, scale = 1, paletteIdx = 0) {
    const tGroup = new THREE.Group()
    tGroup.position.set(x, getTerrainHeight(x, z) - 0.12, z)

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24 * scale, 0.45 * scale, 2.4 * scale, 8),
      mats.oakWood,
    )
    trunk.position.y = 1.05 * scale
    trunk.castShadow = true
    trunk.receiveShadow = true
    tGroup.add(trunk)

    const crown = new THREE.Group()
    crown.position.y = 2.4 * scale
    const mat = treePalettes[paletteIdx % treePalettes.length]

    const puffs: Array<[number, number, number, number]> = [
      [0, 0.5, 0, 1.35],
      [-0.75, 0.1, 0.45, 0.98],
      [0.78, 0.15, 0.35, 1.02],
      [0.15, 0.1, -0.78, 1.05],
      [-0.45, 0.85, -0.35, 0.92],
      [0.45, 0.9, 0.25, 0.88],
    ]
    puffs.forEach(([px, py, pz, r]) => {
      const puff = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r * scale, 2),
        mat,
      )
      puff.position.set(px * scale, py * scale, pz * scale)
      puff.castShadow = true
      puff.receiveShadow = true
      crown.add(puff)
    })

    tGroup.add(crown)
    foliageGroup.add(tGroup)
    animatedTrees.push({
      crown,
      phase: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 0.6,
    })
  }

  function createCypressTree(x: number, z: number, scale = 1) {
    const tGroup = new THREE.Group()
    tGroup.position.set(x, getTerrainHeight(x, z) - 0.1, z)

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16 * scale, 0.28 * scale, 1.55 * scale, 8),
      mats.oakWood,
    )
    trunk.position.y = 0.65 * scale
    tGroup.add(trunk)

    const crown = new THREE.Group()
    crown.position.y = 1.2 * scale
    const mat = treePalettes[2]
    for (let tier = 0; tier < 3; tier++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(
          (1.25 - tier * 0.26) * scale,
          (2.2 - tier * 0.25) * scale,
          10,
        ),
        mat,
      )
      cone.position.y = tier * 1.15 * scale + 0.8 * scale
      crown.add(cone)
    }
    tGroup.add(crown)
    castAndReceive(tGroup)
    foliageGroup.add(tGroup)
    animatedTrees.push({
      crown,
      phase: Math.random() * Math.PI * 2,
      speed: 1.4,
    })
  }

  const treeLocations: Array<[number, number, number, number]> = [
    [-14, -8, 1.25, 0],
    [-18, -2, 1.1, 1],
    [-16, 8, 1.15, 4],
    [-11, 15, 1.05, 0],
    [-19, 16, 1.3, 2],
    [-8, -14, 1.35, 1],
    [0, -16, 1.4, 0],
    [9, -13, 1.2, 3],
    [19, -7, 1.25, 0],
    [22, 3, 1.15, 1],
    [21, 15, 1.3, 4],
    [9, 21, 1.05, 3],
    [-10, 24, 1.15, 1],
  ]
  treeLocations.forEach(([x, z, s, p]) => createPuffyTree(x, z, s, p))

  const cypressCoords: Array<[number, number, number]> = [
    [-7.8, -11.5, 1.15],
    [7.8, -11.5, 1.15],
    [-10.5, -4, 0.95],
    [9.5, -4, 1.0],
    [-14.5, 4.5, 0.9],
  ]
  cypressCoords.forEach(([x, z, s]) => createCypressTree(x, z, s))

  const berryColors = [0xff80ab, 0xffd54f, 0x80d8ff, 0xffffff]
  function createBush(x: number, z: number, scale = 1, hasFlowers = true) {
    const bush = new THREE.Group()
    bush.position.set(x, getTerrainHeight(x, z) - 0.1, z)
    const mat = treePalettes[Math.abs(Math.round(x + z)) % 4]

    const bushPuffs: Array<[number, number, number, number]> = [
      [0, 0.34, 0, 0.62],
      [-0.42, 0.24, 0.2, 0.46],
      [0.44, 0.26, -0.15, 0.48],
    ]
    bushPuffs.forEach(([bx, by, bz, r]) => {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r * scale, 2), mat)
      b.position.set(bx * scale, by * scale, bz * scale)
      bush.add(b)
    })

    if (hasFlowers) {
      const bMat = new THREE.MeshStandardMaterial({
        color: berryColors[Math.abs(Math.round(x * 3)) % berryColors.length],
        roughness: 0.5,
      })
      for (let i = 0; i < 6; i++) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.09 * scale, 8, 8),
          bMat,
        )
        const angle = (i / 6) * Math.PI * 2
        dot.position.set(
          Math.cos(angle) * 0.48 * scale,
          (0.42 + (i % 2) * 0.2) * scale,
          Math.sin(angle) * 0.42 * scale,
        )
        bush.add(dot)
      }
    }
    castAndReceive(bush)
    foliageGroup.add(bush)
  }

  const bushCoords: Array<[number, number, number]> = [
    [-6.8, 6.8, 0.95],
    [6.8, 6.8, 0.95],
    [-6.8, 2.2, 0.85],
    [6.8, 2.2, 0.85],
    [-9.2, 1.5, 1.0],
    [-13.5, 1.8, 0.9],
    [-7.5, 14.5, 1.1],
    [7.5, 14.5, 1.05],
    [10.2, 8.5, 0.9],
    [18.2, 9.5, 1.1],
    [-4.5, 20.0, 0.95],
    [5.2, 22.0, 1.0],
  ]
  bushCoords.forEach(([x, z, s]) => createBush(x, z, s, true))

  // Instanced Meadow Flowers
  const flowerPalette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xffeb3b),
    new THREE.Color(0xf48fb1),
    new THREE.Color(0xce93d8),
    new THREE.Color(0x81d4fa),
  ]

  const flowerCount = 500
  const stemGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.4, 5)
  stemGeo.translate(0, 0.16, 0)
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x558b2f,
    roughness: 0.9,
  })
  const stemInst = new THREE.InstancedMesh(stemGeo, stemMat, flowerCount)
  stemInst.castShadow = true
  stemInst.receiveShadow = true

  const blossomGeo = new THREE.DodecahedronGeometry(0.13, 1)
  blossomGeo.scale(1, 0.55, 1)
  blossomGeo.translate(0, 0.36, 0)
  const blossomMat = new THREE.MeshStandardMaterial({ roughness: 0.6 })
  const blossomInst = new THREE.InstancedMesh(
    blossomGeo,
    blossomMat,
    flowerCount,
  )
  blossomInst.castShadow = true
  blossomInst.receiveShadow = true

  const dummy = new THREE.Object3D()
  let placed = 0
  for (let i = 0; i < 1400 && placed < flowerCount; i++) {
    const r = 7 + Math.random() * 25
    const theta = Math.random() * Math.PI * 2
    const fx = Math.cos(theta) * r
    const fz = Math.sin(theta) * r

    if (Math.abs(fx) < 7.5 && fz > -15.5 && fz < 18.5) continue
    const streamX = 14 + Math.sin(fz * 0.12) * 3.5
    if (Math.abs(fx - streamX) < 3.0) continue
    if (fz > 8 && Math.abs(fx) < 3.4) continue

    const fy = getTerrainHeight(fx, fz) - 0.03
    dummy.position.set(fx, fy, fz)
    dummy.rotation.set(
      (Math.random() - 0.5) * 0.25,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.25,
    )
    const s = 0.75 + Math.random() * 0.7
    dummy.scale.setScalar(s)
    dummy.updateMatrix()

    stemInst.setMatrixAt(placed, dummy.matrix)
    blossomInst.setMatrixAt(placed, dummy.matrix)
    blossomInst.setColorAt(placed, flowerPalette[placed % flowerPalette.length])
    placed++
  }
  stemInst.instanceMatrix.needsUpdate = true
  blossomInst.instanceMatrix.needsUpdate = true
  if (blossomInst.instanceColor) blossomInst.instanceColor.needsUpdate = true
  scene.add(stemInst)
  scene.add(blossomInst)

  // Grazing White Sheep
  const sheepList: Array<{
    mesh: THREE.Group
    baseY: number
    phase: number
  }> = []
  function createSheep(x: number, z: number, rotY: number) {
    const sGroup = new THREE.Group()
    sGroup.position.set(x, getTerrainHeight(x, z) - 0.04, z)
    sGroup.rotation.y = rotY

    const wool = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.45, 2),
      mats.statueWhite,
    )
    wool.scale.set(1.25, 0.95, 0.9)
    wool.position.y = 0.52
    sGroup.add(wool)

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.26, 0.26),
      mats.iron,
    )
    head.position.set(0.52, 0.62, 0)
    sGroup.add(head)

    const legCoords: Array<[number, number]> = [
      [-0.28, 0.18],
      [-0.28, -0.18],
      [0.28, 0.18],
      [0.28, -0.18],
    ]
    legCoords.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.04, 0.4, 6),
        mats.iron,
      )
      leg.position.set(lx, 0.18, lz)
      sGroup.add(leg)
    })

    castAndReceive(sGroup)
    scene.add(sGroup)
    sheepList.push({
      mesh: sGroup,
      baseY: sGroup.position.y,
      phase: Math.random() * 6,
    })
  }
  createSheep(8.5, 4.5, 2.2)
  createSheep(10.2, 2.8, 1.7)
  createSheep(7.8, 1.5, 2.8)
  createSheep(-13.5, 11.2, 0.5)

  // Fluffy Clouds
  const clouds: Array<{
    group: THREE.Group
    speed: number
    baseY: number
    phase: number
  }> = []
  function createCloud(x: number, y: number, z: number, scale = 1) {
    const cGroup = new THREE.Group()
    cGroup.position.set(x, y, z)

    const puffs: Array<[number, number, number, number]> = [
      [0, 0, 0, 1.9],
      [-1.6, -0.2, 0.2, 1.4],
      [1.6, -0.15, -0.1, 1.45],
      [-0.8, 0.55, -0.3, 1.3],
      [0.85, 0.6, 0.25, 1.25],
      [2.7, -0.35, 0.1, 1.05],
    ]
    puffs.forEach(([px, py, pz, r]) => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 16),
        mats.cloud,
      )
      sphere.position.set(px, py, pz)
      cGroup.add(sphere)
    })
    cGroup.scale.setScalar(scale)
    scene.add(cGroup)
    clouds.push({
      group: cGroup,
      speed: 0.35 + Math.random() * 0.35,
      baseY: y,
      phase: Math.random() * Math.PI * 2,
    })
  }
  createCloud(-26, 23, -18, 1.35)
  createCloud(14, 26, -24, 1.55)
  createCloud(32, 21, -6, 1.15)
  createCloud(-18, 25, 16, 1.25)
  createCloud(24, 24, 22, 1.3)
  createCloud(-4, 28, -32, 1.65)

  // Floating Pollen & Circling White Doves
  const particleCount = 100
  const pGeo = new THREE.BufferGeometry()
  const pPositions = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i++) {
    pPositions[i * 3] = (Math.random() - 0.5) * 55
    pPositions[i * 3 + 1] = 1 + Math.random() * 16
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 55
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3))
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      color: 0xfff59d,
      size: 0.26,
      transparent: true,
      opacity: 0.8,
    }),
  )
  scene.add(particles)

  const doves: Array<{
    group: THREE.Group
    leftWing: THREE.Mesh
    rightWing: THREE.Mesh
    angle: number
  }> = []
  for (let i = 0; i < 4; i++) {
    const dove = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.42, 8),
      mats.statueWhite,
    )
    body.rotation.x = Math.PI / 2
    dove.add(body)

    const leftWing = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.03, 0.16),
      mats.statueWhite,
    )
    leftWing.position.x = -0.22
    dove.add(leftWing)

    const rightWing = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.03, 0.16),
      mats.statueWhite,
    )
    rightWing.position.x = 0.22
    dove.add(rightWing)

    scene.add(dove)
    doves.push({
      group: dove,
      leftWing,
      rightWing,
      angle: (i / 4) * Math.PI * 2,
    })
  }

  let bellRingEnergy = 0

  function applyTimeOfDay(mode: SceneTimeOfDay) {
    const p = TIME_PRESETS[mode]
    skyMat.uniforms.topColor.value.setHex(p.topColor)
    skyMat.uniforms.horizonColor.value.setHex(p.horizonColor)
    skyMat.uniforms.bottomColor.value.setHex(p.bottomColor)
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.setHex(p.fogColor)
    }

    sunLight.color.setHex(p.sunColor)
    sunLight.intensity = p.sunIntensity
    sunLight.position.set(...p.sunPos)
    sunOrb.position.copy(sunLight.position).multiplyScalar(2.2)
    sunOrbMat.color.setHex(mode === 'night' ? 0xe2e8f0 : p.sunColor)

    hemiLight.color.setHex(p.hemiSky)
    hemiLight.groundColor.setHex(p.hemiGround)
    hemiLight.intensity = p.hemiIntensity

    mats.stainedGlass.emissiveIntensity = p.windowEmissive
    mats.stainedBlue.emissiveIntensity = p.windowEmissive * 0.85
    mats.stainedRose.emissiveIntensity = p.windowEmissive * 0.85

    lanternLights.forEach((l) => {
      l.intensity = p.lanternIntensity
    })
  }

  function stepAnimation(t: number) {
    clouds.forEach((c) => {
      c.group.position.x += c.speed * 0.016
      if (c.group.position.x > 55) c.group.position.x = -55
      c.group.position.y = c.baseY + Math.sin(t * 0.8 + c.phase) * 0.35
    })

    animatedTrees.forEach((tr) => {
      tr.crown.rotation.z = Math.sin(t * tr.speed + tr.phase) * 0.035
      tr.crown.rotation.x = Math.cos(t * tr.speed * 0.8 + tr.phase) * 0.025
    })

    sheepList.forEach((s) => {
      s.mesh.position.y = s.baseY + Math.abs(Math.sin(t * 1.8 + s.phase)) * 0.08
    })

    doves.forEach((doveItem, idx) => {
      const a = t * 0.72 + doveItem.angle
      const rx = 7.8 + Math.sin(t * 0.5 + idx) * 1.2
      const rz = 4.8 + Math.cos(t * 0.5 + idx) * 1.0
      const cx = Math.cos(a) * rx
      const cz = 4.5 + Math.sin(a) * rz
      const cy = 18.5 + Math.sin(t * 1.5 + idx) * 1.1
      doveItem.group.position.set(cx, cy, cz)
      doveItem.group.rotation.y = -a
      const flap = Math.sin(t * 14 + idx * 2) * 0.45
      doveItem.leftWing.rotation.z = flap
      doveItem.rightWing.rotation.z = -flap
    })

    if (bellRingEnergy > 0.005) {
      bellPivots.forEach(({ pivot, phaseOffset }) => {
        pivot.rotation.z =
          Math.sin(t * 6.5 + phaseOffset) * 0.55 * bellRingEnergy
      })
      bellRingEnergy *= 0.991
    } else {
      bellPivots.forEach(({ pivot }) => {
        pivot.rotation.z = 0
      })
    }

    const posArr = particles.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < particleCount; i++) {
      posArr[i * 3 + 1] += Math.sin(t + i) * 0.005
    }
    particles.geometry.attributes.position.needsUpdate = true
  }

  function triggerBellRing() {
    bellRingEnergy = 1.0
  }

  return {
    scene,
    applyTimeOfDay,
    stepAnimation,
    triggerBellRing,
  }
}

export interface SaigonNotreDameSceneProps {
  isDark?: boolean
  className?: string
}

export function SaigonNotreDameScene({
  isDark = false,
  className,
}: SaigonNotreDameSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneControllerRef = useRef<BuiltCathedralScene | null>(null)

  // Sync with parent theme toggle
  useEffect(() => {
    const nextMode: SceneTimeOfDay = isDark ? 'night' : 'day'
    sceneControllerRef.current?.applyTimeOfDay(nextMode)
  }, [isDark])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      })
    } catch {
      // Fallback if WebGL context is unavailable (e.g. headless test runner)
      return
    }

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || 680

    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    container.appendChild(renderer.domElement)

    const initialCam = getResponsiveCameraConfig(width, height)
    const camera = new THREE.PerspectiveCamera(
      initialCam.fov,
      width / height,
      0.1,
      400,
    )
    camera.position.set(...initialCam.pos)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enableZoom = false
    controls.enablePan = false
    controls.maxPolarAngle = Math.PI / 2 + 0.35
    controls.minDistance = 8
    controls.maxDistance = 95
    controls.target.set(...initialCam.look)

    // Shift camera frustum center on desktop (right side) and on mobile/tablet (bottom of scene)
    const updateCameraFraming = (w: number, h: number) => {
      const cfg = getResponsiveCameraConfig(w, h)
      camera.fov = cfg.fov
      camera.aspect = w / h
      camera.position.set(...cfg.pos)
      controls.target.set(...cfg.look)
      if (cfg.useDesktopOffset) {
        // Negative x-offset shifts rendered objects to the right side of the canvas
        camera.setViewOffset(w, h, -w * 0.22, 0, w, h)
      } else if (cfg.mobileYOffsetRatio) {
        // Negative y-offset pans the camera frustum up so objects stay at the bottom of the mobile scene
        camera.setViewOffset(w, h, 0, h * cfg.mobileYOffsetRatio, w, h)
      } else {
        camera.clearViewOffset()
      }
      camera.updateProjectionMatrix()
      controls.update()
    }
    updateCameraFraming(width, height)

    const built = buildSaigonNotreDameScene()
    sceneControllerRef.current = built
    built.applyTimeOfDay(isDark ? 'night' : 'day')

    const clock = new THREE.Clock()
    let animFrameId = 0

    const animate = () => {
      animFrameId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      built.stepAnimation(t)

      controls.update()
      renderer.render(built.scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!mountRef.current) return
      const newW = mountRef.current.clientWidth || window.innerWidth
      const newH = mountRef.current.clientHeight || 680
      updateCameraFraming(newW, newH)
      renderer.setSize(newW, newH)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animFrameId)
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      className={cn('relative w-full h-full overflow-hidden', className)}
      data-testid="saigon-notre-dame-scene"
    >
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        data-testid="saigon-notre-dame-canvas-mount"
      />
    </div>
  )
}
