"use strict";
/* EXCAVADORA-ARMO: sesion del comprador y validacion remota.
 * No modifica ni habilita el puente fisico de localhost.
 * Nunca persiste contrasenas ni JWT. El backend determina permisos y
 * mantiene ARMO_REMOTE_CONTROL_ENABLED=0 durante esta etapa.
 */
(() => {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
  const API = 'https://vehiculo-iot.duckdns.org';
  const centro = document.querySelector('.bloque-extras-centro');
  if (!centro) return;
  const aviso = document.querySelector('.control-aviso');
  const leyenda = document.getElementById('leyendaControl');
  const estados = {
    direccion: document.getElementById('direccionActual'),
    brazo: document.getElementById('brazoActual')
  };
  const mapa = {
    direccion: {arriba:'AVANZAR', abajo:'RETROCEDER', izquierda:'GIRAR_IZQUIERDA', derecha:'GIRAR_DERECHA'},
    brazo: {arriba:'DESCARGAR_PALA', abajo:'EXCAVAR', izquierda:'GIRAR_VEHICULO_IZQUIERDA', derecha:'GIRAR_VEHICULO_DERECHA'}
  };
  // Los codigos se obtienen del catalogo autorizado en RDS, no se adivinan.
  const extras = ['MUSICA','CAMBIAR_VELOCIDAD','LUZ_LED'];
  const nombreACodigo = new Map();
  let token = null, vehiculo = null, sesion = 0, movimiento = null, puntero = null;
  let ocupado = false, vozActiva = false, enviarDetencion = false;
  let demoActiva = false, demoCancelada = false;
  function mostrar(s, malo=false) {
    if (aviso) aviso.textContent = s;
    if (leyenda) { leyenda.textContent = s; leyenda.style.color = malo ? '#fca5a5' : '#facc15'; }
    estado.textContent = s;
  }
  const caja = document.createElement('div');
  caja.id = 'armo-comprador-remoto';
  caja.style.cssText = 'box-sizing:border-box;width:100%;max-width:220px;margin:4px auto 0;padding:4px;border:1px solid #64748b;border-radius:8px;text-align:center;font-size:10px;color:#fff;position:relative';
  const acceso = document.createElement('button');
  acceso.type = 'button';
  acceso.textContent = '🔐 Acceso comprador';
  acceso.style.cssText='width:100%;background:#ffd21a;color:#13213b;font-weight:700;border:0;border-radius:5px;padding:5px;cursor:pointer;font-size:11px';
  const estado = document.createElement('p');
  estado.style.cssText='margin:3px 0 0;font-size:9px;line-height:1.2';
  estado.textContent='Sin sesión · Sin control físico';
  const formulario = document.createElement('form');
  formulario.hidden=true;
  formulario.style.cssText='position:absolute;left:50%;transform:translateX(-50%);top:100%;z-index:1000;width:220px;box-sizing:border-box;padding:9px;background:#14243d;border:1px solid #94a3b8;border-radius:8px;box-shadow:0 8px 25px #0009';
  const correo = document.createElement('input');
  correo.type='email';correo.required=true;correo.placeholder='Correo del comprador';correo.autocomplete='username';
  const clave = document.createElement('input');
  clave.type='password';clave.required=true;clave.placeholder='Contraseña';clave.autocomplete='current-password';
  const ingresar = document.createElement('button');
  ingresar.type='submit';ingresar.textContent='Iniciar sesión';
  const cerrarForm = document.createElement('button');
  cerrarForm.type='button';cerrarForm.textContent='Cancelar';
  for (const el of [correo,clave,ingresar,cerrarForm]) el.style.cssText='display:block;box-sizing:border-box;width:100%;margin:4px 0;padding:6px;border-radius:4px;font-size:12px';
  formulario.append(correo,clave,ingresar,cerrarForm);
  caja.append(acceso,estado,formulario); centro.append(caja);
  const cerrar = () => {
    demoCancelada=true;
    if(token) void detener();
    sesion++;token=null;vehiculo=null;nombreACodigo.clear();movimiento=null;puntero=null;
    clave.value='';formulario.hidden=true;acceso.textContent='🔐 Acceso comprador';
    const b=document.getElementById('btnDetener');if(b)b.disabled=true;
    document.querySelectorAll('.extras-mini-grid .btn-extra-mini').forEach(b=>b.disabled=true);
    for(const id of ['btnEjecutarDemo','btnCancelarDemo']){const b=document.getElementById(id);if(b)b.disabled=true;}
    mostrar('Sesión cerrada · Sin control físico');
  };
  acceso.addEventListener('click',()=>{
    if(token){cerrar();return;}
    formulario.hidden=!formulario.hidden;
    if(!formulario.hidden) correo.focus();
  });
  cerrarForm.addEventListener('click',()=>{formulario.hidden=true;clave.value='';});
  async function solicitud(url, opciones={}, jwt=null){
    const c=new AbortController();const limite=setTimeout(()=>c.abort(),6000);
    try {
      const headers={'Content-Type':'application/json',...(jwt?{Authorization:'Bearer '+jwt}:{})};
      const r=await fetch(API+url,{...opciones,headers,signal:c.signal,cache:'no-store'});
      if(!r.ok) throw new Error('AWS HTTP '+r.status);
      return await r.json();
    } finally {clearTimeout(limite);}
  }
  formulario.addEventListener('submit',async e=>{
    e.preventDefault();if(token)return;
    ingresar.disabled=true;mostrar('Validando comprador...');
    try{
      const login=await solicitud('/usuario/auth/login',{method:'POST',body:JSON.stringify({correo:correo.value.trim(),password:clave.value})});
      const jwt=login.access_token;if(typeof jwt!=='string'||!jwt)throw new Error('JWT no recibido');
      const unidades=await solicitud('/usuario/mis-vehiculos',{},jwt);
      if(!Array.isArray(unidades) || !unidades.length)throw new Error('No tienes vehículos asignados');
      const elegido=unidades.find(u=>Number(u.id_vehiculo)===1);
      if(!elegido) throw new Error('Vehículo 1 no está asignado a esta cuenta');
      const comandos=await solicitud('/usuario/vehiculos/1/comandos-permitidos',{},jwt);
      if(!Array.isArray(comandos))throw new Error('Catálogo inválido');
      const nuevo=new Map();
      for(const x of comandos){
        const n=String(x.nombre||'').trim().toUpperCase(), c=Number(x.codigo);
        if(n && Number.isInteger(c) && c>0) nuevo.set(n,c);
      }
      if(nuevo.get('DETENER')!==13)throw new Error('No se autorizó DETENER (13)');
      nombreACodigo.clear();for(const [n,c] of nuevo)nombreACodigo.set(n,c);
      token=jwt;vehiculo=1;sesion++;clave.value='';formulario.hidden=true;
      acceso.textContent='🔒 Cerrar sesión';
      const b=document.getElementById('btnDetener');if(b)b.disabled=false;
      document.querySelectorAll('.extras-mini-grid .btn-extra-mini').forEach(b=>b.disabled=false);
      for(const id of ['btnEjecutarDemo','btnCancelarDemo']){const b=document.getElementById(id);if(b)b.disabled=false;}
      mostrar('Comprador autorizado · Prueba remota; motores desactivados');
    }catch(err){clave.value='';mostrar('Acceso rechazado: '+err.message,true);}
    finally{ingresar.disabled=false;}
  });
  // Esta etapa prueba la ruta de ejecución con la bandera física apagada en AWS.
  // La confirmación de la API no equivale a confirmación eléctrica del ESP8266.
  async function enviar(nombre,duracion=200){
    if(!token||vehiculo!==1)throw new Error('Inicia sesión como comprador');
    const codigo=nombreACodigo.get(nombre);
    if(!codigo)throw new Error('Comando no permitido: '+nombre);
    const version=sesion;
    const resultado=await solicitud('/usuario/vehiculos/1/ejecutar-comando',{
      method:'POST',body:JSON.stringify({codigo_comando:codigo,duracion_ms:duracion})
    },token);
    if(version!==sesion)throw new Error('Sesión cambiada');
    if(resultado.ejecutado===true){
      mostrar('AWS aceptó '+nombre+' · Comando enviado (sin acuse del ESP8266)');
    } else {
      mostrar('AWS validó '+nombre+' · Sin movimiento físico');
    }
    return resultado;
  }
  async function detener(cancelarDemo=true){
    if(cancelarDemo) demoCancelada=true;
    movimiento=null;puntero=null;
    if(!token || enviarDetencion)return;
    enviarDetencion=true;
    try{ await enviar('DETENER',1); }
    catch(err){mostrar('DETENER no confirmado: '+err.message,true);}
    finally{enviarDetencion=false;}
  }
  function direccion(el,e){
    const r=el.getBoundingClientRect();const x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;
    if(Math.hypot(x,y)<Math.min(r.width,r.height)*0.09)return null;
    return Math.abs(x)>Math.abs(y)?(x<0?'izquierda':'derecha'):(y<0?'arriba':'abajo');
  }
  for(const [id,tipo] of [['joystick','direccion'],['joystickBrazo','brazo']]){
    const el=document.getElementById(id);if(!el)continue;
    el.addEventListener('pointerdown',e=>{
      if(!token){mostrar('Inicia sesión para validar órdenes',true);return;}
      if(puntero!==null||ocupado||vozActiva||demoActiva||document.hidden)return;
      puntero=e.pointerId;try{el.setPointerCapture(e.pointerId);}catch{}
      const dir=direccion(el,e),nombre=dir?mapa[tipo][dir]:null;
      if(!nombre)return;
      movimiento=nombre;ocupado=true;
      void enviar(nombre).catch(err=>mostrar(err.message,true)).finally(()=>{ocupado=false;});
      if(estados[tipo])estados[tipo].textContent=nombre+' · Validando AWS';
    },true);
    const soltar=e=>{if(puntero===null)return;if(e.pointerId!==undefined&&e.pointerId!==puntero)return;void detener();};
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,soltar,true);
  }
  document.querySelectorAll('.extras-mini-grid .btn-extra-mini').forEach((el,i)=>{
    el.addEventListener('click',e=>{
      if(!token)return;
      e.preventDefault();e.stopImmediatePropagation();
      if(i===3){void ejecutarDemo();return;}
      if(ocupado||vozActiva||demoActiva){mostrar('Control ocupado',true);return;}
      const nombre=extras[i];ocupado=true;
      void enviar(nombre).catch(err=>mostrar(err.message,true)).finally(()=>{ocupado=false;});
    },true);
  });
  document.getElementById('btnDetener')?.addEventListener('click',()=>{void detener();},true);
  // DEMO programada: secuencia de movimientos cortos; NO pulsa DEMO autonoma
  // del juguete. Cada paso tiene DETENER y un retardo para evitar solapamiento.
  const pasosDemo = ['AVANZAR','GIRAR_DERECHA','EXCAVAR','DESCARGAR_PALA','RETROCEDER'];
  const pausa = ms => new Promise(resolve=>setTimeout(resolve,ms));
  async function ejecutarDemo(){
    if(!token || ocupado || vozActiva || demoActiva || movimiento || document.hidden){
      mostrar('Inicia sesion y libera los controles antes de DEMO',true);return;
    }
    const version=sesion;
    for(const nombre of pasosDemo){
      if(!nombreACodigo.has(nombre)) {mostrar('DEMO no permitida: '+nombre,true);return;}
    }
    demoActiva=true;demoCancelada=false;
    try{
      for(const nombre of pasosDemo){
        if(demoCancelada || version!==sesion || document.hidden) break;
        await enviar(nombre,180);
        // Se detiene siempre antes de continuar; el firmware limita a 900 ms.
        await detener(false);
        if(demoCancelada || version!==sesion || document.hidden) break;
        await pausa(250);
      }
      mostrar(demoCancelada ? 'DEMO cancelada' : 'DEMO terminada · DETENER');
    }catch(err){mostrar('DEMO interrumpida: '+err.message,true);}
    finally{
      // No enviar con token de otra sesion.
      if(token && version===sesion) await detener(false);
      demoActiva=false;
    }
  }
  document.getElementById('btnEjecutarDemo')?.addEventListener('click',e=>{e.preventDefault();void ejecutarDemo();},true);
  document.getElementById('btnCancelarDemo')?.addEventListener('click',e=>{e.preventDefault();demoCancelada=true;void detener();},true);
  // La voz comparte la misma sesión y autorización. Una orden por pulsación.
  // No se habilitan pulsos de tres segundos hasta verificar la parada física.
  window.ARMOControlVoz=Object.freeze({ejecutar:async nombre=>{
    if(!token)throw new Error('Inicia sesión como comprador');
    if(nombre==='DETENER'){await detener();return;}
    if(nombre==='DEMO'){await ejecutarDemo();return;}
    if(ocupado||vozActiva||movimiento||demoActiva)throw new Error('Control ocupado');
    vozActiva=true;
    try{return await enviar(nombre,200);}finally{vozActiva=false;}
  }});
  for(const ev of ['blur','pagehide'])window.addEventListener(ev,()=>{if(movimiento||demoActiva)void detener();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(movimiento||demoActiva))void detener();});
})();
