// EL LINDE · PIEZAS compuestas (de varias de las de los otros modulos) que usan la escena del concepto y el nivel
// del juego: la chatarra del bosque con su musgo, el tocon de los anillos, la lena, los huertos, el espantapajaros,
// el invernadero, el pozo, el porche de las campanillas y los farolillos. Se pintan en `g` con las cotas que se les
// den; el suelo, el de base.js (sueloY).
import { TINTA, azar, trazar, tinta } from '../dibujo/tinta.js';
import { g, lerp, sueloY, brillo, ladoLuz } from './base.js';
import { musgo, roca } from './suelo.js';
import { hojas, liana } from './follaje.js';
import { chapa, tubo, autobus, deposito } from './metal.js';

// EXCEPCION a la regla de la vegetacion (la pidio el usuario el 2026-10-18): la chatarra del bosque lleva musgo y
// hiedra ENCIMA, como en la referencia. borde: puntos [x, y] del canto de arriba de la pieza, de izquierda a
// derecha. Encima, mantos de musgo por tramos (alguno falta) con hebras de hiedra que cuelgan; lazos de hiedra que
// caen por delante; matas pequenas (la copa de una mata sale ~3 veces su radio: con mas, la pieza desaparece debajo)
export function cubrir(borde, sem, d, o = {}) {
  const rq = azar(sem), cols = ['#8f9a36', '#7f8a2c', '#99a13a'];
  for (let i = 0; i < borde.length - 1; i++) {
    if (i > 0 && i < borde.length - 2 && rq() < (o.huecos ?? 0.18)) continue;
    const [x0, y0] = borde[i], [x1, y1] = borde[i + 1];
    musgo(x0 - 4, Math.max(y0, y1) + 3, x1 - x0 + 8, o.grosor ?? 13, cols[i % 3], sem + i * 7, { cuelga: (o.cuelga ?? 46) * (0.5 + rq()), esporas: rq() < 0.35 });
  }
  for (let k = 0; k < (o.lazos ?? 2); k++) {
    const i = Math.floor(rq() * (borde.length - 2)), j = Math.min(borde.length - 1, i + 1 + Math.floor(rq() * 3)), [xa, ya] = borde[i], [xb, yb] = borde[j];
    liana(xa, ya + 4, xb, yb + 4, (o.comba ?? 70) * (0.6 + rq() * 0.8), d, sem + 50 + k, 3.5 + rq() * 2);
  }
  for (const t of o.matas ?? [0, 1]) { const i = Math.min(borde.length - 1, Math.round(t * (borde.length - 1))), [mx, my] = borde[i]; hojas(mx, my - 2, 10 + rq() * 8, 6 + rq() * 4, d, sem + 90 + Math.floor(t * 10), { den: 0.95, mata: true }); }
}

// la cisterna tumbada (x: su izquierda, y: su suelo)
export function cisterna(x, y, d) {
  const yy = y + 20, top = yy - 120; deposito(x, yy, 250, 120, d, 591);
  cubrir([[x + 12, top + 30], [x + 36, top + 6], [x + 100, top], [x + 166, top], [x + 222, top + 6], [x + 244, top + 30]], 592, d, { cuelga: 50, lazos: 2, comba: 50, grosor: 16 });
}
// el autobus de la linea 4, hundido hasta el eje y algo ladeado (cx: su centro, y: su suelo); el techo (la misma
// curva que el autobus: se hunde 8 en el medio) cubierto de musgo, la hiedra cae por las ventanas
export function autobusBosque(cx, y, d) {
  g.save(); g.translate(cx, y); g.rotate(-0.035); g.translate(-cx, -y); autobus(cx - 272, y + 16, 560, 200, d, 1881, { letrero: 'LINEA 4' });
  const top = y + 16 - 200, borde = []; for (let x = cx - 254; x <= cx + 264; x += 74) borde.push([x, top + Math.sin(Math.PI * (x - cx + 272) / 560) * 8]);
  cubrir(borde, 1882, d, { cuelga: 95, lazos: 4, comba: 80, grosor: 18 });
  g.restore();
}
// una viga de celosia caida, casi en vertical (x0, y0: su pie): la hiedra la trepa en lazos cortos de un lado a
// otro, musgo donde apoya y mata al pie
export function vigaCaida(x0, y0, d) {
  g.save(); g.translate(x0, y0); g.rotate(-1.13); chapa([[0, -10], [380, -10], [380, 10], [0, 10]], d, 2041, { remaches: 12 }); for (let k = 0; k < 9; k++) tubo([[20 + k * 40, -10], [40 + k * 40, 10]], 3, d, x0, { cap: 'butt' }); g.restore();
  const ca = Math.cos(-1.13), sa = Math.sin(-1.13), P = (t, s) => [x0 + t * ca - s * sa, y0 + t * sa + s * ca];
  for (let k = 0; k < 4; k++) { const a = P(40 + k * 80, k % 2 ? 10 : -10), b = P(100 + k * 80, k % 2 ? -10 : 10); liana(a[0], a[1], b[0], b[1], 18 + k * 6, d, 2042 + k, 3.5); }
  { const [mx, my] = P(372, -6); musgo(mx - 30, my + 4, 46, 12, '#8f9a36', 2047, { cuelga: 60, esporas: true }); }
  { const [mx, my] = P(10, 0); hojas(mx + 10, my - 10, 16, 10, d, 2048, { den: 0.95, mata: true }); }
}

// Juego 1: el tocon de los anillos (x: su centro, y: el canto de arriba, b: su suelo) y la raiz que se aparta
export function tocon(x, y, b) {
  const R0 = 120;
  chapa([[x - R0, b + 6], [x - R0 * 0.92, y], [x + R0 * 0.92, y], [x + R0, b + 6]], 0, 41, { col: '#4a3e2a' });
  g.beginPath(); g.ellipse(x, y, R0 * 0.92, 34, 0, 0, 7); g.fillStyle = '#a28a62'; g.fill(); tinta(g, 3);
  for (let k = 1; k <= 4; k++) { g.beginPath(); g.ellipse(x, y, R0 * 0.92 * (1 - k * 0.2), 34 * (1 - k * 0.2), 0, 0, 7); g.strokeStyle = TINTA; g.lineWidth = 2; g.stroke(); const a = [0.4, 2.1, 4.0, 5.3][k - 1], ex = x + Math.cos(a) * R0 * 0.92 * (1 - (k - 0.5) * 0.2), ey = y + Math.sin(a) * 34 * (1 - (k - 0.5) * 0.2); g.save(); g.globalCompositeOperation = 'lighter'; brillo(ex, ey, 24, '#a9cde6', 0.6); g.restore(); g.fillStyle = '#e6f2fa'; g.beginPath(); g.arc(ex, ey, 3.2, 0, 7); g.fill(); }
  musgo(x - R0 - 10, b + 2, R0 * 0.9, 18, '#7f8a2c', 42, { esporas: true }); musgo(x + R0 * 0.2, b + 2, R0 * 0.9, 16, '#99a13a', 43, { esporas: true });
}
// la raiz arqueada junto al tocon (solo el concepto: en el juego la raiz que cierra el paso es la del Hack 3)
export function raizArco(x, b) {
  for (let k = 0; k < 5; k++) { for (const [w2, cc] of [[16 - k, TINTA], [11 - k, '#3a3122']]) { g.strokeStyle = cc; g.lineWidth = w2; g.beginPath(); g.moveTo(x + 200, b + 10); g.quadraticCurveTo(x + 230 + k * 10, b - 120 - k * 30, x + 190 - k * 8, b - 240 - k * 20); g.stroke(); } }
}

// la pila de lena (x: su izquierda, y: su suelo)
export function lena(x, y) {
  for (let f = 0; f < 4; f++) for (let k = 0; k < 6 - f; k++) { const cx = x + k * 22 + f * 11, cy = y - 12 - f * 20; g.beginPath(); g.arc(cx, cy, 11, 0, 7); g.fillStyle = '#8a7356'; g.fill(); tinta(g, 2); g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.2; g.stroke(); }
}
// tres hileras de coles (x0: la primera)
export function cultivos(x0) {
  for (let b = 0; b < 3; b++) for (let k = 0; k < 7; k++) { const x = x0 + k * 40 + b * 12, y = sueloY(x) - 6 - b * 10; g.beginPath(); g.ellipse(x, y, 16, 10, 0, 0, 7); g.fillStyle = ['#7f8a2c', '#69751f', '#99a13a'][(k + b) % 3]; g.fill(); tinta(g, 1.6); }
}
// el espantapajaros (x: su poste, y: su suelo)
export function espantapajaros(x, y) {
  chapa([[x - 3, y], [x - 3, y - 150], [x + 3, y - 150], [x + 3, y]], 0, 81); chapa([[x - 60, y - 118], [x + 60, y - 118], [x + 60, y - 110], [x - 60, y - 110]], 0, 82); chapa([[x - 30, y - 120], [x + 30, y - 120], [x + 36, y - 50], [x - 36, y - 50]], 0, 83, { col: '#7a6a4c' }); g.beginPath(); g.arc(x, y - 140, 18, 0, 7); g.fillStyle = '#c9b98e'; g.fill(); tinta(g, 2.4); chapa([[x - 32, y - 150], [x + 32, y - 150], [x + 14, y - 176], [x - 14, y - 176]], 0, 84, { col: '#3a2e20' });
}
// el invernadero roto (x: su izquierda, y: su suelo)
export function invernadero(x, y) {
  g.strokeStyle = TINTA; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 90); g.quadraticCurveTo(x + 90, y - 170, x + 180, y - 90); g.lineTo(x + 180, y); g.stroke(); for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(x + k * 30, y); g.lineTo(x + k * 30, y - 90 - Math.sin((k / 6) * Math.PI) * 70); g.stroke(); } g.fillStyle = 'rgba(230,236,220,.25)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 90); g.quadraticCurveTo(x + 90, y - 170, x + 120, y - 140); g.lineTo(x + 100, y - 60); g.lineTo(x + 40, y); g.fill();
}
// el pozo (x: su centro, y: su suelo)
export function pozo(x, y) {
  roca([[x - 42, y + 4], [x - 42, y - 46], [x + 42, y - 46], [x + 42, y + 4]], 0, 85); for (const px of [x - 34, x + 30]) chapa([[px, y - 46], [px, y - 120], [px + 5, y - 120], [px + 5, y - 46]], 0, px); chapa([[x - 50, y - 120], [x, y - 150], [x + 50, y - 120]], 0, 86, { col: '#3e4a22' });
}
// el porche de la granja con las campanillas (Juego 2) (x: su centro, y: el canto de su tejadillo); o.campanillas:
// lo que miden respecto al concepto (en el juego, ampliado el porche, salian barras de un metro)
export function porche(x, y, o = {}) {
  const f = o.campanillas ?? 1, ld = ladoLuz(x);
  if (o.relieve) {
    // (o.relieve) con fondo: la sombra del tejadillo sobre la pared de detras, la chapa vista desde arriba (se va al
    // fondo hacia el lado del sol, ondulada) y su canto; los postes con su cara al sol y su sombra en la pared
    const so = g.createLinearGradient(0, y + 14, 0, y + 110); so.addColorStop(0, 'rgba(6,5,4,.55)'); so.addColorStop(1, 'rgba(6,5,4,0)'); g.fillStyle = so; g.fillRect(x - 150, y + 14, 300, 96);
    for (const px of [x - 128, x + 128]) { g.fillStyle = 'rgba(6,5,4,.35)'; g.beginPath(); g.moveTo(px - ld * 6, y + 18); g.lineTo(px - ld * 30, y + 26); g.lineTo(px - ld * 30, sueloY(px) - 4); g.lineTo(px - ld * 6, sueloY(px)); g.closePath(); g.fill(); }
    const dx = ld * 34, dy = -18, top = [[x - 140, y], [x + 140, y], [x + 140 + dx, y + dy], [x - 140 + dx, y + dy]];
    trazar(g, top); g.fillStyle = '#4a5530'; g.fill();
    g.save(); trazar(g, top); g.clip();
    for (let k = -150; k < 150 + Math.abs(dx); k += 9) { g.strokeStyle = 'rgba(20,24,10,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + dx, y + dy); g.stroke(); g.strokeStyle = 'rgba(190,190,140,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + k + 3, y); g.lineTo(x + k + 3 + dx, y + dy); g.stroke(); }
    g.fillStyle = 'rgba(90,58,36,.35)'; g.fillRect(x - 60, y + dy, 70, -dy);
    g.restore();
    trazar(g, top); tinta(g, 2);
  }
  chapa([[x - 140, y], [x + 140, y], [x + 160, y + 16], [x - 160, y + 16]], 0, 51, { col: '#3e4a22' }); for (const px of [x - 128, x + 128]) chapa([[px - 5, y + 16], [px + 5, y + 16], [px + 5, sueloY(px)], [px - 5, sueloY(px)]], 0, px + 1);
  if (o.relieve) for (const px of [x - 128, x + 128]) { g.fillStyle = 'rgba(232,214,170,.55)'; g.fillRect(ld > 0 ? px + 2 : px - 5, y + 18, 3, sueloY(px) - y - 20); g.fillStyle = 'rgba(8,7,5,.4)'; g.fillRect(ld > 0 ? px - 5 : px + 2, y + 18, 3, sueloY(px) - y - 20); }
  [70, 52, 88, 40, 62].forEach((l, k) => { const cx = x - 72 + k * 36; g.strokeStyle = TINTA; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, y + 16); g.lineTo(cx, y + 34); g.stroke(); trazar(g, [[cx - 5 * Math.sqrt(f), y + 34], [cx + 5 * Math.sqrt(f), y + 34], [cx + 5 * Math.sqrt(f), y + 34 + l * f], [cx - 5 * Math.sqrt(f), y + 34 + l * f]]); g.fillStyle = k === 2 ? '#efe8cc' : '#b8ae8e'; g.fill(); tinta(g, 2); if (k === 2) { g.save(); g.globalCompositeOperation = 'lighter'; brillo(cx, y + 34 + (l * f) / 2, 50 * f, '#ffe2a8', 0.45); g.restore(); } });
}
// una guirnalda de farolillos de a a b, colgada a la altura y
export function guirnalda(a, b2, y) {
  g.strokeStyle = TINTA; g.lineWidth = 1.3; g.beginPath(); g.moveTo(a, y); g.quadraticCurveTo((a + b2) / 2, y + 50, b2, y); g.stroke(); g.save(); g.globalCompositeOperation = 'lighter'; for (let k = 1; k < 12; k++) { const t = k / 12, x = lerp(a, b2, t), yy = y + Math.sin(t * Math.PI) * 46; brillo(x, yy + 6, 24, '#ffd994', 0.55); g.fillStyle = '#fff0c8'; g.beginPath(); g.arc(x, yy + 6, 4, 0, 7); g.fill(); } g.restore();
}
