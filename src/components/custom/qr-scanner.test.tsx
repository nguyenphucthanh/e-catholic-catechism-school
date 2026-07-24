import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QRScanner } from './qr-scanner'

// Mock @zxing/browser with regular function constructor
vi.mock('@zxing/browser', () => {
  return {
    BrowserQRCodeReader: vi.fn().mockImplementation(function (this: any) {
      this.decodeFromStream = vi.fn().mockResolvedValue({
        stop: vi.fn(),
      })
    }),
  }
})

describe('QRScanner component', () => {
  let mockGetUserMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockGetUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [
        {
          stop: vi.fn(),
        },
      ],
    })

    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {
        getUserMedia: mockGetUserMedia,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error - BarcodeDetector is draft window property
    delete window.BarcodeDetector
  })

  it('renders video element when active and permission is granted', async () => {
    render(<QRScanner active={true} onScan={vi.fn()} />)

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
    })

    expect(
      screen.getByText('Căn khung QR code vào giữa vùng quét'),
    ).toBeInTheDocument()
  })

  it('toggles camera facing mode when switch camera button is clicked', async () => {
    render(<QRScanner active={true} onScan={vi.fn()} />)

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({ facingMode: 'environment' }),
        }),
      )
    })

    const switchBtn = screen.getByTitle('Đổi Camera')
    fireEvent.click(switchBtn)

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({ facingMode: 'user' }),
        }),
      )
    })
  })

  it('displays error state when camera permission fails', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'))

    render(<QRScanner active={true} onScan={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Không thể truy cập camera')).toBeInTheDocument()
      expect(screen.getByText('Permission denied')).toBeInTheDocument()
    })

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i })
    fireEvent.click(retryBtn)
  })

  it('cleans up camera stream when inactive', async () => {
    const stopTrackMock = vi.fn()
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: stopTrackMock }],
    })

    const { rerender } = render(<QRScanner active={true} onScan={vi.fn()} />)
    await waitFor(() => expect(mockGetUserMedia).toHaveBeenCalled())

    rerender(<QRScanner active={false} onScan={vi.fn()} />)
    await waitFor(() => {
      expect(stopTrackMock).toHaveBeenCalled()
    })
  })

  it('supports native BarcodeDetector when present', async () => {
    const mockDetect = vi.fn().mockResolvedValue([{ rawValue: 'STUDENT123' }])

    // @ts-expect-error - BarcodeDetector is draft window property
    window.BarcodeDetector = function BarcodeDetector() {
      return { detect: mockDetect }
    }

    const onScanMock = vi.fn()

    render(<QRScanner active={true} onScan={onScanMock} />)

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled()
    })
  })
})
