
"use strict";

/*
 * EXCAVADORA-ARMO
 * Practica 4.2 - CONTROL + MONITOREO
 *
 * Service Worker PWA.
 * Cache de archivos estaticos.
 * La API AWS y el WebSocket no se interceptan.
 */

const CACHE = "armoiot-pwa-v5";

const ARCHIVOS = [
    "./",
    "./index.html",
    "./styles.css",
    "./acabados.css",
    "./monitoreo.css",
    "./app.js",
    "./manifest.json",
    "./assets/favicon.svg",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./js/api-client.js",
    "./js/control-service.js",
    "./js/rds-status.js",
    "./js/monitoreo-service.js",
    "./js/monitoreo.js"
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
