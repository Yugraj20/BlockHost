import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const collagePath = 'C:/Users/Administrator/.gemini/antigravity/brain/3ab62d91-984c-40d9-829f-017c60c2f01c/.user_uploaded/media_1792145068761_614caf74.jpg'
const outResources = path.resolve('resources/backgrounds')
const outPublic = path.resolve('src/renderer/public/backgrounds')
const buildDir = path.resolve('build')

fs.mkdirSync(outResources, { recursive: true })
fs.mkdirSync(outPublic, { recursive: true })
fs.mkdirSync(buildDir, { recursive: true })

async function main() {
  const meta = await sharp(collagePath).metadata()
  const width = meta.width || 1024
  const height = meta.height || 576
  const cellW = Math.floor(width / 4)
  const cellH = Math.floor(height / 4)

  let idx = 1
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const filename = `bg-${idx}.jpg`
      const buf = await sharp(collagePath)
        .extract({
          left: col * cellW,
          top: row * cellH,
          width: cellW,
          height: cellH
        })
        .jpeg({ quality: 92 })
        .toBuffer()

      fs.writeFileSync(path.join(outResources, filename), buf)
      fs.writeFileSync(path.join(outPublic, filename), buf)
      idx++
    }
  }
  console.log(`Sliced 16 backgrounds (${cellW}x${cellH}) into resources/backgrounds and src/renderer/public/backgrounds`)

  // Create Isometric Emerald Cube SVG for BlockHost logo
  const svgLogo = `
  <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <defs>
      <linearGradient id="top" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#34d399"/>
        <stop offset="100%" stop-color="#10b981"/>
      </linearGradient>
      <linearGradient id="left" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#059669"/>
      </linearGradient>
      <linearGradient id="right" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#059669"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#10b981" flood-opacity="0.45"/>
      </filter>
    </defs>
    <rect width="256" height="256" rx="54" fill="#0b111e"/>
    <g filter="url(#glow)">
      <!-- Top face -->
      <polygon points="128,36 212,84 128,132 44,84" fill="url(#top)"/>
      <!-- Left face -->
      <polygon points="44,84 128,132 128,220 44,172" fill="url(#left)"/>
      <!-- Right face -->
      <polygon points="212,84 128,132 128,220 212,172" fill="url(#right)"/>
      <!-- Inner core lines -->
      <polyline points="86,108 128,132 170,108" fill="none" stroke="#a7f3d0" stroke-width="5" stroke-linecap="round"/>
      <line x1="128" y1="132" x2="128" y2="180" stroke="#a7f3d0" stroke-width="5" stroke-linecap="round"/>
    </g>
  </svg>`

  const png256 = await sharp(Buffer.from(svgLogo)).resize(256, 256).png().toBuffer()
  const png32 = await sharp(Buffer.from(svgLogo)).resize(32, 32).png().toBuffer()

  fs.writeFileSync(path.resolve('resources/icon.png'), png256)
  fs.writeFileSync(path.resolve('resources/tray.png'), png32)
  fs.writeFileSync(path.resolve('src/renderer/public/logo.png'), png256)
  fs.writeFileSync(path.resolve('build/icon.png'), png256)

  // Construct valid Windows .ico wrapping 256x256 PNG
  const icoHeader = Buffer.alloc(6)
  icoHeader.writeUInt16LE(0, 0) // Reserved
  icoHeader.writeUInt16LE(1, 2) // Type 1 = ICO
  icoHeader.writeUInt16LE(1, 4) // 1 image

  const icoEntry = Buffer.alloc(16)
  icoEntry.writeUInt8(0, 0) // 256 width (0 means 256)
  icoEntry.writeUInt8(0, 1) // 256 height (0 means 256)
  icoEntry.writeUInt8(0, 2) // palette
  icoEntry.writeUInt8(0, 3) // reserved
  icoEntry.writeUInt16LE(1, 4) // color planes
  icoEntry.writeUInt16LE(32, 6) // bits per pixel
  icoEntry.writeUInt32LE(png256.length, 8) // image size
  icoEntry.writeUInt32LE(22, 12) // offset (6 + 16)

  const icoBuf = Buffer.concat([icoHeader, icoEntry, png256])
  fs.writeFileSync(path.resolve('build/icon.ico'), icoBuf)
  fs.writeFileSync(path.resolve('resources/icon.ico'), icoBuf)
  console.log('Generated BlockHost icons (build/icon.ico, resources/icon.png, resources/tray.png)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
