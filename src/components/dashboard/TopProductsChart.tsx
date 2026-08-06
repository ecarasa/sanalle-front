'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const COLORS = ['#003087', '#E31837', '#00AEEF', '#10B981', '#F59E0B', '#8B5CF6']

interface BarChartProps {
  data: { nombre?: string; vendedor?: string; total: number; [key: string]: any }[]
  title: string
  dataKey?: string
  nameKey?: string
  color?: string
}

export function SimpleBarChart({
  data,
  title,
  dataKey = 'total',
  nameKey = 'nombre',
  color = '#003087',
}: BarChartProps) {
  const formatCurrency = (value: number) => `$ ${value.toLocaleString('es-AR')}`

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey={nameKey} fontSize={11} tickLine={false} />
          <YAxis fontSize={11} tickLine={false} tickFormatter={formatCurrency} />
          <Tooltip formatter={(value: number) => [formatCurrency(value), 'Total']} />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface PieChartComponentProps {
  data: { name: string; value: number }[]
  title: string
}

export function SimplePieChart({ data, title }: PieChartComponentProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }: { name: string; percent: number }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
            fontSize={11}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend fontSize={12} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
