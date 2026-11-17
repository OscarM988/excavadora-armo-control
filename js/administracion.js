
"use strict";

// EXCAVADORA-ARMO
// Practica 4.3 - Administracion IoT
// Primera etapa: interfaz y navegacion
// Sin operaciones administrativas hasta
// integrar autorizacion real en FastAPI.

const vistasPermitidas = [
  "dashboard",
  "modelos",
  "vehiculos",
  "clientes",
  "asignaciones",
  "demos",
  "auditoria"
];

function mostrarMensaje(texto) {
  const mensaje = document.getElementById("mensajeGlobal");

  if (!mensaje) return;

  mensaje.textContent = texto;
}

function mostrarVista(nombre) {

  if (!vistasPermitidas.includes(nombre)) {
    nombre = "dashboard";
  }

  document.querySelectorAll(".vista").forEach((vista) => {
    vista.classList.toggle(
      "activa",
      vista.id === nombre
    );
  });

  document.querySelectorAll(".menu-btn").forEach((boton) => {
    const activa = boton.dataset.vista === nombre;

    boton.classList.toggle("activo", activa);
    boton.setAttribute("aria-pressed", String(activa));
  });

  const mensajes = {
    dashboard: "Resumen general de Administracion IoT.",
    modelos: "Catalogo de modelos comerciales.",
    vehiculos: "Inventario de unidades fisicas IoT.",
    clientes: "Administracion de compradores.",
    asignaciones: "Asignaciones de vehiculos a clientes.",
    demos: "Administracion de demostraciones IoT.",
    auditoria: "Registro de operaciones administrativas."
  };

  mostrarMensaje(
    mensajes[nombre] + " Datos pendientes de autorizacion."
  );
}

function configurarNavegacion() {

  document.querySelectorAll(".menu-btn").forEach((boton) => {

    boton.addEventListener("click", () => {

      const nombreVista = boton.dataset.vista;

      mostrarVista(nombreVista);
    });

  });
}

function configurarAcciones() {

  document.querySelectorAll("[data-accion]").forEach((boton) => {

    boton.addEventListener("click", () => {
      if (boton.dataset.accion === "crear-demo") return;

      mostrarMensaje(
        "Esta operacion requiere autenticacion " +
        "de Administrador y una API autorizada. " +
        "Todavia no se ha habilitado."
      );

      document.getElementById("mensajeGlobal")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    });

  });
}

function inicializarIndicadores() {

  const indicadores = [
    "estadoAPI",
    "estadoWSS",
    "estadoRDS"
  ];

  for (const id of indicadores) {

    const elemento = document.getElementById(id);

    if (elemento) {
      elemento.textContent = "Sin verificar";
    }
  }
}


async function verificarAPI() {
  const indicador = document.getElementById("estadoAPI");

  if (!indicador) return;

  indicador.textContent = "Comprobando...";

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 8000);

  try {
    const respuesta = await fetch(
      "https://vehiculo-iot.duckdns.org/",
      {
        method: "GET",
        signal: controlador.signal,
        cache: "no-store"
      }
    );

    if (!respuesta.ok) {
      throw new Error("HTTP " + respuesta.status);
    }

    const datos = await respuesta.json();

    indicador.textContent =
      datos.estado === "activo"
        ? "Disponible"
        : "Respuesta no verificada";

  } catch (error) {
    indicador.textContent = "No disponible";
    console.warn("API AWS:", error.message);
  } finally {
    clearTimeout(timeout);
  }
}
function iniciarAdministracion() {

  configurarNavegacion();

  configurarAcciones();

  inicializarIndicadores();
  verificarAPI();

  mostrarVista("dashboard");

  console.info(
    "EXCAVADORA-ARMO | Administracion 4.3 inicializada"
  );
}

document.addEventListener(
  "DOMContentLoaded",
  iniciarAdministracion
);
