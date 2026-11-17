"use strict";
/* Solo organiza los elementos existentes; NO transmite ni intercepta movimientos. */
(() => {
  function iniciar() {
    const control = document.querySelector('#pantallaControl > section[aria-label="Control principal de la excavadora"]');
    if (!control) return;
    const voz = document.querySelector('#pantallaControl > section[aria-label="Control por voz"]');
    if (voz && !control.contains(voz)) {
      voz.id = 'armo-voz-dock';
      control.appendChild(voz); // Conserva los event listeners del micrófono.
    }
    const footer = document.querySelector('#pantallaControl > footer.armo-creditos');
    if (footer) footer.setAttribute('aria-label', 'Créditos y enlaces profesionales');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, {once:true});
  else iniciar();
})();
