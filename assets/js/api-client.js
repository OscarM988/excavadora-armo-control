
"use strict";

/*
 * EXCAVADORA-ARMO
 * Práctica 4.1 - Aplicación de CONTROL IoT
 *
 * Cliente REST modular para FastAPI en AWS.
 *
 * No guarda contraseñas, API Keys ni tokens.
 * No ejecuta movimientos automáticamente.
 */

const API_BASE_URL =
    "https://vehiculo-iot.duckdns.org";

const ID_VEHICULO = 1;

const TIMEOUT_MS = 10000;

/* ==========================================
   ERRORES DE LA API
   ========================================== */

export class APIError extends Error {
    constructor(mensaje, status = 0) {
        super(mensaje);

        this.name = "APIError";
        this.status = status;
    }
}

/* ==========================================
   VALIDAR IDENTIFICADORES
   ========================================== */

function validarId(id, nombre) {
    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        throw new APIError(
            `${nombre} debe ser un entero positivo.`
        );
    }
}

/* ==========================================
   CLIENTE HTTP CENTRALIZADO
   ========================================== */

export async function solicitarAPI(
    ruta,
    {
        method = "GET",
        token = null,
        body = undefined,
        timeout = TIMEOUT_MS,
        signal = undefined
    } = {}
) {
    const controlador = new AbortController();

    const cancelarExterno = () => {
        controlador.abort();
    };

    if (signal) {
        if (signal.aborted) {
            controlador.abort();
        } else {
            signal.addEventListener(
                "abort",
                cancelarExterno,
                { once: true }
            );
        }
    }

    const temporizador = setTimeout(() => {
        controlador.abort();
    }, timeout);

    try {
        const headers = {
            "Accept": "application/json"
        };

        if (body !== undefined) {
            headers["Content-Type"] =
                "application/json";
        }

        if (token) {
            headers["Authorization"] =
                `Bearer ${token}`;
        }

        const respuesta = await fetch(
            `${API_BASE_URL}${ruta}`,
            {
                method,
                headers,
                body: body === undefined
                    ? undefined
                    : JSON.stringify(body),
                signal: controlador.signal,
                cache: "no-store"
            }
        );

        const texto = await respuesta.text();

        let datos = null;

        if (texto.trim()) {
            try {
                datos = JSON.parse(texto);
            } catch {
                throw new APIError(
                    "El servidor devolvió una respuesta JSON inválida.",
                    respuesta.status
                );
            }
        }

        if (!respuesta.ok) {
            if (respuesta.status === 401) {
                throw new APIError(
                    "Sesión no autorizada o expirada.",
                    401
                );
            }

            if (respuesta.status === 403) {
                throw new APIError(
                    "No tienes permiso para esta operación.",
                    403
                );
            }

            if (respuesta.status === 404) {
                throw new APIError(
                    "El recurso solicitado no existe.",
                    404
                );
            }

            if (respuesta.status === 409) {
                throw new APIError(
                    "La operación entra en conflicto con otra ejecución.",
                    409
                );
            }

            if (respuesta.status === 422) {
                throw new APIError(
                    "La API rechazó los datos enviados.",
                    422
                );
            }

            if (respuesta.status === 429) {
                throw new APIError(
                    "Demasiadas solicitudes. Intenta más tarde.",
                    429
                );
            }

            throw new APIError(
                `Error del servidor: HTTP ${respuesta.status}.`,
                respuesta.status
            );
        }

        return datos;

    } catch (error) {
        if (error instanceof APIError) {
            throw error;
        }

        if (error.name === "AbortError") {
            throw new APIError(
                "La solicitud fue cancelada o superó el tiempo de espera."
            );
        }

        throw new APIError(
            "No se pudo conectar con la API de AWS."
        );

    } finally {
        clearTimeout(temporizador);

        if (signal) {
            signal.removeEventListener(
                "abort",
                cancelarExterno
            );
        }
    }
}

/* ==========================================
   NORMALIZAR LISTADOS
   ========================================== */

export function normalizarLista(datos) {
    if (Array.isArray(datos)) {
        return datos;
    }

    if (
        datos &&
        typeof datos === "object" &&
        Array.isArray(datos.value)
    ) {
        return datos.value;
    }

    if (datos === null) {
        return [];
    }

    throw new APIError(
        "El servidor devolvió un listado no válido."
    );
}

/* ==========================================
   CONSULTAR VEHÍCULO
   GET /vehiculos/{id_vehiculo}
   ========================================== */

export async function consultarVehiculo(
    idVehiculo = ID_VEHICULO
) {
    validarId(idVehiculo, "id_vehiculo");

    return solicitarAPI(
        `/vehiculos/${idVehiculo}`
    );
}

/* ==========================================
   CONSULTAR COMANDOS DISPONIBLES
   GET /comandos/vehiculo/{id_vehiculo}
   ========================================== */

export async function consultarComandos(
    idVehiculo = ID_VEHICULO
) {
    validarId(idVehiculo, "id_vehiculo");

    const datos = await solicitarAPI(
        `/comandos/vehiculo/${idVehiculo}`
    );

    return normalizarLista(datos);
}

/* ==========================================
   OBTENER MAPA DE COMANDOS REALES
   ========================================== */

export function crearMapaComandos(lista) {
    if (!Array.isArray(lista)) {
        throw new APIError(
            "El catálogo de comandos no es válido."
        );
    }

    const mapa = new Map();

    for (const comando of lista) {
        if (
            !comando ||
            Number(comando.activo) !== 1 ||
            Number(comando.id_vehiculo) !== ID_VEHICULO
        ) {
            continue;
        }

        const id = Number(comando.id_comando);

        if (
            !Number.isInteger(id) ||
            id <= 0 ||
            typeof comando.nombre !== "string"
        ) {
            continue;
        }

        mapa.set(
            comando.nombre.trim().toUpperCase(),
            {
                id_comando: id,
                codigo: Number(comando.codigo),
                nombre: comando.nombre,
                activo: true
            }
        );
    }

    return mapa;
}

/* ==========================================
   ENVIAR MOVIMIENTO INDIVIDUAL
   POST /estado/movimiento

   Requiere JWT vigente.
   ========================================== */

export async function enviarMovimiento(
    idComando,
    token,
    signal = undefined
) {
    validarId(idComando, "id_comando");

    if (
        typeof token !== "string" ||
        !token
    ) {
        throw new APIError(
            "Se necesita una sesión JWT válida.",
            401
        );
    }

    return solicitarAPI(
        "/estado/movimiento",
        {
            method: "POST",
            token,
            signal,
            body: {
                id_vehiculo: ID_VEHICULO,
                id_comando: idComando,
                origen: "CONTROL_WEB"
            }
        }
    );
}

/* ==========================================
   CONSULTAR DEMO EXISTENTES
   GET /demos/vehiculo/{id_vehiculo}
   ========================================== */

export async function consultarDemos(
    idVehiculo = ID_VEHICULO
) {
    validarId(idVehiculo, "id_vehiculo");

    const datos = await solicitarAPI(
        `/demos/vehiculo/${idVehiculo}`
    );

    return normalizarLista(datos);
}

/* ==========================================
   CONSULTAR PASOS DE UNA DEMO
   GET /demos/{id_demo}/movimientos
   ========================================== */

export async function consultarMovimientosDemo(
    idDemo
) {
    validarId(idDemo, "id_demo");

    const datos = await solicitarAPI(
        `/demos/${idDemo}/movimientos`
    );

    return normalizarLista(datos);
}

/* ==========================================
   CONSULTAR EJECUCIÓN ACTUAL
   GET /demos/ejecucion/{id_vehiculo}
   ========================================== */

export async function consultarEjecucionDemo(
    idVehiculo = ID_VEHICULO
) {
    validarId(idVehiculo, "id_vehiculo");

    return solicitarAPI(
        `/demos/ejecucion/${idVehiculo}`
    );
}

/* ==========================================
   EJECUTAR DEMO EXISTENTE
   POST /demos/ejecutar

   La secuencia y tiempos son gestionados
   exclusivamente por el backend.
   ========================================== */

export async function ejecutarDemo(
    idDemo,
    token
) {
    validarId(idDemo, "id_demo");

    if (
        typeof token !== "string" ||
        !token
    ) {
        throw new APIError(
            "Se necesita una sesión JWT válida.",
            401
        );
    }

    return solicitarAPI(
        "/demos/ejecutar",
        {
            method: "POST",
            token,
            body: {
                id_vehiculo: ID_VEHICULO,
                id_demo: idDemo
            }
        }
    );
}

/* ==========================================
   CANCELAR DEMO
   POST /demos/cancelar/{id_vehiculo}
   ========================================== */

export async function cancelarDemo(
    token,
    idVehiculo = ID_VEHICULO
) {
    validarId(idVehiculo, "id_vehiculo");

    if (
        typeof token !== "string" ||
        !token
    ) {
        throw new APIError(
            "Se necesita una sesión JWT válida.",
            401
        );
    }

    return solicitarAPI(
        `/demos/cancelar/${idVehiculo}`,
        {
            method: "POST",
            token
        }
    );
}
