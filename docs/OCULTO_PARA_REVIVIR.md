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

**Ítems ocultos del menú** (las rutas y páginas siguen existiendo, solo no se enlazan):

| Ítem | Ruta | Grupo original |
|------|------|----------------|
| Pedidos | `/dashboard/pedidos` | Operaciones |
| Entregas | `/dashboard/entregas` | Operaciones |
| Pagos | `/dashboard/pagos` | Operaciones |
| Compras (ingresos mercadería) | `/dashboard/admin/ingresos-mercaderia` | Operaciones |
| Gestión de Proveedores | `/dashboard/admin/proveedores` | Administración |
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

_Última actualización: 2026-08-04_
