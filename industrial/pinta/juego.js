// EL PINTOR DEL PLANO DE JUEGO: el edificio de la ventana redonda (medido en la imagen), la farola, la calle, las
// vallas, y los tramos que siguen. Todo pintado con el taller: hormigon de chapa en cel con su canto encendido por
// el contraluz, tinta, oxido pardo. Los HUECOS se recortan de verdad (destination-out) en un lienzo aparte: por ellos
// se ve la capa de detras, como en la imagen. Coordenadas del mundo con X, Y (comun.js); px, py: la imagen.
import { TINTA, azar, mezclar, rgba, trazar, tinta } from '../taller/dibujo/tinta.js';
import { g, ponerG, brillo } from '../taller/linde/base.js';
import { chapa, tubo } from '../taller/linde/metal.js';
import { armazon, escombros } from '../taller/ciudad/piezas.js';
import { X, Y, CP, px, py, YTOP } from './comun.js';
import { hormigon, telar } from './materia.js';

const chapaJ = (pts, d, sem, o = {}) => chapa(pts, d, sem, { tinte: 0.5, ...o });
const HORM = '#5c564e', HORM_OSC = '#3b3631', HIERRO = '#2f2924';
// ---------------------------------------------------------------- utiles
// pintar en un lienzo aparte (para recortar huecos sin comerse lo de detras) y posarlo
function aparte(x0, y0, x1, y1, fn) {
  const G0 = g, k = G0.getTransform().a, cx0 = X(x0), cy0 = Y(y1), cw = X(x1) - cx0, ch = Y(y0) - cy0;
  const c = new OffscreenCanvas(Math.max(1, Math.ceil(cw * k)), Math.max(1, Math.ceil(ch * k))), t = c.getContext('2d');
  t.setTransform(k, 0, 0, k, -cx0 * k, -cy0 * k); ponerG(t); fn(); ponerG(G0);
  G0.drawImage(c, cx0, cy0, cw, ch);
}
const R = (x0, y0, x1, y1) => [[X(x0), Y(y0)], [X(x0), Y(y1)], [X(x1), Y(y1)], [X(x1), Y(y0)]];
// los muros son HORMIGON (materia.js); o.juntas en px del taller como antes
function muro(x0, y0, x1, y1, sem, o = {}) { const j = o.juntas ? o.juntas.map((v) => Math.min(v / CP, 60)) : [1.2, 0.9]; hormigon(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1), sem, { ...o, col: o.col ?? '#2f2c2a', juntas: j }); }
function hueco(x0, y0, x1, y1) { g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fillRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1)); g.restore(); }
function huecoT(x0, y0, x1, y1) { hueco(x0, y0, x1, y1); telar(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1)); }
function huecoCirculo(cx, cy, r) { g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(X(cx), Y(cy), r * CP, 0, 7); g.fill(); g.restore(); }
function barra(x0, y0, x1, y1, w, col = HIERRO) { tubo([[X(x0), Y(y0)], [X(x1), Y(y1)]], w * CP, 0, X(x0), { cap: 'butt', col }); }
function canto(x, y0, y1, w = 0.03) { g.fillStyle = '#d9a66a'; g.globalAlpha = 0.7; g.fillRect(X(x) - w * CP, Y(y1), w * CP, Y(y0) - Y(y1)); g.globalAlpha = 1; }
// el marco de una ventana: perfil de hierro, montantes, travesano; un pano de vidrio sucio a veces, otro roto
function marco(h, sem, o = {}) {
  const rr = azar(sem), t = 0.05;
  if (rr() < (o.vidrio ?? 0.35)) { g.fillStyle = 'rgba(120,112,100,.32)'; g.fillRect(X(h.x), Y(h.y + h.h), h.w * CP, h.h * CP); }
  for (const [a, b] of [[[h.x, h.y], [h.x + h.w, h.y]], [[h.x, h.y + h.h], [h.x + h.w, h.y + h.h]], [[h.x, h.y], [h.x, h.y + h.h]], [[h.x + h.w, h.y], [h.x + h.w, h.y + h.h]]]) barra(a[0], a[1], b[0], b[1], t);
  const nm = o.montantes ?? (h.w > 1.1 ? 2 : 1);
  for (let k = 1; k <= nm; k++) barra(h.x + (h.w * k) / (nm + 1), h.y, h.x + (h.w * k) / (nm + 1), h.y + h.h, t * 0.8);
  const ty = h.y + h.h * (o.travesano ?? 0.62); barra(h.x, ty, h.x + h.w, ty, t * 0.8);
  if (rr() < (o.torcido ?? 0.25)) barra(h.x + h.w * 0.45, h.y + h.h * 0.1, h.x + h.w * 0.6, h.y + h.h * 0.55, t * 0.7);
}
// fachada por antepechos, dinteles y machones: pinta el muro y recorta los huecos; devuelve los huecos
function fachada(x0, x1, y0, y1, n, sem, o = {}) {
  muro(x0, y0, x1, y1, sem, o);
  const ap = o.antepecho ?? 0.55, di = o.dintel ?? 0.6, me = o.machon ?? 0.38, W = x1 - x0 - me * 2, ww = (W / n) * (o.ancho ?? 0.62), mach = (W - ww * n) / Math.max(1, n - 1), rr = azar(sem + 9), hs = [];
  for (let k = 0; k < n; k++) { if (rr() < (o.salta ?? 0)) continue; const h = { x: x0 + me + k * (ww + mach), y: y0 + ap, w: ww, h: y1 - y0 - ap - di }; huecoT(h.x, h.y, h.x + h.w, h.y + h.h); hs.push(h); }
  return hs;
}
function losa(x0, x1, y, grosor, sem) {
  hormigon(X(x0), Y(y), X(x1) - X(x0), grosor * CP, sem, { col: '#262322', juntas: [1.6, 99], berenjenos: false, sucio: 0, grietas: 1 });
  g.fillStyle = '#e0ab6e'; g.globalAlpha = 0.85; g.fillRect(X(x0), Y(y), X(x1) - X(x0), 2.6); g.globalAlpha = 1;
  // la sombra que echa el forjado sobre lo de debajo
  const sg = g.createLinearGradient(0, Y(y - grosor), 0, Y(y - grosor - 0.45)); sg.addColorStop(0, 'rgba(8,7,6,.6)'); sg.addColorStop(1, 'rgba(8,7,6,0)'); g.fillStyle = sg; g.fillRect(X(x0), Y(y - grosor), X(x1) - X(x0), 0.45 * CP);
}
function pilar(x0, x1, y0, y1, sem) { hormigon(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1), sem, { col: '#2b2826', juntas: [99, 1.1], berenjenos: false, grietas: 0 }); }
function barandilla(x0, x1, y, alto, o = {}) {
  const paso = o.paso ?? 0.3, rr = azar(Math.round(x0 * 31));
  for (let x = x0; x <= x1 + 1e-3; x += paso) { const dob = rr() < 0.08 ? (rr() - 0.5) * 0.15 : 0; barra(x, y, x + dob, y + alto, 0.032); }
  barra(x0, y + alto, x1, y + alto + (rr() - 0.5) * 0.03, 0.04); barra(x0, y + alto * 0.5, x1, y + alto * 0.5, 0.025);
}
function escalera(x, y0, y1, ancho = 0.3, jaula = false) {
  barra(x - ancho / 2, y0, x - ancho / 2, y1, 0.035); barra(x + ancho / 2, y0, x + ancho / 2, y1, 0.035);
  for (let y = y0 + 0.2; y < y1; y += 0.28) barra(x - ancho / 2, y, x + ancho / 2, y, 0.025);
  if (jaula) for (let y = y0 + 2.2; y < y1; y += 0.9) { g.strokeStyle = HIERRO; g.lineWidth = 0.025 * CP; g.beginPath(); g.ellipse(X(x), Y(y), ancho * 0.75 * CP, 0.06 * CP, 0, Math.PI, 0); g.stroke(); }
  canto(x + ancho / 2 + 0.017, y0, y1, 0.012);
}
function tuberia(pts, r) { tubo(pts.map(([x, y]) => [X(x), Y(y)]), r * 2 * CP, 0, X(pts[0][0]), { col: '#3a2f27' }); }
// ARBUSTO seco, ENREDADERA y RAMAS (las del lienzo de vegetacion.js, pintadas aqui en su sitio)
const SECO = { tallo: '#14110d', canto: 'rgba(214,170,110,.6)', hoja: '#1e1b12', hoja2: '#2b2616', hojaSeca: '#5a4a28' };
function rama(x, y, ang, largo, grueso, prof, rr, o) {
  const pasos = 6; let qx = x, qy = y, a = ang; const pts = [[qx, qy]];
  for (let k = 0; k < pasos; k++) { a += (rr() - 0.5) * 0.35 + (o.cae || 0) * 0.04; qx += Math.cos(a) * largo / pasos; qy += Math.sin(a) * largo / pasos; pts.push([qx, qy]); }
  g.strokeStyle = o.tallo; g.lineWidth = grueso; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke();
  if (o.canto) { g.strokeStyle = o.canto; g.lineWidth = Math.max(1, grueso * 0.3); g.beginPath(); g.moveTo(pts[0][0] + grueso * 0.3, pts[0][1] - grueso * 0.2); for (const p of pts) g.lineTo(p[0] + grueso * 0.3, p[1] - grueso * 0.2); g.stroke(); }
  if (prof > 0) for (let k = 0; k < 1 + Math.floor(rr() * 2.4); k++) { const [hx, hy] = pts[2 + Math.floor(rr() * (pasos - 2))]; rama(hx, hy, a + (rr() < 0.5 ? -1 : 1) * (0.4 + rr() * 0.6), largo * (0.5 + rr() * 0.25), grueso * 0.62, prof - 1, rr, o); }
  if (prof <= 1) for (let k = 0; k < (o.hojas ?? 7); k++) { const [hx, hy] = pts[Math.floor((0.3 + rr() * 0.7) * pasos)]; hoja(hx + (rr() - 0.5) * 8, hy + (rr() - 0.5) * 8, (o.tamHoja || 7) * (0.6 + rr() * 0.7), rr() * 6.28, rr, o); }
}
function hoja(x, y, s, a, rr, o) { g.save(); g.translate(x, y); g.rotate(a); const z = rr(); g.fillStyle = z < 0.6 ? o.hoja : z < 0.85 ? o.hoja2 : o.hojaSeca; g.beginPath(); g.ellipse(0, 0, s, s * 0.45, 0, 0, 7); g.fill(); if (o.canto && rr() < 0.5) { g.fillStyle = o.canto; g.beginPath(); g.ellipse(s * 0.2, -s * 0.2, s * 0.5, s * 0.18, 0, 0, 7); g.fill(); } g.restore(); }
export function mata(x, y, w, h, sem, o = {}) {
  const rr = azar(sem), O = { ...SECO, ...o }, n = Math.round(4 + w * 4);
  for (let k = 0; k < n; k++) rama(X(x - w * 0.3 + rr() * w * 0.6), Y(y), -Math.PI / 2 + (rr() - 0.5) * 1.5, h * CP * (0.45 + rr() * 0.5), (3 + rr() * 3) * CP / 160, 2, rr, { ...O, tamHoja: 7 * CP / 160 });
}
export function enredadera(x, y, w, h, sem) {
  const rr = azar(sem), n = Math.round(3 + w * 3);
  for (let k = 0; k < n; k++) {
    let qx = X(x - w / 2 + rr() * w), qy = Y(y); const largo = h * CP * (0.35 + rr() * 0.65), pasos = 18, pts = [];
    g.strokeStyle = SECO.tallo; g.lineWidth = (2 + rr() * 2) * CP / 160; g.beginPath(); g.moveTo(qx, qy);
    for (let q = 0; q < pasos; q++) { qx += Math.sin(q * 0.7 + k) * 4 + (rr() - 0.5) * 3; qy += largo / pasos; g.lineTo(qx, qy); pts.push([qx, qy]); }
    g.stroke();
    for (const [hx, hy] of pts) if (rr() < 0.65) hoja(hx + (rr() - 0.5) * 10, hy, (6 + rr() * 6) * CP / 160, rr() * 6.28, rr, { ...SECO, hojaSeca: '#6a5730' });
  }
}
function ramas(x, y, w, h, sem, desde) {
  const rr = azar(sem), x0 = desde === 'derecha' ? X(x + w / 2) : X(x - w / 2), a0 = desde === 'derecha' ? Math.PI * 0.85 : 0.15;
  for (let k = 0; k < 3; k++) rama(x0, Y(y + h / 2) + h * CP * (0.05 + k * 0.08), a0 + (rr() - 0.5) * 0.5, w * CP * (0.6 + rr() * 0.3), (9 - k * 2) * CP / 160, 3, rr, { ...SECO, hojas: 2, cae: 1, tamHoja: 7 * CP / 160 });
}
function valla(x0, x1, alto, sem, roto) {
  const p = 0.11 * CP, x0p = X(x0), x1p = X(x1), yb = Y(0), yt = Y(alto);
  g.save(); g.beginPath(); g.rect(x0p, yt, x1p - x0p, yb - yt); g.clip();
  if (roto) { g.beginPath(); g.rect(x0p, yt, x1p - x0p, yb - yt); g.ellipse(X(x0 + (x1 - x0) * roto[0]), Y(alto * (1 - roto[1])), (x1 - x0) * 0.12 * CP, alto * 0.2 * CP, 0.3, 0, 7, true); g.clip('evenodd'); }
  g.strokeStyle = 'rgba(22,20,18,.9)'; g.lineWidth = 1.6;
  for (let x = x0p - (yb - yt); x < x1p + (yb - yt); x += p) { g.beginPath(); g.moveTo(x, yt); g.lineTo(x + (yb - yt), yb); g.stroke(); g.beginPath(); g.moveTo(x, yb); g.lineTo(x + (yb - yt), yt); g.stroke(); }
  g.restore();
  const n = Math.max(1, Math.round((x1 - x0) / 1.1)); for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n; barra(x, 0, x, alto + 0.05, 0.06); }
  barra(x0, alto, x1, alto, 0.04);
}
function bolardo(x) { tubo([[X(x - 0.14), Y(0)], [X(x - 0.14), Y(0.28)], [X(x - 0.1), Y(0.33)], [X(x + 0.1), Y(0.33)], [X(x + 0.14), Y(0.28)], [X(x + 0.14), Y(0)]], 0.1 * CP, 0, X(x), { col: '#3a2f27' }); }
function cajon(x, w, h) { chapaJ(R(x - w / 2, 0, x + w / 2, h), 0, Math.round(x * 13), { col: '#4a3d33', remaches: 0.12 * CP }); chapaJ(R(x - w * 0.54, h, x + w * 0.54, h + 0.05), 0, Math.round(x * 17), { liso: true, col: '#3a3029' }); }
function cartel(x, y, w, h, l1, l2) {
  chapaJ(R(x - w / 2, y - h / 2, x + w / 2, y + h / 2), 0, Math.round(x * 7), { liso: true, col: '#4a4640' });
  g.strokeStyle = TINTA; g.lineWidth = 2; g.strokeRect(X(x - w / 2) + 4, Y(y + h / 2) + 4, w * CP - 8, h * CP - 8);
  g.fillStyle = '#8a8274'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(h * CP * 0.26)}px Georgia`; g.fillText(l1, X(x), Y(y + h * 0.12));
  if (l2) { g.font = `${Math.round(h * CP * 0.18)}px Georgia`; g.fillText(l2, X(x), Y(y - h * 0.22)); }
}
// la luz de una fuente que tine lo que tiene alrededor (despues de pintarlo)
function bano(x, y, r, col, a) { g.save(); g.globalCompositeOperation = 'lighter'; brillo(X(x), Y(y), r * CP, col, a); g.restore(); }

// ---------------------------------------------------------------- la VENTANA REDONDA: el fuego, el muro, los anillos
function ventanaRedonda(cx, cy, R0, caja, sem) {
  // el fuego de dentro (se pinta antes: el muro con el hueco va encima)
  const gr = g.createRadialGradient(X(cx), Y(cy), 0, X(cx), Y(cy), R0 * CP);
  gr.addColorStop(0, '#fff2d0'); gr.addColorStop(0.35, '#ffc77a'); gr.addColorStop(0.75, '#f28a32'); gr.addColorStop(1, '#a8460f');
  g.beginPath(); g.arc(X(cx), Y(cy), R0 * CP, 0, 7); g.fillStyle = gr; g.fill();
  // las aspas de detras del vidrio (el ventilador): mas oscuras hacia fuera
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.5; g.fillStyle = 'rgba(150,60,15,.45)'; g.beginPath(); g.moveTo(X(cx), Y(cy)); g.arc(X(cx), Y(cy), R0 * CP * 0.95, a, a + 0.32); g.closePath(); g.fill(); }
  aparte(caja[0], caja[2], caja[1], caja[3], () => { muro(caja[0], caja[2], caja[1], caja[3], sem, { juntas: [0.9 * CP, 0.8 * CP] }); huecoCirculo(cx, cy, R0); });
  // el marco cuadrado, los dos anillos, los radios y la cruz
  for (const [a, b] of [[[cx - R0 * 1.2, cy - R0 * 1.2], [cx + R0 * 1.2, cy - R0 * 1.2]], [[cx - R0 * 1.2, cy + R0 * 1.2], [cx + R0 * 1.2, cy + R0 * 1.2]], [[cx - R0 * 1.2, cy - R0 * 1.2], [cx - R0 * 1.2, cy + R0 * 1.2]], [[cx + R0 * 1.2, cy - R0 * 1.2], [cx + R0 * 1.2, cy + R0 * 1.2]]]) barra(a[0], a[1], b[0], b[1], 0.11);
  for (const [r, w] of [[R0, 0.13], [R0 * 0.32, 0.08]]) { g.beginPath(); g.arc(X(cx), Y(cy), r * CP, 0, 7); g.strokeStyle = TINTA; g.lineWidth = w * CP + 3; g.stroke(); g.strokeStyle = '#2a211b'; g.lineWidth = w * CP; g.stroke(); g.strokeStyle = 'rgba(255,190,120,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(X(cx), Y(cy), r * CP - w * CP * 0.3, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; barra(cx + Math.cos(a) * R0 * 0.32, cy + Math.sin(a) * R0 * 0.32, cx + Math.cos(a) * R0 * 0.97, cy + Math.sin(a) * R0 * 0.97, k % 2 ? 0.035 : 0.065); }
  barra(cx - R0, cy, cx + R0, cy, 0.08); barra(cx, cy - R0, cx, cy + R0, 0.08);
}

// ================================================================= 0 · LA IMAGEN
function referencia() {
  const X0 = px(50), X1 = px(640);
  // A · la pared del fondo (a oscuras, con sus huecos: por ellos sigue la ciudad)
  aparte(X0, 0, X1, py(240), () => {
    muro(X0 + 0.2, 0, X1 - 0.2, py(240), 13, { col: '#1c1a18' });
    for (const [x, y, w, h] of [[px(125), py(720), 1.0, 1.2], [px(285), py(720), 0.5, 1.2], [px(360), py(720), 0.5, 1.2], [px(125), py(420), 0.85, 1.25], [px(210), py(420), 0.4, 1.25], [px(285), py(420), 0.45, 1.25], [px(355), py(420), 0.5, 1.25]]) huecoT(x, y, x + w, y + h);
  });
  // B · la torre de arriba, detras del balcon, con sus tuberias y la escalera
  aparte(px(180), py(212), px(430), YTOP + 0.3, () => { muro(px(180), py(212), px(430), YTOP + 0.3, 21, { col: '#24211f' }); for (const [x, y] of [[px(200), py(212) + 0.45], [px(330), py(212) + 0.45], [px(200), py(212) + 1.85], [px(330), py(212) + 1.85]]) huecoT(x, y, x + 0.55, y + 0.95); });
  for (const [x, y] of [[px(200), py(212) + 0.45], [px(330), py(212) + 0.45], [px(200), py(212) + 1.85], [px(330), py(212) + 1.85]]) marco({ x, y, w: 0.55, h: 0.95 }, Math.round(x * 9 + y), { montantes: 1 });
  tuberia([[px(212), py(212)], [px(212), YTOP + 0.3]], 0.06);
  tuberia([[px(390), py(212)], [px(390), py(120)], [px(352), py(90)], [px(352), YTOP + 0.3]], 0.05);
  escalera(px(232), py(212), YTOP + 0.3, 0.32);
  // C · el bloque de la ventana redonda, su losa y su escalera
  ventanaRedonda(px(515), py(137), 0.8, [px(435), px(645), py(258), YTOP + 0.3], 31);
  tuberia([[px(470), py(258)], [px(470), py(330)], [px(520), py(360)], [px(520), py(480)]], 0.05);
  escalera(px(633), py(250), YTOP + 0.3, 0.28);
  losa(px(430), px(652), py(228), 0.36, 33);
  // D · la planta baja: el muro con sus cuatro ventanales (huecos) y sus marcos
  let hs = [];
  aparte(X0, 0, X1, py(500), () => { hs = fachada(X0, X1, 0, py(500), 4, 3, { antepecho: 0.55, dintel: 0.62, ancho: 0.62 }); });
  hs.forEach((h, k) => marco(h, 40 + k, { vidrio: 0.25 }));
  // E · pilares, forjados y barandillas
  for (const [xa, xb, y1] of [[px(245), px(275), py(232)], [px(405), px(440), py(232)], [px(598), px(628), py(258)], [px(85), px(120), py(232)]]) pilar(xa, xb, xa === px(85) ? py(505) : 0, y1, Math.round(xa * 10));
  losa(X0 - 0.15, X1 + 0.15, py(490), 0.34, 51);
  barandilla(X0 + 0.15, px(440), py(490), 0.42);
  losa(X0 - 0.1, px(448), py(212), 0.42, 53);
  barandilla(X0 + 0.15, px(440), py(212), 0.36);
  barra(px(440), py(300), px(600), py(300), 0.12);
  // el mastil de la izquierda y sus cables
  tubo([[X(px(108)), Y(py(212))], [X(px(108)), Y(YTOP + 0.3)]], 0.14 * CP, 0, X(px(108)), { cap: 'butt' });
  for (const [a, b, c] of [[[px(108), py(40)], [px(-120), py(120)], 0.5], [[px(108), py(75)], [px(-120), py(170)], 0.6], [[px(108), py(60)], [px(300), py(110)], 0.35]]) { g.beginPath(); g.moveTo(X(a[0]), Y(a[1])); g.quadraticCurveTo((X(a[0]) + X(b[0])) / 2, (Y(a[1]) + Y(b[1])) / 2 + c * CP * 2, X(b[0]), Y(b[1])); g.strokeStyle = '#100e0c'; g.lineWidth = 2.6; g.stroke(); }
  escalera(px(65), py(780), py(160), 0.3, true);
  // F · vegetacion: matas en los balcones, enredaderas, ramas arriba
  for (const [xx, yy, w, h, s] of [[150, 212, 0.75, 0.6, 1], [360, 212, 1.0, 0.7, 2], [165, 490, 0.7, 0.55, 3], [430, 395, 0.6, 0.5, 4]]) mata(px(xx), py(yy), w, h, s);
  enredadera(px(428), py(240), 0.55, 3.0, 21); enredadera(px(165), py(500), 0.5, 1.6, 22);
  ramas(px(700), py(60), 1.6, 1.6, 23, 'derecha'); ramas(px(20), py(20), 1.2, 1.0, 24);
  // G · la luz naranja de la ventana sobre lo que tiene alrededor
  bano(px(515), py(137), 2.6, '#ff8a3a', 0.3); bano(px(515), py(200), 1.4, '#ffb070', 0.18);
  // H · la derecha: el edificio oscuro, sus balcones, el armario con barandilla, el poste con su cartel
  const XD = px(1555);
  muro(XD, 0, XD + 3, YTOP + 0.3, 61, { col: '#141312', juntas: [1.0 * CP, 1.4 * CP], luz: -1 });
  canto(XD + 0.04, 0, YTOP, 0.025);
  for (const [y, x0, x1] of [[py(298), XD - 0.6, XD + 0.5], [py(60), XD - 0.15, XD + 1.5], [py(150), XD - 0.15, XD + 1.5], [py(640), XD - 0.35, XD + 0.3]]) { losa(x0, x1, y, 0.18, Math.round(y * 10)); barandilla(x0 + 0.05, x1 - 0.05, y, 0.5); }
  escalera(XD - 0.15, py(640), YTOP + 0.3, 0.28);
  tuberia([[XD + 0.15, 0.3], [XD + 0.15, py(480)], [XD - 0.3, py(450)], [XD - 0.3, py(300)]], 0.05);
  chapaJ(R(px(1445), py(600), px(1505), py(520)), 0, 71, { col: '#3b332c', remaches: 0.1 * CP }); losa(px(1440), px(1555), py(600), 0.1, 72);
  barandilla(px(1440), px(1520), py(520), 0.32, { paso: 0.18 });
  barra(px(1395), py(590), px(1450), py(590), 0.06); barra(px(1395), 0, px(1395), py(585), 0.1);
  cartel(px(1383), py(658), px(1415) - px(1350), py(615) - py(700), 'ZONA', 'B · 17');
  valla(px(1342), px(1560), 1.25, 1, [0.3, 0.4]); valla(px(-10), px(78), 1.55, 2);
  for (const xx of [1162, 1197]) bolardo(px(xx));
  cajon(px(1262), 0.6, 0.48);
  barandilla(px(125), px(195), 0, 0.62, { paso: 0.17 });
  mata(px(440), 0, 1.6, 0.8, 5); mata(px(690), 0, 0.7, 0.35, 6);
}

// ================================================================= EDIFICIO DE MARCO (la familia del de la imagen)
function edificioMarco(x0, x1, o = {}) {
  const rr = azar(o.sem ?? Math.round(x0 * 17)), pb = o.planta ?? 3.4, fh = o.piso ?? 2.7, n = o.pisos ?? 3, techo = pb + n * fh;
  // el fondo (a oscuras, con huecos) y la planta baja con sus ventanales
  aparte(x0, 0, x1, techo, () => { muro(x0 + 0.2, 0, x1 - 0.2, techo, Math.round(x0 * 3), { col: '#1c1a18' }); for (let p = 0; p <= n; p++) { const y0 = p === 0 ? 0 : pb + (p - 1) * fh, y1 = p === 0 ? pb : pb + p * fh; for (let x = x0 + 0.6; x < x1 - 0.9; x += 1.4 + rr() * 0.6) if (rr() < 0.75) huecoT(x, y0 + 0.5, x + 0.6 + rr() * 0.4, y1 - 0.5); } });
  let hs = [];
  aparte(x0, 0, x1, pb, () => { hs = fachada(x0, x1, 0, pb, Math.max(2, Math.round((x1 - x0) / 1.7)), Math.round(x0 * 7)); });
  hs.forEach((h, k) => marco(h, Math.round(x0 * 11) + k));
  // las plantas altas: abiertas, con marcos sueltos en la de atras, pilares y forjados que vuelan
  const pil = []; for (let x = x0; x <= x1 - 0.3; x += (x1 - x0 - 0.35) / Math.max(1, Math.round((x1 - x0) / 2.6))) pil.push(x);
  for (const x of pil) pilar(x, x + 0.34, 0, techo, Math.round(x * 13));
  for (let p = 0; p <= n; p++) {
    const y = pb + p * fh;
    losa(x0 - 0.2, x1 + 0.2, y + 0.34, 0.34, Math.round(x0 * 5 + p));
    if (p < n || rr() < 0.5) barandilla(x0 + 0.15, x1 - 0.15, y + 0.34, 0.42);
    if (p === n) break;
    if (rr() < 0.5) mata(x0 + 0.6 + rr() * (x1 - x0 - 1.2), y + 0.34, 0.7 + rr() * 0.4, 0.5 + rr() * 0.3, Math.round(x0 * 3 + p));
    if (rr() < 0.45) enredadera(x0 + 0.5 + rr() * (x1 - x0 - 1), y, 0.5, 1.2 + rr() * 1.8, Math.round(x0 * 5 + p));
  }
  // remate: un pretil roto, la tuberia y la escalera de gato
  muro(x0, techo + 0.34, x1, techo + 1.2, Math.round(x0 * 9), { col: '#36312c', juntas: [1.4 * CP, 99 * CP], berenjenos: false });
  for (let x = x0 + 0.3; x < x1; x += 0.7 + rr()) if (rr() < 0.4) hueco(x, techo + 0.9, x + 0.3, techo + 1.25);
  tuberia([[x0 + 0.6, techo], [x0 + 0.6, 0.4]], 0.055);
  if (rr() < 0.7) escalera(rr() < 0.5 ? x0 - 0.15 : x1 + 0.15, 0.6, techo, 0.3, true);
  if (o.cartel) cartel((x0 + x1) / 2, pb + 0.9, 2.2, 0.7, 'ALMACEN 4', '');
  return techo;
}

// ================================================================= 1 · LOS DEPOSITOS
function planta(x0, x1) {
  const rr = azar(301);
  for (const [cx, r, h] of [[x0 + 4.5, 2.3, 6.4], [x0 + 10.5, 1.7, 4.8]]) {
    hormigon(X(cx - r), Y(h), 2 * r * CP, h * CP, Math.round(cx * 7), { col: '#2a2420', juntas: [r * 0.5, 1.1], berenjenos: false, oxido: 0.55, grietas: 0 });
    remaches(cx - r, cx + r, h, 1.1);
    // el volumen del cilindro: sombra a la izquierda, el canto calido a la derecha
    g.save(); trazar(g, R(cx - r, 0, cx + r, h)); g.clip();
    const gr = g.createLinearGradient(X(cx - r), 0, X(cx + r), 0); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0)'); gr.addColorStop(0.9, 'rgba(255,170,100,.12)'); gr.addColorStop(1, 'rgba(255,190,120,.35)');
    g.fillStyle = gr; g.fillRect(X(cx - r), Y(h), 2 * r * CP, h * CP); g.restore();
    g.beginPath(); g.ellipse(X(cx), Y(h), r * CP, 0.3 * CP, 0, Math.PI, 0); g.fillStyle = '#2c2621'; g.fill(); tinta(g, 2);
    for (let y = 0.4, s = 1; y < h - 0.5; y += 1.1, s = -s) barra(cx - s * r * 0.7, y, cx + s * r * 0.7, y + 1.1, 0.06);
    barandilla(cx - r * 0.8, cx + r * 0.8, h + 0.05, 0.5);
  }
  const yT = 4.3;
  for (let x = x0 + 1; x <= x1 - 1; x += 4.6) { chapaJ(R(x - 0.11, 0, x + 0.11, yT), 0, Math.round(x * 3), { col: HIERRO, liso: true }); barra(x - 0.7, yT, x + 0.7, yT, 0.12); }
  for (const [dy, r] of [[0.24, 0.14], [0.2, 0.1], [0.27, 0.17]]) tuberia([[x0 - 1, yT + dy + r], [x1 + 1, yT + dy + r]], r);
  tuberia([[x0 + 7.5, yT + 0.4], [x0 + 7.5, 1.4], [x0 + 6.6, 1.4], [x0 + 6.6, 0.6]], 0.09);
  g.beginPath(); g.arc(X(x0 + 7.5), Y(2.1), 0.22 * CP, 0, 7); g.strokeStyle = TINTA; g.lineWidth = 7; g.stroke(); g.strokeStyle = '#3a2f27'; g.lineWidth = 4; g.stroke();
  // la caseta de control con su ventana encendida
  muro(x1 - 5.8, 0, x1 - 3.2, 2.6, 311, { col: '#2f2c29' }); losa(x1 - 5.95, x1 - 3.05, 2.7, 0.12, 312);
  g.fillStyle = '#ffc07a'; g.fillRect(X(x1 - 5.0), Y(2.1), 0.9 * CP, 1.0 * CP); g.fillStyle = 'rgba(80,40,10,.45)'; g.fillRect(X(x1 - 5.0), Y(1.55), 0.9 * CP, 0.45 * CP);
  marco({ x: x1 - 5.0, y: 1.1, w: 0.9, h: 1.0 }, 313, { vidrio: 0 }); bano(x1 - 4.55, 1.6, 1.6, '#ffb46a', 0.3);
  for (let k = 0; k < 3; k++) mata(x0 + 2 + rr() * (x1 - x0 - 4), 0, 0.8 + rr() * 0.6, 0.4 + rr() * 0.3, 300 + k);
  cajon(x0 + 13.6, 0.7, 0.55); cajon(x0 + 14.4, 0.5, 0.4);
}

// ================================================================= 3 · EL DERRUMBE
// los remaches de una chapa: filas en las juntas de arriba abajo
function remaches(x0, x1, alto, paso) {
  g.fillStyle = '#0d0b09';
  for (let y = paso; y < alto - 0.1; y += paso) for (let x = x0 + 0.08; x < x1 - 0.05; x += 0.13) { g.beginPath(); g.arc(X(x), Y(y) + 6, 2.3, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(200,160,110,.35)'; for (let y = paso; y < alto - 0.1; y += paso) for (let x = x0 + 0.08; x < x1 - 0.05; x += 0.13) g.fillRect(X(x) - 1, Y(y) + 3.5, 2, 1.2);
}
// el ESQUELETO del derrumbe: pilares de distinta altura, forjados partidos con la ferralla al aire, un trozo de muro
// con sus huecos que queda en pie y una losa que cuelga de un pilar
function esqueleto(x0, x1, sem) {
  const rr = azar(sem), fh = 2.6, n = Math.round((x1 - x0) / 1.8);
  aparte(x0, 0, x0 + 2.2, 4.6, () => { muro(x0, 0, x0 + 2.2, 4.6, sem, { col: '#38332e' }); huecoT(x0 + 0.4, 0.7, x0 + 1.5, 2.1); huecoT(x0 + 0.4, 3.0, x0 + 1.1, 4.1); hueco(x0 + 1.4, 3.6, x0 + 2.3, 4.7); });
  const hs = [];
  for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0 - 0.4) * k) / n, h = k === n ? 2.4 + rr() : fh * 2 + 0.3 - (k % 2) * rr() * 1.4; pilar(x, x + 0.4, 0, h, sem + k); hs.push([x, h]); for (let q = 0; q < 4; q++) barra(x + 0.06 + q * 0.09, h, x + q * 0.11 + (rr() - 0.5) * 0.3, h + 0.3 + rr() * 0.5, 0.02); }
  for (let p = 1; p <= 2; p++) {
    const y = fh * p, a = x0 - 0.3, b = p === 1 ? x1 - 1.1 : x0 + (x1 - x0) * 0.55;
    losa(a, b, y, 0.3, sem + 10 + p);
    for (let q = 0; q < 6; q++) barra(b, y - 0.05 - q * 0.04, b + 0.25 + rr() * 0.5, y - 0.15 - q * 0.04 - rr() * 0.4, 0.018);
    if (p === 1) barandilla(a + 0.2, b - 0.3, y, 0.4);
  }
  g.save(); g.translate(X(x1 - 1.1), Y(fh)); g.rotate(1.05); hormigon(0, -0.15 * CP, 2.4 * CP, 0.3 * CP, sem + 20, { col: '#47413a', juntas: [1.2, 99], berenjenos: false, sucio: 0 }); g.restore();
}
function ruina(x0, x1) {
  const rr = azar(503);
  esqueleto(x0 + 8.5, x0 + 14, 5031);
  for (let x = x0 + 0.8; x < x1 - 1; x += 2.2 + rr() * 1.2) { if (x > x0 + 8 && x < x0 + 14.5) continue; const h = 1.5 + rr() * 6.5; pilar(x, x + 0.38, 0, h, Math.round(x * 5)); for (let q = 0; q < 4; q++) barra(x + 0.05 + q * 0.09, h, x + q * 0.12 + (rr() - 0.5) * 0.3, h + 0.4 + rr() * 0.5, 0.02); }
  for (let k = 0; k < 4; k++) { const cx = x0 + 3 + k * 4 + rr(), w = 3 + rr() * 2.5, a = (rr() - 0.5) * 0.9, cy = 0.9 + rr() * 2.6; g.save(); g.translate(X(cx), Y(cy)); g.rotate(-a); hormigon(-w * CP / 2, -0.16 * CP, w * CP, 0.32 * CP, 5040 + k, { col: '#4a443d', juntas: [1.4, 99], berenjenos: false, sucio: 0 }); for (let q = 0; q < 5; q++) { const s = q % 2 ? 1 : -1; tubo([[s * w * CP / 2, (q - 2) * 0.05 * CP], [s * (w / 2 + 0.25 + rr() * 0.3) * CP, (q - 2) * 0.07 * CP + (rr() - 0.3) * 0.2 * CP]], 0.025 * CP, 0, X(cx), { col: '#3a2f27' }); } g.restore(); }
  escombros(X(x0), X(x1), Y(0) + 6, 0, 5050, { alto: 0.6 * CP });
  mata(x0 + 6, 0, 3.2, 4.6, 521, { hojas: 1 });
  for (let k = 0; k < 4; k++) mata(x0 + 1 + rr() * (x1 - x0 - 2), 0, 0.6 + rr() * 0.6, 0.35 + rr() * 0.3, 530 + k);
}

// ================================================================= 4 · LA PASARELA CUBIERTA
function pasarela(x0, x1) {
  edificioMarco(x0 + 0.5, x0 + 7.5, { pisos: 3, sem: 61 });
  edificioMarco(x1 - 7.5, x1 - 0.5, { pisos: 2, sem: 62, planta: 3.0, piso: 2.9 });
  const pa = x0 + 7.5, pb = x1 - 7.5, y0 = 5.2, y1 = 6.9;
  let hs = [];
  aparte(pa, y0, pb, y1, () => { hs = fachada(pa, pb, y0, y1, Math.round((pb - pa) / 1.1), 63, { antepecho: 0.42, dintel: 0.22, machon: 0.15, col: '#2f2b28' }); });
  hs.forEach((h, k) => { if (k === 3) { g.fillStyle = '#ffc58a'; g.fillRect(X(h.x), Y(h.y + h.h), h.w * CP, h.h * CP); bano(h.x + h.w / 2, h.y + h.h / 2, 1.4, '#ffb46a', 0.25); } marco(h, 630 + k, { montantes: 1 }); });
  losa(pa - 0.2, pb + 0.2, y0 + 0.1, 0.2, 641); losa(pa - 0.2, pb + 0.2, y1 + 0.08, 0.16, 642);
  for (let x = pa, k = 0; x < pb; x += 0.7, k++) { barra(x, y0 - 0.45, x + 0.35, y0 - 0.03, 0.03); barra(x + 0.35, y0 - 0.03, x + 0.7, y0 - 0.45, 0.03); }
  barra(pa, y0 - 0.45, pb, y0 - 0.45, 0.05);
  cajon(pa + 1.2, 0.6, 0.5); bolardo(pb - 1);
}

// ================================================================= 5 · EL PATIO DE CARGA
function patio(x0, x1) {
  const rr = azar(707);
  valla(x0 + 0.4, x0 + 5, 1.6, 71, [0.4, 0.5]);
  { const cx = x0 + 7.5, w = 5.2, h = 2.4; chapaJ(R(cx - w / 2, 0, cx + w / 2, h), 0, 7101, { col: '#5a4232', juntas: [0.16 * CP, 999], juntaLuz: true }); g.fillStyle = 'rgba(0,0,0,.35)'; for (let x = cx - w / 2 + 0.08; x < cx + w / 2; x += 0.16) g.fillRect(X(x), Y(h - 0.05), 2.4, (h - 0.1) * CP); chapaJ(R(cx + w / 2, 0, cx + w / 2 + 0.5, h), 0, 7102, { col: '#4a3628' }); }
  for (const [x, w, h, y] of [[x0 + 11, 0.9, 0.8, 0], [x0 + 11.95, 0.8, 0.7, 0], [x0 + 11.4, 0.85, 0.7, 0.8]]) chapaJ(R(x - w / 2, y, x + w / 2, y + h), 0, Math.round(x * 11 + y), { col: '#4a3d33', remaches: 0.14 * CP });
  { const cx = x0 + 15.5; muro(cx - 2.1, 0.45, cx - 0.7, 1.95, 7201, { col: '#3a3632' }); g.fillStyle = 'rgba(140,150,150,.3)'; g.fillRect(X(cx - 1.6), Y(1.8), 0.7 * CP, 0.5 * CP); chapaJ(R(cx - 0.8, 0.45, cx + 2.6, 2.25), 0, 7202, { col: '#4a3a2e', juntas: [0.8 * CP, 999] }); for (const x of [cx - 1.4, cx + 0.4, cx + 1.7]) { g.beginPath(); g.arc(X(x), Y(0.42), 0.42 * CP, 0, 7); g.fillStyle = '#141211'; g.fill(); tinta(g, 2.4); g.beginPath(); g.arc(X(x), Y(0.42), 0.2 * CP, 0, 7); g.fillStyle = '#3a3530'; g.fill(); } }
  muro(x1 - 2.7, 0, x1 - 1.3, 2.4, 7301, { col: '#33302c' }); losa(x1 - 2.85, x1 - 1.15, 2.5, 0.12, 7302);
  g.fillStyle = '#ffd29a'; g.fillRect(X(x1 - 2.35), Y(1.8), 0.7 * CP, 0.6 * CP); marco({ x: x1 - 2.35, y: 1.2, w: 0.7, h: 0.6 }, 7303, { vidrio: 0 }); bano(x1 - 2, 1.5, 1.4, '#ffc68a', 0.25);
  barra(x1 - 4.6, 0.9, x1 - 2.8, 0.9, 0.08); chapaJ(R(x1 - 4.79, 0, x1 - 4.61, 1.0), 0, 7304, { liso: true, col: '#3a3029' });
  for (let k = 0; k < 4; k++) mata(x0 + rr() * (x1 - x0), 0, 0.6 + rr() * 0.6, 0.35 + rr() * 0.3, 720 + k);
}

// ================================================================= 6 · LA NAVE
function nave(x0, x1) {
  const h = 6.3;
  let hs = [];
  aparte(x0, 0, x1, h + 1.0, () => { muro(x0 + 0.5, 0, x1 - 0.5, h, 801, { col: '#312d2a', juntas: [1.8 * CP, 1.2 * CP] }); const rr = azar(802); for (const [y0, y1, n] of [[0.6, 3.0, 6], [3.85, 5.85, 8]]) { const paso = (x1 - x0 - 2) / n; for (let k = 0; k < n; k++) { if (rr() < 0.1) continue; const hx = x0 + 1 + k * paso + paso * 0.18, w = paso * 0.62; huecoT(hx, y0, hx + w, y1); hs.push({ x: hx, y: y0, w, h: y1 - y0 }); } } muro(x0, h, x1, h + 0.9, 803, { col: '#36312c', juntas: [1.8 * CP, 99 * CP], berenjenos: false }); });
  // detras de los ventanales, la luz calida de la nave (vidrio sucio, maquinas a contraluz) o la ciudad
  const rr = azar(811);
  hs.forEach((q, k) => {
    if (k % 3 !== 1) {
      g.save(); g.globalCompositeOperation = 'destination-over'; const gr = g.createLinearGradient(0, Y(q.y), 0, Y(q.y + q.h)); gr.addColorStop(0, '#f0b36a'); gr.addColorStop(1, '#8d5a2c'); g.fillStyle = gr; g.fillRect(X(q.x), Y(q.y + q.h), q.w * CP, q.h * CP); g.restore();
      g.fillStyle = 'rgba(40,20,8,.55)'; const mx = X(q.x + q.w * (0.2 + rr() * 0.5)); g.fillRect(mx, Y(q.y + q.h * 0.45), q.w * CP * 0.25, q.h * CP * 0.45);
    }
    marco(q, 820 + k, { montantes: 2, travesano: 0.66, vidrio: 0.5 });
  });
  for (let x = x0 + 0.3; x < x1; x += 3.6) pilar(x, x + 0.5, 0, h + 0.4, Math.round(x * 7));
  chapaJ(R(x0, 5.3, x1, 5.7), 0, 831, { col: HIERRO, juntas: [1.2 * CP, 999], remaches: 0.2 * CP });
  barra(x0 + 10, 5.3, x0 + 10, 4.1, 0.03); barra(x0 + 10.2, 5.3, x0 + 10.2, 4.1, 0.03);
  chapaJ(R(x0 + 9.87, 3.8, x0 + 10.33, 4.1), 0, 832, { liso: true, col: HIERRO });
  tubo([[X(x0 + 10.1), Y(3.8)], [X(x0 + 10.1), Y(3.45)], [X(x0 + 10.35), Y(3.3)]], 0.1 * CP, 0, X(x0 + 10), { col: HIERRO });
  bano((x0 + x1) / 2, 2.0, 6, '#e8a060', 0.12);
  for (const x of [x0 + 7, x0 + 7.4, x1 - 8]) bolardo(x);
}

// ================================================================= 7 · LA PUERTA
function puerta(x0, x1) {
  const cx = x0 + 12, ancho = 8, h = 9.2;
  // el tunel: oscuridad y una luz calida al fondo
  g.fillStyle = '#0d0b0a'; g.fillRect(X(cx - ancho / 2), Y(h - 3.4), ancho * CP, (h - 3.4) * CP);
  bano(cx + 1.2, 1.3, 3.6, '#c98a4e', 0.35);
  for (const s of [-1, 1]) { muro(cx + s * (ancho / 2 + 1.4) - 1.4, 0, cx + s * (ancho / 2 + 1.4) + 1.4, h, Math.round(cx + s * 10), { col: '#2e2a27', juntas: [1.4 * CP, 1.2 * CP], luz: s < 0 ? 1 : -1 }); escalera(cx + s * (ancho / 2 + 2.9), 0.5, h - 1, 0.3, true); }
  ventanaRedonda(cx, h - 1.7, 1.0, [cx - ancho / 2 - 0.1, cx + ancho / 2 + 0.1, h - 3.4, h], 901);
  for (let x = cx - ancho / 2, k = 0; x < cx + ancho / 2 - 0.1; x += 0.8, k++) { barra(x, h - 3.6, x + 0.4, h - 3.0, 0.04); barra(x + 0.4, h - 3.0, x + 0.8, h - 3.6, 0.04); }
  barra(cx - ancho / 2, h - 3.6, cx + ancho / 2, h - 3.6, 0.07);
  cartel(cx, h - 4.4, 3.2, 0.7, 'SECTOR 9', '');
  bano(cx, h - 1.7, 3, '#ff8a3a', 0.25);
  valla(x0 + 0.6, cx - ancho / 2 - 4.4, 1.5, 91);
}

// ================================================================= la FAROLA y la CALLE
export function farola(x) {
  const alto = py(380);
  chapaJ(R(x - 0.11, 0, x + 0.11, 0.65), 0, Math.round(x * 7), { liso: true, col: '#2c2520' }); chapaJ(R(x - 0.07, 0.65, x + 0.07, 0.8), 0, Math.round(x * 9), { liso: true, col: '#2c2520' });
  tubo([[X(x), Y(0.8)], [X(x), Y(alto - 0.2)], [X(x + 0.03), Y(alto + 0.12)], [X(x + 0.2), Y(alto + 0.19)], [X(x + 0.55), Y(alto + 0.19)]], 0.11 * CP, 0, X(x), { col: '#2c2520' });
  chapaJ(R(x + 0.39, alto + 0.05, x + 0.81, alto + 0.2), 0, Math.round(x * 11), { liso: true, col: '#2c2520' });
  chapaJ(R(x - 0.07, alto * 0.5, x + 0.11, alto * 0.5 + 0.3), 0, Math.round(x * 13), { liso: true, col: '#3a3029' });
  g.beginPath(); g.arc(X(x + 0.6), Y(alto + 0.03), 0.09 * CP, 0, 7); g.fillStyle = '#fff2d6'; g.fill();
  bano(x + 0.6, alto, 1.2, '#ffd29a', 0.35); bano(x + 0.6, alto - 0.6, 2.2, '#ffc27a', 0.12);
  canto(x + 0.06, 0.8, alto - 0.2, 0.02);
}
function calle(x0, x1, farolas) {
  // la cara de delante de la calle: hormigon y asfalto en penumbra, mas oscura abajo, con grava y grietas
  const gr = g.createLinearGradient(0, Y(0), 0, Y(-1.5)); gr.addColorStop(0, '#1d1a17'); gr.addColorStop(0.1, '#0e0d0c'); gr.addColorStop(1, '#050505');
  g.fillStyle = gr; g.fillRect(X(x0), Y(0), (x1 - x0) * CP, 1.6 * CP);
  const rr = azar(Math.round(x0 * 3));
  for (let k = 0; k < (x1 - x0) * 40; k++) { const x = X(x0 + rr() * (x1 - x0)), y = Y(-rr() * 1.4); g.fillStyle = rr() < 0.5 ? 'rgba(0,0,0,.3)' : 'rgba(180,150,110,.06)'; g.fillRect(x, y, 2 + rr() * 4, 1 + rr() * 2); }
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.4;
  for (let k = 0; k < (x1 - x0) * 0.6; k++) { let x = X(x0 + rr() * (x1 - x0)), y = Y(-0.05); g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 5; q++) { x += (rr() - 0.5) * 40; y += 8 + rr() * 20; g.lineTo(x, y); } g.stroke(); }
  // el canto del bordillo, lamido por la luz, y las piedras sueltas encima
  g.fillStyle = 'rgba(200,150,95,.4)'; g.fillRect(X(x0), Y(0) - 1, (x1 - x0) * CP, 2.4);
  g.fillStyle = TINTA; g.fillRect(X(x0), Y(0) + 1.5, (x1 - x0) * CP, 2);
  for (let k = 0; k < (x1 - x0) * 3; k++) { const x = X(x0 + rr() * (x1 - x0)), s = 2 + rr() * 6; g.fillStyle = rr() < 0.5 ? '#2a2420' : '#3b3430'; g.beginPath(); g.moveTo(x - s, Y(0)); g.lineTo(x - s * 0.5, Y(0) - s * 0.9); g.lineTo(x + s * 0.6, Y(0) - s * 0.7); g.lineTo(x + s, Y(0)); g.fill(); }
  // el charco de luz de cada farola sobre la calle
  for (const f of farolas) if (f > x0 - 4 && f < x1 + 4) { g.save(); g.globalCompositeOperation = 'lighter'; const c = g.createRadialGradient(X(f + 0.9), Y(0), 0, X(f + 0.9), Y(0), 2.6 * CP); c.addColorStop(0, 'rgba(255,190,120,.32)'); c.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = c; g.save(); g.translate(X(f + 0.9), Y(0)); g.scale(1, 0.32); g.translate(-X(f + 0.9), -Y(0)); g.fillRect(X(f - 2), Y(0) - 1.4 * CP, 6 * CP, 3 * CP); g.restore(); g.restore(); }
}

// ---------------------------------------------------------------- reparto
export function pintarJuego(p, ef) {
  switch (p.t) {
    case 'tramo_referencia': referencia(); break;
    case 'tramo_planta': planta(p.x0, p.x1); break;
    case 'tramo_marco': edificioMarco(p.x0 + 1, p.x0 + 13, { pisos: 3, sem: 41, cartel: true }); valla(p.x0 + 15.5, p.x1 - 0.4, 1.3, 42, [0.6, 0.3]); bolardo(p.x0 + 0.4); break;
    case 'tramo_ruina': ruina(p.x0, p.x1); break;
    case 'tramo_pasarela': pasarela(p.x0, p.x1); break;
    case 'tramo_patio': patio(p.x0, p.x1); break;
    case 'tramo_nave': nave(p.x0, p.x1); break;
    case 'tramo_puerta': puerta(p.x0, p.x1); break;
    case 'farola': farola(p.x); break;
    case 'calle': calle(p.tx0 ?? p.x0, p.tx1 ?? p.x1, ef.farolas); break;
  }
}
