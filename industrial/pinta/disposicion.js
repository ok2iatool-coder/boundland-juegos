// DONDE VA CADA COSA, capa a capa y en todo el nivel (puro: lo usan los hilos que pintan y la pagina, que pone el
// humo, los resplandores y el polvo en el mismo sitio). Unidades del mundo, y hacia arriba. Cerca del principio,
// lo de la imagen de referencia en su sitio medido (px, py); despues, lo que sigue su direccion de arte.
// Cada pieza: { t: tipo, ...sus medidas, caja: [x0, y0, x1, y1] } (la caja, holgada, para saber que baldosas pisa).
import { px, py } from './comun.js';
import { TRAMOS, NIVEL } from '../js/nivel.js';

function azar(s) { let a = (s * 2654435761) >>> 0 || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return ((a >>> 0) % 1e6) / 1e6; }; }
export const CAM0 = { x: px(836), y: py(470) };
export function rango(f) {
  const M = 12.5, a = CAM0.x * (1 - f) + (NIVEL.x0 + CAM0.x) * f, b = CAM0.x * (1 - f) + (NIVEL.x1 + CAM0.x) * f;
  return [a - M, b + M];
}

let CACHE = null;
export function disposicion() {
  if (CACHE) return CACHE;
  const capas = { lejos: [], medioLejos: [], medio: [], juego: [], frente: [] }, efectos = { humo: [], halos: [], luces: [] };
  const pon = (capa, p) => { capas[capa].push(p); return p; };

  // ================================================================= LEJOS
  {
    const [a, b] = rango(0.12), S = py(620), rr = azar(41);
    pon('lejos', { t: 'grua', x: px(912), y0: py(560), alto: py(250) - py(560), izq: 1.0, der: 2.35, caja: [px(912) - 1.3, py(560), px(912) + 2.6, py(150)] });
    for (const [xx, top, r, humo] of [[1257, 209, 0.32, true], [1414, 325, 0.2, true], [1297, 359, 0.13], [1318, 352, 0.12], [1470, 380, 0.15], [1452, 420, 0.1]]) chimenea('lejos', px(xx), py(600), py(top) - py(600), r, humo);
    pon('lejos', { t: 'cupula', x: px(1456), y0: py(560), r: 1.06, caja: [px(1456) - 1.2, py(560), px(1456) + 1.2, py(560) + 3.2] });
    for (const [xx, top, w] of [[20, 140, 0.35], [45, 200, 0.25], [230, 260, 0.3], [1540, 300, 0.3], [1600, 360, 0.25], [1640, 260, 0.22]]) pon('lejos', { t: 'aguja', x: px(xx), y0: S, alto: py(top) - S, w: w * 2, caja: [px(xx) - w, S, px(xx) + w, py(top) + 0.2] });
    for (let x = 12; x < b; x += 4 + rr() * 5) {
      const z = rr();
      if (z < 0.35) chimenea('lejos', x, S, 3.2 + rr() * 2.6, 0.18 + rr() * 0.16, rr() < 0.4);
      else if (z < 0.5) { const al = 2.6 + rr() * 1.4, iz = 0.6 + rr() * 0.6, de = 1.4 + rr() * 1.2; pon('lejos', { t: 'grua', x, y0: S + 0.6, alto: al, izq: iz, der: de, caja: [x - iz - 0.2, S, x + de + 0.2, S + al + 3] }); }
      else if (z < 0.62) { const r = 0.8 + rr() * 0.7; pon('lejos', { t: 'cupula', x, y0: S + 0.4, r, caja: [x - r - 0.2, S, x + r + 0.2, S + r * 3.2] }); }
      else if (z < 0.75) { const al = 2.6 + rr() * 1.2, r = 1.0 + rr() * 0.4; pon('lejos', { t: 'refrigeracion', x, y0: S, alto: al, r, caja: [x - r, S, x + r, S + al] }); }
      else { const al = 3 + rr() * 3, w = 0.5 + rr() * 0.4; pon('lejos', { t: rr() < 0.5 ? 'aguja' : 'torreG', x, y0: S, alto: al, w, caja: [x - w, S, x + w, S + al + 0.5] }); }
    }
    for (let x = a; x < b; x += 0.6 + rr() * 1.3) { const h = 0.8 + rr() * 2.6, w = 0.6 + rr() * 1.5; pon('lejos', { t: 'bloque', x0: x - w / 2, x1: x + w / 2, y0: S, alto: h, sem: Math.round(x * 97), caja: [x - w / 2 - 0.2, S, x + w / 2 + 0.2, S + h + 2] }); }
    for (let x = 14 + rr() * 5; x < b; x += 8 + rr() * 9) { const r = 0.5 + rr() * 0.35; pon('lejos', { t: 'esfera', x, y0: S, r, caja: [x - r * 1.5, S, x + r * 1.2, S + r * 2.8] }); }
  }
  function chimenea(capa, x, y0, alto, r, humo) {
    pon(capa, { t: 'chimenea', x, y0, alto, r, caja: [x - r - 0.3, y0, x + r + 0.4, y0 + alto + 0.5] });
    if (humo) efectos.humo.push({ capa, x, y: y0 + alto + 0.3, grande: r > 0.25 });
  }

  // ================================================================= MEDIO LEJOS
  {
    const [a, b] = rango(0.3), S = py(640), rr = azar(73);
    for (const [xx, base, top, w, n] of [[745, 600, 159, 0.95, 4], [840, 600, 320, 0.36, 3], [650, 620, 339, 0.3, 3]]) pon('medioLejos', { t: 'torreG', x: px(xx), y0: py(base), alto: py(top) - py(base), w, cuerpos: n, caja: [px(xx) - w, py(base), px(xx) + w, py(top) + 1.6] });
    for (const [x0, x1, y0, top] of [[612, 738, 640, 494], [965, 1060, 640, 560], [1290, 1390, 660, 540]]) bloque('medioLejos', px(x0), px(x1), py(y0), py(top) - py(y0), 1.2);
    pon('medioLejos', { t: 'pilon', x: px(1012), y0: py(600), alto: py(384) - py(600), ancho: 0.55, caja: [px(1012) - 0.8, py(600), px(1012) + 0.8, py(384) + 0.3] });
    for (let x = a; x < b;) {
      if (x > -1 && x < 9.5) { x = 9.5; continue; }
      const w = 1.0 + rr() * 2.2, h = 1.2 + rr() * 3.0;
      bloque('medioLejos', x, x + w, S, h, 1.2);
      if (rr() < 0.18) { const al = 4.5 + rr() * 2.5, ww = 0.5 + rr() * 0.4, tx = x + w + 0.6; pon('medioLejos', { t: 'torreG', x: tx, y0: S, alto: al, w: ww, cuerpos: 3, caja: [tx - ww, S, tx + ww, S + al + 1.6] }); }
      else if (rr() < 0.15) { const al = 3 + rr() * 1.5, tx = x + w + 0.5; pon('medioLejos', { t: 'pilon', x: tx, y0: S, alto: al, ancho: 0.5, caja: [tx - 0.8, S, tx + 0.8, S + al + 0.4] }); }
      x += w + 0.3 + rr() * 1.2;
    }
    for (let x = 11 + rr() * 4; x < b; x += 9 + rr() * 10) { if (rr() < 0.55) { const r = 0.7 + rr() * 0.5; pon('medioLejos', { t: 'esfera', x, y0: S, r, caja: [x - r * 1.5, S, x + r * 1.2, S + r * 2.8] }); } else { const l = 2.2 + rr() * 1.4, r = 0.38 + rr() * 0.2; pon('medioLejos', { t: 'cisterna', x, y0: S, l, r, caja: [x - l / 2 - r, S, x + l / 2 + r, S + r * 2.4] }); } }
  }
  function bloque(capa, x0, x1, y0, alto, dens, o = {}) {
    pon(capa, { t: 'bloque', x0, x1, y0, alto, sem: Math.round(x0 * 131 + alto * 7), ...o, caja: [x0 - 0.3, y0, x1 + 0.3, y0 + alto + 3.2] });
    pon(capa, { t: 'remate', x0, x1, y: y0 + alto, dens, sem: Math.round(x0 * 71), caja: [x0 - 0.3, y0 + alto - 0.3, x1 + 0.3, y0 + alto + 3.2] });
  }

  // ================================================================= MEDIO
  {
    const [a, b] = rango(0.55), S = py(760), rr = azar(95);
    for (const [x0, x1, top] of [[757, 892, 519], [1002, 1102, 509], [1072, 1250, 614], [615, 745, 560]]) bloque('medio', px(x0), px(x1), S, py(top) - S, 1.0, { lit: 0.3 });
    pon('medio', { t: 'viaducto', x0: px(892), x1: px(1002), y: py(549), alto: py(549) - S + 0.4, vano: px(1002) - px(892) - 0.25, caja: [px(892) - 0.1, S, px(1002) + 0.1, py(549) + 0.9] });
    const torres = [{ x: px(1157), y0: py(640), alto: py(159) - py(640), ancho: 1.05 }];
    const hitos = [[22, 5.5, 'gasometro'], [40, 3, 'deposito'], [52, 21, 'tren'], [78, 10, 'nave'], [94, 5.5, 'gasometro']];
    for (const [hx, hw, tipo] of hitos) {
      if (hx > b) continue;
      if (tipo === 'gasometro') pon('medio', { t: 'gasometro', x: hx + 2.6, y0: S, r: 2.2, alto: 4.4, caja: [hx, S, hx + 5.2, S + 4.8] });
      else if (tipo === 'deposito') pon('medio', { t: 'deposito', x: hx + 1.4, y0: S, alto: 6.5, caja: [hx + 0.2, S, hx + 2.6, S + 6.8] });
      else if (tipo === 'tren') pon('medio', { t: 'viaducto', x0: hx, x1: hx + 20, y: S + 3.2, alto: 3.6, vano: 3.2, tren: true, caja: [hx - 0.1, S, hx + 20.1, S + 5] });
      else if (tipo === 'nave') pon('medio', { t: 'nave', x0: hx, x1: hx + 9, y0: S, alto: 2.6, caja: [hx - 0.1, S, hx + 9.1, S + 3.6] });
    }
    for (let x = Math.max(a, px(1575)); x < b;) {
      const hito = hitos.find(([hx, hw, tipo]) => x > hx - 0.6 && x < hx + hw && tipo !== 'tren');
      if (hito) { x = hito[0] + hito[1] + 0.4; continue; }
      const w = 1.2 + rr() * 2.6, h = 1.6 + rr() * 3.2;
      bloque('medio', x, x + w, S, h, 1.0, { lit: 0.22 + rr() * 0.12 });
      if (rr() < 0.18) { const v = 1.8 + rr() * 1.4, y = S + h * (0.45 + rr() * 0.3); pon('medio', { t: 'viaducto', x0: x + w, x1: x + w + v, y, alto: y - S + 0.5, vano: v - 0.3, caja: [x + w - 0.1, S, x + w + v + 0.1, y + 0.9] }); x += w + v; continue; }
      x += w + 0.2 + rr() * 1.4;
    }
    for (let xt = px(1157) + 15; xt < b; xt += 15 + rr() * 6) torres.push({ x: xt, y0: S + 0.5, alto: 6.2 + rr() * 1.4, ancho: 0.95 });
    for (const q of torres) pon('medio', { t: 'pilon', ...q, caja: [q.x - 1.4, q.y0, q.x + 1.4, q.y0 + q.alto + 0.6] });
    // el tendido de torre a torre (y de la primera hacia la izquierda, como en la imagen)
    const brazos = (q) => [[0.62, 1.0], [0.76, 1.35], [0.9, 0.85]].map(([t, l]) => [q.ancho * 0.5 * l + q.ancho * 0.5 * (1 - Math.pow(t, 0.75) * 0.82), q.y0 + q.alto * t - 0.35]);
    for (const [hb, yb] of brazos(torres[0])) cablePon('medio', [torres[0].x - hb, yb], [px(560), yb - 1.2 - rr() * 0.8], 0.6 + rr() * 0.5);
    for (let k = 0; k < torres.length - 1; k++) { const A = brazos(torres[k]), B2 = brazos(torres[k + 1]); for (let q = 0; q < 3; q++) cablePon('medio', [torres[k].x + A[q][0], A[q][1]], [torres[k + 1].x - B2[q][0], B2[q][1]], 0.9 + rr() * 0.5); }
    for (let x = 14 + rr() * 6; x < b; x += 11 + rr() * 12) { const q = rr(); if (q < 0.4) { const r = 0.9 + rr() * 0.5; pon('medio', { t: 'esfera', x, y0: S, r, caja: [x - r * 1.5, S, x + r * 1.2, S + r * 2.8] }); } else if (q < 0.7) { const l = 2.6 + rr() * 1.6, r = 0.42 + rr() * 0.2; pon('medio', { t: 'cisterna', x, y0: S, l, r, caja: [x - l / 2 - r, S, x + l / 2 + r, S + r * 2.4] }); } else { const w = 2.7 + rr() * 2, h = 2.2 + rr() * 2; pon('medio', { t: 'andamio', x0: x, x1: x + w, y0: S, alto: h, caja: [x - 0.1, S, x + w + 0.1, S + h + 0.2] }); } }
  }
  function cablePon(capa, a, b, comba) { pon(capa, { t: 'cable', a, b, comba, caja: [Math.min(a[0], b[0]), Math.min(a[1], b[1]) - comba - 0.1, Math.max(a[0], b[0]), Math.max(a[1], b[1]) + 0.1] }); }

  // ================================================================= JUEGO
  {
    for (const tr of TRAMOS) pon('juego', { t: 'tramo_' + tr.tipo, x0: tr.x0, x1: tr.x1, caja: [tr.x0 - 3, -1.5, tr.x1 + 3, 12] });
    const [a, b] = rango(1);
    pon('juego', { t: 'calle', x0: a, x1: b, caja: [a, -1.6, b, 0.5] });
    // los resplandores y las luces del plano de juego (los pintores pintan la luz; aqui va lo que brilla de verdad)
    efectos.halos.push({ capa: 'juego', x: px(515), y: py(137), r: 2.6, color: '#ff8030', fuerza: 0.55, respira: true });
    efectos.luces.push({ x: px(515), y: py(137), z: -0.5, col: '#ff9a4a', r: 2.2 });
    const farolas = [px(518), 32.4, 48.5, 71.8, 84.8, 105.8, 119.2, 138, 146.4];
    for (const x of farolas) { pon('juego', { t: 'farola', x, caja: [x - 0.4, 0, x + 1.4, py(380) + 1.5] }); efectos.halos.push({ capa: 'juego', x: x + 0.6, y: py(380), r: 0.9, color: '#ffc68a', fuerza: 0.5, parpadea: Math.round(x) % 3 === 0 }); efectos.luces.push({ x: x + 0.6, y: py(380) - 0.3, z: 0.6, col: '#ffd09a', r: 1.6 }); }
    efectos.farolas = farolas;
    efectos.halos.push({ capa: 'juego', x: 154, y: 7.5, r: 2.8, color: '#ff8030', fuerza: 0.45, respira: true });
    efectos.humo.push({ capa: 'juego', x: 26.6, y: 4.9, vapor: true });
  }

  // ================================================================= FRENTE
  {
    const [a, b] = rango(1.35), S = py(941), rr = azar(1201);
    for (const [x0, y0, x1, y1] of [[-1, 940, 95, 840], [108, 940, 192, 872], [600, 941, 690, 860], [1500, 941, 1600, 850], [1610, 941, 1700, 880], [850, 941, 905, 900]]) pon('frente', { t: 'bloqueR', x0: px(x0), x1: px(x1), y0: py(y0), y1: py(y1), caja: [px(x0), py(y0), px(x1), py(y1) + 0.2] });
    for (const [xx, w, h, s] of [[380, 2.2, 1.9, 31], [1040, 1.6, 1.3, 32], [-40, 1.2, 1.1, 33], [1300, 1.4, 1.0, 34]]) pon('frente', { t: 'mata', x: px(xx), y: S - 0.1, w, h, sem: s, caja: [px(xx) - w, S - 0.2, px(xx) + w, S + h + 0.2] });
    for (let x = 16; x < b; x += 1.0 + rr() * 2.6) {
      const z = rr(), sem = Math.round(x * 13);
      const tipo = z < 0.26 ? 'bloqueR' : z < 0.5 ? 'mata' : z < 0.58 ? 'cadena' : z < 0.66 ? 'bidones' : z < 0.74 ? 'barandilla' : z < 0.82 ? 'cajas' : z < 0.9 ? 'varillas' : 'postes';
      if (tipo === 'bloqueR') { const w = 0.6 + rr() * 1.1; pon('frente', { t: tipo, x0: x, x1: x + w, y0: S, y1: S + 0.6 + rr() * 0.5, caja: [x, S, x + w, S + 1.3] }); }
      else if (tipo === 'mata') { const w = 1.0 + rr() * 1.4, h = 0.8 + rr() * 1.1; pon('frente', { t: tipo, x, y: S - 0.1, w, h, sem, caja: [x - w, S - 0.2, x + w, S + h + 0.2] }); }
      else pon('frente', { t: tipo, x, y: S, sem, caja: [x - 0.3, S - 0.1, x + 1.8, S + 2.2] });
    }
    for (let x = 20 + rr() * 10; x < b; x += 26 + rr() * 30) { const l = 6 + rr() * 9; pon('frente', { t: 'tubo', x0: x, x1: x + l, y: S + 0.35, caja: [x - 0.3, S, x + l + 0.3, S + 0.8] }); }
    for (let x = 30 + rr() * 20; x < b; x += 40 + rr() * 50) { const l = 5 + rr() * 6, y = CAM0.y + 5.6, c = 0.8 + rr() * 0.8; pon('frente', { t: 'cableAlto', a: [x, y], b: [x + l, y], comba: c, caja: [x - 0.1, y - c - 0.2, x + l + 0.1, y + 0.2] }); }
  }
  CACHE = { capas, efectos };
  return CACHE;
}
