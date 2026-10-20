// EL LINDE · ATREZO A LA ESCALA DEL JUEGO (nivel 6)
// Las piezas del concepto se pintaron para un plano lejano, y en el juego estaban a media escala: junto al 18
// (50 u = 137 px; el mundo va a 64 u el metro, como el coche de la ciudad) la puerta de la cabana le llegaba al
// hombro y el autobus no le doblaba la altura. `aEscala` pinta una pieza del concepto ampliada SIN engordar la
// tinta: un Proxy del contexto divide el grosor de linea por la escala, y las luces que la pieza apunta se llevan
// a su sitio. Y aqui va lo que en el juego tiene que AGUANTAR algo y en el concepto no estaba: el tablado de las
// copas y los puentes de tablas, los pilotes y las cuerdas de las tablas podridas, las perchas de las cuerdas, las
// lianas de las anclas del gancho; y el penasco con su cascada y la orilla del agua.
// Todo en px del concepto (como obrero.js) y en `g`.
import { TINTA, azar, rgba, mezclar, trazar, tinta } from '../dibujo/tinta.js';
import { g, ponerG, sueloY, ARROYO, ponerTerreno, luces, brillos, tono, ladoLuz, brillo, lerp, RELIEVE } from './base.js';
import { roca, cascada, hierba } from './suelo.js';
import { hojas, liana } from './follaje.js';
import { tronco } from './troncos.js';

// ---------------------------------------------------------------- una pieza del concepto, s veces mas grande
// (cx, by): el punto que no se mueve (el pie de la pieza). El suelo que lea la pieza es el del mundo bajo ella.
export function aEscala(cx, by, s, fn) {
  const real = g, nl = luces.length, nb = brillos.length, suelo = sueloY, arroyo = ARROYO, cache = new Map();
  const P = new Proxy(real, {
    get(t, k) {
      if (k === 'lineWidth') return t.lineWidth * s;
      const v = t[k];
      if (typeof v !== 'function') return v;
      let f = cache.get(k); if (!f) { f = v.bind(t); cache.set(k, f); }
      return f;
    },
    set(t, k, v) { if (k === 'lineWidth') t.lineWidth = v / s; else t[k] = v; return true; },
  });
  real.save(); real.translate(cx, by); real.scale(s, s); real.translate(-cx, -by);
  ponerG(P); ponerTerreno((x) => by + (suelo(cx + (x - cx) * s) - by) / s, arroyo);
  try { fn(); } finally {
    ponerG(real); ponerTerreno(suelo, arroyo); real.restore();
    const lleva = (x, y) => [cx + (x - cx) * s, by + (y - by) * s];
    for (let k = nl; k < luces.length; k++) { const [x, y, r, a] = luces[k]; luces[k] = [...lleva(x, y), r * s, a]; }
    for (let k = nb; k < brillos.length; k++) { const [x, y, r, col, a] = brillos[k]; brillos[k] = [...lleva(x, y), r * s, col, a]; }
  }
}

// ---------------------------------------------------------------- madera y cuerda
const M = { osc: '#0f0d09', som: '#2e2c1d', som2: '#413721', med: '#57492f', cla: '#7a6a49', luz: '#c0a374', pico: '#e3d5ad', viga: '#2a2216', viga2: '#3b3020', cuerda: '#6a5a3e', cuerdaL: '#b09a72' };
const camino = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); };
// una cuerda: tinta, el cuerpo y el trenzado (rayitas claras)
export function cuerda(pts, w = 3) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  camino(pts); g.strokeStyle = TINTA; g.lineWidth = w + 2.4; g.stroke();
  camino(pts); g.strokeStyle = M.cuerda; g.lineWidth = w; g.stroke();
  g.save(); g.setLineDash([2.2, 3.6]); camino(pts); g.strokeStyle = rgba(M.cuerdaL, 0.85); g.lineWidth = Math.max(0.8, w * 0.42); g.stroke(); g.restore();
}
// los puntos de una cuerda combada (sag > 0 cuelga)
export const combada = (x0, y0, x1, y1, sag, n = 18) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n; return [lerp(x0, x1, t), lerp(y0, y1, t) + Math.sin(Math.PI * t) * sag]; });
// un madero (rectangulo) con veta, canto de luz arriba, sombra abajo y tinta
function madero(x, y, w, h, rr, o = {}) {
  const col = o.col ?? [M.som2, M.med, M.som, M.cla][Math.floor(rr() * 4)];
  g.fillStyle = col; g.fillRect(x, y, w, h);
  g.fillStyle = rgba(M.osc, 0.42); g.fillRect(x, y + h * 0.7, w, h * 0.3);
  g.fillStyle = rgba(M.luz, o.luz ?? 0.8); g.fillRect(x + 1, y, w - 2, Math.max(1.4, Math.min(3, h * 0.16)));
  g.strokeStyle = rgba(M.osc, 0.5); g.lineWidth = 1; g.beginPath();
  if (w > h) { const gy = y + h * (0.35 + rr() * 0.3); g.moveTo(x + 3, gy); g.lineTo(x + w - 3, gy + (rr() - 0.5) * 2); }
  else { const gx = x + w * (0.3 + rr() * 0.4); g.moveTo(gx, y + 4); g.lineTo(gx + (rr() - 0.5) * 2, y + h - 4); }
  g.stroke();
  if (rr() < (o.clavos ?? 0.35)) { g.fillStyle = M.osc; g.fillRect(x + 3 + rr() * Math.max(1, w - 8), y + Math.min(h - 3, 3 + rr() * 3), 2.2, 2.2); }
  g.strokeStyle = TINTA; g.lineWidth = o.tinta ?? 1.5; g.strokeRect(x, y, w, h);
}
// los tramos de [x0, x1] que no caen en ningun hueco [[a, b]]
function tramos(x0, x1, huecos = []) {
  const hs = huecos.slice().sort((p, q) => p[0] - q[0]), out = []; let a = x0;
  for (const [ha, hb] of hs) { if (hb <= a || ha >= x1) continue; if (ha > a) out.push([a, ha]); a = Math.max(a, hb); }
  if (a < x1) out.push([a, x1]);
  return out;
}

// ---------------------------------------------------------------- TABLADO de tablas colgado
// La pasarela por las copas (o.copas: postes cada tanto y tirantes que suben a las ramas, fuera de la vista) y los
// puentes de la aldea (o.puente: solo los postes de los extremos y pendolas de la barandilla al tablero). Tablones
// vistos de canto sobre su larguero; en los huecos (las tablas podridas del mapa, que pinta el juego y caen) se
// corta el tablero y siguen las cuerdas. y: la cara de arriba (la de la casilla), en px.
export function tablado(x0, x1, y, o = {}) {
  const rr = azar(o.semilla ?? Math.floor(x0)), TH = 12, LH = 15, RAIL = o.baranda ?? 112;
  const hueco = (x) => (o.huecos || []).some(([a, b]) => x > a - 10 && x < b + 10);
  const ps = [x0 + 7];
  if (!o.puente) { const paso = o.postes ?? 270; for (let x = x0 + paso; x < x1 - paso * 0.45; x += paso) if (!hueco(x)) ps.push(x); }
  ps.push(x1 - 7);
  // tirantes (detras de todo): del poste a las ramas de arriba, abiertos hacia fuera
  if (o.copas) ps.forEach((x, k) => { const s = k === 0 ? -1 : k === ps.length - 1 ? 1 : k % 2 ? 1 : -1; cuerda([[x, y - RAIL - 6], [x + s * (70 + rr() * 90), y - RAIL - 1000]], 2.4); });
  // barandilla: la cuerda de arriba y la del medio, de poste a poste (en el puente de punta a punta, mas combada)
  const tramosRail = []; for (let k = 0; k + 1 < ps.length; k++) tramosRail.push([ps[k], ps[k + 1]]);
  const sagA = (a, b) => Math.min(o.puente ? 70 : 22, (b - a) * (o.puente ? 0.06 : 0.05));
  for (const [a, b] of tramosRail) {
    const arriba = combada(a, y - RAIL, b, y - RAIL, sagA(a, b));
    // pendolas (puente): de la barandilla al larguero
    if (o.puente) for (let k = 1; k < arriba.length - 1; k++) { const [px, py] = arriba[k]; g.strokeStyle = TINTA; g.lineWidth = 2.2; g.beginPath(); g.moveTo(px, py); g.lineTo(px, y + (hueco(px) ? -18 - rr() * 30 : TH)); g.stroke(); g.strokeStyle = M.cuerda; g.lineWidth = 1; g.stroke(); }
    cuerda(arriba, 3.2);
    cuerda(combada(a, y - RAIL * 0.5, b, y - RAIL * 0.5, sagA(a, b) * 0.6), 2.4);
  }
  // larguero bajo los tablones (roto en los huecos: astillas)
  for (const [a, b] of tramos(x0, x1, o.huecos)) {
    const pts = [[a, y + TH], [b, y + TH], [b, y + TH + LH], [a, y + TH + LH]];
    if (a > x0 + 1) { pts[0] = [a + 6, y + TH]; pts[3] = [a - 4, y + TH + LH * 0.6]; pts.splice(3, 0, [a + 9, y + TH + LH]); }
    if (b < x1 - 1) { pts[1] = [b - 7, y + TH]; pts[2] = [b + 5, y + TH + LH * 0.5]; pts.splice(3, 0, [b - 4, y + TH + LH]); }
    trazar(g, pts); g.fillStyle = M.viga; g.fill(); g.fillStyle = rgba(M.luz, 0.35); g.fillRect(a + 4, y + TH + 1, b - a - 8, 1.5); tinta(g, 1.6);
    for (let x = a + 20; x < b - 10; x += 60 + rr() * 30) { g.fillStyle = '#5a5246'; g.beginPath(); g.arc(x, y + TH + LH * 0.55, 2.2, 0, 7); g.fill(); }
    // tablones vistos de canto, de ancho distinto, con su junta; alguno torcido
    for (let x = a; x < b - 2;) {
      const w = Math.min(b - x, 26 + rr() * 14), tor = rr() < 0.08 ? (rr() - 0.5) * 3 : 0;
      g.save(); g.translate(0, tor); madero(x, y, w - 2, TH, rr, { clavos: 0.5, luz: 0.9 }); g.restore();
      x += w;
    }
  }
  // postes (los del medio bajan hasta el larguero; los de los extremos, un poco mas, a su apoyo)
  ps.forEach((x, k) => {
    const fin = k === 0 || k === ps.length - 1, top = y - RAIL - 10, bot = y + TH + LH + (fin ? 24 : 6);
    madero(x - 6, top, 12, bot - top, rr, { col: M.viga2, luz: 0.5 });
    g.fillStyle = M.viga; g.fillRect(x - 8, top - 5, 16, 6); g.strokeStyle = TINTA; g.lineWidth = 1.2; g.strokeRect(x - 8, top - 5, 16, 6);
    // la cuerda da una vuelta al poste
    for (const yy of [y - RAIL, y - RAIL * 0.5]) { g.strokeStyle = TINTA; g.lineWidth = 3.4; g.beginPath(); g.ellipse(x, yy, 8, 3.4, 0, 0, 7); g.stroke(); g.strokeStyle = M.cuerda; g.lineWidth = 1.6; g.stroke(); }
  });
}

// ---------------------------------------------------------------- lo que aguanta las TABLAS PODRIDAS del mapa
// Las tablas las pinta el juego (caen al pisarlas); aqui va lo que queda cuando caen. Sobre el agua: pilotes de
// madera mojada con su cabezal y una cruz rota (yAgua: la lamina). En el aire: dos cuerdas que suben a las ramas.
// y: la cara de arriba de la casilla (px); la tabla del juego mide 12 u (33 px).
export function pilotes(x0, x1, y, yAgua, sem) {
  const rr = azar(sem), yC = y + 34, xs = [x0 + 22, x1 - 22];
  if (x1 - x0 > 300) xs.splice(1, 0, (x0 + x1) / 2);
  const ld = ladoLuz((x0 + x1) / 2);
  // la cruz rota entre los dos primeros
  { const a = xs[0], b = xs[1]; g.save(); g.lineCap = 'butt';
    for (const [p, q] of [[[a, yC + 24], [lerp(a, b, 0.62), lerp(yC + 24, yAgua - 10, 0.62)]], [[b, yC + 24], [a + 6, yAgua - 6]]]) { g.strokeStyle = TINTA; g.lineWidth = 13; g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke(); g.strokeStyle = M.som2; g.lineWidth = 9; g.stroke(); g.strokeStyle = rgba(M.luz, 0.5); g.lineWidth = 1.5; g.beginPath(); g.moveTo(p[0], p[1] - 3); g.lineTo(q[0], q[1] - 3); g.stroke(); }
    g.restore(); }
  for (const x of xs) {
    const w = 22 + rr() * 6, bot = yAgua + 70, top = yC - 6;
    const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, M.med); gr.addColorStop(0.55, M.som2); gr.addColorStop(0.8, '#1d1a10'); gr.addColorStop(1, '#0d0c08');
    g.fillStyle = gr; g.fillRect(x - w / 2, top, w, bot - top);
    g.fillStyle = rgba(M.luz, 0.75); g.fillRect(ld > 0 ? x + w / 2 - 5 : x - w / 2 + 1, top + 2, 4, (yAgua - top) * 0.9);
    g.strokeStyle = rgba(M.osc, 0.55); g.lineWidth = 1; g.beginPath(); for (let k = 0; k < 3; k++) { const gx = x - w / 2 + 4 + rr() * (w - 8); g.moveTo(gx, top + 6); g.lineTo(gx + (rr() - 0.5) * 3, yAgua - 6); } g.stroke();
    // la marca del agua: lo mojado mas oscuro y una linea de verdin
    g.fillStyle = rgba('#3c4228', 0.8); g.fillRect(x - w / 2, yAgua - 16, w, 7);
    g.strokeStyle = TINTA; g.lineWidth = 1.6; g.strokeRect(x - w / 2, top, w, bot - top);
  }
  madero(x0 - 6, yC, x1 - x0 + 12, 18, rr, { col: M.viga, luz: 0.55, clavos: 1 });
}
export function colgadas(x0, x1, y, sem) {
  const rr = azar(sem);
  for (const [x, s] of [[x0 + 12, -1], [x1 - 12, 1]]) {
    cuerda([[x, y + 6], [x + s * (40 + rr() * 50), y - 1000]], 2.6);
    // el cabo deshilachado donde estaba atada la tabla
    g.strokeStyle = M.cuerdaL; g.lineWidth = 1; g.beginPath(); for (let k = 0; k < 4; k++) { g.moveTo(x, y + 6); g.lineTo(x + (k - 1.5) * 3, y + 14 + rr() * 6); } g.stroke();
  }
}

// ---------------------------------------------------------------- PERCHA de una cuerda del mapa
// Las cuerdas colgaban de nada. Un poste sale del extremo del tablero de al lado (xp: su borde, yDeck: su cara de
// arriba) y un brazo pasa por encima de la cuerda (xr), que esta atada con vueltas y un nudo. yTop: donde empieza
// la cuerda que pinta el terreno (px).
export function percha(xr, yTop, xp, yDeck, sem) {
  const rr = azar(sem), yb = yTop - 30, lado = Math.sign(xr - xp) || 1;
  // tornapunta: del poste al brazo
  g.save(); g.lineCap = 'butt';
  const pa = [xp, yb + 74], pb = [lerp(xp, xr, 0.62), yb + 10];
  g.strokeStyle = TINTA; g.lineWidth = 11; g.beginPath(); g.moveTo(...pa); g.lineTo(...pb); g.stroke(); g.strokeStyle = M.som2; g.lineWidth = 7.5; g.stroke();
  g.restore();
  madero(xp - 7, yb - 12, 14, yDeck - yb + 40, rr, { col: M.viga2, luz: 0.5 });
  const xa = Math.min(xp, xr + lado * 18), xb = Math.max(xp, xr + lado * 18);
  madero(xa - (lado < 0 ? 0 : 8), yb, xb - xa + 8, 13, rr, { col: M.viga, luz: 0.7, clavos: 1 });
  // la cuerda: baja del brazo, tres vueltas y el nudo
  cuerda([[xr, yb + 6], [xr, yTop + 4]], 3.2);
  for (let k = 0; k < 3; k++) { const yy = yb + 3 + k * 4; g.strokeStyle = TINTA; g.lineWidth = 3.2; g.beginPath(); g.ellipse(xr, yy, 9, 3, 0, 0, 7); g.stroke(); g.strokeStyle = M.cuerda; g.lineWidth = 1.6; g.stroke(); }
  g.beginPath(); g.ellipse(xr + 2, yb + 22, 6, 5, 0.4, 0, 7); g.fillStyle = M.cuerda; g.fill(); tinta(g, 1.6);
  g.strokeStyle = M.cuerdaL; g.lineWidth = 1.2; g.beginPath(); g.moveTo(xr + 5, yb + 24); g.quadraticCurveTo(xr + 14, yb + 34, xr + 10, yb + 46); g.stroke();
}

// ---------------------------------------------------------------- la LIANA de un ancla del gancho
// La anilla del gancho colgaba en el aire. Ahora cuelga de una liana gruesa que baja de las ramas (fuera de la
// vista) y acaba en un collar de hierro con su eslabon; el perno y la anilla los pinta el juego (y: su centro).
export function lianaAncla(x, y, sem) {
  const rr = azar(sem), yf = y - 36, x0 = x + (rr() - 0.5) * 160;
  liana(x0, yf - 1100, x, yf, 40 + rr() * 30, 0.02, sem, 6.5);
  liana(x0 + 26, yf - 1100, x + 3, yf - 4, 50 + rr() * 30, 0.02, sem + 1, 4);
  g.fillStyle = '#4b525a'; g.fillRect(x - 7, yf - 6, 14, 9); g.strokeStyle = TINTA; g.lineWidth = 1.6; g.strokeRect(x - 7, yf - 6, 14, 9);
  g.fillStyle = 'rgba(214,220,226,.6)'; g.fillRect(x - 6, yf - 5, 12, 1.4);
}

// ---------------------------------------------------------------- INVERNADERO a escala
// El del concepto era un arco de alambre con un velo: ampliado, se leia como un arco de jardin. Este tiene zocalo
// de piedra, armazon de montantes y travesanos, tejado a dos aguas con su cumbrera, cristales con reflejo (alguno
// roto, alguno sucio), la puerta y las plantas de dentro vistas a traves del cristal. x: su centro, y: su suelo.
export function invernadero(x, y, w, h, sem) {
  const nx = 6, rr = azar(sem), x0 = x - w / 2, x1 = x + w / 2, zh = h * 0.13, yw = y - h * 0.62, yc = y - h;
  const ld = ladoLuz(x), ym = yw + (y - zh - yw) * 0.5;
  const S = (a) => rgba(M.osc, a), L = (a) => rgba(M.pico, a);
  const seg = (a, b, wv, col) => { g.strokeStyle = col; g.lineWidth = wv; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
  const frente = [[x0, y - zh], [x0, yw], [x, yc], [x1, yw], [x1, y - zh]];
  if (RELIEVE) {
    // CON FONDO: el armazon de la cara de atras se ve a traves del cristal (mas apagado), y el costado del lado del
    // sol se va al fondo con su cristal, su faldon y su zocalo
    const dx = ld * w * 0.24, dy = -h * 0.16, xs = ld > 0 ? x1 : x0, B = (p) => [p[0] + dx, p[1] + dy];
    const atras = 'rgba(34,36,26,.75)';
    for (let k = 0; k <= nx; k++) { const a = lerp(x0, x1, k / nx); seg(B([a, y - zh]), B([a, yw]), 3, atras); }
    seg(B([x0, yw]), B([x1, yw]), 3, atras); seg(B([x0, yw]), B([x, yc]), 3.5, atras); seg(B([x, yc]), B([x1, yw]), 3.5, atras);
    trazar(g, [[xs, y], [xs, y - zh], B([xs, y - zh]), B([xs, y])]); g.fillStyle = '#3a382f'; g.fill(); tinta(g, 1.2);
    trazar(g, [[xs, y - zh], [xs, yw], B([xs, yw]), B([xs, y - zh])]); g.fillStyle = 'rgba(176,186,146,.24)'; g.fill();
    trazar(g, [[xs, yw], [x, yc], B([x, yc]), B([xs, yw])]); g.fillStyle = 'rgba(206,214,184,.22)'; g.fill();
    for (let k = 1; k < 3; k++) { const t = k / 3; seg([xs + dx * t, y - zh + dy * t], [xs + dx * t, yw + dy * t], 3, '#3a3a2c'); seg([xs + dx * t, yw + dy * t], [x + dx * t, yc + dy * t], 2.5, '#3a3a2c'); }
    for (const p of [[xs, y - zh], [xs, yw], [x, yc]]) seg(p, B(p), 4.5, '#34342a');
    seg(B([xs, y - zh]), B([xs, yw]), 4, '#34342a');
  }

  // ---- DENTRO: penumbra verde (mas oscura arriba y al fondo), el suelo de tierra
  trazar(g, frente); const gi = g.createLinearGradient(0, yc, 0, y); gi.addColorStop(0, 'rgba(26,32,20,.72)'); gi.addColorStop(1, 'rgba(46,54,32,.6)'); g.fillStyle = gi; g.fill();
  g.save(); trazar(g, frente); g.clip();
  g.fillStyle = '#2a241a'; g.fillRect(x0, y - zh - 14, w, 14);
  // la luz que entra por el tejado en haces calidos, hasta la mesa
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) { const bx = lerp(x0, x1, 0.25 + k * 0.25) + (rr() - 0.5) * 30, gr = g.createLinearGradient(bx, yw, bx + ld * 40, y - zh - 60); gr.addColorStop(0, 'rgba(255,236,180,.16)'); gr.addColorStop(1, 'rgba(255,236,180,0)'); g.fillStyle = gr; trazar(g, [[bx - 14, yw - 20], [bx + 14, yw - 20], [bx + ld * 40 + 34, y - zh - 50], [bx + ld * 40 - 30, y - zh - 50]]); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  // la mesa de tablas del fondo con sus patas y las macetas encima
  const my = y - zh - 74;
  for (const px of [x0 + 26, x1 - 32, x - 3]) madero(px, my, 6, y - zh - my, rr, { col: M.som2, luz: 0.3, tinta: 1.2 });
  madero(x0 + 16, my - 8, w - 32, 9, rr, { col: M.med, luz: 0.7, clavos: 1 });
  for (let k = 0; k < 7; k++) {
    const px = x0 + 40 + k * ((w - 80) / 6) + (rr() - 0.5) * 10, pw = 16 + rr() * 8, ph = 14 + rr() * 6;
    trazar(g, [[px - pw / 2, my - 8 - ph], [px + pw / 2, my - 8 - ph], [px + pw * 0.38, my - 8], [px - pw * 0.38, my - 8]]); g.fillStyle = k % 3 ? '#6e5038' : '#5c4532'; g.fill();
    g.fillStyle = S(0.35); g.fillRect(ld > 0 ? px - pw / 2 : px, my - 8 - ph, pw / 2, ph); g.fillStyle = '#7d5c40'; g.fillRect(px - pw / 2 - 1, my - 8 - ph - 3, pw + 2, 4); tinta(g, 1.1);
    if (k !== 4) hojas(px, my - 14 - ph, 12 + rr() * 8, 10 + rr() * 8, 0.04, sem + 40 + k, { den: 0.9, tam: 6 });
  }
  // tomateras en su cana, con frutos apagados, y una regadera de lata en el suelo
  for (let k = 0; k < 2; k++) {
    const px = lerp(x0, x1, 0.2 + k * 0.58), top = yw + 26 + rr() * 30;
    seg([px, y - zh], [px + 2, top], 2.6, '#5a4a30');
    for (let q = 0; q < 4; q++) hojas(px + (rr() - 0.5) * 24, lerp(top, y - zh - 30, q / 3), 18 + rr() * 8, 14 + rr() * 6, 0.04, sem + 60 + k * 10 + q, { den: 0.9, tam: 7 });
    for (let q = 0; q < 6; q++) { const fx = px + (rr() - 0.5) * 30, fy = lerp(top + 20, y - zh - 30, rr()), fr = 3.5 + rr() * 2.5; g.beginPath(); g.arc(fx, fy, fr, 0, 7); g.fillStyle = q % 3 ? '#7e3a2a' : '#8c6a30'; g.fill(); tinta(g, 0.9); g.fillStyle = L(0.6); g.beginPath(); g.arc(fx - 1, fy - 1.2, 1, 0, 7); g.fill(); }
  }
  { const px = x + w * 0.16, py = y - zh - 2; trazar(g, [[px, py], [px, py - 22], [px + 26, py - 22], [px + 26, py]]); g.fillStyle = '#5a5c56'; g.fill(); g.fillStyle = L(0.3); g.fillRect(ld > 0 ? px + 20 : px + 1, py - 22, 4, 22); tinta(g, 1.2); seg([px + 26, py - 16], [px + 42, py - 30], 3, '#5a5c56'); g.strokeStyle = '#5a5c56'; g.lineWidth = 2.4; g.beginPath(); g.arc(px + 13, py - 22, 9, Math.PI, 0); g.stroke(); }
  // una maceta colgada de la cumbrera con su planta que cae
  { const px = x - w * 0.2, py = yw + 30; seg([px, py - 10], [x - w * 0.17, yc + 24], 1, M.cuerda); seg([px, py - 10], [x - w * 0.23, yc + 30], 1, M.cuerda); trazar(g, [[px - 12, py - 10], [px + 12, py - 10], [px + 8, py + 4], [px - 8, py + 4]]); g.fillStyle = '#5c4532'; g.fill(); tinta(g, 1); for (let q = 0; q < 4; q++) { g.strokeStyle = '#3e5422'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(px - 8 + q * 5, py + 2); g.quadraticCurveTo(px - 10 + q * 6, py + 26, px - 6 + q * 5, py + 34 + rr() * 16); g.stroke(); } hojas(px, py - 12, 16, 8, 0.04, sem + 80, { den: 0.9, tam: 6 }); }
  g.restore();

  // ---- CRISTALES: verdin abajo, vaho, reflejo del cielo en diagonal, grietas; alguno falta (esquirlas) y uno del
  // tejado esta abierto (el ventano)
  const paneles = [];
  for (let k = 0; k < nx; k++) { const a = lerp(x0, x1, k / nx), b = lerp(x0, x1, (k + 1) / nx); paneles.push([[a, y - zh], [a, ym], [b, ym], [b, y - zh]], [[a, ym], [a, yw], [b, yw], [b, ym]]); }
  const techo = (t) => (t <= 0.5 ? [lerp(x0, x, t * 2), lerp(yw, yc, t * 2)] : [lerp(x, x1, (t - 0.5) * 2), lerp(yc, yw, (t - 0.5) * 2)]);
  for (let k = 0; k < 8; k++) { const a = techo(k / 8), b = techo((k + 1) / 8); paneles.push([a, b, [b[0], yw], [a[0], yw]]); }
  const ventano = ld > 0 ? 5 : 2;                                   // el del faldon al sol, abierto
  paneles.forEach((pn, i) => {
    const z = rr(), xs = pn.map((p) => p[0]), ys = pn.map((p) => p[1]), mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
    if (i === 2 * nx + ventano) {
      // abierto: la hoja de cristal levantada sobre su bisagra de arriba, con el hueco oscuro debajo
      trazar(g, pn); g.fillStyle = S(0.45); g.fill();
      const [a, b] = [pn[0], pn[1]], lev = [[a[0], a[1]], [b[0], b[1]], [b[0] + ld * 6, b[1] - 26], [a[0] + ld * 6, a[1] - 26]];
      trazar(g, lev); g.fillStyle = 'rgba(214,228,216,.3)'; g.fill(); tinta(g, 1.6); seg([lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5)], [lerp(a[0], b[0], 0.5) + ld * 3, lerp(a[1], b[1], 0.5) - 13], 2, '#3a3c34');
      return;
    }
    if (z < 0.1 && i < 2 * nx) {
      trazar(g, pn); g.fillStyle = 'rgba(10,12,8,.55)'; g.fill();
      const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
      for (let q = 0; q < 4; q++) { const p0 = pn[q], p1 = pn[(q + 1) % 4]; trazar(g, [p0, [lerp(p0[0], cx, 0.35 + rr() * 0.25), lerp(p0[1], cy, 0.35 + rr() * 0.25)], [lerp(p1[0], cx, 0.15), lerp(p1[1], cy, 0.15)], p1]); g.fillStyle = 'rgba(214,226,214,.32)'; g.fill(); g.strokeStyle = L(0.5); g.lineWidth = 0.8; g.stroke(); }
      return;
    }
    g.save(); trazar(g, pn); g.clip();
    const gv = g.createLinearGradient(0, mny, 0, mxy); gv.addColorStop(0, 'rgba(222,232,218,.24)'); gv.addColorStop(0.6, 'rgba(176,188,150,.2)'); gv.addColorStop(1, 'rgba(120,136,84,.38)'); g.fillStyle = gv; g.fillRect(mnx, mny, mxx - mnx, mxy - mny);
    // verdin en el canto de abajo (a manchas) y vaho por dentro
    for (let q = 0; q < 5; q++) { const vx = mnx + rr() * (mxx - mnx), r = 6 + rr() * 14; const gm = g.createRadialGradient(vx, mxy, 0, vx, mxy, r * 1.6); gm.addColorStop(0, 'rgba(70,84,34,.5)'); gm.addColorStop(1, 'rgba(70,84,34,0)'); g.fillStyle = gm; g.fillRect(vx - r * 2, mxy - r * 2, r * 4, r * 2); }
    if (rr() < 0.6) { const vx = mnx + rr() * (mxx - mnx), vy = mny + rr() * (mxy - mny), r = 14 + rr() * 18; const gf = g.createRadialGradient(vx, vy, 0, vx, vy, r); gf.addColorStop(0, 'rgba(236,240,226,.16)'); gf.addColorStop(1, 'rgba(236,240,226,0)'); g.fillStyle = gf; g.fillRect(vx - r, vy - r, r * 2, r * 2); }
    // el reflejo del cielo: dos bandas en diagonal
    const o = (mxy - mny) * 0.8;
    for (const [u0, u1, a] of [[0.12, 0.34, 0.24], [0.42, 0.5, 0.14]]) { g.fillStyle = `rgba(255,252,232,${a})`; g.beginPath(); g.moveTo(mnx + (mxx - mnx) * u0, mxy); g.lineTo(mnx + (mxx - mnx) * u0 + o, mny); g.lineTo(mnx + (mxx - mnx) * u1 + o, mny); g.lineTo(mnx + (mxx - mnx) * u1, mxy); g.closePath(); g.fill(); }
    // grieta
    if (z > 0.82) { let gx = mnx + (mxx - mnx) * (0.3 + rr() * 0.4), gy = mny + 4; g.strokeStyle = L(0.6); g.lineWidth = 0.9; g.beginPath(); g.moveTo(gx, gy); for (let q = 0; q < 5; q++) { gx += (rr() - 0.5) * 14; gy += (mxy - mny) / 5; g.lineTo(gx, gy); } g.stroke(); }
    g.restore();
  });
  // ---- el ARMAZON: montantes, travesano, alero, barras del tejado y cumbrera; el canto al sol de cada montante
  const viga = (pts, wv) => { cuerdaLisa(pts, wv); };
  for (let k = 0; k <= nx; k++) { const a = lerp(x0, x1, k / nx); viga([[a, y - zh], [a, yw]], k === 0 || k === nx ? 7 : 5); seg([a + ld * 2, y - zh], [a + ld * 2, yw], 1, L(0.45)); }
  viga([[x0, ym], [x1, ym]], 4); viga([[x0, yw], [x1, yw]], 6);
  for (let k = 1; k < 8; k++) { const p = techo(k / 8); viga([[p[0], p[1]], [p[0], yw]], 3.5); }
  viga([[x0 - 10, yw + 6], [x, yc], [x1 + 10, yw + 6]], 8);
  // ---- la PUERTA de cristal, entornada: la hoja corrida y la rendija oscura
  { const pw = w * 0.17, ph = (y - zh - yw) * 0.95 + zh, px = x - pw / 2;
    g.fillStyle = 'rgba(14,16,10,.75)'; g.fillRect(px, y - ph, pw, ph);
    const hx = px + (ld > 0 ? 9 : -9);
    trazar(g, [[hx, y - ph + 2], [hx + pw, y - ph], [hx + pw, y], [hx, y]]); g.fillStyle = 'rgba(200,214,196,.22)'; g.fill();
    viga([[hx, y], [hx, y - ph + 2], [hx + pw, y - ph], [hx + pw, y]], 5); viga([[hx, y - ph * 0.5], [hx + pw, y - ph * 0.5]], 3);
    g.fillStyle = '#6b6250'; g.beginPath(); g.arc(hx + (ld > 0 ? 8 : pw - 8), y - ph * 0.45, 3, 0, 7); g.fill(); }
  // ---- el ZOCALO de piedra con musgo encima, y la hiedra que trepa por la esquina en sombra
  for (let xx = x0 - 4; xx < x1; xx += 26 + rr() * 10) {
    const sw = 26 + rr() * 8; g.beginPath(); g.roundRect(xx, y - zh, sw, zh + 4, 3); g.fillStyle = rr() < 0.5 ? '#4a473c' : '#3c3a31'; g.fill(); tinta(g, 1.4);
    g.fillStyle = rgba(M.luz, 0.45); g.fillRect(xx + 2, y - zh + 1, sw * 0.6, 1.6);
    if (rr() < 0.55) { g.fillStyle = rr() < 0.5 ? '#4f5e26' : '#5f6e2c'; g.beginPath(); g.ellipse(xx + sw * (0.3 + rr() * 0.4), y - zh + 1, sw * 0.3, 3.5, 0, Math.PI, 0); g.fill(); }
  }
  // (fina y hasta media altura: llena y hasta el alero parecia un seto y tapaba el brazo del espantapajaros)
  { const hx = ld > 0 ? x1 - 3 : x0 + 3, alto = (y - zh - yw) * 0.6; g.strokeStyle = '#3a4a20'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(hx, y - zh); for (let k = 1; k <= 8; k++) g.lineTo(hx + Math.sin(k * 1.7) * 5, y - zh - (k / 8) * alto); g.stroke();
    for (let k = 0; k < 12; k++) { const t = k / 12, px = hx + Math.sin(t * 13.6) * 5 + (rr() - 0.5) * 8, py = y - zh - t * alto, s = 5 + rr() * 3; g.save(); g.translate(px, py); g.rotate((rr() - 0.5) * 1.6); g.beginPath(); g.ellipse(0, 0, s, s * 0.65, 0, 0, 7); g.fillStyle = rr() < 0.4 ? '#6f8434' : '#4f6426'; g.fill(); g.strokeStyle = TINTA; g.lineWidth = 1; g.stroke(); g.restore(); } }
  // la luz del lado del sol en el montante de la esquina
  g.fillStyle = rgba(M.pico, 0.6); g.fillRect(ld > 0 ? x1 - 3 : x0, yw, 3, y - zh - yw);
}
// un armazon de barra plana (tinta y cuerpo), para el invernadero
function cuerdaLisa(pts, w) {
  g.lineCap = 'square'; g.lineJoin = 'miter';
  camino(pts); g.strokeStyle = TINTA; g.lineWidth = w + 2.4; g.stroke();
  camino(pts); g.strokeStyle = '#3a3c34'; g.lineWidth = w; g.stroke();
  camino(pts.map(([x, y]) => [x - w * 0.2, y - w * 0.2])); g.strokeStyle = rgba('#a8a48e', 0.5); g.lineWidth = Math.max(1, w * 0.25); g.stroke();
}

// ---------------------------------------------------------------- ESPANTAPAJAROS y HUERTO a escala
// El del concepto era un rectangulo con una bola y un sombrero: ampliado al lado del 18 se veia de carton. Este es
// una camisa vieja colgada de la cruz, con remiendos y jirones, paja que sale por las mangas y el cuello, cabeza de
// saco atada, sombrero de paja y un cuervo en el brazo. x: el poste, y: el suelo (unos 1,7 m: 300 px).
export function espantapajaros(x, y, sem) {
  const rr = azar(sem), ld = ladoLuz(x);
  const PAJA = ['#c9ae55', '#a88e3e', '#e2cf86', '#8f7a3a'], TELA = '#6a5838', TELA2 = '#54452c', TELAL = '#8f7a50', FORRO = '#2e261a';
  const SACO = '#b9a47b', SACOS = '#8a7656', yb = y - 218, mx = 112, hy = yb - 46;
  const S = (a) => rgba(M.osc, a), L = (a) => rgba(M.pico, a), sl = (u) => (ld > 0 ? u : 1 - u);
  // paja: briznas curvas de tres tonos que salen de un punto hacia dir
  const paja = (px, py, dir, n, l0 = 14, l1 = 28, abre = 1.3) => {
    for (let k = 0; k < n; k++) {
      const a = dir + (rr() - 0.5) * abre, l = l0 + rr() * (l1 - l0), x0 = px + (rr() - 0.5) * 8, y0 = py + (rr() - 0.5) * 6;
      g.strokeStyle = PAJA[Math.floor(rr() * 4)]; g.lineWidth = 1.1 + rr() * 1.1; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(a) * l * 0.55 + (rr() - 0.5) * 5, y0 + Math.sin(a) * l * 0.55, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l + 4); g.stroke();
    }
  };
  // sombreado de cilindro (de canto a canto en x) dentro de una forma
  const cilindro = (pts, xa, xb, fuerza = 1) => {
    g.save(); trazar(g, pts); g.clip();
    const gr = g.createLinearGradient(xa, 0, xb, 0);
    gr.addColorStop(sl(0), S(0.55 * fuerza)); gr.addColorStop(sl(0.32), S(0.16 * fuerza)); gr.addColorStop(sl(0.62), 'rgba(0,0,0,0)'); gr.addColorStop(sl(0.86), L(0.2 * fuerza)); gr.addColorStop(sl(1), S(0.22 * fuerza));
    g.fillStyle = gr; g.fillRect(Math.min(xa, xb) - 4, y - 420, Math.abs(xb - xa) + 8, 440);
    g.restore();
  };
  // pliegue de tela: una linea oscura y su labio de luz al lado del sol
  const pliegue = (x0, y0, x1, y1, cx, cy, a = 0.45) => {
    g.lineCap = 'round';
    g.strokeStyle = S(a); g.lineWidth = 2.2; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
    g.strokeStyle = L(a * 0.45); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0 + ld * 2.2, y0); g.quadraticCurveTo(cx + ld * 2.2, cy, x1 + ld * 2.2, y1); g.stroke();
  };

  // ---- el montoncito de tierra del pie, el poste (redondo) y la cruz
  g.beginPath(); g.ellipse(x, y + 2, 30, 10, 0, Math.PI, 0); g.fillStyle = '#3a3122'; g.fill(); tinta(g, 1.6);
  madero(x - 7, y - 300, 14, 300, rr, { col: M.viga2, luz: 0.3 });
  cilindro([[x - 7, y - 300], [x + 7, y - 300], [x + 7, y], [x - 7, y]], x - 7, x + 7, 0.8);
  madero(x - mx - 8, yb - 7, (mx + 8) * 2, 13, rr, { col: M.viga, luz: 0.6, clavos: 1 });
  for (const px of [x - mx - 2, x + mx - 4]) { g.fillStyle = M.osc; g.fillRect(px, yb - 3, 2.4, 2.4); }

  // ---- las MANGAS: cuelgan de la cruz, se comban por debajo, con la boca abierta y la paja saliendo
  const manga = (s) => {
    const x0 = x + s * 44, x1 = x + s * (mx - 2), top = yb - 11;
    const pts = [[x0, top], [x1, top + 1], [x1 + s * 7, top + 14], [x1 + s * 2, top + 36]];
    // el borde de abajo, combado, con un jiron
    for (let k = 1; k <= 8; k++) { const t = k / 8, px = lerp(x1, x0, t), caida = 34 + Math.sin(Math.PI * t) * 16 + (k === 3 ? 9 : 0); pts.push([px, top + caida + (rr() - 0.5) * 3]); }
    trazar(g, pts); g.fillStyle = TELA; g.fill();
    g.save(); trazar(g, pts); g.clip();
    const gv = g.createLinearGradient(0, top, 0, top + 52); gv.addColorStop(0, L(0.22)); gv.addColorStop(0.35, 'rgba(0,0,0,0)'); gv.addColorStop(1, S(0.5)); g.fillStyle = gv; g.fillRect(Math.min(x0, x1) - 10, top - 2, Math.abs(x1 - x0) + 30, 60);
    for (let k = 0; k < 4; k++) { const px = lerp(x0, x1, 0.15 + k * 0.22); pliegue(px, top + 4, px + s * 6, top + 44, px - s * 4, top + 26, 0.4); }
    g.restore();
    trazar(g, pts); tinta(g, 2);
    // la boca de la manga y la paja que sale (y cuelga)
    g.beginPath(); g.ellipse(x1 + s * 4, top + 22, 5, 15, s * 0.15, 0, 7); g.fillStyle = FORRO; g.fill(); tinta(g, 1.4);
    paja(x1 + s * 6, top + 22, s > 0 ? 0.35 : Math.PI - 0.35, 14, 12, 30);
    paja(x1 + s * 2, top + 34, Math.PI / 2, 6, 10, 22, 0.6);
  };
  manga(-1); manga(1);

  // ---- el CUERPO: chaqueta vieja con hombros, solapas, botones, bolsillos y el bajo roto
  const cuerpo = [[x - 18, yb - 16], [x - 52, yb - 6], [x - 58, yb + 30], [x - 62, yb + 74]];
  for (let k = 0; k <= 10; k++) cuerpo.push([x - 62 + (124 * k) / 10, yb + 96 + (k % 2 ? -12 : 7) + rr() * 8]);
  cuerpo.push([x + 62, yb + 74], [x + 58, yb + 30], [x + 52, yb - 6], [x + 18, yb - 16]);
  // paja que asoma por el bajo, por detras de la tela
  for (let k = 0; k < 7; k++) paja(x - 50 + k * 16, yb + 94, Math.PI / 2, 4, 10, 24, 0.7);
  trazar(g, cuerpo); g.fillStyle = TELA; g.fill();
  g.save(); trazar(g, cuerpo); g.clip();
  // trama de la tela
  g.strokeStyle = S(0.12); g.lineWidth = 1; g.beginPath(); for (let yy = yb - 20; yy < yb + 110; yy += 4) { g.moveTo(x - 70, yy); g.lineTo(x + 70, yy + 1); } g.stroke();
  // la sombra de la cabeza y del cuello en los hombros
  g.fillStyle = S(0.35); g.beginPath(); g.ellipse(x - ld * 8, yb - 8, 34, 14, 0, 0, 7); g.fill();
  // pliegues que caen de los hombros y se abren hacia el bajo
  for (const [a, b, c] of [[-44, -52, -36], [-26, -30, -22], [26, 32, 22], [44, 54, 38], [-6, -10, -2]]) pliegue(x + a, yb + 2, x + b, yb + 92, x + c, yb + 50, 0.38);
  g.restore();
  cilindro(cuerpo, x - 62, x + 62);
  // solapas: dos triangulos que bajan del cuello a la botonadura, con su sombra debajo
  for (const s of [-1, 1]) {
    const sol = [[x + s * 18, yb - 16], [x + s * 30, yb - 8], [x + s * 6, yb + 40], [x, yb + 42]];
    g.fillStyle = S(0.4); trazar(g, sol.map(([px, py]) => [px + s * 3, py + 4])); g.fill();
    trazar(g, sol); g.fillStyle = s === ld ? TELAL : TELA2; g.fill(); tinta(g, 1.4);
  }
  // la abertura de la chaqueta y los botones (uno colgando de su hilo)
  g.strokeStyle = S(0.7); g.lineWidth = 2; g.beginPath(); g.moveTo(x, yb + 42); g.lineTo(x + 2, yb + 96); g.stroke();
  for (let k = 0; k < 3; k++) { const by = yb + 50 + k * 15, bx = x - 6 + (k === 2 ? 3 : 0), by2 = by + (k === 2 ? 8 : 0); if (k === 2) { g.strokeStyle = S(0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(x - 6, by); g.lineTo(bx, by2); g.stroke(); } g.fillStyle = '#2a2318'; g.beginPath(); g.arc(bx, by2, 3.4, 0, 7); g.fill(); g.fillStyle = L(0.7); g.beginPath(); g.arc(bx - 1, by2 - 1, 1.1, 0, 7); g.fill(); }
  // bolsillos con su tapa y la sombra de la tapa; del de la izquierda asoma un trapo
  for (const s of [-1, 1]) {
    const px = x + s * 34 - 13, py = yb + 64;
    g.fillStyle = S(0.25); g.fillRect(px, py, 26, 20); g.strokeStyle = S(0.6); g.lineWidth = 1.2; g.strokeRect(px, py, 26, 20);
    g.fillStyle = s === ld ? TELAL : TELA2; trazar(g, [[px - 2, py - 3], [px + 28, py - 3], [px + 26, py + 6], [px, py + 6]]); g.fill(); tinta(g, 1.2);
    g.fillStyle = S(0.4); g.fillRect(px, py + 6, 26, 3);
    if (s < 0) { trazar(g, [[px + 6, py - 2], [px + 12, py - 14], [px + 20, py - 10], [px + 18, py]]); g.fillStyle = '#8c8070'; g.fill(); tinta(g, 1); }
  }
  // remiendo con puntadas y un roto con la paja de dentro
  { const px = x + 22, py = yb + 14; g.fillStyle = '#7d6e4c'; trazar(g, [[px, py], [px + 24, py - 2], [px + 26, py + 20], [px + 2, py + 22]]); g.fill(); tinta(g, 1.2); g.strokeStyle = L(0.7); g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k < 6; k++) { g.moveTo(px + 2 + k * 4, py + 1); g.lineTo(px + 4 + k * 4, py + 5); g.moveTo(px + 3 + k * 4, py + 17); g.lineTo(px + 5 + k * 4, py + 21); } g.stroke(); }
  { const px = x - 40, py = yb + 30; g.fillStyle = FORRO; trazar(g, [[px, py], [px + 14, py - 4], [px + 18, py + 8], [px + 6, py + 14]]); g.fill(); paja(px + 8, py + 6, -Math.PI * 0.6, 5, 6, 14, 1.4); }
  trazar(g, cuerpo); tinta(g, 2.2);
  // el CINTURON de cuerda con su nudo y los cabos, y la paja que se sale por encima
  paja(x - 52, yb + 46, -Math.PI * 0.75, 5, 8, 16); paja(x + 52, yb + 46, -Math.PI * 0.25, 5, 8, 16);
  cuerda([[x - 60, yb + 50], [x - 20, yb + 53], [x + 20, yb + 52], [x + 60, yb + 49]], 3.6);
  cuerda([[x + 14, yb + 52], [x + 10, yb + 66], [x + 14, yb + 78]], 2.6); cuerda([[x + 16, yb + 52], [x + 22, yb + 64], [x + 20, yb + 72]], 2.6);
  g.beginPath(); g.arc(x + 15, yb + 52, 5, 0, 7); g.fillStyle = M.cuerda; g.fill(); tinta(g, 1.4);

  // ---- la CABEZA: saco relleno, con trama, atado al cuello
  paja(x, hy + 30, -Math.PI / 2, 10, 8, 18, 2.6);
  const cab = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, r = 1 + 0.05 * Math.sin(a * 3 + 1) + (Math.sin(a) > 0 ? 0.06 * Math.sin(a) : 0); cab.push([x + Math.cos(a) * 30 * r, hy + Math.sin(a) * 34 * r]); }
  trazar(g, cab); g.fillStyle = SACO; g.fill();
  g.save(); trazar(g, cab); g.clip();
  g.strokeStyle = rgba(SACOS, 0.55); g.lineWidth = 1; g.beginPath(); for (let k = -40; k < 40; k += 3.2) { g.moveTo(x + k, hy - 40); g.lineTo(x + k + 2, hy + 40); g.moveTo(x - 40, hy + k); g.lineTo(x + 40, hy + k + 1); } g.stroke();
  const gb = g.createRadialGradient(x + ld * 10, hy - 14, 2, x, hy, 40); gb.addColorStop(0, L(0.22)); gb.addColorStop(0.5, 'rgba(0,0,0,0)'); gb.addColorStop(1, S(0.55)); g.fillStyle = gb; g.fillRect(x - 40, hy - 40, 80, 80);
  // la sombra del ala del sombrero en la cara
  const gs = g.createLinearGradient(0, hy - 34, 0, hy - 10); gs.addColorStop(0, S(0.55)); gs.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gs; g.fillRect(x - 40, hy - 36, 80, 28);
  g.restore();
  trazar(g, cab); tinta(g, 2);
  // el frunce del cuello y la cuerda que lo ata
  for (let k = 0; k < 9; k++) { const px = x - 18 + k * 4.5; g.strokeStyle = S(0.5); g.lineWidth = 1.4; g.beginPath(); g.moveTo(px, hy + 24); g.lineTo(px + (k - 4) * 0.8, hy + 36); g.stroke(); }
  trazar(g, [[x - 20, hy + 30], [x + 20, hy + 30], [x + 16, hy + 40], [x - 16, hy + 40]]); g.fillStyle = SACOS; g.fill(); tinta(g, 1.4);
  cuerda([[x - 19, hy + 31], [x + 19, hy + 31]], 2.6); cuerda([[x + 8, hy + 31], [x + 12, hy + 44]], 2); cuerda([[x + 10, hy + 31], [x + 18, hy + 42]], 2);
  // la cara cosida: ojos en X de hilo gordo, boca de puntadas y un remiendo en la mejilla
  for (const ex of [x - 11, x + 11]) { g.strokeStyle = '#1a140c'; g.lineWidth = 2.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - 5, hy - 9); g.lineTo(ex + 5, hy + 1); g.moveTo(ex + 5, hy - 9); g.lineTo(ex - 5, hy + 1); g.stroke(); g.strokeStyle = L(0.35); g.lineWidth = 0.8; g.beginPath(); g.moveTo(ex - 4, hy - 9); g.lineTo(ex + 5, hy); g.stroke(); }
  g.strokeStyle = '#1a140c'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x - 14, hy + 13); g.quadraticCurveTo(x, hy + 20, x + 14, hy + 13); g.stroke();
  g.lineWidth = 1.4; g.beginPath(); for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6, px = x - 14 + 28 * t, py = hy + 13 + Math.sin(Math.PI * t) * 3.5; g.moveTo(px, py - 3.5); g.lineTo(px + 1, py + 3.5); } g.stroke();
  { const px = x + (ld > 0 ? -26 : 12), py = hy + 2; g.fillStyle = '#8f7d58'; g.fillRect(px, py, 13, 11); g.strokeStyle = S(0.7); g.lineWidth = 1; g.strokeRect(px, py, 13, 11); }

  // ---- el SOMBRERO de paja: el ala vista desde arriba (se ve su cara), la copa abollada, la cinta y una pluma
  const ay = hy - 30, ala = [];
  for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2, r = 1 + (rr() - 0.5) * 0.05 + (k === 21 || k === 22 ? -0.08 : 0); ala.push([x + 2 + Math.cos(a) * 58 * r, ay + Math.sin(a) * 15 * r - Math.cos(a) * 3]); }
  trazar(g, ala); g.fillStyle = '#8c7444'; g.fill();
  g.save(); trazar(g, ala); g.clip();
  // el trenzado: rayas que salen de la copa hacia el borde y vueltas concentricas
  g.strokeStyle = S(0.3); g.lineWidth = 1; g.beginPath(); for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; g.moveTo(x + 2 + Math.cos(a) * 26, ay + Math.sin(a) * 7); g.lineTo(x + 2 + Math.cos(a) * 60, ay + Math.sin(a) * 16); } g.stroke();
  for (let r = 34; r < 60; r += 6) { g.strokeStyle = L(0.25); g.beginPath(); g.ellipse(x + 2, ay, r, r * 0.26, 0, 0, 7); g.stroke(); }
  const ga = g.createLinearGradient(x - 58, 0, x + 62, 0); ga.addColorStop(sl(0), S(0.4)); ga.addColorStop(sl(0.5), 'rgba(0,0,0,0)'); ga.addColorStop(sl(1), L(0.25)); g.fillStyle = ga; g.fillRect(x - 60, ay - 20, 124, 40);
  // la sombra de la copa sobre el ala
  g.fillStyle = S(0.4); g.beginPath(); g.ellipse(x + 2 - ld * 10, ay + 4, 30, 8, 0, 0, 7); g.fill();
  g.restore();
  trazar(g, ala); tinta(g, 2);
  // pajas sueltas del borde del ala
  for (let k = 0; k < 9; k++) { const a = rr() * Math.PI * 2; paja(x + 2 + Math.cos(a) * 57, ay + Math.sin(a) * 15, a, 1, 5, 11, 0.4); }
  // la copa: abollada por arriba (pellizco), con su trenzado en horizontal y sombra de cilindro
  const copa = [[x - 27, ay - 2], [x - 23, ay - 32], [x - 12, ay - 38], [x + 2, ay - 33], [x + 16, ay - 39], [x + 26, ay - 32], [x + 29, ay - 3]];
  trazar(g, copa); g.fillStyle = '#9a8150'; g.fill();
  g.save(); trazar(g, copa); g.clip(); g.strokeStyle = S(0.3); g.lineWidth = 1; g.beginPath(); for (let yy = ay - 38; yy < ay; yy += 4) { g.moveTo(x - 30, yy); g.lineTo(x + 32, yy + 1); } g.stroke(); g.restore();
  cilindro(copa, x - 27, x + 29);
  g.fillStyle = '#4a3c24'; trazar(g, [[x - 26, ay - 12], [x + 28, ay - 12], [x + 29, ay - 4], [x - 27, ay - 4]]); g.fill(); g.fillStyle = L(0.3); g.fillRect(x - 26, ay - 12, 54, 1.4);
  trazar(g, copa); tinta(g, 2);
  // la pluma de cuervo metida en la cinta
  { const px = x + 20, py = ay - 10; g.fillStyle = '#16140f'; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + 22, py - 30, px + 14, py - 52); g.quadraticCurveTo(px + 6, py - 28, px - 2, py - 4); g.closePath(); g.fill(); tinta(g, 1); g.strokeStyle = L(0.4); g.lineWidth = 0.8; g.beginPath(); g.moveTo(px + 1, py - 2); g.quadraticCurveTo(px + 14, py - 28, px + 13, py - 48); g.stroke(); }

  // ---- el CUERVO en el brazo de la izquierda (mirando afuera) y una lata colgada del de la derecha
  {
    const cx = x - 84, cy = yb - 10, s = -1;
    const cuerpoC = [[cx + s * -18, cy + 2], [cx + s * -8, cy - 14], [cx + s * 8, cy - 18], [cx + s * 16, cy - 28], [cx + s * 24, cy - 27], [cx + s * 31, cy - 24], [cx + s * 22, cy - 20], [cx + s * 18, cy - 10], [cx + s * 6, cy], [cx + s * -6, cy + 4], [cx + s * -26, cy + 10]];
    trazar(g, cuerpoC); g.fillStyle = '#121210'; g.fill(); tinta(g, 1.4);
    // el ala plegada con sus plumas y el brillo del lomo
    for (let k = 0; k < 4; k++) { trazar(g, [[cx + s * (4 - k * 5), cy - 12 + k], [cx + s * (-10 - k * 5), cy - 2 + k * 2], [cx + s * (-14 - k * 4), cy + 3 + k * 2]], false); g.strokeStyle = 'rgba(120,124,110,.45)'; g.lineWidth = 1; g.stroke(); }
    g.strokeStyle = 'rgba(190,196,170,.35)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx + s * -6, cy - 10); g.quadraticCurveTo(cx + s * 6, cy - 18, cx + s * 16, cy - 26); g.stroke();
    trazar(g, [[cx + s * 29, cy - 25], [cx + s * 38, cy - 23], [cx + s * 29, cy - 21]]); g.fillStyle = '#3a3a34'; g.fill(); tinta(g, 0.8);
    g.fillStyle = '#e8e2c8'; g.beginPath(); g.arc(cx + s * 24, cy - 25, 1.7, 0, 7); g.fill();
    g.strokeStyle = TINTA; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx + s * 2, cy); g.lineTo(cx + s * 2, cy + 5); g.moveTo(cx + s * 8, cy - 1); g.lineTo(cx + s * 9, cy + 5); g.stroke();
  }
  {
    const lx = x + 92, ly = yb + 44;
    g.strokeStyle = M.cuerda; g.lineWidth = 1.2; g.beginPath(); g.moveTo(lx + 2, yb + 4); g.lineTo(lx + 4, ly - 12); g.stroke();
    trazar(g, [[lx - 6, ly - 12], [lx + 14, ly - 12], [lx + 13, ly + 12], [lx - 5, ly + 12]]); g.fillStyle = '#5c5a52'; g.fill();
    cilindro([[lx - 6, ly - 12], [lx + 14, ly - 12], [lx + 13, ly + 12], [lx - 5, ly + 12]], lx - 6, lx + 14, 0.9);
    g.fillStyle = 'rgba(92,58,36,.5)'; g.fillRect(lx - 4, ly + 2, 16, 9);
    g.beginPath(); g.ellipse(lx + 4, ly - 12, 10, 3, 0, 0, 7); g.fillStyle = '#7c7a70'; g.fill(); tinta(g, 1);
    trazar(g, [[lx - 6, ly - 12], [lx + 14, ly - 12], [lx + 13, ly + 12], [lx - 5, ly + 12]]); tinta(g, 1.4);
  }
}
// el huerto: un bancal de tablas con tierra oscura, hileras de coles y caneros de judias con su planta trepando.
// x0, x1: de donde a donde; y: el suelo
export function huerto(x0, x1, y, sem) {
  const rr = azar(sem), hb = 34;
  // los caneros (detras): canas en tienda con la judia enredada
  for (let x = x0 + 50; x < x1 - 40; x += 110 + rr() * 30) {
    const top = y - 190 - rr() * 30;
    for (const dx of [-22, 22]) { g.strokeStyle = TINTA; g.lineWidth = 5; g.beginPath(); g.moveTo(x + dx, y - hb + 6); g.lineTo(x - dx * 0.2, top); g.stroke(); g.strokeStyle = '#8a7a52'; g.lineWidth = 2.6; g.stroke(); }
    for (let k = 0; k < 6; k++) hojas(x + (rr() - 0.5) * 34, lerp(y - hb, top + 20, k / 6), 12 + rr() * 8, 9 + rr() * 5, 0.04, sem + Math.floor(x) + k, { den: 0.9, mata: true });
  }
  // el bancal
  trazar(g, [[x0, y + 4], [x0, y - hb], [x1, y - hb], [x1, y + 4]]); g.fillStyle = '#211c12'; g.fill();
  g.fillStyle = '#3a2f20'; for (let x = x0 + 6; x < x1 - 6; x += 9) g.fillRect(x, y - hb - 3 + rr() * 3, 7, 4);   // la tierra removida
  for (let x = x0; x < x1 - 2;) { const w = Math.min(x1 - x, 70 + rr() * 40); madero(x, y - hb + 10, w - 2, hb - 6, rr, { col: M.som2, luz: 0.7, clavos: 0.6 }); x += w; }
  for (const px of [x0 - 4, x1 - 8]) madero(px, y - hb - 4, 12, hb + 8, rr, { col: M.viga, luz: 0.5 });
  // coles (delante del bancal, asomando): hojas de fuera abiertas y el cogollo claro
  for (let x = x0 + 34; x < x1 - 24; x += 52 + rr() * 10) {
    const cy = y - hb - 6, r = 20 + rr() * 6;
    for (let k = 0; k < 5; k++) { const a = Math.PI + (k / 4) * Math.PI; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.4, r * 0.6, r * 0.38, a, 0, 7); g.fillStyle = ['#69751f', '#7f8a2c', '#5b6a2a'][k % 3]; g.fill(); tinta(g, 1.3); }
    g.beginPath(); g.arc(x, cy - r * 0.2, r * 0.5, 0, 7); g.fillStyle = '#a7ad4a'; g.fill(); tinta(g, 1.4);
    g.strokeStyle = rgba('#3e4a14', 0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(x, cy - r * 0.7); g.lineTo(x, cy + 2); g.stroke();
  }
}

// ---------------------------------------------------------------- PENASCO de la capa del medio
// Antes era un monticulo redondo con una corona de matas y se leia como un almiar. Ahora sube en bancales de caras
// casi verticales, con matas solo en las repisas, un arbol flaco en lo alto y la cascada saliendo de una grieta
// del bancal de arriba, con su bruma al pie.
export function penasco(x0, w, top, base, d, sem) {
  const rr = azar(sem), bancales = [];
  let a = x0, b = x0 + w, y = base + 10;
  const altos = [0.44, 0.33, 0.23];
  for (let k = 0; k < 3; k++) {
    const h = (base - top) * altos[k], yt = y - h, na = a + w * (0.05 + rr() * 0.12), nb = b - w * (0.05 + rr() * 0.12);
    const pts = [[a - 6, y], [a + (rr() - 0.3) * 12, y - h * 0.45], [na - 4, yt + 18], [na + 8, yt + 2], [lerp(na, nb, 0.3), yt - 4 - rr() * 10], [lerp(na, nb, 0.55), yt + rr() * 8], [lerp(na, nb, 0.8), yt - 6 - rr() * 8], [nb - 6, yt + 4], [nb + 6, yt + 20], [b + (rr() - 0.7) * 12, y - h * 0.5], [b + 6, y]];
    bancales.push({ pts, yt, a: na, b: nb });
    a = na; b = nb; y = yt + 22;
  }
  // el arbol flaco de arriba (detras del ultimo bancal)
  const cima = bancales[2], ax = lerp(cima.a, cima.b, 0.3 + rr() * 0.4);
  tronco(ax, cima.yt + 16, cima.yt - 300 - rr() * 120, 26 + rr() * 10, d, sem + 5, { colgajos: 2 });
  hojas(ax + (rr() - 0.5) * 60, cima.yt - 300 - rr() * 60, 110 + rr() * 50, 60 + rr() * 26, d, sem + 6, { den: 0.6, tam: 7 });
  bancales.forEach((B, k) => {
    roca(B.pts, d, sem + 10 + k);
    // grietas verticales en la cara (lo que hace que se lea como pared y no como monton)
    const T = (c) => tono(c, d, B.a);
    for (let q = 0; q < 2 + Math.floor(rr() * 3); q++) { const gx = lerp(B.a, B.b, 0.12 + rr() * 0.76), y0 = B.yt + 20 + rr() * 30, y1 = B.pts[0][1] - 10 - rr() * 40; g.fillStyle = T('#0a0907'); g.beginPath(); g.moveTo(gx - 2.5, y0); g.lineTo(gx + 2.5, y0); g.lineTo(gx + (rr() - 0.5) * 12, y1); g.closePath(); g.fill(); }
    // matas en la repisa
    for (let xx = B.a + 20; xx < B.b - 20; xx += 40 + rr() * 60) if (rr() < 0.7) hojas(xx, B.yt + 6, 24 + rr() * 26, 10 + rr() * 8, d, Math.floor(xx) + sem, { den: 0.75, tam: 6, mata: true });
  });
  // la cascada: sale de una grieta del bancal de arriba y baja por delante hasta el pie, con su bruma
  const cx = lerp(cima.a, cima.b, 0.25 + rr() * 0.5), cw = 22 + rr() * 16;
  cascada(cx - cw / 2, cima.yt + 26, base + 10, cw, d, sem + 7, { velo: 0.3 });
  for (let k = 0; k < 6; k++) brillo(cx + (rr() - 0.5) * w * 0.5, base - rr() * 40, 60 + rr() * 80, '#f2efe0', 0.12 + rr() * 0.08);
}

// ---------------------------------------------------------------- la ORILLA de enfrente de un agua
// Lo que se ve entre el suelo y la lamina del agua. Antes era un rectangulo oscuro liso, que se leia como un muro.
// Ahora es la pared de tierra de la otra orilla: estratos, raices que asoman del borde, piedras y juncos al pie,
// mas clara arriba (la bruma) y oscura abajo. yt: el canto de arriba, ys: la lamina, en px.
export function orilla(x0, x1, yt, ys, sem) {
  const rr = azar(sem), H = ys - yt;
  const gr = g.createLinearGradient(0, yt, 0, ys); gr.addColorStop(0, '#4a4630'); gr.addColorStop(0.25, '#353222'); gr.addColorStop(1, '#14140d');
  g.fillStyle = gr; g.beginPath(); g.moveTo(x0, ys + 30); g.lineTo(x0, yt + 6);
  for (let x = x0; x <= x1; x += 22) g.lineTo(x, yt + (rr() - 0.5) * 6);
  g.lineTo(x1, ys + 30); g.closePath(); g.fill();
  // estratos de tierra y piedrecillas
  for (let k = 0; k < Math.max(2, H / 40); k++) { const yy = yt + 18 + rr() * (H - 30); g.strokeStyle = rgba('#0a0907', 0.6); g.lineWidth = 1.6; g.beginPath(); let x = x0 + rr() * 60; g.moveTo(x, yy); while (x < x1) { x += 30 + rr() * 50; g.lineTo(x, yy + (rr() - 0.5) * 6); } g.stroke(); }
  for (let k = 0; k < (x1 - x0) / 30; k++) { const x = x0 + rr() * (x1 - x0), y = yt + 10 + rr() * (H - 20); g.fillStyle = rgba(rr() < 0.5 ? '#5a5444' : '#3e3a2c', 0.8); g.beginPath(); g.ellipse(x, y, 3 + rr() * 6, 2 + rr() * 3, 0, 0, 7); g.fill(); }
  // raices que asoman del borde y cuelgan
  g.lineCap = 'round';
  for (let k = 0; k < (x1 - x0) / 90; k++) {
    const x = x0 + rr() * (x1 - x0), l = 20 + rr() * Math.min(110, H * 0.8), cx = x + (rr() - 0.5) * 40;
    g.strokeStyle = TINTA; g.lineWidth = 4 + rr() * 3; g.beginPath(); g.moveTo(x, yt + 2); g.quadraticCurveTo(cx, yt + l * 0.6, cx + (rr() - 0.5) * 20, yt + l); g.stroke();
    g.strokeStyle = '#4a3e2a'; g.lineWidth = 1.6; g.stroke();
  }
  // el canto de arriba, con algo de luz, y matas que vuelan sobre el borde
  g.fillStyle = rgba('#b8a878', 0.4); for (let x = x0; x < x1; x += 22) g.fillRect(x, yt - 1 + (rr() - 0.5) * 3, 20, 2);
  for (let x = x0 + 30; x < x1 - 20; x += 60 + rr() * 90) hojas(x, yt + 4, 26 + rr() * 30, 12 + rr() * 8, 0.1, Math.floor(x) + sem, { den: 0.85, mata: true });
  // al pie: piedras y juncos
  for (let k = 0; k < (x1 - x0) / 140; k++) { const x = x0 + rr() * (x1 - x0), w = 50 + rr() * 80, yy = ys - 6 - rr() * 30; roca([[x - w / 2, ys + 20], [x - w * 0.4, yy + 10], [x - w * 0.1, yy], [x + w * 0.35, yy + 6], [x + w / 2, ys + 20]], 0.2, Math.floor(x)); }
  for (let k = 0; k < (x1 - x0) / 55; k++) { const x = x0 + rr() * (x1 - x0); hierba(x, ys + 2, 26 + rr() * 40, 0.15, Math.floor(x)); }
}

// ---------------------------------------------------------------- el AGUA, con reflejos
// La lamina con su degradado, el reflejo de la orilla (banda oscura bajo el borde), destellos donde le da el sol,
// ondas largas y un brillo palido en la linea del agua. x0, x1, ys (lamina) e yb (fondo), en px.
export function agua(x0, x1, ys, yb, sem) {
  const rr = azar(sem), ld = ladoLuz((x0 + x1) / 2);
  const gr = g.createLinearGradient(0, ys, 0, yb); gr.addColorStop(0, 'rgba(70,78,52,.92)'); gr.addColorStop(0.18, 'rgba(36,44,32,.96)'); gr.addColorStop(1, 'rgba(10,14,10,1)');
  g.fillStyle = gr; g.fillRect(x0, ys, x1 - x0, yb - ys);
  // reflejo de la orilla de enfrente: oscuro y temblon justo bajo la lamina
  g.fillStyle = 'rgba(14,16,10,.55)'; for (let x = x0; x < x1; x += 14) g.fillRect(x, ys + 3, 14, 18 + Math.sin(x * 0.05) * 6 + rr() * 8);
  g.save(); g.globalCompositeOperation = 'lighter';
  // columnas de luz reflejada (el cielo entre los troncos), cortadas en rayas
  for (let k = 0; k < (x1 - x0) / 160; k++) { const cx = x0 + rr() * (x1 - x0), w = 20 + rr() * 50; for (let y = ys + 24; y < ys + 150; y += 5 + rr() * 5) { const a = 0.1 * (1 - (y - ys) / 160); g.fillStyle = `rgba(232,226,186,${a})`; g.fillRect(cx - w / 2 + (rr() - 0.5) * 12, y, w * (0.6 + rr() * 0.4), 1.6); } }
  // ondas largas y destellos
  for (let n = 0; n < (x1 - x0) / 5; n++) { const y = ys + 4 + Math.pow(rr(), 1.7) * 170; g.fillStyle = `rgba(255,246,214,${0.05 + rr() * 0.17})`; g.fillRect(x0 + rr() * (x1 - x0), y, 12 + rr() * 70, 1.3); }
  for (let n = 0; n < (x1 - x0) / 40; n++) { const x = x0 + rr() * (x1 - x0), y = ys + 6 + rr() * 60; brillo(x, y, 6 + rr() * 8, '#fff6d6', 0.25 + rr() * 0.3); }
  g.restore();
  // la linea del agua: palida, con la sombra de tinta debajo
  g.fillStyle = 'rgba(224,216,170,.6)'; g.fillRect(x0, ys - 1, x1 - x0, 2.5);
  g.strokeStyle = '#0b0a0c'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, ys + 1.5); g.lineTo(x1, ys + 1.5); g.stroke();
  // nenufares sueltos (vida, no decoracion: pocos y pequenos)
  for (let k = 0; k < (x1 - x0) / 260; k++) { const x = x0 + 40 + rr() * (x1 - x0 - 80); g.beginPath(); g.ellipse(x, ys + 3, 14 + rr() * 8, 3.2, 0, 0, 7); g.fillStyle = rr() < 0.5 ? '#5b6a2a' : '#4e5c22'; g.fill(); tinta(g, 1.2); g.fillStyle = rgba('#c9c47a', 0.6); g.fillRect(x - 8, ys + 1.5, 10, 1); }
  void ld;
}
