// El TERRENO del trozo: rejilla de 2 m sobre los 500 x 500 m (triangulos que se leen, como el 18), con la altura del
// plano (mapa.js) y un temblor por vertice que hace las facetas. Color por cara segun la zona: tierra pisada dentro de
// la Base, pradera fuera (verdes apagados y claros secos), orillas oscuras del arroyo, la franja pisada al pie del muro.
// Encima, los caminos en cinta y el agua del arroyo. `altura(x, z)` da la cara pintada EXACTA (pies, IK, tela).
import * as THREE from 'three';
import { X0, X1, Z0, Z1, alturaLisa, bordeCamino, distArroyo, CAMINOS, ARROYO, PLAZA, COSAS, fbm, suave, VADO } from './mapa.js';
import { col, matToon } from './geo.js';

const PASO = 2;
const NX = (X1 - X0) / PASO, NZ = (Z1 - Z0) / PASO;
function hash(i, j, k = 0) {
  let h = Math.imul(i * 73856093 ^ j * 19349663 ^ k * 83492791, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

// ---------------- la rejilla de alturas ----------------
const H = new Float32Array((NX + 1) * (NZ + 1));
const DIAG = new Uint8Array(NX * NZ);
for (let j = 0; j <= NZ; j++) {
  for (let i = 0; i <= NX; i++) {
    const x = X0 + i * PASO, z = Z0 + j * PASO;
    // el temblor: fuerte en la pradera, poco dentro, nada en los caminos, al pie del muro ni en el cauce
    let amp = z < 0 ? 0.05 : 0.32 * suave(1, 14, z);
    amp *= suave(0.3, 3, bordeCamino(x, z)) * suave(4, 7, distArroyo(x, z));
    H[j * (NX + 1) + i] = alturaLisa(x, z) + (hash(i, j) - 0.5) * amp;
  }
}
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) DIAG[j * NX + i] = hash(i, j, 1) < 0.5 ? 0 : 1;

export function altura(x, z) {
  const gx = Math.max(0, Math.min(NX - 1e-6, (x - X0) / PASO)), gz = Math.max(0, Math.min(NZ - 1e-6, (z - Z0) / PASO));
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, f = NX + 1;
  const h00 = H[j * f + i], h10 = H[j * f + i + 1], h01 = H[(j + 1) * f + i], h11 = H[(j + 1) * f + i + 1];
  if (DIAG[j * NX + i] === 0) return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h01 - h00) * fz + (h11 - h01) * fx;
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
// la pendiente (normal) en un punto: para tumbar cosas con el suelo
export function normal(x, z, out = new THREE.Vector3()) {
  const e = 0.3;
  return out.set(altura(x - e, z) - altura(x + e, z), 2 * e, altura(x, z - e) - altura(x, z + e)).normalize();
}

// ---------------- color ----------------
const C = {
  oscuro: col(0x56643a), claro: col(0x8b9a57), seco: col(0xa7a066), pisado: col(0x8f875a),
  tierra: col(0x857a64), tierraClara: col(0xa08f72), tierraOscura: col(0x6a604f), plaza: col(0x9e9179),
  orilla: col(0x4d5a35), cauce: col(0x6b6250), barro: col(0x5d4b37), huerta: col(0x5e4831),
};
const _t = new THREE.Color();
export function colorSuelo(x, z, out = new THREE.Color()) {
  if (z < 0) {
    // dentro: tierra pisada, mas clara en la plaza y en la calle de la puerta, con calvas de hierba rala en los rincones
    out.copy(C.tierra).lerp(C.tierraOscura, 0.5 * suave(0.45, 0.7, fbm(x / 9 + 3, z / 9)));
    const ep = Math.hypot((x - PLAZA.x) / PLAZA.rx, (z - PLAZA.z) / PLAZA.rz);
    out.lerp(C.plaza, 0.75 * (1 - suave(0.7, 1.05, ep)));
    out.lerp(C.plaza, 0.6 * (1 - suave(4, 7, Math.abs(x))) * suave(-36, -28, z));
    out.lerp(C.oscuro, 0.35 * suave(0.62, 0.75, fbm(x / 7 - 20, z / 7 + 5)) * suave(0.9, 1.3, ep));
    return out;
  }
  out.copy(C.oscuro).lerp(C.claro, suave(0.3, 0.7, fbm(x / 38 + 11, z / 38 - 4, 3)));
  out.lerp(C.seco, 0.75 * suave(0.6, 0.72, fbm(x / 26 - 40, z / 26 + 8, 3)));
  // al pie del muro, tierra pisada (el campamento de fuera)
  out.lerp(_t.copy(C.pisado).lerp(C.tierra, 0.5), 0.85 * (1 - suave(8, 24, z)) * (1 - suave(70, 95, Math.abs(x))));
  // el arroyo: orilla oscura y cauce de grava
  const da = distArroyo(x, z);
  if (da < 9) out.lerp(C.orilla, 0.55 * (1 - suave(3, 9, da)));
  if (da < ARROYO.ancho + 0.6) out.lerp(C.cauce, 1 - suave(ARROYO.ancho - 0.4, ARROYO.ancho + 0.6, da));
  // las huertas: tierra labrada
  const hu = COSAS.huertas;
  const dh = Math.max(Math.abs(x - hu.x) - hu.ancho / 2, Math.abs(z - hu.z) - hu.fondo / 2);
  if (dh < 1.5) out.lerp(C.huerta, 1 - suave(-0.5, 1.5, dh));
  return out;
}

// ---------------- mallas ----------------
export function crearTerreno(grupo) {
  // el suelo: triangulos con color por cara
  {
    const n = NX * NZ * 6, pos = new Float32Array(n * 3), cl = new Float32Array(n * 3);
    let k = 0;
    const c = new THREE.Color();
    const v = (i, j) => [X0 + i * PASO, H[j * (NX + 1) + i], Z0 + j * PASO];
    const tri = (a, b, d) => {
      const ux = b[0] - a[0], uz = b[2] - a[2], wx = d[0] - a[0], wz = d[2] - a[2];
      if (uz * wx - ux * wz < 0) [b, d] = [d, b];
      const cx = (a[0] + b[0] + d[0]) / 3, cz = (a[2] + b[2] + d[2]) / 3;
      colorSuelo(cx, cz, c);
      const m = 0.94 + 0.12 * hash(Math.round(cx * 7), Math.round(cz * 7), 5);
      for (const p of [a, b, d]) { pos.set(p, k * 3); cl.set([c.r * m, c.g * m, c.b * m], k * 3); k++; }
    };
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const p00 = v(i, j), p10 = v(i + 1, j), p01 = v(i, j + 1), p11 = v(i + 1, j + 1);
        if (DIAG[j * NX + i] === 0) { tri(p00, p10, p11); tri(p00, p11, p01); } else { tri(p00, p10, p01); tri(p10, p11, p01); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, matToon());
    m.receiveShadow = true;
    m.name = 'suelo';
    grupo.add(m);
  }

  // los caminos: cintas de tierra de cuatro vertices de ancho, un poco por encima (la cara de debajo puede doblarse)
  {
    const pos = [], cl = [], q = azar(7), cruces = [-1, -0.4, 0.4, 1], subida = [0.03, 0.05, 0.05, 0.03];
    const tierra = col(0x8a6f4c), clara = col(0xa58a62), pisado = col(0x8f875a), c = new THREE.Color();
    for (const cam of CAMINOS) {
      const pts = cam.pts, filas = [];
      for (let n = 0; n < pts.length; n++) {
        const a = pts[Math.max(0, n - 1)], b = pts[Math.min(pts.length - 1, n + 1)];
        const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
        const ancho = (cam.ancho / 2) * (1 + (q() - 0.5) * 0.2), lado = (q() - 0.5) * 0.1;
        filas.push(cruces.map((s, m) => {
          const x = pts[n][0] + nx * (s * ancho + lado), z = pts[n][1] + nz * (s * ancho + lado);
          // en el vado el camino se mete en el agua: va al ras del terreno
          return [x, altura(x, z) + subida[m], z];
        }));
      }
      for (let n = 0; n < filas.length - 1; n++) {
        // dentro del muro no hay cinta: la calle es la tierra pisada
        if (pts[n][1] < 1.5) continue;
        for (let m = 0; m < 3; m++) {
          const a = filas[n][m], b = filas[n][m + 1], cc = filas[n + 1][m + 1], d = filas[n + 1][m];
          c.copy(tierra).lerp(clara, q());
          if (m !== 1) c.lerp(pisado, 0.35);
          const mm = 0.93 + 0.1 * q();
          for (const t of [[a, b, cc], [a, cc, d]]) {
            let [p0, p1, p2] = t;
            const ux = p1[0] - p0[0], uz = p1[2] - p0[2], wx = p2[0] - p0[0], wz = p2[2] - p0[2];
            if (uz * wx - ux * wz < 0) [p1, p2] = [p2, p1];
            for (const p of [p0, p1, p2]) { pos.push(...p); cl.push(c.r * mm, c.g * mm, c.b * mm); }
          }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, matToon({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true;
    m.name = 'caminos';
    grupo.add(m);
  }

  // el agua del arroyo: una cinta a nivel por tramos, con corriente
  const agua = { uTiempo: { value: 0 }, uCielo: { value: col(0xc9cdb4) }, uHondo: { value: col(0x46564a) } };
  {
    const pts = ARROYO.pts, pos = [], fl = [], idx = [];
    let s = 0;
    const W = ARROYO.ancho * 0.94;
    for (let n = 0; n < pts.length; n++) {
      const a = pts[Math.max(0, n - 1)], b = pts[Math.min(pts.length - 1, n + 1)];
      const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
      if (n > 0) s += Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]);
      // el nivel: la orilla menos un palmo (la mas baja de las dos)
      const yl = Math.min(altura(pts[n][0] + nx * (ARROYO.ancho + 0.8), pts[n][1] + nz * (ARROYO.ancho + 0.8)),
        altura(pts[n][0] - nx * (ARROYO.ancho + 0.8), pts[n][1] - nz * (ARROYO.ancho + 0.8))) - 0.12;
      for (const sg of [-1, 0, 1]) { pos.push(pts[n][0] + nx * sg * W, yl, pts[n][1] + nz * sg * W); fl.push(s, sg); }
    }
    for (let n = 0; n < pts.length - 1; n++) {
      for (let m = 0; m < 2; m++) {
        const a = n * 3 + m, b = a + 1, c = a + 3, d = a + 4;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('flujo', new THREE.Float32BufferAttribute(fl, 2));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader: `attribute vec2 flujo; varying vec2 vF; varying vec3 vMundo;
#include <fog_pars_vertex>
void main() { vF = flujo; vec4 m = modelMatrix * vec4(position, 1.0); vMundo = m.xyz; vec4 mvPosition = viewMatrix * m; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
      fragmentShader: `uniform vec3 uCielo; uniform vec3 uHondo; uniform float uTiempo; varying vec2 vF; varying vec3 vMundo;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec3 V = normalize(cameraPosition - vMundo);
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.0);
  vec3 c = mix(uHondo, uCielo, 0.25 + 0.65 * fres);
  // la corriente: rayas que bajan con el agua, mas en el centro
  float r = sin(vF.x * 1.7 - uTiempo * 2.2 + sin(vF.x * 0.37) * 2.0 + vF.y * 1.3);
  float r2 = sin(vF.x * 3.1 - uTiempo * 3.0 - vF.y * 2.0);
  c = mix(c, uCielo * 1.1, step(0.86, r) * 0.32 * (1.0 - abs(vF.y)));
  c = mix(c, uCielo * 1.05, step(0.93, r2) * 0.2);
  // espuma en la orilla
  c = mix(c, vec3(0.86, 0.85, 0.78), smoothstep(0.78, 1.0, abs(vF.y)) * 0.35);
  gl_FragColor = vec4(c, 0.9);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
      transparent: true, depthWrite: false, fog: true,
    });
    mat.uniforms.uTiempo = agua.uTiempo; mat.uniforms.uCielo = agua.uCielo; mat.uniforms.uHondo = agua.uHondo;
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 1;
    m.name = 'arroyo';
    grupo.add(m);
  }
  return { agua };
}

function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export { PASO as PASO_TERRENO, VADO };
