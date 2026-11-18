
"use strict";

/*
 * EXCAVADORA-ARMO - Práctica 4.3
 * CONTROL de compradores - Simulación segura
 *
 * - Utiliza el JWT del comprador.
 * - Consulta únicamente comandos autorizados.
 * - Valida los comandos desde FastAPI.
 * - NO ejecuta movimientos físicos.
 */

(() => {
  const API = "https://vehiculo-iot.duckdns.org/v43";

  const panelVehiculos =
    document.getElementById("panelVehiculos");

  const selector =
    document.getElementById("selectorVehiculo");

  if (!panelVehiculos || !selector) {
    console.error("No se encontró el panel del comprador.");
    return;
  }

  // Crear panel de CONTROL
  const panel = document.createElement("section");

  panel.className = "vehiculo oculto";
  panel.id = "panelControlSimulacion";

  panel.innerHTML = `
    <h2>CONTROL — Simulación segura</h2>

    <p>
      Comandos autorizados para este vehículo.
      Ningún botón ejecuta movimientos físicos.
    </p>

    <div id="comandosSimulacion"
         style="
           display: flex;
           flex-wrap: wrap;
           gap: 8px;
           margin-top: 15px;
         ">
    </div>

    <p id="mensajeSimulacion"
       class="mensaje"
       role="status">
    </p>
  `;

  panelVehiculos.appendChild(panel);

  const contenedor =
    document.getElementById("comandosSimulacion");

  const mensaje =
    document.getElementById("mensajeSimulacion");

  let vehiculoCargado = null;
  let generacion = 0;

  function obtenerToken() {
    try {
      return typeof tokenComprador === "string"
        ? tokenComprador
        : null;
    } catch {
      return null;
    }
  }

  function vehiculoSeleccionado() {
    const id = Number(selector.value);

    return Number.isInteger(id) && id > 0
      ? id
      : null;
  }

  function sesionVisible() {
    return !panelVehiculos.classList.contains("oculto");
  }

  function ocultarControl() {
    generacion++;
    vehiculoCargado = null;
    panel.classList.add("oculto");
    contenedor.replaceChildren();
    mensaje.textContent = "";
  }

  async function cargarComandos() {
    const token = obtenerToken();
    const idVehiculo = vehiculoSeleccionado();

    if (!token || !idVehiculo || !sesionVisible()) {
      ocultarControl();
      return;
    }

    if (vehiculoCargado === idVehiculo) {
      return;
    }

    const actual = ++generacion;

    panel.classList.remove("oculto");
    contenedor.replaceChildren();

    mensaje.textContent = "Consultando comandos permitidos...";

    try {
      const respuesta = await fetch(
        `${API}/usuario/vehiculos/${idVehiculo}/comandos-permitidos`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          },
          cache: "no-store"
        }
      );

      if (!respuesta.ok) {
        throw new Error(
          `No se pudieron cargar los comandos (${respuesta.status}).`
        );
      }

      const comandos = await respuesta.json();

      if (actual !== generacion) {
        return;
      }

      if (!Array.isArray(comandos)) {
        throw new Error("Respuesta de comandos inválida.");
      }

      vehiculoCargado = idVehiculo;

      if (comandos.length === 0) {
        mensaje.textContent =
          "Este vehículo no tiene comandos habilitados.";
        return;
      }

      for (const comando of comandos) {
        const boton = document.createElement("button");

        boton.type = "button";
        boton.textContent = comando.nombre;
        boton.style.margin = "4px";
        boton.style.padding = "12px 16px";

        boton.addEventListener("click", async () => {
          if (
            !obtenerToken() ||
            vehiculoSeleccionado() !== idVehiculo ||
            !sesionVisible()
          ) {
            mensaje.textContent =
              "Sesión o vehículo no válido.";
            return;
          }

          boton.disabled = true;

          mensaje.textContent =
            `Validando ${comando.nombre}...`;

          try {
            const duracion = Math.min(
              200,
              Number(comando.duracion_maxima_ms) || 200
            );

            const respuestaValidacion = await fetch(
              `${API}/usuario/vehiculos/${idVehiculo}/validar-comando`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${obtenerToken()}`
                },
                body: JSON.stringify({
                  codigo_comando: comando.codigo,
                  duracion_ms: duracion
                })
              }
            );

            if (!respuestaValidacion.ok) {
              throw new Error(
                `Comando rechazado (${respuestaValidacion.status}).`
              );
            }

            const resultado =
              await respuestaValidacion.json();

            if (
              vehiculoSeleccionado() !== idVehiculo ||
              !sesionVisible()
            ) {
              return;
            }

            mensaje.textContent =
              `${resultado.comando}: validado. ` +
              "Ejecutado físicamente: NO.";

          } catch (error) {
            mensaje.textContent = error.message;
          } finally {
            boton.disabled = false;
          }
        });

        contenedor.appendChild(boton);
      }

      mensaje.textContent =
        `${comandos.length} comandos disponibles para simulación.`;

    } catch (error) {
      if (actual !== generacion) {
        return;
      }

      vehiculoCargado = null;
      mensaje.textContent = error.message;
    }
  }

  // Detectar cuando se inicia o cierra sesión
  const observador = new MutationObserver(() => {
    if (sesionVisible()) {
      cargarComandos();
    } else {
      ocultarControl();
    }
  });

  observador.observe(panelVehiculos, {
    attributes: true,
    attributeFilter: ["class"]
  });

  // Detectar cambio de vehículo
  selector.addEventListener("change", () => {
    vehiculoCargado = null;
    cargarComandos();
  });

  // Detectar cuando se actualiza el selector
  const observadorSelector = new MutationObserver(() => {
    if (sesionVisible() && vehiculoSeleccionado()) {
      vehiculoCargado = null;
      cargarComandos();
    }
  });

  observadorSelector.observe(selector, {
    childList: true
  });

})();
