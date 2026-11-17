"use strict";

/*
 * EXCAVADORA-ARMO - PRACTICA 4.3
 * Navegacion principal.
 * No altera comandos ni conexiones IoT.
 */

(() => {
  function iniciar() {
    if (document.getElementById("navegacion-principal-43")) {
      return;
    }

    const estilo = document.createElement("style");
    estilo.textContent = `
      #navegacion-principal-43 {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 12px;
        padding: 16px;
        background: #0f172a;
        border-bottom: 2px solid #f59e0b;
        position: relative;
        z-index: 20;
      }

      #navegacion-principal-43 button,
      #navegacion-principal-43 a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 170px;
        padding: 13px 18px;
        border: 1px solid #445675;
        border-radius: 12px;
        background: #233a5c;
        color: white;
        font: 700 15px Arial, sans-serif;
        text-decoration: none;
        cursor: pointer;
      }

      #navegacion-principal-43 .activo {
        background: #facc15;
        color: #111827;
        border-color: #facc15;
      }

      #navegacion-principal-43 button:hover,
      #navegacion-principal-43 a:hover {
        border-color: #facc15;
      }

      @media (max-width: 600px) {
        #navegacion-principal-43 {
          gap: 7px;
          padding: 10px;
        }

        #navegacion-principal-43 button,
        #navegacion-principal-43 a {
          min-width: 0;
          flex: 1 1 120px;
          font-size: 12px;
          padding: 11px 8px;
        }
      }
    `;

    document.head.appendChild(estilo);

    const barra = document.createElement("nav");
    barra.id = "navegacion-principal-43";
    barra.setAttribute("aria-label", "Navegacion principal");

    const control = document.createElement("button");
    control.type = "button";
    control.textContent = "CONTROL";
    control.classList.add("activo");

    const monitoreo = document.createElement("button");
    monitoreo.type = "button";
    monitoreo.textContent = "MONITOREO";

    const administracion = document.createElement("a");
    administracion.href = "administracion.html";
    administracion.textContent = "ADMINISTRACION";

    barra.replaceChildren(control, monitoreo, administracion);
    document.body.prepend(barra);

    function abrirPestana(nombre) {
      const candidatos = [
        ...document.querySelectorAll(
          'button, [role="tab"], a'
        )
      ];

      const boton = candidatos.find(elemento =>
        !barra.contains(elemento) &&
        elemento.textContent.trim().toLowerCase() ===
          nombre.toLowerCase()
      );

      if (!boton) {
        console.warn("Pestana no encontrada:", nombre);
        return false;
      }

      boton.click();
      control.classList.toggle(
        "activo", nombre === "Dirección"
      );
      monitoreo.classList.toggle(
        "activo", nombre === "Monitor"
      );

      return true;
    }

    function cambiarVista43(indice, alternativa) {
      // Botones funcionales de monitoreo.js, ocultos visualmente.
      // Se usan para preservar actualizacion de datos y estado de la vista.
      const botones = document.querySelectorAll('.navegacion-modos button');
      if (botones.length >= 2) {
        botones[indice].click();
        return;
      }
      abrirPestana(alternativa);
    }

    control.addEventListener("click", () => {
      cambiarVista43(0, "Dirección");
    });

    monitoreo.addEventListener("click", () => {
      cambiarVista43(1, "Monitor");
    });

    console.log(
      "EXCAVADORA-ARMO: Navegacion 4.3 cargada"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
