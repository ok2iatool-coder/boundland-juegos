// EL MAPA del mundo (tecla M o el boton de arriba a la derecha): el plano desde arriba, dibujado del mismo relieve
// (relieve.js) y no de una foto: el color de cada sitio, la nieve, el agua, sombreado con la luz del noroeste, CURVAS DE
// NIVEL cada 20 m (mas gruesas cada 100), los nombres de los planos y la flecha del 18. Al pasar el raton dice que sitio
// es y a que cota; un CLIC lleva al 18 alli.
import * as R from './relieve.js';
import { HUELLAS } from './sitios.js';

const LADO = R.EXT;                    // el plano cubre de -3000 a 3000 en x y z (el norte, -z, arriba)
const PX = 1000;                       // pixeles del dibujo: 6 m por pixel
const PINTADO = R.MATERIALES.map((M) => (M.color == null ? null : [(M.color >> 16) & 255, (M.color >> 8) & 255, M.color & 255]));

function dibujar() {
  const c = document.createElement('canvas');
  c.width = c.height = PX;
  const g = c.getContext('2d');
  const img = g.createImageData(PX, PX), d = img.data;
  const H = new Float32Array(PX * PX), AG = new Uint8Array(PX * PX), m = {};
  const col = new Float32Array(PX * PX * 3);
  const mezcla = (o, a, t) => { o[0] += (a[0] - o[0]) * t; o[1] += (a[1] - o[1]) * t; o[2] += (a[2] - o[2]) * t; };
  const C = {
    verde: [96, 116, 66], claro: [134, 152, 88], seco: [170, 162, 104], jugoso: [74, 102, 56], tierra: [150, 128, 98],
    roca: [150, 142, 128], nieve: [238, 242, 243], agua: [96, 150, 178], hielo: [214, 230, 238], grava: [176, 168, 148],
    norte: [132, 139, 134],
  };
  for (let j = 0; j < PX; j++) {
    for (let i = 0; i < PX; i++) {
      const x = -LADO + (i + 0.5) * (2 * LADO / PX), z = -LADO + (j + 0.5) * (2 * LADO / PX);
      const h = R.forma(x, z, m) + R.deltaEn(x, z), k = j * PX + i;      // con lo subido o bajado en el editor
      H[k] = h;
      const o = C.verde.slice();
      mezcla(o, C.claro, R.suave(0.3, 0.7, R.fbm(x / 90 + 11, z / 90 - 4, 3)) * 0.8);
      mezcla(o, C.seco, Math.min(1, R.suave(160, 560, h) + (m.zona === 15 ? 0.4 : 0)));
      if (m.zona === 3) mezcla(o, C.jugoso, 0.6);
      mezcla(o, C.tierra, 0.4 * R.suave(450, 620, h));
      if (m.zona === 6 || m.zona === 16) mezcla(o, C.roca, 0.75);
      const nn = R.norte(x, z);
      if (nn > 0) mezcla(o, C.norte, 0.6 * nn);                                             // v8: el norte, gris
      mezcla(o, C.nieve, R.suave(R.COTA_NIEVE - 20 - 160 * nn, R.COTA_NIEVE + 25, h));
      if (R.distAgua(x, z) < 10) mezcla(o, C.grava, 0.4);
      const p = R.pinturaEn(x, z);
      if (p) mezcla(o, PINTADO[p], 0.85);
      const nivel = R.nivelAgua(x, z);
      if (nivel > R.SIN_AGUA && nivel > h + 0.1) { o.splice(0, 3, ...(m.zona === 10 ? C.hielo : C.agua)); AG[k] = 1; }
      col.set(o, k * 3);
    }
  }
  // sombreado (luz del noroeste) y curvas de nivel cada 20 m (mas gruesas cada 100)
  for (let j = 0; j < PX; j++) {
    for (let i = 0; i < PX; i++) {
      const k = j * PX + i, iz = Math.max(0, i - 1), de = Math.min(PX - 1, i + 1), ar = Math.max(0, j - 1), ab = Math.min(PX - 1, j + 1);
      const dx = H[j * PX + de] - H[j * PX + iz], dz = H[ab * PX + i] - H[ar * PX + i];
      let s = 1 - 0.05 * (dx + dz);
      s = Math.max(0.55, Math.min(1.25, s));
      const e = Math.floor(H[k] / 20), eD = Math.floor(H[j * PX + de] / 20), eA = Math.floor(H[ab * PX + i] / 20);
      let linea = 0;
      if (!AG[k] && (e !== eD || e !== eA)) linea = (Math.max(e, eD, eA) % 5 === 0) ? 0.66 : 0.86;
      const f = AG[k] ? 1 : s * (linea || 1);
      d[k * 4] = Math.min(255, col[k * 3] * f); d[k * 4 + 1] = Math.min(255, col[k * 3 + 1] * f); d[k * 4 + 2] = Math.min(255, col[k * 3 + 2] * f); d[k * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // la huella de los modelos solidos que ha puesto el editor
  g.fillStyle = 'rgba(40, 34, 28, 0.85)'; g.strokeStyle = 'rgba(242, 236, 220, 0.6)'; g.lineWidth = 1;
  for (const h of HUELLAS) {
    const px = (h.x + LADO) * PX / (2 * LADO), py = (h.z + LADO) * PX / (2 * LADO), k = PX / (2 * LADO);
    g.save(); g.translate(px, py); g.rotate(h.ang);
    const w = Math.max(1.5, h.hx / 0.92 * 2 * k), dd = Math.max(1.5, h.hz / 0.92 * 2 * k);
    g.fillRect(-w / 2, -dd / 2, w, dd); g.strokeRect(-w / 2, -dd / 2, w, dd);
    g.restore();
  }
  // los nombres (los de los planos)
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const n of R.GEO.nombres) {
    const px = (n.x + LADO) * PX / (2 * LADO), py = (n.z + LADO) * PX / (2 * LADO);
    g.save(); g.translate(px, py); if (n.giro) g.rotate(n.giro * Math.PI / 180);
    const grande = n.tam >= 15;
    g.font = `${grande ? 600 : 500} ${n.tam}px Bahnschrift, "Segoe UI", sans-serif`;
    g.lineWidth = 3.5; g.strokeStyle = 'rgba(24,22,16,0.8)'; g.fillStyle = '#f2ecdc';
    const t = grande ? n.t.toUpperCase() : n.t;
    g.strokeText(t, 0, 0); g.fillText(t, 0, 0);
    g.restore();
  }
  // escala (1 km) y norte
  g.fillStyle = '#f2ecdc'; g.strokeStyle = 'rgba(24,22,16,0.85)'; g.lineWidth = 3;
  const e500 = 1000 * PX / (2 * LADO);
  g.strokeRect(16, PX - 22, e500, 4); g.fillRect(16, PX - 22, e500, 4);
  g.font = '600 11px Bahnschrift, sans-serif'; g.textAlign = 'left';
  g.strokeText('1 km', 16, PX - 32); g.fillText('1 km', 16, PX - 32);
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
#plano .lienzo { position: relative; width: min(78vh, 86vw, 760px); aspect-ratio: 1; cursor: crosshair; }
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
  raiz.innerHTML = `<div class="marco"><div class="cab"><b>MAPA DEL MUNDO</b><span>${Math.round(2 * LADO / 1000)} × ${Math.round(2 * LADO / 1000)} km · clic para ir · M o Esc para cerrar</span></div>
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
  const dentro = (p) => R.radioBorde(p.x, p.z) < R.LADO;
  encima.addEventListener('mousemove', (ev) => {
    raton = aMundo(ev);
    pie.textContent = dentro(raton)
      ? `${R.zona(raton.x, raton.z)} · ${R.altura(raton.x, raton.z).toFixed(0)} m · (${Math.round(raton.x)}, ${Math.round(raton.z)})`
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

  const preparar = () => { if (!dibujado) { fondo.getContext('2d').drawImage(dibujar(), 0, 0); dibujado = true; } };
  if (window.requestIdleCallback) requestIdleCallback(preparar, { timeout: 5000 }); else setTimeout(preparar, 2000);
  function abrir() {
    preparar();
    abierto = true;
    raiz.classList.add('abierto');
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function cerrar() { abierto = false; raiz.classList.remove('abierto'); }
  boton.addEventListener('click', () => (abierto ? cerrar() : abrir()));

  function actualizar(pos, giro) {
    if (!abierto) return;
    ge.clearRect(0, 0, PX, PX);
    const px = (pos.x + LADO) * PX / (2 * LADO), py = (pos.z + LADO) * PX / (2 * LADO);
    ge.save();
    ge.translate(px, py);
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
  function rehacer() { dibujado = false; if (abierto) preparar(); }
  return { abrir, cerrar, actualizar, rehacer, get abierto() { return abierto; } };
}
