// Prepares the panorama for /experience.
//
//   npm run pano -- path/to/panorama.png
//
// Input: one full 360° x 180° equirectangular image (2:1), centre column = straight ahead.
// Output (public/pano/, replacing what was there):
//   preview.webp           the whole panorama, small: shown at once while sharper pieces load
//   <width>/<row>_<col>.webp   the panorama at several sizes, cut into tiles; the page only
//                          downloads the tiles the visitor is facing, at the size their screen needs
//   manifest.json          what was written (read by src/lib/pano.js)
// The source image itself is not copied into the site.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const TILE = 2048 // px; within every phone's texture limit
const PREVIEW = 2048 // px wide
const OUT = 'public/pano'

const input = process.argv[2]
if (!input) {
  console.error('Usage: npm run pano -- path/to/panorama.png')
  process.exit(1)
}

const source = sharp(input, { limitInputPixels: false })
const { width, height } = await source.metadata()
if (Math.abs(width / height - 2) > 0.01) {
  console.error(`The panorama must be 2:1 (full 360° x 180°). This one is ${width} x ${height}.`)
  process.exit(1)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const previewWidth = Math.min(PREVIEW, width)
await source.clone().resize(previewWidth, previewWidth / 2).webp({ quality: 70 }).toFile(join(OUT, 'preview.webp'))

// Full size, then half, then half again, for as long as it is still bigger than the preview.
const levels = []
for (let w = width - (width % 2); w > PREVIEW; w = Math.floor(w / 4) * 2) {
  const h = w / 2
  const cols = Math.ceil(w / TILE)
  const rows = Math.ceil(h / TILE)
  const pixels = await source.clone().resize(w, h).removeAlpha().raw().toBuffer()
  mkdirSync(join(OUT, String(w)))
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const area = { left: col * TILE, top: row * TILE, width: Math.min(TILE, w - col * TILE), height: Math.min(TILE, h - row * TILE) }
      await sharp(pixels, { raw: { width: w, height: h, channels: 3 }, limitInputPixels: false })
        .extract(area).webp({ quality: 82 }).toFile(join(OUT, String(w), `${row}_${col}.webp`))
    }
  }
  levels.push({ width: w, height: h, cols, rows })
  console.log(`${w} x ${h}: ${cols * rows} tiles`)
}

// `version` changes with every run so browsers don't keep showing old tiles.
const manifest = { version: Date.now().toString(36), tile: TILE, preview: { width: previewWidth, height: previewWidth / 2 }, levels: levels.reverse() }
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Done: ${OUT} (source ${width} x ${height}).`)
if (width < 16000) console.log('Note: for a sharp 45mm view the panorama should be at least 16384 px wide.')
