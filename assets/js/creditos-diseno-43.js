'use strict';
/* EXCAVADORA-ARMO: créditos y enlaces públicos. No afecta REST, JWT ni joysticks. */
(() => {
  function iniciar() {
    if (document.querySelector('.armo-creditos')) return;
    const hoja = document.createElement('link');
    hoja.rel = 'stylesheet';
    hoja.href = 'css/creditos-diseno-43.css?v=2';
    document.head.appendChild(hoja);

    const anterior = document.querySelector('#pantallaControl footer[aria-label="Creditos del desarrollador"]');
    const pie = anterior || document.createElement('footer');
    pie.classList.add('armo-creditos');
    pie.setAttribute('aria-label', 'Créditos del proyecto EXCAVADORA-ARMO');
    pie.replaceChildren();

    const titulo = document.createElement('p');
    const fuerte = document.createElement('strong');
    fuerte.textContent = 'EXCAVADORA-ARMO · Oscar Alexis Muñoz Reséndiz';
    titulo.append(fuerte);
    const escuela = document.createElement('p');
    escuela.textContent = 'Ingeniería en Sistemas Computacionales · Tecnológico Nacional de México, Campus Pachuca';
    const materia = document.createElement('p');
    materia.textContent = 'Implementación de Soluciones IoT · 2026';
    const enlaces = document.createElement('div');
    enlaces.className = 'armo-enlaces';
    const sitios = [
      ['GitHub', 'https://github.com/OscarM988/excavadora-armo-control'],
      ['LinkedIn', 'https://www.linkedin.com/in/oscar-alexis-mu%C3%B1oz-resendiz-275098431/']
    ];
    sitios.forEach(([nombre, url]) => {
      const a = document.createElement('a');
      a.href = url; a.textContent = nombre;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      enlaces.append(a);
    });
    pie.append(titulo, escuela, materia, enlaces);
    if (!anterior) document.body.appendChild(pie);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else iniciar();
})();
