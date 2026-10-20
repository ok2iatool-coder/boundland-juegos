// El PLANO del primer trozo jugable: 500 x 500 m alrededor de la puerta sur de la Base. Puro (sin three): donde va
// cada cosa, el relieve, los caminos, el arroyo, los sitios de los personajes y por donde andan, y los obstaculos.
// Ejes: x al este, z al SUR (fuera, z > 0, hacia la Cuenca); el muro corre por z = 0 con la puerta en x = 0.
//
//   dentro (z < 0): la plaza con el pozo, la obra del segundo pozo, la Intendencia y su tablon, el puesto de Tobias,
//     la herreria con el banco y la carpinteria, la enfermeria de Amparo y el barracon de las literas; alrededor,
//     calles de tiendas y chabolas que cierran el paso al resto de la ciudad
//   extramuros (0 < z < 90): tiendas pegadas al muro, la de Lia junto a las huertas, un fuego, un banco de trabajo,
//     la arboleda del oeste (madera)
//   la Cuenca (z > 90): pradera con lomas, el arroyo con su vado, juncos, flores blancas, barro y rocas
export const X0 = -250, X1 = 250, Z0 = -150, Z1 = 350;          // el trozo
export const BORDE = { x0: -238, x1: 238, z0: -132, z1: 338 };   // hasta donde llega el 18
export const MURO = { z: 0, grueso: 2.4, alto: 34, puerta: 5, altoPuerta: 14 };   // puerta de 10 m de ancho

// ---------------- ruido con semilla (el mismo que el del mapa del muro) ----------------
function azarDe(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const azar = azarDe;
const P = (() => { const r = azarDe(11), a = new Float32Array(256 * 256); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
function ruido(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
  const v = (i, j) => P[((i & 255) << 8) | (j & 255)];
  const a = v(xi, zi), b = v(xi + 1, zi), c = v(xi, zi + 1), d = v(xi + 1, zi + 1);
  return a + (b - a) * u + ((c + (d - c) * u) - (a + (b - a) * u)) * w;
}
export const fbm = (x, z, o = 3) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * ruido(x * f + i * 17.3, z * f - i * 9.1); n += a; a *= 0.5; f *= 2; } return s / n; };
export const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------- lineas: caminos y arroyo ----------------
function polilinea(pts, paso = 1) {
  // Catmull-Rom centripeta muestreada cada `paso` m (sin three)
  const out = [];
  const P2 = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P2.length - 2; i++) {
    const [p0, p1, p2, p3] = [P2[i - 1], P2[i], P2[i + 1], P2[i + 2]];
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(L / paso));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
export const CAMINOS = [
  { ancho: 2.2, pts: polilinea([[0, -2], [0, 12], [3, 40], [-5, 80], [6, 130], [4, 170], [5, 192], [-4, 240], [8, 300], [0, 345]]) },     // de la puerta al sur
  { ancho: 1.4, pts: polilinea([[1, 30], [-25, 33], [-55, 40], [-90, 52], [-130, 62], [-175, 70]]) },                                    // a las huertas y la arboleda
  { ancho: 1.4, pts: polilinea([[2, 26], [30, 30], [60, 36], [95, 50]]) },                                                                // al campamento del este
  { ancho: 1.1, pts: polilinea([[-5, 80], [-40, 110], [-70, 150], [-90, 186]]) },                                                        // senda a las flores y el barro
];
// dentro: tierra pisada (no camino de cinta): la calle de la puerta a la plaza y la plaza
export const ARROYO = { pts: polilinea([[-260, 176], [-200, 170], [-140, 182], [-80, 188], [-30, 186], [5, 192], [50, 200], [110, 194], [170, 206], [260, 214]]), ancho: 3.2, hondo: 0.45 };
export const VADO = { x: 5, z: 192 };

// distancia de un punto a una polilinea (y el indice del tramo mas cercano)
export function distLinea(pts, x, z) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az;
    const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    d = Math.min(d, Math.hypot(ax + dx * k - x, az + dz * k - z));
  }
  return d;
}
// rejilla de distancias (1 m) al borde de los caminos y al eje del arroyo: se piden muchas veces
const NC = (X1 - X0) + 1, NZ = (Z1 - Z0) + 1;
function rejilla(lineas, rango, medio) {
  const g = new Float32Array(NC * NZ).fill(rango);
  for (const L of lineas) {
    const pts = L.pts, m = medio(L);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - rango - m - X0)), i1 = Math.min(NC - 1, Math.ceil(Math.max(ax, bx) + rango + m - X0));
      const j0 = Math.max(0, Math.floor(Math.min(az, bz) - rango - m - Z0)), j1 = Math.min(NZ - 1, Math.ceil(Math.max(az, bz) + rango + m - Z0));
      for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) {
        const x = k + X0, z = j + Z0, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
        const d = Math.hypot(ax + dx * t - x, az + dz * t - z) - m;
        if (d < g[j * NC + k]) g[j * NC + k] = d;
      }
    }
  }
  return g;
}
const GC = rejilla(CAMINOS, 10, (L) => L.ancho / 2);
const GA = rejilla([ARROYO], 30, () => 0);
function leer(g, x, z, fuera) {
  const gx = x - X0, gz = z - Z0;
  if (gx < 0 || gz < 0 || gx > NC - 1.001 || gz > NZ - 1.001) return fuera;
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const a = g[j * NC + i], b = g[j * NC + i + 1], c = g[(j + 1) * NC + i], d = g[(j + 1) * NC + i + 1];
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}
export const bordeCamino = (x, z) => leer(GC, x, z, 10);
export const distArroyo = (x, z) => leer(GA, x, z, 30);

// ---------------- dentro de la Base ----------------
export const PLAZA = { x: 0, z: -58, rx: 30, rz: 22 };        // elipse de tierra pisada (mas grande, el 18 se perdia en ella)
export const DENTRO = { x0: -82, x1: 82, z0: -128, z1: -3 };   // lo que se recorre dentro (lo demas, casas)

// ---------------- el relieve ----------------
// dentro, llano; extramuros, casi llano; la Cuenca, lomas y el valle del arroyo; en los bordes, cuestas que cierran
export function alturaLisa(x, z) {
  if (z < 0) return 0.25 * (fbm(x / 20 + 3, z / 20) - 0.5);
  let h = 0.6 * (fbm(x / 30 + 7, z / 30 - 2) - 0.5);
  const lejos = suave(40, 140, z);                                       // la Cuenca empieza a ondular
  h += lejos * (6 * (fbm(x / 80 + 3.1, z / 80 - 1.7, 4) - 0.5) + 1.6 * (fbm(x / 22, z / 22) - 0.5));
  h += lejos * 2.5 * suave(150, 330, z);
  // el valle del arroyo
  const da = distArroyo(x, z);
  h -= lejos * 1.6 * Math.exp(-((da / 18) ** 2));
  // el cauce
  if (da < ARROYO.ancho) h -= ARROYO.hondo * (1 - (da / ARROYO.ancho) ** 2) + 0.25;
  else h -= 0.25 * Math.exp(-((da - ARROYO.ancho) / 1.2));
  // el vado: el camino cruza casi a ras
  const dv = Math.hypot(x - VADO.x, z - VADO.z);
  if (dv < 8 && da < ARROYO.ancho + 1) h += (1 - dv / 8) * 0.3;
  // bordes que suben: el mundo sigue, pero por aqui no se pasa
  const borde = Math.max(suave(222, 250, Math.abs(x)), suave(325, 350, z));
  h += borde * 9 * (0.6 + fbm(x / 40, z / 40));
  // pegado al muro, llano (la base del muro y el paso de la puerta)
  h *= suave(2, 14, z);
  // los caminos, aplanados
  const b = bordeCamino(x, z);
  h -= 0.05 * (1 - suave(-0.3, 0.6, b));
  return h;
}
// la altura del agua del arroyo en (x, z) si esta dentro del cauce (o null)
export function nivelAgua(x, z) {
  if (z < 100) return null;
  const da = distArroyo(x, z);
  if (da > ARROYO.ancho + 0.5) return null;
  // la superficie del agua sigue al terreno del borde del cauce, un poco por debajo
  return alturaLisaSinCauce(x, z) - 0.32;
}
function alturaLisaSinCauce(x, z) {
  let h = 0.6 * (fbm(x / 30 + 7, z / 30 - 2) - 0.5);
  const lejos = suave(40, 140, z);
  h += lejos * (6 * (fbm(x / 80 + 3.1, z / 80 - 1.7, 4) - 0.5) + 1.6 * (fbm(x / 22, z / 22) - 0.5));
  h += lejos * 2.5 * suave(150, 330, z);
  h -= lejos * 1.6 * Math.exp(-((distArroyo(x, z) / 18) ** 2));
  return h;
}

// ---------------- los sitios ----------------
// donde esta cada personaje a cada hora (datos.js PERSONAS.horario) y hacia donde mira (giro: 0 = hacia +z); los de
// casa/tienda no se ven; los de `asientos` reparten a quien llegue alrededor del fuego
export const SITIOS = {
  puerta:      { x: 7.5, z: 5.5, mira: 0.15 },
  puerta_noche: { x: 3.4, z: -3.2, mira: 0.3 },
  intendencia: { x: 2.2, z: -86.4, mira: 0.1 },
  plaza:       { x: -5, z: -64, mira: 0.6 },
  hoguera:     { x: 0, z: -72, asientos: 2.5 },
  herreria:    { x: 33.6, z: -40.8, mira: -Math.PI / 2 },
  enfermeria:  { x: -29.8, z: -85.6, mira: 0.82 },
  puesto:      { x: -31.3, z: -56, mira: Math.PI / 2 },
  huerta:      { x: -40, z: 50, mira: -0.6 },
  arroyo:      { x: -32, z: 181, mira: 0.2 },
  fuego_fuera: { x: -20, z: 26, asientos: 2.2 },
  casa_elena:  { x: 16, z: -106, oculto: true }, casa_nieves: { x: 52, z: -42, oculto: true }, casa_amparo: { x: -46, z: -100, oculto: true },
  casa_tobias: { x: -52, z: -62, oculto: true }, tienda_lia: { x: -48, z: 27, oculto: true },
};
// los sitios de las cosas
export const COSAS = {
  pozo1:      { x: -13, z: -50 },
  obra:       { x: 14, z: -57 },                 // el segundo pozo
  cartelObra: { x: 9.6, z: -52.4 },
  tablon:     { x: -8.6, z: -87.4 },
  intendencia:{ x: 0, z: -92, ancho: 12, fondo: 7 },     // puerta al sur, a la plaza
  puesto:     { x: -29.4, z: -56 },              // el mostrador de Tobias (el puesto entero va de -33,7 a -29,5)
  herreria:   { x: 36, z: -40, ancho: 6, fondo: 7 },     // cobertizo abierto al oeste
  yunque:     { x: 34.6, z: -40 },
  fragua:     { x: 38.1, z: -40 },
  banco:      { x: 30, z: -45.6 },               // el banco de trabajo de la herreria
  carpinteria:{ x: 30, z: -34.4 },
  bancoFuera: { x: 22, z: 36 },                  // el de extramuros
  enfermeria: { x: -34.5, z: -88.5, r: 3.4 },    // tienda redonda con la entrada al este
  barracon:   { x: 36, z: -90, ancho: 18, fondo: 8 },    // abierto por delante (sur)
  litera:     { x: 32, z: -91.6 },
  baul:       { x: 43, z: -92.2 },
  frasco:     { x: 43.4, z: -88.2 },
  hogueraDentro: { x: 0, z: -72 },
  fuegoFuera: { x: -20, z: 26 },
  tiendaLia:  { x: -48, z: 27 },
  huertas:    { x: -45, z: 54, ancho: 34, fondo: 20 },
  garita:     { x: 9.5, z: 8.5 },
};

// el grafo de paso: los personajes van de su sitio al nodo mas cercano, por nodos, y del ultimo a su sitio. Los tramos
// pasan lejos de pozos, fuegos y edificios (comprobado en test_trozo.mjs)
export const NODOS = {
  plazaC: [-5, -62], plazaN: [-5, -80], plazaE: [24, -64], plazaO: [-20, -60], trasPuesto: [-31.6, -61], herr: [28, -41], enf: [-25, -83],
  barr: [36, -83], traseraI: [10, -86], casaE: [12, -104], casaO: [-42, -98], calleO: [-46, -60], herrSur: [27, -49.5], calleE: [46, -49.5],
  dentroPuerta: [0, -12], fueraPuerta: [0, 9], cruce: [2, 28], oeste1: [-26, 35], oeste2: [-39, 40], este1: [30, 31],
  sur1: [-4, 80], sur2: [6, 130], vado: [5, 186], senda1: [-40, 110], senda2: [-62, 148], senda3: [-38, 177],
};
export const ARISTAS = [
  ['plazaC', 'plazaN'], ['plazaC', 'plazaE'], ['plazaC', 'plazaO'], ['plazaO', 'trasPuesto'], ['trasPuesto', 'calleO'], ['plazaE', 'herr'],
  ['plazaN', 'enf'], ['plazaN', 'traseraI'], ['traseraI', 'barr'], ['traseraI', 'casaE'], ['enf', 'casaO'], ['herr', 'herrSur'], ['herrSur', 'calleE'],
  ['plazaC', 'dentroPuerta'], ['dentroPuerta', 'fueraPuerta'], ['fueraPuerta', 'cruce'],
  ['cruce', 'oeste1'], ['oeste1', 'oeste2'], ['cruce', 'este1'], ['cruce', 'sur1'], ['sur1', 'sur2'], ['sur2', 'vado'], ['sur1', 'senda1'], ['senda1', 'senda2'], ['senda2', 'senda3'],
];
// el camino mas corto entre dos puntos por el grafo (Dijkstra pequeno): lista de [x, z]
// (se entra y se sale del grafo por el nodo que deja el recorrido entero mas corto de entre los tres mas cercanos)
const NOMBRES = Object.keys(NODOS);
const DN = (n, p) => Math.hypot(NODOS[n][0] - p[0], NODOS[n][1] - p[1]);
function dijkstra(ini) {
  const dist = Object.fromEntries(NOMBRES.map((n) => [n, Infinity])), prev = {};
  dist[ini] = 0;
  const pend = new Set(NOMBRES);
  while (pend.size) {
    let u = null;
    for (const n of pend) if (u === null || dist[n] < dist[u]) u = n;
    pend.delete(u);
    for (const [p, q] of ARISTAS) {
      const v = p === u ? q : q === u ? p : null;
      if (!v || !pend.has(v)) continue;
      const d = dist[u] + DN(v, NODOS[u]);
      if (d < dist[v]) { dist[v] = d; prev[v] = u; }
    }
  }
  return { dist, prev };
}
const ARBOLES = Object.fromEntries(NOMBRES.map((n) => [n, dijkstra(n)]));
// un tramo recto que atraviesa el muro fuera del hueco de la puerta
function cruzaMuro(p, q) {
  if ((p[1] > MURO.z) === (q[1] > MURO.z)) return false;
  const k = (MURO.z - p[1]) / (q[1] - p[1]);
  return Math.abs(p[0] + (q[0] - p[0]) * k) > MURO.puerta - 1.5;
}
export function ruta(a, b) {
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 6 && !cruzaMuro(a, b)) return [a, b];
  const cerca = (p) => NOMBRES.filter((n) => !cruzaMuro(NODOS[n], p)).sort((m, n) => DN(m, p) - DN(n, p)).slice(0, 3);
  let mejor = null;
  for (const i of cerca(a)) for (const f of cerca(b)) {
    const L = DN(i, a) + ARBOLES[i].dist[f] + DN(f, b);
    if (!mejor || L < mejor.L) mejor = { L, i, f };
  }
  const camino = [];
  for (let n = mejor.f; n; n = ARBOLES[mejor.i].prev[n]) { camino.unshift(NODOS[n]); if (n === mejor.i) break; }
  return [a, ...camino, b];
}

// ---------------- donde se recoge ----------------
// cada sitio con su tipo (sim/datos.js RECURSOS) y su id estable (la partida guarda lo que queda por id)
export const RECOGIDA = (() => {
  const r = azarDe(404), lista = [];
  const libre = (x, z, sep) => lista.every((o) => Math.hypot(o.x - x, o.z - z) > sep) && bordeCamino(x, z) > 2 && Math.abs(x) < 225 && z < 320;
  // rocas en la Cuenca (y alguna en la ladera de extramuros)
  for (let k = 0; k < 400 && lista.filter((o) => o.tipo === 'roca').length < 46; k++) {
    const x = (r() - 0.5) * 420, z = 70 + r() * 250;
    if (distArroyo(x, z) < 6 || !libre(x, z, 9)) continue;
    lista.push({ tipo: 'roca', x, z, tam: 0.6 + r() * 0.7, giro: r() * 6.28 });
  }
  // la arboleda del oeste
  for (let k = 0; k < 400 && lista.filter((o) => o.tipo === 'arbol').length < 30; k++) {
    const x = -215 + r() * 110, z = 25 + r() * 105;
    if (!libre(x, z, 6)) continue;
    lista.push({ tipo: 'arbol', x, z, tam: 0.8 + r() * 0.5, giro: r() * 6.28 });
  }
  for (let k = 0; k < 200 && lista.filter((o) => o.tipo === 'tronco').length < 10; k++) {
    const x = -200 + r() * 160, z = 20 + r() * 140;
    if (!libre(x, z, 5)) continue;
    lista.push({ tipo: 'tronco', x, z, tam: 0.8 + r() * 0.4, giro: r() * 6.28 });
  }
  // juncos, flores blancas y barro junto al arroyo
  for (const [tipo, n, d0, d1, sep] of [['juncos', 26, 3.2, 6, 7], ['flores', 22, 6, 22, 9], ['barro', 9, 3.4, 5, 16]]) {
    for (let k = 0; k < 2000 && lista.filter((o) => o.tipo === tipo).length < n; k++) {
      const i = Math.floor(r() * (ARROYO.pts.length - 1)), [ax, az] = ARROYO.pts[i], [bx, bz] = ARROYO.pts[i + 1];
      const l = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / l, nz = (bx - ax) / l, s = r() < 0.5 ? -1 : 1, d = d0 + r() * (d1 - d0);
      const x = ax + nx * s * d, z = az + nz * s * d;
      if (Math.hypot(x - VADO.x, z - VADO.z) < 12 || !libre(x, z, sep)) continue;
      lista.push({ tipo, x, z, tam: 0.8 + r() * 0.4, giro: r() * 6.28 });
    }
  }
  return lista.map((o, i) => ({ ...o, id: `${o.tipo}-${i}` }));
})();

// ---------------- obstaculos en planta (circulos y cajas giradas) ----------------
// el muro (con su hueco), el cierre de casas de dentro y lo que se recoge; los edificios ponen los suyos al hacerse
export function obstaculos() {
  const circulos = [], cajas = [];
  const caja = (x, z, hx, hz, ang = 0) => cajas.push({ x, z, hx, hz, ang });
  // el muro: dos tramos a los lados de la puerta
  const mitad = (X1 - X0) / 2 + 200;
  caja(-(MURO.puerta + mitad) / 2, MURO.z, (mitad - MURO.puerta) / 2, MURO.grueso / 2);
  caja((MURO.puerta + mitad) / 2, MURO.z, (mitad - MURO.puerta) / 2, MURO.grueso / 2);
  // el cierre de dentro: hileras de casas que no dejan pasar al resto de la ciudad
  caja(0, DENTRO.z0 - 2, 120, 2);
  // (los lados llegan hasta la cara de dentro del muro, no lo cruzan: fuera se anda pegado a el)
  const zf = -MURO.grueso / 2, zi = DENTRO.z0 - 4;
  caja(DENTRO.x0 - 2, (zi + zf) / 2, 2, (zf - zi) / 2);
  caja(DENTRO.x1 + 2, (zi + zf) / 2, 2, (zf - zi) / 2);
  // los arboles (solo el tronco) y las rocas grandes
  for (const o of RECOGIDA) {
    if (o.tipo === 'arbol') circulos.push({ x: o.x, z: o.z, r: 0.32 * o.tam, id: o.id });
    if (o.tipo === 'roca' && o.tam > 0.9) circulos.push({ x: o.x, z: o.z, r: 0.55 * o.tam, id: o.id });
  }
  return { circulos, cajas };
}
