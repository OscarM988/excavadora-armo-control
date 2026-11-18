
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
                mensaje: "Sin confirmar; el indicador visual inicia sin referencia física",
                color: "neutro"
            }
        ])
    );

    const botones = new Map();
    let resumenTexto = null;

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

        // El pulsador del juguete alterna su función; el indicador visual
        // no representa una lectura eléctrica del ESP8266.
        if (nombre === "MUSICA" || nombre === "LUZ_LED") {
            boton.setAttribute(
                "aria-pressed",
                estado.estimado === null ? "false" : String(estado.estimado)
            );
        }

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

        // Al abrir la página el estado físico es desconocido.
        // Solo tras calibración manual se alterna por orden aceptada;
        // el resultado siempre es ESTIMADO, no telemetría.
        const mostrar = (estado, encendida, apagada) =>
            estado.estimado === null
                ? "SIN VERIFICAR"
                : (estado.estimado ? encendida : apagada) + "*";

        resumenTexto.textContent =
            `Música: ${mostrar(musica, "ENCENDIDA", "APAGADA")} · ` +
            `Luces: ${mostrar(luces, "ENCENDIDAS", "APAGADAS")} · ` +
            `Velocidad: ${velocidad.cambios} cambio(s) `;

        resumen.title =
            "* Estado VISUAL estimado por pulsaciones aceptadas desde esta carga. " +
            "Usa Sincronizar para indicar el estado físico que estás viendo. " +
            "Después se alterna por cada orden aceptada desde esta pestaña. " +
            "No se recibe una medición real del ESP8266 ni del control remoto.";
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
                // Nunca se inventa el estado inicial. El primer cambio
                // solo se puede representar si el usuario sincronizó
                // previamente con el estado que ve en el juguete.
                if (estado.estimado === null) {
                    actualizar(
                        nombre,
                        "Orden aceptada. Sin estado físico conocido: pulsa Sincronizar",
                        "neutro"
                    );
                } else {
                    estado.estimado = !estado.estimado;
                    const encendido = estado.estimado;
                    actualizar(
                        nombre,
                        encendido
                            ? "ENCENDIDO estimado después de orden aceptada"
                            : "APAGADO estimado después de orden aceptada",
                        encendido ? "aceptado" : "apagado"
                    );
                }
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


    function abrirSincronizacion() {
        // No lee ni escribe estados del hardware. No realiza peticiones a AWS.
        let dialogo = document.getElementById("arm-sinc-dialogo");
        if (!dialogo) {
            dialogo = document.createElement("div");
            dialogo.id = "arm-sinc-dialogo";
            dialogo.setAttribute("role", "dialog");
            dialogo.setAttribute("aria-modal", "true");
            dialogo.setAttribute("aria-label", "Sincronizar indicadores visuales");
            dialogo.hidden = true;
            const caja = document.createElement("form");
            caja.className = "arm-sinc-caja";
            const titulo = document.createElement("h3");
            titulo.textContent = "Sincronizar Música y Luces";
            const nota = document.createElement("p");
            nota.textContent = "Observa la excavadora y selecciona cómo están AHORA. Esto solo calibra los foquitos, no envía órdenes.";
            caja.append(titulo, nota);
            for (const [nombre, etiqueta] of [["MUSICA", "Música física"], ["LUZ_LED", "Luces físicas"]]) {
                const etiquetaNodo = document.createElement("label");
                etiquetaNodo.textContent = etiqueta;
                const selector = document.createElement("select");
                selector.dataset.calibrar = nombre;
                for (const [valor, texto] of [["?", "No lo sé / Sin verificar"], ["0", "Apagada"], ["1", "Encendida"]]) {
                    const opcion = document.createElement("option");
                    opcion.value = valor;
                    opcion.textContent = texto;
                    selector.appendChild(opcion);
                }
                etiquetaNodo.appendChild(selector);
                caja.appendChild(etiquetaNodo);
            }
            const notaLimite = document.createElement("p");
            notaLimite.style.cssText = "font-size:11px;color:#cad5e6";
            notaLimite.textContent = "Los indicadores seguirán cada pulsación aceptada por esta página. Si utilizas el control remoto físico o reinicias el equipo, sincroniza otra vez.";
            const acciones = document.createElement("div");
            acciones.className = "arm-sinc-acciones";
            const cancelar = document.createElement("button");
            cancelar.type = "button";
            cancelar.textContent = "Cancelar";
            cancelar.addEventListener("click", () => { dialogo.hidden = true; });
            const guardar = document.createElement("button");
            guardar.type = "submit";
            guardar.textContent = "Aplicar";
            acciones.append(cancelar, guardar);
            caja.append(notaLimite, acciones);
            caja.addEventListener("submit", evento => {
                evento.preventDefault();
                for (const selector of caja.querySelectorAll("select[data-calibrar]")) {
                    const estado = estados.get(selector.dataset.calibrar);
                    if (!estado) continue;
                    estado.estimado = selector.value === "?" ? null : selector.value === "1";
                    estado.mensaje = estado.estimado === null
                        ? "Sin verificar; requiere sincronización visual"
                        : (estado.estimado ? "Encendida visualmente (calibrada por usuario)" : "Apagada visualmente (calibrada por usuario)");
                    estado.color = estado.estimado === null ? "neutro" : (estado.estimado ? "aceptado" : "apagado");
                    dibujar(selector.dataset.calibrar);
                }
                dialogo.hidden = true;
                mostrarAviso("Indicadores visuales sincronizados con lo que observaste. No hay telemetría física.", "neutro", 3500);
            });
            dialogo.addEventListener("click", evento => {
                if (evento.target === dialogo) dialogo.hidden = true;
            });
            dialogo.appendChild(caja);
            document.body.appendChild(dialogo);
        }
        for (const selector of dialogo.querySelectorAll("select[data-calibrar]")) {
            const valor = estados.get(selector.dataset.calibrar)?.estimado;
            selector.value = valor === null ? "?" : (valor ? "1" : "0");
        }
        dialogo.hidden = false;
        dialogo.querySelector("select")?.focus();
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

            #pantallaControl .arm-sinc-extras {
                appearance: none;
                background: transparent;
                color: #facc15;
                border: 0;
                border-bottom: 1px dotted #facc15;
                border-radius: 0;
                padding: 0 2px;
                margin-left: 3px;
                font: 700 10px/1.2 system-ui,sans-serif;
                cursor: pointer;
            }
            #arm-sinc-dialogo {
                position: fixed;
                z-index: 10050;
                inset: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                background: #000a;
                padding: 12px;
            }
            #arm-sinc-dialogo[hidden] { display: none !important; }
            #arm-sinc-dialogo .arm-sinc-caja {
                box-sizing: border-box;
                width: min(96vw, 390px);
                max-height: 90dvh;
                overflow: auto;
                display: grid;
                gap: 10px;
                padding: 18px;
                border: 1px solid #facc15;
                border-radius: 12px;
                background: #12243e;
                color: #fff;
                box-shadow: 0 6px 30px #0009;
                font: 13px/1.35 system-ui,sans-serif;
            }
            #arm-sinc-dialogo .arm-sinc-caja h3 { margin: 0; font-size: 18px; color: #facc15; }
            #arm-sinc-dialogo .arm-sinc-caja p { margin: 0; }
            #arm-sinc-dialogo .arm-sinc-caja label { display: grid; gap: 4px; }
            #arm-sinc-dialogo .arm-sinc-caja select {
                width: 100%; padding: 8px; color: #fff; background: #243c5e;
                border: 1px solid #94a3b8; border-radius: 6px;
            }
            #arm-sinc-dialogo .arm-sinc-acciones { display: flex; gap: 8px; }
            #arm-sinc-dialogo .arm-sinc-acciones button {
                flex: 1; padding: 9px 6px; border: 0; border-radius: 7px;
                font-weight: bold; cursor: pointer;
            }
            #arm-sinc-dialogo .arm-sinc-acciones button[type="submit"] {
                background: #facc15; color: #11233c;
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
        resumen.dataset.versionIndicadores = "9";
        resumenTexto = document.createElement("span");
        const sincronizar = document.createElement("button");
        sincronizar.type = "button";
        sincronizar.className = "arm-sinc-extras";
        sincronizar.textContent = "Sincronizar";
        sincronizar.title = "Ajustar Música y Luces a lo que observas físicamente, sin enviar comandos";
        sincronizar.addEventListener("click", abrirSincronizacion);
        resumen.append(resumenTexto, sincronizar);

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
            "ARMO Extras V9: Música/Luces alternan indicador visual con cada orden aceptada."
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
