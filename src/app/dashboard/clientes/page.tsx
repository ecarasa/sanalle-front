'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, CreditCard, BookOpen, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { GRUPO_BADGE, GRUPO_LABEL, GRUPO_OPTIONS, esGrupo } from '@/lib/listas'
import { useClientesData } from '@/hooks/useClientesData'
import DataGrid from '@/components/grilla/DataGrid'
import ClienteFormModal from '@/components/clientes/ClienteFormModal'
import { ClienteConDeuda } from '@/types'

export default function ClientesPage() {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  const {
    search, setSearch,
    page, setPage,
    pageSize, setPageSize,
    data, total, loading,
    localidades,
    fetchClientes,
    handleExport,
    handleColumnFilter,
  } = useClientesData()

  const columns = useMemo(() => [
    { key: 'id', label: 'ID', sortable: true },
    {
      key: 'nombre',
      label: 'Nombre',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string, row: ClienteConDeuda) => (
        <div className="flex items-center gap-2">
          <span>{value}</span>
          {!row.aprobado && (
            <span className="px-2 py-0.5 text-[10px] font-medium tracking-wide text-amber-700 bg-amber-100 rounded-full border border-amber-200 uppercase">
              Pendiente
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'domicilio',
      label: 'Domicilio',
      sortable: false,
      filterable: true,
      filterType: 'text' as const,
    },
    {
      key: 'localidad_nombre',
      label: 'Localidad',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'zona_nombre',
      label: 'Zona',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'tipo',
      label: 'Tipo',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: GRUPO_OPTIONS,
      render: (value: string | null) => esGrupo(value) ? (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${GRUPO_BADGE[value]}`}>
          {GRUPO_LABEL[value]}
        </span>
      ) : <span className="text-gray-400">-</span>,
    },
    {
      key: 'cuit',
      label: 'CUIT',
      sortable: false,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'vendedor_nombre',
      label: 'Vendedor',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'semaforo',
      label: 'Semáforo',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: [{ label: 'Verde', value: 'verde' }, { label: 'Amarillo', value: 'amarillo' }, { label: 'Rojo', value: 'rojo' }],
      render: (value: string | null, row: ClienteConDeuda) => {
        const colors: Record<string, string> = { verde: 'bg-green-500', amarillo: 'bg-yellow-400', rojo: 'bg-red-500' }
        if (!value) return <span className="text-gray-400 text-xs">-</span>
        const tooltip = row.dias_mora !== null ? `${value} (${row.dias_mora} días de deuda)` : value
        return <span className={`inline-block w-4 h-4 rounded-full ${colors[value] || 'bg-gray-300'}`} title={tooltip} />
      },
    },
    /* --- OCULTO (revivir): columnas Remitos / Facturas / Deuda. Ver docs/OCULTO_PARA_REVIVIR.md ---
    {
      key: 'saldo_remitos',
      label: 'Remitos por Cobrar',
      sortable: true,
      render: (value: number) => (
        <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {formatCurrency(Math.abs(value))}
        </span>
      ),
    },
    {
      key: 'saldo_facturas',
      label: 'Facturas por Cobrar',
      sortable: true,
      render: (value: number) => (
        <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {formatCurrency(Math.abs(value))}
        </span>
      ),
    },
    {
      key: 'deuda',
      label: 'Deuda Consolidada',
      sortable: true,
      render: (value: number) => (
        <span className={`font-bold ${value > 0 ? 'text-red-700' : 'text-green-700'}`}>
          {formatCurrency(Math.abs(value))}
        </span>
      ),
    },
    --- FIN OCULTO --- */
    {
      key: 'acciones',
      label: 'Acciones',
      stickyRight: true,
      sortable: false,
      render: (_value: unknown, row: ClienteConDeuda) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/clientes/${row.id}/nuevo-pedido`)}
            className="p-2 text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title="Nuevo Pedido"
            disabled={!row.aprobado}
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/clientes/${row.id}/nuevo-pago`)}
            className="p-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title="Nuevo Pago"
            disabled={!row.aprobado}
          >
            <CreditCard className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/clientes/${row.id}/cuenta-corriente`)}
            className="p-2 text-[#003087] bg-blue-50 rounded-lg hover:bg-blue-100 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title="Cuenta Corriente"
            disabled={!row.aprobado}
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ], [router])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona tus clientes, pedidos y pagos</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo Cliente</span>
        </button>
      </div>

      <DataGrid
        columns={columns}
        data={data}
        isLoading={loading}
        totalRows={total}
        page={page}
        pageSize={pageSize}
        searchValue={search}
        onSearch={setSearch}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onColumnFilter={handleColumnFilter}
        onExport={handleExport}
        searchPlaceholder="Buscar por nombre, CUIT, localidad..."
        storageKey="clientes-grid-columns"
      />

      <ClienteFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        localidades={localidades}
        onSuccess={fetchClientes}
      />
    </div>
  )
}
