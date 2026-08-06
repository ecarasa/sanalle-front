'use client'

import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color?: 'blue' | 'red' | 'green' | 'cyan' | 'amber' | 'orange' | 'purple'
  subtitle?: string
}

const colorMap = {
  blue: { bg: 'bg-primary/10', text: 'text-primary', icon: 'text-primary' },
  red: { bg: 'bg-secondary/10', text: 'text-secondary', icon: 'text-secondary' },
  green: { bg: 'bg-green-50', text: 'text-green-600', icon: 'text-green-600' },
  cyan: { bg: 'bg-accent/10', text: 'text-accent', icon: 'text-accent' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'text-amber-600' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'text-orange-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-600' },
}

export default function StatCard({ title, value, icon: Icon, color = 'blue', subtitle }: StatCardProps) {
  const colors = colorMap[color] || colorMap.blue
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${colors.text}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colors.bg}`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
      </div>
    </div>
  )
}
