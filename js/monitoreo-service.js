
"use strict";

/*
 * EXCAVADORA-ARMO
 * Practica 4.2 - Servicio de MONITOREO
 *
 * Consulta datos reales mediante FastAPI.
 * No envia movimientos ni modifica RDS.
 */

import {
    solicitarAPI,
    normalizarLista
} from "./api-client.js";

const VEHICULO_ID = 1;
const LIMITE_HISTORIAL = 10;

function validarVehiculo(idVehiculo) {
    if (
        !Number.isInteger(idVehiculo) ||
        idVehiculo <= 0
    ) {
        throw new Error("Identificador de vehículo inválido.");
    }
}

// GET: ultimo estado del vehiculo
export async function obtenerUltimoEstado(
    idVehiculo = VEHICULO_ID
) {
    validarVehiculo(idVehiculo);

    const estado = await solicitarAPI(
        `/estado/vehiculo/${idVehiculo}`
    );

    if (
        !estado ||
        typeof estado !== "object" ||
        Array.isArray(estado) ||
        Number(estado.id_vehiculo) !== idVehiculo
    ) {
        throw new Error("Respuesta de estado no válida.");
    }

    return estado;
}

// Ordenar por fecha real y desempatar por ID.
function compararRecientes(a, b) {
    const fechaA =
        typeof a.fecha_hora === "string"
            ? a.fecha_hora : "";

    const fechaB =
        typeof b.fecha_hora === "string"
            ? b.fecha_hora : "";

    if (fechaA !== fechaB) {
        return fechaB.localeCompare(fechaA);
    }

    return Number(b.id_historial) -
           Number(a.id_historial);
}

// GET: ultimos diez movimientos persistidos
export async function obtenerUltimosMovimientos(
    idVehiculo = VEHICULO_ID
) {
    validarVehiculo(idVehiculo);

    const datos = await solicitarAPI(
        `/historial/vehiculo/${idVehiculo}`
    );

    const registros = normalizarLista(datos);
    const identificadores = new Set();

    return registros
        .filter(registro => {
            if (
                !registro ||
                Number(registro.id_vehiculo) !== idVehiculo
            ) {
                return false;
            }

            const id = Number(registro.id_historial);

            if (
                !Number.isInteger(id) ||
                id <= 0 ||
                identificadores.has(id)
            ) {
                return false;
            }

            identificadores.add(id);
            return true;
        })
        .sort(compararRecientes)
        .slice(0, LIMITE_HISTORIAL);
}
