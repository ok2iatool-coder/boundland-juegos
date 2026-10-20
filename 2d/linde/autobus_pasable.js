// EL AUTOBUS DE LAS AFUERAS, que se ATRAVIESA (el 18 entra por la trasera reventada y sale por el frente sin
// cristal): dos piezas en las mismas casillas del mapa (las J del nivel 6, que ya no son macizas).
//   busDentro  detras del 18 ('fondo'): la pared del otro lado por dentro, con las ventanas huecas (se ve el
//              bosque de detras), asientos de perfil, barras, el pasamanos con sus agarraderas, el techo, el suelo con
//              hojas y un helecho, el puesto del conductor y la luz que entra por las ventanas
//   busFuera   delante del 18 ('sobre', se DESVANECE con el 18 dentro: dibujo/linde.js): la carroceria del lado
//              de aca, con las ventanas huecas (se ve el interior), pintura vieja que salta, oxido, abolladuras,
//              cristales rotos, el frente con su letrero, faros y parachoques, las ruedas hundidas, el techo con
//              musgo, hiedra que cuelga y un arbolillo, y la trasera reventada por donde se entra
// A tamano del concepto (1 px = 1 px del concepto): x0, base = la esquina de abajo a la izquierda (el suelo), w x h.
import { TINTA, azar, rgba, mezclar, trazar, tinta } from '../dibujo/tinta.js';
import { g, ladoLuz, luces, brillo, lerp } from './base.js';
import { hojas } from './follaje.js';

const C = {
  crema: '#b4a684', cremaO: '#8e8266', oliva: '#56603f', olivaO: '#3c442c', mostaza: '#8c7a46', oxido: '#5b3a24', oxidoM: '#7d5434',
  hueco: '#0d0c09', metal: '#6c6a60', metalO: '#3a3934', goma: '#1b1a17', asiento: '#4e3d2e', asientoL: '#6e5641', espuma: '#c8b98e',
  panel: '#48443a', panelO: '#2e2b24', suelo: '#24221c', luz: '#c0a374', pico: '#e3d5ad', cristal: 'rgba(206,214,196,.28)',
};
// geometria comun: las ventanas, las ruedas y los extremos, para que dentro y fuera casen
function plano(x0, base, w, h) {
  const top = base - h, x1 = x0 + w, vy0 = top + 46, vh = h * 0.36;
  const ventanas = [];
  const nv = 7, xa = x0 + 120, xb = x1 - 210, paso = (xb - xa) / nv;
  for (let k = 0; k < nv; k++) ventanas.push({ x: xa + k * paso + 6, y: vy0, w: paso - 14, h: vh });
  return { top, x1, vy0, vh, ventanas, ruedas: [x0 + 190, x1 - 175], parab: { x: x1 - 150, y: top + 38, w: 120, h: vh + 20 }, puerta: { x: x1 - 205, w: 50 } };
}
const rr2 = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const S = (a) => rgba('#0b0a07', a), L = (a) => rgba(C.pico, a);

export function busDentro(x0, base, w, h, sem) {
  const r = azar(sem), Q = plano(x0, base, w, h), { top, x1 } = Q, ld = ladoLuz(x0 + w / 2);
  // ---- la pared de enfrente, por dentro: paneles con remaches, zocalo mas oscuro
  g.save();
  rr2(x0 + 14, top + 14, w - 40, h - 12, 26); g.fillStyle = C.panel; g.fill();
  g.clip();
  for (let x = x0 + 30; x < x1; x += 64 + r() * 20) { g.fillStyle = S(0.35); g.fillRect(x, top, 2, h); g.fillStyle = L(0.08); g.fillRect(x + 2, top, 1, h); for (let y = top + 30; y < base; y += 22) { g.fillStyle = S(0.6); g.fillRect(x + 5, y, 2, 2); } }
  g.fillStyle = C.panelO; g.fillRect(x0, Q.vy0 + Q.vh + 16, w, base - Q.vy0 - Q.vh - 16);
  g.fillStyle = L(0.12); g.fillRect(x0, Q.vy0 + Q.vh + 14, w, 2);
  // el techo por dentro: curvo y mas oscuro, con la trampilla abierta (entra luz) y lamparas rotas
  const gt = g.createLinearGradient(0, top, 0, top + 46); gt.addColorStop(0, '#1a1814'); gt.addColorStop(1, 'rgba(26,24,20,0)'); g.fillStyle = gt; g.fillRect(x0, top, w, 50);
  { const tx = x0 + w * 0.42; g.fillStyle = 'rgba(232,222,186,.5)'; g.fillRect(tx, top + 12, 70, 10); g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createLinearGradient(tx, top + 20, tx + 60, base); gl.addColorStop(0, 'rgba(255,238,190,.22)'); gl.addColorStop(1, 'rgba(255,238,190,0)'); g.fillStyle = gl; trazar(g, [[tx, top + 20], [tx + 70, top + 20], [tx + 150, base], [tx + 40, base]]); g.fill(); g.restore(); }
  for (let k = 0; k < 4; k++) { const lx = x0 + 160 + k * 200; rr2(lx, top + 26, 60, 9, 4); g.fillStyle = k === 2 ? '#3a3830' : '#7a7766'; g.fill(); tinta(g, 1); if (k === 2) { g.strokeStyle = TINTA; g.lineWidth = 1; g.beginPath(); g.moveTo(lx + 30, top + 35); g.lineTo(lx + 34, top + 52); g.stroke(); } }
  // las ventanas de enfrente: HUECAS (se ve el bosque de detras) con su goma y algun cristal
  g.globalCompositeOperation = 'destination-out';
  for (const v of Q.ventanas) { rr2(v.x + 4, v.y + 4, v.w - 8, v.h - 8, 10); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  for (const v of Q.ventanas) {
    rr2(v.x + 4, v.y + 4, v.w - 8, v.h - 8, 10); g.strokeStyle = C.goma; g.lineWidth = 5; g.stroke(); g.strokeStyle = L(0.15); g.lineWidth = 1; g.stroke();
    if (r() < 0.45) { trazar(g, [[v.x + 8, v.y + 8], [v.x + v.w * (0.4 + r() * 0.4), v.y + 8], [v.x + 8, v.y + v.h * (0.3 + r() * 0.4)]]); g.fillStyle = C.cristal; g.fill(); g.strokeStyle = L(0.4); g.lineWidth = 0.8; g.stroke(); }
  }
  g.restore();
  // ---- el pasamanos de lo alto con agarraderas, y las barras verticales
  g.strokeStyle = C.metal; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0 + 60, top + 58); g.lineTo(x1 - 200, top + 58); g.stroke(); g.strokeStyle = L(0.35); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x0 + 60, top + 56); g.lineTo(x1 - 200, top + 56); g.stroke();
  for (let x = x0 + 90; x < x1 - 210; x += 58) { const caida = 22 + r() * 8, rota = r() < 0.18; g.strokeStyle = '#2a2722'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, top + 60); g.lineTo(x + (rota ? 8 : 0), top + 60 + caida); g.stroke(); if (!rota) { g.beginPath(); g.ellipse(x, top + 68 + caida, 7, 9, 0, 0, 7); g.strokeStyle = '#5a5246'; g.lineWidth = 3; g.stroke(); } }
  for (const x of [x0 + 110, x0 + w * 0.36, x0 + w * 0.58, x1 - 215]) { g.strokeStyle = C.metal; g.lineWidth = 6; g.beginPath(); g.moveTo(x, top + 58); g.lineTo(x, base); g.stroke(); g.strokeStyle = L(0.4); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + ld * 1.5, top + 60); g.lineTo(x + ld * 1.5, base); g.stroke(); }
  // ---- asientos de perfil (mirando hacia delante): cojin, respaldo, pata; uno rajado con la espuma, otro que falta
  const asiento = (x, roto) => {
    const sy = base - 58;
    trazar(g, [[x, sy], [x + 62, sy], [x + 66, sy + 14], [x + 2, sy + 16]]); g.fillStyle = C.asiento; g.fill(); tinta(g, 1.4);
    trazar(g, [[x + 2, sy + 2], [x - 8, sy - 74], [x + 8, sy - 80], [x + 18, sy + 2]]); g.fillStyle = C.asiento; g.fill(); tinta(g, 1.4);
    g.fillStyle = rgba(C.asientoL, 0.8); g.fillRect(x + 4, sy - 1, 56, 3); trazar(g, [[x - 6, sy - 72], [x + 6, sy - 78], [x + 8, sy - 72]], true); g.fill();
    if (roto) { g.fillStyle = C.espuma; trazar(g, [[x + 18, sy + 2], [x + 34, sy - 6], [x + 46, sy + 1], [x + 30, sy + 8]]); g.fill(); tinta(g, 1); }
    g.strokeStyle = C.metalO; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 32, sy + 14); g.lineTo(x + 30, base); g.moveTo(x + 18, base); g.lineTo(x + 44, base); g.stroke();
    g.strokeStyle = C.metal; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 6, sy - 76); g.quadraticCurveTo(x - 10, sy - 92, x + 2, sy - 92); g.stroke();
  };
  for (let k = 0, x = x0 + 130; x < x1 - 270; x += 92, k++) { if (k === 3) continue; asiento(x, k === 1 || k === 5); }
  // el banco del fondo (atras, a la izquierda)
  rr2(x0 + 28, base - 66, 80, 18, 6); g.fillStyle = C.asiento; g.fill(); tinta(g, 1.4); rr2(x0 + 24, base - 150, 22, 90, 6); g.fill(); tinta(g, 1.4);
  // ---- el puesto del conductor: asiento, volante, salpicadero con relojes, la maquina de billetes
  { const cx = x1 - 175; rr2(cx, base - 64, 56, 16, 6); g.fillStyle = C.asiento; g.fill(); tinta(g, 1.4); rr2(cx - 6, base - 150, 18, 92, 6); g.fill(); tinta(g, 1.4);
    trazar(g, [[cx + 70, base - 112], [x1 - 34, base - 124], [x1 - 30, base - 84], [cx + 76, base - 76]]); g.fillStyle = '#26241e'; g.fill(); tinta(g, 1.4);
    for (const [gx, gy] of [[cx + 96, base - 104], [cx + 116, base - 108]]) { g.beginPath(); g.arc(gx, gy, 6, 0, 7); g.fillStyle = '#8a8470'; g.fill(); tinta(g, 1); g.strokeStyle = TINTA; g.lineWidth = 1; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + 4, gy - 3); g.stroke(); }
    g.save(); g.translate(cx + 82, base - 96); g.rotate(-0.5); g.beginPath(); g.ellipse(0, 0, 26, 8, 0, 0, 7); g.strokeStyle = '#141310'; g.lineWidth = 5; g.stroke(); g.restore();
    g.strokeStyle = '#141310'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx + 82, base - 96); g.lineTo(cx + 96, base - 78); g.stroke();
    rr2(cx - 40, base - 96, 24, 40, 4); g.fillStyle = '#4a4a44'; g.fill(); tinta(g, 1.2); g.fillStyle = '#1a1a16'; g.fillRect(cx - 34, base - 88, 12, 4); }
  // ---- el suelo: estrias, hojas secas, un charco con brillo y un helecho que ha crecido por un agujero
  g.fillStyle = C.suelo; g.fillRect(x0 + 14, base - 8, w - 40, 10); for (let x = x0 + 20; x < x1 - 30; x += 9) { g.fillStyle = S(0.45); g.fillRect(x, base - 7, 1.5, 7); }
  for (let k = 0; k < 40; k++) { const lx = x0 + 30 + r() * (w - 80), ly = base - 4 - r() * 6; g.save(); g.translate(lx, ly); g.rotate(r() * 6); g.beginPath(); g.ellipse(0, 0, 5 + r() * 3, 2.2, 0, 0, 7); g.fillStyle = ['#6b5636', '#4f4228', '#7d6a3e'][Math.floor(r() * 3)]; g.fill(); g.restore(); }
  { const px = x0 + w * 0.3; g.beginPath(); g.ellipse(px, base - 3, 40, 4, 0, 0, 7); g.fillStyle = 'rgba(40,46,40,.8)'; g.fill(); g.fillStyle = L(0.35); g.fillRect(px - 20, base - 5, 22, 1.4); }
  for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.32, l = 40 + r() * 26, fx = x0 + w * 0.5; g.strokeStyle = '#3e5422'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx, base - 6); g.quadraticCurveTo(fx + Math.cos(a) * l * 0.6, base - 6 + Math.sin(a) * l * 0.6, fx + Math.cos(a) * l, base - 6 + Math.sin(a) * l * 0.7 + 10); g.stroke(); for (let q = 1; q < 6; q++) { const t = q / 6, hx = fx + Math.cos(a) * l * t, hy = base - 6 + Math.sin(a) * l * t * 0.85; g.fillStyle = q % 2 ? '#5f7a2c' : '#4a6222'; g.beginPath(); g.ellipse(hx, hy, 5, 2, a + 1.2, 0, 7); g.fill(); g.beginPath(); g.ellipse(hx, hy, 5, 2, a - 1.2, 0, 7); g.fill(); } }
  // ---- la luz que entra por las ventanas de aca y cae en los asientos (aditiva) y la penumbra de las esquinas
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const v of Q.ventanas) { if (r() < 0.4) continue; const gl = g.createLinearGradient(0, v.y, 0, base); gl.addColorStop(0, 'rgba(255,236,186,.12)'); gl.addColorStop(1, 'rgba(255,236,186,0)'); g.fillStyle = gl; trazar(g, [[v.x, v.y + v.h], [v.x + v.w, v.y + v.h], [v.x + v.w + ld * 50, base], [v.x + ld * 50, base]]); g.fill(); }
  g.restore();
  const ge = g.createLinearGradient(x0, 0, x1, 0); ge.addColorStop(0, S(0.55)); ge.addColorStop(0.12, S(0)); ge.addColorStop(0.85, S(0)); ge.addColorStop(1, S(0.5)); g.fillStyle = ge; rr2(x0 + 14, top + 14, w - 40, h - 12, 26); g.fill();
  luces.push([x1 - 120, base - 100, 2.4, 0.18]);
}

export function busFuera(x0, base, w, h, sem) {
  const r = azar(sem + 1), Q = plano(x0, base, w, h), { top, x1 } = Q, ld = ladoLuz(x0 + w / 2);
  // el contorno: trasera reventada a la izquierda (jirones de chapa), frente redondeado a la derecha
  const borde = [[x0 + 40, base + 8], [x0 + 26, base - 40]];
  // (el desgarro es irregular: tramos de largo distinto, casi rectos donde la chapa aguanta y un par de mordiscos hondos;
  // con un zigzag de paso fijo se leia como una sierra)
  { let t = 0; const hondo = [0.28 + r() * 0.1, 0.62 + r() * 0.12];
    while (t < 1) { const m = hondo.some((q) => Math.abs(t - q) < 0.05) ? 20 + r() * 10 : r() * 7;
      borde.push([x0 + 30 + m, lerp(base - 50, top + 30, t)]); t += 0.035 + r() * 0.07; }
    borde.push([x0 + 32, top + 30]); }
  borde.push([x0 + 50, top + 6], [x1 - 70, top], [x1 - 30, top + 10], [x1 - 6, top + 40], [x1, top + h * 0.55], [x1 - 2, base + 8]);
  // (sin techo visto desde arriba ni frente que se vaya al fondo: el usuario los quito el 2026-10-18; de lado, como el resto)
  // ---- la chapa: crema arriba, oliva abajo, la franja mostaza; pintura que salta y deja ver el oxido
  trazar(g, borde); g.fillStyle = C.crema; g.fill();
  g.save(); trazar(g, borde); g.clip();
  const yf = Q.vy0 + Q.vh + 18;
  g.fillStyle = C.oliva; g.fillRect(x0, yf, w, base - yf + 10); g.fillStyle = C.mostaza; g.fillRect(x0, yf - 9, w, 9); g.fillStyle = L(0.3); g.fillRect(x0, yf - 9, w, 1.6);
  // costuras de paneles con remaches
  for (let x = x0 + 70; x < x1 - 40; x += 92 + r() * 30) { g.fillStyle = S(0.4); g.fillRect(x, top, 2, h + 10); for (let y = top + 10; y < base; y += 16) { g.fillStyle = S(0.55); g.fillRect(x - 4, y, 2, 2); g.fillStyle = L(0.3); g.fillRect(x - 4, y - 1, 2, 1); } }
  // sombreado de la caja: luz arriba, la panza oscura, el lado contrario al sol hundido
  const gv = g.createLinearGradient(0, top, 0, base); gv.addColorStop(0, L(0.16)); gv.addColorStop(0.45, 'rgba(0,0,0,0)'); gv.addColorStop(1, S(0.5)); g.fillStyle = gv; g.fillRect(x0, top, w, h + 10);
  const gh = g.createLinearGradient(x0, 0, x1, 0); gh.addColorStop(ld > 0 ? 0 : 1, S(0.35)); gh.addColorStop(0.5, 'rgba(0,0,0,0)'); g.fillStyle = gh; g.fillRect(x0, top, w, h + 10);
  // pintura que salta (manchas de oxido con su borde de pintura levantada) y chorretones
  for (let k = 0; k < 26; k++) { const mx = x0 + 50 + r() * (w - 100), my = top + 10 + r() * (h - 20), rx = 6 + r() * 26, ry = 4 + r() * 14; g.beginPath(); for (let q = 0; q < 9; q++) { const a = (q / 9) * Math.PI * 2, f = 0.6 + r() * 0.5; q ? g.lineTo(mx + Math.cos(a) * rx * f, my + Math.sin(a) * ry * f) : g.moveTo(mx + Math.cos(a) * rx * f, my + Math.sin(a) * ry * f); } g.closePath(); g.fillStyle = r() < 0.6 ? C.oxido : C.oxidoM; g.fill(); g.strokeStyle = L(0.35); g.lineWidth = 1; g.stroke(); }
  for (let k = 0; k < 18; k++) { const cx = x0 + 50 + r() * (w - 100), cy = top + 30 + r() * (h * 0.5), l = 20 + r() * 70; const gc = g.createLinearGradient(0, cy, 0, cy + l); gc.addColorStop(0, rgba(C.oxido, 0.55)); gc.addColorStop(1, rgba(C.oxido, 0)); g.fillStyle = gc; g.fillRect(cx, cy, 2 + r() * 3, l); }
  // abolladuras: arco de sombra abajo y de luz arriba
  for (let k = 0; k < 6; k++) { const ax = x0 + 80 + r() * (w - 200), ay = yf + 20 + r() * (base - yf - 40), rd = 10 + r() * 14; g.strokeStyle = S(0.5); g.lineWidth = 2; g.beginPath(); g.arc(ax, ay, rd, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); g.strokeStyle = L(0.35); g.beginPath(); g.arc(ax, ay - 2, rd, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); }
  // el anuncio viejo entre las ruedas: marco con un cartel desvaido
  { const ax = Q.ruedas[0] + 80, aw = Q.ruedas[1] - Q.ruedas[0] - 240, ay = yf + 14, ah = base - yf - 60; rr2(ax, ay, aw, ah, 4); g.fillStyle = '#9a8f6e'; g.fill(); g.strokeStyle = C.metalO; g.lineWidth = 4; g.stroke(); g.fillStyle = '#6d5f44'; g.fillRect(ax + 10, ay + 10, aw * 0.35, ah - 20); for (let q = 0; q < 4; q++) { g.fillStyle = S(0.35); g.fillRect(ax + aw * 0.42, ay + 14 + q * 10, aw * (0.45 - q * 0.08), 4); } g.fillStyle = 'rgba(214,206,180,.5)'; trazar(g, [[ax + aw * 0.7, ay], [ax + aw, ay], [ax + aw, ay + ah * 0.6]]); g.fill(); }
  // ---- las ventanas: HUECAS (se ve el interior) con marco grueso, goma y cristales rotos o sucios
  g.globalCompositeOperation = 'destination-out';
  for (const v of Q.ventanas) { rr2(v.x, v.y, v.w, v.h, 12); g.fill(); }
  rr2(Q.parab.x, Q.parab.y, Q.parab.w, Q.parab.h, 18); g.fill();                         // el parabrisas, sin cristal
  rr2(Q.puerta.x, top + 40, Q.puerta.w, base - top - 34, 6); g.fill();                    // la puerta de delante, abierta
  g.globalCompositeOperation = 'source-over';
  g.restore();
  for (const v of Q.ventanas) {
    rr2(v.x - 3, v.y - 3, v.w + 6, v.h + 6, 14); g.strokeStyle = C.metalO; g.lineWidth = 7; g.stroke(); tinta(g, 1.4);
    g.strokeStyle = C.goma; g.lineWidth = 2.5; rr2(v.x + 1, v.y + 1, v.w - 2, v.h - 2, 11); g.stroke();
    g.fillStyle = L(0.5); g.fillRect(v.x + 8, v.y - 4, v.w - 16, 1.4);
    const z = r();
    if (z < 0.35) { // cristal sucio entero con su reflejo
      rr2(v.x + 2, v.y + 2, v.w - 4, v.h - 4, 10); g.fillStyle = 'rgba(160,168,140,.32)'; g.fill();
      g.save(); g.clip(); g.fillStyle = 'rgba(255,250,230,.22)'; trazar(g, [[v.x + v.w * 0.15, v.y + v.h], [v.x + v.w * 0.45, v.y], [v.x + v.w * 0.62, v.y], [v.x + v.w * 0.32, v.y + v.h]]); g.fill(); g.restore();
    } else if (z < 0.75) { // roto: esquirlas que quedan en el marco
      for (let q = 0; q < 3; q++) { const c0 = [[v.x + 4, v.y + 4], [v.x + v.w - 4, v.y + 4], [v.x + v.w - 4, v.y + v.h - 4]][q]; trazar(g, [c0, [c0[0] + (q === 0 ? 1 : -1) * v.w * (0.2 + r() * 0.3), c0[1] + (q < 2 ? 1 : -1) * 6], [c0[0] + (q === 0 ? 1 : -1) * 6, c0[1] + (q < 2 ? 1 : -1) * v.h * (0.2 + r() * 0.4)]]); g.fillStyle = 'rgba(206,214,196,.35)'; g.fill(); g.strokeStyle = L(0.55); g.lineWidth = 0.9; g.stroke(); }
    }
  }
  // ---- el frente: marco del parabrisas, letrero de destino, faros, rejilla, parachoques, espejo y limpiaparabrisas
  { const P = Q.parab; rr2(P.x - 4, P.y - 4, P.w + 8, P.h + 8, 20); g.strokeStyle = C.metalO; g.lineWidth = 8; g.stroke(); tinta(g, 1.6);
    rr2(P.x + 4, top + 8, P.w - 8, 26, 4); g.fillStyle = '#1e1c16'; g.fill(); tinta(g, 1.2);
    g.fillStyle = '#c7b98a'; g.font = 'bold 17px Georgia'; g.textAlign = 'center'; g.fillText('CENTRO', P.x + P.w / 2 - 10, top + 27); g.fillText('7', P.x + P.w - 14, top + 27); g.textAlign = 'left';
    g.strokeStyle = '#1a1a16'; g.lineWidth = 3; g.beginPath(); g.moveTo(P.x + 20, P.y + P.h - 6); g.lineTo(P.x + 58, P.y + P.h - 40); g.stroke();
    // espejo en su brazo
    g.strokeStyle = C.metalO; g.lineWidth = 4; g.beginPath(); g.moveTo(x1 - 6, top + 50); g.lineTo(x1 + 24, top + 44); g.lineTo(x1 + 26, top + 70); g.stroke(); rr2(x1 + 16, top + 66, 18, 32, 5); g.fillStyle = '#2a2a24'; g.fill(); tinta(g, 1.4); g.fillStyle = L(0.4); g.fillRect(x1 + 19, top + 70, 3, 22);
    // faros: uno entero con su brillo apagado, el otro reventado y colgando de su cable
    const fy = base - 64; g.beginPath(); g.arc(x1 - 22, fy, 13, 0, 7); g.fillStyle = '#8c8670'; g.fill(); tinta(g, 1.6); g.beginPath(); g.arc(x1 - 22, fy, 8, 0, 7); g.fillStyle = '#c9c2a0'; g.fill(); g.fillStyle = L(0.7); g.beginPath(); g.arc(x1 - 25, fy - 3, 3, 0, 7); g.fill();
    g.strokeStyle = TINTA; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x1 - 22, fy + 26); g.quadraticCurveTo(x1 - 8, fy + 40, x1 - 14, fy + 54); g.stroke(); g.beginPath(); g.arc(x1 - 14, fy + 60, 7, 0, 7); g.fillStyle = '#4a4638'; g.fill(); tinta(g, 1.2);
    for (let q = 0; q < 4; q++) { g.fillStyle = S(0.7); g.fillRect(x1 - 52, base - 86 + q * 8, 22, 3); }
    rr2(x1 - 80, base - 30, 84, 14, 5); g.fillStyle = '#7c7868'; g.fill(); tinta(g, 1.6); g.fillStyle = L(0.6); g.fillRect(x1 - 76, base - 29, 76, 1.6);
    rr2(x1 - 66, base - 52, 40, 14, 2); g.fillStyle = '#c4bc9c'; g.fill(); tinta(g, 1); g.fillStyle = TINTA; g.font = '9px monospace'; g.fillText('NH 412', x1 - 62, base - 41); }
  // ---- la puerta de delante, plegada y abierta: dos hojas de cristal en angulo
  { const px = Q.puerta.x, py = top + 44; for (let q = 0; q < 2; q++) { const hx = px + 4 + q * 12; trazar(g, [[hx, py], [hx + 10, py + 6], [hx + 10, base - 8], [hx, base - 2]]); g.fillStyle = 'rgba(176,184,160,.35)'; g.fill(); g.strokeStyle = C.metalO; g.lineWidth = 3; g.stroke(); tinta(g, 1); } }
  // ---- la trasera reventada: jirones de chapa doblados hacia fuera y el piloto que cuelga
  // (dos jirones, no cuatro dientes: chapa que se dobla hacia fuera en curva, con su reves oxidado)
  for (const [k, jy] of [[0, top + 70 + r() * 30], [1, base - 120 - r() * 30]]) {
    const L0 = 34 + r() * 16, ab = 18 + r() * 12;
    g.beginPath(); g.moveTo(x0 + 34, jy); g.quadraticCurveTo(x0 + 10 - L0 * 0.3, jy - 6, x0 + 34 - L0, jy + ab * 0.45);
    g.quadraticCurveTo(x0 + 18 - L0 * 0.2, jy + ab * 0.9, x0 + 34, jy + ab); g.closePath();
    g.fillStyle = k ? C.oxido : C.crema; g.fill(); tinta(g, 1.4);
    g.strokeStyle = S(0.4); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x0 + 32, jy + ab * 0.3); g.quadraticCurveTo(x0 + 22 - L0 * 0.3, jy + ab * 0.4, x0 + 36 - L0, jy + ab * 0.48); g.stroke(); }
  { g.strokeStyle = TINTA; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x0 + 40, base - 70); g.quadraticCurveTo(x0 + 26, base - 54, x0 + 30, base - 40); g.stroke(); rr2(x0 + 22, base - 42, 16, 22, 4); g.fillStyle = '#5a2a22'; g.fill(); tinta(g, 1.2); }
  // ---- las ruedas, hundidas en la tierra: cubierta pinchada, llanta oxidada con sus tuercas y el paso de rueda
  for (const rx of Q.ruedas) {
    const ry = base - 18, R = 44;
    g.beginPath(); g.arc(rx, ry + 4, R + 10, Math.PI, 0); g.fillStyle = C.hueco; g.fill(); tinta(g, 1.8);
    g.beginPath(); g.ellipse(rx, ry, R, R * 0.9, 0, 0, 7); g.fillStyle = C.goma; g.fill(); tinta(g, 2);
    g.strokeStyle = 'rgba(70,66,58,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(rx, ry, R - 8, 0, 7); g.stroke();
    g.beginPath(); g.arc(rx, ry, R * 0.55, 0, 7); g.fillStyle = '#6a6250'; g.fill(); tinta(g, 1.4);
    g.fillStyle = rgba(C.oxido, 0.6); g.beginPath(); g.arc(rx + 4, ry + 6, R * 0.4, 0, 7); g.fill();
    for (let q = 0; q < 6; q++) { const a = (q / 6) * Math.PI * 2; g.fillStyle = '#2a2822'; g.beginPath(); g.arc(rx + Math.cos(a) * R * 0.32, ry + Math.sin(a) * R * 0.32, 3, 0, 7); g.fill(); }
    g.beginPath(); g.arc(rx, ry, 7, 0, 7); g.fillStyle = '#4a463c'; g.fill(); tinta(g, 1);
    g.strokeStyle = L(0.35); g.lineWidth = 2; g.beginPath(); g.arc(rx, ry, R * 0.55, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
  }
  trazar(g, borde); tinta(g, 2.6);
  // ---- lo de arriba: la caja del aire, la trampilla abierta, el musgo del borde, la hiedra que cuelga y un arbolillo
  { const ax = x0 + w * 0.6; rr2(ax, top - 22, 120, 26, 6); g.fillStyle = '#7c7660'; g.fill(); tinta(g, 1.6); for (let q = 0; q < 8; q++) { g.fillStyle = S(0.5); g.fillRect(ax + 10 + q * 13, top - 16, 6, 14); } }
  { const tx = x0 + w * 0.42; trazar(g, [[tx, top + 2], [tx + 70, top + 2], [tx + 60, top - 30], [tx - 6, top - 24]]); g.fillStyle = '#6a6450'; g.fill(); tinta(g, 1.6); }
  for (let x = x0 + 50; x < x1 - 50; x += 10 + r() * 12) { g.fillStyle = r() < 0.5 ? '#4f5e26' : '#677a30'; g.beginPath(); g.ellipse(x, top + 2, 10 + r() * 12, 5 + r() * 4, 0, Math.PI, 0); g.fill(); }
  for (let k = 0; k < 7; k++) { const hx = x0 + 70 + r() * (w - 160), largo = 30 + r() * 90; g.strokeStyle = '#33461c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(hx, top + 2); g.quadraticCurveTo(hx + (r() - 0.5) * 20, top + largo * 0.5, hx + (r() - 0.5) * 16, top + largo); g.stroke(); for (let q = 0; q < largo / 9; q++) { const t = q / (largo / 9), lx = hx + Math.sin(q * 1.3) * 5, ly = top + 4 + t * largo; g.fillStyle = q % 3 ? '#4f6426' : '#6f8434'; g.beginPath(); g.ellipse(lx, ly, 5, 3.4, q, 0, 7); g.fill(); g.strokeStyle = TINTA; g.lineWidth = 0.8; g.stroke(); } }
  { const sx = x0 + w * 0.22; g.strokeStyle = '#3e3020'; g.lineWidth = 5; g.beginPath(); g.moveTo(sx, top + 2); g.quadraticCurveTo(sx - 6, top - 40, sx + 4, top - 80); g.stroke(); hojas(sx + 2, top - 92, 40, 30, 0.03, sem + 7, { den: 0.9, tam: 8 }); }
}
