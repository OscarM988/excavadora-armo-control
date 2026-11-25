"use strict";
/* Inicio por rol: el backend confirma la identidad en rutas separadas existentes.
 * Transferencia temporal de JWT entre páginas (se consume una sola vez).
 * No guardar en localStorage ni colocar tokens en URL.
 */
(() => {
  const API = "https://vehiculo-iot.duckdns.org/v43";
  const KEY = "armo:acceso-43-handoff";
  const KEY_CLIENTE = "armo:cliente-sesion-43";
  const $ = id => document.getElementById(id);
  const form = $("formAcceso"), boton = $("btnAcceso"), status = $("mensajeAcceso");
  if (!form) return;
  try { sessionStorage.removeItem(KEY); sessionStorage.removeItem(KEY_CLIENTE); } catch (_) {}
  try {
    const aviso = sessionStorage.getItem("armo:acceso-43-aviso");
    if (aviso) { status.textContent = aviso; sessionStorage.removeItem("armo:acceso-43-aviso"); }
  } catch (_) {}

  async function peticion(ruta, opciones = {}) {
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), 12000);
    try {
      const respuesta = await fetch(API + ruta, {cache:"no-store", ...opciones, signal:controlador.signal});
      let datos = null;
      try { datos = await respuesta.json(); } catch (_) {}
      return { codigo: respuesta.status, ok:respuesta.ok, datos };
    } finally { clearTimeout(limite); }
  }
  async function autenticar(ruta, correo, password) {
    return peticion(ruta, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({correo,password})
    });
  }
  async function validar(ruta, jwt) {
    const r = await peticion(ruta, {headers:{Authorization:"Bearer " + jwt}});
    if (!r.ok) throw new Error("La sesión no obtuvo permisos válidos (HTTP " + r.codigo + ").");
  }
  // Actualización PWA; no intercepta solicitudes a AWS.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }
  form.addEventListener("submit", async evento => {
    evento.preventDefault();
    boton.disabled = true;
    status.textContent = "Comprobando cuenta...";
    const correo = $("correo").value.trim().toLowerCase();
    const password = $("password").value;
    try {
      // El rol nunca lo decide el navegador: cada endpoint firma un JWT de su alcance.
      // Ante 401/403 del endpoint admin se prueba el comprador; otros fallos detienen el flujo.
      let respuesta = await autenticar("/admin/auth/login", correo, password);
      let rol = "administrador";
      if (respuesta.codigo === 401 || respuesta.codigo === 403) {
        respuesta = await autenticar("/usuario/auth/login", correo, password);
        rol = "comprador";
      }
      if (!respuesta.ok || typeof respuesta.datos?.access_token !== "string") {
        if (respuesta.codigo === 429) throw new Error("Demasiados intentos. Intenta más tarde.");
        if (respuesta.codigo === 401 || respuesta.codigo === 403) throw new Error("Correo o contraseña incorrectos, o cuenta inactiva.");
        throw new Error("No fue posible autenticar (HTTP " + respuesta.codigo + ").");
      }
      const jwt = respuesta.datos.access_token;
      if (rol === "administrador") {
        await validar("/admin/clientes", jwt);
      } else {
        await validar("/usuario/mis-vehiculos", jwt);
      }
      // El Control original tiene una API de comprador separada (raíz).
      // Se solicita un segundo JWT al iniciar sesión, sin almacenar contraseña.
      // Si esta API no autoriza, el comprador podrá monitorear, pero NO mover
      // el vehículo físicamente desde el Control original.
      let jwtControl = null;
      if (rol === "comprador") {
        try {
          const raiz = "https://vehiculo-iot.duckdns.org";
          const r = await fetch(raiz + "/usuario/auth/login", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({correo, password}), cache:"no-store"
          });
          if (r.ok) {
            const d = await r.json();
            if (typeof d.access_token === "string") {
              const verificar = await fetch(raiz + "/usuario/mis-vehiculos", {
                headers: {Authorization:"Bearer " + d.access_token}, cache:"no-store"
              });
              if (verificar.ok && Array.isArray(await verificar.json())) jwtControl = d.access_token;
            }
          }
        } catch (_) { /* Sin autorización física, no bloquea el monitoreo. */ }
      }
      // Solo para cruzar al módulo correspondiente: expiración y consumo únicos.
      sessionStorage.setItem(KEY, JSON.stringify({ rol, jwt, jwtControl, vence: Date.now() + 30000 }));
      $("password").value = "";
      location.replace(rol === "administrador" ? "administracion.html" : "comprador.html");
    } catch (error) {
      status.textContent = error.name === "AbortError" ? "La API no respondió a tiempo." : (error.message || "Error de conexión.");
      $("password").value = "";
    } finally { boton.disabled = false; }
  });
})();
