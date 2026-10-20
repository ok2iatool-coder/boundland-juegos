// La HIERBA del mapa de terreno: las matas low poly del mapa del muro (../hierba.js: 30 hojas finas por mata, viento por
// hoja y la FISICA de hierba_fisica.js) y flores de cuatro clases en corros (blancas, amarillas, moradas, rosas), por
// TROZOS de 20 m que se hacen cuando el 18 se acerca (uno por fotograma) y se tiran cuando se aleja. Cuanta y de que
// alto la dice `cubierta` (sitios.js): nada en roca, grava ni barro; corta y pajiza en la meseta; alta en lo bajo.
import * as THREE from 'three';
import { matojo, espiga, material } from '../hierba.js';
import { crearCampo } from '../hierba_fisica.js';
import { TONO } from './tono.js';
import { altura, azar, EXT } from './relieve.js';
import { cubierta } from './sitios.js';
import { colorHierba, COLOR } from './suelo.js';

const CH = 20, SEP = 0.42;
const LEJOS_FUNDE = [34, 46], CERCA_FUNDE = [18, 26], FLOR_FUNDE = [24, 32];
const HACER = 52, TIRAR = 90;
// EL PRADO: lo que hay detras de las matas de cerca para que la hierba no acabe en un circulo. Matas de 7 hojas cada
// 1,3 m, en trozos de 60 m hasta 300 m; aparece donde se van las de cerca, crece con la distancia (a 200 m una mata de
// 30 cm es un pixel) y se va entre 220 y 300 m de la CAMARA, sobre un suelo del mismo verde.
const PCH = 60, PSEP = 1.3, PHACER = 300, PTIRAR = 360;
const P_ENTRA = [36, 50], P_SALE = [220, 300];

// la mata del prado: siete hojas de un tramo, mas anchas que las de cerca (de lejos son una mancha)
function mataPrado() {
  const r = azar(77), pos = [], col = [];
  for (let h = 0; h < 7; h++) {
    const rad = 0.3 * Math.sqrt(r()), a = r() * 6.2832, ang = a + (r() - 0.5) * 1.6;
    const alto = 0.16 + 0.16 * r(), ancho = 0.035 + 0.02 * r(), inc = alto * (0.15 + 0.3 * r());
    const x0 = Math.cos(a) * rad, z0 = Math.sin(a) * rad, cx = Math.cos(ang), cz = Math.sin(ang);
    const k = r() < 0.2 ? [1.1, 1.05, 0.8] : [1, 1, 1];
    pos.push(x0 - cz * ancho, 0, z0 + cx * ancho, x0 + cz * ancho, 0, z0 - cx * ancho, x0 + cx * inc, alto, z0 + cz * inc);
    for (const f of [0.55, 0.55, 1.12]) col.push(k[0] * f, k[1] * f, k[2] * f);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const n = new Float32Array(pos.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}
function materialPrado(comunes) {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: TONO, side: THREE.DoubleSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTiempo = comunes.uTiempo;
    s.vertexShader = 'uniform float uTiempo;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 w = (modelMatrix * instanceMatrix[3]).xyz;
        float dc = distance(w, cameraPosition);
        float t = smoothstep(${P_ENTRA[0].toFixed(1)}, ${P_ENTRA[1].toFixed(1)}, dc) * (1.0 - smoothstep(${P_SALE[0].toFixed(1)}, ${P_SALE[1].toFixed(1)}, dc));
        float crece = 1.0 + clamp((dc - 40.0) / 120.0, 0.0, 1.4);
        float fase = dot(w.xz, vec2(0.085, 0.03)) - uTiempo * 0.5;
        float racha = pow(0.5 + 0.5 * sin(fase * 6.2832), 3.0);
        float k = position.y / 0.3;
        transformed.xz += vec2(0.92, 0.38) * (0.02 + 0.07 * racha) * k * k;
        transformed *= t * crece;
      }`);
  };
  return m;
}

// una flor low poly: tallo y cabeza de ocho petalos del color dado, con su centro
function flor(petalo, centro) {
  const g = { pos: [], col: [], raiz: [] }, verde = [0.33, 0.44, 0.23];
  const tri = (a, b, c, k) => { g.pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) { g.col.push(...k); g.raiz.push(0, 0); } };
  const h = 0.2, w = 0.004, cx = 0.01, cz = 0.01;
  tri([-w, 0, 0], [w, 0, 0], [cx, h, cz], verde);
  tri([0, 0, -w], [0, 0, w], [cx, h, cz], verde);
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2, b = a + 0.32, e = a - 0.32;
    const P = (ang, r, y) => [cx + Math.cos(ang) * r, h + y, cz + Math.sin(ang) * r];
    tri([cx, h, cz], P(e, 0.026, 0.004), P(b, 0.026, 0.004), petalo);
    tri(P(e, 0.026, 0.004), P(a, 0.04, -0.004), P(b, 0.026, 0.004), petalo);
  }
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2, b = ((p + 1) / 5) * Math.PI * 2;
    tri([cx, h + 0.012, cz], [cx + Math.cos(a) * 0.011, h + 0.006, cz + Math.sin(a) * 0.011], [cx + Math.cos(b) * 0.011, h + 0.006, cz + Math.sin(b) * 0.011], centro);
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

export function crearHierba({ grupo, camara = () => null }) {
  const campo = crearCampo({ lado: 24, celda: 0.25 });
  const datos = new Uint16Array(campo.n * campo.n * 4);
  const tex = new THREE.DataTexture(datos, campo.n, campo.n, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const comunes = { uTiempo: { value: 0 }, uCampo: { value: tex }, uCampoOrigen: { value: new THREE.Vector2(1e5, 1e5) }, uCampoLado: { value: campo.lado }, uFoco: { value: new THREE.Vector3() } };
  const amarillo = [0.92, 0.75, 0.24];
  const geo = {
    matojo: matojo(), espiga: espiga(),
    flores: [[0.93, 0.94, 0.95], [0.93, 0.8, 0.3], [0.62, 0.53, 0.78], [0.86, 0.66, 0.72]].map((p, i) => flor(p, i === 1 ? [0.8, 0.55, 0.2] : amarillo)),
  };
  const pc = { porCamara: true };
  const mat = { lejos: material(TONO, comunes, LEJOS_FUNDE, pc), cerca: material(TONO, comunes, CERCA_FUNDE, pc), espiga: material(TONO, comunes, CERCA_FUNDE, pc), flor: material(TONO, comunes, FLOR_FUNDE, pc), prado: materialPrado(comunes) };
  geo.prado = mataPrado();
  const _c = new THREE.Color(), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), sv = new THREE.Vector3();
  const cub = { mata: 0, alto: 1, flor: 0, florTipo: 0, seco: 0 };

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
  const nT = Math.round((2 * EXT) / CH);
  const trozos = new Map();
  function hacer(i, j) {
    const x0 = -EXT + i * CH, z0 = -EXT + j * CH, r = azar(7000 + j * 131 + i);
    const lejos = [], cerca = [], espigas = [], flores = [[], [], [], []];
    const nc = Math.round(CH / SEP);
    for (let gz = 0; gz < nc; gz++) {
      for (let gx = 0; gx < nc; gx++) {
        const jx = r(), jz = r(), giro = r() * 6.2832, rs = r(), ry = r(), rc = r(), rd = r(), rf = r();
        const x = x0 + (gx + 0.15 + jx * 0.7) * SEP, z = z0 + (gz + 0.15 + jz * 0.7) * SEP;
        const c = cubierta(x, z, cub);
        if (rd > c.mata) continue;
        const s = c.alto * (0.85 + rs * 0.3);
        colorHierba(x, z, _c, c).multiplyScalar(1.0 + rc * 0.14);
        const y = altura(x, z) - 0.015;
        const o = { x, y, z, giro, s, sy: s * (0.88 + ry * 0.24), r: _c.r, g: _c.g, b: _c.b };
        ((gx + gz) & 1 ? cerca : lejos).push(o);
        if (((gx + gz) & 1) && rf < 0.05 * (c.alto - 0.6) + 0.04 * c.seco) espigas.push({ ...o, s: 0.9, sy: 0.9 + rs * 0.3, r: 1, g: 1, b: 1 });
        if (rf > 1 - 0.06 * c.flor) flores[c.florTipo].push({ x: x + (jx - 0.5) * 0.3, y: y + 0.005, z: z + (jz - 0.5) * 0.3, giro, s: 0.9 + rs * 0.4, sy: 0.7 + ry * 0.7, r: 1, g: 1, b: 1 });
      }
    }
    const t = { cx: x0 + CH / 2, cz: z0 + CH / 2, grupo: new THREE.Group(), lejos: null, cerca: new THREE.Group(), n: lejos.length + cerca.length };
    t.grupo.name = 'hierba_trozo';
    if (lejos.length) { t.lejos = instancias(geo.matojo, mat.lejos, lejos, 'hierba_lejos'); t.grupo.add(t.lejos); }
    if (cerca.length) t.cerca.add(instancias(geo.matojo, mat.cerca, cerca, 'hierba_cerca'));
    if (espigas.length) t.cerca.add(instancias(geo.espiga, mat.espiga, espigas, 'espigas'));
    flores.forEach((l, k) => { if (l.length) t.cerca.add(instancias(geo.flores[k], mat.flor, l, 'flores')); });
    t.grupo.add(t.cerca);
    grupo.add(t.grupo);
    return t;
  }
  function tirar(t) {
    t.grupo.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    grupo.remove(t.grupo);
  }
  // ---------------- el prado ----------------
  const nP = Math.round((2 * EXT) / PCH);
  const prado = new Map();
  let matasPrado = 0;
  function hacerPrado(i, j) {
    const x0 = -EXT + i * PCH, z0 = -EXT + j * PCH, r = azar(91000 + j * 977 + i), lista = [];
    const nc = Math.round(PCH / PSEP);
    for (let gz = 0; gz < nc; gz++) {
      for (let gx = 0; gx < nc; gx++) {
        const jx = r(), jz = r(), giro = r() * 6.2832, rs = r(), rd = r(), rc = r();
        const x = x0 + (gx + 0.1 + jx * 0.8) * PSEP, z = z0 + (gz + 0.1 + jz * 0.8) * PSEP;
        const c = cubierta(x, z, cub);
        if (rd > c.mata) continue;
        const s = c.alto * (0.9 + rs * 0.4);
        colorHierba(x, z, _c, c).multiplyScalar(1.0 + rc * 0.12);
        lista.push({ x, y: altura(x, z) - 0.02, z, giro, s, sy: s, r: _c.r, g: _c.g, b: _c.b });
      }
    }
    const t = { cx: x0 + PCH / 2, cz: z0 + PCH / 2, malla: null, n: lista.length };
    if (lista.length) {
      t.malla = instancias(geo.prado, mat.prado, lista, 'prado');
      t.malla.receiveShadow = false;
      grupo.add(t.malla);
    }
    matasPrado += t.n;
    return t;
  }
  function tirarPrado(k) {
    const t = prado.get(k);
    if (t.malla) { t.malla.dispose(); grupo.remove(t.malla); }
    matasPrado -= t.n;
    prado.delete(k);
  }
  const distTrozo = (cx, cz, lado, x, z) => Math.hypot(Math.max(Math.abs(cx - x) - lado / 2, 0), Math.max(Math.abs(cz - z) - lado / 2, 0));
  function actualizarPrado(foco, forzar) {
    const fi = Math.floor((foco.x + EXT) / PCH), fj = Math.floor((foco.z + EXT) / PCH), R = Math.ceil(PHACER / PCH);
    const faltan = [];
    for (let j = Math.max(0, fj - R); j <= Math.min(nP - 1, fj + R); j++) {
      for (let i = Math.max(0, fi - R); i <= Math.min(nP - 1, fi + R); i++) {
        const k = j * 1000 + i;
        if (prado.has(k)) continue;
        const d = distTrozo(-EXT + i * PCH + PCH / 2, -EXT + j * PCH + PCH / 2, PCH, foco.x, foco.z);
        if (d <= PHACER) faltan.push([d, i, j, k]);
      }
    }
    faltan.sort((a, b) => a[0] - b[0]);
    // al llegar de golpe, lo de alrededor ya; si no, hasta ~3 ms por fotograma
    const t0 = performance.now();
    let n = 0;
    for (const [d, i, j, k] of faltan) {
      if (forzar ? d > 120 : (n >= 1 && performance.now() - t0 > 3)) break;
      prado.set(k, hacerPrado(i, j));
      n++;
    }
    const cam = camara(), cp = cam ? cam.position : foco;
    for (const [k, t] of prado) {
      if (distTrozo(t.cx, t.cz, PCH, foco.x, foco.z) > PTIRAR) { tirarPrado(k); continue; }
      // lo que esta entero mas alla de donde se va (o dentro de donde aun no ha salido), ni se manda a la tarjeta
      if (t.malla) {
        const dh = distTrozo(t.cx, t.cz, PCH, cp.x, cp.z), dy = Math.max(0, cp.y - altura(t.cx, t.cz) - 40);
        const lejos = Math.hypot(dh, dy) > P_SALE[1];
        const dentro = Math.hypot(Math.abs(t.cx - cp.x) + PCH * 0.71, Math.abs(t.cz - cp.z) + PCH * 0.71) < P_ENTRA[0] && dy === 0;
        t.malla.visible = !lejos && !dentro;
      }
    }
  }
  const contactos = [];
  let hechos = 0;
  function actualizar(tiempo, foco, heroe, dt, forzar = false) {
    comunes.uTiempo.value = tiempo;
    comunes.uFoco.value.copy(foco);
    const fi = Math.floor((foco.x + EXT) / CH), fj = Math.floor((foco.z + EXT) / CH), R = Math.ceil(HACER / CH);
    let mejor = null;
    for (let j = Math.max(0, fj - R); j <= Math.min(nT - 1, fj + R); j++) {
      for (let i = Math.max(0, fi - R); i <= Math.min(nT - 1, fi + R); i++) {
        const k = j * 1000 + i;
        if (trozos.has(k)) continue;
        const cx = -EXT + i * CH + CH / 2, cz = -EXT + j * CH + CH / 2;
        const d = Math.hypot(Math.max(Math.abs(cx - foco.x) - CH / 2, 0), Math.max(Math.abs(cz - foco.z) - CH / 2, 0));
        if (d > HACER) continue;
        if (forzar) { trozos.set(k, hacer(i, j)); hechos++; continue; }
        if (!mejor || d < mejor.d) mejor = { d, i, j, k };
      }
    }
    if (mejor) { trozos.set(mejor.k, hacer(mejor.i, mejor.j)); hechos++; }
    actualizarPrado(foco, forzar);
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
  // el editor: tirar los trozos que tocan un recuadro (se rehacen solos, el mas cercano primero, con el suelo nuevo)
  function tirarZona(x0, z0, x1, z1) {
    for (const [k, t] of trozos) {
      if (t.cx + CH / 2 < x0 || t.cx - CH / 2 > x1 || t.cz + CH / 2 < z0 || t.cz - CH / 2 > z1) continue;
      tirar(t);
      trozos.delete(k);
    }
    for (const [k, t] of prado) {
      if (t.cx + PCH / 2 < x0 || t.cx - PCH / 2 > x1 || t.cz + PCH / 2 < z0 || t.cz - PCH / 2 > z1) continue;
      tirarPrado(k);
    }
  }
  return {
    actualizar, campo, uniformes: comunes, tirarZona,
    get trozos() { return [...trozos.values()]; },
    info: () => ({ trozosHierba: trozos.size, trozosHechos: hechos, matas: [...trozos.values()].reduce((s, t) => s + t.n, 0), trozosPrado: prado.size, matasPrado }),
  };
}
export { COLOR };
