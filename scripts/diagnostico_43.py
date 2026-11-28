"""Diagnóstico NO destructivo de repositorios EXCAVADORA-ARMO 4.3.
No requiere internet ni credenciales, no ejecuta movimientos.
"""
from pathlib import Path
import argparse
import re

REQ_FRONT = [
 'index.html','control.html','comprador.html','invitado.html',
 'administracion.html','editor-demos.html','service-worker.js',
 'assets/js/armo-guard-43.js','assets/js/control-remoto-comprador.js',
 'assets/js/armo-invitado-original-43.js'
]


def main():
 p=argparse.ArgumentParser();p.add_argument('frontend');p.add_argument('--backend')
 a=p.parse_args();root=Path(a.frontend).resolve();backend=Path(a.backend).resolve() if a.backend else None
 print('EXCAVADORA-ARMO | DIAGNOSTICO NO DESTRUCTIVO 4.3')
 if not (root/'.git').is_dir():raise SystemExit('ERROR: el frontend no contiene .git')
 for nombre in REQ_FRONT:print(('OK  ' if (root/nombre).is_file() else 'FALTA ')+nombre)
 guest=(root/'invitado.html').read_text('utf-8') if (root/'invitado.html').exists() else ''
 print('Modo invitado:', 'VIRTUAL (sin conexión física)' if 'modo-invitado-43' in guest else 'NO VERIFICADO')
 if backend:
  if not (backend/'app/main.py').exists():print('BACKEND: falta app/main.py, estructura no reconocida')
  else:
   print('BACKEND: código encontrado; falta auditar rutas reales y hardware antes de movimientos invitados')
   for pat in ('*invitado*.py','*demo*.py','*comprador*.py','*admin*.py'):
    print(' ',pat,':',len(list((backend/'app').rglob(pat))))
 else: print('BACKEND: no suministrado; las funciones físicas y permisos NO están verificados')
 print('Este diagnóstico no acredita pruebas físicas, WSS por unidad ni RDS.')
if __name__=='__main__':main()
