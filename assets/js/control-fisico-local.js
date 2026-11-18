"use strict";
/* CONTROL FISICO LOCAL: solo funciona con servidor_control_local.py.
 * No contiene passwords, JWT ni claves. Nunca usar desde GitHub Pages.
 */
(async () => {
  if (!['localhost','127.0.0.1'].includes(location.hostname)) return;
  // Esperar a que el puente local se autentique. No se habilitan controles
  // ni se envian ordenes mientras la autorizacion sea invalida.
  let cfg;
  while (!cfg?.listo) {
    try {
      const r = await fetch('/__control/config', {cache: 'no-store'});
      if (r.ok) {
        const respuesta = await r.json();
        cfg = respuesta?.listo && typeof respuesta.nonce === 'string'
          ? respuesta : null;
      }
    } catch { cfg = null; }
    if (!cfg) await new Promise(resolve => setTimeout(resolve, 2000));
  }
  let activo=null, puntero=null, intervalo=null, enVuelo=false, secuencia=0;
  let pulsoVozActivo=false, vozCancelada=false;
  let demoActiva=false, demoCancelada=false;
  const texto=document.getElementById('leyendaControl');
  const aviso=document.querySelector('.control-aviso');
  const dirSalida=document.getElementById('direccionActual');
  const brazoSalida=document.getElementById('brazoActual');
  function mostrar(mensaje, error=false){
    if(texto){texto.textContent=mensaje;texto.style.color=error?'#f87171':'#22c55e';}
    if(aviso) aviso.textContent=mensaje;
  }
  mostrar('CONTROL FÍSICO LOCAL · Autorizado');
  const mapa={
    direccion:{arriba:'AVANZAR',abajo:'RETROCEDER',izquierda:'GIRAR_IZQUIERDA',derecha:'GIRAR_DERECHA'},
    brazo:{arriba:'DESCARGAR_PALA',abajo:'EXCAVAR',izquierda:'GIRAR_VEHICULO_IZQUIERDA',derecha:'GIRAR_VEHICULO_DERECHA'}
  };
  // Avisos para los indicadores de Extras. Solo representan aceptación de la API,
  // NO una lectura del estado eléctrico del control remoto o del ESP8266.
  const extrasConIndicador=new Set(['MUSICA','CAMBIAR_VELOCIDAD','LUZ_LED']);
  function publicarExtra(nombre,etapa,mensaje=''){
    if (!extrasConIndicador.has(nombre)) return;
    window.dispatchEvent(new CustomEvent('armo:control-api-evento',{
      detail:{nombre,etapa,mensaje,origen:'puente_local'}
    }));
  }
  async function enviar(comando){
    publicarExtra(comando,'SOLICITADO');
    try {
      const r=await fetch('/__control/accion',{
        method:'POST',headers:{'Content-Type':'application/json','X-ARMO-Control':cfg.nonce},
        body:JSON.stringify({comando,seq:++secuencia}),cache:'no-store'
      });
      const json=await r.json();
      if(!r.ok || !json.ok) throw new Error(json.error||'No confirmado');
      publicarExtra(comando,'ACEPTADO_POR_API');
      return json;
    } catch(error){
      publicarExtra(comando,'ERROR',error.message);
      throw error;
    }
  }
  function apagarIntervalo(){if(intervalo!==null){clearInterval(intervalo);intervalo=null;}}
  async function detener(){
    if (demoActiva) demoCancelada=true;
    activo=null;puntero=null;apagarIntervalo();
    try { await enviar('DETENER'); mostrar('DETENER · Salidas apagadas'); }
    catch(e){mostrar('ERROR DETENER: '+e.message,true);}
  }
  function latido(){
    if(!activo||enVuelo||document.hidden)return;
    const com=activo;
    enVuelo=true;
    enviar(com).then(()=>mostrar('Movimiento físico: '+com))
      .catch(e=>{mostrar('Error de envío: '+e.message,true);void detener();})
      .finally(()=>{enVuelo=false;});
  }
  function mover(comando){
    if (demoActiva) return;
    if(comando===activo)return;
    const comandoAnterior=activo; activo=comando;apagarIntervalo();
    if(!comando){
      const antes=Boolean(comandoAnterior);
      if(antes) void enviar('DETENER').catch(e=>mostrar('ERROR DETENER: '+e.message,true));
      return;
    }
    latido();intervalo=setInterval(latido,350);
  }
  function calcular(el,e){
    const r=el.getBoundingClientRect();const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
    if(Math.hypot(dx,dy)<Math.min(r.width,r.height)*0.09)return null;
    return Math.abs(dx)>Math.abs(dy)?(dx<0?'izquierda':'derecha'):(dy<0?'arriba':'abajo');
  }
  for(const [id,tipo,salida] of [['joystick','direccion',dirSalida],['joystickBrazo','brazo',brazoSalida]]){
    const el=document.getElementById(id);if(!el)continue;
    el.addEventListener('pointerdown',e=>{
      if(puntero!==null || pulsoVozActivo || demoActiva)return;
      puntero=e.pointerId;el.setPointerCapture?.(e.pointerId);
      const d=calcular(el,e);mover(d?mapa[tipo][d]:null);
      if(salida)salida.textContent=d?mapa[tipo][d]+' · Físico':'NEUTRAL';
    },true);
    el.addEventListener('pointermove',e=>{
      if(e.pointerId!==puntero)return;
      const d=calcular(el,e);mover(d?mapa[tipo][d]:null);
      if(salida)salida.textContent=d?mapa[tipo][d]+' · Físico':'NEUTRAL';
    },true);
    for(const evento of ['pointerup','pointercancel','lostpointercapture']){
      el.addEventListener(evento,()=>{if(puntero!==null)void detener();},true);
    }
  }
  const extras=['MUSICA','CAMBIAR_VELOCIDAD','LUZ_LED','DEMO'];
  function habilitarExtras(){document.querySelectorAll('.extras-mini-grid .btn-extra-mini').forEach((b,i)=>{
    // La DEMO usa secuencia propia; no activa funcion autonoma del juguete.
    b.disabled=false;
    if(i===3){b.title='DEMO programada cancelable: 5 movimientos breves';}
  });const stop=document.getElementById('btnDetener');if(stop)stop.disabled=false;}
  habilitarExtras();setInterval(habilitarExtras,700);
  // DEMO PROGRAMADA: NO activa la DEMO autónoma del control remoto.
  // Solo utiliza comandos individuales permitidos por el backend local.
  // Cada movimiento dura hasta 450 ms y después se solicita DETENER.
  // El firmware ESP8266 DEBE disponer de parada independiente de 900 ms.
  const PASOS_DEMO = Object.freeze([
    { comando: 'AVANZAR', duracion: 450 },
    { comando: 'GIRAR_IZQUIERDA', duracion: 450 },
    { comando: 'EXCAVAR', duracion: 450 },
    { comando: 'DESCARGAR_PALA', duracion: 450 },
    { comando: 'RETROCEDER', duracion: 450 }
  ]);
  const PAUSA_DEMO_MS = 250;
  const ESPERA_ENVIO_DEMO_MS = 650;
  const botonDemo=document.querySelector('.extras-mini-grid .btn-extra-mini[data-codigo="13"]');

  async function esperarDemo(ms){
    const hasta=performance.now()+ms;
    while (performance.now()<hasta){
      if (demoCancelada || document.hidden || !document.hasFocus()) {
        throw new Error('DEMO cancelada');
      }
      await new Promise(resolve=>setTimeout(resolve,Math.min(40,Math.max(1,hasta-performance.now()))));
    }
  }

  async function ejecutarDemo(){
    if(demoActiva){
      demoCancelada=true;
      mostrar('Cancelando DEMO...');
      return;
    }
    if(activo || puntero!==null || pulsoVozActivo){
      mostrar('Suelta los joysticks y termina la orden de voz antes de DEMO.',true);
      return;
    }
    if(document.hidden || !document.hasFocus()){
      mostrar('La ventana debe estar visible para ejecutar DEMO.',true);
      return;
    }
    demoActiva=true;
    demoCancelada=false;
    botonDemo?.setAttribute('aria-pressed','true');
    try {
      // Solo una DEMO activa; todo movimiento tiene parada separada.
      for (const paso of PASOS_DEMO){
        if(demoCancelada) throw new Error('DEMO cancelada');
        const inicio=performance.now();
        await enviar(paso.comando);
        if(performance.now()-inicio>ESPERA_ENVIO_DEMO_MS){
          throw new Error('DEMO detenida por latencia de red');
        }
        mostrar('DEMO · '+paso.comando);
        await esperarDemo(paso.duracion);
        if(demoCancelada) throw new Error('DEMO cancelada');
        await enviar('DETENER');
        mostrar('DEMO · DETENER');
        await esperarDemo(PAUSA_DEMO_MS);
      }
      if(!demoCancelada) mostrar('DEMO finalizada · DETENER');
    } catch(error){
      mostrar('DEMO: '+error.message+'. Verificar parada física.',true);
    } finally {
      demoCancelada=true;
      try {
        await enviar('DETENER');
        mostrar('DEMO terminada · DETENER aceptado por AWS');
      } catch(error){
        mostrar('ATENCIÓN: DETENER NO CONFIRMADO: '+error.message,true);
      } finally {
        demoActiva=false;
        botonDemo?.setAttribute('aria-pressed','false');
      }
    }
  }
  if (botonDemo){
    botonDemo.title='DEMO programada con 5 movimientos breves y DETENER entre pasos';
    botonDemo.addEventListener('click',e=>{
      e.preventDefault();e.stopImmediatePropagation();
      void ejecutarDemo();
    },true);
  }
  document.querySelectorAll('.extras-mini-grid .btn-extra-mini').forEach((b,i)=>{
    if(i>2)return;
    b.addEventListener('click',async e=>{
      e.stopImmediatePropagation();
      if (pulsoVozActivo || demoActiva) return;
      if(activo)await detener();
      try{await enviar(extras[i]);mostrar('Botón físico: '+extras[i]);}
      catch(err){mostrar('Error: '+err.message,true);}
    },true);
  });
  document.getElementById('btnDetener')?.addEventListener('click',e=>{
    e.stopImmediatePropagation();vozCancelada=true;demoCancelada=true;void detener();
  },true);
  // API interna para voz. Comparte nonce y contador secuencial con joysticks.
  // Nunca se expone el token JWT ni se aceptan ordenes arbitrarias.
  const comandosVoz = new Set([
    'AVANZAR','RETROCEDER','GIRAR_IZQUIERDA','GIRAR_DERECHA',
    'EXCAVAR','DESCARGAR_PALA','GIRAR_VEHICULO_IZQUIERDA',
    'GIRAR_VEHICULO_DERECHA','MUSICA','CAMBIAR_VELOCIDAD','LUZ_LED'
  ]);
  // Ordenes continuas reconocidas por voz: duracion MAXIMA de 3 segundos.
  // Se refrescan periodicamente para respetar watchdog de puente (1.05 s)
  // y el limite fisico del ESP8266 (900 ms, si esta realmente cargado).
  const DURACION_VOZ_MS = 3000;
  const INTERVALO_VOZ_MS = 300;
  const MAX_LATENCIA_MS = 650;
  const extrasPorPulsacion = new Set(['MUSICA','CAMBIAR_VELOCIDAD','LUZ_LED']);
  const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
  const cancelarVoz = () => { vozCancelada = true; };
  async function ejecutarVoz(comando) {
    if (comando === 'DETENER') {
      cancelarVoz();
      await detener();
      return;
    }
    if (!comandosVoz.has(comando)) throw new Error('Orden no autorizada');
    if (activo || puntero !== null || pulsoVozActivo || demoActiva) {
      throw new Error('Suelta los joysticks antes de hablar');
    }
    if (document.hidden || !document.hasFocus()) {
      throw new Error('La pagina debe estar visible y enfocada');
    }
    pulsoVozActivo = true;
    vozCancelada = false;
    const esContinuo = !extrasPorPulsacion.has(comando);
    try {
      if (!esContinuo) {
        // Música, velocidad y luces son pulsaciones, NO de 3 segundos.
        await enviar(comando);
        mostrar('Voz: ' + comando + ' · pulsación aceptada');
      } else {
        const inicio = performance.now();
        const limite = inicio + DURACION_VOZ_MS;
        while (!vozCancelada && performance.now() < limite) {
          if (document.hidden || !document.hasFocus()) {
            throw new Error('Ventana fuera de foco: parada por seguridad');
          }
          const envioInicio = performance.now();
          await enviar(comando);
          if (performance.now() - envioInicio > MAX_LATENCIA_MS) {
            throw new Error('Retraso de red: parada por seguridad');
          }
          if (vozCancelada) break;
          mostrar('Voz: ' + comando + ' · máximo 3 segundos');
          const restante = limite - performance.now();
          if (restante <= 0) break;
          await pausa(Math.min(INTERVALO_VOZ_MS, restante));
        }
      }
    } finally {
      // DETENER se intenta tanto al terminar los 3 s como ante cualquier fallo.
      cancelarVoz();
      try { await detener(); }
      finally { pulsoVozActivo = false; }
    }
  }
  window.ARMOControlVoz = Object.freeze({ ejecutar: ejecutarVoz });
  for (const evento of ['blur','pagehide']) {
    window.addEventListener(evento,()=>{
      cancelarVoz();demoCancelada=true;
      if(activo || pulsoVozActivo || demoActiva) void detener();
    });
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      cancelarVoz();demoCancelada=true;
      if(activo || pulsoVozActivo || demoActiva) void detener();
    }
  });
})();
