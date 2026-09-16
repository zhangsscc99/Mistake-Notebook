// 学习打卡分享（网页端）：画一张卡片图，支持系统分享 / 下载 / 复制链接
const W = 750
const H = 1000

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function statBlock(ctx, x, y, value, label) {
  ctx.textAlign = 'center'
  ctx.fillStyle = '#0b1633'
  ctx.font = '800 56px system-ui, -apple-system, sans-serif'
  ctx.fillText(String(value), x, y)
  ctx.fillStyle = 'rgba(11,22,51,0.5)'
  ctx.font = '400 24px system-ui, -apple-system, sans-serif'
  ctx.fillText(label, x, y + 36)
}

/**
 * 生成打卡卡片
 * @param {{nickName:string, streak:number, totalDays:number, questionCount:number, coins:number}} data
 * @returns {Promise<Blob>}
 */
export async function renderCheckinCard(data) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // 背景
  ctx.fillStyle = '#eef3fb'
  ctx.fillRect(0, 0, W, H)

  // 顶部品牌渐变
  const grad = ctx.createLinearGradient(0, 0, W, 340)
  grad.addColorStop(0, '#2459ff')
  grad.addColorStop(0.5, '#52b7ff')
  grad.addColorStop(1, '#b6a6ff')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, 340)

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '600 26px system-ui, -apple-system, sans-serif'
  ctx.fillText('智卷错题通 · 学习打卡', 56, 92)

  ctx.fillStyle = '#fff'
  ctx.font = '800 64px system-ui, -apple-system, sans-serif'
  ctx.fillText(`连续打卡 ${data.streak || 0} 天`, 56, 184)

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '400 28px system-ui, -apple-system, sans-serif'
  ctx.fillText(`${data.nickName || '我'} 正在坚持整理错题`, 56, 240)

  // 数据卡
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

  // 文案卡
  ctx.fillStyle = '#fff'
  roundRect(ctx, 48, 580, W - 96, 300, 32)
  ctx.fill()

  ctx.fillStyle = '#0b1633'
  ctx.font = '800 36px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('今天也把错题理清楚了', 88, 660)

  ctx.fillStyle = 'rgba(11,22,51,0.6)'
  ctx.font = '400 28px system-ui, -apple-system, sans-serif'
  const lines = [
    '拍照录题，AI 自动分类与讲解，',
    '错因分析、变式题、组卷一步到位。',
    '一起来把错题变成分数。'
  ]
  lines.forEach((line, i) => ctx.fillText(line, 88, 720 + i * 46))

  // 底部
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(11,22,51,0.4)'
  ctx.font = '400 24px system-ui, -apple-system, sans-serif'
  ctx.fillText('智卷错题通 · 网页版', W / 2, 940)

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/** 优先用系统分享，不支持则下载图片 */
export async function shareCheckin(data, shareUrl) {
  const blob = await renderCheckinCard(data)
  const file = new File([blob], 'checkin.png', { type: 'image/png' })
  const text = `我在智卷错题通连续打卡 ${data.streak || 0} 天，一起来整理错题`

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: '学习打卡', text })
    return { mode: 'share' }
  }
  if (navigator.share) {
    await navigator.share({ title: '学习打卡', text, url: shareUrl })
    return { mode: 'share-link' }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `打卡-${data.streak || 0}天.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return { mode: 'download' }
}

export async function copyShareLink(url) {
  await navigator.clipboard.writeText(url)
}
