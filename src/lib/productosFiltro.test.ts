import { describe, it, expect } from 'vitest'
import { filtrarProductos, ordenarProductos, type ProductoFiltroCriterios } from './productosFiltro'
import type { Producto } from '@/types'

// Factory mínima: las funciones solo leen algunos campos.
function prod(p: Partial<Producto>): Producto {
  return {
    id: 1, codigo: 'C1', nombre: 'Producto', proveedor_id: null, laboratorio_id: null,
    pvp: null, categoria_producto: null, created_at: '2020-01-01T00:00:00Z',
    ...p,
  } as unknown as Producto
}

const AHORA = new Date('2026-08-11T00:00:00Z').getTime()

const baseCriterios = (over: Partial<ProductoFiltroCriterios> = {}): ProductoFiltroCriterios => ({
  search: '', proveedorId: '', laboratorioId: '', soloNuevos: false, sinPvp: false,
  productoNuevoDias: 30, columnFilters: {}, ahora: AHORA, ...over,
})

describe('filtrarProductos', () => {
  const items = [
    prod({ id: 1, nombre: 'Azitromicina 500', codigo: 'AZI500', proveedor_id: 10, laboratorio_id: 100, pvp: 1000, categoria_producto: 'GENERICO' }),
    prod({ id: 2, nombre: 'Ibuprofeno 400', codigo: 'IBU400', proveedor_id: 20, laboratorio_id: 100, pvp: null, categoria_producto: 'OTC' }),
    prod({ id: 3, nombre: 'Paracetamol', codigo: 'PARA', proveedor_id: 10, laboratorio_id: 200, pvp: 500, categoria_producto: 'OTC' }),
  ]

  it('busca por nombre / código / categoría (case-insensitive)', () => {
    expect(filtrarProductos(items, baseCriterios({ search: 'azi' })).map(p => p.id)).toEqual([1])
    expect(filtrarProductos(items, baseCriterios({ search: 'IBU400' })).map(p => p.id)).toEqual([2])
    expect(filtrarProductos(items, baseCriterios({ search: 'otc' })).map(p => p.id)).toEqual([2, 3])
  })

  it('filtra por proveedor y por laboratorio', () => {
    expect(filtrarProductos(items, baseCriterios({ proveedorId: '10' })).map(p => p.id)).toEqual([1, 3])
    expect(filtrarProductos(items, baseCriterios({ laboratorioId: '100' })).map(p => p.id)).toEqual([1, 2])
  })

  it('filtra "sin PVP"', () => {
    expect(filtrarProductos(items, baseCriterios({ sinPvp: true })).map(p => p.id)).toEqual([2])
  })

  it('filtra "nuevos" según los días configurados (usando ahora inyectado)', () => {
    const recientes = [
      prod({ id: 1, created_at: '2026-08-01T00:00:00Z' }), // hace ~10 días
      prod({ id: 2, created_at: '2026-06-01T00:00:00Z' }), // hace >30 días
    ]
    expect(filtrarProductos(recientes, baseCriterios({ soloNuevos: true })).map(p => p.id)).toEqual([1])
    // con ventana de 120 días entran ambos
    expect(filtrarProductos(recientes, baseCriterios({ soloNuevos: true, productoNuevoDias: 120 })).map(p => p.id)).toEqual([1, 2])
  })

  it('aplica filtros de columna (contains)', () => {
    expect(filtrarProductos(items, baseCriterios({ columnFilters: { categoria_producto: 'generico' } })).map(p => p.id)).toEqual([1])
    expect(filtrarProductos(items, baseCriterios({ columnFilters: { codigo: 'IBU' } })).map(p => p.id)).toEqual([2])
  })

  it('combina varios filtros', () => {
    const r = filtrarProductos(items, baseCriterios({ proveedorId: '10', columnFilters: { categoria_producto: 'otc' } }))
    expect(r.map(p => p.id)).toEqual([3])
  })
})

describe('ordenarProductos', () => {
  const items = [
    prod({ id: 1, nombre: 'Beta', pvp: 300 }),
    prod({ id: 2, nombre: 'alfa', pvp: null }),
    prod({ id: 3, nombre: 'Gamma', pvp: 100 }),
  ]

  it('ordena por texto asc (case-insensitive, es)', () => {
    expect(ordenarProductos(items, 'nombre', 'asc').map(p => p.id)).toEqual([2, 1, 3])
  })

  it('ordena por número desc', () => {
    // nulls al final incluso en desc
    expect(ordenarProductos(items, 'pvp', 'desc').map(p => p.id)).toEqual([1, 3, 2])
  })

  it('nulls siempre al final en asc', () => {
    expect(ordenarProductos(items, 'pvp', 'asc').map(p => p.id)).toEqual([3, 1, 2])
  })

  it('no muta el array original', () => {
    const copia = [...items]
    ordenarProductos(items, 'nombre', 'asc')
    expect(items).toEqual(copia)
  })
})
