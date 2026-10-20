// La NATURALEZA del trozo: lo que se RECOGE (rocas, arboles y troncos caidos de la arboleda, juncos, flores blancas y
// barro del arroyo) y lo que solo esta (arboles de ribera y de la Cuenca, matorrales, penascos en las lomas del borde).
// Lo que se recoge va en instancias: cada sitio cambia a la vista con lo que le queda (la roca mengua, el arbol cortado
// queda en tocon, los juncos y las flores desaparecen) y vuelve cuando la partida dice que ha vuelto.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TONO, TINTA, cascoDe, azar, col, M } from './geo.js';
import { RECOGIDA, ARROYO, distArroyo, bordeCamino, COSAS, X0, X1, Z1 } from './mapa.js';

// ---------------- geometrias unidad ----------------
function roca(semilla) {
  const q = azar(semilla);
  let g = new THREE.IcosahedronGeometry(1, 1);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  const planos = [];
  for (let k = 0, n = 5 + Math.floor(q() * 4); k < n; k++) planos.push([new THREE.Vector3(q() * 2 - 1, q() * 1.6 - 0.3, q() * 2 - 1).normalize(), 0.62 + q() * 0.25]);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).multiplyScalar(0.9 + q() * 0.2);
    for (const [n, c] of planos) { const d = v.dot(n) - c; if (d > 0) v.addScaledVector(n, -d); }
    v.y = Math.max(v.y, -0.35);
    p.setXYZ(i, v.x, (v.y + 0.35) * 0.75, v.z);
  }
  return g;
}
function plana(g) { const n = g.index ? g.toNonIndexed() : g.clone(); n.computeVertexNormals(); return n; }
// arbol: copa de tres bolas facetadas sobre un tronco que se estrecha (altura 1 = 6 m)
function copa(semilla) {
  const q = azar(semilla), partes = [];
  for (let k = 0; k < 3; k++) {
    const b = new THREE.IcosahedronGeometry(1, 0);
    b.scale(1.5 + q() * 0.6, 1.2 + q() * 0.5, 1.5 + q() * 0.6).rotateY(q() * 3).translate((q() - 0.5) * 1.6, 4.2 + k * 0.9 + q() * 0.4, (q() - 0.5) * 1.6);
    partes.push(b.toNonIndexed());
  }
  return juntarGeos(partes);
}
function juntarGeos(gs) {
  let n = 0;
  for (const g of gs) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  let o = 0;
  for (const g of gs) { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
const TRONCO = new THREE.CylinderGeometry(0.16, 0.3, 4.6, 6).translate(0, 2.3, 0);
const TOCON = new THREE.CylinderGeometry(0.28, 0.32, 0.45, 6).translate(0, 0.22, 0);
const CAIDO = new THREE.CylinderGeometry(0.24, 0.3, 3.2, 6).rotateZ(Math.PI / 2).translate(0, 0.24, 0);
function juncos(semilla) {
  const q = azar(semilla), partes = [];
  for (let k = 0; k < 14; k++) {
    const a = q() * 6.28, rad = 0.35 * Math.sqrt(q()), h = 0.8 + q() * 0.7;
    const b = new THREE.ConeGeometry(0.025, h, 3).translate(0, h / 2, 0).rotateX((q() - 0.5) * 0.3).rotateZ((q() - 0.5) * 0.3).translate(Math.cos(a) * rad, 0, Math.sin(a) * rad);
    partes.push(b.toNonIndexed());
    if (k % 3 === 0) {           // la espiga parda de la enea
      const e = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 5).translate(Math.cos(a) * rad, h * 0.82, Math.sin(a) * rad);
      partes.push(e.toNonIndexed());
    }
  }
  return juntarGeos(partes);
}
function flores(semilla) {
  // un corro de flores blancas: tallo y una cabeza de cinco petalos
  const q = azar(semilla), partes = [], blancas = [];
  for (let k = 0; k < 13; k++) {
    const a = q() * 6.28, rad = 0.5 * Math.sqrt(q()), h = 0.25 + q() * 0.2, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    partes.push(new THREE.CylinderGeometry(0.008, 0.01, h, 3).translate(x, h / 2, z).toNonIndexed());
    blancas.push(new THREE.CylinderGeometry(0.07, 0.03, 0.025, 5).translate(x, h, z).toNonIndexed());
    blancas.push(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 5).translate(x, h + 0.02, z).toNonIndexed());
  }
  return { tallos: juntarGeos(partes), cabezas: juntarGeos(blancas) };
}

export function crearNaturaleza(grupo, { altura, choques }) {
  const r = azar(303);
  const tinta = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });
  const mats = {};
  const toon = (c) => (mats[c] ||= new THREE.MeshToonMaterial({ color: c, gradientMap: TONO, flatShading: true }));
  // una instancia por sitio, con su casco de tinta en otra con las mismas matrices
  function capa(geo, color, lista, { conTinta = 0.03, nombre = 'nat', sombra = true } = {}) {
    const im = new THREE.InstancedMesh(geo, toon(color), lista.length);
    im.castShadow = sombra; im.receiveShadow = true; im.name = nombre;
    let it = null;
    if (conTinta) { it = new THREE.InstancedMesh(cascoDe(geo, conTinta), tinta, lista.length); it.name = nombre + '_tinta'; }
    const c = new THREE.Color();
    lista.forEach((o, i) => {
      im.setMatrixAt(i, o.m);
      if (it) it.setMatrixAt(i, o.m);
      if (o.c) im.setColorAt(i, c.setRGB(o.c, o.c, o.c));
    });
    grupo.add(im);
    if (it) grupo.add(it);
    return { im, it, lista };
  }
  const escala = (cap, i, s3, base) => {
    // pone la instancia i con su matriz base escalada (s3 = [sx, sy, sz] relativos); 0 = no se ve
    const m = base.clone().multiply(new THREE.Matrix4().makeScale(...s3));
    cap.im.setMatrixAt(i, m); if (cap.it) cap.it.setMatrixAt(i, m);
  };

  // ---------------- lo que se recoge ----------------
  const porTipo = (t) => RECOGIDA.filter((o) => o.tipo === t);
  const geoRoca = [roca(1), roca(2), roca(3)].map(plana);
  const rocasRec = porTipo('roca').map((o) => {
    const y = altura(o.x, o.z) - 0.12;
    return { ...o, m: M(o.x, y, o.z, o.giro, [0.7 * o.tam, 0.62 * o.tam, 0.6 * o.tam]), c: 0.88 + r() * 0.22, v: Math.floor(r() * 3) };
  });
  const capRocas = [0, 1, 2].map((v) => capa(geoRoca[v], 0x9a9384, rocasRec.filter((o) => o.v === v), { nombre: 'rocas_recoger', conTinta: 0.025 }));
  // la arboleda: arbol (tronco + copa), tocon cuando se corta; troncos caidos
  const arboles = porTipo('arbol').map((o) => ({ ...o, m: M(o.x, altura(o.x, o.z) - 0.1, o.z, o.giro, o.tam * (0.9 + r() * 0.25)), c: 0.85 + r() * 0.25 }));
  const capTroncos = capa(TRONCO, 0x6a4f36, arboles, { nombre: 'arboles_tronco', conTinta: 0.03 });
  const geoCopa = copa(9);
  const capCopas = capa(geoCopa, 0x5f7440, arboles, { nombre: 'arboles_copa', conTinta: 0.05 });
  const capTocones = capa(TOCON, 0x7a5a3c, arboles, { nombre: 'tocones', conTinta: 0.02 });
  const caidos = porTipo('tronco').map((o) => ({ ...o, m: M(o.x, altura(o.x, o.z) - 0.05, o.z, o.giro, o.tam), c: 0.9 + r() * 0.2 }));
  const capCaidos = capa(CAIDO, 0x6e5238, caidos, { nombre: 'troncos_caidos', conTinta: 0.025 });
  const capJuncos = capa(juncos(5), 0x7a8a48, porTipo('juncos').map((o) => ({ ...o, m: M(o.x, altura(o.x, o.z) - 0.05, o.z, o.giro, o.tam), c: 0.9 + r() * 0.2 })), { nombre: 'juncos', conTinta: 0, sombra: false });
  const geoFlores = flores(7);
  const listaFlores = porTipo('flores').map((o) => ({ ...o, m: M(o.x, altura(o.x, o.z) - 0.02, o.z, o.giro, o.tam * 1.2), c: 1 }));
  const capTallos = capa(geoFlores.tallos, 0x5f7a3c, listaFlores, { nombre: 'flores_tallos', conTinta: 0, sombra: false });
  const capCabezas = capa(geoFlores.cabezas, 0xeef0ea, listaFlores, { nombre: 'flores_blancas', conTinta: 0.008, sombra: false });
  const barro = porTipo('barro').map((o) => ({ ...o, m: M(o.x, altura(o.x, o.z) + 0.02, o.z, o.giro, [1.8 * o.tam, 0.05, 1.2 * o.tam]), c: 1 }));
  const capBarro = capa(new THREE.CylinderGeometry(1, 1, 1, 9).translate(0, 0.5, 0), 0x4a3a2b, barro, { nombre: 'barro', conTinta: 0, sombra: false });

  // ---------------- lo que solo esta ----------------
  const deco = [], decoRocas = [], matas = [];
  const libre = (x, z, sep) => bordeCamino(x, z) > 2.5 && RECOGIDA.every((o) => Math.hypot(o.x - x, o.z - z) > sep) && deco.every((o) => Math.hypot(o.x - x, o.z - z) > sep);
  // arboles de ribera a lo largo del arroyo y sueltos por la Cuenca y el borde
  for (let k = 0; k < 600 && deco.length < 70; k++) {
    let x, z;
    if (k % 2) { const i = Math.floor(r() * (ARROYO.pts.length - 1)), [ax, az] = ARROYO.pts[i], s = r() < 0.5 ? -1 : 1, d = 7 + r() * 10; x = ax; z = az + s * d; }
    else { x = X0 + 20 + r() * (X1 - X0 - 40); z = 70 + r() * (Z1 - 90); }
    if (Math.abs(x) > 232 || z > 332 || distArroyo(x, z) < 5 || !libre(x, z, 7)) continue;
    // lejos de las huertas y del campamento
    if (z < 90 && Math.abs(x - COSAS.huertas.x) < 30) continue;
    deco.push({ x, z, m: M(x, altura(x, z) - 0.1, z, r() * 6.28, 0.9 + r() * 0.6), c: 0.8 + r() * 0.3 });
  }
  capa(TRONCO, 0x6a4f36, deco, { nombre: 'arboles_deco_tronco' });
  capa(geoCopa, 0x5a6e3c, deco, { nombre: 'arboles_deco_copa', conTinta: 0.05 });
  for (const o of deco) choques.circulos.push({ x: o.x, z: o.z, r: 0.3 });
  // penascos en las lomas del borde y alguno suelto
  for (let k = 0; k < 400 && decoRocas.length < 60; k++) {
    const borde = k % 3 !== 0;
    const x = borde ? (r() < 0.5 ? -1 : 1) * (205 + r() * 30) : X0 + 30 + r() * (X1 - X0 - 60);
    const z = borde ? 40 + r() * 290 : 90 + r() * 230;
    if (!libre(x, z, 6) || distArroyo(x, z) < 6) continue;
    const s = borde ? 1.6 + r() * 2.8 : 0.9 + r() * 1.2;
    decoRocas.push({ x, z, m: M(x, altura(x, z) - 0.3 * s, z, r() * 6.28, [s, s * (0.6 + r() * 0.5), s * (0.7 + r() * 0.4)]), c: 0.8 + r() * 0.25, v: Math.floor(r() * 3) });
    choques.circulos.push({ x, z, r: s * 0.75 });
  }
  for (const v of [0, 1, 2]) capa(geoRoca[v], 0x8f897a, decoRocas.filter((o) => o.v === v), { nombre: 'penascos', conTinta: 0.04 });
  // matorrales
  for (let k = 0; k < 900 && matas.length < 160; k++) {
    const x = X0 + 15 + r() * (X1 - X0 - 30), z = 30 + r() * (Z1 - 45);
    if (!libre(x, z, 2) || distArroyo(x, z) < 4) continue;
    if (z < 70 && Math.abs(x) < 100) continue;
    const s = 0.6 + r() * 0.8;
    matas.push({ x, z, m: M(x, altura(x, z) + 0.1 * s, z, r() * 6.28, [s * 1.2, s * 0.7, s]), c: 0.8 + r() * 0.3 });
  }
  capa(new THREE.IcosahedronGeometry(0.7, 0).toNonIndexed(), 0x56683a, matas, { nombre: 'matorral', conTinta: 0.025 });

  // ---------------- poner al dia lo recogido ----------------
  // quedan(id, tipo) -> unidades que le quedan al sitio (0 = agotado). Se llama cuando cambia algo
  const R0 = { roca: 4, arbol: 5, tronco: 2, juncos: 4, flores: 3, barro: 3 };
  function poner(quedan) {
    for (const cap of capRocas) cap.lista.forEach((o, i) => { const k = quedan(o.id, 'roca') / R0.roca; escala(cap, i, k > 0 ? [0.55 + 0.45 * k, 0.4 + 0.6 * k, 0.55 + 0.45 * k] : [0.35, 0.12, 0.35], o.m); });
    arboles.forEach((o, i) => {
      const k = quedan(o.id, 'arbol');
      escala(capTroncos, i, k > 0 ? [1, 1, 1] : [0, 0, 0], o.m);
      escala(capCopas, i, k > 0 ? [1, 0.75 + 0.25 * k / R0.arbol, 1] : [0, 0, 0], o.m);
      escala(capTocones, i, k > 0 ? [0, 0, 0] : [1, 1, 1], o.m);
    });
    caidos.forEach((o, i) => { const k = quedan(o.id, 'tronco'); escala(capCaidos, i, k > 0 ? [k / R0.tronco * 0.5 + 0.5, 1, 1] : [0, 0, 0], o.m); });
    capJuncos.lista.forEach((o, i) => { const k = quedan(o.id, 'juncos'); escala(capJuncos, i, k > 0 ? [1, 0.5 + 0.5 * k / R0.juncos, 1] : [0.6, 0.12, 0.6], o.m); });
    listaFlores.forEach((o, i) => { const k = quedan(o.id, 'flores'); const s = k > 0 ? [0.5 + 0.5 * k / R0.flores, 1, 0.5 + 0.5 * k / R0.flores] : [0, 0, 0]; escala(capTallos, i, s, o.m); escala(capCabezas, i, s, o.m); });
    barro.forEach((o, i) => { const k = quedan(o.id, 'barro'); escala(capBarro, i, [0.5 + 0.5 * k / R0.barro, 1, 0.5 + 0.5 * k / R0.barro], o.m); });
    for (const c of [...capRocas, capTroncos, capCopas, capTocones, capCaidos, capJuncos, capTallos, capCabezas, capBarro]) {
      c.im.instanceMatrix.needsUpdate = true;
      if (c.it) c.it.instanceMatrix.needsUpdate = true;
    }
  }
  // los choques de los arboles: un tocon sigue chocando (mas pequeno)
  return { poner, info: { arboles: arboles.length + deco.length, rocas: rocasRec.length + decoRocas.length, matas: matas.length } };
}
