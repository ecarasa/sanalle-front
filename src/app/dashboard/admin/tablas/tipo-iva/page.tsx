'use client'

import GenericABM from '@/components/admin/GenericABM'

export default function TipoIvaPage() {
  return (
    <GenericABM
      title="Tipo IVA"
      subtitle="Gestión de condiciones impositivas"
      endpoint="/tipo-iva"
      entityLabel="Tipo IVA"
      storageKey="abm-tipo-iva"
      searchPlaceholder="Buscar por nombre..."
      columns={[
        { key: 'id', label: 'ID', sortable: true },
        { key: 'nombre', label: 'Nombre', sortable: true },
        {
          key: 'tasa',
          label: 'Tasa',
          sortable: true,
          render: (value: number) => value != null ? `${Number(value).toFixed(2)}%` : '-',
        },
        {
          key: 'discrimina',
          label: 'Discrimina',
          sortable: true,
          render: (value: string) => value === 'S' ? 'Sí' : 'No',
        },
      ]}
      fields={[
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        { key: 'tasa', label: 'Tasa', type: 'number', required: true, step: '0.01' },
        {
          key: 'discrimina',
          label: 'Discrimina',
          type: 'select',
          required: true,
          options: [
            { label: 'Sí', value: 'S' },
            { label: 'No', value: 'N' },
          ],
        },
      ]}
    />
  )
}
