import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { Camera, RefreshCw } from 'lucide-react'
import type { IScannerControls } from '@zxing/browser'

interface QRScannerProps {
  onScan: (studentCode: string) => void
  active: boolean
}

// Check for native BarcodeDetector support
const hasNativeBarcodeDetector = () => {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

export function QRScanner({ onScan, active }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment',
  )
  const [detectorError, setDetectorError] = useState<string | null>(null)

  const zxingControlsRef = useRef<IScannerControls | null>(null)
  const activeStreamRef = useRef<MediaStream | null>(null)
  const animationFrameIdRef = useRef<number | null>(null)

  // Switch facing mode (back vs front camera)
  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  useEffect(() => {
    if (!active) {
      cleanupCamera()
      return
    }

    let isComponentMounted = true

    async function startCamera() {
      cleanupCamera() // Ensure clean state

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!isComponentMounted) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        activeStreamRef.current = stream
        setHasPermission(true)

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Try native BarcodeDetector first
        if (hasNativeBarcodeDetector()) {
          try {
            // @ts-ignore - BarcodeDetector is a draft spec
            const detector = new BarcodeDetector({ formats: ['qr_code'] })

            const scanFrame = async () => {
              if (
                !videoRef.current ||
                !activeStreamRef.current ||
                !isComponentMounted
              )
                return

              if (
                videoRef.current.readyState ===
                videoRef.current.HAVE_ENOUGH_DATA
              ) {
                try {
                  const barcodes = await detector.detect(videoRef.current)
                  if (barcodes.length > 0 && barcodes[0].rawValue) {
                    onScan(barcodes[0].rawValue)
                  }
                } catch (err) {
                  // Ignore detection frame errors
                }
              }
              // Throttle to about ~10 FPS for native scanning to preserve CPU/battery
              setTimeout(() => {
                if (isComponentMounted && active) {
                  animationFrameIdRef.current = requestAnimationFrame(scanFrame)
                }
              }, 100)
            }

            animationFrameIdRef.current = requestAnimationFrame(scanFrame)
            return
          } catch (e) {
            console.warn(
              'Native BarcodeDetector creation failed, falling back to ZXing:',
              e,
            )
          }
        }

        // Fallback: ZXing @zxing/browser
        const codeReader = new BrowserQRCodeReader()
        const controls = await codeReader.decodeFromStream(
          stream,
          videoRef.current!,
          (result) => {
            if (!isComponentMounted) return
            if (result && result.getText()) {
              onScan(result.getText())
            }
          },
        )
        zxingControlsRef.current = controls
      } catch (err: any) {
        console.error('Camera startup error:', err)
        if (isComponentMounted) {
          setHasPermission(false)
          setDetectorError(
            err.message || 'Camera permission denied or not available',
          )
        }
      }
    }

    startCamera()

    return () => {
      isComponentMounted = false
      cleanupCamera()
    }
  }, [active, facingMode, onScan])

  const cleanupCamera = () => {
    // Stop native loop
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current)
      animationFrameIdRef.current = null
    }

    // Stop ZXing controls
    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop()
      zxingControlsRef.current = null
    }

    // Stop active tracks
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop())
      activeStreamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  if (hasPermission === false) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-neutral-900 text-white rounded-lg aspect-video">
        <Camera className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-center font-semibold mb-2">
          Không thể truy cập camera
        </p>
        <p className="text-sm text-neutral-400 text-center mb-4">
          {detectorError}
        </p>
        <button
          onClick={() => setFacingMode((f) => f)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-sm font-medium rounded-md transition-colors"
        >
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
      {/* Video stream container */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="w-full h-full object-cover"
      />

      {/* Target scanning viewport overlay */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
        {/* Semi-transparent backdrops around viewport */}
        <div className="bg-black/60 h-1/4 w-full" />
        <div className="flex h-2/4 w-full">
          <div className="bg-black/60 w-1/12 md:w-1/4 h-full" />
          {/* Main viewport box */}
          <div className="relative w-10/12 md:w-2/4 h-full border-2 border-emerald-500 rounded-lg">
            {/* Viewport corners */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br" />
            {/* Animated scanning laser line */}
            <div className="absolute top-0 inset-x-0 h-0.5 bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,1)] animate-bounce" />
          </div>
          <div className="bg-black/60 w-1/12 md:w-1/4 h-full" />
        </div>
        <div className="bg-black/60 h-1/4 w-full flex items-center justify-center">
          <p className="text-white text-xs font-semibold px-4 py-2 bg-black/80 rounded-full border border-neutral-700 select-none">
            Căn khung QR code vào giữa vùng quét
          </p>
        </div>
      </div>

      {/* Camera switcher button */}
      <button
        onClick={toggleCamera}
        className="absolute top-4 right-4 p-3 bg-neutral-800/80 hover:bg-neutral-700/80 text-white rounded-full border border-neutral-600 transition-colors shadow-md active:scale-95"
        title="Đổi Camera"
      >
        <RefreshCw className="w-5 h-5" />
      </button>
    </div>
  )
}
