"use strict";
/* Presentación segura de DEMO programada del comprador.
 * Reutiliza los botones y la implementación física YA existentes en
 * control-remoto-comprador.js. No crea nuevos endpoints ni permisos.
 * Solo habilita DEMO tras validación de asignación y comandos por FastAPI.
 */
(() => {
  if (location.pathname.split('/').pop() !== 'control.html') return;
  const ejecutar = document.getElementById('btnEjecutarDemo');
  const cancelar = document.getElementById('btnCancelarDemo');
  const panel = ejecutar?.closest('section.panel');
  if (!ejecutar || !cancelar || !panel) return;
  document.body.classList.add('armo-demo-comprador-v4');
  const bloque = document.createElement('div');
  bloque.className = 'armo-demo-info-v4';
  const titulo = document.createElement('strong');
  titulo.textContent = 'DEMO programada · EXCAVADORA-ARMO';
  const recorrido = document.createElement('p');
  recorrido.textContent = 'Secuencia: Avanzar · Girar derecha · Excavar · Descargar pala · Retroceder. Cada movimiento lleva DETENER.';
  const estado = document.createElement('p');
  estado.className = 'armo-demo-estado-v4';
  estado.setAttribute('role', 'status');
  estado.setAttribute('aria-live', 'polite');
  const advertencia = document.createElement('p');
  advertencia.className = 'armo-demo-nota-v4';
  advertencia.textContent = 'Solo ejecuta órdenes si FastAPI confirma propiedad, permisos y comandos habilitados. No equivale a una DEMO almacenada en MySQL.';
  bloque.append(titulo, recorrido, estado, advertencia);
  panel.querySelector('h2')?.insertAdjacentElement('afterend',bloque);
  ejecutar.textContent = 'EJECUTAR DEMO PROGRAMADA';
  cancelar.textContent = 'CANCELAR DEMO';
  let autorizado = false;
  let permitida = false;
  let enCurso = false;
  let mensaje = 'Validando acceso del comprador. La DEMO permanece bloqueada.';
  function pintar() {
    const puede = autorizado && permitida;
    const puedeEjecutar = puede && !enCurso;
    const puedeCancelar = puede && enCurso;
    if (ejecutar.disabled !== !puedeEjecutar) ejecutar.disabled = !puedeEjecutar;
    if (cancelar.disabled !== !puedeCancelar) cancelar.disabled = !puedeCancelar;
    estado.textContent = mensaje;
  }
  // app.js original también controla el atributo disabled. La sincronización
  // NO genera una autorización: únicamente refleja la señal comprobada por
  // control-remoto-comprador.js tras consultar al backend.
  const observador = new MutationObserver(pintar);
  observador.observe(ejecutar,{attributes:true,attributeFilter:['disabled']});
  observador.observe(cancelar,{attributes:true,attributeFilter:['disabled']});
  window.addEventListener('armo:comprador-control-autorizado',evento=>{
    autorizado = evento.detail?.autorizado === true;
    permitida = evento.detail?.demoDisponible === true;
    mensaje = !autorizado ? 'DEMO bloqueada: comprador sin autorización física.' :
      !permitida ? 'DEMO bloqueada: faltan movimientos autorizados en el catálogo de este vehículo.' :
      'DEMO lista. Verifica que la excavadora esté despejada y supervisada antes de ejecutar.';
    pintar();
  });
  window.addEventListener('armo:comprador-control-revocado',()=>{
    autorizado=false;permitida=false;enCurso=false;
    mensaje='Sesión cerrada. DEMO deshabilitada.';
    pintar();
  });
  window.addEventListener('armo:demo-comprador-estado',evento=>{
    enCurso = evento.detail?.activo === true;
    mensaje = enCurso ? 'DEMO programada en curso. Puedes cancelarla o usar DETENER.' :
      (autorizado && permitida ? 'DEMO finalizada o cancelada. Revisa MONITOREO para los movimientos registrados.' : mensaje);
    pintar();
  });
  pintar();
})();
