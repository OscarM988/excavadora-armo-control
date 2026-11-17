
"use strict";

/*
 * EXCAVADORA-ARMO 4.3
 * WebSocket protegido del comprador.
 * Solo recibe estados. No envia comandos.
 */

(() => {
  const panelVehiculos =
    document.getElementById("panelVehiculos");

  const selector =
    document.getElementById("selectorVehiculo");

  if (!panelVehiculos || !selector) return;

  const panel = document.createElement("section");
  panel.className = "vehiculo";
  panel.hidden = true;

  const titulo = document.createElement("h3");
  titulo.textContent = "WebSocket protegido";

  const estado = document.createElement("p");
  estado.textContent = "Desconectado";

  panel.append(titulo, estado);
  panelVehiculos.appendChild(panel);

  let socket = null;
  let vehiculoActual = null;

  function token() {
    try {
      return typeof tokenComprador === "string"
        ? tokenComprador
        : null;
    } catch {
      return null;
    }
  }

  function cerrar() {
    if (socket) {
      const anterior = socket;
      socket = null;
      anterior.close();
    }

    vehiculoActual = null;
  }

  function conectar() {
    const idVehiculo = Number(selector.value);

    const visible =
      !panelVehiculos.classList.contains("oculto");

    if (
      !visible ||
      !token() ||
      !Number.isInteger(idVehiculo) ||
      idVehiculo <= 0
    ) {
      cerrar();
      panel.hidden = true;
      return;
    }

    if (
      socket &&
      vehiculoActual === idVehiculo &&
      socket.readyState !== WebSocket.CLOSED
    ) {
      return;
    }

    cerrar();

    panel.hidden = false;
    estado.textContent = "Conectando...";

    vehiculoActual = idVehiculo;

    const ws = new WebSocket(
      `wss://vehiculo-iot.duckdns.org/v43/ws/usuario/vehiculos/${idVehiculo}`
    );

    socket = ws;

    ws.onopen = () => {
      if (socket !== ws) return;

      ws.send(JSON.stringify({
        token: token()
      }));
    };

    ws.onmessage = evento => {
      if (socket !== ws) return;

      try {
        const datos = JSON.parse(evento.data);

        if (datos.tipo !== "estado_comprador") {
          return;
        }

        if (!datos.estado) {
          estado.textContent = "Sin estado registrado.";
          return;
        }

        estado.textContent =
          "Movimiento: " +
          (datos.estado.comando || "Sin datos") +
          " | Fecha: " +
          (datos.estado.fecha_actualizacion || "Sin datos");

      } catch {
        estado.textContent = "Respuesta no válida.";
      }
    };

    ws.onclose = () => {
      if (socket !== ws) return;

      socket = null;
      vehiculoActual = null;
      estado.textContent = "WebSocket desconectado.";
    };

    ws.onerror = () => {
      if (socket === ws) {
        estado.textContent = "Error de conexión WebSocket.";
      }
    };
  }

  selector.addEventListener("change", conectar);

  const observador = new MutationObserver(conectar);

  observador.observe(selector, {
    childList: true
  });

  observador.observe(panelVehiculos, {
    attributes: true,
    attributeFilter: ["class"]
  });

  window.addEventListener("pagehide", cerrar);
})();
