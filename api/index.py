import io
import re
import statistics
from datetime import datetime
from zoneinfo import ZoneInfo

import pdfplumber
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

FMT = "%Y-%m-%d %H:%M:%S"
TZ = ZoneInfo("Etc/GMT+6")  # UTC-6 fijo: el periodo de los reportes de Binance
NY, LON, TKY = ZoneInfo("America/New_York"), ZoneInfo("Europe/London"), ZoneInfo("Asia/Tokyo")
FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def num(s):
    try:
        return float(str(s).replace(",", ""))
    except ValueError:
        return None


def sesion(dt):
    """Sesión según la hora local de cada mercado (respeta horario de verano)."""
    if dt.weekday() >= 5:
        return "Fin de semana"
    ny = dt.astimezone(NY)
    if 570 <= ny.hour * 60 + ny.minute < 960:  # 9:30-16:00 ET
        return "Nueva York"
    lo = dt.astimezone(LON)
    if 480 <= lo.hour * 60 + lo.minute < 990:  # 8:00-16:30 Londres
        return "Londres"
    if 9 <= dt.astimezone(TKY).hour < 18:  # 9:00-18:00 Tokio
        return "Tokio"
    return "Fuera de sesión"


def resumen(ts):
    n = len(ts)
    if not n:
        return None
    gan = [t["pnl"] for t in ts if t["pnl"] > 0]
    per = [t["pnl"] for t in ts if t["pnl"] < 0]
    bruto = sum(t["pnl"] for t in ts)
    neto = sum(t["pnl_neto"] for t in ts)
    return {
        "n": n,
        "win_rate": round(len(gan) / n * 100, 1),
        "pnl": round(bruto, 3),
        "pnl_neto": round(neto, 3),
        "avg_win": round(sum(gan) / len(gan), 3) if gan else 0,
        "avg_loss": round(sum(per) / len(per), 3) if per else 0,
        "profit_factor": round(sum(gan) / abs(sum(per)), 2) if per else None,
    }


def agrupar(ts, clave):
    grupos = {}
    for t in ts:
        grupos.setdefault(t[clave], []).append(t)
    return {k: resumen(v) for k, v in grupos.items()}


@app.route("/", defaults={"path": ""}, methods=["POST", "GET"])
@app.route("/<path:path>", methods=["POST", "GET"])
def procesar_pdf(path):
    if request.method == "GET":
        return jsonify({"status": "Activo"}), 200
    if "file" not in request.files:
        return jsonify({"error": "No se envió ningún archivo"}), 400

    # Comisión estimada por lado, en % del nominal (taker 0.05 / maker 0.02)
    fee_pct = num(request.form.get("fee", "0.05"))
    fee_rate = (fee_pct if fee_pct is not None else 0.05) / 100

    try:
        pdf_bytes = io.BytesIO(request.files["file"].read())
        trades, es_order_history = [], False

        with pdfplumber.open(pdf_bytes) as pdf:
            for pagina in pdf.pages:
                for linea in (pagina.extract_text() or "").split("\n"):
                    p = linea.split()
                    if len(p) >= 7 and p[6] in ("BUY", "SELL", "Buy", "Sell"):
                        es_order_history = True
                    if len(p) >= 12 and p[2] in ("Long", "Short") and FECHA.match(p[8]) and FECHA.match(p[10]):
                        entrada, cierre, size, pnl = num(p[3]), num(p[4]), num(p[6]), num(p[7])
                        if None in (entrada, cierre, size, pnl):
                            continue
                        ab = datetime.strptime(f"{p[8]} {p[9]}", FMT).replace(tzinfo=TZ)
                        ce = datetime.strptime(f"{p[10]} {p[11]}", FMT).replace(tzinfo=TZ)
                        fee = size * (entrada + cierre) * fee_rate
                        trades.append({
                            "id": f"{p[0]}|{p[8]} {p[9]}",
                            "simbolo": p[0], "lado": p[2],
                            "entrada": entrada, "cierre": cierre, "tamano": size,
                            "pnl": pnl, "comision": round(fee, 4), "pnl_neto": pnl - fee,
                            "apertura": f"{p[8]} {p[9]}", "cierre_fecha": f"{p[10]} {p[11]}",
                            "_ab": ab, "_ce": ce,
                            "dur_min": round((ce - ab).total_seconds() / 60, 1),
                            "sesion": sesion(ab),
                            "dia": ab.strftime("%a"),
                        })

        if es_order_history and not trades:
            return jsonify({"error": 'Este es el Historial de Órdenes. Sube el "Historial de Posiciones" de Futuros.'}), 400
        if not trades:
            return jsonify({"error": "No se detectaron posiciones. Verifica que sea el PDF correcto de Binance."}), 400

        # Orden cronológico por cierre (el PDF puede venir en cualquier orden)
        trades.sort(key=lambda t: t["_ce"])

        # Banderas de disciplina
        for i, t in enumerate(trades):
            t["flags"] = []
            if t["sesion"] == "Fin de semana":
                t["flags"].append("fin_semana")
            if t["dur_min"] < 5:
                t["flags"].append("scalp_5min")
            prev = [x for x in trades[:i] if x["_ce"] <= t["_ab"]]
            if prev and prev[-1]["pnl"] < 0 and (t["_ab"] - prev[-1]["_ce"]).total_seconds() <= 900:
                t["flags"].append("revancha")
            mismos = [x["tamano"] for x in trades[:i] if x["simbolo"] == t["simbolo"]][-5:]
            if len(mismos) >= 3 and t["tamano"] > 2 * statistics.median(mismos):
                t["flags"].append("salto_tamano")

        disciplina = {}
        for f in ("fin_semana", "scalp_5min", "revancha", "salto_tamano"):
            disciplina[f] = resumen([t for t in trades if f in t["flags"]])
        por_dia = {}
        for t in trades:
            por_dia.setdefault(t["apertura"][:10], []).append(t)
        sobre = {d: v for d, v in por_dia.items() if len(v) > 5}
        disciplina["dias_sobreoperados"] = {
            "n": len(sobre), "max_en_un_dia": max(len(v) for v in por_dia.values()),
            "pnl": round(sum(t["pnl"] for v in sobre.values() for t in v), 3),
        }

        # Curva y drawdown (cronológicos)
        acum = acum_neto = pico = dd = 0.0
        curva = []
        for t in trades:
            acum += t["pnl"]
            acum_neto += t["pnl_neto"]
            pico = max(pico, acum)
            dd = max(dd, pico - acum)
            curva.append({"date": t["cierre_fecha"], "pnl": round(acum, 2), "neto": round(acum_neto, 2)})

        # Rachas
        mejor = peor = act = 0
        for t in trades:
            act = (act + 1 if act > 0 else 1) if t["pnl"] > 0 else (act - 1 if act < 0 else -1)
            mejor, peor = max(mejor, act), min(peor, act)

        for t in trades:
            del t["_ab"], t["_ce"]
            t["pnl_neto"] = round(t["pnl_neto"], 4)

        return jsonify({
            "status": "success",
            "fee_pct": fee_rate * 100,
            "general": resumen(trades),
            "max_drawdown": round(dd, 3),
            "racha_ganadora": mejor, "racha_perdedora": abs(peor),
            "por_sesion": agrupar(trades, "sesion"),
            "por_lado": agrupar(trades, "lado"),
            "por_simbolo": agrupar(trades, "simbolo"),
            "disciplina": disciplina,
            "curva": curva,
            "trades": trades,
        }), 200

    except Exception as e:
        return jsonify({"error": f"Error interno: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5328)
