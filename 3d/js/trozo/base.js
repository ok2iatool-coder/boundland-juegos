// LA BASE por dentro y el campamento de fuera: los edificios donde pasa el juego y las chabolas y tiendas donde vive la
// gente. Todo low poly con tinta, en pocas mallas. Cada pieza pone su caja de choque.
//   dentro: Intendencia (con el tablon: un papel por encargo abierto), puesto de Tobias, herreria con fragua, banco de
//     trabajo y carpinteria, enfermeria de Amparo, barracon con literas, baul y el FRASCO (guardar), el pozo, la hoguera,
//     la OBRA del segundo pozo en cuatro fases (solar, material que se va amontonando, andamio, pozo terminado) y
//     chabolas y tiendas en las calles; alrededor, un cierre de casas de dos plantas
//   fuera: la garita de Ramiro, tiendas pegadas al muro, la tienda azul de Lia, las huertas (crecen cuando hay agua),
//     el fuego de fuera y un banco de trabajo
import * as THREE from 'three';
import { Lote, FORMAS, M, col, azar, rotulo, TONO, matToon } from './geo.js';
import { COSAS, PLAZA, DENTRO, NODOS, ARISTAS, bordeCamino, MURO, distLinea } from './mapa.js';
import { TORRES } from './muro.js';

const MADERA = col(0x8a6a48), MADERA_OSC = col(0x6a4f36), PIEDRA = col(0x9a9384), CHAPA = col(0x7d6e5c), OXIDO = col(0x7a5236);
const LONAS = [0xb9ab8c, 0xa59c7e, 0x8d9474, 0x7f8a86, 0xb4a17a, 0x9a8f86, 0xa8987a].map(col);
const CHAPAS = [0x7d6e5c, 0x6f6a62, 0x7a5236, 0x86796a, 0x5f6461, 0x8b6b4e].map(col);

export function crearBase(grupo, { altura, choques }) {
  const r = azar(55), info = {};
  const caja = (x, z, w, d, giro = 0) => choques.cajas.push({ x, z, hx: w / 2, hz: d / 2, ang: -giro });
  const circulo = (x, z, rad) => choques.circulos.push({ x, z, r: rad });
  const yS = (x, z) => altura(x, z);
  // lo que se pone en un marco local (x, z, giro): devuelve una funcion que pasa de local a mundo
  const marco = (x, z, g) => (lx, lz) => [x + lx * Math.cos(g) + lz * Math.sin(g), z - lx * Math.sin(g) + lz * Math.cos(g)];

  const edif = new Lote('edificios', 11), props = new Lote('props', 12), calles = new Lote('calles', 13), fuera = new Lote('campamento', 14), cierre = new Lote('cierre', 15);
  const extra = [];                                   // grupos sueltos (rotulos, animados)

  // ================= piezas =================
  function caseta(L, x, z, w, d, h, g, { pared = col(0x8f8170), tejado = CHAPA, puerta = true, ventanas = 1, rotuloTex = null } = {}) {
    const y = yS(x, z), m = marco(x, z, g);
    L.poner(FORMAS.cajaSuelo, M(x, y - 0.5, z, g, [w, h + 0.5, d]), pared, { varia: 0.05 });
    // tejado a un agua de chapa, que vuela
    L.poner(FORMAS.caja, M(...[x, y + h + 0.25, z].map((v, i) => v), [0.12, g, 0], [w + 0.6, 0.12, d + 0.7]), tejado);
    // puerta y ventanas en la cara de delante (+z local)
    if (puerta) { const [px, pz] = m(0, d / 2 + 0.02); L.poner(FORMAS.cajaSuelo, M(px, yS(px, pz), pz, g, [1.0, 2.05, 0.06]), col(0x3b3129), { tinta: 0.012 }); }
    for (let k = 0; k < ventanas; k++) {
      for (const s of [-1, 1]) {
        const lx = s * (1.2 + k * 1.6 + 0.2);
        if (Math.abs(lx) > w / 2 - 0.5) continue;
        const [vx, vz] = m(lx, d / 2 + 0.02);
        L.poner(FORMAS.caja, M(vx, y + 1.55, vz, g, [0.75, 0.6, 0.06]), col(0x2e2a26), { tinta: 0.012 });
      }
    }
    if (rotuloTex) {
      const [rx, rz] = m(0, d / 2 + 0.06);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 0.6, 3.6), 0.8), new THREE.MeshToonMaterial({ map: rotuloTex, gradientMap: TONO }));
      pl.position.set(rx, y + 2.45, rz); pl.rotation.y = g; pl.castShadow = true;
      extra.push(pl);
    }
    caja(x, z, w, d, g);
  }
  function chabola(L, x, z, g, w, d, h) {
    const y = yS(x, z) - 0.4, m = marco(x, z, g);
    // paredes de chapas de colores distintos
    const c1 = CHAPAS[Math.floor(r() * CHAPAS.length)], c2 = CHAPAS[Math.floor(r() * CHAPAS.length)];
    L.poner(FORMAS.cajaSuelo, M(x, y, z, g, [w, h + 0.4, d]), c1, { varia: 0.08 });
    const [ax, az] = m(-w / 4, d / 2 + 0.03);
    L.poner(FORMAS.cajaSuelo, M(ax, y + 0.4, az, g, [w / 2 - 0.1, h * 0.8, 0.05]), c2, { tinta: 0.01 });
    // tejado inclinado que vuela, con una piedra encima
    L.poner(FORMAS.caja, M(x, y + h + 0.5, z, [0.16 * (r() < 0.5 ? 1 : -1), g, 0], [w + 0.5, 0.08, d + 0.5]), CHAPAS[Math.floor(r() * CHAPAS.length)]);
    if (r() < 0.6) L.poner(FORMAS.bola, M(x + (r() - 0.5) * w * 0.6, y + h + 0.62, z + (r() - 0.5) * d * 0.5, r() * 3, 0.32), PIEDRA);
    const [px, pz] = m(w * 0.22, d / 2 + 0.04);
    L.poner(FORMAS.cajaSuelo, M(px, yS(px, pz), pz, g, [0.9, 1.9, 0.05]), r() < 0.5 ? col(0x3b3129) : LONAS[Math.floor(r() * LONAS.length)], { tinta: 0.01 });
    caja(x, z, w, d, g);
  }
  function tienda(L, x, z, g, { w = 2.6, d = 3.4, h = 1.9, color = null } = {}) {
    const y = yS(x, z) - 0.05, c = color || LONAS[Math.floor(r() * LONAS.length)], m = marco(x, z, g);
    L.poner(FORMAS.dosAguas, M(x, y, z, g + Math.PI / 2, [d, h, w]), c, { varia: 0.07 });
    // la entrada oscura y los vientos con sus estacas
    const [ex, ez] = m(0, d / 2 + 0.01);
    L.poner(FORMAS.dosAguas, M(ex, y, ez, g + Math.PI / 2, [0.04, h * 0.62, w * 0.42]), col(0x2c2621), { tinta: 0 });
    for (const [lx, lz] of [[-w / 2 - 0.6, d / 2 - 0.3], [w / 2 + 0.6, d / 2 - 0.3], [-w / 2 - 0.6, -d / 2 + 0.3], [w / 2 + 0.6, -d / 2 + 0.3]]) {
      const [sx, sz] = m(lx, lz);
      L.poner(FORMAS.cajaSuelo, M(sx, yS(sx, sz) - 0.05, sz, g, [0.06, 0.25, 0.06]), MADERA_OSC, { tinta: 0.005 });
    }
    caja(x, z, w + 0.4, d, g);
  }
  function barril(L, x, z, c = null) {
    const y = yS(x, z);
    L.poner(FORMAS.cil8, M(x, y, z, r() * 3, [0.6, 0.9, 0.6]), c || CHAPAS[Math.floor(r() * CHAPAS.length)]);
    L.poner(FORMAS.cil8, M(x, y + 0.2, z, 0, [0.63, 0.06, 0.63]), col(0x4a4038), { tinta: 0 });
    L.poner(FORMAS.cil8, M(x, y + 0.66, z, 0, [0.63, 0.06, 0.63]), col(0x4a4038), { tinta: 0 });
    circulo(x, z, 0.35);
  }
  function cajon(L, x, z, s = 0.6, g = r() * 3) {
    L.poner(FORMAS.cajaSuelo, M(x, yS(x, z), z, g, [s, s * 0.8, s]), MADERA.clone().lerp(MADERA_OSC, r()), { varia: 0.08 });
    circulo(x, z, s * 0.6);
  }
  function tendedero(L, x, z, g, largo = 4) {
    const m = marco(x, z, g);
    for (const s of [-1, 1]) { const [px, pz] = m(s * largo / 2, 0); L.poner(FORMAS.cajaSuelo, M(px, yS(px, pz) - 0.1, pz, g, [0.08, 1.9, 0.08]), MADERA_OSC, { tinta: 0.008 }); }
    const y = yS(x, z) + 1.75;
    L.poner(FORMAS.caja, M(x, y, z, g, [largo, 0.015, 0.015]), col(0x3a3530), { tinta: 0 });
    for (let k = 0; k < 4; k++) {
      const lx = -largo / 2 + 0.5 + k * (largo - 1) / 3 + (r() - 0.5) * 0.3, [px, pz] = m(lx, 0);
      L.poner(FORMAS.caja, M(px, y - 0.32, pz, g, [0.45 + r() * 0.3, 0.55 + r() * 0.2, 0.02]), LONAS[Math.floor(r() * LONAS.length)].clone().lerp(col(0xd8d0bd), 0.4), { tinta: 0.006 });
    }
  }
  function tronco(L, x, z, g, largo = 1.6, rad = 0.2) {
    L.poner(FORMAS.cil6, M(x, yS(x, z) + rad, z, [0, g, Math.PI / 2], [rad * 2, largo, rad * 2]).multiply(new THREE.Matrix4().makeTranslation(0, -0.5, 0)), MADERA_OSC);
  }
  function anilloPiedras(L, x, z, R, n, s = 0.3) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.2;
      L.poner(FORMAS.bola, M(x + Math.cos(a) * R, yS(x, z) + s * 0.25, z + Math.sin(a) * R, r() * 3, [s * (1 + r() * 0.4), s * 0.75, s * (1 + r() * 0.3)]), PIEDRA.clone().multiplyScalar(0.85 + r() * 0.25), { tinta: 0.01 });
    }
  }
  function pozo(L, x, z, nuevo = false) {
    const y = yS(x, z), c = nuevo ? col(0xa8a091) : PIEDRA;
    // brocal de piedras en dos hiladas
    for (let fila = 0; fila < 2; fila++) for (let k = 0; k < 12; k++) {
      const a = (k + fila * 0.5) / 12 * Math.PI * 2;
      L.poner(FORMAS.cajaSuelo, M(x + Math.cos(a) * 1.15, y + fila * 0.42 - 0.1, z + Math.sin(a) * 1.15, -a, [0.42, 0.44, 0.62]), c.clone().multiplyScalar(0.86 + r() * 0.22), { tinta: 0.012 });
    }
    L.poner(FORMAS.cil8, M(x, y + 0.5, z, 0, [2.0, 0.02, 2.0]), col(0x1f2526), { tinta: 0 });              // el agua, oscura, al fondo
    for (const s of [-1, 1]) L.poner(FORMAS.cajaSuelo, M(x + s * 1.35, y - 0.1, z, 0, [0.18, 2.5, 0.18]), MADERA_OSC);
    L.poner(FORMAS.dosAguas, M(x, y + 2.4, z, 0, [3.2, 0.8, 1.9]), nuevo ? col(0x8f6b4a) : col(0x6e5a48));
    L.poner(FORMAS.cil8, M(x - 1.3, y + 1.45, z, [0, 0, -Math.PI / 2], [0.22, 2.6, 0.22]).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0)), MADERA);    // el torno
    L.poner(FORMAS.caja, M(x + 1.45, y + 1.3, z, 0, [0.06, 0.4, 0.06]), MADERA_OSC, { tinta: 0.006 });               // la manivela
    L.poner(FORMAS.caja, M(x, y + 1.0, z, 0, [0.02, 0.9, 0.02]), col(0x6d5f4a), { tinta: 0 });                        // la cuerda
    L.poner(FORMAS.cil8, M(x, y + 0.45, z, 0, [0.34, 0.32, 0.34]), MADERA, { tinta: 0.008 });                         // el cubo
    circulo(x, z, 1.55);
  }

  // ================= la plaza =================
  pozo(edif, COSAS.pozo1.x, COSAS.pozo1.z);
  // la hoguera: piedras, lena cruzada y bancos de tronco alrededor
  {
    const { x, z } = COSAS.hogueraDentro;
    anilloPiedras(props, x, z, 0.85, 11);
    for (let k = 0; k < 4; k++) { const a = k * 0.8; props.poner(FORMAS.cil6, M(x, yS(x, z) + 0.12, z, [0.25, a, Math.PI / 2 - 0.35], [0.18, 1.2, 0.18]).multiply(new THREE.Matrix4().makeTranslation(0, -0.5, 0)), col(0x3a2c22)); }
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; tronco(props, x + Math.cos(a) * 3.3, z + Math.sin(a) * 3.3, -a + Math.PI / 2, 1.8, 0.2); }
    circulo(x, z, 1.1);
  }
  // bancos de la plaza y un par de faroles
  for (const [x, z, g] of [[-22, -48, 0.4], [20, -46, -0.5], [-24, -70, 1.2], [22, -74, -1.1]]) {
    const y = yS(x, z);
    props.poner(FORMAS.cajaSuelo, M(x, y + 0.42, z, g, [1.8, 0.08, 0.45]), MADERA);
    for (const s of [-1, 1]) props.poner(FORMAS.cajaSuelo, M(x + Math.cos(g) * s * 0.75, y, z - Math.sin(g) * s * 0.75, g, [0.1, 0.42, 0.42]), MADERA_OSC);
    caja(x, z, 1.8, 0.5, g);
  }
  // ================= el suelo de dentro: piedras, charcos, tablas tiradas, hierbajos =================
  // (sin esto la tierra pisada era una explanada lisa: lo que hace que parezca un sitio donde vive gente)
  const suelo = new Lote('suelo_detalle', 18);
  function detallarSuelo() {
    const fuera = (x, z) => choques.cajas.some((c) => Math.hypot(c.hx, c.hz) < 60 && Math.abs(x - c.x) < c.hx + 0.6 && Math.abs(z - c.z) < c.hz + 0.6)
      || choques.circulos.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 0.5);
    const enPlaza = (x, z) => Math.hypot((x - PLAZA.x) / PLAZA.rx, (z - PLAZA.z) / PLAZA.rz);
    const sitio = () => [DENTRO.x0 + r() * (DENTRO.x1 - DENTRO.x0), DENTRO.z0 + r() * (DENTRO.z1 - DENTRO.z0 + 2)];
    // charcos: manchas oscuras y brillantes en las rodadas de la calle de la puerta y en los bajos de la plaza
    for (let k = 0; k < 400 && suelo.cuerpo.length < 16; k++) {
      const [x, z] = k % 3 ? sitio() : [(r() - 0.5) * 9, -6 - r() * 26];
      if (fuera(x, z) || enPlaza(x, z) < 0.55) continue;
      suelo.poner(FORMAS.cil8, M(x, yS(x, z) + 0.015, z, r() * 3, [0.9 + r() * 1.6, 0.01, 0.6 + r() * 1.0]), col(0x76776c).lerp(col(0x8a8f86), r()), { tinta: 0, varia: 0.02 });
    }
    // piedras sueltas y cascotes
    for (let k = 0; k < 1500; k++) {
      const [x, z] = sitio();
      if (fuera(x, z) || r() > 0.35 + 0.65 * Math.min(1, enPlaza(x, z) - 0.4)) continue;
      const s = 0.05 + Math.pow(r(), 2.5) * 0.22;
      suelo.poner(FORMAS.bola, M(x, yS(x, z) + s * 0.15, z, [r() * 3, r() * 6, r() * 3], [s * (1.2 + r() * 0.6), s * 0.7, s]), PIEDRA.clone().multiplyScalar(0.75 + r() * 0.35), { tinta: s > 0.12 ? 0.008 : 0, varia: 0.05 });
    }
    // tablas, cajas rotas y sacos tirados junto a las chabolas
    for (let k = 0; k < 400; k++) {
      const [x, z] = sitio();
      if (fuera(x, z) || enPlaza(x, z) < 1.05) continue;
      if (r() < 0.5) suelo.poner(FORMAS.caja, M(x, yS(x, z) + 0.03, z, [0, r() * 6, (r() - 0.5) * 0.15], [1.2 + r() * 1.4, 0.04, 0.22]), MADERA.clone().lerp(MADERA_OSC, r()), { tinta: 0.006 });
      else suelo.poner(FORMAS.bola, M(x, yS(x, z) + 0.12, z, r() * 6, [0.55, 0.32, 0.4]), LONAS[Math.floor(r() * LONAS.length)].clone().multiplyScalar(0.85), { tinta: 0.008 });
    }
    // hierbajos al pie del muro, de las chabolas y en los rincones (el centro de la plaza esta pisado)
    for (let k = 0; k < 2600; k++) {
      const [x, z] = sitio();
      const pegado = z > -6 || choques.cajas.some((c) => Math.hypot(c.hx, c.hz) < 60 && Math.abs(x - c.x) < c.hx + 1.6 && Math.abs(z - c.z) < c.hz + 1.6);
      if (fuera(x, z) || (!pegado && r() > 0.12) || enPlaza(x, z) < 0.9) continue;
      const s = 0.18 + r() * 0.3;
      suelo.poner(FORMAS.cono4, M(x, yS(x, z) - 0.02, z, [(r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3], [s * 0.6, s, s * 0.6]), col(0x6b7440).lerp(col(0x8a8650), r()), { tinta: 0, varia: 0.08 });
    }
  }

  // ================= la Intendencia y el tablon =================
  {
    const I = COSAS.intendencia;
    caseta(edif, I.x, I.z, I.ancho, I.fondo, 3.4, 0, { pared: col(0x9a7d66), tejado: col(0x6a5c4c), ventanas: 2, rotuloTex: rotulo('INTENDENCIA', { ancho: 512, alto: 112 }) });
    // escalon, toldo sobre la puerta y una mesa con papeles fuera
    const y = yS(I.x, I.z);
    edif.poner(FORMAS.cajaSuelo, M(I.x, y - 0.3, I.z + I.fondo / 2 + 0.45, 0, [2.2, 0.42, 0.9]), PIEDRA);
    edif.poner(FORMAS.caja, M(I.x, y + 2.25, I.z + I.fondo / 2 + 0.75, [0.25, 0, 0], [2.6, 0.06, 1.5]), col(0x8d9474));
    edif.poner(FORMAS.cajaSuelo, M(I.x + 3.4, y + 0.75, I.z + I.fondo / 2 + 1.1, 0, [1.6, 0.06, 0.8]), MADERA);
    for (const [dx, dz] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) edif.poner(FORMAS.cajaSuelo, M(I.x + 3.4 + dx, y, I.z + I.fondo / 2 + 1.1 + dz, 0, [0.07, 0.75, 0.07]), MADERA_OSC, { tinta: 0.006 });
    edif.poner(FORMAS.caja, M(I.x + 3.2, y + 0.8, I.z + I.fondo / 2 + 1.05, 0.2, [0.4, 0.02, 0.3]), col(0xe0d8c3), { tinta: 0.004 });
    caja(I.x + 3.4, I.z + I.fondo / 2 + 1.1, 1.6, 0.8);
    // un mastil con una tela
    edif.poner(FORMAS.cajaSuelo, M(I.x - 5.4, y, I.z + I.fondo / 2 + 1.2, 0, [0.12, 7, 0.12]), MADERA_OSC);
    edif.poner(FORMAS.caja, M(I.x - 4.6, y + 6.3, I.z + I.fondo / 2 + 1.2, 0, [1.5, 0.9, 0.03]), col(0x8d9474), { tinta: 0.008 });
    circulo(I.x - 5.4, I.z + I.fondo / 2 + 1.2, 0.2);
  }
  // el tablon: los papeles los pone el juego (uno por encargo abierto)
  const tablon = new THREE.Group();
  tablon.name = 'tablon';
  {
    const { x, z } = COSAS.tablon, y = yS(x, z), g = 0.35;
    const L = new Lote('tablon', 16);
    L.poner(FORMAS.caja, M(x, y + 1.55, z, g, [2.2, 1.3, 0.08]), MADERA);
    L.poner(FORMAS.dosAguas, M(x, y + 2.2, z, g, [2.6, 0.35, 0.5]), col(0x6a5c4c));
    for (const s of [-1, 1]) L.poner(FORMAS.cajaSuelo, M(x + Math.cos(g) * s * 1.0, y - 0.1, z - Math.sin(g) * s * 1.0, g, [0.12, 2.3, 0.12]), MADERA_OSC);
    // papeles viejos rotos que siempre estan
    for (let k = 0; k < 3; k++) {
      const lx = -0.8 + r() * 1.6, ly = 1.05 + r() * 0.9;
      L.poner(FORMAS.caja, M(x + Math.cos(g) * lx + Math.sin(g) * 0.05, y + ly, z - Math.sin(g) * lx + Math.cos(g) * 0.05, [0, g, (r() - 0.5) * 0.4], [0.28, 0.22, 0.01]), col(0xb8ae98), { tinta: 0.003 });
    }
    tablon.add(L.hacer());
    tablon.userData.papeles = [];
    for (let k = 0; k < 4; k++) {
      const lx = -0.68 + k * 0.45, ly = 1.62 + (k % 2) * 0.12;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.46), new THREE.MeshToonMaterial({ color: 0xf0e8d2, gradientMap: TONO, side: THREE.DoubleSide }));
      p.position.set(x + Math.cos(g) * lx + Math.sin(g) * 0.06, y + ly, z - Math.sin(g) * lx + Math.cos(g) * 0.06);
      p.rotation.set(0, g, (r() - 0.5) * 0.15);
      p.visible = false;
      tablon.add(p);
      tablon.userData.papeles.push(p);
    }
    circulo(x, z, 0.5);
    caja(x, z, 2.3, 0.3, g);
  }
  grupo.add(tablon);

  // ================= el puesto de Tobias =================
  {
    const { x, z } = COSAS.puesto, y = yS(x, z);
    // mostrador (en x = -29,4), estantes detras (x = -33,6), toldo a rayas
    edif.poner(FORMAS.cajaSuelo, M(x, y - 0.2, z, 0, [0.7, 1.25, 4.6]), MADERA);
    edif.poner(FORMAS.cajaSuelo, M(x + 0.05, y + 1.05, z, 0, [0.85, 0.07, 4.8]), MADERA_OSC);
    edif.poner(FORMAS.cajaSuelo, M(x - 4.2, y - 0.2, z, 0, [0.6, 2.4, 4.6]), MADERA_OSC);
    for (const sz of [-2.3, 2.3]) for (const sx of [0.35, -4.4]) edif.poner(FORMAS.cajaSuelo, M(x + sx, y - 0.2, z + sz, 0, [0.12, 3.0, 0.12]), MADERA_OSC);
    for (let k = 0; k < 8; k++) edif.poner(FORMAS.caja, M(x - 2.0, y + 2.85 + 0.12, z - 2.45 + k * 0.7 + 0.35, [0, 0, -0.12], [5.6, 0.06, 0.7]), k % 2 ? col(0xc9b88f) : col(0x9a4f3a), { tinta: 0.01, varia: 0 });
    // mercancia: rollos de cuerda, piedras, troncos, tarros, sacos
    for (let k = 0; k < 6; k++) edif.poner(FORMAS.cil8, M(x, y + 1.12, z - 2 + k * 0.8, [Math.PI / 2, 0, 0], [0.32, 0.12, 0.32]), col(0x9c8a5c), { tinta: 0.006 });
    for (let k = 0; k < 10; k++) edif.poner(FORMAS.bola, M(x - 4.0 + r() * 0.3, y + 1.1 + Math.floor(k / 5) * 0.75, z - 1.9 + (k % 5) * 0.9, r() * 3, 0.25 + r() * 0.12), k % 3 ? PIEDRA : col(0xc2b893), { tinta: 0.006 });
    for (let k = 0; k < 3; k++) edif.poner(FORMAS.bola, M(x - 1.4, y + 0.3, z - 1.6 + k * 1.3, 0, [0.7, 0.6, 0.6]), col(0xb4a17a), { tinta: 0.01 });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.65), new THREE.MeshToonMaterial({ map: rotulo('TOBÍAS\ncompro y vendo', { ancho: 512, alto: 150, letra: 'bold 50px Bahnschrift, sans-serif' }), gradientMap: TONO }));
    pl.position.set(x + 0.42, y + 2.32, z); pl.rotation.y = Math.PI / 2; pl.castShadow = true;
    extra.push(pl);
    caja(x - 2.1, z, 4.3, 4.8);
  }

  // ================= la herreria, el banco de trabajo y la carpinteria =================
  {
    const Hh = COSAS.herreria, y = yS(Hh.x, Hh.z), x0 = Hh.x - Hh.ancho / 2, x1 = Hh.x + Hh.ancho / 2;
    // tres paredes (abierta al oeste, a la plaza) y tejado a un agua
    edif.poner(FORMAS.cajaSuelo, M(x1 - 0.15, y - 0.4, Hh.z, 0, [0.3, 3.6, Hh.fondo]), col(0x6f6a62));
    for (const s of [-1, 1]) edif.poner(FORMAS.cajaSuelo, M(Hh.x, y - 0.4, Hh.z + s * (Hh.fondo / 2 - 0.15), 0, [Hh.ancho, 3.2, 0.3]), col(0x76695a));
    edif.poner(FORMAS.caja, M(Hh.x - 0.3, y + 3.25, Hh.z, [0, 0, 0.18], [Hh.ancho + 1.6, 0.12, Hh.fondo + 0.6]), col(0x5f6461));
    caja(x1 - 0.15, Hh.z, 0.3, Hh.fondo); for (const s of [-1, 1]) caja(Hh.x, Hh.z + s * (Hh.fondo / 2 - 0.15), Hh.ancho, 0.3);
    // la fragua: base de ladrillo, brasas (emisivas aparte) y chimenea
    const F = COSAS.fragua;
    edif.poner(FORMAS.cajaSuelo, M(F.x, y, F.z, 0, [1.5, 0.95, 1.8]), col(0x8a5e48));
    edif.poner(FORMAS.cil6, M(F.x + 0.3, y + 0.95, F.z, 0, [0.6, 3.6, 0.6]), col(0x6e5546));
    edif.poner(FORMAS.cono4, M(F.x + 0.3, y + 0.95, F.z, 0, [1.4, 0.8, 1.6]), col(0x6e5546));
    caja(F.x, F.z, 1.5, 1.8);
    // el yunque sobre su tocon
    const Y = COSAS.yunque;
    edif.poner(FORMAS.cil8, M(Y.x, y, Y.z, 0, [0.6, 0.55, 0.6]), MADERA_OSC);
    edif.poner(FORMAS.cajaSuelo, M(Y.x, y + 0.55, Y.z, 0, [0.28, 0.2, 0.55]), col(0x3d3d3d));
    edif.poner(FORMAS.cajaSuelo, M(Y.x, y + 0.75, Y.z - 0.05, 0, [0.36, 0.14, 0.75]), col(0x464646));
    edif.poner(FORMAS.cono4, M(Y.x, y + 0.82, Y.z + 0.48, [Math.PI / 2, 0, 0], [0.22, 0.32, 0.12]), col(0x464646));
    circulo(Y.x, Y.z, 0.35);
    // herramientas colgadas en la pared del fondo, un barril de agua
    for (let k = 0; k < 5; k++) edif.poner(FORMAS.caja, M(x1 - 0.34, y + 1.4 + (k % 2) * 0.2, Hh.z - 2.6 + k * 0.5, 0, [0.04, 0.7, 0.08]), col(0x4b4b4b), { tinta: 0.004 });
    barril(edif, x0 + 1.2, Hh.z - 2.8, col(0x5f6461));
    // el banco de trabajo (con un tornillo y herramientas)
    const B = COSAS.banco, yb = yS(B.x, B.z);
    edif.poner(FORMAS.cajaSuelo, M(B.x, yb + 0.85, B.z, 0, [2.2, 0.12, 0.85]), MADERA);
    for (const [dx, dz] of [[-1, -0.35], [1, -0.35], [-1, 0.35], [1, 0.35]]) edif.poner(FORMAS.cajaSuelo, M(B.x + dx, yb, B.z + dz, 0, [0.1, 0.85, 0.1]), MADERA_OSC, { tinta: 0.006 });
    edif.poner(FORMAS.cajaSuelo, M(B.x + 0.85, yb + 0.97, B.z - 0.2, 0, [0.22, 0.2, 0.25]), col(0x4b4b4b), { tinta: 0.004 });
    edif.poner(FORMAS.caja, M(B.x - 0.3, yb + 0.99, B.z + 0.1, 0.5, [0.5, 0.03, 0.06]), col(0x4b4b4b), { tinta: 0.003 });
    edif.poner(FORMAS.cil6, M(B.x - 0.75, yb + 0.91, B.z - 0.15, [0, 0, Math.PI / 2], [0.12, 0.4, 0.12]), col(0x9c8a5c), { tinta: 0.003 });
    caja(B.x, B.z, 2.2, 0.85);
    // la carpinteria: caballete con una tabla y la sierra, troncos y tablones apilados
    const C = COSAS.carpinteria, yc = yS(C.x, C.z);
    for (const s of [-1, 1]) edif.poner(FORMAS.dosAguas, M(C.x + s * 0.8, yc, C.z, Math.PI / 2, [0.9, 0.85, 0.12]), MADERA_OSC, { tinta: 0.006 });
    edif.poner(FORMAS.cajaSuelo, M(C.x, yc + 0.85, C.z, 0, [2.4, 0.08, 0.38]), MADERA);
    edif.poner(FORMAS.caja, M(C.x + 0.2, yc + 1.05, C.z, [0, 0, 0.6], [0.7, 0.18, 0.02]), col(0x9aa0a0), { tinta: 0.004 });
    for (let k = 0; k < 4; k++) tronco(edif, C.x + 2.0, C.z - 0.8 + k * 0.45, Math.PI / 2, 1.6, 0.2);
    for (let k = 0; k < 6; k++) edif.poner(FORMAS.cajaSuelo, M(C.x - 2.2, yc + k * 0.06, C.z + 0.2, 0, [0.3, 0.05, 2.4]), MADERA.clone().multiplyScalar(1.05), { tinta: 0.004 });
    caja(C.x, C.z, 2.4, 0.9); caja(C.x + 2.0, C.z - 0.1, 1.6, 1.8); caja(C.x - 2.2, C.z + 0.2, 0.4, 2.4);
  }

  // ================= la enfermeria =================
  {
    const E = COSAS.enfermeria, y = yS(E.x, E.z);
    edif.poner(FORMAS.cil8, M(E.x, y - 0.2, E.z, 0, [E.r * 2, 2.2, E.r * 2]), col(0xd2c8b0));
    edif.poner(FORMAS.cono6, M(E.x, y + 2.0, E.z, 0.2, [E.r * 2.2, 1.9, E.r * 2.2]), col(0xc4b99c));
    // la entrada al este con el faldon recogido y una hoja verde pintada (la de las curanderas)
    edif.poner(FORMAS.cajaSuelo, M(E.x + E.r - 0.02, y, E.z, Math.PI / 2, [1.3, 1.9, 0.06]), col(0x2e2a26), { tinta: 0.01 });
    edif.poner(FORMAS.bola, M(E.x + E.r * 0.62, y + 2.95, E.z, [0, 0, 0.9], [0.55, 0.9, 0.12]), col(0x5f7d45), { tinta: 0.008 });
    // camastro fuera y una mesita con frascos
    edif.poner(FORMAS.cajaSuelo, M(E.x + 4.4, y + 0.35, E.z - 2.6, 0.3, [0.8, 0.12, 1.9]), col(0xd8d0bd));
    edif.poner(FORMAS.cajaSuelo, M(E.x + 4.4, y, E.z - 2.6, 0.3, [0.7, 0.35, 1.8]), MADERA_OSC);
    edif.poner(FORMAS.cajaSuelo, M(E.x + 3.2, y + 0.7, E.z + 2.6, 0, [0.9, 0.06, 0.6]), MADERA);
    edif.poner(FORMAS.cajaSuelo, M(E.x + 3.2, y, E.z + 2.6, 0, [0.8, 0.7, 0.5]), MADERA_OSC);
    for (let k = 0; k < 4; k++) edif.poner(FORMAS.cil6, M(E.x + 2.9 + k * 0.2, y + 0.76, E.z + 2.55 + (k % 2) * 0.12, 0, [0.09, 0.16, 0.09]), col(0x7c9a8a), { tinta: 0.003 });
    circulo(E.x, E.z, E.r);
    caja(E.x + 4.4, E.z - 2.6, 0.9, 2.0, 0.3); caja(E.x + 3.2, E.z + 2.6, 0.9, 0.6);
  }

  // ================= el barracon: literas, baul y el frasco =================
  {
    const B = COSAS.barracon, y = yS(B.x, B.z), x0 = B.x - B.ancho / 2, x1 = B.x + B.ancho / 2, zb = B.z - B.fondo / 2, zf = B.z + B.fondo / 2;
    edif.poner(FORMAS.cajaSuelo, M(B.x, y - 0.4, zb + 0.15, 0, [B.ancho, 3.4, 0.3]), col(0x76695a));
    for (const xx of [x0 + 0.15, x1 - 0.15]) edif.poner(FORMAS.cajaSuelo, M(xx, y - 0.4, B.z, 0, [0.3, 3.4, B.fondo]), col(0x7d6e5c));
    for (let k = 0; k <= 6; k++) edif.poner(FORMAS.cajaSuelo, M(x0 + k * B.ancho / 6, y - 0.2, zf - 0.1, 0, [0.16, 3.0, 0.16]), MADERA_OSC);
    edif.poner(FORMAS.caja, M(B.x, y + 3.05, B.z + 0.3, [-0.14, 0, 0], [B.ancho + 0.8, 0.12, B.fondo + 1.0]), CHAPA);
    edif.poner(FORMAS.cajaSuelo, M(B.x, y - 0.02, B.z, 0, [B.ancho - 0.4, 0.06, B.fondo - 0.4]), col(0x7a6650), { tinta: 0 });    // tarima
    caja(B.x, zb + 0.15, B.ancho, 0.3); caja(x0 + 0.15, B.z, 0.3, B.fondo); caja(x1 - 0.15, B.z, 0.3, B.fondo);
    // literas de dos pisos contra el fondo
    for (let k = 0; k < 4; k++) {
      const lx = x0 + 2.2 + k * 3.6, lz = zb + 1.0;
      for (const h of [0.45, 1.5]) {
        edif.poner(FORMAS.cajaSuelo, M(lx, y + h, lz, 0, [2.1, 0.1, 0.95]), MADERA);
        edif.poner(FORMAS.cajaSuelo, M(lx, y + h + 0.1, lz, 0, [1.95, 0.12, 0.85]), LONAS[k % LONAS.length], { tinta: 0.006 });
      }
      for (const sx of [-1, 1]) edif.poner(FORMAS.cajaSuelo, M(lx + sx * 1.0, y, lz + 0.42, 0, [0.08, 2.0, 0.08]), MADERA_OSC, { tinta: 0.005 });
      caja(lx, lz, 2.1, 1.0);
    }
    // el baul
    const U = COSAS.baul, yu = yS(U.x, U.z);
    edif.poner(FORMAS.cajaSuelo, M(U.x, yu, U.z, 0, [1.1, 0.55, 0.6]), col(0x7a5a3a));
    edif.poner(FORMAS.cajaSuelo, M(U.x, yu + 0.55, U.z, 0, [1.12, 0.12, 0.62]), col(0x6a4b30));
    edif.poner(FORMAS.caja, M(U.x, yu + 0.4, U.z + 0.31, 0, [0.12, 0.14, 0.03]), col(0xb59a3a), { tinta: 0.003 });
    caja(U.x, U.z, 1.1, 0.6);
  }
  // el frasco: un tarro de cristal grande con tapon de corcho (donde se guarda; brilla un poco)
  const frasco = new THREE.Group();
  frasco.name = 'frasco';
  {
    const F = COSAS.frasco, y = yS(F.x, F.z);
    const L = new Lote('frasco_base', 17);
    L.poner(FORMAS.cil8, M(F.x, y, F.z, 0, [1.1, 0.12, 1.1]), MADERA_OSC);
    L.poner(FORMAS.cil8, M(F.x, y + 1.58, F.z, 0, [0.62, 0.22, 0.62]), col(0xa0784e));
    frasco.add(L.hacer());
    const vidrio = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 1.45, 10).translate(0, 0.84, 0),
      new THREE.MeshToonMaterial({ color: 0xcfe3dc, gradientMap: TONO, transparent: true, opacity: 0.38, depthWrite: false }));
    vidrio.position.set(F.x, y, F.z);
    const brillo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c4 }));
    brillo.position.set(F.x, y + 0.6, F.z);
    frasco.add(vidrio, brillo);
    frasco.userData.brillo = brillo;
    circulo(F.x, F.z, 0.55);
  }
  grupo.add(frasco);

  // ================= la obra del segundo pozo, por fases =================
  const obra = crearObra(grupo, { altura, r, circulo });

  // ================= chabolas y tiendas de dentro =================
  {
    // donde no se puede poner nada: la plaza, la calle de la puerta, los edificios, los tramos que andan los personajes
    // (contra lo que habia antes de las manzanas: los refugios no se miran entre si, cada uno tiene su casilla)
    const fijasC = choques.cajas.slice(), fijosO = choques.circulos.slice();
    const ocupado = (x, z, rad) => {
      if (Math.hypot((x - PLAZA.x) / (PLAZA.rx + rad + 3), (z - PLAZA.z) / (PLAZA.rz + rad + 3)) < 1) return true;
      if (Math.abs(x) < 10 + rad && z > -36) return true;
      for (const t of TORRES) if (Math.hypot(x - t.x, z - t.z) < 4 + rad) return true;
      for (const c of fijasC) { if (Math.hypot(c.hx, c.hz) > 60) continue; if (Math.abs(x - c.x) < c.hx + rad + 2 && Math.abs(z - c.z) < c.hz + rad + 2) return true; }
      for (const c of fijosO) if (Math.hypot(x - c.x, z - c.z) < c.r + rad + 1.5) return true;
      for (const [a, b] of ARISTAS) {
        const p = NODOS[a], q = NODOS[b];
        if (distLinea([p, q], x, z) < rad + 2.2) return true;
      }
      return false;
    };
    // MANZANAS: una casilla de 7 m por refugio (el refugio ocupa 3-4,6 m: quedan callejones de 2,4 m o mas, y la camara
    // cabe detras del 18; con 6 m se subia encima a cada paso), de cara a
    // la calle (los de la fila norte de cada par miran al norte y los de la sur al sur: calles cada dos filas)
    const CASILLA = 7;
    let n = 0;
    for (let z0 = DENTRO.z0 + 1; z0 + CASILLA <= DENTRO.z1 - 1; z0 += CASILLA) {
      for (let x0 = DENTRO.x0 + 1; x0 + CASILLA <= DENTRO.x1 - 1; x0 += CASILLA) {
        if (r() < 0.08) continue;                                  // algun hueco: un patio, un corral vacio
        const fila = Math.round((z0 - DENTRO.z0) / CASILLA), mira = fila % 2 ? 0 : Math.PI;
        const esChabola = r() < 0.58, w = esChabola ? 3.0 + r() * 1.6 : 2.6 + r() * 0.5, d = esChabola ? 2.8 + r() * 1.6 : 3.2 + r() * 0.6;
        const x = x0 + CASILLA / 2 + (r() - 0.5) * (CASILLA - w - 1.4), z = z0 + CASILLA / 2 + (r() - 0.5) * (CASILLA - d - 1.4);
        const rad = Math.hypot(w, d) / 2;
        if (ocupado(x, z, rad - 1.3)) continue;
        const g = mira + (r() - 0.5) * 0.12;
        if (esChabola) chabola(calles, x, z, g, w, d, 1.9 + r() * 0.7); else tienda(calles, x, z, g, { w, d });
        // trastos delante (en la calle): barriles, cajas, una cuerda de ropa
        const m = marco(x, z, g);
        if (r() < 0.4) { const [bx, bz] = m(w / 2 - 0.3, d / 2 + 0.55); if (!ocupado(bx, bz, -1)) barril(calles, bx, bz); }
        if (r() < 0.3) { const [cx, cz] = m(-w / 2 + 0.3, d / 2 + 0.5); if (!ocupado(cx, cz, -1)) cajon(calles, cx, cz); }
        if (r() < 0.1) { const [tx, tz] = m(0, d / 2 + 1.1); if (!ocupado(tx, tz, 0)) tendedero(calles, tx, tz, g, 2.8); }
        n++;
      }
    }
    info.refugios = n;
  }

  // ================= el cierre: casas de dos plantas que tapan el resto de la ciudad =================
  {
    const fila = (x0, z0, x1, z1, mira) => {
      const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
      for (let s = 0; s < L;) {
        const w = 5 + r() * 6, h = 4.5 + r() * 4, d = 6 + r() * 2;
        const cx = x0 + ux * (s + w / 2), cz = z0 + uz * (s + w / 2), g = mira;
        const y = yS(cx, cz) - 0.5, tono = col(0x8f8170).lerp(col(0x7d756b), r()).multiplyScalar(0.9 + r() * 0.15);
        cierre.poner(FORMAS.cajaSuelo, M(cx, y, cz, g, [w, h, d]), tono, { varia: 0.05 });
        cierre.poner(FORMAS.dosAguas, M(cx, y + h, cz, g, [w + 0.3, 1.2 + r(), d + 0.3]), CHAPAS[Math.floor(r() * CHAPAS.length)]);
        // ventanas en las dos plantas de la fachada que mira a la Base
        const m = marco(cx, cz, g);
        for (const yy of [1.3, 4.0]) for (const lx of [-w / 4, w / 4]) {
          if (yy > h - 1) continue;
          const [vx, vz] = m(lx, d / 2 + 0.02);
          cierre.poner(FORMAS.caja, M(vx, y + yy + 0.5, vz, g, [0.8, 0.9, 0.05]), col(0x2b2723), { tinta: 0.01 });
        }
        s += w + 0.1;
      }
    };
    fila(DENTRO.x0 - 6, DENTRO.z0 - 4, DENTRO.x1 + 6, DENTRO.z0 - 4, 0);
    fila(DENTRO.x0 - 4, DENTRO.z0 - 2, DENTRO.x0 - 4, -2, Math.PI / 2);
    fila(DENTRO.x1 + 4, -2, DENTRO.x1 + 4, DENTRO.z0 - 2, -Math.PI / 2);
  }

  detallarSuelo();

  // ================= fuera: la garita de Ramiro =================
  {
    const G = COSAS.garita, y = yS(G.x, G.z);
    fuera.poner(FORMAS.cajaSuelo, M(G.x, y - 0.3, G.z, 0, [1.8, 2.7, 1.8]), col(0x6d7058));
    fuera.poner(FORMAS.caja, M(G.x - 0.9, y + 1.5, G.z, 0, [0.06, 0.6, 1.2]), col(0x2b2723), { tinta: 0.006 });
    fuera.poner(FORMAS.cono4, M(G.x, y + 2.4, G.z, 0, [2.6, 0.9, 2.6]), col(0x5a5148));
    fuera.poner(FORMAS.cajaSuelo, M(G.x - 1.6, y + 0.0, G.z + 1.4, 0, [0.6, 0.75, 0.6]), MADERA, { tinta: 0.008 });
    caja(G.x, G.z, 1.8, 1.8);
    // sacos terreros a los lados del paso
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++) {
      const x = s * (6.6 + (k % 3) * 0.75), z = 3.2 + Math.floor(k / 3) * 0.02, yy = yS(x, z) + Math.floor(k / 3) * 0.32;
      fuera.poner(FORMAS.bola, M(x, yy + 0.15, z, 0, [0.75, 0.34, 0.5]), col(0xa99877), { tinta: 0.006 });
    }
    caja(-7.4, 3.2, 2.4, 0.6); caja(7.4, 3.2, 2.4, 0.6);
  }
  // ================= tiendas pegadas al muro =================
  {
    let n = 0;
    for (let k = 0; k < 600 && n < 34; k++) {
      const s = r() < 0.5 ? -1 : 1, x = s * (12 + r() * 78), z = 5 + r() * 14;
      if (bordeCamino(x, z) < 3) continue;
      if (Math.hypot(x - COSAS.fuegoFuera.x, z - COSAS.fuegoFuera.z) < 6 || Math.hypot(x - COSAS.tiendaLia.x, z - COSAS.tiendaLia.z) < 6) continue;
      if (choques.cajas.some((c) => Math.hypot(c.hx, c.hz) < 60 && Math.abs(x - c.x) < c.hx + 2.4 && Math.abs(z - c.z) < c.hz + 2.4)) continue;
      if (choques.circulos.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 2.6)) continue;
      const g = (r() - 0.5) * 0.3 + (z < 10 ? 0 : (r() < 0.5 ? Math.PI / 2 : -Math.PI / 2));
      if (r() < 0.75) tienda(fuera, x, z, g); else chabola(fuera, x, z, g, 2.4 + r(), 2.2 + r(), 1.8);
      if (r() < 0.35) barril(fuera, x + 2.0, z + (r() - 0.5));
      if (r() < 0.15) tendedero(fuera, x + (r() - 0.5) * 2, z + 3, (r() - 0.5) * 0.5, 3);
      n++;
    }
  }
  // ================= la tienda azul de Lia y su madre =================
  {
    const T = COSAS.tiendaLia;
    tienda(fuera, T.x, T.z, 0.15, { w: 3.0, d: 3.6, h: 2.1, color: col(0x4f6d8f) });
    tendedero(fuera, T.x + 3.4, T.z + 0.5, Math.PI / 2 + 0.2, 3);
    // una muneca de trapo junto a la entrada
    const y = yS(T.x + 0.9, T.z + 2.4);
    fuera.poner(FORMAS.bola, M(T.x + 0.9, y + 0.1, T.z + 2.4, 0, [0.14, 0.2, 0.12]), col(0xc98f6b), { tinta: 0.004 });
    fuera.poner(FORMAS.bola, M(T.x + 0.9, y + 0.26, T.z + 2.4, 0, 0.1), col(0xe0c9a6), { tinta: 0.004 });
  }
  // ================= el fuego de fuera y el banco de trabajo de fuera =================
  {
    const { x, z } = COSAS.fuegoFuera;
    anilloPiedras(fuera, x, z, 0.75, 9);
    for (let k = 0; k < 3; k++) fuera.poner(FORMAS.cil6, M(x, yS(x, z) + 0.1, z, [0.3, k * 1.1, Math.PI / 2 - 0.4], [0.15, 1.0, 0.15]).multiply(new THREE.Matrix4().makeTranslation(0, -0.5, 0)), col(0x3a2c22));
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.3; tronco(fuera, x + Math.cos(a) * 2.6, z + Math.sin(a) * 2.6, -a + Math.PI / 2, 1.4, 0.18); }
    circulo(x, z, 1.0);
    const B = COSAS.bancoFuera, y = yS(B.x, B.z);
    fuera.poner(FORMAS.cajaSuelo, M(B.x, y + 0.85, B.z, 0, [2.2, 0.12, 0.85]), MADERA);
    for (const [dx, dz] of [[-1, -0.35], [1, -0.35], [-1, 0.35], [1, 0.35]]) fuera.poner(FORMAS.cajaSuelo, M(B.x + dx, y, B.z + dz, 0, [0.1, 0.85, 0.1]), MADERA_OSC, { tinta: 0.006 });
    // tejadillo de lona sobre cuatro palos
    for (const [dx, dz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) fuera.poner(FORMAS.cajaSuelo, M(B.x + dx, y, B.z + dz, 0, [0.1, 2.3, 0.1]), MADERA_OSC, { tinta: 0.006 });
    fuera.poner(FORMAS.caja, M(B.x, y + 2.35, B.z, [0.1, 0, 0], [3.6, 0.05, 2.9]), col(0xa59c7e));
    caja(B.x, B.z, 2.2, 0.85);
    for (const [dx, dz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) circulo(B.x + dx, B.z + dz, 0.12);
  }
  // ================= las huertas (las plantas crecen con el agua) =================
  const huertas = crearHuertas(grupo, fuera, { altura, r, caja, circulo });

  // ================= juntar =================
  for (const L of [edif, props, calles, fuera, cierre, suelo]) grupo.add(L.hacer());
  for (const e of extra) grupo.add(e);

  // ================= lo que cambia =================
  function papeles(n) { tablon.userData.papeles.forEach((p, i) => { p.visible = i < n; }); }
  function actualizar(t) {
    frasco.userData.brillo.scale.setScalar(0.85 + 0.25 * Math.sin(t * 2.1));
    obra.actualizar(t);
  }
  return { papeles, obra, huertas, frasco, actualizar, info };
}

// ---------------- la obra del segundo pozo ----------------
// fase 0: solar con estacas, cuerda y el cartel; el material que se aporta se va AMONTONANDO a la vista (piedras,
// tablones, cuerdas); fase 1 (en obra): hoyo con tierra sacada, tripode con polea y trabajadores (los pone gente.js);
// fase 2: el pozo terminado, con banderines
function crearObra(grupo, { altura, r, circulo }) {
  const { x, z } = COSAS.obra, y = altura(x, z);
  const raiz = new THREE.Group();
  raiz.name = 'obra';
  grupo.add(raiz);
  // el solar
  const solar = new Lote('obra_solar', 21);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, px = x + Math.cos(a) * 2.6, pz = z + Math.sin(a) * 2.6;
    solar.poner(FORMAS.cajaSuelo, M(px, altura(px, pz) - 0.1, pz, a, [0.08, 0.9, 0.08]), MADERA_OSC, { tinta: 0.006 });
    const b = a + Math.PI / 2, qx = x + Math.cos(b) * 2.6, qz = z + Math.sin(b) * 2.6;
    const mx = (px + qx) / 2, mz = (pz + qz) / 2, L = Math.hypot(qx - px, qz - pz);
    solar.poner(FORMAS.caja, M(mx, y + 0.65, mz, -Math.atan2(qz - pz, qx - px), [L, 0.015, 0.015]), col(0xb59a3a), { tinta: 0 });
  }
  solar.poner(FORMAS.cil8, M(x, y - 0.04, z, 0, [2.2, 0.06, 2.2]), col(0x7a6650), { tinta: 0 });           // el circulo marcado
  const gSolar = solar.hacer();
  // el cartel: tabla con el dibujo de un pozo
  {
    const C = COSAS.cartelObra, yc = altura(C.x, C.z), g = Math.atan2(-C.x + 0, 20) * 0 - 0.6;
    const L = new Lote('obra_cartel', 22);
    for (const s of [-1, 1]) L.poner(FORMAS.cajaSuelo, M(C.x + Math.cos(g) * s * 0.65, yc - 0.1, C.z - Math.sin(g) * s * 0.65, g, [0.1, 1.9, 0.1]), MADERA_OSC);
    raiz.add(L.hacer());
    const c = document.createElement('canvas'); c.width = 512; c.height = 320;
    const gg = c.getContext('2d');
    gg.fillStyle = '#d8cfb4'; gg.fillRect(0, 0, 512, 320);
    gg.strokeStyle = '#2a2118'; gg.lineWidth = 9; gg.strokeRect(5, 5, 502, 310);
    gg.fillStyle = '#2a2118'; gg.font = 'bold 54px Bahnschrift, sans-serif'; gg.textAlign = 'center';
    gg.fillText('SEGUNDO POZO', 256, 70);
    gg.lineWidth = 7;
    gg.beginPath(); gg.moveTo(170, 270); gg.lineTo(170, 190); gg.lineTo(342, 190); gg.lineTo(342, 270); gg.stroke();       // brocal
    gg.beginPath(); gg.moveTo(190, 190); gg.lineTo(190, 110); gg.moveTo(322, 190); gg.lineTo(322, 110); gg.moveTo(160, 120); gg.lineTo(256, 92); gg.lineTo(352, 120); gg.stroke();
    gg.beginPath(); gg.moveTo(256, 120); gg.lineTo(256, 168); gg.stroke();
    gg.strokeRect(240, 168, 32, 22);
    gg.font = '30px Bahnschrift, sans-serif'; gg.fillText('se aporta aquí', 256, 300);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const pl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.06), new THREE.MeshToonMaterial({ map: tex, gradientMap: TONO }));
    pl.position.set(C.x, yc + 1.45, C.z); pl.rotation.y = g; pl.castShadow = true;
    raiz.add(pl);
    circulo(C.x, C.z, 0.5);
  }
  // los montones: piedras (30), tablones (12), cuerdas (4), en instancias que se muestran segun lo aportado
  const montones = new THREE.Group();
  const instan = (geo, n, colocar, color) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ color, gradientMap: TONO, flatShading: true }), n);
    for (let i = 0; i < n; i++) im.setMatrixAt(i, colocar(i));
    im.count = 0; im.castShadow = im.receiveShadow = true;
    montones.add(im);
    return im;
  };
  const px = x - 3.6, pz = z + 1.6;
  const piedras = instan(new THREE.IcosahedronGeometry(0.22, 0), 30, (i) => {
    const capa = i < 14 ? 0 : i < 24 ? 1 : 2, k = i - [0, 14, 24][capa], n = [14, 10, 6][capa], R = [0.75, 0.5, 0.25][capa];
    const a = (k / n) * Math.PI * 2;
    return M(px + Math.cos(a) * R, altura(px, pz) + 0.15 + capa * 0.25, pz + Math.sin(a) * R, [r(), r() * 3, r()], [1, 0.8, 1.1]);
  }, 0x9a9384);
  const tablones = instan(new THREE.BoxGeometry(2.4, 0.08, 0.28), 12, (i) => M(x + 3.8, altura(x + 3.8, z + 1.2) + 0.06 + Math.floor(i / 3) * 0.09, z + 1.2 + (i % 3) * 0.3 - 0.3, Math.PI / 2 + (r() - 0.5) * 0.05), 0x8a6a48);
  const cuerdas = instan(new THREE.TorusGeometry(0.22, 0.07, 4, 8).rotateX(Math.PI / 2), 4, (i) => M(x + 2.4, altura(x + 2.4, z - 2.6) + 0.07 + i * 0.13, z - 2.6, r()), 0x9c8a5c);
  raiz.add(montones);
  // el hoyo, la tierra sacada y el tripode (en obra)
  const enObra = new Lote('obra_andamio', 23);
  enObra.poner(FORMAS.cil8, M(x, y - 0.02, z, 0, [2.1, 0.05, 2.1]), col(0x2a2420), { tinta: 0 });
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1, bx = x + Math.cos(a) * 1.6, bz = z + Math.sin(a) * 1.6;
    const v = new THREE.Vector3(x - bx, 3.4, z - bz), l = v.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    enObra.poner(FORMAS.cil6, new THREE.Matrix4().compose(new THREE.Vector3(bx, y, bz), q, new THREE.Vector3(0.14, l, 0.14)), MADERA);
  }
  enObra.poner(FORMAS.cil8, M(x, y + 3.2, z, [Math.PI / 2, 0, 0], [0.3, 0.12, 0.3]), MADERA_OSC);
  enObra.poner(FORMAS.caja, M(x, y + 1.8, z, 0, [0.02, 2.8, 0.02]), col(0x6d5f4a), { tinta: 0 });
  for (const [dx, dz, s] of [[2.6, 1.2, 1.0], [2.1, -1.8, 0.8], [-2.2, -1.6, 0.9]]) enObra.poner(FORMAS.bola, M(x + dx, y - 0.1, z + dz, r(), [1.6 * s, 0.7 * s, 1.3 * s]), col(0x7a6248), { tinta: 0.012 });
  const gObra = enObra.hacer();
  // el pozo terminado
  const hecho = new Lote('obra_pozo', 24);
  {
    const c = col(0xa8a091);
    for (let fila = 0; fila < 2; fila++) for (let k = 0; k < 12; k++) {
      const a = (k + fila * 0.5) / 12 * Math.PI * 2;
      hecho.poner(FORMAS.cajaSuelo, M(x + Math.cos(a) * 1.15, y + fila * 0.42 - 0.1, z + Math.sin(a) * 1.15, -a, [0.42, 0.44, 0.62]), c.clone().multiplyScalar(0.9 + r() * 0.18), { tinta: 0.012 });
    }
    hecho.poner(FORMAS.cil8, M(x, y + 0.5, z, 0, [2.0, 0.02, 2.0]), col(0x24343a), { tinta: 0 });
    for (const s of [-1, 1]) hecho.poner(FORMAS.cajaSuelo, M(x + s * 1.35, y - 0.1, z, 0, [0.18, 2.5, 0.18]), MADERA);
    hecho.poner(FORMAS.dosAguas, M(x, y + 2.4, z, 0, [3.2, 0.8, 1.9]), col(0x8f6b4a));
    hecho.poner(FORMAS.cil8, M(x - 1.3, y + 1.45, z, [0, 0, -Math.PI / 2], [0.22, 2.6, 0.22]), MADERA);
    hecho.poner(FORMAS.caja, M(x + 1.45, y + 1.3, z, 0, [0.06, 0.4, 0.06]), MADERA_OSC, { tinta: 0.006 });
    hecho.poner(FORMAS.cil8, M(x + 0.7, y + 0.42, z + 0.9, 0, [0.34, 0.32, 0.34]), MADERA, { tinta: 0.008 });
    // banderines de fiesta del pozo al mastil del tablon de la plaza
    const cols = [col(0xb59a3a), col(0x8d9474), col(0xa05a3c), col(0xd8d0bd), col(0x4f6d8f)];
    for (const [ax, az] of [[x + 1.35, z], [x - 1.35, z]]) {
      const bx = ax + (ax > x ? 9 : -9), bz = z - 6;
      hecho.poner(FORMAS.cajaSuelo, M(bx, altura(bx, bz) - 0.2, bz, 0, [0.14, 4.6, 0.14]), MADERA_OSC);
      const punto = (t) => new THREE.Vector3(ax + (bx - ax) * t, y + 2.5 + (4.3 - 2.5) * t - Math.sin(t * Math.PI) * 0.8, az + (bz - az) * t);
      for (let k = 1; k < 14; k++) {
        const p = punto(k / 14);
        hecho.poner(FORMAS.cono4, M(p.x, p.y - 0.2, p.z, [Math.PI, -Math.atan2(bz - az, bx - ax), 0], [0.26, 0.4, 0.04]), cols[k % cols.length], { tinta: 0.004, varia: 0 });
      }
      // la cuerda de la que cuelgan
      for (let k = 0; k < 14; k++) {
        const a = punto(k / 14), b = punto((k + 1) / 14), d = b.clone().sub(a), l = d.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
        hecho.poner(FORMAS.caja, new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(l, 0.015, 0.015)), col(0x3a3530), { tinta: 0 });
      }
    }
  }
  const gHecho = hecho.hacer();
  raiz.add(gSolar, gObra, gHecho);
  circulo(x, z, 1.6);
  circulo(px, pz, 0.9);
  let fase = -1;
  function poner(estado) {
    // estado: { puesto: {piedra, tablon, cuerda}, empezada, terminada }
    const f = estado.terminada !== null ? 2 : estado.empezada !== null ? 1 : 0;
    piedras.count = f === 2 ? 0 : Math.min(30, estado.puesto.piedra);
    tablones.count = f === 2 ? 0 : Math.min(12, estado.puesto.tablon);
    cuerdas.count = f === 2 ? 0 : Math.min(4, estado.puesto.cuerda);
    if (f === fase) return;
    fase = f;
    gSolar.visible = f === 0;
    gObra.visible = f === 1;
    gHecho.visible = f === 2;
  }
  return { poner, actualizar() {}, get fase() { return fase; } };
}

// ---------------- las huertas ----------------
// bancales de tierra con borde de tablas, cerca de palos y plantas instanciadas que crecen con el agua de la Base
function crearHuertas(grupo, L, { altura, r, caja, circulo }) {
  const Hu = COSAS.huertas, x0 = Hu.x - Hu.ancho / 2, x1 = Hu.x + Hu.ancho / 2, z0 = Hu.z - Hu.fondo / 2, z1 = Hu.z + Hu.fondo / 2;
  // la cerca, con un hueco al norte (hacia el camino)
  for (let x = x0; x <= x1 + 0.01; x += 2.4) for (const z of [z0, z1]) {
    if (z === z0 && Math.abs(x - (Hu.x + 6)) < 2) continue;
    L.poner(FORMAS.cajaSuelo, M(x, altura(x, z) - 0.1, z, 0, [0.1, 1.1, 0.1]), MADERA_OSC, { tinta: 0.006 });
    if (x + 2.4 <= x1 + 0.01 && !(z === z0 && Math.abs(x + 1.2 - (Hu.x + 6)) < 2.5)) L.poner(FORMAS.caja, M(x + 1.2, altura(x + 1.2, z) + 0.75, z, 0, [2.4, 0.06, 0.05]), MADERA, { tinta: 0.005 });
  }
  for (let z = z0; z <= z1 + 0.01; z += 2.5) for (const x of [x0, x1]) {
    L.poner(FORMAS.cajaSuelo, M(x, altura(x, z) - 0.1, z, 0, [0.1, 1.1, 0.1]), MADERA_OSC, { tinta: 0.006 });
    if (z + 2.5 <= z1 + 0.01) L.poner(FORMAS.caja, M(x, altura(x, z + 1.25) + 0.75, z + 1.25, 0, [0.05, 0.06, 2.5]), MADERA, { tinta: 0.005 });
  }
  caja(Hu.x, z1, Hu.ancho, 0.2); caja(x0, Hu.z, 0.2, Hu.fondo); caja(x1, Hu.z, 0.2, Hu.fondo);
  caja((x0 + Hu.x + 4) / 2, z0, Hu.x + 4 - x0, 0.2); caja((Hu.x + 8 + x1) / 2, z0, x1 - Hu.x - 8, 0.2);
  // bancales a lo largo (x), con pasillos
  const plantas = [];
  for (let k = 0; k < 6; k++) {
    const zb = z0 + 2 + k * 3.1, xa = x0 + 1.5, xb = x1 - 1.5;
    const y = altura((xa + xb) / 2, zb);
    L.poner(FORMAS.cajaSuelo, M((xa + xb) / 2, y - 0.15, zb, 0, [xb - xa, 0.32, 1.5]), col(0x4f3c2a), { tinta: 0.01, varia: 0.08 });
    for (let x = xa + 0.5; x < xb; x += 0.6 + r() * 0.2) plantas.push({ x, z: zb + (r() - 0.5) * 0.7, y: y + 0.17, g: r() * 6.28, s: 0.8 + r() * 0.4, tipo: k % 3 });
  }
  // las plantas: una mata de hojas (col, lechuga) o unas varas (judias)
  const hojaGeo = (() => {
    const g = new THREE.IcosahedronGeometry(0.22, 0);
    g.scale(1, 0.55, 1).translate(0, 0.1, 0);
    return g;
  })();
  const varaGeo = new THREE.ConeGeometry(0.12, 0.7, 5).translate(0, 0.35, 0);
  const mk = (geo, lista, color) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ color, gradientMap: TONO, flatShading: true }), lista.length);
    im.castShadow = im.receiveShadow = true;
    im.userData.lista = lista;
    return im;
  };
  const coles = mk(hojaGeo, plantas.filter((p) => p.tipo !== 2), 0x7b8f4a), varas = mk(varaGeo, plantas.filter((p) => p.tipo === 2), 0x6e8a45);
  grupo.add(coles, varas);
  const mt = new THREE.Matrix4(), c = new THREE.Color();
  const pardo = col(0x8a7a48), verde = col(0x7b8f4a);
  function crecer(k) {
    // k = 0 (secas, pequenas y pardas) .. 1 (grandes y verdes)
    for (const im of [coles, varas]) {
      im.userData.lista.forEach((p, i) => {
        const s = p.s * (0.45 + 0.65 * k);
        im.setMatrixAt(i, mt.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.g), new THREE.Vector3(s, s * (0.7 + 0.5 * k), s)));
        im.setColorAt(i, c.copy(pardo).lerp(verde, k).multiplyScalar(0.9 + 0.2 * ((i * 7) % 5) / 5));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
  crecer(0);
  return { crecer };
}
