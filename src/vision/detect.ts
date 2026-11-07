import { PIP_PATTERNS } from '../pips'
import { tileId, type TileId } from '../domain/tiles'

/** OpenCV.js's own type definitions are too loose to help here, so it stays untyped. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OpenCv = any

export interface RawImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface TileReading {
  id: TileId
  pips: number
  /** The reading didn't look clean, so it needs a person to check it. */
  doubtful: boolean
  corners: Point[]
}

const PATCH_W = 120
const PATCH_H = 240

/** Runs a piece of work and frees every OpenCV object it made, which JavaScript can't do alone. */
function withMats<T>(work: (track: <M extends { delete(): void }>(mat: M) => M) => T): T {
  const mats: { delete(): void }[] = []
  try {
    return work((mat) => {
      mats.push(mat)
      return mat
    })
  } finally {
    mats.forEach((mat) => mat.delete())
  }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

/** Lab distance from one color, with lightness counted a bit less so shadows matter less. */
function distanceFrom(lab: { data: Uint8Array; rows: number; cols: number }, target: number[], out: { data: Uint8Array }) {
  const total = lab.rows * lab.cols
  for (let i = 0; i < total; i++) {
    const dl = (lab.data[i * 3] - target[0]) * 0.7
    const da = lab.data[i * 3 + 1] - target[1]
    const db = lab.data[i * 3 + 2] - target[2]
    out.data[i] = Math.min(255, Math.sqrt(dl * dl + da * da + db * db))
  }
}

/** The most common color in the image, which on a table photo is the table itself. */
function dominantColor(lab: { data: Uint8Array; rows: number; cols: number }) {
  const buckets = new Map<number, number[]>()
  const total = lab.rows * lab.cols
  for (let i = 0; i < total; i += 3) {
    const [l, a, b] = [lab.data[i * 3], lab.data[i * 3 + 1], lab.data[i * 3 + 2]]
    const key = ((l >> 4) << 8) | ((a >> 4) << 4) | (b >> 4)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket[0]++
      bucket[1] += l
      bucket[2] += a
      bucket[3] += b
    } else {
      buckets.set(key, [1, l, a, b])
    }
  }
  const largest = [...buckets.values()].sort((x, y) => y[0] - x[0])[0]
  return [largest[1] / largest[0], largest[2] / largest[0], largest[3] / largest[0]]
}

/** The four corners of a rotated rectangle, with its long side running top to bottom. */
function rectCorners(rect: { center: Point; size: { width: number; height: number }; angle: number }): Point[] {
  let { width, height } = rect.size
  let angle = (rect.angle * Math.PI) / 180
  if (width > height) {
    ;[width, height] = [height, width]
    angle += Math.PI / 2
  }
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
  const place = (dx: number, dy: number) => ({
    x: rect.center.x + dx * cos - dy * sin,
    y: rect.center.y + dx * sin + dy * cos,
  })
  const [w, h] = [width / 2, height / 2]
  return [place(-w, -h), place(w, -h), place(w, h), place(-w, h)]
}

function centerOf(reading: TileReading): Point {
  const sum = reading.corners.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / 4, y: sum.y / 4 }
}

interface Blob {
  x: number
  y: number
}

/** How far the dots on a half are from where a domino's dots go, as a share of the half's size. */
function patternError(blobs: Blob[], top: number) {
  const n = blobs.length
  if (n === 0) return 0
  if (n > 6) return 1
  const half = PATCH_W
  const local = blobs.map((b) => ({ x: b.x / half, y: (b.y - top) / half }))
  const spots = PIP_PATTERNS[n].map(([x, y]) => ({ x: 0.2 + x * 0.3, y: 0.2 + y * 0.3 }))
  const flips = [(p: Blob) => p, (p: Blob) => ({ x: p.y, y: p.x }), (p: Blob) => ({ x: 1 - p.x, y: p.y })]
  return Math.min(
    ...flips.map((flip) =>
      Math.max(...spots.map(flip).map((spot) => Math.min(...local.map((b) => Math.hypot(b.x - spot.x, b.y - spot.y))))),
    ),
  )
}

/** Reads one straightened tile. Returns null when it doesn't look like a domino at all. */
function readPatch(cv: OpenCv, patch: OpenCv) {
  return withMats((track) => {
    const lab = track(new cv.Mat())
    const rgb = track(new cv.Mat())
    cv.cvtColor(patch, rgb, cv.COLOR_RGBA2RGB)
    cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab)

    const channels: number[][] = [[], [], []]
    for (let i = 0; i < PATCH_W * PATCH_H; i += 3) {
      for (let c = 0; c < 3; c++) channels[c].push(lab.data[i * 3 + c])
    }
    const tileColor = channels.map(median)

    const diff = track(new cv.Mat(PATCH_H, PATCH_W, cv.CV_8UC1))
    distanceFrom(lab, tileColor, diff)

    const mask = track(new cv.Mat())
    const otsu = cv.threshold(diff, mask, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
    // A blank tile has no real contrast for Otsu to split, so hold it to a minimum.
    cv.threshold(diff, mask, Math.max(otsu, 28), 255, cv.THRESH_BINARY)

    // The middle line: the central row that differs most from the tile's color. Its threshold
    // is lower than the dots' because a line is often much fainter than the dots.
    let lineHits = 0
    let lineRow = PATCH_H / 2
    for (let row = PATCH_H / 2 - 30; row < PATCH_H / 2 + 30; row++) {
      let hits = 0
      for (let col = 20; col < PATCH_W - 20; col++) if (diff.data[row * PATCH_W + col] > 14) hits++
      if (hits / (PATCH_W - 40) > lineHits) {
        lineHits = hits / (PATCH_W - 40)
        lineRow = row
      }
    }

    // Opening removes specks and thin strokes, leaving solid dots.
    const kernel = track(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5)))
    const dots = track(new cv.Mat())
    cv.morphologyEx(mask, dots, cv.MORPH_OPEN, kernel)

    const labels = track(new cv.Mat())
    const stats = track(new cv.Mat())
    const centers = track(new cv.Mat())
    const count = cv.connectedComponentsWithStats(dots, labels, stats, centers, 8, cv.CV_32S)

    const candidates: (Blob & { area: number })[] = []
    for (let i = 1; i < count; i++) {
      const [w, h, area] = [stats.intAt(i, cv.CC_STAT_WIDTH), stats.intAt(i, cv.CC_STAT_HEIGHT), stats.intAt(i, cv.CC_STAT_AREA)]
      const [x, y] = [centers.doubleAt(i, 0), centers.doubleAt(i, 1)]
      const edge = 7
      if (x < edge || y < edge || x > PATCH_W - edge || y > PATCH_H - edge) continue
      if (Math.abs(y - lineRow) < 13) continue // The line and any pin in its middle.
      if (area < 60 || area > 1500) continue
      const ratio = w / h
      if (ratio < 0.55 || ratio > 1.8 || area / (w * h) < 0.5) continue
      candidates.push({ x, y, area })
    }
    const typical = median(candidates.map((c) => c.area))
    const blobs = candidates.filter((c) => c.area > typical * 0.45 && c.area < typical * 2.2)

    // A rectangle with neither a line nor dots is something else, like a phone or a box.
    if (lineHits < 0.3 && blobs.length === 0) return null

    const top = blobs.filter((b) => b.y < lineRow)
    const bottom = blobs.filter((b) => b.y >= lineRow)
    const error = Math.max(patternError(top, lineRow - PATCH_W), patternError(bottom, lineRow))
    const counted = top.length <= 6 && bottom.length <= 6
    return {
      a: Math.min(top.length, 6),
      b: Math.min(bottom.length, 6),
      doubtful: !counted || error > 0.17 || lineHits < 0.3 || blobs.length !== candidates.length,
    }
  })
}

/**
 * Finds domino tiles on a plain surface and reads each one: separate the tiles from
 * the background color, straighten each one, then count the dots on each half. Works
 * from color differences, so it doesn't depend on which color the tiles are.
 */
export function readTiles(cv: OpenCv, image: RawImage): TileReading[] {
  return withMats((track) => {
    const src = track(cv.matFromImageData(image))
    const rgb = track(new cv.Mat())
    const lab = track(new cv.Mat())
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB)
    cv.GaussianBlur(rgb, rgb, new cv.Size(5, 5), 0)
    cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab)

    const size = Math.max(3, Math.round(Math.max(lab.cols, lab.rows) / 250)) | 1
    const kernel = track(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(size, size)))

    // First way to find tiles: anything that differs in color from the table.
    const byColor = track(new cv.Mat())
    const diff = track(new cv.Mat(lab.rows, lab.cols, cv.CV_8UC1))
    distanceFrom(lab, dominantColor(lab), diff)
    cv.threshold(diff, byColor, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
    cv.morphologyEx(byColor, byColor, cv.MORPH_OPEN, kernel)
    cv.morphologyEx(byColor, byColor, cv.MORPH_CLOSE, kernel)

    // Bright dots can make that split ignore a dark tile on a dark table, so also take
    // anything even slightly different from the table.
    const bySlightColor = track(new cv.Mat())
    cv.threshold(diff, bySlightColor, 16, 255, cv.THRESH_BINARY)
    cv.morphologyEx(bySlightColor, bySlightColor, cv.MORPH_OPEN, kernel)
    cv.morphologyEx(bySlightColor, bySlightColor, cv.MORPH_CLOSE, kernel)

    // Last way, for tiles close to the table's color: their outlines and shadows.
    const gray = track(new cv.Mat())
    const byEdges = track(new cv.Mat())
    cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY)
    cv.Canny(gray, byEdges, 30, 90)
    cv.dilate(byEdges, byEdges, kernel)

    // White on white can leave the side away from the shadow very faint.
    const byFaintEdges = track(new cv.Mat())
    cv.Canny(gray, byFaintEdges, 6, 18)
    cv.morphologyEx(byFaintEdges, byFaintEdges, cv.MORPH_CLOSE, kernel)
    cv.dilate(byFaintEdges, byFaintEdges, kernel)

    const minArea = lab.cols * lab.rows * 0.002
    const readings: TileReading[] = []
    for (const mask of [byColor, bySlightColor, byEdges, byFaintEdges]) {
      const contours = track(new cv.MatVector())
      const hierarchy = track(new cv.Mat())
      cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

      for (let i = 0; i < contours.size(); i++) {
        const contour = track(contours.get(i))
        const area = cv.contourArea(contour)
        if (area < minArea) continue
        const rect = cv.minAreaRect(contour)
        const long = Math.max(rect.size.width, rect.size.height)
        const short = Math.min(rect.size.width, rect.size.height)
        if (short === 0 || long / short < 1.55 || long / short > 2.6) continue
        if (area / (long * short) < 0.72) continue

        const corners = rectCorners(rect)
        const from = track(cv.matFromArray(4, 1, cv.CV_32FC2, corners.flatMap((p) => [p.x, p.y])))
        const to = track(cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, PATCH_W, 0, PATCH_W, PATCH_H, 0, PATCH_H]))
        const transform = track(cv.getPerspectiveTransform(from, to))
        const patch = track(new cv.Mat())
        cv.warpPerspective(src, patch, transform, new cv.Size(PATCH_W, PATCH_H))
        const read = readPatch(cv, patch)
        if (!read) continue

        const reading = { id: tileId(read.a, read.b), pips: read.a + read.b, doubtful: read.doubtful, corners }
        // Several ways can find the same tile, so keep the cleanest reading of it.
        const same = readings.findIndex((r) => Math.hypot(centerOf(r).x - rect.center.x, centerOf(r).y - rect.center.y) < short / 2)
        if (same < 0) readings.push(reading)
        else if (readings[same].doubtful && !reading.doubtful) readings[same] = reading
      }
    }

    // In one photo tiles are about the same size, so something far smaller is a dot or a speck.
    const sizeOf = (r: TileReading) =>
      Math.hypot(r.corners[0].x - r.corners[1].x, r.corners[0].y - r.corners[1].y) *
      Math.hypot(r.corners[1].x - r.corners[2].x, r.corners[1].y - r.corners[2].y)
    const largest = Math.max(0, ...readings.map(sizeOf))
    for (let i = readings.length - 1; i >= 0; i--) {
      if (sizeOf(readings[i]) < largest * 0.3) readings.splice(i, 1)
    }

    // A set has one of each tile, so two identical readings can't both be right.
    const seen = new Map<TileId, number>()
    readings.forEach((r) => seen.set(r.id, (seen.get(r.id) ?? 0) + 1))
    readings.forEach((r) => {
      if ((seen.get(r.id) ?? 0) > 1) r.doubtful = true
    })
    return readings
  })
}
