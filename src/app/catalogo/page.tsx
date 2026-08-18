'use client'

import { ShoppingBag, Store, User, Users } from 'lucide-react'
import Link from 'next/link'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Vitalnova'

export default function CatalogoPublico() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Premium Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#003087] rounded-xl flex items-center justify-center shadow-lg shadow-[#003087]/20">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#003087] to-blue-600">
                  {APP_NAME}
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium tracking-wider uppercase">
                  Catálogo de Productos
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-4">
            Bienvenido al Catálogo
          </h2>
          <p className="text-gray-500 text-lg">
            Seleccione su perfil para ver precios y disponibilidad
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
          <Link
            href="/catalogo/minorista"
            className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 hover:shadow-2xl hover:border-[#003087]/20 transition-all group flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-yellow-500/10 text-yellow-600 group-hover:bg-yellow-500 group-hover:text-white transition-all duration-500 flex items-center justify-center mb-6">
              <User className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 group-hover:text-[#003087] transition-colors">Venta Minorista</h3>
            <p className="text-gray-500 mt-2">Acceso a precios para público general</p>
          </Link>

          <Link
            href="/catalogo/mayorista"
            className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 hover:shadow-2xl hover:border-[#003087]/20 transition-all group flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-[#003087]/10 text-[#003087] group-hover:bg-[#003087] group-hover:text-white transition-all duration-500 flex items-center justify-center mb-6">
              <Users className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 group-hover:text-[#003087] transition-colors">Venta Mayorista</h3>
            <p className="text-gray-500 mt-2">Acceso exclusivo para farmacias y droguerías</p>
          </Link>

          <Link
            href="/catalogo/comercio"
            className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 hover:shadow-2xl hover:border-[#003087]/20 transition-all group flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-[#00AEEF]/10 text-[#00AEEF] group-hover:bg-[#00AEEF] group-hover:text-white transition-all duration-500 flex items-center justify-center mb-6">
              <Store className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 group-hover:text-[#003087] transition-colors">Venta a Comercios</h3>
            <p className="text-gray-500 mt-2">Precios por formato: blisteado, estuchado y hospitalario</p>
          </Link>
        </div>
      </main>

      <footer className="py-8 text-center text-gray-400 text-sm">
        &copy; {new Date().getFullYear()} {APP_NAME} - Droguería y Distribuidora de Medicamentos.
      </footer>
    </div>
  )
}
