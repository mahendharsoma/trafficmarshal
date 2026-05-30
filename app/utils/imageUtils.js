/**
 * Compress image to base64 with specified max width and quality
 * @param {File} file - Image file to compress
 * @param {number} maxW - Maximum width (default 800px)
 * @param {number} quality - JPEG quality (default 0.7)
 * @returns {Promise<string>} Base64 encoded image
 */
export const compressImage = (file, maxW = 800, quality = 0.7) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const w = img.width * scale, h = img.height * scale
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = e.target.result
  }
  reader.onerror = reject
  reader.readAsDataURL(file)
})

/**
 * Watermark base64 image with multi-line text overlay at bottom
 * @param {string} base64 - Base64 encoded image
 * @param {Array<string>} watermarkLines - Array of text lines to overlay
 * @returns {Promise<string>} Watermarked base64 image
 */
export const watermarkPhoto = (base64, watermarkLines) => new Promise((resolve, reject) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const fontSize = Math.max(14, Math.floor(img.width / 36))
    const lineH = Math.floor(fontSize * 1.35)
    const barH = lineH * watermarkLines.length + 24
    const grad = ctx.createLinearGradient(0, img.height - barH - 30, 0, img.height)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.4, 'rgba(0,0,0,0.55)')
    grad.addColorStop(1, 'rgba(0,0,0,0.85)')
    ctx.fillStyle = grad
    ctx.fillRect(0, img.height - barH - 30, img.width, barH + 30)
    ctx.fillStyle = '#fff'
    ctx.font = `${fontSize}px sans-serif`
    ctx.textBaseline = 'bottom'
    watermarkLines.forEach((line, idx) => {
      const y = img.height - 14 - (watermarkLines.length - 1 - idx) * lineH
      ctx.fillText(line, 16, y)
    })
    // small red badge top-left
    ctx.fillStyle = 'rgba(220,38,38,0.92)'
    ctx.fillRect(12, 12, 110, 28)
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.floor(fontSize * 0.9)}px sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText('MKSC VISIT', 22, 26)
    resolve(canvas.toDataURL('image/jpeg', 0.75))
  }
  img.onerror = reject
  img.src = base64
})
