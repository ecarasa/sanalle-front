'use client'

import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color?: 'blue' | 'red' | 'green' | 'cyan' | 'amber' | 'orange' | 'purple'
  subtitle?: string
}

// Degradé por color, alineado con el lenguaje visual del navbar.
const gradientMap: Record<NonNullable<StatCardProps['color']>, string> = {
  blue: 'linear-gradient(135deg, #0A4BC2 0%, #003087 100%)',
  cyan: 'linear-gradient(135deg, #00AEEF 0%, #0093D4 100%)',
  green: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  red: 'linear-gradient(135deg, #F0476A 0%, #E31837 100%)',
  amber: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  orange: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
  purple: 'linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)',
}

export default function StatCard({ title, value, icon: Icon, color = 'blue', subtitle }: StatCardProps) {
  const gradient = gradientMap[color] || gradientMap.blue
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      {/* Glow decorativo en la esquina */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.08] blur-2xl transition-opacity duration-200 group-hover:opacity-[0.14]"
        style={{ background: gradient }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-gray-900 tabular-nums">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-black/10 transition-transform duration-200 group-hover:scale-105"
          style={{ background: gradient }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
