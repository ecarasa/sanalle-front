import { describe, it, expect } from 'vitest'
import { enteroDeInput, decimalDeInput } from './inputNumerico'
import type { ChangeEvent } from 'react'

/** Simula el evento de un input, incluyendo que se le pueda pisar el `value`. */
function ev(valor: string) {
  const target = { value: valor } as HTMLInputElement
  return { target } as ChangeEvent<HTMLInputElement>
}

describe('enteroDeInput', () => {
  it('saca el cero pegado adelante', () => {
    expect(enteroDeInput(ev('01'))).toBe(1)
    expect(enteroDeInput(ev('007'))).toBe(7)
  })

  it('no toca los ceros del final', () => {
    expect(enteroDeInput(ev('100'))).toBe(100)
    expect(enteroDeInput(ev('10'))).toBe(10)
    expect(enteroDeInput(ev('1000'))).toBe(1000)
  })

  it('deja el cero solo como está', () => {
    expect(enteroDeInput(ev('0'))).toBe(0)
  })

  it('un campo vacío es 0', () => {
    expect(enteroDeInput(ev(''))).toBe(0)
  })

  it('corrige también el DOM, para cuando el estado no cambia', () => {
    const e = ev('01')
    enteroDeInput(e)
    expect(e.target.value).toBe('1')
  })

  it('no toca el DOM si no hacía falta', () => {
    const e = ev('100')
    enteroDeInput(e)
    expect(e.target.value).toBe('100')
  })

  it('el caso que reportó el usuario: 0 y después tipea 1', () => {
    // El campo mostraba "0", el cursor quedó atrás y el navegador armó "01".
    expect(enteroDeInput(ev('01'))).toBe(1)
    // Y si sigue tipeando hasta 100, no se rompe.
    expect(enteroDeInput(ev('010'))).toBe(10)
    expect(enteroDeInput(ev('0100'))).toBe(100)
  })
})

describe('decimalDeInput', () => {
  it('no se come el cero de un decimal', () => {
    expect(decimalDeInput(ev('0.5'))).toBe(0.5)
    expect(decimalDeInput(ev('0.05'))).toBe(0.05)
  })

  it('saca el cero pegado adelante pero conserva los decimales', () => {
    expect(decimalDeInput(ev('01.5'))).toBe(1.5)
    expect(decimalDeInput(ev('0012.75'))).toBe(12.75)
  })

  it('vacío es 0', () => {
    expect(decimalDeInput(ev(''))).toBe(0)
  })

  it('un valor sin sentido es 0 y no NaN', () => {
    expect(decimalDeInput(ev('-'))).toBe(0)
  })
})
