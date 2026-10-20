// EL MAPA del terreno (tecla M o el boton de arriba a la derecha): el plano desde arriba, dibujado del mismo relieve
// (relieve.js) y no de una foto: color por zona, sombreado de relieve con la luz del noroeste, CURVAS DE NIVEL cada 2 m
// (mas gruesas cada 10), los nombres de cada sitio, las RAMPAS marcadas (por donde se suben bancales y meseta) y la
// flecha del 18. Al pasar el raton dice que sitio es y a que cota; un CLIC lleva al 18 alli.
import * as R from './relieve.js';
import { HUELLAS } from './sitios.js';

const LADO = 300;                      // el plano cubre de -300 a 300 en x y z (el norte, -z, arriba)
const PX = 600;                        // pixeles del dibujo: 1 m por pixel

// los nombres y donde van (en metros)
const NOMBRES = [
  ['La explanada', 0, 46, 15], ['Primer bancal', -40, -98, 13], ['Segundo bancal', -36, -190, 13], ['Tercer bancal', -30, -262, 13],
  ['La meseta', 226, -70, 15], ['Las lomas', -222, 30, 15], ['La rambla', -66, -12, 12], ['La llanura baja', -10, 196, 15],
  ['La laguna seca', 105, 246, 12], ['Cerros testigo', -92, 246, 12],
];

const PINTADO = R.MATERIALES.map((M) => (M.color == null ? null : [(M.color >> 16) & 255, (M.color >> 8) & 255, M.color & 255].map((v) => Math.min(255, v * 1.12))));

function dibujar() {
  const c = document.createElement('canvas');
  c.width = c.height = PX;
  const g = c.getContext('2d');
  const img = g.createImageData(PX, PX), d = img.data;
  const H = new Float32Array(PX * PX), m = {};
  const col = new Float32Array(PX * PX * 3);
  const mezcla = (o, a, t) => { o[0] += (a[0] - o[0]) * t; o[1] += (a[1] - o[1]) * t; o[2] += (a[2] - o[2]) * t; };
  const C = {
    verde: [93, 112, 63], claro: [134, 152, 88], seco: [168, 160, 101], jugoso: [80, 108, 60], tierra: [138, 117, 88],
    roca: [152, 144, 129], grava: [180, 171, 150], barro: [212, 199, 168], borde: [104, 112, 78],
  };
  for (let j = 0; j < PX; j++) {
    for (let i = 0; i < PX; i++) {
      const x = -LADO + (i + 0.5) * (2 * LADO / PX), z = -LADO + (j + 0.5) * (2 * LADO / PX);
      const h = R.forma(x, z, m) + R.deltaEn(x, z), k = j * PX + i;      // con lo subido o bajado en el editor
      H[k] = h;
      const o = C.verde.slice();
      mezcla(o, C.claro, R.suave(0.3, 0.7, R.fbm(x / 38 + 11, z / 38 - 4, 3)) * 0.8);
      mezcla(o, C.seco, Math.min(1, 0.75 * m.meseta + 0.16 * (m.bancal || 0)));
      mezcla(o, C.jugoso, 0.6 * m.baja);
      mezcla(o, C.borde, m.borde);
      mezcla(o, C.tierra, Math.max(0.9 * m.taludBancal, 0.7 * m.orillaRambla, 0.6 * m.derrubio, 0.5 * m.rampa));
      mezcla(o, C.roca, Math.max(m.escarpe, m.paredCerro));
      mezcla(o, C.grava, m.rambla);
      mezcla(o, C.barro, m.laguna);
      const p = R.pinturaEn(x, z);                                      // y lo pintado
      if (p) mezcla(o, PINTADO[p], 0.85);
      col.set(o, k * 3);
    }
  }
  // sombreado (luz del noroeste) y curvas de nivel
  for (let j = 0; j < PX; j++) {
    for (let i = 0; i < PX; i++) {
      const k = j * PX + i, iz = Math.max(0, i - 1), de = Math.min(PX - 1, i + 1), ar = Math.max(0, j - 1), ab = Math.min(PX - 1, j + 1);
      const dx = H[j * PX + de] - H[j * PX + iz], dz = H[ab * PX + i] - H[ar * PX + i];
      let s = 1 - 0.32 * (dx + dz);                                    // la ladera que mira al noroeste, mas clara
      s = Math.max(0.55, Math.min(1.25, s));
      // la curva: cambia el escalon de 2 m entre este pixel y el de la derecha o el de abajo
      const e = Math.floor(H[k] / 2), eD = Math.floor(H[j * PX + de] / 2), eA = Math.floor(H[ab * PX + i] / 2);
      let linea = 0;
      if (e !== eD || e !== eA) linea = (Math.max(e, eD, eA) % 5 === 0) ? 0.6 : 0.82;
      const f = s * (linea || 1);
      d[k * 4] = Math.min(255, col[k * 3] * f); d[k * 4 + 1] = Math.min(255, col[k * 3 + 1] * f); d[k * 4 + 2] = Math.min(255, col[k * 3 + 2] * f); d[k * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // fuera del borde del mapa (no se llega): velado
  g.save();
  g.fillStyle = 'rgba(20, 22, 16, 0.42)';
  g.beginPath();
  g.rect(0, 0, PX, PX);
  const R0 = 282 * PX / (2 * LADO);
  for (let a = 0; a <= 64; a++) {
    const t = (a / 64) * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
    const r = R0 / Math.pow(Math.abs(ct) ** 6 + Math.abs(st) ** 6, 1 / 6);
    const px = PX / 2 + ct * r, py = PX / 2 + st * r;
    if (a === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.fill('evenodd');
  g.restore();
  // las rampas: por donde se suben los taludes y el escarpe
  const rampa = (x, z) => {
    const px = (x + LADO) * PX / (2 * LADO), py = (z + LADO) * PX / (2 * LADO);
    g.save();
    g.translate(px, py);
    g.fillStyle = '#f2ecdc'; g.strokeStyle = 'rgba(25,22,16,0.85)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -7); g.lineTo(6, 5); g.lineTo(-6, 5); g.closePath(); g.stroke(); g.fill();
    g.restore();
  };
  for (const B of R.BANCALES) for (const x of B.rampas) {
    // la rampa cae donde el escalon esta a media altura en esa x
    let a = -B.borde + 30, b = -B.borde - 30;
    const altoDe = (z) => R.forma(x, z);
    const medio = (altoDe(a) + altoDe(b)) / 2;
    for (let k = 0; k < 24; k++) { const z = (a + b) / 2; if (altoDe(z) < medio) a = z; else b = z; }
    rampa(x, (a + b) / 2);
  }
  {
    let a = 100, b = 230;
    for (let k = 0; k < 24; k++) { const x = (a + b) / 2; R.forma(x, R.MESETA.rampaZ, m); if (m.meseta < 0.5) a = x; else b = x; }
    rampa((a + b) / 2, R.MESETA.rampaZ);
  }
  // la huella de los modelos solidos que ha puesto el editor (muros, casas...)
  g.fillStyle = 'rgba(40, 34, 28, 0.85)'; g.strokeStyle = 'rgba(242, 236, 220, 0.6)'; g.lineWidth = 1;
  for (const h of HUELLAS) {
    const px = (h.x + LADO) * PX / (2 * LADO), py = (h.z + LADO) * PX / (2 * LADO), k = PX / (2 * LADO);
    g.save(); g.translate(px, py); g.rotate(h.ang);
    const w = Math.max(1.5, h.hx / 0.92 * 2 * k), d = Math.max(1.5, h.hz / 0.92 * 2 * k);
    g.fillRect(-w / 2, -d / 2, w, d); g.strokeRect(-w / 2, -d / 2, w, d);
    g.restore();
  }
  // los nombres
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [n, x, z, tam] of NOMBRES) {
    const px = (x + LADO) * PX / (2 * LADO), py = (z + LADO) * PX / (2 * LADO);
    g.font = `600 ${tam}px Bahnschrift, "Segoe UI", sans-serif`;
    g.lineWidth = 3.5; g.strokeStyle = 'rgba(24,22,16,0.8)'; g.fillStyle = '#f2ecdc';
    g.strokeText(n.toUpperCase(), px, py); g.fillText(n.toUpperCase(), px, py);
  }
  // escala (100 m) y norte
  g.fillStyle = '#f2ecdc'; g.strokeStyle = 'rgba(24,22,16,0.85)'; g.lineWidth = 3;
  const e100 = 100 * PX / (2 * LADO);
  g.strokeRect(16, PX - 22, e100, 4); g.fillRect(16, PX - 22, e100, 4);
  g.font = '600 11px Bahnschrift, sans-serif'; g.textAlign = 'left';
  g.strokeText('100 m', 16, PX - 32); g.fillText('100 m', 16, PX - 32);
  g.textAlign = 'center'; g.font = '700 13px Bahnschrift, sans-serif';
  g.strokeText('N', PX - 24, 22); g.fillText('N', PX - 24, 22);
  return c;
}

export function crearPlano({ alIr }) {
  const css = document.createElement('style');
  css.textContent = `
#plano-boton { position: fixed; right: 16px; top: 14px; z-index: 6; font: 600 12px/1 Bahnschrift, "Segoe UI", sans-serif; letter-spacing: .18em; color: #f2ecdc;
  background: rgba(22,24,18,.6); border: 1px solid rgba(255,255,255,.18); border-radius: 18px; padding: 9px 14px; cursor: pointer; backdrop-filter: blur(3px); }
#plano-boton:hover { background: rgba(22,24,18,.8); }
#plano-boton kbd { border: 1px solid rgba(242,236,220,.5); border-radius: 4px; padding: 1px 5px; margin-left: 6px; font: inherit; }
#plano { position: fixed; inset: 0; z-index: 7; display: none; align-items: center; justify-content: center; background: rgba(12,14,10,.55); backdrop-filter: blur(2px); }
#plano.abierto { display: flex; }
#plano .marco { position: relative; padding: 14px 14px 12px; background: rgba(22,24,18,.92); border: 1px solid rgba(255,255,255,.14); border-radius: 10px; color: #f2ecdc;
  font: 13px/1.4 Bahnschrift, "Segoe UI", sans-serif; }
#plano .cab { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; letter-spacing: .2em; font-size: 12px; }
#plano .cab b { font-size: 15px; letter-spacing: .25em; }
#plano .cab span { opacity: .65; letter-spacing: .06em; }
#plano .lienzo { position: relative; width: min(78vh, 86vw, 720px); aspect-ratio: 1; cursor: crosshair; }
#plano canvas { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 4px; image-rendering: auto; }
#plano .pie { margin-top: 8px; min-height: 18px; opacity: .85; font-size: 13px; }
`;
  document.head.appendChild(css);
  const boton = document.createElement('button');
  boton.id = 'plano-boton';
  boton.innerHTML = 'MAPA<kbd>M</kbd>';
  document.body.appendChild(boton);
  const raiz = document.createElement('div');
  raiz.id = 'plano';
  raiz.innerHTML = `<div class="marco"><div class="cab"><b>MAPA</b><span>clic para ir · M o Esc para cerrar</span></div>
    <div class="lienzo"><canvas class="fondo" width="${PX}" height="${PX}"></canvas><canvas class="encima" width="${PX}" height="${PX}"></canvas></div>
    <div class="pie">&nbsp;</div></div>`;
  document.body.appendChild(raiz);
  const fondo = raiz.querySelector('.fondo'), encima = raiz.querySelector('.encima'), pie = raiz.querySelector('.pie');
  const ge = encima.getContext('2d');
  let dibujado = false, abierto = false, raton = null;

  const aMundo = (ev) => {
    const r = encima.getBoundingClientRect();
    const u = (ev.clientX - r.left) / r.width, v = (ev.clientY - r.top) / r.height;
    return { x: -LADO + u * 2 * LADO, z: -LADO + v * 2 * LADO };
  };
  const dentro = (p) => R.radioBorde(p.x, p.z) < 282;
  encima.addEventListener('mousemove', (ev) => {
    raton = aMundo(ev);
    pie.textContent = dentro(raton)
      ? `${R.zona(raton.x, raton.z)} · ${R.altura(raton.x, raton.z).toFixed(1)} m · (${Math.round(raton.x)}, ${Math.round(raton.z)})`
      : 'Fuera del mapa: hasta ahí no se llega';
  });
  encima.addEventListener('mouseleave', () => { raton = null; pie.innerHTML = '&nbsp;'; });
  encima.addEventListener('click', (ev) => {
    const p = aMundo(ev);
    if (!dentro(p)) return;
    cerrar();
    alIr(p.x, p.z);
  });
  raiz.addEventListener('click', (ev) => { if (ev.target === raiz) cerrar(); });

  // dibujarlo cuesta ~0,9 s: se hace en cuanto el navegador esta libre, no al pulsar M
  const preparar = () => { if (!dibujado) { fondo.getContext('2d').drawImage(dibujar(), 0, 0); dibujado = true; } };
  if (window.requestIdleCallback) requestIdleCallback(preparar, { timeout: 4000 }); else setTimeout(preparar, 1500);
  function abrir() {
    preparar();
    abierto = true;
    raiz.classList.add('abierto');
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function cerrar() { abierto = false; raiz.classList.remove('abierto'); }
  boton.addEventListener('click', () => (abierto ? cerrar() : abrir()));

  // la flecha del 18 (y el sitio bajo el raton), cada fotograma mientras esta abierto
  function actualizar(pos, giro) {
    if (!abierto) return;
    ge.clearRect(0, 0, PX, PX);
    const px = (pos.x + LADO) * PX / (2 * LADO), py = (pos.z + LADO) * PX / (2 * LADO);
    ge.save();
    ge.translate(px, py);
    // giro: el 18 mira hacia (sen giro, cos giro) en (x, z); en el plano z crece hacia abajo
    ge.rotate(Math.atan2(Math.cos(giro), Math.sin(giro)) - Math.PI / 2);
    ge.fillStyle = '#ffdf8a'; ge.strokeStyle = 'rgba(25,22,16,0.95)'; ge.lineWidth = 2.5;
    ge.beginPath(); ge.moveTo(0, 11); ge.lineTo(7, -7); ge.lineTo(0, -3); ge.lineTo(-7, -7); ge.closePath(); ge.stroke(); ge.fill();
    ge.restore();
    if (raton && dentro(raton)) {
      const rx = (raton.x + LADO) * PX / (2 * LADO), ry = (raton.z + LADO) * PX / (2 * LADO);
      ge.strokeStyle = 'rgba(255,255,255,0.9)'; ge.lineWidth = 1.5;
      ge.beginPath(); ge.arc(rx, ry, 9, 0, Math.PI * 2); ge.stroke();
    }
  }
  // tras editar el terreno: se vuelve a dibujar al abrirlo (o ya, si esta abierto)
  function rehacer() { dibujado = false; if (abierto) preparar(); }
  return { abrir, cerrar, actualizar, rehacer, get abierto() { return abierto; } };
}
