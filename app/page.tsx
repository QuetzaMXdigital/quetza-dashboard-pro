"use client";

import { useEffect, useState } from "react";
import { UploadCloud, FileText, AlertCircle, Activity, ShieldAlert, NotebookPen } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Entrada = { btc: string; reglas: string };
const LS_KEY = "quetza_journal_v1";
const FLAGS: Record<string, string> = {
  fin_semana: "Fin de semana (fuera de tu ventana)",
  scalp_5min: "Trades de menos de 5 min",
  revancha: "Revancha (abierto ≤15 min tras una pérdida)",
  salto_tamano: "Salto de tamaño (>2× la mediana reciente)",
};
const fmt = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? "—" : n.toFixed(d));
const color = (n: number) => (n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-gray-300");

// Resumen simple para comparar grupos del diario (se calcula en el navegador)
function stat(ts: any[]) {
  if (!ts.length) return null;
  const g = ts.filter((t) => t.pnl > 0).map((t) => t.pnl);
  const p = ts.filter((t) => t.pnl < 0).map((t) => t.pnl);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  return {
    n: ts.length,
    win_rate: (g.length / ts.length) * 100,
    pnl: sum(ts.map((t) => t.pnl)),
    pnl_neto: sum(ts.map((t) => t.pnl_neto)),
    avg_win: g.length ? sum(g) / g.length : 0,
    avg_loss: p.length ? sum(p) / p.length : 0,
    profit_factor: p.length ? sum(g) / Math.abs(sum(p)) : null,
  };
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className={`text-3xl font-bold ${tone || "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function Tabla({ titulo, datos, etiquetas }: { titulo: string; datos: Record<string, any>; etiquetas?: Record<string, string> }) {
  const filas = Object.entries(datos || {}).filter(([, v]) => v);
  return (
    <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl overflow-x-auto">
      <h3 className="font-medium text-gray-300 mb-3">{titulo}</h3>
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="text-gray-500 text-left">
            <th className="pb-2">Grupo</th><th>Trades</th><th>Win %</th><th>PnL</th><th>Neto est.</th><th>Gan. prom.</th><th>Pérd. prom.</th><th>PF</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(([k, v]) => (
            <tr key={k} className="border-t border-gray-800">
              <td className="py-2 text-gray-200">{etiquetas?.[k] || k}</td>
              <td>{v.n}</td>
              <td>{fmt(v.win_rate, 1)}</td>
              <td className={color(v.pnl)}>{fmt(v.pnl)}</td>
              <td className={color(v.pnl_neto)}>{fmt(v.pnl_neto)}</td>
              <td>{fmt(v.avg_win)}</td>
              <td>{fmt(v.avg_loss)}</td>
              <td>{fmt(v.profit_factor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function QuetzaDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [fee, setFee] = useState("0.05");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [diario, setDiario] = useState<Record<string, Entrada>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setDiario(JSON.parse(raw));
    } catch {}
  }, []);

  const setCampo = (id: string, campo: keyof Entrada, valor: string) => {
    const nuevo = { ...diario, [id]: { btc: "", reglas: "", ...diario[id], [campo]: valor } };
    setDiario(nuevo);
    try { localStorage.setItem(LS_KEY, JSON.stringify(nuevo)); } catch {}
  };

  const processFile = async () => {
    if (!file) return setError("Por favor, selecciona un archivo PDF de Binance.");
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("fee", fee);
    try {
      const res = await fetch("/api/index", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Error al comunicarse con el servidor.");
      setData(json);
    } catch (e: any) {
      setError(e.message || "Ocurrió un error inesperado al procesar el PDF.");
    } finally {
      setLoading(false);
    }
  };

  const g = data?.general;
  const trades: any[] = data?.trades || [];
  const comparar = (campo: keyof Entrada) => {
    const si = trades.filter((t) => diario[t.id]?.[campo] === "si");
    const no = trades.filter((t) => diario[t.id]?.[campo] === "no");
    return { Sí: stat(si), No: stat(no) };
  };
  const marcados = trades.filter((t) => diario[t.id]?.btc || diario[t.id]?.reglas).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 font-sans">
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Activity className="text-cyan-400" size={32} /> QUETZA ANALYTICS
        </h1>
        <p className="text-gray-400 mt-1">Análisis avanzado de Historial de Posiciones</p>
      </header>

      <main className="max-w-6xl mx-auto space-y-6">
        {!data && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col items-center text-center">
            <div className="bg-gray-800 p-4 rounded-full mb-4"><UploadCloud size={48} className="text-cyan-400" /></div>
            <h2 className="text-xl font-semibold mb-2">Sube tu reporte de Binance</h2>
            <p className="text-gray-400 mb-6 max-w-md">PDF de &quot;Futures Position History&quot;.</p>
            <div className="flex flex-col items-center gap-4 w-full max-w-sm">
              <label className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 py-3 px-4 rounded-xl cursor-pointer">
                <FileText size={20} />
                <span className="truncate">{file ? file.name : "Seleccionar archivo PDF"}</span>
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setError(""); }} />
              </label>
              <label className="w-full text-left text-sm text-gray-400">
                Comisión estimada por lado (% del nominal)
                <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal"
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
                <span className="text-xs text-gray-500">Taker 0.05 · Maker 0.02 (menos si pagas con BNB). El PDF no trae comisiones.</span>
              </label>
              <button onClick={processFile} disabled={loading || !file}
                className={`w-full py-3 rounded-xl font-semibold ${loading || !file ? "bg-cyan-900/50 text-cyan-200/50 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-400 text-gray-950"}`}>
                {loading ? <span className="animate-pulse">Analizando PDF...</span> : "Generar Dashboard"}
              </button>
            </div>
            {error && (
              <div className="mt-6 flex items-center gap-2 text-red-400 bg-red-400/10 py-2 px-4 rounded-lg border border-red-400/20">
                <AlertCircle size={18} /><p className="text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {data && g && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi label="PnL bruto" value={`$ ${fmt(g.pnl, 3)}`} tone={color(g.pnl)} />
              <Kpi label="PnL neto estimado" value={`$ ${fmt(g.pnl_neto)}`} tone={color(g.pnl_neto)} sub={`Comisión ${data.fee_pct}% por lado`} />
              <Kpi label="Win rate" value={`${fmt(g.win_rate, 1)} %`} sub={`${g.n} trades`} />
              <Kpi label="Profit factor" value={fmt(g.profit_factor)} sub=">1 = rentable" tone={g.profit_factor >= 1 ? "text-emerald-400" : "text-red-400"} />
              <Kpi label="Ganancia promedio" value={`$ ${fmt(g.avg_win)}`} tone="text-emerald-400" />
              <Kpi label="Pérdida promedio" value={`$ ${fmt(g.avg_loss)}`} tone="text-red-400" />
              <Kpi label="Ratio gan/pérd" value={fmt(g.avg_loss ? Math.abs(g.avg_win / g.avg_loss) : null)} sub="Meta: ≥ 1.5" />
              <Kpi label="Máx. drawdown" value={`$ ${fmt(data.max_drawdown)}`} sub={`Rachas: ${data.racha_ganadora}G / ${data.racha_perdedora}P`} />
            </div>

            <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl h-96">
              <h3 className="font-medium text-gray-400 mb-4">Curva de rendimiento (orden cronológico por cierre)</h3>
              <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={data.curva}>
                  <defs>
                    <linearGradient id="cPnl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} /><stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(v) => String(v).slice(5, 10)} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip contentStyle={{ backgroundColor: "#111827", borderColor: "#374151", borderRadius: 8, color: "#fff" }} />
                  <Legend />
                  <Area type="monotone" name="Bruto" dataKey="pnl" stroke="#22d3ee" strokeWidth={2.5} fill="url(#cPnl)" />
                  <Area type="monotone" name="Neto est." dataKey="neto" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
              <h3 className="font-medium text-gray-300 mb-3 flex items-center gap-2"><ShieldAlert size={18} className="text-amber-400" /> Disciplina: ¿cuánto te costó romper reglas?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(FLAGS).map(([k, label]) => {
                  const v = data.disciplina[k];
                  return (
                    <div key={k} className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm">
                      <p className="text-gray-300">{label}</p>
                      {v ? (
                        <p className="mt-1"><span className="text-white font-semibold">{v.n}</span> trades · win {fmt(v.win_rate, 0)}% · <span className={color(v.pnl)}>PnL {fmt(v.pnl)}</span> · <span className={color(v.pnl_neto)}>neto {fmt(v.pnl_neto)}</span></p>
                      ) : <p className="mt-1 text-emerald-400">Ninguno ✓</p>}
                    </div>
                  );
                })}
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm">
                  <p className="text-gray-300">Días con más de 5 trades</p>
                  <p className="mt-1"><span className="text-white font-semibold">{data.disciplina.dias_sobreoperados.n}</span> día(s) · máx. {data.disciplina.dias_sobreoperados.max_en_un_dia} en un día</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">Las banderas son indicadores, no veredictos: un grupo con pocos trades no demuestra nada por sí solo.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Tabla titulo="Por sesión (según hora local de cada mercado, con horario de verano)" datos={data.por_sesion} />
              <Tabla titulo="Por lado" datos={data.por_lado} />
              <Tabla titulo="Por símbolo" datos={data.por_simbolo} />
            </div>

            <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
              <h3 className="font-medium text-gray-300 mb-1 flex items-center gap-2"><NotebookPen size={18} className="text-cyan-400" /> Diario: valida tu estrategia</h3>
              <p className="text-xs text-gray-500 mb-4">Marca cada trade (se guarda en este navegador). Con 40+ marcados compara los grupos. Trades marcados: {marcados}/{trades.length}.</p>
              <div className="grid grid-cols-1 gap-4 mb-5">
                <Tabla titulo="¿BTC confirmó?" datos={comparar("btc")} />
                <Tabla titulo="¿Seguí todas mis reglas?" datos={comparar("reglas")} />
              </div>
              <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="sticky top-0 bg-gray-900">
                    <tr className="text-gray-500 text-left"><th className="pb-2">Cierre</th><th>Par</th><th>Lado</th><th>PnL</th><th>Sesión</th><th>Banderas</th><th>BTC confirmó</th><th>Reglas</th></tr>
                  </thead>
                  <tbody>
                    {[...trades].reverse().map((t) => (
                      <tr key={t.id} className="border-t border-gray-800">
                        <td className="py-2 text-gray-400">{t.cierre_fecha.slice(5, 16)}</td>
                        <td>{t.simbolo}</td><td>{t.lado}</td>
                        <td className={color(t.pnl)}>{fmt(t.pnl)}</td>
                        <td>{t.sesion}</td>
                        <td className="text-amber-400 text-xs">{t.flags.join(", ")}</td>
                        {(["btc", "reglas"] as const).map((c) => (
                          <td key={c}>
                            <select value={diario[t.id]?.[c] || ""} onChange={(e) => setCampo(t.id, c, e.target.value)}
                              className="bg-gray-800 border border-gray-700 rounded px-1 py-1 text-xs">
                              <option value="">—</option><option value="si">Sí</option><option value="no">No</option>
                            </select>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button onClick={() => setData(null)} className="text-cyan-400 hover:text-cyan-300 text-sm font-medium">← Analizar otro documento</button>
          </>
        )}
      </main>
    </div>
  );
}
