
"use strict";

/*
 * EXCAVADORA-ARMO
 * Práctica 4.1 - Coordinación de control
 *
 * No ejecuta órdenes automáticamente.
 * DETENER tiene prioridad en el navegador.
 *
 * No conectar ESP8266 ni motores en esta práctica.
 */

import {
    crearMapaComandos,
    enviarMovimiento
} from "./api-client.js";

const DIRECCIONES = Object.freeze({
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
});

const EXTRAS = new Set([
    "MUSICA",
    "CAMBIAR_VELOCIDAD",
    "LUZ_LED"
]);

const NECESARIOS = [
    ...new Set([
        ...Object.values(DIRECCIONES.direccion),
        ...Object.values(DIRECCIONES.brazo),
        ...EXTRAS,
        "DETENER"
    ])
];

export class CoordinadorControl {

    constructor({
        obtenerToken,
        informar = () => {}
    }) {
        if (typeof obtenerToken !== "function") {
            throw new TypeError("Falta obtenerToken.");
        }

        this.obtenerToken = obtenerToken;
        this.informar = informar;

        this.comandos = new Map();

        this.catalogoListo = false;
        this.habilitado = false;
        this.demoActiva = false;

        this.enviando = false;
        this.pendiente = null;
        this.ultimoSolicitado = null;

        this.secuencia = 0;
        this.detencionEnCurso = null;
    }

    cargarCatalogo(lista) {
        this.bloquear();

        this.comandos = crearMapaComandos(lista);

        const faltantes = NECESARIOS.filter(
            nombre => !this.comandos.has(nombre)
        );

        this.catalogoListo = faltantes.length === 0;

        this.informar({
            etapa: this.catalogoListo
                ? "catalogo_listo"
                : "catalogo_incompleto",
            faltantes
        });

        return {
            listo: this.catalogoListo,
            faltantes
        };
    }

    habilitar() {
        if (
            !this.catalogoListo ||
            this.demoActiva ||
            this.detencionEnCurso ||
            this.enviando
        ) {
            throw new Error(
                "Control no disponible todavía."
            );
        }

        if (!this.obtenerToken()) {
            throw new Error(
                "Sesión JWT no disponible."
            );
        }

        this.habilitado = true;

        this.informar({
            etapa: "control_habilitado"
        });
    }

    bloquear() {
        this.habilitado = false;
        this.pendiente = null;
        this.ultimoSolicitado = null;

        this.secuencia++;

        // No revierte solicitudes ya recibidas por AWS.
    }

    establecerDemoActiva(activa) {
        this.demoActiva = Boolean(activa);

        this.pendiente = null;
        this.ultimoSolicitado = null;

        this.secuencia++;
    }

    mover(joystick, direccion) {
        if (direccion === "neutral") {
            return this.detener();
        }

        if (
            !this.habilitado ||
            this.demoActiva ||
            this.detencionEnCurso
        ) {
            return false;
        }

        const nombre =
            DIRECCIONES[joystick]?.[direccion];

        if (!nombre || !this.comandos.has(nombre)) {
            return false;
        }

        // Evitar duplicados del mismo movimiento.

        if (
            nombre === this.pendiente ||
            (
                nombre === this.ultimoSolicitado &&
                this.pendiente === null
            )
        ) {
            return false;
        }

        // Solo conservar la última dirección solicitada.

        this.pendiente = nombre;

        void this.procesarPendientes();

        return true;
    }

    async procesarPendientes() {
        if (
            this.enviando ||
            this.detencionEnCurso
        ) {
            return;
        }

        this.enviando = true;

        try {
            while (
                this.habilitado &&
                !this.demoActiva &&
                !this.detencionEnCurso &&
                this.pendiente !== null
            ) {
                const nombre = this.pendiente;

                this.pendiente = null;

                const comando =
                    this.comandos.get(nombre);

                const version = this.secuencia;

                this.ultimoSolicitado = nombre;

                this.informar({
                    etapa: "solicitado",
                    nombre
                });

                try {
                    const respuesta =
                        await enviarMovimiento(
                            comando.id_comando,
                            this.obtenerToken()
                        );

                    // Ignorar respuestas anteriores a DETENER.

                    if (version === this.secuencia) {
                        this.informar({
                            etapa: "aceptado_por_api",
                            nombre,
                            respuesta
                        });
                    }

                } catch (error) {
                    if (version === this.secuencia) {
                        this.ultimoSolicitado = null;

                        this.informar({
                            etapa: "error",
                            nombre,
                            mensaje: error.message
                        });
                    }
                }
            }

        } finally {
            this.enviando = false;

            if (
                this.habilitado &&
                !this.detencionEnCurso &&
                !this.demoActiva &&
                this.pendiente !== null
            ) {
                void this.procesarPendientes();
            }
        }
    }

    detener({ forzar = false } = {}) {
        // Compartir la solicitud si ya se está deteniendo.

        if (this.detencionEnCurso) {
            return this.detencionEnCurso;
        }

        if (
            !this.catalogoListo ||
            !this.obtenerToken()
        ) {
            return Promise.resolve(false);
        }

        if (!forzar && !this.habilitado) {
            return Promise.resolve(false);
        }

        if (
            !forzar &&
            !this.enviando &&
            !this.ultimoSolicitado &&
            !this.pendiente
        ) {
            return Promise.resolve(false);
        }

        // DETENER no espera la cola normal.

        this.secuencia++;
        this.pendiente = null;
        this.ultimoSolicitado = null;

        this.informar({
            etapa: "solicitado",
            nombre: "DETENER"
        });

        const parada = (async () => {
            try {
                const respuesta =
                    await enviarMovimiento(
                        this.comandos.get("DETENER").id_comando,
                        this.obtenerToken()
                    );

                this.informar({
                    etapa: "aceptado_por_api",
                    nombre: "DETENER",
                    respuesta
                });

                return true;

            } catch (error) {
                this.informar({
                    etapa: "error",
                    nombre: "DETENER",
                    mensaje: error.message
                });

                return false;
            }
        })();

        this.detencionEnCurso = parada;

        void parada.finally(() => {
            if (this.detencionEnCurso === parada) {
                this.detencionEnCurso = null;
            }
        });

        return parada;
    }

    async extra(nombre) {
        if (
            !this.habilitado ||
            this.demoActiva ||
            this.enviando ||
            this.pendiente ||
            this.detencionEnCurso ||
            !EXTRAS.has(nombre)
        ) {
            return false;
        }

        const comando = this.comandos.get(nombre);

        if (!comando) {
            return false;
        }

        const version = this.secuencia;

        this.enviando = true;

        this.informar({
            etapa: "solicitado",
            nombre
        });

        try {
            const respuesta =
                await enviarMovimiento(
                    comando.id_comando,
                    this.obtenerToken()
                );

            if (version === this.secuencia) {
                this.informar({
                    etapa: "aceptado_por_api",
                    nombre,
                    respuesta
                });
            }

            return version === this.secuencia;

        } catch (error) {
            if (version === this.secuencia) {
                this.informar({
                    etapa: "error",
                    nombre,
                    mensaje: error.message
                });
            }

            return false;

        } finally {
            this.enviando = false;
        }
    }
}
