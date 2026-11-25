"use strict";
/* Evita mostrar las vistas privadas sin JWT verificado por FastAPI.
 * El servidor, y NO este script, aplica los permisos definitivos.
 */
(() => {
  const ruta = location.pathname.split("/").pop();
  const rol = ruta === "administracion.html" ? "administrador" : ruta === "comprador.html" ? "comprador" : null;
  if (!rol) return;
  document.documentElement.style.visibility = "hidden";
  const KEY = "armo:acceso-43-handoff";
  let acceso = null;
  try { acceso = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (_) {}
  // Volver desde Control original conserva la sesión del comprador.
  if (rol === "comprador" && (!acceso || acceso.rol !== "comprador")) {
    try {
      const guardada = JSON.parse(sessionStorage.getItem("armo:cliente-sesion-43") || "null");
      if (guardada?.jwt && guardada.vence > Date.now()) {
        acceso = {rol:"comprador", jwt:guardada.jwt, vence:guardada.vence};
      }
    } catch (_) {}
  }
  const volver = () => {
    try { sessionStorage.removeItem(KEY); } catch (_) {}
    location.replace("index.html");
  };
  if (!acceso || acceso.rol !== rol || !acceso.jwt || Date.now() > acceso.vence) { volver(); return; }
  const rutaValidacion = rol === "administrador" ? "/admin/clientes" : "/usuario/mis-vehiculos";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  fetch("https://vehiculo-iot.duckdns.org/v43" + rutaValidacion, {
    headers:{Authorization:"Bearer " + acceso.jwt}, cache:"no-store", signal:controller.signal
  }).then(r => {if (!r.ok) throw new Error("JWT no autorizado"); document.documentElement.style.visibility="visible";})
    .catch(volver).finally(() => clearTimeout(timer));
})();
