// LOS FOCOS DE LAS TORRES DEL MURO, con volumen (pedido: «mejora, haz mas realista el foco de la luz. Particulas»).
// Antes cada uno era un cilindro abierto aditivo al 3 %: una pantalla lisa de luz con el borde duro, que no casaba con
// lo que alumbraba el foco de verdad. Ahora tres cosas:
//  - el HAZ se integra a lo largo de cada rayo de la camara: el rayo entra en el cono de luz (analitico), sale por la
//    cara de atras de la malla del cono o donde haya algo (la profundidad del mundo) y por el camino se suma la luz que
//    devuelve la bruma, con la MISMA apertura y penumbra que la SpotLight de three (los dos que alumbran la base caen
//    justo donde se ve el haz), con un nucleo mas claro, la bruma que se mueve con el viento (ruido que deriva) y la
//    funcion de fase de Henyey-Greenstein (la bruma devuelve la luz algo mas hacia delante: mirando hacia la lampara el
//    haz se enciende). Va a media resolucion en su propio render target y el pase final lo suma al 3D;
//  - POLVO en suspension: una nube de motas alrededor de la camara (la caja va con ella y cada mota se queda quieta en
//    el mundo mientras tanto: deriva con el viento, cae despacio y destella al girar) alumbrada por los seis focos con
//    la misma cuenta que el haz, asi que solo se ve dentro de la luz y brilla sobre todo a contraluz; las que en pantalla
//    miden menos de un pixel no se encogen sino que se apagan en proporcion (si no, titilan);
//  - el DESLUMBRAMIENTO de la lampara: un halo que crece cuando se mira desde dentro del cono.
import * as THREE from 'three';
import { DENSIDAD_GLSL } from './niebla.js';

const NF = 6;                                            // focos que alumbran el polvo (los seis de la coronacion)

// lo que comparten: la luz de un foco en un punto del mundo (la apertura y la penumbra de getSpotAttenuation de three)
// y la bruma (ruido de valor 3D, dos octavas)
const LUZ_GLSL = /* glsl */`
  uniform float uCosA, uCosP, uAlcance, uDecae;
  float luzDe(vec3 x, vec3 A, vec3 D, float I, out vec3 l) {
    vec3 r = x - A; float d = length(r); l = r / max(d, 1e-4);
    float c = dot(l, D);
    float spot = smoothstep(uCosA, uCosP, c) * (0.55 + 0.9 * smoothstep(uCosP - 0.02, 1.0, c));   // con su nucleo
    // la caida del HAZ es mas suave que la de la luz en el suelo (1/d^1,4 de la SpotLight): el proyector concentra la
    // luz y en la bruma se ve casi igual de largo; con la caida puntual solo se veia un brillo junto a la lente
    float cae = 1.0 / (1.0 + pow(d / 3.0, uDecae));
    float corte = clamp(1.0 - pow(d / uAlcance, 4.0), 0.0, 1.0);
    return I * spot * cae * corte * corte;
  }
  float fase(float c, float g) { float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
  float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float ruido(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  // la bruma que dispersa la luz es la MISMA neblina de niebla.js (normalizada a ~0,7 a la altura de la base): el haz se
  // ve mas donde hay un banco y casi nada en un claro
  ${DENSIDAD_GLSL}
  float bruma(vec3 x, float t) { return min(densidadNiebla(x, t) * 27.0, 2.2); }   // (con tope: la del muro es muy espesa)
`;

// el HAZ: se pinta la cara de atras de un cono cerrado que envuelve la luz; cada pixel marcha por su rayo
const HAZ_VERT = /* glsl */`
  varying vec3 vMundo;
  void main() { vec4 m = modelMatrix * vec4(position, 1.0); vMundo = m.xyz; gl_Position = projectionMatrix * viewMatrix * m; }
`;
const HAZ_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tProf; uniform vec2 uRes; uniform float uNear, uFar, uT, uNiebla, uI; uniform vec3 uCol, uCam, uFrente, uA, uD;
  varying vec3 vMundo;
  ${LUZ_GLSL}
  // donde entra el rayo en el cono de luz (punta en uA, eje uD, coseno del medio angulo c): 0 si la camara ya esta dentro
  float entra(vec3 O, vec3 V, float c) {
    vec3 co = O - uA; float c2 = c * c, vd = dot(V, uD), cd = dot(co, uD);
    if (cd > 0.0 && cd * cd >= dot(co, co) * c2) return 0.0;
    float a = vd * vd - c2, b = 2.0 * (vd * cd - dot(V, co) * c2), k = cd * cd - dot(co, co) * c2;
    float disc = b * b - 4.0 * a * k;
    if (disc < 0.0 || abs(a) < 1e-6) return -1.0;
    float s = sqrt(disc), t1 = (-b - s) / (2.0 * a), t2 = (-b + s) / (2.0 * a);
    float tA = min(t1, t2), tB = max(t1, t2);
    if (tA > 0.0 && dot(co + tA * V, uD) > 0.0) return tA;
    if (tB > 0.0 && dot(co + tB * V, uD) > 0.0) return tB;
    return -1.0;
  }
  void main() {
    vec3 V = normalize(vMundo - uCam);
    float tSale = length(vMundo - uCam);
    // la profundidad del mundo en este pixel, en metros a lo largo del rayo
    float zb = texture2D(tProf, gl_FragCoord.xy / uRes).r * 2.0 - 1.0;
    float zv = 2.0 * uNear * uFar / (uFar + uNear - zb * (uFar - uNear));
    tSale = min(tSale, zv / max(dot(V, uFrente), 1e-3));
    float tEntra = entra(uCam, V, uCosA);
    if (tEntra < 0.0) tEntra = max(0.0, tSale - 6.0);
    if (tSale <= tEntra) discard;
    const int N = 16;
    float dt = (tSale - tEntra) / float(N);
    float j = fract(sin(dot(gl_FragCoord.xy + fract(uT * 7.3) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 suma = vec3(0.0);
    for (int i = 0; i < N; i++) {
      float t = tEntra + (float(i) + j) * dt;
      vec3 x = uCam + V * t, l;
      float e = luzDe(x, uA, uD, uI, l);
      if (e <= 0.0) continue;
      float trans = exp(-pow(uNiebla * t, 2.0));                       // la niebla del mundo (FogExp2) se lo come
      suma += e * fase(dot(l, -V), 0.3) * bruma(x, uT) * trans * dt;
    }
    gl_FragColor = vec4(uCol * suma * 0.05, 1.0);
  }
`;

// el POLVO: una caja de motas que va con la camara (cada una se queda en su sitio del mundo y da la vuelta a la caja al
// salirse por un lado); las alumbran los seis focos
const CAJA = new THREE.Vector3(20, 13, 20);
const POLVO_VERT = /* glsl */`
  attribute vec4 aSitio;            // sitio en la caja (0..1) y semilla
  uniform vec3 uCam, uCaja; uniform float uT, uEsc, uNiebla;
  uniform vec3 uAs[${NF}], uDs[${NF}]; uniform float uIs[${NF}];
  varying float vLuz;
  ${LUZ_GLSL}
  void main() {
    float sem = aSitio.w;
    // la deriva: viento y caida, y un remolino pequeno
    vec3 vel = vec3(0.09, -0.03, 0.05) * (0.6 + 0.8 * fract(sem * 7.1));
    vec3 x = aSitio.xyz * uCaja + vel * uT;
    x += 0.07 * vec3(sin(uT * 0.7 + sem * 40.0), sin(uT * 0.53 + sem * 23.0), cos(uT * 0.61 + sem * 31.0));
    // a la caja alrededor de la camara
    vec3 rel = mod(x - uCam + uCaja * 0.5, uCaja);
    x = uCam - uCaja * 0.5 + rel;
    vec3 b = rel / uCaja;
    float borde = smoothstep(0.0, 0.08, b.x) * smoothstep(1.0, 0.92, b.x) * smoothstep(0.0, 0.08, b.y) * smoothstep(1.0, 0.92, b.y)
                * smoothstep(0.0, 0.08, b.z) * smoothstep(1.0, 0.92, b.z);
    vec3 V = normalize(x - uCam);
    float luz = 0.0;
    for (int k = 0; k < ${NF}; k++) {
      vec3 l;
      float e = luzDe(x, uAs[k], uDs[k], uIs[k], l);
      if (e > 0.0) luz += e * fase(dot(l, -V), 0.55);
    }
    float destello = 0.3 + 0.7 * pow(0.5 + 0.5 * sin(uT * (1.5 + 3.0 * fract(sem * 11.0)) + sem * 60.0), 6.0);
    vec4 mv = viewMatrix * vec4(x, 1.0);
    gl_Position = projectionMatrix * mv;
    // tamano: motas de polvo y ceniza de 2 a 6 mm; por debajo de 1,6 px se queda en 1,6 px y se apaga en proporcion
    float dist = max(-mv.z, 0.05);
    float px = (0.002 + 0.004 * fract(sem * 13.0)) * uEsc / dist;
    gl_PointSize = clamp(px, 1.6, 9.0);
    float cobertura = min(1.0, (px / 1.6) * (px / 1.6));
    vLuz = luz * destello * borde * cobertura * smoothstep(0.25, 0.6, dist) * exp(-pow(uNiebla * dist, 2.0));
  }
`;
const POLVO_FRAG = /* glsl */`
  uniform vec3 uCol; varying float vLuz;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(uCol * vLuz * smoothstep(0.5, 0.1, d) * 1.6, 1.0);
  }
`;

// el DESLUMBRAMIENTO: un cuadrado de cara a la camara en la lente, que crece al mirar desde dentro del cono
const BRILLO_VERT = /* glsl */`
  uniform vec3 uA, uD, uCam; uniform float uCosA, uI, uI0;
  varying vec2 vP; varying float vK;
  void main() {
    vec3 haciaCam = normalize(uCam - uA);
    float k = smoothstep(uCosA - 0.12, 1.0, dot(haciaCam, uD));
    vK = (0.15 + k) * uI / uI0;
    vec4 mv = viewMatrix * vec4(uA + uD * 0.05, 1.0);
    mv.xy += position.xy * (0.35 + 2.2 * k * k);
    vP = position.xy;
    gl_Position = projectionMatrix * mv;
  }
`;
const BRILLO_FRAG = /* glsl */`
  uniform vec3 uCol; varying vec2 vP; varying float vK;
  void main() {
    float r = length(vP);
    float g = exp(-r * r * 9.0) * 1.4 + exp(-r * 3.2) * 0.35;
    float raya = exp(-abs(vP.y) * 40.0) * exp(-abs(vP.x) * 2.5) * 0.25;       // el destello horizontal de la lente
    gl_FragColor = vec4(uCol * (g + raya) * vK * smoothstep(1.0, 0.6, r), 1.0);
  }
`;

// focos: [{ x, y, z, objetivo: [x, y, z] o direccion: [x, y, z] }]
export function crearFocos(scene, focos, { angulo = 0.5, penumbra = 0.7, alcance = 34, decae = 1.4, intensidad = 26, color = '#dfe7f0' } = {}) {
  const escenaHaz = new THREE.Scene();
  const col = new THREE.Color(color);
  const cosA = Math.cos(angulo), cosP = Math.cos(angulo * (1 - penumbra));
  const LARGO = 24;                                      // hasta donde llega la malla que envuelve el haz
  const cam = new THREE.Vector3(), frente = new THREE.Vector3();
  const comunes = {
    tProf: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: 0.1 }, uFar: { value: 100 },
    uT: { value: 0 }, uNiebla: { value: 0 }, uCam: { value: cam }, uFrente: { value: frente }, uCol: { value: col },
    uCosA: { value: cosA }, uCosP: { value: cosP }, uAlcance: { value: alcance }, uDecae: { value: decae }, uI0: { value: intensidad },
  };
  const haces = [];
  const yArriba = new THREE.Vector3(0, -1, 0);
  for (const f of focos.slice(0, NF)) {
    const A = new THREE.Vector3(f.x, f.y, f.z);
    const D = f.objetivo ? new THREE.Vector3(...f.objetivo).sub(A).normalize() : new THREE.Vector3(...f.direccion).normalize();
    const propios = { uA: { value: A }, uD: { value: D }, uI: { value: intensidad } };
    // la malla: un cono cerrado algo mas abierto que la luz, de la lampara hacia abajo (su eje -Y va al eje del haz)
    const R = LARGO * Math.tan(angulo) * 1.05;
    const g = new THREE.CylinderGeometry(0.05, R, LARGO, 40, 1, false).translate(0, -LARGO / 2, 0);
    const haz = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { ...comunes, ...propios }, vertexShader: HAZ_VERT, fragmentShader: HAZ_FRAG,
      side: THREE.BackSide, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    haz.position.copy(A);
    haz.quaternion.setFromUnitVectors(yArriba, D);
    haz.frustumCulled = false;
    escenaHaz.add(haz);
    // el deslumbramiento
    const brillo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { ...comunes, ...propios }, vertexShader: BRILLO_VERT, fragmentShader: BRILLO_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    brillo.frustumCulled = false; brillo.renderOrder = 5;
    scene.add(brillo);
    haces.push({ haz, brillo, A, D, propios, real: !!f.objetivo });
  }
  // el polvo: 60.000 motas en una caja de 20 x 13 x 20 m que va con la camara (15 por m3)
  const N = 60000;
  const sitio = new Float32Array(N * 4);
  let s = 77;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < N * 4; k++) sitio[k] = r();
  const gp = new THREE.BufferGeometry();
  gp.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  gp.setAttribute('aSitio', new THREE.BufferAttribute(sitio, 4));
  const uPolvo = {
    ...comunes, uCaja: { value: CAJA }, uEsc: { value: 500 },
    uAs: { value: haces.map((h) => h.A) }, uDs: { value: haces.map((h) => h.D) }, uIs: { value: haces.map(() => intensidad) },
  };
  const polvo = new THREE.Points(gp, new THREE.ShaderMaterial({
    uniforms: uPolvo, vertexShader: POLVO_VERT, fragmentShader: POLVO_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  polvo.name = 'polvoFocos'; polvo.renderOrder = 4; polvo.frustumCulled = false;
  scene.add(polvo);

  // por fotograma: el reloj, la camara y la niebla; los focos tiemblan un poco y uno (el quinto) falla
  function actualizar(t, camara, niebla, alto) {
    comunes.uT.value = t;
    comunes.uNiebla.value = niebla;
    camara.getWorldPosition(cam);
    camara.getWorldDirection(frente);
    comunes.uNear.value = camara.near; comunes.uFar.value = camara.far;
    uPolvo.uEsc.value = alto * 0.5 / Math.tan(THREE.MathUtils.degToRad(camara.fov) / 2);
    const falla = Math.sin(t * 0.9) > 0.86 && Math.sin(t * 31) > 0;
    haces.forEach((h, k) => {
      const I = k === 2 ? intensidad * (0.96 + 0.04 * Math.sin(t * 17.3)) : k === 4 && falla ? intensidad * 0.12 : intensidad;
      h.propios.uI.value = I; uPolvo.uIs.value[k] = I;
    });
  }
  // el haz, en su render target (a media resolucion), leyendo la profundidad del mundo
  function pintar(renderer, camara, rtHaz, profundidad) {
    comunes.tProf.value = profundidad;
    comunes.uRes.value.set(rtHaz.width, rtHaz.height);
    const fondo = renderer.getClearColor(new THREE.Color()), alfa = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(rtHaz);
    renderer.clear();
    renderer.render(escenaHaz, camara);
    renderer.setRenderTarget(null);
    renderer.setClearColor(fondo, alfa);
  }
  return { actualizar, pintar, escenaHaz, haces, polvo };
}
