// LA NEBLINA del mapa del mundo (21-10, «metele neblina, mas ambientacion»), adaptada de la de boundland-paso3d
// (web/js/niebla.js): la FogExp2 de three solo depende de la distancia (un velo plano); esto es un MEDIO, una densidad en
// cada punto del aire que se integra por cada rayo de la camara hasta lo que tapa el pixel (la profundidad de la escena),
// con la transmitancia y la luz que dispersa:
//   - PEGADA AL TERRENO: la densidad depende de la altura SOBRE EL SUELO de ese punto (una textura con la rejilla de
//     alturas del mundo a 16 m), asi se espesa a ras de suelo en el llano, en los valles y en las laderas, y se aclara
//     hacia arriba (una capa de `capa` m y un velo alto mas fino);
//   - BANCOS de unos 120 m que pasan con el viento y JIRONES de 15 m que se deshacen;
//   - LUZ: la del cielo de la hora y la del sol (o la luna) con fase de Henyey-Greenstein: mirando hacia el sol la
//     neblina se enciende (el resplandor del amanecer y del atardecer).
// La hora (horas.js) pone la fuerza, el espesor de la capa y los colores. Va a media resolucion en su render target
// (rgb = luz dispersada, a = transmitancia) y el pase final la junta con la escena: escena * T + L. La escena se pinta
// antes en un render target con 4 muestras (el antialias) y su profundidad.
//
// Hasta `LEJOS` m; mas alla sigue la FogExp2 de siempre (la bruma de la distancia).
import * as THREE from 'three';
import * as R from './relieve.js';

const LEJOS = 700;

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG_NIEBLA = /* glsl */`
  precision highp float;
  uniform sampler2D tProf, tSuelo;
  uniform mat4 uInvProy, uCamMundo;
  uniform vec3 uCam, uFrente, uLuzCielo, uLuzSol, uDirSol, uViento;
  uniform float uNear, uFar, uT, uFuerza, uCapa, uSueloMin, uSueloTam, uLejos;
  varying vec2 vUv;
  float nh3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float nruido(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(nh3(i), nh3(i + vec3(1, 0, 0)), f.x), mix(nh3(i + vec3(0, 1, 0)), nh3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(nh3(i + vec3(0, 0, 1)), nh3(i + vec3(1, 0, 1)), f.x), mix(nh3(i + vec3(0, 1, 1)), nh3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float suelo(vec2 xz) { return texture2D(tSuelo, (xz - vec2(uSueloMin)) / uSueloTam).r; }
  float densidad(vec3 p) {
    float hs = max(p.y - suelo(p.xz), 0.0);
    // la capa a ras de suelo y un velo alto
    float h = 0.028 * exp(-hs / uCapa) + 0.0022 * exp(-hs / 90.0);
    // bancos (120 m, empujados por el viento) y jirones (15 m, mas deprisa)
    vec3 q = p * vec3(0.0085, 0.03, 0.0085) + uViento * uT * 0.01;
    float n = 0.65 * nruido(q) + 0.35 * nruido(q * 2.3 + 5.1);
    float bancos = smoothstep(0.3, 0.75, n);
    vec3 r = p * vec3(0.065, 0.16, 0.065) + uViento * uT * 0.06 + vec3(0.0, 0.0, 0.03 * uT);
    float j = nruido(r);
    return uFuerza * h * (0.2 + 1.7 * bancos) * (0.5 + 0.9 * j);
  }
  float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
  void main() {
    if (uFuerza < 1e-4) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    vec4 v = uInvProy * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); v /= v.w;
    vec3 dir = normalize((uCamMundo * vec4(v.xyz, 0.0)).xyz);
    float tMax = min(linZ(texture2D(tProf, vUv).r) / max(dot(dir, uFrente), 1e-3), uLejos);
    // la fase: mirando hacia el sol la neblina devuelve mucha mas luz (Henyey-Greenstein, g = 0,65) + algo isotropo
    float c = dot(dir, uDirSol), g = 0.65;
    float fase = 0.25 + 3.0 * (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5) / 12.566;
    vec3 Li = uLuzCielo + uLuzSol * fase;
    float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    const int N = 28;
    float T = 1.0; vec3 L = vec3(0.0);
    for (int i = 0; i < N; i++) {
      float u0 = float(i) / float(N), u1 = float(i + 1) / float(N);
      float tA = tMax * u0 * u0, tB = tMax * u1 * u1, dt = tB - tA;
      vec3 x = uCam + dir * mix(tA, tB, j);
      float s = densidad(x);
      if (s < 1e-7) continue;
      float Ts = exp(-s * dt);
      L += T * Li * (1.0 - Ts);
      T *= Ts;
      if (T < 0.02) break;
    }
    gl_FragColor = vec4(L, T);
  }
`;
const FRAG_FINAL = /* glsl */`
  uniform sampler2D tEscena, tNiebla;
  varying vec2 vUv;
  void main() {
    vec4 e = texture2D(tEscena, vUv), n = texture2D(tNiebla, vUv);
    gl_FragColor = vec4(e.rgb * n.a + n.rgb, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function crearNeblina() {
  // el suelo, a 16 m (la rejilla del mundo es de 8: para la neblina sobra), en media precision
  const paso = 2, n = Math.floor(R.N / paso) + 1, f = R.N + 1;
  const datos = new Uint16Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) datos[j * n + i] = THREE.DataUtils.toHalfFloat(R.H[Math.min(f - 1, j * paso) * f + Math.min(f - 1, i * paso)]);
  const tSuelo = new THREE.DataTexture(datos, n, n, THREE.RedFormat, THREE.HalfFloatType);
  tSuelo.magFilter = tSuelo.minFilter = THREE.LinearFilter;
  tSuelo.needsUpdate = true;
  const tam = (n - 1) * paso * R.PASO;

  const rtEscena = new THREE.WebGLRenderTarget(16, 16, { samples: 4, type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(16, 16) });
  const rtNiebla = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, depthBuffer: false });
  const u = {
    tProf: { value: rtEscena.depthTexture }, tSuelo: { value: tSuelo }, uInvProy: { value: new THREE.Matrix4() }, uCamMundo: { value: new THREE.Matrix4() },
    uCam: { value: new THREE.Vector3() }, uFrente: { value: new THREE.Vector3() }, uLuzCielo: { value: new THREE.Color() }, uLuzSol: { value: new THREE.Color() },
    uDirSol: { value: new THREE.Vector3(0, 1, 0) }, uViento: { value: new THREE.Vector3(1.0, 0.05, 0.45) },
    uNear: { value: 0.1 }, uFar: { value: 1000 }, uT: { value: 0 }, uFuerza: { value: 0 }, uCapa: { value: 8 },
    uSueloMin: { value: -R.EXT - (paso * R.PASO) / 2 }, uSueloTam: { value: tam + paso * R.PASO }, uLejos: { value: LEJOS },
  };
  const escenaN = new THREE.Scene(), escenaF = new THREE.Scene(), camO = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadN = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG_NIEBLA, depthTest: false, depthWrite: false }));
  const matF = new THREE.ShaderMaterial({ uniforms: { tEscena: { value: rtEscena.texture }, tNiebla: { value: rtNiebla.texture } }, vertexShader: VERT, fragmentShader: FRAG_FINAL, depthTest: false, depthWrite: false });
  const quadF = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matF);
  quadN.frustumCulled = quadF.frustumCulled = false;
  escenaN.add(quadN); escenaF.add(quadF);
  const tam2 = new THREE.Vector2();

  return {
    uniforms: u,
    // la hora: fuerza, espesor de la capa (m), luz del cielo y del sol (colores ya multiplicados por su fuerza) y su direccion
    hora({ fuerza, capa, luzCielo, luzSol, dirSol }) {
      u.uFuerza.value = fuerza; u.uCapa.value = capa;
      u.uLuzCielo.value.copy(luzCielo); u.uLuzSol.value.copy(luzSol); u.uDirSol.value.copy(dirSol);
    },
    pintar(renderer, scene, cam, t) {
      renderer.getDrawingBufferSize(tam2);
      if (rtEscena.width !== tam2.x || rtEscena.height !== tam2.y) {
        rtEscena.setSize(tam2.x, tam2.y);
        rtNiebla.setSize(Math.ceil(tam2.x / 2), Math.ceil(tam2.y / 2));
      }
      renderer.setRenderTarget(rtEscena);
      renderer.render(scene, cam);
      cam.updateMatrixWorld();
      u.uT.value = t;
      u.uInvProy.value.copy(cam.projectionMatrixInverse);
      u.uCamMundo.value.copy(cam.matrixWorld);
      cam.getWorldPosition(u.uCam.value);
      cam.getWorldDirection(u.uFrente.value);
      u.uNear.value = cam.near; u.uFar.value = cam.far;
      renderer.setRenderTarget(rtNiebla);
      renderer.render(escenaN, camO);
      renderer.setRenderTarget(null);
      renderer.render(escenaF, camO);
    },
  };
}
