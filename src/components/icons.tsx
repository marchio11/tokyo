import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </svg>
)
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </svg>
)
export const IconScale = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M8 8.5a6 6 0 0 1 8 0l-2.5 3a2 2 0 0 0-3 0z" />
  </svg>
)
export const IconPaw = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <ellipse cx="6" cy="10" rx="1.8" ry="2.3" />
    <ellipse cx="10" cy="6" rx="1.8" ry="2.4" />
    <ellipse cx="14" cy="6" rx="1.8" ry="2.4" />
    <ellipse cx="18" cy="10" rx="1.8" ry="2.3" />
    <path d="M12 12c-2.5 0-5 3.5-5 6 0 1.8 1.5 2.5 3 2.2 1-.2 1.4-.6 2-.6s1 .4 2 .6c1.5.3 3-.4 3-2.2 0-2.5-2.5-6-5-6z" />
  </svg>
)
