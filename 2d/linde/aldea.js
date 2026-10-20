// EL LINDE · LA ALDEA DEL ARBOL (capa MEDIO, d ~0,24): la pieza que manda en la referencia. Un arbol gigante
// sobre un monticulo de roca del que caen cascadas, con capsulas de chapa colgadas a cuatro alturas, cada una
// sobre su plataforma, escaleras de mano entre ellas, un puente de tablas que cruza por delante del tronco y
// otros dos que van a los arboles de al lado, estandartes, farolillos y la copa abierta justo donde esta el sol.
// Aqui solo se COMPONE: las piezas son las de troncos, casas, metal, suelo y follaje. La vegetacion va en el
// arbol y en la roca (regla del usuario), nunca encima de las capsulas ni del hierro.
import { TINTA, azar, rgba } from '../dibujo/tinta.js';
import { g, tono, luces, sueloY, lerp } from './base.js';
import { tronco, setasTronco } from './troncos.js';
import { capsula, plataforma, escalera, estandarte } from './casas.js';
import { tubo } from './metal.js';
import { roca, cascada, grupoSetas } from './suelo.js';
import { hojas, colgajo } from './follaje.js';

export const ALDEA = { x: 5640, base: 900, an: 380, inclina: 0.03 };
// el eje del tronco a la altura y (para colgar cosas de el sin adivinar)
const eje = (y) => ALDEA.x + ALDEA.inclina * (ALDEA.base - y);
const medio = (y) => (ALDEA.an * (1 - ((ALDEA.base - y) / 1120) * 0.38)) / 2;

// PUENTE de tablas colgado de dos cables: catenaria, tablas a pasos distintos (falta alguna, otra torcida),
// pendolas del cable a las tablas
// o.huecos: [[xa, xb]] tramos sin tabla (en el juego, donde el mapa tiene tablas podridas: las pinta el juego, que
// caen); o.combaCable: la comba del pasamanos si el tablero va recto (en el juego el tablero es una fila de casillas)
export function puenteTablas(x0, y0, x1, y1, comba, d, sem, o = {}) {
  const rr = azar(sem), T = (c) => tono(c, d, x0), n = Math.max(6, Math.round(Math.abs(x1 - x0) / 13));
  const p = (t, dy = 0) => [lerp(x0, x1, t), lerp(y0, y1, t) + Math.sin(t * Math.PI) * comba + dy];
  // cable de arriba (pasamanos) y el de abajo; pendolas
  const arriba = [], abajo = [];
  const cc = o.combaCable ?? -comba * 0.35;
  for (let i = 0; i <= 24; i++) { const t = i / 24; arriba.push(p(t, -30 + Math.sin(t * Math.PI) * cc)); abajo.push(p(t)); }
  g.lineCap = 'round';
  for (let i = 1; i < 24; i += 2) { g.strokeStyle = T('#2a2620'); g.lineWidth = 1; g.beginPath(); g.moveTo(...arriba[i]); g.lineTo(...abajo[i]); g.stroke(); }
  for (const L of [arriba, abajo]) { if (d < 0.4) { g.strokeStyle = TINTA; g.lineWidth = 3.4; g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); } g.strokeStyle = T('#3a332a'); g.lineWidth = 1.8; g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  // tablas: canto de 5 px con la luz arriba
  for (let k = 0; k <= n; k++) {
    if (k > 1 && k < n - 1 && rr() < 0.08) continue;
    const t = k / n, [x, y] = p(t), tor = rr() < 0.1 ? (rr() - 0.5) * 0.6 : 0;
    if (o.huecos && o.huecos.some(([a, b]) => x > a - 4 && x < b + 4)) continue;
    g.save(); g.translate(x, y); g.rotate(tor);
    g.fillStyle = T(rr() < 0.5 ? '#3d3427' : '#4a3f2e'); g.fillRect(-5, -1, 10, 6); g.fillStyle = T('#b59b6c'); g.fillRect(-5, -1.5, 10, 1.4);
    if (d < 0.4) { g.strokeStyle = TINTA; g.lineWidth = 0.9; g.strokeRect(-5, -1.5, 10, 7); }
    g.restore();
  }
}

// FAROLILLOS colgados de un cable entre dos puntos (la luz se enciende despues de la bruma)
function farolillos(x0, y0, x1, y1, n, d, sem) {
  const T = (c) => tono(c, d, x0), rr = azar(sem);
  g.strokeStyle = T('#2a2620'); g.lineWidth = 1.1; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 40, x1, y1); g.stroke();
  for (let k = 1; k < n; k++) {
    const t = k / n, x = lerp(x0, x1, t), y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * (Math.max(y0, y1) + 40) + t * t * y1, l = 6 + rr() * 8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + l); g.stroke();
    g.fillStyle = T('#2b2620'); g.fillRect(x - 3.5, y + l, 7, 9); g.fillStyle = '#eed69f'; g.fillRect(x - 2, y + l + 2, 4, 5);
    luces.push([x, y + l + 4.5, 2.4, 0.55 * (1 - d * 0.5)]);
  }
}

export function aldea(d) {
  const { x: X, base: B, an } = ALDEA, rr = azar(5640);
  // ---- los arboles de al lado, de donde salen los puentes
  tronco(5020, sueloY(5020), -150, 130, d, 5021, { colgajos: 5 });
  tronco(6270, sueloY(6270), -150, 140, d, 6271, { colgajos: 5 });
  // ---- el monticulo de roca
  const mont = [[5250, 1205], [5272, 1080], [5318, 1000], [5392, 944], [5482, 906], [5590, 886], [5700, 889], [5800, 902], [5884, 934], [5946, 992], [5990, 1090], [6012, 1205]];
  roca(mont, d, 5641);
  // ---- el tronco gigante, algo inclinado, con contrafuertes que abrazan la roca
  tronco(X, B, -220, an, d, 5642, { colgajos: 14, recto: true, inclina: ALDEA.inclina, pivote: B });
  // setas que brillan subiendo por los dos cantos del tronco
  setasTronco(X, B - 40, B - 300, -1, 6, 10, d, 5643);
  setasTronco(X, B - 60, B - 260, 1, 4, 8, d, 5644);
  setasTronco(5020, sueloY(5020) - 120, sueloY(5020) - 380, 1, 4, 7, d, 5645);
  // matas en las repisas de la roca (nacen del suelo) y setas al pie
  for (const [mx, my, w] of [[5310, 1006, 70], [5420, 930, 80], [5830, 912, 70], [5950, 996, 60]]) hojas(mx, my - 6, w, 26, d, mx, { den: 0.9, mata: true });
  grupoSetas(5520, 898, 4, 6, d, 5646); grupoSetas(5790, 900, 3, 5, d, 5647);
  // ---- capsulas, cada una sobre su plataforma: [cx, cy, r, puerta]
  const C = [
    [eje(760) - medio(760) - 40, 760, 64, true],
    [eje(600) + medio(600) + 52, 600, 84, true],
    [eje(430) - medio(430) - 44, 430, 76, false],
    [eje(240) + medio(240) + 30, 240, 58, false],
  ];
  const pl = C.map(([cx, cy, r]) => [cx - r * 1.05, cx + r * 1.15, cy + r * 1.18]);
  // tubos que bajan por el tronco desde las capsulas (por detras de todo lo demas)
  tubo([[pl[1][0] + 30, pl[1][2] + 14], [eje(830) + medio(830) - 30, 830], [eje(890) + medio(890) - 40, 900]], 8, d, X);
  tubo([[pl[2][1] - 20, pl[2][2] + 14], [eje(660) - medio(660) + 24, 660], [eje(880) - medio(880) + 20, 900]], 6, d, X);
  // escaleras entre plataformas y hasta la roca
  escalera(pl[0][0] + 26, pl[0][2], 948, d);
  escalera(pl[0][1] - 24, pl[2][2], pl[0][2], d);
  escalera(pl[1][1] - 40, pl[1][2], 950, d);
  escalera(pl[1][0] + 40, pl[3][2], pl[1][2], d);
  for (let k = 0; k < C.length; k++) { const [cx, cy, r, puerta] = C[k]; plataforma(...pl[k], d, 5650 + k); capsula(cx, cy, r, d, 5660 + k, { puerta, oxido: true, luz: 2.2 }); }
  // el puente de tablas que cruza por delante del tronco, y los que van a los arboles de al lado
  puenteTablas(pl[2][1] - 6, pl[2][2], pl[1][0] + 8, pl[1][2], 34, d, 5670);
  plataforma(5020 + 40, 5020 + 150, 640, d, 5671); puenteTablas(5170, 640, pl[2][0] + 6, pl[2][2], 60, d, 5672);
  plataforma(6270 - 160, 6270 - 50, 360, d, 5673); puenteTablas(pl[3][1] - 6, pl[3][2], 6270 - 156, 360, 44, d, 5674);
  // estandartes y farolillos
  estandarte(pl[1][1] - 50, pl[1][2] + 18, 40, 120, d, 5680);
  estandarte(pl[2][0] + 14, pl[2][2] + 18, 32, 92, d, 5681);
  estandarte(6270 - 130, 378, 30, 84, d, 5682);
  farolillos(pl[0][1] - 4, pl[0][2] - 34, pl[1][0] + 4, pl[1][2] - 34, 6, d, 5683);
  farolillos(pl[3][0] + 4, pl[3][2] - 34, pl[2][1] - 4, pl[2][2] - 34, 7, d, 5684);
  // ---- cascadas que salen de la roca (entre las matas) y de una tuberia rota
  // (se ponen en los huecos que dejan las casas de delante: a los lados del monticulo y en el centro, bajo la capsula del juego)
  cascada(5288, 1010, 1198, 28, d, 5690);
  cascada(5560, 893, 1198, 20, d, 5691, { velo: 0.2 });
  roca([[5640, 918], [5648, 892], [5672, 878], [5712, 874], [5748, 884], [5764, 906], [5760, 924]], d, 5695);
  hojas(5700, 870, 50, 16, d, 5696, { den: 0.9, mata: true });
  cascada(5680, 898, 1198, 50, d, 5694, { velo: 0.12 });
  cascada(5940, 990, 1198, 24, d, 5692);
  tubo([[pl[1][1] - 6, pl[1][2] + 40], [pl[1][1] + 26, pl[1][2] + 40]], 9, d, X); cascada(pl[1][1] + 26, pl[1][2] + 44, 1080, 9, d, 5693, { velo: 0.12 });
  // ---- la copa: abierta encima del sol, que entra por el hueco
  for (const [cx, cy, rx, ry] of [[5380, 70, 270, 120], [5930, 40, 280, 130], [5250, 200, 150, 70], [5520, 210, 160, 74], [5800, 150, 170, 80], [6080, 180, 170, 70], [5470, -40, 200, 90], [5840, -60, 220, 90]]) hojas(cx, cy, rx, ry, d, Math.floor(cx + cy), { den: 0.85 });
  for (let k = 0; k < 10; k++) colgajo(5300 + rr() * 760, 120 + rr() * 120, 80 + rr() * 220, d, 5700 + k);
}

// LA ALDEA en el nivel del juego (6): el mismo arbol, pero lo que se pisa es lo del MAPA (linde/nivel.js), en px del
// concepto: P = { x, base, plataformas: [{ x0, x1, y }], puentes: [{ x0, x1, y, huecos }] }. Cada plataforma lleva su
// capsula; el puente, sus tablas salvo en los huecos. Las escaleras son las cuerdas del mapa (las pinta el terreno).
export function aldeaJuego(P, d = 0.05) {
  const X = P.x, B = P.base, an = 380, rr = azar(5640);
  tronco(X, B, -560, an, d, 5642, { colgajos: 14, recto: true, inclina: 0.02, pivote: B });
  // setas en racimos sueltos (de una en una a paso fijo se leian como una escalera)
  setasTronco(X, B - 60, B - 130, -1, 3, 10, d, 5643); setasTronco(X, B - 250, B - 310, -1, 2, 9, d, 5648);
  setasTronco(X, B - 150, B - 210, 1, 3, 8, d, 5644);
  for (const [mx, w] of [[X - 260, 80], [X + 230, 70]]) hojas(mx, B - 6, w, 26, d, Math.round(mx), { den: 0.9, mata: true });
  grupoSetas(X - 140, B - 2, 4, 6, d, 5646); grupoSetas(X + 160, B - 2, 3, 5, d, 5647);
  // los puentes primero (sus cables pasan por detras de las capsulas)
  if (!P.sinPuentes) P.puentes.forEach((pu, k) => puenteTablas(pu.x0, pu.y, pu.x1, pu.y, 0, d, 5670 + k, { huecos: pu.huecos, combaCable: 50 }));   // (el juego pinta los suyos a escala: atrezo.js)
  P.plataformas.forEach((pl, k) => {
    // (P.capsulaMax / P.capsulaK: en el juego, a la escala del 18, que tiene que caber de pie por su puerta)
    const r = Math.min(P.capsulaMax ?? 84, (pl.x1 - pl.x0) * (P.capsulaK ?? 0.36)), cx = (pl.x0 + pl.x1) / 2, cy = pl.y - r * 1.18;
    plataforma(pl.x0, pl.x1, pl.y, d, 5650 + k);
    capsula(cx, cy, r, d, 5660 + k, { puerta: true, oxido: true, luz: 2.2 });
    estandarte(pl.x1 - 46, pl.y + 18, 34, 96, d, 5680 + k);
  });
  // farolillos de una plataforma a la otra
  for (let k = 0; k + 1 < P.plataformas.length; k++) { const a = P.plataformas[k], b = P.plataformas[k + 1]; farolillos(a.x1 - 4, a.y - 34, b.x0 + 4, b.y - 34, 6, d, 5683 + k); }
  // la copa: alta (el arbol sale por encima del mapa)
  for (const [dx, cy, rx, ry] of [[-260, -300, 280, 120], [290, -340, 290, 130], [-390, -150, 160, 70], [-120, -170, 170, 74], [160, -230, 180, 80], [440, -200, 170, 70], [-170, -470, 200, 90], [200, -490, 220, 90]]) hojas(X + dx, cy, rx, ry, d, Math.floor(X + dx + cy), { den: 0.85 });
  for (let k = 0; k < 10; k++) colgajo(X - 340 + rr() * 760, -220 + rr() * 140, 80 + rr() * 260, d, 5700 + k);
}
