import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compressAndResizeImage } from './image'

describe('compressAndResizeImage', () => {
  let originalFileReader: typeof FileReader
  let originalImage: typeof Image
  let originalToBlob: any
  let originalGetContext: any

  beforeEach(() => {
    originalFileReader = global.FileReader
    originalImage = global.Image
    originalToBlob = HTMLCanvasElement.prototype.toBlob
    originalGetContext = HTMLCanvasElement.prototype.getContext
  })

  afterEach(() => {
    global.FileReader = originalFileReader
    global.Image = originalImage
    HTMLCanvasElement.prototype.toBlob = originalToBlob
    HTMLCanvasElement.prototype.getContext = originalGetContext
    vi.restoreAllMocks()
  })

  it('should return the original file if the file is not an image', async () => {
    const file = new File(['text content'], 'test.txt', { type: 'text/plain' })
    const result = await compressAndResizeImage(file)
    expect(result).toBe(file)
  })

  it('should return the original file if window is undefined (simulated server-side environment)', async () => {
    // Temporarily delete window
    const originalWindow = global.window
    // @ts-expect-error - deleting window to simulate server-side environment
    delete global.window

    try {
      const file = new File(['image content'], 'test.png', {
        type: 'image/png',
      })
      const result = await compressAndResizeImage(file)
      expect(result).toBe(file)
    } finally {
      global.window = originalWindow
    }
  })

  it('should compress and resize a large image (landscape: width > height)', async () => {
    const file = new File(['mock image binary'], 'landscape.jpg', {
      type: 'image/jpeg',
    })

    // Mock FileReader
    class MockFileReader {
      onload: any = null
      readAsDataURL(_f: File) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: 'data:image/jpeg;base64,mock' } })
          }
        }, 0)
      }
    }
    // @ts-expect-error - mocking global FileReader for testing
    global.FileReader = MockFileReader

    // Mock Image
    class MockImage {
      onload: any = null
      onerror: any = null
      width = 2000
      height = 1000
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 0)
      }
    }
    // @ts-expect-error - mocking global Image for testing
    global.Image = MockImage

    // Mock Canvas toBlob and getContext
    const drawImageSpy = vi.fn()
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: drawImageSpy,
    })

    HTMLCanvasElement.prototype.toBlob = vi
      .fn()
      .mockImplementation(function (callback, type, quality) {
        // @ts-expect-error - accessing mock canvas properties in mock callback
        expect(this.width).toBe(1024) // landscape: scaled from 2000x1000 down to 1024 max width
        // @ts-expect-error - accessing mock canvas properties in mock callback
        expect(this.height).toBe(512) // aspect ratio preserved (512)
        expect(type).toBe('image/jpeg')
        expect(quality).toBe(0.8)

        const mockBlob = new Blob(['compressed content'], {
          type: 'image/jpeg',
        })
        callback(mockBlob)
      })

    const result = await compressAndResizeImage(file, 1024, 1024, 0.8)
    expect(result).toBeInstanceOf(File)
    expect(result.name).toBe('landscape.jpg')
    expect(result.type).toBe('image/jpeg')
    expect(drawImageSpy).toHaveBeenCalled()
  })

  it('should compress and resize a large image (portrait: height > width)', async () => {
    const file = new File(['mock image binary'], 'portrait.png', {
      type: 'image/png',
    })

    // Mock FileReader
    class MockFileReader {
      onload: any = null
      readAsDataURL(_f: File) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: 'data:image/png;base64,mock' } })
          }
        }, 0)
      }
    }
    // @ts-expect-error - mocking global FileReader for testing
    global.FileReader = MockFileReader

    // Mock Image
    class MockImage {
      onload: any = null
      onerror: any = null
      width = 1200
      height = 2400
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 0)
      }
    }
    // @ts-expect-error - mocking global Image for testing
    global.Image = MockImage

    const drawImageSpy = vi.fn()
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: drawImageSpy,
    })

    HTMLCanvasElement.prototype.toBlob = vi
      .fn()
      .mockImplementation(function (callback) {
        // @ts-expect-error - accessing mock canvas properties in mock callback
        expect(this.width).toBe(512) // portrait: scaled from 1200x2400 down to 1024 max height
        // @ts-expect-error - accessing mock canvas properties in mock callback
        expect(this.height).toBe(1024)

        const mockBlob = new Blob(['compressed content'], {
          type: 'image/jpeg',
        })
        callback(mockBlob)
      })

    const result = await compressAndResizeImage(file, 1024, 1024, 0.85)
    expect(result).toBeInstanceOf(File)
    expect(result.name).toBe('portrait.png')
    expect(result.type).toBe('image/jpeg')
    expect(drawImageSpy).toHaveBeenCalled()
  })

  it('should resolve with original file if image load fails', async () => {
    const file = new File(['bad image binary'], 'broken.jpg', {
      type: 'image/jpeg',
    })

    // Mock FileReader
    class MockFileReader {
      onload: any = null
      readAsDataURL(_f: File) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: 'data:image/jpeg;base64,bad' } })
          }
        }, 0)
      }
    }
    // @ts-expect-error - mocking global FileReader for testing
    global.FileReader = MockFileReader

    // Mock Image failure
    class MockImage {
      onload: any = null
      onerror: any = null
      set src(_val: string) {
        setTimeout(() => {
          if (this.onerror) this.onerror(new Error('Load error'))
        }, 0)
      }
    }
    // @ts-expect-error - mocking global Image for testing
    global.Image = MockImage

    const result = await compressAndResizeImage(file)
    expect(result).toBe(file)
  })

  it('should resolve with original file if FileReader fails', async () => {
    const file = new File(['bad image binary'], 'broken.jpg', {
      type: 'image/jpeg',
    })

    // Mock FileReader failure
    class MockFileReader {
      onerror: any = null
      readAsDataURL(_f: File) {
        setTimeout(() => {
          if (this.onerror) {
            this.onerror()
          }
        }, 0)
      }
    }
    // @ts-expect-error - mocking global FileReader for testing
    global.FileReader = MockFileReader

    const result = await compressAndResizeImage(file)
    expect(result).toBe(file)
  })

  it('should resolve with original file if Canvas context is null', async () => {
    const file = new File(['mock image binary'], 'test.jpg', {
      type: 'image/jpeg',
    })

    // Mock FileReader
    class MockFileReader {
      onload: any = null
      readAsDataURL(_f: File) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: 'data:image/jpeg;base64,mock' } })
          }
        }, 0)
      }
    }
    // @ts-expect-error - mocking global FileReader for testing
    global.FileReader = MockFileReader

    // Mock Image
    class MockImage {
      onload: any = null
      onerror: any = null
      width = 500
      height = 500
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 0)
      }
    }
    // @ts-expect-error - mocking global Image for testing
    global.Image = MockImage

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null)

    const result = await compressAndResizeImage(file)
    expect(result).toBe(file)
  })

  it('should resolve with original file if toBlob returns null', async () => {
    const file = new File(['mock image binary'], 'test.jpg', {
      type: 'image/jpeg',
    })

    // Mock FileReader
    class MockFileReader {
      onload: any = null
      readAsDataURL(_f: File) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: 'data:image/jpeg;base64,mock' } })
          }
        }, 0)
      }
    }
    // @ts-expect-error - mocking global FileReader for testing
    global.FileReader = MockFileReader

    // Mock Image
    class MockImage {
      onload: any = null
      onerror: any = null
      width = 500
      height = 500
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 0)
      }
    }
    // @ts-expect-error - mocking global Image for testing
    global.Image = MockImage

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    })

    HTMLCanvasElement.prototype.toBlob = vi
      .fn()
      .mockImplementation(function (callback) {
        callback(null)
      })

    const result = await compressAndResizeImage(file)
    expect(result).toBe(file)
  })

  it('should resolve with original file if drawImage or canvas fails', async () => {
    const file = new File(['mock image binary'], 'test.jpg', {
      type: 'image/jpeg',
    })

    // Mock FileReader
    class MockFileReader {
      onload: any = null
      readAsDataURL(_f: File) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: 'data:image/jpeg;base64,mock' } })
          }
        }, 0)
      }
    }
    // @ts-expect-error - mocking global FileReader for testing
    global.FileReader = MockFileReader

    // Mock Image
    class MockImage {
      onload: any = null
      onerror: any = null
      width = 500
      height = 500
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 0)
      }
    }
    // @ts-expect-error - mocking global Image for testing
    global.Image = MockImage

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: () => {
        throw new Error('Canvas draw failed')
      },
    })

    const result = await compressAndResizeImage(file)
    expect(result).toBe(file)
  })
})
