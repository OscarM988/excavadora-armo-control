"""Comprobación segura de API pública: SOLO GET, sin tokens ni comandos.

No confundir disponibilidad de la API con ejecución física del ESP8266.
"""
import json
import urllib.request
import urllib.error
import sys

BASE = 'https://vehiculo-iot.duckdns.org/v43'
PRUEBAS = [
 ('OpenAPI Administracion 4.3', '/openapi.json', {200}),
 ('Admin sin token debe rechazar', '/admin/clientes', {401,403}),
 ('Comprador sin token debe rechazar', '/usuario/mis-vehiculos', {401,403}),
 ('Catalogo invitado publico', '/invitado/catalogo', {200}),
]

def check(nombre, ruta, esperado):
    req=urllib.request.Request(BASE+ruta, headers={'Accept':'application/json', 'Cache-Control':'no-store'})
    try:
        with urllib.request.urlopen(req,timeout=10) as r:
            status=r.status; data=r.read(750000)
    except urllib.error.HTTPError as e:
        status=e.code;data=e.read(20000)
    except Exception as e:
        print('[SIN VERIFICAR]',nombre,type(e).__name__);return False
    if ruta=='/openapi.json' and status==200:
        try:
            spec=json.loads(data)
            print('  Endpoints documentados:',len(spec.get('paths',{})))
        except (ValueError,TypeError):
            print('  AVISO: OpenAPI sin JSON interpretable');return False
    ok=status in esperado
    print('[OK]' if ok else '[FALLO]',nombre,'HTTP',status)
    return ok

if __name__=='__main__':
 print('PRUEBA GET/HTTP SIN MOVIMIENTOS FISICOS; backend:',BASE)
 resultados=[check(*p) for p in PRUEBAS]
 print(sum(resultados),'de',len(resultados),'comprobaciones HTTP correctas')
 sys.exit(0 if all(resultados) else 1)
