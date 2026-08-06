'use client'

import GenericABM from '@/components/admin/GenericABM'

export default function ProveedoresPage() {
  return (
    <GenericABM
      title="Proveedores"
      subtitle="Gestión de proveedores de productos"
      endpoint="/proveedores"
      entityLabel="Proveedor"
      storageKey="abm-proveedores"
      searchPlaceholder="Buscar por nombre..."
      columns={[
        { key: 'id', label: 'ID', sortable: true },
        { key: 'nombre', label: 'Nombre', sortable: true },
        {
          key: 'telefono',
          label: 'Teléfono',
          render: (value: string | null) => value || '-',
        },
        {
          key: 'direccion',
          label: 'Dirección',
          render: (value: string | null) => value || '-',
        },
      ]}
      fields={[
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        { key: 'telefono', label: 'Teléfono', type: 'text' },
        { key: 'direccion', label: 'Dirección', type: 'text' },
      ]}
    />
  )
}
