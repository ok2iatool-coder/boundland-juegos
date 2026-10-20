// EL LINDE · CASAS y CONSTRUCCIONES: casa de madera, capsula, plataforma, escalera, edificio de la ciudad,
// aguja lejana y estandarte. SIN vegetacion (regla del usuario): ni musgo ni hiedra encima; el abandono se
// cuenta con oxido PARDO, mugre, chorretones, picado, abolladuras y piezas que faltan.
// Luz: contraluz desde atras-arriba, del lado del sol (ladoLuz). Cel: tres valores planos por forma
// (sombra, medio, luz) con corte duro, y la luz solo LAME el canto que mira al sol (banda ocre, pico crema).
// Tinta: una sola, mas gruesa cerca, nada pasado d 0,4. Ningun brillo por encima del blanco del 18.
// Color: las chapas y el hormigon llevan un punto FRIO (B por encima de R) porque el etalonaje final de la
// pagina (soft-light calido/oliva) los amarillea; despues de el quedan en el gris calido de la referencia.
// Ronda 2 del escultor de casas (2026-10-18): capsula con terminador en cel, jaula irregular y ventana grande
// descentrada; plataforma con mensulas distintas, tirantes en cruz y sombra arrojada; edificios con remate
// dentado, forjados cortados con sombra, vanos irregulares con retranqueo y sin el rayo pegado encima;
// casas con tejado combado de verdad y tejas irregulares.
import { TINTA, azar, mezclar, rgba, trazar, tinta, hash } from '../dibujo/tinta.js';
import { g, tono, ladoLuz, luces, sueloY, SOL } from './base.js';

// grosor de tinta segun la distancia: entero cerca, se adelgaza y desaparece en d 0,4
const tk = (w0, d) => (d < 0.4 ? w0 * (1 - (d / 0.4) * 0.65) : 0);
const VENTANA = '#eed69f';            // luz de dentro: crema-oro, nunca naranja, nunca blanca
function linea(pts, col, w) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]); g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
// barra con tinta (tubo, costilla, viga): tinta debajo, color, y la luz solo en los tramos que dice luzEn
function barra(pts, col, w, d, luzCol, luzEn, tm = 1) {
  const t = tk(1.2, d) * tm;
  if (t) linea(pts, TINTA, w + 2 * t);
  linea(pts, col, w);
  if (luzCol) for (let k = 1; k < pts.length; k++) if (!luzEn || luzEn(k)) { const a = pts[k - 1], b = pts[k], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, nx = dy / m, ny = -dx / m, s = ny > 0 ? -1 : 1, o = (w / 2 - 0.8) * s; linea([[a[0] + nx * o, a[1] + ny * o], [b[0] + nx * o, b[1] + ny * o]], luzCol, Math.max(1, w * 0.3)); }
}
// chorreton: hilo oscuro que baja y se afina (sin degradado: dos tramos planos)
function chorreton(x, y, l, w, col) { g.fillStyle = col; g.fillRect(x, y, w, l * 0.6); g.fillRect(x + w * 0.25, y + l * 0.6, Math.max(1, w * 0.5), l * 0.4); }
// GRANO de la materia: motas de 1-3 px en gris (overlay: no cambia el valor medio, solo da textura)
let _grano = null;
function grano(x0, y0, w, h, a) {
  if (typeof document === 'undefined') return;
  if (!_grano) {
    const c = document.createElement('canvas'); c.width = c.height = 192; const G = c.getContext('2d'), rr = azar(77);
    G.fillStyle = '#808080'; G.fillRect(0, 0, 192, 192);
    for (let k = 0; k < 9000; k++) { const v = Math.floor(128 + (rr() - 0.5) * 150); G.fillStyle = `rgb(${v},${v},${v})`; G.fillRect(Math.floor(rr() * 192), Math.floor(rr() * 192), 1 + Math.floor(rr() * 2), 1 + Math.floor(rr() * 3)); }
    _grano = c;
  }
  g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = a; g.fillStyle = g.createPattern(_grano, 'repeat'); g.fillRect(x0, y0, w, h); g.restore();
}
function remache(x, y, d, luz, r = 1.3) { g.fillStyle = rgba(tono('#15141a', d, x), 0.8); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); if (luz) { g.fillStyle = luz; g.fillRect(x - 0.6, y - r - 0.3, 1.2, 1); } }

// ================================================================= CAPSULA
// Casita esferica de chapa en gajos remachados. La FORMA la da la luz: tres zonas en cel con corte duro
// (luz arriba del lado del sol, medio, y la sombra que se come la mitad de abajo y la del lado contrario),
// un contraluz grueso en el canto de arriba y oclusion fuerte bajo el balcon. Jaula de pocas costillas de
// hierro, de grosor distinto y una doblada, solo en la cara que se ve. Ventana grande arqueada y descentrada
// con barras radiales y la luz crema dentro; dos ojos de buey pequenos, a oscuras y desplazados.
export function capsula(cx, cy, r, d, sem, o = {}) {
  const rr = azar(sem), ld = ladoLuz(cx), T = (c) => tono(c, d, cx), t = tk(2.8, d);
  // o.oxido: la chapa de la aldea del arbol (referencia): bronce pardo oscuro en vez de gris, la ventana llena de luz
  const OXI = !!o.oxido, LV = o.luz ?? 1;
  const SOM = T(OXI ? '#221d19' : '#3a3b42'), MED = T(OXI ? '#3a3029' : '#585a61'), CLA = T(OXI ? '#5a4a3b' : '#787980'), LUZ = T('#c0a374'), PICO = T('#e3d5ad');
  const OX = T('#5b3a24'), OX2 = T('#7d5434'), OSC = T('#121215'), MUG = rgba(T('#101014'), 0.55);
  const HIE = [T('#26252a'), T('#4a4241'), T('#7a6656')];      // costillas: en sombra, medio, al sol (pardo apagado)
  const RAD = Math.PI / 180, IN = 0.3;
  const V = (lon, lat) => { const X = Math.cos(lat) * Math.sin(lon), Y = Math.sin(lat), Z = Math.cos(lat) * Math.cos(lon); return [X, Y * Math.cos(IN) - Z * Math.sin(IN), Y * Math.sin(IN) + Z * Math.cos(IN)]; };
  const P = (lon, lat, rad = r) => { const [X, Y] = V(lon, lat); return [cx + rad * X, cy - rad * Y]; };
  const Zv = (lon, lat) => V(lon, lat)[2];
  // zonas de luz en pantalla (cel): dentro de cLuz = luz, dentro de cMed = medio, fuera = sombra
  const cLuz = [cx + ld * r * 0.4, cy - r * 0.8, r * 0.72], cMed = [cx + ld * r * 0.3, cy - r * 0.34, r * 1.0];
  const zona = (px, py) => (Math.hypot(px - cLuz[0], py - cLuz[1]) < cLuz[2] ? 2 : Math.hypot(px - cMed[0], py - cMed[1]) < cMed[2] ? 1 : 0);
  const esfera = () => { g.beginPath(); g.arc(cx, cy, r, 0, 7); };
  // balcon (del lado del sol) y su sitio, que hace falta antes para la oclusion
  const bal = P(ld * 64 * RAD, -16 * RAD), balW = r * 0.62;
  // ---- patas y tubo de bajada por DETRAS (desiguales: una recta, otra con codo y riostra)
  { const a = P(-ld * 30 * RAD, -58 * RAD), b = P(ld * 26 * RAD, -62 * RAD);
    barra([a, [a[0] - ld * r * 0.22, cy + r * 1.18]], SOM, 6, d, null);
    barra([b, [b[0] + ld * r * 0.12, cy + r * 0.98], [b[0] + ld * r * 0.2, cy + r * 1.18]], SOM, 4.5, d, LUZ, (k) => k === 1);
    barra([[a[0] - ld * r * 0.12, cy + r * 0.95], [b[0] + ld * r * 0.12, cy + r * 1.0]], T('#2a2a2f'), 2.2, d); }
  // ---- cuerpo en cel
  g.save(); esfera(); g.clip();
  g.fillStyle = SOM; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  g.fillStyle = MED; g.beginPath(); g.arc(cMed[0], cMed[1], cMed[2], 0, 7); g.fill();
  g.fillStyle = CLA; g.beginPath(); g.arc(cLuz[0], cLuz[1], cLuz[2], 0, 7); g.fill();
  // placas: gajos irregulares x anillos; cada placa con su tinte (mas oscura o mas clara, plano) y su canto grueso
  const gajos = [-90, -63, -38, -12, 9, 33, 61, 90].map((v, i, A) => (i === 0 || i === A.length - 1 ? v : v + (rr() - 0.5) * 10) * RAD);
  const anillos = [-90, -52, -24, 4, 30, 58, 90].map((v, i, A) => (i === 0 || i === A.length - 1 ? v : v + (rr() - 0.5) * 6) * RAD);
  const placas = [];
  for (let i = 0; i < gajos.length - 1; i++) for (let j = 0; j < anillos.length - 1; j++) {
    const l0 = gajos[i], l1 = gajos[i + 1], a0 = anillos[j], a1 = anillos[j + 1], pts = [];
    if (Zv((l0 + l1) / 2, (a0 + a1) / 2) < -0.2) continue;
    for (let s = 0; s <= 4; s++) pts.push(P(l0 + ((l1 - l0) * s) / 4, a0));
    for (let s = 0; s <= 4; s++) pts.push(P(l1, a0 + ((a1 - a0) * s) / 4));
    for (let s = 0; s <= 4; s++) pts.push(P(l1 - ((l1 - l0) * s) / 4, a1));
    for (let s = 0; s <= 4; s++) pts.push(P(l0, a1 - ((a1 - a0) * s) / 4));
    placas.push({ pts, l0, l1, a0, a1 });
  }
  for (const p of placas) { const z = rr(); if (z < 0.55) continue; trazar(g, p.pts); g.fillStyle = z < 0.8 ? rgba(T('#18181c'), 0.22) : rgba(T('#9a9aa0'), 0.12); g.fill(); }
  // oxido pardo en pocas manchas (chapa gris manda), picado y chorretones
  const area = r * r;
  for (let k = 0; k < area / 1500; k++) { const px = cx + (rr() - 0.5) * 1.6 * r, py = cy + (rr() - 0.1) * 1.2 * r; g.fillStyle = rgba(rr() < 0.7 ? OX : OX2, 0.32); g.beginPath(); g.ellipse(px, py, 2 + rr() * 6, 1.5 + rr() * 3, rr() * 3, 0, 7); g.fill(); }
  for (let k = 0; k < area / 22; k++) { const z = rr(), px = cx + (rr() - 0.5) * 2 * r, py = cy + (rr() - 0.5) * 2 * r; g.fillStyle = z < 0.55 ? rgba(OSC, 0.3) : rgba(T('#8e8e94'), 0.22); g.fillRect(px, py, 1 + rr() * 1.5, 1 + rr()); }
  grano(cx - r, cy - r, 2 * r, 2 * r, 0.45 * (1 - d * 0.6));
  // abolladuras: arco de sombra abajo y de luz arriba, solo donde hay luz para verlas
  for (let k = 0; k < 4; k++) { const px = cx + (rr() - 0.3 * ld) * r * 0.9 * ld, py = cy - r * 0.2 + (rr() - 0.5) * r * 0.9, rd = 4 + rr() * 5; if (zona(px, py) === 0) continue; g.lineWidth = 1.3; g.strokeStyle = rgba(OSC, 0.55); g.beginPath(); g.arc(px, py, rd, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); g.strokeStyle = rgba(T('#a4a3a6'), 0.5); g.beginPath(); g.arc(px, py - 1.4, rd, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); }
  // juntas: canto grueso (tinta de 1,4 y bisel de luz debajo solo en las zonas con luz)
  const junta = (pts) => {
    g.strokeStyle = rgba(T('#0e0e11'), 0.85); g.lineWidth = 1.5; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.stroke();
    for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], z = zona((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); if (!z) continue; g.strokeStyle = z === 2 ? rgba(LUZ, 0.7) : rgba(T('#8a8a90'), 0.45); g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1] + 1.4); g.lineTo(b[0], b[1] + 1.4); g.stroke(); }
  };
  for (const lon of gajos.slice(1, -1)) { const pts = []; for (let lat = -88; lat <= 88; lat += 4) if (Zv(lon, lat * RAD) > 0.02) pts.push(P(lon, lat * RAD)); if (pts.length > 1) junta(pts); }
  for (const lat of anillos.slice(1, -1)) { const pts = []; for (let lon = -90; lon <= 90; lon += 4) if (Zv(lon * RAD, lat) > 0.02) pts.push(P(lon * RAD, lat)); if (pts.length > 1) junta(pts); }
  // anillos de remaches a los dos lados de cada junta horizontal
  for (const lat of anillos.slice(1, -1)) for (let lon = -84; lon <= 84; lon += 7) { const L = lon * RAD; if (Zv(L, lat) < 0.15) continue; for (const s of [-1, 1]) { const [px, py] = P(L + 3.5 * RAD * (s > 0 ? 1 : 0), lat + s * 3.2 * RAD); remache(px, py, d, zona(px, py) === 2 ? PICO : null, 1.1); } }
  for (const p of placas) { if (rr() > 0.45) continue; const b = p.pts[12]; chorreton(b[0] + (rr() - 0.5) * 6, b[1] + 1, 6 + rr() * 20, 1 + rr() * 1.6, MUG); }
  // oclusion: bajo el balcon (fuerte, plana) y el sombreado de contacto de la cara de abajo
  g.fillStyle = rgba(T('#08080a'), 0.55); g.beginPath(); g.moveTo(bal[0] - ld * 4, bal[1] + 4); g.lineTo(bal[0] - ld * r * 0.55, bal[1] + r * 0.08); g.lineTo(bal[0] - ld * r * 0.5, bal[1] + r * 0.32); g.lineTo(bal[0], bal[1] + r * 0.4); g.closePath(); g.fill();
  g.fillStyle = rgba(T('#08080a'), 0.4); g.beginPath(); g.ellipse(cx - ld * r * 0.15, cy + r * 1.02, r * 0.95, r * 0.3, 0, 0, 7); g.fill();
  g.restore();
  // ---- ojos de buey pequenos, a oscuras, desplazados (marco grueso con remaches, cristal apagado)
  const ojo = (lon, lat, rw) => {
    const [wx, wy] = P(lon, lat), ex = Math.max(0.5, Math.cos(lon)), z = zona(wx, wy);
    g.save(); g.translate(wx, wy); g.scale(ex, 1);
    g.beginPath(); g.arc(0, 0, rw + 4.5, 0, 7); g.fillStyle = HIE[Math.max(0, z - 0) === 2 ? 1 : 0]; g.fill(); if (t) { g.lineWidth = t * 0.5; g.strokeStyle = TINTA; g.stroke(); }
    g.beginPath(); g.arc(0, 0, rw, 0, 7); g.fillStyle = T('#1d1d22'); g.fill(); if (t) { g.lineWidth = t * 0.4; g.strokeStyle = TINTA; g.stroke(); }
    g.fillStyle = rgba(T('#55565c'), 0.6); g.beginPath(); g.ellipse(-rw * 0.35, -rw * 0.35, rw * 0.28, rw * 0.14, -0.7, 0, 7); g.fill();
    g.strokeStyle = HIE[0]; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-rw, 0); g.lineTo(rw, 0); g.moveTo(0, -rw); g.lineTo(0, rw); g.stroke();
    for (let q = 0; q < 8; q++) { const a = (q / 8) * Math.PI * 2; remache(Math.cos(a) * (rw + 2.4), Math.sin(a) * (rw + 2.4), d, z === 2 && Math.sin(a) < 0 ? PICO : null, 0.9); }
    if (z) { g.strokeStyle = z === 2 ? LUZ : rgba(T('#8a8a90'), 0.8); g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, rw + 4.2, ld > 0 ? -1.5 : -2.9, ld > 0 ? -0.2 : -1.6); g.stroke(); }
    g.restore();
  };
  ojo(ld * 44 * RAD, 30 * RAD, r * 0.11);
  ojo(-ld * 58 * RAD, -30 * RAD, r * 0.085);
  // ---- ventana grande arqueada, descentrada hacia el lado contrario al sol
  { const lon = -ld * 20 * RAD, [wx, wy] = P(lon, -2 * RAD), ex = Math.cos(lon), ww = r * 0.24 * ex, hb = r * 0.2, ra = ww;
    const arco = (k) => { g.beginPath(); g.moveTo(wx - ww - k, wy + hb + k); g.lineTo(wx - ww - k, wy); g.arc(wx, wy, ra + k, Math.PI, 0); g.lineTo(wx + ww + k, wy + hb + k); g.closePath(); };
    // marco grueso e irregular de hierro, con su canto al sol arriba
    arco(6); g.fillStyle = HIE[1]; g.fill(); if (t) tinta(g, t * 0.7);
    g.fillStyle = rgba(OX, 0.5); g.fillRect(wx - ww - 6, wy + hb - 2, 2 * ww + 12, 8);
    arco(0); g.fillStyle = OSC; g.fill();
    g.save(); arco(0); g.clip();
    // la luz de dentro: ocre apagado al fondo y un nucleo crema pequeno, abajo y descentrado
    const lx = wx + ld * ww * 0.15, ly = wy + hb * 0.45;
    g.fillStyle = T('#3a321f'); g.beginPath(); g.ellipse(lx, ly, ww * 0.95, hb * 1.2, 0, 0, 7); g.fill();
    g.fillStyle = T('#7d6a42'); g.beginPath(); g.ellipse(lx, ly + 2, ww * 0.5, hb * 0.6, 0, 0, 7); g.fill();
    if (LV > 1) { g.fillStyle = T('#b89a5e'); g.beginPath(); g.ellipse(lx, ly + 1, ww * 0.85, hb * 1.1, 0, 0, 7); g.fill(); }
    g.fillStyle = VENTANA; g.beginPath(); g.arc(lx, ly + 3, Math.min(4.5, ww * 0.22) * (LV > 1 ? 1.8 : 1), 0, 7); g.fill();
    // barras radiales desde un cubo en el centro del arco y un aro a media altura
    g.strokeStyle = T('#1c1a1a'); g.lineWidth = 2; g.beginPath();
    for (let q = 0; q <= 6; q++) { const a = Math.PI + (q / 6) * Math.PI; g.moveTo(wx, wy + hb * 0.15); g.lineTo(wx + Math.cos(a) * ra * 1.2, wy + hb * 0.15 + Math.sin(a) * ra * 1.2); }
    g.moveTo(wx - ww, wy + hb * 0.55); g.lineTo(wx + ww, wy + hb * 0.55); g.moveTo(wx, wy); g.lineTo(wx, wy + hb);
    g.stroke(); g.lineWidth = 1.6; g.beginPath(); g.arc(wx, wy + hb * 0.15, ra * 0.55, Math.PI, 0); g.stroke();
    g.fillStyle = T('#2a2624'); g.beginPath(); g.arc(wx, wy + hb * 0.15, 3, 0, 7); g.fill();
    g.restore();
    luces.push([lx, ly + 3, 2.2 * LV, 0.3 * LV * (1 - d * 0.5)]);
    // canto de luz en el marco (lado del sol, arriba) y remaches del marco
    g.lineCap = 'butt'; g.strokeStyle = LUZ; g.lineWidth = 2.2; g.beginPath(); g.arc(wx, wy, ra + 5, ld > 0 ? -1.45 : -2.9, ld > 0 ? -0.25 : -1.7); g.stroke();
    for (let q = 0; q < 9; q++) { const a = Math.PI + (q / 8) * Math.PI; remache(wx + Math.cos(a) * (ra + 3), wy + Math.sin(a) * (ra + 3), d, null, 0.9); }
    chorreton(wx - ww * 0.4, wy + hb + 7, 14 + rr() * 16, 1.6, MUG); chorreton(wx + ww * 0.5, wy + hb + 7, 8 + rr() * 10, 1.2, MUG); }
  // ---- puerta-escotilla, del lado del balcon, en la sombra
  if (o.puerta) {
    const [px, top] = P(ld * 36 * RAD, -12 * RAD), bot = P(ld * 36 * RAD, -56 * RAD)[1], pw = r * 0.15;
    const hueco = () => { g.beginPath(); g.moveTo(px - pw, bot); g.lineTo(px - pw, top + pw); g.arc(px, top + pw, pw, Math.PI, 0); g.lineTo(px + pw, bot); g.closePath(); };
    hueco(); g.strokeStyle = HIE[0]; g.lineWidth = 5; g.stroke(); if (t) tinta(g, t * 0.5); g.fillStyle = T('#24242a'); g.fill();
    g.strokeStyle = rgba(T('#4a4a50'), 0.9); g.lineWidth = 1.3; g.beginPath(); g.moveTo(px - pw * 0.7, top + pw * 1.1); g.lineTo(px + pw * 0.7, top + pw * 1.1); g.moveTo(px - pw * 0.7, (top + bot) / 2 + 6); g.lineTo(px + pw * 0.7, (top + bot) / 2 + 6); g.stroke();
    g.strokeStyle = HIE[1]; g.lineWidth = 2; g.beginPath(); g.arc(px - ld * pw * 0.4, (top + bot) / 2, 3.5, 0, 7); g.stroke();
  }
  // ---- jaula: pocas costillas de grosor distinto, una doblada y otra partida; SOLO la cara que se ve
  const costilla = (pts, w0) => {
    const tt = tk(1.3, d);
    for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k]; if (a.z < 0.12 || b.z < 0.12 || a.roto || b.roto) continue; if (tt) linea([a.p, b.p], TINTA, w0 + 2 * tt); }
    for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k]; if (a.z < 0.12 || b.z < 0.12 || a.roto || b.roto) continue; const z = zona((a.p[0] + b.p[0]) / 2, (a.p[1] + b.p[1]) / 2); linea([a.p, b.p], HIE[z], w0); if (z === 2) linea([[a.p[0], a.p[1] - w0 * 0.3], [b.p[0], b.p[1] - w0 * 0.3]], T('#a78b71'), Math.max(1, w0 * 0.35)); }
  };
  const RJ = r * 1.05;
  const merid = [[-ld * 52, 4.6, 0, -1], [ld * 4, 2.4, 9, -1], [ld * 47, 3.6, 0, 0.62]];
  for (const [lon0, w0, doblez, rot] of merid) { const pts = []; for (let lat = -84; lat <= 84; lat += 3) { const L = lat * RAD, kink = doblez * Math.exp(-(((lat - 18) / 12) ** 2)), lon = (lon0 + kink) * RAD; const u = (lat + 84) / 168; pts.push({ p: P(lon, L, RJ), z: Zv(lon, L), roto: rot > 0 && u > rot && u < rot + 0.09 }); } costilla(pts, w0 * (1 - d * 0.4)); }
  for (const [lat0, w0] of [[-16, 5.5], [46, 3]]) { const pts = []; for (let lon = -100; lon <= 100; lon += 4) pts.push({ p: P(lon * RAD, lat0 * RAD, RJ), z: Zv(lon * RAD, lat0 * RAD) }); costilla(pts, w0 * (1 - d * 0.4)); }
  // remaches gordos en el cinturon
  for (let lon = -78; lon <= 78; lon += 11) { const L = lon * RAD; if (Zv(L, -16 * RAD) < 0.2) continue; const [px, py] = P(L, -16 * RAD, RJ); remache(px, py, d, zona(px, py) === 2 ? PICO : null, 1.5); }
  // casquete de arriba: aro y vastago torcido
  { const [tx, ty] = P(0, 90 * RAD, RJ); g.beginPath(); g.ellipse(tx, ty, r * 0.2, r * 0.2 * Math.sin(IN), 0, 0, 7); g.fillStyle = HIE[1]; g.fill(); if (t) tinta(g, t * 0.5); g.fillStyle = LUZ; g.fillRect(tx - r * 0.16, ty - r * 0.2 * Math.sin(IN) - 0.5, r * 0.3, 1.6); barra([[tx, ty], [tx + ld * 2, ty - r * 0.18], [tx + ld * 7, ty - r * 0.3]], HIE[0], 3.5, d, LUZ, (k) => k === 2); }
  // tubo por fuera, del lado contrario al sol, con abrazaderas
  { const s = -ld, [ox, oy] = P(s * 66 * RAD, 26 * RAD, r), ex = cx + s * r * 1.15, pts = [[ox, oy], [ex - s * 6, oy - 4], [ex, oy + 5], [ex, cy + r * 1.12]]; barra(pts, T('#36373d'), 5, d, rgba(T('#77787e'), 0.8), (k) => k === 1); for (const fy of [oy + 26, oy + 74]) { g.fillStyle = HIE[1]; g.fillRect(ex - 4, fy, 8, 3); } g.fillStyle = HIE[1]; g.fillRect(ox - 4, oy - 4, 8, 8); }
  // ---- balcon con mensula, chapa de canto grueso y barandilla torcida (del lado del sol)
  { const s = ld, [bx, by] = bal, x0 = Math.min(bx, bx + s * balW), x1 = Math.max(bx, bx + s * balW);
    // mensula: triangulo de llanta con alma, contra la esfera
    const m0 = [bx + s * 2, by + 6], m1 = [bx + s * balW * 0.75, by + 6], m2 = [bx - s * 3, by + r * 0.34];
    g.fillStyle = T('#2b2b31'); g.beginPath(); g.moveTo(...m0); g.lineTo(...m1); g.lineTo(...m2); g.closePath(); g.fill(); if (t) tinta(g, t * 0.45);
    barra([m1, m2], T('#3c3c42'), 3, d);
    g.fillStyle = T('#1b1b20'); g.beginPath(); g.arc(bx + s * balW * 0.32, by + r * 0.12, 3, 0, 7); g.fill();
    // piso: canto grueso de 6 px, luz arriba
    g.fillStyle = T('#3c3d44'); g.fillRect(x0, by, x1 - x0, 6); g.fillStyle = rgba(OSC, 0.6); g.fillRect(x0, by + 4, x1 - x0, 2);
    g.fillStyle = LUZ; g.fillRect(x0, by - 1, x1 - x0, 1.8); for (let xx = x0 + 3; xx < x1; xx += 6 + (hash(Math.floor(xx), sem) * 4)) remache(xx, by + 3, d, null, 0.8);
    if (t) { g.strokeStyle = TINTA; g.lineWidth = t * 0.5; g.strokeRect(x0, by - 1, x1 - x0, 7); }
    // barandilla: postes a distancias distintas, uno inclinado, pasamanos que cae al final
    const xs = [x0 + 2, x0 + (x1 - x0) * 0.3, x0 + (x1 - x0) * 0.52, x1 - 2];
    const alto = (xx) => -17 + (s > 0 ? (xx - x0) : (x1 - xx)) / (x1 - x0) * 5;
    for (let k = 0; k < xs.length; k++) barra([[xs[k], by], [xs[k] + (k === 2 ? s * 4 : 0), by + alto(xs[k])]], HIE[1], 2.2, d, null, null, 0.5);
    barra(xs.map((xx, k) => [xx + (k === 2 ? s * 4 : 0), by + alto(xx)]), HIE[1], 2.4, d, T('#a78b71'), null, 0.6);
    barra([[xs[0], by - 8], [xs[1], by - 9]], HIE[0], 1.4, d, null, null, 0.4); }
  // ---- contorno de tinta y CONTRALUZ: banda gruesa plana en el canto de arriba del lado del sol
  if (t) { esfera(); tinta(g, t); }
  const mid = -Math.PI / 2 + ld * 0.5, a0 = mid - 0.95, a1 = mid + 0.95;
  g.lineCap = 'butt'; g.strokeStyle = LUZ; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, r - 3.4, a0, a1); g.stroke();
  g.strokeStyle = PICO; g.lineWidth = 1.6; g.beginPath(); g.arc(cx, cy, r - 1.9, a0 + 0.35, a1 - 0.35); g.stroke();
}

// PLATAFORMA de chapa con canto grueso remachado, tres mensulas distintas (escuadra con alma, codo curvo
// y jabalcon con tirante en cruz), sombra arrojada irregular debajo y barandilla de postes desiguales.
export function plataforma(x0, x1, y, d, sem) {
  const rr = azar(sem), T = (c) => tono(c, d, x0), ld = ladoLuz(x0), t = tk(2.4, d), W = x1 - x0;
  const SOM = T('#25262b'), MED = T('#3f4047'), CLA = T('#5e5f66'), LUZ = T('#c0a374'), PICO = T('#e3d5ad');
  const HIE = T('#3b3433'), HIE2 = T('#5e4f45'), HL = T('#a78b71'), OX = T('#5b3a24'), OSC = T('#0d0d10');
  // sombra arrojada sobre lo de detras: banda irregular, dura
  { g.fillStyle = rgba(T('#08080a'), 0.42); g.beginPath(); g.moveTo(x0 + 6, y + 14); let xx = x0 + 6; const pts = []; while (xx < x1 - 4) { pts.push([xx, y + 30 + rr() * 26 + (xx - x0) / W * 18]); xx += 14 + rr() * 30; } pts.push([x1 - 4, y + 22]); g.lineTo(x1 - 4, y + 14); for (let k = pts.length - 1; k >= 0; k--) g.lineTo(pts[k][0], pts[k][1]); g.closePath(); g.fill(); }
  // mensulas distintas
  const mx = [x0 + W * 0.12 + rr() * 8, x0 + W * 0.47 + rr() * 14, x1 - W * 0.14 - rr() * 8];
  // 1: escuadra con alma (chapa triangular rellena) y agujero de aligerado
  { const a = mx[0], hgt = 56; g.fillStyle = MED; g.beginPath(); g.moveTo(a, y + 13); g.lineTo(a + 40, y + 13); g.lineTo(a, y + 13 + hgt); g.closePath(); g.fill(); if (t) tinta(g, t * 0.6);
    g.fillStyle = OSC; g.beginPath(); g.arc(a + 11, y + 28, 5, 0, 7); g.fill(); barra([[a, y + 13], [a, y + 13 + hgt]], SOM, 4, d); barra([[a + 40, y + 14], [a + 1, y + 13 + hgt]], HIE, 3, d, ld > 0 ? HL : null);
    for (const q of [0.25, 0.55, 0.85]) remache(a + 2, y + 13 + hgt * q, d); g.fillStyle = rgba(OX, 0.45); g.fillRect(a + 2, y + 40, 6, 18); }
  // 2: codo curvo de pletina
  { const a = mx[1]; g.lineCap = 'round'; const curva = () => { g.beginPath(); g.moveTo(a + 34, y + 13); g.quadraticCurveTo(a + 2, y + 18, a + 4, y + 66); }; if (t) { curva(); g.strokeStyle = TINTA; g.lineWidth = 4 + 2 * tk(1.2, d); g.stroke(); } curva(); g.strokeStyle = HIE; g.lineWidth = 4; g.stroke(); g.save(); g.translate(1, -1); curva(); g.strokeStyle = rgba(HL, 0.6); g.lineWidth = 1.2; g.stroke(); g.restore();
    barra([[a + 4, y + 13], [a + 5, y + 70]], SOM, 5, d); }
  // 3: jabalcon + tirante en cruz hasta la mensula 2, con tensor
  { const a = mx[2]; barra([[a, y + 13], [a - 30, y + 64]], SOM, 4.5, d); barra([[a - 30, y + 64], [a - 32, y + 74]], SOM, 4, d);
    const b = mx[1] + 5; barra([[b, y + 20], [a - 28, y + 60]], T('#2c2a2c'), 1.8, d); barra([[b, y + 62], [a - 6, y + 18]], T('#2c2a2c'), 1.8, d);
    const tx = (b + a - 28) / 2, ty = y + 40; g.fillStyle = HIE2; g.fillRect(tx - 5, ty - 2, 10, 4); }
  // canto (frente): chapa de 14 px en tramos con juntas, remaches a distancias distintas, abolladura
  g.fillStyle = MED; g.fillRect(x0, y, W, 14);
  let xs = x0; while (xs < x1) { const sw = 40 + rr() * 60, z = rr(); g.fillStyle = z < 0.4 ? SOM : z < 0.8 ? MED : CLA; g.fillRect(xs, y + 2, Math.min(sw, x1 - xs), 10); g.fillStyle = OSC; g.fillRect(xs + sw - 1, y, 1.5, 14); for (let q = xs + 4; q < xs + sw - 3 && q < x1 - 2; q += 9 + rr() * 6) { remache(q, y + 4, d, null, 1); remache(q, y + 11, d, null, 1); } xs += sw; }
  g.fillStyle = rgba(OSC, 0.7); g.fillRect(x0, y + 12, W, 2);
  for (let k = 0; k < W / 22; k++) { g.fillStyle = rgba(rr() < 0.6 ? OX : T('#7d5434'), 0.38); g.fillRect(x0 + rr() * W, y + 3 + rr() * 8, 2 + rr() * 6, 1 + rr() * 2); }
  for (let k = 0; k < W / 28; k++) chorreton(x0 + rr() * W, y + 14, 4 + rr() * 18, 1 + rr() * 1.4, rgba(T('#111014'), 0.6));
  { const ax = x0 + W * (0.3 + rr() * 0.4); g.strokeStyle = rgba(OSC, 0.7); g.lineWidth = 1.2; g.beginPath(); g.arc(ax, y + 6, 6, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); }
  // luz: lame el borde de arriba, con el pico en el extremo del sol
  g.fillStyle = LUZ; g.fillRect(x0, y - 1.5, W, 2.5); g.fillStyle = PICO; g.fillRect(ld > 0 ? x1 - 70 : x0, y - 1.5, 70, 1.2);
  if (t) { g.strokeStyle = TINTA; g.lineWidth = t; g.strokeRect(x0, y - 1.5, W, 15.5); }
  // barandilla: postes a pasos distintos, uno que falta, uno doblado, pasamanos que se hunde donde falta
  const pos = []; for (let x = x0 + 4; x <= x1 - 3; x += 22 + rr() * 26) pos.push(x); if (pos[pos.length - 1] < x1 - 8) pos.push(x1 - 3);
  const falta = 1 + Math.floor(rr() * (pos.length - 3)), dob = (falta + 2) % pos.length || 1;
  const hund = (x) => 9 * Math.max(0, 1 - Math.abs(x - pos[falta]) / 40);
  for (let k = 0; k < pos.length; k++) { if (k === falta) { barra([[pos[k], y - 1], [pos[k] + 2, y - 9]], HIE, 3, d, null, null, 0.5); continue; } const x = pos[k]; barra([[x, y - 1], [x + (k === dob ? -ld * 7 : 0), y - 36 + (k === dob ? 4 : 0)]], HIE, k % 3 === 0 ? 3.5 : 2.6, d, HL, () => true, 0.5); }
  const top = []; for (let x = x0 + 4; x <= x1 - 3; x += 5) top.push([x, y - 36 + hund(x) + (x > pos[dob] - 20 && x < pos[dob] + 20 ? 3 : 0)]);
  barra(top, HIE, 3, d, HL, null, 0.6);
  const medio = top.map(([x, yy]) => [x, yy + 17]).filter(([x]) => Math.abs(x - pos[falta]) > 26); barra(medio.filter(([x]) => x < pos[falta]), HIE, 2, d, null, null, 0.5); barra(medio.filter(([x]) => x > pos[falta]), HIE, 2, d, null, null, 0.5);
  barra([[pos[falta] - 26, top[0][1] + 17], [pos[falta] - 18, y - 6]], HIE, 2, d, null, null, 0.5);
}

// ESCALERA de mano de hierro: largueros que no son paralelos del todo, peldanos a pasos distintos (falta uno,
// otro torcido), abrazadera a media altura; luz en el larguero del sol
export function escalera(x, y0, y1, d) {
  const T = (c) => tono(c, d, x), ld = ladoLuz(x), COS = T('#3e3636'), LUZ = T('#c0a374'), rr = azar(Math.floor(x) * 7 + 3);
  const falta = 3 + Math.floor(rr() * 6), tuerto = falta + 3 + Math.floor(rr() * 4);
  let y = y0 + 8, k = 0;
  const izq = (yy) => x - 9 - (yy - y0) / (y1 - y0) * 1.5, der = (yy) => x + 9 + (yy - y0) / (y1 - y0) * 1.0;
  while (y < y1 - 4) { if (k !== falta) barra([[izq(y), y], [der(y), y + (k === tuerto ? 5 : 1)]], COS, 2, d); y += 12 + rr() * 5; k++; }
  barra([[izq(y0), y0], [izq(y1), y1]], COS, 3, d, ld < 0 ? LUZ : null);
  barra([[der(y0), y0], [der(y1), y1]], COS, 3, d, ld > 0 ? LUZ : null);
  const ym = (y0 + y1) / 2; g.fillStyle = T('#5e4f45'); g.fillRect(izq(ym) - 3, ym, der(ym) - izq(ym) + 6, 4);
}

// ESTANDARTE: tela oscura deshilachada con agujeros y el rombo; barra con anillas y cuerdas
export function estandarte(x, y, w, h, d, sem) {
  const rr = azar(sem), T = (c) => tono(c, d, x), ld = ladoLuz(x), t = tk(2, d);
  const SOM = T('#1f1e1a'), MED = T('#2f2e27'), CLA = T('#454236'), LUZ = T('#b7a074');
  // borde de abajo deshilachado
  const pts = [[x, y], [x + w, y]];
  const n = 14; for (let k = 0; k <= n; k++) { const xx = x + w - (w * k) / n, cola = k === Math.floor(n / 2) ? h * 0.1 : 0; pts.push([xx + (rr() - 0.5) * 3, y + h * 0.86 + cola - (k % 2) * h * 0.07 - rr() * h * 0.1]); }
  pts.push([x + rr() * 3, y + h * 0.7]);
  const semH = rr(); const rrH = azar(Math.floor(semH * 1e6)); const hoyos = []; for (let k = 0; k < 2; k++) hoyos.push([x + w * (rrH() < 0.5 ? 0.1 + rrH() * 0.15 : 0.75 + rrH() * 0.15), y + h * (0.55 + rrH() * 0.2), 1.5 + rrH() * 2.5]);
  const forma = () => { trazar(g, pts); const [hx, hy, hr] = hoyos[0]; g.moveTo(hx + hr * 1.6, hy); g.lineTo(hx + hr * 0.3, hy - hr * 1.3); g.lineTo(hx - hr, hy - hr * 0.2); g.lineTo(hx - hr * 0.4, hy + hr * 1.2); g.lineTo(hx + hr * 0.8, hy + hr * 0.6); g.closePath(); };
  forma(); g.fillStyle = MED; g.fill('evenodd');
  g.save(); forma(); g.clip('evenodd');
  // pliegues verticales planos: sombra y luz en el lado del sol
  for (let k = 0; k < 5; k++) { const fx = x + (w * (k + 0.5)) / 5 + (rr() - 0.5) * 8; g.fillStyle = SOM; g.fillRect(fx - 3, y, 5 + rr() * 4, h); g.fillStyle = CLA; g.fillRect(fx + ld * 6, y, 2, h); }
  g.fillStyle = LUZ; g.fillRect(ld > 0 ? x + w - 3 : x, y, 3, h);
  for (let k = 0; k < w * h / 60; k++) { g.fillStyle = rgba(rr() < 0.5 ? SOM : CLA, 0.5); g.fillRect(x + rr() * w, y + rr() * h, 1 + rr() * 2, 1); }
  // mugre de abajo
  g.fillStyle = rgba(T('#0d0c09'), 0.35); g.fillRect(x, y + h * 0.7, w, h * 0.4);
  // rombo de la marca, en lino viejo (ni naranja ni azul)
  const cx = x + w / 2, cy = y + h * 0.42; g.strokeStyle = T('#8f876e'); g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(cx, cy - h * 0.18); g.lineTo(cx + w * 0.22, cy); g.lineTo(cx, cy + h * 0.18); g.lineTo(cx - w * 0.22, cy); g.closePath(); g.stroke();
  g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, cy - h * 0.09); g.lineTo(cx + w * 0.11, cy); g.lineTo(cx, cy + h * 0.09); g.lineTo(cx - w * 0.11, cy); g.closePath(); g.stroke();
  g.fillStyle = T('#8f876e'); g.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  g.restore();
  if (t) { forma(); g.lineWidth = t; g.strokeStyle = TINTA; g.lineJoin = 'round'; g.stroke(); }
  // hilachas sueltas
  g.strokeStyle = MED; g.lineWidth = 1; g.beginPath(); for (let k = 3; k < pts.length - 1; k++) if (rr() < 0.6) { const [px, py] = pts[k]; g.moveTo(px, py - 2); g.lineTo(px + (rr() - 0.5) * 4, py + 5 + rr() * 12); } g.stroke();
  // barra con anillas y cuerdas colgando
  barra([[x - 12, y - 2], [x + w + 12, y - 2]], T('#2e2820'), 5, d, LUZ);
  for (let k = 0; k <= 4; k++) { const ax = x + (w * k) / 4; g.strokeStyle = T('#5d4836'); g.lineWidth = 2; g.beginPath(); g.arc(ax, y, 4, 0, 7); g.stroke(); }
  for (const s of [x - 10, x + w + 10]) linea([[s, y], [s + (rr() - 0.5) * 6, y + 20 + rr() * 14]], T('#3a3328'), 1.4);
}

// AGUJA de la ciudad (lejana): torre por tramos, con remates rotos, ventanas y antenas; plana de bruma
export function aguja(x, base, h, w, d, sem) {
  const rr = azar(sem), col = tono('#55534c', d, x), osc = tono('#3b3933', d, x), luz = tono('#c3a56c', d * 0.8, x);
  let y = base, ww = w;
  const tramos = 3 + Math.floor(rr() * 3);
  for (let t = 0; t < tramos; t++) {
    const th = (h * 0.8) / tramos;
    g.fillStyle = col; g.fillRect(x - ww / 2, y - th, ww, th);
    g.fillStyle = rgba(luz, 0.45); g.fillRect(x + (ladoLuz(x) > 0 ? ww / 2 - 3 : -ww / 2), y - th, 3, th);
    g.fillStyle = osc; for (let yy = y - th + 10; yy < y - 8; yy += 18) for (let xx = x - ww / 2 + 6; xx < x + ww / 2 - 8; xx += 12) if (rr() < 0.6) g.fillRect(xx, yy, 4, 9);
    g.fillRect(x - ww / 2, y - th, ww, 3);
    if (rr() < 0.5) for (const sx of [x - ww / 2 - 6, x + ww / 2 + 6]) { g.fillStyle = col; g.beginPath(); g.moveTo(sx - 4, y - th); g.lineTo(sx, y - th - 18 - rr() * 14); g.lineTo(sx + 4, y - th); g.fill(); }
    y -= th; ww *= 0.72;
  }
  g.fillStyle = col; g.beginPath(); g.moveTo(x - ww / 2, y); g.lineTo(x + (rr() - 0.5) * ww * 0.3, y - h * 0.2); g.lineTo(x + ww / 2, y); g.fill();
  g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - h * 0.18); g.lineTo(x + 6, y - h * 0.2 - 40); g.stroke();
}

// ================================================================= EDIFICIO de la ciudad, roto
// Hormigon gris con un punto frio por plantas. Remate DENTADO: bloques que faltan por plantas, forjados que
// asoman en el hueco y varillas en haz. Vanos irregulares (desplazados, dobles, ciegos, rotos, tapiados, con
// persiana, alguno encendido pequeno) con retranqueo: sombra del dintel y la jamba; una planta hundida.
// Forjados cortados, oscuros y con su sombra debajo (no hilos de luz). Chorretones de cada vano, balcones,
// cajas de aire y chapas parcheadas. La luz solo lame el canto del sol y la cara lateral.
export function edificio(x, base, w, h, d, sem, o = {}) {
  const rr = azar(sem), ld = ladoLuz(x), T = (c) => tono(c, d, x), t = tk(2.4, d), fino = d < 0.55;
  // tres hormigones (normal, tiznado de hollin, lavado) para que no salgan todos iguales
  const [cS, cM, cC] = [['#202128', '#30323a', '#4b4d56'], ['#1a1b21', '#2a2c33', '#44464f'], ['#24262d', '#363840', '#53555e']][Math.floor(hash(sem, 13) * 3)];
  const SOM = T(cS), MED = T(o.col || cM), CLA = T(cC), LUZ = T('#c0a374'), PICO = T('#e3d5ad');
  const OSC = T('#0d0d10'), NEG = T('#060607'), OX = T('#5b3a24'), MUG = rgba(T('#0c0c0e'), 0.6);
  const top = base - h, fh = 44 + Math.floor(rr() * 10);
  // ---- remate dentado: uno o dos mordiscos hondos escalonados por plantas + dientes pequenos
  const bocados = []; for (let k = 0; k < 1 + Math.floor(rr() * 2); k++) bocados.push([x + w * (rr() < 0.5 ? rr() * 0.35 : 0.65 + rr() * 0.35), w * (0.18 + rr() * 0.3), fh * (h > 500 ? 1.5 + rr() * 2.5 : 0.8 + rr() * 1.2)]);
  const bloques = []; let bx = x;
  while (bx < x + w - 0.5) {
    const bw = Math.min(x + w - bx, 7 + rr() * 22), xm = bx + bw / 2;
    let hondo = 0; for (const [bc, hw, hd] of bocados) hondo = Math.max(hondo, hd * (1 - Math.abs(xm - bc) / hw));
    hondo = Math.floor(Math.max(0, hondo) / (fh * 0.5)) * fh * 0.5;                // escalones por medias plantas
    const z = rr(), diente = z < 0.5 ? rr() * 3 : z < 0.8 ? 4 + rr() * 8 : 10 + rr() * 16;
    bloques.push([bx, bx + bw, top + hondo + diente]); bx += bw;
  }
  const pts = [[x, base + 10]]; for (const [a, b, yy] of bloques) { pts.push([a, yy]); pts.push([b, yy]); } pts.push([x + w, base + 10]);
  // cara lateral del sol (estrecha), con su canto de luz calido contrastado
  const lw = Math.max(7, w * 0.08), lx = ld > 0 ? x + w : x - lw;
  { const bq = ld > 0 ? bloques[bloques.length - 1] : bloques[0], tp = bq[2], lat = [[lx, base + 10], [lx, tp + 3], [lx + lw, tp + 6], [lx + lw, base + 10]];
    trazar(g, lat); g.fillStyle = mezclar(MED, CLA, 0.5); g.fill();
    g.save(); trazar(g, lat); g.clip();
    for (let y2 = tp + 20; y2 < base; y2 += fh) { const j = (rr() - 0.5) * 6; g.fillStyle = rgba(SOM, 0.85); g.fillRect(lx, y2 + j, lw, 3); g.fillStyle = rgba(NEG, 0.5); g.fillRect(lx, y2 + j + 3, lw, 2); if (rr() < 0.45) { g.fillStyle = OSC; g.fillRect(lx + lw * 0.3, y2 + j + 12, Math.max(2, lw * 0.3), 14); } }
    grano(lx, tp, lw, base - tp, 0.4 * (1 - d * 0.6));
    g.fillStyle = LUZ; g.fillRect(ld > 0 ? lx + lw - 3 : lx, tp, 3, base - tp + 10); g.fillStyle = PICO; g.fillRect(ld > 0 ? lx + lw - 1.6 : lx, tp, 1.6, (base - tp) * 0.45);
    g.restore(); if (t) { trazar(g, lat); tinta(g, t * 0.7); } }
  trazar(g, pts); g.fillStyle = MED; g.fill();
  g.save(); trazar(g, pts); g.clip();
  // paneles de hormigon en cel y desconchones con ladrillo
  for (let k = 0; k < (w * h) / 2600; k++) { const px = x + rr() * w, py = top + rr() * h, pw = 18 + rr() * 60, ph = 14 + rr() * 50, z = rr(); g.fillStyle = z < 0.6 ? SOM : z < 0.88 ? CLA : T('#4c4642'); g.globalAlpha = 0.5; g.fillRect(px, py, pw, ph); }
  g.globalAlpha = 1;
  if (fino) for (let k = 0; k < (w * h) / 9000; k++) { const px = x + rr() * w, py = top + 30 + rr() * (h - 60); g.fillStyle = T('#433834'); g.beginPath(); g.ellipse(px, py, 10 + rr() * 14, 6 + rr() * 8, 0, 0, 7); g.fill(); g.strokeStyle = rgba(OSC, 0.7); g.lineWidth = 1; g.beginPath(); for (let q = -6; q < 8; q += 4) { g.moveTo(px - 12, py + q); g.lineTo(px + 12, py + q); } g.stroke(); }
  for (let k = 0; k < w / 50; k++) { const px = x + rr() * w, pw = 14 + rr() * 50, ph = h * (0.25 + rr() * 0.6); g.fillStyle = rgba(T('#0e0e11'), 0.55); g.fillRect(px, top, pw, ph); g.fillRect(px + pw * 0.3, top + ph, pw * 0.4, h * 0.1); }
  // picado fino (grano)
  for (let k = 0; k < (w * h) / (fino ? 25 : 70); k++) { const z = rr(); g.fillStyle = z < 0.5 ? rgba(OSC, 0.45) : z < 0.92 ? rgba(CLA, 0.55) : rgba(OX, 0.35); g.fillRect(x + rr() * w, top + rr() * h, 1 + rr() * 2, 1 + rr() * 2); }
  grano(x, top - 20, w, h + 40, 0.5 * (1 - d * 0.6));
  // grietas en diagonal
  g.strokeStyle = rgba(OSC, 0.85); g.lineWidth = 1; g.beginPath(); for (let k = 0; k < (w * h) / 9000; k++) { let px = x + rr() * w, py = top + rr() * h; g.moveTo(px, py); for (let q = 0; q < 4 + rr() * 5; q++) { px += (rr() - 0.5) * 16; py += 5 + rr() * 9; g.lineTo(px, py); } } g.stroke();
  // ---- plantas
  const cols = 30 + Math.floor(rr() * 10), vw0 = 15 + Math.floor(rr() * 6), vh0 = 22 + Math.floor(rr() * 6);
  const colX = []; for (let xx = x + 10 + rr() * 8; xx < x + w - vw0 - 6; xx += cols) colX.push(xx);
  const pisos = []; for (let y = base - fh; y > top + 10; y -= fh) pisos.push(y);
  const hundida = pisos.length > 4 ? 1 + Math.floor(rr() * (pisos.length - 3)) : -1;
  // bajante a la sombra, sin hilo de luz
  { const bxx = Math.floor(x + (ld > 0 ? w * 0.1 : w * 0.85) + rr() * 12); g.fillStyle = rgba(T('#141418'), 0.85); g.fillRect(bxx, top + 20, 3, h); for (let yy = top + 34 + rr() * 30; yy < base; yy += 50 + rr() * 40) g.fillRect(bxx - 1, yy, 5, 2); }
  pisos.forEach((y, ip) => {
    // forjado: canto oscuro cortado en tramos, sombra debajo; la luz solo en tramos cortos cerca del canto del sol
    let fx = x; while (fx < x + w) { const fl = 20 + rr() * 90, z = rr(); if (z > 0.12) { g.fillStyle = z < 0.7 ? SOM : mezclar(MED, CLA, 0.4); g.fillRect(fx, y - 4, fl, 4); g.fillStyle = rgba(NEG, 0.55); g.fillRect(fx, y, fl, 3); } else { g.fillStyle = rgba(NEG, 0.75); g.fillRect(fx, y - 5, fl * 0.4, 6); } fx += fl; }
    { const lxx = ld > 0 ? x + w - 18 - rr() * 30 : x + 4 + rr() * 10; g.fillStyle = rgba(LUZ, 0.75); g.fillRect(lxx, y - 5, 14 + rr() * 20, 1.2); }
    if (ip === hundida) {   // planta hundida: el cerramiento cayo y se ve el fondo oscuro con los pilares
      g.fillStyle = rgba(NEG, 0.9); g.fillRect(x, y + 1, w, fh - 5);
      g.fillStyle = rgba(T('#1d1d22'), 1); for (const xx of colX) { g.fillRect(Math.floor(xx - (cols - vw0) / 2) - 2, y + 1, 6, fh - 5); g.fillStyle = rgba(CLA, 0.5); g.fillRect(Math.floor(xx - (cols - vw0) / 2) + (ld > 0 ? 3 : -2), y + 1, 1, fh - 5); g.fillStyle = T('#1d1d22'); }
      for (let q = 0; q < 3; q++) { const sx = x + rr() * w; g.fillStyle = T('#2a2a30'); g.fillRect(sx, y + fh - 14 - rr() * 6, 12 + rr() * 20, 8); }
      return;
    }
    for (let ic = 0; ic < colX.length; ic++) {
      const z = rr(), vx = Math.floor(colX[ic] + (rr() - 0.5) * 6), vy = Math.floor(y + 8 + rr() * 4);
      let vw = vw0 + Math.floor((rr() - 0.5) * 6); const vh = vh0 + Math.floor((rr() - 0.5) * 6);
      if (z < 0.1) { // vano cegado con ladrillo: rectangulo de otro tono y su junta
        g.fillStyle = mezclar(MED, T('#4a3f3a'), 0.4); g.fillRect(vx, vy, vw, vh); g.strokeStyle = rgba(OSC, 0.7); g.lineWidth = 1; g.strokeRect(vx + 0.5, vy + 0.5, vw - 1, vh - 1); g.beginPath(); for (let q = 4; q < vh; q += 4) { g.moveTo(vx, vy + q); g.lineTo(vx + vw, vy + q); } g.stroke(); continue;
      }
      if (z > 0.86 && ic < colX.length - 1) { vw = vw + cols; ic++; }   // vano doble (escaparate o balconera)
      // hueco con retranqueo: fondo negro, sombra del dintel arriba y jamba encendida a medias del lado contrario al sol
      g.fillStyle = OSC; g.fillRect(vx, vy, vw, vh);
      g.fillStyle = NEG; g.fillRect(vx, vy, vw, 4);
      g.fillStyle = mezclar(SOM, CLA, 0.3); g.fillRect(ld > 0 ? vx : vx + vw - 2, vy + 4, 2, vh - 4);
      const c = rr();
      if (c < 0.35) { /* hueco negro */ }
      else if (c < 0.55) { // rota: restos de marco y un cristal colgando
        g.strokeStyle = SOM; g.lineWidth = 2; g.beginPath(); g.moveTo(vx + vw / 2, vy + 4); g.lineTo(vx + vw / 2 + 2, vy + vh * 0.6); g.stroke();
        g.fillStyle = rgba(CLA, 0.8); g.beginPath(); g.moveTo(vx + 2, vy + 4); g.lineTo(vx + vw * 0.45, vy + 4); g.lineTo(vx + 3, vy + vh * 0.5); g.closePath(); g.fill();
      } else if (c < 0.72) { // tapiada con tablas
        g.fillStyle = T('#3a322b'); g.fillRect(vx + 2, vy + 4, vw - 4, vh - 5); g.strokeStyle = rgba(OSC, 0.9); g.lineWidth = 1; g.beginPath(); for (let q = 8; q < vh; q += 5) { g.moveTo(vx + 2, vy + q); g.lineTo(vx + vw - 2, vy + q + (rr() - 0.5) * 2); } g.stroke(); g.strokeStyle = T('#4a4038'); g.lineWidth = 2.5; g.beginPath(); g.moveTo(vx + 2, vy + 6); g.lineTo(vx + vw - 2, vy + vh - 3); g.stroke();
      } else if (c < 0.95) { // con marco y persiana a medias
        g.strokeStyle = mezclar(MED, CLA, 0.6); g.lineWidth = 2; g.strokeRect(vx + 2, vy + 4, vw - 4, vh - 5); const pz = (vh - 5) * (0.25 + rr() * 0.5); g.fillStyle = T('#3c3d43'); g.fillRect(vx + 2, vy + 4, vw - 4, pz); g.strokeStyle = rgba(OSC, 0.8); g.lineWidth = 1; g.beginPath(); for (let q = 3; q < pz; q += 3) { g.moveTo(vx + 2, vy + 4 + q); g.lineTo(vx + vw - 2, vy + 4 + q); } g.stroke();
      } else { // encendida, pequena
        g.fillStyle = T('#2c2618'); g.fillRect(vx + 2, vy + 4, vw - 4, vh - 5); g.fillStyle = VENTANA; g.fillRect(vx + vw / 2 - 2.5, vy + vh * 0.5, 5, vh * 0.35); luces.push([vx + vw / 2, vy + vh * 0.65, 2.2, 0.4]);
      }
      // alfeizar: repisa en medio tono y su sombra debajo; luz solo si mira al sol
      g.fillStyle = mezclar(MED, CLA, 0.5); g.fillRect(vx - 2, vy + vh, vw + 4, 2); g.fillStyle = rgba(NEG, 0.6); g.fillRect(vx - 1, vy + vh + 2, vw + 2, 2);
      if (rr() < 0.3) { g.fillStyle = rgba(LUZ, 0.6); g.fillRect(ld > 0 ? vx + vw - 4 : vx - 2, vy + vh - 0.5, 6, 1); }
      // chorretones de cada vano
      const nc = 1 + Math.floor(rr() * 3); for (let q = 0; q < nc; q++) chorreton(vx + rr() * vw, vy + vh + 3, 8 + rr() * 30, 1 + rr() * 2, MUG);
      // balcon, caja de aire o chapa parcheada
      const e = rr();
      if (e < 0.1) { g.fillStyle = SOM; g.fillRect(vx - 6, vy + vh + 2, vw + 12, 4); g.fillStyle = rgba(NEG, 0.6); g.fillRect(vx - 6, vy + vh + 6, vw + 12, 5); g.fillStyle = rgba(LUZ, 0.7); g.fillRect(ld > 0 ? vx + vw - 2 : vx - 6, vy + vh + 1, 8, 1.2); g.strokeStyle = rgba(T('#1c1c20'), 0.95); g.lineWidth = 1; g.beginPath(); g.moveTo(vx - 6, vy + vh - 10); g.lineTo(vx + vw + 6, vy + vh - 9); for (let q = vx - 5; q <= vx + vw + 6; q += 3 + rr() * 3) { g.moveTo(q, vy + vh + 2); g.lineTo(q + (rr() - 0.5), vy + vh - 10); } g.stroke(); }
      else if (e < 0.18) { const ax = vx + vw + 3; g.fillStyle = T('#45464c'); g.fillRect(ax, vy + 6, 13, 10); g.fillStyle = rgba(NEG, 0.5); g.fillRect(ax, vy + 16, 13, 3); g.strokeStyle = rgba(OSC, 0.9); g.lineWidth = 1; g.strokeRect(ax, vy + 6, 13, 10); g.beginPath(); for (let q = 2; q < 13; q += 3) { g.moveTo(ax + q, vy + 7); g.lineTo(ax + q, vy + 15); } g.stroke(); chorreton(ax + 5, vy + 16, 18 + rr() * 20, 1.5, MUG); }
      else if (e < 0.25) { const cx2 = vx - 4 + rr() * 10, cy2 = vy + vh + 4, cw = 16 + rr() * 16, ch = 10 + rr() * 12; g.fillStyle = rr() < 0.5 ? T('#3e3634') : T('#46474d'); g.fillRect(cx2, cy2, cw, ch); g.fillStyle = rgba(OX, 0.5); g.fillRect(cx2, cy2 + ch * 0.6, cw, ch * 0.4); g.strokeStyle = rgba(OSC, 0.9); g.lineWidth = 1; g.strokeRect(cx2, cy2, cw, ch); for (const [rx, ry] of [[cx2 + 2, cy2 + 2], [cx2 + cw - 2, cy2 + 2], [cx2 + 2, cy2 + ch - 2], [cx2 + cw - 2, cy2 + ch - 2]]) { g.fillStyle = OSC; g.fillRect(rx - 0.5, ry - 0.5, 1.5, 1.5); } }
    }
  });
  // cables caidos en catenaria
  if (fino) for (let k = 0; k < 1 + w / 120; k++) { const ax = x + rr() * w * 0.5, bx2 = ax + 40 + rr() * w * 0.5, ay = top + 30 + rr() * h * 0.7, by = ay + (rr() - 0.5) * 40, fl = 12 + rr() * 30; g.strokeStyle = rgba(T('#141418'), 0.9); g.lineWidth = 1; g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx2) / 2, Math.max(ay, by) + fl, bx2, by); g.stroke(); }
  // sombra plana en el lado contrario al sol (cel) y oscuro bajo el remate roto
  g.fillStyle = rgba(T('#08080a'), 0.35); g.fillRect(ld > 0 ? x : x + w - w * 0.2, top, w * 0.2, h + 10);
  for (const [a, b, yy] of bloques) { g.fillStyle = rgba(NEG, 0.35); g.fillRect(a, yy, b - a, 6); }
  g.restore();
  // ---- forjados que asoman en los mordiscos y varillas en haz
  if (fino) for (let k = 1; k < bloques.length; k++) {
    const [a0, b0, y0] = bloques[k - 1], [, , y1] = bloques[k];
    if (Math.abs(y0 - y1) < fh * 0.45) continue;
    const alto = Math.min(y0, y1), bajo = Math.max(y0, y1), sx = b0, dir = y0 < y1 ? 1 : -1;   // dir: hacia donde cae el hueco
    for (const py of pisos.map((p) => p - 4).filter((p) => p > alto + 3 && p < bajo - 2)) {
      const l = 6 + rr() * 12; g.fillStyle = SOM; g.fillRect(dir > 0 ? sx : sx - l, py, l, 4); g.fillStyle = rgba(LUZ, 0.8); g.fillRect(dir > 0 ? sx : sx - l, py - 1, l, 1); if (t) { g.strokeStyle = TINTA; g.lineWidth = t * 0.5; g.strokeRect(dir > 0 ? sx : sx - l, py - 1, l, 5); }
      const ex = sx + dir * l, n = 3 + Math.floor(rr() * 3);
      for (let q = 0; q < n; q++) { const ll = 5 + rr() * 12, a = (rr() - 0.5) * 0.9 + (rr() < 0.3 ? 0.6 : 0); linea([[ex, py + 1.5], [ex + dir * Math.cos(a) * ll, py + 1.5 + Math.sin(a) * ll], ...(rr() < 0.35 ? [[ex + dir * Math.cos(a) * ll + dir * 3, py + 1.5 + Math.sin(a) * ll + 4]] : [])], T('#1e1a18'), 1); }
    }
  }
  if (fino) for (const [a, b, yy] of bloques) if (rr() < 0.35) { const n = 2 + Math.floor(rr() * 4), px = a + rr() * (b - a); for (let q = 0; q < n; q++) { const bxx = Math.round(px + (q - n / 2) * 1.6) + 0.5, l = 6 + rr() * 14, an = -Math.PI / 2 + (q - n / 2) * 0.18 + (rr() - 0.5) * 0.3, ex = bxx + Math.cos(an) * l, ey = yy + 2 + Math.sin(an) * l; linea([[bxx, yy + 2], [ex, ey], ...(rr() < 0.3 ? [[ex + (rr() < 0.5 ? -4 : 4), ey + 2]] : [])], T('#1e1a18'), 1); } }
  // canto del sol en la fachada y el borde de arriba de los bloques que miran al sol
  { const bq = ld > 0 ? bloques[bloques.length - 1] : bloques[0]; g.fillStyle = LUZ; g.fillRect(ld > 0 ? x + w - 2.5 : x, bq[2], 2.5, base - bq[2]); }
  for (const [a, b, yy] of bloques) { g.fillStyle = rgba(LUZ, 0.85); g.fillRect(a, yy, b - a, 1.6); }
  if (t) { trazar(g, pts); tinta(g, t); }
}

// ================================================================= CASA DE MADERA, vieja
// Tablas gastadas en sombra (pardo pizarra), con huecos, una que falta y otra que se descuelga; los 15 px
// de abajo podridos; tejado combado con tejas parcheadas; chimenea torcida; el canto del sol y la cumbrera
// encendidos en 2-4 px. Luz de ventana pequena. Sin vegetacion encima: la que haya va del suelo, delante.
export function casaMadera(x, w, h, base, d, sem, o = {}) {
  const rr = azar(sem), ld = ladoLuz(x), T = (c) => tono(c, d, x), t = tk(2.6, d);
  const tinte = (c) => (o.pared ? mezclar(c, o.pared, 0.12) : c);
  const SOM = T(tinte('#2e2c1d')), SOM2 = T(tinte('#413721')), MEDm = T(tinte('#57492f')), MED = T(tinte('#7a6a49'));
  const LUZ = T('#c0a374'), PICO = T('#e3d5ad'), OSC = T('#0f0d09'), VIGA = T('#2a2216'), VIGA2 = T('#3b3020');
  const muro = [[x, base + 6], [x, base - h], [x + w, base - h], [x + w, base + 6]];
  // ---- pared de tablas horizontales
  g.save(); trazar(g, muro); g.clip();
  g.fillStyle = OSC; g.fillRect(x, base - h, w, h + 6);
  const fila = 12 + Math.floor(rr() * 3), filas = [];
  for (let y = base - h, f = 0; y < base + 6; y += fila, f++) {
    let xx = x - rr() * 30;
    while (xx < x + w) {
      const bw = 40 + rr() * 100, z = rr();
      const col = z < 0.4 ? SOM : z < 0.78 ? SOM2 : z < 0.93 ? MEDm : MED;
      // tabla con volumen: algo torcida, bisel claro arriba, cuerpo, sombra del solape abajo y testa con luz
      const sk = (rr() - 0.5) * 2.4, xe = xx + bw - 1;
      g.fillStyle = col; g.beginPath(); g.moveTo(xx, y); g.lineTo(xe, y + sk); g.lineTo(xe, y + sk + fila - 1.5); g.lineTo(xx, y + fila - 1.5); g.closePath(); g.fill();
      g.fillStyle = mezclar(col, MED, 0.55); g.beginPath(); g.moveTo(xx, y); g.lineTo(xe, y + sk); g.lineTo(xe, y + sk + 1.6); g.lineTo(xx, y + 1.6); g.closePath(); g.fill();
      g.fillStyle = rgba(OSC, 0.6); g.beginPath(); g.moveTo(xx, y + fila - 4.5); g.lineTo(xe, y + sk + fila - 4.5); g.lineTo(xe, y + sk + fila - 1.5); g.lineTo(xx, y + fila - 1.5); g.closePath(); g.fill();   // sombra del solape (plana)
      g.fillStyle = OSC; g.fillRect(xe, y, 1.5, fila); if (ld > 0) { g.fillStyle = rgba(MED, 0.8); g.fillRect(xe - 1, y + 1, 1, fila - 4); }
      g.strokeStyle = rgba(OSC, 0.5); g.lineWidth = 1; g.beginPath(); for (let q = 0; q < 2; q++) { const gy = y + 2 + rr() * (fila - 6); g.moveTo(xx + rr() * 20, gy); g.lineTo(xx + bw - rr() * 30, gy + (rr() - 0.5) * 2); } g.stroke();
      if (rr() < 0.3) { g.fillStyle = OSC; g.beginPath(); g.ellipse(xx + rr() * bw, y + fila / 2, 2.5, 1.5, 0, 0, 7); g.fill(); }  // nudo
      filas.push([xx, y, bw]);
      xx += bw;
    }
  }
  // picado de la madera
  for (let k = 0; k < (w * h) / 30; k++) { const z = rr(); g.fillStyle = z < 0.5 ? rgba(OSC, 0.5) : rgba(MED, 0.45); g.fillRect(x + rr() * w, base - h + rr() * h, 1 + rr() * 4, 1); }
  // una tabla que FALTA (se ve el hueco y un pie derecho)
  { const f = filas[Math.floor(filas.length * (0.35 + rr() * 0.3))]; if (f) { const fx = Math.max(x + 10, f[0]), fw = Math.min(f[2] * 0.7, x + w - fx - 10); g.fillStyle = OSC; g.fillRect(fx, f[1] - 1, fw, fila + 1); g.fillStyle = VIGA2; g.fillRect(fx + fw * 0.4, f[1] - 1, 6, fila + 1); g.fillStyle = rgba(LUZ, 0.5); g.fillRect(fx, f[1] + fila - 2, fw, 1); } }
  // los 15 px de abajo, podridos: borde mellado, mas oscuro, y la humedad que sube en hilos
  { g.fillStyle = rgba(T('#0a0906'), 0.62); g.beginPath(); g.rect(x, base - 12, w, 20); for (let xx = x + rr() * 20; xx < x + w; xx += 18 + rr() * 30) g.ellipse(xx, base - 12, 6 + rr() * 12, 3 + rr() * 5, 0, Math.PI, 0); g.fill(); g.fillStyle = rgba(T('#0a0906'), 0.35); for (let xx = x + rr() * 30; xx < x + w; xx += 40 + rr() * 50) { g.beginPath(); g.ellipse(xx, base - 20, 8 + rr() * 10, 5 + rr() * 6, 0, 0, 7); g.fill(); } }
  // sombra plana del alero
  g.fillStyle = rgba(T('#080705'), 0.45); g.fillRect(x, base - h, w, 9);
  // los cantos de las tablas del lado del sol se encienden
  for (const [, fy] of filas) if (rr() < 0.85) { g.fillStyle = LUZ; g.fillRect(ld > 0 ? x + w - 7 - rr() * 3 : x + 4, fy + 1, 4 + rr() * 3, fila - 4); }
  g.restore();
  // tabla descolgada: clavada por un extremo, el otro cae
  { const fy = base - h * (0.2 + rr() * 0.25), fx = ld > 0 ? x + w * 0.18 : x + w * 0.55, bw = w * 0.32, a = 0.22 + rr() * 0.15;
    g.save(); g.translate(fx, fy); g.rotate(a); g.fillStyle = SOM2; g.fillRect(0, 0, bw, fila - 2); g.fillStyle = rgba(LUZ, 0.9); g.fillRect(0, -1, bw, 1.6); if (t) { g.strokeStyle = TINTA; g.lineWidth = t * 0.55; g.strokeRect(0, 0, bw, fila - 2); } g.fillStyle = OSC; g.fillRect(2, 3, 2, 2); g.restore(); }
  // ---- postes de esquina y viga
  for (const px of [x - 5, x + w - 6]) { g.fillStyle = VIGA; g.fillRect(px, base - h, 11, h + 6); if ((ld > 0) === (px > x)) { g.fillStyle = LUZ; g.fillRect(ld > 0 ? px + 6 : px, base - h, 5, h + 6); g.fillStyle = PICO; g.fillRect(ld > 0 ? px + 9 : px, base - h, 2, h + 6); } else { g.fillStyle = VIGA2; g.fillRect(ld > 0 ? px + 8 : px, base - h, 3, h + 6); } if (t) { g.strokeStyle = TINTA; g.lineWidth = t * 0.6; g.strokeRect(px, base - h, 11, h + 6); } }
  g.fillStyle = VIGA; g.fillRect(x - 8, base - h - 3, w + 16, 10); g.fillStyle = LUZ; g.fillRect(x - 8, base - h - 4, w + 16, 1.5); if (t) { g.strokeStyle = TINTA; g.lineWidth = t * 0.6; g.strokeRect(x - 8, base - h - 3, w + 16, 10); }
  // zocalo de piedra oscura con la arista de arriba al sol
  for (let xx = x - 6; xx < x + w + 4; xx += 16 + hash(Math.floor(xx), 5) * 9) { g.beginPath(); g.ellipse(xx + 9, base + 2, 10, 6.5, 0, 0, 7); g.fillStyle = T(hash(Math.floor(xx), 6) < 0.5 ? '#3e3d35' : '#33322b'); g.fill(); if (t) { g.strokeStyle = rgba(TINTA, 0.9); g.lineWidth = t * 0.45; g.stroke(); } g.fillStyle = rgba(LUZ, 0.75); g.fillRect(xx + (ld > 0 ? 9 : 2), base - 4, 6, 1.5); }
  if (t) { trazar(g, muro); tinta(g, t); }
  // ---- tejado COMBADO a dos aguas (hastial de frente): los faldones se hunden por el medio, cada uno distinto,
  // la cumbrera se corre, y el borde de abajo cede en el centro
  const cumbre = base - h - w * 0.45, ey = base - h + 8, ax = x + w / 2 + (hash(sem, 21) - 0.5) * w * 0.06, comba = w * 0.1;
  const cmb = { '-1': comba * (0.7 + hash(sem, 22) * 0.3), 1: comba * (1.0 + hash(sem, 23) * 0.35) };
  const faldon = (s) => { const out = []; for (let k = 0; k <= 14; k++) { const u = k / 14, px = ax + s * ((s > 0 ? x + w - ax : ax - x) + 20) * u, py = cumbre + (ey - cumbre) * u + cmb[s] * Math.sin(Math.PI * u) * (1 - 0.25 * u); out.push([px, py]); } return out; };
  const izq = faldon(-1), der = faldon(1), ceder = 6 + hash(sem, 24) * 5;
  const borde = []; for (let k = 1; k < 12; k++) { const u = k / 12, px = der[14][0] + (izq[14][0] - der[14][0]) * u; borde.push([px, ey + ceder * Math.sin(Math.PI * u)]); }
  const tj = [...izq.slice().reverse(), ...der.slice(1), ...borde];
  // chimenea torcida, por detras del tejado
  if (o.chimenea !== false) {
    const chx = x + w * 0.68, chy = cumbre + (ey - cumbre) * ((chx - ax) / (x + w - ax + 20)) + 10, a = (hash(sem, 3) < 0.5 ? -1 : 1) * (0.07 + hash(sem, 4) * 0.07), cw = 20, chh = w * 0.3;
    g.save(); g.translate(chx, chy); g.rotate(a);
    // (o.chimeneaBaja: baja hasta el tejado combado; ampliada en el juego, quedaba un hueco y flotaba)
    const ext = o.chimeneaBaja ? comba * 1.6 + 14 : 0;
    g.fillStyle = T('#3a2f26'); g.fillRect(0, -chh, cw, chh + ext);
    g.strokeStyle = rgba(OSC, 0.8); g.lineWidth = 1; g.beginPath(); for (let yy = -chh + 6, f = 0; yy < ext; yy += 6, f++) { g.moveTo(0, yy); g.lineTo(cw, yy); for (let xx = (f % 2) * 5 + 5; xx < cw; xx += 10) { g.moveTo(xx, yy - 6); g.lineTo(xx, yy); } } g.stroke();
    g.fillStyle = OSC; g.fillRect(4, -chh * 0.55, 5, 4);   // ladrillo que falta
    g.fillStyle = LUZ; g.fillRect(ld > 0 ? cw - 3 : 0, -chh, 3, chh + ext);
    g.fillStyle = VIGA; g.fillRect(-3, -chh - 6, cw + 6, 6); g.fillStyle = LUZ; g.fillRect(-3, -chh - 7, cw + 6, 1.5);
    if (t) { g.strokeStyle = TINTA; g.lineWidth = t * 0.6; g.strokeRect(0, -chh, cw, chh + ext); g.strokeRect(-3, -chh - 6, cw + 6, 6); }
    if (o.humo) { for (let k = 0; k < 7; k++) { g.fillStyle = rgba(T('#9b978a'), 0.1 - k * 0.012); g.beginPath(); g.arc(cw / 2 + k * 9 + Math.sin(k) * 6, -chh - 16 - k * 26, 10 + k * 5, 0, 7); g.fill(); } }
    g.restore();
  }
  trazar(g, tj); g.fillStyle = T('#16130e'); g.fill();
  g.save(); trazar(g, tj); g.clip();
  // tejas: hiladas que se hunden con el tejado; piezas rectangulares de ancho distinto, cada una con su
  // sombra de solape; alguna corrida, alguna que falta (se ve el rastrel)
  const tejas = [T('#2c2820'), T('#38322a'), T('#463d30'), T('#24211b'), T('#3d3a35')], x0 = x - 32, x1 = x + w + 32;
  const hy = 8 + Math.floor(hash(sem, 25) * 3);
  for (let yy = cumbre + 4, f = 0; yy < ey + ceder + 12; yy += hy, f++) {
    const prof = Math.min(1, (yy - cumbre) / (ey - cumbre));
    const hund = (xx) => (comba * 0.75 * prof + ceder * prof * prof) * Math.sin(Math.PI * Math.min(1, Math.max(0, (xx - x0) / (x1 - x0))));
    let xx = x0 - hash(f, sem) * 12;
    while (xx < x1) {
      const tw = 8 + hash(Math.floor(xx), f, sem) * 9, z = hash(f, Math.floor(xx), sem + 1), yv = yy + hund(xx + tw / 2);
      const corre = z > 0.95 ? 3 : 0, tw2 = tw - 1;
      if (z < 0.05) { g.fillStyle = T('#0c0a07'); g.fillRect(xx, yv, tw2, hy + 1); g.fillStyle = T('#3b3020'); g.fillRect(xx - 1, yv + hy * 0.4, tw + 2, 2); xx += tw; continue; }
      const col = tejas[Math.floor(hash(f, Math.floor(xx), sem) * 5)];
      g.save(); if (corre) { g.translate(xx + tw / 2, yv); g.rotate(0.12); g.translate(-(xx + tw / 2), -yv); }
      g.fillStyle = col; g.fillRect(xx, yv + corre, tw2, hy + 2);
      g.fillStyle = rgba(OSC, 0.75); g.fillRect(xx, yv + corre + hy - 0.5, tw2, 2.5);        // solape
      g.fillStyle = rgba(OSC, 0.6); g.fillRect(xx + tw2, yv + corre, 1, hy + 2);              // junta
      if ((ld > 0 ? xx > ax : xx < ax) && z > 0.6) { g.fillStyle = rgba(LUZ, 0.5); g.fillRect(xx, yv + corre, tw2, 1); }
      g.restore();
      xx += tw;
    }
  }
  // parches de chapa sobre las tejas
  for (let k = 0; k < 2; k++) { const px = ax + (rr() - 0.5) * w * 0.7, py = cumbre + (ey - cumbre) * (0.4 + rr() * 0.45), pw = 22 + rr() * 22, ph = 12 + rr() * 10, a = (rr() - 0.5) * 0.4; g.save(); g.translate(px, py); g.rotate(a); g.fillStyle = T('#43444a'); g.fillRect(-pw / 2, -ph / 2, pw, ph); g.fillStyle = rgba(T('#5b3a24'), 0.5); g.fillRect(-pw / 2, 0, pw, ph / 2); g.fillStyle = rgba(LUZ, 0.6); g.fillRect(-pw / 2, -ph / 2, pw, 1.2); g.strokeStyle = TINTA; g.lineWidth = 1; g.strokeRect(-pw / 2, -ph / 2, pw, ph); for (const [rx, ry] of [[-pw / 2 + 2, -ph / 2 + 2], [pw / 2 - 2, -ph / 2 + 2], [-pw / 2 + 2, ph / 2 - 2], [pw / 2 - 2, ph / 2 - 2]]) { g.fillStyle = OSC; g.fillRect(rx - 0.7, ry - 0.7, 1.5, 1.5); } g.restore(); }
  // sombra plana del faldon contrario al sol (cel) y oscuro del alero
  g.fillStyle = rgba(T('#060504'), 0.32); g.beginPath(); g.moveTo(ax, cumbre); for (const [px, py] of (ld > 0 ? izq : der)) g.lineTo(px, py); g.lineTo(ax, ey + ceder); g.closePath(); g.fill();
  g.fillStyle = rgba(T('#080705'), 0.3); g.beginPath(); g.moveTo(izq[14][0], ey - 10); for (const [px, py] of borde.slice().reverse()) g.lineTo(px, py - 12); g.lineTo(der[14][0], ey - 10); g.lineTo(der[14][0], ey + 20); g.lineTo(izq[14][0], ey + 20); g.fill();
  g.restore();
  if (t) { trazar(g, tj); tinta(g, t * 0.6); }
  // tablas de borde (aleros) con la cumbrera y el faldon del sol encendidos en todo su largo
  for (const [lado, pts] of [[-1, izq], [1, der]]) {
    barra(pts, VIGA2, 6 * (1 - d * 0.5), d);
    if (lado === ld) { linea(pts.map(([px, py]) => [px, py - 2.4]), LUZ, 3.4); linea(pts.slice(0, 11).map(([px, py]) => [px, py - 3.4]), PICO, 1.6); }
  }
  g.fillStyle = PICO; g.beginPath(); g.arc(ax, cumbre - 2, 2.6, 0, 7); g.fill();
  // ---- ventanas: pequenas, con marco; luz de dentro en uno o dos cuarterones
  const nv = Math.max(1, Math.floor(w / 85));
  for (let k = 0; k < nv; k++) {
    const vx = Math.floor(x + w * ((k + 1) / (nv + 1)) - 13), vy = Math.floor(base - h * 0.66), vw = 26, vh = 28;
    const luz = o.luz && (k === 0 || rr() < 0.4), redonda = rr() < 0.3;
    if (redonda) { g.beginPath(); g.arc(vx + 13, vy + 13, 12, 0, 7); g.fillStyle = VIGA2; g.fill(); g.beginPath(); g.arc(vx + 13, vy + 13, 8.5, 0, 7); g.fillStyle = OSC; g.fill(); if (luz) { g.fillStyle = VENTANA; g.fillRect(vx + 13, vy + 13, 6, 6); luces.push([vx + 16, vy + 16, 2.2, 0.5]); } g.strokeStyle = VIGA2; g.lineWidth = 2; g.beginPath(); g.moveTo(vx + 4, vy + 13); g.lineTo(vx + 22, vy + 13); g.moveTo(vx + 13, vy + 4); g.lineTo(vx + 13, vy + 22); g.stroke(); if (t) { g.beginPath(); g.arc(vx + 13, vy + 13, 12, 0, 7); tinta(g, t * 0.6); } continue; }
    g.fillStyle = VIGA2; g.fillRect(vx - 4, vy - 4, vw + 8, vh + 8);
    g.fillStyle = OSC; g.fillRect(vx, vy, vw, vh);
    if (luz) { g.fillStyle = T('#4a3e27'); g.fillRect(vx, vy + vh / 2, vw / 2, vh / 2); g.fillStyle = VENTANA; g.fillRect(vx + 3, vy + vh / 2 + 4, vw / 2 - 5, vh / 2 - 6); luces.push([vx + vw / 4, vy + vh * 0.75, 2.6, 0.5]); }
    g.fillStyle = VIGA2; g.fillRect(vx + vw / 2 - 1.5, vy, 3, vh); g.fillRect(vx, vy + vh / 2 - 1.5, vw, 3);
    if (rr() < 0.5) { g.fillStyle = rgba(T('#6f6a5c'), 0.7); g.beginPath(); g.moveTo(vx + vw / 2 + 2, vy); g.lineTo(vx + vw, vy); g.lineTo(vx + vw, vy + 8); g.closePath(); g.fill(); }   // cristal roto
    g.fillStyle = VIGA; g.fillRect(vx - 7, vy + vh + 4, vw + 14, 5); g.fillStyle = LUZ; g.fillRect(vx - 7, vy + vh + 3, vw + 14, 1.5);
    if (t) { g.strokeStyle = TINTA; g.lineWidth = t * 0.6; g.strokeRect(vx - 4, vy - 4, vw + 8, vh + 8); g.strokeRect(vx - 7, vy + vh + 4, vw + 14, 5); }
    // contraventanas: una en su sitio, la otra descolgada de un gozne
    for (const s of [-1, 1]) {
      const sx = s < 0 ? vx - 18 : vx + vw + 4, cuelga = s === (k % 2 ? 1 : -1);
      g.save(); if (cuelga) { g.translate(sx + (s < 0 ? 14 : 0), vy - 4); g.rotate(s * 0.35); g.translate(-(sx + (s < 0 ? 14 : 0)), -(vy - 4)); }
      g.fillStyle = SOM2; g.fillRect(sx, vy - 4, 14, vh + 8); g.strokeStyle = rgba(OSC, 0.9); g.lineWidth = 1; g.beginPath(); for (let q = 4; q < vh + 6; q += 5) { g.moveTo(sx + 2, vy - 4 + q); g.lineTo(sx + 12, vy - 2 + q); } g.stroke();
      if (s === ld) { g.fillStyle = LUZ; g.fillRect(s > 0 ? sx + 11 : sx, vy - 4, 2.5, vh + 8); }
      if (t) { g.strokeStyle = TINTA; g.lineWidth = t * 0.55; g.strokeRect(sx, vy - 4, 14, vh + 8); }
      g.restore();
    }
    // chorreton bajo el alfeizar
    chorreton(vx + rr() * vw, vy + vh + 9, 10 + rr() * 20, 1.5, rgba(OSC, 0.5));
  }
  // ---- puerta de tablas con arco, picaporte apagado
  // (o.puertaAlto / o.puertaAncho: en el juego la casa va a escala del 18 y la puerta tiene que ser de persona)
  if (o.puerta !== false) {
    const px = x + w * 0.12, ph = o.puertaAlto ?? Math.min(80, h * 0.55), pw = o.puertaAncho ?? 34, pr = pw / 2;
    const arco = () => { g.beginPath(); g.moveTo(px, base); g.lineTo(px, base - ph + pr); g.arc(px + pr, base - ph + pr, pr, Math.PI, 0); g.lineTo(px + pw, base); g.closePath(); };
    arco(); g.fillStyle = SOM; g.fill(); g.strokeStyle = VIGA2; g.lineWidth = 6; g.stroke(); if (t) tinta(g, t * 0.7);
    g.save(); arco(); g.clip(); g.fillStyle = rgba(OSC, 0.8); for (let q = 8; q < pw; q += 8) g.fillRect(px + q, base - ph, 1.5, ph); g.fillStyle = rgba(OSC, 0.6); g.fillRect(px, base - 14, pw, 14); g.restore();
    g.fillStyle = LUZ; g.fillRect(ld > 0 ? px + pw - 1 : px - 3, base - ph + 14, 2.5, ph - 14);
    g.fillStyle = T('#6b6250'); g.beginPath(); g.arc(px + pw - 7, base - ph * 0.45, 2.2, 0, 7); g.fill();
    g.fillStyle = T('#33322b'); g.fillRect(px - 8, base - 3, pw + 16, 7); g.fillStyle = rgba(LUZ, 0.7); g.fillRect(px - 8, base - 4, pw + 16, 1.2); if (t) { g.strokeStyle = TINTA; g.lineWidth = t * 0.5; g.strokeRect(px - 8, base - 3, pw + 16, 7); }
  }
  return { cumbre };
}

// BANCO (?banco=casas): cada pieza con sus coordenadas del concepto, traida a la vista con translate
// (conserva la bruma y el lado de la luz de su sitio): la cabana y la granja (d 0), capsula con plataforma y
// escalera de la aldea (d 0), una casa de las afueras (d 0.3), edificios (d 0.3 y 0.46), una aguja (d 0.82)
export function banco() {
  const en = (dx, dy, fn) => { g.save(); g.translate(dx, dy); fn(); g.restore(); };
  en(-3300, -500, () => casaMadera(3420, 220, 160, sueloY(3530), 0, 3420, { luz: true, humo: true }));
  en(-4400, -500, () => casaMadera(4880, 240, 175, sueloY(5000), 0, 4880, { pared: '#857152', luz: true }));
  en(-4800, 0, () => { const x = 5680, b = sueloY(x); capsula(x + 10, 700, 78, 0, 5682, { ventanas: 3, puerta: true }); plataforma(x - 130, x + 150, 790, 0, 5683); escalera(x - 110, 790, b, 0); });
  en(-6000, 250, () => casaMadera(6380, 120, 200, sueloY(6440), 0.3, 6380, { pared: '#7c7466', tejado: '#45493c', luz: false, chimenea: true }));
  en(-6300, 0, () => edificio(7560, sueloY(7560), 220, 360, 0.3, 7567));
  en(-6100, 0, () => edificio(7640, 1180, 240, 760, 0.46, 7640));
  en(-6000, 0, () => aguja(8000, 1150, 700, 80, 0.82, 8000));
  estandarte(150, 900, 120, 180, 0, 5);
}
