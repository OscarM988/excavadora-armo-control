
"use strict";

/*
 * EXCAVADORA-ARMO
 * PRACTICA 4.3 - ADMINISTRACION AWS/RDS
 *
 * API: https://vehiculo-iot.duckdns.org/v43
 * Base: Amazon RDS MySQL
 *
 * Las operaciones autorizadas pueden modificar RDS.
 * No ejecuta movimientos de la excavadora.
 * JWT administrativo solamente en memoria.
 */

(() => {
  const API = "https://vehiculo-iot.duckdns.org/v43";

  let token = null;

  let modelos = [];
  let unidades = [];
  let clientes = [];
  let asignaciones = [];

  const $ = id => document.getElementById(id);

  function mensaje(texto) {
    const elemento = $("mensajeGlobal");
    if (elemento) elemento.textContent = texto;
  }

  function texto(valor) {
    return valor === null || valor === undefined
      ? "—"
      : String(valor);
  }

  // ==========================================
  // API ADMINISTRATIVA
  // ==========================================

  async function solicitar(
    ruta,
    { method = "GET", body } = {}
  ) {
    if (!token && ruta !== "/admin/auth/login") {
      throw new Error(
        "Inicia sesión administrativa primero."
      );
    }

    const headers = {
      Accept: "application/json"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let respuesta;

    try {
      respuesta = await fetch(`${API}${ruta}`, {
        method,
        headers,
        cache: "no-store",
        body: body === undefined
          ? undefined
          : JSON.stringify(body)
      });
    } catch (_) {
      throw new Error(
        "No se pudo conectar con la API local. " +
        "Comprueba Uvicorn y CORS."
      );
    }

    let datos = null;

    try {
      datos = await respuesta.json();
    } catch (_) {
      // Respuesta sin JSON
    }

    if (!respuesta.ok) {
      if (
        respuesta.status === 401 &&
        ruta !== "/admin/auth/login"
      ) {
        token = null;
        actualizarSesion();
      }

      throw new Error(
        typeof datos?.detail === "string"
          ? datos.detail
          : `HTTP ${respuesta.status}`
      );
    }

    return datos;
  }

  // ==========================================
  // TABLAS
  // ==========================================

  function celda(fila, valor) {
    const td = document.createElement("td");
    td.textContent = texto(valor);
    fila.appendChild(td);
    return td;
  }

  function pintar(
    id,
    registros,
    columnas,
    mensajeVacio = "Sin datos disponibles"
  ) {
    const tabla = $(id);

    if (!tabla) return;

    tabla.replaceChildren();

    if (!Array.isArray(registros) || !registros.length) {
      const fila = tabla.insertRow();
      const td = fila.insertCell();

      td.colSpan = columnas.length;
      td.textContent = mensajeVacio;
      td.className = "vacio";
      return;
    }

    registros.forEach(registro => {
      const fila = tabla.insertRow();

      columnas.forEach(columna => {
        celda(fila, columna(registro));
      });
    });
  }

  function valorFecha(valor) {
    if (!valor) return "—";

    let fecha;

    if (typeof valor === "string") {
      const normalizado = valor.replace(" ", "T");
      fecha = new Date(normalizado);
    } else {
      fecha = new Date(valor);
    }

    if (Number.isNaN(fecha.getTime())) {
      return String(valor);
    }

    return fecha.toLocaleString("es-MX");
  }

  function selector(
    id,
    lista,
    etiqueta,
    clave,
    titulo
  ) {
    const select = $(id);

    if (!select) return;

    select.replaceChildren();

    const primera = document.createElement("option");

    primera.value = "";
    primera.textContent = etiqueta;

    select.appendChild(primera);

    lista.forEach(registro => {
      const opcion = document.createElement("option");

      opcion.value = String(registro[clave]);
      opcion.textContent = titulo(registro);

      select.appendChild(opcion);
    });
  }

  // ==========================================
  // CARGAR DATOS LOCALES
  // ==========================================

  async function cargarDatos() {
    if (!token) return;

    const [
      m,
      u,
      c,
      a,
      audit,
      demos43
    ] = await Promise.all([
      solicitar("/admin/modelos"),
      solicitar("/admin/unidades"),
      solicitar("/admin/clientes"),
      solicitar("/admin/asignaciones"),
      solicitar("/admin/auditoria?limite=50"),
      solicitar("/admin/demos").catch(error => {
        console.warn(
          "No fue posible consultar demostraciones:",
          error.message
        );
        return [];
      })
    ]);

    modelos = Array.isArray(m) ? m : [];
    unidades = Array.isArray(u) ? u : [];
    clientes = Array.isArray(c) ? c : [];
    asignaciones = Array.isArray(a) ? a : [];

    // MODELOS
    pintar("tablaModelos", modelos, [
      x => x.id_modelo,
      x => `${texto(x.nombre)} (${texto(x.codigo)})`,
      x => x.descripcion,
      x => x.activo ? "Activo" : "Inactivo",
      x => "Registrado"
    ]);

    // UNIDADES IOT
    pintar("tablaVehiculos", unidades, [
      x => x.id_unidad,
      x => x.identificador,
      x => x.modelo,
      x => x.estado_comercial,
      x => x.estado_comercial === "asignado"
        ? "Asignado"
        : "Sin asignar",
      x => "Registrado"
    ]);

    // CLIENTES
    pintar("tablaClientes", clientes, [
      x => x.id_usuario,
      x => x.nombre,
      x => x.correo,
      x => x.activo ? "Activo" : "Pendiente",
      x => "Registrado"
    ]);

    // ASIGNACIONES
    pintar("tablaAsignaciones", asignaciones, [
      x => x.identificador || x.id_vehiculo,
      x => x.cliente,
      x => valorFecha(x.fecha_inicio),
      x => x.estado
    ]);

    // DEMOSTRACIONES
    const demos = Array.isArray(demos43)
      ? demos43
      : [];

    pintar("tablaDemos", demos, [
      x => x.id_demo,
      x => x.nombre,
      x => "Administrativa",
      x => x.vehiculo || x.id_vehiculo,
      x => {
        const ms = Number(
          x.duracion_total_ms || 0
        );

        return ms > 0
          ? `${(ms / 1000).toFixed(1)} s`
          : "Sin movimientos";
      },
      x => x.activo ? "Activo" : "Inactivo"
    ]);

    // AUDITORIA
    // Respetar los encabezados visibles de HTML.
    const auditBody = $("tablaAuditoria");

    if (auditBody) {
      const encabezados = Array.from(
        auditBody.closest("table")
          ?.querySelectorAll("thead th") || []
      );

      const columnas = encabezados.map(th => {
        const encabezado = th.textContent
          .trim()
          .toLowerCase();

        if (encabezado.includes("fecha")) {
          return x => valorFecha(x.fecha_hora);
        }

        if (encabezado.includes("actor")) {
          return x => x.actor;
        }

        if (
          encabezado.includes("acción") ||
          encabezado.includes("accion")
        ) {
          return x => x.accion;
        }

        if (encabezado.includes("recurso")) {
          return x => x.recurso;
        }

        if (encabezado.includes("resultado")) {
          return x => x.resultado;
        }

        if (encabezado.includes("detalle")) {
          return x => x.detalle;
        }

        return () => "—";
      });

      const columnasFinales = columnas.length
        ? columnas
        : [
            x => valorFecha(x.fecha_hora),
            x => x.actor,
            x => x.accion,
            x => x.recurso,
            x => x.resultado
          ];

      pintar(
        "tablaAuditoria",
        Array.isArray(audit) ? audit : [],
        columnasFinales
      );
    }

    // CONTADORES
    if ($("totalModelos")) {
      $("totalModelos").textContent = modelos.length;
    }

    if ($("totalVehiculos")) {
      $("totalVehiculos").textContent = unidades.length;
    }

    if ($("totalClientes")) {
      $("totalClientes").textContent = clientes.length;
    }

    if ($("totalDemos")) {
      $("totalDemos").textContent = demos.length;
    }

    // SELECTORES
    selector(
      "modeloUnidad",
      modelos,
      "Seleccione un modelo",
      "id_modelo",
      x => x.nombre
    );

    selector(
      "asignarCliente",
      clientes,
      "Seleccione un comprador",
      "id_usuario",
      x => `${x.nombre} (${x.correo})`
    );

    selector(
      "asignarUnidad",
      unidades.filter(
        x => x.estado_comercial === "disponible"
      ),
      "Seleccione una unidad",
      "id_vehiculo",
      x => x.identificador
    );

    mensaje(
      "Datos administrativos consultados desde Amazon RDS."
    );
  }

  // ==========================================
  // SESION ADMINISTRATIVA
  // ==========================================

  function actualizarSesion() {
    if ($("estadoSesion")) {
      $("estadoSesion").textContent = token
        ? "Administrador autenticado · AWS/RDS"
        : "Sesión administrativa sin verificar";
    }

    if ($("adminLogin")) {
      $("adminLogin").hidden = Boolean(token);
    }

    if ($("adminCerrarSesion")) {
      $("adminCerrarSesion").hidden = !token;
    }

    if ($("adminRecargar")) {
      $("adminRecargar").disabled = !token;
    }
  }

  function crearAcceso() {
    const principal = $("contenidoPrincipal");

    if (!principal || $("adminAccesoLocal")) {
      return;
    }

    const contenedor = document.createElement("section");

    contenedor.id = "adminAccesoLocal";
    contenedor.className = "panel";
    contenedor.style.marginBottom = "18px";

    const titulo = document.createElement("h3");
    titulo.textContent =
      "Administración · Práctica 4.3";

    contenedor.appendChild(titulo);

    const nota = document.createElement("p");
    nota.textContent =
      "Conectado a la API 4.3 publicada con HTTPS. " +
      "La contraseña y el token no se guardan en el navegador.";

    contenedor.appendChild(nota);

    const formulario = document.createElement("form");

    formulario.id = "adminLogin";
    formulario.className = "form-admin";

    const correo = document.createElement("input");

    correo.type = "email";
    correo.required = true;
    correo.placeholder = "Correo administrativo";
    correo.autocomplete = "username";
    correo.id = "adminCorreo";

    const clave = document.createElement("input");

    clave.type = "password";
    clave.required = true;
    clave.placeholder = "Contraseña administrativa";
    clave.autocomplete = "current-password";
    clave.id = "adminClave";

    const entrar = document.createElement("button");

    entrar.type = "submit";
    entrar.className = "accion";
    entrar.textContent = "Iniciar sesión administrativa";

    formulario.append(
      correo,
      document.createTextNode(" "),
      clave,
      document.createTextNode(" "),
      entrar
    );

    contenedor.appendChild(formulario);

    const recargar = document.createElement("button");

    recargar.id = "adminRecargar";
    recargar.className = "accion";
    recargar.type = "button";
    recargar.textContent = "Actualizar datos";
    recargar.disabled = true;

    const salir = document.createElement("button");

    salir.id = "adminCerrarSesion";
    salir.type = "button";
    salir.className = "btn-secundario";
    salir.textContent = "Cerrar sesión administrativa";
    salir.hidden = true;

    contenedor.append(
      recargar,
      document.createTextNode(" "),
      salir
    );

    principal.prepend(contenedor);

    // LOGIN
    formulario.addEventListener(
      "submit",
      async evento => {
        evento.preventDefault();

        entrar.disabled = true;

        try {
          const resultado = await solicitar(
            "/admin/auth/login",
            {
              method: "POST",
              body: {
                correo: correo.value.trim(),
                password: clave.value
              }
            }
          );

          if (!resultado?.access_token) {
            throw new Error(
              "El servidor no devolvió un token."
            );
          }

          token = resultado.access_token;
          clave.value = "";

          actualizarSesion();
          await cargarDatos();

        } catch (error) {
          mensaje(
            `Administración: ${error.message}`
          );
        } finally {
          entrar.disabled = false;
        }
      }
    );

    recargar.addEventListener("click", () => {
      cargarDatos().catch(error => {
        mensaje(error.message);
      });
    });

    // CERRAR SESION
    salir.addEventListener("click", () => {
      token = null;

      actualizarSesion();

      [
        "tablaModelos",
        "tablaVehiculos",
        "tablaClientes",
        "tablaAsignaciones",
        "tablaAuditoria",
        "tablaDemos"
      ].forEach(id => {
        const tabla = $(id);
        if (tabla) tabla.replaceChildren();
      });

      for (const id of [
        "totalModelos",
        "totalVehiculos",
        "totalClientes",
        "totalDemos"
      ]) {
        if ($(id)) $(id).textContent = "--";
      }

      const formDemo = $("formDemoAdmin43");

      if (formDemo) {
        formDemo.reset();
        formDemo.hidden = true;
        formDemo.style.display = "none";
      }

      modelos = [];
      unidades = [];
      clientes = [];
      asignaciones = [];

      mensaje("Sesión administrativa cerrada.");
      window.location.replace("index.html");
    });

    actualizarSesion();
  }

  // ==========================================
  // FORMULARIOS EXISTENTES
  // ==========================================

  async function procesarFormulario(id) {
    if (!token) {
      throw new Error(
        "Inicia sesión administrativa primero."
      );
    }

    const formulario = $(id);

    if (!formulario?.reportValidity()) return;

    let ruta;
    let cuerpo;

    if (id === "formModelo") {
      ruta = "/admin/modelos";

      cuerpo = {
        nombre: $("nombreModelo").value.trim(),
        codigo: $("codigoModelo").value
          .trim()
          .toUpperCase(),
        descripcion: $("descripcionModelo").value.trim(),
        activo: $("estadoModelo").value === "activo"
      };

    } else if (id === "formCliente") {
      ruta = "/admin/clientes";

      cuerpo = {
        nombre: $("clienteNombre").value.trim(),
        correo: $("clienteCorreo").value
          .trim()
          .toLowerCase()
      };

    } else if (id === "formUnidad") {
      ruta = "/admin/unidades";

      const idVehiculo = Number(
        $("adminIdVehiculo")?.value
      );

      if (
        !Number.isInteger(idVehiculo) ||
        idVehiculo < 1
      ) {
        throw new Error(
          "Indica un ID de vehículo existente."
        );
      }

      if (
        unidades.some(
          x => Number(x.id_vehiculo) === idVehiculo
        )
      ) {
        throw new Error(
          "Ese vehículo ya cuenta con unidad comercial."
        );
      }

      cuerpo = {
        id_vehiculo: idVehiculo,
        id_modelo: Number($("modeloUnidad").value),
        identificador: $("identificadorUnidad")
          .value.trim().toUpperCase(),
        estado_comercial: $("estadoUnidad").value
      };

    } else if (id === "formAsignacion") {
      ruta = "/admin/asignaciones";

      cuerpo = {
        id_vehiculo: Number(
          $("asignarUnidad").value
        ),
        id_usuario: Number(
          $("asignarCliente").value
        ),
        observaciones:
          "Asignación desde Administración 4.3"
      };

      if (
        !cuerpo.id_usuario ||
        !cuerpo.id_vehiculo
      ) {
        throw new Error(
          "Selecciona cliente y unidad disponibles."
        );
      }

    } else {
      return;
    }

    await solicitar(ruta, {
      method: "POST",
      body: cuerpo
    });

    formulario.reset();
    formulario.hidden = true;

    await cargarDatos();

    mensaje(
      "Registro guardado correctamente en MySQL local."
    );
  }

  // ==========================================
  // FORMULARIO DE DEMOSTRACIONES
  // ==========================================

  function prepararFormularioDemos43() {
    const seccion = $("demos");

    if (!seccion || $("formDemoAdmin43")) {
      return;
    }

    const formulario = document.createElement("form");

    formulario.id = "formDemoAdmin43";
    formulario.className = "panel";
    formulario.hidden = true;
    formulario.style.display = "none";
    formulario.style.marginTop = "16px";

    formulario.innerHTML = `
      <h3>Nueva demostración administrativa</h3>

      <p>
        Esta demostración se registrará únicamente
        en MySQL local de pruebas.
        No ejecutará movimientos físicos.
      </p>

      <div class="form-grid">
        <label for="demoVehiculo43">
          Vehículo
        </label>

        <select
          id="demoVehiculo43"
          required
        ></select>

        <label for="demoNombre43">
          Nombre de la demostración
        </label>

        <input
          id="demoNombre43"
          type="text"
          maxlength="80"
          required
        >

        <label for="demoDescripcion43">
          Descripción
        </label>

        <textarea
          id="demoDescripcion43"
          maxlength="255"
          rows="3"
        ></textarea>
      </div>

      <button
        type="submit"
        class="accion"
      >
        Guardar demostración
      </button>

      <button
        type="button"
        id="cancelarDemo43"
        class="btn-secundario"
      >
        Cancelar
      </button>
    `;

    seccion.appendChild(formulario);

    // CANCELAR
    $("cancelarDemo43").addEventListener(
      "click",
      () => {
        formulario.reset();
        formulario.hidden = true;
        formulario.style.display = "none";
      }
    );

    // GUARDAR DEMOSTRACION
    formulario.addEventListener(
      "submit",
      async evento => {
        evento.preventDefault();
        evento.stopImmediatePropagation();

        if (!token) {
          mensaje(
            "Inicia sesión administrativa primero."
          );
          return;
        }

        const guardar = formulario.querySelector(
          'button[type="submit"]'
        );

        guardar.disabled = true;

        try {
          const datos = {
            id_vehiculo: Number(
              $("demoVehiculo43").value
            ),
            nombre: $("demoNombre43").value.trim(),
            descripcion: $("demoDescripcion43")
              .value.trim()
          };

          if (
            !Number.isInteger(datos.id_vehiculo) ||
            datos.id_vehiculo < 1 ||
            !datos.nombre
          ) {
            throw new Error(
              "Completa el vehículo y el nombre."
            );
          }

          await solicitar("/admin/demos", {
            method: "POST",
            body: datos
          });

          formulario.reset();
          formulario.hidden = true;
          formulario.style.display = "none";

          await cargarDatos();

          mensaje(
            "Demostración registrada correctamente en MySQL local."
          );

        } catch (error) {
          mensaje(
            `Demostraciones: ${error.message}`
          );
        } finally {
          guardar.disabled = false;
        }
      }
    );
  }

  function abrirDemo43() {
    if (!token) {
      mensaje(
        "Inicia sesión administrativa primero."
      );
      return;
    }

    const formulario = $("formDemoAdmin43");

    if (!formulario) {
      mensaje(
        "No se encontró el formulario de demostraciones."
      );
      return;
    }

    const disponibles = unidades.filter(
      x => x.id_vehiculo != null
    );

    selector(
      "demoVehiculo43",
      disponibles,
      "Seleccione un vehículo",
      "id_vehiculo",
      x => x.identificador ||
        x.vehiculo ||
        `Vehículo ${x.id_vehiculo}`
    );

    formulario.hidden = false;
    formulario.style.display = "block";

    $("demoNombre43")?.focus();

    mensaje(
      "Completa los datos de la demostración administrativa."
    );
  }

  // ==========================================
  // EVENTOS UNIFICADOS
  // ==========================================

  function configurarEventos() {
    const formularioIds = new Set([
      "formModelo",
      "formUnidad",
      "formCliente",
      "formAsignacion"
    ]);

    // CAPTURAR FORMULARIOS EXISTENTES
    document.addEventListener(
      "submit",
      evento => {
        const id = evento.target?.id;

        if (!formularioIds.has(id)) return;

        evento.preventDefault();
        evento.stopImmediatePropagation();

        procesarFormulario(id).catch(error => {
          mensaje(`No se guardó: ${error.message}`);
        });
      },
      true
    );

    // UN CONTROLADOR PARA TODOS LOS BOTONES
    document.addEventListener(
      "click",
      evento => {
        const boton = evento.target
          ?.closest?.("[data-accion]");

        if (!boton) return;

        const accion = boton.dataset.accion;

        // DEMOSTRACIONES
        if (accion === "crear-demo") {
          evento.preventDefault();
          evento.stopImmediatePropagation();

          abrirDemo43();
          return;
        }

        const mapa = {
          "crear-modelo": "formModelo",
          "crear-unidad": "formUnidad",
          "crear-cliente": "formCliente",
          "asignar-unidad": "formAsignacion"
        };

        const id = mapa[accion];

        if (!id) return;

        evento.preventDefault();
        evento.stopImmediatePropagation();

        if (!token) {
          mensaje(
            "Inicia sesión administrativa primero."
          );
          return;
        }

        const formulario = $(id);

        if (!formulario) {
          mensaje(
            "No está disponible el formulario."
          );
          return;
        }

        if (id === "formAsignacion") {
          selector(
            "asignarCliente",
            clientes,
            "Seleccione un comprador",
            "id_usuario",
            x => x.nombre
          );

          selector(
            "asignarUnidad",
            unidades.filter(
              x => x.estado_comercial === "disponible"
            ),
            "Seleccione una unidad",
            "id_vehiculo",
            x => x.identificador
          );
        }

        formulario.hidden = false;

        formulario
          .querySelector("input,select")
          ?.focus();
      },
      true
    );
  }

  // ==========================================
  // AJUSTAR FORMULARIOS ANTERIORES
  // ==========================================

  function adecuarFormularios() {
    const unidad = $("formUnidad");

    if (unidad && !$("adminIdVehiculo")) {
      const label = document.createElement("label");

      label.htmlFor = "adminIdVehiculo";
      label.textContent =
        "ID del vehículo existente en Amazon RDS";

      const input = document.createElement("input");

      input.id = "adminIdVehiculo";
      input.type = "number";
      input.min = "1";
      input.step = "1";
      input.required = true;

      unidad
        .querySelector(".form-grid")
        ?.prepend(label, input);
    }

    [
      "formModelo",
      "formUnidad",
      "formCliente",
      "formAsignacion"
    ].forEach(id => {
      const form = $(id);

      if (!form) return;

      form.querySelectorAll(
        ".advertencia-admin,.clientes-nota"
      ).forEach(nota => {
        nota.textContent =
          "Las operaciones autorizadas se realizan en Amazon RDS.";
      });

      const submit = form.querySelector(
        'button[type="submit"]'
      );

      if (submit) {
        submit.textContent =
          "Guardar en Amazon RDS";
      }
    });
  }

  // ==========================================
  // INICIALIZAR
  // ==========================================

  function iniciar() {
    crearAcceso();
    // Token de un solo uso transferido tras validación de FastAPI.
    try {
      const t = JSON.parse(sessionStorage.getItem("armo:acceso-43-handoff") || "null");
      sessionStorage.removeItem("armo:acceso-43-handoff");
      if (t?.rol === "administrador" && typeof t.jwt === "string" && Date.now() < t.vence) {
        token = t.jwt;
        actualizarSesion();
        cargarDatos().catch(e => {token = null; actualizarSesion(); mensaje(e.message);});
      }
    } catch (_) {token = null;}
    prepararFormularioDemos43();
    configurarEventos();

    // NAVEGACION_ADMIN_43
    // Los botones del menu deben seguir funcionando.
    document.addEventListener("click", evento => {
      const boton = evento.target.closest?.("[data-vista]");
      if (!boton) return;

      const nombre = boton.dataset.vista;
      const vista = document.getElementById(nombre);

      if (!vista) return;

      document.querySelectorAll("section.vista").forEach(
        seccion => seccion.classList.remove("activa")
      );

      vista.classList.add("activa");

      document.querySelectorAll("[data-vista]").forEach(
        elemento => elemento.classList.remove("activo")
      );

      boton.classList.add("activo");
    });


    queueMicrotask(adecuarFormularios);

    console.info(
      "EXCAVADORA-ARMO 4.3: " +
      "integración administrativa inicializada."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      iniciar,
      { once: true }
    );
  } else {
    iniciar();
  }

})();
