// DONDE VA CADA COSA del mapa de terreno (puro, sin three): las rocas (que son terreno: canchal al pie del escarpe y de
// los cerros, bloques en sus paredes, crestas de las lomas, cantos en la rambla) y lo que crece en cada sitio
// (`cubierta`: cuanta hierba, de que alto, flores y de que clase).
import { forma, altura, normalY, curvatura, fbm, suave, hash, azar, EXT, distRambla, CERROS, MESETA, BANCALES, pinturaEn, MATERIALES } from './relieve.js';

// ---------------- las rocas ----------------
// { x, z, r (radio de la huella), alto, y (la base), giro, tipo, cat, inclina }
export const N_TIPOS_ROCA = 10;
export const ROCAS = [];
{
  const r = azar(77);
  const celda = new Map(), C = 6, clave = (i, j) => i * 10007 + j;
  const libre = (x, z, rad) => {
    const ci = Math.floor(x / C), cj = Math.floor(z / C);
    for (let j = cj - 2; j <= cj + 2; j++) for (let i = ci - 2; i <= ci + 2; i++) {
      for (const o of celda.get(clave(i, j)) || []) if (Math.hypot(o.x - x, o.z - z) < (o.r + rad) * 0.72) return false;
    }
    return true;
  };
  const poner = (x, z, rad, alto, cat, enterrar = 0.3) => {
    if (Math.abs(x) > EXT - 3 || Math.abs(z) > EXT - 3 || !libre(x, z, rad)) return false;
    let hmin = altura(x, z);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.2832; hmin = Math.min(hmin, altura(x + Math.cos(a) * rad * 0.85, z + Math.sin(a) * rad * 0.85)); }
    const o = { x, z, r: rad, alto, y: hmin - alto * enterrar, bajo: alto * enterrar, giro: r() * 6.2832, tipo: Math.floor(r() * N_TIPOS_ROCA), cat, inclina: [(r() - 0.5) * 0.25, (r() - 0.5) * 0.25] };
    ROCAS.push(o);
    const k = clave(Math.floor(x / C), Math.floor(z / C));
    if (!celda.has(k)) celda.set(k, []);
    celda.get(k).push(o);
    return true;
  };
  const m = {};
  // el escarpe de la meseta: bloques en la pared y canchal al pie (no en la rampa, que se sube)
  for (let k = 0; k < 9000; k++) {
    const x = 120 + r() * 70, z = -290 + r() * 440;
    forma(x, z, m);
    if (m.escarpe > 0.25) continue;            // la cara la hace paredes.js (un bloque aqui asomaba como un pincho)
    // el pie: justo fuera de la pared, mas cuanto mas cerca
    const fuera = forma(x + 3, z, m) - forma(x, z, m);
    if (fuera > 3 && m.rampa < 0.2 && r() < 0.35) { const rad = 0.35 + Math.pow(r(), 1.8) * 1.5; poner(x, z, rad, rad * (0.55 + r() * 0.5), 'canchal', 0.3); }
  }
  // los cerros testigo: bloques en la pared, canchal en el derrubio
  for (const Ce of CERROS) {
    for (let k = 0; k < 900; k++) {
      const a = r() * 6.2832, d = Ce.r * (0.8 + r() * 1.1), x = Ce.x + Math.cos(a) * d, z = Ce.z + Math.sin(a) * d;
      forma(x, z, m);
      if (m.paredCerro > 0.5) continue;        // la pared la hace paredes.js
      else if (m.derrubio > 0.2 && r() < 0.3 * m.derrubio) { const rad = 0.3 + Math.pow(r(), 1.7) * 1.2; poner(x, z, rad, rad * (0.55 + r() * 0.5), 'canchal', 0.3); }
    }
  }
  // crestas de las lomas: grupos que asoman en lo alto
  for (let gz = -270; gz <= 270; gz += 9) for (let gx = -280; gx <= -110; gx += 9) {
    const x = gx + (r() - 0.5) * 7, z = gz + (r() - 0.5) * 7;
    forma(x, z, m);
    if (m.lomas < 0.6 || curvatura(x, z) > -0.04 || r() > 0.45) continue;
    const n = 2 + Math.floor(r() * 4);
    for (let q = 0; q < n; q++) { const rad = 0.45 + Math.pow(r(), 1.5) * 1.6; poner(x + (r() - 0.5) * 5, z + (r() - 0.5) * 5, rad, rad * (0.5 + r() * 0.7), 'cresta', 0.35); }
  }
  // la rambla: cantos rodados en el lecho y bloques en las orillas del barranco
  for (let k = 0; k < 7000; k++) {
    const x = -200 + r() * 290, z = -300 + r() * 600;
    const d = distRambla(x, z);
    if (d > 10) continue;
    forma(x, z, m);
    if (m.rambla > 0.6 && r() < 0.18) { const rad = 0.12 + Math.pow(r(), 2) * 0.45; poner(x, z, rad, rad * (0.5 + r() * 0.3), 'lecho', 0.35); }
    else if (m.orillaRambla > 0.5 && normalY(x, z) < 0.8 && r() < 0.25) { const rad = 0.5 + r() * 1.3; poner(x, z, rad, rad * (0.6 + r() * 0.4), 'orilla', 0.45); }
  }
  // los taludes de los bancales: alguna piedra que asoma y alguna caida al pie
  for (let k = 0; k < 6000; k++) {
    const x = -260 + r() * 400, z = -280 + r() * 280;
    forma(x, z, m);
    if (m.taludBancal > 0.6 && r() < 0.08) { const rad = 0.3 + r() * 0.8; poner(x, z, rad, rad * (0.5 + r() * 0.4), 'talud', 0.55); }
  }
  // cantos sueltos en las explanadas (pocos: tienen que leerse llanas) y losas en la meseta
  for (let k = 0; k < 400; k++) {
    const x = (r() * 2 - 1) * 270, z = (r() * 2 - 1) * 270;
    forma(x, z, m);
    if (m.escarpe > 0.05 || m.rambla > 0.05 || m.laguna > 0.05 || m.taludBancal > 0.1 || m.borde > 0.2) continue;
    const enMeseta = m.meseta > 0.95;
    const rad = enMeseta ? 0.6 + r() * 1.4 : 0.25 + Math.pow(r(), 2.2) * 0.9;
    if (poner(x, z, rad, rad * (enMeseta ? 0.25 + r() * 0.2 : 0.5 + r() * 0.5), enMeseta ? 'losa' : 'suelta', enMeseta ? 0.15 : 0.3) && r() < 0.3) {
      const a = r() * 6.28, s = rad * (0.3 + r() * 0.3);
      poner(x + Math.cos(a) * (rad + s) * 0.9, z + Math.sin(a) * (rad + s) * 0.9, s, s * 0.7, 'suelta');
    }
  }
}
ROCAS.forEach((o, i) => { o.id = i; });
// las de la lista de arriba son siempre las mismas (el editor las quita por su numero); las que pone el editor van detras
export const N_ROCAS_ORIG = ROCAS.length;

// distancia al borde de la roca mas cercana (rejilla de 0,5 m): la hierba no crece debajo y crece mas alta al lado
const DC = 0.5, NC = Math.round((2 * EXT) / DC) + 1;
const DR = new Float32Array(NC * NC).fill(9);
function marcar(o, i0 = 0, j0 = 0, i1 = NC - 1, j1 = NC - 1) {
  const R = o.r + 3;
  const a0 = Math.max(i0, Math.floor((o.x - R + EXT) / DC)), a1 = Math.min(i1, Math.ceil((o.x + R + EXT) / DC));
  const b0 = Math.max(j0, Math.floor((o.z - R + EXT) / DC)), b1 = Math.min(j1, Math.ceil((o.z + R + EXT) / DC));
  for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) {
    const d = Math.hypot(i * DC - EXT - o.x, j * DC - EXT - o.z) - o.r * 0.9;
    if (d < DR[j * NC + i]) DR[j * NC + i] = d;
  }
}
for (const o of ROCAS) marcar(o);
export function distRoca(x, z) {
  const gx = (x + EXT) / DC, gz = (z + EXT) / DC;
  if (gx < 0 || gz < 0 || gx > NC - 1.001 || gz > NC - 1.001) return 9;
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const a = DR[j * NC + i], b = DR[j * NC + i + 1], c = DR[(j + 1) * NC + i], d = DR[(j + 1) * NC + i + 1];
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}
// la distancia otra vez en un recuadro (tras poner o quitar rocas en el editor)
export function recalcularDistRoca(x0, z0, x1, z1) {
  const i0 = Math.max(0, Math.floor((x0 + EXT) / DC)), i1 = Math.min(NC - 1, Math.ceil((x1 + EXT) / DC));
  const j0 = Math.max(0, Math.floor((z0 + EXT) / DC)), j1 = Math.min(NC - 1, Math.ceil((z1 + EXT) / DC));
  for (let j = j0; j <= j1; j++) DR.fill(9, j * NC + i0, j * NC + i1 + 1);
  for (const o of ROCAS) {
    if (o.quitada || o.x + o.r + 3 < x0 || o.x - o.r - 3 > x1 || o.z + o.r + 3 < z0 || o.z - o.r - 3 > z1) continue;
    marcar(o, i0, j0, i1, j1);
  }
}
// los choques: las rocas que estorban al 18 (la lista es la que leen el 18 y su capa cada vez: se cambia en su sitio)
const estorba = (o) => o.r >= 0.33 && o.alto >= 0.28;
export const CHOQUES_ROCAS = [];
for (const o of ROCAS) if (estorba(o)) { o.choque = { x: o.x, z: o.z, r: o.r * 0.86 }; CHOQUES_ROCAS.push(o.choque); }

// ---------------- lo que hace el editor con las rocas ----------------
// la base de la roca otra vez sobre el suelo de ahora (enterrada lo mismo que al ponerla)
export function asentar(o) {
  let hmin = altura(o.x, o.z);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.2832; hmin = Math.min(hmin, altura(o.x + Math.cos(a) * o.r * 0.85, o.z + Math.sin(a) * o.r * 0.85)); }
  o.y = hmin - o.bajo;
  return o;
}
// quitar (o devolver) una roca: deja de estorbar y la hierba vuelve a crecer donde estaba
export function activarRoca(o, si) {
  if (!o.quitada === si) return;
  o.quitada = !si;
  if (o.choque) {
    const k = CHOQUES_ROCAS.indexOf(o.choque);
    if (!si && k >= 0) CHOQUES_ROCAS.splice(k, 1);
    if (si && k < 0) CHOQUES_ROCAS.push(o.choque);
  }
}
// una roca nueva: { x, z, r, alto, giro, tipo, inclina } (lo que no venga, al azar)
export function nuevaRoca(d) {
  const o = {
    x: d.x, z: d.z, r: d.r, alto: d.alto ?? d.r * (0.55 + Math.random() * 0.5), giro: d.giro ?? Math.random() * 6.2832,
    tipo: d.tipo ?? Math.floor(Math.random() * N_TIPOS_ROCA), cat: 'editor',
    inclina: d.inclina ?? [(Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25], id: ROCAS.length,
  };
  o.bajo = o.alto * 0.3;
  asentar(o);
  if (estorba(o)) { o.choque = { x: o.x, z: o.z, r: o.r * 0.86 }; CHOQUES_ROCAS.push(o.choque); }
  ROCAS.push(o);
  return o;
}

// ---------------- que crece en cada sitio ----------------
// calvas: manchas de tierra gastada (pocas)
export const calva = (x, z) => suave(0.78, 0.85, fbm(x / 7 + 100, z / 7 - 50, 2));
const _m = {}, _cub = { mata: 0, alto: 1, flor: 0, florTipo: 0, seco: 0 };
// mata: 0..1 densidad; alto: altura relativa; flor: 0..1; florTipo: 0..3; seco: 0..1 (pajizo)
export function cubierta(x, z, out = _cub, m = null) {
  if (!m) { m = _m; forma(x, z, m); }
  const ny = normalY(x, z), dr = distRoca(x, z);
  let mata = 1;
  if (dr < 0.05) mata = 0;
  mata *= 1 - suave(0.86, 0.7, ny);                         // en las cuestas fuertes, tierra
  mata *= 1 - 0.85 * calva(x, z) * (1 - m.baja);
  mata *= 1 - m.rambla;                                     // el lecho de grava
  mata *= 1 - m.laguna;                                     // el barro cuarteado
  mata *= 1 - 0.9 * Math.max(m.escarpe, m.paredCerro);
  mata *= 1 - 0.55 * m.derrubio;
  // lo seco: la meseta y los bancales altos, las crestas; lo jugoso: la llanura baja y el pie de la rambla
  const seco = Math.min(1, 0.7 * m.meseta + 0.18 * (m.bancal || 0) + 0.35 * m.lomas * suave(-0.02, -0.12, curvatura(x, z)) + 0.25 * suave(0.55, 0.72, fbm(x / 30 - 40, z / 30 + 8, 3)));
  mata *= 1 - 0.35 * m.meseta * suave(0.55, 0.7, fbm(x / 9 + 12, z / 9 - 5, 2));    // calvas de la meseta
  let alto = 0.75 + 0.5 * suave(0.3, 0.75, fbm(x / 13 + 5, z / 13 + 1, 3));
  alto *= 1 - 0.4 * suave(0.6, 0.72, fbm(x / 30 - 11, z / 30 + 40, 2));             // pradillos cortos
  alto *= 1 + 0.3 * suave(1.4, 0.1, dr) + 0.25 * m.baja;                              // mas alta junto a rocas y en lo bajo
  alto *= 1 - 0.35 * m.meseta - 0.2 * seco;
  out.mata = mata;
  out.alto = alto;
  out.seco = seco;
  out.flor = mata > 0.3 ? Math.max(0.02, suave(0.6, 0.74, fbm(x / 19 - 70, z / 19 + 30, 3))) * mata * (1 - 0.6 * seco) : 0;
  out.florTipo = Math.max(0, Math.min(3, Math.floor((fbm(x / 50 + 5, z / 50 + 9, 2) - 0.5) * 9 + 2)));
  // lo pintado a mano en el editor manda sobre todo lo anterior (menos las rocas, que siguen sin hierba debajo)
  const p = pinturaEn(x, z);
  if (p) {
    const M = MATERIALES[p];
    out.mata = dr < 0.05 ? 0 : M.mata;
    out.alto = (0.75 + 0.5 * suave(0.3, 0.75, fbm(x / 13 + 5, z / 13 + 1, 3))) * (M.alto || 1);
    out.seco = M.seco || 0;
    out.flor = M.flor ? 1 : (M.mata ? 0.03 : 0);
  }
  // debajo de un modelo solido (un muro, una casa) no crece nada
  if (HUELLAS.length && enHuella(x, z)) { out.mata = 0; out.flor = 0; }
  return out;
}

// las HUELLAS de los modelos solidos que pone el editor (modelos.js): { x, z, hx, hz, ang, r }, r = radio que la cubre
export const HUELLAS = [];
export function enHuella(x, z) {
  for (const h of HUELLAS) {
    const dx = x - h.x, dz = z - h.z;
    if (Math.abs(dx) > h.r || Math.abs(dz) > h.r) continue;
    const ca = Math.cos(h.ang), sa = Math.sin(h.ang);
    if (Math.abs(dx * ca + dz * sa) < h.hx && Math.abs(-dx * sa + dz * ca) < h.hz) return true;
  }
  return false;
}
export { BANCALES, MESETA };
