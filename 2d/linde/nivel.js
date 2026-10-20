// EL LINDE en el juego (nivel 6): QUE pieza del concepto va en cada sitio del mapa. Sin dibujo: lo usan el hilo
// que pinta (linde/obrero.js) y el terreno (que no pinta tablones donde va una rama, una plataforma de la aldea,
// un puente o la pasarela de hierro).
// Piezas de las marcas del nivel (`tipo: 'linde'`): las casillas seguidas con la misma letra son una sola pieza.
// Piezas que salen de las plataformas ('=' y 'x'):
//   rama        la plataforma que hay junto a un arbol (sale de su tronco)
//   plataforma  en la aldea, las cortas: plataforma de chapa con su capsula encima
//   puente      en la aldea, las largas: puente de tablas colgado de cables
//   pasarela    sobre el vacio (el arroyo): la pasarela de hierro
//   tablado     lo demas (la pasarela por las copas de los huertos): tablas colgadas de las ramas
//   tablas      una fila que es SOLO de tablas podridas (las pinta el juego, que caen): lo que las aguanta, pilotes
//               si estan sobre el agua (agua: true) o cuerdas que suben a las ramas
// Y lo que tiene que colgar de algo (atrezo.js): cada cuerda del mapa ('H', con el tablero de al lado donde va su
// percha) y cada ancla del gancho ('o').
import { T } from '../sim/constantes.js';

const ES_PLAT = (c) => c === '=' || c === 'x';

export function piezasDelLinde(nivel) {
  const mapa = nivel.mapa, h = mapa.length, w = Math.max(...mapa.map((f) => f.length));
  const ch = (i, j) => (j < 0 || j >= h || i < 0 || i >= w ? '#' : mapa[j][i] ?? ' ');
  const marcas = nivel.marcas || {};
  const piezas = [], sinTabla = new Set();
  // ---- las marcas, agrupadas
  const visto = new Set();
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = ch(i, j), m = marcas[c];
    if (!m || m.tipo !== 'linde' || visto.has(i + ',' + j)) continue;
    let i0 = i, i1 = i, j0 = j, j1 = j; const cola = [[i, j]]; visto.add(i + ',' + j);
    while (cola.length) {
      const [a, b] = cola.pop();
      i0 = Math.min(i0, a); i1 = Math.max(i1, a); j0 = Math.min(j0, b); j1 = Math.max(j1, b);
      for (const [x, y] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) if (ch(x, y) === c && !visto.has(x + ',' + y)) { visto.add(x + ',' + y); cola.push([x, y]); }
    }
    piezas.push({ ...m, letra: c, i0, i1, j0, j1, x: ((i0 + i1 + 1) / 2) * T, y: (j1 + 1) * T });
  }
  // el suelo de una columna por debajo de una fila (la cara de arriba del primer macizo)
  const suelo = (i, j) => { for (let y = j; y < h; y++) if (ch(i, y) === '#') return y; return h; };
  const arboles = piezas.filter((p) => p.pieza === 'arbol');
  const aldea = piezas.find((p) => p.pieza === 'aldea');
  // ---- las plataformas
  for (let j = 0; j < h; j++) {
    let i = 0;
    while (i < w) {
      if (!ES_PLAT(ch(i, j))) { i++; continue; }
      let i1 = i; while (ES_PLAT(ch(i1 + 1, j))) i1++;
      const x0 = i * T, x1 = (i1 + 1) * T, cx = (x0 + x1) / 2;
      const tablas = []; for (let k = i; k <= i1; k++) if (ch(k, j) === 'x') tablas.push(k);
      const pon = (p, a0, a1) => {
        const tb = tablas.filter((k) => k >= a0 && k <= a1);
        piezas.push({ ...p, i0: a0, i1: a1, j0: j, j1: j, x: ((a0 + a1 + 1) / 2) * T, y: j * T, tablas: tb });
        for (let k = a0; k <= a1; k++) if (ch(k, j) === '=') sinTabla.add(k + ',' + j);
      };
      const largo = i1 - i + 1;
      if (tablas.length === largo) piezas.push({ pieza: 'tablas', i0: i, i1, j0: j, j1: j, x: cx, y: j * T, agua: suelo(i, j + 1) >= h && j >= h - 6 });
      else if (aldea && i >= aldea.i0 - 8 && i1 <= aldea.hasta && j < aldea.j1) {
        // en la aldea: lo que esta delante del tronco es plataforma (con su capsula) y lo que sigue, puente
        const corte = aldea.i1 + 3;
        if (largo <= 6 && !tablas.length) pon({ pieza: 'plataforma', capsula: true }, i, i1);
        else if (i <= corte && i1 > corte) { pon({ pieza: 'plataforma', capsula: true }, i, corte); pon({ pieza: 'puente' }, corte + 1, i1); }
        else pon({ pieza: 'puente' }, i, i1);
      } else {
        const ar = largo <= 5 && arboles.find((a) => Math.abs(cx - a.x) < ((a.an || 200) / 2 / 2.73) + 7 * T && j < a.j1);
        if (ar) pon({ pieza: 'rama', arbol: ar, lado: cx > ar.x ? 1 : -1 }, i, i1);
        else if (suelo(i, j + 1) >= h && suelo(i1, j + 1) >= h) pon({ pieza: 'pasarela' }, i, i1);
        else pon({ pieza: 'tablado' }, i, i1);
      }
      i = i1 + 1;
    }
  }
  // ---- las cuerdas (una por columna y tramo) con el tablero de al lado, y las anclas del gancho
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
    if (ch(i, j) !== 'H' || ch(i, j - 1) === 'H') continue;
    let j1 = j; while (ch(i, j1 + 1) === 'H') j1++;
    let xp = null;
    for (let dk = 1; dk <= 3 && xp === null; dk++) for (const k of [i + dk, i - dk]) if (xp === null && ES_PLAT(ch(k, j + 1))) xp = k > i ? k * T : (k + 1) * T;
    piezas.push({ pieza: 'cuerda', i0: i, i1: i, j0: j, j1, x: (i + 0.5) * T, y: j * T, xp, yDeck: (j + 1) * T });
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (ch(i, j) === 'o') piezas.push({ pieza: 'ancla', i0: i, i1: i, j0: j, j1: j, x: (i + 0.5) * T, y: (j + 0.5) * T });
  return { piezas, sinTabla, ancho: w * T, alto: h * T, suelo };
}
