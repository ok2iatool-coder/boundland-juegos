// Cajas (x, y arriba-izquierda, w, h) contra la rejilla y contra los solidos que se mueven
// (tornillos gigantes, el autobus, escombros flotantes, rejillas). Se mueve un eje cada vez y en
// pasos de media casilla, asi nada atraviesa una pared aunque vaya deprisa.
import { T } from './constantes.js';
import { celda, MACIZO, PLAT, PINCHO, REJA, HUNDE, TALLO, CUERDA } from './mapa.js';

export const esSolida = (v) => v === MACIZO || v === REJA || v === HUNDE || v === TALLO;
export const solida = (m, i, j) => esSolida(celda(m, i, j));

const solapa = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export { solapa as solapan };

// mundo = { m: mapa, solidos: [caja...] }
export function moverX(c, mundo, dx) {
  if (!dx) return 0;
  const m = mundo.m;
  const pasos = Math.ceil(Math.abs(dx) / (T / 2)), d = dx / pasos;
  for (let k = 0; k < pasos; k++) {
    c.x += d;
    const j0 = Math.floor(c.y / T), j1 = Math.floor((c.y + c.h - 0.01) / T);
    if (d > 0) {
      const i = Math.floor((c.x + c.w - 0.01) / T);
      for (let j = j0; j <= j1; j++) if (solida(m, i, j)) { c.x = i * T - c.w; return 1; }
    } else {
      const i = Math.floor(c.x / T);
      for (let j = j0; j <= j1; j++) if (solida(m, i, j)) { c.x = (i + 1) * T; return -1; }
    }
    for (const s of mundo.solidos) {
      if (!s.activo || !solapa(c, s)) continue;
      if (d > 0) { c.x = s.x - c.w; return 1; }
      c.x = s.x + s.w; return -1;
    }
  }
  return 0;
}

// atraviesa: true para dejarse caer por una plataforma de paso.
export function moverY(c, mundo, dy, atraviesa = false) {
  if (!dy) return 0;
  const m = mundo.m;
  const pasos = Math.ceil(Math.abs(dy) / (T / 2)), d = dy / pasos;
  for (let k = 0; k < pasos; k++) {
    const pie0 = c.y + c.h;
    c.y += d;
    const i0 = Math.floor(c.x / T), i1 = Math.floor((c.x + c.w - 0.01) / T);
    if (d > 0) {
      const j = Math.floor((c.y + c.h - 0.01) / T);
      for (let i = i0; i <= i1; i++) {
        const v = celda(m, i, j);
        if (esSolida(v) || (v === PLAT && !atraviesa && pie0 <= j * T + 0.5)) { c.y = j * T - c.h; return 1; }
      }
    } else {
      const j = Math.floor(c.y / T);
      for (let i = i0; i <= i1; i++) if (solida(m, i, j)) { c.y = (j + 1) * T; return -1; }
    }
    for (const s of mundo.solidos) {
      if (!s.activo || !solapa(c, s)) continue;
      if (d > 0) { if (s.paso && (atraviesa || pie0 > s.y + 0.5)) continue; c.y = s.y - c.h; return 1; }
      if (s.paso) continue;
      c.y = s.y + s.h; return -1;
    }
  }
  return 0;
}

// Sobre que esta de pie: null, 'tile' o el solido.
export function suelo(c, mundo) {
  const m = mundo.m;
  const pie = c.y + c.h;
  const j = Math.floor((pie + 1) / T);
  if (Math.abs(pie - j * T) <= 1.5) {
    const i0 = Math.floor(c.x / T), i1 = Math.floor((c.x + c.w - 0.01) / T);
    for (let i = i0; i <= i1; i++) {
      const v = celda(m, i, j);
      if (esSolida(v) || v === PLAT) return { tile: v, i, j };
    }
  }
  for (const s of mundo.solidos) {
    if (!s.activo) continue;
    if (Math.abs(pie - s.y) <= 1.5 && c.x < s.x + s.w && c.x + c.w > s.x) return { solido: s };
  }
  return null;
}

// Solo plataforma de paso bajo los pies (para dejarse caer con abajo + salto)
export function soloPlataforma(c, mundo) {
  const m = mundo.m;
  const j = Math.floor((c.y + c.h + 1) / T);
  let plat = false;
  for (let i = Math.floor(c.x / T); i <= Math.floor((c.x + c.w - 0.01) / T); i++) {
    const v = celda(m, i, j);
    if (esSolida(v)) return false;
    if (v === PLAT) plat = true;
  }
  return plat;
}

export function tocaPinchos(c, m) {
  const g = 4;
  const i0 = Math.floor((c.x + g) / T), i1 = Math.floor((c.x + c.w - g) / T);
  const j0 = Math.floor((c.y + g) / T), j1 = Math.floor((c.y + c.h - 1) / T);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (celda(m, i, j) === PINCHO && c.y + c.h > j * T + T * 0.4) return true;
  }
  return false;
}

// Cuerda o escalera bajo el centro del cuerpo
export function cuerdaEn(c, m) {
  const i = Math.floor((c.x + c.w / 2) / T);
  const j0 = Math.floor((c.y + 6) / T), j1 = Math.floor((c.y + c.h - 4) / T);
  for (let j = j0; j <= j1; j++) if (celda(m, i, j) === CUERDA) return i;
  return -1;
}

// Hay linea de vista entre dos puntos? (rejilla y solidos)
export function vista(mundo, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.ceil(d / 8);
  for (let k = 1; k < n; k++) {
    const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
    const v = celda(mundo.m, Math.floor(x / T), Math.floor(y / T));
    if (v === MACIZO || v === HUNDE || v === TALLO) return false;
    for (const s of mundo.solidos) if (s.activo && !s.paso && !s.ancla && x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return false;
  }
  return true;
}

export const libre = (mundo, c) => {
  const m = mundo.m;
  const i0 = Math.floor(c.x / T), i1 = Math.floor((c.x + c.w - 0.01) / T);
  const j0 = Math.floor(c.y / T), j1 = Math.floor((c.y + c.h - 0.01) / T);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (solida(m, i, j)) return false;
  for (const s of mundo.solidos) if (s.activo && !s.paso && solapa(c, s)) return false;
  return true;
};
export const cx = (c) => c.x + c.w / 2;
export const cy = (c) => c.y + c.h / 2;
