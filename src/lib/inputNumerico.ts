import type { ChangeEvent } from 'react'

/**
 * Lectura de inputs numéricos sin el "01".
 *
 * El problema: un `<input type="number">` controlado que muestra `0` deja el
 * cursor detrás del cero, así que tipear `1` arma `"01"` en el DOM. React
 * normalmente lo corrige al re-renderizar, pero si el valor parseado coincide
 * con el que ya está en el estado (0 y se tipea otro 0, por ejemplo) no hay
 * re-render y el `"01"` queda ahí.
 *
 * La solución es sacar los ceros a la izquierda del propio campo antes de
 * parsear. Se corrige el DOM además del estado, para el caso en que el estado
 * no cambie y React no vuelva a pintar.
 *
 * Casos:
 *   "01"  -> 1      "007" -> 7      "100" -> 100   (no toca los ceros del final)
 *   "0"   -> 0      ""    -> 0      "0.5" -> 0.5   (no toca el cero antes del punto)
 */

/** Saca los ceros a la izquierda, pero sólo si queda un dígito detrás. */
function sinCerosIniciales(valor: string): string {
  const negativo = valor.startsWith('-')
  const cuerpo = negativo ? valor.slice(1) : valor
  // El lookahead `(?=\d)` es lo que salva a "0" y a "0.5": sólo recorta si
  // después de los ceros viene otro dígito.
  const limpio = cuerpo.replace(/^0+(?=\d)/, '')
  return negativo ? `-${limpio}` : limpio
}

function normalizar(e: ChangeEvent<HTMLInputElement>): string {
  const limpio = sinCerosIniciales(e.target.value)
  if (limpio !== e.target.value) {
    // Escribir el DOM a mano: si el estado no cambia, React no re-renderiza y el
    // campo se quedaría mostrando "01".
    e.target.value = limpio
  }
  return limpio
}

/** Entero de un input. Vacío o inválido = 0. */
export function enteroDeInput(e: ChangeEvent<HTMLInputElement>): number {
  const limpio = normalizar(e)
  if (limpio === '' || limpio === '-') return 0
  const n = parseInt(limpio, 10)
  return Number.isFinite(n) ? n : 0
}

/** Decimal de un input (precios, descuentos). Vacío o inválido = 0. */
export function decimalDeInput(e: ChangeEvent<HTMLInputElement>): number {
  const limpio = normalizar(e)
  if (limpio === '' || limpio === '-') return 0
  const n = Number(limpio)
  return Number.isFinite(n) ? n : 0
}

/**
 * Selecciona el contenido al enfocar: entrar a un campo que dice `0` y tipear
 * reemplaza en vez de concatenar. Complementa lo de arriba para el caso más
 * común, que es pararse en la cantidad y escribir otra.
 */
export function seleccionarAlEnfocar(e: { currentTarget: HTMLInputElement }): void {
  e.currentTarget.select()
}
