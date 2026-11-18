/* Solo estado visual de DEMO programada. No envia movimientos. */
(()=>{
  const listo=()=>{
    const b=document.querySelector('.extras-mini-grid .btn-extra-mini:nth-child(4)');
    if(!b)return;
    window.addEventListener('armo:demo-comprador-estado',e=>{
      const activo=e.detail?.activo===true;
      b.dataset.indicadorExtra=activo?'demo':'apagado';
      const p=b.querySelector('.arm-punto-extra');
      if(p)p.style.backgroundColor=activo?'#60a5fa':'#94a3b8';
      b.title=activo?'DEMO programada en ejecucion (estado estimado)':'DEMO detenida';
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',listo,{once:true});else listo();
})();
