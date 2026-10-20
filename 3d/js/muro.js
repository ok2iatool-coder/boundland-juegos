// El MAPA DEL MURO, de momento solo el SUELO: 300 x 300 m de pradera en LOW POLY, como el 18 (tono plano en escalones,
// caras que se leen): terreno de triangulos grandes con lomas suaves, caminitos de tierra estrechos que acaban todos en
// el norte (z -150, donde ira el muro) y hierba low poly con viento y FISICA (hierba.js, hierba_fisica.js): se aparta,
// rebota, queda tumbada donde se pisa y se levanta despacio. Misma interfaz que mundo.js (el bosque): altura, choques,
// salida, actualizar, puntoCamino, LADO.
import * as THREE from 'three';
import { azar } from './texturas.js';
import { crearHierba } from './hierba.js';

export const LADO = 150;                      // el mapa va de -LADO a +LADO en X y Z (m)
const PASO = 2.5;                             // m entre vertices del terreno: triangulos de low poly que se leen
const N = Math.round((2 * LADO) / PASO);      // 120 celdas por lado

// ---------------- ruido con semilla ----------------
function crearRuido(semilla) {
  const r = azar(semilla), P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = r();
  const v = (x, z) => P[((x & 255) << 8) | (z & 255)];
  return (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
    const a = v(xi, zi), b = v(xi + 1, zi), c = v(xi, zi + 1), d = v(xi + 1, zi + 1);
    const ab = a + (b - a) * u, cd = c + (d - c) * u;
    return ab + (cd - ab) * w;                 // 0..1
  };
}
const ruido = crearRuido(7);
function fbm(x, z, octavas = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < octavas; i++) { s += a * ruido(x * f + i * 17.3, z * f - i * 9.1); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
// azar fijo por celda o vertice (las mismas caras en cada carga)
function hash(i, j, k = 0) {
  let h = Math.imul(i * 73856093 ^ j * 19349663 ^ k * 83492791, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}
const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------- caminitos ----------------
// todos acaban en el NORTE (z -150), donde ira el muro: el principal sube del sur, un lazo por el oeste, un ramal al este
// que se parte y dos sendas finas
const CAMINOS = [
  { ancho: 1.0, puntos: [[6, 142], [2, 118], [-10, 96], [-6, 72], [8, 50], [12, 26], [0, 4], [-14, -18], [-10, -44], [4, -66], [6, -92], [-2, -116], [0, -146]] },
  { ancho: 0.75, puntos: [[-6, 72], [-26, 66], [-48, 70], [-70, 58], [-88, 34], [-96, 6], [-84, -22], [-60, -34], [-36, -28], [-14, -18]] },
  { ancho: 0.75, puntos: [[12, 26], [34, 30], [58, 22], [80, 32], [104, 48], [124, 72]] },
  { ancho: 0.65, puntos: [[58, 22], [66, -4], [62, -34], [74, -62], [94, -86], [104, -112], [100, -146]] },
  { ancho: 0.6, puntos: [[4, -66], [-22, -78], [-48, -96], [-60, -122], [-58, -146]] },
].map((c) => {
  const curva = new THREE.CatmullRomCurve3(c.puntos.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const largo = curva.getLength();
  return { ...c, curva, largo, pts: curva.getSpacedPoints(Math.ceil(largo / 0.8)) };
});

// distancia al BORDE del camino mas cercano (negativa dentro), en una rejilla de 0,5 m: la piden el terreno (aplana junto
// al camino), su color (hierba pisada) y la hierba (no crece encima)
const DC = 0.5, NC = Math.round((2 * LADO) / DC) + 1, RANGO = 8;
const BORDE = new Float32Array(NC * NC).fill(RANGO);
for (const c of CAMINOS) {
  for (let s = 0; s < c.pts.length - 1; s++) {
    const a = c.pts[s], b = c.pts[s + 1];
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-9;
    const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - RANGO + LADO) / DC)), i1 = Math.min(NC - 1, Math.ceil((Math.max(a.x, b.x) + RANGO + LADO) / DC));
    const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - RANGO + LADO) / DC)), j1 = Math.min(NC - 1, Math.ceil((Math.max(a.z, b.z) + RANGO + LADO) / DC));
    for (let j = j0; j <= j1; j++) {
      const z = j * DC - LADO;
      for (let i = i0; i <= i1; i++) {
        const x = i * DC - LADO;
        const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
        const d = Math.hypot(a.x + dx * k - x, a.z + dz * k - z) - c.ancho / 2;
        if (d < BORDE[j * NC + i]) BORDE[j * NC + i] = d;
      }
    }
  }
}
export function bordeCamino(x, z) {
  const gx = Math.max(0, Math.min(NC - 1.001, (x + LADO) / DC)), gz = Math.max(0, Math.min(NC - 1.001, (z + LADO) / DC));
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const a = BORDE[j * NC + i], b = BORDE[j * NC + i + 1], c = BORDE[(j + 1) * NC + i], d = BORDE[(j + 1) * NC + i + 1];
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}

// ---------------- el terreno ----------------
// lomas suaves + un temblor por vertice (las facetas del low poly) que se apaga junto a los caminos
function alturaLisa(x, z) {
  return 5.5 * (fbm(x / 75 + 3.1, z / 75 - 1.7, 3) - 0.5) + 1.4 * (fbm(x / 24, z / 24, 3) - 0.5);
}
const H = new Float32Array((N + 1) * (N + 1));
for (let j = 0; j <= N; j++) {
  for (let i = 0; i <= N; i++) {
    const x = -LADO + i * PASO, z = -LADO + j * PASO;
    const temblor = (hash(i, j) - 0.5) * 0.45 * suave(0.5, 4, bordeCamino(x, z));
    H[j * (N + 1) + i] = alturaLisa(x, z) + temblor;
  }
}
// diagonal de cada celda al azar (con todas iguales se ven las filas)
const DIAG = new Uint8Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) DIAG[j * N + i] = hash(i, j, 1) < 0.5 ? 0 : 1;

// la altura EXACTA de la cara pintada (el triangulo de la celda, no el ruido): los pies, la IK y la tela pisan la faceta
export function altura(x, z) {
  const gx = Math.max(0, Math.min(N - 1e-6, (x + LADO) / PASO)), gz = Math.max(0, Math.min(N - 1e-6, (z + LADO) / PASO));
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const f = N + 1;
  const h00 = H[j * f + i], h10 = H[j * f + i + 1], h01 = H[(j + 1) * f + i], h11 = H[(j + 1) * f + i + 1];
  if (DIAG[j * N + i] === 0) {                 // corte 00-11
    return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h01 - h00) * fz + (h11 - h01) * fx;
  }
  // corte 10-01
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

// ---------------- color ----------------
// verdes apagados que casan con el crema y el pardo del 18 y claros secos. La hierba pisada va en los cantos de la cinta del
// camino, no en el terreno: con caras de 2,5 m, teñir las que caen cerca del camino lo ensanchaba a la vista
const C = {
  oscuro: new THREE.Color(0x56643a), claro: new THREE.Color(0x8b9a57), seco: new THREE.Color(0xa7a066),
  pisado: new THREE.Color(0x8f875a), tierra: new THREE.Color(0x8a6f4c), tierraClara: new THREE.Color(0xa58a62),
  piedra: new THREE.Color(0x8d8778),
};
const _c = new THREE.Color();
function colorSuelo(x, z, out = _c) {
  out.copy(C.oscuro).lerp(C.claro, suave(0.3, 0.7, fbm(x / 38 + 11, z / 38 - 4, 3)));
  out.lerp(C.seco, 0.75 * suave(0.6, 0.72, fbm(x / 26 - 40, z / 26 + 8, 3)));
  return out;
}

export function puntoCamino(t, k = 0) {
  const c = CAMINOS[k].curva, u = Math.max(0, Math.min(1, t));
  const p = c.getPointAt(u), tg = c.getTangentAt(u);
  return { x: p.x, z: p.z, tx: tg.x, tz: tg.z };
}

// escalones del tono: el 18 va en dos (sombra y luz); el suelo en cuatro para que las facetas se lean
function escalones(niveles) {
  const t = new THREE.DataTexture(new Uint8Array(niveles.flatMap((v) => [v, v, v, 255])), niveles.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export function crearMundo(scene) {
  const r = azar(91);
  const choques = { circulos: [], cajas: [] };
  const grupo = new THREE.Group();
  scene.add(grupo);
  const tono = escalones([120, 175, 222, 255]);

  // cielo y niebla: salvia palida, mas abierta que el bosque
  const CIELO = new THREE.Color(0xb9bd9c);
  scene.background = CIELO.clone();
  scene.fog = new THREE.FogExp2(CIELO, 0.0115);

  const cielo = new THREE.HemisphereLight(0xf3efd6, 0x55603a, 1.55);
  const sol = new THREE.DirectionalLight(0xffe3b2, 2.7);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { near: 1, far: 90, left: -16, right: 16, top: 16, bottom: -16 });
  sol.shadow.bias = -0.0006;
  sol.shadow.normalBias = 0.03;
  scene.add(cielo, sol, sol.target);
  const DIR_SOL = new THREE.Vector3(-0.5, 0.68, 0.53).normalize();
  const _ejeU = new THREE.Vector3().crossVectors(DIR_SOL, new THREE.Vector3(0, 1, 0)).normalize();
  const _ejeV = new THREE.Vector3().crossVectors(_ejeU, DIR_SOL).normalize();
  const _foco = new THREE.Vector3();

  // ---------------- suelo: triangulos con color por cara ----------------
  {
    const pos = new Float32Array(N * N * 6 * 3), col = new Float32Array(N * N * 6 * 3);
    let k = 0;
    const v = (i, j) => [-LADO + i * PASO, H[j * (N + 1) + i], -LADO + j * PASO];
    const tri = (a, b, c) => {
      // cara hacia arriba (normal +Y) se mire como se mire el orden
      const ux = b[0] - a[0], uz = b[2] - a[2], wx = c[0] - a[0], wz = c[2] - a[2];
      if (uz * wx - ux * wz < 0) [b, c] = [c, b];
      const cx = (a[0] + b[0] + c[0]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
      colorSuelo(cx, cz);
      // cada cara un poco distinta (el mosaico del low poly)
      const m = 0.94 + 0.12 * hash(Math.round(cx * 7), Math.round(cz * 7), 5);
      for (const p of [a, b, c]) {
        pos.set(p, k * 3);
        col.set([_c.r * m, _c.g * m, _c.b * m], k * 3);
        k++;
      }
    };
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const p00 = v(i, j), p10 = v(i + 1, j), p01 = v(i, j + 1), p11 = v(i + 1, j + 1);
        if (DIAG[j * N + i] === 0) { tri(p00, p10, p11); tri(p00, p11, p01); } else { tri(p00, p10, p01); tri(p10, p11, p01); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const suelo = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, flatShading: true }));
    suelo.receiveShadow = true;
    suelo.name = 'suelo';
    grupo.add(suelo);
  }

  // ---------------- caminitos: cintas de tierra de cuatro vertices de ancho ----------------
  // un poco por encima del suelo (la cara del terreno bajo un tramo puede doblarse); los cantos tiran a hierba pisada
  {
    const pos = [], col = [];
    const cruces = [-1, -0.4, 0.4, 1], subida = [0.02, 0.035, 0.035, 0.02];
    for (const c of CAMINOS) {
      const filas = [];
      c.pts.forEach((p, n) => {
        const q = c.pts[Math.min(c.pts.length - 1, n + 1)], o = c.pts[Math.max(0, n - 1)];
        const tx = q.x - o.x, tz = q.z - o.z, l = Math.hypot(tx, tz) || 1;
        const nx = -tz / l, nz = tx / l;
        const ancho = c.ancho / 2 * (1 + (r() - 0.5) * 0.22);
        const lado = (r() - 0.5) * 0.12;
        filas.push(cruces.map((s, m) => {
          const x = p.x + nx * (s * ancho + lado), z = p.z + nz * (s * ancho + lado);
          return [x, altura(x, z) + subida[m], z];
        }));
      });
      for (let n = 0; n < filas.length - 1; n++) {
        for (let m = 0; m < cruces.length - 1; m++) {
          const a = filas[n][m], b = filas[n][m + 1], cc = filas[n + 1][m + 1], d = filas[n + 1][m];
          const canto = m !== 1;
          for (const t of [[a, b, cc], [a, cc, d]]) {
            let [p0, p1, p2] = t;
            const ux = p1[0] - p0[0], uz = p1[2] - p0[2], wx = p2[0] - p0[0], wz = p2[2] - p0[2];
            if (uz * wx - ux * wz < 0) [p1, p2] = [p2, p1];
            _c.copy(C.tierra).lerp(C.tierraClara, r());
            if (canto) _c.lerp(C.pisado, 0.35);
            const mm = 0.93 + 0.1 * r();
            for (const p of [p0, p1, p2]) { pos.push(...p); col.push(_c.r * mm, _c.g * mm, _c.b * mm); }
          }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true;
    m.name = 'caminos';
    m.userData.caminoCortes = cruces.length;
    grupo.add(m);
  }

  // ---------------- piedrecitas en los cantos de los caminos ----------------
  {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const lista = [];
    for (const c of CAMINOS) {
      for (let n = 0; n < c.pts.length; n += 2) {
        if (r() > 0.45) continue;
        const p = c.pts[n], q = c.pts[Math.min(c.pts.length - 1, n + 1)];
        const tx = q.x - p.x, tz = q.z - p.z, l = Math.hypot(tx, tz) || 1;
        const s = r() < 0.5 ? -1 : 1, d = c.ancho / 2 + 0.05 + r() * 0.35;
        lista.push([p.x - tz / l * s * d, p.z + tx / l * s * d, 0.04 + Math.pow(r(), 2) * 0.12]);
      }
    }
    const im = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ gradientMap: tono, flatShading: true }), lista.length);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    lista.forEach(([x, z, s], i) => {
      q.setFromEuler(e.set(r() * 3, r() * 6.28, r() * 3));
      mt.compose(new THREE.Vector3(x, altura(x, z) + s * 0.25, z), q, new THREE.Vector3(s * (1 + r() * 0.5), s * 0.6, s));
      im.setMatrixAt(i, mt);
      im.setColorAt(i, _c.copy(C.piedra).multiplyScalar(0.85 + r() * 0.3));
    });
    im.receiveShadow = true;
    im.name = 'piedrecitas';
    grupo.add(im);
  }

  // ---------------- hierba (hierba.js): tres matas low poly, viento y FISICA ----------------
  const hierba = crearHierba({ grupo, LADO, tono, suelo: { altura, bordeCamino, color: colorSuelo, fbm, suave } });

  function actualizar(t, foco, heroe = null, dt = 0) {
    // el sol y su sombra siguen al heroe, ajustados a la rejilla de texeles (si no, los bordes tiemblan al andar)
    const texel = (sol.shadow.camera.right - sol.shadow.camera.left) / sol.shadow.mapSize.x;
    const u = _ejeU.dot(foco), w = _ejeV.dot(foco);
    _foco.copy(foco).addScaledVector(_ejeU, Math.round(u / texel) * texel - u).addScaledVector(_ejeV, Math.round(w / texel) * texel - w);
    sol.position.copy(_foco).addScaledVector(DIR_SOL, 45);
    sol.target.position.copy(_foco);
    hierba.actualizar(t, foco, heroe, dt);
  }

  const p0 = puntoCamino(0.01);
  return {
    LADO, altura, choques, actualizar, sol, puntoCamino,
    salida: { x: p0.x, z: p0.z, giro: Math.atan2(p0.tx, p0.tz) },
    titulo: 'EL MURO',
    hierba,
    get info() { return { triangulosSuelo: N * N * 2, ...hierba.info(), caminos: CAMINOS.map((c) => Math.round(c.largo)) }; },
  };
}
