"use strict";

const CACHE = "armoiot-pwa-v4";

const ARCHIVOS = [
    "./",
    "./index.html",
    "./styles.css",
    "./acabados.css",
    "./app.js",
    "./manifest.json",
    "./assets/favicon.svg",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./js/api-client.js",
    "./js/control-service.js"
];

self.addEventListener("install", evento => {
    evento.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(ARCHIVOS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", evento => {
    evento.waitUntil(
        caches.keys().then(claves =>
            Promise.all(
                claves
                    .filter(clave =>
                        clave.startsWith("armoiot-pwa-") &&
                        clave !== CACHE
                    )
                    .map(clave => caches.delete(clave))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", evento => {
    const url = new URL(evento.request.url);

    // Nunca interceptar AWS, autenticacion ni WebSocket.
    if (
        evento.request.method !== "GET" ||
        url.origin !== self.location.origin
    ) {
        return;
    }

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
