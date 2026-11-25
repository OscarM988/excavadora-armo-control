"use strict";
/* Demostración SIN hardware ni endpoints de movimiento.
 * El invitado nunca recibe un JWT de comprador o administrador.
 */
(() => {
 const $ = id => document.getElementById(id);
 const API="https://vehiculo-iot.duckdns.org/v43";
 const DURACION=60000;
 const secuencia=["AVANZAR","DETENER","GIRAR_IZQUIERDA","DETENER","EXCAVAR","DETENER","DESCARGAR_PALA","DETENER","RETROCEDER","DETENER"];
 let modelo="EXCAVADORA-ARMO", hasta=0, intervalo=null, pausaMovimiento=null, demoIntervalo=null;
 let historia=[], ultimo="DETENER";
 function pestaña(nombre) {
  document.querySelectorAll(".vista").forEach(e=>{e.hidden=e.id!==nombre;});
  document.querySelectorAll("[data-pestana]").forEach(b=>{const on=b.dataset.pestana===nombre;b.classList.toggle("activo",on);if(on)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});
 }
 for(const b of document.querySelectorAll("[data-pestana]"))b.addEventListener("click",()=>pestaña(b.dataset.pestana));
 function activa(){return hasta>Date.now();}
 function estado() {
  const restante=Math.max(0,hasta-Date.now());
  $("tiempoSesion").textContent="Tiempo disponible: "+Math.ceil(restante/1000)+" s";
  const s=activa()?"Invitado activo · demo virtual":"Sin sesión";
  $("sesionEstado").textContent=s;$("monitorSesion").textContent=s;
  document.querySelectorAll(".mando").forEach(b=>b.disabled=!activa());
  $("demoAutomatica").disabled=!activa();
  $("comenzarSesion").disabled=activa();
  if(hasta && !activa()) finalizar("Tiempo de demostración terminado.");
 }
 function guardar(nombre,origen="INVITADO / DEMO") {
  ultimo=nombre;
  const fecha=new Date();
  $("movimientoActual").textContent=nombre;
  $("monitorMovimiento").textContent=nombre;
  $("monitorFecha").textContent="Último movimiento virtual: "+fecha.toLocaleString("es-MX");
  historia.unshift({hora:fecha.toLocaleTimeString("es-MX"),nombre,origen});
  historia=historia.slice(0,10);
  $("monitorHistorial").replaceChildren();
  for(const item of historia){
    const tr=document.createElement("tr");
    for(const s of [item.hora,item.nombre,item.origen]){const td=document.createElement("td");td.textContent=s;tr.appendChild(td);}
    $("monitorHistorial").appendChild(tr);
  }
 }
 function detenerMovimiento() {
  if(pausaMovimiento!==null){clearTimeout(pausaMovimiento);pausaMovimiento=null;}
  if(ultimo!=="DETENER")guardar("DETENER","PARO VIRTUAL");
 }
 function detenerDemo() {
  if(demoIntervalo!==null){clearInterval(demoIntervalo);demoIntervalo=null;}
  $("progresoDemo").style.width="0%";
 }
 function finalizar(mensaje="Sesión terminada. No se envió ningún movimiento físico.") {
  detenerDemo();detenerMovimiento();hasta=0;
  if(intervalo!==null){clearInterval(intervalo);intervalo=null;}
  $("mensajeControl").textContent=mensaje;
  estado();
 }
 function comenzar() {
  finalizar("Preparando sesión virtual...");
  hasta=Date.now()+DURACION;historia=[];$("monitorHistorial").replaceChildren();
  guardar("DETENER","INICIO DEMO");
  $("mensajeControl").textContent="Sesión virtual de 60 segundos iniciada. Pulsa un joystick o usa la demostración automática.";
  intervalo=setInterval(estado,150);estado();pestaña("control");
 }
 function movimiento(nombre) {
  if(!activa()){estado();return;}
  detenerDemo();detenerMovimiento();
  if(nombre==="DETENER")return;
  guardar(nombre);
  // Sin hardware: los comandos virtuales se detienen automáticamente en 700 ms.
  pausaMovimiento=setTimeout(()=>{pausaMovimiento=null;detenerMovimiento();},700);
 }
 async function catalogo(){
  const lista=$("listaModelos");
  try{
   const controller=new AbortController();const t=setTimeout(()=>controller.abort(),8500);
   let r;
   try{r=await fetch(API+"/invitado/catalogo",{cache:"no-store",signal:controller.signal});}finally{clearTimeout(t);}
   if(!r.ok)throw new Error("HTTP "+r.status);
   const datos=await r.json();
   if(!Array.isArray(datos.modelos))throw new Error("Catálogo inválido");
   lista.replaceChildren();
   if(!datos.modelos.length){$("mensajeCatalogo").textContent="No hay modelos disponibles.";}
   for(const item of datos.modelos){
     const card=document.createElement("article");card.className="modelo";
     const h=document.createElement("h3");h.textContent=item.nombre||"Vehículo IoT";
     const p=document.createElement("p");p.textContent=(item.descripcion||"Modelo comercial")+" · "+(item.codigo||"");
     const btn=document.createElement("button");btn.type="button";btn.textContent="Probar este modelo";
     btn.addEventListener("click",()=>{modelo=item.nombre||"Vehículo IoT";$("modeloDemo").textContent="Modelo: "+modelo+" (simulación)";pestaña("control");});
     card.append(h,p,btn);lista.appendChild(card);
   }
  }catch(_){
    $("mensajeCatalogo").textContent="El catálogo remoto no está disponible. La simulación de muestra sigue accesible.";
    lista.replaceChildren();
  }
  const fallback=document.createElement("button");fallback.type="button";fallback.textContent="Probar EXCAVADORA-ARMO virtual";
  fallback.addEventListener("click",()=>{modelo="EXCAVADORA-ARMO";$("modeloDemo").textContent="Modelo: EXCAVADORA-ARMO (simulación)";pestaña("control");});
  lista.appendChild(fallback);
 }
 $("comenzarSesion").addEventListener("click",comenzar);
 $("finalizarSesion").addEventListener("click",()=>finalizar());
 $("detenerDemo").addEventListener("click",()=>{detenerDemo();detenerMovimiento();$("mensajeControl").textContent="DETENER: demostración detenida.";});
 for(const b of document.querySelectorAll("[data-orden]")){
  b.addEventListener("click",()=>movimiento(b.dataset.orden));
 }
 $("demoAutomatica").addEventListener("click",()=>{
  if(!activa())return;
  detenerDemo();detenerMovimiento();
  const inicio=Date.now(), duracion=Math.min(20000,hasta-Date.now());let paso=-1;
  $("mensajeControl").textContent="Secuencia de demostración virtual activa.";
  demoIntervalo=setInterval(()=>{
    if(!activa()){finalizar("Sesión de demostración finalizada.");return;}
    const transcurrido=Date.now()-inicio;
    if(transcurrido>=duracion){detenerDemo();detenerMovimiento();$("mensajeControl").textContent="Demostración virtual finalizada.";return;}
    const i=Math.min(secuencia.length-1,Math.floor(transcurrido/(duracion/secuencia.length)));
    $("progresoDemo").style.width=(100*transcurrido/duracion).toFixed(0)+"%";
    if(i!==paso){paso=i;detenerMovimiento();if(secuencia[i]!=="DETENER")guardar(secuencia[i],"DEMO AUTOMÁTICA");}
  },120);
 });
 document.addEventListener("visibilitychange",()=>{if(document.hidden){detenerDemo();detenerMovimiento();}});
 window.addEventListener("pagehide",()=>{detenerDemo();detenerMovimiento();});
 estado();catalogo();
})();
