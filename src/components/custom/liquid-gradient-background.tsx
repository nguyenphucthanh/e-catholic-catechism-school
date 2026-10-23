import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export interface TouchPoint {
  x: number
  y: number
  age: number
  force: number
  vx: number
  vy: number
}

export interface LiquidGradientPalette {
  baseColor: THREE.Vector3
  color1: THREE.Vector3
  color2: THREE.Vector3
  color3: THREE.Vector3
  color4: THREE.Vector3
  color5: THREE.Vector3
  color6: THREE.Vector3
  intensity: number
  grainIntensity: number
}

export interface LiquidGradientBackgroundProps {
  isDark?: boolean
  className?: string
  speed?: number
}

/**
 * Offscreen 2D canvas texture that records pointer/touch trails with velocity
 * and age decay, sampled by the liquid gradient fragment shader to warp UVs
 * and create interactive ripples.
 */
export class TouchTexture {
  size = 64
  width = 64
  height = 64
  maxAge = 64
  radius = 0.25 * 64
  speed = 1 / 64
  trail: Array<TouchPoint> = []
  last: { x: number; y: number } | null = null
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D | null
  texture: THREE.Texture

  constructor(size = 64) {
    this.size = size
    this.width = size
    this.height = size
    this.maxAge = 64
    this.radius = 0.25 * this.size
    this.speed = 1 / this.maxAge

    this.canvas = document.createElement('canvas')
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.ctx = this.canvas.getContext('2d')
    this.clear()
    this.texture = new THREE.Texture(this.canvas)
    this.texture.needsUpdate = true
  }

  clear() {
    if (!this.ctx) return
    this.ctx.fillStyle = 'black'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
  }

  addTouch(point: { x: number; y: number }) {
    let force = 0
    let vx = 0
    let vy = 0
    const last = this.last

    if (last) {
      const dx = point.x - last.x
      const dy = point.y - last.y
      if (dx === 0 && dy === 0) return

      const dd = dx * dx + dy * dy
      const d = Math.sqrt(dd)
      vx = dx / d
      vy = dy / d
      force = Math.min(dd * 20000, 2.0)
    }

    this.last = { x: point.x, y: point.y }
    this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy })
  }

  update() {
    this.clear()
    const ageSpeed = this.speed

    for (let i = this.trail.length - 1; i >= 0; i--) {
      const point = this.trail[i]
      const f = point.force * ageSpeed * (1 - point.age / this.maxAge)
      point.x += point.vx * f
      point.y += point.vy * f
      point.age++

      if (point.age > this.maxAge) {
        this.trail.splice(i, 1)
      } else {
        this.drawPoint(point)
      }
    }

    this.texture.needsUpdate = true
  }

  drawPoint(point: TouchPoint) {
    if (!this.ctx) return

    const pos = {
      x: point.x * this.width,
      y: (1 - point.y) * this.height,
    }

    let intensity = 1
    const halfMax = this.maxAge * 0.3
    if (point.age < halfMax) {
      intensity = Math.sin((point.age / halfMax) * (Math.PI / 2))
    } else {
      const t = 1 - (point.age - halfMax) / (this.maxAge - halfMax)
      intensity = -t * (t - 2)
    }
    intensity *= point.force

    const radius = this.radius
    const r = ((point.vx + 1) / 2) * 255
    const g = ((point.vy + 1) / 2) * 255
    const b = intensity * 255
    const color = `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`

    const offset = this.size * 5
    this.ctx.shadowOffsetX = offset
    this.ctx.shadowOffsetY = offset
    this.ctx.shadowBlur = radius * 1
    this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`

    this.ctx.beginPath()
    this.ctx.fillStyle = 'rgba(255,0,0,1)'
    this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2)
    this.ctx.fill()
  }

  dispose() {
    this.texture.dispose()
  }
}

/**
 * Returns the site-matched color scheme for the liquid gradient shader.
 * Uses eCCS liturgical royal purple (`#7a38cb` / `#6c27bd`), warm gold/amber
 * (`#fed17b` / `#ecc06c`), soft orchid (`#a855f7`), and theme background tones.
 */
export function getLiquidGradientPalette(
  isDark: boolean,
): LiquidGradientPalette {
  if (isDark) {
    return {
      // Deep violet-charcoal base matching .dark --background
      baseColor: new THREE.Vector3(0.075, 0.059, 0.114),
      // Royal violet (#7a38cb)
      color1: new THREE.Vector3(0.478, 0.22, 0.796),
      // Warm liturgical gold (#ecc06c)
      color2: new THREE.Vector3(0.78, 0.56, 0.24),
      // Deep amethyst (#531c9c)
      color3: new THREE.Vector3(0.325, 0.11, 0.612),
      // Luminous orchid (#9b4dff)
      color4: new THREE.Vector3(0.55, 0.25, 0.88),
      // Warm amber glow (#d98a2b)
      color5: new THREE.Vector3(0.68, 0.44, 0.18),
      // Midnight indigo-violet (#1e1333)
      color6: new THREE.Vector3(0.14, 0.09, 0.24),
      intensity: 1.35,
      grainIntensity: 0.045,
    }
  }

  return {
    // Soft alabaster-lavender base matching :root --background
    baseColor: new THREE.Vector3(0.968, 0.958, 0.988),
    // Soft royal lavender-violet
    color1: new THREE.Vector3(0.79, 0.69, 0.98),
    // Warm liturgical gold-cream (#fed17b)
    color2: new THREE.Vector3(0.996, 0.855, 0.58),
    // Orchid lilac
    color3: new THREE.Vector3(0.85, 0.74, 0.99),
    // Soft amber-champagne
    color4: new THREE.Vector3(0.99, 0.89, 0.68),
    // Periwinkle violet
    color5: new THREE.Vector3(0.76, 0.66, 0.96),
    // Pure warm ivory highlight
    color6: new THREE.Vector3(0.98, 0.96, 0.995),
    intensity: 1.08,
    grainIntensity: 0.028,
  }
}

export const LIQUID_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const LIQUID_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uBaseColor;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  uniform vec3 uColor5;
  uniform vec3 uColor6;
  uniform float uSpeed;
  uniform float uIntensity;
  uniform sampler2D uTouchTexture;
  uniform float uGrainIntensity;

  varying vec2 vUv;

  float grain(vec2 uv, float time) {
    vec2 seed = uv * uResolution * 0.5;
    return fract(sin(dot(seed + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  }

  vec2 rotate2d(vec2 uv, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    mat2 m = mat2(c, -s, s, c);
    return m * (uv - 0.5) + 0.5;
  }

  vec3 getGradientColor(vec2 uv, float time) {
    vec2 rUv = rotate2d(uv, sin(time * 0.15) * 0.35);

    vec2 center1 = vec2(
      0.5 + sin(time * 0.45) * 0.38,
      0.5 + cos(time * 0.55) * 0.36
    );
    vec2 center2 = vec2(
      0.5 + cos(time * 0.6) * 0.4,
      0.5 + sin(time * 0.4) * 0.38
    );
    vec2 center3 = vec2(
      0.5 + sin(time * 0.35 + 2.1) * 0.42,
      0.5 + cos(time * 0.5 + 1.4) * 0.35
    );
    vec2 center4 = vec2(
      0.5 + cos(time * 0.5 + 3.2) * 0.36,
      0.5 + sin(time * 0.65 + 2.5) * 0.4
    );
    vec2 center5 = vec2(
      0.5 + sin(time * 0.55 + 4.2) * 0.35,
      0.5 + cos(time * 0.38 + 3.7) * 0.42
    );
    vec2 center6 = vec2(
      0.5 + cos(time * 0.42 + 5.1) * 0.4,
      0.5 + sin(time * 0.52 + 4.6) * 0.35
    );

    float d1 = 1.0 - smoothstep(0.0, 0.78, distance(rUv, center1));
    float d2 = 1.0 - smoothstep(0.0, 0.78, distance(rUv, center2));
    float d3 = 1.0 - smoothstep(0.0, 0.82, distance(rUv, center3));
    float d4 = 1.0 - smoothstep(0.0, 0.76, distance(rUv, center4));
    float d5 = 1.0 - smoothstep(0.0, 0.8, distance(rUv, center5));
    float d6 = 1.0 - smoothstep(0.0, 0.84, distance(rUv, center6));

    vec3 col = uBaseColor;
    col = mix(col, uColor1, d1 * 0.75);
    col = mix(col, uColor2, d2 * 0.7);
    col = mix(col, uColor3, d3 * 0.65);
    col = mix(col, uColor4, d4 * 0.6);
    col = mix(col, uColor5, d5 * 0.6);
    col = mix(col, uColor6, d6 * 0.55);

    return col;
  }

  void main() {
    vec2 uv = vUv;

    vec4 touch = texture2D(uTouchTexture, uv);
    vec2 touchDir = touch.rg * 2.0 - 1.0;
    float touchStrength = touch.b;

    // Interactive liquid distortion & ripple wave from cursor trail
    float ripple = sin(length(touchDir) * 18.0 - uTime * 4.0) * 0.03 * touchStrength;
    uv += touchDir * (0.14 * touchStrength) + ripple;

    // Subtle organic wave motion
    float t = uTime * uSpeed;
    uv.x += sin(uv.y * 4.5 + t * 0.7) * 0.025;
    uv.y += cos(uv.x * 4.5 + t * 0.6) * 0.025;

    vec3 color = getGradientColor(uv, t);

    // Highlight sheen along interactive touch ripples
    color += vec3(0.08, 0.05, 0.12) * touchStrength;

    // Apply intensity and film grain
    color = mix(uBaseColor, color, uIntensity);
    color += grain(vUv, uTime) * uGrainIntensity;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`

export function createLiquidGradientMaterial(
  palette: LiquidGradientPalette,
  touchTexture: THREE.Texture,
  resolution: THREE.Vector2,
  speed = 0.85,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: LIQUID_VERTEX_SHADER,
    fragmentShader: LIQUID_FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: resolution },
      uBaseColor: { value: palette.baseColor.clone() },
      uColor1: { value: palette.color1.clone() },
      uColor2: { value: palette.color2.clone() },
      uColor3: { value: palette.color3.clone() },
      uColor4: { value: palette.color4.clone() },
      uColor5: { value: palette.color5.clone() },
      uColor6: { value: palette.color6.clone() },
      uSpeed: { value: speed },
      uIntensity: { value: palette.intensity },
      uTouchTexture: { value: touchTexture },
      uGrainIntensity: { value: palette.grainIntensity },
    },
    depthTest: false,
    depthWrite: false,
  })
}

export function applyPaletteToMaterial(
  material: THREE.ShaderMaterial,
  palette: LiquidGradientPalette,
) {
  material.uniforms.uBaseColor.value.copy(palette.baseColor)
  material.uniforms.uColor1.value.copy(palette.color1)
  material.uniforms.uColor2.value.copy(palette.color2)
  material.uniforms.uColor3.value.copy(palette.color3)
  material.uniforms.uColor4.value.copy(palette.color4)
  material.uniforms.uColor5.value.copy(palette.color5)
  material.uniforms.uColor6.value.copy(palette.color6)
  material.uniforms.uIntensity.value = palette.intensity
  material.uniforms.uGrainIntensity.value = palette.grainIntensity
}

export function LiquidGradientBackground({
  isDark = false,
  className = '',
  speed = 0.85,
}: LiquidGradientBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const isDarkRef = useRef(isDark)

  useEffect(() => {
    isDarkRef.current = isDark
    const palette = getLiquidGradientPalette(isDark)
    if (materialRef.current) {
      applyPaletteToMaterial(materialRef.current, palette)
    }
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(
        palette.baseColor.x,
        palette.baseColor.y,
        palette.baseColor.z,
      )
    }
  }, [isDark])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth || window.innerWidth || 1024
    const height = container.clientHeight || window.innerHeight || 768

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
        depth: false,
      })
    } catch {
      return
    }

    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    container.appendChild(renderer.domElement)

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const scene = new THREE.Scene()
    sceneRef.current = scene

    const initialPalette = getLiquidGradientPalette(isDarkRef.current)
    scene.background = new THREE.Color(
      initialPalette.baseColor.x,
      initialPalette.baseColor.y,
      initialPalette.baseColor.z,
    )

    const touchTexture = new TouchTexture()
    const resolution = new THREE.Vector2(width, height)
    const material = createLiquidGradientMaterial(
      initialPalette,
      touchTexture.texture,
      resolution,
      speed,
    )
    materialRef.current = material

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const updatePointerFromClientXY = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect()
      const rectWidth = rect.width || width
      const rectHeight = rect.height || height
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        const x = (clientX - rect.left) / rectWidth
        const y = 1 - (clientY - rect.top) / rectHeight
        touchTexture.addTouch({ x, y })
      }
    }

    const handleMouseMove = (ev: MouseEvent) => {
      updatePointerFromClientXY(ev.clientX, ev.clientY)
    }

    const handleTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length > 0) {
        const touch = ev.touches[0]
        updatePointerFromClientXY(touch.clientX, touch.clientY)
      }
    }

    const handleResize = () => {
      const newW = container.clientWidth || window.innerWidth || 1024
      const newH = container.clientHeight || window.innerHeight || 768
      renderer.setSize(newW, newH)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      material.uniforms.uResolution.value.set(newW, newH)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('resize', handleResize)

    let animationFrameId = 0
    const startTime = performance.now()

    const tick = (now: number) => {
      animationFrameId = requestAnimationFrame(tick)
      material.uniforms.uTime.value = (now - startTime) * 0.001
      touchTexture.update()
      renderer.render(scene, camera)
    }
    animationFrameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('resize', handleResize)
      materialRef.current = null
      sceneRef.current = null
      geometry.dispose()
      material.dispose()
      touchTexture.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [speed])

  return (
    <div
      ref={containerRef}
      data-testid="liquid-gradient-background"
      aria-hidden="true"
      className={`pointer-events-none overflow-hidden ${className}`}
    />
  )
}
