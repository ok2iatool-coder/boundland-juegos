// LA CIUDAD · PIEZAS: lo que la ciudad lleva de suyo (la imagen de referencia del usuario,
// boundland/concepto/ciudad_referencia.webp): torres goticas que se deshacen en esqueleto, la cupula de costillas,
// la catedral, el paso elevado de arcos con los soldados de la Podredumbre encima, los armazones de hormigon con
// sus orbes de celosia encendidos por dentro, farolas altas con estandarte, semaforos, torres de la luz,
// barreras, escombros y siluetas de soldados.
// Se pintan en `g` (linde/base.js) en px del concepto (un u del juego son PXU px) y con la bruma de su capa
// (tono): son del mismo taller que las del Linde y usan su hierro (linde/metal.js) para la materia.
// Reglas de la direccion de arte (GDD): una sola tinta, que desaparece con la distancia; el NARANJA solo para la
// Podredumbre (orbes, hongos, soldados mutados); el oxido es PARDO; nada brilla mas que el 18 salvo la Podredumbre
// lejana, que es un punto.
import { TINTA, azar, mezclar, rgba, trazar, tinta, hash } from '../dibujo/tinta.js';
import { g, tono, ladoLuz, brillos, luces, brillo } from '../linde/base.js';
import { chapa, tubo, torreCelosia } from '../linde/metal.js';
import { estandarte } from '../linde/casas.js';

export const PODRE = '#e2792b', PODRE_CLARO = '#ffb46a', PODRE_OSC = '#7a3510';
// grosor de tinta segun la distancia: entero cerca, nada pasado d 0,4
const tk = (w0, d) => (d < 0.4 ? w0 * (1 - (d / 0.4) * 0.65) : 0);
function camino(pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]); }
function linea(pts, col, w, cap = 'round') { camino(pts); g.strokeStyle = col; g.lineWidth = w; g.lineCap = cap; g.lineJoin = 'round'; g.stroke(); }
// un poligono relleno con su tinta
function forma(pts, col, d, t = 2.2) { trazar(g, pts); g.fillStyle = col; g.fill(); const w = tk(t, d); if (w) tinta(g, w); }
// arco apuntado (gotico) de ancho w y alto h con la base en (x, y): como lista de puntos
function ojiva(x, y, w, h, n = 6) {
  const pts = [[x, y], [x, y - h + w * 0.55]];
  for (let k = 1; k <= n; k++) { const t = k / n, a = Math.PI - t * Math.PI / 2.2; pts.push([x + w / 2 + Math.cos(a) * w * 0.62 - w * 0.12 * t, y - h + w * 0.55 - Math.sin(a) * w * 0.55 - t * w * 0.18]); }
  pts.push([x + w / 2, y - h]);
  for (let k = n; k >= 1; k--) { const t = k / n, a = Math.PI - t * Math.PI / 2.2; pts.push([x + w - (w / 2 + Math.cos(a) * w * 0.62 - w * 0.12 * t), y - h + w * 0.55 - Math.sin(a) * w * 0.55 - t * w * 0.18]); }
  pts.push([x + w, y - h + w * 0.55], [x + w, y]);
  return pts;
}
function ojivaCamino(x, y, w, h) { const p = ojiva(x, y, w, h); g.moveTo(p[0][0], p[0][1]); for (let k = 1; k < p.length; k++) g.lineTo(p[k][0], p[k][1]); g.closePath(); }

// ================================================================= LA PODREDUMBRE
// Hongos: tallos finos que se curvan hacia fuera con una bola encendida en la punta (los de la referencia, en las
// cabezas de los soldados y en las grietas). (x, y): donde nacen; dir: hacia donde se abren (-1..1 de lado)
export function hongos(x, y, n, s, d, sem, o = {}) {
  const rr = azar(sem), osc = tono(PODRE_OSC, d * 0.7, x), med = tono(PODRE, d * 0.5, x), luz = tono(PODRE_CLARO, d * 0.4, x);
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + ((k + 0.5) / n - 0.5) * (o.abre ?? 1.6) + (rr() - 0.5) * 0.35 + (o.dir || 0) * 0.5, l = s * (0.6 + rr() * 0.7);
    const x1 = x + Math.cos(a) * l, y1 = y + Math.sin(a) * l, qx = x + Math.cos(a + 0.4 * (rr() - 0.5)) * l * 0.5, qy = y + Math.sin(a) * l * 0.6;
    const w = Math.max(1.2, s * 0.07);
    if (tk(1, d)) { g.strokeStyle = TINTA; g.lineWidth = w + 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(qx, qy, x1, y1); g.stroke(); }
    g.strokeStyle = osc; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(qx, qy, x1, y1); g.stroke();
    const r = s * (0.12 + rr() * 0.08);
    g.beginPath(); g.arc(x1, y1, r, 0, 7); g.fillStyle = med; g.fill(); if (tk(1.6, d)) tinta(g, tk(1.6, d));
    g.beginPath(); g.arc(x1 - r * 0.3, y1 - r * 0.3, r * 0.45, 0, 7); g.fillStyle = luz; g.fill();
    brillos.push([x1, y1, r * 5, PODRE, 0.28 * (1 - d * 0.5)]);
  }
}
// ORBE: el nido de la Podredumbre. Esfera de costillas de hierro negro (meridianos y paralelos, alguno roto) con
// celdas encendidas por dentro, mas fuertes abajo y en el centro, hongos que asoman por la jaula y una peana de
// costillas que la agarra a lo que tenga debajo.
export function orbe(cx, cy, r, d, sem, o = {}) {
  const rr = azar(sem), T = (c) => tono(c, d, cx);
  // dentro: el fuego en celdas (oscuro casi negro con brasas)
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
  const gr = g.createRadialGradient(cx - r * 0.15, cy + r * 0.2, r * 0.1, cx, cy, r);
  gr.addColorStop(0, T(mezclar(PODRE, PODRE_CLARO, 0.45))); gr.addColorStop(0.45, T(mezclar(PODRE, PODRE_OSC, 0.25))); gr.addColorStop(0.85, T(PODRE_OSC)); gr.addColorStop(1, T('#2a120a'));
  g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  // celdas: manchas oscuras de las paredes de dentro
  for (let k = 0; k < 18; k++) { const a = rr() * 7, q = Math.sqrt(rr()) * r; g.beginPath(); g.ellipse(cx + Math.cos(a) * q, cy + Math.sin(a) * q, r * (0.08 + rr() * 0.12), r * (0.05 + rr() * 0.1), rr() * 3, 0, 7); g.fillStyle = rgba(T('#1a0b06'), 0.55); g.fill(); }
  g.restore();
  // la jaula: meridianos (elipses estrechas) y paralelos
  const neg = T('#0d0a0a'), med = T('#2b2422'), luz = tono('#c9a477', d * 0.6, cx), w = Math.max(1.6, r * 0.075);
  const tw = tk(1.4, d);
  const arco = (fn) => { g.beginPath(); fn(); if (tw) { g.strokeStyle = TINTA; g.lineWidth = w + tw * 2; g.stroke(); } g.strokeStyle = med; g.lineWidth = w; g.stroke(); };
  for (let k = 0; k < 6; k++) { const rx = r * Math.abs(Math.cos((k / 6) * Math.PI + 0.25)), roto = rr() < 0.18; arco(() => g.ellipse(cx, cy, Math.max(0.5, rx), r, 0, roto ? 0.6 : 0, roto ? Math.PI * 1.6 : Math.PI * 2)); }
  for (let k = 1; k < 5; k++) { const t = -1 + (k / 5) * 2, yy = cy + t * r * 0.92, rx = r * Math.sqrt(1 - t * t * 0.85); arco(() => g.ellipse(cx, yy, rx, rx * 0.18, 0, 0, Math.PI)); }
  g.beginPath(); g.arc(cx, cy, r, 0, 7); if (tw) { g.strokeStyle = TINTA; g.lineWidth = w * 1.4 + tw * 2; g.stroke(); } g.strokeStyle = neg; g.lineWidth = w * 1.4; g.stroke();
  // el canto de arriba lo lame la luz del cielo
  g.beginPath(); g.arc(cx, cy, r - w * 0.3, Math.PI * 1.15, Math.PI * 1.85); g.strokeStyle = rgba(luz, 0.55); g.lineWidth = Math.max(1, w * 0.4); g.stroke();
  // peana de costillas
  if (o.peana !== false) for (const s of [-1, 1]) { const x0 = cx + s * r * 0.55, y0 = cy + r * 0.82; linea([[x0, y0], [x0 + s * r * 0.35, y0 + r * 0.45]], neg, w * 1.3); }
  // hongos por la jaula
  const nh = o.hongos ?? 3;
  for (let k = 0; k < nh; k++) { const a = -Math.PI * (0.2 + rr() * 0.6) + (rr() < 0.3 ? Math.PI : 0); hongos(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95, 3, r * 0.55, d, sem + k * 7, { dir: Math.cos(a) }); }
  // el resplandor (va despues de la bruma de la capa)
  // (por debajo del 18: es lo unico que puede brillar mas que el)
  brillos.push([cx, cy, r * 3, PODRE, 0.16 * (1 - d * 0.55)]);
  brillos.push([cx, cy + r * 0.2, r * 1.2, PODRE_CLARO, 0.09 * (1 - d * 0.6)]);
}

// SOLDADO de Boltbound con la Podredumbre (en silueta: lejos, en el paso elevado o en la calle del fondo).
// Corpachon con hombreras, casco, una pierna adelantada, un arma o una lanza; los hongos le salen de la cabeza y
// del hombro. s: su alto en px. dir: hacia donde mira.
export function soldadoSilueta(x, y, s, d, sem, o = {}) {
  const rr = azar(sem), col = tono(o.col || '#2a2724', d, x), dir = o.dir ?? (rr() < 0.5 ? -1 : 1);
  const u = s / 10, X = (v) => x + v * u * dir, Y = (v) => y - v * u;
  g.fillStyle = col;
  // piernas
  forma([[X(-1.2), Y(0)], [X(-0.4), Y(0)], [X(-0.1), Y(4.2)], [X(-1.5), Y(4.2)]], col, d);
  forma([[X(0.6), Y(0)], [X(1.5), Y(0)], [X(1.2), Y(4.3)], [X(0.0), Y(4.3)]], col, d);
  // torso y hombreras
  forma([[X(-1.9), Y(4)], [X(1.8), Y(4)], [X(2.2), Y(7.6)], [X(1.2), Y(8.2)], [X(-1.4), Y(8.2)], [X(-2.4), Y(7.5)]], col, d);
  forma([[X(-2.9), Y(7.0)], [X(-1.2), Y(8.4)], [X(-1.0), Y(7.0)], [X(-2.6), Y(6.2)]], col, d);
  // brazo con el arma
  forma([[X(1.4), Y(7.6)], [X(2.6), Y(6.8)], [X(3.4), Y(5.0)], [X(2.8), Y(4.7)], [X(1.6), Y(6.2)]], col, d);
  linea([[X(2.2), Y(3.0)], [X(4.4), Y(7.6)]], col, Math.max(1.5, u * 0.45), 'butt');
  // cabeza con casco
  forma([[X(-0.9), Y(8.1)], [X(0.9), Y(8.1)], [X(1.1), Y(9.2)], [X(0.4), Y(9.8)], [X(-0.6), Y(9.8)], [X(-1.2), Y(9.1)]], col, d);
  if (o.podre !== false) hongos(X(-0.1), Y(9.6), 4, u * 3.4, Math.max(d, 0.2), sem + 3, { dir: -dir * 0.4 });
  if (o.podre !== false && rr() < 0.6) hongos(X(-2), Y(8.0), 2, u * 2.4, Math.max(d, 0.2), sem + 4, { dir: -dir });
}

// ================================================================= LA CIUDAD GOTICA DEL FONDO
// TORRE gotica que se deshace: cuerpos que se estrechan con ventanales apuntados (huecos de verdad: se ve lo de
// detras), pinaculos en las esquinas, una aguja con ganchos y, a partir de cierta altura, solo el ESQUELETO
// (montantes y arcos) como en la referencia. d: bruma.
export function torreGotica(x, base, h, w, d, sem, o = {}) {
  const rr = azar(sem), col = tono(o.col || '#5f5850', d, x), osc = tono(mezclar(o.col || '#5f5850', '#000000', 0.35), d, x), luz = tono('#e2cfa6', d * 0.7, x), ld = ladoLuz(x);
  const cuerpos = 3 + Math.floor(rr() * 2), esqueleto = o.esqueleto ?? (0.45 + rr() * 0.3);
  let y = base, ww = w, k = 0;
  const altoCuerpos = h * 0.7;
  for (; k < cuerpos; k++) {
    const th = (altoCuerpos / cuerpos) * (k === 0 ? 1.25 : 1 - k * 0.08), x0 = x - ww / 2;
    const roto = (y - base) / -h > esqueleto;
    if (!roto) {
      // el cuerpo, con sus ventanales recortados
      g.beginPath(); g.rect(x0, y - th, ww, th);
      const nv = Math.max(1, Math.round(ww / 46)), vw = (ww / nv) * 0.52;
      for (let v = 0; v < nv; v++) ojivaCamino(x0 + (ww / nv) * (v + 0.24), y - th * 0.12, vw, th * 0.62);
      g.fillStyle = col; g.fill('evenodd');
      // la luz en el canto del sol y una sombra en el otro
      g.fillStyle = rgba(luz, 0.4); g.fillRect(ld > 0 ? x0 + ww - 3 : x0, y - th, 3, th);
      g.fillStyle = rgba(osc, 0.6); g.fillRect(ld > 0 ? x0 : x0 + ww - 5, y - th, 5, th);
      // parteluces de los ventanales
      for (let v = 0; v < nv; v++) { const vx = x0 + (ww / nv) * (v + 0.24) + vw / 2; g.fillStyle = col; g.fillRect(vx - 1.2, y - th * 0.12 - th * 0.55, 2.4, th * 0.55); }
      // cornisa
      g.fillStyle = osc; g.fillRect(x0 - 4, y - th - 4, ww + 8, 5);
    } else {
      // el esqueleto: montantes y arcos, uno que falta
      const nm = Math.max(2, Math.round(ww / 30));
      for (let m = 0; m <= nm; m++) { if (m > 0 && m < nm && rr() < 0.2) continue; const mx = x0 + (ww * m) / nm; linea([[mx, y], [mx + (rr() - 0.5) * 3, y - th * (0.7 + rr() * 0.3)]], col, m === 0 || m === nm ? 4 : 2.4, 'butt'); }
      for (let m = 0; m < nm; m++) if (rr() < 0.75) { g.beginPath(); ojivaCamino(x0 + (ww * m) / nm, y - th * 0.35, ww / nm, th * 0.4); g.strokeStyle = col; g.lineWidth = 1.8; g.stroke(); }
      g.fillStyle = col; if (rr() < 0.7) g.fillRect(x0 - 3, y - th * 0.36, ww + 6, 3);
    }
    // pinaculos en las esquinas
    for (const sx of [x0 - 4, x0 + ww + 4]) if (rr() < 0.85) { const ph = 22 + rr() * 30 + ww * 0.15; trazar(g, [[sx - 4, y - th], [sx, y - th - ph], [sx + 4, y - th]]); g.fillStyle = col; g.fill(); }
    y -= th; ww *= 0.74;
  }
  // la aguja: triangulo largo con ganchos (crochets); rota a veces y con el esqueleto a la vista
  const ah = h - altoCuerpos, rota = rr() < (o.rota ?? 0.35);
  if (!rota) {
    trazar(g, [[x - ww / 2, y], [x - 2, y - ah], [x + 2, y - ah], [x + ww / 2, y]]); g.fillStyle = col; g.fill();
    for (let q = 1; q < 6; q++) { const t = q / 6, yy = y - ah * t, half = (ww / 2) * (1 - t); for (const s of [-1, 1]) { trazar(g, [[x + s * half, yy], [x + s * (half + 7), yy - 6], [x + s * half, yy - 10]]); g.fill(); } }
    g.fillStyle = rgba(luz, 0.45); trazar(g, [[ld > 0 ? x : x - ww / 2, y], [x, y - ah], [ld > 0 ? x + ww / 2 : x, y]]); g.fill();
    linea([[x, y - ah], [x, y - ah - 24]], col, 2);
    linea([[x - 7, y - ah - 14], [x + 7, y - ah - 14]], col, 2);
  } else {
    // aguja partida: medio cono y las costillas al aire
    trazar(g, [[x - ww / 2, y], [x - ww * 0.2, y - ah * 0.45], [x + ww * 0.05, y - ah * 0.38], [x + ww / 2, y]]); g.fillStyle = col; g.fill();
    for (const s of [-1, 0, 1]) linea([[x + s * ww * 0.25, y - ah * 0.3], [x + s * ww * 0.08, y - ah * (0.75 + rr() * 0.15)]], col, 2, 'butt');
  }
}
// CUPULA de costillas sobre su tambor: columnas y ventanas en el tambor, la cupula con gajos, las costillas al aire
// donde faltan los gajos, y la linterna con su aguja.
export function cupula(x, base, r, d, sem) {
  const rr = azar(sem), col = tono('#6a6258', d, x), osc = tono('#4a443d', d, x), luz = tono('#e9d7b0', d * 0.7, x), ld = ladoLuz(x);
  const th = r * 0.85, y0 = base - th;
  // tambor con huecos en arco
  g.beginPath(); g.rect(x - r, y0, r * 2, th);
  for (let k = 0; k < 7; k++) { const vx = x - r + (r * 2 * (k + 0.2)) / 7; ojivaCamino(vx, base - th * 0.15, (r * 2) / 7 * 0.6, th * 0.55); }
  g.fillStyle = col; g.fill('evenodd');
  g.fillStyle = osc; g.fillRect(x - r - 8, y0 - 6, r * 2 + 16, 8); g.fillRect(x - r - 4, base - 6, r * 2 + 8, 6);
  // la cupula: media elipse por gajos; los gajos del lado roto faltan y quedan las costillas
  const H = r * 1.05, nG = 10, rotoDesde = Math.floor(rr() * 4) + 5;
  // un gajo es la franja entre dos meridianos: de frente, entre x + rx*cos(a_k) y x + rx*cos(a_k+1) a cada altura
  const meridiano = (k, q) => { const t = q / 12, yy = y0 - H * Math.sin(t * Math.PI / 2), rx = r * Math.cos(t * Math.PI / 2); return [x + rx * Math.cos(Math.PI - (k / nG) * Math.PI), yy]; };
  for (let k = 0; k < nG; k++) {
    if (k >= rotoDesde && k < rotoDesde + 2) continue;
    g.beginPath();
    for (let q = 0; q <= 12; q++) { const [xx, yy] = meridiano(k, q); q ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
    for (let q = 12; q >= 0; q--) { const [xx, yy] = meridiano(k + 1, q); g.lineTo(xx, yy); }
    g.closePath(); const lit = Math.cos(Math.PI - ((k + 0.5) / nG) * Math.PI) * ld; g.fillStyle = lit > 0.3 ? mezclar(col, luz, 0.25) : lit < -0.3 ? osc : col; g.fill();
  }
  // costillas
  for (let k = 0; k <= nG; k++) { g.beginPath(); for (let q = 0; q <= 12; q++) { const t = q / 12, yy = y0 - H * Math.sin(t * Math.PI / 2), rx = r * Math.cos(t * Math.PI / 2), xx = x + rx * Math.cos(Math.PI - (k / nG) * Math.PI); q ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.strokeStyle = osc; g.lineWidth = 2.4; g.stroke(); }
  for (let q = 1; q < 4; q++) { const t = q / 4, yy = y0 - H * Math.sin(t * Math.PI / 2), rx = r * Math.cos(t * Math.PI / 2); g.beginPath(); g.ellipse(x, yy, rx, rx * 0.08, 0, Math.PI, Math.PI * 2); g.strokeStyle = osc; g.lineWidth = 1.6; g.stroke(); }
  // linterna
  const lw = r * 0.16, ly = y0 - H;
  g.fillStyle = col; g.fillRect(x - lw, ly - lw * 1.8, lw * 2, lw * 1.8);
  g.fillStyle = osc; for (let k = 0; k < 3; k++) g.fillRect(x - lw + 3 + k * (lw * 0.62), ly - lw * 1.5, 3, lw * 1.1);
  trazar(g, [[x - lw * 1.1, ly - lw * 1.8], [x, ly - lw * 4.2], [x + lw * 1.1, ly - lw * 1.8]]); g.fillStyle = col; g.fill();
  linea([[x, ly - lw * 4.2], [x, ly - lw * 5.4]], col, 2);
}
// CATEDRAL: la nave larga con contrafuertes y el roseton (hueco), y dos torres goticas
export function catedral(x, base, w, h, d, sem) {
  const rr = azar(sem), col = tono('#625b52', d, x), osc = tono('#463f38', d, x);
  const nh = h * 0.42, x0 = x - w / 2;
  g.beginPath(); g.rect(x0, base - nh, w, nh);
  const nv = Math.round(w / 60);
  for (let k = 0; k < nv; k++) ojivaCamino(x0 + (w / nv) * (k + 0.3), base - nh * 0.18, (w / nv) * 0.4, nh * 0.55);
  g.fillStyle = col; g.fill('evenodd');
  // tejado a dos aguas y contrafuertes
  trazar(g, [[x0 - 6, base - nh], [x0 + w * 0.15, base - nh - nh * 0.35], [x0 + w * 0.85, base - nh - nh * 0.35], [x0 + w + 6, base - nh]]); g.fillStyle = osc; g.fill();
  for (let k = 0; k <= nv; k++) { const bx = x0 + (w / nv) * k; trazar(g, [[bx - 5, base], [bx - 5, base - nh * 0.9], [bx, base - nh * 1.05], [bx + 5, base - nh * 0.9], [bx + 5, base]]); g.fillStyle = col; g.fill(); }
  // fachada con el roseton
  const fx = rr() < 0.5 ? x0 + w * 0.08 : x0 + w * 0.92, fr = Math.min(w * 0.09, nh * 0.3);
  torreGotica(fx - fr * 2.2, base, h, fr * 2.2, d, sem + 1, { rota: 0.5 });
  torreGotica(fx + fr * 2.2, base, h * 0.86, fr * 2.2, d, sem + 2, { rota: 0.7 });
  g.beginPath(); g.rect(fx - fr * 1.6, base - nh * 1.3, fr * 3.2, nh * 1.3); g.arc(fx, base - nh * 0.85, fr, 0, 7, true); g.fillStyle = col; g.fill('evenodd');
  g.beginPath(); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.moveTo(fx, base - nh * 0.85); g.lineTo(fx + Math.cos(a) * fr, base - nh * 0.85 + Math.sin(a) * fr); } g.strokeStyle = col; g.lineWidth = 2; g.stroke();
}
// TORRE ESQUELETO (plano medio): la estructura de una torre gotica moderna a la que se le cayeron los paneles:
// rejilla de montantes y forjados, algun panel que queda, remate en aguja de celosia y antenas.
export function torreEsqueleto(x, base, w, h, d, sem) {
  const rr = azar(sem), col = tono('#4c4741', d, x), osc = tono('#2e2b28', d, x), luz = tono('#dcc79c', d * 0.7, x), ld = ladoLuz(x);
  const x0 = x - w / 2, fh = 34 + rr() * 12, nm = Math.max(3, Math.round(w / 30));
  // los paneles que quedan, a RACHAS (abajo casi todos, arriba casi ninguno): cada panel oscuro con su ventana
  // y el borde de luz; donde faltan, se ve lo de detras
  const corte = h * (0.35 + rr() * 0.25);
  for (let y = base - fh; y > base - h * 0.85; y -= fh) {
    const t = (base - y) / h, queda = base - y < corte ? 0.95 : 0.25 * (1 - t);
    let m = 0;
    while (m < nm) {
      const racha = 1 + Math.floor(rr() * 4), si = rr() < queda;
      for (let q = 0; q < racha && m < nm; q++, m++) if (si) {
        const px0 = x0 + (w * m) / nm + 1, pw = w / nm - 2;
        g.fillStyle = osc; g.fillRect(px0, y + 2, pw, fh - 4);
        g.fillStyle = mezclar(osc, col, 0.4); g.fillRect(px0 + pw * 0.2, y + fh * 0.22, pw * 0.6, fh * 0.5);
      }
    }
  }
  // la rejilla
  for (let m = 0; m <= nm; m++) { const mx = x0 + (w * m) / nm, alto = h * (0.82 + rr() * 0.12) * (m === 0 || m === nm ? 1 : 0.92 + rr() * 0.08); linea([[mx, base], [mx, base - alto]], col, m === 0 || m === nm ? 4 : 2.6, 'butt'); }
  for (let y = base - fh; y > base - h * 0.84; y -= fh) { let a = x0; while (a < x0 + w) { const l = 20 + rr() * 60; if (rr() > 0.12) linea([[a, y], [Math.min(x0 + w, a + l), y]], col, 3, 'butt'); a += l; } }
  g.fillStyle = rgba(luz, 0.4); g.fillRect(ld > 0 ? x0 + w - 2 : x0, base - h * 0.82, 2.4, h * 0.82);
  // remate: aguja de celosia
  const yt = base - h * 0.84, ah = h * 0.16;
  for (const s of [-1, 1]) linea([[x + s * w * 0.3, yt], [x + s * 2, yt - ah]], col, 2.6, 'butt');
  for (let q = 1; q < 5; q++) { const t = q / 5; linea([[x - w * 0.3 * (1 - t), yt - ah * t], [x + w * 0.3 * (1 - t), yt - ah * t]], col, 1.6, 'butt'); }
  linea([[x, yt - ah], [x, yt - ah - 30]], col, 1.6);
}

// ================================================================= EL PASO ELEVADO
// Tablero de hormigon con su peto y una barandilla de tubo, sobre pilas que se abren en arcos de medio punto (los
// de la referencia); farolas encima, un tramo hundido o cortado (o.roto: x del corte), y soldados de pie (o.soldados).
// y: cara de arriba del tablero; base: el suelo. Dibuja tambien las sombras de los arcos.
export function pasoElevado(x0, x1, y, base, d, sem, o = {}) {
  const rr = azar(sem), T = (c) => tono(c, d, x0), col = T('#4b4740'), osc = T('#2a2724'), neg = T('#151312'), luz = tono('#e4d0a4', d * 0.6, x0);
  const canto = o.canto ?? 34, vano = o.vano ?? 260, ld = ladoLuz(x0);
  const roto = o.roto ?? null, hueco = 120;
  const fuera = (x) => roto !== null && x > roto - hueco / 2 && x < roto + hueco / 2;
  // pilas con arcos: un muro con huecos de medio punto entre pila y pila
  g.beginPath(); g.rect(x0, y + canto, x1 - x0, base - y - canto);
  for (let x = x0 + vano * 0.15; x < x1 - vano * 0.3; x += vano) {
    const a = x + vano * 0.16, b = x + vano * 0.84, r = (b - a) / 2, top = y + canto + 26 + r;
    g.moveTo(a, base + 2); g.lineTo(a, top); g.arc(a + r, top, r, Math.PI, 0); g.lineTo(b, base + 2); g.closePath();
  }
  if (roto !== null) g.rect(roto - hueco * 0.9, y + canto - 2, hueco * 1.8, base - y);
  g.fillStyle = col; g.fill('evenodd');
  // dentro del arco, la sombra del intrados
  for (let x = x0 + vano * 0.15; x < x1 - vano * 0.3; x += vano) {
    const a = x + vano * 0.16, b = x + vano * 0.84, r = (b - a) / 2, top = y + canto + 26 + r;
    if (fuera(a) || fuera(b)) continue;
    g.beginPath(); g.arc(a + r, top, r, Math.PI, 0); g.lineTo(b, top + 8); g.arc(a + r, top + 8, r, 0, Math.PI, true); g.closePath(); g.fillStyle = osc; g.fill();
    // impostas y la luz en el canto de cada pila del lado del sol
    g.fillStyle = luz; g.globalAlpha = 0.35; g.fillRect(ld > 0 ? b - 3 : a, top, 3, base - top); g.globalAlpha = 1;
    g.fillStyle = osc; g.fillRect(a - 6, top - 4, 12, 6); g.fillRect(b - 6, top - 4, 12, 6);
  }
  // el tablero (con el corte)
  const tramos = roto === null ? [[x0, x1]] : [[x0, roto - hueco / 2], [roto + hueco / 2, x1]];
  for (const [a, b] of tramos) {
    chapa([[a, y], [b, y], [b, y + canto], [a, y + canto]], d, sem + Math.floor(a), { col: '#5a5550', juntas: [vano, 999] });
    g.fillStyle = luz; g.globalAlpha = 0.7; g.fillRect(a, y, b - a, 1.6); g.globalAlpha = 1;
    // peto bajo y barandilla de tubo con sus postes, alguno doblado
    g.fillStyle = col; g.fillRect(a, y - 10, b - a, 10); g.fillStyle = osc; g.fillRect(a, y - 2, b - a, 2);
    for (let x = a + 14; x < b - 6; x += 46 + rr() * 8) { const dob = rr() < 0.1 ? (rr() - 0.5) * 18 : 0; linea([[x, y - 10], [x + dob, y - 44]], osc, 2.6, 'butt'); }
    linea([[a, y - 42], [b, y - 42 + (rr() - 0.5) * 6]], osc, 2.6);
    linea([[a, y - 26], [b, y - 26]], osc, 1.6);
    // farolas encima
    for (let x = a + vano * 0.5; x < b - 40; x += vano * (1.5 + rr())) farolaSimple(x, y - 10, 150 + rr() * 30, d, sem + Math.floor(x));
    // soldados de pie
    if (o.soldados) for (let k = 0; k < o.soldados; k++) { const sx = a + 40 + rr() * (b - a - 80); soldadoSilueta(sx, y - 10, 70 + rr() * 16, d, sem + k * 31 + Math.floor(a)); }
  }
  // el corte: varillas que asoman y el borde roto
  if (roto !== null) for (const s of [-1, 1]) {
    const cx = roto + (s * hueco) / 2;
    for (let k = 0; k < 5; k++) linea([[cx, y + 6 + k * 6], [cx - s * (10 + rr() * 26), y + 4 + k * 7 + rr() * 16]], neg, 1.4);
    trazar(g, [[cx, y - 10], [cx - s * 14, y + 2], [cx - s * 4, y + canto * 0.6], [cx, y + canto]]); g.fillStyle = osc; g.fill();
  }
}
// farola sencilla (la del paso elevado y los planos de fondo): poste, brazo curvo, cabeza
export function farolaSimple(x, base, alto, d, sem, o = {}) {
  const col = tono(o.col || '#24221f', d, x), dir = o.dir ?? 1, rr = azar(sem);
  linea([[x, base], [x + (rr() - 0.5) * 3, base - alto]], col, Math.max(2, alto * 0.025), 'butt');
  g.beginPath(); g.moveTo(x, base - alto); g.quadraticCurveTo(x + dir * alto * 0.02, base - alto - alto * 0.1, x + dir * alto * 0.2, base - alto - alto * 0.06); g.strokeStyle = col; g.lineWidth = Math.max(1.6, alto * 0.018); g.stroke();
  trazar(g, [[x + dir * alto * 0.13, base - alto - alto * 0.07], [x + dir * alto * 0.27, base - alto - alto * 0.05], [x + dir * alto * 0.25, base - alto - alto * 0.02], [x + dir * alto * 0.15, base - alto - alto * 0.03]]); g.fillStyle = col; g.fill();
  if (o.bandera) estandarteChico(x - dir * 2, base - alto * 0.72, alto * 0.13, alto * 0.32, d, sem + 1, -dir);
}
// banderola estrecha y deshilachada colgada de un brazo del poste (la de la referencia: tela oscura con el rombo)
export function estandarteChico(x, y, w, h, d, sem, lado = 1) {
  const rr = azar(sem), T = (c) => tono(c, d, x), x0 = lado > 0 ? x : x - w;
  linea([[x, y], [x + lado * (w + 6), y]], T('#1d1b19'), Math.max(1.5, w * 0.08), 'butt');
  const pts = [[x0, y + 2], [x0 + w, y + 2]];
  const n = 6; for (let k = 0; k <= n; k++) { const xx = x0 + w - (w * k) / n; pts.push([xx + (rr() - 0.5) * 2, y + h * (0.78 + (k % 2 ? 0.1 : 0) + rr() * 0.18)]); }
  forma(pts, T('#2f2d2a'), d, 1.6);
  g.save(); trazar(g, pts); g.clip();
  for (let k = 0; k < 3; k++) { g.fillStyle = rgba(T('#1a1917'), 0.6); g.fillRect(x0 + w * (0.2 + k * 0.3), y, 2 + rr() * 2, h); }
  // el rombo
  const cx = x0 + w / 2, cy = y + h * 0.36, s = Math.min(w * 0.36, h * 0.16);
  g.strokeStyle = T('#8d867a'); g.lineWidth = Math.max(1, s * 0.18);
  g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 0.8, cy); g.lineTo(cx, cy + s); g.lineTo(cx - s * 0.8, cy); g.closePath(); g.stroke();
  g.beginPath(); g.arc(cx, cy, s * 0.35, 0, 7); g.stroke();
  g.restore();
}

// ================================================================= A PIE DE CALLE
// FAROLA ALTA de la ciudad (la de las marcas): poste de fundicion con basa, fuste estriado, collarin, brazo curvo
// con su voluta y la cabeza; la banderola cuelga del lado contrario. (x, base): el pie. La cabeza queda en
// (x + dir*dx, base - alto) (para que la luz del juego caiga donde esta pintada).
export function farolaCiudad(x, base, alto, dx, d, sem, o = {}) {
  const rr = azar(sem), dir = o.dir ?? 1, T = (c) => tono(c, d, x), t = tk(2.2, d);
  const col = T('#241a15'), med = T('#3d2b20'), luz = tono('#d9c49a', d * 0.5, x), ld = ladoLuz(x);
  const top = base - alto + 26;
  // basa
  forma([[x - 16, base + 4], [x - 13, base - 24], [x - 8, base - 34], [x + 8, base - 34], [x + 13, base - 24], [x + 16, base + 4]], med, d);
  g.fillStyle = luz; g.fillRect(ld > 0 ? x + 9 : x - 12, base - 30, 2, 30);
  // fuste (se adelgaza) con collarines
  const fuste = [[x - 6, base - 34], [x - 3.5, top], [x + 3.5, top], [x + 6, base - 34]];
  forma(fuste, col, d, 2);
  g.fillStyle = luz; g.globalAlpha = 0.6; g.fillRect(ld > 0 ? x + 2 : x - 4, top, 1.6, base - 34 - top); g.globalAlpha = 1;
  for (const yy of [base - alto * 0.38, top + 8]) forma([[x - 8, yy], [x + 8, yy], [x + 7, yy - 7], [x - 7, yy - 7]], med, d, 1.6);
  // brazo con voluta
  const hx = x + dir * dx, hy = base - alto;
  g.beginPath(); g.moveTo(x, top + 4); g.bezierCurveTo(x, top - 24, x + dir * dx * 0.4, hy - 16, hx - dir * 6, hy - 6);
  if (t) { g.strokeStyle = TINTA; g.lineWidth = 5 + t * 2; g.stroke(); }
  g.strokeStyle = col; g.lineWidth = 5; g.stroke();
  g.beginPath(); g.arc(x + dir * 14, top - 6, 9, 0, 6); g.strokeStyle = col; g.lineWidth = 2.4; g.stroke();
  // cabeza: campana de chapa con la boca abajo (el cristal roto, apagado)
  forma([[hx - 20, hy + 8], [hx - 12, hy - 8], [hx + 12, hy - 8], [hx + 20, hy + 8]], med, d, 2.2);
  forma([[hx - 15, hy + 8], [hx + 15, hy + 8], [hx + 11, hy + 14], [hx - 11, hy + 14]], T('#4a4740'), d, 1.6);
  g.fillStyle = luz; g.fillRect(hx - 10, hy - 7, 20, 1.6);
  // oxido pardo: chorretones de los collarines y de la cabeza, y la basa comida
  if (d < 0.45) { oxido(x - 3, base - alto * 0.38, 40 + rr() * 40, 3, d, sem + 11); oxido(hx - 8, hy + 14, 26 + rr() * 20, 3, d, sem + 12); oxido(x - 12, base - 30, 24, 4, d, sem + 13); }
  // banderola
  if (o.bandera !== false) estandarteChico(x - dir * 4, base - alto * 0.62, 44, 128, d, sem + 3, -dir);
  // cartel pegado al poste, a veces
  if (rr() < 0.35) forma([[x - 10, base - 130], [x + 12, base - 128], [x + 11, base - 96], [x - 9, base - 99]], T('#8e8676'), d, 1.4);
}
// SEMAFORO de baculo: poste, brazo sobre la calzada y dos cajas con tres lentes apagadas (una colgando de un cable)
export function semaforo(x, base, d, sem, o = {}) {
  const rr = azar(sem), dir = o.dir ?? 1, T = (c) => tono(c, d, x), col = T('#22201d'), med = T('#34312c'), lente = T('#0e0d0c');
  const alto = o.alto ?? 380, brazo = o.brazo ?? 230;
  tubo([[x, base + 4], [x, base - alto]], 10, d, x, { cap: 'butt', col: '#5a3a26' });
  tubo([[x - dir * 4, base - alto + 10], [x + dir * brazo, base - alto + 18]], 7, d, x, { cap: 'butt', col: '#5a3a26' });
  tubo([[x, base - alto + 70], [x + dir * brazo * 0.45, base - alto + 16]], 3.5, d, x, { cap: 'butt', col: '#5a3a26' });
  if (d < 0.45) { oxido(x - 2, base - alto + 20, 70 + rr() * 60, 4, d, sem + 21); oxido(x - 3, base - 160, 50, 4, d, sem + 22); }
  const caja = (cx, cy, rot) => {
    g.save(); g.translate(cx, cy); g.rotate(rot);
    chapa([[-14, 0], [14, 0], [14, 78], [-14, 78]], d, sem + Math.floor(cx), { liso: true, col: '#3a2619' });
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0, 14 + k * 25, 8, 0, 7); g.fillStyle = lente; g.fill(); g.beginPath(); g.arc(0, 14 + k * 25 - 3, 9.5, Math.PI, 0); g.strokeStyle = med; g.lineWidth = 3; g.stroke(); }
    g.restore();
  };
  caja(x + dir * brazo * 0.55, base - alto + 24, 0);
  // la segunda cuelga torcida de su cable
  const cx = x + dir * brazo, cy = base - alto + 18;
  linea([[cx, cy], [cx + dir * 6, cy + 30]], col, 1.6);
  caja(cx + dir * 6, cy + 30, dir * 0.35);
  // la caja del pulsador abajo y una pegatina
  chapa([[x + 5, base - 120], [x + 19, base - 120], [x + 19, base - 96], [x + 5, base - 96]], d, sem + 5, { liso: true });
}
// TORRE DE LA LUZ (las de celosia del plano medio), con sus aisladores y dos cables que cuelgan
export function torreLuz(x, base, alto, d, sem) {
  torreCelosia(x, base - alto, base, alto * 0.13, d, sem);
  const col = tono('#24211f', d, x);
  for (const s of [-1, 1]) { linea([[x - alto * 0.18, base - alto * 0.86], [x + alto * 0.18, base - alto * 0.86]], col, 3, 'butt'); linea([[x + s * alto * 0.17, base - alto * 0.86], [x + s * alto * 0.17, base - alto * 0.82]], col, 2); }
}
// BARRERA tipo New Jersey de hormigon, de frente: perfil que se abre abajo, junta, grapas, desconchones
export function barrera(x, y, w, d, sem) {
  const h = 62, rr = azar(sem);
  chapa([[x, y + 4], [x + 3, y - h * 0.35], [x + 9, y - h], [x + w - 9, y - h], [x + w - 3, y - h * 0.35], [x + w, y + 4]], d, sem, { col: '#5c5850' });
  const luz = tono('#dccaa2', d * 0.5, x), osc = tono('#141312', d, x);
  g.fillStyle = luz; g.globalAlpha = 0.7; g.fillRect(x + 9, y - h, w - 18, 1.6); g.globalAlpha = 1;
  g.fillStyle = rgba(osc, 0.5); g.fillRect(x + 3, y - h * 0.35, w - 6, 3);
  for (const gx of [x + w * 0.25, x + w * 0.75]) { linea([[gx - 5, y - h], [gx - 5, y - h - 7], [gx + 5, y - h - 7], [gx + 5, y - h]], osc, 1.8); }
  if (rr() < 0.5) { const bx = x + rr() * w * 0.7; trazar(g, [[bx, y - h], [bx + 18, y - h], [bx + 8, y - h + 16]]); g.fillStyle = osc; g.fill(); }
}
// ESCOMBROS: lajas de hormigon, cascotes y varillas, en un monton de x0 a x1 sobre el suelo y
export function escombros(x0, x1, y, d, sem, o = {}) {
  const rr = azar(sem), w = x1 - x0, alto = o.alto ?? Math.min(70, w * 0.3);
  const osc = tono('#141312', d, x0), luz = tono('#d6c39c', d * 0.5, x0);
  // las lajas grandes primero (detras), luego los cascotes
  for (let k = 0; k < Math.max(2, w / 70); k++) {
    const cx = x0 + rr() * w, cw = 30 + rr() * 60, ch = 14 + rr() * alto * 0.8, a = (rr() - 0.5) * 0.8;
    const pts = [[-cw / 2, 4], [-cw / 2 + rr() * 8, -ch * (0.5 + rr() * 0.5)], [rr() * cw * 0.3, -ch], [cw / 2 - rr() * 6, -ch * (0.3 + rr() * 0.6)], [cw / 2, 4]].map(([px, py]) => [cx + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)]);
    chapa(pts, d, sem + k * 13, { col: rr() < 0.5 ? '#57534b' : '#4a463f', liso: cw < 40 });
    if (rr() < 0.5) { const [px, py] = pts[2]; for (let q = 0; q < 3; q++) linea([[px + q * 3, py + 4], [px + q * 5 + (rr() - 0.5) * 30, py - 16 - rr() * 30]], osc, 1.5); }
  }
  for (let k = 0; k < w / 14; k++) { const cx = x0 + rr() * w, r = 3 + rr() * 9; trazar(g, [[cx - r, y + 2], [cx - r * 0.6, y - r * 1.2], [cx + r * 0.7, y - r], [cx + r, y + 2]]); g.fillStyle = tono(rr() < 0.5 ? '#3d3a35' : '#57534b', d, x0); g.fill(); g.fillStyle = luz; g.globalAlpha = 0.5; g.fillRect(cx - r * 0.5, y - r * 1.15, r, 1.2); g.globalAlpha = 1; }
}

// ================================================================= LA PODREDUMBRE QUE TREPA Y EL OXIDO
// VENAS: la Podredumbre que sale de un orbe y trepa por lo que tenga cerca: un tallo oscuro que serpentea y se
// ramifica, con su alma encendida y nudos que brillan. (x, y): de donde sale; ang: hacia donde va; l: largo.
export function venas(x, y, ang, l, d, sem, o = {}) {
  const rr = azar(sem), osc = tono(PODRE_OSC, d * 0.7, x), med = tono(PODRE, d * 0.5, x), w0 = o.ancho ?? 4;
  const rama = (x0, y0, a, L, w, prof) => {
    const pts = [[x0, y0]]; let px0 = x0, py0 = y0, aa = a;
    const n = Math.max(3, Math.round(L / 14));
    for (let k = 0; k < n; k++) { aa += (rr() - 0.5) * 0.7; px0 += Math.cos(aa) * (L / n); py0 += Math.sin(aa) * (L / n); pts.push([px0, py0]); }
    const tw = tk(1, d);
    for (let k = 0; k < pts.length - 1; k++) {
      const t = k / (pts.length - 1), ww = w * (1 - t * 0.75);
      if (tw) linea([pts[k], pts[k + 1]], TINTA, ww + 1.6);
      linea([pts[k], pts[k + 1]], osc, ww);
      linea([pts[k], pts[k + 1]], med, Math.max(0.6, ww * 0.35));
    }
    for (let k = 2; k < pts.length; k += 3) { g.beginPath(); g.arc(pts[k][0], pts[k][1], w * 0.55 * (1 - k / pts.length) + 0.8, 0, 7); g.fillStyle = tono(PODRE_CLARO, d * 0.4, x); g.fill(); brillos.push([pts[k][0], pts[k][1], 10 + w * 2, PODRE, 0.07 * (1 - d * 0.5)]); }
    if (prof > 0) for (let k = 2; k < pts.length - 1; k += 2) if (rr() < 0.45) rama(pts[k][0], pts[k][1], aa + (rr() < 0.5 ? -1 : 1) * (0.6 + rr() * 0.6), L * 0.45, w * 0.6, prof - 1);
  };
  rama(x, y, ang, l, w0, o.ramas ?? 2);
}
// LUZ de la Podredumbre en un hueco: el color naranja que tine la pared y el suelo (pintado: va bajo la bruma) y
// el resplandor que la atraviesa (brillos: despues de la bruma). (x0..x1, y0..y1): el hueco; (cx, cy): la fuente.
export function luzPodre(x0, y0, x1, y1, cx, cy, fuerza, d) {
  const R = Math.max(x1 - x0, y1 - y0) * 0.75;
  g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
  gr.addColorStop(0, rgba(tono('#c4682a', d * 0.6, cx), 0.46 * fuerza)); gr.addColorStop(0.45, rgba(tono('#7a3a17', d * 0.6, cx), 0.34 * fuerza)); gr.addColorStop(1, 'rgba(40,16,8,0)');
  g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.restore();
  brillos.push([cx, cy, R * 1.1, PODRE, 0.1 * fuerza * (1 - d * 0.5)]);
}
// CHORRETON de oxido PARDO: lengua que baja y se afila, con su alma algo mas clara (nunca naranja)
export function oxido(x, y, l, w, d, sem) {
  const rr = azar(sem), n = 6, izq = [], der = [];
  for (let k = 0; k <= n; k++) { const t = k / n, ww = w * (1 - t * 0.8) * (0.7 + rr() * 0.6), cx = x + (rr() - 0.5) * 1.4 + t * (rr() - 0.5) * 3; izq.push([cx - ww / 2, y + t * l]); der.push([cx + ww / 2, y + t * l]); }
  g.globalAlpha = 0.7; trazar(g, [...izq, ...der.reverse()]); g.fillStyle = tono('#4f3221', d, x); g.fill();
  g.globalAlpha = 0.55; g.fillStyle = tono('#76533a', d, x); g.fillRect(x - w * 0.2, y, w * 0.4, l * 0.45);
  g.globalAlpha = 1;
}

// ================================================================= LOS ARMAZONES DE HORMIGON (la ruina de cerca)
// El edificio brutalista de la referencia: forjados gruesos de canto con su sombra, pilares cuadrados, el fondo de
// cada planta a oscuras con algun tabique y ventanal de atras, vidrios rotos colgando en punta, ORBES de la
// Podredumbre que encienden de naranja su crujia y las de al lado (con venas que trepan y hongos en los cantos),
// estandartes que cuelgan de los forjados, cables, chorretones de oxido pardo bajo las varillas y cascotes.
// (x, base): esquina de abajo a la izquierda; w, h. o.pisos: alturas de forjado (px) si se quieren alineadas con
// algo; o.techo: y del remate. o.orbes, o.orbeDesde (la primera planta donde puede ir uno), o.orbeTam,
// o.podre (crujias podridas sin orbe a la vista), o.abiertas, o.vidrios, o.estandartes.
export function armazon(x, base, w, h, d, sem, o = {}) {
  const rr = azar(sem), T = (c) => tono(c, d, x), t = tk(2.6, d), ld = ladoLuz(x);
  const NEG = T('#08080a'), DENTRO = T('#0e0d0f'), LUZ = tono('#d9c194', d * 0.5, x), PICO = tono('#f1e2bb', d * 0.4, x);
  const fh = o.fh ?? 190, canto = o.canto ?? 30, top = o.techo ?? base - h;
  const pisos = o.pisos ? o.pisos.slice() : []; if (!o.pisos) for (let y = base - fh; y > top + fh * 0.4; y -= fh) pisos.push(y);
  const bay = o.bay ?? 150, cols = []; for (let xx = x; xx <= x + w + 1; xx += bay) cols.push(Math.min(xx, x + w - 26));
  const cimas = cols.map(() => top + rr() * fh * 0.6);
  const hueco = (p, k) => ({ a: cols[k] + 26, b: cols[k + 1], yb: p === 0 ? base : pisos[p - 1], yt: p < pisos.length ? pisos[p] + canto : top + 20 });
  // ---- 0 · donde van los orbes y que crujias estan podridas (se decide antes: su luz tine lo de alrededor)
  const sitios = [];
  for (let p = o.orbeDesde ?? 0; p < pisos.length; p++) for (let k = 0; k < cols.length - 1; k++) sitios.push([p, k]);
  const orbes = [];
  const nOrbes = o.orbes ?? (rr() < 0.7 ? 1 : 2);
  for (let q = 0; q < nOrbes && sitios.length; q++) {
    const [p, k] = sitios.splice(Math.floor(rr() * sitios.length), 1)[0], H = hueco(p, k);
    const r = Math.min((H.b - H.a) * 0.46, (H.yb - H.yt) * 0.5) * (o.orbeTam ?? 1);
    orbes.push({ p, k, cx: (H.a + H.b) / 2, cy: H.yb - r, r });
  }
  const podridas = new Map();     // 'p,k' -> fuerza de la luz naranja
  for (const ob of orbes) for (const dk of [-1, 0, 1]) { const k = ob.k + dk; if (k < 0 || k >= cols.length - 1) continue; podridas.set(ob.p + ',' + k, Math.max(podridas.get(ob.p + ',' + k) || 0, dk ? 0.45 : 1)); }
  for (const [p, k] of sitios) if (rr() < (o.podre ?? 0.12)) podridas.set(p + ',' + k, Math.max(podridas.get(p + ',' + k) || 0, 0.55));
  // ---- 1 · cada crujia: ABIERTA, la pared del fondo con sus ventanas, o un tabique roto; luz naranja si esta podrida
  const CIELO = mezclar(DENTRO, tono('#8f897f', Math.min(0.9, d + 0.35), x), 0.6), LUZV = tono('#b9b0a0', Math.min(0.9, d + 0.3), x);
  for (let p = 0; p <= pisos.length; p++) {
    for (let k = 0; k < cols.length - 1; k++) {
      const { a, b, yb, yt } = hueco(p, k), bw = b - a, hh = yb - yt, z = rr(), podre = podridas.get(p + ',' + k) || 0;
      if (hh < 20) continue;
      if (z < (o.abiertas ?? 0.22) && !podre) continue;
      g.fillStyle = DENTRO; g.fillRect(a - 1, yt, bw + 2, hh);
      g.fillStyle = rgba(T('#1b1a1c'), 0.8); for (let y = yt + 30; y < yb; y += 46) g.fillRect(a, y, bw, 1.2);
      if (z < 0.66 && !podre) {
        const nv = bw > 220 ? 2 : 1, vw = bw * (nv === 2 ? 0.3 : 0.46), vh = hh * 0.42, vy = yt + hh * 0.2;
        for (let v = 0; v < nv; v++) {
          const vx = a + (bw * (v + 0.5)) / nv - vw / 2;
          g.fillStyle = CIELO; g.fillRect(vx, vy, vw, vh);
          g.fillStyle = rgba(LUZV, 0.35); g.fillRect(vx, vy + vh * 0.55, vw, vh * 0.45);
          g.fillStyle = DENTRO; g.fillRect(vx + vw / 2 - 1.5, vy, 3, vh); g.fillRect(vx, vy + vh * 0.48, vw, 2.4);
          if (rr() < 0.4) { g.fillStyle = DENTRO; trazar(g, [[vx, vy], [vx + vw * 0.6, vy], [vx, vy + vh * 0.5]]); g.fill(); }
        }
      } else if (z < 0.82 && !podre) {
        const alto = hh * (0.3 + rr() * 0.5), pts = [[a, yb], [a, yb - alto]];
        for (let q = 1; q < 6; q++) pts.push([a + (bw * q) / 6, yb - alto * (0.6 + rr() * 0.5)]);
        pts.push([b, yb - alto * rr()], [b, yb]);
        trazar(g, pts); g.fillStyle = T('#252426'); g.fill();
      }
      // la luz de la Podredumbre: de su orbe (abajo en el centro) o de uno que no se ve (abajo a un lado)
      if (podre) {
        const ob = orbes.find((q) => q.p === p && q.k === k);
        const cx = ob ? ob.cx : orbes.find((q) => q.p === p) ? (orbes.find((q) => q.p === p).k < k ? a : b) : a + bw * rr(), cy = ob ? ob.cy : yb - hh * 0.2;
        luzPodre(a - 1, yt, b + 1, yb, cx, cy, podre, d);
        // venas por la pared del fondo y hongos en el suelo de la planta
        if (d < 0.5) for (let q = 0; q < 1 + Math.round(podre * 1.5); q++) venas(cx + (rr() - 0.5) * bw * 0.4, cy + (ob ? ob.r * 0.6 : 0), -Math.PI / 2 + (rr() - 0.5) * 2.2, hh * (0.5 + rr() * 0.5), d, sem + p * 97 + k * 13 + q, { ancho: 3 + podre * 2 });
        if (d < 0.5 && rr() < 0.8) hongos(a + bw * (0.15 + rr() * 0.7), yb - 2, 3 + Math.floor(podre * 3), 26 + podre * 20, d, sem + p * 7 + k * 3);
      }
      // sombra bajo el forjado de arriba
      const gr = g.createLinearGradient(0, yt, 0, yt + hh * 0.35); gr.addColorStop(0, rgba(NEG, 0.75)); gr.addColorStop(1, rgba(NEG, 0));
      g.fillStyle = gr; g.fillRect(a - 1, yt, bw + 2, hh * 0.35);
    }
    const yb = p === 0 ? base : pisos[p - 1];
    if (d < 0.4 && p > 0 && rr() < 0.75) { const ax = x + 30 + rr() * (w - 220); escombros(ax, ax + 110 + rr() * 140, yb, d, sem + p * 41, { alto: 40 }); }
  }
  // ---- 2 · los orbes en sus crujias
  orbes.forEach((ob, q) => orbe(ob.cx, ob.cy, ob.r, d, sem + 100 + q * 17));
  // ---- 3 · pilares, con chorretones de oxido y la luz naranja en la cara que mira a una crujia podrida
  cols.forEach((cx, k) => {
    const pts = [[cx, base + 6], [cx, cimas[k]], [cx + 26, cimas[k] + 4], [cx + 26, base + 6]];
    chapa(pts, d, sem + k * 7, { col: '#55524c', juntas: [999, fh] });
    g.fillStyle = LUZ; g.fillRect(ld > 0 ? cx + 23 : cx, cimas[k], 3, base - cimas[k]);
    g.fillStyle = PICO; g.fillRect(ld > 0 ? cx + 24.4 : cx, cimas[k], 1.4, (base - cimas[k]) * 0.3);
    for (let p = 0; p <= pisos.length; p++) {
      const { yb, yt } = hueco(p, Math.min(k, cols.length - 2));
      for (const [kk, lado] of [[k - 1, 0], [k, 26]]) { const f = podridas.get(p + ',' + kk); if (!f) continue; const gr = g.createLinearGradient(0, yb, 0, yt); gr.addColorStop(0, rgba(tono('#d27a3a', d * 0.6, cx), 0.7 * f)); gr.addColorStop(1, rgba(tono('#d27a3a', d * 0.6, cx), 0)); g.fillStyle = gr; g.fillRect(cx + lado - 3, yt, 3, yb - yt); }
      if (d < 0.45 && rr() < 0.4 && p < pisos.length) oxido(cx + 5 + rr() * 16, pisos[p] + canto, 30 + rr() * 70, 3 + rr() * 4, d, sem + k * 31 + p);
    }
    for (let q = 0; q < 4; q++) linea([[cx + 4 + q * 6, cimas[k] + 2], [cx + 2 + q * 7 + (rr() - 0.5) * 12, cimas[k] - 18 - rr() * 24]], T('#3a2a20'), 1.6);
  });
  // ---- 4 · forjados de canto grueso con su sombra debajo, el de arriba a trozos; el naranja lame su cara de abajo
  pisos.forEach((y, p) => {
    let a = x - 6; const ultimo = p === pisos.length - 1;
    while (a < x + w + 6) {
      const l = ultimo ? 40 + rr() * 140 : x + w + 6 - a, falta = ultimo && rr() < 0.35;
      if (!falta) {
        chapa([[a, y], [a + l, y + (ultimo ? (rr() - 0.5) * 8 : 0)], [a + l, y + canto], [a, y + canto]], d, sem + p * 31 + Math.floor(a), { col: '#5d5951', juntas: [bay, 999] });
        g.fillStyle = LUZ; g.globalAlpha = 0.8; g.fillRect(a, y, l, 1.8); g.globalAlpha = 1;
        g.fillStyle = rgba(NEG, 0.7); g.fillRect(a, y + canto, l, 7);
        if (ultimo) for (let q = 0; q < 3; q++) linea([[a + l, y + 6 + q * 7], [a + l + 8 + rr() * 16, y + 2 + q * 9 + rr() * 10]], T('#3a2a20'), 1.4);
        // chorretones de oxido de las varillas del canto
        if (d < 0.45) for (let q = 0; q < l / 160; q++) if (rr() < 0.5) oxido(a + rr() * l, y + canto - 4, 20 + rr() * 50, 3 + rr() * 3, d, sem + p * 13 + q + Math.floor(a));
      }
      a += l;
    }
    // naranja en el canto de abajo del forjado que cubre una crujia podrida, y en el de arriba del de debajo
    for (let k = 0; k < cols.length - 1; k++) {
      const f = podridas.get((p + 1) + ',' + k), f2 = podridas.get(p + ',' + k), a2 = cols[k] + 26, b2 = cols[k + 1];
      if (f) { g.fillStyle = rgba(tono('#e08a44', d * 0.6, a2), 0.55 * f); g.fillRect(a2, y - 2, b2 - a2, 2.2); }
      if (f2) { g.fillStyle = rgba(tono('#d27a3a', d * 0.6, a2), 0.5 * f2); g.fillRect(a2, y + canto + 7, b2 - a2, 3); }
      if (f2 && d < 0.5 && rr() < 0.6) hongos(a2 + (b2 - a2) * rr(), y + canto + 2, 3, 22, d, sem + p * 5 + k, { abre: 1.2, dir: 0 });
    }
  });
  // ---- 5 · vidrios rotos en punta colgando de los forjados y estandartes
  for (let p = 0; p < pisos.length; p++) for (let k = 0; k < cols.length - 1; k++) {
    const y = pisos[p] + canto + 7, a = cols[k] + 26, b = cols[k + 1];
    if (rr() < (o.vidrios ?? 0.3)) { const n = 2 + Math.floor(rr() * 3); for (let q = 0; q < n; q++) { const vx = a + 6 + rr() * (b - a - 30), vw = 14 + rr() * 26, vh = 30 + rr() * 80; trazar(g, [[vx, y], [vx + vw, y], [vx + vw * (0.3 + rr() * 0.5), y + vh]]); g.fillStyle = rgba(T('#9aa3a6'), 0.32); g.fill(); g.strokeStyle = rgba(PICO, 0.45); g.lineWidth = 1; g.beginPath(); g.moveTo(vx + vw * 0.2, y + 3); g.lineTo(vx + vw * 0.5, y + vh * 0.6); g.stroke(); if (t) { trazar(g, [[vx, y], [vx + vw, y], [vx + vw * 0.5, y + vh]]); g.strokeStyle = rgba(TINTA, 0.6); g.lineWidth = 1; g.stroke(); } } }
    if (rr() < (o.estandartes ?? 0.18) && p < pisos.length - 1) estandarte(a + 20, y - 2, Math.min(90, b - a - 40), 150 + rr() * 80, d, sem + p * 7 + k);
  }
  // ---- 6 · cables que cuelgan entre pilares
  for (let k = 0; k < 3; k++) { const p = Math.floor(rr() * pisos.length), y = pisos[p] + canto + 4, a = x + rr() * w * 0.5, b = a + 80 + rr() * 200; g.strokeStyle = NEG; g.lineWidth = 1.6; g.beginPath(); g.moveTo(a, y); g.quadraticCurveTo((a + b) / 2, y + 50 + rr() * 60, b, y); g.stroke(); }
  // ---- 7 · al pie, el monton de lo que se cayo
  if (o.pie !== false) escombros(x - 40, x + w * (0.3 + rr() * 0.4), base + 6, d, sem + 991, { alto: 70 });
  return { cols, pisos, cimas, orbes };
}

// ================================================================= CHATARRA DE LA CALLE
// BIDON de chapa oxidado (de pie o tumbado), con sus aros y un churreton
export function bidon(x, y, d, sem, o = {}) {
  const rr = azar(sem), tumbado = o.tumbado ?? rr() < 0.35;
  if (tumbado) {
    chapa([[x, y + 2], [x, y - 40], [x + 64, y - 40], [x + 64, y + 2]], d, sem, { col: '#4d3424', juntas: [21, 999] });
    g.beginPath(); g.ellipse(x + 64, y - 19, 7, 21, 0, 0, 7); g.fillStyle = tono('#2e2119', d, x); g.fill(); if (tk(1.6, d)) tinta(g, tk(1.6, d));
  } else {
    chapa([[x, y + 2], [x, y - 70], [x + 44, y - 70], [x + 44, y + 2]], d, sem, { col: '#4d3424', juntas: [999, 23] });
    g.fillStyle = tono('#d0b78a', d * 0.5, x); g.globalAlpha = 0.6; g.fillRect(x, y - 70, 44, 1.6); g.globalAlpha = 1;
  }
  oxido(x + 8 + rr() * 20, y - (tumbado ? 36 : 64), 26 + rr() * 30, 4, d, sem + 1);
}
// NEUMATICOS: uno o una pila
export function neumaticos(x, y, n, d, sem) {
  for (let k = 0; k < n; k++) {
    const cy = y - 9 - k * 15, cx = x + (k % 2) * 4;
    g.beginPath(); g.ellipse(cx, cy, 34, 9, 0, 0, 7); g.fillStyle = tono('#141313', d, x); g.fill(); if (tk(1.8, d)) tinta(g, tk(1.8, d));
    g.beginPath(); g.ellipse(cx, cy - 1, 18, 4.5, 0, 0, 7); g.fillStyle = tono('#050505', d, x); g.fill();
    g.fillStyle = tono('#5a5450', d * 0.6, x); g.fillRect(cx - 26, cy - 7, 20, 1.4);
  }
}
// TUBO de hormigon tirado (de canto: se ve la boca)
export function tuboHormigon(x, y, r, d, sem) {
  chapa([[x, y + 2], [x, y - r * 2], [x + r * 2.6, y - r * 2], [x + r * 2.6, y + 2]], d, sem, { col: '#5a564e' });
  g.beginPath(); g.ellipse(x + r * 2.6, y - r, r * 0.55, r, 0, 0, 7); g.fillStyle = tono('#4a463f', d, x); g.fill(); if (tk(2, d)) tinta(g, tk(2, d));
  g.beginPath(); g.ellipse(x + r * 2.6, y - r, r * 0.38, r * 0.72, 0, 0, 7); g.fillStyle = tono('#0b0a0b', d, x); g.fill();
}
// FURGONETA oxidada, hundida y con los cristales rotos (la de la referencia, a la derecha)
export function furgoneta(x, y, d, sem, o = {}) {
  const rr = azar(sem), w = o.w ?? 330, h = 150, T = (c) => tono(c, d, x);
  const pts = [[x, y + 6], [x - 2, y - h * 0.55], [x + 14, y - h], [x + w * 0.7, y - h], [x + w * 0.8, y - h * 0.62], [x + w - 4, y - h * 0.5], [x + w, y + 6]];
  chapa(pts, d, sem, { col: '#5a3a26', juntas: [w / 3, 999], remaches: 0 });
  // ventanas y parabrisas rotos
  for (const [vx, vw] of [[x + 22, 66], [x + 100, 66], [x + 178, 52]]) { g.fillStyle = T('#0a0909'); g.fillRect(vx, y - h + 16, vw, 46); if (rr() < 0.6) { g.fillStyle = rgba(T('#8d9294'), 0.3); trazar(g, [[vx + 2, y - h + 18], [vx + vw * 0.6, y - h + 18], [vx + 6, y - h + 52]]); g.fill(); } g.strokeStyle = TINTA; g.lineWidth = tk(1.8, d) || 1; g.strokeRect(vx, y - h + 16, vw, 46); }
  trazar(g, [[x + w * 0.72, y - h + 6], [x + w * 0.8, y - h * 0.64], [x + w * 0.74, y - h * 0.64]]); g.fillStyle = T('#0a0909'); g.fill();
  // ruedas hundidas y desinfladas, puerta corrida torcida, chorretones
  for (const rx of [x + 60, x + w - 70]) { g.beginPath(); g.ellipse(rx, y - 4, 30, 22, 0, Math.PI, 0); g.fillStyle = T('#0d0c0c'); g.fill(); g.beginPath(); g.ellipse(rx, y - 6, 26, 26, 0, Math.PI * 1.05, Math.PI * 1.95); g.fillStyle = T('#191716'); g.fill(); }
  g.strokeStyle = rgba(T('#0b0a0a'), 0.8); g.lineWidth = 2; g.beginPath(); g.moveTo(x + 96, y - h + 10); g.lineTo(x + 92, y - 10); g.stroke();
  for (let k = 0; k < 6; k++) oxido(x + 20 + rr() * (w - 40), y - h + 66 + rr() * 30, 20 + rr() * 50, 4 + rr() * 4, d, sem + k);
  g.fillStyle = tono('#d1b98c', d * 0.5, x); g.globalAlpha = 0.6; g.fillRect(x + 14, y - h, w * 0.68, 1.8); g.globalAlpha = 1;
  // hundida: la calle se la come por abajo
  g.fillStyle = T('#100f0e'); g.beginPath(); g.moveTo(x - 6, y + 8); for (let xx = x - 6; xx <= x + w + 6; xx += 12) g.lineTo(xx, y - 4 - rr() * 10); g.lineTo(x + w + 6, y + 8); g.fill();
}
// VALLA de obra de barrotes, torcida y con un tramo caido
export function vallaObra(x0, x1, y, d, sem) {
  const rr = azar(sem), col = tono('#2d2119', d, x0), alto = 110;
  const caida = x0 + (x1 - x0) * (0.4 + rr() * 0.3);
  for (let x = x0; x < x1; x += 14) {
    if (Math.abs(x - caida) < 50) continue;
    const inc = Math.sin((x - x0) * 0.01) * 4;
    linea([[x, y + 2], [x + inc, y - alto + rr() * 8]], col, 3, 'butt');
  }
  linea([[x0, y - alto + 10], [caida - 50, y - alto + 14]], col, 4, 'butt'); linea([[caida + 50, y - alto + 12], [x1, y - alto + 8]], col, 4, 'butt');
  linea([[x0, y - 30], [x1, y - 26]], col, 3, 'butt');
  for (let k = 0; k < 4; k++) linea([[caida - 46 + k * 26, y + 2], [caida - 60 + k * 30, y - 16]], col, 3, 'butt');
  oxido(x0 + 20, y - alto + 14, 40, 4, d, sem + 1);
}
