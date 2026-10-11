import io
import pandas as pd
import pdfplumber
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/', defaults={'path': ''}, methods=['POST', 'GET'])
@app.route('/<path:path>', methods=['POST', 'GET'])
def procesar_pdf(path):
    if request.method == 'GET':
        return jsonify({"status": "Activo"}), 200
        
    if 'file' not in request.files:
        return jsonify({'error': 'No se envió ningún archivo'}), 400
        
    file = request.files['file']
    try:
        pdf_bytes = io.BytesIO(file.read())
        filas_datos = []
        muestra_texto = []
        
        with pdfplumber.open(pdf_bytes) as pdf:
            for pagina in pdf.pages:
                texto = pagina.extract_text()
                if not texto: continue
                
                # MODO DETECTIVE: Guardamos una muestra de las líneas para ver dónde pone Binance los datos
                lineas = texto.split('\n')
                if not muestra_texto and len(lineas) > 5:
                    muestra_texto = lineas[4:10] # Tomamos unas líneas de en medio donde están los trades
                
                for linea in lineas:
                    partes = linea.split()
                    if len(partes) >= 10 and partes[2] in ['Long', 'Short']:
                        filas_datos.append({
                            "Símbolo": partes[0],
                            "Lado": partes[2],
                            "Precio_Entrada": partes[3],
                            "Precio_Cierre": partes[4],
                            "Cierre_PNL": partes[7], 
                            "Fecha": f"{partes[10]} {partes[11]}" if len(partes) >= 12 else ""
                        })

        if not filas_datos:
            debug_info = " | ".join(muestra_texto)
            return jsonify({'error': f'Estructura diferente. El PDF dice: {debug_info}'}), 400

        df = pd.DataFrame(filas_datos)
        
        df['Cierre_PNL'] = pd.to_numeric(df['Cierre_PNL'].str.replace(',', ''), errors='coerce')
        df['Precio_Entrada'] = pd.to_numeric(df['Precio_Entrada'].str.replace(',', ''), errors='coerce')
        df['Precio_Cierre'] = pd.to_numeric(df['Precio_Cierre'].str.replace(',', ''), errors='coerce')
        
        df = df.dropna(subset=['Cierre_PNL'])
        
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