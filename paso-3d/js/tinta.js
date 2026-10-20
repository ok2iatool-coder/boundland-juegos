// Copia de boundland/web/dibujo/tinta.js (sin tocar el original).
// Utilidades de dibujo con una sola linea de tinta (GDD: mismo grosor y color de contorno en
// personajes, objetos y primer plano) y ruido determinista para que nada tiemble entre fotogramas.

export const TINTA = '#0b0a0c';
export const GROSOR = 2.6;          // en unidades del mundo (u): ~5 px a 1080p

// ruido determinista
export function hash(x, y = 0, z = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function ruido1(x, semilla = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash(i, semilla), b = hash(i + 1, semilla);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
export const azar = (semilla) => {
  let s = semilla >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
};

// Polilinea temblada: subdivide cada tramo y desplaza los puntos de lado con ruido
export function temblar(pts, paso = 14, amp = 1.4, semilla = 1, cerrada = true) {
  const out = [];
  const n = pts.length;
  const lim = cerrada ? n : n - 1;
  for (let k = 0; k < lim; k++) {
    const a = pts[k], b = pts[(k + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const m = Math.max(1, Math.round(L / paso));
    for (let i = 0; i < m; i++) {
      const t = i / m;
      const x = a[0] + dx * t, y = a[1] + dy * t;
      const r = i === 0 ? 0.35 : 1;
      const d = (ruido1((x + y * 0.7) / paso * 0.9, semilla) - 0.5) * 2 * amp * r;
      out.push([x + nx * d, y + ny * d]);
    }
  }
  if (!cerrada) out.push(pts[n - 1]);
  return out;
}

export function trazar(c, pts, cerrada = true) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
  if (cerrada) c.closePath();
}

// trazo suave por puntos medios (para curvas organicas)
export function trazarSuave(c, pts, cerrada = true) {
  const n = pts.length;
  c.beginPath();
  if (!cerrada) {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < n - 1; k++) {
      const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
      c.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
    }
    c.lineTo(pts[n - 1][0], pts[n - 1][1]);
    return;
  }
  const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
  c.moveTo(m0[0], m0[1]);
  for (let k = 0; k < n; k++) {
    const a = pts[k], b = pts[(k + 1) % n];
    c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  c.closePath();
}

export function tinta(c, grosor = GROSOR, color = TINTA) {
  c.lineWidth = grosor; c.strokeStyle = color; c.lineJoin = 'round'; c.lineCap = 'round';
  c.stroke();
}

// Figura rellena con contorno de tinta temblado (rectangulo)
export function caja(c, x, y, w, h, relleno, semilla = 7, amp = 1.2, grosor = GROSOR) {
  const pts = temblar([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 12, amp, semilla);
  trazar(c, pts);
  if (relleno) { c.fillStyle = relleno; c.fill(); }
  if (grosor) tinta(c, grosor);
}

export function linea(c, x0, y0, x1, y1, grosor = GROSOR, color = TINTA, semilla = 3, amp = 0.8) {
  const pts = temblar([[x0, y0], [x1, y1]], 10, amp, semilla, false);
  trazar(c, pts, false);
  tinta(c, grosor, color);
}

export function circulo(c, x, y, r, relleno, grosor = GROSOR, semilla = 5, amp = 0.6) {
  const n = Math.max(10, Math.round(r * 0.9));
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = r + (hash(k, semilla) - 0.5) * amp * 2;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  trazarSuave(c, pts);
  if (relleno) { c.fillStyle = relleno; c.fill(); }
  if (grosor) tinta(c, grosor);
}

// rayado de sombra dentro del trazado actual (llamar con el clip puesto)
export function rayado(c, x, y, w, h, sep = 9, color = 'rgba(0,0,0,.18)', angulo = -0.9, semilla = 2) {
  c.save();
  c.strokeStyle = color; c.lineWidth = 1.1;
  const ca = Math.cos(angulo), sa = Math.sin(angulo);
  const d = Math.hypot(w, h);
  c.beginPath();
  for (let k = -d; k < d; k += sep) {
    const j = (hash(Math.round(k), semilla) - 0.5) * sep * 0.6;
    const cx = x + w / 2 + (-sa) * (k + j), cy = y + h / 2 + ca * (k + j);
    c.moveTo(cx - ca * d, cy - sa * d);
    c.lineTo(cx + ca * d, cy + sa * d);
  }
  c.stroke();
  c.restore();
}

export const mezclar = (a, b, t) => {
  const pa = hex(a), pb = hex(b);
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
};
export function hex(h) {
  if (h.startsWith('rgb')) return h.match(/[\d.]+/g).map(Number);
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export const rgba = (h, a) => { const p = hex(h); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; };
