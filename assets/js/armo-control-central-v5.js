"use strict";
/* V5 | Exclusivamente distribucion DOM visual.
   appendChild conserva listeners del microfono; no modifica ordenes IoT. */
(() => {
  function acomodarVoz() {
    const panel = document.querySelector('#pantallaControl > section[aria-label="Control principal de la excavadora"]');
    if (!panel) return;
    const extras = panel.querySelector('.zona-controles-principales > .bloque-extras-centro');
    const voz = panel.querySelector('section[aria-label="Control por voz"]') ||
      document.querySelector('#pantallaControl > section[aria-label="Control por voz"]');
    if (!extras || !voz) return;
    voz.id = 'armo-voz-dock';
    if (voz.parentElement !== extras) extras.appendChild(voz);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', acomodarVoz, { once: true });
  } else {
    acomodarVoz();
  }
})();
