'use client'

import GenericABM from '@/components/admin/GenericABM'

export default function TipoIvaPage() {
  return (
    <GenericABM
      title="Percepciones / IVA"
      subtitle="Conceptos impositivos que se pueden agregar a una compra (IVA 21, 10.5, IIBB provinciales…)"
      endpoint="/tipo-iva"
      entityLabel="Concepto"
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
          key: 'tipo',
          label: 'Tipo',
          sortable: true,
          render: (value: string) => value === 'iva' ? 'IVA' : 'Percepción',
        },
        {
          key: 'activo',
          label: 'Activo',
          sortable: true,
          render: (value: boolean) => value ? 'Sí' : 'No',
        },
      ]}
      fields={[
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        { key: 'tasa', label: 'Tasa (%)', type: 'number', required: true, step: '0.01' },
        {
          key: 'tipo',
          label: 'Tipo',
          type: 'select',
          required: true,
          options: [
            { label: 'IVA', value: 'iva' },
            { label: 'Percepción', value: 'percepcion' },
          ],
        },
        {
          key: 'activo',
          label: 'Activo',
          type: 'select',
          required: true,
          options: [
            { label: 'Sí', value: 'true' },
            { label: 'No', value: 'false' },
          ],
        },
      ]}
    />
  )
}
