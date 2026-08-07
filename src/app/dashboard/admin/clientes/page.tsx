'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ShoppingCart, CreditCard, BookOpen, X, Loader2, Upload, FileSpreadsheet, FileJson, CheckCircle2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { GRUPO_BADGE, GRUPO_LABEL, GRUPO_OPTIONS, esGrupo } from '@/lib/listas'
import { useAuth } from '@/hooks/useAuth'
import { useClientesData } from '@/hooks/useClientesData'
import DataGrid from '@/components/grilla/DataGrid'
import ClienteFormModal from '@/components/clientes/ClienteFormModal'
import UnificarClientesModal from '@/components/admin/UnificarClientesModal'
import { GitMerge } from 'lucide-react'
import { ClienteConDeuda } from '@/types'

export default function AdminClientesPage() {
  useAuth()
  const router = useRouter()

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

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<ClienteConDeuda | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ClienteConDeuda | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [unificarOpen, setUnificarOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importData, setImportData] = useState<Record<string, unknown>[] | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importFileName, setImportFileName] = useState('')
  const [importFileType, setImportFileType] = useState<'json' | 'xlsx'>('json')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    created: number; updated: number; skipped: number; errors: string[]; vendedores_created?: string[]
  } | null>(null)

  const openEdit = (cliente: ClienteConDeuda) => {
    setEditingCliente(cliente)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingCliente(null)
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await api.delete(`/clientes/${deleteConfirm.id}`)
      toast.success('Cliente eliminado correctamente')
      setDeleteConfirm(null)
      fetchClientes()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al eliminar cliente')
    } finally {
      setDeleting(false)
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    setImportResult(null)
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    setImportFileType(isXlsx ? 'xlsx' : 'json')
    if (isXlsx) {
      setImportFile(file)
      setImportData(null)
    } else {
      setImportFile(null)
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string)
          setImportData(Array.isArray(parsed) ? parsed : [parsed])
        } catch {
          toast.error('El archivo no es un JSON valido')
          setImportData(null)
        }
      }
      reader.readAsText(file)
    }
  }

  const handleImportSubmit = async () => {
    setImporting(true)
    try {
      if (importFileType === 'xlsx' && importFile) {
        const formData = new FormData()
        formData.append('file', importFile)
        const res = await api.post('/clientes/import-xlsx', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        setImportResult(res.data)
        toast.success(`Importacion completada: ${res.data.created} creados, ${res.data.updated} actualizados`)
      } else if (importData?.length) {
        const res = await api.post('/clientes/import', importData)
        setImportResult(res.data)
        toast.success(`Importacion completada: ${res.data.created} creados, ${res.data.updated} actualizados`)
      }
      fetchClientes()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  const closeImportModal = () => {
    setImportModalOpen(false)
    setImportData(null)
    setImportFile(null)
    setImportFileName('')
    setImportResult(null)
  }

  const canImport = importFileType === 'xlsx' ? !!importFile : (importData?.length ?? 0) > 0

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
      key: 'razon_social',
      label: 'Razon Social',
      sortable: false,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
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
      key: 'categoria',
      label: 'Cat.',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: [
        { label: 'A', value: 'A' }, { label: 'B', value: 'B' }, { label: 'C', value: 'C' },
        { label: 'D', value: 'D' }, { label: 'E', value: 'E' },
      ],
      render: (value: string | null) => value || '-',
    },
    {
      key: 'vendedor_nombre',
      label: 'Vendedor',
      sortable: false,
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
        const tooltip = row.dias_mora !== null ? `${value} (${row.dias_mora} días)` : value
        return <span className={`inline-block w-4 h-4 rounded-full ${colors[value] || 'bg-gray-300'}`} title={tooltip} />
      },
    },
    /* --- OCULTO (revivir): columnas Remitos / Facturas / Deuda. Ver docs/OCULTO_PARA_REVIVIR.md ---
    {
      key: 'saldo_remitos',
      label: 'Remitos',
      sortable: true,
      render: (value: number) => (
        <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {formatCurrency(Math.abs(value))}
        </span>
      ),
    },
    {
      key: 'saldo_facturas',
      label: 'Facturas',
      sortable: true,
      render: (value: number) => (
        <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {formatCurrency(Math.abs(value))}
        </span>
      ),
    },
    {
      key: 'deuda',
      label: 'Deuda',
      sortable: true,
      render: (value: number) => (
        <span className={`font-bold ${value > 0 ? 'text-red-700' : 'text-green-700'}`}>
          {formatCurrency(Math.abs(value))}
        </span>
      ),
    },
    --- FIN OCULTO --- */
    {
      key: 'activo',
      label: 'Estado',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: [{ label: 'Activo', value: 'true' }, { label: 'Inactivo', value: 'false' }],
      render: (value: boolean) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {value ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      stickyRight: true,
      sortable: false,
      render: (_value: unknown, row: ClienteConDeuda) => (
        <div className="flex items-center gap-1.5">
          {/* --- OCULTO (revivir más adelante): Nuevo Pedido / Nuevo Pago / Cuenta Corriente ---
              Ver docs/OCULTO_PARA_REVIVIR.md. Reactivar descomentando este bloque.
          <button
            type="button"
            onClick={() => router.push(`/dashboard/clientes/${row.id}/nuevo-pedido`)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors disabled:opacity-50"
            title="Nuevo Pedido"
            disabled={!row.aprobado}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/clientes/${row.id}/nuevo-pago`)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            title="Nuevo Pago"
            disabled={!row.aprobado}
          >
            <CreditCard className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/clientes/${row.id}/cuenta-corriente`)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#003087] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            title="Cuenta Corriente"
            disabled={!row.aprobado}
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>
          --- FIN OCULTO --- */}
          <button
            type="button"
            onClick={() => openEdit(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirm(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ], [router])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-1.5 flex-shrink-0 rounded-full bg-gradient-to-b from-[#00AEEF] to-[#003087]" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Clientes</h1>
              <p className="mt-0.5 text-sm text-gray-500">Gestiona clientes, pedidos y pagos</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setUnificarOpen(true)}
            title="Unificar dos clientes duplicados"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
          >
            <GitMerge className="w-4 h-4" />
            <span className="hidden sm:inline">Unificar</span>
          </button>
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Importar</span>
          </button>
          <button
            type="button"
            onClick={() => { setEditingCliente(null); setModalOpen(true) }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Cliente</span>
          </button>
        </div>
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
        storageKey="admin-clientes-grid-columns"
      />

      <ClienteFormModal
        open={modalOpen}
        onClose={closeModal}
        editingCliente={editingCliente}
        localidades={localidades}
        onSuccess={fetchClientes}
        isAdmin={true}
      />

      {unificarOpen && (
        <UnificarClientesModal
          onClose={() => setUnificarOpen(false)}
          onMerged={fetchClientes}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Eliminar Cliente</h3>
                <p className="text-sm text-gray-500 mt-1">
                  ¿Está seguro que desea eliminar a <strong>{deleteConfirm.nombre}</strong>? Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={closeImportModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#003087]/10">
                  <Upload className="w-5 h-5 text-[#003087]" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Importar Clientes</h2>
              </div>
              <button type="button" onClick={closeImportModal} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <label
                htmlFor="import-clientes-file"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#003087]/50 hover:bg-gray-50 transition-colors"
              >
                {importFileName ? (
                  importFileType === 'xlsx'
                    ? <FileSpreadsheet className="w-8 h-8 text-green-600 mb-2" />
                    : <FileJson className="w-8 h-8 text-blue-600 mb-2" />
                ) : (
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                )}
                <span className="text-sm font-medium text-gray-600">{importFileName || 'Seleccionar archivo'}</span>
                <span className="text-xs text-gray-400 mt-1">Formatos: XLSX o JSON</span>
                <input id="import-clientes-file" type="file" accept=".json,.xlsx,.xls" className="hidden" onChange={handleImportFile} />
              </label>

              {importFileType === 'xlsx' && importFile && !importResult && (
                <div className="bg-green-50 rounded-lg p-4 flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Archivo Excel listo para importar</p>
                    <p className="text-xs text-green-700 mt-1">Los vendedores que no existan se crearán automáticamente.</p>
                  </div>
                </div>
              )}

              {importFileType === 'json' && importData && !importResult && (
                <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-3">
                  <FileJson className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">{importData.length} registros encontrados</p>
                    <p className="text-xs text-blue-700 mt-1">Se crearán nuevos o se actualizarán existentes (por nombre/CUIT)</p>
                  </div>
                </div>
              )}

              {importResult && (
                <div className="bg-green-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-semibold text-green-900">Importación completada</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-lg font-bold text-green-600">{importResult.created}</p>
                      <p className="text-xs text-gray-500">Creados</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-lg font-bold text-blue-600">{importResult.updated}</p>
                      <p className="text-xs text-gray-500">Actualizados</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-lg font-bold text-gray-400">{importResult.skipped}</p>
                      <p className="text-xs text-gray-500">Omitidos</p>
                    </div>
                  </div>
                  {importResult.vendedores_created && importResult.vendedores_created.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-800 mb-1">Vendedores creados (password: ventas123):</p>
                      <p className="text-xs text-blue-700">{importResult.vendedores_created.join(', ')}</p>
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="bg-amber-50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-medium text-amber-800">Errores:</span>
                      </div>
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-amber-700">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeImportModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {importResult ? 'Cerrar' : 'Cancelar'}
                </button>
                {!importResult && (
                  <button
                    type="button"
                    onClick={handleImportSubmit}
                    disabled={importing || !canImport}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors disabled:opacity-50"
                  >
                    {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                    Importar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
