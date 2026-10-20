// LO COMUN de la pintura (sin dibujo ni DOM: lo usan la pagina y los hilos que pintan).
// El nivel esta en u del mundo (el 18 mide 1,18; sus pies en y 0) y se PINTA en px del taller (los del concepto
// de El Linde y de la ciudad del juego, para que sus piezas salgan a su tamano): un u son CP px del taller, y
// en el lienzo el eje y va hacia abajo desde YTOP. Cada capa se pinta a su resolucion (px de lienzo por u) en
// baldosas de BALDOSA px de ancho.
export const CP = 175;                     // px del taller por u (el 18, 1,18 u, sale a ~206 px como en el concepto)
export const YTOP = 9.6, YBAJO = -1.45;    // lo que llega a verse en vertical (la camara no sube ni baja)
export const BALDOSA = 2048;
export const X = (u) => u * CP, Y = (v) => (YTOP - v) * CP;
export const px = (p) => (p - 655) * 0.01116, py = (p) => (828 - p) * 0.01116;      // pixeles de la imagen de referencia

// las capas pintadas: paralaje f, profundidad z (orden), resolucion, bruma (d) y su color
export const CAPAS = {
  lejos: { f: 0.12, z: -330, res: 42, d: 0.8, niebla: '#8e8177' },
  medioLejos: { f: 0.3, z: -175, res: 58, d: 0.55, niebla: '#857a71' },
  medio: { f: 0.55, z: -72, res: 78, d: 0.32, niebla: '#766c65' },
  juego: { f: 1, z: 0, res: 112, d: 0, niebla: '#7d6f60' },
  frente: { f: 1.35, z: 12, res: 84, d: 0, niebla: '#000000', desenfoque: 1.6 },
};
// cuantas baldosas tiene una capa que cubre [a, b] (u) y donde empieza cada una
export function baldosas(capa, a, b) {
  const ancho = BALDOSA / CAPAS[capa].res, n = Math.ceil((b - a) / ancho), l = [];
  for (let i = 0; i < n; i++) l.push({ i, x0: a + i * ancho, x1: a + (i + 1) * ancho });
  return l;
}
