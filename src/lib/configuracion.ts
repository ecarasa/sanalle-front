// Espejo de CONFIG_DEFAULTS en backend/app/routers/configuracion.py — si agregás
// una clave allá, agregala acá. Los valores viajan siempre como texto (la tabla
// `configuracion` es clave/valor con `valor String(500)`); convertir es
// responsabilidad de quien la lee, para eso está `numero()` en el hook.

export const CONFIG_DEFAULTS: Record<string, string> = {
  // Días para considerar un producto "nuevo" (badge y filtro).
  producto_nuevo_dias: '30',
  // Importe a partir del cual un pedido minorista pasa a precio mayorista.
  // '0' desactiva el escalón.
  umbral_mayorista: '800000',
}

export type ConfigKey = keyof typeof CONFIG_DEFAULTS
