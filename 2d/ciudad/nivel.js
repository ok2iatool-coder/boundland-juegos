// LA CIUDAD (niveles 7 y 8, zona 'ciudad'): QUE va en cada sitio del mapa. Sin dibujo ni DOM: lo usan el hilo que
// pinta (ciudad/obrero.js) y el juego (dibujo/ciudad.js decide que decorado viejo no pintar).
//
// Los dos niveles van PEGADOS por la calle (sim/pasos.js) y comparten fondo, asi que todo se calcula en su MUNDO
// COMUN, que tiene el origen del nivel 7: la columna c del nivel 8 es la W7 + c del mundo, y su fila r la r - dy
// (el suelo del 8 empieza dy filas mas abajo que donde acaba el del 7). En el juego, lo del mundo comun se pinta
// desplazado (-ox, -oy) del nivel en curso (E.comun).
//
// Piezas que salen del TERRENO (lo macizo que no toca el fondo del mapa):
//   sala    un cajon hueco (paredes y techo de casillas, por dentro aire y pisos '='): un edificio en ruinas que
//           sigue por encima y se apoya en pilares por debajo; el cajon es la planta en la que se juega
//   bloque  macizo de 4 o mas filas: la parte de arriba de un edificio al que se le cayo la de abajo
//   losa    macizo fino (el tablero de un paso elevado), con las patas que tenga
// Y de las MARCAS de decorado de los dos niveles: farola, senal, coche, orden_militar, cartel_ceniza, nido_chapa,
// soldado_caido, rejilla_salida (en su sitio del mundo comun).
// La CALLE: los tramos de suelo de la calle (la cara de arriba del macizo que toca el fondo), para repartir
// barreras, escombros y bolardos sin tapar nada.
import { T } from '../sim/constantes.js';
import { NIVELES } from '../sim/niveles.js';
import { unir } from '../sim/pasos.js';

// lo que se pinta de nuevo en la ciudad: el decorado viejo de esos tipos no se pinta (dibujo/decorado.js). Los
// carteles, el nido de los insectos, el soldado caido y la rejilla siguen siendo los suyos (cuentan la historia).
export const PINTADAS = new Set(['farola', 'senal', 'coche', 'edificio']);
const MARCAS = new Set([...PINTADAS, 'soldado_caido', 'nido_chapa']);
// la farola alta de la ciudad: la cabeza esta dx a la derecha del pie y alto por encima (u). La luz del juego
// (decorado.js, lucesDe) cae ahi.
export const FAROLA = { dx: 30, alto: 240 };

const anchoDe = (m) => Math.max(...m.map((f) => f.length));

let CACHE = null;
export function mundoCiudad() {
  if (CACHE) return CACHE;
  const n7 = NIVELES.find((n) => n.id === 7), n8 = NIVELES.find((n) => n.id === 8);
  const u8 = unir(n8, NIVELES);
  const W7 = anchoDe(n7.mapa), W8 = anchoDe(n8.mapa), dy = Math.round(-(u8.mundo ? u8.mundo.oy : 0) / T);
  const W = W7 + W8, H = Math.max(n7.mapa.length, n8.mapa.length - dy);
  // el 8 tal y como se juega: sin la pared de su borde izquierdo (lleva delante el trozo del 7, que se salta)
  const m8 = u8.nivel.mapa, S8 = Math.round((u8.desplX || 0) / T);
  const deNivel = (m, i, j) => { if (j < 0) return ' '; if (j >= m.length) return '#'; const f = m[j]; return i < f.length ? f[i] : f[f.length - 1]; };
  // el caracter del mundo comun (fuera por abajo, macizo; por arriba, aire)
  const ch = (i, j) => {
    if (i < 0) i = 0; if (i >= W) i = W - 1;
    return i < W7 ? deNivel(n7.mapa, i, j) : deNivel(m8, i - W7 + S8, j + dy);
  };
  const macizo = (i, j) => (j >= H ? true : j < 0 ? false : ch(i, j) === '#');

  // ---- lo macizo por piezas conexas; las que tocan el fondo son el suelo de la calle
  const comp = new Int32Array(W * H).fill(-1), grupos = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!macizo(i, j) || comp[j * W + i] >= 0) continue;
    const id = grupos.length, celdas = [], cola = [[i, j]]; comp[j * W + i] = id;
    let i0 = i, i1 = i, j0 = j, j1 = j, fondo = false;
    while (cola.length) {
      const [a, b] = cola.pop(); celdas.push([a, b]);
      i0 = Math.min(i0, a); i1 = Math.max(i1, a); j0 = Math.min(j0, b); j1 = Math.max(j1, b);
      if (b === H - 1) fondo = true;
      for (const [x, y] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) if (x >= 0 && x < W && y >= 0 && y < H && macizo(x, y) && comp[y * W + x] < 0) { comp[y * W + x] = id; cola.push([x, y]); }
    }
    grupos.push({ id, celdas, i0, i1, j0, j1, fondo });
  }

  const piezas = [];
  for (const gq of grupos) {
    if (gq.fondo) continue;
    const w = gq.i1 - gq.i0 + 1, h = gq.j1 - gq.j0 + 1, lleno = gq.celdas.length / (w * h);
    const fila = (j) => gq.celdas.filter((c) => c[1] === j).length;
    const base = { i0: gq.i0, i1: gq.i1, j0: gq.j0, j1: gq.j1, x0: gq.i0 * T, x1: (gq.i1 + 1) * T, y0: gq.j0 * T, y1: (gq.j1 + 1) * T };
    if (lleno < 0.5 && fila(gq.j0) >= w * 0.9) {
      // los pisos de dentro ('=') y el suelo de la sala: la ultima fila de pisos o, si no hay, el borde de abajo
      const pisos = [];
      for (let j = gq.j0 + 1; j <= gq.j1; j++) { let n = 0; for (let i = gq.i0 + 1; i < gq.i1; i++) if (ch(i, j) === '=') n++; if (n >= (w - 2) * 0.5) pisos.push(j); }
      piezas.push({ pieza: 'sala', ...base, pisos });
    } else if (lleno >= 0.85 && h >= 4) piezas.push({ pieza: 'bloque', ...base });
    else {
      // el tablero: las filas casi enteras; las patas: lo que cuelga por debajo
      const tablero = []; for (let j = gq.j0; j <= gq.j1; j++) if (fila(j) >= w * 0.8) tablero.push(j);
      const ja = tablero.length ? tablero[0] : gq.j0, jb = tablero.length ? tablero[tablero.length - 1] : gq.j0;
      const patas = [];
      for (let i = gq.i0; i <= gq.i1; i++) { let j = jb + 1; while (j <= gq.j1 && macizo(i, j) && comp[j * W + i] === gq.id) j++; if (j > jb + 1) patas.push({ i, j0: jb + 1, j1: j - 1 }); }
      piezas.push({ pieza: 'losa', ...base, tablero: [ja, jb], ty0: ja * T, ty1: (jb + 1) * T, patas });
    }
  }

  // ---- el suelo de la calle en cada columna (la cara de arriba del macizo del fondo) y sus tramos
  const suelo = new Int32Array(W);
  for (let i = 0; i < W; i++) {
    let j = H - 1;
    while (j > 0 && macizo(i, j - 1) && (comp[(j - 1) * W + i] < 0 || grupos[comp[(j - 1) * W + i]].fondo)) j--;
    suelo[i] = j;
  }
  const calle = [];
  for (let i = 0; i < W;) {
    let k = i; while (k + 1 < W && suelo[k + 1] === suelo[i]) k++;
    // los fosos de pinchos no son calle
    let pinchos = false; for (let q = i; q <= k; q++) if (ch(q, suelo[i] - 1) === '^' || ch(q, suelo[i]) === '^') pinchos = true;
    if (!pinchos) calle.push({ i0: i, i1: k, j: suelo[i], x0: i * T, x1: (k + 1) * T, y: suelo[i] * T });
    i = k + 1;
  }
  // los fosos: tramos con pinchos (cristales rotos en el fondo de un socavon)
  const fosos = [];
  for (let i = 0; i < W; i++) {
    const j = suelo[i]; if (ch(i, j - 1) !== '^' && ch(i, j) !== '^') continue;
    const f = fosos[fosos.length - 1];
    if (f && f.i1 === i - 1) f.i1 = i; else fosos.push({ i0: i, i1: i });
  }

  // ---- las marcas de decorado de los dos niveles
  const marcas = [];
  for (const [n, di, dj] of [[n7, 0, 0], [n8, W7, -dy]]) {
    const mk = n.marcas || {};
    n.mapa.forEach((f, j) => { for (let i = 0; i < f.length; i++) { const m = mk[f[i]]; if (m && MARCAS.has(m.tipo)) marcas.push({ pieza: m.tipo, nivel: n.id, i: i + di, j: j + dj, x: (i + di + 0.5) * T, y: (j + dj + 1) * T }); } });
  }
  // donde no conviene poner cosas a pie de calle: las marcas, la entrada y la salida
  const ocupado = [];
  for (const m of marcas) ocupado.push([m.x - 70, m.x + 70]);
  for (const [n, di] of [[n7, 0], [n8, W7]]) n.mapa.forEach((f) => { for (let i = 0; i < f.length; i++) if ('PSUNkezCGY'.includes(f[i])) ocupado.push([(i + di) * T - 40, (i + di + 1) * T + 40]); });

  CACHE = { W, H, W7, W8, dy, ancho: W * T, alto: H * T, ch, macizo, piezas, marcas, calle, fosos, ocupado, sueloCol: (i) => suelo[Math.max(0, Math.min(W - 1, i))], sueloEn: (x) => suelo[Math.max(0, Math.min(W - 1, Math.floor(x / T)))] * T };
  return CACHE;
}

// el desplazamiento del mundo comun al nivel en curso (lo comun en (x, y) esta en el nivel en (x - ox, y - oy))
export function desplazamiento(E) { return E.comun ? { ox: E.comun.ox, oy: E.comun.oy } : { ox: 0, oy: 0 }; }
