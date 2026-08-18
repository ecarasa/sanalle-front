import { describe, it, expect } from 'vitest'
import { esGrupo, listaDe, listasDe } from './listas'

describe('esGrupo', () => {
  it('reconoce los grupos válidos', () => {
    expect(esGrupo('minorista')).toBe(true)
    expect(esGrupo('mayorista')).toBe(true)
    expect(esGrupo('comercio')).toBe(true)
  })
  it('rechaza valores inválidos', () => {
    expect(esGrupo('otro')).toBe(false)
    expect(esGrupo(null)).toBe(false)
    expect(esGrupo(3)).toBe(false)
  })
})

describe('listaDe / listasDe', () => {
  it('cada grupo tiene exactamente una lista', () => {
    expect(listasDe('minorista')).toHaveLength(1)
    expect(listaDe('comercio')?.grupo).toBe('comercio')
  })
})
