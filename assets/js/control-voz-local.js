"use strict";
/* EXCAVADORA-ARMO: voz local, reconocimiento de Chrome.
   No utiliza secretos en el navegador ni habilita control desde GitHub Pages.
   Micrófono solo al pulsar; cada orden requiere "excavadora".
*/
(() => {
  const modoLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  // El reconocimiento es visible en GitHub Pages; las ordenes fisicas
  // permanecen limitadas al puente local autenticado.
  const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
  const panelControl = document.querySelector('[aria-label="Control principal de la excavadora"]');
  if (!panelControl) return;

  const seccion = document.createElement('section');
  seccion.setAttribute('aria-label', 'Control por voz');
  seccion.style.cssText = 'margin:18px 0;padding:16px;border:1px solid #435674;border-radius:14px;background:#14243d;color:#fff';
  const titulo = document.createElement('h3');
  titulo.textContent = '🎤 Control por voz';
  titulo.style.cssText = 'font-size:1.15rem;color:#ffd21a;margin:0 0 12px';
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.textContent = '🎤 Hablar (una orden)';
  boton.style.cssText = 'padding:10px 16px;background:#ffd21a;color:#101827;border:0;border-radius:9px;font-weight:700;cursor:pointer';
  const detener = document.createElement('button');
  detener.type='button';
  detener.textContent = '⛔ DETENER';
  detener.style.cssText = 'margin-left:10px;padding:10px 16px;background:#a62748;color:#fff;border:0;border-radius:9px;font-weight:700;cursor:pointer';
  const estado = document.createElement('p');
  estado.setAttribute('role', 'status');
  estado.style.cssText='margin:12px 0 0;font-size:.95rem';
  const ejemplos=document.createElement('p');
  ejemplos.style.cssText='color:#bdcbe0;font-size:.88rem;margin:10px 0 0';
  ejemplos.textContent='Di: «Excavadora, avanza», «retrocede», «excava», «enciende luces» o «detente». Una orden por pulsación.';
  seccion.append(titulo,boton,detener,estado,ejemplos);
  if (modoLocal) {
    // Conservar exactamente la ubicacion anterior en localhost.
    panelControl.insertAdjacentElement('afterend', seccion);
  } else {
    // La pantalla publica NO tiene scroll: el panel fuera de la vista se oculta.
    // Anclar la voz dentro del bloque central, visible junto a Extras/DETENER.
    const extras = panelControl.querySelector('.bloque-extras-centro');
    if (extras) {
      extras.appendChild(seccion);
      seccion.style.cssText = 'box-sizing:border-box;width:100%;max-width:220px;margin:3px 0 0;padding:5px 6px;border:1px solid #435674;border-radius:8px;background:#14243d;color:#fff;text-align:center;flex:0 0 auto';
      titulo.style.cssText = 'font-size:11px;color:#ffd21a;margin:0 0 3px';
      boton.style.cssText = 'padding:5px 8px;background:#ffd21a;color:#101827;border:0;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;width:100%';
      estado.style.cssText = 'margin:3px 0 0;font-size:9px;line-height:1.15';
      ejemplos.style.display = 'none';
      detener.style.display = 'none'; // No insinuar parada fisica disponible sin autorizacion
    } else {
      panelControl.appendChild(seccion);
    }
  }
  if (!modoLocal) {
    boton.textContent='🎤 Reconocer voz';
    detener.disabled=true;
    detener.title='DETENER fisico no disponible desde esta pagina';
    detener.style.opacity='0.5';
    estado.textContent='Reconocimiento disponible · Control fisico remoto pendiente de autorizacion';
  }

  if (!Reconocimiento) {
    estado.textContent='Este navegador no ofrece reconocimiento de voz. Prueba Chrome con micrófono habilitado.';
    boton.disabled=true;
    return;
  }
  let escuchando=false;
  let procesando=false;
  let reconocimiento=null;
  const publicar = (mensaje,error=false) => {
    estado.textContent=mensaje;
    estado.style.color=error?'#ff9aa2':'#e9f4fc';
  };
  const normalizar = texto => texto.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
  const palabra = (t,exp) => exp.test(t);
  function interpretar(texto) {
    const t=normalizar(texto);
    // Exigir prefijo para evitar activaciones por frases incidentales.
    if (!/^excavadora\b/.test(t)) return null;
    const orden=t.replace(/^excavadora\b/,'').trim();
    if (palabra(orden,/\b(no|nunca|evita|cancelar|cancelado)\b/)) return null;
    if (palabra(orden,/\b(detente|detener|alto|para|parar|stop)\b/)) return 'DETENER';
    if (palabra(orden,/\b(retrocede|retroceder|atras)\b/)) return 'RETROCEDER';
    if (palabra(orden,/\b(avanza|avanzar|adelante)\b/)) return 'AVANZAR';
    if (palabra(orden,/\b(excava|excavar|baja la pala)\b/)) return 'EXCAVAR';
    if (palabra(orden,/\b(descarga|descargar|sube la pala)\b/)) return 'DESCARGAR_PALA';
    if (palabra(orden,/\b(musica|sonido)\b/)) return 'MUSICA';
    if (palabra(orden,/\b(velocidad|rapido|lento)\b/)) return 'CAMBIAR_VELOCIDAD';
    if (palabra(orden,/\b(luz|luces|foco|faros)\b/)) return 'LUZ_LED';
    if (palabra(orden,/\b(izquierda|derecha)\b/)) {
      const izquierda=palabra(orden,/\bizquierda\b/);
      // El usuario debe indicar si gira la plataforma/direccion o el vehiculo/brazo.
      if (palabra(orden,/\b(brazo|vehiculo|orugas)\b/)) {
        return izquierda?'GIRAR_VEHICULO_IZQUIERDA':'GIRAR_VEHICULO_DERECHA';
      }
      if (palabra(orden,/\b(gira|girar|direccion|plataforma)\b/)) {
        return izquierda?'GIRAR_IZQUIERDA':'GIRAR_DERECHA';
      }
    }
    return null;
  }
  function control() { return window.ARMOControlVoz; }
  boton.addEventListener('click',()=>{
    if (escuchando || procesando) return;
    if (modoLocal && !control()) { publicar('Puente local no autorizado. Inicia servidor_control_local.py.',true);return; }
    const r=new Reconocimiento();
    reconocimiento=r;
    r.lang='es-MX';r.continuous=false;r.interimResults=false;r.maxAlternatives=1;
    r.onstart=()=>{escuchando=true;boton.disabled=true;publicar('Escuchando... di «Excavadora» y tu orden.');};
    r.onerror=e=>{publicar('Micrófono: '+e.error+'. Sin movimiento enviado.',true);};
    r.onresult=async e=>{
      if (procesando) return;
      procesando=true;
      const frase=e.results?.[0]?.[0]?.transcript||'';
      const orden=interpretar(frase);
      if (!orden) {publicar('No se reconoció una orden válida: «'+frase+'». Sin movimiento.',true);procesando=false;return;}
      publicar('Reconocido: «'+frase+'» → '+orden);
      try {
        if (!control()) throw new Error('Control no disponible');
        const resultado = await control().ejecutar(orden);
        publicar(modoLocal
          ? 'Orden enviada: '+orden+' · Finalizada con DETENER'
          : (resultado?.ejecutado === true
              ? 'AWS reporta ejecución de '+orden+' · Comprueba DETENER'
              : 'AWS validó '+orden+' · Sin movimiento físico'));
      } catch(err) {publicar('Error de control: '+err.message,true);}
      finally {procesando=false;}
    };
    r.onend=()=>{escuchando=false;boton.disabled=false;};
    try {r.start();}catch(err){publicar('No se pudo abrir el micrófono: '+err.message,true);boton.disabled=false;}
  });
  detener.addEventListener('click',async()=>{
    if (!modoLocal) { publicar('DETENER fisico no disponible: control remoto sin autorizar',true); return; }
    try {reconocimiento?.abort();}catch{}
    if (!control()) {publicar('Puente local no autorizado.',true);return;}
    try {await control().ejecutar('DETENER');publicar('DETENER enviado');}
    catch(err){publicar('No se confirmó DETENER: '+err.message,true);}
  });
})();
