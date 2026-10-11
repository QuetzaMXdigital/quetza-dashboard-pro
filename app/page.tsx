"use client";

import { useState } from "react";
import { UploadCloud, FileText, AlertCircle, TrendingUp, DollarSign, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function QuetzaDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dashboardData, setDashboardData] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const processFile = async () => {
    if (!file) {
      setError("Por favor, selecciona un archivo PDF de Binance.");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      // 1. Apuntamos a la ruta exacta definida en tu backend de Python
      const response = await fetch("/api/index", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Error al comunicarse con el servidor.");
      }

      // 2. Transformamos el "historial" de Python en datos para la gráfica (Acumulado)
      let cumulativePnl = 0;
      // Invertimos el arreglo porque los PDFs de Binance suelen poner lo más reciente arriba
      const reversedHistorial = [...data.historial].reverse(); 
      
      const chartData = reversedHistorial.map((trade: any, index: number) => {
        cumulativePnl += Number(trade.Cierre_PNL) || 0;
        return {
          date: trade.Fecha || `Trade ${index + 1}`,
          pnl: parseFloat(cumulativePnl.toFixed(2))
        };
      });

      // 3. Emparejamos los datos con la estructura "metricas" de tu Python
      setDashboardData({
        total_pnl: data.metricas.pnl_total_usdt,
        win_rate: data.metricas.win_rate_porcentaje,
        total_trades: data.metricas.total_trades,
        chart_data: chartData
      });

    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado al procesar el PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-sans">
      <header className="mb-10 flex items-center justify-between border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Activity className="text-cyan-400" size={32} />
            QUETZA ANALYTICS
          </h1>
          <p className="text-gray-400 mt-1">Análisis avanzado de Historial de Posiciones</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-8">
        {!dashboardData && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-xl">
            <div className="bg-gray-800 p-4 rounded-full mb-4">
              <UploadCloud size={48} className="text-cyan-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Sube tu reporte de Binance</h2>
            <p className="text-gray-400 mb-8 max-w-md">
              Selecciona tu archivo PDF con el historial de futuros. Nuestro motor de Python extraerá y analizará tus operaciones.
            </p>
            
            <div className="flex flex-col items-center gap-4 w-full max-w-sm">
              <label className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white py-3 px-4 rounded-xl cursor-pointer transition-all">
                <FileText size={20} />
                <span className="truncate">{file ? file.name : "Seleccionar archivo PDF"}</span>
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              </label>

              <button
                onClick={processFile}
                disabled={loading || !file}
                className={`w-full py-3 rounded-xl font-semibold transition-all flex justify-center items-center gap-2
                  ${loading || !file ? 'bg-cyan-900/50 text-cyan-200/50 cursor-not-allowed' : 'bg-cyan-500 hover:bg-cyan-400 text-gray-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]'}`}
              >
                {loading ? (
                  <span className="animate-pulse">Analizando PDF...</span>
                ) : (
                  "Generar Dashboard"
                )}
              </button>
            </div>

            {error && (
              <div className="mt-6 flex items-center gap-2 text-red-400 bg-red-400/10 py-2 px-4 rounded-lg border border-red-400/20">
                <AlertCircle size={18} />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {dashboardData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3 text-gray-400 mb-2">
                  <DollarSign size={20} className="text-emerald-400" />
                  <h3 className="font-medium">PnL Total</h3>
                </div>
                <p className={`text-4xl font-bold ${dashboardData.total_pnl >= 0 ? 'text-white' : 'text-red-400'}`}>
                  $ {dashboardData.total_pnl}
                </p>
              </div>
              
              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3 text-gray-400 mb-2">
                  <TrendingUp size={20} className="text-cyan-400" />
                  <h3 className="font-medium">Win Rate</h3>
                </div>
                <p className="text-4xl font-bold text-white">{dashboardData.win_rate} %</p>
              </div>

              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3 text-gray-400 mb-2">
                  <Activity size={20} className="text-purple-400" />
                  <h3 className="font-medium">Total de Trades</h3>
                </div>
                <p className="text-4xl font-bold text-white">{dashboardData.total_trades}</p>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg h-96">
              <h3 className="font-medium text-gray-400 mb-6">Curva de Rendimiento (PnL Acumulado)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData.chart_data}>
                  <defs>
                    <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#22d3ee' }}
                  />
                  <Area type="monotone" dataKey="pnl" stroke="#22d3ee" strokeWidth={3} fillOpacity={1} fill="url(#colorPnL)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <button 
              onClick={() => setDashboardData(null)}
              className="mt-8 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
            >
              ← Analizar otro documento
            </button>
          </div>
        )}
      </main>
    </div>
  );
}