
"use strict";

/*
 * EXCAVADORA-ARMO
 * Practica 4.2 - Indicadores de Extras
 *
 * Muestra el estado visual de:
 * - MUSICA
 * - CAMBIAR_VELOCIDAD
 * - LUZ_LED
 * - DEMO
 *
 * No envia movimientos REST.
 * No crea otra conexion WebSocket.
 * No modifica los joysticks.
 */

(() => {
    const NOMBRES = [
        "MUSICA",
        "CAMBIAR_VELOCIDAD",
        "LUZ_LED",
        "DEMO"
    ];

    const ETIQUETAS = {
        MUSICA: "Música",
        CAMBIAR_VELOCIDAD: "Velocidad",
        LUZ_LED: "Luces",
        DEMO: "DEMO"
    };

    const COLORES = {
        neutro: "#94a3b8",
        enviando: "#facc15",
        aceptado: "#34d399",
        apagado: "#94a3b8",
        error: "#fb7185",
        demo: "#60a5fa"
    };

    const estados = new Map(
        NOMBRES.map(nombre => [
            nombre,
            {
                estimado: null,
                cambios: 0,
                mensaje: "Estado físico desconocido",
                color: "neutro"
            }
        ])
    );

    const botones = new Map();

    let aviso = null;
    let resumen = null;
    let temporizador = null;

    function normalizar(texto) {
        return String(texto ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toUpperCase();
    }

    function dibujar(nombre) {
        const boton = botones.get(nombre);
        const estado = estados.get(nombre);

        if (!boton || !estado) return;

        const punto = boton.querySelector(
            ".arm-punto-extra"
        );

        if (punto) {
            punto.style.backgroundColor =
                COLORES[estado.color];
        }

        boton.dataset.indicadorExtra = estado.color;

        boton.title =
            `${ETIQUETAS[nombre]}: ${estado.mensaje}`;

        actualizarResumen();
    }

    function actualizarResumen() {
        if (!resumen) return;

        const musica = estados.get("MUSICA");
        const luces = estados.get("LUZ_LED");
        const velocidad = estados.get(
            "CAMBIAR_VELOCIDAD"
        );

        resumen.textContent =
            `Música: ${musica.cambios} orden(es) · ` +
            `Luces: ${luces.cambios} orden(es) · ` +
            `Velocidad: ${velocidad.cambios} cambio(s)`;

        resumen.title =
            "Se muestran órdenes aceptadas por API, no estados físicos. " +
            "El ESP8266 no confirma si Música o Luces están encendidas.";
    }

    function mostrarAviso(
        mensaje,
        color = "neutro",
        duracion = 4500
    ) {
        if (!aviso) return;

        aviso.textContent = mensaje;
        aviso.style.borderColor = COLORES[color];

        aviso.classList.add(
            "arm-aviso-visible"
        );

        clearTimeout(temporizador);

        temporizador = setTimeout(() => {
            aviso.classList.remove(
                "arm-aviso-visible"
            );
        }, duracion);
    }

    function actualizar(
        nombre,
        mensaje,
        color,
        anunciar = true
    ) {
        const estado = estados.get(nombre);

        if (!estado) return;

        estado.mensaje = mensaje;
        estado.color = color;

        dibujar(nombre);

        if (anunciar) {
            mostrarAviso(
                `${ETIQUETAS[nombre]}: ${mensaje}`,
                color
            );
        }
    }

    function procesarResultadoAPI(evento) {
        if (
            !evento ||
            typeof evento !== "object"
        ) {
            return;
        }

        const nombre = normalizar(
            evento.nombre
        );

        const etapa = normalizar(
            evento.etapa
        );

        if (!botones.has(nombre)) return;

        if (nombre === "DEMO") return;

        if (etapa === "SOLICITADO") {
            actualizar(
                nombre,
                "Enviando orden...",
                "enviando"
            );

            return;
        }

        if (etapa === "ACEPTADO_POR_API") {
            const estado = estados.get(nombre);

            estado.cambios++;

            if (
                nombre === "MUSICA" ||
                nombre === "LUZ_LED"
            ) {
                // La API acepta un comando, pero no confirma ON/OFF físico.
                // No invertir ni suponer el estado de Música o Luces.
                estado.estimado = null;
                actualizar(
                    nombre,
                    `Orden ${estado.cambios} aceptada (estado físico no confirmado)`,
                    "aceptado"
                );
            } else {
                actualizar(
                    nombre,
                    `Cambio ${estado.cambios} aceptado por API (nivel desconocido)`,
                    "aceptado"
                );
            }

            return;
        }

        if (etapa === "ERROR") {
            actualizar(
                nombre,
                `Error: ${String(
                    evento.mensaje ?? "Orden fallida"
                )}`,
                "error"
            );
        }
    }

    function procesarEventoWS(datos) {
        if (
            !datos ||
            typeof datos !== "object"
        ) {
            return;
        }

        const tipo = normalizar(
            datos.tipo
        );

        if (
            tipo === "DEMO_INICIADO" ||
            tipo === "DEMO_MOVIMIENTO"
        ) {
            actualizar(
                "DEMO",
                "En ejecución (evento WSS)",
                "enviando",
                tipo === "DEMO_INICIADO"
            );

        } else if (
            /^DEMO_(FINALIZAD|TERMINAD|COMPLETAD)/
                .test(tipo)
        ) {
            actualizar(
                "DEMO",
                "Finalizada (evento WSS)",
                "aceptado"
            );

        } else if (
            /^DEMO_CANCELAD/.test(tipo)
        ) {
            actualizar(
                "DEMO",
                "Cancelada (evento WSS)",
                "apagado"
            );

        } else if (
            /^DEMO_ERROR/.test(tipo)
        ) {
            actualizar(
                "DEMO",
                "Error reportado por WSS",
                "error"
            );
        }
    }

    function crearInterfaz() {
        const nodos = [
            ...document.querySelectorAll(
                ".extras-mini-grid .btn-extra-mini"
            )
        ];

        if (nodos.length !== 4) {
            console.warn(
                "No se encontraron los cuatro botones Extras."
            );

            return;
        }

        const estilos = document.createElement(
            "style"
        );

        estilos.id = "arm-estilos-extras";

        estilos.textContent = `
            #pantallaControl .extras-mini-grid
            .btn-extra-mini {
                position: relative;
            }

            #pantallaControl .arm-punto-extra {
                position: absolute;
                top: 4px;
                right: 4px;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                border: 1px solid white;
                pointer-events: none;
            }

            #pantallaControl .arm-resumen-extras {
                margin: 0;
                padding: 2px;
                color: #cbd5e1;
                text-align: center;
                font-size: clamp(
                    9px,
                    1vw,
                    11px
                );
                line-height: 1.2;
            }

            #arm-aviso-extras {
                position: fixed;
                left: 50%;
                bottom: max(
                    16px,
                    env(safe-area-inset-bottom)
                );

                transform:
                    translate(-50%, 12px);

                z-index: 9999;

                width: max-content;
                max-width: min(
                    92vw,
                    540px
                );

                padding: 11px 15px;

                background: #0f1d34;
                color: #f8fafc;

                border: 2px solid #94a3b8;
                border-radius: 12px;

                text-align: center;

                font:
                    600 13px/1.4
                    system-ui,
                    sans-serif;

                overflow-wrap: anywhere;

                opacity: 0;
                pointer-events: none;

                transition:
                    opacity .15s,
                    transform .15s;
            }

            #arm-aviso-extras.arm-aviso-visible {
                opacity: 1;

                transform:
                    translate(-50%, 0);
            }

            @media (max-width: 600px) {
                #arm-aviso-extras {
                    font-size: 11px;
                    padding: 9px 11px;
                }

                #pantallaControl .arm-punto-extra {
                    width: 8px;
                    height: 8px;
                }
            }
        `;

        document.head.appendChild(estilos);

        aviso = document.createElement("div");

        aviso.id = "arm-aviso-extras";

        aviso.setAttribute(
            "role",
            "status"
        );

        aviso.setAttribute(
            "aria-live",
            "polite"
        );

        document.body.appendChild(aviso);

        nodos.forEach((boton, i) => {
            const nombre = NOMBRES[i];

            botones.set(nombre, boton);

            const punto =
                document.createElement("i");

            punto.className =
                "arm-punto-extra";

            punto.setAttribute(
                "aria-hidden",
                "true"
            );

            boton.appendChild(punto);

            if (nombre === "DEMO") {
                boton.addEventListener(
                    "click",
                    () => {
                        actualizar(
                            "DEMO",
                            "Ejecución física bloqueada hasta validar parada y cancelación",
                            "error"
                        );
                    }
                );
            }

            dibujar(nombre);
        });

        resumen = document.createElement("p");

        resumen.className =
            "arm-resumen-extras";

        const cuadricula =
            document.querySelector(
                ".extras-mini-grid"
            );

        cuadricula.insertAdjacentElement(
            "afterend",
            resumen
        );

        actualizarResumen();

        window.addEventListener(
            "armo:control-api-evento",
            evento => {
                procesarResultadoAPI(
                    evento.detail
                );
            }
        );

        window.addEventListener(
            "armo:ws-evento",
            evento => {
                procesarEventoWS(
                    evento.detail
                );
            }
        );

        console.info(
            "Indicadores Extras preparados."
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            crearInterfaz,
            { once: true }
        );
    } else {
        crearInterfaz();
    }
})();
