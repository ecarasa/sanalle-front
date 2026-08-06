'use client'

import { useAuth } from '@/hooks/useAuth'
import { Landmark, MapPin, Clock, Tag, Globe, Package, Box, Receipt, Truck, Users, FlaskConical } from 'lucide-react'
import Link from 'next/link'

const sections = [
  {
    title: 'Productos',
    description: 'Tablas necesarias para cargar y gestionar productos',
    items: [
      {
        title: 'Proveedores',
        description: 'Proveedores de mercadería',
        href: '/dashboard/admin/tablas/proveedores',
        icon: Truck,
      },
      {
        title: 'Laboratorios',
        description: 'Laboratorios / Marcas de productos',
        href: '/dashboard/admin/tablas/laboratorios',
        icon: FlaskConical,
      },
    ],
  },
  {
    title: 'Clientes',
    description: 'Tablas para la gestión de clientes',
    items: [
      {
        title: 'Localidades',
        description: 'Localidades, provincias y CP',
        href: '/dashboard/admin/tablas/localidades',
        icon: MapPin,
      },
    ],
  },
  {
    title: 'Pagos y Facturación',
    description: 'Tablas para pagos y condiciones impositivas',
    items: [
      {
        title: 'Bancos',
        description: 'Bancos para cheques y transferencias',
        href: '/dashboard/admin/tablas/bancos',
        icon: Landmark,
      },
      {
        title: 'Tipo IVA',
        description: 'Condiciones de IVA y tasas',
        href: '/dashboard/admin/tablas/tipo-iva',
        icon: Receipt,
      },
    ],
  },
]

export default function TablasPage() {
  useAuth()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tablas del Sistema</h1>
        <p className="text-sm text-gray-500 mt-1">Administra las tablas auxiliares del sistema</p>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="space-y-3">
          <div className="border-b border-gray-200 pb-2">
            <h2 className="text-lg font-semibold text-gray-800">{section.title}</h2>
            <p className="text-xs text-gray-400">{section.description}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.items.map((tabla) => (
              <Link
                key={tabla.href}
                href={tabla.href}
                className="group bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-[#00AEEF]/40 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#003087]/10 text-[#003087] shrink-0">
                    <tabla.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#003087] transition-colors">
                      {tabla.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">{tabla.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
