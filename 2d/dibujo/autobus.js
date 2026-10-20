// El autobus volcado del nivel 8, con detalle: un urbano tumbado sobre el techo. Arriba quedan los bajos
// (largueros del chasis, ejes, ballestas, deposito, escape) y las ruedas en sus pasos; la chapa es metal
// viejo con juntas, remaches y chorretones de oxido; las ventanillas, enteras, rotas o sin cristal, dejan
// ver los asientos colgando boca abajo; la puerta plegable, el parabrisas astillado con el cartel de destino,
// la rejilla del motor y los pilotos; el techo aplastado contra el suelo, cristales y musgo. Sin naranja
// (GDD: es solo de la Podredumbre): la franja es crema descolorida.
// Todo lo quieto se pinta UNA vez en un lienzo; las ruedas se dibujan aparte porque giran al arrastrarlo.
import { metal, vidrio, remache } from '../assets/pintura.js';
import { TINTA, temblar, trazar, tinta, hash, azar, rgba } from './tinta.js';

const cache = new Map();
const K = 3;                  // pixeles por unidad del lienzo
const ARRIBA = 34, LADO = 12; // margen del lienzo por encima (ruedas, bajos) y a los lados

// (2026-10-18, la imagen de referencia de la ciudad: chapa comida por el OXIDO PARDO, nada de verde ni de musgo)
const CHAPA = '#6e5139', CHAPA_OSC = '#4c3627', CREMA = '#a39883', MARCO = '#2a2420', DENTRO = '#0d0c0c';

function ejes(w) { return [70, w - 84]; }

function pintar(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((w + 2 * LADO) * K); cv.height = Math.ceil((h + ARRIBA + 8) * K);
  const c = cv.getContext('2d');
  c.scale(K, K); c.translate(LADO, ARRIBA);
  const r = azar(1515);
  const top = 16;                                     // donde empieza la chapa (por encima, los bajos)
  const [e1, e2] = ejes(w);

  // ---- los bajos: largueros, travesanos, ejes con sus ballestas, deposito y escape
  metal(c, () => { c.beginPath(); c.rect(36, top - 9, w - 70, 6); }, [36, top - 9, w - 70, 6], { semilla: 1601, base: '#3a3f43', oxido: 0.9, brilloBorde: 0.15, tintaG: 1.4 });
  for (let x = 60; x < w - 40; x += 46) metal(c, () => { c.beginPath(); c.rect(x, top - 11, 5, 10); }, [x, top - 11, 5, 10], { semilla: 1602 + x, base: '#33383c', oxido: 0.8, brilloBorde: 0.1, tintaG: 1 });
  for (const ex of [e1, e2]) {
    // ballesta: hojas curvas por encima del eje
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(ex - 26 + k * 2, top - 6 - k * 1.6); c.quadraticCurveTo(ex, top - 15 - k * 1.6, ex + 26 - k * 2, top - 6 - k * 1.6); c.strokeStyle = TINTA; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = '#555c62'; c.lineWidth = 1; c.stroke(); }
  }
  metal(c, () => { c.beginPath(); c.roundRect(150, top - 17, 52, 12, 2); }, [150, top - 17, 52, 12], { semilla: 1610, base: '#4d5559', oxido: 0.7, cilindro: 'h', brilloBorde: 0.3, tintaG: 1.4 });
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(160, top - 15, 3, 8);
  // escape: tubo a lo largo, con su silenciador y la cola doblada hacia atras
  c.beginPath(); c.moveTo(e1 + 30, top - 4); c.lineTo(w - 60, top - 4); c.quadraticCurveTo(w - 30, top - 4, w - 22, top - 14);
  c.strokeStyle = TINTA; c.lineWidth = 4.4; c.stroke(); c.strokeStyle = '#4a4440'; c.lineWidth = 2.4; c.stroke();
  metal(c, () => { c.beginPath(); c.roundRect(e2 - 70, top - 9, 34, 9, 4); }, [e2 - 70, top - 9, 34, 9], { semilla: 1611, base: '#4a4440', oxido: 0.9, cilindro: 'h', brilloBorde: 0.2, tintaG: 1.3 });

  // ---- la carroceria: morro redondeado a la izquierda, techo aplastado abajo
  const forma = temblar([[12, top], [w - 10, top], [w - 2, top + 8], [w - 1, h - 16], [w - 9, h - 4], [w * 0.6, h - 1], [w * 0.3, h - 3], [20, h - 2], [5, h - 16], [2, top + 22], [6, top + 6]], 14, 0.7, 1617);
  metal(c, () => trazar(c, forma), [0, top, w, h - top], { semilla: 1620, base: CHAPA, oxido: 1, brilloBorde: 0.25, tintaG: 2.6 });
  c.save(); trazar(c, forma); c.clip();
  // faldon (arriba) un tono mas oscuro, la franja crema y el techo (abajo) con sus nervios
  c.fillStyle = rgba(CHAPA_OSC, 0.45); c.fillRect(0, top, w, 28);
  c.fillStyle = rgba(CREMA, 0.8); c.fillRect(0, top + 30, w, 6);
  c.fillStyle = 'rgba(80,60,40,.35)'; for (let k = 0; k < 9; k++) { const x = r() * w; c.fillRect(x, top + 30, 10 + r() * 30, 6); }
  c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(0, h - 22, w, 22);
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
  for (let x = 30; x < w; x += 18) { c.beginPath(); c.moveTo(x, h - 21); c.lineTo(x + (r() - 0.5) * 3, h - 2); c.stroke(); }
  // juntas de los paneles y remaches del faldon
  for (let x = 44; x < w - 30; x += 62) { c.beginPath(); c.moveTo(x, top + 1); c.lineTo(x, top + 29); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2; c.stroke(); }
  for (let x = 20; x < w - 16; x += 9) { remache(c, x, top + 3, 0.9); remache(c, x, top + 27, 0.9); }
  // el rotulo de la linea, boca abajo y casi borrado
  c.save(); c.translate(w * 0.5, top + 14); c.scale(-1, -1);
  c.fillStyle = 'rgba(30,32,30,.45)'; c.font = 'bold 9px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('BOUNDLAND  ·  LINE 15', 0, 0); c.restore();
  c.restore();

  // pasos de rueda: el hueco oscuro donde se meten las ruedas
  for (const ex of [e1, e2]) {
    c.beginPath(); c.arc(ex, top, 25, 0, Math.PI); c.fillStyle = '#121416'; c.fill(); tinta(c, 2.2);
    c.beginPath(); c.arc(ex, top, 25, 0.15, Math.PI - 0.15); c.strokeStyle = 'rgba(160,170,160,.18)'; c.lineWidth = 1; c.stroke();
  }

  // ---- parabrisas (morro) con el cartel de destino junto al techo
  const yv0 = top + 40, yv1 = h - 24;
  const para = [[7, yv0], [30, yv0 - 2], [30, yv1], [9, yv1 - 3], [5, yv0 + 18]];
  vidrio(c, () => trazar(c, para), [5, yv0 - 2, 25, yv1 - yv0 + 2], { tinte: 'rgba(120,140,150,', a: 0.55, tintaG: 1.8 });
  c.strokeStyle = 'rgba(220,235,240,.55)'; c.lineWidth = 0.7;
  const gx = 18, gy = yv0 + 24;
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + 0.3; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(a) * (14 + r() * 8), gy + Math.sin(a) * (14 + r() * 8)); c.stroke(); }
  for (const rr of [4, 8]) { c.beginPath(); for (let k = 0; k <= 9; k++) { const a = k / 9 * Math.PI * 2 + 0.3; const q = rr + r() * 2; k ? c.lineTo(gx + Math.cos(a) * q, gy + Math.sin(a) * q) : c.moveTo(gx + Math.cos(a) * q, gy + Math.sin(a) * q); } c.stroke(); }
  c.fillStyle = '#16181a'; c.beginPath(); c.roundRect(8, h - 21, 22, 10, 1.5); c.fill(); tinta(c, 1.4);
  c.save(); c.translate(19, h - 16); c.scale(-1, -1); c.fillStyle = 'rgba(200,205,170,.55)'; c.font = 'bold 8px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('15', 0, 0); c.restore();
  // faros (junto al parachoques, que ahora queda arriba)
  for (const fy of [top + 8]) { c.beginPath(); c.arc(9, fy, 3.4, 0, 7); c.fillStyle = 'rgba(200,205,190,.55)'; c.fill(); tinta(c, 1.2); }
  metal(c, () => { c.beginPath(); c.roundRect(1, top - 2, 16, 5, 2); }, [1, top - 2, 16, 5], { semilla: 1630, base: '#3d4246', oxido: 0.6, brilloBorde: 0.3, tintaG: 1.4 });

  // ---- la puerta plegable: dos hojas con cristal, una medio salida
  const px0 = 36, px1 = 68;
  caja2(c, px0, top + 4, px1 - px0, h - top - 10, MARCO);
  for (const [a, b, rota] of [[px0 + 2, px0 + 15, false], [px0 + 17, px1 - 2, true]]) {
    caja2(c, a, top + 8, b - a, h - top - 18, '#3e4447');
    const gy0 = top + 34, gy1 = h - 18;
    if (rota) { c.fillStyle = DENTRO; c.fillRect(a + 2, gy0, b - a - 4, gy1 - gy0); dientes(c, a + 2, gy0, b - a - 4, gy1 - gy0, 1641); }
    else vidrio(c, () => { c.beginPath(); c.rect(a + 2, gy0, b - a - 4, gy1 - gy0); }, [a + 2, gy0, b - a - 4, gy1 - gy0], { tinte: 'rgba(110,130,140,', a: 0.6, tintaG: 1 });
  }

  // ---- ventanillas: intactas, rotas (agujero con dientes) o sin cristal; dentro, asientos boca abajo
  const v0 = 76, v1 = w - 48, n = 7, paso = (v1 - v0) / n;
  for (let k = 0; k < n; k++) {
    const x = v0 + k * paso + 3, ww = paso - 6, y0 = yv0, y1 = yv1;
    caja2(c, x - 2, y0 - 2, ww + 4, y1 - y0 + 4, MARCO);
    c.fillStyle = DENTRO; c.fillRect(x, y0, ww, y1 - y0);
    // asientos colgando: el suelo del autobus esta arriba, asi que las patas salen hacia abajo desde el
    // borde de arriba y el respaldo cuelga
    c.save(); c.beginPath(); c.rect(x, y0, ww, y1 - y0); c.clip();
    // la barra de agarrarse (ahora abajo, junto al techo) y dos asientos colgando de las patas
    c.strokeStyle = '#5a6066'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y1 - 7); c.lineTo(x + ww, y1 - 7); c.stroke();
    for (let s = 0; s < 2; s++) {
      const sx = x + 2 + s * (ww / 2), sw = ww / 2 - 3;
      c.fillStyle = '#26211d'; c.fillRect(sx + 3, y0, 2, 7); c.fillRect(sx + sw - 5, y0, 2, 7);   // patas
      c.fillStyle = '#4a3c34'; c.beginPath(); c.roundRect(sx, y0 + 7, sw, 5, 1.5); c.fill();      // asiento
      c.fillStyle = '#3e322b'; c.beginPath(); c.roundRect(sx + sw - 6, y0 + 9, 6, 20, 2); c.fill(); // respaldo
      c.fillStyle = '#54453c'; c.beginPath(); c.roundRect(sx + sw - 7, y0 + 27, 8, 5, 2); c.fill(); // reposacabezas
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 0.8; c.strokeRect(sx + sw - 6, y0 + 9, 6, 20);
    }
    c.restore();
    const est = k === 1 || k === 4 ? 'rota' : k === 5 ? 'falta' : 'entera';
    if (est === 'entera') {
      vidrio(c, () => { c.beginPath(); c.rect(x, y0, ww, y1 - y0); }, [x, y0, ww, y1 - y0], { tinte: 'rgba(100,120,130,', a: 0.55, tintaG: 1.2 });
      c.strokeStyle = 'rgba(220,235,240,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 4, y1 - 4); c.lineTo(x + ww * 0.5, y0 + 4); c.stroke();
    } else if (est === 'rota') {
      vidrio(c, () => { c.beginPath(); c.rect(x, y0, ww, y1 - y0); }, [x, y0, ww, y1 - y0], { tinte: 'rgba(100,120,130,', a: 0.5, tintaG: 1.2 });
      dientes(c, x + ww * 0.15, y0 + (y1 - y0) * 0.2, ww * 0.7, (y1 - y0) * 0.65, 1650 + k);
    }
    // pilar entre ventanillas
    caja2(c, x + ww + 1, y0 - 2, 4, y1 - y0 + 4, MARCO);
  }

  // ---- la trasera: rejilla del motor y pilotos
  caja2(c, w - 40, top + 40, 30, h - top - 64, '#3a3f42');
  for (let y = top + 44; y < h - 26; y += 5) { c.beginPath(); c.moveTo(w - 37, y); c.lineTo(w - 13, y); c.strokeStyle = TINTA; c.lineWidth = 1.6; c.stroke(); }
  for (const fy of [top + 6, top + 16]) { c.fillStyle = fy === top + 6 ? 'rgba(150,40,35,.75)' : 'rgba(200,190,150,.55)'; c.beginPath(); c.roundRect(w - 9, fy, 6, 7, 1.5); c.fill(); tinta(c, 1); }

  // ---- abolladuras y aranazos sobre la chapa
  c.save(); trazar(c, forma); c.clip();
  for (let k = 0; k < 6; k++) {
    const x = 80 + r() * (w - 140), y = top + 4 + r() * 22, rr = 6 + r() * 9;
    const g = c.createRadialGradient(x - 2, y - 2, 0, x, y, rr);
    g.addColorStop(0, 'rgba(255,255,255,.1)'); g.addColorStop(0.6, 'rgba(0,0,0,.15)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill();
  }
  // oxido pardo: placas comidas y lenguas que bajan de las juntas y los remaches
  for (let k = 0; k < 14; k++) {
    const x = r() * w, y = top + r() * (h - top), rx = 8 + r() * 26, ry = 5 + r() * 14;
    c.beginPath();
    for (let q = 0; q < 7; q++) { const a = (q / 7) * Math.PI * 2, f = 0.6 + r() * 0.5; q ? c.lineTo(x + Math.cos(a) * rx * f, y + Math.sin(a) * ry * f) : c.moveTo(x + Math.cos(a) * rx * f, y + Math.sin(a) * ry * f); }
    c.closePath(); c.fillStyle = r() < 0.5 ? 'rgba(74,46,29,.55)' : 'rgba(110,74,48,.45)'; c.fill();
  }
  for (let x = 10; x < w - 10; x += 9 + r() * 22) {
    const y = top + 2 + r() * 30, l = 10 + r() * 34, ww = 1.5 + r() * 2.5;
    c.fillStyle = 'rgba(70,42,26,.6)'; c.beginPath(); c.moveTo(x - ww, y); c.lineTo(x + ww, y); c.lineTo(x + ww * 0.3, y + l); c.lineTo(x - ww * 0.3, y + l * 0.9); c.closePath(); c.fill();
  }
  c.restore();

  // ---- cristales en el suelo, musgo por arriba y enredaderas que cuelgan
  for (let k = 0; k < 22; k++) {
    const x = -8 + r() * (w + 16), y = h - 1 - r() * 2, s = 1 + r() * 2.5;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y - s * 0.6); c.lineTo(x + s * 1.6, y); c.closePath();
    c.fillStyle = 'rgba(190,210,215,.6)'; c.fill();
  }
  for (let k = 0; k < 26; k++) {
    const x = 20 + r() * (w - 40), base = top + (r() < 0.6 ? 0 : -9);
    c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + 4, base - 8, x + (r() - 0.5) * 12, base - 10 - r() * 12);
    c.strokeStyle = r() < 0.5 ? '#3d3426' : '#51442f'; c.lineWidth = 1.2 + r() * 0.6; c.stroke();
  }
  for (let k = 0; k < 6; k++) {
    const x = 90 + r() * (w - 150), l = 18 + r() * 40;
    c.beginPath(); c.moveTo(x, top + 1); c.bezierCurveTo(x + 6, top + l * 0.3, x - 6, top + l * 0.7, x + (r() - 0.5) * 8, top + l);
    c.strokeStyle = '#2a2320'; c.lineWidth = 1.4; c.stroke();
    for (let q = 0; q < 4; q++) { const yy = top + l * (0.2 + q * 0.22); c.beginPath(); c.ellipse(x + (q % 2 ? 3 : -3), yy, 2.6, 1.4, q, 0, 7); c.fillStyle = '#3a2a1f'; c.fill(); }
  }
  return cv;
}

function caja2(c, x, y, w, h, color) {
  c.beginPath(); c.rect(x, y, w, h); c.fillStyle = color; c.fill(); tinta(c, 1.4);
}

// el agujero de un cristal roto: oscuro, con el borde en dientes de sierra
function dientes(c, x, y, w, h, semilla) {
  const r = azar(semilla), pts = [], n = 14;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, rr = 0.55 + r() * 0.45;
    pts.push([x + w / 2 + Math.cos(a) * w / 2 * rr, y + h / 2 + Math.sin(a) * h / 2 * rr]);
  }
  c.beginPath(); pts.forEach(([px, py], k) => (k ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath();
  c.fillStyle = DENTRO; c.fill();
  c.strokeStyle = 'rgba(210,225,230,.5)'; c.lineWidth = 0.8; c.stroke();
}

// una rueda: cubierta con su dibujo, flanco, llanta con tuercas y tapacubos
function rueda(c, x, y, ang) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.arc(0, 0, 21, 0, 7); c.fillStyle = '#1b1c1d'; c.fill(); tinta(c, 2.4);
  c.strokeStyle = '#2c2e30'; c.lineWidth = 3;
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 17.5, Math.sin(a) * 17.5); c.lineTo(Math.cos(a + 0.12) * 20.5, Math.sin(a + 0.12) * 20.5); c.stroke(); }
  c.beginPath(); c.arc(0, 0, 14.5, 0, 7); c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; c.stroke();
  metal(c, () => { c.beginPath(); c.arc(0, 0, 11, 0, 7); }, [-11, -11, 22, 22], { semilla: 1660, base: '#6a7076', oxido: 0.7, brilloBorde: 0.35, tintaG: 1.6 });
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; c.beginPath(); c.arc(Math.cos(a) * 7, Math.sin(a) * 7, 1.2, 0, 7); c.fillStyle = '#2a2e31'; c.fill(); }
  c.beginPath(); c.arc(0, 0, 3.6, 0, 7); c.fillStyle = '#80868c'; c.fill(); tinta(c, 1);
  c.restore();
}

export function dibujarAutobus(c, bus, t) {
  const s = bus.s, w = Math.round(s.w), h = Math.round(s.h);
  const clave = w + 'x' + h;
  let cv = cache.get(clave);
  if (!cv) { cv = pintar(w, h); cache.set(clave, cv); }
  // arrastrandolo: tiembla un poco y las ruedas giran sueltas con los tirones
  const tira = s.dx && !bus.libre;
  bus.giro = (bus.giro || 0) + (tira ? 0.09 : 0) + (bus.giroV || 0);
  bus.giroV = tira ? 0.04 : (bus.giroV || 0) * 0.97;
  const tx = tira ? (hash(Math.floor(t * 30), 3) - 0.5) * 1.2 : 0, ty = tira ? (hash(Math.floor(t * 30), 7) - 0.5) * 0.8 : 0;
  c.save();
  c.translate(s.x + tx, s.y + ty);
  // algo inclinado, como en la referencia: gira sobre el centro de abajo (los extremos se mueven ~4 u, y el 18
  // sigue pisando su caja de choque sin que se note)
  c.translate(w / 2, h); c.rotate(0.022); c.translate(-w / 2, -h);
  c.drawImage(cv, -LADO, -ARRIBA, w + 2 * LADO, h + ARRIBA + 8);
  for (const ex of ejes(w)) rueda(c, ex, 6, bus.giro + ex);
  c.restore();
}
