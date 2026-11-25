"use strict";
/* CONTROL ORIGINAL para el comprador. Solo se presenta a cuentas con
 * asignacion de la unidad 1, verificada en FastAPI v43. Los endpoints del
 * servidor deben seguir aplicando permisos propios por recurso (401/403).
 * JAMAS habilita el puente local sin autenticacion.
 */
(() => {
  document.documentElement.style.visibility = "hidden";
  const API = "https://vehiculo-iot.duckdns.org/v43";
  const KEY = "armo:cliente-sesion-43";
  let s = null;
  try { s = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (_) {}
  function salir(mensaje) {
    try { sessionStorage.removeItem(KEY); sessionStorage.setItem("armo:acceso-43-aviso", mensaje); } catch (_) {}
    location.replace("index.html");
  }
  if (!s || !s.jwt || !Number.isFinite(s.vence) || s.vence < Date.now()) {
    salir("Debes iniciar sesión como cliente."); return;
  }
  const controlador = new AbortController();
  const espera = setTimeout(() => controlador.abort(), 12000);
  fetch(API + "/usuario/mis-vehiculos", {
    headers: { Authorization: "Bearer " + s.jwt },
    cache: "no-store", signal: controlador.signal
  }).then(async respuesta => {
    if (!respuesta.ok) throw new Error("Sesión no autorizada");
    const unidades = await respuesta.json();
    if (!Array.isArray(unidades) || !unidades.some(u => Number(u.id_vehiculo) === 1)) {
      throw new Error("Esta cuenta no tiene asignada EXCAVADORA-ARMO (unidad 1)");
    }
    // No se debe habilitar ningún control físico aquí: solo el backend
    // autenticado decide mediante sus rutas /usuario/vehiculos/{id}/...
    document.documentElement.style.visibility = "visible";
    window.dispatchEvent(new Event("armo:cliente-validado"));
  }).catch(e => salir(e.message || "No se pudo validar tu acceso."))
    .finally(() => clearTimeout(espera));

  document.addEventListener("DOMContentLoaded", () => {
    const barra = document.createElement("div");
    barra.id = "armo-cliente-barra";
    barra.style.cssText = "display:flex;justify-content:center;align-items:center;gap:12px;flex-wrap:wrap;padding:9px;background:#172338;color:#fff;border-bottom:2px solid #facc15;font:700 13px Arial;position:relative;z-index:90";
    barra.innerHTML = '<span>CLIENTE · EXCAVADORA-ARMO</span><a href="comprador.html" style="color:#facc15">MIS VEHÍCULOS</a><button type="button" id="armo-cliente-salir" style="background:#475569;color:white;border:0;border-radius:8px;padding:8px 12px;cursor:pointer">CERRAR SESIÓN</button>';
    document.body.prepend(barra);
    document.getElementById("armo-cliente-salir")?.addEventListener("click", () => {
      try { sessionStorage.removeItem(KEY); } catch (_) {}
      location.replace("index.html");
    });
  });
})();
