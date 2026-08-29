import { describe, it, expect } from 'vitest'
import {
  unidadesDeProducto,
  precioBasePorUnidad,
  recalcularLinea,
  precioConDescuento,
  UNIDAD_LABEL,
} from './ventas'

describe('unidadesDeProducto', () => {
  it('devuelve caja y blister cuando ambos están habilitados', () => {
    expect(unidadesDeProducto({ vende_caja: true, vende_blister: true })).toEqual(['caja', 'blister'])
  })

  it('devuelve solo blister cuando la caja está deshabilitada (caso azitromicina)', () => {
    expect(unidadesDeProducto({ vende_caja: false, vende_blister: true })).toEqual(['blister'])
  })

  it('cae a caja si no hay ninguna unidad habilitada (nunca queda vacío)', () => {
    expect(unidadesDeProducto({ vende_caja: false, vende_blister: false })).toEqual(['caja'])
  })
})

describe('precioBasePorUnidad', () => {
  it('caja: devuelve el precio de caja tal cual', () => {
    expect(precioBasePorUnidad(1000, 'caja', 30)).toBe(1000)
  })

  it('blister: precio de caja dividido por blisters_por_caja', () => {
    expect(precioBasePorUnidad(1200, 'blister', 30)).toBe(40)
  })

  it('blister sin blisters_por_caja válido: no fracciona, usa precio de caja', () => {
    expect(precioBasePorUnidad(1200, 'blister', 0)).toBe(1200)
    expect(precioBasePorUnidad(1200, 'blister', null)).toBe(1200)
  })

  it('precio de caja null: devuelve null (nunca 0)', () => {
    expect(precioBasePorUnidad(null, 'caja', 30)).toBeNull()
    expect(precioBasePorUnidad(null, 'blister', 30)).toBeNull()
  })
})

describe('UNIDAD_LABEL', () => {
  it('tiene etiquetas para caja y blister', () => {
    expect(UNIDAD_LABEL.caja).toMatch(/caja/i)
    expect(UNIDAD_LABEL.blister).toMatch(/blíster/i)
  })
})

describe('recalcularLinea', () => {
  it('sin descuento: el unitario es el de lista y el total multiplica', () => {
    expect(recalcularLinea({ precioLista: 1000, descuento: null, cantidad: 3 }))
      .toEqual({ precioUnitario: 1000, precioTotal: 3000 })
  })

  it('aplica el descuento sobre el precio de lista', () => {
    expect(recalcularLinea({ precioLista: 1000, descuento: 10, cantidad: 2 }))
      .toEqual({ precioUnitario: 900, precioTotal: 1800 })
  })

  it('el precio unitario pisado a mano manda sobre el descuento', () => {
    expect(recalcularLinea({ precioLista: 1000, descuento: 10, precioUnitario: 850, cantidad: 2 }))
      .toEqual({ precioUnitario: 850, precioTotal: 1700 })
  })

  it('un unitario forzado a 0 se respeta (bonificación), no cae al de lista', () => {
    expect(recalcularLinea({ precioLista: 1000, descuento: 0, precioUnitario: 0, cantidad: 5 }))
      .toEqual({ precioUnitario: 0, precioTotal: 0 })
  })

  it('precio de lista nulo sin unitario: queda en 0 en vez de NaN', () => {
    expect(recalcularLinea({ precioLista: null, descuento: 10, cantidad: 4 }))
      .toEqual({ precioUnitario: 0, precioTotal: 0 })
  })

  it('cantidad vacía o negativa no genera un total negativo', () => {
    expect(recalcularLinea({ precioLista: 1000, descuento: null, cantidad: 0 }).precioTotal).toBe(0)
    expect(recalcularLinea({ precioLista: 1000, descuento: null, cantidad: -2 }).precioTotal).toBe(0)
    expect(recalcularLinea({ precioLista: 1000, descuento: null, cantidad: NaN }).precioTotal).toBe(0)
  })
})

describe('precioConDescuento', () => {
  it('descuenta el porcentaje indicado', () => {
    expect(precioConDescuento(1000, 25)).toBe(750)
  })

  it('descuento nulo o 0 deja el precio intacto', () => {
    expect(precioConDescuento(1000, 0)).toBe(1000)
  })
})
