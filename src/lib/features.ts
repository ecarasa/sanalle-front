// Catálogo central de módulos gobernados por feature flags.
// Un flag que no existe en la DB se considera habilitado (default abierto).
// El rol super_admin ignora los flags: siempre ve todo.

export interface FeatureDef {
  key: string;
  label: string;
  grupo: string;
  /** Ruta que gobierna (menú + guard). Ausente en flags de capacidades puntuales. */
  href?: string;
  /** Texto descriptivo para la pantalla de Funcionalidades (si no hay href). */
  descripcion?: string;
  /** Valor cuando el flag no existe en la DB. true si se omite. */
  defaultEnabled?: boolean;
}

export const FEATURES: FeatureDef[] = [
  // General
  { key: 'stock', label: 'Stock / Productos', grupo: 'General', href: '/dashboard/stock' },
  { key: 'catalogo', label: 'Catálogo', grupo: 'General', href: '/catalogo' },
  { key: 'mis_ventas', label: 'Ventas (vendedores)', grupo: 'General', href: '/dashboard/mis-ventas' },
  { key: 'reportes', label: 'Reportes', grupo: 'General', href: '/dashboard/reportes' },
  { key: 'novedades', label: 'Novedades / Changelog', grupo: 'General', href: '/dashboard/novedades' },
  { key: 'chat', label: 'Chat interno', grupo: 'General', href: '/dashboard/chat' },
  // Operaciones
  { key: 'clientes', label: 'Clientes', grupo: 'Operaciones', href: '/dashboard/clientes' },
  { key: 'pedidos', label: 'Pedidos', grupo: 'Operaciones', href: '/dashboard/pedidos' },
  { key: 'cotizaciones', label: 'Cotizaciones (pedidos en borrador)', grupo: 'Operaciones', href: '/dashboard/cotizaciones' },
  { key: 'entregas', label: 'Entregas', grupo: 'Operaciones', href: '/dashboard/entregas' },
  { key: 'pagos', label: 'Pagos', grupo: 'Operaciones', href: '/dashboard/pagos' },
  { key: 'compras', label: 'Compras (ingresos de mercadería)', grupo: 'Operaciones', href: '/dashboard/admin/ingresos-mercaderia' },
  // Administración
  { key: 'admin_clientes', label: 'Gestión de Clientes', grupo: 'Administración', href: '/dashboard/admin/clientes' },
  { key: 'admin_productos', label: 'Gestión de Productos', grupo: 'Administración', href: '/dashboard/admin/productos' },
  { key: 'admin_proveedores', label: 'Gestión de Proveedores', grupo: 'Administración', href: '/dashboard/admin/proveedores' },
  { key: 'admin_pagos_proveedor', label: 'Pagos a proveedor', grupo: 'Administración', href: '/dashboard/admin/pagos-proveedor' },
  { key: 'admin_notas', label: 'Notas NC/ND', grupo: 'Administración', href: '/dashboard/admin/notas-credito-debito' },
  { key: 'admin_tablas', label: 'Tablas', grupo: 'Administración', href: '/dashboard/admin/tablas' },
  { key: 'admin_usuarios', label: 'Usuarios', grupo: 'Administración', href: '/dashboard/admin/usuarios' },
  { key: 'admin_configuracion', label: 'Configuración general', grupo: 'Administración', href: '/dashboard/admin/configuracion' },
  { key: 'transacciones', label: 'Transacciones', grupo: 'Administración', href: '/dashboard/transacciones' },
  {
    key: 'ajuste_stock_manual',
    label: 'Ajuste manual de stock',
    grupo: 'Administración',
    descripcion: 'Pestaña "Ajuste" (+/-) en Operación de Stock de Gestión de Productos. Para carga inicial o correcciones de inventario.',
    defaultEnabled: false,
  },
];

/** Valor por defecto de cada flag cuando no existe en la DB. */
export const FEATURE_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f.defaultEnabled !== false])
);

// Ordenado por href más largo primero para que /dashboard/admin/clientes
// matchee admin_clientes y no otro prefijo más corto.
const FEATURES_BY_HREF = FEATURES.filter(
  (f): f is FeatureDef & { href: string } => typeof f.href === 'string'
).sort((a, b) => b.href.length - a.href.length);

/** Feature key que gobierna un href de menú (match exacto por href). */
export function featureKeyForHref(href: string): string | undefined {
  return FEATURES.find((f) => f.href === href)?.key;
}

/** Feature key que gobierna una ruta (match por prefijo, ej. /dashboard/pedidos/123). */
export function featureKeyForPath(pathname: string): string | undefined {
  return FEATURES_BY_HREF.find((f) => pathname === f.href || pathname.startsWith(f.href + '/'))?.key;
}
