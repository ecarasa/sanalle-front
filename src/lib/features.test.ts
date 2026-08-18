import { describe, it, expect } from 'vitest'
import { featureKeyForHref, featureKeyForPath } from './features'

describe('featureKeyForHref', () => {
  it('mapea href exacto a su feature key', () => {
    expect(featureKeyForHref('/dashboard/admin/productos')).toBe('admin_productos')
    expect(featureKeyForHref('/dashboard/chat')).toBe('chat')
    expect(featureKeyForHref('/dashboard/novedades')).toBe('novedades')
  })
  it('devuelve undefined para un href desconocido', () => {
    expect(featureKeyForHref('/dashboard/no-existe')).toBeUndefined()
  })
})

describe('featureKeyForPath', () => {
  it('matchea por prefijo (rutas con subpaths)', () => {
    expect(featureKeyForPath('/dashboard/admin/productos/123')).toBe('admin_productos')
  })
  it('prefiere el href más largo (admin/clientes vs clientes)', () => {
    expect(featureKeyForPath('/dashboard/admin/clientes')).toBe('admin_clientes')
    expect(featureKeyForPath('/dashboard/clientes')).toBe('clientes')
  })
})
