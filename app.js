
"use strict";

/*
 * EXCAVADORA-ARMO
 * Práctica 4.1 - CONTROL IoT
 *
 * Login JWT, API REST, WebSocket,
 * dos joysticks, Extras, DETENER y DEMO.
 *
 * IMPORTANTE:
 * El control REST inicia deshabilitado.
 * No conectar el ESP8266 ni los motores.
 */

const CONFIG = Object.freeze({
    API_URL: "https://vehiculo-iot.duckdns.org",
    WS_URL: "wss://vehiculo-iot.duckdns.org/ws/vehiculo/1",
    VEHICULO: 1,
    TIMEOUT: 10000,
    API_INTERVALO: 30000
});

const $ = id => document.getElementById(id);

const UI = {
    login: $("pantallaLogin"),
    panel: $("pantallaControl"),
    form: $("formLogin"),
    usuario: $("usuario"),
    clave: $("contrasena"),
    btnLogin: $("btnLogin"),
    mensajeLogin: $("mensajeLogin"),
    salir: $("btnSalir"),
    api: $("estadoAPI"),
    ws: $("estadoWS"),
    rds: $("estadoRDS"),
    jwt: $("estadoJWT"),
    seguridad: $("mensajeSeguridad"),
    monitor: $("monitor"),
    btnDetener: $("btnDetener"),
    btnDemo: $("btnEjecutarDemo"),
    btnCancelar: $("btnCancelarDemo")
};

const COLOR = {
    ok: "#22c55e",
    espera: "#facc15",
    error: "#f87171",
    neutro: "#cbd5e1"
};

const MAPA_DIRECCIONES = {
    direccion: {
        arriba: "AVANZAR",
        abajo: "RETROCEDER",
        izquierda: "GIRAR_IZQUIERDA",
        derecha: "GIRAR_DERECHA"
    },
    brazo: {
        arriba: "DESCARGAR_PALA",
        abajo: "EXCAVAR",
        izquierda: "GIRAR_VEHICULO_IZQUIERDA",
        derecha: "GIRAR_VEHICULO_DERECHA"
    }
};

const NOMBRES_EXTRAS = [
    "MUSICA",
    "CAMBIAR_VELOCIDAD",
    "LUZ_LED",
    "DEMO"
];

let token = null;
let vence = 0;

let ws = null;
let timerAPI = null;
let timerSesion = null;
let timerWS = null;
let timerConexion = null;

let reintentos = 0;
let apiDisponible = false;
let consultaAPIPendiente = false;
let finalizando = false;

let versionSesion = 0;
let versionDemo = 0;

let modulos = null;
let coordinador = null;

let catalogo = [];
let demos = [];

let demoValida = false;
let demoActiva = false;
let operacionDemo = false;

let armado = false;
let extraEnCurso = false;
let controlJoystick = null;

let botonArmar = null;
let franjaSegura = null;

const controlAviso =
    document.querySelector(".control-aviso");

let selectDemo = null;
let mensajeDemo = null;
let resumenDemo = null;
let detalleDemo = null;

/* ==========================================
   INDICADORES Y EVENTOS
   ========================================== */

function indicador(elemento, texto, color = COLOR.neutro) {
    if (!elemento) return;

    elemento.textContent = texto;
    elemento.style.color = color;
}

function registrar(texto) {
    if (!UI.monitor) return;

    const p = document.createElement("p");

    p.textContent =
        `[${new Date().toLocaleTimeString("es-MX")}] ${texto}`;

    UI.monitor.appendChild(p);

    while (UI.monitor.children.length > 50) {
        UI.monitor.firstElementChild.remove();
    }

    UI.monitor.scrollTop = UI.monitor.scrollHeight;
}

function sesionActiva() {
    return Boolean(token && Date.now() < vence);
}

/* ==========================================
   FETCH CON TIMEOUT
   ========================================== */

async function fetchConTiempo(
    ruta,
    opciones = {},
    ms = CONFIG.TIMEOUT
) {
    const controlador = new AbortController();

    const reloj = setTimeout(
        () => controlador.abort(),
        ms
    );

    try {
        return await fetch(
            CONFIG.API_URL + ruta,
            {
                ...opciones,
                cache: "no-store",
                signal: controlador.signal
            }
        );
    } finally {
        clearTimeout(reloj);
    }
}

function listar(datos) {
    if (Array.isArray(datos)) {
        return datos;
    }

    if (datos && Array.isArray(datos.value)) {
        return datos.value;
    }

    if (datos === null) {
        return [];
    }

    throw new Error(
        "La API devolvió un listado no reconocido."
    );
}

async function consultarLista(ruta) {
    const respuesta = await fetchConTiempo(ruta);

    if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status}`);
    }

    return listar(await respuesta.json());
}

/* ==========================================
   NAVEGACIÓN ENTRE PESTAÑAS
   ========================================== */

function configurarNavegacion() {
    const paneles = [
        ...UI.panel.querySelectorAll(
            ":scope > section.panel"
        )
    ];

    if (paneles.length < 7) {
        throw new Error(
            "No coinciden los paneles del index.html."
        );
    }

    paneles[1].classList.add("seguridad-armo");

    franjaSegura = document.createElement("div");
    franjaSegura.className = "aviso-seguro";

    paneles[1].insertAdjacentElement(
        "afterend",
        franjaSegura
    );

    const navegacion = document.createElement("nav");

    navegacion.className = "navegacion-armo";

    navegacion.setAttribute(
        "aria-label",
        "Secciones de control"
    );

    const vistas = [
        ["Dirección", 2],
        ["Brazo", 3],
        ["Extras", 4],
        ["Demo", 5],
        ["Monitor", 6]
    ];

    const botones = vistas.map(
        ([nombre, indice], posicion) => {
            const boton = document.createElement("button");

            boton.type = "button";
            boton.textContent = nombre;

            paneles[indice].dataset.vista = nombre;

            boton.addEventListener("click", () => {
                vistas.forEach(([, i], j) => {
                    paneles[i].classList.toggle(
                        "vista-activa",
                        j === posicion
                    );

                    navegacion.children[j].classList.toggle(
                        "activo",
                        j === posicion
                    );

                    navegacion.children[j].setAttribute(
                        "aria-current",
                        j === posicion ? "page" : "false"
                    );
                });
            });

            navegacion.appendChild(boton);

            return boton;
        }
    );

    franjaSegura.insertAdjacentElement(
        "afterend",
        navegacion
    );

    botones[0].click();

    /* Botón de activación manual */

    botonArmar = document.createElement("button");

    botonArmar.type = "button";
    botonArmar.id = "btnArmarAPI";
    botonArmar.textContent = "Habilitar control API";

    botonArmar.style.cssText =
        "border-radius:9px;" +
        "padding:6px 12px;" +
        "font-weight:700;" +
        "background:#facc15;" +
        "color:#111827;" +
        "margin-left:8px;" +
        "min-height:36px;";

    franjaSegura.style.display = "flex";
    franjaSegura.style.justifyContent = "center";
    franjaSegura.style.alignItems = "center";
    franjaSegura.style.flexWrap = "wrap";
    franjaSegura.style.gap = "4px";

    const leyenda = document.createElement("span");

    leyenda.textContent =
        "CONTROL REST · Deshabilitado";

    leyenda.id = "leyendaControl";

    franjaSegura.append(leyenda, botonArmar);

    botonArmar.addEventListener(
        "click",
        () => void alternarControl()
    );
}

/* ==========================================
   SELECTOR DE DEMO
   ========================================== */

function construirSelectorDemo() {
    const panel = UI.panel.querySelectorAll(
        ":scope > section.panel"
    )[5];

    const contenedor = document.createElement("div");

    contenedor.className = "demo-catalogo";
    contenedor.style.cssText =
        "display:grid;gap:6px;min-height:0;";

    const etiqueta = document.createElement("label");

    etiqueta.htmlFor = "selectDemo";
    etiqueta.textContent = "DEMO almacenada";

    selectDemo = document.createElement("select");

    selectDemo.id = "selectDemo";
    selectDemo.disabled = true;

    selectDemo.style.cssText =
        "background:#12233b;" +
        "color:#fff;" +
        "border:1px solid #64748b;" +
        "border-radius:9px;" +
        "padding:8px;" +
        "min-height:40px;" +
        "width:100%;";

    mensajeDemo = document.createElement("p");
    resumenDemo = document.createElement("p");
    detalleDemo = document.createElement("p");

    for (const p of [
        mensajeDemo,
        resumenDemo,
        detalleDemo
    ]) {
        p.style.cssText =
            "margin:0;" +
            "font-size:clamp(11px,1.4vw,14px);" +
            "line-height:1.25;";
    }

    detalleDemo.style.cssText +=
        "overflow:hidden;" +
        "display:-webkit-box;" +
        "-webkit-line-clamp:2;" +
        "-webkit-box-orient:vertical;" +
        "color:#facc15;";

    mensajeDemo.setAttribute("role", "status");

    mensajeDemo.textContent =
        "Inicia sesión para consultar DEMO.";

    contenedor.append(
        etiqueta,
        selectDemo,
        mensajeDemo,
        resumenDemo,
        detalleDemo
    );

    panel.insertBefore(
        contenedor,
        panel.querySelector(".cuadricula-controles")
    );

    selectDemo.addEventListener(
        "change",
        () => void consultarPasos()
    );
}

/* ==========================================
   CONTROLAR BOTONES HABILITADOS
   ========================================== */

function pintarControles() {
    const enSesion = sesionActiva();

    const listo = Boolean(
        enSesion &&
        apiDisponible &&
        modulos &&
        coordinador?.catalogoListo
    );

    const habilitados = Boolean(
        armado &&
        listo &&
        !demoActiva &&
        !operacionDemo &&
        !extraEnCurso
    );

    const extras = [
        ...document.querySelectorAll(
            ".extras-mini-grid .btn-extra-mini"
        )
    ];

    extras.forEach((boton, i) => {
        boton.disabled = !habilitados;
        boton.dataset.nombre = NOMBRES_EXTRAS[i];
    });

    document.querySelectorAll(
        "[data-funcion]"
    ).forEach(boton => {
        boton.disabled = true;
    });

    UI.btnDetener.disabled = !(
        enSesion &&
        coordinador?.catalogoListo &&
        (armado || demoActiva)
    );

    UI.btnDemo.disabled = !(
        habilitados &&
        demoValida &&
        !coordinador.enviando
    );

    UI.btnCancelar.disabled = !(
        enSesion && demoActiva
    );

    if (botonArmar) {
        botonArmar.disabled = !(
            enSesion &&
            listo &&
            !demoActiva &&
            !operacionDemo
        );

        botonArmar.textContent = armado
            ? "Bloquear control API"
            : "Habilitar control API";
    }

    const leyenda = $("leyendaControl");

    if (leyenda) {
        leyenda.textContent = armado
            ? "CONTROL REST · Habilitado"
            : "CONTROL REST · Deshabilitado";
    }

    if (UI.seguridad) {
        UI.seguridad.textContent = armado
            ? "Control REST habilitado para pruebas, sin conexión física del ESP8266."
            : "MODO SEGURO. Controles REST deshabilitados hasta activación manual.";
    }

    if (controlAviso) {
        controlAviso.textContent = armado
            ? "Control REST activo · SIN ESP8266"
            : "Modo seguro · Sin órdenes REST";
    }
}

function desarmar(motivo = "") {
    const estabaArmado = armado;

    armado = false;
    extraEnCurso = false;
    controlJoystick = null;

    coordinador?.bloquear();

    if (motivo && estabaArmado) {
        registrar(motivo);
    }

    pintarControles();
}

/* ==========================================
   ACTIVACIÓN MANUAL DEL CONTROL
   ========================================== */

async function alternarControl() {
    if (armado) {
        armado = false;

        pintarControles();

        if (coordinador && sesionActiva()) {
            await coordinador.detener({
                forzar: true
            });
        }

        desarmar(
            "Control REST bloqueado manualmente."
        );

        return;
    }

    if (
        !sesionActiva() ||
        !apiDisponible ||
        !coordinador?.catalogoListo ||
        demoActiva
    ) {
        return;
    }

    try {
        coordinador.habilitar();

        armado = true;

        registrar(
            "Control REST habilitado manualmente. Solo pruebas sin microcontrolador."
        );
    } catch (error) {
        registrar(error.message);
    }

    pintarControles();
}

/* ==========================================
   CARGA DE MÓDULOS ES6
   ========================================== */

async function cargarModulos() {
    try {
        const [control, api] = await Promise.all([
            import("./js/control-service.js"),
            import("./js/api-client.js")
        ]);

        modulos = { api };

        coordinador = new control.CoordinadorControl({
            obtenerToken: () =>
                sesionActiva() ? token : null,

            informar: evento => {
                if (evento.etapa === "solicitado") {
                    registrar(
                        `Solicitado: ${evento.nombre}`
                    );
                }

                if (
                    evento.etapa === "aceptado_por_api"
                ) {
                    registrar(
                        `Aceptado por API: ${evento.nombre}`
                    );
                }

                if (evento.etapa === "error") {
                    registrar(
                        `Error ${evento.nombre}: ${evento.mensaje}`
                    );
                }

                if (
                    evento.etapa === "catalogo_incompleto"
                ) {
                    registrar(
                        "Catálogo incompleto: " +
                        evento.faltantes.join(", ")
                    );
                }
            }
        });

        if (catalogo.length) {
            coordinador.cargarCatalogo(catalogo);
        }

        pintarControles();

    } catch (error) {
        registrar(
            "No se pudieron cargar los módulos REST. Revisa los archivos de la carpeta js."
        );

        console.error(
            "Error cargando módulos de control:",
            error
        );

        desarmar();
    }
}

/* ==========================================
   CONTROL DE LOS DOS JOYSTICKS
   ========================================== */


function instalarControlJoystick(id, tipo, idSalida) {
    const zona = $(id);
    const salida = $(idSalida);

    if (!zona) return;

    let puntero = null;
    let teclaActiva = null;
    let ultima = "neutral";
    let huboMovimiento = false;
    let paradaSolicitada = false;

    function direccionEn(x, y) {
        const rect = zona.getBoundingClientRect();

        const dx = x - (rect.left + rect.width / 2);
        const dy = y - (rect.top + rect.height / 2);

        const radio =
            Math.min(rect.width, rect.height) / 2;

        if (
            radio <= 0 ||
            Math.hypot(dx, dy) < radio * 0.18
        ) {
            return "neutral";
        }

        return Math.abs(dx) > Math.abs(dy)
            ? (dx < 0 ? "izquierda" : "derecha")
            : (dy < 0 ? "arriba" : "abajo");
    }

    function actualizar(dir) {
        if (dir === ultima) return;

        // Si regresó al centro, el gesto queda
        // detenido hasta que se suelte.
        if (paradaSolicitada && dir !== "neutral") {
            return;
        }

        ultima = dir;

        if (
            !armado ||
            extraEnCurso ||
            !coordinador ||
            controlJoystick !== tipo
        ) {
            return;
        }

        if (dir === "neutral") {
            // No enviar DETENER por hacer clic
            // en el centro sin mover nada.
            if (huboMovimiento && !paradaSolicitada) {
                paradaSolicitada = true;

                if (salida) {
                    salida.textContent =
                        "NEUTRAL · DETENER solicitado";
                }

                void coordinador.detener({
                    forzar: true
                });
            }

            return;
        }

        huboMovimiento = true;

        if (salida) {
            salida.textContent =
                `${MAPA_DIRECCIONES[tipo][dir]} · Solicitado`;
        }

        void coordinador.mover(tipo, dir);
    }

    function soltar() {
        if (
            puntero === null &&
            teclaActiva === null
        ) {
            return;
        }

        puntero = null;
        teclaActiva = null;
        ultima = "neutral";

        if (controlJoystick === tipo) {
            controlJoystick = null;

            // DETENER solo una vez por gesto.
            if (
                armado &&
                coordinador &&
                huboMovimiento &&
                !paradaSolicitada
            ) {
                paradaSolicitada = true;

                void coordinador.detener({
                    forzar: true
                });
            }

            if (salida) {
                salida.textContent = huboMovimiento
                    ? "NEUTRAL · DETENER solicitado"
                    : "NEUTRAL · Sin orden REST";
            }
        }

        huboMovimiento = false;
        paradaSolicitada = false;
    }

    zona.addEventListener("pointerdown", ev => {
        if (
            !armado ||
            extraEnCurso ||
            (
                controlJoystick &&
                controlJoystick !== tipo
            ) ||
            puntero !== null ||
            teclaActiva !== null
        ) {
            return;
        }

        controlJoystick = tipo;
        puntero = ev.pointerId;

        ultima = "neutral";
        huboMovimiento = false;
        paradaSolicitada = false;

        actualizar(
            direccionEn(ev.clientX, ev.clientY)
        );
    });

    zona.addEventListener("pointermove", ev => {
        if (
            ev.pointerId === puntero &&
            controlJoystick === tipo
        ) {
            actualizar(
                direccionEn(ev.clientX, ev.clientY)
            );
        }
    });

    for (const evento of [
        "pointerup",
        "pointercancel",
        "lostpointercapture"
    ]) {
        zona.addEventListener(evento, soltar);
    }

    zona.addEventListener("keydown", ev => {
        const mapa = {
            ArrowUp: "arriba",
            ArrowDown: "abajo",
            ArrowLeft: "izquierda",
            ArrowRight: "derecha"
        };

        if (
            !mapa[ev.key] ||
            !armado ||
            extraEnCurso ||
            (
                controlJoystick &&
                controlJoystick !== tipo
            )
        ) {
            return;
        }

        ev.preventDefault();

        controlJoystick = tipo;
        teclaActiva = ev.key;

        actualizar(mapa[ev.key]);
    });

    zona.addEventListener("keyup", ev => {
        if (ev.key === teclaActiva) {
            soltar();
        }
    });

    window.addEventListener("blur", soltar);

    document.addEventListener(
        "visibilitychange",
        () => {
            if (document.hidden) {
                soltar();
            }
        }
    );
}


/* ==========================================
   BOTONES EXTRAS Y DETENER
   ========================================== */

function instalarExtras() {
    document.querySelectorAll(
        ".extras-mini-grid .btn-extra-mini"
    ).forEach((boton, i) => {
        boton.addEventListener(
            "click",
            async () => {
                if (
                    !armado ||
                    demoActiva ||
                    !coordinador ||
                    coordinador.enviando
                ) {
                    return;
                }

                const nombre =
                    NOMBRES_EXTRAS[i];

                if (nombre === "DEMO") {
                    // Abre las DEMO almacenadas.
                    // No activa accidentalmente
                    // el comando de hardware DEMO.

                    const tabDemo = [
                        ...document.querySelectorAll(
                            ".navegacion-armo button"
                        )
                    ].find(
                        b => b.textContent === "Demo"
                    );

                    tabDemo?.click();

                    registrar(
                        "Selecciona una DEMO almacenada para ejecutarla."
                    );

                } else {
                    extraEnCurso = true;

                    pintarControles();

                    try {
                        await coordinador.extra(nombre);
                    } finally {
                        extraEnCurso = false;
                        pintarControles();
                    }
                }
            }
        );
    });

    UI.btnDetener?.addEventListener(
        "click",
        () => void detenerAhora()
    );

    UI.btnDemo?.addEventListener(
        "click",
        () => void ejecutarDemoSeleccionada()
    );

    UI.btnCancelar?.addEventListener(
        "click",
        () => void cancelarDemoActual()
    );
}

/* ==========================================
   DETENER
   ========================================== */

async function detenerAhora() {
    if (
        !sesionActiva() ||
        !coordinador?.catalogoListo
    ) {
        return;
    }

    controlJoystick = null;

    if (demoActiva) {
        await cancelarDemoActual();
        return;
    }

    if (armado) {
        await coordinador.detener({
            forzar: true
        });
    }
}

/* ==========================================
   CATÁLOGO REAL DE COMANDOS
   ========================================== */

function opcion(valor, nombre) {
    const nodo = document.createElement("option");

    nodo.value = String(valor);
    nodo.textContent = nombre;

    return nodo;
}

async function cargarCatalogos() {
    const version = versionSesion;

    try {
        const lista = await consultarLista(
            `/comandos/vehiculo/${CONFIG.VEHICULO}`
        );

        if (
            version !== versionSesion ||
            !sesionActiva()
        ) {
            return;
        }

        catalogo = lista.filter(
            c =>
                Number(c.activo) === 1 &&
                Number(c.id_vehiculo) === CONFIG.VEHICULO
        );

        coordinador?.cargarCatalogo(catalogo);

        const extras = [
            ...document.querySelectorAll(
                ".extras-mini-grid .btn-extra-mini"
            )
        ];

        extras.forEach((boton, i) => {
            const c = catalogo.find(
                c => c.nombre === NOMBRES_EXTRAS[i]
            );

            if (c) {
                boton.dataset.codigo =
                    String(c.codigo);

                boton.dataset.idComando =
                    String(c.id_comando);
            }
        });

        const stop = catalogo.find(
            c => c.nombre === "DETENER"
        );

        if (stop) {
            UI.btnDetener.dataset.idComando =
                String(stop.id_comando);
        }

        registrar(
            `Catálogo REST: ${catalogo.length} comandos activos.`
        );

        pintarControles();

    } catch (error) {
        if (version === versionSesion) {
            registrar(
                `Error consultando comandos: ${error.message}`
            );
        }
    }

    try {
        const lista = await consultarLista(
            `/demos/vehiculo/${CONFIG.VEHICULO}`
        );

        if (
            version !== versionSesion ||
            !sesionActiva()
        ) {
            return;
        }

        demos = lista.filter(
            d =>
                Number(d.activo) === 1 &&
                Number(d.id_vehiculo) === CONFIG.VEHICULO
        );

        selectDemo.replaceChildren(
            opcion(
                "",
                "-- Selecciona una DEMO --"
            ),
            ...demos.map(
                d => opcion(
                    d.id_demo,
                    String(d.nombre)
                )
            )
        );

        selectDemo.disabled =
            demos.length === 0;

        mensajeDemo.textContent =
            `${demos.length} DEMO activas disponibles.`;

        registrar(
            `Catálogo REST: ${demos.length} DEMO activas.`
        );

        pintarControles();

    } catch (error) {
        if (version === versionSesion) {
            mensajeDemo.textContent =
                `Error consultando DEMO: ${error.message}`;
        }
    }
}

/* ==========================================
   MOVIMIENTOS DE DEMO
   ========================================== */

async function consultarPasos() {
    const id = Number(selectDemo.value);

    const v = ++versionDemo;

    demoValida = false;

    resumenDemo.textContent = "";
    detalleDemo.textContent = "";

    pintarControles();

    if (
        !demos.some(
            d => Number(d.id_demo) === id
        )
    ) {
        mensajeDemo.textContent =
            "Selecciona una DEMO existente.";

        return;
    }

    mensajeDemo.textContent =
        "Consultando secuencia...";

    try {
        const lista = await consultarLista(
            `/demos/${id}/movimientos`
        );

        if (
            v !== versionDemo ||
            !sesionActiva()
        ) {
            return;
        }

        const pasos = lista
            .filter(
                p =>
                    Number.isInteger(
                        Number(p.orden)
                    )
            )
            .sort(
                (a, b) =>
                    Number(a.orden) -
                    Number(b.orden)
            );

        demoValida = pasos.length > 0;

        if (!demoValida) {
            mensajeDemo.textContent =
                "La DEMO seleccionada no tiene movimientos configurados.";

            return;
        }

        const total = pasos.reduce(
            (s, p) =>
                s +
                Number(p.duracion_ms || 0) +
                Number(p.pausa_ms || 0),
            0
        );

        mensajeDemo.textContent =
            `DEMO ${id}: secuencia verificada.`;

        resumenDemo.textContent =
            `${pasos.length} movimientos · ` +
            `${(total / 1000).toFixed(2)} s programados`;

        detalleDemo.textContent = pasos
            .map(
                p =>
                    `${p.orden}. ${p.comando ?? p.id_comando}`
            )
            .join(" · ");

    } catch (error) {
        if (v === versionDemo) {
            mensajeDemo.textContent =
                `Error: ${error.message}`;
        }
    } finally {
        pintarControles();
    }
}

/* ==========================================
   EJECUTAR DEMO
   ========================================== */

async function ejecutarDemoSeleccionada() {
    if (
        !armado ||
        !demoValida ||
        demoActiva ||
        operacionDemo ||
        !sesionActiva() ||
        coordinador?.enviando ||
        !modulos
    ) {
        return;
    }

    const id = Number(selectDemo.value);

    if (
        !demos.some(
            d => Number(d.id_demo) === id
        )
    ) {
        return;
    }

    operacionDemo = true;

    pintarControles();

    try {
        const parada =
            await coordinador.detener({
                forzar: true
            });

        if (!parada) {
            throw new Error(
                "No se confirmó DETENER antes de la DEMO."
            );
        }

        coordinador.establecerDemoActiva(true);

        demoActiva = true;

        pintarControles();

        registrar(
            `Solicitada DEMO ${id}.`
        );

        await modulos.api.ejecutarDemo(
            id,
            token
        );

        registrar(
            `API aceptó iniciar DEMO ${id}; esperando eventos WSS.`
        );

    } catch (error) {
        demoActiva = false;

        coordinador.establecerDemoActiva(false);

        registrar(
            `No se pudo iniciar DEMO: ${error.message}`
        );

    } finally {
        operacionDemo = false;
        pintarControles();
    }
}

/* ==========================================
   CANCELAR DEMO
   ========================================== */

async function cancelarDemoActual() {
    if (
        !demoActiva ||
        operacionDemo ||
        !sesionActiva() ||
        !modulos
    ) {
        return;
    }

    operacionDemo = true;

    pintarControles();

    try {
        registrar(
            "Solicitada cancelación prioritaria de DEMO."
        );

        await modulos.api.cancelarDemo(
            token,
            CONFIG.VEHICULO
        );

        registrar(
            "API aceptó cancelar DEMO."
        );

        if (coordinador?.habilitado) {
            await coordinador.detener({
                forzar: true
            });
        } else {
            const stop = catalogo.find(
                c => c.nombre === "DETENER"
            );

            if (stop) {
                await modulos.api.enviarMovimiento(
                    Number(stop.id_comando),
                    token
                );
            }
        }

        demoActiva = false;

        coordinador?.establecerDemoActiva(false);

        desarmar(
            "DEMO cancelada. Control REST bloqueado."
        );

    } catch (error) {
        registrar(
            `No se confirmó cancelación/DETENER: ${error.message}`
        );

    } finally {
        operacionDemo = false;
        pintarControles();
    }
}

/* ==========================================
   COMPROBACIÓN DE AWS
   ========================================== */

async function verificarAPI() {
    if (
        !sesionActiva() ||
        consultaAPIPendiente ||
        document.hidden
    ) {
        return;
    }

    consultaAPIPendiente = true;

    const v = versionSesion;

    indicador(
        UI.api,
        "Comprobando",
        COLOR.espera
    );

    try {
        const r = await fetchConTiempo("/");

        if (!r.ok) {
            throw new Error(
                `HTTP ${r.status}`
            );
        }

        if (v !== versionSesion) {
            return;
        }

        if (!apiDisponible) {
            registrar(
                "Servidor AWS: API disponible."
            );
        }

        apiDisponible = true;

        indicador(
            UI.api,
            "Disponible",
            COLOR.ok
        );

    } catch (_error) {
        if (v !== versionSesion) {
            return;
        }

        apiDisponible = false;

        indicador(
            UI.api,
            "No disponible",
            COLOR.error
        );

        desarmar(
            "Control bloqueado: API no disponible."
        );

    } finally {
        consultaAPIPendiente = false;
        pintarControles();
    }
}

/* ==========================================
   ESTADO DE AMAZON RDS
   ========================================== */

function estadoRDS() {
    // Sin endpoint documentado de diagnóstico
    // RDS, no afirmar conectividad directa.

    indicador(
        UI.rds,
        "Sin verificar",
        COLOR.neutro
    );
}

/* ==========================================
   WEBSOCKET WSS
   ========================================== */

function cancelarTimersWS() {
    clearTimeout(timerWS);
    clearTimeout(timerConexion);

    timerWS = null;
    timerConexion = null;
}

function cerrarWS() {
    cancelarTimersWS();

    const anterior = ws;

    ws = null;

    try {
        anterior?.close(
            1000,
            "Fin de sesión"
        );
    } catch (_error) {
        // No interrumpir el cierre.
    }

    indicador(
        UI.ws,
        "Desconectado",
        COLOR.error
    );
}

function reintentarWS() {
    if (
        finalizando ||
        !sesionActiva() ||
        timerWS !== null
    ) {
        return;
    }

    const demora = Math.min(
        2000 *
            (2 ** Math.min(reintentos++, 4)),
        30000
    );

    indicador(
        UI.ws,
        "Reconectando",
        COLOR.espera
    );

    timerWS = setTimeout(() => {
        timerWS = null;
        conectarWS();
    }, demora);
}

function conectarWS() {
    if (
        finalizando ||
        !sesionActiva() ||
        document.hidden ||
        (
            ws &&
            (
                ws.readyState === 0 ||
                ws.readyState === 1
            )
        )
    ) {
        return;
    }

    indicador(
        UI.ws,
        reintentos
            ? "Reconectando"
            : "Conectando",
        COLOR.espera
    );

    let conexion;

    try {
        conexion = new WebSocket(
            CONFIG.WS_URL
        );
    } catch (_error) {
        reintentarWS();
        return;
    }

    ws = conexion;

    timerConexion = setTimeout(() => {
        if (
            ws === conexion &&
            conexion.readyState ===
                WebSocket.CONNECTING
        ) {
            conexion.close();
        }
    }, 10000);

    conexion.addEventListener(
        "open",
        () => {
            if (ws !== conexion) return;

            clearTimeout(timerConexion);
            reintentos = 0;

            indicador(
                UI.ws,
                "En línea",
                COLOR.ok
            );

            registrar(
                "WebSocket del navegador en línea (no confirma ESP8266)."
            );

            pintarControles();
        }
    );

    conexion.addEventListener(
        "message",
        evento => {
            if (
                ws !== conexion ||
                !sesionActiva()
            ) {
                return;
            }

            try {
                procesarEvento(
                    JSON.parse(evento.data)
                );
            } catch (_error) {
                registrar(
                    "Evento WSS con JSON no válido."
                );
            }
        }
    );

    conexion.addEventListener(
        "error",
        () => {
            if (ws !== conexion) return;

            indicador(
                UI.ws,
                "Desconectado",
                COLOR.error
            );
        }
    );

    conexion.addEventListener(
        "close",
        () => {
            if (ws !== conexion) return;

            ws = null;

            clearTimeout(timerConexion);

            indicador(
                UI.ws,
                "Desconectado",
                COLOR.error
            );

            registrar(
                "WebSocket desconectado."
            );

            desarmar(
                "Control deshabilitado al perder WSS."
            );

            reintentarWS();
        }
    );
}

/* ==========================================
   EVENTOS WEBSOCKET
   ========================================== */

function procesarEvento(datos) {
    if (
        !datos ||
        typeof datos !== "object" ||
        Array.isArray(datos)
    ) {
        return;
    }

    const tipo =
        typeof datos.tipo === "string"
            ? datos.tipo
            : "evento";

    if (tipo === "estado_inicial") {
        registrar(
            "WSS: estado inicial recibido."
        );

    } else if (
        tipo === "movimiento_individual"
    ) {
        const m = datos.movimiento || {};

        registrar(
            `Evento WSS: ${String(m.comando ?? "Desconocido")} ` +
            `(código ${String(m.codigo ?? "N/D")}).`
        );

    } else if (
        tipo.toLowerCase().includes("demo")
    ) {
        registrar(
            `Evento WSS de DEMO: ${tipo}.`
        );

        const fin =
            /finaliz|termin|cancel|complet/i.test(tipo);

        if (fin && demoActiva) {
            demoActiva = false;

            coordinador?.establecerDemoActiva(
                false
            );

            desarmar(
                "DEMO terminada; habilita control nuevamente."
            );
        }

    } else {
        registrar(
            `Evento WSS: ${tipo}.`
        );
    }

    // El evento WSS confirma publicación,
    // no ejecución física.
}

/* ==========================================
   COMPROBACIONES PERIÓDICAS
   ========================================== */

function iniciarServicios() {
    estadoRDS();

    void verificarAPI();

    timerAPI = setInterval(
        () => void verificarAPI(),
        CONFIG.API_INTERVALO
    );

    conectarWS();

    timerSesion = setInterval(() => {
        if (!sesionActiva()) {
            void cerrarSesion(
                "Sesión expirada: inicia sesión nuevamente."
            );
        }
    }, 1000);
}

/* ==========================================
   MOSTRAR PANEL
   ========================================== */

function mostrarPanel() {
    UI.login.classList.add("oculto");

    UI.panel.classList.remove("oculto");

    indicador(
        UI.jwt,
        "Activa",
        COLOR.ok
    );

    UI.monitor.replaceChildren();

    registrar(
        "Sesión iniciada. Control REST deshabilitado por seguridad."
    );

    finalizando = false;
    versionSesion++;

    armado = false;
    demoActiva = false;

    iniciarServicios();

    void cargarCatalogos();

    pintarControles();
}

/* ==========================================
   LOGIN JWT
   ========================================== */

async function iniciarSesion(evento) {
    evento.preventDefault();

    const usuario =
        UI.usuario.value.trim();

    const contrasena =
        UI.clave.value;

    if (!usuario || !contrasena) {
        return;
    }

    UI.mensajeLogin.textContent = "";

    UI.btnLogin.disabled = true;
    UI.btnLogin.textContent = "VERIFICANDO...";

    try {
        const r = await fetchConTiempo(
            "/auth/login",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    usuario,
                    contrasena
                })
            },
            12000
        );

        if (!r.ok) {
            if (r.status === 401) {
                throw new Error(
                    "Usuario o contraseña incorrectos."
                );
            }

            if (r.status === 429) {
                throw new Error(
                    "Demasiados intentos. Intenta más tarde."
                );
            }

            throw new Error(
                `Error de inicio de sesión HTTP ${r.status}.`
            );
        }

        const datos = await r.json();

        if (
            typeof datos.access_token !== "string" ||
            String(datos.token_type).toLowerCase() !==
                "bearer" ||
            !Number.isFinite(datos.expires_in) ||
            datos.expires_in <= 0
        ) {
            throw new Error(
                "Respuesta JWT inválida."
            );
        }

        token = datos.access_token;

        vence =
            Date.now() +
            datos.expires_in * 1000;

        UI.clave.value = "";

        mostrarPanel();

    } catch (error) {
        UI.mensajeLogin.textContent =
            error.name === "AbortError"
                ? "La API no respondió a tiempo."
                : error.message;

        UI.clave.value = "";

    } finally {
        UI.btnLogin.disabled = false;
        UI.btnLogin.textContent =
            "INICIAR SESIÓN";
    }
}

/* ==========================================
   CERRAR SESIÓN
   ========================================== */

async function cerrarSesion(mensaje = "") {
    if (finalizando) return;

    finalizando = true;

    if (
        armado &&
        coordinador &&
        sesionActiva()
    ) {
        try {
            await coordinador.detener({
                forzar: true
            });
        } catch (_error) {
            // No garantiza detención del backend.
        }
    }

    if (
        demoActiva &&
        modulos &&
        sesionActiva()
    ) {
        try {
            await modulos.api.cancelarDemo(
                token,
                CONFIG.VEHICULO
            );
        } catch (_error) {
            registrar(
                "No fue posible confirmar cancelación de DEMO al salir."
            );
        }
    }

    versionSesion++;

    desarmar();

    demoActiva = false;

    clearInterval(timerAPI);
    clearInterval(timerSesion);

    timerAPI = null;
    timerSesion = null;

    cerrarWS();

    token = null;
    vence = 0;

    apiDisponible = false;

    catalogo = [];
    demos = [];
    demoValida = false;

    versionDemo++;

    selectDemo.replaceChildren();
    selectDemo.disabled = true;

    mensajeDemo.textContent =
        "Inicia sesión para consultar DEMO.";

    resumenDemo.textContent = "";
    detalleDemo.textContent = "";

    indicador(
        UI.jwt,
        "Inactiva",
        COLOR.error
    );

    indicador(
        UI.api,
        "Comprobando",
        COLOR.espera
    );

    estadoRDS();

    UI.panel.classList.add("oculto");
    UI.login.classList.remove("oculto");

    UI.clave.value = "";
    UI.mensajeLogin.textContent = mensaje;

    pintarControles();
}

/* ==========================================
   INICIALIZACIÓN
   ========================================== */

function inicializar() {
    configurarNavegacion();

    construirSelectorDemo();

    instalarControlJoystick(
        "joystick",
        "direccion",
        "direccionActual"
    );

    instalarControlJoystick(
        "joystickBrazo",
        "brazo",
        "brazoActual"
    );

    instalarExtras();

    estadoRDS();
    pintarControles();

    void cargarModulos();

    UI.form.addEventListener(
        "submit",
        iniciarSesion
    );

    UI.salir.addEventListener(
        "click",
        () => void cerrarSesion()
    );

    document.addEventListener(
        "visibilitychange",
        () => {
            if (!sesionActiva()) return;

            if (document.hidden) {
                if (armado && coordinador) {
                    void coordinador.detener({
                        forzar: true
                    });
                }

                desarmar(
                    "Control bloqueado al ocultar la pestaña."
                );

            } else {
                void verificarAPI();
                conectarWS();
            }
        }
    );

    window.addEventListener(
        "offline",
        () => {
            apiDisponible = false;

            indicador(
                UI.api,
                "No disponible",
                COLOR.error
            );

            indicador(
                UI.ws,
                "Desconectado",
                COLOR.error
            );

            desarmar(
                "Control bloqueado: sin red."
            );
        }
    );

    window.addEventListener(
        "online",
        () => {
            if (sesionActiva()) {
                void verificarAPI();
                conectarWS();
            }
        }
    );
}

inicializar();
