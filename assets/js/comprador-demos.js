
"use strict";

/*
 * EXCAVADORA-ARMO - PRACTICA 4.3
 * DEMOS privadas del comprador.
 * Solo consulta movimientos.
 * Nunca envia comandos fisicos.
 */

(() => {
  const API = "https://vehiculo-iot.duckdns.org/v43";

  const panelVehiculos =
    document.getElementById("panelVehiculos");

  const selector =
    document.getElementById("selectorVehiculo");

  if (!panelVehiculos || !selector) {
    return;
  }

  const panel = document.createElement("section");
  panel.className = "vehiculo";
  panel.hidden = true;

  const titulo = document.createElement("h3");
  titulo.textContent = "Mis DEMOS disponibles";

  const descripcion = document.createElement("p");
  descripcion.textContent =
    "Demostraciones autorizadas para tu vehículo. " +
    "Consulta de solo lectura.";

  const botonActualizar = document.createElement("button");
  botonActualizar.type = "button";
  botonActualizar.textContent = "Actualizar DEMOS";

  const mensaje = document.createElement("p");
  mensaje.setAttribute("role", "status");

  const lista = document.createElement("div");

  panel.append(
    titulo,
    descripcion,
    botonActualizar,
    mensaje,
    lista
  );

  panelVehiculos.appendChild(panel);

  let consultaActual = 0;
  let ultimoVehiculo = null;
  let ultimoToken = null;

  function tokenActual() {
    try {
      return typeof tokenComprador === "string"
        ? tokenComprador
        : null;
    } catch {
      return null;
    }
  }

  function sesionActiva() {
    return !panelVehiculos.classList.contains("oculto");
  }

  function limpiar() {
    consultaActual++;
    ultimoVehiculo = null;
    ultimoToken = null;
    panel.hidden = true;
    lista.replaceChildren();
    mensaje.textContent = "";
  }

  async function pedirJSON(url, token) {
    const respuesta = await fetch(url, {
      headers: {
        Authorization: "Bearer " + token
      },
      cache: "no-store"
    });

    if (respuesta.status === 401) {
      throw new Error("Tu sesión venció. Inicia sesión nuevamente.");
    }

    if (respuesta.status === 403) {
      throw new Error(
        "No tienes permiso para consultar estas DEMOS."
      );
    }

    if (!respuesta.ok) {
      throw new Error(
        "No fue posible consultar las DEMOS (" +
        respuesta.status + ")."
      );
    }

    return respuesta.json();
  }

  async function verMovimientos(idVehiculo, idDemo, contenedor) {
    const token = tokenActual();

    if (!token) return;

    const consulta = consultaActual;

    contenedor.replaceChildren();
    contenedor.textContent = "Consultando movimientos...";

    try {
      const datos = await pedirJSON(
        API +
        "/usuario/vehiculos/" +
        idVehiculo +
        "/demos/" +
        idDemo +
        "/movimientos",
        token
      );

      if (
        consulta !== consultaActual ||
        token !== tokenActual() ||
        Number(selector.value) !== idVehiculo
      ) {
        return;
      }

      contenedor.replaceChildren();

      if (
        !Array.isArray(datos.movimientos) ||
        datos.movimientos.length === 0
      ) {
        contenedor.textContent =
          "Esta DEMO todavía no tiene movimientos.";
        return;
      }

      const elementos = document.createElement("ol");

      for (const movimiento of datos.movimientos) {
        const elemento = document.createElement("li");

        elemento.textContent =
          movimiento.comando +
          " | Duración: " +
          movimiento.duracion_ms +
          " ms | Pausa: " +
          movimiento.pausa_ms +
          " ms";

        elemento.style.margin = "8px 0";
        elementos.appendChild(elemento);
      }

      contenedor.appendChild(elementos);

    } catch (error) {
      if (consulta === consultaActual) {
        contenedor.textContent = error.message;
      }
    }
  }

  async function cargarDemos(forzar = false) {
    const token = tokenActual();
    const idVehiculo = Number(selector.value);

    if (
      !sesionActiva() ||
      !token ||
      !Number.isInteger(idVehiculo) ||
      idVehiculo <= 0
    ) {
      limpiar();
      return;
    }

    if (
      !forzar &&
      ultimoVehiculo === idVehiculo &&
      ultimoToken === token
    ) {
      return;
    }

    ultimoVehiculo = idVehiculo;
    ultimoToken = token;

    const consulta = ++consultaActual;

    panel.hidden = false;
    lista.replaceChildren();
    mensaje.textContent = "Cargando DEMOS...";

    try {
      const demos = await pedirJSON(
        API +
        "/usuario/vehiculos/" +
        idVehiculo +
        "/demos",
        token
      );

      if (
        consulta !== consultaActual ||
        token !== tokenActual() ||
        idVehiculo !== Number(selector.value)
      ) {
        return;
      }

      mensaje.textContent = "";

      if (!Array.isArray(demos)) {
        throw new Error("Respuesta de DEMOS no válida.");
      }

      if (demos.length === 0) {
        mensaje.textContent =
          "No hay demostraciones disponibles para este vehículo.";
        return;
      }

      for (const demo of demos) {
        const tarjeta = document.createElement("div");
        tarjeta.className = "vehiculo";

        const nombre = document.createElement("h3");
        nombre.textContent = demo.nombre;

        const detalle = document.createElement("p");
        detalle.textContent =
          demo.descripcion || "Sin descripción";

        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = "Ver movimientos";

        const movimientos = document.createElement("div");

        boton.addEventListener("click", () => {
          verMovimientos(
            idVehiculo,
            demo.id_demo,
            movimientos
          );
        });

        tarjeta.append(
          nombre,
          detalle,
          boton,
          movimientos
        );

        lista.appendChild(tarjeta);
      }

      mensaje.textContent =
        "DEMOS disponibles: " + demos.length;

    } catch (error) {
      if (consulta === consultaActual) {
        mensaje.textContent = error.message;
      }
    }
  }

  selector.addEventListener("change", () => {
    cargarDemos(true);
  });

  botonActualizar.addEventListener("click", () => {
    cargarDemos(true);
  });

  const observador = new MutationObserver(() => {
    cargarDemos();
  });

  observador.observe(selector, {
    childList: true
  });

  observador.observe(panelVehiculos, {
    attributes: true,
    attributeFilter: ["class"]
  });

  window.addEventListener("pagehide", limpiar);

  cargarDemos();
})();
