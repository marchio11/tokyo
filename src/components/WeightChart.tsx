import { useMemo, useRef, useState } from 'react'
import type { Weight } from '../db'
import { daysBetween, formatDate } from '../lib/dates'

const W = 360
const H = 200
const PAD = { top: 16, right: 14, bottom: 26, left: 38 }

/** Grafico a linea dell'andamento del peso, con tooltip al tocco */
export function WeightChart({ data }: { data: Weight[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [sel, setSel] = useState<number | null>(null)
  const pts = useMemo(() => [...data].sort((a, b) => a.date.localeCompare(b.date)), [data])

  const geo = useMemo(() => {
    if (pts.length === 0) return null
    const first = pts[0].date
    const span = Math.max(1, daysBetween(first, pts[pts.length - 1].date))
    const kgs = pts.map((p) => p.kg)
    let lo = Math.min(...kgs)
    let hi = Math.max(...kgs)
    const pad = Math.max(0.3, (hi - lo) * 0.15)
    lo = Math.floor((lo - pad) * 2) / 2
    hi = Math.ceil((hi + pad) * 2) / 2
    const iw = W - PAD.left - PAD.right
    const ih = H - PAD.top - PAD.bottom
    const x = (d: string) => PAD.left + (pts.length === 1 ? iw / 2 : (daysBetween(first, d) / span) * iw)
    const y = (kg: number) => PAD.top + (1 - (kg - lo) / (hi - lo)) * ih
    const step = niceStep((hi - lo) / 4)
    const ticks: number[] = []
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(2))
    const xs = pts.map((p) => x(p.date))
    const ys = pts.map((p) => y(p.kg))
    const line = xs.map((xx, i) => `${i ? 'L' : 'M'}${xx.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
    const area = `${line} L${xs[xs.length - 1].toFixed(1)},${H - PAD.bottom} L${xs[0].toFixed(1)},${H - PAD.bottom} Z`
    return { xs, ys, y, ticks, line, area }
  }, [pts])

  if (!geo) return null

  const pick = (clientX: number) => {
    const svg = svgRef.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const vx = ((clientX - r.left) / r.width) * W
    let best = 0
    geo.xs.forEach((xx, i) => {
      if (Math.abs(xx - vx) < Math.abs(geo.xs[best] - vx)) best = i
    })
    setSel(best)
  }

  const s = sel ?? pts.length - 1
  const sp = pts[s]
  const tipLeft = (geo.xs[s] / W) * 100

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-card-2 px-2.5 py-1 text-center text-xs whitespace-nowrap shadow"
        style={{ left: `clamp(48px, ${tipLeft}%, calc(100% - 48px))` }}
      >
        <div className="font-semibold text-[#ececf1]">{sp.kg.toLocaleString('it-IT')} kg</div>
        <div className="text-muted">{formatDate(sp.date)}</div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-10 w-full touch-pan-y select-none"
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => (e.buttons || e.pointerType === 'mouse') && pick(e.clientX)}
        role="img"
        aria-label="Andamento del peso"
      >
        <defs>
          <linearGradient id="wfill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#f28c28" stopOpacity="0.22" />
            <stop offset="1" stopColor="#f28c28" stopOpacity="0" />
          </linearGradient>
        </defs>
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke="#2c2c34" strokeWidth="1" />
            <text x={PAD.left - 6} y={geo.y(t) + 3.5} textAnchor="end" fontSize="10" fill="#8b8b97">
              {t.toLocaleString('it-IT')}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 6} fontSize="10" fill="#8b8b97">
          {formatDate(pts[0].date)}
        </text>
        {pts.length > 1 && (
          <text x={W - PAD.right} y={H - 6} fontSize="10" fill="#8b8b97" textAnchor="end">
            {formatDate(pts[pts.length - 1].date)}
          </text>
        )}
        <path d={geo.area} fill="url(#wfill)" />
        <path d={geo.line} fill="none" stroke="#f28c28" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={geo.xs[s]} x2={geo.xs[s]} y1={PAD.top} y2={H - PAD.bottom} stroke="#8b8b97" strokeWidth="1" strokeDasharray="3 3" />
        {pts.length <= 40 &&
          geo.xs.map((xx, i) => <circle key={i} cx={xx} cy={geo.ys[i]} r="2.5" fill="#f28c28" />)}
        <circle cx={geo.xs[s]} cy={geo.ys[s]} r="5" fill="#f28c28" stroke="#18181c" strokeWidth="2" />
      </svg>
    </div>
  )
}

function niceStep(raw: number) {
  const steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10]
  return steps.find((s) => s >= raw) ?? 10
}
