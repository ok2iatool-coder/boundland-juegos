// Convierte el mapa ASCII de un nivel en la rejilla de colision y la lista de cosas.
import { T } from './constantes.js';

export const AIRE = 0, MACIZO = 1, PLAT = 2, PINCHO = 3, CUERDA = 4, HUNDE = 5, REJA = 6, TALLO = 7, PUERTA = 8;
const TILES = { ' ': AIRE, '#': MACIZO, '=': PLAT, '^': PINCHO, H: CUERDA, x: HUNDE, '%': REJA, '|': TALLO, '!': PUERTA };
const COSAS = 'PSNCDotkezaYGBRQf[]&';

export function leerMapa(nivel) {
  const filas = nivel.mapa;
  const w = Math.max(...filas.map((f) => f.length));
  const h = filas.length;
  const t = new Uint8Array(w * h);
  const cosas = [];
  const marcas = [];
  for (let j = 0; j < h; j++) {
    const f = filas[j];
    for (let i = 0; i < w; i++) {
      const c = i < f.length ? f[i] : f[f.length - 1];
      if (c in TILES) { t[j * w + i] = TILES[c]; continue; }
      if (COSAS.includes(c)) { cosas.push({ c, i, j }); continue; }
      if (c === 'h') t[j * w + i] = CUERDA;            // la escalera de ADN trepa como una cuerda
      const m = nivel.marcas && nivel.marcas[c];
      if (m) { marcas.push({ c, i, j, ...m }); if (m.solido) t[j * w + i] = MACIZO; }
    }
  }
  return { w, h, t, cosas, marcas, ancho: w * T, alto: h * T };
}

export const celda = (m, i, j) => {
  if (i < 0) return MACIZO;                        // los lados cierran (salvo un nivel que se sale por el borde)
  if (i >= m.w) return m.abreDer ? AIRE : MACIZO;
  if (j < 0) return m.t[i] === MACIZO ? MACIZO : AIRE;
  if (j >= m.h) return AIRE;                      // por debajo se cae al vacio
  return m.t[j * m.w + i];
};
export const ponerCelda = (m, i, j, v) => { if (i >= 0 && j >= 0 && i < m.w && j < m.h) m.t[j * m.w + i] = v; };
