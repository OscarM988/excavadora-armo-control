
"use strict";

/*
 * EXCAVADORA-ARMO
 * PRACTICA 4.2 - MONITOREO
 *
 * Consulta estado e historial mediante REST.
 * Recibe eventos del WebSocket de app.js.
 * No crea otro WebSocket.
 * No envia movimientos.
 * No almacena pasos de DEMO en el historial.
 */

import {
    obtenerUltimoEstado,
    obtenerUltimosMovimientos
} from "./monitoreo-service.js";

const $ = id => document.getElementById(id);

const VEHICULO_ID = 1;

const principal = $("pantallaControl");
const vistaMonitoreo = $("vistaMonitoreo");

const navegacionControl =
    principal?.querySelector(".navegacion-armo");

let versionConsulta = 0;
let versionHistorial = 0;
let revisionWSS = 0;
let temporizadorHistorial = null;
let ultimaMarcaEstado = null;
let ultimoEstadoDesdeWSS = false;
let hayEstado = false;

/* ==========================================
   FECHAS DEL BACKEND
   ========================================== */

function separarFechaHora(valor) {
    if (typeof valor !== "string") {
        return {
            fecha: "—",
            hora: "—"
        };
    }

    const resultado = valor.match(
        /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2}:\d{2})/
    );

    if (!resultado) {
        return {
            fecha: "—",
            hora: "—"
        };
    }

    return {
        fecha:
            `${resultado[3]}/${resultado[2]}/${resultado[1]}`,
        hora: resultado[4]
    };
}

function marcaComparable(valor) {
    if (typeof valor !== "string") {
        return null;
    }

    // Comparar solo marcas del estado del backend.
    // No mezclar fechas UTC con fechas sin zona.
    const resultado = valor.match(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/
    );

    return resultado ? valor : null;
}

function monitoreoVisible() {
    return Boolean(
        principal &&
        vistaMonitoreo &&
        !vistaMonitoreo.hidden &&
        !principal.classList.contains("oculto")
    );
}

/* ==========================================
   ULTIMO ESTADO
   ========================================== */

function mostrarEstado(estado, desdeWSS = false) {
    if (
        !estado ||
        typeof estado !== "object" ||
        Number(estado.id_vehiculo) !== VEHICULO_ID
    ) {
        return;
    }

    const marca = marcaComparable(
        estado.fecha_actualizacion
    );

    if (
        marca &&
        ultimaMarcaEstado &&
        marca < ultimaMarcaEstado
    ) {
        return;
    }

    if (
        marca &&
        marca === ultimaMarcaEstado &&
        ultimoEstadoDesdeWSS &&
        !desdeWSS
    ) {
        return;
    }

    if (marca) {
        ultimaMarcaEstado = marca;
    }

    const fecha = separarFechaHora(
        estado.fecha_actualizacion
    );

    $("monitoreoVehiculo").textContent =
        estado.vehiculo ||
        `Vehículo ${VEHICULO_ID}`;

    $("monitoreoMovimiento").textContent =
        estado.comando || "Sin movimientos";

    $("monitoreoFecha").textContent =
        fecha.fecha;

    $("monitoreoHora").textContent =
        fecha.hora;

    $("monitoreoCodigo").textContent =
        estado.codigo == null
            ? "—"
            : String(estado.codigo);

    $("monitoreoOrigen").textContent =
        estado.origen || "No informado";

    ultimoEstadoDesdeWSS = desdeWSS;
    hayEstado = true;
}

/* ==========================================
   HISTORIAL PERSISTIDO
   ========================================== */

function mostrarHistorial(registros) {
    const cuerpo = $("monitoreoHistorial");
    const fragmento = document.createDocumentFragment();

    if (!Array.isArray(registros) || !registros.length) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");

        celda.colSpan = 4;
        celda.textContent =
            "Sin movimientos registrados";

        fila.appendChild(celda);
        fragmento.appendChild(fila);
    } else {
        registros.slice(0, 10).forEach(
            (registro, indice) => {
                const fecha = separarFechaHora(
                    registro.fecha_hora
                );

                const fila = document.createElement("tr");

                const valores = [
                    String(indice + 1),
                    String(
                        registro.comando ?? "Desconocido"
                    ),
                    fecha.fecha,
                    fecha.hora
                ];

                valores.forEach(valor => {
                    const celda =
                        document.createElement("td");

                    celda.textContent = valor;
                    fila.appendChild(celda);
                });

                fragmento.appendChild(fila);
            }
        );
    }

    cuerpo.replaceChildren(fragmento);
}

async function refrescarHistorial() {
    const version = ++versionHistorial;

    try {
        const registros =
            await obtenerUltimosMovimientos(VEHICULO_ID);

        if (
            version !== versionHistorial ||
            !monitoreoVisible()
        ) {
            return false;
        }

        mostrarHistorial(registros);
        return true;

    } catch (error) {
        console.warn(
            "MONITOREO: No se pudo actualizar el historial.",
            error
        );

        if (
            version === versionHistorial &&
            monitoreoVisible()
        ) {
            $("monitoreoMensaje").textContent =
                "No se pudo actualizar el historial. " +
                "Se conservarán los datos anteriores.";
        }

        return false;
    }
}

function programarRefrescoHistorial() {
    clearTimeout(temporizadorHistorial);

    temporizadorHistorial = setTimeout(() => {
        temporizadorHistorial = null;

        if (monitoreoVisible()) {
            void refrescarHistorial();
        }
    }, 400);
}

/* ==========================================
   CONSULTA INICIAL REST
   ========================================== */

async function cargarMonitoreo() {
    if (!monitoreoVisible()) {
        return;
    }

    const version = ++versionConsulta;
    const revisionInicial = revisionWSS;

    if (!hayEstado) {
        $("monitoreoMovimiento").textContent =
            "Cargando...";
    }

    $("monitoreoMensaje").textContent =
        "Consultando datos reales de AWS...";

    const [resultadoEstado, resultadoHistorial] =
        await Promise.allSettled([
            obtenerUltimoEstado(VEHICULO_ID),
            refrescarHistorial()
        ]);

    if (
        version !== versionConsulta ||
        !monitoreoVisible()
    ) {
        return;
    }

    if (resultadoEstado.status === "fulfilled") {
        if (revisionInicial === revisionWSS) {
            mostrarEstado(resultadoEstado.value);
        }
    } else if (!hayEstado) {
        $("monitoreoMovimiento").textContent =
            "Sin datos actualizados";
    }

    const historialCorrecto =
        resultadoHistorial.status === "fulfilled" &&
        resultadoHistorial.value === true;

    if (
        resultadoEstado.status === "fulfilled" &&
        historialCorrecto
    ) {
        $("monitoreoMensaje").textContent =
            "Datos sincronizados con AWS. " +
            "Fechas y horas mostradas según el backend.";
    } else {
        $("monitoreoMensaje").textContent =
            "La consulta fue parcial. " +
            "Se intentará sincronizar nuevamente.";
    }
}

/* ==========================================
   EVENTOS DEL WEBSOCKET EXISTENTE
   ========================================== */

function procesarEventoWSS(evento) {
    if (!monitoreoVisible()) {
        return;
    }

    const datos = evento.detail;

    if (
        !datos ||
        typeof datos !== "object" ||
        Array.isArray(datos)
    ) {
        return;
    }

    const movimiento =
        datos.movimiento && typeof datos.movimiento === "object"
            ? datos.movimiento
            : {};

    const estado =
        datos.estado && typeof datos.estado === "object"
            ? datos.estado
            : {};

    // Rechazar eventos de otros vehículos.
    const identificadores = [
        datos.id_vehiculo,
        movimiento.id_vehiculo,
        estado.id_vehiculo
    ].filter(valor => valor !== null && valor !== undefined);

    if (
        identificadores.some(
            valor => Number(valor) !== VEHICULO_ID
        )
    ) {
        return;
    }

    revisionWSS++;

    const tipo =
        typeof datos.tipo === "string"
            ? datos.tipo.toLowerCase()
            : "";

    // Se recibe al conectar o reconectar WSS.
    if (tipo === "estado_inicial") {
        void cargarMonitoreo();
        return;
    }

    const esIndividual =
        tipo === "movimiento_individual";

    const esDemo =
        tipo.includes("demo");

    if (!esIndividual && !esDemo) {
        return;
    }

    const comando =
        movimiento.comando ??
        movimiento.nombre ??
        estado.comando;

    if (comando) {
        const estadoActual = {
            id_vehiculo: VEHICULO_ID,

            vehiculo:
                estado.vehiculo ||
                $("monitoreoVehiculo").textContent,

            comando: String(comando),

            codigo:
                movimiento.codigo ??
                estado.codigo ??
                null,

            origen:
                movimiento.origen ??
                datos.origen ??
                (esDemo ? "DEMO" : "WSS"),

            fecha_actualizacion:
                estado.fecha_actualizacion ??
                movimiento.fecha_hora ??
                datos.fecha_hora ??
                null
        };

        mostrarEstado(estadoActual, true);

        $("monitoreoMensaje").textContent =
            esDemo
                ? "Movimiento DEMO recibido por WSS. " +
                  "No se agrega al historial individual."
                : "Movimiento individual recibido por WSS.";
    }

    // Solo los movimientos individuales persistidos
    // provocan una nueva consulta del historial.
    // La tabla siempre proviene de REST/RDS.
    if (
        esIndividual &&
        movimiento.persistido !== false
    ) {
        programarRefrescoHistorial();
    }
}

/* ==========================================
   NAVEGACION CONTROL / MONITOREO
   ========================================== */

function configurarNavegacion() {
    if (
        !principal ||
        !vistaMonitoreo ||
        !navegacionControl
    ) {
        console.error(
            "MONITOREO: Faltan elementos de navegación."
        );

        return;
    }

    const vistasControl = [
        ...principal.querySelectorAll(
            ":scope > section.panel[data-vista]"
        )
    ].filter(panel => panel !== vistaMonitoreo);

    vistaMonitoreo.dataset.vista = "Monitoreo";

    const navegacion = document.createElement("nav");

    navegacion.className = "navegacion-modos";

    navegacion.setAttribute(
        "aria-label",
        "Navegación principal"
    );

    const btnControl = document.createElement("button");
    btnControl.type = "button";
    btnControl.textContent = "CONTROL";

    const btnMonitoreo = document.createElement("button");
    btnMonitoreo.type = "button";
    btnMonitoreo.textContent = "MONITOREO";

    navegacion.append(
        btnControl,
        btnMonitoreo
    );

    navegacionControl.before(navegacion);

    function seleccionarBoton(modo) {
        const esControl = modo === "control";

        btnControl.classList.toggle(
            "activo",
            esControl
        );

        btnMonitoreo.classList.toggle(
            "activo",
            !esControl
        );

        btnControl.setAttribute(
            "aria-current",
            esControl ? "page" : "false"
        );

        btnMonitoreo.setAttribute(
            "aria-current",
            esControl ? "false" : "page"
        );
    }

    function abrirControl() {
        versionConsulta++;
        versionHistorial++;

        clearTimeout(temporizadorHistorial);
        temporizadorHistorial = null;

        vistaMonitoreo.hidden = true;
        vistaMonitoreo.classList.remove(
            "vista-activa"
        );

        navegacionControl.hidden = false;

        const pestanaActiva =
            navegacionControl.querySelector(
                "button.activo"
            ) ||
            navegacionControl.querySelector(
                "button"
            );

        pestanaActiva?.click();

        seleccionarBoton("control");
    }

    function abrirMonitoreo() {
        navegacionControl.hidden = true;

        vistasControl.forEach(panel => {
            panel.classList.remove(
                "vista-activa"
            );
        });

        vistaMonitoreo.hidden = false;
        vistaMonitoreo.classList.add(
            "vista-activa"
        );

        seleccionarBoton("monitoreo");

        void cargarMonitoreo();
    }

    btnControl.addEventListener(
        "click",
        abrirControl
    );

    btnMonitoreo.addEventListener(
        "click",
        abrirMonitoreo
    );

    // Al cerrar sesión, regresar a CONTROL.
    const observador = new MutationObserver(() => {
        if (principal.classList.contains("oculto")) {
            abrirControl();
            hayEstado = false;
            ultimaMarcaEstado = null;
            ultimoEstadoDesdeWSS = false;
        }
    });

    observador.observe(principal, {
        attributes: true,
        attributeFilter: ["class"]
    });

    // Sincronizar cuando vuelve a mostrarse la pestaña.
    document.addEventListener(
        "visibilitychange",
        () => {
            if (
                !document.hidden &&
                monitoreoVisible()
            ) {
                void cargarMonitoreo();
            }
        }
    );

    // Reutilizar eventos publicados desde app.js.
    window.addEventListener(
        "armo:ws-evento",
        procesarEventoWSS
    );

    abrirControl();
}

configurarNavegacion();
