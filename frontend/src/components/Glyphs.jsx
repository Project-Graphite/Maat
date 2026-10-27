import { useMemo } from 'react'

// The Egyptian Hieroglyphs block of Unicode, U+13000 to U+1342E
const FIRST = 0x13000
const LAST = 0x1342e
const COLUMNS = 14
const GLYPHS_PER_HALF = 44

// A small seeded generator, so the carving is the same on every visit
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const buildColumns = () => {
  const random = seeded(3000)
  return Array.from({ length: COLUMNS }, (_, index) => {
    const half = Array.from({ length: GLYPHS_PER_HALF }, () =>
      String.fromCodePoint(FIRST + Math.floor(random() * (LAST - FIRST + 1))),
    )
    return {
      index,
      // The same run twice, so the loop has no visible seam
      glyphs: [...half, ...half],
      direction: index % 2 === 0 ? 'up' : 'down',
      duration: 110 + Math.floor(random() * 90),
      size: 30 + Math.floor(random() * 14),
    }
  })
}

/**
 * Columns of hieroglyphs drifting up and down behind the page, like the carved
 * stelae of a temple wall. `hero` fills the width, `ambient` stays in the margins.
 */
export default function Glyphs({ variant = 'ambient' }) {
  const columns = useMemo(buildColumns, [])

  return (
    <div className={`glyphs glyphs-${variant}`} aria-hidden="true">
      {columns.map((column) => (
        <div key={column.index} className="glyph-column" data-dir={column.direction}>
          <div
            className="glyph-track"
            style={{ '--glyph-duration': `${column.duration}s`, '--glyph-size': `${column.size}px` }}
          >
            {column.glyphs.map((glyph, i) => (
              <span key={i}>{glyph}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
