// La HIERBA del trozo: las matas low poly del mapa del muro (../hierba.js: 30 hojas finas por mata, viento por hoja y
// la FISICA de hierba_fisica.js) mas margaritas, pero en 500 x 500 m no cabe entera: va por TROZOS de 20 m que se
// hacen cuando el 18 se acerca (uno por fotograma) y se TIRAN cuando se aleja (la memoria no crece al recorrer el mapa).
// Donde crece lo dice `densidad(x, z)`: nada en caminos, cauce, huertas ni dentro de la Base; poca al pie del muro.
import * as THREE from 'three';
import { matojo, espiga, material } from '../hierba.js';
import { crearCampo } from '../hierba_fisica.js';
import { azar, TONO } from './geo.js';
import { X0, X1, Z1, bordeCamino, distArroyo, COSAS, ARROYO, RECOGIDA, fbm, suave } from './mapa.js';

const CH = 20, SEP = 0.42;
const LEJOS_FUNDE = [34, 46], CERCA_FUNDE = [18, 26], FLOR_FUNDE = [22, 30];
const HACER = 52, TIRAR = 90;

export function densidad(x, z) {
  if (z < 2.5) return 0;
  let d = suave(0.1, 0.8, bordeCamino(x, z));
  d *= suave(ARROYO.ancho - 0.2, ARROYO.ancho + 1.2, distArroyo(x, z));
  const hu = COSAS.huertas, dh = Math.max(Math.abs(x - hu.x) - hu.ancho / 2, Math.abs(z - hu.z) - hu.fondo / 2);
  d *= suave(-0.2, 1.2, dh);
  // el campamento pegado al muro: pisoteado
  d *= 0.25 + 0.75 * suave(10, 26, z) + 0.75 * suave(80, 100, Math.abs(x));
  // calvas
  d *= 1 - 0.7 * suave(0.68, 0.8, fbm(x / 6 + 100, z / 6 - 50, 2));
  return Math.min(1, d);
}

// una margarita low poly (tallo y cabeza de ocho petalos); la cabeza mira un poco al sol
function margarita() {
  const g = { pos: [], col: [], raiz: [] }, verde = [0.33, 0.44, 0.23], blanco = [0.93, 0.94, 0.95], amarillo = [0.92, 0.75, 0.24];
  const tri = (a, b, c, k) => { g.pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) { g.col.push(...k); g.raiz.push(0, 0); } };
  const h = 0.2, w = 0.004;
  tri([-w, 0, 0], [w, 0, 0], [0.01, h, 0.01], verde);
  tri([0, 0, -w], [0, 0, w], [0.01, h, 0.01], verde);
  const c = [0.01, h, 0.01];
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2, b = a + 0.32, e = a - 0.32;
    tri(c, [c[0] + Math.cos(e) * 0.026, h + 0.004, c[2] + Math.sin(e) * 0.026], [c[0] + Math.cos(b) * 0.026, h + 0.004, c[2] + Math.sin(b) * 0.026], blanco);
    tri([c[0] + Math.cos(e) * 0.026, h + 0.004, c[2] + Math.sin(e) * 0.026], [c[0] + Math.cos(a) * 0.04, h - 0.004, c[2] + Math.sin(a) * 0.04], [c[0] + Math.cos(b) * 0.026, h + 0.004, c[2] + Math.sin(b) * 0.026], blanco);
  }
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2, b = ((p + 1) / 5) * Math.PI * 2;
    tri([c[0], h + 0.012, c[2]], [c[0] + Math.cos(a) * 0.011, h + 0.006, c[2] + Math.sin(a) * 0.011], [c[0] + Math.cos(b) * 0.011, h + 0.006, c[2] + Math.sin(b) * 0.011], amarillo);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
  geo.setAttribute('raiz', new THREE.Float32BufferAttribute(g.raiz, 2));
  const n = new Float32Array(g.pos.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return geo;
}

export function crearHierba({ grupo, altura, color }) {
  const campo = crearCampo({ lado: 24, celda: 0.25 });
  const datos = new Uint16Array(campo.n * campo.n * 4);
  const tex = new THREE.DataTexture(datos, campo.n, campo.n, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const comunes = { uTiempo: { value: 0 }, uCampo: { value: tex }, uCampoOrigen: { value: new THREE.Vector2(1e5, 1e5) }, uCampoLado: { value: campo.lado }, uFoco: { value: new THREE.Vector3() } };
  const geo = { matojo: matojo(), espiga: espiga(), flor: margarita() };
  const mat = { lejos: material(TONO, comunes, LEJOS_FUNDE), cerca: material(TONO, comunes, CERCA_FUNDE), espiga: material(TONO, comunes, CERCA_FUNDE), flor: material(TONO, comunes, FLOR_FUNDE) };
  const _c = new THREE.Color(), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), sv = new THREE.Vector3();
  // las rocas y arboles que se recogen: no crece hierba debajo
  const ocupado = (x, z) => RECOGIDA.some((o) => (o.tipo === 'roca' || o.tipo === 'arbol' || o.tipo === 'barro') && Math.abs(o.x - x) < 1.4 && Math.abs(o.z - z) < 1.4 && Math.hypot(o.x - x, o.z - z) < (o.tipo === 'barro' ? 1.6 : 0.75) * o.tam);

  function instancias(g, m, lista, nombre) {
    const im = new THREE.InstancedMesh(g, m, lista.length);
    lista.forEach((o, i) => {
      im.setMatrixAt(i, mt.compose(v3.set(o.x, o.y, o.z), q.setFromAxisAngle(Y, o.giro), sv.set(o.s, o.sy, o.s)));
      im.setColorAt(i, _c.setRGB(o.r, o.g, o.b));
    });
    im.receiveShadow = true;
    im.computeBoundingSphere();
    im.name = nombre;
    return im;
  }
  const nI = Math.ceil((X1 - X0) / CH), nJ = Math.ceil((Z1 - 0) / CH);
  const trozos = new Map();
  function hacer(i, j) {
    const x0 = X0 + i * CH, z0 = j * CH, r = azar(7000 + j * 131 + i);
    const lejos = [], cerca = [], espigas = [], flores = [];
    const nc = Math.round(CH / SEP);
    for (let gz = 0; gz < nc; gz++) {
      for (let gx = 0; gx < nc; gx++) {
        const jx = r(), jz = r(), giro = r() * 6.2832, rs = r(), ry = r(), rc = r(), rd = r();
        const x = x0 + (gx + 0.15 + jx * 0.7) * SEP, z = z0 + (gz + 0.15 + jz * 0.7) * SEP;
        const d = densidad(x, z);
        if (rd > d || ocupado(x, z)) continue;
        const alta = 0.75 + 0.5 * suave(0.3, 0.75, fbm(x / 13 + 5, z / 13 + 1, 3));
        const s = alta * (0.85 + rs * 0.3) * (0.55 + 0.45 * suave(0.1, 0.6, bordeCamino(x, z)));
        color(x, z, _c).multiplyScalar(1.0 + rc * 0.14);
        const o = { x, y: altura(x, z) - 0.015, z, giro, s, sy: s * (0.88 + ry * 0.24), r: _c.r, g: _c.g, b: _c.b, alta };
        ((gx + gz) & 1 ? cerca : lejos).push(o);
        if (((gx + gz) & 1) && r() < 0.04 * (alta - 0.6)) espigas.push({ ...o, s: 0.9, sy: 0.9 + r() * 0.3, r: 1, g: 1, b: 1 });
        // margaritas en corros (praditos con pocas)
        if (r() < 0.05 * suave(0.56, 0.68, fbm(x / 7 + 70, z / 7 - 30))) flores.push({ x: x + (r() - 0.5) * 0.3, y: altura(x, z) - 0.01, z: z + (r() - 0.5) * 0.3, giro: r() * 6.28, s: 0.9 + r() * 0.4, sy: 0.8 + r() * 0.6, r: 1, g: 1, b: 1 });
      }
    }
    const t = { i, j, cx: x0 + CH / 2, cz: z0 + CH / 2, grupo: new THREE.Group(), lejos: null, cerca: new THREE.Group() };
    t.grupo.name = 'hierba_trozo';
    if (lejos.length) { t.lejos = instancias(geo.matojo, mat.lejos, lejos, 'hierba_lejos'); t.grupo.add(t.lejos); }
    if (cerca.length) t.cerca.add(instancias(geo.matojo, mat.cerca, cerca, 'hierba_cerca'));
    if (espigas.length) t.cerca.add(instancias(geo.espiga, mat.espiga, espigas, 'espigas'));
    if (flores.length) t.cerca.add(instancias(geo.flor, mat.flor, flores, 'margaritas'));
    t.grupo.add(t.cerca);
    t.n = lejos.length + cerca.length;
    grupo.add(t.grupo);
    return t;
  }
  function tirar(t) {
    t.grupo.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    grupo.remove(t.grupo);
  }

  const contactos = [];
  let hechos = 0;
  function actualizar(tiempo, foco, heroe, dt, forzar = false) {
    comunes.uTiempo.value = tiempo;
    comunes.uFoco.value.copy(foco);
    // hacer los que faltan cerca (uno por fotograma, el mas cercano; todos si se fuerza) y tirar los lejanos
    const fi = Math.floor((foco.x - X0) / CH), fj = Math.floor(foco.z / CH), R = Math.ceil(HACER / CH);
    let mejor = null;
    for (let j = Math.max(0, fj - R); j <= Math.min(nJ - 1, fj + R); j++) {
      for (let i = Math.max(0, fi - R); i <= Math.min(nI - 1, fi + R); i++) {
        const k = j * 1000 + i;
        if (trozos.has(k)) continue;
        const cx = X0 + i * CH + CH / 2, cz = j * CH + CH / 2;
        const d = Math.hypot(Math.max(Math.abs(cx - foco.x) - CH / 2, 0), Math.max(Math.abs(cz - foco.z) - CH / 2, 0));
        if (d > HACER) continue;
        if (forzar) { trozos.set(k, hacer(i, j)); hechos++; continue; }
        if (!mejor || d < mejor.d) mejor = { d, i, j, k };
      }
    }
    if (mejor) { trozos.set(mejor.k, hacer(mejor.i, mejor.j)); hechos++; }
    for (const [k, t] of trozos) {
      const d = Math.hypot(Math.max(Math.abs(t.cx - foco.x) - CH / 2, 0), Math.max(Math.abs(t.cz - foco.z) - CH / 2, 0));
      if (d > TIRAR) { tirar(t); trozos.delete(k); continue; }
      if (t.lejos) t.lejos.visible = d < LEJOS_FUNDE[1];
      t.cerca.visible = d < Math.max(CERCA_FUNDE[1], FLOR_FUNDE[1]);
    }
    if (dt > 0) {
      campo.centrar(foco.x, foco.z);
      campo.paso(dt, heroe && heroe.contactos ? heroe.contactos(contactos) : [], heroe ? heroe.caida : null);
      const [ox, oz] = campo.origen();
      comunes.uCampoOrigen.value.set(ox - campo.celda / 2, oz - campo.celda / 2);
      const h = THREE.DataUtils.toHalfFloat;
      for (let k = 0, n = campo.bx.length; k < n; k++) { datos[k * 4] = h(campo.bx[k]); datos[k * 4 + 1] = h(campo.bz[k]); datos[k * 4 + 2] = h(campo.ap[k]); }
      tex.needsUpdate = true;
    }
  }
  return {
    actualizar, campo, uniformes: comunes,
    get trozos() { return [...trozos.values()]; },
    info: () => ({ trozosVivos: trozos.size, hechos, matas: [...trozos.values()].reduce((s, t) => s + t.n, 0) }),
  };
}
