// EL LINDE · HIERRO y CHATARRA oxidada: chapa, pasarela, autobus, postes, valla, la rejilla del conducto,
// el coche, la parada y la arana mecanica. SIN vegetacion (regla del usuario): el abandono se cuenta con
// oxido PARDO (nunca naranja: es de la Podredumbre), mugre, picado, abolladuras y cristales rotos.
// UNICA EXCEPCION (2026-10-18, pedida por el usuario): la chatarra del bosque (autobus, cisterna, viga) lleva
// musgo y hiedra encima; se lo pone la pagina (`cubrir` en concepto_linde.html), no estas piezas.
// Luz (guia del director): todo lo cercano esta en sombra, pizarra casi negra en tres planos de cel, y el
// contraluz solo LAME el canto que mira arriba o al sol con un hilo ocre de 1,5-3 px.
import { TINTA, azar, rgba, trazar, tinta, mezclar } from '../dibujo/tinta.js';
import { g, ponerG, sueloY, tono, AGUA, ladoLuz, RELIEVE } from './base.js';

// paleta a d = 0 (la bruma la sube con tono())
const P = {
  negro: '#080608', hueco: '#030201', sombra: '#151316', medio: '#1e1b1e', luz: '#383438', claro: '#5a5452', frio: '#20252a',
  agua: '#37362e', picado: '#8e8878', canto: '#c0a374', pico: '#dccb9c', oxido: '#583d2a', oxidoM: '#785738', labio: '#a8825a',
};
const TW = (d) => (d < 0.4 ? 2.6 * (1 - d / 0.4) + 0.4 : 0);   // grueso de la tinta: desaparece con la bruma

// ---------------------------------------------------------------- utilidades de forma
function centro(pts) { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; }
// cuanto mira una normal a la luz: arriba manda, y el lado del sol suma
const aLaLuz = (nx, ny, lado) => -ny + nx * lado * 0.75;
// normal de un trazo abierto hacia la luz (para tubos y barras)
function normalLuz(pts, lado) {
  const a = pts[0], b = pts[pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
  if (aLaLuz(nx, ny, lado) < 0) { nx = -nx; ny = -ny; }
  return [nx, ny];
}
function camino(pts, dx = 0, dy = 0) { g.beginPath(); g.moveTo(pts[0][0] + dx, pts[0][1] + dy); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0] + dx, pts[k][1] + dy); }
function mancha(cx, cy, rx, ry, rr) {
  const n = 5 + Math.floor(rr() * 4); g.beginPath();
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, f = 0.55 + rr() * 0.6; k ? g.lineTo(cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f) : g.moveTo(cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f); }
  g.closePath();
}
function rrect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r); g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r); g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r); g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath(); }
// churreton de oxido: lengua que se afila hacia abajo, cuerpo pardo y alma mas clara, labio arriba
function churreton(px, py, an, l, d, x, rr, a = 0.7) {
  const n = 7, izq = [], der = [];
  for (let k = 0; k <= n; k++) { const t = k / n, w = an * (1 - t * 0.8) * (0.7 + rr() * 0.6), cx = px + (rr() - 0.5) * 1.6 + t * (rr() - 0.5) * 3; izq.push([cx - w / 2, py + t * l]); der.push([cx + w / 2, py + t * l]); }
  g.globalAlpha = a; g.fillStyle = tono(P.oxido, d, x); trazar(g, [...izq, ...der.reverse()]); g.fill();
  mancha(px, py + an * 0.4, an * 0.8, an * 0.6, rr); g.fillStyle = tono(P.oxidoM, d, x); g.globalAlpha = a * 0.8; g.fill();
  if (d < 0.5) { g.fillStyle = tono(P.labio, d, x); g.globalAlpha = a; g.fillRect(px - an * 0.4, py - 0.5, an * 0.8, 1); }
  g.globalAlpha = 1;
}
// grano de pintura: motas de 2 px, claras y oscuras, muy suaves (patron compartido)
let GRANO = null;
function grano() {
  if (GRANO) return GRANO;
  const n = 96, s = document.createElement('canvas'); s.width = s.height = n;
  const S = s.getContext('2d'), id = S.createImageData(n, n), rr = azar(4242);
  for (let i = 0; i < id.data.length; i += 4) { const v = rr() - 0.5, c = v > 0.25 ? 120 : 0; id.data[i] = c; id.data[i + 1] = c * 0.97; id.data[i + 2] = c * 0.94; id.data[i + 3] = Math.abs(v) * 2 * 85; }
  S.putImageData(id, 0, 0);
  const c = document.createElement('canvas'); c.width = c.height = n * 4; const C = c.getContext('2d'); C.imageSmoothingEnabled = true; C.drawImage(s, 0, 0, n * 4, n * 4);
  GRANO = g.createPattern(c, 'repeat'); return GRANO;
}
function remache(px, py, d, x, lado) {
  g.fillStyle = tono(P.negro, d, x); g.beginPath(); g.arc(px, py, 1.7, 0, 7); g.fill();
  g.fillStyle = tono(P.canto, d * 0.5, x); g.fillRect(px - 0.5 + lado * 0.6, py - 1.6, 1.2, 1.1);
}

// ---------------------------------------------------------------- TUBO de 4-14 px: cuerpo en sombra, medio, hilo de luz
export function tubo(pts, w, d, x, o = {}) {
  const lado = ladoLuz(x), [nx, ny] = normalLuz(pts, lado);
  g.lineJoin = 'round'; g.lineCap = o.cap || 'round';
  if (TW(d)) { camino(pts); g.strokeStyle = TINTA; g.lineWidth = w + TW(d) * 1.4; g.stroke(); }
  camino(pts); g.strokeStyle = tono(o.col ? mezclar(P.sombra, o.col, 0.3) : P.sombra, d, x); g.lineWidth = w; g.stroke();
  camino(pts, nx * w * 0.16, ny * w * 0.16); g.strokeStyle = tono(o.col ? mezclar(P.medio, o.col, 0.3) : P.medio, d, x); g.lineWidth = w * 0.45; g.stroke();
  const off = w / 2 - Math.min(2, w * 0.2) / 2 - 0.3;
  camino(pts, nx * off, ny * off); g.strokeStyle = tono(P.canto, d * 0.5, x); g.lineWidth = Math.max(1, Math.min(2.2, w * 0.22)); g.stroke();
}
// brida: anillo plano a traves de un tubo (en el punto p, con la direccion del tubo)
function brida(px, py, dx, dy, w, d, x) {
  const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, h = w * 0.85 + 3;
  const pts = [[px - ux * 2.5 - uy * h, py - uy * 2.5 + ux * h], [px + ux * 2.5 - uy * h, py + uy * 2.5 + ux * h], [px + ux * 2.5 + uy * h, py + uy * 2.5 - ux * h], [px - ux * 2.5 + uy * h, py - uy * 2.5 - ux * h]];
  chapa(pts, d, Math.floor(px * 7 + py), { liso: true });
}

// ---------------------------------------------------------------- CHAPA: la materia de todo el hierro
// o.col tine un poco la pizarra; o.remaches = paso de la fila de remaches; o.juntas = [ancho, alto] de las planchas;
// o.liso = sin manchas (piezas pequenas); o.sinTinta; o.canto = false sin hilo de luz
export function chapa(pts, d, sem, o = {}) {
  const rr = azar(sem), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const W = x1 - x0, H = y1 - y0, A = W * H, lado = ladoLuz(x0), cerca = d < 0.5;
  const T = (c, dd = d) => tono(o.col ? mezclar(c, o.col, 0.16) : c, dd, x0);
  trazar(g, pts); g.fillStyle = T(P.medio); g.fill();
  // la materia de la cara se pinta aparte y se posa con un desenfoque de pincel (0,8 px): manchas de borde
  // blando como las de la referencia; juntas, remaches, cantos y tinta van despues, nitidos
  const blando = cerca && !o.liso && W > 12 && H > 12, G0 = g;
  if (blando) { const c = document.createElement('canvas'); c.width = Math.ceil(W) + 4; c.height = Math.ceil(H) + 4; const O = c.getContext('2d'); O.translate(2 - x0, 2 - y0); ponerG(O); }
  else { g.save(); trazar(g, pts); g.clip(); }
  // planchas: donde caen las juntas (se calculan antes para que cada plancha tenga su plano de cel)
  const jy = [], jx = [];
  if (o.juntas && cerca) {
    const [pw, ph] = o.juntas;
    for (let yy = y0 + ph * (0.7 + rr() * 0.4); yy < y1 - 12; yy += ph * (0.85 + rr() * 0.3)) jy.push(yy);
    for (let xx = x0 + pw * (0.6 + rr() * 0.5); xx < x1 - 12; xx += pw * (0.85 + rr() * 0.3)) jx.push(xx);
  }
  // 1 · tres planos de cel, planos: cada plancha su tono, luego manchas oscuras y placas algo mas claras
  if (!o.liso) {
    const bx = [x0, ...jx, x1], by = [y0, ...jy, y1], PL = [P.sombra, P.medio, P.luz, P.medio, P.medio];
    if (jx.length + jy.length) for (let i = 0; i < bx.length - 1; i++) for (let j = 0; j < by.length - 1; j++) { g.fillStyle = T(PL[Math.floor(rr() * PL.length)]); g.globalAlpha = 0.5 + rr() * 0.5; g.fillRect(bx[i], by[j], bx[i + 1] - bx[i], by[j + 1] - by[j]); }
    // desconchones casi negros de borde roto (los de la referencia), de todos los tamanos, ~30 % de la cara
    const tam = Math.max(3, Math.min(19, Math.sqrt(A) * 0.055));
    let cub = 0, nido = null;
    while (cub < A * 0.4) {
      if (rr() < 0.08 || !nido) nido = [x0 + rr() * W, y0 + rr() * H, tam * (2 + rr() * 4)];
      const e = Math.pow(rr(), 2.2) * 1.4 + 0.15, rx = tam * e * (0.5 + rr() * 0.4), ry = tam * e * (1.1 + rr() * 1.3), an0 = rr() * 7, rd = nido[2] * Math.sqrt(rr()), cx = nido[0] + Math.cos(an0) * rd, cy = nido[1] + Math.sin(an0) * rd * 1.4, n = 5 + Math.floor(rr() * 4), pp = [];
      const rot = (rr() - 0.5) * 1.6, cr = Math.cos(rot), sr = Math.sin(rot);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rr() * 0.5, f = 0.35 + rr() * 0.85, ux = Math.cos(a) * rx * f, uy = Math.sin(a) * ry * f; pp.push([cx + ux * cr - uy * sr, cy + ux * sr + uy * cr]); }
      trazar(g, pp); g.fillStyle = T(rr() < 0.5 ? P.hueco : P.sombra); g.globalAlpha = 0.75 + rr() * 0.25; g.fill(); cub += rx * ry * 1.6;
    }
    cub = 0;
    while (cub < A * 0.14) { const rx = tam * (0.3 + rr() * 0.6), ry = tam * (0.6 + rr() * 1.6); mancha(x0 + rr() * W, y0 + rr() * H, rx, ry, rr); g.fillStyle = T(rr() < 0.7 ? P.luz : P.claro); g.globalAlpha = 0.75; g.fill(); cub += rx * ry * 2.2; }
    // aranazos: rayas finas en diagonal, el surco oscuro y su labio claro
    for (let k = 0; k < A / 4000; k++) {
      const px = x0 + rr() * W, py = y0 + rr() * H, l = 8 + rr() * Math.min(60, Math.max(W, H) * 0.4), an = (rr() < 0.5 ? 1 : -1) * (0.5 + rr() * 0.6) + Math.PI / 2 * (rr() < 0.3 ? 1 : 0);
      const ex = px + Math.cos(an) * l, ey = py + Math.sin(an) * l;
      g.globalAlpha = 0.85; g.strokeStyle = T(P.hueco); g.lineWidth = 1.6; g.beginPath(); g.moveTo(px, py); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = T(P.claro); g.lineWidth = 1.1; g.beginPath(); g.moveTo(px, py + 1.4); g.lineTo(ex, ey + 1.4); g.stroke();
    }
    g.globalAlpha = 1;
    // manchas de agua: lenguas algo mas claras que bajan
    for (let k = 0; k < W / 80; k++) { const px = x0 + rr() * W, py = y0 + rr() * H * 0.5, l = 20 + rr() * Math.min(90, H * 0.7), an = 5 + rr() * 14; g.fillStyle = T(P.agua); g.globalAlpha = 0.3; g.beginPath(); g.moveTo(px - an / 2, py); g.lineTo(px + an / 2, py); g.lineTo(px + an * 0.2, py + l); g.lineTo(px - an * 0.3, py + l * 0.8); g.closePath(); g.fill(); g.globalAlpha = 1; }
    // grano de pintura (como el de la referencia): motas de 2 px claras y oscuras muy suaves
    if (cerca) { g.fillStyle = grano(); g.globalAlpha = 1 - d * 1.6; g.fillRect(x0, y0, W, H); g.globalAlpha = 1; }
  }
  const filas = [];
  for (const yy of jy) filas.push(['h', yy + 6]);
  for (const xx of jx) filas.push(['v', xx + 6 * lado]);
  if (o.remaches && cerca && W > 16 && H > 16) { filas.push(['h', y0 + 6], ['h', y1 - 7]); if (H > 120 && !jx.length) filas.push(['v', x0 + 6], ['v', x1 - 6]); }
  // 3 · churretones de oxido PARDO desde juntas, remaches y el borde de arriba
  if (!o.liso) {
    const nC = Math.max(1, W / 70 + filas.length * 0.6);
    for (let k = 0; k < nC; k++) {
      const f = filas.length && rr() < 0.75 ? filas[Math.floor(rr() * filas.length)] : null;
      const px = f && f[0] === 'v' ? f[1] : x0 + rr() * W, py = f && f[0] === 'h' ? f[1] : y0 + rr() * H * (f ? 1 : 0.35);
      churreton(px, py, 3 + rr() * 5, 20 + rr() * Math.min(60, H * 0.6), d, x0, rr, 0.35 + rr() * 0.3);
    }
  }
  if (!o.liso && cerca) for (let k = 0; k < A / 5000; k++) { const f = filas.length ? filas[Math.floor(rr() * filas.length)] : ['h', y0 + 4], px = f[0] === 'v' ? f[1] : x0 + rr() * W, py = f[0] === 'h' ? f[1] : y0 + rr() * H; mancha(px, py, 4 + rr() * 9, 3 + rr() * 7, rr); g.fillStyle = T(P.oxido); g.globalAlpha = 0.45 + rr() * 0.3; g.fill(); }
  g.globalAlpha = 1;
  // 4 · picado: motas finas claras por zonas (no por toda la chapa) y poros negros
  if (cerca && !o.liso) {
    for (let k = 0; k < A * 0.0015; k++) { g.fillStyle = T(P.picado); g.globalAlpha = 0.45 + rr() * 0.4; g.fillRect(Math.round(x0 + rr() * W), Math.round(y0 + rr() * H), 2, 2); }
    const nz = 1 + Math.floor(A / 45000);
    for (let z = 0; z < nz; z++) {
      const cx = x0 + rr() * W, cy = y0 + rr() * H, R0 = 18 + rr() * Math.min(60, Math.max(W, H) * 0.5), n = Math.PI * R0 * R0 * 0.01;
      for (let k = 0; k < n; k++) { const a = rr() * 7, r0 = R0 * Math.sqrt(rr()); g.fillStyle = T(k % 3 ? P.picado : P.negro); g.globalAlpha = k % 3 ? 0.6 : 0.9; g.fillRect(Math.round(cx + Math.cos(a) * r0), Math.round(cy + Math.sin(a) * r0), 2, 2); }
    }
    g.globalAlpha = 1;
  }
  if (blando) { const c = g.canvas; ponerG(G0); g.save(); trazar(g, pts); g.clip(); g.filter = 'blur(0.8px)'; g.drawImage(c, x0 - 2, y0 - 2); g.filter = 'none'; }
  // 2 · juntas: linea negra y labio de luz roto en la plancha de abajo (mira arriba)
  for (const yy of jy) {
    g.fillStyle = T(P.negro); g.fillRect(x0, yy - 1, W, 2);
    g.fillStyle = tono(P.canto, d * 0.5, x0); g.globalAlpha = 0.65; for (let xx = x0; xx < x1; xx += 30 + rr() * 60) g.fillRect(xx, yy + 1, 8 + rr() * 34, 1.5); g.globalAlpha = 1;
  }
  for (const xx of jx) { g.fillStyle = T(P.negro); g.fillRect(xx - 1, y0, 2, H); if (o.juntaLuz) { g.fillStyle = tono(P.canto, d * 0.5, x0); g.globalAlpha = 0.6; g.fillRect(lado > 0 ? xx + 1 : xx - 2.5, y0, 1.5, H); g.globalAlpha = 1; } }
  // paneles enmarcados (como las cajas de la referencia): marco grueso de esquinas redondas en cada plancha,
  // la luz solo en el canto de arriba del marco
  if (o.paneles && cerca) {
    const bx = [x0, ...jx, x1], by = [y0, ...jy, y1];
    for (let i = 0; i < bx.length - 1; i++) for (let j = 0; j < by.length - 1; j++) {
      const ax = bx[i] + 4, ay = by[j] + 4, aw = bx[i + 1] - bx[i] - 8, ah = by[j + 1] - by[j] - 8; if (aw < 30 || ah < 30) continue;
      g.save(); rrect(ax, ay, aw, ah, 10); g.clip(); g.fillStyle = T(P.negro); g.globalAlpha = 0.8;
      g.beginPath(); const sx = lado > 0 ? ax : ax + aw; g.moveTo(sx, ay); g.lineTo(sx + lado * (14 + rr() * 6), ay + 16); g.lineTo(sx + lado * (10 + rr() * 8), ay + ah - 18); g.lineTo(ax + aw * (0.3 + rr() * 0.4), ay + ah - 12 - rr() * 6); g.lineTo(lado > 0 ? ax + aw : ax, ay + ah - 8); g.lineTo(lado > 0 ? ax + aw : ax, ay + ah); g.lineTo(sx, ay + ah); g.closePath(); g.fill(); g.globalAlpha = 1; g.restore();
      rrect(ax, ay, aw, ah, 10); g.strokeStyle = T(mezclar(P.sombra, P.oxido, 0.25)); g.lineWidth = 8; g.stroke();
      rrect(ax + 4.5, ay + 4.5, aw - 9, ah - 9, 7); g.strokeStyle = T(P.hueco); g.lineWidth = 1.6; g.stroke();
      rrect(ax - 4, ay - 4, aw + 8, ah + 8, 13); g.strokeStyle = T(P.hueco); g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = tono(P.canto, d * 0.5, x0); g.lineWidth = 1.8; g.beginPath(); g.moveTo(ax - 2, ay + 10); g.arcTo(ax - 2, ay - 2, ax + 10, ay - 2, 12); g.lineTo(ax + aw - 10, ay - 2); g.arcTo(ax + aw + 2, ay - 2, ax + aw + 2, ay + 10, 12); g.stroke();
      g.lineWidth = 1.2; g.beginPath(); g.moveTo(ax + 10, ay + ah - 4.5); g.lineTo(ax + aw - 10, ay + ah - 4.5); g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
      for (let xx = ax + 12; xx < ax + aw - 8; xx += 12 + rr() * 2) remache(xx, ay, d, x0, lado);
      churreton(ax + 6 + rr() * (aw - 12), ay + ah + 2, 3 + rr() * 4, 14 + rr() * 30, d, x0, rr, 0.5);
    }
  }
  // remaches encima del oxido
  if (o.remaches && cerca) { const paso = 11 + rr() * 3; for (const [t, v] of filas) { if (t === 'h') for (let xx = x0 + 8; xx < x1 - 5; xx += paso) remache(xx, v, d, x0, lado); else for (let yy = y0 + 14; yy < y1 - 10; yy += paso) remache(v, yy, d, x0, lado); } }
  // 5 · abolladuras: hueco en sombra y un hilo de luz corto en su borde de abajo, que mira arriba
  if (cerca && A > 12000) for (let k = 0; k < A / 40000; k++) {
    const cx = x0 + 20 + rr() * (W - 40), cy = y0 + 20 + rr() * (H - 40), rx = 10 + rr() * 22, ry = 6 + rr() * 10, rot = (rr() - 0.5) * 0.5;
    g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, 7); g.fillStyle = T(P.negro); g.globalAlpha = 0.55; g.fill();
    g.beginPath(); g.ellipse(cx, cy, rx * 0.92, ry * 0.85, rot, 0.7, Math.PI - 0.9); g.strokeStyle = tono(P.canto, d * 0.5, x0); g.lineWidth = 1.2; g.globalAlpha = 0.6; g.stroke(); g.globalAlpha = 1;
  }
  // 6 · la luz solo lame los cantos que miran arriba o al sol
  if (o.canto !== false) {
    const c = centro(pts), an = Math.max(1.5, Math.min(3, Math.min(W, H) * 0.18)) * (d < 0.6 ? 1 : 0.7);
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 2) continue;
      let nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L; const mx = (a[0] + b[0]) / 2 - c[0], my = (a[1] + b[1]) / 2 - c[1];
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      const f = aLaLuz(nx, ny, lado); if (f < 0.45) continue;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = tono(P.canto, d * 0.5, x0); g.lineWidth = an * 2; g.stroke();
      if (f > 0.8 && an > 1.6) { g.strokeStyle = tono(P.pico, d * 0.5, x0); g.lineWidth = 1.6; g.stroke(); }
      // el oxido muerde el canto: cortes oscuros
      if (cerca) for (let s = 0; s < L / 40; s++) { const t = rr(), w2 = 3 + rr() * 9; g.strokeStyle = T(P.oxido); g.lineWidth = an * 2.2; g.beginPath(); g.moveTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); g.lineTo(a[0] + (b[0] - a[0]) * (t + w2 / L), a[1] + (b[1] - a[1]) * (t + w2 / L)); g.stroke(); }
    }
  }
  g.restore();
  if (!o.sinTinta && TW(d)) { trazar(g, pts); tinta(g, TW(d)); }
}

// ---------------------------------------------------------------- AUTOBUS abandonado: combado, hundido hasta el eje
export function autobus(x, y, w, h, d, sem, o = {}) {
  const rr = azar(sem), top = y - h, lado = ladoLuz(x), T = (c) => tono(c, d, x), cerca = d < 0.5;
  const hundir = 8, r1 = 24, r2 = 32;
  const techo = (xx) => top + Math.sin(Math.PI * Math.min(1, Math.max(0, (xx - x) / w))) * hundir;
  // carroceria: esquinas redondas, techo que se hunde en medio, morro a la derecha algo abombado
  const pts = [[x + 3, y + 12], [x - 1, top + h * 0.55], [x, top + r1]];
  for (let k = 1; k <= 6; k++) { const a = Math.PI + (k / 6) * Math.PI / 2; pts.push([x + r1 + Math.cos(a) * r1, top + r1 + Math.sin(a) * r1]); }
  for (let k = 1; k < 14; k++) { const xx = x + r1 + ((w - r1 - r2) * k) / 14; pts.push([xx, techo(xx)]); }
  for (let k = 0; k <= 6; k++) { const a = Math.PI * 1.5 + (k / 6) * Math.PI / 2; pts.push([x + w - r2 + Math.cos(a) * r2, top + r2 + Math.sin(a) * r2]); }
  pts.push([x + w + 3, top + h * 0.5], [x + w - 1, y + 12]);
  if (RELIEVE && cerca) {
    // CON FONDO: el techo visto desde arriba y el frontal del lado del sol, que se van al fondo (por detras de la chapa)
    const prof = w * 0.21, dx = lado * prof * 0.62, dy = -prof * 0.4, xe = lado > 0 ? x + w : x;
    trazar(g, [[x + r1, top + 2], [x + w - r2, top + 2], [x + w - r2 + dx, top + 2 + dy], [x + r1 + dx, top + 2 + dy]]); g.fillStyle = T('#3a372e'); g.fill();
    g.save(); g.clip(); for (let k = 0; k < 9; k++) { const xx = x + r1 + ((w - r1 - r2) * k) / 9; g.strokeStyle = rgba(T('#141209'), 0.5); g.lineWidth = 2; g.beginPath(); g.moveTo(xx, top + 2); g.lineTo(xx + dx, top + 2 + dy); g.stroke(); } g.fillStyle = rgba(T('#5b3a24'), 0.3); g.fillRect(x + w * 0.5, top + dy, w * 0.2, -dy + 4); g.restore();
    tinta(g, 2);
    trazar(g, [[xe, top + r2], [xe, y + 10], [xe + dx, y + 10 + dy], [xe + dx, top + r2 + dy]]); g.fillStyle = T('#24221c'); g.fill(); tinta(g, 2);
    g.fillStyle = rgba(T('#cfc39a'), 0.25); g.fillRect(Math.min(xe, xe + dx) + 4, top + r2 + dy * 0.5 + 10, Math.abs(dx) - 8, 6);
  }
  chapa(pts, d, sem, { juntas: [62, 999], juntaLuz: true, remaches: 12, col: o.col || '#2c2a24' });
  g.save(); trazar(g, pts); g.clip();
  // aire acondicionado del techo
  { const ax = x + w * 0.3, aw = w * 0.22, ay = techo(ax + aw / 2); chapa([[ax, ay + 3], [ax + 6, ay - 12], [ax + aw - 6, ay - 12], [ax + aw, ay + 3]], d, sem + 9, { liso: true }); }
  // ventanas: marco grueso de esquinas redondas, interior negro con asientos y barras, cristales rotos
  const vh = h * 0.42, vy0 = top + 22, nv = Math.floor((w - 100) / 62);
  for (let k = 0; k < nv; k++) {
    const vx = x + 24 + k * 62, vw = 44, vy = vy0 + (techo(vx + 24) - top) * 0.8;
    rrect(vx, vy, vw, vh, 11); g.fillStyle = T(P.hueco); g.fill();
    if (cerca) {
      g.save(); rrect(vx, vy, vw, vh, 11); g.clip();
      g.fillStyle = T('#1b1a16'); g.fillRect(vx + 4, vy + 4, vw - 8, vh * 0.35);              // las ventanas del otro lado
      g.fillStyle = T(P.hueco); g.fillRect(vx + vw * 0.48, vy, 5, vh);                        // su montante
      for (const sx of [vx + 4, vx + 27]) { rrect(sx, vy + vh * 0.5, 15, vh * 0.6, 5); g.fillStyle = T('#0f0e0b'); g.fill(); g.fillStyle = T('#26241d'); g.fillRect(sx + 2, vy + vh * 0.5 + 1, 11, 1.2); }
      g.fillStyle = T('#1d1c17'); g.fillRect(vx + vw * 0.72, vy, 2.2, vh); g.fillStyle = tono(P.canto, d * 0.6, x); g.fillRect(vx + vw * 0.72, vy + vh * 0.3, 1, 5);
      g.restore();
      if (rr() < 0.6) { // cristal roto en punta desde una esquina
        const cx = rr() < 0.5 ? vx + 2 : vx + vw - 2, s = cx < vx + vw / 2 ? 1 : -1;
        const sh = [[cx, vy + 2], [cx + s * vw * (0.4 + rr() * 0.4), vy + 2], [cx + s * vw * (0.1 + rr() * 0.2), vy + vh * (0.35 + rr() * 0.4)], [cx + s * 6, vy + vh * 0.2], [cx, vy + vh * (0.5 + rr() * 0.3)]];
        trazar(g, sh); g.fillStyle = rgba(T('#5e5b50'), 0.42); g.fill();
        g.strokeStyle = rgba(tono(P.canto, d * 0.6, x), 0.3); g.lineWidth = 1; g.beginPath(); g.moveTo(sh[0][0], sh[0][1] + 0.5); g.lineTo(sh[1][0], sh[1][1] + 0.5); g.stroke();
      }
    }
    // marco: banda parda oscura, tinta a los dos lados, luz en el alfeizar y en el canto de arriba
    rrect(vx - 3.5, vy - 3.5, vw + 7, vh + 7, 16); g.strokeStyle = T(mezclar(P.sombra, P.oxido, 0.55)); g.lineWidth = 7; g.stroke();
    if (TW(d)) { rrect(vx - 7, vy - 7, vw + 14, vh + 14, 19); g.strokeStyle = TINTA; g.lineWidth = TW(d) * 0.8; g.stroke(); rrect(vx, vy, vw, vh, 11); g.lineWidth = TW(d) * 0.7; g.stroke(); }
    g.fillStyle = tono(P.canto, d * 0.5, x); g.fillRect(vx + 9, vy + vh + 1, vw - 18, 1.6); g.fillRect(vx + 12, vy - 7.5, vw - 24, 1.6); g.fillRect(lado > 0 ? vx + vw + 6 : vx - 7.5, vy + 8, 1.6, vh - 16);
    if (cerca) { churreton(vx + 4 + rr() * 6, vy + vh + 6, 4 + rr() * 3, 40 + rr() * 50, d, x, rr); churreton(vx + vw - 6 - rr() * 6, vy + vh + 6, 3 + rr() * 3, 30 + rr() * 50, d, x, rr); churreton(vx + vw + 9, vy + 4, 3 + rr() * 3, 30 + rr() * 60, d, x, rr, 0.6); }
  }
  // pliegues de chapa: la carroceria se vencio al hundirse; cada pliegue en diagonal con su luz arriba y sombra abajo
  if (cerca) for (let k = 0; k < 3; k++) {
    const px = x + w * (0.12 + k * 0.3 + rr() * 0.1), py = vy0 + vh + 22 + rr() * 10, l = 28 + rr() * 26, an = (k % 2 ? -1 : 1) * (0.6 + rr() * 0.3), ex = px + Math.cos(an) * l, ey = py + Math.abs(Math.sin(an)) * l, qx = (px + ex) / 2 + 6, qy = (py + ey) / 2 - 5;
    g.strokeStyle = T(P.hueco); g.lineWidth = 2.2; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(qx, qy, ex, ey); g.stroke();
    g.strokeStyle = tono(P.canto, d * 0.5, x); g.globalAlpha = 0.55; g.lineWidth = 1.3; g.beginPath(); g.moveTo(px + 1, py - 2); g.quadraticCurveTo(qx + 1, qy - 2, ex + 1, ey - 2); g.stroke(); g.globalAlpha = 1;
  }
  // parabrisas y morro (derecha)
  { const px = x + w - 44, py = vy0 + 2, pw = 34, ph = vh + 14;
    trazar(g, [[px, py], [px + pw, py + 4], [px + pw + 4, py + ph], [px - 2, py + ph]]); g.fillStyle = T(P.hueco); g.fill();
    if (TW(d)) { tinta(g, TW(d) * 0.8); }
    trazar(g, [[px + 3, py + 3], [px + pw - 6, py + 6], [px + 8, py + ph * 0.5]]); g.fillStyle = rgba(T('#5e5b50'), 0.4); g.fill();
    g.fillStyle = tono(P.canto, d * 0.5, x); g.fillRect(px + 2, py + ph + 1, pw - 2, 2);
  }
  // molduras: linea de cintura y faldon, con su hilo de luz arriba
  for (const my of [vy0 + vh + 14]) { g.fillStyle = T(P.sombra); g.fillRect(x, my, w, 6); g.fillStyle = tono(P.canto, d * 0.5, x); g.fillRect(x, my, w, 1.6); g.fillStyle = TINTA; g.globalAlpha = TW(d) ? 1 : 0; g.fillRect(x, my + 6, w, 1.4); g.globalAlpha = 1; }
  // faros rotos y parachoques torcido
  if (cerca) {
    for (const fx of [x + w - 14]) { g.beginPath(); g.arc(fx, y - h * 0.3, 8, 0, 7); g.fillStyle = T(P.hueco); g.fill(); if (TW(d)) tinta(g, TW(d) * 0.8); g.beginPath(); g.moveTo(fx - 6, y - h * 0.3 - 5); g.lineTo(fx + 1, y - h * 0.3 - 7); g.lineTo(fx - 3, y - h * 0.3 + 1); g.closePath(); g.fillStyle = rgba(T('#77735f'), 0.5); g.fill(); }
    trazar(g, [[x + w - 70, y - h * 0.12], [x + w + 6, y - h * 0.16], [x + w + 6, y - h * 0.16 + 9], [x + w - 70, y - h * 0.12 + 8]]); g.fillStyle = T(P.sombra); g.fill(); g.fillStyle = tono(P.canto, d * 0.5, x); g.fillRect(x + w - 68, y - h * 0.125 - 1, 70, 1.6); if (TW(d)) { trazar(g, [[x + w - 70, y - h * 0.12], [x + w + 6, y - h * 0.16], [x + w + 6, y - h * 0.16 + 9], [x + w - 70, y - h * 0.12 + 8]]); tinta(g, TW(d) * 0.8); }
  }
  // hundido en la tierra hasta el eje: banda de barro de borde roto abajo
  g.fillStyle = T('#0d0b07'); g.beginPath(); g.moveTo(x - 4, y + 14);
  for (let xx = x - 4; xx <= x + w + 6; xx += 10) g.lineTo(xx, y + 4 - rr() * 8 - (Math.abs(xx - x - w * 0.18) < 40 || Math.abs(xx - x - w * 0.8) < 40 ? 6 : 0));
  g.lineTo(x + w + 6, y + 14); g.closePath(); g.fill();
  g.restore();
  // letrero de destino (apagado: no puede brillar mas que el 18)
  if (o.letrero && d < 0.45) {
    const lx = x + w - 112, ly = techo(lx) + 6; rrect(lx, ly, 78, 17, 3); g.fillStyle = T('#0b0a08'); g.fill(); if (TW(d)) tinta(g, TW(d) * 0.7);
    g.fillStyle = T('#a99c78'); g.font = 'bold 12px Georgia'; g.textAlign = 'center'; g.fillText(o.letrero, lx + 39, ly + 13); g.textAlign = 'left';
  }
}

// ---------------------------------------------------------------- PASARELA de hierro sobre el agua
// viga en celosia con un tramo hundido, pilas con cartelas, tuberia con bridas y barandilla torcida
export function pasarela(x0, x1, y, yFondo, d, sem) {
  const rr = azar(sem), L = x1 - x0, lado = ladoLuz(x0);
  const bay = 170, hund = 2;                                           // el tercer vano se hunde
  const caida = (x) => { const a = x0 + 60 + hund * bay, t = (x - a) / bay; return t > 0 && t < 1 ? Math.sin(t * Math.PI) * 18 : 0; };
  const pila = []; for (let x = x0 + 60; x < x1 - 20; x += bay) pila.push(x);
  // pilas: cajon de chapa con capitel y cartelas, hundidas en el agua
  for (const x of pila) {
    chapa([[x - 12, y + 40], [x + 12, y + 40], [x + 14, yFondo], [x - 14, yFondo]], d, sem + x, { remaches: 12, juntas: [999, 60] });
    chapa([[x - 20, y + 40], [x + 20, y + 40], [x + 20, y + 47], [x - 20, y + 47]], d, sem + x + 1, { liso: true });
    for (const s of [-1, 1]) chapa([[x + s * 12, y + 47], [x + s * 30, y + 47], [x + s * 12, y + 74]], d, sem + x + 2 + s, { liso: true });
  }
  // tuberia bajo el tablero, con bridas y un codo que baja al agua
  { const ty = y + 62, xa = x0 + 30, xb = x1 - 70;
    tubo([[xa, ty], [xb, ty + caida(xb)], [xb + 24, ty + 18], [xb + 24, yFondo - 20]], 11, d, x0);
    for (let x = xa + 60; x < xb; x += 120) brida(x, ty, 1, 0, 11, d, x0);
    brida(xb + 24, ty + 60, 0, 1, 11, d, x0);
  }
  // viga en celosia: cordon de arriba, cordon de abajo y diagonales en cruz de San Andres
  const cordon = (yy, alto, s) => { const pts = []; for (let x = x0; x <= x1; x += 30) pts.push([x, yy + caida(x)]); for (let k = pts.length - 1; k >= 0; k--) pts.push([pts[k][0], pts[k][1] + alto]); chapa(pts, d, s, { remaches: 12, liso: alto < 10 }); };
  for (let x = x0; x < x1 - 41; x += 42) {
    if (rr() < 0.07) continue;                                          // falta una diagonal
    for (const [a, b] of [[[x, y + 14], [x + 42, y + 40]], [[x + 42, y + 14], [x, y + 40]]]) {
      const pa = [a[0], a[1] + caida(a[0])], pb = [b[0], b[1] + caida(b[0])];
      if (TW(d)) { g.strokeStyle = TINTA; g.lineWidth = 6.5; g.beginPath(); g.moveTo(...pa); g.lineTo(...pb); g.stroke(); }
      g.strokeStyle = tono(P.sombra, d, x); g.lineWidth = 4.5; g.beginPath(); g.moveTo(...pa); g.lineTo(...pb); g.stroke();
      if ((pb[1] - pa[1]) * lado < 0 || true) { g.strokeStyle = tono(P.canto, d * 0.5, x); g.lineWidth = 1; g.beginPath(); g.moveTo(pa[0], pa[1] - 1.8); g.lineTo(pb[0], pb[1] - 1.8); g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1; }
    }
  }
  cordon(y + 38, 8, sem + 3);
  cordon(y, 15, sem + 1);
  // barandilla: montantes (alguno falta, alguno vencido), pasamanos torcido, travesano partido
  const kx = x0 + L * 0.82, sube = (x) => y - 50 + caida(x) + Math.max(0, 1 - Math.abs(x - kx) / 34) * 8;
  const mont = [];
  for (let x = x0 + 4; x <= x1 - 4; x += 46) { if (rr() < 0.14) continue; const inc = rr() < 0.2 ? (rr() - 0.5) * 18 : 0; mont.push([x, inc]); }
  for (const [x, inc] of mont) tubo([[x, y + caida(x)], [x + inc, sube(x + inc) + 2]], 5, d, x0, { cap: 'butt' });
  const pas = []; for (let x = x0; x <= x1; x += 15) pas.push([x, sube(x)]);
  tubo(pas, 6.5, d, x0);
  const med = []; const corte = x0 + L * (0.55 + rr() * 0.2);
  for (let x = x0; x <= corte; x += 15) med.push([x, y - 25 + caida(x)]);
  med.push([corte + 10, y - 25 + caida(corte) + 14]);
  tubo(med, 4.5, d, x0);
  const med2 = []; for (let x = corte + 40; x <= x1; x += 15) med2.push([x, y - 25 + caida(x)]);
  if (med2.length > 1) tubo(med2, 4.5, d, x0);
}

// ---------------------------------------------------------------- VALLA de hierro: pletinas en punta y dos travesanos
export function valla(x0, x1, d) {
  const rr = azar(Math.floor(x0));
  for (const h of [16, 40]) { const pts = []; for (let x = x0; x <= x1; x += 17) pts.push([x, sueloY(x) - h + (h > 20 ? Math.sin(x * 0.03) * 2 : 0)]); tubo(pts, 4.5, d, x0); }
  for (let x = x0; x <= x1; x += 34) {
    if (rr() < 0.1) continue;
    const y = sueloY(x), inc = rr() < 0.18 ? (rr() - 0.5) * 16 : 0, t = y - 52;
    chapa([[x - 3.5, y + 4], [x - 3.5 + inc, t], [x + inc, t - 7], [x + 3.5 + inc, t], [x + 3.5, y + 4]], d, Math.floor(x), { liso: true, col: '#2e261c' });
  }
}

// ---------------------------------------------------------------- ARANA MECANICA (fauna de las afueras, de lejos)
export function arana(x, y, s, d, sem) {
  const rr = azar(sem), col = tono(P.medio, d, x), luz = tono(P.canto, d * 0.6, x);
  g.strokeStyle = col; g.lineCap = 'round';
  for (let k = 0; k < 8; k++) {
    const l2 = k < 4 ? -1 : 1, i = k % 4, bx = x + l2 * s * 0.3, by = y - s * 0.9, kx = x + l2 * s * (0.9 + i * 0.35), ky = y - s * (1.6 + rr() * 0.4), fx = x + l2 * s * (1.3 + i * 0.55), fy = y;
    g.lineWidth = s * 0.09; g.beginPath(); g.moveTo(bx, by); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
    g.strokeStyle = rgba(luz, 0.7); g.lineWidth = 1; g.beginPath(); g.moveTo(bx, by - 1); g.lineTo(kx, ky - 1); g.stroke(); g.strokeStyle = col;
  }
  g.beginPath(); g.ellipse(x, y - s, s * 0.75, s * 0.5, 0, 0, 7); g.fillStyle = col; g.fill();
  g.beginPath(); g.ellipse(x - s * 0.7, y - s * 0.95, s * 0.3, s * 0.25, 0, 0, 7); g.fill();
  g.strokeStyle = rgba(luz, 0.85); g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, y - s, s * 0.75, s * 0.5, 0, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  g.fillStyle = '#c9c2a4'; g.beginPath(); g.arc(x - s * 0.85, y - s, s * 0.07, 0, 7); g.fill();
}

// ---------------------------------------------------------------- TORRE DE CELOSIA: dos pies que se abren abajo,
// cruces de San Andres por tramos (alguna que falta), cartela y capitel de chapa arriba
export function torreCelosia(x, top, base, an, d, sem) {
  const rr = azar(sem), arriba = an * 0.42, pie = (t, s) => [x + s * lerpN(arriba, an, t), top + (base - top) * t];
  for (const s of [-1, 1]) tubo([pie(0, s), pie(1, s)], 7, d, x, { cap: 'butt' });
  const tramo = 46 + rr() * 16;
  for (let y = top + tramo, k = 0; y < base - 10; y += tramo, k++) {
    const t0 = (y - tramo - top) / (base - top), t1 = (y - top) / (base - top);
    tubo([pie(t1, -1), pie(t1, 1)], 3.5, d, x, { cap: 'butt' });
    if (rr() < 0.12) continue;
    tubo([pie(t0, -1), pie(t1, 1)], 2.4, d, x, { cap: 'butt' });
    if (rr() < 0.85) tubo([pie(t0, 1), pie(t1, -1)], 2.4, d, x, { cap: 'butt' });
  }
  chapa([[x - arriba - 10, top - 12], [x + arriba + 10, top - 12], [x + arriba + 4, top + 6], [x - arriba - 4, top + 6]], d, sem + 3, { liso: true });
}
const lerpN = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- VIADUCTO: la pasarela de hierro en lo alto
// del plano medio, sobre torres de celosia; un vano ROTO con la viga colgando y un cable suelto.
export function viaducto(x0, x1, y, base, d, sem, o = {}) {
  const rr = azar(sem), roto = o.roto ?? x0 + (x1 - x0) * 0.6;
  for (let x = x0 + 90; x < x1 - 40; x += 280 + rr() * 140) if (Math.abs(x - roto) > 90) torreCelosia(x, y + 62, base, 40 + rr() * 14, d, sem + Math.floor(x));
  pasarela(x0, roto - 20, y, y + 62, d, sem + 1);
  pasarela(roto + 60, x1, y, y + 62, d, sem + 2);
  // la viga del vano caido, colgando de un perno, y el cable
  g.save(); g.translate(roto - 22, y + 18); g.rotate(1.12); chapa([[0, -8], [210, -8], [210, 8], [0, 8]], d, sem + 5, { remaches: 12 }); g.restore();
  g.strokeStyle = tono(P.sombra, d, roto); g.lineWidth = 2; g.beginPath(); g.moveTo(roto + 60, y + 4); g.quadraticCurveTo(roto + 50, y + 140, roto + 26, y + 220); g.stroke();
}

// ---------------------------------------------------------------- DEPOSITO tumbado (cisterna de chapa), hundido
// cuerpo de cilindro con los fondos abombados, aros de refuerzo, boca de hombre arriba con su tapa abierta,
// escalerilla y una abolladura grande; la tierra se lo come por abajo.
export function deposito(x, y, w, h, d, sem) {
  const rr = azar(sem), r = h / 2, cy = y - r, T = (c) => tono(c, d, x), lado = ladoLuz(x);
  const pts = []; for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 + (k / 10) * Math.PI; pts.push([x + r * 0.45 + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r]); }
  for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + (k / 10) * Math.PI; pts.push([x + w - r * 0.45 + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r]); }
  chapa(pts, d, sem, { juntas: [w / 4, 999], remaches: 11, col: '#2c2620' });
  g.save(); trazar(g, pts); g.clip();
  // volumen de cilindro: banda de sombra abajo y de luz arriba (cel, plano)
  g.fillStyle = rgba(T(P.hueco), 0.45); g.fillRect(x, cy + r * 0.35, w, r);
  g.fillStyle = rgba(tono(P.canto, d * 0.5, x), 0.35); g.fillRect(x, cy - r + 3, w, 3);
  // aros
  for (let k = 1; k < 4; k++) { const ax = x + (w * k) / 4 + (rr() - 0.5) * 10; g.fillStyle = T(P.sombra); g.fillRect(ax - 5, cy - r, 10, h); g.fillStyle = tono(P.canto, d * 0.5, x); g.fillRect(ax + lado * 3, cy - r, 1.6, h * 0.5); }
  // tierra que se lo come
  g.fillStyle = T('#0d0b07'); g.beginPath(); g.moveTo(x - 4, y + 10); for (let xx = x - 4; xx <= x + w + 6; xx += 12) g.lineTo(xx, y - h * 0.12 - rr() * h * 0.12); g.lineTo(x + w + 6, y + 10); g.closePath(); g.fill();
  g.restore();
  // boca de hombre y su tapa abierta
  { const bx = x + w * 0.55; chapa([[bx - 22, cy - r + 4], [bx - 18, cy - r - 12], [bx + 18, cy - r - 12], [bx + 22, cy - r + 4]], d, sem + 7, { liso: true, remaches: 8 }); g.save(); g.translate(bx + 20, cy - r - 12); g.rotate(-1.1); chapa([[0, -3], [42, -3], [42, 4], [0, 4]], d, sem + 8, { liso: true }); g.restore(); }
  // escalerilla de mano en el fondo
  { const ex = x + w - r * 0.5; for (const s of [-8, 8]) tubo([[ex + s, cy - r + 6], [ex + s + 4, y - 4]], 3, d, x, { cap: 'butt' }); for (let yy = cy - r + 18; yy < y - 10; yy += 16) tubo([[ex - 8, yy], [ex + 10, yy]], 2.2, d, x, { cap: 'butt' }); }
}

// ================================================================= trozos de la capa JUEGO (en su sitio del concepto)
// la rejilla del conducto por donde sale el 18 (x 60-340, y 985-1130)
export function rejillaConducto() {
  chapa([[60, 1105], [60, 985], [200, 985], [200, 1105]], 0, 83, { remaches: 13, col: '#33302a' });
  rrect(76, 1000, 108, 92, 6); g.fillStyle = P.hueco; g.fill(); tinta(g, 2);
  g.save(); rrect(76, 1000, 108, 92, 6); g.clip(); g.fillStyle = '#100f0c'; g.fillRect(76, 1000, 108, 14); g.restore();
  for (let k = 0; k < 5; k++) tubo([[86 + k * 22, 1000], [92 + k * 22 + (k === 3 ? 8 : 0), 1092]], 7, 0, 100, { cap: 'butt' });
  tubo([[76, 1046], [184, 1050]], 5, 0, 100, { cap: 'butt' });
  g.save(); g.translate(230, 1120); g.rotate(0.5); chapa([[0, 0], [110, 0], [110, 9], [0, 9]], 0, 84, { liso: true }); g.restore();
}
// postes de la luz de hierro con su cruceta, aisladores y tres cables
export function tendido(xs) {
  const ps = xs.map((x) => {
    const y = sueloY(x);
    tubo([[x, y + 4], [x, y - 318]], 10, 0, x, { cap: 'butt' });
    chapa([[x - 42, y - 308], [x + 42, y - 308], [x + 42, y - 300], [x - 42, y - 300]], 0, x + 1, { liso: true });
    for (const s of [-1, 1]) tubo([[x, y - 270], [x + s * 30, y - 302]], 3.5, 0, x);
    for (const dx of [-34, 0, 34]) { if (dx) chapa([[x + dx - 3, y - 308], [x + dx + 3, y - 308], [x + dx + 3, y - 318], [x + dx - 3, y - 318]], 0, x + dx, { liso: true }); }
    if (x % 3 === 0) churreton(x + 2, y - 300, 3, 60, 0, x, azar(x));
    return [x, y - 316];
  });
  g.strokeStyle = TINTA; g.lineWidth = 1.8;
  for (let k = 0; k < ps.length - 1; k++) for (const dx of [-34, 0, 34]) { g.beginPath(); g.moveTo(ps[k][0] + dx, ps[k][1]); g.quadraticCurveTo((ps[k][0] + ps[k + 1][0]) / 2 + dx, ps[k][1] + 44 + (dx === 34 && k === 1 ? 40 : 0), ps[k + 1][0] + dx, ps[k + 1][1]); g.stroke(); }
}
// coche abandonado, hundido hasta el eje
export function coche(x) {
  const y = sueloY(x), pts = [[x + 2, y + 8], [x, y - 30], [x + 8, y - 44], [x + 52, y - 50]];
  for (let k = 0; k <= 8; k++) { const t = k / 8, a = Math.PI + t * Math.PI; pts.push([x + 112 + Math.cos(a) * 52, y - 52 + Math.sin(a) * 30]); }
  pts.push([x + 196, y - 46], [x + 214, y - 38], [x + 216, y + 8]);
  chapa(pts, 0, 7001, { remaches: 0, juntas: [70, 999], col: '#2f2b25' });
  for (const [vx, vw] of [[x + 74, 34], [x + 114, 34]]) {
    rrect(vx, y - 74, vw, 22, 6); g.fillStyle = P.hueco; g.fill(); tinta(g, 1.8);
    g.fillStyle = P.canto; g.fillRect(vx + 4, y - 51, vw - 8, 1.6);
  }
  g.beginPath(); g.moveTo(x + 116, y - 72); g.lineTo(x + 138, y - 72); g.lineTo(x + 120, y - 58); g.closePath(); g.fillStyle = rgba('#5e5b50', 0.45); g.fill();
  g.beginPath(); g.arc(x + 206, y - 30, 5, 0, 7); g.fillStyle = P.hueco; g.fill(); tinta(g, 1.6);
  g.fillStyle = '#0d0b07'; g.beginPath(); g.moveTo(x - 2, y + 10); for (let xx = x - 2; xx <= x + 218; xx += 9) g.lineTo(xx, y - 6 - ((xx * 7) % 9)); g.lineTo(x + 218, y + 10); g.fill();
}
// senal de la parada del autobus: disco de chapa sucio (apagado: no compite con el 18)
export function paradaBus(x) {
  const y = sueloY(x);
  tubo([[x, y], [x, y - 166]], 6, 0, x, { cap: 'butt' });
  g.beginPath(); g.arc(x, y - 186, 24, 0, 7); g.fillStyle = '#7f7764'; g.fill();
  g.save(); g.clip(); const rr = azar(101);
  for (let k = 0; k < 14; k++) { mancha(x - 24 + rr() * 48, y - 210 + rr() * 48, 4 + rr() * 8, 3 + rr() * 6, rr); g.fillStyle = k % 3 ? '#5f5848' : P.oxido; g.globalAlpha = 0.6; g.fill(); }
  g.globalAlpha = 1; churreton(x + 6, y - 196, 4, 30, 0, x, rr);
  g.beginPath(); g.arc(x, y - 186, 24, Math.PI * 1.1, Math.PI * 1.9); g.strokeStyle = P.canto; g.lineWidth = 3; g.stroke();
  g.restore();
  g.beginPath(); g.arc(x, y - 186, 24, 0, 7); tinta(g, 2.4); g.beginPath(); g.arc(x, y - 186, 20, 0, 7); tinta(g, 1.2);
  g.fillStyle = TINTA; g.font = 'bold 20px Georgia'; g.textAlign = 'center'; g.fillText('BUS', x, y - 179); g.textAlign = 'left';
}

// BANCO (?banco=metal): cada pieza con sus coordenadas del concepto, traida a la vista con translate
// (asi conserva la bruma y el lado de la luz de su sitio): pasarela, los dos autobuses (d 0 y 0.3),
// postes con coche y parada, valla, la rejilla del conducto, una chapa grande y la arana (d 0.4)
export function banco() {
  const en = (dx, dy, fn) => { g.save(); g.translate(dx, dy); fn(); g.restore(); };
  en(-2300, -950, () => pasarela(2360, 3260, 1150, AGUA + 40, 0, 91));
  en(-5450, -850, () => autobus(6520, sueloY(6700), 400, 160, 0, 6520, { letrero: 'CENTRO' }));
  en(-330, -850, () => autobus(1880, sueloY(2100) + 10, 420, 150, 0.3, 1880, { letrero: 'LINEA 4' }));
  en(-6200, -350, () => { tendido([6300, 6620, 6980, 7320]); coche(7000); paradaBus(6880); });
  en(-2700, -350, () => valla(4040, 4380, 0));
  en(100, 150, () => rejillaConducto());
  chapa([[600, 1000], [1100, 1000], [1100, 1400], [600, 1400]], 0, 7, { juntas: [125, 200], paneles: true });
  // delante de la chapa: una bajante con bridas y un codo, y una pletina vertical atornillada
  tubo([[1040, 1400], [1040, 1060], [1060, 1040], [1120, 1040]], 13, 0, 1040); for (const yy of [1130, 1250, 1350]) brida(1040, yy, 0, 1, 13, 0, 1040);
  chapa([[604, 1000], [620, 1000], [620, 1400], [604, 1400]], 0, 77, { liso: true, remaches: 12 });
  en(-5300, 200, () => arana(6980, sueloY(6980) - 30, 22, 0.4, 1));
}
