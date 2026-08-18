'use client'

import GenericABM from '@/components/admin/GenericABM'

export default function ZonasPage() {
  return (
    <GenericABM
      title="Zonas"
      subtitle="Zonas de reparto (Norte, Sur, Este, Oeste…)"
      endpoint="/zonas"
      entityLabel="Zona"
      storageKey="abm-zonas"
      searchPlaceholder="Buscar por nombre..."
      columns={[
        { key: 'id', label: 'ID', sortable: true },
        { key: 'nombre', label: 'Nombre', sortable: true },
      ]}
      fields={[
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      ]}
    />
  )
}
