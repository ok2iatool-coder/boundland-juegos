// EL LINDE · el SUELO del primer plano: el labio de cojines de musgo por donde anda el 18, el faldon de hiedra
// que cuelga del corte, las raices, las piedras medio enterradas, la tierra por estratos que se oscurece hacia
// abajo, el ribazo de detras en la bruma, matas de hierba, helechos, hojarasca, setas que brillan, rocas y el agua.
// Las funciones pintarX(rr) son trozos de la capa JUEGO que la pagina llama en su orden. Reciben el azar de
// la capa (rr) y GASTAN exactamente lo que gastaba la version anterior (gastar*), asi el resto de la capa no
// se mueve; lo que pintan sale de su propio azar.
// Luz: contraluz dorado desde atras-arriba-derecha (en el bosque); casi todo en sombra fria y solo el canto
// que mira al sol en ocre-oro. Cel: valores PLANOS por forma con saltos duros entre la cara de luz y la de
// sombra (nada de moteado de grano: la textura la dan los bordes). Tinta de 1-2 px en lo cercano.
// Vegetacion SOLO en suelo y arboles (regla del usuario): todo lo de aqui nace del suelo. Unica excepcion
// (2026-10-18, pedida por el usuario): la chatarra del bosque, que cubre la pagina con `cubrir` y musgo().
import { TINTA, azar, mezclar, rgba, trazar, trazarSuave, tinta, ruido1 } from '../dibujo/tinta.js';
import { g, W, H, AGUA, sueloY, ARROYO, ladoLuz, brillo, tono, brillos } from './base.js';

// ---------------------------------------------------------------- paleta (de la referencia, k-medias)
const P = {
  musgoO: '#171006', musgoM: '#413721', musgoC: '#5d4e2e', musgoL: '#bda269', musgoS: '#d2b856', musgoP: '#e3d5ad',
  piedra: '#3e3f35', piedraO: '#2a2a23', piedraM: '#4b4b3f', piedraL: '#8a7648', raiz: '#2a2316', raizL: '#7a6a49',
  silueta: '#1e1c10', ribazo: '#69655a',
};
// HOJAS por modo de luz (cel): sombra entera, medio, a contraluz con el canto encendido, y entera al sol
const HS = { // sombra: oliva oscuro, algo verdoso
  cuerpo: ['#141309', '#1a190e', '#211f12', '#28210f', '#242615', '#2b2a19'], vena: '#3a3622' };
const HM = { cuerpo: ['#3e371e', '#46402a', '#524a2e', '#4a4a2b', '#3d3f26'], osc: ['#28210f', '#2e2d1c', '#2a2c1a'], vena: '#1a180e' };
const HC = { cuerpo: ['#1f1d13', '#28210f', '#2e2d20', '#33311d', '#3e371e'], canto: ['#b5a165', '#d3ba72', '#cdb24e', '#dcc35a'] };
const HL = { cuerpo: ['#c9ad48', '#d8c050', '#e1c85a', '#d3ba5e', '#c4ad52', '#b9a04a'], osc: ['#9a8336', '#a58d3c', '#8f7a35'], vena: '#6e5c26', pico: '#efdea6' };
const elige = (R, a) => a[Math.floor(R() * a.length)];
const enArroyo = (x, m = 0) => x > ARROYO.x0 - m && x < ARROYO.x1 + m;

// ---------------------------------------------------------------- piezas
// FORMA de una hoja como Path2D. Base en (x,y), punta hacia el angulo a, largo s. esc < 1 la pone en escorzo
// (mas estrecha). Tipos: 'oval' (punta), 'diente' (oval con el borde dentado), 'hiedra' (cinco lobulos),
// 'corazon' (base escotada).
function formaHoja(x, y, s, a, tipo, esc = 1) {
  const ca = Math.cos(a), sa = Math.sin(a), Q = (u, v) => [x + ca * u * s - sa * v * s, y + sa * u * s + ca * v * s];
  const p = new Path2D();
  if (tipo === 'hiedra' || tipo === 'corazon') {
    const w = 0.52 * esc;
    const pts = tipo === 'hiedra'
      ? [[0, 0], [-0.04, -0.5 * w], [0.18, -1.05 * w], [0.36, -0.62 * w], [0.5, -1.0 * w], [0.66, -0.5 * w], [1, 0], [0.66, 0.5 * w], [0.5, 1.0 * w], [0.36, 0.62 * w], [0.18, 1.05 * w], [-0.04, 0.5 * w]]
      : [[0.06, 0], [-0.08, -0.7 * w], [0.2, -1.05 * w], [0.6, -0.75 * w], [1, 0], [0.6, 0.75 * w], [0.2, 1.05 * w], [-0.08, 0.7 * w]];
    const q = pts.map(([u, v]) => Q(u, v)), n = q.length;
    p.moveTo((q[n - 1][0] + q[0][0]) / 2, (q[n - 1][1] + q[0][1]) / 2);
    for (let k = 0; k < n; k++) { const A = q[k], B = q[(k + 1) % n]; p.quadraticCurveTo(A[0], A[1], (A[0] + B[0]) / 2, (A[1] + B[1]) / 2); }
    p.closePath();
  } else if (tipo === 'diente') {
    const w = 0.4 * esc, n = 7, pts = [[0, 0]];
    for (let k = 1; k <= n; k++) { const u = k / (n + 1), v = Math.sin(Math.PI * Math.pow(u, 0.8)) * w * (k % 2 ? 1.12 : 0.9); pts.push([u, -v]); }
    pts.push([1, 0]);
    for (let k = n; k >= 1; k--) { const u = k / (n + 1), v = Math.sin(Math.PI * Math.pow(u, 0.8)) * w * (k % 2 ? 1.12 : 0.9); pts.push([u, v]); }
    const q = pts.map(([u, v]) => Q(u, v)); p.moveTo(q[0][0], q[0][1]); for (const [u, v] of q.slice(1)) p.lineTo(u, v); p.closePath();
  } else {
    const w = 0.44 * esc, b = Q(0, 0), t = Q(1, 0), l1 = Q(0.2, -w * 1.15), l2 = Q(0.78, -w * 0.6), r1 = Q(0.2, w * 1.15), r2 = Q(0.78, w * 0.6);
    p.moveTo(b[0], b[1]); p.bezierCurveTo(l1[0], l1[1], l2[0], l2[1], t[0], t[1]); p.bezierCurveTo(r2[0], r2[1], r1[0], r1[1], b[0], b[1]); p.closePath();
  }
  return { p, Q };
}
// HOJA en cel. modo: 'sol' (entera al sol, oro saturado), 'canto' (oscura con el canto encendido del lado del
// sol), 'medio' (oliva con media hoja algo mas oscura) o 'sombra' (entera en sombra, plana).
export function hoja(x, y, s, a, modo, R, o = {}) {
  const tipo = o.tipo || elige(R, ['oval', 'diente', 'hiedra', 'corazon', 'diente']), esc = o.esc ?? 0.55 + R() * 0.45;
  const { p, Q } = formaHoja(x, y, s, a, tipo, esc), der = o.der ?? 1, d = o.d || 0, T = (c) => (d ? tono(c, d, x) : c);
  const lado = Math.sin(a) * der > 0 ? 1 : -1; // que mitad mira al sol
  g.save(); g.clip(p);
  if (modo === 'sol') {
    g.fillStyle = T(elige(R, HL.cuerpo)); g.fill(p);
    if (R() < 0.6) { g.fillStyle = T(elige(R, HL.osc)); g.beginPath(); const m = [Q(-0.2, 0), Q(1.2, 0), Q(1.2, lado), Q(-0.2, lado)]; trazar(g, m); g.fill(); }
    if (s > 14 && R() < 0.5) { g.fillStyle = T(HL.pico); g.beginPath(); const c = Q(0.55, -lado * 0.12); g.ellipse(c[0], c[1], s * 0.12, s * 0.05, a, 0, 7); g.fill(); }
  } else if (modo === 'canto') {
    g.fillStyle = T(elige(R, HC.canto)); g.fill(p);
    const rw = Math.max(1.4, Math.min(3.2, s * 0.11));
    g.translate(-der * rw, rw * 0.8); g.fillStyle = T(elige(R, HC.cuerpo)); g.fill(p);
  } else if (modo === 'medio') {
    g.fillStyle = T(elige(R, HM.cuerpo)); g.fill(p);
    g.fillStyle = T(elige(R, HM.osc)); g.beginPath(); const m = [Q(-0.2, 0), Q(1.2, 0), Q(1.2, -lado), Q(-0.2, -lado)]; trazar(g, m); g.fill();
  } else {
    g.fillStyle = T(elige(R, HS.cuerpo)); g.fill(p);
  }
  g.restore();
  // nervios: el central y, en las grandes, dos pares
  if (s > 9 && o.nervio !== false) {
    g.strokeStyle = T(modo === 'sol' ? HL.vena : modo === 'sombra' ? HS.vena : HM.vena); g.lineWidth = s > 22 ? 1.2 : 0.8;
    g.beginPath(); const b = Q(0.04, 0), e = Q(0.84, 0); g.moveTo(b[0], b[1]); g.lineTo(e[0], e[1]);
    if (s > 20) for (const u of [0.32, 0.55]) for (const v of [-1, 1]) { const m = Q(u, 0), t = Q(u + 0.2, v * 0.24 * esc); g.moveTo(m[0], m[1]); g.lineTo(t[0], t[1]); }
    g.stroke();
  }
  if (o.tinta !== 0 && d < 0.4) { g.strokeStyle = rgba(TINTA, o.tinta ?? 0.92); g.lineWidth = o.lw ?? (s > 22 ? 1.6 : s > 12 ? 1.25 : 1); g.lineJoin = 'round'; g.stroke(p); }
}
// cuanto sol coge una hoja (0..3) -> su modo; asi se mezclan hojas enteras al sol con hojas enteras en sombra
function modoHoja(R, luz) {
  const z = R();
  if (luz >= 3) return z < 0.68 ? 'sol' : z < 0.92 ? 'canto' : 'medio';
  if (luz === 2) return z < 0.3 ? 'sol' : z < 0.72 ? 'canto' : 'medio';
  if (luz === 1) return z < 0.06 ? 'sol' : z < 0.3 ? 'canto' : z < 0.62 ? 'medio' : 'sombra';
  return z < 0.05 ? 'canto' : z < 0.25 ? 'medio' : 'sombra';
}
// tamano de hoja por escalones: pequena, media, grande y, alguna, muy grande (las de primer termino)
const tamHoja = (R, esc = 1) => { const z = R(); return (z < 0.38 ? 7 + R() * 5 : z < 0.75 ? 12 + R() * 7 : z < 0.95 ? 19 + R() * 9 : 28 + R() * 10) * esc; };

// RACIMO: hojas que salen de un punto (x,y) en abanico, solapadas, con giros y escorzos distintos.
// dir = -1 hacia arriba (lo que asoma del labio), 1 hacia abajo (lo que cuelga). luz(t) da el sol de cada hoja.
function racimo(x, y, alto, R, o = {}) {
  const n = o.n || 4 + Math.floor(R() * 7), der = ladoLuz(x), dir = o.dir ?? -1, hj = [];
  g.strokeStyle = HS.cuerpo[0]; g.lineWidth = 1.2; g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const ab = (o.abre ?? 2.4), a = dir * Math.PI / 2 + (R() - 0.5) * ab, l = alto * (0.25 + R() * 0.75);
    const px = x + Math.cos(a) * l, py = y + Math.sin(a) * l * (dir < 0 ? 1 : 0.9);
    g.beginPath(); g.moveTo(x + (R() - 0.5) * 6, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.25, y + Math.sin(a) * l * 0.8, px, py); g.stroke();
    hj.push([px, py, a + (R() - 0.5) * 0.9, tamHoja(R, o.esc || 1), l / alto]);
  }
  // de atras a delante: primero las altas (atras), luego las bajas
  hj.sort((p, q) => (dir < 0 ? p[1] - q[1] : q[3] - p[3]));
  for (const [px, py, a, s, t] of hj) {
    const mira = Math.cos(a) * der > -0.1;
    let luz = o.luz ? o.luz(t, mira) : dir < 0 ? (t > 0.55 && mira ? 3 : t > 0.35 ? 2 : 1) : (t < 0.25 ? (mira ? 2 : 1) : 0);
    if (o.maxLuz !== undefined) luz = Math.min(luz, o.maxLuz);
    hoja(px - Math.cos(a) * s * 0.25, py - Math.sin(a) * s * 0.25, s, a, modoHoja(R, luz), R, { der });
  }
}
// HEBRA de hiedra que cuelga de (x,y) l px: tallo con racimitos alternos; arriba alguno coge el sol
function hebra(x, y, l, R, o = {}) {
  const amp = 2 + R() * 6, fase = R() * 6, der = ladoLuz(x), dx = o.deriva || 0;
  const P0 = (t) => [x + Math.sin(t * 4 + fase) * amp * t + dx * t, y + l * t];
  g.strokeStyle = HS.cuerpo[0]; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, y);
  for (let t = 0.1; t <= 1.0001; t += 0.1) { const [a, b] = P0(t); g.lineTo(a, b); }
  g.stroke();
  let lado = R() < 0.5 ? 1 : -1;
  for (let s2 = 3 + R() * 4; s2 < l; s2 += 7 + R() * 9) {
    const t = s2 / l, [px, py] = P0(t), s = tamHoja(R, (o.esc || 1) * (1 - t * 0.35)), a = Math.PI / 2 + lado * (0.5 + R() * 0.9);
    const luz = t < 0.18 && o.sol ? (R() < 0.5 ? 2 : 1) + (lado === der && R() < 0.4 ? 1 : 0) : t < 0.35 && R() < 0.3 ? 1 : 0;
    hoja(px, py, s, a, modoHoja(R, luz), R, { der });
    lado = -lado;
  }
}
// COJIN de musgo del labio: cupula irregular con bultos. Cel: abajo #171006, cuerpo, y la luz SOLO en la cresta
// (4-8 px del lado del sol, rota en motas), tinta en el contorno de arriba
function cojin(x, w, base, alto, R, o = {}) {
  const der = o.der ?? 1, n = Math.max(6, Math.round(w / 5)), top = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, bulto = Math.pow(Math.sin(Math.PI * t), 0.55), lump = 0.82 + 0.3 * ruido1(t * w / 9 + x * 0.1, 61);
    top.push([x + t * w, base - alto * bulto * lump]);
  }
  const fondo = [[x + w + 2, base + 6], [x - 2, base + 6]], forma = [...top, ...fondo];
  const luz = o.luz ?? 2, cuerpo = o.cuerpo || elige(R, ['#2b2a17', '#33311b', '#2e2a18', '#3a3520']);
  g.save(); trazarSuave(g, forma); g.clip();
  const crest = luz > 0 ? 3 + R() * 3.5 : 0;
  g.fillStyle = luz > 1 ? (R() < 0.5 ? P.musgoS : P.musgoL) : '#7a6a42'; g.fillRect(x - 6, base - alto - 10, w + 12, alto + 20);
  g.save(); g.translate(-der * crest * 0.45, crest); trazarSuave(g, forma); g.fillStyle = cuerpo; g.fill(); g.restore();
  // la cara de abajo en sombra, recortada con un borde ondulado
  const sb = []; for (let k = 0; k <= n; k++) { const t = k / n; sb.push([x + t * w, base - alto * (0.32 + 0.2 * ruido1(t * 4 + x, 62)) + 3]); }
  trazar(g, [...sb, [x + w + 8, base + 10], [x - 8, base + 10]]); g.fillStyle = P.musgoO; g.fill();
  // grietas entre bultos: cunas oscuras que bajan desde la cresta
  for (let k = 0; k < w / 22; k++) { const t = 0.15 + R() * 0.7, px = x + t * w, py = base - alto * Math.pow(Math.sin(Math.PI * t), 0.55) * 0.9; g.fillStyle = P.musgoO; g.beginPath(); g.moveTo(px - 1.6, py); g.lineTo(px + 1.6, py); g.lineTo(px + der * 2, py + alto * (0.4 + R() * 0.4)); g.fill(); }
  // motas de la cresta: puntos de luz y huecos oscuros (rompen la banda)
  if (luz > 1) for (let k = 0; k < w / 10; k++) { const t = 0.2 + R() * 0.75, i = Math.min(n, Math.round(t * n)), [px, py] = top[i]; g.fillStyle = R() < 0.45 ? P.musgoP : R() < 0.5 ? P.musgoO : '#e0c862'; g.fillRect(px - der * R() * 3, py + 1 + R() * crest * 0.8, 1.5 + R() * 1.6, 1.4 + R() * 1.2); }
  g.restore();
  g.strokeStyle = rgba(TINTA, 0.95); g.lineWidth = o.lw ?? 1.8; g.lineJoin = 'round'; g.lineCap = 'round';
  trazarSuave(g, top, false); g.stroke();
}
// RAIZ gruesa que sale del corte, se afina y se ramifica: sombra arrojada, tinta por debajo, cuerpo y el canto
// de luz SOLO por arriba
function raiz(x, y, l, w, R, prof = 0) {
  const n = 18, pts = []; let px = x, py = y, ang = Math.PI / 2 + (R() - 0.5) * 1.6, giro = (R() - 0.5) * 0.16;
  for (let k = 0; k <= n; k++) { pts.push([px, py]); giro += (R() - 0.5) * 0.12; giro *= 0.9; ang = Math.max(0.15, Math.min(Math.PI - 0.15, ang + giro)); px += Math.cos(ang) * l / n; py += Math.sin(ang) * l / n * 0.8; }
  const ancho = (k) => Math.max(1, w * Math.pow(1 - k / n, 0.75));
  g.lineCap = 'round'; g.lineJoin = 'round';
  const tramo = (col, ext, dx, dy) => { for (let k = 0; k < n; k++) { g.strokeStyle = col; g.lineWidth = ancho(k) + ext; g.beginPath(); g.moveTo(pts[k][0] + dx, pts[k][1] + dy); g.lineTo(pts[k + 1][0] + dx, pts[k + 1][1] + dy); g.stroke(); } };
  tramo('rgba(3,2,1,.75)', 1, -2, 4);               // sombra arrojada sobre la tierra
  tramo(TINTA, 2.4, 0, 0.8);                        // tinta, cargada abajo
  tramo(P.raiz, 0, 0, 0);
  // la cara de abajo en sombra (cel)
  g.strokeStyle = '#140f08';
  for (let k = 0; k < n; k++) { const a = ancho(k); if (a < 3) continue; g.lineWidth = a * 0.4; g.beginPath(); g.moveTo(pts[k][0], pts[k][1] + a * 0.3); g.lineTo(pts[k + 1][0], pts[k + 1][1] + a * 0.3); g.stroke(); }
  // el canto de luz: por arriba, en los tramos que van de lado
  g.strokeStyle = P.raizL;
  for (let k = 0; k < n; k++) { const dx = pts[k + 1][0] - pts[k][0], dyy = pts[k + 1][1] - pts[k][1]; if (Math.abs(dx) < Math.abs(dyy) * 0.45) continue; const a = ancho(k), of = a * 0.33; g.lineWidth = Math.max(1, a * 0.28); g.beginPath(); g.moveTo(pts[k][0], pts[k][1] - of); g.lineTo(pts[k + 1][0], pts[k + 1][1] - of); g.stroke(); }
  // grietas de la corteza
  g.strokeStyle = rgba(TINTA, 0.85); g.lineWidth = 1;
  for (let k = 1; k < n - 2; k += 2) if (ancho(k) > 5) { const [a, b] = pts[k]; g.beginPath(); g.moveTo(a - ancho(k) * 0.3, b - 1); g.lineTo(a + ancho(k) * 0.25, b + 1.5); g.stroke(); }
  // ramas: una o dos, mas finas
  if (prof < 1 && w > 5) for (let q = 0; q < 1 + (R() < 0.5 ? 1 : 0); q++) { const k = 4 + Math.floor(R() * 8); raiz(pts[k][0], pts[k][1], l * (0.35 + R() * 0.3), ancho(k) * 0.55, R, prof + 1); }
  // raicillas al final
  g.strokeStyle = '#120e07'; g.lineWidth = 1;
  for (let k = n - 6; k < n; k += 2) if (R() < 0.6) { const [a, b] = pts[k]; g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo(a + (R() - 0.5) * 12, b + 6, a + (R() - 0.5) * 16, b + 8 + R() * 14); g.stroke(); }
}
// facetas de un poligono: abanico desde un punto interior; cada cara con su valor segun mire al sol
function facetas(pts, cx, cy, der, T, tonos) {
  const n = pts.length, Lx = der * 0.55, Ly = -0.84;
  for (let k = 0; k < n; k++) {
    const a = pts[k], b = pts[(k + 1) % n], mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy, L = Math.hypot(mx, my) || 1;
    const dot = (mx / L) * Lx + (my / L) * Ly;
    g.fillStyle = T(dot > 0.62 ? tonos[0] : dot > 0.15 ? tonos[1] : dot > -0.45 ? tonos[2] : tonos[3]);
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.closePath(); g.fill();
  }
}
// PIEDRA medio enterrada: poligono facetado (canto de luz arriba, pizarra, sombra abajo), sombra en cuna debajo,
// tierra o musgo que la entierra por los lados
function piedra(cx, cy, rx, ry, R, der = 1, o = {}) {
  const n = 6 + Math.floor(R() * 3), pts = [], a0 = R() * 0.8;
  for (let k = 0; k < n; k++) { const a = a0 + (k / n) * Math.PI * 2 + (R() - 0.5) * 0.5, r = 0.78 + R() * 0.3; pts.push([cx + Math.cos(a) * rx * r, Math.min(cy + ry * 0.62, cy + Math.sin(a) * ry * r)]); }
  // sombra en cuna debajo
  const ys = pts.map((p) => p[1]), yb = Math.max(...ys);
  g.fillStyle = '#050401'; g.beginPath(); g.moveTo(cx - rx * 1.05, yb - 2); g.lineTo(cx + rx * 1.05, yb - 2); g.lineTo(cx - der * rx * 0.4, yb + ry * 0.45 + 3); g.closePath(); g.fill();
  const cxi = cx - der * rx * 0.15, cyi = cy + ry * 0.18;
  facetas(pts, cxi, cyi, der, (c) => c, [P.piedraL, P.piedraM, P.piedra, P.piedraO]);
  // aristas interiores (tinta fina) y alguna grieta en cuna
  g.strokeStyle = rgba(TINTA, 0.55); g.lineWidth = 1; g.beginPath();
  for (let k = 0; k < n; k += 2) { g.moveTo(cxi, cyi); g.lineTo(pts[k][0], pts[k][1]); }
  g.stroke();
  trazar(g, pts); tinta(g, o.lw ?? 2);
  // enterrada: terrones o musgo que la tapan por los lados
  if (o.tierra !== false) for (const s of [-1, 1]) {
    const bx = cx + s * rx * (0.75 + R() * 0.2), by = yb - ry * 0.15, r = rx * (0.25 + R() * 0.25);
    if (o.musgo) cojin(bx - r, r * 2, by + 2, r * 0.7, R, { der, luz: s === der ? 2 : 0, lw: 1.3 });
    else { g.fillStyle = o.tierraCol || '#1d180e'; g.beginPath(); g.ellipse(bx, by, r, r * 0.55, 0, Math.PI, 0); g.fill(); g.fillStyle = '#3a3020'; g.fillRect(bx - r * 0.6, by - r * 0.55, r * 1.1, 1.3); }
  }
}

// MUSGO en mancha baja e irregular (encima de rocas y tocones): bultos de tamanos distintos, lengüetas que caen
// por el canto, cresta con luz rota en motas. col tine apenas el cuerpo: manda la paleta oliva
export function musgo(x, y, w, h, col, semilla, o = {}) {
  const R = azar(semilla), der = ladoLuz(x + w / 2), cuerpo = mezclar(R() < 0.5 ? P.musgoM : '#4a3f25', col, 0.1);
  // contorno de arriba: bultos de anchos distintos (no cojines alineados)
  const top = []; let px = x;
  top.push([x, y + h * 0.2]);
  while (px < x + w) { const bw = 5 + R() * Math.max(6, h * 1.6), bh = h * (0.25 + R() * 0.75); top.push([px + bw * 0.5, y - bh]); px += bw; top.push([Math.min(px, x + w), y - bh * (0.2 + R() * 0.4)]); }
  top.push([x + w, y + h * 0.2]);
  // contorno de abajo con lenguetas
  const bot = []; for (let k = 10; k >= 0; k--) { const t = k / 10, tongue = R() < 0.25 ? h * (0.5 + R() * 1.2) : R() * h * 0.3; bot.push([x + t * w, y + h * 0.3 + tongue]); }
  const forma = [...top, ...bot];
  if (o.cuelga) for (let k = 0; k < w / 10; k++) { const sx = x + R() * w; hebra(sx, y + h * 0.2, 6 + R() * o.cuelga, R, { sol: 1, esc: 0.7 }); }
  g.save(); trazarSuave(g, forma); g.clip();
  g.fillStyle = R() < 0.6 ? P.musgoS : P.musgoL; g.fillRect(x - 10, y - h * 1.2, w + 20, h * 3 + 20);
  const cr = 2.5 + Math.min(5, h * 0.3);
  g.save(); g.translate(-der * cr * 0.8, cr); trazarSuave(g, forma); g.fillStyle = cuerpo; g.fill(); g.restore();
  g.fillStyle = P.musgoO; g.beginPath(); g.moveTo(x - 10, y + h * 0.05); for (let k = 0; k <= 8; k++) g.lineTo(x + (k / 8) * w, y + h * (0.05 + R() * 0.25)); g.lineTo(x + w + 10, y + h * 3); g.lineTo(x - 10, y + h * 3); g.fill();
  for (let k = 0; k < w / 7; k++) { const [tx, ty] = top[1 + Math.floor(R() * (top.length - 2))]; g.fillStyle = R() < 0.4 ? P.musgoP : R() < 0.5 ? P.musgoO : P.musgoL; g.fillRect(tx + (R() - 0.5) * 6, ty + R() * cr, 1.4 + R() * 1.4, 1.3 + R()); }
  g.restore();
  if (!o.sinTinta) { trazarSuave(g, top, false); g.strokeStyle = rgba(TINTA, 0.92); g.lineWidth = 1.6; g.lineJoin = 'round'; g.stroke(); }
  if (o.esporas) for (let k = 0; k < w / 16; k++) {
    const [tx, ty] = top[1 + Math.floor(R() * (top.length - 2))], l = 5 + R() * 10, inc = (R() - 0.5) * 7;
    g.strokeStyle = '#4a3c22'; g.lineWidth = 1; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + inc * 0.3, ty - l * 0.6, tx + inc, ty - l); g.stroke();
    g.fillStyle = R() < 0.4 ? P.musgoS : '#4e3c22'; g.beginPath(); g.ellipse(tx + inc, ty - l, 1.4, 2.4, inc * 0.06, 0, 7); g.fill();
  }
}
// SETA QUE BRILLA: pie visible, sombrero en cupula oscuro, laminas crema verdoso que dan luz por debajo
// (nunca azul: es de Varga; y nunca mas que el blanco del 18). s = medio ancho del sombrero
export function setaLuz(x, y, s, d, sem) {
  const rr = azar(sem), h = s * (1.3 + rr() * 1.3), inc = (rr() - 0.5) * s * 0.8, der = ladoLuz(x), T = (c) => tono(c, d, x);
  const tx = x + inc, ty = y - h, ry = s * (0.7 + rr() * 0.35);
  // el brillo que dan las laminas, sobre el suelo y el pie
  g.save(); g.globalCompositeOperation = 'lighter'; brillo(tx, ty + s * 0.2, s * 2.6, '#c9cf98', 0.2); g.restore();
  // y la luz de verdad, encima de la bruma de la capa (la enciende la pagina): halo ancho y nucleo bajo el sombrero
  brillos.push([tx, ty + s * 0.3, s * 4.2, '#d6dca4', 0.2 * (1 - d * 0.7)], [tx, ty + s * 0.15, s * 1.5, '#eef0c8', 0.3 * (1 - d * 0.7)]);
  // pie: cel en dos valores, tinta
  const pie = new Path2D(), pw = Math.max(1.6, s * 0.28);
  pie.moveTo(x - pw, y); pie.quadraticCurveTo(x + inc * 0.3 - pw, y - h * 0.5, tx - pw * 0.8, ty); pie.lineTo(tx + pw * 0.8, ty); pie.quadraticCurveTo(x + inc * 0.3 + pw, y - h * 0.5, x + pw, y); pie.closePath();
  g.fillStyle = T('#8f8c72'); g.fill(pie);
  g.save(); g.clip(pie); g.fillStyle = T('#c8c6a2'); g.fillRect(tx - der * pw * 2.2 + (der > 0 ? pw * 0.4 : -pw * 0.4) - pw, ty, pw * 1.2, h + 2); g.restore();
  if (d < 0.4) { g.strokeStyle = rgba(TINTA, 0.9); g.lineWidth = 1.1; g.stroke(pie); }
  // laminas: la cara de abajo del sombrero, luz crema verdoso con rayas
  g.fillStyle = T('#d5d8ab'); g.beginPath(); g.ellipse(tx, ty, s * 1.02, s * 0.26, 0, 0, 7); g.fill();
  g.strokeStyle = T('#8d8f62'); g.lineWidth = 0.8; g.beginPath();
  for (let q = -5; q <= 5; q++) { g.moveTo(tx + q * s * 0.07, ty); g.lineTo(tx + q * s * 0.19, ty + s * 0.2 * Math.cos(q * 0.25)); }
  g.stroke();
  // sombrero en cupula: oscuro, el canto del lado del sol con luz, tinta
  const cap = new Path2D(); cap.moveTo(tx - s * 1.08, ty + 1); cap.bezierCurveTo(tx - s * 1.1, ty - ry * 1.25, tx + s * 1.1, ty - ry * 1.25, tx + s * 1.08, ty + 1); cap.quadraticCurveTo(tx, ty + s * 0.18, tx - s * 1.08, ty + 1); cap.closePath();
  g.fillStyle = T('#7a6d44'); g.fill(cap);
  g.save(); g.clip(cap); g.translate(-der * Math.max(1.5, s * 0.16), Math.max(1.5, s * 0.14)); g.fillStyle = T('#23241b'); g.fill(cap); g.restore();
  g.save(); g.clip(cap); g.fillStyle = T('#34352a'); g.beginPath(); g.ellipse(tx - der * s * 0.3, ty - ry * 0.35, s * 0.35, ry * 0.25, 0, 0, 7); g.fill(); g.restore();
  if (d < 0.4) { g.strokeStyle = rgba(TINTA, 0.95); g.lineWidth = s > 7 ? 1.6 : 1.2; g.stroke(cap); }
  // el filo luminoso del sombrero
  g.strokeStyle = T('#e0e2b6'); g.lineWidth = Math.max(1, s * 0.12); g.beginPath(); g.ellipse(tx, ty + 0.5, s * 1.0, s * 0.16, 0, 0.15, Math.PI - 0.15); g.stroke();
}
// GRUPO de setas: 3-6, una grande delante (20-30 px de sombrero) y las demas menores, apinadas
export function grupoSetas(x, y, n, s, d, sem) {
  const rr = azar(sem), m = Math.max(3, Math.min(6, n + 1)), gr = Math.floor(rr() * m), lst = [];
  for (let k = 0; k < m; k++) { const big = k === gr, ss = big ? s * (1.6 + rr() * 0.6) : s * (0.45 + rr() * 0.6); lst.push([x + (k - m / 2) * s * 1.5 + (rr() - 0.5) * s, y + (big ? 3 : rr() * 3 - 1), ss]); }
  lst.sort((a, b) => a[2] - b[2]); // las pequenas detras
  for (const [px, py, ss] of lst) setaLuz(px, py, ss, d, sem + Math.floor(px));
}
// CASCADA como en la referencia: no es una lamina lisa sino HEBRAS de agua (blancas y crema, de anchos
// distintos, con huecos por donde se ve lo de detras) que se abren al caer y algunas se deshacen antes de
// llegar; un velo palido detras que las une, el labio encendido donde el agua pasa el borde, y abajo la
// nube de rocio que TAPA (no suma luz: es agua en el aire) con gotas sueltas. o.velo = 0 la deja en hebras.
export function cascada(x, y0, y1, w, d, sem, o = {}) {
  const rr = azar(sem), H0 = y1 - y0, T = (c) => tono(c, d * 0.75, x), k0 = 1 - d * 0.35;
  const BL = T('#f4f1e2'), CR = T('#ddd6b9'), SO = T('#a9a690');
  // velo de detras: la cortina entera muy palida, mas ancha abajo
  const velo = o.velo ?? 0.28;
  if (velo) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, rgba(CR, velo * k0)); gr.addColorStop(1, rgba(CR, velo * 0.5 * k0)); g.fillStyle = gr; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + w, y0); g.lineTo(x + w * 1.22, y1); g.lineTo(x - w * 0.22, y1); g.fill(); }
  // hebras: cada una un huso que ondula poco y se ensancha al bajar; la sombra (gris) primero, luego las blancas
  const n = Math.max(3, Math.round(w / 4.5)), hebras = [];
  for (let k = 0; k < n; k++) {
    const u = (k + 0.2 + rr() * 0.6) / n, corta = rr() < 0.22 ? y0 + H0 * (0.45 + rr() * 0.45) : y1 + 4;
    hebras.push({ x: x + u * w, w: 1.2 + rr() * Math.max(2, w * 0.13), abre: (u - 0.5) * w * (0.35 + rr() * 0.3), corta, f: rr() * 6, col: rr() < 0.3 ? SO : rr() < 0.55 ? CR : BL, a: (0.5 + rr() * 0.45) * k0 });
  }
  hebras.sort((a, b) => (a.col === SO ? 0 : 1) - (b.col === SO ? 0 : 1));
  for (const h of hebras) {
    const izq = [], der = [], m = Math.max(6, Math.round((h.corta - y0) / 24));
    for (let i = 0; i <= m; i++) { const t = i / m, yy = y0 + (h.corta - y0) * t, cx = h.x + h.abre * t * t + Math.sin(t * 7 + h.f) * 1.3, ww = h.w * (0.7 + t * 0.9) * (t > 0.85 && h.corta < y1 ? (1 - t) * 6 : 1); izq.push([cx - ww / 2, yy]); der.push([cx + ww / 2, yy]); }
    trazar(g, [...izq, ...der.reverse()]); g.fillStyle = rgba(h.col, h.a); g.fill();
  }
  // gotas que se sueltan de las hebras cortas y del borde
  for (let k = 0; k < w * 0.8; k++) { const t = rr(), yy = y0 + H0 * t, xx = x - w * 0.15 * t + rr() * w * (1 + 0.3 * t); g.fillStyle = rgba(BL, (0.25 + rr() * 0.5) * k0); g.fillRect(xx, yy, 1.4, 2 + rr() * 5); }
  // labio: el agua pasando el borde, encendido, y su sombra debajo
  g.fillStyle = rgba(SO, 0.5 * k0); g.fillRect(x - 1, y0 + 2, w + 2, 3);
  g.fillStyle = rgba(BL, 0.9 * k0); g.beginPath(); g.ellipse(x + w / 2, y0, w * 0.56, 2.6, 0, 0, 7); g.fill();
  // rocio abajo: nube blanda que tapa, y gotas que saltan
  for (let k = 0; k < 10; k++) brillo(x + w / 2 + (rr() - 0.5) * w * 2.2, y1 - rr() * Math.min(60, H0 * 0.15), w * (0.7 + rr() * 1.3) + 10, '#f2efe0', (0.16 + rr() * 0.16) * k0);
  for (let k = 0; k < w * 0.6; k++) { const a = -Math.PI * (0.15 + rr() * 0.7), r0 = rr() * w * 1.4; g.fillStyle = rgba(BL, 0.6 * k0); g.fillRect(x + w / 2 + Math.cos(a) * r0, y1 - 6 + Math.sin(a) * r0 * 0.5, 1.6, 1.6); }
}
// ROCA en cel: poligono con el borde quebrado, CARAS planas segun miren al sol (canto ocre arriba, pizarra,
// sombra abajo), estratos y grietas en cuna, tinta. Piedra, nunca metal.
export function roca(pts, d, sem) {
  const rr = azar(sem), T = (c) => tono(c, d, pts[0][0]);
  // borde quebrado: subdivide cada lado y lo mueve un poco, en recto (nada de curvas de huevo)
  const q = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.round(L / 26));
    for (let i = 0; i < m; i++) { const t = i / m, j = i === 0 ? 0 : Math.min(7, L * 0.05); q.push([a[0] + (b[0] - a[0]) * t + (rr() - 0.5) * j, a[1] + (b[1] - a[1]) * t + (rr() - 0.5) * j]); }
  }
  const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const der = ladoLuz((x0 + x1) / 2), w = x1 - x0, h = y1 - y0;
  g.save(); trazar(g, q); g.clip();
  // caras: abanicos desde uno o varios puntos interiores (las rocas grandes tienen varios planos)
  const nc = Math.max(1, Math.min(4, Math.round(w / 140)));
  for (let c = 0; c < nc; c++) {
    const cx = x0 + w * (c + 0.5) / nc + (rr() - 0.5) * w * 0.1 / nc, cy = y0 + h * (0.45 + rr() * 0.2);
    facetas(q, cx, cy, der, T, [P.piedraL, '#5a5444', P.piedra, P.piedraO]);
  }
  // el canto de luz arriba (banda por desplazamiento) y la sombra baja
  const lb = Math.max(3, Math.min(8, w * 0.035)), cx0 = (x0 + x1) / 2, cy0 = (y0 + y1) / 2;
  g.strokeStyle = T(P.piedraL); g.lineWidth = lb * 2; g.lineCap = 'round';
  for (let k = 0; k < q.length; k++) {
    const a = q[k], b = q[(k + 1) % q.length], nx = (a[1] - b[1]), ny = (b[0] - a[0]), L = Math.hypot(nx, ny) || 1;
    const sgn = ((a[0] + b[0]) / 2 - cx0) * nx + ((a[1] + b[1]) / 2 - cy0) * ny > 0 ? 1 : -1, dot = sgn * (nx / L * der * 0.5 - ny / L * 0.86);
    if (dot > 0.55) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  }
  g.fillStyle = T('#1d1d18'); g.beginPath(); g.moveTo(x0 - 10, y1 - h * 0.18); for (let k = 0; k <= 6; k++) g.lineTo(x0 + (k / 6) * w, y1 - h * (0.12 + rr() * 0.14)); g.lineTo(x1 + 10, y1 + 10); g.lineTo(x0 - 10, y1 + 10); g.fill();
  // estratos: lineas casi horizontales con su repisa de luz encima
  for (let k = 0; k < Math.max(1, h / 45); k++) {
    const yy = y0 + h * (0.22 + rr() * 0.55), xa = x0 + rr() * w * 0.4, xb = xa + w * (0.25 + rr() * 0.45), m = 6, ln = [];
    for (let i = 0; i <= m; i++) ln.push([xa + (xb - xa) * i / m, yy + (rr() - 0.5) * 5 + (i / m) * (rr() - 0.5) * 10]);
    g.strokeStyle = T('#6e6346'); g.lineWidth = 1.2; trazar(g, ln.map(([a, b]) => [a, b - 1.6]), false); g.stroke();
    g.strokeStyle = T('#0a0907'); g.lineWidth = 1.6; trazar(g, ln, false); g.stroke();
  }
  // grietas en cuna
  for (let k = 0; k < Math.max(2, (w * h) / 5000); k++) { const a = x0 + rr() * w, b = y0 + h * 0.2 + rr() * h * 0.6, l = 8 + rr() * Math.min(60, h * 0.4); g.fillStyle = T('#050401'); g.beginPath(); g.moveTo(a - 2, b); g.lineTo(a + 2, b); g.lineTo(a + (rr() - 0.5) * 10, b + l); g.fill(); }
  g.restore();
  if (d < 0.45) { trazar(g, q); tinta(g, 2 * (1 - d * 1.4)); }
}
// MATA DE HIERBA: 8-20 briznas afiladas; la mayoria en silueta (contraluz) y algunas con el canto al sol
export function hierba(x, y, alto, d, sem) {
  const R = azar(sem), n = 8 + Math.floor(R() * 12), der = ladoLuz(x), T = (c) => tono(c, d, x);
  const bl = [];
  for (let k = 0; k < n; k++) bl.push([(k / (n - 1) - 0.5) * 1.3 + (R() - 0.5) * 0.35, alto * (0.4 + R() * 0.65), x + (R() - 0.5) * 9, R() < 0.45, R()]);
  bl.sort((a, b) => a[3] - b[3]); // las de sombra detras
  for (const [a, l, bx, sol, z] of bl) {
    const ex = bx + Math.sin(a) * l, ey = y - Math.cos(a) * l, mx = bx + Math.sin(a) * l * 0.3, my = y - l * 0.6, w = 1.1 + z * 1.2;
    const luz = sol && a * der > -0.25;
    const pth = new Path2D(); pth.moveTo(bx - w, y); pth.quadraticCurveTo(mx - w * 0.6, my, ex, ey); pth.quadraticCurveTo(mx + w * 0.6, my, bx + w, y); pth.closePath();
    g.fillStyle = T(luz ? '#5d4e2e' : P.silueta); g.fill(pth);
    if (luz) { g.save(); g.clip(pth); g.fillStyle = T(z < 0.5 ? '#cdb456' : P.musgoL); g.translate(der * w * 0.9, 0); const p2 = new Path2D(); p2.moveTo(bx, y - l * 0.45); p2.quadraticCurveTo(mx, my, ex, ey); p2.lineTo(ex + der * 4, ey); p2.lineTo(bx + der * 4, y - l * 0.45); p2.closePath(); g.fill(p2); g.restore(); }
  }
}
// HELECHO / HIEDRA DE SUELO: una mata de hojas grandes (14-28 px) con su raiz en el suelo
function mataHojas(x, y, tam, R) {
  racimo(x, y, tam * 1.2, R, { n: 6 + Math.floor(R() * 6), dir: -1, abre: 2.8, esc: 1.25 });
}
// HOJARASCA: hoja caida plana y parda, cel en dos valores
function hojaCaida(x, y, s, R) {
  const z = R(), a = (R() - 0.5) * 1.2 + (R() < 0.5 ? 0 : Math.PI), { p, Q } = formaHoja(x, y, s, a, R() < 0.5 ? 'oval' : 'diente', 0.35 + R() * 0.3);
  const [c1, c2] = z < 0.45 ? ['#1f1a10', '#3a3020'] : z < 0.8 ? ['#3a3020', '#5e5034'] : ['#5e5034', '#c2a352'];
  g.fillStyle = c2; g.fill(p);
  g.save(); g.clip(p); g.fillStyle = c1; const m = [Q(-0.2, 0), Q(1.2, 0), Q(1.2, 1), Q(-0.2, 1)]; trazar(g, m); g.fill(); g.restore();
  g.strokeStyle = rgba(TINTA, 0.8); g.lineWidth = 0.9; g.stroke(p);
}

// ---------------------------------------------------------------- lo que gastaba cada trozo del azar de la capa
function gastarSuelo(rr) {
  for (let k = 0; k < 900; k++) { const x = rr() * W; if (x > 2440 && x < 3200) continue; rr(); rr(); rr(); rr(); rr(); }
  for (let k = 0; k < 160; k++) { const x = rr() * 6600; if (x > 2440 && x < 3200) continue; rr(); rr(); for (let q = 0; q < 6; q++) rr(); }
  for (let x = -20; x < W; x += 44) { if (x > 2440 && x < 3200) continue; if (x > 7000 && rr() > 0.25) continue; rr(); rr(); }
}
function gastarSetas(rr) { for (let k = 0; k < 16; k++) { const x = 200 + rr() * 3100; if (x > 2400 && x < 3220) continue; rr(); rr(); } }
function gastarHierba(rr) {
  for (let k = 0; k < 700; k++) { const x = rr() * 3500; if (x > 2420 && x < 3220) continue; rr(); rr(); rr(); rr(); }
  for (let k = 0; k < 260; k++) rr();
}

// ================================================================= trozos de la capa JUEGO (en este orden en la pagina)
// el suelo: ribazo de detras, corte por estratos (tierra, piedras, raices, faldon de hiedra) y el labio de cojines
export function pintarSuelo(rr, x0 = -20, x1 = W + 20) {
  gastarSuelo(rr);
  const R = azar(4401), labio = (x) => sueloY(x);
  // 1 · RIBAZO de detras, en la bruma: se pinta en un lienzo aparte y entra DETRAS de lo que ya hay en la capa
  // (troncos y ramas) con destination-over. Loma gris calida, matas de hojas planas sin tinta, canto claro arriba.
  for (const [a, b] of [[x0, 2430], [3210, Math.min(x1, 6950)]]) {
    if (b <= a) continue;
    const alto = (x) => (x < 3300 ? 110 : 45) + (ruido1(x / 90, 3) - 0.5) * 60 + (ruido1(x / 23, 4) - 0.5) * 16;
    const yA = Math.min(...[a, (a + b) / 2, b].map((x) => sueloY(x))) - 200, yB = Math.max(...[a, (a + b) / 2, b].map((x) => sueloY(x))) + 60;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(b - a); cv.height = Math.ceil(yB - yA); const c = cv.getContext('2d');
    c.translate(-a, -yA);
    const top = []; for (let x = a; x <= b; x += 6) top.push([x, labio(x) - Math.max(14, alto(x))]);
    trazar(c, [...top, [b, labio(b) + 50], [a, labio(a) + 50]]); c.fillStyle = '#4e4b41'; c.fill();
    // matas de la loma: hojas planas en tres valores, el sol en las de arriba que miran a el
    for (let x = a; x < b; x += 6 + R() * 12) {
      const y = labio(x) - Math.max(14, alto(x)) * (0.55 + R() * 0.5) + 10, rad = 9 + R() * 22, der = ladoLuz(x);
      c.fillStyle = '#45433a'; c.beginPath(); c.ellipse(x, y + rad * 0.2, rad, rad * 0.7, 0, Math.PI, 0); c.fill();
      for (let k = 0; k < 6 + rad * 0.7; k++) {
        const u = (R() - 0.5) * 2, v = -R() * 1.1, px = x + u * rad, py = y + v * rad * 0.8, s = 4 + R() * 7, ang = R() * 3;
        const luz = v < -0.6 && u * der > -0.1, z = R();
        c.fillStyle = luz ? (z < 0.5 ? '#a89a62' : '#c2ad6a') : z < 0.35 ? '#3e3c33' : z < 0.7 ? '#58544a' : '#69655a';
        c.beginPath(); c.moveTo(px - Math.cos(ang) * s, py - Math.sin(ang) * s); c.quadraticCurveTo(px + Math.sin(ang) * s * 0.5, py - Math.cos(ang) * s * 0.5, px + Math.cos(ang) * s, py + Math.sin(ang) * s); c.quadraticCurveTo(px - Math.sin(ang) * s * 0.5, py + Math.cos(ang) * s * 0.5, px - Math.cos(ang) * s, py - Math.sin(ang) * s); c.fill();
      }
    }
    g.save(); g.globalCompositeOperation = 'destination-over'; g.drawImage(cv, a, yA); g.restore();
  }
  // 2 · CORTE por estratos (cel): franja de tierra algo mas clara con vetas justo bajo el labio, luego cada
  // banda mas oscura con el borde ondulado, hasta el negro donde manda la silueta del primer plano
  const sueloPts = []; for (let x = x0; x <= x1; x += 6) sueloPts.push([x, labio(x) - 2]);
  g.save(); trazar(g, [...sueloPts, [x1, H + 20], [x0, H + 20]]); g.clip();
  g.fillStyle = '#18140c'; g.fillRect(x0, 0, x1 - x0, H + 20);
  const banda = (dy, k, amp) => { const pts = []; for (let x = x0; x <= x1; x += 8) pts.push([x, labio(x) + dy + (ruido1(x / 70, 10 + k) - 0.5) * amp + (ruido1(x / 13, 20 + k) - 0.5) * 5]); return pts; };
  // vetas de la franja clara: lentejones planos con la repisa de luz encima y la raya oscura debajo
  for (let k = 0; k < (x1 - x0) / 22; k++) {
    const x = x0 + R() * (x1 - x0), y = labio(x) + 10 + R() * 50, l = 20 + R() * 70, t = 2 + R() * 5;
    g.fillStyle = R() < 0.5 ? '#251e12' : '#0e0b06'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - t, x + l, y + (R() - 0.5) * 4); g.quadraticCurveTo(x + l / 2, y + t, x, y); g.fill();
    g.fillStyle = '#3f3421'; g.fillRect(x + l * 0.2, y - t * 0.55, l * 0.5, 1.3);
    g.fillStyle = '#0c0a06'; g.fillRect(x + l * 0.1, y + t * 0.5, l * 0.7, 1.4);
  }
  [[70, 1, '#0d0a06', 30], [130, 2, '#060503', 34], [195, 3, '#020201', 40]].forEach(([dy, k, col, amp]) => {
    const pts = banda(dy, k, amp);
    trazar(g, [...pts, [x1, H + 20], [x0, H + 20]]); g.fillStyle = col; g.fill();
    // el borde de cada banda: una repisa algo mas clara (estrato) y debajo la raya negra
    g.strokeStyle = k === 1 ? '#3a301e' : '#1d170e'; g.lineWidth = 1.4; trazar(g, pts.map(([a, b]) => [a, b - 1.5]), false); g.stroke();
  });
  // grietas negras en el corte
  g.strokeStyle = '#050401'; g.lineCap = 'round';
  for (let k = 0; k < (x1 - x0) / 45; k++) { const x = x0 + R() * (x1 - x0), y = labio(x) + 20 + R() * 120, l = 12 + R() * 40; g.lineWidth = 1.5 + R() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * 0.6, y + (R() - 0.5) * 8); g.lineTo(x + l, y + (R() - 0.5) * 12); g.stroke(); }
  // piedras medio enterradas en el corte (facetadas, con su sombra en cuna)
  for (let x = x0 + R() * 120; x < x1; x += 120 + R() * 200) { if (enArroyo(x, 40)) continue; const dy = 22 + R() * 70, rx = 10 + R() * 22; piedra(x, labio(x) + dy, rx, rx * (0.55 + R() * 0.3), R, ladoLuz(x), { tierraCol: dy < 60 ? '#18140c' : '#0d0a06' }); }
  // guijarros pequenos (pocos, nitidos)
  for (let k = 0; k < (x1 - x0) / 40; k++) { const x = x0 + R() * (x1 - x0), dy = 14 + Math.pow(R(), 1.4) * 100, r = 2.5 + R() * 3.5; if (enArroyo(x, 20)) continue; piedra(x, labio(x) + dy, r * 1.3, r, R, ladoLuz(x), { tierra: false, lw: 1.2 }); }
  // raices gruesas que salen del corte (pocas), con sus ramas
  for (let x = x0 + R() * 120; x < x1; x += 160 + R() * 260) { if (enArroyo(x, 30)) continue; raiz(x, labio(x) + 8 + R() * 16, 70 + R() * 120, 6 + R() * 6, R); }
  g.restore();
  // 3 · el fondo del labio: una banda oscura continua (lo que se ve en los huecos entre cojines)
  {
    const up = [], dn = [];
    for (let x = x0; x <= x1; x += 5) { up.push([x, labio(x) - 4 - ruido1(x / 17, 71) * 6]); dn.push([x, labio(x) + 10 + ruido1(x / 11, 72) * 8]); }
    const tramos = []; let t = [];
    up.forEach((p, i) => { if (enArroyo(p[0], 10)) { if (t.length) tramos.push(t); t = []; } else t.push(i); });
    if (t.length) tramos.push(t);
    for (const ix of tramos) { if (ix.length < 2) continue; trazar(g, [...ix.map((i) => up[i]), ...ix.map((i) => dn[i]).reverse()]); g.fillStyle = '#0a0805'; g.fill(); }
  }
  // 4 · lo que asoma DETRAS del labio: racimos de hiedra que suben, con la punta al sol
  for (let x = x0 + R() * 30; x < x1; x += 26 + R() * 50) {
    if (enArroyo(x, 10) || (x > 7000 && R() > 0.3)) continue;
    racimo(x, labio(x) - 2, 22 + R() * 34, R, { n: 3 + Math.floor(R() * 6) });
  }
  // 5 · FALDON de hiedra que cuelga del corte (30-90 px, a veces 150). La densidad va por matas (ruido): donde
  // baja, el faldon se queda corto y se ven la tierra, las raices y las piedras
  const dens = (x) => ruido1(x / 110, 51) * 0.75 + ruido1(x / 37, 52) * 0.25;
  // la MASA del faldon: racimos que cuelgan apretados, casi todos en sombra, que tapan los primeros 40-90 px
  for (let x = x0 + R() * 6; x < x1; x += 7 + R() * 9) {
    if (enArroyo(x, 6) || (x > 7000 && R() > 0.25)) continue;
    const dn = dens(x); if (dn < 0.18 && R() < 0.7) continue;
    racimo(x, labio(x) + 2 + R() * 10, 22 + dn * 60 + R() * 25, R, { n: 4 + Math.floor(R() * 5), dir: 1, abre: 2.6, luz: (t, mira) => (t < 0.3 && mira && R() < 0.35 ? 2 : t < 0.5 ? 1 : 0) });
  }
  for (let x = x0 + R() * 8; x < x1; x += 7 + R() * 13) {
    if (enArroyo(x)) continue;
    const ciudad = x > 7000; if (ciudad && R() > 0.25) continue;
    const dn = dens(x), z = R();
    if (dn < 0.22 && z < 0.65) continue;
    const l = ciudad ? 10 + R() * 20 : dn < 0.36 ? 10 + R() * 22 : z < 0.15 ? 16 + R() * 20 : z < 0.88 ? 30 + Math.pow(R(), 0.8) * 60 * (0.6 + dn) : 100 + R() * 55;
    hebra(x, labio(x) + 8, l, R, { sol: 1, deriva: (R() - 0.5) * 10, esc: dn > 0.6 && R() < 0.35 ? 1.3 : 1 });
  }
  // cortinas de hilos: enredaderas finas y largas, con hojitas espaciadas
  for (let x = x0 + R() * 40; x < x1; x += 40 + R() * 90) {
    if (enArroyo(x) || x > 7000 || dens(x) < 0.35) continue;
    const l = 80 + R() * 110, fase = R() * 6, y0 = labio(x) + 6, der = ladoLuz(x);
    g.strokeStyle = HS.cuerpo[0]; g.lineWidth = 1.1; g.beginPath(); g.moveTo(x, y0);
    for (let t = 0.05; t <= 1.001; t += 0.05) g.lineTo(x + Math.sin(t * 5 + fase) * 4 * t, y0 + l * t);
    g.stroke();
    for (let s2 = 12 + R() * 8; s2 < l; s2 += 14 + R() * 14) { const t = s2 / l, px = x + Math.sin(t * 5 + fase) * 4 * t, lado = R() < 0.5 ? 1 : -1; hoja(px, y0 + s2, 5 + R() * 6, Math.PI / 2 + lado * (0.6 + R() * 0.5), modoHoja(R, 0), R, { der, lw: 0.9 }); }
  }
  // 6 · el LABIO: cojines de musgo sueltos, con huecos oscuros entre ellos; el contorno sube y baja 10-25 px
  for (let x = x0 + R() * 10; x < x1;) {
    const w = 26 + R() * 80;
    if (!enArroyo(x + w / 2, 10) && !(x > 7000 && R() > 0.3)) {
      const base = labio(x + w / 2) + 8 + R() * 6, alto = (x > 7000 ? 8 : 16) + R() * (x > 7000 ? 8 : 22);
      cojin(x, w, base, alto, R, { der: ladoLuz(x), luz: R() < 0.72 ? 2 : R() < 0.5 ? 1 : 0 });
    }
    x += w * (0.62 + R() * 0.3) + (R() < 0.45 ? 4 + R() * 12 : 0);
  }
  // brotes sobre los cojines: ramitos de hojas pequenas y alguna brizna (rompen la cresta)
  for (let x = x0 + R() * 10; x < x1; x += 14 + R() * 26) {
    if (enArroyo(x, 10) || x > 7000) continue;
    racimo(x, labio(x) - 4 - R() * 10, 10 + R() * 14, R, { n: 2 + Math.floor(R() * 4), dir: -1, abre: 2.6, esc: 0.7 });
  }
  // 7 · delante del labio: racimos grandes que se derraman por el borde (hojas de 20-40 px), raices y piedras
  for (let x = x0 + R() * 80; x < x1; x += 90 + R() * 170) {
    if (enArroyo(x, 10) || x > 7000) continue;
    if (R() < 0.55) racimo(x, labio(x) + 6, 30 + R() * 30, R, { n: 4 + Math.floor(R() * 5), dir: 1, abre: 2.2, esc: 1.35, luz: (t, mira) => (t < 0.45 ? (mira ? 3 : 2) : t < 0.8 ? 1 : 0) });
    else racimo(x, labio(x) + 2, 26 + R() * 26, R, { n: 4 + Math.floor(R() * 5), dir: -1, abre: 2.8, esc: 1.3 });
  }
  for (let x = x0 + R() * 300; x < x1; x += 300 + R() * 360) { if (enArroyo(x, 30)) continue; raiz(x, labio(x) + 6, 60 + R() * 70, 8 + R() * 4, R); }
  for (let x = x0 + R() * 260; x < x1; x += 240 + R() * 320) { if (enArroyo(x, 40)) continue; const rx = 14 + R() * 18; piedra(x, labio(x) + rx * 0.2, rx, rx * (0.55 + R() * 0.2), R, ladoLuz(x), { musgo: true }); }
  // hojarasca sobre el labio
  for (let k = 0; k < (x1 - x0) / 34; k++) {
    const x = x0 + R() * (x1 - x0); if (enArroyo(x, 10) || x > 7000) continue;
    hojaCaida(x, labio(x) - 6 - R() * 12, 6 + R() * 6, R);
  }
}
// setas que brillan: grupos al pie de los troncos de la capa (los que ya estan pintados) y algunas sueltas
export function pintarSetas(rr, pies) {
  gastarSetas(rr);
  const R = azar(902), troncos = pies || (window.__troncos || []).map((t) => [t.x, t.an]);
  for (const [x, an] of troncos) {
    if (enArroyo(x, 60) || x > 7000) continue;
    for (const lado of [-1, 1]) if (R() < 0.75) { const px = x + lado * (an * 0.5 + 10 + R() * 26); grupoSetas(px, sueloY(px) - 4, 3 + Math.floor(R() * 3), 7.5 + R() * 3.5, 0, Math.floor(px)); }
  }
  for (let k = 0; k < 5; k++) { const x = 300 + R() * 3000; if (enArroyo(x, 60)) continue; grupoSetas(x, sueloY(x) - 4, 2 + Math.floor(R() * 2), 5.5 + R() * 2.5, 0, 900 + k); }
}
// juncos a las dos orillas del arroyo (en contraluz: tallo oscuro y el canto al sol)
export function pintarJuncos(rr) {
  for (let k = 0; k < 30; k++) {
    const x = k < 15 ? 2420 + rr() * 70 : 3150 + rr() * 70, y = sueloY(x) + 4, ex = x + (rr() - 0.5) * 20, ey = y - 80 - rr() * 50;
    g.strokeStyle = P.silueta; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 50, ex, ey); g.stroke();
    if (k % 3 === 0) { g.strokeStyle = P.musgoS; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x + 4, y - 40); g.quadraticCurveTo(x + 7.5, y - 55, ex + 1.2, ey); g.stroke(); }
    if (rr() < 0.4) { g.fillStyle = '#3a2c1a'; g.fillRect(ex - 3, ey - 16, 6, 24); g.strokeStyle = rgba(TINTA, 0.8); g.lineWidth = 1; g.strokeRect(ex - 3, ey - 16, 6, 24); }
  }
}
// altramuces junto a la cabana: pocos y de un malva apagado (que no se confundan con el azul de Varga)
export function pintarAltramuces(rr) {
  for (let k = 0; k < 10; k++) {
    const x = 3000 + rr() * 900, y = sueloY(x) + 2, h = 70 + rr() * 60;
    if (k % 3 || enArroyo(x, 30)) continue;
    g.strokeStyle = '#1f1d13'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 4, y - h * 0.6, x + 2, y - h); g.stroke();
    for (let q = 0; q < 7; q++) { g.fillStyle = q % 2 ? '#6b5f62' : '#564d50'; g.beginPath(); g.ellipse(x + 4, y - h * 0.35 - q * h * 0.085, 3.2, 5, 0.4, 0, 7); g.fill(); }
  }
}
// delante de todo lo que nace del suelo: matas de hierba, helechos e hiedra, hojarasca y guijarros
export function pintarHierba(rr, x0 = 0, x1 = 7250) {
  gastarHierba(rr);
  const R = azar(5203), libre = (x) => !enArroyo(x, 20) && x >= x0 && x < x1;
  // helechos e hiedra de suelo (los que tapan la parte baja de lo que se apoya en el suelo)
  for (let x = x0 + 60 + R() * 120; x < x1; x += 150 + R() * 150) if (libre(x)) mataHojas(x, sueloY(x) + 6, 18 + R() * 20, R);
  // matas de hierba
  for (let x = x0 + R() * 60; x < x1; x += 60 + R() * 90) if (libre(x)) hierba(x, sueloY(x) + 2, 12 + R() * 23, 0, Math.floor(x) + 31);
  // guijarros y hojas sueltas en el borde
  for (let k = 0; k < (x1 - x0) / 50; k++) {
    const x = x0 + R() * (x1 - x0); if (!libre(x)) continue;
    const y = sueloY(x) - 2 - R() * 6;
    if (R() < 0.35) piedra(x, y, 4 + R() * 5, 3 + R() * 2.5, R, ladoLuz(x), { tierra: false, lw: 1.3 });
    else hojaCaida(x, y, 6 + R() * 5, R);
  }
}
// EL AGUA del arroyo (para el bloque 6 de la pagina: pintarAgua(M, main) en lugar de su reflejo). Base oliva
// oscura, REFLEJO vertical y roto de lo que tiene encima (pasarela, troncos, juncos), destellos SOLO donde lo
// reflejado es cielo con sol (como mucho el 5 %), y la linea de orilla oscura con la sombra de los ribazos.
export function pintarAgua(M, src, x0 = 2440, x1 = 3220, y0 = AGUA, h = 330) {
  const w = x1 - x0, R = azar(7701), hh = Math.min(h, H - y0);
  const cp = document.createElement('canvas'); cp.width = w; cp.height = h; const C = cp.getContext('2d');
  C.translate(0, h); C.scale(1, -1); C.drawImage(src, x0, y0 - h, w, h, 0, 0, w, h);
  M.save(); M.beginPath(); M.rect(x0, y0, w, H - y0); M.clip();
  const base = M.createLinearGradient(0, y0, 0, y0 + hh); base.addColorStop(0, '#433e2b'); base.addColorStop(0.5, '#332f1f'); base.addColorStop(1, '#1f1c11');
  M.fillStyle = base; M.fillRect(x0, y0, w, H - y0);
  // el reflejo en tiras verticales, cada una partida en tramos que se corren de lado (la onda rompe la imagen)
  for (let x = 0; x < w;) {
    const sw = 2 + Math.floor(R() * 5);
    for (let y = 0; y < hh;) {
      const sh = 6 + R() * (10 + y * 0.25), dx = (R() - 0.5) * (1.5 + y * 0.03);
      M.globalAlpha = (0.5 - y / hh * 0.25) * (0.75 + R() * 0.35); M.drawImage(cp, x, y, sw, sh, x0 + x + dx, y0 + y, sw, sh);
      y += sh + (R() < 0.35 ? 1 + R() * 2 : 0);
    }
    x += sw;
  }
  M.globalAlpha = 1;
  // la reflexion de un agua oscura: valores hacia la base (no se ve tan clara como lo reflejado)
  M.fillStyle = 'rgba(41,38,23,.45)'; M.fillRect(x0, y0, w, H - y0);
  // ondas: rayas cortas OSCURAS, casi horizontales
  M.strokeStyle = 'rgba(14,13,8,.55)'; M.lineWidth = 1;
  for (let k = 0; k < w / 6; k++) { const x = x0 + R() * w, y = y0 + 6 + Math.pow(R(), 1.3) * hh, l = 6 + R() * 26; M.beginPath(); M.moveTo(x, y); M.lineTo(x + l, y + (R() - 0.5)); M.stroke(); }
  // destellos: solo donde lo reflejado es muy claro (cielo con sol), y como mucho el 5 % del agua
  const im = C.getImageData(0, 0, w, hh).data, cupo = w * hh * 0.05; let usado = 0;
  for (let k = 0; k < w * 4 && usado < cupo; k++) {
    const x = Math.floor(R() * w), y = Math.floor(Math.pow(R(), 1.6) * hh), i = (y * w + x) * 4, L = (im[i] * 0.3 + im[i + 1] * 0.59 + im[i + 2] * 0.11) * (im[i + 3] / 255);
    if (L < 205) continue;
    const l = 2 + R() * 7; M.fillStyle = R() < 0.6 ? '#e5d9b2' : '#bfb289'; M.fillRect(x0 + x, y0 + y, l, 1.2); usado += l * 1.2;
  }
  // la sombra de las orillas y la linea de orilla
  for (const [xa, s] of [[x0, 1], [x1, -1]]) { const gr = M.createLinearGradient(xa, 0, xa + s * 90, 0); gr.addColorStop(0, 'rgba(8,7,4,.8)'); gr.addColorStop(1, 'rgba(8,7,4,0)'); M.fillStyle = gr; M.fillRect(Math.min(xa, xa + s * 90), y0, 90, H - y0); }
  M.fillStyle = 'rgba(8,7,4,.7)'; M.fillRect(x0, y0, w, 5);
  M.restore();
  M.strokeStyle = TINTA; M.lineWidth = 2.5; M.beginPath(); M.moveTo(x0, y0); M.lineTo(x1, y0); M.stroke();
}

// BANCO (?banco=suelo): el suelo del bosque tal cual sale en el concepto (x 0-2200, d 0) con setas al pie de
// dos troncos que no se pintan (x 860 y 1400 como en la capa JUEGO), una roca del arroyo y la cascada de la capa
// media (d 0.3) para ver de cerca lo que se pinta. ?banco=suelo&agua: el arroyo (x 2200-4400 corrido a 0) con
// sus orillas, juncos, rocas y el agua de pintarAgua sobre un cielo de prueba.
export function banco() {
  const QS = new URLSearchParams(location.search);
  if (QS.has('agua')) {
    g.save(); g.beginPath(); g.rect(0, 0, 2200, 1500); g.clip(); g.translate(-2200, 0);
    const rr = azar(71);
    pintarSuelo(rr, 2180, 4420);
    for (const [x, w] of [[2560, 70], [2700, 56], [2840, 74], [2990, 60]]) { roca([[x - w / 2, AGUA + 8], [x - w * 0.42, AGUA - 14], [x - w * 0.1, AGUA - 24], [x + w * 0.35, AGUA - 18], [x + w / 2, AGUA + 8]], 0, x); musgo(x - w * 0.4, AGUA - 18, w * 0.8, 8, '#8f9a36', x + 1); }
    pintarJuncos(rr);
    g.restore();
    const cv = document.createElement('canvas'); cv.width = 8400; cv.height = 1600; const c = cv.getContext('2d');
    const gr = c.createLinearGradient(0, 0, 0, 1600); gr.addColorStop(0, '#8f936a'); gr.addColorStop(0.7, '#f2e6bc'); c.fillStyle = gr; c.fillRect(0, 0, 8400, 1600);
    c.drawImage(g.canvas, 2200, 0, 2200, 1600, 2200, 0, 2200, 1600);
    c.fillStyle = '#1e1c10'; for (let x = 2470; x < 3200; x += 170) c.fillRect(x, 1100, 14, 168);
    const tmp = document.createElement('canvas'); tmp.width = 2200; tmp.height = 1600; const t = tmp.getContext('2d');
    t.translate(-2200, 0); pintarAguaEn(t, cv);
    g.drawImage(tmp, 0, 0);
    return;
  }
  g.save(); g.beginPath(); g.rect(0, 0, 2200, 1500); g.clip();
  const rr = azar(71);
  pintarSuelo(rr, -20, 2260);
  cascada(1960, 820, 1172, 22, 0.3, 63);
  const x = 1500, w = 74; roca([[x - w / 2, 1190], [x - w * 0.42, 1168], [x - w * 0.1, 1158], [x + w * 0.35, 1164], [x + w / 2, 1190]], 0, x); musgo(x - w * 0.4, 1164, w * 0.8, 8, '#8f9a36', x + 1);
  pintarSetas(rr, [[860, 210], [1400, 170]]);
  pintarHierba(rr, 0, 2200);
  g.restore();
}
function pintarAguaEn(t, cv) { pintarAgua(t, cv); }
