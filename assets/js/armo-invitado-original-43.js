"use strict";
/* EXCAVADORA-ARMO · Invitado 4.3
 * Reutiliza exclusivamente el HTML/CSS de CONTROL + MONITOREO original.
 * NO carga app.js, monitoreo.js, WSS, ni control remoto del comprador.
 * NO hace fetch ni accede a JWT; cada orden se limita a este navegador.
 * El perfil invitado físico necesita sesión exclusiva autorizada por backend.
 */
(() => {
  const $ = id => document.getElementById(id);
  const control = document.querySelector('#pantallaControl > section[aria-label="Control principal de la excavadora"]');
  const monitoreo = $('vistaMonitoreo');
  // Conservamos el panel DEMO del CONTROL original sin cargar APIs reales.
  const panelDemo = $('btnEjecutarDemo')?.closest('section.panel');
  if (!control || !monitoreo || !panelDemo || !$('joystick') || !$('joystickBrazo')) return;
  const labelUltimo = monitoreo.querySelector('.monitoreo-tarjeta .monitoreo-etiqueta');
  if (labelUltimo) labelUltimo.textContent = 'ÚLTIMO MOVIMIENTO VIRTUAL';
  const captionHistorial = monitoreo.querySelector('.monitoreo-tabla caption');
  if (captionHistorial) captionHistorial.textContent = 'Diez movimientos virtuales más recientes de la demostración local.';

  const DURACION = 60_000;
  let limite = 0;
  let reloj = null;
  let pausaMovimiento = null;
  let timersDemo = [];
  let demoEnCurso = false;
  let movimientoActual = 'DETENER';
  let historial = [];
  let vistaActual = 'control';
  let musicaEncendida=false, lucesEncendidas=false, velocidadRapida=false;

  control.dataset.vista = 'control';
  panelDemo.dataset.vista = 'demo';
  panelDemo.hidden = true;
  monitoreo.dataset.vista = 'monitoreo';
  control.classList.add('vista-activa');
  control.hidden = false;
  monitoreo.classList.remove('vista-activa');
  monitoreo.hidden = true;

  // La barra del perfil se construye igual que la del comprador.
  const barraPerfil = document.createElement('div');
  barraPerfil.id = 'armo-guest-perfil-v5';
  const perfilTexto = document.createElement('span');
  perfilTexto.textContent = 'INVITADO · EXCAVADORA-ARMO';
  const perfilVolver = document.createElement('a');
  perfilVolver.textContent = 'INICIAR SESIÓN';
  perfilVolver.href = 'index.html';
  barraPerfil.append(perfilTexto,perfilVolver);
  document.body.prepend(barraPerfil);

  const cabecera = document.querySelector('.encabezado');
  if (cabecera?.querySelector('p')) cabecera.querySelector('p').textContent = 'Panel de control remoto · Exhibición virtual';
  const salir = $('btnSalir');
  if (salir) {
    salir.hidden = false;
    salir.style.display = '';
    salir.textContent = 'INICIAR SESIÓN';
    salir.addEventListener('click', () => { finalizar('Sesión terminada'); location.assign('index.html'); });
  }

  for (const [id, valor] of [
    ['estadoWS', 'No conectado · virtual'],
    ['estadoAPI', 'No utilizado · virtual'],
    ['estadoRDS', 'Sin acceso · virtual']
  ]) {
    const e = $(id);
    if (e) { e.textContent = valor; e.style.color = '#facc15'; }
  }

  const nav = document.createElement('nav');
  nav.id = 'navegacion-principal-43';
  nav.setAttribute('aria-label', 'Control y monitoreo de exhibición');
  const btnControl = document.createElement('button');
  const btnMonitor = document.createElement('button');
  for (const [boton,texto] of [[btnControl,'CONTROL'],[btnMonitor,'MONITOREO']]) {
    boton.type = 'button'; boton.textContent = texto;
    nav.appendChild(boton);
  }
  btnControl.addEventListener('click', () => mostrarVista('control'));
  btnMonitor.addEventListener('click', () => mostrarVista('monitoreo'));
  barraPerfil.insertAdjacentElement('afterend',nav);

  const barra = document.createElement('div');
  barra.id = 'armo-invitado-barra';
  barra.setAttribute('role', 'group');
  barra.setAttribute('aria-label', 'Sesión de demostración de invitado');
  const etiqueta = document.createElement('strong');
  etiqueta.textContent = 'INVITADO · EXHIBICIÓN VIRTUAL';
  const tiempo = document.createElement('span');
  tiempo.id = 'armo-invitado-tiempo';
  tiempo.setAttribute('role','status');
  const iniciar = document.createElement('button');
  iniciar.type = 'button'; iniciar.id='armo-invitado-iniciar'; iniciar.textContent = 'INICIAR DEMO 60 s';
  const terminar = document.createElement('button');
  terminar.type='button'; terminar.id='armo-invitado-terminar'; terminar.textContent = 'FINALIZAR';
  barra.append(etiqueta, tiempo, iniciar, terminar);
  document.querySelector('#pantallaControl > .indicadores')?.insertAdjacentElement('afterend', barra);

  // Las mismas tres pestañas útiles del comprador: Dirección, DEMO y Monitor.
  // BRAZO y EXTRAS siguen disponibles en el panel principal, NO como pestañas.
  const secciones = document.createElement('nav');
  secciones.className = 'armo-guest-subnav-v4';
  secciones.setAttribute('aria-label','Secciones de exhibición');
  const botonesSeccion = {};
  for (const [vista, nombre] of [['control','Dirección'],['demo','Demo'],['monitoreo','Monitor']]) {
    const boton = document.createElement('button');
    boton.type = 'button'; boton.textContent = nombre;
    boton.addEventListener('click',()=> mostrarVista(vista));
    secciones.append(boton); botonesSeccion[vista] = boton;
  }
  barra.insertAdjacentElement('afterend', secciones);

  const demoOriginal = $('btnEjecutarDemo');
  const cancelarOriginal = $('btnCancelarDemo');
  const catalogoDemo = document.createElement('div');
  catalogoDemo.id = 'armo-guest-catalogo-v4';
  const etiquetaDemo = document.createElement('label');
  etiquetaDemo.textContent = 'Elige una DEMO virtual';
  const elegirDemo = document.createElement('select');
  elegirDemo.id = 'armo-guest-seleccion-v4';
  for (const [codigo,nombre] of [
    ['recorrido','Recorrido · Dirección y excavación'],
    ['brazo','Movimiento de brazo y pala']
  ]) {
    const opcion = document.createElement('option');
    opcion.value = codigo; opcion.textContent = nombre; elegirDemo.append(opcion);
  }
  etiquetaDemo.append(elegirDemo);
  const mensajeDemo = document.createElement('p');
  mensajeDemo.id='armo-guest-mensaje-v4';
  mensajeDemo.setAttribute('role','status');
  mensajeDemo.textContent='Inicia la sesión de 60 s para ejecutar una DEMO.';
  catalogoDemo.append(etiquetaDemo,mensajeDemo);
  panelDemo.querySelector('h2')?.insertAdjacentElement('afterend',catalogoDemo);
  if (demoOriginal) demoOriginal.textContent='Ejecutar DEMO virtual';
  if (cancelarOriginal) cancelarOriginal.textContent='Cancelar DEMO virtual';

  const aviso = document.createElement('p');
  aviso.id = 'armo-invitado-aviso'; aviso.setAttribute('role','status');
  aviso.textContent = 'Prueba los joysticks originales: sesión virtual sin movimientos físicos.';
  control.querySelector('h2')?.insertAdjacentElement('afterend', aviso);

  // Las piezas del CONTROL de comprador se conservan, pero sólo esta página
  // habilita las visualizaciones, nunca los endpoints reales.
  // El comprador tiene Extras + Voz en la misma zona central.
  // Construimos esos elementos para el invitado con la MISMA disposición.
  const centro = control.querySelector('.bloque-extras-centro');
  const gridExtras = centro?.querySelector('.extras-mini-grid');
  const botonDetener = $('btnDetener');
  const encabezadoExtras = centro?.querySelector('h3');
  const contenedorExtras = document.createElement('div');
  contenedorExtras.className = 'armo-guest-extras-v5';
  const controlesExtras = document.createElement('div');
  controlesExtras.className = 'armo-guest-extras-izq-v5';
  if (encabezadoExtras) controlesExtras.append(encabezadoExtras);
  if (gridExtras) controlesExtras.append(gridExtras);
  if (botonDetener) controlesExtras.append(botonDetener);
  const extrasEstado = document.createElement('p');
  extrasEstado.className='armo-guest-estado-extras-v5';
  extrasEstado.setAttribute('role','status');
  extrasEstado.textContent='Música: sin activar · Luces: sin activar · Velocidad: normal';
  controlesExtras.append(extrasEstado);

  const vozDock = document.createElement('section');
  vozDock.id='armo-voz-dock';
  vozDock.className='armo-guest-voz-v5';
  vozDock.setAttribute('aria-label','Control por voz virtual');
  const vozTitulo = document.createElement('h3');
  vozTitulo.textContent='🎤 Control por voz';
  const vozBoton = document.createElement('button');
  vozBoton.type='button';
  vozBoton.textContent='🎤 Reconocer voz';
  vozBoton.disabled=true;
  const vozParar = document.createElement('button');
  vozParar.type='button';
  vozParar.textContent='⛔ DETENER';
  vozParar.disabled=true;
  const vozEstado = document.createElement('p');
  vozEstado.setAttribute('role','status');
  vozEstado.textContent='Voz: demostración virtual';
  vozDock.append(vozTitulo,vozBoton,vozParar,vozEstado);
  contenedorExtras.append(controlesExtras,vozDock);
  centro?.prepend(contenedorExtras);
  const extras = [...control.querySelectorAll('.extras-mini-grid [data-codigo]')];
  const detener = $('btnDetener');
  const etiquetasJoystick = [$('direccionActual'), $('brazoActual')];
  const perillas = [$('joystickPerilla'), $('joystickPerillaBrazo')];
  function activa() { return limite > Date.now(); }

  function mostrarVista(vista) {
    vistaActual = ['control','demo','monitoreo'].includes(vista) ? vista : 'control';
    for (const [nombre, panel] of [['control',control],['demo',panelDemo],['monitoreo',monitoreo]]) {
      const visible = vistaActual === nombre;
      panel.classList.toggle('vista-activa', visible);
      panel.hidden = !visible;
      const btn = botonesSeccion[nombre];
      if (btn) {
        btn.classList.toggle('activo',visible);
        btn.setAttribute('aria-current', visible?'page':'false');
      }
    }
    btnControl.classList.toggle('activo',vistaActual !== 'monitoreo');
    btnMonitor.classList.toggle('activo',vistaActual === 'monitoreo');
  }

  function actualizarBotones() {
    const habilitado = activa();
    for (const e of extras) e.disabled = !habilitado;
    vozBoton.disabled = !habilitado || demoEnCurso;
    vozParar.disabled = !habilitado;
    if (detener) detener.disabled = !habilitado;
    iniciar.disabled = habilitado;
    terminar.disabled = !habilitado;
    if (demoOriginal) demoOriginal.disabled = !habilitado || demoEnCurso;
    if (cancelarOriginal) cancelarOriginal.disabled = !demoEnCurso;
    elegirDemo.disabled = !habilitado || demoEnCurso;
    tiempo.textContent = habilitado ? `${Math.max(0,Math.ceil((limite-Date.now())/1000))} s restantes` : 'Sin sesión activa';
  }

  function mostrarUltimo(nombre, fecha, origen) {
    for (const [id, dato] of [
      ['monitoreoVehiculo', 'EXCAVADORA-ARMO · Exhibición virtual (sin dispositivo físico)'],
      ['monitoreoMovimiento', nombre],
      ['monitoreoFecha', fecha.toLocaleDateString('es-MX')],
      ['monitoreoHora', fecha.toLocaleTimeString('es-MX')],
      ['monitoreoCodigo', 'VIRTUAL'],
      ['monitoreoOrigen', origen],
      ['monitoreoMensaje', 'Simulación del navegador. No se consulta el historial real de Amazon RDS.']
    ]) {
      const el = $(id); if (el) el.textContent = dato;
    }
  }

  function pintarHistorial() {
    const tbody = $('monitoreoHistorial');
    if (!tbody) return;
    tbody.replaceChildren();
    if (!historial.length) {
      const tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 4; td.textContent = 'Sin movimientos virtuales'; tr.append(td); tbody.append(tr); return;
    }
    historial.forEach((h,i) => {
      const tr = document.createElement('tr');
      for (const val of [String(i+1), h.nombre, h.fecha.toLocaleDateString('es-MX'), h.fecha.toLocaleTimeString('es-MX')]) {
        const td = document.createElement('td'); td.textContent = val; tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  }

  function registrar(nombre, origen='INVITADO · VIRTUAL') {
    const fecha = new Date();
    movimientoActual = nombre;
    historial.unshift({nombre,origen,fecha});
    historial = historial.slice(0,10);
    mostrarUltimo(nombre,fecha,origen);
    pintarHistorial();
    aviso.textContent = `${nombre} · ${origen} · No se envían comandos físicos`;
  }

  function limpiarPausa() {
    if (pausaMovimiento !== null) { clearTimeout(pausaMovimiento); pausaMovimiento = null; }
  }
  function limpiarDemo() {
    for (const t of timersDemo) clearTimeout(t);
    timersDemo = []; demoEnCurso = false;
  }
  function detenerVirtual(origen='DETENER VIRTUAL') {
    limpiarPausa();
    if (movimientoActual !== 'DETENER') registrar('DETENER', origen);
    for(const salida of etiquetasJoystick) if(salida) salida.textContent = 'NEUTRAL · Virtual';
    for(const p of perillas) if(p){p.style.left='50%';p.style.top='50%';}
  }
  function finalizar(mensaje='Demostración finalizada') {
    limpiarDemo(); detenerVirtual(); limite=0;
    if(reloj!==null){clearInterval(reloj);reloj=null;}
    actualizarBotones(); mensajeDemo.textContent='Inicia una sesión para ejecutar una DEMO virtual.'; aviso.textContent = mensaje + '. Sin movimientos físicos.';
  }
  function tick() {
    if(limite && !activa()) { finalizar('Tiempo de exhibición terminado'); return; }
    actualizarBotones();
  }
  function comenzar() {
    finalizar('Preparando demostración');
    historial=[]; movimientoActual='DETENER'; limite=Date.now()+DURACION;
    registrar('DETENER','INICIO DE SESIÓN VIRTUAL');
    mensajeDemo.textContent='Selecciona una DEMO para probarla durante esta sesión.';
    reloj=setInterval(tick,250);
    tick(); mostrarVista('control');
    aviso.textContent = 'Sesión virtual activa. Prueba Dirección, Brazo, extras y Monitoreo.';
  }
  function mover(nombre, origen='INVITADO · CONTROL') {
    if(!activa()) {tick();return;}
    if(demoEnCurso) limpiarDemo();
    limpiarPausa();
    if(nombre==='DETENER') {detenerVirtual();return;}
    if(nombre!==movimientoActual) registrar(nombre,origen);
    // Corte automático de cada orden virtual; no hay conexión a hardware.
    pausaMovimiento = setTimeout(()=>{pausaMovimiento=null;detenerVirtual('PARO AUTOMÁTICO VIRTUAL');},700);
  }
  function demoAutomatica() {
    if (!activa() || demoEnCurso) return;
    limpiarDemo(); detenerVirtual(); demoEnCurso=true;
    const secuencias = {
      recorrido:['AVANZAR','DETENER','GIRAR_IZQUIERDA','DETENER','EXCAVAR','DETENER','DESCARGAR_PALA','DETENER'],
      brazo:['EXCAVAR','DETENER','DESCARGAR_PALA','DETENER','GIRAR_VEHICULO_IZQUIERDA','DETENER','GIRAR_VEHICULO_DERECHA','DETENER']
    };
    const secuencia = secuencias[elegirDemo.value] || secuencias.recorrido;
    const pasoMs = 1050;
    mensajeDemo.textContent = 'DEMO virtual en ejecución. Puedes cancelarla en cualquier momento.';
    actualizarBotones();
    secuencia.forEach((nombre,i)=>{
      timersDemo.push(setTimeout(()=>{
        if(!activa()||!demoEnCurso)return;
        if(nombre==='DETENER') detenerVirtual('DEMO AUTOMÁTICA');
        else registrar(nombre,'DEMO AUTOMÁTICA VIRTUAL');
        if(i===secuencia.length-1){
          demoEnCurso=false;
          detenerVirtual('FIN DE DEMO');
          aviso.textContent='DEMO terminada · simulación local';
          mensajeDemo.textContent='DEMO completada; los movimientos aparecen en MONITOREO.';
          actualizarBotones();
        }
      }, i*pasoMs));
    });
  }

  function prepararJoystick(idZona,idPerilla,idSalida,mapa) {
    const zona=$(idZona), perilla=$(idPerilla), salida=$(idSalida);
    if(!zona||!perilla||!salida)return;
    let puntero=null, direccion=null;
    function centrar() {
      puntero=null; direccion=null;
      perilla.style.left='50%';perilla.style.top='50%';
      salida.textContent='NEUTRAL · Virtual';
      if(!demoEnCurso && activa()) detenerVirtual('SOLTAR JOYSTICK');
    }
    function calcular(x,y) {
      const r=zona.getBoundingClientRect(), dx=x-r.left-r.width/2, dy=y-r.top-r.height/2;
      if(!r.width||!r.height)return;
      const radio=Math.min(r.width,r.height)/2, distancia=Math.hypot(dx,dy);
      const factor=Math.min(1,(radio*.52)/(distancia||1));
      perilla.style.left=`${50+dx*factor/r.width*100}%`;
      perilla.style.top=`${50+dy*factor/r.height*100}%`;
      const lado = distancia < radio*.18 ? null : Math.abs(dx)>Math.abs(dy) ? (dx<0?'izquierda':'derecha') : (dy<0?'arriba':'abajo');
      const nombre=lado?mapa[lado]:null;
      salida.textContent=(nombre||'NEUTRAL')+' · Virtual';
      if(nombre!==direccion) {
        direccion=nombre;
        if(nombre)mover(nombre);else detenerVirtual('JOYSTICK NEUTRAL');
      }
    }
    zona.addEventListener('pointerdown',e=>{
      if(!activa()||puntero!==null) return;
      puntero=e.pointerId;
      try{zona.setPointerCapture(puntero);}catch(_){}
      calcular(e.clientX,e.clientY);
    });
    zona.addEventListener('pointermove',e=>{if(puntero===e.pointerId)calcular(e.clientX,e.clientY);});
    const liberar=e=>{if(puntero===e.pointerId)centrar();};
    zona.addEventListener('pointerup',liberar);
    zona.addEventListener('pointercancel',liberar);
    zona.addEventListener('lostpointercapture',()=>{if(puntero!==null)centrar();});
    const flechas={ArrowUp:'arriba',ArrowDown:'abajo',ArrowLeft:'izquierda',ArrowRight:'derecha'};
    zona.addEventListener('keydown',e=>{if(flechas[e.key]){e.preventDefault();if(!e.repeat&&activa()) {direccion=mapa[flechas[e.key]];salida.textContent=direccion+' · Virtual';mover(direccion);}}});
    zona.addEventListener('keyup',e=>{if(flechas[e.key]){e.preventDefault();centrar();}});
    window.addEventListener('blur',centrar);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)centrar();});
  }
  prepararJoystick('joystick','joystickPerilla','direccionActual',{
    arriba:'AVANZAR',abajo:'RETROCEDER',izquierda:'GIRAR_IZQUIERDA',derecha:'GIRAR_DERECHA'
  });
  prepararJoystick('joystickBrazo','joystickPerillaBrazo','brazoActual',{
    arriba:'DESCARGAR_PALA',abajo:'EXCAVAR',izquierda:'GIRAR_VEHICULO_IZQUIERDA',derecha:'GIRAR_VEHICULO_DERECHA'
  });
  const nombresExtras={10:'MUSICA',11:'CAMBIAR_VELOCIDAD',12:'LUZ_LED',13:'DEMO'};
  for(const boton of extras) {
    boton.addEventListener('click',()=>{
      if(!activa())return;
      const nombre=nombresExtras[Number(boton.dataset.codigo)];
      if(nombre==='DEMO'){mostrarVista('demo');mensajeDemo.textContent='Selecciona una DEMO y presiona Ejecutar.';return;}
      if(nombre){
        if(nombre==='MUSICA')musicaEncendida=!musicaEncendida;
        if(nombre==='LUZ_LED')lucesEncendidas=!lucesEncendidas;
        if(nombre==='CAMBIAR_VELOCIDAD')velocidadRapida=!velocidadRapida;
        extrasEstado.textContent=`Música: ${musicaEncendida?'activada':'apagada'} · Luces: ${lucesEncendidas?'encendidas':'apagadas'} · Velocidad: ${velocidadRapida?'rápida':'normal'} (virtual)`;
        registrar(nombre);limpiarPausa();pausaMovimiento=setTimeout(()=>detenerVirtual('PULSACIÓN VIRTUAL'),400);
      }
    });
  }
  detener?.addEventListener('click',()=>{if(!activa())return;limpiarDemo();detenerVirtual('DETENER INVITADO');mensajeDemo.textContent='DEMO detenida.';actualizarBotones();aviso.textContent='DETENER activado · simulación sin hardware';});
  demoOriginal?.addEventListener('click',demoAutomatica);
  cancelarOriginal?.addEventListener('click',()=>{
    if(!demoEnCurso)return;
    limpiarDemo();detenerVirtual('DEMO CANCELADA');
    mensajeDemo.textContent='DEMO cancelada. Puedes iniciar otra mientras quede tiempo.';
    actualizarBotones();
  });

  // Reconocimiento del navegador únicamente para la simulación, SIN fetch.
  // Mantener obligatoria la palabra «excavadora», como en el panel del comprador.
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) vozEstado.textContent='El navegador no dispone de reconocimiento de voz.';
  function interpretarVoz(frase) {
    const t=String(frase||'').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
    if(!/^excavadora\b/.test(t) || /\b(no|nunca|evita)\b/.test(t)) return null;
    const q=t.replace(/^excavadora\b/,'').trim();
    if(/\b(detente|detener|alto|para|parar|stop)\b/.test(q))return 'DETENER';
    if(/\b(retrocede|retroceder|atras)\b/.test(q))return 'RETROCEDER';
    if(/\b(avanza|avanzar|adelante)\b/.test(q))return 'AVANZAR';
    if(/\b(excava|excavar)\b/.test(q))return 'EXCAVAR';
    if(/\b(descarga|descargar)\b/.test(q))return 'DESCARGAR_PALA';
    if(/\b(musica|sonido)\b/.test(q))return 'MUSICA';
    if(/\b(velocidad)\b/.test(q))return 'CAMBIAR_VELOCIDAD';
    if(/\b(luces|luz)\b/.test(q))return 'LUZ_LED';
    if(/\bizquierda\b/.test(q))return /\b(brazo|orugas|vehiculo)\b/.test(q)?'GIRAR_VEHICULO_IZQUIERDA':'GIRAR_IZQUIERDA';
    if(/\bderecha\b/.test(q))return /\b(brazo|orugas|vehiculo)\b/.test(q)?'GIRAR_VEHICULO_DERECHA':'GIRAR_DERECHA';
    return null;
  }
  const ordenesVoz=new Set(['AVANZAR','RETROCEDER','GIRAR_IZQUIERDA','GIRAR_DERECHA',
    'EXCAVAR','DESCARGAR_PALA','GIRAR_VEHICULO_IZQUIERDA','GIRAR_VEHICULO_DERECHA']);
  let vozAbierta=null;
  vozBoton.addEventListener('click',()=>{
    if(!activa() || !Speech || vozAbierta) return;
    let rec;
    try{rec=new Speech();}catch(_){vozEstado.textContent='Micrófono no disponible.';return;}
    vozAbierta=rec;rec.lang='es-MX';rec.continuous=false;rec.interimResults=false;rec.maxAlternatives=1;
    rec.onstart=()=>{vozEstado.textContent='Escuchando: «Excavadora, avanza»';vozBoton.disabled=true;};
    rec.onresult=e=>{
      const n=interpretarVoz(e.results?.[0]?.[0]?.transcript||'');
      if(!activa()){vozEstado.textContent='Sesión finalizada';return;}
      if(!n){vozEstado.textContent='Orden no reconocida. Di «Excavadora» y la orden.';return;}
      if(n==='DETENER'){limpiarDemo();detenerVirtual('VOZ · DETENER');actualizarBotones();}
      else if(ordenesVoz.has(n))mover(n,'INVITADO · VOZ VIRTUAL');
      else {
        const b=extras.find(x=>nombresExtras[Number(x.dataset.codigo)]===n);
        b?.click();
      }
      vozEstado.textContent=n+' · Solo simulación';
    };
    rec.onerror=e=>{vozEstado.textContent='Micrófono: '+e.error+'. Sin orden enviada.';};
    rec.onend=()=>{vozAbierta=null;actualizarBotones();};
    try{rec.start();}catch(_){vozAbierta=null;vozEstado.textContent='No se pudo abrir micrófono.';actualizarBotones();}
  });
  vozParar.addEventListener('click',()=>{
    try{vozAbierta?.abort();}catch(_){}
    limpiarDemo();detenerVirtual('VOZ · DETENER');
    actualizarBotones();vozEstado.textContent='DETENER · Simulación virtual';
  });

  iniciar.addEventListener('click',comenzar);
  terminar.addEventListener('click',()=>finalizar('Sesión finalizada por invitado'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){try{vozAbierta?.abort();}catch(_){}limpiarDemo();detenerVirtual();}});
  window.addEventListener('pagehide',()=>{try{vozAbierta?.abort();}catch(_){}limpiarDemo();detenerVirtual();});

  mostrarVista('control');
  mostrarUltimo('DETENER',new Date(),'INVITADO · VIRTUAL');
  pintarHistorial();
  actualizarBotones();
})();
