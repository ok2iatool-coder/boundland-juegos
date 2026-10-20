// LAS PAREDES DE ROCA del escarpe de la meseta y de los cerros testigo. La rejilla del suelo (1,6 m) no puede dibujar
// una pared de 18 m que cabe en 3 m de ancho: salian tiras verticales estiradas. Aqui cada pared es una malla propia que
// sigue la linea del escarpe y la tapa por fuera: ESTRATOS horizontales de 0,9-1,6 m, cada uno de su color (ocre, gris,
// claro, rojizo), que se retranquean un poco al subir y dejan una REPISA con algo de verde; y fracturas verticales
// (cada columna de la pared sale o entra un poco). Para no meterse en el suelo, cada punto se pone donde el relieve
// tiene esa misma cota (buscada por biseccion) y un palmo por fuera.
import * as THREE from 'three';
import { forma, formaEditada, EXT, CERROS, MESETA, fbm, hash, suave, azar } from './relieve.js';

const ESTRATOS = [0x968f80, 0x9e8a6c, 0x847b6e, 0xaea592, 0x8f7a66, 0x9c9584, 0x8b8072].map((c) => new THREE.Color(c));
const REPISA = new THREE.Color(0x7c8a50), REPISA_SECA = new THREE.Color(0x9a9460);

// el punto del perfil (desde `p`, hacia fuera `n`) donde el relieve tiene la cota `y`: s de 0 (arriba) a sMax (abajo)
function hasta(p, n, y, sMax) {
  let a = -2, b = sMax;
  for (let k = 0; k < 14; k++) {
    const m = (a + b) / 2;
    if (formaEditada(p[0] + n[0] * m, p[1] + n[1] * m) > y) a = m; else b = m;
  }
  return (a + b) / 2;
}

// una pared a lo largo de `linea` ([{x, z, nx, nz}], n hacia el lado BAJO), entre la cota del pie y la de arriba
function pared(pos, col, linea, semilla, { cerrada = false, margen = 0.45 } = {}, cajas = null) {
  const r = azar(semilla), q = new THREE.Color();
  if (cajas) cajas.push([Math.min(...linea.map((L) => L.x)) - 16, Math.min(...linea.map((L) => L.z)) - 16, Math.max(...linea.map((L) => L.x)) + 16, Math.max(...linea.map((L) => L.z)) + 16]);
  // las cotas de los estratos (las mismas a lo largo de toda la pared: se leen de punta a punta)
  const columnas = linea.map((L, i) => {
    const p = [L.x, L.z], n = [L.nx, L.nz];
    // (con lo subido o bajado a mano en el editor: si se allana el escarpe, la pared se queda en nada)
    const cima = formaEditada(L.x - L.nx * 3.5, L.z - L.nz * 3.5), pie = formaEditada(L.x + L.nx * 5, L.z + L.nz * 5);
    return { p, n, cima, pie, sale: 0.25 * (fbm(i * 0.35 + semilla, 3.1, 2) - 0.5) + 0.12 * (hash(i, semilla, 4) - 0.5) };
  });
  const yMin = Math.min(...columnas.map((c) => c.pie)), yMax = Math.max(...columnas.map((c) => c.cima));
  const cotas = [];
  for (let y = yMin; y < yMax;) { const h = 0.9 + r() * 0.7; cotas.push({ y, h, color: ESTRATOS[Math.floor(r() * ESTRATOS.length)], entra: 0.08 + r() * 0.3 }); y += h; }
  // cada columna, por estrato: su punto de abajo y el de arriba (ya retranqueado), o nada si el estrato no le llega
  const filas = columnas.map((c) => cotas.map((e) => {
    const y0 = Math.max(c.pie, e.y), y1 = Math.min(c.cima, e.y + e.h);
    if (y1 - y0 < 0.05) return null;
    const punto = (y, extra) => { const s = hasta(c.p, c.n, y, 12) + margen + c.sale + extra; return { x: c.p[0] + c.n[0] * s, y, z: c.p[1] + c.n[1] * s }; };
    // cada estrato sale lo suyo (los duros salen, los blandos se meten): entre dos, un escalon
    return { b: punto(y0, e.entra), t: punto(y1, e.entra) };
  }));
  const quad = (a, b, cc, d, color) => {
    for (const [u, v, w] of [[a, b, cc], [a, cc, d]]) {
      pos.push(u.x, u.y, u.z, v.x, v.y, v.z, w.x, w.y, w.z);
      for (let k = 0; k < 3; k++) col.push(color.r, color.g, color.b);
    }
  };
  const n = linea.length;
  for (let i = 0; i < n - (cerrada ? 0 : 1); i++) {
    const A = filas[i], B = filas[(i + 1) % n];
    for (let k = 0; k < cotas.length; k++) {
      const a = A[k], b = B[k];
      if (!a || !b) continue;
      // la cara del estrato, de su pie a su cima
      q.copy(cotas[k].color).multiplyScalar(0.94 + 0.08 * fbm(i * 0.12 + k * 3.1, k * 0.7, 2));
      quad(a.b, b.b, b.t, a.t, q);
      // el escalon hasta el siguiente: si el de arriba se mete, una REPISA con algo de verde; si sale, su panza oscura
      const a2 = A[k + 1], b2 = B[k + 1];
      if (a2 && b2) {
        if (cotas[k + 1].entra < cotas[k].entra) q.copy(REPISA).lerp(REPISA_SECA, hash(i, k, 7)).multiplyScalar(0.92 + 0.12 * hash(i, k, 8));
        else q.copy(cotas[k + 1].color).multiplyScalar(0.62);
        quad(a.t, b.t, b2.b, a2.b, q);
      }
    }
  }
}

export function crearParedes(grupo, tono) {
  const cajas = [];
  const construir = () => {
  const pos = [], col = [];
  // ---------------- el escarpe de la meseta: el borde oeste (sin la rampa) y el sur ----------------
  {
    const m = {};
    // borde oeste: donde la meseta esta a medias (me = 0,5), de norte a sur
    const oeste = [];
    for (let z = -EXT + 1; z < 160; z += 1.4) {
      // buscar en x el punto de media altura entre lo de abajo y lo de arriba
      let a = 100, b = 215;
      forma(150, z, m);
      for (let k = 0; k < 18; k++) { const x = (a + b) / 2; forma(x, z, m); if (m.meseta < 0.5) a = x; else b = x; }
      const x = (a + b) / 2;
      forma(x, z, m);
      if (m.meseta < 0.3 || m.meseta > 0.7) { oeste.push(null); continue; }
      const rampa = Math.exp(-(((z - MESETA.rampaZ) / 18) ** 2));
      oeste.push(rampa > 0.25 ? null : { x, z, nx: -1, nz: 0 });
    }
    // trocear donde hay huecos (la rampa, el final del sur)
    let tramo = [];
    const cerrarTramo = (sem) => { if (tramo.length > 2) pared(pos, col, tramo, sem, {}, cajas); tramo = []; };
    oeste.forEach((p, i) => { if (p) tramo.push(p); else cerrarTramo(100 + i); });
    cerrarTramo(99);
    // borde sur: de oeste a este, donde la meseta acaba
    const sur = [];
    for (let x = 140; x < EXT - 1; x += 1.4) {
      let a = 100, b = 200;
      for (let k = 0; k < 18; k++) { const z = (a + b) / 2; forma(x, z, m); if (m.meseta > 0.5) a = z; else b = z; }
      const z = (a + b) / 2;
      forma(x, z, m);
      sur.push(m.meseta > 0.3 && m.meseta < 0.7 ? { x, z, nx: 0, nz: 1 } : null);
    }
    sur.forEach((p, i) => { if (p) tramo.push(p); else cerrarTramo(300 + i); });
    cerrarTramo(298);
  }
  // ---------------- los cerros testigo: un anillo por cerro, en el borde de la cima ----------------
  for (const [k, C] of CERROS.entries()) {
    const linea = [];
    const M = Math.max(48, Math.round((2 * Math.PI * C.r) / 1.3));
    for (let i = 0; i < M; i++) {
      const a = (i / M) * Math.PI * 2;
      const R = C.r * (1 + 0.16 * Math.sin(3 * a + C.f) + 0.09 * Math.sin(5 * a - C.f)) * 0.94;
      linea.push({ x: C.x + Math.cos(a) * R, z: C.z + Math.sin(a) * R, nx: Math.cos(a), nz: Math.sin(a) });
    }
    pared(pos, col, linea, 500 + k * 37, { cerrada: true, margen: 0.4 }, cajas);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
  };
  const m = new THREE.Mesh(construir(), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, flatShading: true, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  m.name = 'paredes';
  grupo.add(m);
  // el editor: si lo tocado cae cerca de alguna pared, se rehacen todas con las cotas nuevas
  function rehacer(x0, z0, x1, z1) {
    if (!cajas.some(([a, b, c, d]) => x1 >= a && x0 <= c && z1 >= b && z0 <= d)) return false;
    cajas.length = 0;
    m.geometry.dispose();
    m.geometry = construir();
    return true;
  }
  return { rehacer, info: () => ({ triangulosParedes: m.geometry.attributes.position.count / 3 }) };
}

// ---------------- la laguna seca: barro claro cuarteado en poligonos ----------------
// una lamina encima del fondo de la laguna con la textura de las grietas (la rejilla del suelo no las puede dibujar)
export function crearLaguna(grupo, tono, LAGUNA) {
  // (el lienzo, del MISMO lado que el dibujo: con 1024 y el dibujo en 2048 solo salia un cuarto de la laguna)
  const T = 2048, CEL = 22, NCEL = Math.ceil(T / CEL), sem = [];
  const c = document.createElement('canvas');
  c.width = c.height = T;
  const g = c.getContext('2d'), r = azar(41);
  // celdas de Voronoi (las placas de barro): una semilla por casilla de 22 px y cada pixel busca en las 3 x 3 de al lado
  for (let j = 0; j < NCEL; j++) for (let i = 0; i < NCEL; i++) sem.push([(i + r()) * CEL, (j + r()) * CEL, 0.93 + r() * 0.1]);
  const img = g.getImageData(0, 0, T, T), d = img.data;
  for (let y = 0; y < T; y++) {
    const cj = Math.floor(y / CEL);
    for (let x = 0; x < T; x++) {
      const ci = Math.floor(x / CEL);
      let a = 1e9, b = 1e9, ia = 0;
      for (let jj = cj - 1; jj <= cj + 1; jj++) for (let ii = ci - 1; ii <= ci + 1; ii++) {
        if (ii < 0 || jj < 0 || ii >= NCEL || jj >= NCEL) continue;
        const s = sem[jj * NCEL + ii], dx = x - s[0], dy = y - s[1], dd = dx * dx + dy * dy;
        if (dd < a) { b = a; a = dd; ia = jj * NCEL + ii; } else if (dd < b) b = dd;
      }
      const borde = Math.sqrt(b) - Math.sqrt(a);
      const i = (y * T + x) * 4, t = sem[ia][2];
      let R = 203 * t, G = 189 * t, B = 159 * t;
      if (borde < 2.2) { const k = 0.62 + 0.38 * (borde / 2.2); R *= k; G *= k; B *= k; }
      // el borde de la laguna: se funde con la orilla
      const ex = (x - T / 2) / (T / 2), ey = (y - T / 2) / (T / 2), e = Math.hypot(ex, ey);
      d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255 * (1 - suave(0.8, 1.0, e));
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(2 * LAGUNA.rx * 1.12, 2 * LAGUNA.rz * 1.12, 1, 1).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map: tex, gradientMap: tono, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  m.position.set(LAGUNA.x, LAGUNA.cota + 0.06, LAGUNA.z);
  m.rotation.y = -LAGUNA.giro;
  m.receiveShadow = true;
  m.renderOrder = 1;
  m.name = 'laguna_barro';
  grupo.add(m);
  return m;
}
