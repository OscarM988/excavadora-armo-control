"use strict";

/*
 * EXCAVADORA-ARMO
 * Diagnostico Amazon RDS mediante FastAPI.
 *
 * Solo realiza consultas GET.
 * No envia comandos ni modifica MySQL.
 */

(() => {
    const API =
        "https://vehiculo-iot.duckdns.org";

    const INTERVALO = 30000;

    const panel =
        document.getElementById("pantallaControl");

    const estado =
        document.getElementById("estadoRDS");

    if (!panel || !estado) return;

    let verificando = false;
    let version = 0;

    function sesionVisible() {
        return !panel.classList.contains("oculto");
    }

    function mostrar(texto, color, detalle = "") {
        estado.textContent = texto;
        estado.style.color = color;
        estado.title = detalle;
    }

    async function verificarRDS() {
        if (!sesionVisible() || verificando) {
            return;
        }

        verificando = true;

        const actual = ++version;
        const controlador = new AbortController();

        const timeout = setTimeout(() => {
            controlador.abort();
        }, 8000);

        mostrar("Comprobando", "#facc15");

        try {
            const respuesta = await fetch(
                `${API}/comandos/vehiculo/1`,
                {
                    method: "GET",
                    cache: "no-store",
                    signal: controlador.signal
                }
            );

            if (!respuesta.ok) {
                throw new Error(
                    `HTTP ${respuesta.status}`
                );
            }

            const datos = await respuesta.json();

            const lista = Array.isArray(datos)
                ? datos
                : datos?.value;

            if (!Array.isArray(lista)) {
                throw new Error(
                    "Respuesta de base de datos no valida"
                );
            }

            if (
                actual !== version ||
                !sesionVisible()
            ) {
                return;
            }

            mostrar(
                "Disponible",
                "#22c55e",
                "Consulta MySQL realizada correctamente " +
                "a traves de FastAPI."
            );

        } catch (error) {
            if (
                actual !== version ||
                !sesionVisible()
            ) {
                return;
            }

            if (!navigator.onLine) {
                mostrar(
                    "Sin conexión",
                    "#f87171",
                    "El navegador no tiene Internet."
                );

            } else if (
                error.name === "AbortError" ||
                error instanceof TypeError
            ) {
                mostrar(
                    "Sin verificar",
                    "#cbd5e1",
                    "No se pudo alcanzar la API."
                );

            } else {
                mostrar(
                    "Consulta fallida",
                    "#f87171",
                    "La API no pudo completar " +
                    "la consulta: " + error.message
                );
            }

        } finally {
            clearTimeout(timeout);
            verificando = false;
        }
    }

    // Primera comprobacion al iniciar sesion.
    const observador = new MutationObserver(() => {
        if (sesionVisible()) {
            void verificarRDS();
        } else {
            version++;

            mostrar(
                "Sin verificar",
                "#cbd5e1"
            );
        }
    });

    observador.observe(panel, {
        attributes: true,
        attributeFilter: ["class"]
    });

    // Comprobar periodicamente.
    setInterval(() => {
        if (
            sesionVisible() &&
            !document.hidden
        ) {
            void verificarRDS();
        }
    }, INTERVALO);

    window.addEventListener("online", () => {
        void verificarRDS();
    });

    document.addEventListener(
        "visibilitychange",
        () => {
            if (!document.hidden) {
                void verificarRDS();
            }
        }
    );

    if (sesionVisible()) {
        void verificarRDS();
    }
})();