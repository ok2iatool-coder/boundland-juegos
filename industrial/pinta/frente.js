// EL PRIMER PLANO: siluetas casi negras (cascotes de hormigon de esquinas redondas, matas secas, postes con su
// cadena, bidones, barandillas torcidas, cajas, varillas, tuberias a ras de abajo y cables que cuelgan por arriba).
// Sin tinta ni detalle: solo la masa y el canto de ARRIBA lamido por el contraluz, como en la imagen. El hilo que
// pinta lo desenfoca despues (CAPAS.frente.desenfoque).
import { azar } from '../taller/dibujo/tinta.js';
import { g } from '../taller/linde/base.js';
import { mata } from './juego.js';
import { X, Y, CP } from './comun.js';

const SIL = '#030303', SIL2 = '#070606', RIM = 'rgba(214,150,88,.55)', RIM2 = 'rgba(240,190,130,.35)';
const OSCURO = { tallo: '#050403', hoja: '#070605', hoja2: '#0b0907', hojaSeca: '#16110b', canto: 'rgba(200,140,80,.4)' };

function redondo(x0, y0, x1, y1) {
  const r = Math.min(0.2, (x1 - x0) * 0.22) * CP, a = X(x0), b = X(x1), t = Y(y1), s = Y(y0);
  g.beginPath(); g.moveTo(a, s); g.lineTo(a, t + r); g.quadraticCurveTo(a, t, a + r, t); g.lineTo(b - r, t); g.quadraticCurveTo(b, t, b, t + r); g.lineTo(b, s); g.closePath();
  const gr = g.createLinearGradient(0, t, 0, s); gr.addColorStop(0, SIL2); gr.addColorStop(1, SIL); g.fillStyle = gr; g.fill();
  // el canto de arriba, mas encendido hacia la derecha (de donde viene la luz)
  const lg = g.createLinearGradient(a, 0, b, 0); lg.addColorStop(0, 'rgba(214,150,88,.18)'); lg.addColorStop(1, RIM);
  g.strokeStyle = lg; g.lineWidth = 3; g.beginPath(); g.moveTo(a + r * 0.3, t + r * 0.25); g.quadraticCurveTo(a, t, a + r, t); g.lineTo(b - r, t); g.quadraticCurveTo(b, t, b, t + r); g.lineTo(b, t + r * 2); g.stroke();
  // grietas y desconchones (apenas se leen)
  const rr = azar(Math.round(x0 * 97)); g.strokeStyle = 'rgba(30,26,22,.9)'; g.lineWidth = 2;
  for (let k = 0; k < 3; k++) { let x = a + rr() * (b - a), y = t + 4; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 4; q++) { x += (rr() - 0.5) * 30; y += 10 + rr() * 20; g.lineTo(x, y); } g.stroke(); }
}
function poste(x, y0, y1, w = 0.1) {
  g.fillStyle = SIL; g.fillRect(X(x - w / 2), Y(y1), w * CP, (y1 - y0) * CP);
  g.fillStyle = RIM; g.fillRect(X(x + w / 2) - 2.4, Y(y1), 2.4, (y1 - y0) * CP * 0.6); g.fillRect(X(x - w / 2), Y(y1), w * CP, 2.4);
}
function linea(x0, y0, x1, y1, w, col = SIL) { g.strokeStyle = col; g.lineWidth = w * CP; g.lineCap = 'round'; g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); }
function comba(a, b, c, w) {
  g.strokeStyle = SIL; g.lineWidth = w * CP; g.beginPath(); g.moveTo(X(a[0]), Y(a[1]));
  g.quadraticCurveTo((X(a[0]) + X(b[0])) / 2, (Y(a[1]) + Y(b[1])) / 2 + c * CP * 2, X(b[0]), Y(b[1])); g.stroke();
}
function cadena(x, S, sem) {
  const rr = azar(sem), h = 0.9 + rr() * 0.4;
  poste(x, S, S + h, 0.12); poste(x + 1.4, S, S + h, 0.12);
  // eslabones: ovalos a lo largo de la comba
  for (let q = 0; q <= 22; q++) { const t = q / 22, px0 = x + 1.4 * t, py0 = S + h - 0.1 - 0.35 * 4 * t * (1 - t); g.strokeStyle = SIL; g.lineWidth = 3; g.beginPath(); g.ellipse(X(px0), Y(py0), q % 2 ? 6 : 3, q % 2 ? 3 : 5, 0.2, 0, 7); g.stroke(); }
}
function bidones(x, S, sem) {
  const rr = azar(sem);
  const uno = (cx, cy, w, h, tumbado) => {
    g.save(); g.translate(X(cx), Y(cy)); if (tumbado) g.rotate(Math.PI / 2);
    g.fillStyle = SIL2; g.fillRect(-w * CP / 2, -h * CP / 2, w * CP, h * CP);
    g.fillStyle = SIL; for (const f of [-0.3, 0.3]) g.fillRect(-w * CP / 2 - 2, f * h * CP - 3, w * CP + 4, 6);
    g.fillStyle = RIM; if (!tumbado) { g.fillRect(-w * CP / 2, -h * CP / 2, w * CP, 2.4); g.fillRect(w * CP / 2 - 3, -h * CP / 2, 3, h * CP); } else g.fillRect(-w * CP / 2, h * CP / 2 - 2.4, w * CP, 2.4);
    g.restore();
  };
  uno(x, S + 0.45, 0.6, 0.9, false); if (rr() < 0.6) uno(x + 0.82, S + 0.3, 0.6, 0.85, true);
}
function barandilla(x, S, sem) {
  for (let q = 0; q < 4; q++) linea(x + q * 0.4, S, x + q * 0.4 + (q === 2 ? 0.15 : 0), S + 1.05, 0.05);
  linea(x - 0.1, S + 1.0, x + 1.35, S + 0.92, 0.06); linea(x - 0.1, S + 1.0 + 0.03, x + 1.35, S + 0.95, 0.012, RIM);
}
function cajas(x, S) {
  for (const [cx, cy, w, h] of [[x, S, 0.7, 0.6], [x + 0.1, S + 0.6, 0.5, 0.45]]) { g.fillStyle = SIL2; g.fillRect(X(cx), Y(cy + h), w * CP, h * CP); g.strokeStyle = SIL; g.lineWidth = 3; g.strokeRect(X(cx) + 5, Y(cy + h) + 5, w * CP - 10, h * CP - 10); g.beginPath(); g.moveTo(X(cx) + 5, Y(cy + h) + 5); g.lineTo(X(cx + w) - 5, Y(cy) - 5); g.stroke(); g.fillStyle = RIM; g.fillRect(X(cx), Y(cy + h), w * CP, 2.4); g.fillRect(X(cx + w) - 2.4, Y(cy + h), 2.4, h * CP * 0.7); }
}
function varillas(x, S, sem) {
  const rr = azar(sem);
  redondo(x, S, x + 0.8, S + 0.55);
  for (let q = 0; q < 6; q++) { const x0 = x + 0.25 + q * 0.06, x1 = x + 0.05 + q * 0.14 + rr() * 0.25, y1 = S + 1.2 + rr() * 0.6; linea(x0, S + 0.5, x1, y1, 0.025); linea(x0 + 0.01, S + 0.5, x1 + 0.01, y1, 0.007, RIM2); }
}
function postes(x, S) {
  for (let q = 0; q < 5; q++) poste(x + q * 0.28, S, S + 0.95, 0.06);
  linea(x - 0.05, S + 0.85, x + 1.25, S + 0.85, 0.06); linea(x - 0.05, S + 0.875, x + 1.25, S + 0.875, 0.012, RIM);
}
function tubo(x0, x1, y) {
  const r = 0.21; g.fillStyle = SIL2; g.fillRect(X(x0), Y(y + r), (x1 - x0) * CP, 2 * r * CP);
  g.fillStyle = RIM; g.fillRect(X(x0), Y(y + r), (x1 - x0) * CP, 2.6);
  const rr = azar(Math.round(x0 * 17));
  for (let q = x0 + 0.6; q < x1; q += 1.6 + rr()) { g.fillStyle = SIL; g.fillRect(X(q), Y(y + r + 0.07), 0.09 * CP, (2 * r + 0.14) * CP); g.fillStyle = RIM; g.fillRect(X(q), Y(y + r + 0.07), 0.09 * CP, 2.4); g.fillStyle = SIL; g.fillRect(X(q + 0.5), Y(y - r), 0.18 * CP, 0.2 * CP); }
}
export function pintarFrente(p) {
  switch (p.t) {
    case 'bloqueR': redondo(p.x0, p.y0, p.x1, p.y1); break;
    case 'mata': mata(p.x, p.y, p.w, p.h, p.sem, OSCURO); break;
    case 'cadena': cadena(p.x, p.y, p.sem); break;
    case 'bidones': bidones(p.x, p.y, p.sem); break;
    case 'barandilla': barandilla(p.x, p.y, p.sem); break;
    case 'cajas': cajas(p.x, p.y); break;
    case 'varillas': varillas(p.x, p.y, p.sem); break;
    case 'postes': postes(p.x, p.y); break;
    case 'tubo': tubo(p.x0, p.x1, p.y); break;
    case 'cableAlto': comba(p.a, p.b, p.comba, 0.05); break;
  }
}
