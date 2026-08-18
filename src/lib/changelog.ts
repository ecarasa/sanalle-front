// Changelog estático de Droguería SANALLE.
// Para publicar una versión nueva: agregá un objeto ARRIBA de todo en RELEASES.
// El más nuevo va primero. `estado` controla el badge: 'en_curso' | 'publicado'.

export interface ChangelogItem {
  /** Categoría corta para agrupar visualmente (ej. "Clientes", "Productos"). */
  area: string
  /** Descripción del cambio, en lenguaje de negocio. */
  detalle: string
}

export interface Release {
  version: string
  /** Fecha ISO (YYYY-MM-DD) o texto libre para "en curso". */
  fecha: string
  estado: 'en_curso' | 'publicado'
  /** Título corto de la versión. */
  titulo: string
  cambios: ChangelogItem[]
}

export const RELEASES: Release[] = [
  {
    version: 'v3',
    fecha: '2026-08-11',
    estado: 'en_curso',
    titulo: 'Mejoras de módulos: filtros, herramientas comerciales y novedades',
    cambios: [
      { area: 'Clientes', detalle: 'Se arregló el filtro de localidad y de zona (antes no filtraba: traía todos los clientes).' },
      { area: 'Clientes', detalle: 'El filtro de Zona ahora es un desplegable con las zonas cargadas (oeste/este/sur, a elección desde Tablas).' },
      { area: 'Clientes', detalle: 'Nuevo semáforo de actividad por recencia de compra: verde (da continuidad), amarillo (compró hace poco), rojo (inactivo). Con filtro propio.' },
      { area: 'Productos', detalle: 'Ordenar por código y por fecha de carga (columna "Cargado") para ver el último producto ingresado.' },
      { area: 'Productos', detalle: 'Filtro "Nuevos" y badge NUEVO como herramienta comercial. La cantidad de días para considerar "nuevo" se configura en Configuración general.' },
      { area: 'Sistema', detalle: 'Nueva pantalla de Configuración general (admin), arrancando por los días de "producto nuevo".' },
      { area: 'Productos', detalle: 'Filtro "Sin PVP" y badge, para detectar y completar los precios que faltan.' },
      { area: 'Precios', detalle: 'Nuevo cuadro de Aumentos de PVP: cambios agrupados por fecha con % promedio y detalle de productos afectados.' },
      { area: 'Comisiones', detalle: 'Filtro por vendedor en el reporte de comisiones para unificar las ventas de uno solo.' },
      { area: 'Productos', detalle: 'Formato de venta por producto: se puede cargar un expendedor y habilitarlo para vender solo por blíster (precio y stock ajustados por unidad).' },
      { area: 'Productos', detalle: 'Listado en memoria: se carga todo una sola vez y el filtrado/orden/búsqueda es instantáneo (sin pegarle a la API por cada filtro). Recuerda la página al volver y actualiza solo la fila editada.' },
      { area: 'Productos', detalle: 'Se quitó el botón "Importar Excel" de la pantalla de productos.' },
      { area: 'Clientes', detalle: 'Unificar clientes ahora permite elegir qué dato queda campo por campo, sin importar el orden de selección.' },
      { area: 'Sistema', detalle: 'Nuevo Chat interno (individual y grupos) con avisos de mensajes no leídos.' },
      { area: 'Pedidos', detalle: 'Formato de venta completo end-to-end: la cantidad por blíster ahora se muestra bien en la app, el PDF, los reportes y la bitácora (antes salía 0). En el pedido, el stock disponible y el tope se calculan en la unidad correcta.' },
      { area: 'Pedidos', detalle: 'Se reactivó el listado de pedidos con filtros, estados y acciones (ver/editar/estado/eliminar/asignar repartidor), y volvió el estado de pago y el compromiso de pago.' },
      { area: 'Pedidos', detalle: '"Asignar repartidor" ahora lista solo repartidores.' },
      { area: 'Entregas', detalle: 'El mapa permite planificar y optimizar la ruta desde "listo para despacho" (antes solo con "en camino"), despachar toda la ruta en masa, e imprimir una hoja de ruta con el orden de paradas.' },
      { area: 'Clientes', detalle: 'Volvieron las columnas de balance en el listado (Remitos por cobrar, Facturas por cobrar y Deuda consolidada). Se arregló el coloreo de la cuenta corriente.' },
      { area: 'Finanzas', detalle: 'Nuevo módulo de Transacciones: cobros, pagos a proveedor y notas en una vista unificada, con links navegables a su pedido/compra/cliente/proveedor.' },
      { area: 'Logística', detalle: 'El repartidor ahora ve el módulo "Logística" (entregas + mapa + hoja de ruta) en su perfil.' },
      { area: 'Pedidos', detalle: 'Nuevo pedido rediseñado: se busca cliente por nombre/CUIT/razón social, en el alta de productos hay "Agregar y seguir" y atajos de teclado (Enter / Shift+Enter), y una barra fija abajo muestra el total y el botón Finalizar siempre a la vista.' },
      { area: 'Pedidos', detalle: 'Las fechas del pedido vienen precargadas: creación = hoy (editable), entrega = según los "Días de entrega" del cliente, y compromiso de pago = según su plazo. Cada cliente configura sus días de entrega y plazo de pago en su perfil.' },
      { area: 'Pedidos', detalle: 'La sección "Datos del pedido" quedó más compacta y ordenada (identidad / fechas / observación), y el listado tiene un filtro rápido "Sin repartidor".' },
      { area: 'Navegación', detalle: 'Menú lateral (sidebar) nuevo, reorganizado por grupos: Ventas, Catálogo, Compras, Cuentas, Comunicación y Configuración. "Vender" va directo a cargar un pedido.' },
      { area: 'Logística', detalle: 'Pantalla rediseñada: tarjetas de resumen, navegación por día con indicador de "Hoy", y las entregas de días futuros quedan en solo lectura. Se puede filtrar por fecha de entrega.' },
      { area: 'Pedidos', detalle: 'Selección con checkbox para cambiar el estado de despacho de varios pedidos a la vez (el botón se habilita al tildar). Filtros de despacho y pago reordenados en una tarjeta.' },
      { area: 'Cuentas', detalle: 'Nuevo módulo de Cuentas (cajas/bancos/billeteras) con una cuenta por defecto. Los cobros se asocian a una cuenta (a la default si no se elige otra).' },
      { area: 'Sistema', detalle: 'La página de Novedades ahora agrupa los cambios por tag.' },
      { area: 'Logística', detalle: 'Las entregas se agrupan por zona (Norte / Sur / Este / Oeste / Centro), cada zona con su total y colapsable, y la dirección del cliente quedó bien visible para el reparto. El navegador de día pasó al encabezado, entre el título y el selector Lista/Mapa.' },
      { area: 'Pedidos', detalle: 'Nueva columna Zona en el listado de pedidos.' },
      { area: 'Precios', detalle: 'Listas de precios públicas: 3 links para compartir sin login (minorista, mayorista y comercio) con precios actualizados en tiempo real. Cada link usa un token que se puede regenerar para revocar el anterior. Se administran desde Productos → "Listas públicas".' },
      { area: 'Marca', detalle: 'Las listas públicas y el catálogo ahora muestran "Vitalnova" (antes decía SANALLE).' },
      { area: 'Pedidos', detalle: 'PDF del pedido (imprimir con/sin valores) rediseñado: encabezado con la marca y la credencial del comprobante, tarjetas de Cliente y Comprobante con estados en color, total destacado con el importe en letras y observaciones en recuadro.' },
      { area: 'Logística', detalle: 'La hoja de ruta y la orden de compra estrenan el mismo diseño (encabezado de marca, tarjetas y acentos). La hoja de ruta ahora muestra la zona de cada parada y el total de bultos.' },
      { area: 'Chat', detalle: 'El chat pasó a tiempo real (WebSockets) en un server dedicado: mensajes al instante, envío optimista (se ven sin esperar), buscador de conversaciones y usuarios en memoria, indicador de "escribiendo…" y estado En vivo. Adiós al refresco por polling.' },
      { area: 'Navegación', detalle: 'Se corrigió el menú lateral que a veces requería doble click (se remontaba en cada actualización del badge de chat).' },
      { area: 'Sistema', detalle: 'Nuevo ABM de Entidades/Combos: una sola pantalla para administrar los valores de los desplegables (condición de pago, transporte, sociedad, tipo de precio y los que quieras agregar), con orden y activar/desactivar. Además el hub de Tablas ahora reúne Zonas, Localidades, Depósitos, Laboratorios, Bancos y más, accesible desde Configuración → Tablas.' },
      { area: 'Pedidos', detalle: 'Al cargar un pedido ahora se puede definir la Dirección de entrega (envío), que viene precargada con la dirección completa del cliente (domicilio, localidad, CP y provincia) y es editable por pedido. Botón "Usar la del cliente" para restaurarla.' },
      { area: 'Pedidos', detalle: 'Modal de detalle del pedido rediseñado, más grande y estructurado: encabezado con estados y semáforo, tarjetas de "Cliente y entrega" (teléfono, zona, localidad, domicilio, dirección de entrega, transporte, repartidor) y "Comprobante", tabla de ítems y footer con total y saldo.' },
      { area: 'Pedidos', detalle: 'Al cargar un pedido, los productos se precargan en memoria: buscarlos y agregarlos es instantáneo (sin pegarle a la API en cada búsqueda). Los clientes ya venían precargados.' },
      { area: 'Sistema', detalle: 'Nueva página de Novedades (esta), para dejar registro de cada actualización.' },
    ],
  },
  {
    version: 'v2',
    fecha: '2026-08',
    estado: 'publicado',
    titulo: 'ERP operativo: precios, depósitos y ventas',
    cambios: [
      { area: 'Precios', detalle: 'Scraper automático de PVP (alfabeta.net) con historial e actualización semanal, más log por producto.' },
      { area: 'Stock', detalle: 'Depósitos dinámicos: stock por depósito con stock fraccionario (cajas / blísters).' },
      { area: 'Ventas', detalle: 'Módulo Vender (pedidos), unificación de clientes y menú ERP con submenús.' },
      { area: 'UI', detalle: 'Nuevo header, restyle general y ajustes de experiencia.' },
      { area: 'Infra', detalle: 'Despliegue en Railway con backend y frontend separados.' },
    ],
  },
]
