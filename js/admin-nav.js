"use strict";

// EXCAVADORA-ARMO - Navegacion Administracion 4.3

(() => {
  const ADMIN_URL = "administracion.html";

  function texto(elemento) {
    return (elemento.textContent || "")
      .trim()
      .toUpperCase();
  }

  function integrarAdministracion() {
    if (document.querySelector(
      ".pestana-administracion"
    )) {
      return true;
    }

    const elementos = [
      ...document.querySelectorAll(
        "button, [role='tab']"
      )
    ];

    const control = elementos.find(
      elemento => texto(elemento) === "CONTROL"
    );

    const monitoreo = elementos.find(
      elemento => texto(elemento) === "MONITOREO"
    );

    if (!control || !monitoreo) {
      return false;
    }

    // Solo modificar si ambas pestañas
    // comparten el mismo contenedor.
    if (control.parentElement !== monitoreo.parentElement) {
      return false;
    }

    const contenedor = control.parentElement;

    contenedor.classList.add(
      "navegacion-admin-43"
    );

    const enlace = document.createElement("a");

    enlace.href = ADMIN_URL;
    enlace.textContent = "ADMINISTRACIÓN";
    enlace.className = "pestana-administracion";

    monitoreo.insertAdjacentElement(
      "afterend",
      enlace
    );

    console.info(
      "EXCAVADORA-ARMO: tercera pestaña integrada"
    );

    return true;
  }

  function iniciar() {
    if (integrarAdministracion()) return;

    const observador = new MutationObserver(() => {
      if (integrarAdministracion()) {
        observador.disconnect();
      }
    });

    observador.observe(document.body, {
      childList: true,
      subtree: true
    });
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
