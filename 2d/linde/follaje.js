// EL LINDE · FOLLAJE y lo que cuelga de los arboles: copas, matas y enredaderas.
// Solo va en arboles y suelo (regla del usuario): nunca sobre casas, metal ni construcciones. Unica excepcion
// (2026-10-18, pedida por el usuario): la chatarra del bosque, que cubre la pagina con `cubrir`.
//
// Como la referencia (concepto/referencia.png), a contraluz dorado:
//  · la copa son RAMILLETES sobre ramillas visibles. Cada ramillete se pinta como TRES MASAS PLANAS hechas de
//    hojas grandes del mismo valor (nucleo negro, medio en sombra pizarra, luz oliva hacia el sol), asi se lee
//    como masa y no como ruido de hojas; las hojas sueltas, con su peciolo, solo en el borde del ramillete
//  · huecos grandes al cielo entre ramilletes (3-6 por copa) por donde se ven las ramillas; borde rasgado
//  · en la punta de una rama (copa pequena) el ramillete se alarga a lo largo y cae, no es una bola
//  · cel de 3 valores por hoja solo en las del canto; labio claro y destellos amarillos en el canto al sol
//  · la mata baja es lo mismo con el sol rasante: arriba se enciende, dentro queda negra
//  · lo de lejos (d > 0,4) pierde tinta y hojas sueltas: manchas de bruma con el canto de luz
//  · las enredaderas son cuerdas casi negras de 4-9 px con nudos y racimos de hojitas, de largos muy
//    distintos y AGRUPADAS en racimos de 2-4 con huecos; una de cada cuatro hace un lazo
import { TINTA, azar, rgba, hash } from '../dibujo/tinta.js';
import { g, SOL, tono, cl, ponerG, brillo, RELIEVE } from './base.js';

// PALETA: oliva/ocre calido (R > G) con sombras pizarra casi neutras, nada de verde lima ni de naranja
const P = {
  dentro: '#010000', dentro2: '#181411',                            // nucleo de la masa
  sombra0: '#1a1410', sombra: '#2b241e', sombra2: '#393028',        // masa en sombra (pizarra calida)
  medio: '#463e2f', medio2: '#5a5138',                              // masa a media luz
  luz: '#78704c', luz2: '#ab9d5c', luz3: '#d4c26a',                 // masa al sol
  destello: '#e4c94e', labio: '#f0da8e', trasluz: '#c6ad58',        // canto al sol, destellos, hoja a contraluz
  ramilla: '#070604', cuerda: '#030201',
};

// la paleta de la SILUETA del primer plano (capa 8 de la pagina, la que se desenfoca): negros calidos y neutros,
// el canto no pasa de L ~60. La pagina puede usarla: hojas(x, y, rx, ry, 0, sem, { ...SILUETA })
export const SILUETA = { osc: '#030201', med: '#0d0a07', cla: '#1c1610', luz: '#3a3122', den: 1, tam: 12 };

// ---------------------------------------------------------------- lo que el follaje NO puede pisar
// En la capa JUEGO (d <= 0,1) nada encima de metal, capsulas ni plataformas. Por defecto la capsula del arbol
// de la aldea (x 5680: capsula en 5690,700 r 78) y su plataforma; la pagina puede pasar las suyas con
// respetar([{ c: [x, y, r] }, { r: [x0, y0, x1, y1] }, ...]) y asi no dependen de cifras copiadas aqui.
// No se recorta con un clip (dejaba un halo en arco): se quitan HOJAS ENTERAS que tocarian la zona.
let RESPETAR = [{ c: [5690, 700, 79] }, { r: [5546, 782, 5834, 806] }];
export function respetar(zonas) { RESPETAR = zonas || []; }
let ZON = [];
function pisa(x, y, rad) {
  for (const z of ZON) {
    if (z.c) { if (Math.hypot(x - z.c[0], y - z.c[1]) < z.c[2] + rad + 1) return true; }
    else if (x + rad > z.r[0] && x - rad < z.r[2] && y + rad > z.r[1] && y - rad < z.r[3]) return true;
  }
  return false;
}

// ---------------------------------------------------------------- una hoja
// (px,py) es el arranque; ang hacia donde apunta; forma 0 = ovalada con punta, 1 = hiedra de tres lobulos.
// cA el valor de la hoja, cB la mitad que mira al sol, lab el canto al sol (o null), ti alfa de la tinta.
function contorno(L, W, forma, s) {
  if (forma === 1) {
    g.quadraticCurveTo(L * 0.02, s * W * 1.15, L * 0.38, s * W * 1.05);
    g.quadraticCurveTo(L * 0.5, s * W * 0.55, L * 0.6, s * W * 0.5);
    g.quadraticCurveTo(L * 0.9, s * W * 0.45, L, 0);
  } else g.bezierCurveTo(L * 0.22, s * W, L * 0.68, s * W * 0.92, L, 0);
}
function contornoVuelta(L, W, forma, s) {
  if (forma === 1) {
    g.quadraticCurveTo(L * 0.9, s * W * 0.45, L * 0.6, s * W * 0.5);
    g.quadraticCurveTo(L * 0.5, s * W * 0.55, L * 0.38, s * W * 1.05);
    g.quadraticCurveTo(L * 0.02, s * W * 1.15, 0, 0);
  } else g.bezierCurveTo(L * 0.68, s * W * 0.92, L * 0.22, s * W, 0, 0);
}
function hoja(px, py, ang, L, W, forma, cA, cB, lab, ti, sx, sy, peciolo, filo) {
  const c = Math.cos(ang), s = Math.sin(ang);
  if (ZON.length && pisa(px + c * L * 0.5, py + s * L * 0.5, L * 0.5 + W)) return;
  const M0 = g.getTransform();
  g.transform(c, s, -s, c, px, py);
  const arriba = s * sx - c * sy > 0 ? -1 : 1;              // que mitad mira al sol
  if (peciolo) { g.strokeStyle = cA; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-L * 0.35, 0); g.lineTo(0, 0); g.stroke(); }
  g.beginPath(); g.moveTo(0, 0); contorno(L, W, forma, -1); contornoVuelta(L, W, forma, 1);
  g.fillStyle = cA; g.fill();
  if (filo) { g.strokeStyle = filo; g.lineWidth = 1.3; g.stroke(); g.beginPath(); g.moveTo(L * 0.08, 0); g.lineTo(L * 0.75, 0); g.lineWidth = 1; g.stroke(); }
  else if (ti > 0) { g.strokeStyle = rgba(TINTA, ti); g.lineWidth = 1; g.stroke(); }
  if (cB) { g.beginPath(); g.moveTo(0, 0); contorno(L, W * 0.86, forma, arriba); g.closePath(); g.fillStyle = cB; g.fill(); }
  if (lab) { g.beginPath(); g.moveTo(L * 0.12, arriba * W * 0.55); contorno(L * 0.97, W * 0.97, forma, arriba); g.strokeStyle = lab; g.lineWidth = 1.4; g.stroke(); }
  if (ti > 0.3 && cB) { g.strokeStyle = rgba(TINTA, ti * 0.5); g.lineWidth = 0.8; g.beginPath(); g.moveTo(L * 0.05, 0); g.lineTo(L * 0.8, 0); g.stroke(); }
  g.setTransform(M0);
}

// una mancha plana (union de circulos ondulada) para lo de lejos
function masa(cx, cy, R, col, rr, n = 7, aplas = 0.8) {
  if (ZON.length && pisa(cx, cy, R)) return;
  g.fillStyle = col; g.beginPath();
  const m = 9, a0 = rr() * 6.283;
  for (let k = 0; k <= m; k++) { const a = a0 + (k / m) * 6.283, q = R * (0.5 + rr() * 0.18); if (k === 0) g.moveTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q * aplas); else g.quadraticCurveTo(cx + Math.cos(a - 0.35) * q * 1.12, cy + Math.sin(a - 0.35) * q * 1.12 * aplas, cx + Math.cos(a) * q, cy + Math.sin(a) * q * aplas); }
  g.fill();
  for (let k = 0; k < n + 5; k++) { const a = rr() * 6.283, q = R * (0.3 + rr() * 0.25); hoja(cx + Math.cos(a) * q, cy + Math.sin(a) * q * aplas, a + (rr() - 0.5) * 0.7, R * (0.45 + rr() * 0.35), R * (0.16 + rr() * 0.08), rr() < 0.3 ? 1 : 0, col, null, null, 0, 1, 0, false); }
}

// ---------------------------------------------------------------- COPA / MATA
// hojas(cx, cy, rx, ry, d, sem, o): o.den densidad, o.tam tamano de hoja, o.osc/med/cla/luz paleta propia
// (la silueta del primer plano), o.mata true/false (por defecto: si toca el suelo), o.forma 0/1,
// o.lado -1/1 hacia donde sale la rama (en la punta de una rama el ramillete se alarga hacia ese lado).
export function hojas(cx, cy, rx, ry, d, sem, o = {}) {
  const propia = !!(o.osc || o.med || o.cla || o.luz);
  if (d >= 0.4 || propia || typeof document === 'undefined') return pintarCopa(cx, cy, rx, ry, d, sem, o);
  // de cerca, la copa se pinta aparte y se le pone GRANO solo encima de lo pintado (source-atop): la referencia
  // no tiene ningun plano liso, ni en los negros; el cel de 3 valores sigue mandando
  const bx = Math.floor(cx - rx * 1.9 - 120), by = Math.floor(cy - ry * 2.1 - 120), bw = Math.ceil(rx * 3.8 + 240), bh = Math.ceil(ry * 4.4 + 280);
  const cv = document.createElement('canvas'); cv.width = bw; cv.height = bh;
  const q = cv.getContext('2d'), g0 = g;
  q.translate(-bx, -by); ponerG(q);
  try { pintarCopa(cx, cy, rx, ry, d, sem, o); } finally { ponerG(g0); }
  const ls = cx < SOL.x ? 1 : -1, mata = o.mata ?? (cy + ry * 0.6 > 980);
  if (RELIEVE) {
    // VOLUMEN de bola: luz arriba del lado del sol, la panza y el lado contrario hundidos (solo sobre lo pintado)
    q.setTransform(1, 0, 0, 1, -bx, -by); q.globalCompositeOperation = 'source-atop';
    const R = Math.max(rx, ry) * 1.3, lx = cx + ls * rx * 0.35, ly = cy - ry * 0.55;
    const gv = q.createRadialGradient(lx, ly, 0, lx, ly, R); gv.addColorStop(0, 'rgba(246,232,186,.2)'); gv.addColorStop(0.38, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(6,7,3,.6)');
    q.fillStyle = gv; q.fillRect(cx - rx * 2, cy - ry * 2.2, rx * 4, ry * 4.6);
    // y la sombra que echa sobre lo de detras (las copas, no las matas: debajo de una mata esta el suelo)
    if (!mata) {
      g.save(); g.translate(cx - ls * rx * 0.18, cy + ry * 0.8); g.scale(1, 0.55);
      const gs = g.createRadialGradient(0, 0, 0, 0, 0, rx * 1.05); gs.addColorStop(0, 'rgba(6,5,2,.3)'); gs.addColorStop(1, 'rgba(6,5,2,0)');
      g.fillStyle = gs; g.fillRect(-rx * 1.1, -rx * 1.1, rx * 2.2, rx * 2.2); g.restore();
    }
  }
  q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'source-atop';
  const k = 1 - d / 0.4;
  q.globalAlpha = 0.85 * k; q.fillStyle = q.createPattern(grano(), 'repeat');
  q.translate(-((bx % 64) + 64) % 64, -((by % 64) + 64) % 64); q.fillRect(0, 0, bw + 64, bh + 64);
  g.drawImage(cv, bx, by);
}
// textura de grano: motas de 2-3 px claras (oliva) y oscuras, semitransparentes, en una tesela de 64
let GRANO = null;
function grano() {
  if (GRANO) return GRANO;
  const n = 44, a = document.createElement('canvas'); a.width = a.height = n;
  const A = a.getContext('2d'), id = A.createImageData(n, n), rr = azar(4242);
  for (let i = 0; i < n * n; i++) {
    const v = rr(), j = i * 4;
    if (v < 0.25) { id.data[j] = 104; id.data[j + 1] = 92; id.data[j + 2] = 62; id.data[j + 3] = 26 + rr() * 40; }
    else if (v < 0.55) { id.data[j + 3] = 50 + rr() * 70; }
  }
  A.putImageData(id, 0, 0);
  GRANO = document.createElement('canvas'); GRANO.width = GRANO.height = 64;
  const G = GRANO.getContext('2d'); G.imageSmoothingEnabled = true; G.drawImage(a, 0, 0, 64, 64);
  return GRANO;
}
function pintarCopa(cx, cy, rx, ry, d, sem, o = {}) {
  const rr = azar(sem), den = o.den ?? 1, mata = o.mata ?? (cy + ry * 0.6 > 980);
  const propia = !!(o.osc || o.med || o.cla || o.luz);
  const T = (col, f = 1) => tono(col, d * f, cx);           // los claros se lavan menos: el contraluz atraviesa
  const C = propia
    ? { A: o.osc || P.dentro, s1: o.osc || P.sombra0, s2: o.med || P.sombra, m1: o.med || P.medio, m2: o.cla || P.medio2, l1: o.cla || P.luz, l2: o.luz || P.luz2, l3: o.luz || P.luz3, des: o.luz || P.destello, lab: o.luz || P.labio, tras: o.luz || P.trasluz, ram: o.osc || P.ramilla }
    : { A: T(P.dentro), A2: T(P.dentro2), s0: T(P.sombra0), s1: T(P.sombra), s2: T(P.sombra2), m1: T(P.medio), m2: T(P.medio2), l1: T(P.luz, 0.8), l2: T(P.luz2, 0.7), l3: T(P.luz3, 0.6), des: T(P.destello, 0.5), lab: T(P.labio, 0.5), tras: T(P.trasluz, 0.6), ram: T(P.ramilla) };
  let sx = SOL.x - cx, sy = SOL.y - cy; const sl = Math.hypot(sx, sy) || 1; sx /= sl; sy /= sl;
  if (mata) { sx = sx * 0.8; sy = -0.75; const q = Math.hypot(sx, sy); sx /= q; sy /= q; } // sol rasante
  const ti = propia ? 0 : d < 0.4 ? 0.95 * (1 - d / 0.4) : 0;
  const lejos = d > 0.4;
  // en la punta de una rama: mas ancho que alto, y cae
  const punta = !mata && !propia && rx <= 120 && ry <= 80;
  const lado = o.lado ?? (hash(sem, 3) < 0.5 ? -1 : 1);
  if (punta) { if (o.lado) cx += lado * rx * 0.2; rx *= 1.3; ry *= 1.1; }
  const hz = (o.tam || 12) * (1 + d * 0.25) * (lejos ? 1.3 : 1);
  const tocan = () => (d <= 0.1 ? RESPETAR.filter((z) => (z.c ? Math.abs(z.c[0] - cx) < rx * 1.3 + z.c[2] + 60 && Math.abs(z.c[1] - cy) < ry * 1.5 + z.c[2] + 60 : z.r[2] > cx - rx * 1.3 - 60 && z.r[0] < cx + rx * 1.3 + 60 && z.r[3] > cy - ry * 1.5 - 60 && z.r[1] < cy + ry * 1.5 + 60)) : []);
  ZON = tocan();
  // si la copa le cae encima a una capsula, la masa sube DETRAS y por encima de ella (no la rodea como un nido)
  const circ = ZON.filter((z) => z.c);
  for (const z of circ) if (Math.abs(cx - z.c[0]) < rx + z.c[2] && cy + ry * 0.4 > z.c[1] - z.c[2]) cy = Math.min(cy, z.c[1] - z.c[2] - ry * 0.45);
  if (circ.length) ZON = tocan();
  const choca = (x, y, R) => circ.some((z) => Math.hypot(x - z.c[0], y - z.c[1]) < z.c[2] + R * 0.8 || (y > z.c[1] - z.c[2] * 0.6 && Math.abs(x - z.c[0]) < z.c[2] + R * 0.5));

  // ---- huecos grandes al cielo (copas cercanas): ningun ramillete se centra dentro
  const huecos = [];
  if (!mata && !propia && !lejos && !punta && rx > 110) {
    const nh = o.huecos ?? 3 + Math.floor(rr() * 3);
    for (let k = 0; k < nh; k++) { const a = rr() * 6.283, q = 0.3 + rr() * 0.5; huecos.push({ x: cx + Math.cos(a) * q * rx * 0.85, y: cy + Math.sin(a) * q * ry * 0.75 - ry * 0.12, r: Math.min(rx, ry) * (0.08 + rr() * 0.08) }); }
  }
  // ---- ramilletes
  const Rr = cl(Math.min(rx, ry) * 0.4, 16, 70) * (lejos ? 1.3 : 1);
  const nR = Math.max(3, Math.round((rx * ry * 4.2) / (Rr * Rr) * Math.min(1.25, 0.55 + den * 0.6)));
  const ram = [];
  if (punta) {
    // en la punta de una rama: un ramo que sale a lo largo de la rama y cae hacia el extremo, con 2-3 caidas
    // sin o.lado no se sabe hacia donde sale la rama: el ramo cae por los DOS extremos (en arco de sauce)
    const ys = (al) => cy - ry * 0.3 + ry * (o.lado ? 1.1 * ((al * lado + 1) / 2) ** 2 : 0.85 * al * al);
    const n = Math.max(4, Math.round(nR * 0.75));
    for (let k = 0; k < n; k++) {
      const al = rr() * 2 - 1, x = cx + al * rx * 0.8, y = ys(al) + (rr() - 0.5) * ry * 0.55 * (1 - 0.3 * Math.abs(al));
      ram.push({ x, y, u: al, v: (y - cy) / ry, R: Rr * (1.05 - 0.4 * Math.abs(al)) * (0.75 + rr() * 0.4), z: rr() });
    }
    for (let c = 0, nc = 2 + Math.floor(rr() * 2); c < nc; c++) {
      const al = (rr() < 0.5 ? -1 : 1) * (0.4 + rr() * 0.55); let x = cx + al * rx * 0.8, y = ys(al);
      for (let j = 0, m = 2 + Math.floor(rr() * 3); j < m; j++) { const R = Rr * (0.6 - j * 0.1) * (0.8 + rr() * 0.3); y += R * 1.2; x += (rr() - 0.5) * R * 0.5; ram.push({ x, y, u: (x - cx) / rx, v: (y - cy) / ry, R, z: rr() }); }
    }
  }
  for (let k = 0; !punta && k < nR * 4 && ram.length < nR; k++) {
    const a = rr() * 6.283, q = Math.sqrt(rr()), borde = 1 + 0.22 * Math.sin(a * 3 + sem) + 0.12 * Math.sin(a * 7 + sem * 0.3);
    if (q > borde * 0.98) continue;
    let u = Math.cos(a) * q, v = Math.sin(a) * q * (mata ? 1.15 : 1);
    if (mata && v > 0.85) continue;
    const x = cx + u * rx * 0.92, y = cy + Math.min(v, 1.1) * ry * 0.92, R = Rr * (0.7 + rr() * 0.55);
    if (huecos.some((h) => Math.hypot(x - h.x, y - h.y) < h.r + R * 0.55)) continue;
    if (circ.length && choca(x, y, R)) continue;
    ram.push({ x, y, u, v, R, z: rr() });
  }
  // ramitas que se escapan del borde (borde rasgado); la copa tambien deja caer ramitas por debajo
  const nE = Math.round(nR * 0.3 + 1);
  for (let k = 0; k < nE; k++) {
    const abajo = !mata && rr() < (punta ? 0.6 : 0.3), a = abajo ? Math.PI / 2 + (rr() - 0.5) * 1.8 : -Math.PI / 2 + (rr() - 0.5) * Math.PI * (mata ? 1.2 : 1.9), q = 1.02 + rr() * (abajo ? 0.45 : 0.28), u = Math.cos(a) * q, v = Math.sin(a) * q;
    const ex = cx + u * rx * 0.92, ey = cy + v * ry * 0.92, eR = Rr * (0.4 + rr() * 0.3);
    if (circ.length && choca(ex, ey, eR)) continue;
    ram.push({ x: ex, y: ey, u, v, R: eR, z: rr(), suelto: true });
  }
  for (const r of ram) {
    r.luz = cl((r.u * sx + r.v * sy) * 0.85 + 0.12 + (r.z - 0.5) * 0.4, -1, 1);
    r.orden = r.luz * 0.6 + Math.hypot(r.u, r.v) * 0.3 + r.z * 0.4;
    // hacia donde se alarga: hacia fuera de la copa y, en la copa, cayendo un poco
    const fx = r.u * rx || 0.01, fy = r.v * ry; r.phi = Math.atan2(fy + (mata ? -ry * 0.4 : ry * 0.25), fx);
    if (punta) r.phi = Math.atan2(0.4 + 0.5 * Math.abs(r.u), r.u >= 0 ? 1 : -1);
  }
  ram.sort((a, b) => a.orden - b.orden);

  // ---- ramas madre y ramillas (se ven en los huecos)
  if (!lejos) {
    const nm = 3 + Math.floor(rr() * 3), madres = [];
    for (let k = 0; k < nm; k++) {
      const f = (k + 0.5) / nm - 0.5;
      const bx = punta ? (o.lado ? cx - lado * rx * 0.7 : cx + (rr() - 0.5) * rx * 0.3) : cx + (mata ? f * rx * 1.1 : f * rx * 0.25) + (rr() - 0.5) * 20, by = punta ? cy - ry * 0.25 : mata ? cy + ry * 0.75 : cy + ry * 0.9;
      const tx = cx + f * rx * (mata ? 1.2 : 1.3) + (rr() - 0.5) * rx * 0.3, ty = punta ? cy + (rr() - 0.3) * ry * 0.6 : cy - ry * (0.3 + rr() * 0.45);
      madres.push({ bx, by, tx, ty, mx: (bx + tx) / 2 + (rr() - 0.5) * rx * 0.2, my: by + (ty - by) * 0.6 });
    }
    g.strokeStyle = C.ram; g.lineCap = 'round';
    for (const m of madres) {
      if (ZON.length && (pisa(m.bx, m.by, 4) || pisa(m.tx, m.ty, 4) || pisa(m.mx, m.my, 4))) continue;
      g.lineWidth = (mata ? 3 : 5) * (1 - d * 0.6); g.beginPath(); g.moveTo(m.bx, m.by); g.quadraticCurveTo(m.mx, m.my, m.tx, m.ty); g.stroke();
    }
    for (const r of ram) {
      let best = null, bd = 1e9;
      for (const m of madres) for (let t = 0.3; t <= 1.001; t += 0.1) { const q1 = (1 - t) * (1 - t), q2 = 2 * t * (1 - t), q3 = t * t, px = q1 * m.bx + q2 * m.mx + q3 * m.tx, py = q1 * m.by + q2 * m.my + q3 * m.ty, dd = (px - r.x) ** 2 + (py - r.y) ** 2; if (dd < bd) { bd = dd; best = [px, py]; } }
      if (ZON.length && (pisa(r.x, r.y, r.R * 0.3) || pisa(best[0], best[1], 3))) continue;
      if ((!r.suelto && r.z < 0.4) || bd > (r.R * 2.2) ** 2) continue;                // no a todos: si no, la copa es un paraguas de varillas
      g.lineWidth = (2.8 - Math.hypot(r.u, r.v) * 1.4) * (1 - d * 0.6) + 0.7;
      g.beginPath(); g.moveTo(best[0], best[1]); g.quadraticCurveTo((best[0] + r.x) / 2, (best[1] + r.y) / 2 + (mata ? -6 : 10), r.x, r.y); g.stroke();
    }
  }
  // ---- lo de lejos: manchas de bruma con el canto de luz
  if (lejos) {
    for (const r of ram) {
      masa(r.x, r.y, r.R * 1.15, r.luz > 0.25 ? C.m1 : C.s1, rr, 8, 0.8);
      if (r.luz > 0.1) masa(r.x + sx * r.R * 0.35, r.y + sy * r.R * 0.35, r.R * 0.7, r.luz > 0.55 ? C.l2 : C.m2, rr, 5, 0.8);
    }
    for (const r of ram) if (r.luz > 0.3) for (let k = 0; k < 5; k++) { const a = Math.atan2(sy, sx) + (rr() - 0.5) * 2.2; hoja(r.x + Math.cos(a) * r.R * 0.9, r.y + Math.sin(a) * r.R * 0.75, a + (rr() - 0.5) * 0.8, hz * 1.6, hz * 0.6, 0, r.luz > 0.6 ? C.l2 : C.m2, null, null, 0, sx, sy, false); }
    ZON = [];
    return;
  }

  // ---- cada ramillete: tres masas planas de hojas grandes del mismo valor + hojas sueltas en su borde
  const k0 = Math.min(1.25, 0.55 + den * 0.6);
  const capa = (r, n, rad, off, lo, hi, col, colB, tiA, forma, lab, filo) => {
    const c = Math.cos(r.phi), s = Math.sin(r.phi), ox = r.x + sx * r.R * off, oy = r.y + sy * r.R * off;
    for (let k = 0; k < n; k++) {
      // posicion en una elipse alargada a lo largo de phi (1,35 : 0,8)
      const a = rr() * 6.283, q = Math.pow(rr(), 0.6), lu = Math.cos(a) * q * rad * 1.3, lv = Math.sin(a) * q * rad * 0.8;
      const hx = ox + lu * c - lv * s, hy = oy + lu * s + lv * c;
      let ang = Math.atan2(hy - r.y, hx - r.x) * 0.6 + r.phi * 0.4 + (rr() - 0.5) * 1.5;
      ang = mata ? ang - Math.sin(ang + 1.57) * 0.25 : ang + Math.cos(ang) * 0.3;
      const L = hz * (rr() < 0.12 ? hi * (1 + rr() * 0.4) : lo * 0.7 + Math.pow(rr(), 1.8) * (hi - lo * 0.7)), fm = forma ?? (mata ? (rr() < 0.6 ? 1 : 0) : rr() < 0.2 ? 1 : 0);
      const W = L * (fm === 1 ? 0.5 : 0.38);
      // canto al sol del ramillete: la mitad de la hoja que mira al sol y el labio
      const t = (Math.cos(a) * c - Math.sin(a) * s) * sx + (Math.cos(a) * s + Math.sin(a) * c) * sy;
      const lb = lab && q > 0.55 && t > 0.35 ? lab : null;
      hoja(hx, hy, ang, L, W, fm, col, colB && t > -0.1 ? colB : null, lb, tiA, sx, sy, false, filo);
    }
  };
  // en TRES PASADAS sobre todos los ramilletes (nucleos, medios, luces): asi cada valor es una masa plana
  // continua y un nucleo negro no tapa la luz del ramillete de detras
  for (const fase of [1, 2, 3]) for (const r of ram) {
    const f = r.suelto ? 0.45 : 1, N = (a, b) => Math.max(1, Math.round((a + rr() * (b - a)) * f * k0));
    // 1) nucleo negro: una masa plana ondulada a lo largo del ramillete y su silueta de hojas grandes
    if (fase === 1) {
    if (!r.suelto && !(ZON.length && pisa(r.x, r.y, r.R * 0.85))) {
      const c = Math.cos(r.phi), s = Math.sin(r.phi), m = 10, a0 = rr() * 6.283;
      g.fillStyle = C.A; g.beginPath();
      for (let k = 0; k <= m; k++) {
        const a = a0 + (k / m) * 6.283, q = r.R * (r.luz < 0 ? 0.52 : 0.42) * (1 + rr() * 0.35), lu = Math.cos(a) * q * 1.25, lv = Math.sin(a) * q * 0.8;
        const px = r.x + lu * c - lv * s, py = r.y + lu * s + lv * c;
        if (k === 0) g.moveTo(px, py); else { const b = a - 0.3, qb = q * 1.15, bu = Math.cos(b) * qb * 1.25, bv = Math.sin(b) * qb * 0.8; g.quadraticCurveTo(r.x + bu * c - bv * s, r.y + bu * s + bv * c, px, py); }
      }
      g.fill();
    }
    capa(r, N(9, 13), r.R * 0.7, -0.15, 1.5, 2.8, C.A, null, ti * 0.6, o.forma, null, C.A2);
    continue;
    }
    // 2) masa en sombra/medio, corrida hacia el sol
    if (fase === 2) {
      // cel de dos valores por hoja: la mitad que mira al sol un escalon por encima (solo las del lado del sol)
      const colB = r.luz > 0.45 ? C.m1 : r.luz > 0.05 ? C.s2 : C.s1, celB = r.luz > 0.45 ? C.m2 : r.luz > 0.05 ? C.m1 : C.s2;
      capa(r, N(12, 17), r.R * 0.68, 0.18, 1.0, 2.2, colB, celB, ti * 0.9, o.forma, null);
      continue;
    }
    // 3) masa de luz en el canto al sol (no en la panza)
    // (cada ramillete tiene su lomo con luz; en la panza de la copa es solo un medio apagado)
    {
      const fuerte = r.luz > 0.5, media = r.luz > 0.1;
      const cA = fuerte ? C.l1 : media ? C.m2 : C.m1, cB = fuerte ? (rr() < 0.5 ? C.l2 : C.l3) : media ? C.l1 : C.m2;
      capa(r, N(fuerte ? 4 : 3, fuerte ? 8 : 6) * (mata && r.v > 0 ? 0.6 : 1), r.R * 0.4, 0.5, 1.0, 1.9, cA, cB, ti, o.forma, fuerte ? C.lab : media ? C.l3 : null);
      // destellos: hojas pequenas amarillas saturadas en el filo que mira al sol
      if (fuerte && !propia) for (let k = 0; k < 1 + Math.floor(rr() * 3); k++) {
        const a = Math.atan2(sy, sx) + (rr() - 0.5) * 1.6, q = r.R * (0.6 + rr() * 0.35);
        hoja(r.x + Math.cos(a) * q, r.y + Math.sin(a) * q * 0.85, a + (rr() - 0.5) * 0.8, hz * (0.7 + rr() * 0.6), hz * 0.32, 0, C.des, C.lab, null, ti * 0.7, sx, sy, false);
      }
    }
    // 4) hojas sueltas en el borde del ramillete (las del borde de la copa con su peciolo)
    const borde = Math.hypot(r.u, r.v) > 0.7 || r.suelto;
    if (borde) for (let k = 0; k < N(2, 4); k++) {
      const a = r.phi + (rr() - 0.5) * 2.4, q = r.R * (0.85 + rr() * 0.4), hx = r.x + Math.cos(a) * q, hy = r.y + Math.sin(a) * q * 0.85;
      const t = Math.cos(a) * sx + Math.sin(a) * sy, L = hz * (1.1 + rr() * 1.3);
      let cA = t > 0.35 && r.luz > 0.1 ? C.m2 : C.s1, cB = t > 0.35 && r.luz > 0.1 ? C.l2 : C.s2, lb = t > 0.55 && r.luz > 0.3 ? C.lab : null;
      // la del borde al sol, contra el cielo y en una copa: a contraluz se vuelve translucida
      if (!mata && !propia && r.luz > 0.5 && t > 0.5 && rr() < 0.3) { cA = C.tras; cB = C.l3; lb = C.lab; }
      hoja(hx, hy, a + (rr() - 0.5) * 0.6 + (mata ? 0 : 0.25), L, L * 0.37, mata && rr() < 0.5 ? 1 : 0, cA, cB, lb, ti, sx, sy, true);
    }
  }
  ZON = [];
}

// ---------------------------------------------------------------- ENREDADERAS
// una cuerda casi negra por puntos, que adelgaza hacia la punta, con nudos y racimos de hojitas
function cuerda(pts, w0, d, rr, x0, sx, sy) {
  const col = tono(P.cuerda, d, x0), ti = d < 0.35 ? 1 - d / 0.35 : 0;
  g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  const n = pts.length;
  for (let i = 1; i < n; i++) { g.lineWidth = Math.max(1.2, w0 * (1 - (i / n) * 0.55)); g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke(); }
  // brillo de canto: una hebra fina en el lado del sol
  if (d < 0.5 && w0 > 4.5) { g.strokeStyle = rgba(tono('#6a5a30', d * 0.6, x0), 0.6); g.lineWidth = 1; g.beginPath(); for (let i = 1; i < n; i++) { const w = Math.max(1, w0 * (1 - (i / n) * 0.55)) * 0.42; g.moveTo(pts[i - 1][0] + w * Math.sign(sx), pts[i - 1][1]); g.lineTo(pts[i][0] + w * Math.sign(sx), pts[i][1]); } g.stroke(); }
  // nudos: abultados
  g.fillStyle = col;
  for (let i = 3; i < n - 1; i += 5 + Math.floor(rr() * 7)) { const w = Math.max(1.2, w0 * (1 - (i / n) * 0.55)); g.beginPath(); g.ellipse(pts[i][0], pts[i][1], w * 1.05, w * 1.7, (rr() - 0.5) * 0.6, 0, 6.283); g.fill(); }
  // racimos de hojitas de 4-8 px: oscuras, alguna con luz en el lado del sol
  const os = tono(P.sombra0, d, x0), os2 = tono(P.sombra, d, x0), me = tono(P.medio2, d, x0), lu = tono(P.luz2, d * 0.7, x0), lab = tono(P.labio, d * 0.5, x0);
  for (let i = 1; i < n; i += 2 + Math.floor(rr() * 5)) {
    if (rr() < 0.3) continue;
    const m = 2 + Math.floor(rr() * 5), [px, py] = pts[i];
    for (let k = 0; k < m; k++) {
      const a = (rr() < 0.5 ? 0 : Math.PI) + (rr() - 0.5) * 1.6 + 0.5, L = (4 + rr() * 4.5) * (1 - d * 0.4), z = rr();
      const luz = Math.cos(a) * sx > 0.2 && z < 0.22;
      hoja(px + (rr() - 0.5) * 3, py + (rr() - 0.5) * 4, a, L * 1.3, L * 0.62, 1, luz ? me : z < 0.75 ? col : os, luz ? lu : os2, luz && z < 0.15 ? lab : null, ti * 0.8, sx, sy, false);
    }
  }
}
// LIANA: catenaria entre dos puntos de rama, con sag px de comba
export function liana(x0, y0, x1, y1, sag, d, sem, w = 5) {
  const rr = azar(sem); let sx = SOL.x - x0, sy = SOL.y - y0; const q = Math.hypot(sx, sy) || 1; sx /= q; sy /= q;
  const pts = []; const n = Math.max(8, Math.round(Math.hypot(x1 - x0, y1 - y0) / 8));
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t + Math.sin(t * 9 + sem) * 1.5, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag * (1 - 0.15 * Math.sin(t * 6 + sem))]); }
  cuerda(pts, w * (1 - d * 0.6), d, rr, x0, sx, sy);
}
// COLGAJO: lo que cuelga de una rama en (x, y): caida de largo l (con su vaiven), uno de cada cuatro hace un
// lazo y alguno es una barba de musgo colgante oscuro. Aunque se llame a paso fijo, las caidas se AGRUPAN en
// racimos de 2-4 (se arriman al centro de su grupo de ~110 px) y alguna falta: nunca cortina de abalorios.
export function colgajo(x, y, l, d, sem) {
  const gi = Math.round(x / 110), cg = gi * 110 + (hash(gi, 11) - 0.5) * 50;
  if (hash(sem, 5) < 0.12) return;                              // alguna falta: huecos en la cortina
  x = x + (cg - x) * 0.55 + (hash(sem, 6) - 0.5) * 8;
  l *= 0.55 + hash(sem, 7) * 0.9;                               // largos muy distintos
  const rr = azar(sem); let sx = SOL.x - x, sy = SOL.y - y; const q = Math.hypot(sx, sy) || 1; sx /= q; sy /= q;
  const tipo = sem % 4 === 1 ? 'lazo' : sem % 7 === 3 ? 'barba' : 'caida';
  const w0 = (4 + rr() * 5) * (1 - d * 0.6);
  if (tipo === 'barba') {
    // musgo colgante: un manojo de hebras finas y onduladas que acaba rasgado
    const col = tono(P.cuerda, d, x), ll = l * (0.35 + rr() * 0.3), m = 9 + Math.floor(rr() * 8);
    g.strokeStyle = col; g.lineCap = 'round';
    for (let k = 0; k < m; k++) {
      const ox = (rr() - 0.5) * 22, lk = ll * (0.45 + rr() * 0.55), ph = rr() * 6;
      g.lineWidth = (1 + rr() * 2.2) * (1 - d * 0.5); g.beginPath(); g.moveTo(x + ox * 0.3, y);
      for (let t = 0.1; t <= 1.001; t += 0.1) g.lineTo(x + ox * (0.3 + t * 0.7) + Math.sin(t * 8 + ph) * 3, y + lk * t);
      g.stroke();
    }
    g.fillStyle = col; g.beginPath(); g.ellipse(x, y + ll * 0.12, 9, ll * 0.16, 0, 0, 6.283); g.fill();
    return;
  }
  const pts = [];
  if (tipo === 'lazo') {
    // lazo: comba hasta un punto vecino de la misma rama, y de lo mas bajo cae un trozo
    const dx = (rr() < 0.5 ? -1 : 1) * (60 + rr() * 90), sag = cl(l * (0.35 + rr() * 0.25), 60, 150);
    liana(x, y, x + dx, y + (rr() - 0.5) * 16, sag, d, sem + 1, w0);
    const bx = x + dx / 2, by = y + sag;
    const l2 = l * (0.25 + rr() * 0.45);
    for (let t = 0; t <= 1.001; t += 8 / l2) pts.push([bx + Math.sin(t * 4 + sem) * 4 * t, by + l2 * t]);
    if (pts.length > 2) cuerda(pts, w0 * 0.75, d, rr, x, sx, sy);
    return;
  }
  const ll = l * (0.7 + rr() * 0.6), amp = 3 + rr() * 9, fr = 2 + rr() * 4;
  for (let t = 0; t <= 1.001; t += Math.min(0.1, 8 / ll)) pts.push([x + Math.sin(t * fr + sem) * amp * t + t * t * (rr() - 0.5) * 2, y + ll * t]);
  cuerda(pts, w0, d, rr, x, sx, sy);
  const [ex, ey] = pts[pts.length - 1];
  if (rr() < 0.12) { g.strokeStyle = tono(P.cuerda, d, x); g.lineWidth = Math.max(1, w0 * 0.4); g.beginPath(); g.arc(ex + 5, ey, 5, Math.PI, Math.PI * 2.6); g.stroke(); }
}

// BANCO (?banco=follaje) a 2200x1500 (el lienzo se ve a 1:1). Cajas del medidor, todas DENTRO del follaje:
//   copa cercana (d 0, ~640x500): 330,220,450,420 y 180,250,300,450
//   copa de la aldea (d 0,02): 1680,240,1800,440 y 1560,180,1680,380
//   mata baja (d 0): 330,1100,450,1300 y 200,1050,320,1250
//   enredaderas delante de una copa media (d 0,22): 1000,760,1120,960 / 820,780,940,980 / 1180,840,1300,1040
//   primer plano en silueta desenfocado (como la capa 8 de la pagina): 1500,1250,1620,1450
export function banco() {
  const ramaB = (pts, w) => { for (const [ww, c] of [[w + 4, TINTA], [w, '#2a2519']]) { g.strokeStyle = c; g.lineWidth = ww; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]); g.stroke(); } };
  hojas(1180, 200, 170, 110, 0.46, 13, { den: 0.55, tam: 8 });
  hojas(820, 210, 150, 100, 0.3, 2, { den: 0.75, tam: 9 });
  // copa media detras de las enredaderas: mas clara (bruma), para que las cuerdas negras se lean delante
  hojas(1070, 900, 340, 210, 0.05, 31, { den: 1.1, mata: false, huecos: 2 });
  // copa cercana grande con su rama
  ramaB([[0, 660], [200, 580], [380, 480]], 18);
  hojas(370, 320, 320, 250, 0, 5, { den: 1 });
  // copa del arbol de la aldea
  ramaB([[2200, 720], [1900, 650], [1740, 470]], 15);
  hojas(1700, 300, 240, 210, 0.02, 5684, { den: 1.1, huecos: 2 });
  // la rama de las enredaderas: catenarias de verdad entre dos ramas, caidas en racimos y una copa en su punta
  ramaB([[740, 700], [1060, 610], [1440, 680]], 14);
  hojas(1470, 640, 90, 55, 0, 77, { den: 0.9, lado: 1 });
  liana(780, 690, 1010, 640, 140, 0, 71, 7); liana(1000, 640, 1250, 655, 75, 0, 72, 5); liana(1130, 648, 1420, 686, 150, 0.04, 73, 6);
  for (let k = 0; k < 20; k++) { const x = 780 + k * 30; colgajo(x, 650 + Math.abs(x - 1080) * 0.1 - 6, 90 + hash(k, 9) * 230, k % 4 ? 0 : 0.05, 900 + k); }
  // mata baja con el sol rasante
  hojas(380, 1220, 270, 220, 0, 21, { den: 1 });
  // primer plano en silueta, desenfocado y con bokeh, como lo pinta la pagina (capa 8: blur 5)
  const q = document.createElement('canvas'); q.width = g.canvas.width; q.height = g.canvas.height;
  const g0 = g; ponerG(q.getContext('2d'));
  hojas(1660, 1450, 430, 310, 0, 5, SILUETA);
  ponerG(g0); g.save(); g.filter = 'blur(5px)'; g.drawImage(q, 0, 0); g.restore();
  g.save(); g.globalCompositeOperation = 'lighter';
  { const rr = azar(111); for (let k = 0; k < 16; k++) brillo(1300 + rr() * 850, 1220 + rr() * 260, 4 + rr() * 14, '#ffe6a8', 0.3 + rr() * 0.3); }
  g.restore();
}
