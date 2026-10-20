// Renders either a loaded .webp Image frame (from 150-frame Higgsfield sequence)
// OR a procedural 3D architectural wireframe camera orbit across frames 1..150.

function project3D(x, y, z, yaw, pitch, width, height, scale = 1) {
  // Rotate around Y axis (yaw)
  const cosY = Math.cos(yaw)
  const sinY = Math.sin(yaw)
  const rx = x * cosY - z * sinY
  const rz = x * sinY + z * cosY

  // Rotate around X axis (pitch)
  const cosX = Math.cos(pitch)
  const sinX = Math.sin(pitch)
  const ry = y * cosX - rz * sinX
  const rz2 = y * sinX + rz * cosX

  const distance = 6.2
  const fov = Math.min(width, height) * 0.78 * scale
  const perspective = fov / (distance + rz2)

  return {
    x: width * 0.5 + rx * perspective,
    y: height * 0.46 - ry * perspective,
    depth: rz2,
    scale: perspective,
  }
}

export function renderScrubFrame(
  ctx,
  width,
  height,
  frameIndex,
  totalFrames,
  tenant,
  customFrames,
  isHybridOverlay = false
) {
  ctx.clearRect(0, 0, width, height)

  const progress = Math.max(0, Math.min(1, frameIndex / (totalFrames - 1)))
  const brandColor = tenant.brandColor || '#f97316'

  // 1. If a real .webp frame is loaded for this index, draw cover-fit on canvas
  const loadedFrame = customFrames?.[frameIndex]
  if (loadedFrame && loadedFrame.complete && loadedFrame.naturalWidth > 0) {
    const imgRatio = loadedFrame.naturalWidth / loadedFrame.naturalHeight
    const canvasRatio = width / height
    let drawW = width
    let drawH = height
    let offsetX = 0
    let offsetY = 0

    if (canvasRatio > imgRatio) {
      drawH = width / imgRatio
      offsetY = (height - drawH) * 0.5
    } else {
      drawW = height * imgRatio
      offsetX = (width - drawW) * 0.5
    }
    ctx.drawImage(loadedFrame, offsetX, offsetY, drawW, drawH)
    return
  }

  // 2. Procedural 3D Wireframe Camera Orbit Fallback (or Transparent Hybrid Telemetry Overlay)
  if (!isHybridOverlay) {
    const bgGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.42,
      40,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.75
    )
    bgGrad.addColorStop(0, '#131c2e')
    bgGrad.addColorStop(0.55, '#0b101b')
    bgGrad.addColorStop(1, '#05080f')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)
  }

  // Camera orbit angles driven by frameIndex (0..149)
  const yaw = -0.65 + progress * Math.PI * 1.45
  const pitch = 0.34 + Math.sin(progress * Math.PI) * 0.16
  const zoom = 0.94 + Math.sin(progress * Math.PI) * 0.14

  // Draw 3D Ground Reference Grid
  ctx.lineWidth = 1
  for (let g = -3; g <= 3; g += 0.75) {
    const p1 = project3D(g, -1.15, -3, yaw, pitch, width, height, zoom)
    const p2 = project3D(g, -1.15, 3, yaw, pitch, width, height, zoom)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.11)'
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()

    const q1 = project3D(-3, -1.15, g, yaw, pitch, width, height, zoom)
    const q2 = project3D(3, -1.15, g, yaw, pitch, width, height, zoom)
    ctx.beginPath()
    ctx.moveTo(q1.x, q1.y)
    ctx.lineTo(q2.x, q2.y)
    ctx.stroke()
  }

  // 3D Architectural Structure Vertices (Main Residence + Gable Roof + Chimney + Deck/HVAC)
  const vertices = [
    // Base Footprint (0..3)
    [-1.8, -1.15, -1.25],
    [1.8, -1.15, -1.25],
    [1.8, -1.15, 1.25],
    [-1.8, -1.15, 1.25],
    // Eave Plate (4..7)
    [-1.8, 0.15, -1.25],
    [1.8, 0.15, -1.25],
    [1.8, 0.15, 1.25],
    [-1.8, 0.15, 1.25],
    // Main Roof Ridge (8..9)
    [-1.8, 1.28, 0],
    [1.8, 1.28, 0],
    // Chimney Stack on North/East Slope (10..17)
    [0.55, 0.45, -0.85],
    [1.05, 0.45, -0.85],
    [1.05, 0.45, -0.35],
    [0.55, 0.45, -0.35],
    [0.55, 1.65, -0.85],
    [1.05, 1.65, -0.85],
    [1.05, 1.65, -0.35],
    [0.55, 1.65, -0.35],
    // Cantilever Deck / Pad Extension (18..21)
    [-1.8, -1.15, 1.25],
    [0.8, -1.15, 1.25],
    [0.8, -1.15, 2.25],
    [-1.8, -1.15, 2.25],
  ]

  const projected = vertices.map(([x, y, z]) =>
    project3D(x, y, z, yaw, pitch, width, height, zoom)
  )

  // Translucent Shaded Roof Planes
  ctx.fillStyle = `${brandColor}16`
  ctx.beginPath()
  ctx.moveTo(projected[4].x, projected[4].y)
  ctx.lineTo(projected[5].x, projected[5].y)
  ctx.lineTo(projected[9].x, projected[9].y)
  ctx.lineTo(projected[8].x, projected[8].y)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = 'rgba(56, 189, 248, 0.08)'
  ctx.beginPath()
  ctx.moveTo(projected[7].x, projected[7].y)
  ctx.lineTo(projected[6].x, projected[6].y)
  ctx.lineTo(projected[9].x, projected[9].y)
  ctx.lineTo(projected[8].x, projected[8].y)
  ctx.closePath()
  ctx.fill()

  // Internal Roof Truss Ribs (7 rafters along ridge)
  ctx.lineWidth = 1.2
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)'
  for (let t = -1.5; t <= 1.5; t += 0.5) {
    const eaveA = project3D(t, 0.15, -1.25, yaw, pitch, width, height, zoom)
    const ridgeM = project3D(t, 1.28, 0, yaw, pitch, width, height, zoom)
    const eaveB = project3D(t, 0.15, 1.25, yaw, pitch, width, height, zoom)
    ctx.beginPath()
    ctx.moveTo(eaveA.x, eaveA.y)
    ctx.lineTo(ridgeM.x, ridgeM.y)
    ctx.lineTo(eaveB.x, eaveB.y)
    ctx.stroke()
  }

  // Structural Wireframe Edges
  const edges = [
    // Base & Walls
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
    // Gable & Ridge
    [4, 8], [7, 8], [5, 9], [6, 9], [8, 9],
    // Deck / Pad
    [18, 19], [19, 20], [20, 21], [21, 18],
  ]

  ctx.lineWidth = 1.8
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)'
  edges.forEach(([a, b]) => {
    ctx.beginPath()
    ctx.moveTo(projected[a].x, projected[a].y)
    ctx.lineTo(projected[b].x, projected[b].y)
    ctx.stroke()
  })

  // Highlighted Ridge & Chimney Stack in Tenant Brand Color
  const highlightEdges = [
    [8, 9],
    [10, 11], [11, 12], [12, 13], [13, 10],
    [14, 15], [15, 16], [16, 17], [17, 14],
    [10, 14], [11, 15], [12, 16], [13, 17],
  ]

  ctx.lineWidth = 2.4
  ctx.strokeStyle = brandColor
  highlightEdges.forEach(([a, b]) => {
    ctx.beginPath()
    ctx.moveTo(projected[a].x, projected[a].y)
    ctx.lineTo(projected[b].x, projected[b].y)
    ctx.stroke()
  })

  // Vision AI Telemetry Scan Nodes on 3D Model
  const scanTargets = [
    {
      pos: [0.8, 0.65, -0.6],
      label: 'FLASHING / SEAL TELEMETRY',
      metric: '98.4% CONF',
    },
    {
      pos: [0.0, 1.28, 0.0],
      label: 'RIDGE & THERMAL VECTOR',
      metric: `FRAME ${String(frameIndex + 1).padStart(3, '0')}/150`,
    },
    {
      pos: [-0.6, -0.85, 1.75],
      label: 'EXTERIOR PERIMETER ZONE',
      metric: tenant.city.toUpperCase(),
    },
  ]

  scanTargets.forEach((node, idx) => {
    const pt = project3D(
      node.pos[0],
      node.pos[1],
      node.pos[2],
      yaw,
      pitch,
      width,
      height,
      zoom
    )

    // Pulsing target ring
    const pulseRadius = 9 + Math.sin(progress * 14 + idx * 2) * 3
    ctx.strokeStyle = brandColor
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, pulseRadius, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = brandColor
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2)
    ctx.fill()

    // Leader line + HUD micro tag
    const offsetDir = idx % 2 === 0 ? 1 : -1
    const labelX = pt.x + offsetDir * 36
    const labelY = pt.y - 22

    ctx.strokeStyle = 'rgba(248, 250, 252, 0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pt.x, pt.y)
    ctx.lineTo(labelX, labelY)
    ctx.stroke()

    ctx.font = '600 11px ui-monospace, SFMono-Regular, Consolas, monospace'
    ctx.fillStyle = '#f8fafc'
    ctx.textAlign = offsetDir > 0 ? 'left' : 'right'
    ctx.fillText(node.label, labelX + offsetDir * 6, labelY - 2)
    ctx.fillStyle = brandColor
    ctx.fillText(node.metric, labelX + offsetDir * 6, labelY + 12)
  })

  ctx.textAlign = 'left'
}
