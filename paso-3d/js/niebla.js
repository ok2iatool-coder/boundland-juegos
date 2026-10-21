// LA NEBLINA (pedido: «mete un poco de neblina hiperrealista»). Antes eran cuatro planos con un alfa que se desliza
// bajo la base y la FogExp2 de three: un velo plano que tine igual lo que esta a la misma distancia. Ahora la neblina es
// un MEDIO: una densidad en cada punto del mundo (DENSIDAD_GLSL) que se integra por cada rayo de la camara hasta lo que
// tapa el pixel (la profundidad del mundo), con la transmitancia y la luz que dispersa de verdad:
//  - por altura: espesa en la sima (la base esta a 35 m del suelo), fina a la altura de las pasarelas, con una capa que
//    se arrastra justo por encima de las rejillas, y casi nada arriba;
//  - BANCOS que pasan con el viento (ruido grande estirado en horizontal) y JIRONES finos que se deshacen (ruido pequeno
//    que deriva mas deprisa);
//  - la luz: la del cielo (la neblina lejana tiende al color del horizonte, asi casa con el cielo) y la de los apliques
//    calidos, la farola, la caseta y el aplique de la salida (un halo dentro del medio que cae con el cuadrado de la
//    distancia); los haces de los focos (focos.js) usan la MISMA densidad, asi se ven mas donde la neblina es espesa.
// Va a media resolucion en su propio render target (rgb = la luz dispersada, a = la transmitancia) y el pase final la
// reescala con la profundidad (que no se corra la neblina de detras sobre una barandilla de delante).
import * as THREE from 'three';
import { D } from './datos.js';

export const DENSIDAD_GLSL = /* glsl */`
  const float MURO_X = ${D.MURO_X.toFixed(3)};
  float nh3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float nruido(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(nh3(i), nh3(i + vec3(1, 0, 0)), f.x), mix(nh3(i + vec3(0, 1, 0)), nh3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(nh3(i + vec3(0, 0, 1)), nh3(i + vec3(1, 0, 1)), f.x), mix(nh3(i + vec3(0, 1, 1)), nh3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  // densidad (1/m) del AIRE en p al tiempo t
  float densidadAire(vec3 p, float t) {
    float h = 0.004 + 0.018 * exp(-max(p.y + 3.0, 0.0) / 8.0) + 0.006 * exp(-max(p.y - 0.3, 0.0) / 2.0) + 0.0015 * exp(-max(p.y, 0.0) / 30.0);
    // bancos: 16 m de ancho y 5 de alto, empujados por el viento (de la ciudad hacia el muro y un poco de lado)
    vec3 q = p * vec3(0.06, 0.18, 0.06) + vec3(-0.035, 0.004, 0.018) * t;
    float n = 0.65 * nruido(q) + 0.35 * nruido(q * 2.3 + 5.1);
    float bancos = smoothstep(0.32, 0.78, n);
    // jirones: 3 m, mas deprisa, que se deshacen (el ruido tambien cambia en el tiempo por la cuarta componente falsa)
    vec3 r = p * vec3(0.32, 0.7, 0.32) + vec3(-0.22, 0.03, 0.12) * t + vec3(0.0, 0.0, 0.05 * t);
    float j = nruido(r);
    return 0.85 * h * (0.22 + 1.65 * bancos) * (0.55 + 0.9 * j);
  }
  // la neblina PEGADA AL MURO (el usuario: «que pille un poco la pared»): una capa de un par de metros delante de la
  // cara que se arrastra a lo largo de el, en parches alargados en horizontal con claros entre ellos y hebras finas que
  // los peinan, y que suben despacio; de frente vela trozos del muro y, mirando a lo largo de el, se ve espesa
  float densidadMuro(vec3 p, float t) {
    float dm = p.x - MURO_X;
    if (dm < -0.05 || dm > 4.5) return 0.0;
    vec3 w = vec3(p.z * 0.11 - 0.06 * t, p.y * 0.3 - 0.018 * t, dm * 0.35);
    float m = 0.6 * nruido(w) + 0.4 * nruido(w * 2.2 + vec3(3.1 + 0.04 * t, 1.7, 0.0));
    float parche = smoothstep(0.5, 0.72, m);
    float hebra = nruido(vec3(p.z * 0.38 - 0.13 * t, p.y * 1.5 - 0.02 * t, dm * 0.8));
    float pegada = exp(-max(dm, 0.0) / 1.4);
    float alto = smoothstep(-33.0, -28.0, p.y) * (1.0 - smoothstep(3.5, 5.5, p.y));
    return 0.42 * parche * (0.35 + 1.0 * hebra) * pegada * alto;
  }
  float densidadNiebla(vec3 p, float t) { return densidadAire(p, t) + densidadMuro(p, t); }
`;

const NL = 16;                                     // luces de punto que alumbran la neblina

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tProf; uniform mat4 uInvProy, uCamMundo; uniform vec3 uCam, uFrente, uAmb;
  uniform float uNear, uFar, uT, uK, uLejos;
  uniform vec3 uPL[${NL}], uPC[${NL}];
  varying vec2 vUv;
  ${DENSIDAD_GLSL}
  float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
  void main() {
    vec4 v = uInvProy * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); v /= v.w;
    vec3 dir = normalize((uCamMundo * vec4(v.xyz, 0.0)).xyz);
    float tMax = min(linZ(texture2D(tProf, vUv).r) / max(dot(dir, uFrente), 1e-3), uLejos);
    // ruido de gradiente entrelazado (fijo por pixel: sin titileo)
    float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    const int N = 26;
    float T = 1.0; vec3 L = vec3(0.0);
    for (int i = 0; i < N; i++) {
      // pasos que crecen con la distancia: cerca, la neblina se ve en detalle
      float u0 = float(i) / float(N), u1 = float(i + 1) / float(N);
      float tA = tMax * u0 * u0, tB = tMax * u1 * u1, dt = tB - tA;
      vec3 x = uCam + dir * mix(tA, tB, j);
      float s = densidadAire(x, uT) * uK;
      if (s < 1e-6) continue;
      vec3 Li = uAmb;
      for (int k = 0; k < ${NL}; k++) { vec3 d = uPL[k] - x; Li += uPC[k] / (dot(d, d) + 0.05); }
      float Ts = exp(-s * dt);
      L += T * Li * (1.0 - Ts);                     // la integral del tramo con la luz constante (Hillaire)
      T *= Ts;
    }
    // la capa pegada al MURO, con su propio recorrido de pasos finos por el tramo del rayo que la cruza (con los pasos
    // del aire, de hasta un metro, una capa de 1,4 m salia granulada); el aire de delante la vela (T del aire)
    float x0 = MURO_X - 0.05, x1 = MURO_X + 4.5;
    float tw0 = 0.0, tw1 = tMax;
    if (abs(dir.x) > 1e-4) {
      float ta = (x0 - uCam.x) / dir.x, tb = (x1 - uCam.x) / dir.x;
      tw0 = max(0.0, min(ta, tb)); tw1 = min(tMax, max(ta, tb));
    } else if (uCam.x < x0 || uCam.x > x1) tw1 = -1.0;
    if (tw1 > tw0) {
      const int NM = 12;
      float dtw = (tw1 - tw0) / float(NM), Tw = 1.0; vec3 Lw = vec3(0.0);
      for (int i = 0; i < NM; i++) {
        vec3 x = uCam + dir * (tw0 + (float(i) + j) * dtw);
        float s = densidadMuro(x, uT) * uK;
        if (s < 1e-6) continue;
        vec3 Li = uAmb;
        for (int k = 0; k < ${NL}; k++) { vec3 d = uPL[k] - x; Li += uPC[k] / (dot(d, d) + 0.05); }
        // devuelve algo mas de luz que el aire (le llega tambien la que rebota en el hormigon): delante de la pared se
        // ve como neblina clara y no como un velo del mismo gris que el muro
        Li *= 1.45;
        float Ts = exp(-s * dtw);
        Lw += Tw * Li * (1.0 - Ts);
        Tw *= Ts;
      }
      L += T * Lw; T *= Tw;
    }
    gl_FragColor = vec4(L, T);
  }
`;

// luces: [{ p: Vector3, color: Color (lineal), i: intensidad }]
export function crearNiebla({ ambiente, luces = [], lejos = 90 }) {
  const escena = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pl = [], pc = [];
  for (let k = 0; k < NL; k++) {
    const l = luces[k];
    pl.push(l ? l.p.clone() : new THREE.Vector3(0, -999, 0));
    pc.push(l ? l.color.clone().multiplyScalar(l.i) : new THREE.Vector3());
  }
  const u = {
    tProf: { value: null }, uInvProy: { value: new THREE.Matrix4() }, uCamMundo: { value: new THREE.Matrix4() },
    uCam: { value: new THREE.Vector3() }, uFrente: { value: new THREE.Vector3() }, uAmb: { value: ambiente.clone() },
    uNear: { value: 0.1 }, uFar: { value: 100 }, uT: { value: 0 }, uK: { value: 1 }, uLejos: { value: lejos },
    uPL: { value: pl }, uPC: { value: pc.map((c) => (c.isColor ? new THREE.Vector3(c.r, c.g, c.b) : c)) },
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false }));
  quad.frustumCulled = false;
  escena.add(quad);
  function actualizar(t, camara, k) {
    u.uT.value = t; u.uK.value = k;
    camara.updateMatrixWorld();
    u.uInvProy.value.copy(camara.projectionMatrixInverse);
    u.uCamMundo.value.copy(camara.matrixWorld);
    camara.getWorldPosition(u.uCam.value);
    camara.getWorldDirection(u.uFrente.value);
    u.uNear.value = camara.near; u.uFar.value = camara.far;
  }
  // una luz que cambia (las que tiemblan): k es su indice en la lista
  function luz(k, i) { const l = luces[k]; if (l) u.uPC.value[k].set(l.color.r * i, l.color.g * i, l.color.b * i); }
  function pintar(renderer, rtNiebla, profundidad) {
    u.tProf.value = profundidad;
    const fondo = renderer.getClearColor(new THREE.Color()), alfa = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(rtNiebla);
    renderer.render(escena, cam);
    renderer.setRenderTarget(null);
    renderer.setClearColor(fondo, alfa);
  }
  return { actualizar, pintar, luz, uniforms: u };
}
