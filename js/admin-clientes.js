"use strict";

/*
 EXCAVADORA-ARMO
 Practica 4.3 - Clientes y Asignaciones

 Datos temporales en memoria.
 No se crean cuentas ni se modifica Amazon RDS.
*/

(() => {
  const clientes = [];
  const asignaciones = [];

  function elemento(id) {
    return document.getElementById(id);
  }

  function mensaje(texto) {
    const destino = elemento("mensajeGlobal");
    if (destino) destino.textContent = texto;
  }

  function crearCelda(fila, texto) {
    const celda = document.createElement("td");
    celda.textContent = String(texto);
    fila.appendChild(celda);
  }

  function agregarFormularioClientes() {
    const panel = document.querySelector("#clientes .panel");

    if (!panel || elemento("formCliente")) return;

    panel.insertAdjacentHTML("afterbegin", `
      <form id="formCliente" class="form-clientes" hidden>
        <h3>Registrar comprador</h3>

        <div class="clientes-grid">
          <div class="clientes-campo">
            <label for="clienteNombre">Nombre completo</label>
            <input id="clienteNombre" name="nombre"
                   maxlength="120" required>
          </div>

          <div class="clientes-campo">
            <label for="clienteCorreo">Correo electrónico</label>
            <input id="clienteCorreo" name="correo"
                   type="email" maxlength="150" required>
          </div>

          <div class="clientes-campo">
            <label for="clienteEstado">Estado</label>
            <select id="clienteEstado" name="estado">
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>

        <p class="clientes-nota">
          Borrador local. No crea una cuenta de usuario
          ni almacena información en RDS.
        </p>

        <div class="clientes-acciones">
          <button class="accion" type="submit">
            Agregar borrador
          </button>
          <button class="clientes-cancelar" type="button"
                  data-cancelar-cliente>
            Cancelar
          </button>
        </div>
      </form>
    `);
  }

  function agregarFormularioAsignaciones() {
    const panel = document.querySelector("#asignaciones .panel");

    if (!panel || elemento("formAsignacion")) return;

    panel.insertAdjacentHTML("afterbegin", `
      <form id="formAsignacion" class="form-clientes" hidden>
        <h3>Asignar unidad a comprador</h3>

        <div class="clientes-grid">
          <div class="clientes-campo">
            <label for="asignarCliente">Comprador</label>
            <select id="asignarCliente" required>
              <option value="">Seleccione un comprador</option>
            </select>
          </div>

          <div class="clientes-campo">
            <label for="asignarUnidad">Unidad IoT</label>
            <select id="asignarUnidad" required>
              <option value="">Seleccione una unidad</option>
            </select>
          </div>
        </div>

        <p class="clientes-nota">
          Asignación de prueba en memoria. No cambia
          el propietario real ni los permisos del vehículo.
        </p>

        <div class="clientes-acciones">
          <button class="accion" type="submit">
            Agregar asignación de prueba
          </button>
          <button class="clientes-cancelar" type="button"
                  data-cancelar-asignacion>
            Cancelar
          </button>
        </div>
      </form>
    `);
  }

  function dibujarClientes() {
    const tabla = elemento("tablaClientes");
    if (!tabla) return;

    tabla.replaceChildren();

    if (!clientes.length) {
      const fila = tabla.insertRow();
      const celda = fila.insertCell();
      celda.colSpan = 5;
      celda.className = "vacio";
      celda.textContent = "Sin datos disponibles";
      return;
    }

    clientes.forEach(cliente => {
      const fila = document.createElement("tr");

      crearCelda(fila, "Local");
      crearCelda(fila, cliente.nombre);
      crearCelda(fila, cliente.correo);
      crearCelda(fila, cliente.estado);
      crearCelda(fila, "Borrador");

      tabla.appendChild(fila);
    });
  }

  function obtenerUnidadesLocales() {
    const filas = Array.from(
      document.querySelectorAll("#tablaVehiculos tr")
    );

    return filas.filter(fila => {
      const celdas = fila.querySelectorAll("td");
      return celdas.length >= 6 &&
        celdas[0].textContent.trim() === "Local" &&
        celdas[5].textContent.trim() === "Borrador";
    }).map(fila => {
      const celdas = fila.querySelectorAll("td");

      return {
        identificador: celdas[1].textContent.trim(),
        estado: celdas[3].textContent.trim()
      };
    });
  }

  function agregarOpcion(select, valor, etiqueta) {
    const opcion = document.createElement("option");
    opcion.value = valor;
    opcion.textContent = etiqueta;
    select.appendChild(opcion);
  }

  function cargarSelectores() {
    const selectClientes = elemento("asignarCliente");
    const selectUnidades = elemento("asignarUnidad");

    selectClientes.replaceChildren();
    selectUnidades.replaceChildren();

    agregarOpcion(selectClientes, "", "Seleccione un comprador");
    agregarOpcion(selectUnidades, "", "Seleccione una unidad");

    clientes.filter(cliente =>
      cliente.estado === "activo"
    ).forEach(cliente => {
      agregarOpcion(
        selectClientes,
        cliente.correo,
        `${cliente.nombre} (${cliente.correo})`
      );
    });

    obtenerUnidadesLocales()
      .filter(unidad =>
        unidad.estado === "disponible" &&
        !asignaciones.some(asignacion =>
          asignacion.unidad === unidad.identificador
        )
      )
      .forEach(unidad => {
        agregarOpcion(
          selectUnidades,
          unidad.identificador,
          unidad.identificador
        );
      });
  }

  function registrarCliente(evento) {
    evento.preventDefault();

    const formulario = evento.currentTarget;
    if (!formulario.reportValidity()) return;

    const nombre = elemento("clienteNombre").value.trim();
    const correo = elemento("clienteCorreo")
      .value.trim().toLowerCase();
    const estado = elemento("clienteEstado").value;

    if (!nombre || !correo) return;

    if (clientes.some(cliente => cliente.correo === correo)) {
      mensaje("Ya existe un borrador con ese correo.");
      return;
    }

    clientes.push({ nombre, correo, estado });

    dibujarClientes();
    formulario.reset();
    formulario.hidden = true;

    mensaje("Comprador agregado como borrador local.");
  }

  function dibujarAsignaciones() {
    const tabla = elemento("tablaAsignaciones");

    tabla.replaceChildren();

    if (!asignaciones.length) {
      const fila = tabla.insertRow();
      const celda = fila.insertCell();
      celda.colSpan = 4;
      celda.className = "vacio";
      celda.textContent = "Sin datos disponibles";
      return;
    }

    asignaciones.forEach(asignacion => {
      const fila = document.createElement("tr");

      crearCelda(fila, asignacion.unidad);
      crearCelda(fila, asignacion.cliente);
      crearCelda(fila, "No registrada");
      crearCelda(fila, "Borrador local");

      tabla.appendChild(fila);
    });
  }

  function registrarAsignacion(evento) {
    evento.preventDefault();

    const formulario = evento.currentTarget;

    const correo = elemento("asignarCliente").value;
    const identificador = elemento("asignarUnidad").value;

    const cliente = clientes.find(c =>
      c.correo === correo && c.estado === "activo"
    );

    const unidad = obtenerUnidadesLocales().find(u =>
      u.identificador === identificador &&
      u.estado === "disponible"
    );

    if (!cliente || !unidad) {
      mensaje("Seleccione un comprador y una unidad disponibles.");
      return;
    }

    if (asignaciones.some(a => a.unidad === identificador)) {
      mensaje("La unidad ya tiene una asignación local.");
      return;
    }

    asignaciones.push({
      cliente: cliente.nombre,
      unidad: identificador
    });

    dibujarAsignaciones();

    formulario.reset();
    formulario.hidden = true;

    mensaje("Asignación creada como borrador local.");
  }

  function abrirFormulario(id) {
    const formulario = elemento(id);
    if (!formulario) return;

    if (id === "formAsignacion") cargarSelectores();

    formulario.hidden = false;
    formulario.querySelector("input, select")?.focus();

    mensaje("Formulario de prueba abierto.");
  }

  function iniciar() {
    agregarFormularioClientes();
    agregarFormularioAsignaciones();

    elemento("formCliente")
      ?.addEventListener("submit", registrarCliente);

    elemento("formAsignacion")
      ?.addEventListener("submit", registrarAsignacion);

    document.querySelectorAll("[data-accion]")
      .forEach(boton => {
        const accion = boton.dataset.accion;

        if (!["crear-cliente", "asignar-unidad"]
          .includes(accion)) return;

        boton.addEventListener("click", evento => {
          evento.preventDefault();
          evento.stopImmediatePropagation();

          abrirFormulario(
            accion === "crear-cliente"
              ? "formCliente"
              : "formAsignacion"
          );
        }, true);
      });

    document.querySelector("[data-cancelar-cliente]")
      ?.addEventListener("click", () => {
        elemento("formCliente").reset();
        elemento("formCliente").hidden = true;
      });

    document.querySelector("[data-cancelar-asignacion]")
      ?.addEventListener("click", () => {
        elemento("formAsignacion").reset();
        elemento("formAsignacion").hidden = true;
      });

    console.info("Clientes y Asignaciones 4.3 preparados.");
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded", iniciar, { once: true }
    );
  } else {
    iniciar();
  }
})();
