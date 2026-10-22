// EL SUELO DE TIERRA DE VERDAD del bosque (21-10, «no parece tierra como tal... tiene que aparecer tierra real»,
// «profundidad en la tierra, pequenas ramitas realistas, mini baches pequenos»). Sustituye al plano con la textura
// pintada (`T.suelo()`), que se veia de dibujo animado.
//
//   - REJILLA DE ALTURAS de 25 cm (`crearRejilla`): el relieve del mapa (la funcion lisa de mundo.js) MAS baches
//     pequenos horneados (ruido de 0,4-1 m de 2-3 cm y hoyitos de 2-5 cm), menos en el camino. La pisa el 18
//     (`altura`, bilineal) y la dibuja la GPU con la misma cuenta (texelFetch + bilineal a mano): pie y suelo casan.
//   - FOTOS reales (Poly Haven, CC0; web/texturas/suelo/LICENCIA.txt): TIERRA compacta con chinas y hojas sueltas,
//     HOJARASCA con musgo y ramitas, HIERBA rala. Color, normal, AO/rugosidad y relieve de cada una.
//   - MASCARA de 50 cm (`mascara`): tierra pisada junto al camino, hojarasca bajo los arboles, hierba en los claros y a
//     manchas; en el sombreador se mezclan por ALTURA (gana la que esta mas alta en su relieve: la transicion es de
//     hojas que tapan la tierra, no un fundido) y con dos muestras giradas para que no se vea la repeticion.
//   - MALLA DENSA de 32 x 32 m con un vertice cada 6,25 cm que sigue al 18 (salta de 25 en 25 cm, asi sus vertices
//     caen siempre en los mismos sitios del mundo y el relieve no "nada"): se LEVANTA con el relieve de las fotos (las
//     ramitas y las hojas de la hojarasca sobresalen de verdad). Fuera, la malla de 25 cm sin levantar, con hueco donde
//     esta la densa.
import * as THREE from 'three';

const URL_TEX = new URL('../texturas/suelo/', import.meta.url);

// ---------------- ruido (el mismo en JS para la rejilla) ----------------
function hash(i, j) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function ruido(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

// ---------------- la rejilla de alturas ----------------
// muestra(x, z) -> [altura lisa en m, 0 fuera del camino .. 1 dentro] (los baches no van en el empedrado; una sola
// llamada para no recorrer el camino dos veces por punto: son 361.000)
export function crearRejilla({ muestra, lado = 75, paso = 0.25, azar }) {
  const N = Math.round(lado * 2 / paso) + 1, MIN = -lado;
  const H = new Float32Array(N * N);
  const quieto = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = MIN + i * paso, z = MIN + j * paso, k = j * N + i;
      const [h0, c] = muestra(x, z);
      quieto[k] = c;
      // baches: dos octavas de ruido (1 m y 40 cm), mas fuertes lejos del camino
      const b = 0.022 * ruido(x / 1.05 + 17, z / 1.05 - 9) + 0.011 * ruido(x / 0.42 - 3, z / 0.42 + 5);
      H[k] = h0 + b * (1 - c);
    }
  }
  // hoyitos: cuencos de 25-70 cm y 2-5 cm de hondo (pisadas viejas, huecos de raiz, charcos secos)
  for (let n = 0; n < 1400; n++) {
    const cx = MIN + azar() * lado * 2, cz = MIN + azar() * lado * 2, rad = 0.25 + azar() * 0.45, hondo = 0.02 + azar() * 0.03;
    const i0 = Math.floor((cx - rad - MIN) / paso), i1 = Math.ceil((cx + rad - MIN) / paso);
    const j0 = Math.floor((cz - rad - MIN) / paso), j1 = Math.ceil((cz + rad - MIN) / paso);
    for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
        const d = Math.hypot(MIN + i * paso - cx, MIN + j * paso - cz) / rad;
        if (d < 1) { const k = j * N + i; H[k] -= hondo * (1 - d * d) * (1 - d * d) * (1 - quieto[k]); }
      }
    }
  }
  function altura(x, z) {
    const gx = Math.max(0, Math.min(N - 1.0001, (x - MIN) / paso)), gz = Math.max(0, Math.min(N - 1.0001, (z - MIN) / paso));
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, k = j * N + i;
    const a = H[k], b = H[k + 1], c = H[k + N], d = H[k + N + 1];
    return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
  }
  return { H, N, MIN, paso, lado, altura };
}

// ---------------- la mascara: tierra (r), hojarasca (g), hierba (b) ----------------
export function crearMascara({ lado = 75, paso = 0.5, distCamino, anchoCamino, arboles, claro }) {
  const N = Math.round(lado * 2 / paso) + 1, MIN = -lado;
  const P = new Float32Array(N * N * 3);
  // bajo los arboles, hojarasca (sello alrededor de cada tronco)
  const hoja = new Float32Array(N * N);
  for (const a of arboles) {
    const R = 3 + a.rb * 4 + (a.abedul ? 0 : 1.5);
    const i0 = Math.floor((a.x - R - MIN) / paso), i1 = Math.ceil((a.x + R - MIN) / paso);
    const j0 = Math.floor((a.z - R - MIN) / paso), j1 = Math.ceil((a.z + R - MIN) / paso);
    for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
        const d = Math.hypot(MIN + i * paso - a.x, MIN + j * paso - a.z) / R;
        if (d < 1) hoja[j * N + i] = Math.max(hoja[j * N + i], (1 - d) * 1.4);
      }
    }
  }
  const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = MIN + i * paso, z = MIN + j * paso, k = j * N + i;
      const { d } = distCamino(x, z);
      // tierra pisada a los lados del camino y a manchas
      let ti = 1 - suave(anchoCamino + 0.15, anchoCamino + 1.4, d);
      ti = Math.max(ti, 0.7 * suave(0.45, 0.8, ruido(x / 6 + 40, z / 6 - 11)));
      let ho = Math.min(1, hoja[k]) + 0.4 + 0.8 * suave(-0.2, 0.5, ruido(x / 9 - 7, z / 9 + 3));
      let hi = 0.8 + 1.2 * suave(-0.4, 0.5, ruido(x / 10 + 2, z / 10 + 21));
      if (claro) { const c = 1 - suave(claro.r * 0.7, claro.r + 2, Math.hypot(x - claro.x, z - claro.z)); hi += 2 * c; ho *= 1 - c; }
      ho *= 1 - ti * 0.55; hi *= 1 - ti;
      const s = ti + ho + hi + 1e-4;
      P[k * 3] = ti / s; P[k * 3 + 1] = ho / s; P[k * 3 + 2] = hi / s;
    }
  }
  function mascara(x, z) {
    const gx = Math.max(0, Math.min(N - 1.0001, (x - MIN) / paso)), gz = Math.max(0, Math.min(N - 1.0001, (z - MIN) / paso));
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, out = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const k = (j * N + i) * 3 + c;
      out[c] = (P[k] + (P[k + 3] - P[k]) * fx) * (1 - fz) + (P[k + N * 3] + (P[k + N * 3 + 3] - P[k + N * 3]) * fx) * fz;
    }
    return out;
  }
  const datos = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) { datos[k * 4] = P[k * 3] * 255; datos[k * 4 + 1] = P[k * 3 + 1] * 255; datos[k * 4 + 2] = P[k * 3 + 2] * 255; datos[k * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(datos, N, N, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return { mascara, tex, N, MIN, paso };
}

// ---------------- el material y las dos mallas ----------------
const GLSL_COMUN = /* glsl */`
uniform sampler2D uAlt; uniform float uAltMin, uAltPaso; uniform int uAltN;
uniform sampler2D uMasc; uniform float uMascMin, uMascTam;
uniform sampler2D uColT, uColH, uColG, uNorT, uNorH, uNorG, uArmT, uArmH, uArmG, uRelT, uRelH, uRelG;
uniform vec3 uTam;          // metros que cubre una repeticion de cada foto (tierra, hojarasca, hierba)
float altRej(vec2 p) {
  vec2 g = (p - vec2(uAltMin)) / uAltPaso;
  ivec2 i = clamp(ivec2(floor(g)), ivec2(0), ivec2(uAltN - 2));
  vec2 f = clamp(g - vec2(i), 0.0, 1.0);
  float a = texelFetch(uAlt, i, 0).r, b = texelFetch(uAlt, i + ivec2(1, 0), 0).r;
  float c = texelFetch(uAlt, i + ivec2(0, 1), 0).r, d = texelFetch(uAlt, i + ivec2(1, 1), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float hashS(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruidoS(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashS(i), hashS(i + vec2(1, 0)), f.x), mix(hashS(i + vec2(0, 1)), hashS(i + vec2(1, 1)), f.x), f.y); }
// dos muestras de la foto, la segunda girada y a otra escala, mezcladas por ruido: no se ve la repeticion
const mat2 GIRO = mat2(0.8, -0.6, 0.6, 0.8);
vec2 uvA(vec2 p, float tam) { return p / tam; }
vec2 uvB(vec2 p, float tam) { return GIRO * (p / tam) * 0.61 + 0.37; }
float mezclaAB(vec2 p) { return smoothstep(0.35, 0.65, ruidoS(p * 0.23)); }
vec3 pesos(vec2 p, vec3 rel) {
  vec3 m = texture(uMasc, (p - vec2(uMascMin)) / uMascTam).rgb;
  // por altura: la que asoma mas en su relieve gana el borde
  vec3 w = m * pow(rel + 0.35, vec3(5.0));
  return w / max(w.r + w.g + w.b, 1e-4);
}
`;
// LEER: en los vertices sin mipmap (textureLod 0), en los fragmentos con (si no, de lejos parpadea)
const GLSL_RELIEVE = /* glsl */`
vec3 relieves(vec2 p) {
  float k = mezclaAB(p);
  return vec3(
    mix(LEER(uRelT, uvA(p, uTam.x)).r, LEER(uRelT, uvB(p, uTam.x)).r, k),
    mix(LEER(uRelH, uvA(p, uTam.y)).r, LEER(uRelH, uvB(p, uTam.y)).r, k),
    mix(LEER(uRelG, uvA(p, uTam.z)).r, LEER(uRelG, uvB(p, uTam.z)).r, k));
}
`;

function cargar(nombre, srgb) {
  const t = new THREE.TextureLoader().load(new URL(nombre, URL_TEX).href);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function crearSuelo({ grupo, rejilla, mascara, sombra = true }) {
  const altTex = new THREE.DataTexture(rejilla.H, rejilla.N, rejilla.N, THREE.RedFormat, THREE.FloatType);
  altTex.magFilter = altTex.minFilter = THREE.NearestFilter;
  altTex.needsUpdate = true;
  const T = {};
  for (const [k, n] of [['T', 'tierra'], ['H', 'hojarasca'], ['G', 'hierba']]) {
    T['uCol' + k] = { value: cargar(n + '_color.jpg', true) };
    T['uNor' + k] = { value: cargar(n + '_normal.jpg', false) };
    T['uArm' + k] = { value: cargar(n + '_arm.jpg', false) };
    T['uRel' + k] = { value: cargar(n + '_relieve.jpg', false) };
  }
  const comunes = {
    uAlt: { value: altTex }, uAltMin: { value: rejilla.MIN }, uAltPaso: { value: rejilla.paso }, uAltN: { value: rejilla.N },
    uMasc: { value: mascara.tex }, uMascMin: { value: mascara.MIN - mascara.paso / 2 }, uMascTam: { value: mascara.N * mascara.paso },
    uTam: { value: new THREE.Vector3(2.11, 3.0, 2.0) },
    ...T,
  };
  // (uMascMin / uMascTam: el texel i de la mascara esta en MIN + i * paso, que con LinearFilter es (i + 0,5) / N)

  function material(densa) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
    const propios = { uCentro: { value: new THREE.Vector2() }, uRelieve: { value: densa ? 1 : 0 }, uHueco: { value: densa ? -1 : 15.95 }, uCentroHueco: { value: new THREE.Vector2(1e5, 1e5) } };
    m.userData.u = propios;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, comunes, propios);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          #define LEER(t, uv) textureLod(t, uv, 0.0)
          ${GLSL_COMUN}
          ${GLSL_RELIEVE}
          uniform vec2 uCentro; uniform float uRelieve;
          varying vec2 vWp; varying vec3 vNw;`)
        .replace('#include <beginnormal_vertex>', `
          vec2 wp = position.xz + uCentro;
          float e = uAltPaso;
          float hx = altRej(wp + vec2(e, 0.0)) - altRej(wp - vec2(e, 0.0));
          float hz = altRej(wp + vec2(0.0, e)) - altRej(wp - vec2(0.0, e));
          vec3 objectNormal = normalize(vec3(-hx, 2.0 * e, -hz));
          vNw = objectNormal; vWp = wp;`)
        .replace('#include <begin_vertex>', `
          float h = altRej(wp);
          if (uRelieve > 0.0) {
            // el relieve de las fotos, hasta 2,5 cm, que se apaga en el borde de la malla densa
            vec2 dl = abs(position.xz);
            float borde = 1.0 - smoothstep(12.0, 15.5, max(dl.x, dl.y));
            vec3 rel = relieves(wp);
            vec3 w = pesos(wp, rel);
            float r = dot(w, rel * vec3(0.018, 0.028, 0.012)) - dot(w, vec3(0.009, 0.012, 0.006));
            h += r * uRelieve * borde;
          }
          vec3 transformed = vec3(wp.x, h, wp.y);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          #define LEER(t, uv) texture(t, uv)
          ${GLSL_COMUN}
          ${GLSL_RELIEVE}
          uniform float uHueco; uniform vec2 uCentroHueco;
          varying vec2 vWp; varying vec3 vNw;
          vec4 dosMuestras(sampler2D t, vec2 p, float tam, float k) { return mix(texture(t, uvA(p, tam)), texture(t, uvB(p, tam)), k); }
          // la normal de la muestra girada hay que girarla de vuelta (su xy esta en los ejes de la foto girada)
          vec3 dosNormales(sampler2D t, vec2 p, float tam, float k) {
            vec3 a = texture(t, uvA(p, tam)).xyz * 2.0 - 1.0, b = texture(t, uvB(p, tam)).xyz * 2.0 - 1.0;
            b.xy = transpose(GIRO) * b.xy;
            return normalize(mix(a, b, k));
          }`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          if (uHueco > 0.0) { vec2 dh = abs(vWp - uCentroHueco); if (max(dh.x, dh.y) < uHueco) discard; }
          float kAB = mezclaAB(vWp);
          vec3 relF = relieves(vWp);
          vec3 wF = pesos(vWp, relF);`)
        .replace('#include <map_fragment>', `
          vec3 col = dosMuestras(uColT, vWp, uTam.x, kAB).rgb * wF.r + dosMuestras(uColH, vWp, uTam.y, kAB).rgb * wF.g + dosMuestras(uColG, vWp, uTam.z, kAB).rgb * wF.b;
          vec3 arm = dosMuestras(uArmT, vWp, uTam.x, kAB).rgb * wF.r + dosMuestras(uArmH, vWp, uTam.y, kAB).rgb * wF.g + dosMuestras(uArmG, vWp, uTam.z, kAB).rgb * wF.b;
          // variacion grande de tono (humedo / seco) para que no sea un color plano a 20 m
          float hum = ruidoS(vWp * 0.09) * 0.5 + ruidoS(vWp * 0.31) * 0.5;
          col *= mix(0.95, 1.3, hum);
          diffuseColor.rgb *= col * mix(1.0, arm.r, 0.85);`)
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = clamp(arm.g, 0.35, 1.0);`)
        .replace('#include <normal_fragment_maps>', `
          {
            vec3 Nw = normalize(vNw);
            vec3 Tg = normalize(vec3(1.0, 0.0, 0.0) - Nw * Nw.x);
            vec3 Bt = cross(Tg, Nw);           // +z: la v de la foto crece con z
            vec3 nt = dosNormales(uNorT, vWp, uTam.x, kAB) * wF.r + dosNormales(uNorH, vWp, uTam.y, kAB) * wF.g + dosNormales(uNorG, vWp, uTam.z, kAB) * wF.b;
            nt.xy *= 1.4;
            vec3 nw = normalize(Tg * nt.x + Bt * nt.y + Nw * nt.z);
            normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
          }`);
    };
    m.customProgramCacheKey = () => 'sueloBosque' + (densa ? 'D' : 'B');
    return m;
  }

  // la malla de 25 cm del mapa entero (sin levantar), con hueco donde va la densa
  const L = rejilla.lado * 2, segB = rejilla.N - 1;
  const gB = new THREE.PlaneGeometry(L, L, segB, segB).rotateX(-Math.PI / 2);
  const matB = material(false);
  matB.polygonOffset = true; matB.polygonOffsetFactor = 1; matB.polygonOffsetUnits = 2;
  const base = new THREE.Mesh(gB, matB);
  // la densa: 32 m, un vertice cada 6,25 cm (512 tramos)
  const gD = new THREE.PlaneGeometry(32, 32, 512, 512).rotateX(-Math.PI / 2);
  const matD = material(true);
  const densa = new THREE.Mesh(gD, matD);
  for (const m of [base, densa]) { m.frustumCulled = false; m.receiveShadow = sombra; m.name = m === base ? 'sueloBase' : 'sueloDenso'; grupo.add(m); }

  function actualizar(foco) {
    // salta de 25 en 25 cm: los vertices (cada 6,25 cm) caen siempre en los mismos sitios del mundo
    const cx = Math.round(foco.x / rejilla.paso) * rejilla.paso, cz = Math.round(foco.z / rejilla.paso) * rejilla.paso;
    matD.userData.u.uCentro.value.set(cx, cz);
    matB.userData.u.uCentroHueco.value.set(cx, cz);
  }
  return { actualizar, base, densa };
}
