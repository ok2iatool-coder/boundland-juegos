// El CIELO y el HORIZONTE del muro: boveda con degradado (bruma calida abajo, salvia fria arriba) y el sol con su halo;
// tres sierras low poly cada vez mas lejos y mas comidas por la bruma (caras planas con su luz horneada en escalones,
// como el 18); y nubes de caras planas que pasan despacio. Nada de esto tiene niebla de la escena: la bruma va horneada
// en su color, asi asoman por encima de la bruma del valle.
import * as THREE from 'three';
import { azar } from '../texturas.js';
import { fbm, suave } from './suelo.js';

export const BRUMA = new THREE.Color(0xc7c6a6);          // el horizonte y la niebla de la escena

const VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = `
uniform vec3 uCenit;
uniform vec3 uHorizonte;
uniform vec3 uSuelo;
uniform vec3 uSol;
uniform vec3 uSolDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(uHorizonte, uCenit, pow(smoothstep(-0.02, 0.7, y), 0.75));
  col = mix(col, uSuelo, smoothstep(-0.01, -0.2, y));
  float s = max(dot(d, uSolDir), 0.0);
  // el disco del sol (con borde neto, como todo) y su halo
  col = mix(col, uSol * 1.12, smoothstep(0.99965, 0.9998, s));
  col += uSol * (pow(s, 14.0) * 0.16 + pow(s, 200.0) * 0.25);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// cara a cara: color con la luz del sol en tres escalones, y la bruma encima
function caraPlana(pos, col, a, b, c, base, sol, bruma, k, alCentro = false) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  // las sierras miran al valle: su normal, hacia el centro
  if (alCentro && nx * a[0] + nz * a[2] > 0) { nx = -nx; ny = -ny; nz = -nz; }
  const lam = Math.max(0, nx * sol.x + ny * sol.y + nz * sol.z);
  const luz = lam > 0.55 ? 1 : lam > 0.22 ? 0.8 : 0.64;
  const r = base.r * luz + (bruma.r - base.r * luz) * k, g = base.g * luz + (bruma.g - base.g * luz) * k, bb = base.b * luz + (bruma.b - base.b * luz) * k;
  pos.push(...a, ...b, ...c);
  for (let i = 0; i < 3; i++) col.push(r, g, bb);
}

export function crearCielo(scene, dirSol) {
  const grupo = new THREE.Group();
  grupo.name = 'cielo';
  scene.add(grupo);
  // ---------------- boveda ----------------
  const cenit = new THREE.Color(0x9fb0a6), horizonte = BRUMA.clone(), suelo = new THREE.Color(0xa9a98a);
  const boveda = new THREE.Mesh(new THREE.SphereGeometry(2300, 48, 24), new THREE.ShaderMaterial({
    uniforms: { uCenit: { value: cenit }, uHorizonte: { value: horizonte }, uSuelo: { value: suelo },
      uSol: { value: new THREE.Color(0xfff1cf) }, uSolDir: { value: dirSol.clone() } },
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  boveda.frustumCulled = false;
  boveda.renderOrder = -10;
  boveda.name = 'boveda';
  grupo.add(boveda);

  // ---------------- sierras ----------------
  // tres anillos: cerca, verdes oscuros con algo de bruma; lejos, azulados y casi del color del cielo
  const sierras = new THREE.Group();
  sierras.name = 'sierras';
  scene.add(sierras);
  const CAPAS = [
    { R: 760, base: 0x6b7650, bruma: 0.5, alto: [45, 120], picos: 3.2, sem: 3 },
    { R: 1150, base: 0x6f7d6c, bruma: 0.66, alto: [90, 230], picos: 2.4, sem: 11 },
    { R: 1750, base: 0x7c8a86, bruma: 0.78, alto: [170, 380], picos: 1.7, sem: 23 },
  ];
  for (const C of CAPAS) {
    const pos = [], col = [];
    const r = azar(C.sem), base = new THREE.Color(C.base), M = 150;
    // la cresta: ruido a lo largo del anillo, con picos (potencia) y collados
    const cresta = [], medio = [];
    for (let i = 0; i < M; i++) {
      const a = (i / M) * Math.PI * 2;
      const n = fbm(Math.cos(a) * C.picos + C.sem, Math.sin(a) * C.picos - C.sem, 4);
      const h = C.alto[0] + (C.alto[1] - C.alto[0]) * Math.pow(suave(0.25, 0.8, n), 1.4);
      const R = C.R * (1 + (r() - 0.5) * 0.06);
      cresta.push([Math.cos(a) * R, h * (0.92 + r() * 0.16), Math.sin(a) * R]);
      // un vertice a media ladera, mas cerca: las caras de la ladera se leen
      const Rm = R * (0.955 - r() * 0.03), hm = h * (0.35 + r() * 0.25);
      medio.push([Math.cos(a + (r() - 0.5) * 0.012) * Rm, hm, Math.sin(a + (r() - 0.5) * 0.012) * Rm]);
    }
    const bruma = BRUMA;
    for (let i = 0; i < M; i++) {
      const j = (i + 1) % M;
      const a0 = (i / M) * Math.PI * 2, a1 = (j / M) * Math.PI * 2;
      const pie0 = [Math.cos(a0) * C.R * 0.9, -40, Math.sin(a0) * C.R * 0.9], pie1 = [Math.cos(a1) * C.R * 0.9, -40, Math.sin(a1) * C.R * 0.9];
      // caras mirando al centro (al valle)
      caraPlana(pos, col, cresta[i], medio[i], cresta[j], base, dirSol, bruma, C.bruma, true);
      caraPlana(pos, col, cresta[j], medio[i], medio[j], base, dirSol, bruma, C.bruma + 0.04, true);
      caraPlana(pos, col, medio[i], pie0, medio[j], base, dirSol, bruma, C.bruma + 0.1, true);
      caraPlana(pos, col, medio[j], pie0, pie1, base, dirSol, bruma, C.bruma + 0.1, true);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    m.renderOrder = -5;
    m.frustumCulled = false;
    sierras.add(m);
  }

  // ---------------- nubes ----------------
  const nubes = new THREE.Group();
  nubes.name = 'nubes';
  scene.add(nubes);
  {
    const r = azar(808);
    const blanco = new THREE.Color(0xf6f2e4), sombra = new THREE.Color(0xb8bfb6);
    const v = new THREE.Vector3();
    for (let k = 0; k < 14; k++) {
      const pos = [], col = [];
      const bolas = 4 + Math.floor(r() * 5), largo = 60 + r() * 90;
      for (let b = 0; b < bolas; b++) {
        const bx = (b / (bolas - 1) - 0.5) * largo + (r() - 0.5) * 12, rad = 18 + r() * 22 * (1 - Math.abs(b / (bolas - 1) - 0.5));
        const by = rad * 0.25 + r() * 6, bz = (r() - 0.5) * 18;
        const g = new THREE.IcosahedronGeometry(rad, 1).toNonIndexed();
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i += 3) {
          const tri = [0, 1, 2].map((o) => {
            v.fromBufferAttribute(p, i + o);
            return [bx + v.x * 1.15, by + Math.max(v.y * 0.62, -rad * 0.12), bz + v.z * 0.9];
          });
          // arriba blanco al sol, abajo la sombra fria; con la bruma de la distancia
          const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3 - by;
          const base = blanco.clone().lerp(sombra, suave(rad * 0.25, -rad * 0.1, cy));
          caraPlana(pos, col, tri[0], tri[1], tri[2], base, dirSol, BRUMA, 0.12);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
      const a = (k / 14) * Math.PI * 2 + r() * 0.3, R = 700 + r() * 900;
      m.position.set(Math.cos(a) * R, 170 + r() * 230, Math.sin(a) * R);
      m.rotation.y = -a + Math.PI / 2 + (r() - 0.5) * 0.6;
      m.renderOrder = -6;
      m.frustumCulled = false;
      nubes.add(m);
    }
  }

  return {
    actualizar(t, foco) {
      boveda.position.set(foco.x, 0, foco.z);
      nubes.rotation.y = t * 0.0025;
    },
  };
}
