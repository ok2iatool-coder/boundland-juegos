// EL AGUA del mapa del mundo: el rio (de la Sierra a la Hoz), el arroyo de los Picos (del lago helado al farallon y de
// la poza al Lago), la CASCADA que cae por el farallon, la poza, el Lago y el lago helado. Las lineas y las cotas vienen de
// geo.json (exportar_juego.py desde mapa.py); el cauce ya esta excavado en el relieve. La lamina corre: una textura de
// vetas que se desliza aguas abajo (mas deprisa en la cascada).
import * as THREE from 'three';
import { GEO, altura } from './relieve.js';
import { DIR_SOL } from './luz.js';

// vetas claras sobre el azul del agua (se repite a lo largo)
function texturaVetas(semilla, claro) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 256);
  let s = semilla;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 46; k++) {
    const x = r() * 64, y = r() * 256, l = 18 + r() * 60, a = (claro ? 0.25 : 0.12) + r() * 0.2;
    g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 1 + r() * 2.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + l); g.stroke();
    g.strokeStyle = `rgba(40,70,90,${a * 0.6})`; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + 3, y + 4); g.lineTo(x + 3 + (r() - 0.5) * 6, y + l * 0.7); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// EL AGUA TRANSPARENTE (2026-10-21, "como el charco de la parcela"): refleja el cielo (mas cuanto mas rasante se mira:
// Fresnel), brilla donde se refleja el sol, se riza con ondas que se mueven (en el rio, aguas abajo) y deja ver el
// FONDO: en la orilla casi transparente y clara, en lo hondo verde oscuro y opaca. La hondura va por vertice (la cota
// del agua menos la del suelo), por eso los lagos son una rejilla de anillos y el rio lleva cinco vertices de ancho.
// `vetas` (la textura de antes) marca la corriente en el rio y la cascada.
const RUIDO = (() => {
  const N2 = 128, d = new Uint8Array(N2 * N2 * 4);
  let sem = 99;
  const r = () => { sem = (Math.imul(sem, 1664525) + 1013904223) >>> 0; return sem / 4294967296; };
  const G = 8, rej = Array.from({ length: G * G }, r), v = (i, j) => rej[((j % G + G) % G) * G + ((i % G + G) % G)];
  for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
    let t = 0, a = 0.6, sm = 0;
    for (let o = 0; o < 3; o++) {
      const per = G << o, fx = (x / N2) * per, fy = (y / N2) * per, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, w = fy - j;
      const uu = u * u * (3 - 2 * u), ww = w * w * (3 - 2 * w), vv = (ii, jj) => v((ii % per) + o * 3, (jj % per) + o * 5);
      t += a * ((vv(i, j) * (1 - uu) + vv(i + 1, j) * uu) * (1 - ww) + (vv(i, j + 1) * (1 - uu) + vv(i + 1, j + 1) * uu) * ww);
      sm += a; a *= 0.5;
    }
    const g = Math.round((t / sm) * 255), k = (y * N2 + x) * 4;
    d[k] = d[k + 1] = d[k + 2] = g; d[k + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N2, N2, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
})();
function materialAgua(textura, { corriente = 0, espuma = 0, vel = 0, claro = 0x8fa38a, hondo = 0x1f3d3a, opaca = 0.9 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uRuido: { value: RUIDO }, uVetas: { value: textura }, uT: { value: 0 }, uCorriente: { value: corriente }, uEspuma: { value: espuma }, uVel: { value: vel },
      uSol: { value: DIR_SOL }, uCielo: { value: new THREE.Color(0xdad9c4) }, uHorizonte: { value: new THREE.Color(0x8c9a86) },
      uClaro: { value: new THREE.Color(claro) }, uHondo: { value: new THREE.Color(hondo) }, uOpaca: { value: opaca },
    }]),
    vertexShader: `attribute float hondo;
varying vec3 vW; varying float vHondo; varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv; vHondo = hondo;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform sampler2D uRuido, uVetas; uniform float uT, uCorriente, uEspuma, uOpaca, uVel;
uniform vec3 uSol, uCielo, uHorizonte, uClaro, uHondo;
varying vec3 vW; varying float vHondo; varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>
float ola(vec2 p) {
  return texture2D(uRuido, p * 0.18 + vec2(uT * 0.021, uT * 0.013)).r * 0.6 + texture2D(uRuido, p * 0.47 - vec2(uT * 0.017, -uT * 0.026)).r * 0.4;
}
void main() {
  float h = max(vHondo, 0.0);
  // las ondas: la pendiente del ruido que se mueve (en el rio, ademas, las vetas de la corriente)
  vec2 p = vW.xz;
  float e = 0.35, o0 = ola(p);
  vec2 g = vec2(ola(p + vec2(e, 0.0)) - o0, ola(p + vec2(0.0, e)) - o0) / e;
  float veta = uCorriente + uEspuma > 0.0 ? texture2D(uVetas, vUv - vec2(0.0, uT * uVel)).r : 1.0;
  g *= 0.55 + 0.6 * uCorriente;
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(cameraPosition - vW);
  vec3 R = reflect(-V, N);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 refl = mix(uHorizonte, uCielo, smoothstep(-0.05, 0.4, R.y));
  float brillo = pow(max(dot(R, uSol), 0.0), 260.0) * 2.2 + pow(max(dot(R, uSol), 0.0), 30.0) * 0.06;
  // el fondo: claro en la orilla, verde oscuro en lo hondo
  vec3 fondo = mix(uClaro, uHondo, smoothstep(0.0, 2.2, h));
  vec3 c = mix(fondo, refl, fres) + brillo * vec3(1.0, 0.95, 0.82);
  c = mix(c, vec3(0.93, 0.96, 0.96), uEspuma * (1.0 - veta) * 0.6 + uCorriente * (1.0 - veta) * 0.18);
  float alfa = mix(0.22, uOpaca, smoothstep(0.0, 1.6, h));
  alfa = max(alfa, min(fres * 1.3, 1.0));
  alfa *= smoothstep(0.0, 0.12, h) * (1.0 - uEspuma) + uEspuma;
  gl_FragColor = vec4(c, clamp(alfa + brillo, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}
const conHondo = (g, f) => {
  const P = g.attributes.position, h = new Float32Array(P.count);
  for (let i = 0; i < P.count; i++) h[i] = f(P.getX(i), P.getY(i), P.getZ(i));
  g.setAttribute('hondo', new THREE.BufferAttribute(h, 1));
  return g;
};

// una cinta de agua por una linea [x, z, cota del agua, medio ancho]: plana de lado a lado, a la cota del agua o, donde el
// fondo asoma (un arroyo de dos metros en una rejilla de ocho), un palmo por encima del suelo
function cinta(pts, ensancha = 1.12) {
  const pos = [], uv = [], idx = [], hon = [], A = [-1, -0.5, 0, 0.5, 1], na = A.length;
  let s = 0;
  for (let k = 0; k < pts.length; k++) {
    const [x, z, nivel, w] = pts[k];
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    if (k > 0) s += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
    const W = w * ensancha, nx = -tz, nz = tx;
    const y = Math.max(nivel, altura(x, z) + 0.06);
    for (const t of A) {
      const px = x + nx * W * t, pz = z + nz * W * t;
      pos.push(px, y, pz); uv.push((t + 1) / 2, s / 14);
      hon.push(Math.max(0.03, y - altura(px, pz)));
    }
    if (k > 0) for (let m = 0; m < na - 1; m++) { const q = (k - 1) * na + m; idx.push(q, q + 1, q + na, q + 1, q + na + 1, q + na); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('hondo', new THREE.Float32BufferAttribute(hon, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
// una elipse llana (los lagos, la poza)
function elipse(cx, cz, rx, rz, giro, y, seg = 96, anillos = 14) {
  const pos = [cx, y, cz], uv = [0.5, 0.5], idx = [];
  const c = Math.cos(giro), s = Math.sin(giro);
  for (let a = 1; a <= anillos; a++) {
    const f = a / anillos;
    for (let k = 0; k < seg; k++) {
      const t = (k / seg) * Math.PI * 2, u = rx * f * Math.cos(t), v = rz * f * Math.sin(t);
      pos.push(cx + u * c - v * s, y, cz + u * s + v * c);
      uv.push(0.5 + 0.5 * f * Math.cos(t), 0.5 + 0.5 * f * Math.sin(t));
    }
  }
  for (let k = 0; k < seg; k++) idx.push(0, 1 + ((k + 1) % seg), 1 + k);
  for (let a = 1; a < anillos; a++) {
    const b0 = 1 + (a - 1) * seg, b1 = 1 + a * seg;
    for (let k = 0; k < seg; k++) { const k1 = (k + 1) % seg; idx.push(b0 + k, b0 + k1, b1 + k, b0 + k1, b1 + k1, b1 + k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return conHondo(g, (x, yy, z) => Math.max(0.0, yy - altura(x, z)));
}

export function crearAgua(grupo, tono) {
  const g = new THREE.Group();
  g.name = 'agua';
  grupo.add(g);
  const vetas = texturaVetas(7, false), vetasCascada = texturaVetas(19, true), vetasLago = texturaVetas(31, false);
  vetas.repeat.set(1, 1);
  vetasCascada.repeat.set(1, 1);
  vetasLago.repeat.set(3, 3);
  const matRio = materialAgua(vetas, { corriente: 1, vel: 0.28 });
  const matCascada = materialAgua(vetasCascada, { espuma: 1, opaca: 0.95, vel: 1.6 });
  const matLago = materialAgua(vetasLago, {});
  const mats = [matRio, matCascada, matLago];
  const mallas = [];
  const poner = (geo, mat, nombre) => { const m = new THREE.Mesh(geo, mat); m.name = nombre; m.renderOrder = 2; g.add(m); mallas.push(m); return m; };

  // el rio y el arroyo
  for (const [nombre, pts] of Object.entries(GEO.lineas)) poner(cinta(pts), matRio, nombre);

  // la cascada: de lo alto del farallon a la poza, pegada a la pared (un metro y medio por fuera)
  const C = GEO.cascada;
  {
    const pos = [], uv = [], idx = [], M = 48;
    const dx = C.x1 - C.x0, dz = C.z1 - C.z0, L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
    let s = 0, yAntes = C.y0, xA = C.x0, zA = C.z0;
    for (let k = 0; k <= M; k++) {
      const t = k / M, x = C.x0 + dx * t, z = C.z0 + dz * t;
      const y = k === 0 ? C.y0 + 0.3 : Math.max(C.y1 + 0.05, Math.min(yAntes, altura(x, z) + 1.5));
      if (k > 0) s += Math.hypot(x - xA, y - yAntes, z - zA);
      const W = C.ancho / 2 * (1 + 0.5 * t);                               // se abre al caer
      pos.push(x + nx * W, y, z + nz * W, x - nx * W, y, z - nz * W);
      uv.push(0, s / 10, 1, s / 10);
      if (k > 0) { const q = (k - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      yAntes = y; xA = x; zA = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    conHondo(geo, () => 1);
    poner(geo, matCascada, 'cascada');
  }
  // la espuma al pie: un anillo blanco que late
  const espuma = new THREE.Mesh(new THREE.RingGeometry(2, 9, 40), new THREE.MeshBasicMaterial({ color: 0xf2f6f7, transparent: true, opacity: 0.55, depthWrite: false }));
  espuma.rotation.x = -Math.PI / 2;
  espuma.position.set(C.x1 + (C.x0 - C.x1) * 0.35, GEO.poza.cota + 0.08, C.z1 + (C.z0 - C.z1) * 0.35);
  espuma.name = 'espuma';
  espuma.renderOrder = 3;
  g.add(espuma);

  // la poza y los lagos
  const Pz = GEO.poza;
  poner(elipse(Pz.x, Pz.z, Pz.r, Pz.r, 0, Pz.cota), matLago, 'poza');
  for (const L of GEO.lagos) {
    if (!L.helado) { poner(elipse(L.x, L.z, L.rx, L.rz, L.giro, L.cota), matLago, L.id); continue; }
    // el lago helado: una lamina de hielo opaca, con sus grietas
    const hielo = new THREE.Mesh(elipse(L.x, L.z, L.rx, L.rz, L.giro, L.cota + 0.02), new THREE.MeshToonMaterial({ color: 0xdce9ef, gradientMap: tono }));
    hielo.name = 'lago_helado';
    hielo.receiveShadow = true;
    g.add(hielo);
    const lin = [], c = Math.cos(L.giro), s = Math.sin(L.giro);
    let sem = 5;
    const r = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
    for (let k = 0; k < 9; k++) {
      let u = (r() - 0.5) * 1.2 * L.rx, v = (r() - 0.5) * 1.2 * L.rz;
      for (let q = 0; q < 4; q++) {
        const u2 = u + (r() - 0.5) * 10, v2 = v + (r() - 0.5) * 8;
        if ((u2 / L.rx) ** 2 + (v2 / L.rz) ** 2 > 0.9) break;
        lin.push(L.x + u * c - v * s, L.cota + 0.05, L.z + u * s + v * c, L.x + u2 * c - v2 * s, L.cota + 0.05, L.z + u2 * s + v2 * c);
        u = u2; v = v2;
      }
    }
    const gl = new THREE.BufferGeometry();
    gl.setAttribute('position', new THREE.Float32BufferAttribute(lin, 3));
    const grietas = new THREE.LineSegments(gl, new THREE.LineBasicMaterial({ color: 0x9fb7c2 }));
    grietas.name = 'grietas';
    g.add(grietas);
  }

  return {
    grupo: g,
    actualizar(t, dt) {
      vetas.offset.y -= dt * 0.28;                // aguas abajo (v crece a lo largo de la linea, de la fuente a la boca)
      vetasCascada.offset.y -= dt * 1.6;
      vetasLago.offset.x += dt * 0.004;
      for (const m of mats) m.uniforms.uT.value = t;
      espuma.material.opacity = 0.45 + 0.15 * Math.sin(t * 5.3);
      const k = 1 + 0.06 * Math.sin(t * 3.1);
      espuma.scale.set(k, k, 1);
    },
    info: () => ({ laminasAgua: mallas.length }),
  };
}
