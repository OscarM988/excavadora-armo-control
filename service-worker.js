
"use strict";

/*
 * EXCAVADORA-ARMO
 * Practica 4.2 - CONTROL + MONITOREO
 *
 * Service Worker PWA.
 * Cache de archivos estaticos.
 * La API AWS y el WebSocket no se interceptan.
 */

const CACHE = "armoiot-pwa-v17-invitado-control-original";

const ARCHIVOS = [
    "./css/armo-invitado-original-43.css",
    "./assets/js/armo-invitado-original-43.js",
    "./",
    "./index.html",
    "./control.html",
    "./portal-43.html",
    "./css/acceso-43.css",
    "./assets/js/armo-guard-43.js",
    "./assets/js/armo-cliente-guard-43.js",
    "./assets/js/armo-acceso-43.js",
    "./assets/js/armo-invitado-demo-43.js",
    "./administracion.html",
    "./comprador.html",
    "./editor-demos.html",
    "./invitado.html",
    "./css/acabados.css",
    "./css/admin-clientes.css",
    "./css/admin-nav.css",
    "./css/administracion-extras.css",
    "./css/administracion.css",
    "./css/armo-admin-sin-scroll.css",
    "./css/armo-creditos-layout.css",
    "./css/armo-pantalla-fija.css",
    "./css/armo-control-monitoreo-v4.css",
    "./css/armo-control-central-v5.css",
    "./css/armo-responsive-final.css",
    "./css/creditos-diseno-43.css",
    "./css/monitoreo.css",
    "./css/styles.css",
    "./assets/js/app.js",
    "./assets/js/admin-clientes.js",
    "./assets/js/admin-integracion.js",
    "./assets/js/admin-inventario.js",
    "./assets/js/admin-nav.js",
    "./assets/js/administracion.js",
    "./assets/js/api-client.js",
    "./assets/js/armo-layout-fijo.js",
    "./assets/js/armo-control-central-v5.js",
    "./assets/js/comprador-demos.js",
    "./assets/js/comprador-simulacion.js",
    "./assets/js/comprador-wss.js",
    "./assets/js/control-fisico-local.js",
    "./assets/js/control-service.js",
    "./assets/js/control-voz-local.js",
    "./assets/js/control-remoto-comprador.js",
    "./assets/js/creditos-diseno-43.js",
    "./assets/js/estado-extras.js",
    "./assets/js/estado-extras-v8.js",
    "./assets/js/estado-extras-v9.js",
    "./assets/js/monitoreo-service.js",
    "./assets/js/monitoreo.js",
    "./assets/js/navegacion-43.js",
    "./assets/js/rds-status.js",
    "./manifest.json",
    "./assets/favicon.svg",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
];

/* ==========================================
   INSTALACION
   ========================================== */

self.addEventListener("install", evento => {
    evento.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(ARCHIVOS))
            .then(() => self.skipWaiting())
    );
});

/* ==========================================
   ACTIVACION
   ========================================== */

self.addEventListener("activate", evento => {
    evento.waitUntil(
        caches.keys()
            .then(claves =>
                Promise.all(
                    claves
                        .filter(clave =>
                            clave.startsWith("armoiot-pwa-") &&
                            clave !== CACHE
                        )
                        .map(clave => caches.delete(clave))
                )
            )
            .then(() => self.clients.claim())
    );
});

/* ==========================================
   CONSULTAS
   ========================================== */

self.addEventListener("fetch", evento => {
    const url = new URL(evento.request.url);

    // Nunca interceptar:
    // - Consultas REST a AWS
    // - Autenticacion
    // - Conexiones externas
    // - Solicitudes POST/PUT/DELETE
    if (
        evento.request.method !== "GET" ||
        url.origin !== self.location.origin
    ) {
        return;
    }

    // Red primero, cache como respaldo.
    evento.respondWith(
        fetch(evento.request)
            .then(async respuesta => {
                if (respuesta.ok) {
                    const cache = await caches.open(CACHE);

                    await cache.put(
                        evento.request,
                        respuesta.clone()
                    );
                }

                return respuesta;
            })
            .catch(async () =>
                (await caches.match(evento.request)) ||
                Response.error()
            )
    );
});
