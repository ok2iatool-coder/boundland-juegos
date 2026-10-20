// La compuerta del Hack 2 (nivel 11, el hospital militar): una hoja blindada metida en su marco del suelo
// al techo, con la CERRADURA del hack en el centro: el mismo laberinto de anillos que se recorre en el
// minijuego (hacks.js, ANILLOS), grabado y con luz fria que late. Cerrojos clavados en el marco, franjas de
// aviso en los cantos, la cruz del hospital medio borrada, cables que suben al techo y un piloto rojo. Al
// resolver el hack se retiran los cerrojos, el piloto se pone verde y la hoja sube despacio al techo.
// La hoja (lo quieto) se pinta una vez en un lienzo.
import { metal, remache } from '../assets/pintura.js';
import { TINTA, tinta, rgba } from './tinta.js';

// mismos anillos que el minijuego: radio relativo, hueco y pared radial
const ANILLOS = [
  { r: 1.0, hueco: 0 }, { r: 0.8, hueco: Math.PI, pared: -0.5 }, { r: 0.6, hueco: 0.3, pared: Math.PI - 0.5 },
  { r: 0.4, hueco: -1.6, pared: 0.8 }, { r: 0.2, hueco: -2.8, pared: -1.1 },
];
const HUECO = 0.34;
const K = 4, FRIO = '169,205,230';
let hoja = null;

function pintarHoja(w, h) {
  const cv = document.createElement('canvas'); cv.width = Math.ceil(w * K); cv.height = Math.ceil(h * K);
  const c = cv.getContext('2d'); c.scale(K, K);
  metal(c, () => { c.beginPath(); c.roundRect(0, 0, w, h, 2); }, [0, 0, w, h], { semilla: 2201, base: '#4a4f54', oxido: 0.55, brilloBorde: 0.3, tintaG: 2.2 });
  // refuerzos: dos bandas horizontales y el canto con franjas de aviso
  for (const y of [h * 0.18, h * 0.82]) metal(c, () => { c.beginPath(); c.rect(1, y - 3, w - 2, 6); }, [1, y - 3, w - 2, 6], { semilla: 2202 + y, base: '#5a6066', oxido: 0.5, brilloBorde: 0.35, tintaG: 1.2 });
  c.save(); c.beginPath(); c.rect(0, h - 9, w, 8); c.clip();
  c.fillStyle = '#8f8350'; c.fillRect(0, h - 9, w, 8);
  c.strokeStyle = TINTA; c.lineWidth = 2.2;
  for (let x = -10; x < w + 10; x += 6) { c.beginPath(); c.moveTo(x, h - 9); c.lineTo(x + 8, h - 1); c.stroke(); }
  c.restore();
  for (let k = 0; k < 6; k++) { remache(c, 3.5, 8 + k * (h - 16) / 5, 1.1); remache(c, w - 3.5, 8 + k * (h - 16) / 5, 1.1); }
  // la cruz del hospital, de plantilla y casi borrada, y el rotulo
  c.fillStyle = 'rgba(120,40,35,.32)';
  const cx = w / 2, cy = h * 0.29;
  c.fillRect(cx - 2, cy - 6, 4, 12); c.fillRect(cx - 6, cy - 2, 12, 4);
  c.fillStyle = 'rgba(220,215,200,.35)'; c.font = 'bold 5px Georgia'; c.textAlign = 'center'; c.fillText('WARD B-2', cx, h * 0.74);
  // el alojamiento de la cerradura: un plato redondo hundido
  const ly = h * 0.5, R = Math.min(w * 0.42, 15);
  c.beginPath(); c.arc(cx, ly, R + 3, 0, 7); c.fillStyle = '#2c3035'; c.fill(); tinta(c, 1.8);
  c.beginPath(); c.arc(cx, ly, R, 0, 7); c.fillStyle = '#16191c'; c.fill();
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; remache(c, cx + Math.cos(a) * (R + 1.5), ly + Math.sin(a) * (R + 1.5), 0.8); }
  return { cv, cx, ly, R };
}

// el laberinto de la cerradura: anillos con su hueco y sus paredes radiales
function laberinto(c, cx, cy, R, a) {
  c.lineCap = 'round';
  for (let k = 0; k < ANILLOS.length; k++) {
    const A = ANILLOS[k], r = A.r * R * 0.92, med = HUECO / 2 / A.r;
    c.beginPath(); c.arc(cx, cy, r, A.hueco + med, A.hueco - med + Math.PI * 2); c.stroke();
    if (A.pared !== undefined) {
      const r1 = ANILLOS[k - 1].r * R * 0.92;
      c.beginPath(); c.moveTo(cx + Math.cos(A.pared) * r, cy + Math.sin(A.pared) * r); c.lineTo(cx + Math.cos(A.pared) * r1, cy + Math.sin(A.pared) * r1); c.stroke();
    }
  }
}

// r: la rejilla del hack (sim): r.solido es la caja que cierra el paso; abierta cuando se resolvio
export function dibujarCompuerta(c, r, t, abierta) {
  const s = r.solido;
  const w = s.w + 20, h = s.h, x = s.x - 10, y = s.y;
  if (!hoja || hoja.w !== w || hoja.h !== h) hoja = { w, h, ...pintarHoja(w, h) };
  // la hoja sube despacio al abrirse (r.anim va de 0 a 1 solo en el dibujo)
  r.anim = r.anim === undefined ? (abierta ? 1 : 0) : Math.max(0, Math.min(1, r.anim + (abierta ? 1 : -1) / 60 / 1.1));
  const u = r.anim, sube = u * u * (3 - 2 * u) * (h - 12);
  // el marco: carriles en el suelo y en el techo y las guias de los lados
  c.fillStyle = '#23272b'; c.fillRect(x - 4, y - 6, w + 8, 6); c.fillRect(x - 4, y + h, w + 8, 4);
  c.strokeStyle = TINTA; c.lineWidth = 1.6; c.strokeRect(x - 4, y - 6, w + 8, 6); c.strokeRect(x - 4, y + h, w + 8, 4);
  for (const gx of [x - 4, x + w]) { c.fillStyle = '#30353a'; c.fillRect(gx, y - 6, 4, h + 10); c.strokeRect(gx, y - 6, 4, h + 10); }
  // los cables que suben de la cerradura al techo
  c.strokeStyle = TINTA; c.lineWidth = 2.2;
  for (const dx of [-5, 5]) { c.beginPath(); c.moveTo(x + w / 2 + dx, y - 6); c.bezierCurveTo(x + w / 2 + dx * 2.5, y - 30, x + w / 2 + dx * 4, y - 46, x + w / 2 + dx * 6, y - 70); c.stroke(); }
  c.strokeStyle = '#3a4a44'; c.lineWidth = 1; for (const dx of [-5, 5]) { c.beginPath(); c.moveTo(x + w / 2 + dx, y - 6); c.bezierCurveTo(x + w / 2 + dx * 2.5, y - 30, x + w / 2 + dx * 4, y - 46, x + w / 2 + dx * 6, y - 70); c.stroke(); }
  // la hoja, recortada por el marco (al subir se mete en el techo)
  c.save(); c.beginPath(); c.rect(x - 1, y, w + 2, h); c.clip();
  const hy = y - sube;
  c.drawImage(hoja.cv, x, hy, w, h);
  // la cerradura: el laberinto con luz fria que late (cerrada); apagandose al abrir
  const late = 0.45 + 0.25 * Math.sin(t * 2.2), luz = (1 - u) * late;
  c.save(); c.globalCompositeOperation = 'lighter';
  const cx = x + hoja.cx, cy = hy + hoja.ly;
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, hoja.R * 1.6);
  g.addColorStop(0, `rgba(${FRIO},${0.25 * luz})`); g.addColorStop(1, `rgba(${FRIO},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, hoja.R * 1.6, 0, 7); c.fill();
  c.strokeStyle = `rgba(${FRIO},${0.35 + 0.55 * luz})`; c.lineWidth = 1.2;
  laberinto(c, cx, cy, hoja.R, u);
  // el punto de entrada del laberinto (por donde empieza el trazo)
  c.fillStyle = `rgba(${FRIO},${0.5 + 0.5 * luz})`; c.beginPath(); c.arc(cx + hoja.R * 1.02, cy, 1.4, 0, 7); c.fill();
  c.restore();
  c.restore();
  // los cerrojos: cuatro pasadores clavados en el marco (arriba y abajo) que se retiran al abrir
  const fuera = Math.min(1, u * 4);
  for (const [bx, arriba] of [[x + 8, true], [x + w - 8, true], [x + 8, false], [x + w - 8, false]]) {
    const largo = 7 * (1 - fuera);
    if (largo < 0.5) continue;
    const by = arriba ? y - largo : y + h;
    c.fillStyle = '#7a8086'; c.fillRect(bx - 2, by, 4, largo); c.strokeStyle = TINTA; c.lineWidth = 1; c.strokeRect(bx - 2, by, 4, largo);
  }
  // el piloto, en la guia de la derecha: rojo cerrada, verde abierta
  const col = abierta ? '120,220,170' : '230,70,60';
  c.beginPath(); c.arc(x + w + 2, y + 14, 2.6, 0, 7); c.fillStyle = `rgba(${col},.95)`; c.fill(); tinta(c, 1);
  c.save(); c.globalCompositeOperation = 'lighter';
  const g2 = c.createRadialGradient(x + w + 2, y + 14, 0, x + w + 2, y + 14, 14);
  g2.addColorStop(0, `rgba(${col},${abierta ? 0.35 : 0.3 + 0.15 * Math.sin(t * 4)})`); g2.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g2; c.beginPath(); c.arc(x + w + 2, y + 14, 14, 0, 7); c.fill();
  c.restore();
}
