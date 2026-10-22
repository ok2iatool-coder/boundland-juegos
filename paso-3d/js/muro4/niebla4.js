// LA NEBLINA del Muro Exterior: el mismo medio que niebla.js (densidad en cada punto, integrada por rayo hasta lo que
// tapa el pixel, a media resolucion, rgb = luz dispersada y a = transmitancia) con otra densidad, la de este sitio, que
// esta en el suelo y no en una sima:
//  - una capa que se arrastra a ras de suelo (casi toda por debajo de 1 m) y poca arriba;
//  - en el FOSO se encharca: por debajo de y = 0 solo hay aire dentro del foso, y ahi la neblina es espesa;
//  - FUERA es mas espesa que dentro (lo de fuera no se ve: el campo se pierde a 40 m);
//  - pegada a las caras del muro, en parches, mas por fuera;
//  - bancos que pasan con el viento, que sopla de fuera hacia dentro, y jirones.
// La alumbran el cielo, las luces de punto (hoguera, caseta, vela) y los dos FOCOS del mastil, cuyo haz sale aqui
// mismo: la luz de un foco solo llega dentro de su cono y se dispersa hacia delante (Henyey-Greenstein), asi el haz se
// ve mas mirando hacia la lampara.
import * as THREE from 'three';

export const DENSIDAD4_GLSL = /* glsl */`
  float nh3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float nruido(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(nh3(i), nh3(i + vec3(1, 0, 0)), f.x), mix(nh3(i + vec3(0, 1, 0)), nh3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(nh3(i + vec3(0, 0, 1)), nh3(i + vec3(1, 0, 1)), f.x), mix(nh3(i + vec3(0, 1, 1)), nh3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float densidadAire(vec3 p, float t) {
    float y = p.y;
    float h = 0.0022 * exp(-max(y, 0.0) / 40.0) + 0.024 * exp(-max(y + 0.1, 0.0) / 0.85) + 0.0045 * exp(-max(y, 0.0) / 7.0);
    h += 0.085 * smoothstep(0.05, -0.85, y);                    // en el foso se encharca
    h *= mix(1.0, 2.3, smoothstep(-1.0, -24.0, p.z));          // fuera, mas
    vec3 q = p * vec3(0.07, 0.26, 0.07) + vec3(0.025, 0.004, 0.05) * t;
    float n = 0.65 * nruido(q) + 0.35 * nruido(q * 2.3 + 5.1);
    float bancos = smoothstep(0.3, 0.78, n);
    vec3 r = p * vec3(0.36, 0.9, 0.36) + vec3(0.12, 0.03, 0.28) * t + vec3(0.0, 0.0, 0.05 * t);
    float j = nruido(r);
    return h * (0.25 + 1.6 * bancos) * (0.55 + 0.9 * j);
  }
  // pegada a las dos caras del muro (z = 0), hasta 3 m, en parches que se arrastran a lo largo; por fuera mas
  float densidadMuro(vec3 p, float t) {
    float dm = abs(p.z) - 0.15;
    if (dm < -0.05 || dm > 3.0) return 0.0;
    vec3 w = vec3(p.x * 0.12 - 0.05 * t, p.y * 0.35 - 0.015 * t, dm * 0.4 + step(0.0, p.z) * 7.0);
    float m = 0.6 * nruido(w) + 0.4 * nruido(w * 2.2 + vec3(3.1 + 0.04 * t, 1.7, 0.0));
    float parche = smoothstep(0.48, 0.72, m);
    float hebra = nruido(vec3(p.x * 0.4 - 0.13 * t, p.y * 1.5 - 0.02 * t, dm * 0.8));
    float pegada = exp(-max(dm, 0.0) / 1.1);
    float alto = 1.0 - smoothstep(1.0, 3.6, p.y);
    float lado = p.z < 0.0 ? 1.0 : 0.5;
    return 0.2 * parche * (0.35 + hebra) * pegada * alto * lado;
  }
  float densidadNiebla(vec3 p, float t) { return densidadAire(p, t) + densidadMuro(p, t); }
  // LO LEJANO: de uLejos en adelante no se marcha; se integra de una vez la parte de la densidad que solo depende de la
  // altura (tres capas exponenciales), con el factor de fuera en el punto medio y el de bancos y jirones en su media.
  // Asi no queda una raya donde acaba la marcha y el muro grande se ve a 300 m dentro y no se ve nada fuera
  float capa(float a, float H, float y0, float dy, float t0, float t1) {
    float e0 = exp(-max(y0 + dy * t0, 0.0) / H), e1 = exp(-max(y0 + dy * t1, 0.0) / H);
    if (abs(dy) < 1e-3) return a * 0.5 * (e0 + e1) * (t1 - t0);
    return a * H / dy * (e0 - e1);
  }
  float opticoLejos(vec3 o, vec3 d, float t0, float t1) {
    float tau = capa(0.0022, 40.0, o.y, d.y, t0, t1) + capa(0.024, 0.85, o.y + 0.1, d.y, t0, t1) + capa(0.0045, 7.0, o.y, d.y, t0, t1);
    vec3 m = o + d * (0.5 * (t0 + t1));
    return tau * mix(1.0, 2.3, smoothstep(-1.0, -24.0, m.z)) * 0.8;
  }
`;

const NL = 6, NS = 2;
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tProf; uniform mat4 uInvProy, uCamMundo; uniform vec3 uCam, uFrente, uAmb;
  uniform float uNear, uFar, uT, uK, uLejos, uInicio;
  uniform vec3 uPL[${NL}], uPC[${NL}];
  uniform vec3 uSP[${NS}], uSD[${NS}], uSC[${NS}]; uniform vec2 uSA[${NS}];
  varying vec2 vUv;
  ${DENSIDAD4_GLSL}
  float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
  const float PI4 = 12.566371;
  float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (PI4 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
  // la luz que llega a x desde las lamparas y los focos, ya con la fase hacia la camara (dir: el rayo de la camara)
  vec3 luces(vec3 x, vec3 dir) {
    vec3 Li = uAmb;
    for (int k = 0; k < ${NL}; k++) { vec3 d = uPL[k] - x; Li += uPC[k] / (dot(d, d) + 0.05); }
    for (int k = 0; k < ${NS}; k++) {
      vec3 d = x - uSP[k]; float L = length(d); d /= L;
      float cono = smoothstep(uSA[k].x, uSA[k].y, dot(d, uSD[k]));
      Li += uSC[k] * cono * hg(dot(d, -dir), 0.35) * PI4 / (1.0 + pow(L / 5.0, 1.4));
    }
    return Li;
  }
  void main() {
    vec4 v = uInvProy * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); v /= v.w;
    vec3 dir = normalize((uCamMundo * vec4(v.xyz, 0.0)).xyz);
    // (uInicio: donde empieza el rayo; con el teleobjetivo del paso a 3D la camara esta a 258 m y no hay que contar esa
    // bruma: bosque/main.js lo pone cerca de lo que se mira. 0 = desde la camara)
    float tMax = min(linZ(texture2D(tProf, vUv).r) / max(dot(dir, uFrente), 1e-3), uInicio + uLejos);
    float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    const int N = 30;
    float T = 1.0; vec3 L = vec3(0.0);
    for (int i = 0; i < N; i++) {
      float u0 = float(i) / float(N), u1 = float(i + 1) / float(N);
      float tA = uInicio + max(0.0, tMax - uInicio) * u0 * u0, tB = uInicio + max(0.0, tMax - uInicio) * u1 * u1, dt = tB - tA;
      vec3 x = uCam + dir * mix(tA, tB, j);
      float s = densidadAire(x, uT) * uK;
      if (s < 1e-6) continue;
      float Ts = exp(-s * dt);
      L += T * luces(x, dir) * (1.0 - Ts);
      T *= Ts;
    }
    // la capa pegada al muro, con pasos finos por el tramo del rayo que cruza la franja |z| < 3,15
    float z0 = -3.15, z1 = 3.15;
    float tw0 = 0.0, tw1 = tMax;
    if (abs(dir.z) > 1e-4) {
      float ta = (z0 - uCam.z) / dir.z, tb = (z1 - uCam.z) / dir.z;
      tw0 = max(uInicio, min(ta, tb)); tw1 = min(tMax, max(ta, tb));
    } else if (uCam.z < z0 || uCam.z > z1) tw1 = -1.0;
    if (tw1 > tw0) {
      const int NM = 14;
      float dtw = (tw1 - tw0) / float(NM), Tw = 1.0; vec3 Lw = vec3(0.0);
      for (int i = 0; i < NM; i++) {
        vec3 x = uCam + dir * (tw0 + (float(i) + j) * dtw);
        float s = densidadMuro(x, uT) * uK;
        if (s < 1e-6) continue;
        float Ts = exp(-s * dtw);
        Lw += Tw * luces(x, dir) * 1.35 * (1.0 - Ts);
        Tw *= Ts;
      }
      L += T * Lw; T *= Tw;
    }
    // lo de mas alla de uLejos, con la luz del cielo
    float tFin = min(linZ(texture2D(tProf, vUv).r) / max(dot(dir, uFrente), 1e-3), 1500.0);
    if (tFin > uInicio + uLejos) {
      float Tl = exp(-opticoLejos(uCam, dir, uInicio + uLejos, tFin) * uK);
      L += T * uAmb * (1.0 - Tl); T *= Tl;
    }
    gl_FragColor = vec4(L, T);
  }
`;

// luces: [{ p, color, i }] ; focos: [{ p, dir, cos0, cos1, color, i }]
export function crearNiebla4({ ambiente, luces = [], focos = [], lejos = 85 }) {
  const escena = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const vec = (c, i) => new THREE.Vector3(c.r * i, c.g * i, c.b * i);
  const u = {
    tProf: { value: null }, uInvProy: { value: new THREE.Matrix4() }, uCamMundo: { value: new THREE.Matrix4() },
    uCam: { value: new THREE.Vector3() }, uFrente: { value: new THREE.Vector3() }, uAmb: { value: vec(ambiente, 1) },
    uNear: { value: 0.1 }, uFar: { value: 100 }, uT: { value: 0 }, uK: { value: 1 }, uLejos: { value: lejos }, uInicio: { value: 0 },
    uPL: { value: Array.from({ length: NL }, (_, k) => (luces[k] ? luces[k].p.clone() : new THREE.Vector3(0, -999, 0))) },
    uPC: { value: Array.from({ length: NL }, (_, k) => (luces[k] ? vec(luces[k].color, luces[k].i) : new THREE.Vector3())) },
    uSP: { value: Array.from({ length: NS }, (_, k) => (focos[k] ? focos[k].p.clone() : new THREE.Vector3(0, -999, 0))) },
    uSD: { value: Array.from({ length: NS }, (_, k) => (focos[k] ? focos[k].dir.clone() : new THREE.Vector3(0, -1, 0))) },
    uSC: { value: Array.from({ length: NS }, (_, k) => (focos[k] ? vec(focos[k].color, focos[k].i) : new THREE.Vector3())) },
    uSA: { value: Array.from({ length: NS }, (_, k) => (focos[k] ? new THREE.Vector2(focos[k].cos0, focos[k].cos1) : new THREE.Vector2(1, 1))) },
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false }));
  quad.frustumCulled = false;
  escena.add(quad);
  function actualizar(t, camara, k, inicio = 0) {
    u.uT.value = t; u.uK.value = k; u.uInicio.value = inicio;
    camara.updateMatrixWorld();
    u.uInvProy.value.copy(camara.projectionMatrixInverse);
    u.uCamMundo.value.copy(camara.matrixWorld);
    camara.getWorldPosition(u.uCam.value);
    camara.getWorldDirection(u.uFrente.value);
    u.uNear.value = camara.near; u.uFar.value = camara.far;
    for (let k2 = 0; k2 < Math.min(NL, luces.length); k2++) u.uPL.value[k2].copy(luces[k2].p);
  }
  // una luz que cambia (la hoguera tiembla): k su indice
  function luz(k, i) { const l = luces[k]; if (l) u.uPC.value[k].copy(vec(l.color, i)); }
  function pintar(renderer, rt, profundidad) {
    u.tProf.value = profundidad;
    const fondo = renderer.getClearColor(new THREE.Color()), alfa = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(rt);
    renderer.render(escena, cam);
    renderer.setRenderTarget(null);
    renderer.setClearColor(fondo, alfa);
  }
  return { actualizar, pintar, luz, uniforms: u };
}
