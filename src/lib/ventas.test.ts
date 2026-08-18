import { describe, it, expect } from 'vitest'
import { unidadesDeProducto, precioBasePorUnidad, UNIDAD_LABEL } from './ventas'

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
