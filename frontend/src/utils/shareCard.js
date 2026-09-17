// 学习打卡分享图：先画卡，再预览 / 下载。不依赖系统分享（微信内置浏览器里经常不可用）。
const W = 750
const H = 1000

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, rad)
    ctx.closePath()
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function statBlock(ctx, x, y, value, label) {
  ctx.textAlign = 'center'
  ctx.fillStyle = '#0b1633'
  ctx.font = '800 56px system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif'
  ctx.fillText(String(value ?? 0), x, y)
  ctx.fillStyle = 'rgba(11,22,51,0.5)'
  ctx.font = '400 24px system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif'
  ctx.fillText(label, x, y + 36)
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',')
  const mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png'
  const bin = atob(parts[1] || '')
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    const fallback = () => {
      try {
        resolve(dataUrlToBlob(canvas.toDataURL('image/png')))
      } catch (e) {
        reject(e)
      }
    }
    if (typeof canvas.toBlob !== 'function') {
      fallback()
      return
    }
    try {
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) resolve(blob)
        else fallback()
      }, 'image/png')
    } catch {
      fallback()
    }
  })
}

/**
 * @param {{nickName:string, streak:number, totalDays:number, questionCount:number, coins:number}} data
 * @returns {Promise<Blob>}
 */
export async function renderCheckinCard(data) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法绘制分享图')

  ctx.fillStyle = '#eef3fb'
  ctx.fillRect(0, 0, W, H)

  const grad = ctx.createLinearGradient(0, 0, W, 340)
  grad.addColorStop(0, '#2459ff')
  grad.addColorStop(0.5, '#52b7ff')
  grad.addColorStop(1, '#b6a6ff')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, 340)

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '600 26px system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif'
  ctx.fillText('智卷错题通 · 学习打卡', 56, 92)

  ctx.fillStyle = '#fff'
  ctx.font = '800 64px system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif'
  ctx.fillText(`连续打卡 ${data.streak || 0} 天`, 56, 184)

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '400 28px system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif'
  ctx.fillText(`${data.nickName || '我'} 正在坚持整理错题`, 56, 240)

  ctx.fillStyle = '#fff'
  roundRect(ctx, 48, 300, W - 96, 240, 32)
  ctx.fill()

  const third = (W - 96) / 3
  statBlock(ctx, 48 + third * 0.5, 400, data.totalDays || 0, '累计打卡')
  statBlock(ctx, 48 + third * 1.5, 400, data.questionCount || 0, '整理错题')
  statBlock(ctx, 48 + third * 2.5, 400, data.coins || 0, '金币')

  ctx.strokeStyle = 'rgba(11,22,51,0.08)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(48 + third, 350)
  ctx.lineTo(48 + third, 470)
  ctx.moveTo(48 + third * 2, 350)
  ctx.lineTo(48 + third * 2, 470)
  ctx.stroke()

  ctx.fillStyle = '#fff'
  roundRect(ctx, 48, 580, W - 96, 300, 32)
  ctx.fill()

  ctx.fillStyle = '#0b1633'
  ctx.font = '800 36px system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('今天也把错题理清楚了', 88, 660)

  ctx.fillStyle = 'rgba(11,22,51,0.6)'
  ctx.font = '400 28px system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif'
  const lines = [
    '拍照录题，AI 自动分类与讲解，',
    '错因分析、变式题、组卷一步到位。',
    '一起来把错题变成分数。'
  ]
  lines.forEach((line, i) => ctx.fillText(line, 88, 720 + i * 46))

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(11,22,51,0.4)'
  ctx.font = '400 24px system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif'
  ctx.fillText('智卷错题通 · 网页版', W / 2, 940)

  const blob = await canvasToBlob(canvas)
  if (!blob || blob.size === 0) throw new Error('分享图是空的')
  return blob
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'checkin.png'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function shareCheckin(data) {
  const blob = await renderCheckinCard(data)
  const previewUrl = URL.createObjectURL(blob)
  return { blob, previewUrl }
}

export async function copyShareLink(url) {
  await navigator.clipboard.writeText(url)
}
