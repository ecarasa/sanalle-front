'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LayoutDashboard,
  Users,
  Package,
  UserCog,
  Menu,
  X,
  ChevronDown,
  KeyRound,
  LogOut,
  Truck as TruckIcon,
  SlidersHorizontal,
  Building2,
  FlaskConical,
  Settings,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { featureKeyForHref } from '@/lib/features';

interface TopNavProps {
  user: {
    nombre_completo: string;
    rol: string;
  };
  onLogout: () => void;
  onChangePassword: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getRolLabel(rol: string): string {
  const labels: Record<string, string> = {
    admin: 'Administrador',
    super_admin: 'Super Administrador',
    ventas: 'Ventas',
    repartidor: 'Repartidor',
  };
  return labels[rol] || rol;
}

export default function TopNav({ user, onLogout, onChangePassword }: TopNavProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const isSuperAdmin = user.rol === 'super_admin';
  const isAdmin = user.rol === 'admin';
  const hasAdminAccess = isAdmin || isSuperAdmin;
  const isRepartidor = user.rol === 'repartidor';
  const todayFormatted = format(new Date(), 'dd/MM/yyyy', { locale: es });

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Vitalnova';
  const appInitial = appName.charAt(0).toUpperCase();

  const { isEnabled } = useFeatureFlags();
  // super_admin siempre ve todo (para poder probar y volver a habilitar módulos)
  const canSee = useCallback(
    (href: string) => isSuperAdmin || isEnabled(featureKeyForHref(href)),
    [isSuperAdmin, isEnabled]
  );

  // Menú tipo ERP en grupos separados por "|":
  //   [Productos] | [Clientes, Proveedores] | [⚙ Configuración]
  // (Dashboard/Inicio queda accesible desde el logo.)
  const { mainGroups, configItems } = useMemo<{ mainGroups: NavItem[][]; configItems: NavItem[] }>(() => {
    if (isRepartidor) {
      return { mainGroups: [[{ label: 'Entregas', href: '/dashboard/entregas', icon: TruckIcon }]], configItems: [] };
    }

    const clientesHref = hasAdminAccess ? '/dashboard/admin/clientes' : '/dashboard/clientes';
    const productosHref = hasAdminAccess ? '/dashboard/admin/productos' : '/dashboard/stock';

    // Grupo Clientes (+ Proveedores para admin).
    const grupoClientes: NavItem[] = [{ label: 'Clientes', href: clientesHref, icon: Users }];
    if (hasAdminAccess) {
      grupoClientes.push({ label: 'Proveedores', href: '/dashboard/admin/proveedores', icon: Building2 });
    }

    const groups: NavItem[][] = [
      [{ label: 'Vender', href: '/dashboard/pedidos', icon: ShoppingCart }],
      [{ label: 'Productos', href: productosHref, icon: Package }],
      grupoClientes,
    ];

    // Submenú "Configuración": tablas de apoyo y herramientas de admin.
    const config: NavItem[] = [];
    if (hasAdminAccess) {
      config.push(
        { label: 'Depósitos', href: '/dashboard/admin/depositos', icon: Warehouse },
        { label: 'Laboratorios', href: '/dashboard/admin/tablas/laboratorios', icon: FlaskConical }
      );
    }
    if (isSuperAdmin) {
      config.push(
        { label: 'Usuarios', href: '/dashboard/admin/usuarios', icon: UserCog },
        { label: 'Funcionalidades', href: '/dashboard/admin/funcionalidades', icon: SlidersHorizontal }
      );
    }

    return { mainGroups: groups, configItems: config };
  }, [isRepartidor, hasAdminAccess, isSuperAdmin]);

  const visibleGroups = useMemo(
    () => mainGroups.map((g) => g.filter((i) => canSee(i.href))).filter((g) => g.length > 0),
    [mainGroups, canSee]
  );
  const visibleMainFlat = useMemo(() => visibleGroups.flat(), [visibleGroups]);
  const visibleConfig = useMemo(() => configItems.filter((i) => canSee(i.href)), [configItems, canSee]);

  const isItemActive = useCallback(
    (href: string) => {
      if (href === '/dashboard') return pathname === '/dashboard';
      return pathname.startsWith(href);
    },
    [pathname]
  );

  const configActive = useMemo(
    () => visibleConfig.some((i) => isItemActive(i.href)),
    [visibleConfig, isItemActive]
  );

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // Close config dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (configRef.current && !configRef.current.contains(event.target as Node)) {
        setConfigOpen(false);
      }
    }
    if (configOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [configOpen]);

  // Close mobile menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setConfigOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-[58px] flex items-center px-4 lg:px-6 shadow-lg shadow-black/20"
        style={{
          background: 'linear-gradient(90deg, #001B5A 0%, #012A6E 100%)',
          borderBottom: '1px solid rgba(0, 174, 239, 0.22)',
        }}
      >
        {/* Left: Logo */}
        <div className="flex-shrink-0 mr-4 lg:mr-6">
          <Link
            href={isRepartidor ? '/dashboard/entregas' : '/dashboard'}
            className="group flex items-center gap-2.5 whitespace-nowrap"
          >
            <span
              className="flex items-center justify-center w-7 h-7 rounded-lg text-[13px] font-extrabold text-white shadow-md shadow-black/30 transition-transform group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #00AEEF 0%, #003087 100%)' }}
            >
              {appInitial}
            </span>
            <span className="text-white font-bold text-base lg:text-lg tracking-tight">
              {appName}
            </span>
          </Link>
        </div>

        {/* Center: Desktop Nav */}
        <div className="hidden lg:flex items-center flex-1 min-w-0 gap-1">
          {visibleGroups.map((group, gi) => (
            <div key={gi} className="flex items-center gap-1">
              {gi > 0 && <div className="w-px h-5 mx-1.5 bg-white/20 flex-shrink-0" />}
              {group.map((item) => {
                const active = isItemActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 xl:gap-2 px-3 xl:px-3.5 py-1.5 rounded-full text-xs xl:text-sm font-semibold tracking-tight transition-all whitespace-nowrap ${active
                      ? 'text-white shadow-[0_2px_12px_rgba(0,174,239,0.45)]'
                      : 'text-white/65 hover:text-white hover:bg-white/10'
                      }`}
                    style={active ? { background: 'linear-gradient(135deg, #00AEEF 0%, #0093D4 100%)' } : undefined}
                  >
                    <Icon size={15} className={active ? 'text-white' : 'text-white/50'} strokeWidth={2.25} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Separador + Dropdown "Configuración" */}
          {visibleConfig.length > 0 && (
            <div className="relative flex items-center gap-1" ref={configRef}>
              <div className="w-px h-5 mx-1.5 bg-white/20 flex-shrink-0" />
              <button
                onClick={() => setConfigOpen((v) => !v)}
                className={`flex items-center gap-1.5 xl:gap-2 px-3 xl:px-3.5 py-1.5 rounded-full text-xs xl:text-sm font-semibold tracking-tight transition-all whitespace-nowrap ${configActive
                  ? 'text-white shadow-[0_2px_12px_rgba(0,174,239,0.45)]'
                  : 'text-white/65 hover:text-white hover:bg-white/10'
                  }`}
                style={configActive ? { background: 'linear-gradient(135deg, #00AEEF 0%, #0093D4 100%)' } : undefined}
              >
                <Settings size={15} className={configActive ? 'text-white' : 'text-white/50'} strokeWidth={2.25} />
                Configuración
                <ChevronDown size={13} className={`transition-transform ${configOpen ? 'rotate-180' : ''}`} />
              </button>

              {configOpen && (
                <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]">
                  <div className="absolute -top-2 left-5 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45" />
                  {visibleConfig.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setConfigOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors relative bg-white ${active
                          ? 'text-[#003087] font-semibold bg-[#003087]/5'
                          : 'text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        <Icon size={16} className={active ? 'text-[#00AEEF]' : 'text-gray-400'} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Date + User (Desktop) */}
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0 ml-3">
          <span className="text-white/60 text-xs whitespace-nowrap">
            {todayFormatted}
          </span>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-white hover:text-white/90 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: '#003087' }}
              >
                {getInitials(user.nombre_completo)}
              </div>
              <ChevronDown
                size={14}
                className={`text-white/70 transition-transform ${dropdownOpen ? 'rotate-180' : ''
                  }`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]">

                <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45" />

                <div className="px-4 py-2 border-b border-gray-100 relative bg-white">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.nombre_completo}
                  </p>
                  <p className="text-xs text-gray-500">
                    {getRolLabel(user.rol)}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onChangePassword();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors relative bg-white"
                >
                  <KeyRound size={16} className="text-gray-400" />
                  Cambiar Contrase&ntilde;a
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors relative bg-white"
                >
                  <LogOut size={16} className="text-red-400" />
                  Cerrar Sesi&oacute;n
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Hamburger */}
        <div className="flex lg:hidden items-center ml-auto">
          <button
            ref={hamburgerRef}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="text-white p-1.5 rounded hover:bg-white/10 transition-colors"
            aria-label={mobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[58px] z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu panel */}
          <div
            ref={mobileMenuRef}
            className="relative w-full max-h-[calc(100vh-58px)] overflow-y-auto shadow-xl"
            style={{ backgroundColor: '#001B5A' }}
          >
            <div className="px-4 py-3 space-y-1">
              {visibleMainFlat.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${active
                      ? 'text-white shadow-[0_2px_12px_rgba(0,174,239,0.4)]'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    style={active ? { background: 'linear-gradient(135deg, #00AEEF 0%, #0093D4 100%)' } : undefined}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Sección Configuración */}
              {visibleConfig.length > 0 && (
                <>
                  <div className="h-px my-2 bg-white/15" />
                  <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-widest text-white/40">Configuración</div>
                  {visibleConfig.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${active
                          ? 'text-white shadow-[0_2px_12px_rgba(0,174,239,0.4)]'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        style={active ? { background: 'linear-gradient(135deg, #00AEEF 0%, #0093D4 100%)' } : undefined}
                      >
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </>
              )}
            </div>

            {/* Mobile: User section */}
            <div className="border-t border-white/20 px-4 py-3">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: '#003087' }}
                >
                  {getInitials(user.nombre_completo)}
                </div>
                <div>
                  <div className="text-white text-sm font-medium">
                    {user.nombre_completo}
                  </div>
                  <div className="text-white/50 text-xs">
                    {getRolLabel(user.rol)} &middot; {todayFormatted}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onChangePassword();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <KeyRound size={18} />
                <span>Cambiar Contrase&ntilde;a</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-red-400 hover:text-red-300 hover:bg-white/10 transition-colors"
              >
                <LogOut size={18} />
                <span>Cerrar Sesi&oacute;n</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer to push content below the fixed nav */}
      <div className="h-[58px]" />
    </>
  );
}
