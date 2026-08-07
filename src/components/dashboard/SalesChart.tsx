'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'

interface SalesChartProps {
  data: { mes: string; importe: number }[]
  title: string
  type?: 'line' | 'area'
  color?: string
}

export default function SalesChart({ data, title, type = 'line', color = '#003087' }: SalesChartProps) {
  const formatMonth = (mes: string) => {
    const [y, m] = mes.split('-')
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return `${months[parseInt(m) - 1]} ${y.slice(2)}`
  }

  const formattedData = data.map((d) => ({ ...d, label: formatMonth(d.mes) }))

  const formatCurrency = (value: number) => `$ ${value.toLocaleString('es-AR')}`

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4 before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-[#00AEEF] before:to-[#003087] before:content-['']">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        {type === 'area' ? (
          <AreaChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="label" fontSize={12} tickLine={false} />
            <YAxis fontSize={12} tickLine={false} tickFormatter={formatCurrency} />
            <Tooltip formatter={(value: number) => [formatCurrency(value), 'Importe']} />
            <Area type="monotone" dataKey="importe" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />
          </AreaChart>
        ) : (
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="label" fontSize={12} tickLine={false} />
            <YAxis fontSize={12} tickLine={false} tickFormatter={formatCurrency} />
            <Tooltip formatter={(value: number) => [formatCurrency(value), 'Importe']} />
            <Line type="monotone" dataKey="importe" stroke={color} strokeWidth={2} dot={{ fill: color, r: 4 }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
