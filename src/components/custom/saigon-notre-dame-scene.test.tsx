import { fireEvent, render, screen } from '@testing-library/react'
import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CAMERA_PRESETS,
  SaigonNotreDameScene,
  TIME_PRESETS,
  buildSaigonNotreDameScene,
  getResponsiveCameraConfig,
  getTerrainHeight,
  playCathedralBellChime,
} from './saigon-notre-dame-scene'

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
    shadowMap = { enabled: false, type: actual.PCFSoftShadowMap }
    toneMapping = actual.NoToneMapping
    toneMappingExposure = 1
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

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => {
  class MockOrbitControls {
    enableDamping = false
    dampingFactor = 0
    enableZoom = true
    enablePan = true
    maxPolarAngle = 0
    minDistance = 0
    maxDistance = 0
    target = new THREE.Vector3()
    update = vi.fn()
    dispose = vi.fn()
  }
  return { OrbitControls: MockOrbitControls }
})

describe('saigon-notre-dame-scene', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    mockRendererState.shouldThrow = false
    mockRendererState.domElement = null
    mockRendererState.setSize.mockReset()
    mockRendererState.setPixelRatio.mockReset()
    mockRendererState.render.mockReset()
    mockRendererState.dispose.mockReset()
  })

  describe('getTerrainHeight', () => {
    it('returns flat 0 height on the central cathedral plateau', () => {
      expect(getTerrainHeight(0, 0)).toBe(0)
      expect(getTerrainHeight(3, -4)).toBe(0)
    })

    it('carves a negative depression along the stream channel', () => {
      // At z = 0, streamCenterX = 14 + sin(0) * 3.5 = 14
      const streamCenterHeight = getTerrainHeight(14, 0)
      const bankHeight = getTerrainHeight(9, 0)
      expect(streamCenterHeight).toBeLessThan(bankHeight)
      expect(streamCenterHeight).toBeLessThan(-0.5)
    })

    it('drops off sharply outside the island radius (dist > 34)', () => {
      const innerRim = getTerrainHeight(0, 33)
      const outerDrop = getTerrainHeight(0, 39)
      expect(outerDrop).toBeLessThan(innerRim - 1)
    })
  })

  describe('getResponsiveCameraConfig', () => {
    it('returns desktop framing with view offset when width >= 1024', () => {
      const cfg = getResponsiveCameraConfig(1440, 900)
      expect(cfg.fov).toBe(45)
      expect(cfg.pos).toEqual(CAMERA_PRESETS.overview.pos)
      expect(cfg.look).toEqual(CAMERA_PRESETS.overview.look)
      expect(cfg.useDesktopOffset).toBe(true)
      expect(cfg.mobileYOffsetRatio).toBe(0)
    })

    it('returns tablet framing with upward pitch and vertical offset when 640 <= width < 1024', () => {
      const cfg = getResponsiveCameraConfig(768, 1024)
      expect(cfg.fov).toBe(52)
      expect(cfg.pos).toEqual([25, 2.4, 41])
      expect(cfg.look).toEqual([0, 13.5, 1])
      expect(cfg.useDesktopOffset).toBe(false)
      expect(cfg.mobileYOffsetRatio).toBe(-0.16)
    })

    it('returns mobile framing with bottom-anchored vertical offset and scales out on narrow portrait screens', () => {
      const wideMobile = getResponsiveCameraConfig(500, 600)
      expect(wideMobile.fov).toBe(58)
      expect(wideMobile.pos).toEqual([28, 3.2, 47])
      expect(wideMobile.look).toEqual([0, 15.5, 0])
      expect(wideMobile.useDesktopOffset).toBe(false)
      expect(wideMobile.mobileYOffsetRatio).toBe(-0.22)

      const narrowPortrait = getResponsiveCameraConfig(375, 812)
      expect(narrowPortrait.fov).toBe(58)
      expect(narrowPortrait.pos[0]).toBeGreaterThan(wideMobile.pos[0])
      expect(narrowPortrait.pos[2]).toBeGreaterThan(wideMobile.pos[2])
      expect(narrowPortrait.look).toEqual([0, 15.5, 0])
      expect(narrowPortrait.useDesktopOffset).toBe(false)
      expect(narrowPortrait.mobileYOffsetRatio).toBe(-0.22)
    })
  })

  describe('playCathedralBellChime', () => {
    it('synthesizes a 4-harmonic bell chord when AudioContext is available', () => {
      const startSpy = vi.fn()
      const stopSpy = vi.fn()
      const oscConnectSpy = vi.fn()
      const gainConnectSpy = vi.fn()
      const setFreqSpy = vi.fn()
      const setGainSpy = vi.fn()
      const rampGainSpy = vi.fn()

      class MockAudioContext {
        currentTime = 10
        destination = {}
        createOscillator() {
          return {
            type: 'sine',
            frequency: { setValueAtTime: setFreqSpy },
            connect: oscConnectSpy,
            start: startSpy,
            stop: stopSpy,
          }
        }
        createGain() {
          return {
            gain: {
              setValueAtTime: setGainSpy,
              exponentialRampToValueAtTime: rampGainSpy,
            },
            connect: gainConnectSpy,
          }
        }
      }

      vi.stubGlobal('AudioContext', MockAudioContext)
      playCathedralBellChime()

      expect(setFreqSpy).toHaveBeenCalledTimes(4)
      expect(startSpy).toHaveBeenCalledTimes(4)
      expect(stopSpy).toHaveBeenCalledTimes(4)
      expect(oscConnectSpy).toHaveBeenCalledTimes(4)
      expect(gainConnectSpy).toHaveBeenCalledTimes(4)
      expect(rampGainSpy).toHaveBeenCalledTimes(8)
    })

    it('falls back to webkitAudioContext or exits cleanly if unavailable or throwing', () => {
      const origAudio = window.AudioContext
      // @ts-expect-error testing missing AudioContext
      delete window.AudioContext
      expect(() => playCathedralBellChime()).not.toThrow()

      // Throwing AudioContext
      vi.stubGlobal(
        'AudioContext',
        class {
          constructor() {
            throw new Error('Blocked by autoplay')
          }
        },
      )
      expect(() => playCathedralBellChime()).not.toThrow()

      window.AudioContext = origAudio
    })
  })

  describe('buildSaigonNotreDameScene', () => {
    it('builds the 3D scene with procedural Marseille brick texture and steps animations', () => {
      const fillRectSpy = vi.fn()
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: fillRectSpy,
      } as unknown as RenderingContext)

      const built = buildSaigonNotreDameScene()
      expect(built.scene).toBeInstanceOf(THREE.Scene)
      expect(built.scene.children.length).toBeGreaterThan(8)
      expect(fillRectSpy).toHaveBeenCalled()

      // Time of day transitions
      built.applyTimeOfDay('sunset')
      expect((built.scene.fog as THREE.FogExp2).color.getHex()).toBe(
        TIME_PRESETS.sunset.fogColor,
      )

      built.applyTimeOfDay('night')
      expect((built.scene.fog as THREE.FogExp2).color.getHex()).toBe(
        TIME_PRESETS.night.fogColor,
      )

      built.applyTimeOfDay('day')
      expect((built.scene.fog as THREE.FogExp2).color.getHex()).toBe(
        TIME_PRESETS.day.fogColor,
      )

      // Step animation without bell ringing
      built.stepAnimation(0.5)

      // Push a cloud past x = 55 to verify wrap-around to -55
      built.scene.children.forEach((obj) => {
        if (obj.position.z === -18 && obj.children.length === 6) {
          obj.position.x = 55.1
        }
      })

      // Trigger bell ring and step animation
      built.triggerBellRing()
      built.stepAnimation(1.2)

      let wrappedCloudFound = false
      built.scene.children.forEach((obj) => {
        if (obj.position.z === -18 && obj.position.x === -55) {
          wrappedCloudFound = true
        }
      })
      expect(wrappedCloudFound).toBe(true)
    })

    it('falls back gracefully when canvas 2D context is null', () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
      const built = buildSaigonNotreDameScene()
      expect(built.scene).toBeInstanceOf(THREE.Scene)
    })
  })

  describe('SaigonNotreDameScene component', () => {
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

    it('renders smoothly when WebGL context is unavailable', () => {
      mockRendererState.shouldThrow = true
      const { rerender } = render(<SaigonNotreDameScene />)
      expect(screen.getByTestId('saigon-notre-dame-scene')).toBeDefined()
      expect(screen.getByTestId('saigon-notre-dame-canvas-mount')).toBeDefined()

      rerender(<SaigonNotreDameScene isDark={true} />)
      expect(screen.getByTestId('saigon-notre-dame-scene')).toBeDefined()
    })

    it('initializes WebGLRenderer, syncs theme changes, handles resize across breakpoints, and cleans up on unmount', () => {
      const domElement = document.createElement('canvas')
      mockRendererState.domElement = domElement

      const { rerender, unmount } = render(
        <SaigonNotreDameScene isDark={false} />,
      )

      expect(mockRendererState.setSize).toHaveBeenCalled()
      expect(mockRendererState.render).toHaveBeenCalledTimes(1)
      expect(CAMERA_PRESETS.overview.pos).toEqual([21, 1.4, 34])

      // Sync with isDark prop change
      rerender(<SaigonNotreDameScene isDark={true} />)
      rerender(<SaigonNotreDameScene isDark={false} />)

      // Step animation frame callback
      expect(rafCallbacks.length).toBeGreaterThan(0)
      rafCallbacks[rafCallbacks.length - 1](16)
      expect(mockRendererState.render).toHaveBeenCalledTimes(2)

      // Trigger window resize for mobile (< 640), tablet (640..1023), and desktop (>= 1024)
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 390,
      })
      fireEvent(window, new Event('resize'))

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800,
      })
      fireEvent(window, new Event('resize'))

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440,
      })
      fireEvent(window, new Event('resize'))

      unmount()
      expect(mockRendererState.dispose).toHaveBeenCalled()
    })
  })
})
