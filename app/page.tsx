"use client";
import React, { useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell 
} from 'recharts';

export default function Dashboard() {
  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(false);

  const subirPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCargando(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Ruta relativa para que funcione en Vercel
      const response = await fetch('/api/index', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        // Pre-procesar datos para las gráficas
        let acumulado = 0;
        const historialGrafica = data.historial.map((trade: any, index: number) => {
          acumulado += trade.Cierre_PNL;
          return {
            trade: `T${index + 1}`,
            pnl: trade.Cierre_PNL,
            acumulado: acumulado
          };
        });
        
        setDatos({ ...data, historialGrafica });
      } else {
        alert(data.error || "Error al procesar el archivo");
      }
    } catch (error) {
      alert("Error conectando con el servidor backend.");
    } finally {
      setCargando(false);
    }
  };

  // Colores QuetzaMX
  const COLORS = ['#008B8B', '#DAA520'];

  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-center mb-10 border-b border-[#2A2A2A] pb-4">
        <h1 className="text-3xl font-bold tracking-wider mb-4 md:mb-0">
          <span className="text-[#DAA520]">QUETZA</span>
          <span className="text-[#008B8B]">MX</span> ANALYTICS
        </h1>
        
        <div className="relative overflow-hidden inline-block">
          <button className="bg-[#008B8B] hover:bg-[#007070] text-white px-6 py-2 rounded-md font-semibold transition-all">
            {cargando ? 'Procesando...' : '+ Subir PDF Binance'}
          </button>
          <input 
            type="file" 
            accept=".pdf"
            onChange={subirPDF}
            className="absolute top-0 left-0 opacity-0 w-full h-full cursor-pointer"
          />
        </div>
      </header>

      {!datos && !cargando && (
        <div className="flex justify-center items-center h-64 border-2 border-dashed border-[#2A2A2A] rounded-xl">
          <p className="text-gray-500">Sube tu reporte de Historial de Posiciones de Binance para comenzar</p>
        </div>
      )}

      {cargando && (
        <div className="flex justify-center items-center h-64">
          <p className="text-[#008B8B] animate-pulse font-semibold">Analizando operaciones...</p>
        </div>
      )}

      {datos && (
        <>
          {/* Métricas Principales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-[#1E1E24] p-6 rounded-xl border border-[#008B8B]/30 shadow-[0_0_15px_rgba(0,139,139,0.15)] flex flex-col justify-center items-center">
              <h2 className="text-gray-400 text-lg mb-2">Win Rate</h2>
              <span className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#008B8B] to-[#00BFFF]">
                {datos.metricas.win_rate_porcentaje}%
              </span>
            </div>

            <div className="bg-[#1E1E24] p-6 rounded-xl border border-[#2A2A2A] flex flex-col justify-center items-center">
              <h2 className="text-gray-400 text-lg mb-2">Profit Neto</h2>
              <span className={`text-4xl font-bold ${datos.metricas.pnl_total_usdt > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {datos.metricas.pnl_total_usdt > 0 ? '+' : ''}${datos.metricas.pnl_total_usdt}
              </span>
            </div>

            <div className="bg-[#1E1E24] p-6 rounded-xl border border-[#2A2A2A] flex flex-col justify-center items-center">
              <h2 className="text-gray-400 text-lg mb-2">Total de Trades</h2>
              <span className="text-4xl font-bold text-white">
                {datos.metricas.total_trades}
              </span>
            </div>
          </div>

          {/* Gráfica de Curva de Capital */}
          <div className="bg-[#1E1E24] p-6 rounded-xl border border-[#2A2A2A] h-[450px] mb-10">
            <h3 className="text-xl font-semibold text-gray-200 mb-6">Curva de Capital (PnL Acumulado)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={datos.historialGrafica} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#008B8B" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#008B8B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                <XAxis dataKey="trade" stroke="#666" tick={{fill: '#888'}} axisLine={false} tickLine={false} />
                <YAxis stroke="#666" tick={{fill: '#888'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1E1E24', borderColor: '#DAA520', borderRadius: '8px' }}
                  itemStyle={{ color: '#00BFFF', fontWeight: 'bold' }}
                />
                <ReferenceLine y={0} stroke="#DAA520" strokeDasharray="3 3" opacity={0.5} />
                <Area type="monotone" dataKey="acumulado" stroke="#00BFFF" strokeWidth={3} fill="url(#colorPnL)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla de Historial */}
          <div className="bg-[#1E1E24] p-6 rounded-xl border border-[#2A2A2A] overflow-hidden">
            <h3 className="text-xl font-semibold text-gray-200 mb-6">Historial de Operaciones</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-[#3A3A3A] text-gray-400 text-sm uppercase tracking-wider">
                    <th className="py-4 px-4 font-medium">Fecha</th>
                    <th className="py-4 px-4 font-medium">Par</th>
                    <th className="py-4 px-4 font-medium">Lado</th>
                    <th className="py-4 px-4 font-medium text-right">Entrada</th>
                    <th className="py-4 px-4 font-medium text-right">Cierre</th>
                    <th className="py-4 px-4 font-medium text-right">PnL</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200 text-sm">
                  {datos.historial.map((trade: any, index: number) => (
                    <tr key={index} className={`border-b border-[#2A2A2A] hover:bg-[#2A2A30] ${index % 2 === 0 ? 'bg-[#1E1E24]' : 'bg-[#18181D]'}`}>
                      <td className="py-3 px-4">{trade.Fecha}</td>
                      <td className="py-3 px-4 font-semibold text-white">{trade.Símbolo}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${trade.Lado === 'Long' ? 'bg-[#008B8B]/20 text-[#008B8B]' : 'bg-[#DAA520]/20 text-[#DAA520]'}`}>
                          {trade.Lado}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">${trade.Precio_Entrada}</td>
                      <td className="py-3 px-4 text-right">${trade.Precio_Cierre}</td>
                      <td className={`py-3 px-4 text-right font-bold ${trade.Cierre_PNL > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.Cierre_PNL > 0 ? '+' : ''}{trade.Cierre_PNL}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}