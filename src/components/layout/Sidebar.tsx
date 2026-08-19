'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Users, Package, UserCog, Menu, X, ChevronDown, KeyRound, LogOut,
  Truck as TruckIcon, SlidersHorizontal, Building2, FlaskConical, Settings,
  ShoppingCart, Warehouse, Rocket, MessageSquare, ArrowLeftRight, ClipboardList,
  Store, PackagePlus, FileText, Wallet, Table2, Banknote, HandCoins,
  ClipboardCheck, UserCheck, TrendingUp, LayoutDashboard, Percent,
} from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { featureKeyForHref } from '@/lib/features';
import api from '@/lib/api';

// Chat todavía no habilitado: se muestra como "Pronto" en el menú. Poner en true para reactivarlo.
const CHAT_HABILITADO = false;

interface SidebarProps {
  user: { nombre_completo: string; rol: string };
  onLogout: () => void;
  onChangePassword: () => void;
}

interface NavItem { label: string; href: string; icon: React.ElementType; disabled?: boolean; }
interface NavGroup { label: string | null; items: NavItem[]; }

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map((p) => p.charAt(0)).slice(0, 2).join('').toUpperCase();
}
function getRolLabel(rol: string): string {
  const labels: Record<string, string> = {
    admin: 'Administrador', super_admin: 'Super Administrador', ventas: 'Ventas',
    repartidor: 'Logística', operaciones: 'Operaciones',
  };
  return labels[rol] || rol;
}

export default function Sidebar({ user, onLogout, onChangePassword }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [configCollapsed, setConfigCollapsed] = useState(true);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = user.rol === 'super_admin';
  const isAdmin = user.rol === 'admin';
  const hasAdminAccess = isAdmin || isSuperAdmin;
  const isRepartidor = user.rol === 'repartidor';
  const isOperaciones = user.rol === 'operaciones';
  const todayFormatted = format(new Date(), 'dd/MM/yyyy', { locale: es });

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Vitalnova';
  const appInitial = appName.charAt(0).toUpperCase();

  const { isEnabled } = useFeatureFlags();
  const canSee = useCallback(
    (href: string) => isSuperAdmin || isEnabled(featureKeyForHref(href)),
    [isSuperAdmin, isEnabled]
  );

  // Badge de chat no leído (sólo si el chat está habilitado)
  const [chatNoLeidos, setChatNoLeidos] = useState(0);
  useEffect(() => {
    if (!CHAT_HABILITADO) return;
    let cancelled = false;
    const fetch = () => api.get<{ total: number }>('/chat/no-leidos')
      .then((r) => { if (!cancelled) setChatNoLeidos(r.data.total); }).catch(() => {});
    fetch();
    const t = setInterval(fetch, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, [pathname]);

  // Cierra menú de usuario / drawer
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    if (userMenuOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [userMenuOpen]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // --- Estructura del menú por grupos ---
  const groups = useMemo<NavGroup[]>(() => {
    if (isRepartidor) {
      return [{ label: null, items: [{ label: 'Logística', href: '/dashboard/entregas', icon: TruckIcon }] }];
    }
    if (isOperaciones) {
      return [{ label: null, items: [{ label: 'Preparación', href: '/dashboard/preparacion', icon: ClipboardCheck }] }];
    }
    const clientesHref = hasAdminAccess ? '/dashboard/admin/clientes' : '/dashboard/clientes';
    const productosHref = hasAdminAccess ? '/dashboard/admin/productos' : '/dashboard/stock';

    const gs: NavGroup[] = [
      { label: null, items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }] },
      {
        label: 'Ventas', items: [
          { label: 'Vender', href: '/dashboard/pedidos/nuevo', icon: ShoppingCart },
          { label: 'Pedidos', href: '/dashboard/pedidos', icon: ClipboardList },
          { label: 'Pagos', href: '/dashboard/pagos', icon: Banknote },
          { label: 'Clientes', href: clientesHref, icon: Users },
          ...(hasAdminAccess
            ? [
                { label: 'Logística', href: '/dashboard/entregas', icon: TruckIcon },
                { label: 'Clientes pendientes', href: '/dashboard/admin/clientes-pendientes', icon: UserCheck },
                { label: 'Comisiones', href: '/dashboard/reportes/comisiones-vendedores', icon: Percent },
              ]
            : [{ label: 'Mis Ventas', href: '/dashboard/mis-ventas', icon: TrendingUp }]),
        ],
      },
      { label: 'Catálogo', items: [{ label: 'Productos', href: productosHref, icon: Package }] },
    ];

    if (hasAdminAccess) {
      gs.push({
        label: 'Compras', items: [
          { label: 'Proveedores', href: '/dashboard/admin/proveedores', icon: Building2 },
          { label: 'Pagos a proveedor', href: '/dashboard/admin/pagos-proveedor', icon: HandCoins },
          { label: 'Ingresos de mercadería', href: '/dashboard/admin/ingresos-mercaderia', icon: PackagePlus },
          { label: 'Notas NC/ND', href: '/dashboard/admin/notas-credito-debito', icon: FileText },
        ],
      });
      gs.push({
        label: 'Cuentas', items: [
          { label: 'Cuentas', href: '/dashboard/admin/cuentas', icon: Wallet },
          { label: 'Transacciones', href: '/dashboard/transacciones', icon: ArrowLeftRight },
        ],
      });
    }

    gs.push({ label: 'Comunicación', items: [{ label: 'Chat', href: '/dashboard/chat', icon: MessageSquare, disabled: !CHAT_HABILITADO }] });

    // Configuración
    const config: NavItem[] = [{ label: 'Novedades', href: '/dashboard/novedades', icon: Rocket }];
    if (hasAdminAccess) {
      config.push(
        { label: 'Tablas', href: '/dashboard/admin/tablas', icon: Table2 },
        { label: 'Depósitos', href: '/dashboard/admin/depositos', icon: Warehouse },
        { label: 'Laboratorios', href: '/dashboard/admin/tablas/laboratorios', icon: FlaskConical },
        { label: 'Configuración general', href: '/dashboard/admin/configuracion', icon: Settings },
      );
    }
    if (isSuperAdmin) {
      config.push(
        { label: 'Usuarios', href: '/dashboard/admin/usuarios', icon: UserCog },
        { label: 'Funcionalidades', href: '/dashboard/admin/funcionalidades', icon: SlidersHorizontal },
      );
    }
    gs.push({ label: 'Configuración', items: config });

    return gs;
  }, [isRepartidor, isOperaciones, hasAdminAccess, isSuperAdmin]);

  const visibleGroups = useMemo(
    // Los deshabilitados se muestran igual (grises), sin depender del feature flag.
    () => groups.map((g) => ({ ...g, items: g.items.filter((i) => i.disabled || canSee(i.href)) })).filter((g) => g.items.length > 0),
    [groups, canSee]
  );

  const isItemActive = useCallback((href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/dashboard/pedidos/nuevo') return pathname.startsWith('/dashboard/pedidos/nuevo');
    if (href === '/dashboard/pedidos') return pathname === '/dashboard/pedidos' || (pathname.startsWith('/dashboard/pedidos/') && !pathname.startsWith('/dashboard/pedidos/nuevo'));
    return pathname === href || pathname.startsWith(href + '/');
  }, [pathname]);

  // Contenido del nav (reutilizado en desktop y drawer).
  // IMPORTANTE: es JSX, NO un componente definido inline. Definirlo como
  // `const NavContent = () => ...` haría que React lo desmonte y remonte en
  // cada re-render (p. ej. el polling del chat cada 15s), lo que "come" clicks
  // y obliga a clickear dos veces.
  const navContent = (
    <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
      {visibleGroups.map((group, gi) => {
        const isConfigGroup = group.label === 'Configuración';
        const collapsed = isConfigGroup && configCollapsed;
        return (
        <div key={gi}>
          {group.label && (
            isConfigGroup ? (
              <button
                type="button"
                onClick={() => setConfigCollapsed((c) => !c)}
                className="w-full flex items-center justify-between px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-white/35 hover:text-white/60 transition-colors"
              >
                <span>{group.label}</span>
                <ChevronDown size={12} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
              </button>
            ) : (
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-white/35">{group.label}</p>
            )
          )}
          {!collapsed && (
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              // Ítem deshabilitado: visible pero gris y no clickeable.
              if (item.disabled) {
                return (
                  <div
                    key={item.href}
                    title="Próximamente"
                    aria-disabled="true"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-white/25 cursor-not-allowed select-none"
                  >
                    <Icon size={17} className="text-white/20" strokeWidth={2.1} />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-white/25 border border-white/15 rounded px-1 py-0.5">Pronto</span>
                  </div>
                );
              }
              const active = isItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${active
                    ? 'text-white'
                    : 'text-white/65 hover:text-white hover:bg-white/10'}`}
                  style={active ? { background: 'linear-gradient(135deg, #00AEEF 0%, #0093D4 100%)' } : undefined}
                >
                  <Icon size={17} className={active ? 'text-white' : 'text-white/45'} strokeWidth={2.1} />
                  <span className="flex-1">{item.label}</span>
                  {item.href === '/dashboard/chat' && chatNoLeidos > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-[#E31837] text-white rounded-full flex items-center justify-center">
                      {chatNoLeidos > 99 ? '99+' : chatNoLeidos}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          )}
        </div>
        );
      })}
    </nav>
  );

  const sidebarBg = { background: 'linear-gradient(180deg, #001B5A 0%, #012A6E 100%)' };

  const brand = (
    <Link href={isRepartidor ? '/dashboard/entregas' : isOperaciones ? '/dashboard/preparacion' : '/dashboard'} className="flex items-center gap-2.5 px-4 h-14 flex-shrink-0 border-b border-white/10">
      <span className="flex items-center justify-center w-8 h-8 rounded-lg text-[15px] font-extrabold text-white shadow-md"
        style={{ background: 'linear-gradient(135deg, #00AEEF 0%, #003087 100%)' }}>
        {appInitial}
      </span>
      <span className="text-white font-bold text-lg tracking-tight">{appName}</span>
    </Link>
  );

  const userBlock = (
    <div className="relative border-t border-white/10 p-3" ref={userMenuRef}>
      <button onClick={() => setUserMenuOpen((v) => !v)} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#003087' }}>
          {getInitials(user.nombre_completo)}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-white truncate">{user.nombre_completo}</p>
          <p className="text-[11px] text-white/45">{getRolLabel(user.rol)}</p>
        </div>
        <ChevronDown size={14} className={`text-white/50 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
      </button>
      {userMenuOpen && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
          <div className="px-3 py-1.5 text-[11px] text-gray-400">{todayFormatted}</div>
          <button onClick={() => { setUserMenuOpen(false); onChangePassword(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <KeyRound size={15} className="text-gray-400" /> Cambiar contraseña
          </button>
          <button onClick={() => { setUserMenuOpen(false); onLogout(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col z-40 shadow-xl" style={sidebarBg}>
        {brand}
        {navContent}
        {userBlock}
      </aside>

      {/* Topbar mobile */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 z-40 flex items-center justify-between px-4 shadow-lg" style={{ background: 'linear-gradient(90deg, #001B5A 0%, #012A6E 100%)' }}>
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-white"><Menu size={22} /></button>
        <span className="text-white font-bold text-base tracking-tight">{appName}</span>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#003087' }}>
          {getInitials(user.nombre_completo)}
        </div>
      </header>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85%] h-full flex flex-col shadow-2xl" style={sidebarBg}>
            <div className="flex items-center justify-between h-14 px-4 border-b border-white/10">
              <span className="text-white font-bold text-lg">{appName}</span>
              <button onClick={() => setMobileOpen(false)} className="p-2 text-white/70"><X size={20} /></button>
            </div>
            {navContent}
            {userBlock}
          </aside>
        </div>
      )}
    </>
  );
}
