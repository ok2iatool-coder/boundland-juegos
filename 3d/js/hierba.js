// La HIERBA del mapa del muro, en LOW POLY como el 18, con FISICA (hierba_fisica.js).
//
// MUCHA hierba, FINA y mas BAJA que el 18 (12-30 cm: le llega a la rodilla o a la cadera, que tiene a 22 cm): cada
// instancia es un MATOJO de 30 hojas finas (1,2-2 cm de ancho) repartidas en un circulo de 24 cm, y los matojos van
// cada 42 cm, asi que se solapan y hacen alfombra. Hojas planas con la normal hacia ARRIBA (se alumbran como el suelo;
// con la suya, las de espaldas al sol salian negras), oscuras en la base y claras en la punta, alguna mas pajiza; las
// altas de dos tramos (curvas). Y espigas sueltas que asoman por encima.
//
// Cada hoja guarda su RAIZ (atributo `raiz`): el viento y el campo de fisica se leen en la raiz de cada hoja, no en el
// centro del matojo, asi el 18 abre la hierba hoja a hoja.
//
// Tanta hierba no cabe entera en todo el mapa: por trozos de 30 m, la mitad de los matojos (al tresbolillo) se hace al
// cargar y llega hasta ~70 m (se encoge entre 56 y 72); la otra mitad y las espigas se hacen la primera vez que el 18
// se acerca a un trozo y se encogen entre 24 y 34 m. Mas alla, el color del suelo y la niebla.
import * as THREE from 'three';
import { azar } from './texturas.js';
import { crearCampo } from './hierba_fisica.js';

const CH = 30;                    // m de cada trozo
const SEP = 0.42;                 // m entre matojos
const H_REF = 0.25;               // m: la altura a la que el campo da el desplazamiento de la punta
const RALO_FUNDE = [56, 72];      // m en que se encoge la mitad que llega lejos
const DENSO_FUNDE = [24, 34];     // m en que se encoge la otra mitad
const ESPIGA_FUNDE = [26, 36];
const HACER_CERCA = 40;           // m (del 18 al trozo) a los que se hace lo de cerca

// ---------------- geometria ----------------
// una hoja con raiz en (x0, z0) del matojo: uno o dos tramos; base, medio y punta con su tono
function hoja(g, { x0, z0, ang, alto, ancho, inclina, tinte, tramos }) {
  const cx = Math.cos(ang), cz = Math.sin(ang), px = -cz, pz = cx;
  const p = (o, y, w) => [x0 + cx * o + px * w, y, z0 + cz * o + pz * w];
  const tri = (a, b, c, ka, kb, kc) => {
    g.pos.push(...a, ...b, ...c);
    for (const k of [ka, kb, kc]) g.col.push(tinte[0] * k, tinte[1] * k, tinte[2] * k);
    for (let i = 0; i < 3; i++) g.raiz.push(x0, z0);
  };
  const bL = p(0, 0, -ancho), bR = p(0, 0, ancho), punta = p(inclina, alto, 0);
  if (tramos === 1) { tri(bL, bR, punta, 0.55, 0.55, 1.12); return; }
  // el tramo de arriba se tumba mas que el de abajo: la hoja sale curva
  const mL = p(inclina * 0.3, alto * 0.55, -ancho * 0.6), mR = p(inclina * 0.3, alto * 0.55, ancho * 0.6);
  tri(bL, bR, mR, 0.5, 0.5, 0.84);
  tri(bL, mR, mL, 0.5, 0.84, 0.84);
  tri(mL, mR, punta, 0.84, 0.84, 1.14);
}

function geometria(g) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
  geo.setAttribute('raiz', new THREE.Float32BufferAttribute(g.raiz, 2));
  const n = new Float32Array(g.pos.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;          // normal arriba
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return geo;
}

// el tinte de cada hoja: casi todas del verde del matojo; alguna mas pajiza, alguna mas oscura
function tinte(r) {
  const u = r();
  if (u < 0.18) return [1.1, 1.05, 0.78];
  if (u < 0.34) return [0.84, 0.9, 0.84];
  return [1, 1, 1];
}

export function matojo() {
  const r = azar(5), g = { pos: [], col: [], raiz: [] };
  for (let h = 0; h < 30; h++) {
    const rad = 0.24 * Math.sqrt(r()), a = r() * 6.2832;
    const alto = 0.1 + 0.2 * Math.pow(r(), 0.8);
    hoja(g, { x0: Math.cos(a) * rad, z0: Math.sin(a) * rad, ang: a + (r() - 0.5) * 1.6, alto,
      ancho: 0.006 + r() * 0.004, inclina: alto * (0.1 + r() * 0.35), tinte: tinte(r), tramos: alto > 0.22 ? 2 : 1 });
  }
  return geometria(g);
}

export function espiga() {
  const r = azar(41), g = { pos: [], col: [], raiz: [] };
  const paja = [0.82, 0.72, 0.48];
  for (let h = 0; h < 2; h++) {
    const ang = h * 2.6 + r(), alto = 0.32 + r() * 0.1, inc = alto * (0.08 + r() * 0.1);
    const x0 = (r() - 0.5) * 0.04, z0 = (r() - 0.5) * 0.04;
    hoja(g, { x0, z0, ang, alto, ancho: 0.004, inclina: inc, tinte: [0.74, 0.74, 0.55], tramos: 2 });
    // la espiga: un rombo alargado en la punta del tallo
    const cx = Math.cos(ang), cz = Math.sin(ang), px = -cz, pz = cx;
    const tx = x0 + cx * inc, tz = z0 + cz * inc;
    const a = [tx - cx * 0.008, alto - 0.08, tz - cz * 0.008], b = [tx + px * 0.014, alto - 0.035, tz + pz * 0.014];
    const c = [tx + cx * 0.01, alto + 0.02, tz + cz * 0.01], d = [tx - px * 0.014, alto - 0.035, tz - pz * 0.014];
    for (const t of [[a, b, c], [a, c, d]]) {
      for (const v of t) { g.pos.push(...v); g.col.push(...paja); g.raiz.push(x0, z0); }
    }
  }
  return geometria(g);
}

// ---------------- sombreador: viento + campo, por hoja ----------------
// `porCamara`: ademas de lejos del 18, se encoge lejos de la CAMARA (en el mundo grande, vista desde arriba, la hierba
// de cerca no queda como un circulo sobre el suelo)
export function material(tono, comunes, funde, { porCamara = false, entra = null } = {}) {
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, side: THREE.DoubleSide });
  mat.defines = {};
  if (porCamara) mat.defines.POR_CAMARA = '';
  // `entra`: cerca del foco no se dibuja (alli va otra hierba, la fina del mapa del mundo) y aparece entre entra[0] y entra[1]
  if (entra) mat.defines.ENTRA = `vec2(${entra[0].toFixed(2)}, ${entra[1].toFixed(2)})`;
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, comunes, { uFunde: { value: new THREE.Vector2(...funde) } });
    s.vertexShader = `attribute vec2 raiz;
uniform float uTiempo;
uniform sampler2D uCampo;
uniform vec2 uCampoOrigen;
uniform float uCampoLado;
uniform vec3 uFoco;
uniform vec2 uFunde;
` + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        // la raiz de ESTA hoja en el mundo; el desplazamiento se calcula en el mundo y se pasa al espacio del matojo
        vec3 base = (instanceMatrix * vec4(raiz.x, 0.0, raiz.y, 1.0)).xyz;
        mat3 m = mat3(instanceMatrix);
        float s2 = dot(m[0], m[0]);
        float hy = max(0.0, position.y) * length(m[1]);      // m sobre la raiz
        float k = hy / ${H_REF.toFixed(2)};
        float doblez = k * k;
        // viento: rachas que cruzan la pradera de oeste a este, y un temblor
        float fase = dot(base.xz, vec2(0.085, 0.03)) - uTiempo * 0.5;
        float racha = pow(0.5 + 0.5 * sin(fase * 6.2832), 3.0);
        float temblor = sin(uTiempo * 2.6 + base.x * 1.7 + base.z * 1.3) * 0.5 + sin(uTiempo * 4.1 + base.z * 2.9) * 0.25;
        vec3 d = vec3(0.92, 0.0, 0.38) * (0.014 + 0.06 * racha + 0.012 * temblor) * doblez;
        // la FISICA: la textura da cuanto se desplaza la punta a ${H_REF} m (pies, cuerpo, capa, caidas) y lo aplastada
        vec2 uv = (base.xz - uCampoOrigen) / uCampoLado;
        if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) {
          vec4 c = texture2D(uCampo, uv);
          d.xz += c.xy * doblez;
          d.y -= hy * 0.55 * c.z;
        }
        // la hoja no se estira: al ladearse, baja
        float h = max(hy, 1e-3);
        float l = min(length(d.xz), 0.95 * h);
        d.y -= h - sqrt(h * h - l * l);
        // a lo lejos el matojo se encoge hasta desaparecer (cada mitad a su distancia)
        float dq = distance(instanceMatrix[3].xz, uFoco.xz);
        #ifdef POR_CAMARA
        dq = max(dq, distance((modelMatrix * instanceMatrix[3]).xyz, cameraPosition) - 12.0);
        #endif
        float queda = 1.0 - smoothstep(uFunde.x, uFunde.y, dq);
        #ifdef ENTRA
        queda *= smoothstep(ENTRA.x, ENTRA.y, distance(instanceMatrix[3].xz, uFoco.xz));
        #endif
        transformed = (transformed + transpose(m) * d / s2) * queda;
      }`);
  };
  return mat;
}

export function crearHierba({ grupo, LADO, suelo, tono }) {
  const { altura, bordeCamino, color, fbm, suave } = suelo;
  const campo = crearCampo({ lado: 24, celda: 0.25 });
  const datos = new Uint16Array(campo.n * campo.n * 4);
  const tex = new THREE.DataTexture(datos, campo.n, campo.n, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const comunes = {
    uTiempo: { value: 0 }, uCampo: { value: tex }, uCampoOrigen: { value: new THREE.Vector2() },
    uCampoLado: { value: campo.lado }, uFoco: { value: new THREE.Vector3() },
  };
  const geo = { matojo: matojo(), espiga: espiga() };
  const mat = { ralo: material(tono, comunes, RALO_FUNDE), denso: material(tono, comunes, DENSO_FUNDE), espiga: material(tono, comunes, ESPIGA_FUNDE) };
  const _c = new THREE.Color(), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  const v3 = new THREE.Vector3(), sv = new THREE.Vector3();

  function instancias(geometria, materialDe, lista, nombre) {
    const im = new THREE.InstancedMesh(geometria, materialDe, lista.length);
    lista.forEach((m, i) => {
      q.setFromAxisAngle(Y, m.giro);
      mt.compose(v3.set(m.x, m.y, m.z), q, sv.set(m.s, m.sy, m.s));
      im.setMatrixAt(i, mt);
      im.setColorAt(i, _c.setRGB(m.r, m.g, m.b));
    });
    im.receiveShadow = true;
    im.computeBoundingSphere();
    im.name = nombre;
    return im;
  }

  // los matojos de un trozo, de la mitad `par` (0 = la que llega lejos, 1 = la de cerca), al tresbolillo. Siempre se
  // recorre la rejilla entera con la misma semilla y los mismos numeros al azar por casilla: las dos mitades casan
  const porLado = Math.round((2 * LADO) / CH);
  function matojos(t, par) {
    const r = azar(500 + t.cj * porLado + t.ci), lista = [];
    const nc = Math.round(CH / SEP);
    for (let gz = 0; gz < nc; gz++) {
      for (let gx = 0; gx < nc; gx++) {
        const jx = r(), jz = r(), giro = r() * 6.2832, rs = r(), ry = r(), rc = r();
        if (((gx + gz) & 1) !== par) continue;
        const x = t.x0 + (gx + 0.15 + jx * 0.7) * SEP, z = t.z0 + (gz + 0.15 + jz * 0.7) * SEP;
        const b = bordeCamino(x, z);
        if (b < 0.1) continue;                     // las hojas llegan 24 cm del centro: que no pisen el camino
        const alta = 0.75 + 0.5 * suave(0.3, 0.75, fbm(x / 13 + 5, z / 13 + 1, 3));
        const s = alta * (0.85 + rs * 0.3) * (0.55 + 0.45 * suave(0.1, 0.6, b));
        color(x, z, _c).multiplyScalar(1.0 + rc * 0.14);
        lista.push({ x, y: altura(x, z) - 0.015, z, giro, s, sy: s * (0.88 + ry * 0.24), r: _c.r, g: _c.g, b: _c.b, alta });
      }
    }
    return lista;
  }

  const trozos = [];
  let nRalos = 0;
  for (let cj = 0; cj < porLado; cj++) {
    for (let ci = 0; ci < porLado; ci++) {
      const t = { ci, cj, x0: -LADO + ci * CH, z0: -LADO + cj * CH, ralo: null, cerca: null };
      const lista = matojos(t, 0);
      if (lista.length) { t.ralo = instancias(geo.matojo, mat.ralo, lista, 'hierba_ralo'); grupo.add(t.ralo); }
      nRalos += lista.length;
      trozos.push(t);
    }
  }

  // la otra mitad y las espigas de un trozo, la primera vez que hace falta
  let nDensos = 0, nEspigas = 0;
  function hacerCerca(t) {
    const g = new THREE.Group();
    g.name = 'hierba_cerca';
    const lista = matojos(t, 1);
    if (lista.length) g.add(instancias(geo.matojo, mat.denso, lista, 'hierba_denso'));
    // espigas: sueltas, mas donde la hierba es alta
    const r = azar(9000 + t.cj * porLado + t.ci), espigas = [];
    for (const m of lista) {
      if (r() > 0.05 * (m.alta - 0.6)) continue;
      const s = 0.85 + r() * 0.35;
      espigas.push({ x: m.x + (r() - 0.5) * 0.3, y: m.y, z: m.z + (r() - 0.5) * 0.3, giro: r() * 6.283, s, sy: s, r: 1, g: 1, b: 1 });
    }
    if (espigas.length) g.add(instancias(geo.espiga, mat.espiga, espigas, 'espigas'));
    nDensos += lista.length;
    nEspigas += espigas.length;
    grupo.add(g);
    t.cerca = g;
  }

  const contactos = [];
  function actualizar(t, foco, heroe, dt) {
    comunes.uTiempo.value = t;
    comunes.uFoco.value.copy(foco);
    // por trozo: lo de cerca se hace a menos de HACER_CERCA m (uno por fotograma: hacerlo cuesta unos ms) y se dibuja a
    // menos del final de su fundido; la mitad que llega lejos, a menos del suyo
    let hecho = false;
    for (const tr of trozos) {
      const dx = Math.max(tr.x0 - foco.x, 0, foco.x - (tr.x0 + CH)), dz = Math.max(tr.z0 - foco.z, 0, foco.z - (tr.z0 + CH));
      const d = Math.hypot(dx, dz);
      if (d < HACER_CERCA && !tr.cerca && !hecho) { hacerCerca(tr); hecho = true; }
      if (tr.cerca) tr.cerca.visible = d < Math.max(DENSO_FUNDE[1], ESPIGA_FUNDE[1]);
      if (tr.ralo) tr.ralo.visible = d < RALO_FUNDE[1];
    }
    // la fisica
    if (dt > 0) {
      campo.centrar(foco.x, foco.z);
      campo.paso(dt, heroe && heroe.contactos ? heroe.contactos(contactos) : [], heroe ? heroe.caida : null);
      const [ox, oz] = campo.origen();
      comunes.uCampoOrigen.value.set(ox - campo.celda / 2, oz - campo.celda / 2);
      const h = THREE.DataUtils.toHalfFloat;
      for (let k = 0, n = campo.bx.length; k < n; k++) {
        datos[k * 4] = h(campo.bx[k]);
        datos[k * 4 + 1] = h(campo.bz[k]);
        datos[k * 4 + 2] = h(campo.ap[k]);
      }
      tex.needsUpdate = true;
    }
  }

  return {
    actualizar, campo, trozos, uniformes: comunes,
    info: () => ({ matojosLejos: nRalos, matojosCerca: nDensos, espigas: nEspigas, hojasPorMatojo: 30,
      trozosCerca: trozos.filter((t) => t.cerca && t.cerca.visible).length }),
  };
}
