import { useState, useEffect } from 'react';
import {
    Calendar,
    CalendarCell,
    CalendarGrid,
    Heading,
    Button,
} from 'react-aria-components';
import { getLocalTimeZone, today } from '@internationalized/date';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

type EventoData = { count: number; detalles?: string[] };
type DayData = {
    entregas: EventoData;
    cobros_pendientes: EventoData;
    cobros_parciales: EventoData;
    cobros_pagados: EventoData;
    vencimientos_pendientes: EventoData;
    vencimientos_parciales: EventoData;
};

const EMPTY_EVENTO: EventoData = { count: 0, detalles: [] };
const EMPTY_DAY: DayData = {
    entregas: EMPTY_EVENTO,
    cobros_pendientes: EMPTY_EVENTO,
    cobros_parciales: EMPTY_EVENTO,
    cobros_pagados: EMPTY_EVENTO,
    vencimientos_pendientes: EMPTY_EVENTO,
    vencimientos_parciales: EMPTY_EVENTO,
};

export function MiCalendario() {
    const [events, setEvents] = useState<Record<string, DayData>>({});
    const [loading, setLoading] = useState(true);
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const res = await api.get('/reportes/calendario');
                const mapping = res.data.reduce((acc: Record<string, DayData>, curr: any) => {
                    acc[curr.fecha] = {
                        entregas: curr.entregas,
                        cobros_pendientes: curr.cobros_pendientes,
                        cobros_parciales: curr.cobros_parciales,
                        cobros_pagados: curr.cobros_pagados,
                        vencimientos_pendientes: curr.vencimientos_pendientes,
                        vencimientos_parciales: curr.vencimientos_parciales,
                    };
                    return acc;
                }, {} as Record<string, DayData>);
                setEvents(mapping);
            } catch (error) {
                console.error('Error fetching calendar events:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();
    }, []);

    return (
        <Calendar className="w-full bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full min-h-[400px]">
            <header className="flex flex-col items-center justify-between pb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Calendario Financiero y Logístico</h3>
                <div className="flex flex-row items-center justify-between w-full">
                    <Button slot="previous" className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <ChevronLeft size={20} />
                    </Button>
                    <Heading className="font-bold text-gray-800 text-lg" />
                    <Button slot="next" className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <ChevronRight size={20} />
                    </Button>
                </div>
                <div className="flex gap-4 mt-2 text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Entregas
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Por cobrar
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Pago parcial
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Pagado
                    </div>
                </div>
            </header>

            <CalendarGrid className="w-full border-separate border-spacing-1">
                {(date) => {
                    const dateStr = date.toString();
                    const data = events[dateStr] ?? EMPTY_DAY;

                    const hasEntregas = data.entregas.count > 0;
                    const porCobrarCount = data.cobros_pendientes.count + data.vencimientos_pendientes.count;
                    const parcialCount = data.cobros_parciales.count + data.vencimientos_parciales.count;
                    const pagadoCount = data.cobros_pagados.count;

                    const hasPorCobrar = porCobrarCount > 0;
                    const hasParcial = parcialCount > 0;
                    const hasPagado = pagadoCount > 0;
                    const hasAny = hasEntregas || hasPorCobrar || hasParcial || hasPagado;

                    const isToday = today(getLocalTimeZone()).compare(date) === 0;

                    // Prioridad de color de fondo: rojo > amarillo > verde > azul
                    const bgClass = hasPorCobrar
                        ? 'bg-red-50 border border-red-100'
                        : hasParcial
                        ? 'bg-amber-50 border border-amber-100'
                        : hasPagado
                        ? 'bg-green-50 border border-green-100'
                        : hasEntregas
                        ? 'bg-blue-50 border border-blue-100'
                        : '';

                    return (
                        <CalendarCell
                            date={date}
                            className={({ isSelected }) => `
                                relative w-full aspect-square flex flex-col items-center justify-center cursor-pointer transition-all rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                                ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-50'}
                                ${!isSelected && hasAny ? bgClass : ''}
                                ${isToday && !isSelected && !hasAny ? 'bg-gray-50 text-blue-600 font-bold' : ''}
                                ${!isSelected && !hasAny && !isToday ? 'text-gray-700' : ''}
                            `}
                        >
                            {({ formattedDate, isSelected }) => (
                                <div
                                    className="relative w-full h-full flex flex-col items-center justify-center"
                                    onMouseEnter={() => hasAny ? setHoveredDate(dateStr) : undefined}
                                    onMouseLeave={() => setHoveredDate(null)}
                                >
                                    <span className={`text-sm ${isSelected ? 'font-bold' : ''} ${!isSelected && hasAny ? 'z-10' : ''}`}>
                                        {formattedDate}
                                    </span>

                                    <div className="absolute top-1 right-1 flex gap-0.5">
                                        {hasEntregas && (
                                            <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold shadow-sm ring-1 ring-white ${isSelected ? 'bg-white text-blue-600' : 'bg-blue-500 text-white'}`}>
                                                {data.entregas.count}
                                            </span>
                                        )}
                                        {hasPorCobrar && (
                                            <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold shadow-sm ring-1 ring-white ${isSelected ? 'bg-white text-red-600' : 'bg-red-500 text-white'}`}>
                                                {porCobrarCount}
                                            </span>
                                        )}
                                        {hasParcial && (
                                            <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold shadow-sm ring-1 ring-white ${isSelected ? 'bg-white text-amber-600' : 'bg-amber-400 text-white'}`}>
                                                {parcialCount}
                                            </span>
                                        )}
                                        {hasPagado && (
                                            <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold shadow-sm ring-1 ring-white ${isSelected ? 'bg-white text-green-600' : 'bg-green-500 text-white'}`}>
                                                {pagadoCount}
                                            </span>
                                        )}
                                    </div>

                                    {hoveredDate === dateStr && (
                                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-xl py-2.5 px-3.5 shadow-2xl w-56 z-50 border border-white/10">
                                            {hasEntregas && (
                                                <div className="mb-2">
                                                    <div className="font-bold text-blue-300 flex items-center gap-1.5 mb-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                                        {data.entregas.count} {data.entregas.count === 1 ? 'Entrega' : 'Entregas'}
                                                    </div>
                                                    <ul className="list-disc pl-4 space-y-1 text-[10px]">
                                                        {data.entregas.detalles?.map((d, i) => <li key={i} className="text-gray-300">{d}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {(data.cobros_pendientes.count > 0 || data.vencimientos_pendientes.count > 0) && (
                                                <div className="mb-2">
                                                    <div className="font-bold text-red-300 flex items-center gap-1.5 mb-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                                        Por cobrar / pagar
                                                    </div>
                                                    <ul className="list-disc pl-4 space-y-1 text-[10px]">
                                                        {data.cobros_pendientes.detalles?.map((d, i) => <li key={`cp-${i}`} className="text-red-100/80">{d}</li>)}
                                                        {data.vencimientos_pendientes.detalles?.map((d, i) => <li key={`vp-${i}`} className="text-red-100/80">{d}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {(data.cobros_parciales.count > 0 || data.vencimientos_parciales.count > 0) && (
                                                <div className="mb-2">
                                                    <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                                        Pago parcial
                                                    </div>
                                                    <ul className="list-disc pl-4 space-y-1 text-[10px]">
                                                        {data.cobros_parciales.detalles?.map((d, i) => <li key={`cpa-${i}`} className="text-amber-100/80">{d}</li>)}
                                                        {data.vencimientos_parciales.detalles?.map((d, i) => <li key={`vpa-${i}`} className="text-amber-100/80">{d}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {data.cobros_pagados.count > 0 && (
                                                <div>
                                                    <div className="font-bold text-green-300 flex items-center gap-1.5 mb-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                                                        {data.cobros_pagados.count} {data.cobros_pagados.count === 1 ? 'Cobrado' : 'Cobrados'}
                                                    </div>
                                                    <ul className="list-disc pl-4 space-y-1 text-[10px]">
                                                        {data.cobros_pagados.detalles?.map((d, i) => <li key={i} className="text-green-100/80">{d}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CalendarCell>
                    );
                }}
            </CalendarGrid>
            {loading && (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm animate-pulse mt-4">
                    Cargando eventos...
                </div>
            )}
        </Calendar>
    );
}
