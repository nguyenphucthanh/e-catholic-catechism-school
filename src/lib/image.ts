/**
 * Compresses and resizes an image file to fit within the specified dimensions and quality.
 *
 * @param file The original image file
 * @param maxWidth The maximum width of the output image (defaults to 1024)
 * @param maxHeight The maximum height of the output image (defaults to 1024)
 * @param quality The compression quality, from 0 to 1 (defaults to 0.8)
 * @returns A promise that resolves to the compressed File, or the original file if compression/resizing fails or is not applicable
 */
export async function compressAndResizeImage(
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.8,
): Promise<File> {
  // If the file is not an image, return it as is
  if (!file.type.startsWith('image/')) {
    return file
  }

  // If the runtime environment doesn't support browser APIs, return the original file
  if (typeof window === 'undefined') {
    return file
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        try {
          let width = img.width
          let height = img.height

          // Only scale down if the image is larger than the maximum dimensions
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width)
              width = maxWidth
            } else {
              width = Math.round((width * maxHeight) / height)
              height = maxHeight
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(file)
            return
          }

          // Draw the image onto the canvas
          ctx.drawImage(img, 0, 0, width, height)

          // Convert canvas back to a Blob, then to a File.
          // Note: profile photos are compressed as image/jpeg to optimize file size.
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file)
                return
              }
              // Create a new File from the blob
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            },
            'image/jpeg',
            quality,
          )
        } catch (error) {
          console.error('Image compression failed:', error)
          resolve(file)
        }
      }
      img.onerror = () => {
        resolve(file)
      }
      img.src = event.target?.result as string
    }
    reader.onerror = () => {
      resolve(file)
    }
    reader.readAsDataURL(file)
  })
}
