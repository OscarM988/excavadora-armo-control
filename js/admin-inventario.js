"use strict";

/*
 EXCAVADORA-ARMO
 Practica 4.3 - Modelos y Unidades

 Esta etapa crea borradores en memoria.
 No escribe en AWS ni Amazon RDS.
*/

const borradoresModelos = [];
const borradoresUnidades = [];

function escaparHTML(valor) {
  return String(valor).replace(/[&<>"']/g, caracter => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caracter]);
}

function informar(texto) {
  const mensaje = document.getElementById("mensajeGlobal");
  if (mensaje) {
    mensaje.textContent = texto;
  }
}

function crearFormularios() {
  const panelModelos = document.querySelector("#modelos .panel");
  const panelUnidades = document.querySelector("#vehiculos .panel");

  if (!panelModelos || !panelUnidades) return;

  panelModelos.insertAdjacentHTML("afterbegin", `
    <form id="formModelo" class="form-admin" hidden>
      <h3>Registrar modelo comercial</h3>

      <div class="form-grid">
        <div class="campo-admin">
          <label for="nombreModelo">Nombre del modelo</label>
          <input id="nombreModelo" name="nombre"
                 maxlength="100" required
                 placeholder="Nombre comercial">
        </div>

        <div class="campo-admin">
          <label for="codigoModelo">Código del modelo</label>
          <input id="codigoModelo" name="codigo"
                 maxlength="40" required
                 pattern="[A-Za-z0-9_-]+"
                 placeholder="Codigo unico">
        </div>

        <div class="campo-admin">
          <label for="descripcionModelo">Descripción</label>
          <textarea id="descripcionModelo"
                    name="descripcion"
                    maxlength="500" rows="3"></textarea>
        </div>

        <div class="campo-admin">
          <label for="estadoModelo">Estado</label>
          <select id="estadoModelo" name="estado">
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
      </div>

      <p class="advertencia-admin">
        Vista previa local. No se guarda en RDS.
      </p>

      <div class="form-acciones">
        <button class="accion" type="submit">
          Agregar borrador
        </button>
        <button class="btn-secundario"
                type="button"
                data-cerrar="formModelo">
          Cancelar
        </button>
      </div>
    </form>
  `);

  panelUnidades.insertAdjacentHTML("afterbegin", `
    <form id="formUnidad" class="form-admin" hidden>
      <h3>Registrar unidad IoT</h3>

      <div class="form-grid">
        <div class="campo-admin">
          <label for="identificadorUnidad">
            Identificador único
          </label>
          <input id="identificadorUnidad"
                 name="identificador"
                 maxlength="60"
                 pattern="[A-Za-z0-9_-]+"
                 required
                 placeholder="Numero de serie">
        </div>

        <div class="campo-admin">
          <label for="modeloUnidad">Modelo comercial</label>
          <select id="modeloUnidad" name="modelo" required>
            <option value="">Seleccione un modelo</option>
          </select>
        </div>

        <div class="campo-admin">
          <label for="estadoUnidad">Estado comercial</label>
          <select id="estadoUnidad" name="estado">
            <option value="disponible">Disponible</option>
            <option value="exhibicion">Exhibición</option>
            <option value="asignado">Asignado</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>

        <div class="campo-admin">
          <label for="nombreUnidad">Nombre de la unidad</label>
          <input id="nombreUnidad"
                 name="nombre"
                 maxlength="100"
                 required>
        </div>
      </div>

      <p class="advertencia-admin">
        Vista previa local. No se asignan propietarios
        ni se ejecutan comandos físicos.
      </p>

      <div class="form-acciones">
        <button class="accion" type="submit">
          Agregar borrador
        </button>
        <button class="btn-secundario"
                type="button"
                data-cerrar="formUnidad">
          Cancelar
        </button>
      </div>
    </form>
  `);
}

function actualizarModelos() {
  const tabla = document.getElementById("tablaModelos");
  if (!tabla) return;

  if (!borradoresModelos.length) {
    tabla.innerHTML = `
      <tr><td colspan="5" class="vacio">
      Sin datos disponibles</td></tr>`;
    return;
  }

  tabla.innerHTML = borradoresModelos.map((modelo) => `
    <tr>
      <td>Local</td>
      <td>
        ${escaparHTML(modelo.nombre)}
        <br><small>${escaparHTML(modelo.codigo)}</small>
      </td>
      <td>${escaparHTML(modelo.descripcion)}</td>
      <td>${escaparHTML(modelo.estado)}</td>
      <td class="etiqueta-borrador">Borrador</td>
    </tr>
  `).join("");
}

function actualizarSelectorModelos() {
  const selector = document.getElementById("modeloUnidad");
  if (!selector) return;

  selector.replaceChildren();

  const inicial = document.createElement("option");
  inicial.value = "";
  inicial.textContent = "Seleccione un modelo";
  selector.appendChild(inicial);

  borradoresModelos.forEach(modelo => {
    const opcion = document.createElement("option");
    opcion.value = modelo.codigo;
    opcion.textContent = modelo.nombre;
    selector.appendChild(opcion);
  });
}

function actualizarUnidades() {
  const tabla = document.getElementById("tablaVehiculos");
  if (!tabla) return;

  if (!borradoresUnidades.length) {
    tabla.innerHTML = `
      <tr><td colspan="6" class="vacio">
      Sin datos disponibles</td></tr>`;
    return;
  }

  tabla.innerHTML = borradoresUnidades.map(unidad => `
    <tr>
      <td>Local</td>
      <td>${escaparHTML(unidad.identificador)}</td>
      <td>${escaparHTML(unidad.modelo)}</td>
      <td>${escaparHTML(unidad.estado)}</td>
      <td>Sin asignar</td>
      <td class="etiqueta-borrador">Borrador</td>
    </tr>
  `).join("");
}

function registrarModelo(evento) {
  evento.preventDefault();

  const formulario = evento.currentTarget;
  if (!formulario.reportValidity()) return;

  const datos = new FormData(formulario);

  const modelo = {
    nombre: String(datos.get("nombre")).trim(),
    codigo: String(datos.get("codigo")).trim().toUpperCase(),
    descripcion: String(datos.get("descripcion")).trim(),
    estado: String(datos.get("estado"))
  };

  if (borradoresModelos.some(
    actual => actual.codigo === modelo.codigo
  )) {
    informar("Ya existe un borrador con ese código.");
    return;
  }

  borradoresModelos.push(modelo);

  actualizarModelos();
  actualizarSelectorModelos();

  formulario.reset();
  formulario.hidden = true;

  informar(
    "Modelo agregado a la vista previa local. " +
    "Pendiente de guardar en Amazon RDS."
  );
}

function registrarUnidad(evento) {
  evento.preventDefault();

  const formulario = evento.currentTarget;
  if (!formulario.reportValidity()) return;

  const datos = new FormData(formulario);

  const unidad = {
    identificador: String(
      datos.get("identificador")
    ).trim().toUpperCase(),
    modelo: String(datos.get("modelo")),
    nombre: String(datos.get("nombre")).trim(),
    estado: String(datos.get("estado"))
  };

  if (!borradoresModelos.some(
    modelo => modelo.codigo === unidad.modelo
  )) {
    informar("Selecciona un modelo del catálogo local.");
    return;
  }

  if (borradoresUnidades.some(
    actual => actual.identificador === unidad.identificador
  )) {
    informar("Ese identificador ya existe en los borradores.");
    return;
  }

  borradoresUnidades.push(unidad);

  actualizarUnidades();

  formulario.reset();
  formulario.hidden = true;

  informar(
    "Unidad agregada a la vista previa local. " +
    "No se ha creado en RDS."
  );
}

function iniciarInventario() {
  crearFormularios();

  document.getElementById("formModelo")
    ?.addEventListener("submit", registrarModelo);

  document.getElementById("formUnidad")
    ?.addEventListener("submit", registrarUnidad);

  document.querySelectorAll("[data-accion]")
    .forEach(boton => {
      if (![
        "crear-modelo",
        "crear-unidad"
      ].includes(boton.dataset.accion)) return;

      boton.addEventListener("click", evento => {
        evento.preventDefault();
        evento.stopImmediatePropagation();

        const id = boton.dataset.accion === "crear-modelo"
          ? "formModelo" : "formUnidad";

        const formulario = document.getElementById(id);

        formulario.hidden = false;
        formulario.querySelector("input")?.focus();

        informar("Formulario de borrador local abierto.");
      }, true);
    });

  document.querySelectorAll("[data-cerrar]")
    .forEach(boton => {
      boton.addEventListener("click", () => {
        const formulario = document.getElementById(
          boton.dataset.cerrar
        );

        formulario.reset();
        formulario.hidden = true;
      });
    });

  console.info("Inventario 4.3: formularios locales listos.");
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded", iniciarInventario,
    { once: true }
  );
} else {
  iniciarInventario();
}
