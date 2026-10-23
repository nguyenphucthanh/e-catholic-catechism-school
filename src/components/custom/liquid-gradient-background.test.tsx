import { fireEvent, render, screen } from '@testing-library/react'
import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LiquidGradientBackground,
  TouchTexture,
  applyPaletteToMaterial,
  createLiquidGradientMaterial,
  getLiquidGradientPalette,
} from './liquid-gradient-background'

const mockRendererState = {
  shouldThrow: false,
  domElement: null as HTMLCanvasElement | null,
  setSize: vi.fn(),
  setPixelRatio: vi.fn(),
  render: vi.fn(),
  dispose: vi.fn(),
}

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>()
  class MockWebGLRenderer {
    domElement: HTMLCanvasElement
    setSize = mockRendererState.setSize
    setPixelRatio = mockRendererState.setPixelRatio
    render = mockRendererState.render
    dispose = mockRendererState.dispose

    constructor() {
      if (mockRendererState.shouldThrow) {
        throw new Error('WebGL unavailable')
      }
      this.domElement =
        mockRendererState.domElement ?? document.createElement('canvas')
    }
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  }
})

describe('liquid-gradient-background', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    mockRendererState.shouldThrow = false
    mockRendererState.domElement = null
    mockRendererState.setSize.mockReset()
    mockRendererState.setPixelRatio.mockReset()
    mockRendererState.render.mockReset()
    mockRendererState.dispose.mockReset()
  })

  describe('TouchTexture', () => {
    it('initializes with default and custom sizes when 2D context is mocked', () => {
      const fillRectSpy = vi.fn()
      const beginPathSpy = vi.fn()
      const arcSpy = vi.fn()
      const fillSpy = vi.fn()

      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowBlur: 0,
        shadowColor: '',
        fillRect: fillRectSpy,
        beginPath: beginPathSpy,
        arc: arcSpy,
        fill: fillSpy,
      } as unknown as RenderingContext)

      const touchTex = new TouchTexture(32)
      expect(touchTex.size).toBe(32)
      expect(fillRectSpy).toHaveBeenCalledWith(0, 0, 32, 32)

      // First touch point has 0 velocity and 0 force
      touchTex.addTouch({ x: 0.2, y: 0.3 })
      expect(touchTex.trail).toHaveLength(1)
      expect(touchTex.trail[0].force).toBe(0)

      // Duplicate touch at exact same coordinates is ignored
      touchTex.addTouch({ x: 0.2, y: 0.3 })
      expect(touchTex.trail).toHaveLength(1)

      // Moving touch computes velocity and force
      touchTex.addTouch({ x: 0.45, y: 0.65 })
      expect(touchTex.trail).toHaveLength(2)
      expect(touchTex.trail[1].force).toBeGreaterThan(0)

      // Step update through young age (< maxAge * 0.3) and older age (>= maxAge * 0.3) until expiration (> maxAge)
      for (let i = 0; i <= touchTex.maxAge + 1; i++) {
        touchTex.update()
      }

      expect(beginPathSpy).toHaveBeenCalled()
      expect(arcSpy).toHaveBeenCalled()
      expect(fillSpy).toHaveBeenCalled()
      expect(touchTex.trail).toHaveLength(0)

      const disposeSpy = vi.spyOn(touchTex.texture, 'dispose')
      touchTex.dispose()
      expect(disposeSpy).toHaveBeenCalled()
    })

    it('handles null 2D canvas context gracefully', () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
      const touchTex = new TouchTexture()
      touchTex.addTouch({ x: 0.5, y: 0.5 })
      expect(() => touchTex.update()).not.toThrow()
    })
  })

  describe('palette and material helpers', () => {
    it('returns distinct palettes for light and dark mode and updates ShaderMaterial uniforms', () => {
      const lightPalette = getLiquidGradientPalette(false)
      const darkPalette = getLiquidGradientPalette(true)

      expect(lightPalette.baseColor.x).toBeGreaterThan(darkPalette.baseColor.x)
      expect(darkPalette.intensity).toBeGreaterThan(lightPalette.intensity)

      const dummyTex = new THREE.Texture()
      const resolution = new THREE.Vector2(1280, 720)
      const mat = createLiquidGradientMaterial(
        lightPalette,
        dummyTex,
        resolution,
        0.9,
      )

      expect(mat.uniforms.uSpeed.value).toBe(0.9)
      expect(mat.uniforms.uIntensity.value).toBe(lightPalette.intensity)

      applyPaletteToMaterial(mat, darkPalette)
      expect(mat.uniforms.uIntensity.value).toBe(darkPalette.intensity)
      expect(mat.uniforms.uGrainIntensity.value).toBe(
        darkPalette.grainIntensity,
      )
      expect(mat.uniforms.uBaseColor.value.x).toBeCloseTo(
        darkPalette.baseColor.x,
      )
    })
  })

  describe('LiquidGradientBackground component', () => {
    let rafCallbacks: Array<FrameRequestCallback> = []

    beforeEach(() => {
      rafCallbacks = []
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallbacks.push(cb)
        return rafCallbacks.length
      })
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    })

    it('renders container smoothly when WebGLRenderer throws', () => {
      mockRendererState.shouldThrow = true
      render(<LiquidGradientBackground className="test-bg" />)
      const el = screen.getByTestId('liquid-gradient-background')
      expect(el).toBeDefined()
      expect(el.className).toContain('test-bg')
    })

    it('mounts WebGL scene, tracks pointer/touch/resize events, updates theme, and cleans up on unmount', () => {
      const domElement = document.createElement('canvas')
      mockRendererState.domElement = domElement

      const { rerender, unmount } = render(
        <LiquidGradientBackground isDark={false} speed={0.85} />,
      )

      const container = screen.getByTestId('liquid-gradient-background')
      vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      })

      expect(mockRendererState.setSize).toHaveBeenCalled()

      // Mousemove inside and outside container bounds
      fireEvent.mouseMove(window, { clientX: 200, clientY: 150 })
      fireEvent.mouseMove(window, { clientX: 250, clientY: 180 })
      fireEvent.mouseMove(window, { clientX: 1200, clientY: 900 })

      // Touchmove with active touch and with empty touches
      fireEvent.touchMove(window, {
        touches: [{ clientX: 300, clientY: 200 }],
      })
      fireEvent.touchMove(window, { touches: [] })

      // Run animation frame tick
      expect(rafCallbacks.length).toBeGreaterThan(0)
      rafCallbacks[rafCallbacks.length - 1](performance.now() + 100)
      expect(mockRendererState.render).toHaveBeenCalled()

      // Toggle dark mode while mounted
      rerender(<LiquidGradientBackground isDark={true} speed={0.85} />)
      rerender(<LiquidGradientBackground isDark={false} speed={0.85} />)

      // Resize window
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440,
      })
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 900,
      })
      fireEvent(window, new Event('resize'))

      unmount()
      expect(mockRendererState.dispose).toHaveBeenCalled()
    })
  })
})
