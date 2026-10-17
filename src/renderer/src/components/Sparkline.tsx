import React from 'react'

interface SparklineProps {
  data: number[]
  color: string // hex color e.g. #10b981
  height?: number
}

export const Sparkline: React.FC<SparklineProps> = ({ data, color, height = 42 }) => {
  const points = data.length >= 2 ? data : [15, 22, 18, 30, 26, 38, 32, 42, 36, 45]
  const width = 220
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = Math.max(max - min, 1)

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width
    const y = height - 6 - ((val - min) / range) * (height - 14)
    return { x, y }
  })

  // Build smooth cubic bezier path
  let pathD = `M ${coords[0].x},${coords[0].y}`
  for (let i = 0; i < coords.length - 1; i++) {
    const curr = coords[i]
    const next = coords[i + 1]
    const midX = (curr.x + next.x) / 2
    pathD += ` C ${midX},${curr.y} ${midX},${next.y} ${next.x},${next.y}`
  }

  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`
  const gradId = `spark-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full overflow-visible"
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.42" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
