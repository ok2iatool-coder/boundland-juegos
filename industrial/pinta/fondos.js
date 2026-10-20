// LOS PINTORES DE LOS FONDOS: cada tipo de pieza de disposicion.js pintado con el taller (web/taller/: la tinta,
// el hierro y el hormigon de El Linde y de la ciudad del juego) y lo que este nivel anade: remates de azotea,
// chimeneas, gruas, torres de refrigeracion, esferas de gas, cisternas, gasometros, depositos de agua, naves de
// dientes de sierra, andamios y cables. Todo en px del taller (X, Y de comun.js) y con la bruma de su capa (d).
import { TINTA, azar, mezclar, rgba, trazar, tinta } from '../taller/dibujo/tinta.js';
import { g, tono, ladoLuz, brillo, luces, brillos } from '../taller/linde/base.js';
import { chapa, tubo, torreCelosia } from '../taller/linde/metal.js';
import { edificio, aguja } from '../taller/linde/casas.js';
import { torreGotica, cupula, pasoElevado, torreLuz } from '../taller/ciudad/piezas.js';
import { X, Y, CP } from './comun.js';

const tk = (w0, d) => (d < 0.4 ? w0 * (1 - (d / 0.4) * 0.65) : 0);
function linea(pts, col, w, cap = 'round') { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]); g.strokeStyle = col; g.lineWidth = w; g.lineCap = cap; g.lineJoin = 'round'; g.stroke(); }
function forma(pts, col, d, t = 2) { trazar(g, pts); g.fillStyle = col; g.fill(); const w = tk(t, d); if (w) tinta(g, w); }
const LUZ = (d, x) => tono('#e6b47a', d * 0.55, x);           // el canto que lame el contraluz (calido)

// ---------------------------------------------------------------- remates de azotea
// depositos de agua sobre patas con tejadillo, torretas de celosia, antenas con travesanos, chimeneas cortas,
// carteles sobre su estructura, casetas y conductos: lo que da a la silueta su complejidad (como en la imagen)
export function remate(p, d) {
  const rr = azar(p.sem), x0 = X(p.x0), x1 = X(p.x1), ya = Y(p.y), w = x1 - x0, col = tono('#3a3530', d, x0), fino = 0.022 * CP * (1 + d);
  const n = Math.max(1, Math.round((p.x1 - p.x0) * 1.4 * p.dens));
  for (let k = 0; k < n; k++) {
    const x = x0 + 30 + rr() * Math.max(10, w - 60), q = rr();
    if (q < 0.17) {          // deposito de agua
      const r = (0.22 + rr() * 0.22) * CP, hp = (0.5 + rr() * 0.8) * CP, ht = r * (1.6 + rr() * 0.6);
      for (const s of [-1, -0.3, 0.3, 1]) linea([[x + s * r, ya], [x + s * r * 0.85, ya - hp]], col, fino * 1.3);
      linea([[x - r, ya - hp * 0.5], [x + r, ya - hp * 0.5]], col, fino);
      linea([[x - r, ya - hp * 0.15], [x + r * 0.9, ya - hp * 0.85]], col, fino * 0.6);
      forma([[x - r, ya - hp], [x - r, ya - hp - ht], [x + r, ya - hp - ht], [x + r, ya - hp]], col, d);
      forma([[x - r * 1.1, ya - hp - ht], [x, ya - hp - ht - r * 0.8], [x + r * 1.1, ya - hp - ht]], col, d);
      g.fillStyle = LUZ(d, x); g.globalAlpha = 0.5; g.fillRect(x + r - 3, ya - hp - ht, 3, ht); g.globalAlpha = 1;
    } else if (q < 0.32) {   // torreta de celosia
      const h = (0.8 + rr() * 1.8) * CP, a = (0.18 + rr() * 0.12) * CP;
      linea([[x - a, ya], [x - a * 0.4, ya - h]], col, fino); linea([[x + a, ya], [x + a * 0.4, ya - h]], col, fino);
      for (let y = 0; y < h - 10; y += 0.3 * CP) { const t0 = y / h, t1 = Math.min(1, (y + 0.3 * CP) / h); linea([[x - a * (1 - t0 * 0.6), ya - y], [x + a * (1 - t1 * 0.6), ya - y - 0.3 * CP]], col, fino * 0.5); linea([[x + a * (1 - t0 * 0.6), ya - y], [x - a * (1 - t1 * 0.6), ya - y - 0.3 * CP]], col, fino * 0.5); }
      linea([[x, ya - h], [x, ya - h - 0.6 * CP]], col, fino * 0.7);
    } else if (q < 0.5) {    // antena con travesanos
      const h = (0.7 + rr() * 2.0) * CP; linea([[x, ya], [x, ya - h]], col, fino);
      for (let t = 0; t < 1 + Math.floor(rr() * 3); t++) { const yy = ya - h * (0.5 + t * 0.18), l = (0.15 + rr() * 0.25) * CP; linea([[x - l, yy], [x + l, yy]], col, fino * 0.7); }
    } else if (q < 0.62) {   // chimenea corta
      const r = (0.06 + rr() * 0.07) * CP, h = (0.4 + rr() * 0.9) * CP; forma([[x - r, ya], [x - r, ya - h], [x + r, ya - h], [x + r, ya]], col, d); forma([[x - r * 1.5, ya - h], [x + r * 1.5, ya - h], [x + r * 1.5, ya - h - 8], [x - r * 1.5, ya - h - 8]], col, d);
    } else if (q < 0.72 && w > 1.5 * CP) {    // cartel sobre su estructura
      const cw = (0.6 + rr() * 0.9) * CP, ch = (0.3 + rr() * 0.3) * CP, h = (0.3 + rr() * 0.4) * CP;
      for (const s of [-0.4, 0.4]) linea([[x + s * cw, ya], [x + s * cw, ya - h]], col, fino);
      linea([[x - cw * 0.4, ya - h * 0.2], [x + cw * 0.4, ya - h * 0.8]], col, fino * 0.5);
      forma([[x - cw / 2, ya - h], [x + cw / 2, ya - h], [x + cw / 2, ya - h - ch], [x - cw / 2, ya - h - ch]], col, d);
    } else if (q < 0.88) {   // caseta
      const cw = (0.3 + rr() * 0.7) * CP, ch = (0.25 + rr() * 0.55) * CP; forma([[x - cw / 2, ya + 2], [x - cw / 2, ya - ch], [x + cw / 2, ya - ch], [x + cw / 2, ya + 2]], col, d);
      g.fillStyle = LUZ(d, x); g.globalAlpha = 0.4; g.fillRect(x + cw / 2 - 2.5, ya - ch, 2.5, ch); g.globalAlpha = 1;
    } else { const l = (0.5 + rr() * 1.2) * CP; forma([[x, ya + 1], [x, ya - 0.14 * CP], [x + l, ya - 0.14 * CP], [x + l, ya + 1]], col, d); }
  }
  if (rr() < 0.45) { const h = 0.32 * CP; for (let x = x0 + 6; x < x1 - 4; x += 0.22 * CP) linea([[x, ya], [x, ya - h]], col, fino * 0.6); linea([[x0 + 4, ya - h], [x1 - 4, ya - h]], col, fino * 0.8); }
}

// ---------------------------------------------------------------- piezas propias de los fondos
export function chimeneaP(p, d) {
  const x = X(p.x), b = Y(p.y0), t = Y(p.y0 + p.alto), r = p.r * CP, col = tono('#3c3631', d, x), osc = tono('#2a2522', d, x);
  forma([[x - r, b], [x - r * 0.82, t], [x + r * 0.82, t], [x + r, b]], col, d);
  g.fillStyle = osc; g.globalAlpha = 0.6; trazar(g, [[x - r, b], [x - r * 0.82, t], [x - r * 0.3, t], [x - r * 0.4, b]]); g.fill(); g.globalAlpha = 1;
  g.fillStyle = LUZ(d, x); g.globalAlpha = 0.5; trazar(g, [[x + r * 0.6, b], [x + r * 0.5, t], [x + r * 0.82, t], [x + r, b]]); g.fill(); g.globalAlpha = 1;
  for (let k = 1; k < 8; k++) { const yy = b + (t - b) * (k / 8), rr2 = r * (1 - 0.18 * (k / 8)) * 1.08; forma([[x - rr2, yy + 4], [x + rr2, yy + 4], [x + rr2, yy - 4], [x - rr2, yy - 4]], osc, d, 1); }
  forma([[x - r * 0.98, t + 6], [x + r * 0.98, t + 6], [x + r * 0.92, t - 10], [x - r * 0.92, t - 10]], osc, d);
  // plataformas en anillo con su barandilla (las chimeneas altas de la imagen) y la boca encendida
  if (p.alto > 2.4) for (const f of p.alto > 4 ? [0.55, 0.8] : [0.7]) { const yy = b + (t - b) * f, rw = r * (1 - 0.18 * f) * 1.55; forma([[x - rw, yy], [x + rw, yy], [x + rw, yy - 5], [x - rw, yy - 5]], osc, d, 1); for (let xx = x - rw; xx <= x + rw; xx += 7) linea([[xx, yy - 5], [xx, yy - 0.12 * CP]], osc, 1.2); linea([[x - rw, yy - 0.12 * CP], [x + rw, yy - 0.12 * CP]], osc, 1.6); for (const s2 of [-1, 1]) linea([[x + s2 * rw, yy], [x + s2 * r * 0.9, yy + 0.25 * CP]], osc, 1.4); }
  if (p.alto > 2.4) { g.fillStyle = tono('#ffb060', d * 0.4, x); g.globalAlpha = 0.85; g.fillRect(x - r * 0.9, t - 3, r * 1.8, 3); g.globalAlpha = 1; brillos.push([x, t - 2, r * 2.4, '#ff9a4a', 0.35 * (1 - d * 0.6)]); }
  // escalerilla
  const ex = x + r * 0.55; linea([[ex, b], [ex - r * 0.1, t]], osc, 1.4); linea([[ex + 7, b], [ex + 7 - r * 0.1, t]], osc, 1.4);
}
export function gruaP(p, d) {
  // como la de la imagen: un pilar alto con su caseta, la pluma de celosia que lo cruza cerca de arriba, el
  // contrapeso a un lado y el mastil con los tirantes a las puntas
  const x = X(p.x), b = Y(p.y0), t = Y(p.y0 + p.alto), col = tono('#3c3631', d, x), osc = tono('#2c2723', d, x), w0 = 0.15 * CP, fino = 0.03 * CP * (1 + d);
  forma([[x - w0 * 1.5, b], [x - w0, b - 0.5 * CP], [x - w0, t], [x + w0, t], [x + w0, b - 0.5 * CP], [x + w0 * 1.5, b]], col, d);
  for (let y = b - 0.6 * CP; y > t + 0.4 * CP; y -= 0.55 * CP) { linea([[x - w0, y], [x + w0, y - 0.5 * CP]], osc, fino * 0.6); linea([[x + w0, y], [x - w0, y - 0.5 * CP]], osc, fino * 0.6); }
  g.fillStyle = LUZ(d, x); g.globalAlpha = 0.45; g.fillRect(x + w0 - 3, t, 3, b - t); g.globalAlpha = 1;
  const yb = t + 0.62 * CP, yt2 = t + 0.47 * CP, xa = X(p.x - p.izq), xb = X(p.x + p.der);
  forma([[x - w0 * 1.7, yb + 0.42 * CP], [x - w0 * 1.7, yb], [x + w0 * 1.7, yb], [x + w0 * 1.7, yb + 0.42 * CP]], col, d);
  linea([[xa, yb], [xb, yb]], col, fino * 1.3); linea([[xa + 0.1 * CP, yt2], [xb - 0.05 * CP, yt2]], col, fino);
  const n = Math.max(3, Math.round((xb - xa) / (0.32 * CP)));
  for (let k = 0; k < n; k++) { const a = xa + ((xb - xa) * k) / n, c = xa + ((xb - xa) * (k + 0.5)) / n, e = xa + ((xb - xa) * (k + 1)) / n; linea([[a, yb], [c, yt2], [e, yb]], col, fino * 0.7); }
  forma([[xa - 0.05 * CP, yb + 0.32 * CP], [xa - 0.05 * CP, yb - 0.02 * CP], [xa + 0.42 * CP, yb - 0.02 * CP], [xa + 0.42 * CP, yb + 0.32 * CP]], col, d);
  const mt = t - 0.55 * CP; linea([[x, yt2], [x, mt]], col, fino * 1.2);
  for (let y = yt2; y > mt; y -= 0.12 * CP) linea([[x - 0.05 * CP, y], [x + 0.05 * CP, y - 0.06 * CP]], col, fino * 0.4);
  linea([[x, mt], [xa + 0.2 * CP, yt2]], col, fino * 0.45); linea([[x, mt], [xb - 0.2 * CP, yt2]], col, fino * 0.45); linea([[x, mt], [x + (xb - x) * 0.5, yt2]], col, fino * 0.35);
  g.fillStyle = LUZ(d, x); g.globalAlpha = 0.4; g.fillRect(xa, yt2 - 1.5, xb - xa, 1.5); g.globalAlpha = 1;
}
export function refrigeracionP(p, d) {
  const x = X(p.x), b = Y(p.y0), t = Y(p.y0 + p.alto), r = p.r * CP, col = tono('#4a433c', d, x);
  g.beginPath(); g.moveTo(x - r, b); g.quadraticCurveTo(x - r * 0.45, (b + t) / 2, x - r * 0.7, t); g.lineTo(x + r * 0.7, t); g.quadraticCurveTo(x + r * 0.45, (b + t) / 2, x + r, b); g.closePath(); g.fillStyle = col; g.fill();
  g.fillStyle = LUZ(d, x); g.globalAlpha = 0.35; g.beginPath(); g.moveTo(x + r * 0.7, b); g.quadraticCurveTo(x + r * 0.3, (b + t) / 2, x + r * 0.5, t); g.lineTo(x + r * 0.7, t); g.quadraticCurveTo(x + r * 0.45, (b + t) / 2, x + r, b); g.closePath(); g.fill(); g.globalAlpha = 1;
}
export function esferaP(p, d) {
  const x = X(p.x), b = Y(p.y0), r = p.r * CP, yc = b - r * 1.5, col = tono('#3f3934', d, x), osc = tono('#2a2522', d, x);
  for (let k = 0; k < 6; k++) { const px0 = x + Math.cos(Math.PI * k / 5) * r * 0.92; linea([[px0, b], [px0, yc]], col, Math.max(2, r * 0.08), 'butt'); }
  for (let k = 0; k < 5; k++) linea([[x + Math.cos(Math.PI * k / 5) * r * 0.92, b - r * 0.3], [x + Math.cos(Math.PI * (k + 1) / 5) * r * 0.92, yc + r * 0.1]], col, 1.6);
  const gr = g.createRadialGradient(x + r * 0.4, yc - r * 0.4, r * 0.1, x, yc, r); gr.addColorStop(0, mezclar(col, LUZ(d, x), 0.35)); gr.addColorStop(0.5, col); gr.addColorStop(1, osc);
  g.beginPath(); g.arc(x, yc, r, 0, 7); g.fillStyle = gr; g.fill(); if (tk(2, d)) tinta(g, tk(2, d));
  linea([[x - r * 1.05, yc], [x + r * 1.05, yc]], osc, 3);
  for (let xx = x - r; xx <= x + r; xx += r * 0.2) linea([[xx, yc], [xx, yc - r * 0.25]], osc, 1.2);
  linea([[x - r * 1.4, b], [x - r * 0.3, yc - r * 0.9]], col, 2);
}
export function cisternaP(p, d) {
  const x = X(p.x), b = Y(p.y0), l = p.l * CP, r = p.r * CP, cy = b - r - 0.15 * CP, col = tono('#3f3934', d, x);
  for (const s of [-0.3, 0.3]) forma([[x + s * l - 18, b], [x + s * l - 12, cy], [x + s * l + 12, cy], [x + s * l + 18, b]], col, d);
  g.beginPath(); g.moveTo(x - l / 2, cy - r); g.lineTo(x + l / 2, cy - r); g.arc(x + l / 2, cy, r, -Math.PI / 2, Math.PI / 2); g.lineTo(x - l / 2, cy + r); g.arc(x - l / 2, cy, r, Math.PI / 2, Math.PI * 1.5); g.closePath(); g.fillStyle = col; g.fill(); if (tk(2, d)) tinta(g, tk(2, d));
  g.fillStyle = LUZ(d, x); g.globalAlpha = 0.4; g.fillRect(x - l / 2, cy - r, l, 3); g.globalAlpha = 1;
  for (let k = 1; k < 4; k++) linea([[x - l / 2 + (l * k) / 4, cy - r], [x - l / 2 + (l * k) / 4, cy + r]], tono('#2a2522', d, x), 2);
}
export function gasometroP(p, d) {
  const x = X(p.x), b = Y(p.y0), r = p.r * CP, h = p.alto * CP, col = tono('#3a3430', d, x), osc = tono('#26221f', d, x);
  forma([[x - r * 0.9, b], [x - r * 0.9, b - h * 0.72], [x + r * 0.9, b - h * 0.72], [x + r * 0.9, b]], osc, d);
  g.fillStyle = LUZ(d, x); g.globalAlpha = 0.25; g.fillRect(x + r * 0.7, b - h * 0.72, r * 0.2, h * 0.72); g.globalAlpha = 1;
  for (let k = 0; k <= 8; k++) { const cx = x + Math.cos(Math.PI * (k / 8)) * r; linea([[cx, b], [cx, b - h]], col, 5, 'butt'); }
  for (let q = 1; q <= 4; q++) { const y = b - (h * q) / 4; linea([[x - r, y], [x + r, y]], col, 4); for (let k = 0; k < 8; k++) { const a0 = x + Math.cos(Math.PI * (k / 8)) * r, a1 = x + Math.cos(Math.PI * ((k + 1) / 8)) * r; linea([[a0, y + h / 4], [a1, y]], col, 1.6); } }
}
export function depositoP(p, d) {
  const x = X(p.x), b = Y(p.y0), al = p.alto * CP, r = al * 0.16, yt = b - al * 0.68, col = tono('#36302b', d, x);
  for (const s of [-1, -0.35, 0.35, 1]) linea([[x + s * r * 1.15, b], [x + s * r * 0.85, yt]], col, 6, 'butt');
  for (let q = 0; q < 3; q++) { const ya = b + (yt - b) * (q / 3), yb = b + (yt - b) * ((q + 1) / 3); linea([[x - r * 1.1, ya], [x + r, yb]], col, 2); linea([[x + r * 1.1, ya], [x - r, yb]], col, 2); }
  forma([[x - r, yt], [x - r, yt - al * 0.22], [x + r, yt - al * 0.22], [x + r, yt]], col, d);
  forma([[x - r * 1.05, yt - al * 0.22], [x, yt - al * 0.32], [x + r * 1.05, yt - al * 0.22]], col, d);
  g.fillStyle = LUZ(d, x); g.globalAlpha = 0.45; g.fillRect(x + r - 4, yt - al * 0.22, 4, al * 0.22); g.globalAlpha = 1;
  for (let xx = x - r; xx <= x + r; xx += r * 0.25) linea([[xx, yt], [xx, yt + 18]], col, 1.4);
}
export function naveP(p, d) {
  const x0 = X(p.x0), x1 = X(p.x1), b = Y(p.y0), t = Y(p.y0 + p.alto), col = tono('#38322d', d, x0), dt = 1.6 * CP;
  const pts = [[x0, b], [x0, t]]; for (let x = x0; x < x1 - 1; x += dt) { pts.push([Math.min(x1, x + dt * 0.82), t - 0.9 * CP], [Math.min(x1, x + dt * 0.82), t], [Math.min(x1, x + dt), t]); } pts.push([x1, b]);
  forma(pts, col, d);
  for (let x = x0; x < x1 - 1; x += dt) { g.fillStyle = tono('#c79a62', d * 0.7, x); g.globalAlpha = 0.5; g.fillRect(x + dt * 0.82 - 5, t - 0.85 * CP, 4, 0.8 * CP); g.globalAlpha = 1; }
  const rr = azar(Math.round(x0)); for (let x = x0 + 30; x < x1 - 40; x += 0.7 * CP) if (rr() < 0.3) { g.fillStyle = tono('#e9b46e', d * 0.6, x); g.fillRect(x, b - 1.4 * CP, 0.25 * CP, 0.5 * CP); }
}
export function andamioP(p, d) {
  const x0 = X(p.x0), x1 = X(p.x1), b = Y(p.y0), t = Y(p.y0 + p.alto), col = tono('#2c2723', d, x0), rr = azar(Math.round(x0));
  for (let x = x0; x <= x1 + 1; x += 0.9 * CP) linea([[x, b], [x, t]], col, 3, 'butt');
  for (let y = b - 1.1 * CP; y >= t - 1; y -= 1.1 * CP) { linea([[x0, y], [x1, y]], col, 2.5); if (rr() < 0.6) forma([[x0, y], [x1, y], [x1, y + 5], [x0, y + 5]], col, d, 1); }
  for (let x = x0; x < x1 - 4; x += 0.9 * CP) for (let y = b; y > t + 10; y -= 1.1 * CP) if (rr() < 0.45) linea([[x, y], [x + 0.9 * CP, y - 1.1 * CP]], col, 1.4);
}
export function cableP(p, d, grueso = 2) {
  const a = [X(p.a[0]), Y(p.a[1])], b = [X(p.b[0]), Y(p.b[1])], c = p.comba * CP;
  g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + c * 2, b[0], b[1]);
  g.strokeStyle = tono('#141210', d * 0.8, a[0]); g.lineWidth = grueso; g.stroke();
}

// ---------------------------------------------------------------- las torres de la imagen
// TORRE ESCALONADA (la gotica industrial de la izquierda del centro): fuste macizo con ventanucos, cuerpos abiertos
// que menguan hacia arriba con su celosia en aspa y un balcon con barandilla encima de cada uno, y la aguja con su
// bola y el pararrayos. p.w es el medio ancho del cuerpo de abajo (u), p.cuerpos cuantos.
export function torreEscalonadaP(p, d) {
  const x = X(p.x), b = Y(p.y0), H = p.alto * CP, rr = azar(Math.round(p.x * 31)), col = tono('#2f2b28', d, x), osc = tono('#221f1d', d, x), fino = 0.022 * CP * (1 + d);
  const n = p.cuerpos || 3, fuste = H * 0.3, aguja = H * 0.3, hc = (H - fuste - aguja) / n;
  let w = p.w * CP, y = b;
  // el fuste: macizo, con ventanucos (alguno encendido) y el canto a la luz
  forma([[x - w, y], [x - w, y - fuste], [x + w, y - fuste], [x + w, y]], col, d);
  for (let yy = y - 0.35 * CP; yy > y - fuste + 0.2 * CP; yy -= 0.42 * CP) for (let xx = x - w + 0.12 * CP; xx < x + w - 0.15 * CP; xx += 0.22 * CP) if (rr() < 0.55) { const enc = rr() < 0.12; g.fillStyle = enc ? '#e8a95e' : osc; g.fillRect(xx, yy - 0.16 * CP, 0.07 * CP, 0.16 * CP); if (enc) luces.push([xx + 0.035 * CP, yy - 0.08 * CP, 2.4 * (1 - d), 0.6]); }
  g.fillStyle = LUZ(d, x); g.globalAlpha = 0.45; g.fillRect(x + w - 3, y - fuste, 3, fuste); g.globalAlpha = 1;
  y -= fuste;
  for (let k = 0; k < n; k++) {
    // el balcon que vuela (losa + barandilla)
    const vb = w * 1.22; forma([[x - vb, y + 0.06 * CP], [x - vb, y - 0.02 * CP], [x + vb, y - 0.02 * CP], [x + vb, y + 0.06 * CP]], osc, d, 1.4);
    const wn = w * 0.8, yt = y - hc;
    // el cuerpo abierto: cuatro pies, travesanos y aspas
    for (const s of [-1, -0.33, 0.33, 1]) linea([[x + s * w * 0.92, y], [x + s * wn * 0.92, yt]], col, fino * (Math.abs(s) === 1 ? 2.2 : 1));
    const pisos = 2; for (let q = 0; q < pisos; q++) { const ya = y - (hc * q) / pisos, yb = y - (hc * (q + 1)) / pisos, wa = w + (wn - w) * (q / pisos), wb = w + (wn - w) * ((q + 1) / pisos); linea([[x - wa * 0.92, ya], [x + wb * 0.92, yb]], col, fino * 0.8); linea([[x + wa * 0.92, ya], [x - wb * 0.92, yb]], col, fino * 0.8); linea([[x - wb, yb], [x + wb, yb]], col, fino); }
    // la barandilla del balcon
    for (let xx = x - vb; xx <= x + vb; xx += 0.09 * CP) linea([[xx, y - 0.02 * CP], [xx, y - 0.2 * CP]], col, fino * 0.45);
    linea([[x - vb, y - 0.2 * CP], [x + vb, y - 0.2 * CP]], col, fino * 0.8);
    g.fillStyle = LUZ(d, x); g.globalAlpha = 0.5; g.fillRect(x - vb, y - 0.035 * CP, vb * 2, 2); g.globalAlpha = 1;
    // una caseta maciza dentro del cuerpo de en medio
    if (k === 1) forma([[x - wn * 0.5, y], [x - wn * 0.5, y - hc * 0.55], [x + wn * 0.5, y - hc * 0.55], [x + wn * 0.5, y]], col, d, 1.4);
    y = yt; w = wn;
  }
  // la aguja: chapitel de dos tramos, la bola y el pararrayos
  forma([[x - w, y], [x - w * 0.55, y - aguja * 0.25], [x + w * 0.55, y - aguja * 0.25], [x + w, y]], col, d);
  forma([[x - w * 0.5, y - aguja * 0.25], [x - w * 0.12, y - aguja * 0.85], [x + w * 0.12, y - aguja * 0.85], [x + w * 0.5, y - aguja * 0.25]], col, d);
  g.beginPath(); g.arc(x, y - aguja * 0.88, Math.max(3, w * 0.16), 0, 7); g.fillStyle = col; g.fill();
  linea([[x, y - aguja * 0.88], [x, y - aguja * 1.02]], col, fino * 0.6);
  g.fillStyle = LUZ(d, x); g.globalAlpha = 0.4; trazar(g, [[x + w * 0.3, y - aguja * 0.25], [x + w * 0.05, y - aguja * 0.85], [x + w * 0.12, y - aguja * 0.85], [x + w * 0.5, y - aguja * 0.25]]); g.fill(); g.globalAlpha = 1;
  // un tubo de humos pegado al fuste, a veces
  if (rr() < 0.6) { const tx = x + p.w * CP * 1.5; forma([[tx - 0.06 * CP, b], [tx - 0.06 * CP, b - fuste - hc * 1.3], [tx + 0.06 * CP, b - fuste - hc * 1.3], [tx + 0.06 * CP, b]], col, d, 1.2); }
}
// PILON ELECTRICO (el de la imagen): celosia que se estrecha, con tres crucetas de las que cuelgan los aisladores
// (los cables de disposicion.js se cuelgan de sus puntas: la misma cuenta de los brazos)
export function pilonP(p, d) {
  const x = X(p.x), b = Y(p.y0), H = p.alto * CP, A = p.ancho * CP, col = tono('#262321', d, x), fino = 0.024 * CP * (1 + d * 0.8);
  const half = (t) => A * 0.5 * (1 - Math.pow(t, 0.75) * 0.82), Yt = (t) => b - H * t;
  linea([[x - half(0), b], [x - half(1), Yt(1)]], col, fino * 2); linea([[x + half(0), b], [x + half(1), Yt(1)]], col, fino * 2);
  const niveles = [0]; for (let t = 0; t < 0.99;) { t += 0.05 + 0.1 * (1 - t); niveles.push(Math.min(1, t)); }
  for (let k = 0; k < niveles.length - 1; k++) {
    const a = niveles[k], c = niveles[k + 1];
    linea([[x - half(a), Yt(a)], [x + half(c), Yt(c)]], col, fino * 0.6); linea([[x + half(a), Yt(a)], [x - half(c), Yt(c)]], col, fino * 0.6);
    linea([[x - half(c), Yt(c)], [x + half(c), Yt(c)]], col, fino * 0.7);
  }
  for (const [t, l] of [[0.62, 1.0], [0.76, 1.35], [0.9, 0.85]]) {
    const y = Yt(t), hb = half(t), L = A * 0.5 * l;
    for (const s of [-1, 1]) {
      const xs = x + s * hb, xt = x + s * (hb + L);
      linea([[xs, y], [xt, y]], col, fino); linea([[xs, y + 0.14 * CP], [xt, y + 0.02 * CP]], col, fino * 0.6);
      for (let q = 0; q < 3; q++) { const u0 = xs + ((xt - xs) * q) / 3, u1 = xs + ((xt - xs) * (q + 1)) / 3; linea([[u0, y + 0.14 * CP * (1 - q / 3)], [u1, y]], col, fino * 0.45); }
      linea([[xt, y], [xt, y + 0.3 * CP]], col, fino * 0.5); g.fillStyle = col; g.fillRect(xt - 0.03 * CP, y + 0.12 * CP, 0.06 * CP, 0.2 * CP);
    }
  }
  linea([[x - half(1), Yt(1)], [x, Yt(1) - 0.35 * CP], [x + half(1), Yt(1)]], col, fino * 0.8);
  linea([[x, Yt(1) - 0.35 * CP], [x, Yt(1) - 0.6 * CP]], col, fino * 0.5);
  g.strokeStyle = LUZ(d, x); g.globalAlpha = 0.45; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + half(0) + fino * 0.6, b); g.lineTo(x + half(1) + fino * 0.6, Yt(1)); g.stroke(); g.globalAlpha = 1;
}

// ---------------------------------------------------------------- reparto: un tipo, su pintor
export function pintarFondo(p, d) {
  switch (p.t) {
    case 'bloque': edificio(X(p.x0), Y(p.y0), (p.x1 - p.x0) * CP, p.alto * CP, d, p.sem); break;
    case 'remate': remate(p, d); break;
    case 'torreG': if (p.w >= 0.45) torreEscalonadaP(p, d); else torreGotica(X(p.x), Y(p.y0), p.alto * CP, p.w * CP, d, Math.round(p.x * 31), { esqueleto: 0.45 }); break;
    case 'aguja': aguja(X(p.x), Y(p.y0), p.alto * CP, p.w * CP, d, Math.round(p.x * 17)); break;
    case 'pilon': pilonP(p, d); break;
    case 'viaducto': pasoElevado(X(p.x0), X(p.x1), Y(p.y), Y(p.y - p.alto), d, Math.round(p.x0 * 7), { vano: p.vano * CP * (p.tren ? 1.17 : 1.25), canto: 0.3 * CP, soldados: 0 }); break;
    case 'chimenea': chimeneaP(p, d); break;
    case 'grua': gruaP(p, d); break;
    case 'cupula': cupula(X(p.x), Y(p.y0), p.r * CP, d, Math.round(p.x * 11)); break;
    case 'refrigeracion': refrigeracionP(p, d); break;
    case 'esfera': esferaP(p, d); break;
    case 'cisterna': cisternaP(p, d); break;
    case 'gasometro': gasometroP(p, d); break;
    case 'deposito': depositoP(p, d); break;
    case 'nave': naveP(p, d); break;
    case 'andamio': andamioP(p, d); break;
    case 'cable': cableP(p, d, 2.4); break;
  }
}
