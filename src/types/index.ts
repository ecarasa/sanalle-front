import type { Grupo, ListaKey } from '@/lib/listas';

export interface TipoIva {
  id: number;
  nombre: string;
  tasa: number;
  discrimina: string;
}

export interface PagoPendienteInfo {
  id: number;
  numero: string;
  numero_comprobante: string;
  fecha: string;
  importe_total: number;
  saldo_pendiente: number;
  fecha_vencimiento: string | null;
}

export interface NotaProveedorInfo {
  id: number;
  numero: string;
  tipo: 'credito' | 'debito';
  fecha: string;
  importe_total: number;
}

export interface Proveedor {
  id: number;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  activo: boolean;
  tipo: 'LABORATORIO' | 'DROGUERIA';
  plazo_pago: number;
  deuda_inicial: number;
  saldo_remito: number;
  saldo_factura: number;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_email: string | null;
  descuento: number;
  cashback: number;
  cashback_parcial: number;
  cashback_total: number;
  created_at: string;
  updated_at: string;
  saldo_pendiente_total?: number;
  pagos_pendientes?: PagoPendienteInfo[];
  notas?: NotaProveedorInfo[];
  total_notas_credito?: number;
  cashback_pendiente?: number;
}

export interface PagoDeudaProveedorResponse {
  total_pagado: number;
  movimiento_id: number;
  ingresos_saldados: number[];
  descuento_aplicado: number;
  cashback_acumulado?: number;
}

export interface Banco {
  id: number;
  nombre: string;
  codigo: string | null;
  activo: boolean;
  created_at: string;
}

export interface Localidad {
  id: number;
  nombre: string;
  provincia: string | null;
  codigo_postal: string | null;
  activo: boolean;
  created_at: string;
}

export interface Zona {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Laboratorio {
  id: number;
  nombre: string;
  activo: boolean;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  nombre_completo: string;
  rol: 'super_admin' | 'admin' | 'ventas' | 'repartidor' | 'operaciones';
  activo: boolean;
  debe_cambiar_contrasena: boolean;
  created_at: string;
  comision_generico: number;
  comision_otc: number;
}

export interface Cliente {
  id: number;
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  domicilio: string;
  localidad_nombre: string | null;
  localidad_provincia?: string | null;
  localidad_codigo_postal?: string | null;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  categoria: string;
  tipo: string;
  zona_id?: number;
  zona_nombre?: string;
  condicion_pago: string;
  /** Último transporte usado con este cliente; se propone al cargar un pedido. */
  transporte_habitual: string | null;
  plazo_dias: number | null;
  dias_entrega: number | null;
  vendedor_id: number | null;
  activo: boolean;
  localidad_id: number | null;
  avg_dias_pago: number | null;
  aprobado: boolean;
  comentarios: string | null;
  deuda_inicial: number;
  deuda_inicial_remito: number;
  deuda_inicial_factura: number;
  created_at: string;
  updated_at: string;
}

/** Una dirección de entrega de la libreta del cliente. */
export interface ClienteDireccion {
  id: number;
  cliente_id: number;
  etiqueta: string;
  direccion: string;
  localidad_id: number | null;
  localidad_nombre: string | null;
  codigo_postal: string | null;
  latitud: number | null;
  longitud: number | null;
  es_default: boolean;
  activo: boolean;
}

export interface ClienteConDeuda extends Cliente {
  deuda: number;
  saldo_remitos: number;
  saldo_facturas: number;
  vendedor_nombre: string | null;
  semaforo: string | null;
  dias_mora: number | null;
  ultima_compra: string | null;
  dias_ultima_compra: number | null;
  semaforo_actividad: string | null;
}


/** Depósito / almacén desde el que se vende y al que ingresa mercadería. */
export interface Deposito {
  id: number;
  nombre: string;
  activo: boolean;
  orden: number;
}

/** Stock de un producto en un depósito puntual. */
export interface StockDeposito {
  deposito_id: number;
  nombre: string | null;
  orden: number;
  activo: boolean;
  cajas: number;
  blisters: number;
  /** Comprometido en pedidos creados y no entregados. */
  reservado_cajas: number;
  reservado_blisters: number;
  /** Vendible, ya expresado en blísters: es contra esto que se valida una venta. */
  total_blisters: number;
  reservado_total_blisters: number;
}

/** Recuento físico de un depósito. */
export interface TomaInventario {
  id: number;
  numero: string;
  deposito_id: number;
  deposito_nombre: string | null;
  estado: 'borrador' | 'aplicada' | 'anulada';
  origen: string;
  fecha: string;
  observacion: string | null;
  creado_por_nombre: string | null;
  aplicado_por_nombre: string | null;
  aplicada_at: string | null;
  created_at: string;
  resumen?: TomaInventarioResumen | null;
  total_lineas?: number;
}

export interface TomaInventarioResumen {
  lineas: number;
  contadas: number;
  con_diferencia: number;
  delta_positivo_blisters: number;
  delta_negativo_blisters: number;
  movidas_durante_conteo: number;
}

export interface TomaInventarioLinea {
  producto_id: number;
  producto_codigo: string | null;
  producto_nombre: string | null;
  blisters_por_caja: number | null;
  esperado_cajas: number;
  esperado_blisters: number;
  contado_cajas: number | null;
  contado_blisters: number | null;
  actual_cajas: number;
  actual_blisters: number;
  reservado_cajas: number;
  diferencia_blisters: number | null;
  movido_durante_conteo: boolean;
}

/** Motivo tipificado de un ajuste de stock. Lo sirve GET /stock/motivos-ajuste. */
export interface MotivoAjuste {
  codigo: string;
  label: string;
  /** true = es pérdida de mercadería (rotura, vencido, faltante). */
  es_merma: boolean;
}

/** Color del semáforo de stock. null = el producto no tiene mínimo configurado. */
export type SemaforoStock = 'rojo' | 'amarillo' | 'verde' | null;

export interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  foto_url: string | null;
  // Stock por depósito: una entrada por depósito donde el producto tuvo movimiento.
  stocks: StockDeposito[];
  // Totales de los depósitos activos y semáforo, calculados por el backend
  // (`stock_service`), que es donde vive la única definición de "cuánto hay".
  stock_total_cajas: number;
  stock_total_blisters: number;
  stock_minimo_blisters_total: number;
  semaforo_stock: SemaforoStock;
  // Mínimos
  stock_minimo_cajas: number;
  stock_minimo_blisters: number;
  // Unidades
  blisters_por_caja: number | null;
  comprimidos_por_blister: number | null;
  categoria_producto: string | null;
  presentacion: string | null;
  status: string | null;
  // Formato de venta habilitado
  vende_caja: boolean;
  vende_blister: boolean;
  vende_comprimido: boolean;
  pvp: number | null;
  fecha_act_pvp: string | null;
  margen_minorista: number | null;
  margen_mayorista: number | null;
  costo_porcentaje: number | null;
  costo_neto: number | null;
  costo_mas_iibb: number | null;
  precio_venta_minorista: number | null;
  precio_venta_mayorista: number | null;
  // Lista comercio: margen null = el producto no se vende en ese formato
  margen_comercio: number | null;
  precio_venta_comercio: number | null;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  laboratorio_id: number | null;
  laboratorio_nombre: string | null;
  url_pvp: string | null;
  pvp_descripcion: string | null;
  rentabilidad: number | null;
  created_at: string;
  updated_at: string;
}

export interface PedidoItem {
  id?: number;
  producto_id: number;
  /** Depósito del que sale la línea. */
  deposito_id?: number | null;
  deposito_nombre?: string | null;
  cantidad: number;
  cantidad_cajas?: number;
  cantidad_blisters?: number;
  unidad_venta?: 'caja' | 'blister';
  blisters_por_caja?: number | null;
  presentacion?: string | null;
  precio_lista?: number | null;
  descuento_porcentaje?: number | null;
  precio_unitario: number;
  precio_total: number;
  producto_nombre?: string;
  margen?: number | null;
  producto_precios?: Partial<Record<ListaKey, number | null>>;
}

/** Producto tal como lo devuelve el catálogo público: sólo los precios de su lista. */
export interface ProductoPublico {
  id: number;
  codigo: string;
  nombre: string;
  foto_url: string | null;
  /** Total de cajas sumando depósitos activos. */
  stock_total_cajas: number;
  categoria_producto: string | null;
  presentacion: string | null;
  comprimidos_por_blister: number | null;
  blisters_por_caja: number | null;
  laboratorio_id: number | null;
  laboratorio_nombre: string | null;
  precios: Partial<Record<ListaKey, number | null>>;
}

export interface BitacoraEntrada {
  id: number;
  pedido_id: number;
  numero_pedido: string | null;
  usuario_id: number | null;
  usuario_nombre: string | null;
  evento: string;
  entidad: 'pedido' | 'item';
  accion: 'alta' | 'baja' | 'modificacion';
  campo: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  producto_id: number | null;
  producto_nombre: string | null;
  grupo_id: string | null;
  observacion: string | null;
  created_at: string;
}

/** Un tramo del plan de cobro de un pedido: forma, cuenta destino e importe.
 *  Es informativo: no genera Pagos ni mueve la cuenta corriente. */
export interface PedidoPlanPago {
  id?: number;
  forma: string;
  cuenta_id: number | null;
  importe: number;
  cuenta_nombre?: string | null;
  observacion?: string | null;
}

/** Cómo llega la mercadería al cliente. Define qué remito se imprime. */
export type ModalidadEntrega = 'envio' | 'retira';

export interface Pedido {
  id: number;
  numero_pedido: string;
  cliente_id: number;
  cliente_nombre: string | null;
  cliente_tipo: string | null;
  vendedor_id: number;
  vendedor_nombre: string | null;
  shipping_status: 'borrador' | 'pendiente' | 'en_preparacion' | 'listo_para_despacho' | 'en_camino' | 'entregado' | 'cancelado';
  payment_status: 'pendiente' | 'pagado' | 'cancelado' | 'parcial';
  tipo_precio: Grupo | null;
  semaforo: string | null;
  tipo_documento: 'remito' | 'factura' | null;
  fecha: string;
  fecha_entrega: string | null;
  transporte: string | null;
  /** 'envio' = se despacha a la dirección de entrega; 'retira' = el cliente pasa por el depósito. */
  modalidad_entrega: ModalidadEntrega;
  fecha_compromiso_pago: string | null;
  despachado: boolean;
  sociedad: string | null;
  /** Nombres de los depósitos de los que sale el pedido. */
  depositos?: string[];
  importe_total: number;
  saldo_pendiente: number;
  observacion: string | null;
  cliente_domicilio?: string | null;
  cliente_telefono?: string | null;
  cliente_localidad?: string | null;
  cliente_codigo_postal?: string | null;
  cliente_provincia?: string | null;
  cliente_zona?: string | null;
  repartidor_id: number | null;
  repartidor_nombre: string | null;
  direccion_entrega_id?: number | null;
  direccion_entrega?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  bultos: number;
  /** False = el pedido no compromete mercadería (se factura antes del ingreso). */
  reserva_stock: boolean;
  items: PedidoItem[];
  plan_pago: PedidoPlanPago[];
  created_at: string;
  updated_at: string;
}

export interface PagoImputacion {
  id: number;
  pago_id: number;
  pedido_id: number;
  numero_pedido: string | null;
  monto: number;
  observacion: string | null;
  created_at: string;
}

export interface PagoProveedorLinked {
  id: number;
  proveedor_id: number;
  proveedor_nombre: string | null;
  pago_id: number | null;
  importe: number;
  fecha_pago: string;
  tipo_pago: string;
  tipo_cuenta: string;
  referencia_pago: string | null;
  observacion: string | null;
  usuario_id: number;
  created_at: string;
  updated_at: string;
}

export interface Pago {
  id: number;
  cliente_id: number;
  cliente_nombre: string | null;
  receptor_id: number;
  receptor_nombre: string | null;
  tipo_pago: 'efectivo' | 'cheque' | 'transferencia' | 'retencion';
  importe: number;
  saldo_restante: number;
  fecha_recepcion: string;
  estado: 'pendiente' | 'recibido' | 'imputado' | 'imputado_parcial' | 'acreditado' | 'rechazado';
  observacion: string | null;
  recibo_pdf_path: string | null;
  numero_recibo: string;
  banco_id: number | null;
  ch_numero: string | null;
  ch_banco: string | null;
  ch_fecha: string | null;
  ch_vto: string | null;
  retencion_tipo: string | null;
  retencion_numero: string | null;
  retencion_fecha: string | null;
  transferencia_numero: string | null;
  transferencia_fecha: string | null;
  transferencia_cuenta_origen: string | null;
  grupo_recibo_id: string | null;
  tipo_cuenta: 'remito' | 'factura';
  es_puente?: boolean;
  created_at: string;
  updated_at: string;
  imputaciones: PagoImputacion[];
  pagos_proveedor: PagoProveedorLinked[];
}

export interface NotaCreditoItem {
  id?: number;
  producto_id: number | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
}

export interface NotaCreditoDebito {
  id: number;
  numero: string;
  tipo: 'credito' | 'debito';
  cliente_id: number;
  cliente_nombre: string | null;
  fecha: string;
  importe_total: number;
  motivo: string | null;
  pedido_id: number | null;
  creado_por_id: number;
  creado_por_nombre: string | null;
  tipo_cuenta: 'remito' | 'factura';
  items: NotaCreditoItem[];
  created_at: string;
}

export interface IngresoMercaderiaItem {
  id?: number;
  producto_id: number;
  producto_nombre?: string;
  cantidad_cajas: number;
  cantidad_blisters: number;
  costo_unitario: number | null;
}

export interface IngresoImputacion {
  id: number;
  pago_proveedor_id: number;
  importe_aplicado: number;
  fecha_pago: string;
  tipo_pago: string;
  referencia_pago: string | null;
}

export interface IngresoImpuesto {
  id: number;
  tipo_iva_id: number | null;
  concepto: string;
  base: number;
  tasa: number;
  importe: number;
}

export interface IngresoMercaderia {
  id: number;
  numero: string;
  fecha: string;
  destino: string;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  numero_comprobante: string;
  observacion: string | null;
  creado_por_id: number;
  creado_por_nombre: string | null;
  items: IngresoMercaderiaItem[];
  impuestos: IngresoImpuesto[];
  imputaciones: IngresoImputacion[];
  subtotal_neto: number;
  importe_total: number;
  saldo_pendiente: number;
  fecha_vencimiento: string | null;
  created_at: string;
  archivo_url?: string | null;
}

export interface SolicitudCambioCliente {
  id: number;
  cliente_id: number;
  cliente_nombre: string | null;
  solicitante_id: number;
  solicitante_nombre: string | null;
  campo: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  motivo: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  revisado_por_id: number | null;
  revisado_por_nombre: string | null;
  created_at: string;
  updated_at: string;
}

export interface CuentaCorrienteMovimiento {
  fecha: string;
  tipo: string;
  numero: string;
  descripcion: string | null;
  debe: number;
  haber: number;
  saldo: number;
}

export interface CuentaCorrienteResponse {
  cliente_id: number;
  cliente_nombre: string | null;
  movimientos: CuentaCorrienteMovimiento[];
  saldo_total: number;
  saldo_a_favor: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_importe?: number;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
  debe_cambiar_contrasena?: boolean;
}

export interface DashboardVentas {
  // Tarjetas del período elegido
  total_pedidos: number;
  importe_vendido: number;
  importe_cobrado: number;
  // Métricas históricas / secundarias
  total_vendido: number;
  pedidos_mes: number;
  pedidos_cancelados: number;
  clientes_activos: number;
  cobros_mes: number;
  ventas_mensuales: { mes: string; importe: number }[];
  top_clientes: { nombre: string; total: number }[];
  estados_pedidos: Record<string, number>;
  ultimos_pedidos: { numero_pedido: string; cliente: string; importe: number; estado: string; fecha: string }[];
}

export interface PagosPorPedidoRow {
  c_nombre: string;
  a_idpedido: number;
  pe_fecha: string;
  pe_fechaentrega: string | null;
  pe_importetotal: number;
  a_idpago: number;
  pa_receptor: string | null;
  tp_nombre: string;
  pa_fecharecep: string;
  pa_chbanco: string | null;
  pa_chvto: string | null;
  a_importe: number;
  a_saldo: number;
}

export interface DashboardAdmin {
  mes: string;
  // Tarjetas del período elegido (ventas + compras)
  importe_vendido: number;
  importe_cobrado: number;
  total_pedidos: number;
  importe_comprado: number;
  importe_pagado: number;
  // Métricas históricas / secundarias
  stock_total: number;
  ventas_totales: number;
  pedidos_totales: number;
  pedidos_cancelados: number;
  cobros_mes: number;
  ingresos_mensuales: { mes: string; importe: number }[];
  ventas_vendedor: { vendedor: string; total: number }[];
  top_stock: { nombre: string; stock: number }[];
  tipos_pago: { tipo: string; cantidad: number; total: number }[];
  top_vendedores: { vendedor: string; total: number; pedidos: number }[];
  stock_bajo: {
    id: number; nombre: string; codigo: string;
    stock: number; stock_minimo: number;
    /** "3 caja(s) + 2 blíster(s)": el número en cajas solo miente si el mínimo es fraccionario. */
    stock_texto: string; stock_minimo_texto: string;
    semaforo: SemaforoStock;
  }[];
  /** Total real de productos bajo mínimo: `stock_bajo` viene capado a 20. */
  stock_bajo_total: number;
  ultimos_pagos: { numero_recibo: string; importe: number; tipo_pago: string; estado: string; fecha: string }[];
  pagos_pendientes_imputacion: number;
  clientes_en_rojo: number;
}

export interface PuntoEntrega {
  pedido_id: number;
  numero_pedido: string;
  cliente_id: number;
  cliente: string;
  direccion_texto: string;
  latitud: number;
  longitud: number;
  estado: string;
  zona: string | null;
}

export interface EtaParada {
  parada_index: number;
  eta_iso: string;
}

export interface RecorridoActivo {
  hash_id: string;
  inicio: string;
  etas: EtaParada[];
}

export interface MovimientoStockResponse {
  id: number;
  producto_id: number;
  producto_nombre?: string;
  usuario_id: number;
  usuario_nombre?: string;
  tipo_operacion: 'TRANSFER' | 'FRACTION' | 'ADJUST';
  origen: string | null;
  destino: string | null;
  cantidad_cajas: number;
  cantidad_blisters: number;
  observacion: string | null;
  created_at: string;
}

export type TipoMovimientoSanalle = 'ingreso' | 'egreso';

export type CategoriaMovimientoSanalle =
  | 'cobro_cliente'
  | 'pago_proveedor'
  | 'gasto_general'
  | 'sueldo'
  | 'impuesto'
  | 'ajuste'
  | 'ingreso_extraordinario'
  | 'transferencia_recibida'
  | 'cheque_recibido'
  | 'compra_mercaderia'
  | 'otro';


export interface CuentaSanalle {
  id: number;
  fecha: string;
  tipo: TipoMovimientoSanalle;
  categoria: CategoriaMovimientoSanalle;
  importe: number;
  metodo_pago: string;
  descripcion: string | null;
  referencia_id: string | null;
  usuario_id: number;
  created_at: string;
  updated_at: string;
}

export interface CuentaSanalleResumen {
  ingresos: number;
  egresos: number;
  balance: number;
  por_metodo: Record<string, { ingresos: number; egresos: number; balance: number }>;
}

export interface CuentaSanalleListResponse extends PaginatedResponse<CuentaSanalle> {
  resumen: CuentaSanalleResumen;
}
