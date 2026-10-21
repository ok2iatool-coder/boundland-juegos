// LA HIERBA FINA (2026-10-21, "agrega la hierba de prueba de 15x15 m2"): la de la PARCELA (../parcela.js, ?mapa=parcela)
// en el mapa del mundo, alrededor del 18: matas finas de 10-30 cm al tresbolillo cada 13 cm, cesped corto debajo cada
// 17 cm, praditos de trebol, margaritas y botones de oro, con su viento y la FISICA de hierba_fisica.js (pies, cuerpo,
// capa y caidas la apartan; queda tumbada donde se pisa). Las hojas, las flores y el sombreador son los de la parcela.
//
// Es mucha hierba (en la parcela, 24.000 matas en 400 m2): por eso solo en un ANILLO de RADIO m alrededor del foco, en
// trozos de 8 m que se hacen al acercarse (uno por fotograma) y se tiran al alejarse; a mas de LOD m las matas pasan a
// hojas de un tramo. En el borde del anillo se encoge y de ahi para fuera sigue la hierba de siempre (hierba.js), que
// dentro del anillo no se dibuja (`ENTRA`). Cuanta y de que alto, y donde no (roca, agua, nieve, la obra de la ciudad,
// los muros), lo dice `cubierta` (sitios.js), como la otra; el color, `colorHierba` (suelo.js) sobre los tonos de la
// parcela, asi casa con el suelo y con la hierba de mas alla.
import * as THREE from 'three';
import { altura, azar, fbm, suave, EXT } from './relieve.js';
import { cubierta } from './sitios.js';
import { colorHierba } from './suelo.js';

export const RADIO = 13;                         // m del foco: hasta aqui la hierba fina
export const ENTRA = [RADIO - 4, RADIO];         // y aqui entra la de siempre (y se va esta)
const CH = 8, HACER = RADIO + 3, TIRAR = RADIO + 14, LOD = 6, CESPED = 8;   // (el cesped, de 3-9 cm, a mas de 8 m lo tapan las matas)
const col = (h) => new THREE.Color(h);

// ---------------- geometria a mano (la de la parcela) ----------------
function malla() { return { pos: [], col: [], nor: [], raiz: [] }; }
function tri(g, a, b, c, ca, cb = ca, cc = ca, normal = null, raiz = null) {
  g.pos.push(...a, ...b, ...c);
  for (const k of [ca, cb, cc]) g.col.push(k.r, k.g, k.b);
  if (normal) for (let i = 0; i < 3; i++) g.nor.push(...normal);
  if (raiz) for (let i = 0; i < 3; i++) g.raiz.push(...raiz);
}
function geometria(g) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
  if (g.nor.length === g.pos.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
  else geo.computeVertexNormals();
  if (g.raiz.length) geo.setAttribute('raiz', new THREE.Float32BufferAttribute(g.raiz, 2));
  return geo;
}
const ARRIBA = [0, 1, 0];
function hoja(g, x0, z0, ang, alto, ancho, inclina, tonos, tramos = 3) {
  const cx = Math.cos(ang), cz = Math.sin(ang), px = -cz, pz = cx, R = [x0, z0];
  const P = (t, w) => { const o = inclina * Math.pow(t, 1.8); return [x0 + cx * o + px * w, alto * t * (1 - 0.25 * (inclina / alto) * t), z0 + cz * o + pz * w]; };
  if (tramos === 1) { tri(g, P(0, -ancho), P(0, ancho), P(1, 0), tonos[0], tonos[0], tonos[3], ARRIBA, R); return; }
  const T = [0, 0.38, 0.72], Wd = [1, 0.72, 0.42];
  const fila = T.map((t, k) => [P(t, -ancho * Wd[k]), P(t, ancho * Wd[k])]);
  for (let k = 0; k < 2; k++) {
    const [a, b] = fila[k], [c, d] = fila[k + 1];
    tri(g, a, b, d, tonos[k], tonos[k], tonos[k + 1], ARRIBA, R);
    tri(g, a, d, c, tonos[k], tonos[k + 1], tonos[k + 1], ARRIBA, R);
  }
  tri(g, fila[2][0], fila[2][1], P(1, 0), tonos[2], tonos[2], tonos[3], ARRIBA, R);
}
const VERDES = [
  [0x2f3d1c, 0x4f6a2c, 0x7b9644, 0xa9bd66], [0x34421f, 0x587330, 0x8aa04c, 0xb9c474],
  [0x2b3a20, 0x46603a, 0x6b8a4c, 0x93ab6c], [0x4a4a26, 0x75703c, 0xa59a5c, 0xcfc18a],
].map((t) => t.map(col));
// el verde "medio" de esos tonos: el color de cada sitio se divide por el (asi el verde lo pone colorHierba)
const REF = VERDES.slice(0, 3).reduce((c, t) => c.add(t[1].clone().lerp(t[2], 0.5)), new THREE.Color(0, 0, 0)).multiplyScalar(1 / 3);
function tonosHoja(q) {
  const u = q(), base = u < 0.5 ? VERDES[0] : u < 0.75 ? VERDES[1] : u < 0.9 ? VERDES[2] : VERDES[3];
  const k = 0.92 + q() * 0.16;
  return base.map((c) => c.clone().multiplyScalar(k));
}
function geoMata(sem, tramos = 3) {
  const q = azar(sem), g = malla(), n = 10 + Math.floor(q() * 12);
  for (let h = 0; h < n; h++) {
    const a = q() * 6.2832, rad = 0.024 * Math.sqrt(q()), alto = 0.2 * (0.55 + 0.6 * q());
    hoja(g, Math.cos(a) * rad, Math.sin(a) * rad, a + (q() - 0.5) * 0.9, alto, 0.0028 + q() * 0.0025, alto * (0.15 + 0.5 * q()), tonosHoja(q), tramos);
  }
  return geometria(g);
}
function geoCesped(sem) {
  const q = azar(sem), g = malla();
  for (let h = 0; h < 30; h++) {
    const a = q() * 6.2832, rad = 0.11 * Math.sqrt(q()), alto = 0.03 + 0.065 * q();
    hoja(g, Math.cos(a) * rad, Math.sin(a) * rad, q() * 6.2832, alto, 0.0024 + q() * 0.0016, alto * (0.1 + 0.5 * q()), tonosHoja(q), 1);
  }
  return geometria(g);
}
function cabeza(hx, hy, hz) {
  const eje = new THREE.Vector3(-0.35, 1, 0.3).normalize(), u = new THREE.Vector3(1, 0, 0).cross(eje).normalize(), v = eje.clone().cross(u);
  return (rad, a, alt = 0) => [hx + (u.x * Math.cos(a) + v.x * Math.sin(a)) * rad + eje.x * alt, hy + (u.y * Math.cos(a) + v.y * Math.sin(a)) * rad + eje.y * alt, hz + (u.z * Math.cos(a) + v.z * Math.sin(a)) * rad + eje.z * alt];
}
function tallo(g, alto, inc, ang, R) {
  const verde = col(0x55703a), w = 0.0016;
  const hx = Math.cos(ang) * inc, hz = Math.sin(ang) * inc, mx = hx * 0.3, mz = hz * 0.3, my = alto * 0.55;
  tri(g, [-w, 0, 0], [w, 0, 0], [mx + w * 0.7, my, mz], verde, verde, verde, ARRIBA, R);
  tri(g, [-w, 0, 0], [mx + w * 0.7, my, mz], [mx - w * 0.7, my, mz], verde, verde, verde, ARRIBA, R);
  tri(g, [mx - w * 0.7, my, mz], [mx + w * 0.7, my, mz], [hx, alto, hz], verde, verde, verde, ARRIBA, R);
  return [hx, alto, hz];
}
function geoMargarita(sem) {
  const q = azar(sem), g = malla(), R = [0, 0], alto = 0.14, ang = q() * 6.28;
  const en = cabeza(...tallo(g, alto, alto * (0.1 + 0.12 * q()), ang, R));
  const blanco = col(0xe4e9ee), punta = col(0xdcd0dc), amarillo = col(0xe9be3a), centro = col(0xc0902a);
  for (let p = 0; p < 12; p++) {
    const a = (p / 12) * 6.2832 + q() * 0.12, rp = 0.027 * (0.88 + 0.2 * q());
    const b1 = en(0.007, a - 0.0024 / 0.007), b2 = en(0.007, a + 0.0024 / 0.007), m1 = en(0.017, a - 0.0042 / 0.017, -0.001), m2 = en(0.017, a + 0.0042 / 0.017, -0.001), t = en(rp, a, -0.003);
    tri(g, b1, b2, m2, blanco, blanco, blanco, ARRIBA, R);
    tri(g, b1, m2, m1, blanco, blanco, blanco, ARRIBA, R);
    tri(g, m1, m2, t, blanco, blanco, punta, ARRIBA, R);
  }
  for (let p = 0; p < 7; p++) tri(g, en(0, 0, 0.0055), en(0.0085, (p / 7) * 6.2832, 0.0012), en(0.0085, ((p + 1) / 7) * 6.2832, 0.0012), amarillo, centro, centro, ARRIBA, R);
  return geometria(g);
}
function geoBoton(sem) {
  const q = azar(sem), g = malla(), R = [0, 0], alto = 0.17;
  const en = cabeza(...tallo(g, alto, alto * (0.1 + 0.12 * q()), q() * 6.28, R));
  const am = col(0xedc53a), osc = col(0xc8952a);
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * 6.2832 + q() * 0.2;
    tri(g, en(0.002, a - 0.5), en(0.002, a + 0.5), en(0.015, a + 0.3, 0.008), osc, osc, am, ARRIBA, R);
    tri(g, en(0.002, a - 0.5), en(0.015, a + 0.3, 0.008), en(0.015, a - 0.3, 0.008), osc, am, am, ARRIBA, R);
  }
  return geometria(g);
}
function geoTrebol(sem) {
  const q = azar(sem), g = malla(), verde = col(0x557434), claro = col(0x7d9a4d), tal = col(0x5b7038);
  for (let k = 0; k < 9; k++) {
    const a0 = q() * 6.2832, rad = 0.1 * Math.sqrt(q()), x = Math.cos(a0) * rad, z = Math.sin(a0) * rad;
    const y = 0.025 + q() * 0.04, s = 0.012 + q() * 0.008, giro = q() * 6.2832, R = [x, z];
    tri(g, [x - 0.0015, 0, z], [x + 0.0015, 0, z], [x, y, z], tal, tal, tal, ARRIBA, R);
    for (let f = 0; f < 3; f++) {
      const a = giro + f * 2.094, ax = Math.cos(a), az = Math.sin(a);
      const pts = [-0.75, -0.25, 0.25, 0.75].map((w) => { const b = a + w * 0.9, l = w * w < 0.1 ? 1.05 : 0.9; return [x + Math.cos(b) * s * l, y + s * 0.25, z + Math.sin(b) * s * l]; });
      const o = [x + ax * s * 0.08, y, z + az * s * 0.08];
      for (let t = 0; t < 3; t++) tri(g, o, pts[t], pts[t + 1], verde, t === 1 ? claro : verde, verde, ARRIBA, R);
    }
  }
  return geometria(g);
}

// ---------------- el sombreador (el de la parcela, sin lo del charco): viento + fisica por hoja, y el anillo ----------------
const H_REF = 0.25;
function materialHierba(tono, comunes) {
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, side: THREE.DoubleSide });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, comunes);
    s.vertexShader = `attribute vec2 raiz;
uniform float uTiempo;
uniform sampler2D uCampo;
uniform vec2 uCampoOrigen;
uniform float uCampoLado;
uniform vec3 uFoco;
` + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 base = (instanceMatrix * vec4(raiz.x, 0.0, raiz.y, 1.0)).xyz;
        vec3 ex = instanceMatrix[0].xyz, ey = instanceMatrix[1].xyz, ez = instanceMatrix[2].xyz;
        float hy = max(0.0, position.y) * length(ey);
        float k = hy / ${H_REF.toFixed(2)};
        float doblez = k < 1.0 ? k * k : 1.0 + 0.55 * (k - 1.0);
        float fase = dot(base.xz, vec2(0.085, 0.03)) - uTiempo * 0.5;
        float racha = pow(0.5 + 0.5 * sin(fase * 6.2832), 3.0);
        float temblor = sin(uTiempo * 2.6 + base.x * 3.7 + base.z * 2.3) * 0.5 + sin(uTiempo * 4.3 + base.z * 5.9) * 0.25;
        vec3 d = vec3(0.92, 0.0, 0.38) * (0.012 + 0.05 * racha + 0.012 * temblor) * doblez;
        vec2 uv = (base.xz - uCampoOrigen) / uCampoLado;
        if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) {
          vec4 c = texture2D(uCampo, uv);
          d.xz += c.xy * doblez;
          d.y -= hy * 0.55 * c.z;
          vColor.rgb *= mix(vec3(1.0), vec3(1.3, 1.24, 1.02), c.z);
        }
        float h = max(hy, 1e-3);
        float l = min(length(d.xz), 0.95 * h);
        d.y -= h - sqrt(h * h - l * l);
        // el anillo: en el borde se encoge (alli entra la hierba de siempre)
        float queda = 1.0 - smoothstep(${ENTRA[0].toFixed(1)}, ${ENTRA[1].toFixed(1)}, distance(instanceMatrix[3].xz, uFoco.xz));
        vec3 loc = vec3(dot(ex, d) / dot(ex, ex), dot(ey, d) / dot(ey, ey), dot(ez, d) / dot(ez, ez));
        transformed = (transformed + loc) * queda;
      }`);
    s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
  };
  mat.customProgramCacheKey = () => 'hierba-fina';
  return mat;
}

// ---------------- los trozos ----------------
export function crearHierbaFina({ grupo, comunes, tono }) {
  const mat = materialHierba(tono, comunes);
  const geos = {
    matas: [0, 1, 2].map((i) => [geoMata(40 + i), geoMata(40 + i, 1)]), cesped: [geoCesped(80), geoCesped(81)],
    margarita: geoMargarita(101), boton: geoBoton(111), trebol: geoTrebol(121),
  };
  const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), sv = new THREE.Vector3();
  const cc = new THREE.Color(), cv = new THREE.Color();
  const cub = { mata: 0, alto: 1, flor: 0, florTipo: 0, seco: 0 };
  const corto = (x, z) => suave(0.58, 0.68, fbm(x / 3.6 - 11, z / 3.6 + 40, 3));
  const trebol = (x, z) => corto(x, z) * suave(0.5, 0.6, fbm(x / 1.6 + 3, z / 1.6 - 8, 3));
  const corro = (x, z) => suave(0.57, 0.68, fbm(x / 2.6 + 70, z / 2.6 - 30, 3));

  function instancias(geo, lista, nombre) {
    const im = new THREE.InstancedMesh(geo, mat, lista.length);
    lista.forEach((m, i) => {
      im.setMatrixAt(i, mt.compose(v3.set(m.x, m.y, m.z), q.setFromAxisAngle(Y, m.giro), sv.set(m.s, m.sy, m.s)));
      im.setColorAt(i, cc.setRGB(m.r, m.g, m.b));
    });
    im.receiveShadow = true;
    im.computeBoundingSphere();
    im.name = nombre;
    return im;
  }
  const nT = Math.round((2 * EXT) / CH), trozos = new Map();
  let cuenta = 0;
  let msMax = 0;
  function hacer(i, j) {
    const t0 = performance.now();
    const x0 = -EXT + i * CH, z0 = -EXT + j * CH, r = azar(5100 + j * 7919 + i * 31);
    // la cubierta en una rejilla de 1 m (para no preguntar por cada mata) y el color de alli dividido por el verde medio
    const n1 = CH + 1, C = [];
    for (let b = 0; b < n1; b++) for (let a = 0; a < n1; a++) {
      const x = x0 + a, z = z0 + b, c = cubierta(x, z, cub);
      colorHierba(x, z, cv, c);
      C.push({ mata: c.mata, alto: c.alto, flor: c.flor, florTipo: c.florTipo, seco: c.seco, r: cv.r / REF.r, g: cv.g / REF.g, b: cv.b / REF.b });
    }
    const en = (x, z) => C[Math.min(CH, Math.max(0, Math.round(z - z0))) * n1 + Math.min(CH, Math.max(0, Math.round(x - x0)))];
    const listas = { mata0: [], mata1: [], mata2: [], cesped0: [], cesped1: [], margarita: [], boton: [], trebol: [] };
    const color = (o, c, k) => { o.r = Math.min(2.6, c.r * k); o.g = Math.min(2.6, c.g * k); o.b = Math.min(2.6, c.b * k); return o; };
    // matas: rejilla de 13 cm con temblor (alguna suelta mas alta: la textura de la pradera)
    const SM = 0.13, nm = Math.round(CH / SM);
    for (let gz = 0; gz < nm; gz++) {
      for (let gx = 0; gx < nm; gx++) {
        const x = x0 + (gx + 0.15 + r() * 0.7) * SM, z = z0 + (gz + 0.15 + r() * 0.7) * SM;
        const c = en(x, z), tr = trebol(x, z);
        if (r() > c.mata * (1 - 0.55 * tr)) continue;
        const alto = Math.min(1.55, c.alto * 1.05 * (0.75 + 0.5 * r()) * (r() < 0.06 ? 1.45 : 1));
        listas['mata' + Math.floor(r() * 3)].push(color({ x, y: altura(x, z) - 0.004, z, giro: r() * 6.28, s: 0.85 + 0.3 * r(), sy: alto * 1.1 }, c, 0.9 + 0.2 * r()));
      }
    }
    // cesped corto: rejilla de 17 cm
    const SC = 0.17, ncs = Math.round(CH / SC);
    for (let gz = 0; gz < ncs; gz++) {
      for (let gx = 0; gx < ncs; gx++) {
        const x = x0 + (gx + 0.1 + r() * 0.8) * SC, z = z0 + (gz + 0.1 + r() * 0.8) * SC;
        const c = en(x, z);
        if (r() > c.mata * 0.95) continue;
        listas['cesped' + Math.floor(r() * 2)].push(color({ x, y: altura(x, z) - 0.003, z, giro: r() * 6.28, s: 0.9 + 0.25 * r(), sy: 0.8 + 0.5 * r() }, c, 0.92 + 0.16 * r()));
      }
    }
    // trebol en los praditos y flores en corros (margaritas y botones de oro segun el sitio)
    const SF = 0.26, nf = Math.round(CH / SF);
    for (let gz = 0; gz < nf; gz++) {
      for (let gx = 0; gx < nf; gx++) {
        const x = x0 + (gx + r()) * SF, z = z0 + (gz + r()) * SF;
        const c = en(x, z);
        if (c.mata < 0.5) continue;
        const tr = trebol(x, z) * (1 - c.seco);
        if (r() < tr * 0.9) listas.trebol.push({ x, y: altura(x, z) - 0.002, z, giro: r() * 6.28, s: 0.9 + 0.4 * r(), sy: 0.9 + 0.3 * r(), r: 0.9 + 0.2 * r(), g: 1, b: 0.95 });
        if (r() < corro(x, z) * (0.3 + 1.6 * c.flor) * 0.6 + 0.008) {
          const alto = (0.6 + 0.5 * r()) * (0.55 + 0.75 * c.alto * 0.8);
          listas[c.florTipo === 1 || c.florTipo === 3 ? 'boton' : 'margarita'].push({ x, y: altura(x, z) - 0.002, z, giro: r() * 6.28, s: Math.sqrt(alto), sy: alto, r: 1, g: 1, b: 1 });
        }
      }
    }
    const t = { cx: x0 + CH / 2, cz: z0 + CH / 2, grupo: new THREE.Group(), matas: [], cesped: [], n: 0 };
    for (const [k, l] of Object.entries(listas)) {
      if (!l.length) continue;
      const geo = k.startsWith('mata') ? geos.matas[+k[4]][0] : k.startsWith('cesped') ? geos.cesped[+k[6]] : geos[k];
      const im = instancias(geo, l, k);
      if (k.startsWith('mata')) { im.userData.lod = geos.matas[+k[4]]; t.matas.push(im); }
      if (k.startsWith('cesped') || k === 'trebol') t.cesped.push(im);
      t.grupo.add(im);
      t.n += l.length;
    }
    t.grupo.name = 'hierba_fina';
    grupo.add(t.grupo);
    cuenta += t.n;
    msMax = Math.max(msMax, Math.round(performance.now() - t0));
    return t;
  }
  function tirar(k) {
    const t = trozos.get(k);
    t.grupo.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    grupo.remove(t.grupo);
    cuenta -= t.n;
    trozos.delete(k);
  }
  const dTrozo = (t, x, z) => Math.hypot(Math.max(Math.abs(t.cx - x) - CH / 2, 0), Math.max(Math.abs(t.cz - z) - CH / 2, 0));
  let hechos = 0;
  function actualizar(foco, forzar = false) {
    const fi = Math.floor((foco.x + EXT) / CH), fj = Math.floor((foco.z + EXT) / CH), R = Math.ceil(HACER / CH);
    const faltan = [];
    for (let j = Math.max(0, fj - R); j <= Math.min(nT - 1, fj + R); j++) {
      for (let i = Math.max(0, fi - R); i <= Math.min(nT - 1, fi + R); i++) {
        const k = j * 10000 + i;
        if (trozos.has(k)) continue;
        const d = dTrozo({ cx: -EXT + i * CH + CH / 2, cz: -EXT + j * CH + CH / 2 }, foco.x, foco.z);
        if (d <= HACER) faltan.push([d, i, j, k]);
      }
    }
    faltan.sort((a, b) => a[0] - b[0]);
    for (const [, i, j, k] of forzar ? faltan : faltan.slice(0, 1)) { trozos.set(k, hacer(i, j)); hechos++; }
    for (const [k, t] of trozos) {
      const d = dTrozo(t, foco.x, foco.z);
      if (d > TIRAR) { tirar(k); continue; }
      t.grupo.visible = d < ENTRA[1];
      // de cerca las matas con sus tres tramos; mas alla, de un tramo
      const lod = d < LOD ? 0 : 1;
      if (t.lod !== lod) { t.lod = lod; for (const im of t.matas) im.geometry = im.userData.lod[lod]; }
      for (const im of t.cesped) im.visible = d < CESPED;
    }
  }
  function tirarZona(x0, z0, x1, z1) {
    for (const [k, t] of trozos) if (!(t.cx + CH / 2 < x0 || t.cx - CH / 2 > x1 || t.cz + CH / 2 < z0 || t.cz - CH / 2 > z1)) tirar(k);
  }
  return { actualizar, tirarZona, info: () => ({ trozosHierbaFina: trozos.size, plantasFinas: cuenta, msTrozoHierbaFina: msMax }) };
}
