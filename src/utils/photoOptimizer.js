// Recreated & enhanced from Tiberius `packages/live-site/client.mjs` (`preparePhotos`):
// Uses `createImageBitmap` + offscreen `<canvas>` to resize homeowner photos to max 1280px
// JPEG (0.82 quality) before attaching to Vision AI pre-scans & Back-Office threads.

export async function optimizeUploadedPhotos(fileList, maxPhotos = 3) {
  const chosen = Array.from(fileList || []).slice(0, maxPhotos)
  const optimized = []

  for (const file of chosen) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Use JPG, PNG, or WebP photos.')
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new Error('Keep each photo under 8 MB.')
    }

    try {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file)
        const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(bitmap, 0, 0, width, height)
        if (typeof bitmap.close === 'function') {
          bitmap.close()
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
        optimized.push({
          name: file.name,
          contentType: 'image/jpeg',
          dataUrl,
          width,
          height,
          originalBytes: file.size,
        })
        continue
      }
    } catch {
      // Fallback to FileReader below if createImageBitmap fails
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Could not read photo'))
      reader.readAsDataURL(file)
    })
    optimized.push({
      name: file.name,
      contentType: file.type || 'image/jpeg',
      dataUrl,
      width: 1280,
      height: 720,
      originalBytes: file.size,
    })
  }

  return optimized
}
