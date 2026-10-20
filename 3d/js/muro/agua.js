// El AGUA del muro: el arroyo (una cinta a la cota de su nivel, que baja del manantial a la charca) y la charca (un
// disco con su orilla irregular). Las dos se meten un poco bajo las orillas: la linea del agua la dibuja el propio
// terreno al cortarla. Cada vertice sabe lo hondo que hay debajo (atributo `hondo`): claro y transparente en lo somero,
// oscuro en lo hondo, espuma en la orilla y en los vados; ondas que corren aguas abajo y destellos en escalones, como
// el tono del 18. Y nenufares en la charca.
import * as THREE from 'three';
import { azar } from '../texturas.js';
import { ARROYO, CHARCA, NIVEL_CHARCA, radioCharca, dnCharca, cauce, altura } from './suelo.js';

const VERT = `
attribute float hondo;
varying float vHondo;
varying vec2 vUv;
varying vec3 vMundo;
#include <fog_pars_vertex>
void main() {
  vHondo = hondo;
  vUv = uv;
  vec4 mundo = modelMatrix * vec4(position, 1.0);
  vMundo = mundo.xyz;
  vec4 mvPosition = viewMatrix * mundo;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = `
uniform float uTiempo;
uniform float uFlujo;
uniform vec3 uHondo;
uniform vec3 uClaro;
uniform vec3 uCielo;
uniform vec3 uEspuma;
varying float vHondo;
varying vec2 vUv;
varying vec3 vMundo;
#include <common>
#include <fog_pars_fragment>
void main() {
  float h = vHondo;
  vec2 p = vUv;
  float t = uTiempo;
  // ondas: en el arroyo corren aguas abajo (u = metros desde el manantial); en la charca, solo se mecen
  float a = sin(p.x * 1.9 - t * 2.4 * uFlujo + sin(p.y * 2.6 + p.x * 0.35) * 1.6) * sin(p.y * 3.7 - p.x * 0.6 + t * 0.8);
  float b = sin(p.x * 0.7 + p.y * 1.1 + t * 0.9) * sin(p.x * 1.3 - p.y * 0.9 - t * 0.6);
  float rizo = a * 0.65 + b * 0.35;
  vec3 col = mix(uClaro, uHondo, smoothstep(0.03, 0.55, h));
  // el cielo encima, mas cuanto mas rasante se mira
  vec3 V = normalize(cameraPosition - vMundo);
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
  col = mix(col, uCielo, 0.22 + 0.6 * fres);
  // crestas y destellos, en escalones
  col = mix(col, uCielo * 1.08, step(0.55, rizo) * 0.16);
  col = mix(col, uEspuma, step(0.84, rizo) * 0.5);
  // espuma en la orilla (a rachas) y donde el agua corre sobre poco fondo
  float orilla = 1.0 - smoothstep(0.02, 0.085, h);
  float rachas = step(0.15, sin(p.x * 2.7 + p.y * 1.9 - t * 1.4 * (0.4 + uFlujo)) + 0.6 * sin(p.x * 5.1 - t));
  col = mix(col, uEspuma, orilla * (0.45 + 0.4 * rachas));
  float alfa = mix(0.42, 0.9, smoothstep(0.0, 0.5, h));
  gl_FragColor = vec4(col, max(alfa, orilla * 0.85));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function material(flujo, comunes) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uFlujo: { value: flujo },
      uHondo: { value: new THREE.Color(0x3f5b52) }, uClaro: { value: new THREE.Color(0x8fa184) },
      uCielo: { value: new THREE.Color(0xc9cdb4) }, uEspuma: { value: new THREE.Color(0xe9e6d6) },
    }]),
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true,
  });
}

export function crearAgua(grupo, tono) {
  const comunes = { uTiempo: { value: 0 } };
  const mats = [];
  // ---------------- el arroyo ----------------
  {
    const A = 9;                                 // vertices a lo ancho
    const pos = [], uv = [], hondo = [], idx = [];
    let filas = 0;
    for (let k = 0; k < ARROYO.pts.length; k++) {
      const p = ARROYO.pts[k];
      if (dnCharca(p.x, p.z) < 0.92) break;     // dentro de la charca manda el disco
      const q = ARROYO.pts[Math.min(ARROYO.pts.length - 1, k + 1)], o = ARROYO.pts[Math.max(0, k - 1)];
      const tx = q.x - o.x, tz = q.z - o.z, l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
      const c = cauce(ARROYO.s[k]);
      const media = c.ancho + 0.75;
      for (let m = 0; m < A; m++) {
        const v = (m / (A - 1)) * 2 - 1;
        const x = p.x + nx * v * media, z = p.z + nz * v * media;
        pos.push(x, c.W, z);
        uv.push(ARROYO.s[k], v * media);
        hondo.push(c.W - altura(x, z));
      }
      filas++;
    }
    for (let f = 0; f < filas - 1; f++) {
      for (let m = 0; m < A - 1; m++) {
        const a = f * A + m, b = a + 1, c = a + A, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('hondo', new THREE.Float32BufferAttribute(hondo, 1));
    g.setIndex(idx);
    const m = material(1, comunes);
    m.uniforms.uTiempo = comunes.uTiempo;
    const malla = new THREE.Mesh(g, m);
    malla.name = 'arroyo';
    malla.renderOrder = 1;
    grupo.add(malla);
    mats.push(m);
  }
  // ---------------- la charca ----------------
  {
    const AN = 72, AN_R = 14;                    // vueltas y anillos (hasta 1,15 del radio: bajo la orilla)
    const pos = [CHARCA.x, NIVEL_CHARCA, CHARCA.z], uv = [CHARCA.x * 0.6, CHARCA.z * 0.6], hondo = [NIVEL_CHARCA - altura(CHARCA.x, CHARCA.z)], idx = [];
    for (let k = 1; k <= AN_R; k++) {
      const dn = (k / AN_R) * 1.15;
      for (let i = 0; i < AN; i++) {
        const a = (i / AN) * Math.PI * 2, R = radioCharca(a) * dn;
        const x = CHARCA.x + Math.cos(a) * R, z = CHARCA.z + Math.sin(a) * R;
        pos.push(x, NIVEL_CHARCA, z);
        uv.push(x * 0.6, z * 0.6);
        hondo.push(NIVEL_CHARCA - altura(x, z));
      }
    }
    for (let i = 0; i < AN; i++) idx.push(0, 1 + ((i + 1) % AN), 1 + i);
    for (let k = 1; k < AN_R; k++) {
      for (let i = 0; i < AN; i++) {
        const a = 1 + (k - 1) * AN + i, b = 1 + (k - 1) * AN + ((i + 1) % AN), c = a + AN, d = b + AN;
        idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('hondo', new THREE.Float32BufferAttribute(hondo, 1));
    g.setIndex(idx);
    const m = material(0, comunes);
    m.uniforms.uTiempo = comunes.uTiempo;
    const malla = new THREE.Mesh(g, m);
    malla.name = 'charca';
    malla.renderOrder = 1;
    grupo.add(malla);
    mats.push(m);
  }
  // ---------------- nenufares ----------------
  {
    // una hoja: un poligono de 9 lados con su muesca, plano sobre el agua
    const pos = [], col = [];
    const L = 9;
    for (let i = 0; i < L - 1; i++) {
      const a0 = 0.35 + (i / (L - 1)) * (Math.PI * 2 - 0.7), a1 = 0.35 + ((i + 1) / (L - 1)) * (Math.PI * 2 - 0.7);
      pos.push(0, 0, 0, Math.cos(a1), 0, Math.sin(a1), Math.cos(a0), 0, Math.sin(a0));
      const k = 0.92 + 0.12 * ((i * 7) % 3) / 2;
      for (let v = 0; v < 3; v++) col.push(k, k, k);
    }
    const hoja = new THREE.BufferGeometry();
    hoja.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    hoja.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    hoja.computeVertexNormals();
    const r = azar(404), lista = [];
    for (let k = 0; k < 160 && lista.length < 34; k++) {
      const a = r() * Math.PI * 2, dn = Math.sqrt(r()) * 0.82;
      const R = radioCharca(a) * dn, x = CHARCA.x + Math.cos(a) * R, z = CHARCA.z + Math.sin(a) * R;
      // en corros: cerca de la orilla del norte y del sur
      if (Math.abs(Math.sin(a)) < 0.35 && r() < 0.8) continue;
      if (lista.some((o) => Math.hypot(o.x - x, o.z - z) < o.s + 0.32)) continue;
      lista.push({ x, z, s: 0.18 + r() * 0.2, giro: r() * 6.28 });
    }
    const im = new THREE.InstancedMesh(hoja, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, side: THREE.DoubleSide }), lista.length);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    lista.forEach((o, i) => {
      mt.compose(new THREE.Vector3(o.x, NIVEL_CHARCA + 0.006, o.z), q.setFromAxisAngle(Y, o.giro), new THREE.Vector3(o.s, 1, o.s));
      im.setMatrixAt(i, mt);
      im.setColorAt(i, c.setHex(0x5f7a3f).multiplyScalar(0.85 + r() * 0.3));
    });
    im.computeBoundingSphere();
    im.name = 'nenufares';
    grupo.add(im);
    // y alguna flor blanca encima: un cono bajo de 6 petalos
    const flor = new THREE.ConeGeometry(0.05, 0.035, 6, 1, true);
    flor.rotateX(Math.PI);
    flor.translate(0, 0.02, 0);
    const conFlor = lista.filter((_, i) => i % 4 === 1);
    const fm = new THREE.InstancedMesh(flor, new THREE.MeshToonMaterial({ color: 0xf3eee2, gradientMap: tono, side: THREE.DoubleSide }), conFlor.length);
    conFlor.forEach((o, i) => {
      mt.compose(new THREE.Vector3(o.x + Math.cos(o.giro) * o.s * 0.3, NIVEL_CHARCA + 0.01, o.z + Math.sin(o.giro) * o.s * 0.3), q.identity(), new THREE.Vector3(1, 1, 1));
      fm.setMatrixAt(i, mt);
    });
    fm.computeBoundingSphere();
    fm.name = 'flores_nenufar';
    grupo.add(fm);
  }
  return {
    actualizar(t) { comunes.uTiempo.value = t; },
    materiales: mats,
  };
}
