"use strict";
/* EXCAVADORA-ARMO 4.3 · Exhibición física con autorizacion de un solo uso.
 * Se superpone al control original SOLO cuando existe una sesion fisica validada.
 * No altera el control virtual mientras la API no habilite exhibicion fisica.
 * Pulsos discretos maximo 500 ms; el backend envia DETENER y el firmware
 * necesita watchdog independiente (<=900 ms).
 */
(() => {
  const API = 'https://vehiculo-iot.duckdns.org/v43';
  const CODIGOS = {
    joystick: {arriba:1, abajo:2, izquierda:3, derecha:4},
    joystickBrazo: {arriba:10, abajo:9, izquierda:11, derecha:12}
  };
  let token = null;
  let caduca = 0;
  let pendiente = Promise.resolve();
  let puntero = null;
  let zonaActiva = null;
  let ultimoCodigo = 0;
  let ultimoEnvio = 0;
  let timer = null;

  const caja = document.createElement('section');
  caja.id = 'armo-exhibicion-fisica-v10';
  caja.setAttribute('aria-label', 'Exhibicion fisica segura');
  caja.innerHTML = `
    <div class="armo-exhibicion-cabecera"><strong>EXHIBICIÓN FÍSICA · ACCESO SUPERVISADO</strong><span id="armo-ex-v10-reloj" aria-live="polite">Sin sesión</span></div>
    <p>Solo para una unidad autorizada por Administración. Cada movimiento es un pulso breve y el servidor envía DETENER. No utilices el vehículo si hay personas cerca de las partes móviles.</p>
    <div class="armo-exhibicion-acceso">
      <label for="armo-ex-v10-codigo">Código de autorización temporal</label>
      <input id="armo-ex-v10-codigo" maxlength="64" inputmode="text" autocomplete="off" spellcheck="false" placeholder="Código entregado presencialmente" />
      <button id="armo-ex-v10-activar" type="button">ACTIVAR PRUEBA FÍSICA</button>
      <button id="armo-ex-v10-finalizar" type="button" disabled>FINALIZAR Y DETENER</button>
    </div>
    <p id="armo-ex-v10-estado" role="status">La demostración física está bloqueada hasta recibir autorización. La DEMO virtual sigue disponible.</p>`;
  const barra = document.getElementById('armo-invitado-barra');
  if (barra) barra.insertAdjacentElement('afterend', caja);
  else document.body.prepend(caja);
  const $ = id => document.getElementById(id);
  const estado = $('armo-ex-v10-estado');
  const activar = $('armo-ex-v10-activar');
  const finalizar = $('armo-ex-v10-finalizar');
  const codigo = $('armo-ex-v10-codigo');
  const reloj = $('armo-ex-v10-reloj');
  const activo = () => Boolean(token && Date.now() < caduca);
  function aviso(s) { estado.textContent = s; }

  async function api(path, payload, sesion) {
    const headers = {'Content-Type':'application/json', 'Accept':'application/json'};
    if (sesion) headers.Authorization = `Bearer ${sesion}`;
    const r = await fetch(API+path, {
      method: 'POST', headers, cache:'no-store',
      body:JSON.stringify(payload ?? {})
    });
    const d = await r.json().catch(()=>({}));
    if (!r.ok) throw Error(typeof d.detail==='string' ? d.detail : `HTTP ${r.status}`);
    return d;
  }

  function bloquear(razon) {
    token=null; caduca=0; puntero=null; zonaActiva=null; ultimoCodigo=0;
    finalizar.disabled=true; activar.disabled=false; codigo.disabled=false;
    if (timer) { clearInterval(timer); timer=null; }
    reloj.textContent='Sin sesión';
    if (razon) aviso(razon);
  }

  async function detener(t) {
    if (!t) return;
    try { await api('/invitado/exhibicion/sesiones/comandos', {codigo_comando:13,duracion_ms:1}, t); }
    catch (_) { aviso('No se confirmó DETENER remoto. Debe existir parada física independiente.'); }
  }
  async function cerrar() {
    const t=token; bloquear('Finalizando demostración física...');
    if (!t) return;
    try { await api('/invitado/exhibicion/sesiones/finalizar', {}, t); aviso('Sesión finalizada; DETENER solicitado al vehículo.'); }
    catch (_) { await detener(t); aviso('La sesión fue cerrada localmente; el firmware debe detener por seguridad.'); }
  }

  activar.addEventListener('click', async () => {
    if (activo()) return;
    activar.disabled=true;
    try {
      const d=await api('/invitado/exhibicion/sesiones', {codigo_autorizacion:codigo.value.trim()});
      if (!d.control_fisico || !d.token_sesion) throw Error('El servidor no autorizó control físico');
      token=d.token_sesion; caduca=Date.now()+Math.min(60,Number(d.duracion_segundos)||60)*1000;
      codigo.value=''; codigo.disabled=true; finalizar.disabled=false;
      aviso(`Unidad ${d.id_vehiculo} autorizada. Usa los joysticks del panel; pulsos de hasta 500 ms. DETENER siempre prioritario.`);
      timer=setInterval(()=>{
        const seg=Math.max(0,Math.ceil((caduca-Date.now())/1000));
        reloj.textContent = `${seg} s restantes`;
        if (!seg) { const t=token; bloquear('Tiempo agotado. El backend y el firmware detienen la unidad.'); detener(t); }
      },200);
    } catch(e) { aviso(`Exhibición física no disponible: ${e.message}`); activar.disabled=false; }
  });
  finalizar.addEventListener('click', cerrar);

  function direccionDeEvento(el,e) {
    const b=el.getBoundingClientRect();
    const x=e.clientX-b.left-b.width/2, y=e.clientY-b.top-b.height/2;
    const radio=Math.min(b.width,b.height)/2;
    if(Math.hypot(x,y)<radio*.18)return null;
    return Math.abs(x)>Math.abs(y)?(x<0?'izquierda':'derecha'):(y<0?'arriba':'abajo');
  }
  function pintarJoystick(zona,e,dir) {
    const sufijo=zona.id==='joystickBrazo'?'Brazo':'';
    const perilla=document.getElementById('joystickPerilla'+sufijo);
    const salida=document.getElementById(sufijo?'brazoActual':'direccionActual');
    if(perilla) {
      const r=zona.getBoundingClientRect();
      const x=e.clientX-r.left-r.width/2, y=e.clientY-r.top-r.height/2;
      const radio=Math.min(r.width,r.height)/2;
      const d=Math.hypot(x,y), f=Math.min(1,(radio*.52)/(d||1));
      perilla.style.left=`${50+x*f/(r.width||1)*100}%`;
      perilla.style.top=`${50+y*f/(r.height||1)*100}%`;
    }
    if(salida)salida.textContent=(dir||'NEUTRAL')+' · EXHIBICIÓN FÍSICA';
  }
  function centrarJoystick() {
    if(!zonaActiva)return;
    const sufijo=zonaActiva.id==='joystickBrazo'?'Brazo':'';
    const perilla=document.getElementById('joystickPerilla'+sufijo);
    const salida=document.getElementById(sufijo?'brazoActual':'direccionActual');
    if(perilla){perilla.style.left='50%';perilla.style.top='50%';}
    if(salida)salida.textContent='NEUTRAL · EXHIBICIÓN FÍSICA';
  }
  function mover(code) {
    if (!activo() || !code) return;
    const ahora=Date.now();
    if (code===ultimoCodigo && ahora-ultimoEnvio<650) return;
    ultimoCodigo=code;ultimoEnvio=ahora;
    const t=token;
    // Se serializan comandos: nunca se envía simultáneamente otro movimiento.
    pendiente=pendiente.catch(()=>{}).then(async()=>{
      if (!activo() || token!==t) return;
      try {
        const d=await api('/invitado/exhibicion/sesiones/comandos',{codigo_comando:code,duracion_ms:350},t);
        aviso(d.publicado?'Orden enviada a API/WSS (NO es confirmación física del motor).':'Orden no publicada');
      } catch(e) {
        aviso(`Movimiento no ejecutado: ${e.message}`);
        await detener(t);
      }
    });
  }
  function elJoystick(target){
    if (!(target instanceof Element))return null;
    const zona=target.closest('#joystick, #joystickBrazo');
    return zona && CODIGOS[zona.id] ? zona : null;
  }
  // Capturar antes de los handlers de simulación; sin sesión física los deja intactos.
  document.addEventListener('pointerdown', e=>{
    const zona=elJoystick(e.target); if(!zona || !activo()) return;
    e.preventDefault();e.stopImmediatePropagation();
    if (puntero!==null)return;
    puntero=e.pointerId;zonaActiva=zona;
    try{zona.setPointerCapture(puntero);}catch(_){}
    const dir=direccionDeEvento(zona,e);
    pintarJoystick(zona,e,dir);
    mover(CODIGOS[zona.id][dir]);
  }, true);
  document.addEventListener('pointermove', e=>{
    if(!activo()||puntero!==e.pointerId||!zonaActiva)return;
    e.preventDefault();e.stopImmediatePropagation();
    const dir=direccionDeEvento(zonaActiva,e);
    pintarJoystick(zonaActiva,e,dir);
    if(dir)mover(CODIGOS[zonaActiva.id][dir]);
  },true);
  for(const tipo of ['pointerup','pointercancel']){
    document.addEventListener(tipo,e=>{
      if(!activo()||puntero!==e.pointerId)return;
      e.preventDefault();e.stopImmediatePropagation();
      puntero=null; zonaActiva=null; ultimoCodigo=0;
      const t=token;
      pendiente=pendiente.catch(()=>{}).then(()=>detener(t));
    },true);
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden && token){const t=token; pendiente=pendiente.catch(()=>{}).then(()=>detener(t));}
  });
  window.addEventListener('pagehide',()=>{
    if (!token)return;
    // En cierre inesperado no se garantiza la solicitud: watchdog físico OBLIGATORIO.
    fetch(API+'/invitado/exhibicion/sesiones/finalizar',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:'{}',keepalive:true,cache:'no-store'}).catch(()=>{});
  });
})();
