// Shrinks a picked image in the browser before it is uploaded: the long side
// is cut to 1024 px and the result is WebP, so it uploads fast and stores small.
export const longSide = 1024

const pickable = ['image/jpeg', 'image/png', 'image/webp']

export function fitWithin(width: number, height: number, max: number): { width: number, height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function shrinkImage(file: File): Promise<{ contentType: 'image/webp', base64: string }> {
  if (!pickable.includes(file.type)) return Promise.reject(new Error('Use a JPEG, PNG or WebP image.'))
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      const size = fitWithin(image.width, image.height, longSide)
      const canvas = document.createElement('canvas')
      canvas.width = size.width
      canvas.height = size.height
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('The image could not be shrunk.'))
        return
      }
      context.drawImage(image, 0, 0, size.width, size.height)
      const data = canvas.toDataURL('image/webp', 0.85)
      resolve({ contentType: 'image/webp', base64: data.slice(data.indexOf(',') + 1) })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Use a JPEG, PNG or WebP image.'))
    }
    image.src = url
  })
}
