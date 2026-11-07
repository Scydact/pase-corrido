import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it } from 'vitest'
import { PIP_PATTERNS } from '../pips'
import { readTiles, type OpenCv } from './detect'

let cv: OpenCv

beforeAll(async () => {
  const loaded = createRequire(import.meta.url)('../../vendor/opencv/opencv.js')
  const holder: { cv: OpenCv } = await (loaded instanceof Promise
    ? loaded.then((module: OpenCv) => ({ cv: module }))
    : new Promise((resolve) => {
        if (loaded.Mat) resolve({ cv: loaded })
        else loaded.onRuntimeInitialized = () => resolve({ cv: loaded })
      }))
  cv = holder.cv
}, 60000)

type Rgb = [number, number, number]

interface Style {
  tile: Rgb
  pip: Rgb
  line: Rgb
  specks?: boolean
}

const scalar = ([r, g, b]: Rgb) => new cv.Scalar(r, g, b, 255)

/** Draws one tile upright, then returns it as an image to place on a scene. */
function drawTile(a: number, b: number, style: Style) {
  const [w, h] = [100, 200]
  const tile = new cv.Mat(h, w, cv.CV_8UC4, scalar(style.tile))
  if (style.specks) {
    let seed = a * 31 + b * 7 + 1
    for (let i = 0; i < 90; i++) {
      seed = (seed * 16807) % 2147483647
      const x = seed % w
      seed = (seed * 16807) % 2147483647
      const y = seed % h
      seed = (seed * 16807) % 2147483647
      cv.circle(tile, new cv.Point(x, y), 1 + (seed % 2), scalar(i % 3 ? [85, 85, 108] : [245, 245, 250]), -1)
    }
  }
  cv.line(tile, new cv.Point(14, h / 2), new cv.Point(w - 14, h / 2), scalar(style.line), 4)
  const place = (n: number, top: number) => {
    for (const [x, y] of PIP_PATTERNS[n]) {
      cv.circle(tile, new cv.Point(24 + x * 26, top + 24 + y * 26), 9, scalar(style.pip), -1)
    }
  }
  place(a, 0)
  place(b, h / 2)
  return tile
}

function scene(background: Rgb, tiles: { a: number; b: number; x: number; y: number; angle: number }[], style: Style, noise = 0) {
  const [width, height] = [900, 900]
  const image = new cv.Mat(height, width, cv.CV_8UC4, scalar(background))
  for (const { a, b, x, y, angle } of tiles) {
    // Real tiles sit on the table with a soft shadow along one side.
    const shadowColor = background.map((c) => Math.round(c * 0.62)) as Rgb
    const shadow = new cv.Mat(200, 100, cv.CV_8UC4, scalar(shadowColor))
    const offset = cv.getRotationMatrix2D(new cv.Point(50, 100), angle, 1)
    offset.doublePtr(0, 2)[0] += x - 50 + 5
    offset.doublePtr(1, 2)[0] += y - 100 + 5
    cv.warpAffine(shadow, image, offset, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_TRANSPARENT)
    shadow.delete()
    offset.delete()

    const tile = drawTile(a, b, style)
    const m = cv.getRotationMatrix2D(new cv.Point(50, 100), angle, 1)
    m.doublePtr(0, 2)[0] += x - 50
    m.doublePtr(1, 2)[0] += y - 100
    cv.warpAffine(tile, image, m, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_TRANSPARENT)
    tile.delete()
    m.delete()
  }
  const data = new Uint8ClampedArray(image.data)
  image.delete()
  if (noise) {
    let seed = 12345
    for (let i = 0; i < data.length; i += 4) {
      seed = (seed * 16807) % 2147483647
      const shift = (seed % (noise * 2)) - noise
      for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, data[i + c] + shift))
    }
  }
  return { data, width, height }
}

const HAND = [
  { a: 6, b: 6, x: 130, y: 170, angle: 0 },
  { a: 6, b: 3, x: 370, y: 180, angle: 25 },
  { a: 5, b: 2, x: 650, y: 170, angle: -40 },
  { a: 4, b: 1, x: 150, y: 480, angle: 80 },
  { a: 3, b: 0, x: 440, y: 470, angle: -15 },
  { a: 2, b: 2, x: 720, y: 500, angle: 110 },
  { a: 0, b: 0, x: 300, y: 760, angle: 60 },
]
const EXPECTED = ['0:0', '2:2', '3:0', '4:1', '5:2', '6:3', '6:6']

const STYLES: Record<string, Style> = {
  ivory: { tile: [246, 241, 227], pip: [29, 37, 34], line: [184, 174, 148] },
  presidente: { tile: [11, 138, 80], pip: [255, 255, 255], line: [255, 255, 255] },
  crimson: { tile: [168, 18, 47], pip: [255, 255, 255], line: [255, 255, 255] },
  ultramarine: { tile: [31, 58, 168], pip: [255, 255, 255], line: [255, 255, 255] },
  black: { tile: [20, 20, 20], pip: [255, 255, 255], line: [138, 138, 138] },
  speckled: { tile: [214, 214, 226], pip: [23, 23, 31], line: [28, 28, 36], specks: true },
}

const BACKGROUNDS: Record<string, Rgb> = {
  'white table': [235, 235, 230],
  wood: [150, 105, 60],
  dark: [40, 44, 48],
}

describe('readTiles', () => {
  for (const [styleName, style] of Object.entries(STYLES)) {
    for (const [backgroundName, background] of Object.entries(BACKGROUNDS)) {
      // Pale tiles on a pale table barely differ, so these can miss tiles. They must never
      // misread the ones they do find, since the review step can add a missing tile more
      // easily than anyone can spot a wrong one.
      const faint = backgroundName === 'white table' && (styleName === 'ivory' || styleName === 'speckled')
      it.runIf(faint)(`finds most ${styleName} tiles on a ${backgroundName}, without misreading any`, () => {
        const ids = readTiles(cv, scene(background, HAND, style, 6)).map((r) => r.id)
        expect(ids.length).toBeGreaterThanOrEqual(4)
        ids.forEach((id) => expect(EXPECTED).toContain(id))
      })

      it.skipIf(faint)(`reads a hand of ${styleName} tiles on a ${backgroundName}`, () => {
        const readings = readTiles(cv, scene(background, HAND, style, 6))
        expect(readings.map((r) => r.id).sort()).toEqual(EXPECTED)
        expect(readings.filter((r) => r.doubtful).map((r) => r.id)).toEqual([])
      })
    }
  }

  it('totals the pips for an end-of-hand count', () => {
    const readings = readTiles(cv, scene([150, 105, 60], HAND, STYLES.ivory, 6))
    expect(readings.reduce((sum, r) => sum + r.pips, 0)).toBe(12 + 9 + 7 + 5 + 3 + 4 + 0)
  })

  it('finds nothing on an empty table', () => {
    expect(readTiles(cv, scene([150, 105, 60], [], STYLES.ivory, 6))).toEqual([])
  })

  it('flags two identical readings, since a set has one of each tile', () => {
    const twins = [
      { a: 6, b: 3, x: 200, y: 200, angle: 0 },
      { a: 6, b: 3, x: 600, y: 200, angle: 0 },
    ]
    const readings = readTiles(cv, scene([150, 105, 60], twins, STYLES.ivory))
    expect(readings.map((r) => r.doubtful)).toEqual([true, true])
  })

  it('ignores a tile-shaped box with no dots or line', () => {
    const image = new cv.Mat(600, 600, cv.CV_8UC4, scalar([150, 105, 60]))
    cv.rectangle(image, new cv.Point(100, 100), new cv.Point(300, 200), scalar([240, 240, 240]), -1)
    const data = new Uint8ClampedArray(image.data)
    image.delete()
    expect(readTiles(cv, { data, width: 600, height: 600 })).toEqual([])
  })

  it('ignores shapes that are not tile-shaped', () => {
    const image = new cv.Mat(600, 600, cv.CV_8UC4, scalar([150, 105, 60]))
    cv.rectangle(image, new cv.Point(100, 100), new cv.Point(300, 300), scalar([240, 240, 240]), -1)
    const data = new Uint8ClampedArray(image.data)
    image.delete()
    expect(readTiles(cv, { data, width: 600, height: 600 })).toEqual([])
  })
})
