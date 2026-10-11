import io
import pandas as pd
import pdfplumber
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app) 

@app.route('/', defaults={'path': ''}, methods=['POST', 'GET'])
@app.route('/<path:path>', methods=['POST', 'GET'])
def procesar_pdf():
    if 'file' not in request.files:
        return jsonify({'error': 'No se envió ningún archivo'}), 400
        
    file = request.files['file']
    try:
        pdf_bytes = io.BytesIO(file.read())
        filas_datos = []
        
        # Estrategia a prueba de balas: Extraer texto puro en lugar de buscar tablas
        with pdfplumber.open(pdf_bytes) as pdf:
            for pagina in pdf.pages:
                texto = pagina.extract_text()
                if not texto: continue
                
                # Revisar línea por línea
                for linea in texto.split('\n'):
                    partes = linea.split()
                    
                    # Validar que la línea sea una operación: tiene más de 10 palabras y dice "Long" o "Short"
                    if len(partes) >= 10 and partes[2] in ['Long', 'Short']:
                        filas_datos.append({
                            "Símbolo": partes[0],
                            "Lado": partes[2],
                            "Precio_Entrada": partes[3],
                            "Precio_Cierre": partes[4],
                            "Cierre_PNL": partes[7], # El PNL siempre está en esta posición
                            "Fecha": f"{partes[10]} {partes[11]}" if len(partes) >= 12 else ""
                        })

        if not filas_datos:
            return jsonify({'error': 'No se detectaron operaciones. Verifica que sea el PDF de Binance.'}), 400

        # Convertir a DataFrame
        df = pd.DataFrame(filas_datos)
        
        # Limpieza de comas y conversión a números
        df['Cierre_PNL'] = pd.to_numeric(df['Cierre_PNL'].str.replace(',', ''), errors='coerce')
        df['Precio_Entrada'] = pd.to_numeric(df['Precio_Entrada'].str.replace(',', ''), errors='coerce')
        df['Precio_Cierre'] = pd.to_numeric(df['Precio_Cierre'].str.replace(',', ''), errors='coerce')
        
        df = df.dropna(subset=['Cierre_PNL'])
        
        # Cálculos para el Dashboard
        total_trades = len(df)
        trades_ganadores = len(df[df['Cierre_PNL'] > 0])
        win_rate = (trades_ganadores / total_trades) * 100 if total_trades > 0 else 0
        pnl_total = df['Cierre_PNL'].sum()
        
        return jsonify({
            "status": "success",
            "metricas": {
                "total_trades": total_trades,
                "win_rate_porcentaje": round(win_rate, 2),
                "pnl_total_usdt": round(pnl_total, 3)
            },
            "historial": df.to_dict(orient='records')
        }), 200

    except Exception as e:
        return jsonify({'error': f'Error interno: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5328)