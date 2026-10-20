// LO COMUN: la paleta (la de la imagen: carbon, gris industrial, pardo desaturado, beige grisaceo, blanco de
// bruma y el naranja calido solo para lo que da luz), el ruido en GLSL, los materiales SUCIOS (mugre, chorretones
// y oxido pardo por posicion del mundo: asi una caja instanciada no repite su textura) y los COLECTORES con los
// que se monta todo: cajas y barras que se juntan en UNA malla instanciada por material.
import * as THREE from 'three';

export const PAL = {
  carbon: '#121110', carbonClaro: '#1c1a18', gris: '#38352f', grisClaro: '#544f47', pardo: '#463b31', oxido: '#5a3e2a',
  beige: '#b8aa93', bruma: '#ae9c84', horizonte: '#f3bf82', cieloAlto: '#3f3b38', naranja: '#ff9440', calido: '#ffc98a',
};

// ---------------------------------------------------------------- ruido
export const RUIDO = /* glsl */ `
float r_hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float r_valor(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(r_hash(i), r_hash(i + vec3(1,0,0)), f.x), mix(r_hash(i + vec3(0,1,0)), r_hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(r_hash(i + vec3(0,0,1)), r_hash(i + vec3(1,0,1)), f.x), mix(r_hash(i + vec3(0,1,1)), r_hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float r_fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * r_valor(p); p *= 2.03; a *= 0.5; } return s; }
`;

// ---------------------------------------------------------------- materiales sucios
// opciones: escala (de la mancha), mugre (0..1), oxido (0..1), chorro (los chorretones verticales), pie (y del suelo:
// por debajo de pie + 1,5 se oscurece, la oclusion barata), luzSol (el canto que mira al horizonte, mas calido)
// rim: el canto que mira al sol (a la derecha y arriba, detras) se enciende calido aunque la cara no se vea.
// ventanas: { w, h, enc } reticula de ventanas por posicion del mundo en las caras que miran a la camara: oscuras,
// alguna que falta, enc de ellas encendidas en calido (y alguna que parpadea, con o.tiempo)
export function sucio(mat, o = {}) {
  const k = { escala: 1.4, mugre: 0.55, oxido: 0.25, chorro: 0.5, pie: -1e4, rim: 0.32, amb: 0, ...o };
  const tiempo = k.tiempo; delete k.tiempo;
  mat.userData.sucio = k;
  mat.customProgramCacheKey = () => 'sucio' + JSON.stringify(k);
  const V = k.ventanas;
  mat.onBeforeCompile = (sh) => {
    if (tiempo) sh.uniforms.uTiempo = tiempo;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSucioPos; varying vec3 vSucioN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      { vec4 sp = vec4(transformed, 1.0); vec3 sn = objectNormal;
        #ifdef USE_INSTANCING
        sp = instanceMatrix * sp; sn = mat3(instanceMatrix) * sn;
        #endif
        vSucioPos = (modelMatrix * sp).xyz; vSucioN = normalize(mat3(modelMatrix) * sn); }`);
    const ventanas = V ? `
      vec2 vc = vSucioPos.xy / vec2(${V.w.toFixed(3)}, ${V.h.toFixed(3)});
      vec2 vf = fract(vc), vi = floor(vc);
      float vh = r_hash(vec3(vi, 3.7)), vh2 = r_hash(vec3(vi, 9.1));
      float frente = smoothstep(0.6, 0.9, vSucioN.z);
      float hueco = step(0.2, vf.x) * step(vf.x, 0.8) * step(0.24, vf.y) * step(vf.y, 0.74) * step(0.08, vh) * frente;
      float forjado = (1.0 - step(0.07, vf.y)) * frente;` : '';
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSucioPos; varying vec3 vSucioN;\n' + (tiempo ? 'uniform float uTiempo;\n' : '') + RUIDO)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float rim = pow(clamp(vSucioN.x * 0.75 + vSucioN.y * 0.45 - vSucioN.z * 0.35, 0.0, 1.0), 3.0);
        totalEmissiveRadiance += vec3(1.0, 0.64, 0.32) * rim * ${k.rim.toFixed(3)};
        // la luz del cielo que rebota en los muros lejanos (los huecos se quedan oscuros: asi se leen)
        totalEmissiveRadiance += diffuseColor.rgb * ${k.amb.toFixed(3)};
        ${V ? `${ventanas}
        float enc = step(vh2, ${V.enc.toFixed(3)}) * hueco;
        float parp = 1.0;
        ${tiempo ? 'if (vh2 < 0.012) parp = step(0.25, fract(sin(floor(uTiempo * 6.0 + vh * 50.0) * 12.98) * 437.5));' : ''}
        totalEmissiveRadiance += vec3(1.0, 0.62, 0.3) * enc * parp * (0.55 + vh * 0.7);` : ''}
      }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 P = vSucioPos * ${k.escala.toFixed(3)};
        float m = r_fbm(P * 1.7 + 3.1);
        float fino = r_valor(P * 9.0);
        // manchas de mugre a dos escalas
        diffuseColor.rgb *= mix(1.0 - ${k.mugre.toFixed(3)} * 0.7, 1.0 + ${k.mugre.toFixed(3)} * 0.18, m) * mix(0.9, 1.06, fino);
        // chorretones: bandas verticales que bajan desde arriba
        float ch = r_fbm(vec3(vSucioPos.x * 3.2, vSucioPos.y * 0.25, vSucioPos.z * 3.2));
        diffuseColor.rgb *= 1.0 - ${k.chorro.toFixed(3)} * 0.45 * smoothstep(0.55, 0.8, ch);
        // oxido pardo por placas
        float ox = smoothstep(0.58, 0.78, r_fbm(P * 0.9 + 11.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20, 0.13, 0.085), ${k.oxido.toFixed(3)} * ox);
        // oclusion barata al pie
        diffuseColor.rgb *= mix(0.45, 1.0, smoothstep(${k.pie.toFixed(3)}, ${(k.pie + 1.6).toFixed(3)}, vSucioPos.y));
        ${V ? `${ventanas}
        diffuseColor.rgb *= 1.0 - hueco * 0.82;
        diffuseColor.rgb *= 1.0 - forjado * 0.35;` : ''}
      }`);
  };
  return mat;
}
export const hormigon = (color = PAL.grisClaro, o) => sucio(new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0 }), o);
export const hierro = (color = PAL.pardo, o) => sucio(new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.45 }), { oxido: 0.55, escala: 2.2, ...o });

// ---------------------------------------------------------------- colectores
// Cajas: add(x, y, z, w, h, d) en el centro (o con ancla abajo: y es la base si abajo = true); rot en Z opcional.
export class Cajas {
  constructor(mat, sombras = true) { this.mat = mat; this.l = []; this.sombras = sombras; }
  add(x, y, z, w, h, d, rz = 0, color = null) { this.l.push([x, y, z, w, h, d, rz, color]); return this; }
  base(x, y, z, w, h, d, rz = 0, color = null) { return this.add(x, y + h / 2, z, w, h, d, rz, color); }
  malla() {
    if (!this.l.length) return new THREE.Group();
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.mat, this.l.length);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    this.l.forEach(([x, y, z, w, h, d, rz, color], i) => {
      q.setFromEuler(e.set(0, 0, rz)); M.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, d)); m.setMatrixAt(i, M);
      m.setColorAt(i, c.set(color || '#ffffff'));
    });
    m.castShadow = this.sombras; m.receiveShadow = true;
    return m;
  }
}
// Barras: de a a b (Vector3 o [x, y, z]) con su grueso (seccion cuadrada) o redondas (cilindro de 6 lados)
export class Barras {
  constructor(mat, redondas = false, sombras = true) { this.mat = mat; this.l = []; this.redondas = redondas; this.sombras = sombras; }
  add(a, b, g) { this.l.push([a, b, g]); return this; }
  malla() {
    if (!this.l.length) return new THREE.Group();
    const geo = this.redondas ? new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, true) : new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.InstancedMesh(geo, this.mat, this.l.length);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3();
    this.l.forEach(([a, b, g], i) => {
      A.set(...(Array.isArray(a) ? a : [a.x, a.y, a.z])); B.set(...(Array.isArray(b) ? b : [b.x, b.y, b.z]));
      D.subVectors(B, A); const L = D.length() || 1e-4; q.setFromUnitVectors(Y, D.normalize());
      M.compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(g, L, g)); m.setMatrixAt(i, M);
    });
    m.castShadow = this.sombras; m.receiveShadow = true;
    return m;
  }
}
// Formas: cualquier geometria repetida (conos de los tejadillos, cilindros cerrados, esferas) en una malla instanciada.
// add(x, y, z, sx, sy, sz, rz) con la geometria de tamano 1 centrada
export class Formas {
  constructor(geo, mat, sombras = false) { this.geo = geo; this.mat = mat; this.l = []; this.sombras = sombras; }
  add(x, y, z, sx, sy, sz, rz = 0) { this.l.push([x, y, z, sx, sy, sz, rz]); return this; }
  malla() {
    if (!this.l.length) return new THREE.Group();
    const m = new THREE.InstancedMesh(this.geo, this.mat, this.l.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    this.l.forEach(([x, y, z, sx, sy, sz, rz], i) => { M.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(0, 0, rz)), new THREE.Vector3(sx, sy, sz)); m.setMatrixAt(i, M); });
    m.castShadow = this.sombras; m.receiveShadow = true;
    return m;
  }
}
// Luces pequenas (ventanas encendidas, pilotos): rectangulos que emiten, con parpadeo por instancia
export class Luces {
  constructor() { this.l = []; }
  add(x, y, z, w, h, color = PAL.calido, fuerza = 1.6, parpadea = 0) { this.l.push([x, y, z, w, h, color, fuerza, parpadea]); return this; }
  malla(tiempo) {
    const g = new THREE.PlaneGeometry(1, 1);
    const fase = new Float32Array(this.l.length), parp = new Float32Array(this.l.length);
    this.l.forEach((q, i) => { fase[i] = Math.random() * 100; parp[i] = q[7]; });
    g.setAttribute('aFase', new THREE.InstancedBufferAttribute(fase, 1));
    g.setAttribute('aParpadea', new THREE.InstancedBufferAttribute(parp, 1));
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTiempo = tiempo;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFase; attribute float aParpadea; uniform float uTiempo; varying float vLuz; varying vec2 vLuzUv; varying float vLuzSem;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float t = uTiempo + aFase;
          float corte = step(0.94, fract(sin(floor(t * 7.0) * 12.9898) * 43758.5453));
          vLuz = 1.0 - aParpadea * (0.35 * (0.5 + 0.5 * sin(t * 1.3)) + corte * 0.8); vLuzUv = uv; vLuzSem = aFase;`);
      // vidrio sucio: mas luz abajo (la lampara de dentro), manchas, y la sombra de alguna maquina por dentro
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLuz; varying vec2 vLuzUv; varying float vLuzSem;\n' + RUIDO)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float gr = mix(1.0, 0.45, smoothstep(0.0, 1.0, vLuzUv.y));
          float mancha = 0.7 + 0.3 * r_fbm(vec3(vLuzUv * vec2(5.0, 7.0), vLuzSem));
          float maquina = 1.0 - 0.75 * smoothstep(0.62, 0.66, r_fbm(vec3(vLuzUv.x * 2.0 + vLuzSem, vLuzUv.y * 1.3, 2.0))) * smoothstep(0.75, 0.3, vLuzUv.y);
          diffuseColor.rgb *= vLuz * gr * mancha * maquina;`);
    };
    const m = new THREE.InstancedMesh(g, mat, this.l.length);
    const M = new THREE.Matrix4(), c = new THREE.Color();
    this.l.forEach(([x, y, z, w, h, color, fuerza], i) => { M.makeScale(w, h, 1).setPosition(x, y, z); m.setMatrixAt(i, M); m.setColorAt(i, c.set(color).multiplyScalar(fuerza)); });
    return m;
  }
}

// azar con semilla
export function azar(s) { let a = (s * 2654435761) >>> 0 || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return ((a >>> 0) % 1e6) / 1e6; }; }
export const lerp = (a, b, t) => a + (b - a) * t;
