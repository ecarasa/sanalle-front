# Cosas ocultas para revivir más adelante

Registro de todo lo que **ocultamos temporalmente** durante el rollout gradual de la app
(mostrar de a poco para no abrumar a los usuarios). Nada se borró: todo sigue en el código
y es reversible. Este archivo es la checklist para reactivar cada cosa cuando toque.

> Convención: en el código, los bloques ocultos llevan el marcador
> `OCULTO (revivir` para poder encontrarlos con un grep:
> `grep -rn "OCULTO (revivir" frontend/src`

---

## 1. Menú de navegación (TopNav)

**Archivo:** `frontend/src/components/layout/TopNav.tsx`

El menú se simplificó a **Dashboard · Clientes · Productos** (más Usuarios y Funcionalidades
solo para `super_admin`). Se quitaron del menú los dropdowns "Operaciones" y "Administración"
completos.

**Ya revividos:**
- ✅ **Proveedores** (`/dashboard/admin/proveedores`) — revivido 2026-08-06 para poder poblar los combos de los productos. Visible para admin/super_admin.
- ✅ **Laboratorios** (`/dashboard/admin/tablas/laboratorios`) — revivido 2026-08-06 (ABM ya existente, expuesto en el menú). El resto de **Tablas** sigue oculto.

**Ítems ocultos del menú** (las rutas y páginas siguen existiendo, solo no se enlazan):

| Ítem | Ruta | Grupo original |
|------|------|----------------|
| Pedidos | `/dashboard/pedidos` | Operaciones |
| Entregas | `/dashboard/entregas` | Operaciones |
| Pagos | `/dashboard/pagos` | Operaciones |
| Compras (ingresos mercadería) | `/dashboard/admin/ingresos-mercaderia` | Operaciones |
| Notas NC/ND | `/dashboard/admin/notas-credito-debito` | Administración |
| Tablas | `/dashboard/admin/tablas` | Administración |
| Catálogo | `/catalogo` | General |
| Reportes | `/dashboard/reportes` | General (era solo super_admin) |
| Cuenta Sanalle/Vitalnova | `/dashboard/admin/cuenta-sanalle` | General |
| Ventas (vendedores) | `/dashboard/mis-ventas` | General (rol ventas) |

**Cómo revivir:** volver a agregar el ítem al array `navItems` en `TopNav.tsx`.
Alternativamente, gran parte de esto también se puede gobernar desde la pantalla
**Funcionalidades** (feature flags) — ver `frontend/src/lib/features.ts`.

**Nota sobre Clientes/Productos:** el destino del ítem cambia por rol.
- admin / super_admin → `/dashboard/admin/clientes` y `/dashboard/admin/productos` (gestión completa).
- ventas → `/dashboard/clientes` y `/dashboard/stock` (vistas operativas).

---

## 2. Botones de acción en Gestión de Clientes

**Archivo:** `frontend/src/app/dashboard/admin/clientes/page.tsx`
(columna "Acciones", dentro del `render`)

Se dejaron visibles solo **Editar** y **Eliminar**. Se ocultaron (bloque comentado con
marcador `OCULTO (revivir`):

| Botón | Ícono | Acción |
|-------|-------|--------|
| Nuevo Pedido | `ShoppingCart` | `router.push('/dashboard/clientes/:id/nuevo-pedido')` |
| Nuevo Pago | `CreditCard` | `router.push('/dashboard/clientes/:id/nuevo-pago')` |
| Cuenta Corriente | `BookOpen` | `router.push('/dashboard/clientes/:id/cuenta-corriente')` |

**Cómo revivir:** descomentar el bloque `{/* --- OCULTO (revivir ... --- */}` en la columna
de acciones. Los imports (`ShoppingCart`, `CreditCard`, `BookOpen`) siguen presentes.

---

## 3. Contenido del Dashboard

**Archivo:** `frontend/src/app/dashboard/page.tsx`

El panel muestra un placeholder **"Panel en preparación"** en lugar de las métricas.
Todo el código (StatCards, gráficos, tablas, calendario, `VentasDashboard`, `AdminDashboard`,
selector de período) **sigue intacto**, solo no se renderiza.

Controlado por la constante `DASHBOARD_CONTENT_ENABLED` (hoy en `false`).

**Cómo revivir:** poner `const DASHBOARD_CONTENT_ENABLED = true` en `DashboardPage`.
Vuelve a aparecer el panel completo (y el selector de período) tal cual estaba.

---

## 4. Columnas Remitos / Facturas / Deuda en Clientes

**Archivos:**
- `frontend/src/app/dashboard/admin/clientes/page.tsx` (vista admin)
- `frontend/src/app/dashboard/clientes/page.tsx` (vista operativa / ventas)

Se ocultaron las columnas **Remitos**, **Facturas** y **Deuda** (saldos/deuda del cliente),
comentadas con el marcador `OCULTO (revivir` dentro del array `columns`.

**Cómo revivir:** descomentar el bloque `/* --- OCULTO (revivir ... --- */` en cada archivo.

---

## 5. Filas expandibles de Proveedores (panel de pago/deuda)

**Archivo:** `frontend/src/app/dashboard/admin/proveedores/page.tsx`

El listado se dejó como tabla plana (como los demás). Se desactivó la **columna del chevron**
y el **panel expandido** (que incluía `PagoProveedorPanel` — pago de deuda a proveedores —,
notas de crédito y condiciones comerciales). Todo el código sigue intacto.

Controlado por la constante `PROVEEDOR_EXPAND_ENABLED` (hoy en `false`).

**Cómo revivir:** poner `const PROVEEDOR_EXPAND_ENABLED = true`.

> Nota: la columna **Saldo Pendiente** (deuda) sigue visible en el listado. Si se quiere
> ocultar también, quitar/comentar la columna `saldo_pendiente_total`.

---

_Última actualización: 2026-08-04_
