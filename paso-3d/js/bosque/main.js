// Boundland · EL PASO A 3D POR EL BOSQUE (2026-10-21; sustituye al del conducto, que sigue en conducto.html). Pedido del
// usuario: «en alguna secuencia mientras va entrando ves agregando arboles en primer plano, por delante del personaje,
// solo algunos, no muchos, arboles 3d, poco a poco, hasta que este todo verde y sea completamente 3d. Aparecera el
// primer muro de 4 metros de altura y a partir de ahi, el muro mas grande delante».
//
// El 18 anda por el bosque en 2D (bosque/plano2d.js, pintado con las piezas de El Linde del juego, con lo que se mueve
// encima y un lienzo de DELANTE que va encima del 18). El bosque 3D (bosque/arboles3d.js) YA ESTA entero desde el
// principio (2026-10-22: «los modelos 3D no tienen que ir apareciendo progresivamente, ya estan»): aparece por los fallos
// y la mezcla. La camara del 3D es hasta ahi el teleobjetivo que ve lo mismo que el 2D (de lado, 2 grados a 258 m):
// entonces viaja a la tercera persona detras del 18, que se convierte por bandas de su carton al .glb. Se sigue por
// el bosque en 3D hasta su borde, y alli, al fondo del campo, el MURO EXTERIOR de 4 m (la escena de muro4.html) y, 300 m
// mas alla, el muro grande en la bruma. Ahi se para, mira, y la camara se abre. No se salta.
//
// Un solo lienzo WebGL: el 2D se sube como textura; el 3D se pinta en render targets: mientras el 2D manda, solo lo que
// brota (la capa 3, con fondo transparente) va ENCIMA del 2D; despues, el 3D entero con su neblina. El 18 va en su
// propia capa encima de todo y lo tapa lo que tiene delante (los arboles de delante pasan por delante de el).
import * as THREE from 'three';
import { B } from './datos.js';
import { cargarSprites, fotograma } from '../sprites.js';
import { crearPlano2D } from './plano2d.js';
import { crearBosque3D, CAPA_BOSQUE } from './arboles3d.js';
import { crearMuro4, M4 } from '../muro4/mundo.js';
import { crearNiebla4 } from '../muro4/niebla4.js';
import { cargarHeroe } from '../heroe.js';
import { crearSonido } from '../sonido.js';
import { CAPA18 } from '../carton18.js';

const qs = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const suave = (e) => e * e * (3 - 2 * e);
const paso01 = (a, b, x) => suave(Math.max(0, Math.min(1, (x - a) / (b - a))));
const mezclaN = (a, b, k) => a + (b - a) * k;
const CX = B.CAMINO_X;

// ------------------------------------------------------------------ render
const canvas = $('vista');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const lienzo = document.createElement('canvas');
const ctx = lienzo.getContext('2d');
const tex2D = new THREE.CanvasTexture(lienzo);
tex2D.colorSpace = THREE.NoColorSpace;                 // se pasa a lineal en el sombreador (una textura sRGB costaba 15 ms)
tex2D.generateMipmaps = false;
tex2D.minFilter = tex2D.magFilter = THREE.LinearFilter;
// el lienzo de DELANTE del 2D (hierba viva, primer plano en silueta, hojas que caen): el pase final lo pone encima del 18
const lienzoFr = document.createElement('canvas');
const ctxFr = lienzoFr.getContext('2d');
const texFr = new THREE.CanvasTexture(lienzoFr);
texFr.colorSpace = THREE.NoColorSpace; texFr.generateMipmaps = false;
texFr.minFilter = texFr.magFilter = THREE.LinearFilter;

const escena = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(B.FOV0, 16 / 9, 0.05, 3000);
const opRT = () => ({ samples: 4, type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(16, 16) });
const rtF = new THREE.WebGLRenderTarget(16, 16, opRT());       // el 3D entero
const rtO = new THREE.WebGLRenderTarget(16, 16, opRT());       // solo lo que brota, sobre transparente (encima del 2D)
const rt18 = new THREE.WebGLRenderTarget(16, 16, opRT());      // el 18
const rtNiebla = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, depthBuffer: false });

// EL 18 POR BANDAS: en que tiras horizontales de la pantalla (en pixeles) ya es 3D. La misma cuenta la hacen el pase
// final (para quitar ahi el carton) y los materiales del .glb (para pintarlo solo ahi): cada tira tiene su turno fijo, mas
// algo de ruido que cambia 14 veces por segundo, asi el borde parpadea
const BANDAS = { uK18: { value: 0 }, uTB: { value: 0 }, uPxB: { value: 12 } };
const BANDA18 = `
    float hB(float n) { return fract(sin(n * 91.345 + 3.1) * 47453.5453); }
    float banda18(float py) {
      if (uK18 >= 0.999) return 1.0;
      if (uK18 <= 0.001) return 0.0;
      float tq = floor(uTB * 14.0), b = floor(py / uPxB);
      return step(mix(hB(b * 1.731), hB(b * 7.13 + tq * 3.31), 0.3), uK18);
    }`;
function enBandas(m) {
  const antes = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (antes) antes.call(m, sh, r);
    Object.assign(sh.uniforms, BANDAS);
    sh.fragmentShader = 'uniform float uK18, uTB, uPxB;\n' + BANDA18 + '\n' +
      sh.fragmentShader.replace('void main() {', 'void main() {\n\tif (banda18(gl_FragCoord.y) < 0.5) discard;');
  };
  m.customProgramCacheKey = () => 'bandas18';
  m.needsUpdate = true;
}

const comp = new THREE.ShaderMaterial({
  uniforms: {
    t2D: { value: tex2D }, tO: { value: rtO.texture }, tF: { value: rtF.texture }, t18: { value: rt18.texture },
    tProfO: { value: rtO.depthTexture }, tProfF: { value: rtF.depthTexture }, tProf18: { value: rt18.depthTexture },
    tNiebla: { value: rtNiebla.texture }, uNieb: { value: 0 }, uResN: { value: new THREE.Vector2(1, 1) }, uNear: { value: 0.1 }, uFar: { value: 100 },
    uUsa2D: { value: 1 }, uUsaO: { value: 0 }, uUsaF: { value: 0 }, uUsa18: { value: 0 }, uMezcla: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) }, uCentro: { value: new THREE.Vector2(0.5, 0.5) }, uVineta: { value: 0.78 }, uGrano: { value: 0.042 },
    uNegro: { value: 1 }, uTiempo: { value: 0 }, uRaya: { value: 0 }, uBandas: { value: 0 },
    uK18: BANDAS.uK18, uTB: BANDAS.uTB, uPxB: BANDAS.uPxB, tFr: { value: texFr }, uUsaFr: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D t2D, tO, tF, t18, tProfO, tProfF, tProf18, tNiebla, tFr;
    uniform float uUsaFr;
    uniform float uNieb, uNear, uFar, uUsa2D, uUsaO, uUsaF, uUsa18, uMezcla, uVineta, uGrano, uNegro, uTiempo, uRaya, uBandas;
    uniform float uK18, uTB, uPxB;
    uniform vec2 uResN, uRes, uCentro;
    varying vec2 vUv;
    float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
    float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    ${BANDA18}
    float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
    vec4 nieblaEn(vec2 uv) {
      vec2 p = uv * uResN - 0.5, f = fract(p), b = (floor(p) + 0.5) / uResN;
      float z0 = linZ(texture2D(tProfF, uv).r);
      vec4 s = vec4(0.0); float ws = 0.0;
      for (int k = 0; k < 4; k++) {
        vec2 o = vec2(float(k - (k / 2) * 2), float(k / 2)), uvk = b + o / uResN;
        float zk = linZ(texture2D(tProfF, uvk).r);
        float w = (o.x > 0.5 ? f.x : 1.0 - f.x) * (o.y > 0.5 ? f.y : 1.0 - f.y) / (0.002 + abs(zk - z0) / max(z0, 0.1));
        s += texture2D(tNiebla, uvk) * w; ws += w;
      }
      return s / max(ws, 1e-6);
    }
    // el 3D con la paleta del juego en El Linde (dibujo/hk.js con el despertar): menos saturado (satMedio 0,6) y tenido
    // del color de la zona (#4f7068, kMedio 0,3, en modo 'color': conserva la luminancia); lo calido que brilla (las
    // setas) se queda como esta
    vec3 etalon(vec3 c) {
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      vec3 d = mix(vec3(l), c, 0.6);
      vec3 tinta = vec3(0.0782, 0.162, 0.138);
      d = mix(d, tinta * (l / 0.1425), 0.3);
      float calido = smoothstep(0.015, 0.12, c.r - c.b) * smoothstep(0.35, 0.7, l);
      return mix(d, c, calido);
    }
    // el mundo en uv: el 2D, lo que brota encima y el 3D entero con su neblina, mezclados por capa (0 el 2D, 1 el 3D)
    vec3 mundo(vec2 uv, float capa) {
      uv = clamp(uv, vec2(0.0005), vec2(0.9995));
      vec3 c = vec3(0.0);
      if (uUsa2D > 0.5) {
        vec3 a = texture2D(t2D, uv).rgb;
        c = mix(a / 12.92, pow((a + 0.055) / 1.055, vec3(2.4)), step(0.04045, a));
        // lo que brota, encima del 2D (premultiplicado: fondo transparente)
        if (uUsaO > 0.5) { vec4 o = texture2D(tO, uv); c = c * (1.0 - o.a) + etalon(o.rgb); }
      }
      if (uUsaF > 0.5) {
        vec3 f = texture2D(tF, uv).rgb;
        if (uNieb > 0.001) { vec4 nb = nieblaEn(uv); f = mix(f, f * nb.a + nb.rgb, uNieb); }
        c = mix(c, etalon(f), capa);
      }
      return c;
    }
    void main() {
      // LOS FALLOS (los del conducto): bandas que se corren a saltos, un tiron de toda la imagen, colores separados y,
      // en algunas tiras, el otro mundo (el 2D donde ya manda el 3D, el 3D donde aun manda el 2D)
      vec2 uv = vUv;
      float g = uRaya;
      float tq = floor(uTiempo * 30.0);
      float nb = mix(12.0, 44.0, h1(tq * 1.7 + 3.0));
      float banda = floor(uv.y * nb);
      float rb = h1(banda * 13.1 + tq * 7.3);
      float desplaza = rb < g * 0.55 ? (h1(banda + tq * 1.3) - 0.5) * 0.11 * g : 0.0;
      float tiron = step(0.9, h1(tq * 3.1)) * g * (h1(tq + 9.0) - 0.5) * 0.035;
      uv.x += desplaza + tiron;
      float otra = step(1.0 - uBandas, h1(banda * 5.7 + tq * 3.3 + 1.0));
      float capa = uUsa2D > 0.5 ? clamp(uMezcla + otra * (uMezcla < 0.5 ? 1.0 : -1.0), 0.0, 1.0) : 1.0;
      float sep = 0.0042 * g + 0.0016 * otra;
      vec3 c = sep > 0.0001
        ? vec3(mundo(uv + vec2(sep, 0.0), capa).r, mundo(uv, capa).g, mundo(uv - vec2(sep, 0.0), capa).b)
        : mundo(uv, capa);
      // hilos claros horizontales y alguna raya vertical de pelicula
      c += step(0.993, h2(vec2(floor(vUv.y * uRes.y * 0.5), tq))) * g * 0.3;
      c = mix(c, vec3(0.62, 0.66, 0.7), step(0.9978, h2(vec2(floor(vUv.x * uRes.x * 0.33), floor(tq / 3.0)))) * g * 0.6);
      c *= 1.0 - 0.16 * g * (0.5 + 0.5 * sin(vUv.y * uRes.y * 3.14159));
      // el 18 de carton encima, salvo donde el mundo esta delante y salvo en las bandas que ya son 3D (ahi se ve el .glb,
      // que esta en el mundo y en esas mismas bandas es lo unico que se pinta de el)
      if (uUsa18 > 0.5) {
        vec4 p18 = texture2D(t18, vUv);
        float dm = uMezcla > 0.5 ? texture2D(tProfF, vUv).r : (uUsaO > 0.5 ? texture2D(tProfO, vUv).r : 1.0);
        float k = (1.0 - step(dm, texture2D(tProf18, vUv).r - 1e-6)) * (1.0 - banda18(gl_FragCoord.y));
        c = c * (1.0 - p18.a * k) + p18.rgb * k;
      }
      // lo de delante del 2D, encima del 18 (donde manda el 2D)
      if (uUsaFr > 0.5) {
        vec4 fr = texture2D(tFr, uv);
        vec3 fl = mix(fr.rgb / 12.92, pow((fr.rgb + 0.055) / 1.055, vec3(2.4)), step(0.04045, fr.rgb));
        c = mix(c, fl, fr.a * (1.0 - capa));
      }
      // EL ACABADO DEL DESPERTAR (despertar.acabado del juego, con las cifras de su RECETA), sobre todo, el 18 incluido:
      // vineta ovalada centrada en el 18 (sin irse mas de un cuarto de pantalla del centro) que enfria y apaga los
      // bordes, los negros a pizarra (screen), el viraje azul de las sombras y el grano
      vec4 o = linearToOutputTexel(vec4(max(c, vec3(0.0)), 1.0));
      vec2 fo = vec2(clamp(uCentro.x, 0.27, 0.73), clamp(1.0 - uCentro.y + 0.06, 0.3, 0.66));
      float dd = length(vec2((vUv.x - fo.x) / 0.62, ((1.0 - vUv.y) - fo.y) / 0.78));
      float v = pow(clamp((dd - 0.35) / 0.75, 0.0, 1.0), 1.6);
      o.rgb *= (1.0 - uVineta * v) * (vec3(1.0) - 0.25 * (vec3(1.0) - vec3(0.55, 0.68, 0.85)) * v);
      o.rgb = 1.0 - (1.0 - o.rgb) * (1.0 - vec3(0.027, 0.039, 0.039));
      o.rgb += vec3(-0.006, 0.0, 0.012) * (1.0 - dot(o.rgb, vec3(0.299, 0.587, 0.114)));
      o.rgb *= 1.0 - uNegro;
      o.rgb += (h2(vUv * uRes + fract(uTiempo * 7.13) * 91.0) - 0.5) * uGrano * (1.0 - uNegro);
      gl_FragColor = o;
    }`,
  depthTest: false, depthWrite: false,
});
const compEscena = new THREE.Scene(), compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp); quad.frustumCulled = false; compEscena.add(quad);

let W = 1, H = 1;
function encajar() {
  const pr = Math.min(devicePixelRatio || 1, 1080 / innerHeight);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  const v = renderer.getDrawingBufferSize(new THREE.Vector2());
  W = v.x; H = v.y;
  lienzo.width = W; lienzo.height = H; tex2D.dispose();
  lienzoFr.width = W; lienzoFr.height = H; texFr.dispose();
  for (const r of [rtF, rtO, rt18]) r.setSize(W, H);
  rtNiebla.setSize(Math.ceil(W / 2), Math.ceil(H / 2));
  comp.uniforms.uResN.value.set(Math.ceil(W / 2), Math.ceil(H / 2));
  comp.uniforms.uRes.value.set(W, H);
  cam.aspect = W / H; cam.updateProjectionMatrix();
  if (plano) plano.redimensionar(W, H);
}

// ------------------------------------------------------------------ el mundo: el sitio del muro + el bosque
// el trozo del muro llega hasta su campo; aqui se anda tambien por el bosque, hasta el caballon del foso (no se salta)
M4.BORDE.z0 = B.Z0 - 20; M4.BORDE.z1 = B.TOPE_Z;
const muro = crearMuro4(escena, { sencillo: true });         // solo el muro: sin puesto ni lo de fuera
// EL BARRIDO DE LA CAMARA en el giro: con las mismas cuentas que ponerCamara (el 18 andando a 1,8 m/s desde CAMBIO),
// donde esta la camara y adonde mira para cada g del giro (de 0 a 1, por tiempo)
// LA CAMARA DEL GIRO en g (0-1, por tiempo): kz el zoom de lado, ko la orbita; fov, distancia al foco, rumbo y cabeceo
function giroCam(g) {
  const G = B.GIRO, kz = suave(paso01(0, G.zoom, g)), ko = suave(paso01(G.orbita0, 1, g));
  const tO = Math.tan(THREE.MathUtils.degToRad(G.fovO) / 2);
  // el zoom: fov y alto visible en logaritmo, del teleobjetivo del 2D al fovO a R0 m
  let fov = Math.exp(mezclaN(Math.log(B.FOV0), Math.log(G.fovO), kz));
  const alto = Math.exp(mezclaN(Math.log(B.VISTA_H), Math.log(2 * G.R0 * tO), kz));
  let dist = alto / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  // la orbita: el cuarto de vuelta, cerrandose
  fov = mezclaN(fov, G.fov1, ko); dist = mezclaN(dist, G.R1, ko);
  return { kz, ko, fov, dist, yaw: mezclaN(-Math.PI / 2, -Math.PI, ko), pitch: mezclaN(0, B.PITCH1, ko) };
}
// EL BARRIDO DE LA CAMARA en el giro: con las mismas cuentas que ponerCamara, donde esta la camara y adonde mira para
// cada g (el giro va por lo que avanza el 18: en g esta en zf)
function camaraDelGiro(g) {
  const c = giroCam(Math.min(1, g)), zf = B.CAMBIO + Math.min(1, g) * (B.GIRO1 - B.CAMBIO);
  const cp = Math.cos(c.pitch), fz = zf + 1.2 * (1 - c.kz);
  return { dist: c.dist, foco: [CX, fz], dir: [Math.sin(c.yaw) * cp, Math.cos(c.yaw) * cp] };
}
// LO QUE ESTORBA AL GIRO: lo que quede entre la camara y el 18 en ese barrido (un tronco, una mata) le pasaria por
// delante; no se planta nada cerca de la linea de vista en los 18 m que la camara ve por delante del 18 (lo de antes lo
// recorta su plano cercano)
const estorba = (() => {
  const tramos = [];
  for (let g = 0; g <= 1.0001; g += 0.015) {
    const c = camaraDelGiro(g), L = Math.min(c.dist, 18.5);
    tramos.push([c.foco[0], c.foco[1], c.foco[0] + c.dir[0] * L, c.foco[1] + c.dir[1] * L]);
  }
  return (x, z, r) => tramos.some(([ax, az, bx, bz]) => {
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - ax - dx * t, z - az - dz * t) < r + 0.5;
  });
})();
const bosque = crearBosque3D(escena, {
  suelo: muro.suelo, M: muro.M, estorba,
  // lo del campo del muro que ya ocupa sitio: las torres de alta tension y los arboles secos
  escaparse: [{ x: -38, z: -72, r: 6 }, { x: 46, z: -88, r: 6 }, { x: -48, z: -40, r: 3 }, { x: 6, z: -46, r: 3 }, { x: 44, z: -33, r: 3 }, { x: -34, z: -22, r: 3 },
    { x: -21, z: -14, r: 3 }, { x: 18, z: -24, r: 3 }, { x: 31, z: -15, r: 3 }, { x: 1.35, z: -27.8, r: 2.6 },
    // los erizos checos (ahora entre los arboles) y lo de dentro: la chabola, la hoguera y los arboles secos
    ...[[-5.6, -11.5], [5.2, -12.6], [-7.4, -17.8], [7.8, -19.2], [-1.2, -21.5], [14.5, -14.2], [-16.5, -13.0]].map(([x, z]) => ({ x, z, r: 1.1 })),
    { x: -62, z: 18, r: 3 }, { x: 38, z: 21, r: 3 }, { x: -6, z: 34, r: 3 }],
});
muro.choques.circulos.push(...bosque.choques);
const mundo = {
  ...muro,
  altura: (x, z) => (z < B.Z_LLANO ? bosque.altura(x, z) : muro.altura(x, z)),
  salida: { x: CX, z: B.Z0, giro: 0 },
};
const Y0 = bosque.altura(CX, B.Z0);                 // el suelo del tramo 2D (llano)
// EL ALBA EN PENUMBRA (2026-10-22: el usuario pidio la manana, sobre las 7, y luego que se pareciera al diseno visual de
// Boundland): no hay sol a la vista; la luz es la del alba metida en la bruma, fria y baja, como en El Linde del juego
// (azul pizarra con verde gris, lo calido solo en lo que brilla). Los focos del mastil y las luces de lejos, apagados
{
  const L = muro.luces;
  L.hemi.color.set('#9fb1b6'); L.hemi.groundColor.set('#262b25'); L.hemi.intensity = 0.95;
  L.luna.color.set('#d4e0e6'); L.luna.intensity = 1.25;
  for (const f of L.focos) f.intensity = 0;
  L.luzCaseta.intensity *= 0.4; L.aplique.intensity *= 0.4; L.vela.intensity *= 0.3;
  const u = escena.getObjectByName('cielo').material.uniforms;
  u.uArriba.value.set('#1a2329'); u.uHorizonte.value.set('#4b5a5e'); u.uFrio.value.set('#33424a'); u.uCiudad.value.set('#56625f');
  escena.fog.color.set('#2f3a3c');
  const ll = escena.getObjectByName('lucesLejos'); if (ll) ll.visible = false;
}
const niebla = crearNiebla4({ ambiente: new THREE.Color('#4a5759'), luces: muro.lucesNiebla, focos: [] });
const iFuego = muro.lucesNiebla.findIndex((l) => l.tiembla);
const sonido = crearSonido();

// el 18 de carton: un plano de pie que mira a la camara del lateral (a -x), con el dibujo del 2D
const carton = (() => {
  const lz = document.createElement('canvas'); lz.width = lz.height = 16;
  const t = new THREE.CanvasTexture(lz); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.004, side: THREE.DoubleSide, fog: false }));
  m.rotation.y = -Math.PI / 2;                       // su x local va a +z (la derecha del 2D) y mira a -x
  m.layers.set(CAPA18); m.visible = false;
  escena.add(m);
  return {
    malla: m,
    lienzoDe(w, h) { if (lz.width !== w || lz.height !== h) { lz.width = w; lz.height = h; t.dispose(); } return lz; },
    poner(z0, y1, ancho, alto, alfa) {
      m.visible = alfa > 0.001; m.material.opacity = alfa;
      m.position.set(CX, y1 - alto / 2, z0 + ancho / 2); m.scale.set(ancho, alto, 1);
      t.needsUpdate = true;
    },
  };
})();
// EL CORTE: mientras la camara mira de lado (el teleobjetivo, a 258 m), por debajo de la raya del suelo el 2D ensena la
// tierra cortada; el 3D veria el suelo de canto y la bruma de lejos (una banda gris). Una lamina de tierra de pie delante
// del camino, con el mismo dibujo, lo tapa; al girar la camara baja y se va
const corte = (() => {
  const lz = document.createElement('canvas'); lz.width = 512; lz.height = 256;
  const q = lz.getContext('2d'), gv = q.createLinearGradient(0, 0, 0, 256);
  gv.addColorStop(0, '#1b2120'); gv.addColorStop(0.2, '#131817'); gv.addColorStop(1, '#070909');
  q.fillStyle = gv; q.fillRect(0, 0, 512, 256);
  let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 60; k++) { q.fillStyle = `rgba(${44 + r() * 20},${52 + r() * 18},${50 + r() * 14},${0.12 + r() * 0.16})`; q.beginPath(); q.ellipse(r() * 512, 20 + r() * 236, 4 + r() * 14, 2 + r() * 5, 0, 0, 7); q.fill(); }
  q.lineCap = 'round';
  for (let k = 0; k < 14; k++) { const x = r() * 512; q.strokeStyle = k % 3 ? '#161b1a' : '#202725'; q.lineWidth = 1.5 + r() * 4; q.beginPath(); q.moveTo(x, 0); q.bezierCurveTo(x + (r() - 0.5) * 60, 60, x + (r() - 0.5) * 80, 120, x + (r() - 0.5) * 100, 60 + r() * 180); q.stroke(); }
  const t = new THREE.CanvasTexture(lz); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  const largo = B.GIRO1 + 30 - (B.Z0 - 30), alto = 9;
  t.repeat.set(largo / 9, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(largo, alto), new THREE.MeshBasicMaterial({ map: t, fog: false, transparent: true }));
  m.rotation.y = -Math.PI / 2;
  m.position.set(CX - 7.2, Y0 - 0.03 - alto / 2, (B.GIRO1 + 30 + B.Z0 - 30) / 2);
  m.name = 'corte';
  // en la capa del 18: va encima de la bruma (la de la manana, clara, la blanqueaba) y la tapa lo que tenga delante
  m.layers.set(CAPA18);
  escena.add(m);
  return { malla: m, y: m.position.y };
})();
// la LUZ DEL BOSQUE: algo de relleno de cielo bajo las copas (a contraluz del sol bajo los troncos eran manchas negras)
const luzBosque = new THREE.HemisphereLight('#a9bcc2', '#2c3228', 0);
escena.add(luzBosque);
// las luces alumbran tambien la capa del 18 y la del bosque (three solo cuenta las luces de las capas que ve la camara)
escena.traverse((o) => { if (o.isLight) { o.layers.enable(CAPA18); o.layers.enable(CAPA_BOSQUE); } });
const cielo = escena.getObjectByName('cielo');

let sprites = null, plano = null, heroe = null, tresListo = false;

// LAS RAFAGAS DE LOS FALLOS: puestas a lo largo del camino (no en el tiempo: si el 18 se para, se para todo), cada una
// de dz metros, mas fuertes cerca del pico; una fuerte justo donde empieza a moverse la camara
const hashN = (n, s) => { const x = Math.sin(n * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
const RAFAGAS = (() => {
  const F = B.FALLOS, L = [{ z: B.CAMBIO - 0.2, dz: 0.7, a: 0.95 }];
  let z = F.z0, s = 9;
  const azar = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  while (z < F.z1) {
    const r = azar(), cerca = 1 - Math.min(1, Math.abs(z - F.pico) / 13);
    if (Math.abs(z - B.CAMBIO) > 1.2) L.push({ z, dz: 0.25 + 0.5 * azar(), a: (0.2 + 0.35 * azar()) * (0.45 + 0.55 * cerca) });
    z += mezclaN(2.4, 0.8, cerca) * (0.7 + 0.6 * r);
  }
  return L;
})();
function falloEn(z, t) {
  let g = 0, activa = -1;
  RAFAGAS.forEach((r, i) => {
    if (z < r.z || z > r.z + r.dz) return;
    const k = (z - r.z) / r.dz, parpadeo = hashN(Math.floor(t * 30), 17) < 0.75 ? 1 : 0.3;
    const v = r.a * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85 * 0.6) * parpadeo;
    if (v > g) { g = v; activa = i; }
  });
  return { g, activa };
}
// los fallos en z: la rafaga (con su sonido) y, en el tramo donde el 2D y el 3D se mezclan, tiras del otro mundo
function fallos(z) {
  const r = falloEn(z, E.t);
  if (r.activa >= 0 && E.rayaSonada !== r.activa) { E.rayaSonada = r.activa; sonido.raya(RAFAGAS[r.activa].a); }
  // mientras el 18 se convierte, un poco siempre
  E.raya = Math.max(r.g, 0.07 * Math.sin(Math.PI * E.s18));
  const mezcla2D = E.fase === 'dos' && z > B.MEZCLA0 - 3;
  E.bandas = tresListo && mezcla2D ? (r.g > 0.05 ? 0.5 : hashN(Math.floor(E.t * 20), 9) < 0.12 ? 0.3 : 0) : 0;
}

// ------------------------------------------------------------------ estado
const E = {};
const C = { yaw: -Math.PI / 2, pitch: 0, dist: 10, fov: B.FOV0, foco: new THREE.Vector3(), libre: false };
function reiniciar() {
  Object.assign(E, {
    t: 0, fase: 'dos', z: B.Z0, y: Y0, vz: 0, vy: 0, suelo: true, cara: 1, pose: 'reposo2', tAnim: 0, anim: 'reposo2', i: 0,
    ver18: !tresListo, mezcla: 0, giro: 0, giroS: 0, s18: 0, tCambio: -1, tLlegada: -1, control: true, niebla: 0,
    raya: 0, bandas: 0, rayaSonada: -1,
    cam2: { cx: B.Z0 + 1.2, cy: Y0 + B.ALTO_CAM }, tPaso: 0, tPieza: -1, brotados: 0,
  });
  C.libre = false; C.yaw = -Math.PI / 2; C.pitch = 0;
  bosque.reiniciar(); bosque.completar();          // el bosque 3D ya esta entero: no brota
  if (heroe && heroe.listo) { heroe.reiniciar(CX, Y0, B.Z0, 0); heroe.fisica = false; }
}

// ------------------------------------------------------------------ entrada
const teclas = new Set(), dbgTeclas = new Set();
let saltoPedido = false;
addEventListener('keydown', (e) => {
  sonido.iniciar();
  if (e.repeat) return;
  teclas.add(e.code);
  if (e.code === 'Space') { saltoPedido = true; e.preventDefault(); }
  if (e.code === 'KeyR') reiniciar();
  if (e.code === 'KeyH') $('ayuda').classList.toggle('oculto');
});
addEventListener('keyup', (e) => teclas.delete(e.code));
addEventListener('blur', () => teclas.clear());
let arrastre = null;
canvas.addEventListener('pointerdown', (e) => { sonido.iniciar(); arrastre = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { arrastre = null; });
addEventListener('pointermove', (e) => {
  if (!arrastre) return;
  const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
  arrastre = { x: e.clientX, y: e.clientY };
  if (!C.libre) return;
  C.yaw -= dx * 0.005;
  C.pitch = Math.max(-0.15, Math.min(1.1, C.pitch + dy * 0.004));
});
const pulsada = (...c) => c.some((k) => teclas.has(k) || dbgTeclas.has(k));
const DBG = { congelado: false, auto: qs.has('auto') };
function leerEntrada() {
  if (DBG.auto) return { der: true, izq: false, arriba: true, abajo: false, correr: false, andar: false, saltar: false, x: 0, z: E.fase === 'llegada' ? 0 : 1 };
  const p = {
    izq: pulsada('KeyA', 'ArrowLeft'), der: pulsada('KeyD', 'ArrowRight'), arriba: pulsada('KeyW', 'ArrowUp'), abajo: pulsada('KeyS', 'ArrowDown'),
    correr: pulsada('ShiftLeft', 'ShiftRight'), andar: pulsada('ShiftLeft', 'ShiftRight'), saltar: saltoPedido,
  };
  saltoPedido = false;
  p.x = (p.der ? 1 : 0) - (p.izq ? 1 : 0);
  p.z = (p.arriba ? 1 : 0) - (p.abajo ? 1 : 0);
  return p;
}

// ------------------------------------------------------------------ simulacion (60 Hz fijos)
const DT = 1 / 60;
function poner2(p) { if (E.pose !== p) { E.pose = p; E.tAnim = 0; } }
function paso(dt, inp) {
  E.t += dt;
  if (E.fase === 'dos') paso2D(dt, inp); else paso3D(dt, inp);
  // lo que brota (mientras se ve de lado) y, en el cambio, el resto del bosque
  const n = bosque.actualizar(E.t, E.z, E.fase);
  if (n && E.t - E.tPieza > 0.22) { E.tPieza = E.t; sonido.pieza(); }
  E.brotados += n;
  sonido.ambiente(0, 1);
}

function paso2D(dt, inp) {
  let dir = 0, v = 0;
  if (E.control) {
    dir = (inp.der ? 1 : 0) - (inp.izq ? 1 : 0);
    // corriendo se puede, pero al llegar al cambio va al paso del 18 en 3D
    v = mezclaN(inp.correr ? B.V2D_CORRE : B.V2D, B.V2D, paso01(B.MEZCLA0 - 4, B.MEZCLA0, E.z));
  }
  E.vz += (dir * v - E.vz) * Math.min(1, (dir ? 10 : 16) * dt);
  if (Math.abs(E.vz) < 0.02 && !dir) E.vz = 0;
  if (E.control && inp.saltar && E.suelo) { E.vy = 6.6; E.suelo = false; }
  if (!E.suelo) E.vy -= 24 * dt;
  let nz = E.z + E.vz * dt, ny = E.y + E.vy * dt;
  if (nz < B.Z0 - 1.5) { nz = B.Z0 - 1.5; E.vz = 0; }
  if (!tresListo && nz > B.MEZCLA0 - 0.01) { nz = B.MEZCLA0 - 0.01; E.vz = 0; }      // (sin el 3D listo, espera)
  if (ny <= Y0 && E.vy <= 0) { if (!E.suelo) sonido.paso(false); ny = Y0; E.vy = 0; E.suelo = true; }
  E.z = nz; E.y = ny;
  if (Math.abs(E.vz) > 0.1) E.cara = Math.sign(E.vz);
  if (!E.suelo) poner2(E.vy > 0 ? 'salto' : 'caer2');
  else if (Math.abs(E.vz) > 2.4) poner2('correr');
  else if (Math.abs(E.vz) > 0.2) poner2('andar');
  else poner2('reposo2');
  E.tAnim += dt;
  if (E.suelo && Math.abs(E.vz) > 0.2) { E.tPaso += dt; if (E.tPaso > (Math.abs(E.vz) > 2.4 ? 0.26 : 0.36)) { E.tPaso = 0; sonido.paso(false); } }
  // la camara 2D: algo adelantada
  E.cam2.cx += (E.z + 1.2 - E.cam2.cx) * Math.min(1, 6 * dt);
  E.cam2.cy += (Y0 + B.ALTO_CAM - E.cam2.cy) * Math.min(1, 5 * dt);
  // el 2D se va (el 3D ya lo tapa casi todo)
  E.mezcla = paso01(B.MEZCLA0, B.MEZCLA1, E.z);
  E.niebla = 0.18 * E.mezcla;
  fallos(E.z);
  // el 18 en 3D va ya a la vez, en su sitio (para que el cambio no tenga salto)
  if (tresListo) {
    heroe.pos.set(CX, E.y, E.z); heroe.vel.set(0, E.vz);
    heroe.paso(dt, { x: E.vz / 1.8, z: 0, andar: false, saltar: false }, -Math.PI / 2);
    heroe.pos.set(CX, E.y, E.z); heroe.raiz.position.copy(heroe.pos);
    heroe.brillo.value = 0.06; heroe.exterior.value = 1;
    ponerCamara(0);
  }
  if (tresListo && E.z >= B.CAMBIO && E.suelo) {
    E.fase = 'tres'; E.tCambio = E.t; E.giroS = 0; E.mezcla = 1;
    bosque.completar();
  }
}

function paso3D(dt, inp) {
  const hp = heroe.pos, est = mundo.estado;
  est.x = hp.x; est.z = hp.z; est.y = hp.y; est.suelo = heroe.suelo;
  let ent, yaw;
  if (E.fase === 'llegada') {
    // se para y mira el muro; luego, libre
    const tl = E.t - E.tLlegada;
    ent = { x: 0, z: 0, andar: true, saltar: false, gesto: tl > 0.9 && tl < 1.0 ? 2 : 0 };
    yaw = Math.PI;
    if (tl > 6.5) { E.fase = 'libre'; C.libre = true; }
  } else if (E.giroS < 0.999) {
    // mientras gira la camara solo se avanza por el camino (hacia delante: el paso va por lo que se avanza)
    ent = { x: 0, z: inp.arriba || inp.der ? 1 : 0, andar: false, saltar: false };
    yaw = Math.PI;
  } else {
    ent = { x: inp.x, z: inp.z, andar: inp.andar, saltar: inp.saltar };
    yaw = C.yaw;
  }
  heroe.paso(dt, ent, yaw);
  E.z = hp.z; E.y = hp.y; E.vz = heroe.vel.y;
  E.pose = Math.abs(E.vz) > 0.25 ? 'andar' : 'reposo2'; E.tAnim += dt;
  E.mezcla = 1;
  // el giro de la camara, por lo que avanza el 18 (si se para, se para; no vuelve atras)
  E.giro = Math.max(E.giro, Math.max(0, Math.min(1, (hp.z - B.CAMBIO) / (B.GIRO1 - B.CAMBIO))));
  E.giroS += (E.giro - E.giroS) * Math.min(1, 4 * dt);
  if (E.giro >= 1 && E.giroS > 0.995) E.giroS = 1;
  const g = E.giroS, gc = giroCam(g);
  // el 18 se convierte en 3D por bandas mientras gira la camara
  E.s18 = paso01(B.PASO18[0], B.PASO18[1], g);
  if (E.s18 > 0.995) E.s18 = 1;
  heroe.fisica = E.s18 >= 1;
  fallos(hp.z);
  heroe.brillo.value = 0.035; heroe.exterior.value = 1;
  // en el bosque, poca; en el campo del muro, la suya entera
  E.niebla = mezclaN(0.18, mezclaN(0.24, 0.75, paso01(-40, -14, hp.z)), gc.kz * gc.kz);
  if (E.fase === 'tres' && E.giroS >= 1 && hp.z > B.LLEGADA) { E.fase = 'llegada'; E.tLlegada = E.t; C.yaw = Math.PI; }
  if (heroe.suelo && heroe.vel.length() > 0.3) { E.tPaso += dt; if (E.tPaso > 0.3) { E.tPaso = 0; sonido.paso(false); } }
  E.cam2.cx += (hp.z + 1.2 - E.cam2.cx) * Math.min(1, 6 * dt);
  camara3(dt);
}

// ------------------------------------------------------------------ la camara 3D
// e = 0: el teleobjetivo de 2 grados que ve lo mismo que el 2D (de lado, desde -x, 9 m de alto); e = 1: tercera persona
// detras del 18 (que va hacia +z). Entre medias, travelling con zoom: fov y alto visible en logaritmo
function ponerCamara(g) {
  const hp = heroe ? heroe.pos : new THREE.Vector3(CX, E.y, E.z), c = giroCam(g), e = c.kz;
  C.foco.set(mezclaN(CX, hp.x, e), mezclaN(E.cam2.cy, hp.y + 0.72, e), mezclaN(E.cam2.cx, hp.z, e));
  C.fov = c.fov; C.dist = c.dist; C.yaw = c.yaw; C.pitch = c.pitch;
  colocar();
}
const _p = new THREE.Vector3();
function colocar() {
  const cp = Math.cos(C.pitch);
  _p.set(C.foco.x + Math.sin(C.yaw) * cp * C.dist, C.foco.y + Math.sin(C.pitch) * C.dist, C.foco.z + Math.cos(C.yaw) * cp * C.dist);
  if (C.dist < 30) _p.y = Math.max(_p.y, mundo.altura(_p.x, _p.z) + 0.25);
  cam.position.copy(_p);
  cam.lookAt(C.foco);
  cam.fov = C.fov;
  cam.near = Math.max(0.05, C.dist - 18);
  cam.far = C.dist + 2600;
  cam.updateProjectionMatrix();
}
function camara3(dt) {
  const hp = heroe.pos;
  if (E.giroS < 1) { ponerCamara(E.giroS); return; }
  const foco = new THREE.Vector3(hp.x, hp.y + 0.72, hp.z);
  if (E.fase === 'llegada') {
    // la camara se abre al muro: mas lejos, algo mas alta, mirando por encima del 18 hacia los dos muros
    const k = paso01(0.4, 5.5, E.t - E.tLlegada);
    C.yaw += (Math.PI - C.yaw) * Math.min(1, 2 * dt);
    C.dist += (mezclaN(3.4, 7.2, k) - C.dist) * Math.min(1, 2 * dt);
    C.pitch += (mezclaN(B.PITCH1, 0.03, k) - C.pitch) * Math.min(1, 2 * dt);
    C.fov += (mezclaN(50, 40, k) - C.fov) * Math.min(1, 2 * dt);
    foco.y += 1.4 * k;
  } else if (E.fase === 'libre') {
    if (!arrastre) C.pitch += (0.16 - C.pitch) * Math.min(1, 0.5 * dt);
    C.dist += (5 - C.dist) * Math.min(1, dt);
    C.fov += (48 - C.fov) * Math.min(1, dt);
    foco.y += 0.6;
  } else {
    C.yaw = Math.PI; C.pitch = B.PITCH1; C.dist += (3.4 - C.dist) * Math.min(1, 3 * dt); C.fov += (50 - C.fov) * Math.min(1, 2 * dt);
  }
  C.foco.lerp(foco, Math.min(1, 6 * dt));
  colocar();
}

// ------------------------------------------------------------------ dibujar
// LA CAPA DEL 18: el dibujo del 18 en el lienzo del carton y el carton en su sitio (como en la prueba del conducto)
function pintarCapa18(camJ) {
  const tres = E.fase !== 'dos';
  const alfa = tres && E.s18 >= 1 ? 0 : 1;          // (mientras se convierte, el pase final lo quita por bandas)
  if (alfa <= 0.001) { carton.poner(0, 0, 1, 1, 0); return; }
  const s0 = H / B.VISTA_H, gc = giroCam(tres ? E.giroS : 0);
  const altoV = 2 * gc.dist * Math.tan(THREE.MathUtils.degToRad(gc.fov) / 2);
  const nivel = Math.min(4, Math.pow(1.25, Math.max(0, Math.floor(Math.log(B.VISTA_H / altoV) / Math.log(1.25) + 1e-6))));
  const s = s0 * nivel;
  const X0 = -0.8, X1 = 0.8, Y0b = -0.4, Y1 = 1.5;
  let z0, y1;
  if (nivel === 1) {
    const px0 = Math.floor((E.z + X0 - camJ.cx) * s0 + W / 2), py0 = Math.floor(H / 2 - (E.y + Y1 - camJ.cy) * s0);
    z0 = camJ.cx + (px0 - W / 2) / s0; y1 = camJ.cy + (H / 2 - py0) / s0;
  } else { z0 = E.z + X0; y1 = E.y + Y1; }
  const w = Math.ceil((X1 - X0) * s) + 2, h = Math.ceil((Y1 - Y0b) * s) + 2;
  const c = carton.lienzoDe(w, h).getContext('2d');
  plano.pintar18(c, E, (z) => (z - z0) * s, (y) => (y1 - y) * s, s);
  carton.poner(z0, y1, w / s, h / s, alfa);
  // en la orbita el carton mira a la camara (de canto se veia un recorte aplastado)
  carton.malla.rotation.y = tres ? C.yaw : -Math.PI / 2;
}
function dibujar() {
  bosque.arbustos.actualizar(cam.position, E.t);       // los arbustos a su LOD y su viento
  // la pose del 18 (la pinta el 2D o la capa del 18)
  {
    const fr = E.pose, a = sprites.datos.anims[fr];
    let fps = null;
    if (fr === 'andar') fps = Math.max(8, Math.min(16, 14 * Math.abs(E.vz) / 1.8));
    if (fr === 'correr') fps = Math.max(10, 22 * Math.abs(E.vz) / 5.8);
    E.anim = a ? fr : 'reposo2';
    E.i = fr === 'salto' ? (E.vy > 3 ? 2 : 3) : fotograma(sprites, E.anim, E.tAnim, fps);
  }
  const capa18 = tresListo;
  E.ver18 = !capa18;
  const camJ = { cx: E.cam2.cx, cy: E.cam2.cy };
  const dos = E.fase === 'dos';
  const usa2D = dos && (E.mezcla < 1 || E.bandas > 0.001);
  const usaO = false;                               // (lo que brotaba encima del 2D: ya no brota nada)
  const usaF = tresListo && (E.mezcla > 0 || E.bandas > 0.001);
  if (usa2D) { plano.dibujar(ctx, E, camJ, ctxFr); tex2D.needsUpdate = true; texFr.needsUpdate = true; }
  if (heroe && heroe.listo) {
    heroe.raiz.visible = E.s18 > 0.001;
    heroe.raiz.scale.x = mezclaN(0.1, 1, E.s18);       // se infla de canto a su grosor mientras se convierte
    // (el 18 en .glb va siempre en el mundo, con su bruma: en la capa del 18 iba sin ella, oscuro, y al entrar en el
    // mundo saltaba a claro; con la cortina no hace falta ponerlo encima de nada)
    const enCapa = false;
    if (enCapa !== heroe.enCapa) { heroe.enCapa = enCapa; heroe.raiz.traverse((o) => o.layers.set(enCapa ? CAPA18 : 0)); }
  }
  BANDAS.uK18.value = dos ? 0 : E.s18; BANDAS.uTB.value = E.t; BANDAS.uPxB.value = Math.max(6, Math.round(H * 0.015));
  if (tresListo) {
    if (dos) ponerCamara(0);
    muro.actualizar(E.t, DT, heroe, cam);
    // el corte baja y se va al girar la camara; la luz del bosque, segun donde este el 18
    // (no baja: esta bajo el suelo, asi que donde se ve el suelo el suelo lo tapa; solo asoma donde el plano cercano
    // de la camara recorta el suelo de delante, y al hundirla ahi se veia el vacio, una franja blanca)
    corte.malla.visible = (dos || E.giroS < 1) && E.mezcla > 0.001;
    corte.malla.material.opacity = Math.min(1, E.mezcla * 1.5);      // (en el 2D, la tierra la pinta el 2D)
    luzBosque.intensity = 0.55 * (1 - paso01(-10, -4, E.z));
    // el sol de la manana: bajo (16 grados), por delante y a la derecha; la sombra sigue al 18
    const hp = heroe.pos, sol = muro.luces.luna;
    sol.target.position.set(hp.x, hp.y, hp.z); sol.position.set(hp.x + 20, hp.y + 15, hp.z + 48);
  }
  const fondo = renderer.getClearColor(new THREE.Color()), alfaFondo = renderer.getClearAlpha();
  if (usaO) {
    // solo lo que brota (capa 3), sobre transparente y sin cielo
    cam.layers.set(CAPA_BOSQUE);
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(rtO); renderer.render(escena, cam);
    renderer.setClearColor(fondo, alfaFondo);
    cam.layers.set(0);
  }
  if (usaF) {
    cam.layers.set(0); cam.layers.enable(CAPA_BOSQUE);
    renderer.setRenderTarget(rtF); renderer.render(escena, cam);
    cam.layers.set(0);
    if (E.niebla > 0.001) {
      niebla.actualizar(E.t, cam, 1, Math.max(0, C.dist - 22));      // (de lejos, el rayo empieza cerca del 18)
      if (iFuego >= 0) niebla.luz(iFuego, 0.5 * muro.luces.fuego.intensity / 9);
      niebla.pintar(renderer, rtNiebla, rtF.depthTexture);
    }
  }
  if (capa18) {
    pintarCapa18(camJ);
    const auto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(0x000000, 0);
    cam.layers.set(CAPA18);
    renderer.setRenderTarget(rt18); renderer.render(escena, cam);
    cam.layers.set(0);
    renderer.setClearColor(fondo, alfaFondo);
    renderer.shadowMap.autoUpdate = auto;
  }
  renderer.setRenderTarget(null);
  const u = comp.uniforms;
  u.uUsa2D.value = usa2D ? 1 : 0; u.uUsaO.value = usaO ? 1 : 0; u.uUsaF.value = usaF ? 1 : 0; u.uUsa18.value = capa18 ? 1 : 0;
  u.uMezcla.value = E.mezcla; u.uNieb.value = usaF ? E.niebla : 0;
  u.uRaya.value = E.raya; u.uBandas.value = E.bandas; u.uUsaFr.value = usa2D ? 1 : 0;
  u.uNear.value = cam.near; u.uFar.value = cam.far; u.uTiempo.value = E.t;
  u.uNegro.value = Math.max(0, 1 - E.t / 1.2);
  if (E.fase !== 'dos' && heroe) {
    const p = heroe.pos.clone().setY(heroe.pos.y + 0.5).project(cam);
    u.uCentro.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
  } else {
    const s = H / B.VISTA_H;
    u.uCentro.value.set(((E.z - E.cam2.cx) * s + W / 2) / W, 1 - (H / 2 - (E.y + 0.5 - E.cam2.cy) * s) / H);
  }
  u.uVineta.value = E.fase === 'llegada' || E.fase === 'libre' ? 0.62 : 0.78;      // (la de El Linde: 0,78)
  renderer.render(compEscena, compCam);
}

// ------------------------------------------------------------------ bucle
let acumulado = 0, tAnterior = null;
function bucle(ahora) {
  requestAnimationFrame(bucle);
  if (DBG.congelado) { tAnterior = ahora; return; }
  const dtr = tAnterior === null ? 16.7 : ahora - tAnterior;
  tAnterior = ahora;
  acumulado += Math.min(0.1, dtr / 1000);
  let n = 0;
  while (acumulado >= DT && n < 5) { paso(DT, leerEntrada()); acumulado -= DT; n++; }
  if (n === 5) acumulado = 0;
  dibujar();
  hud();
}
function hud() {
  let txt = '';
  if (E.fase === 'dos') txt = '<kbd>D</kbd> avanzar &nbsp; <kbd>Mayús</kbd> correr &nbsp; <kbd>Espacio</kbd> saltar';
  else if (E.fase === 'tres' && E.giroS < 1) txt = '<kbd>W</kbd> o <kbd>D</kbd> avanzar';
  else if (E.fase === 'tres' || E.fase === 'libre') txt = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> moverse &nbsp; <kbd>Mayús</kbd> andar &nbsp; <kbd>Espacio</kbd> saltar &nbsp; arrastrar: cámara';
  if (hud.txt !== txt) { hud.txt = txt; $('teclas').innerHTML = txt; }
}

// ------------------------------------------------------------------ arranque
encajar();
addEventListener('resize', encajar);
reiniciar();
sprites = await cargarSprites();
plano = crearPlano2D(sprites);
plano.redimensionar(W, H);
plano.empezar(Y0);
heroe = cargarHeroe(escena, mundo);
await Promise.all([heroe.cargado, plano.listo]);
heroe.raiz.traverse((o) => o.layers.set(0));
for (const m of [...heroe.materiales, ...heroe.tinta]) enBandas(m);
reiniciar();
// calentar: todo el bosque a la vista una vez, compilar y pintar detras de la pantalla de carga
{
  for (const s of bosque.sueltos) { s.obj.visible = true; s.obj.scale.setScalar(1); }
  bosque.completar();
  ponerCamara(0);
  await renderer.compileAsync(escena, cam, escena);
  const fotogramaSig = () => new Promise((r) => { requestAnimationFrame(r); setTimeout(r, 60); });
  cam.layers.set(0); cam.layers.enable(CAPA_BOSQUE);
  renderer.setRenderTarget(rtF); renderer.render(escena, cam); renderer.setRenderTarget(null);
  cam.layers.set(0);
  niebla.actualizar(0, cam, 1); niebla.pintar(renderer, rtNiebla, rtF.depthTexture);
  tresListo = true;
  reiniciar();
  for (const im of Object.values(sprites.hojas)) ctx.drawImage(im, 0, 0);
  for (let i = 0; i < 4; i++) { dibujar(); await fotogramaSig(); }
}
$('carga').remove();
requestAnimationFrame(bucle);

// ------------------------------------------------------------------ para probar desde fuera
window.__dbg = {
  E, C, B, mundo, bosque, escena, cam, renderer, get heroe() { return heroe; }, get plano() { return plano; }, get listo() { return tresListo; },
  congelar(v = true) { DBG.congelado = v; },
  auto(v = true) { DBG.auto = v; },
  pulsar(...c) { c.forEach((k) => dbgTeclas.add(k)); },
  soltar(...c) { (c.length ? c : [...dbgTeclas]).forEach((k) => dbgTeclas.delete(k)); },
  // desde el principio con el piloto automatico hasta que el 18 pasa de z (o t segundos), mas `luego` segundos; y pinta
  ir(z, luego = 0) {
    reiniciar();
    const antes = DBG.auto; DBG.auto = true;
    for (let i = 0; i < 60 * 300 && E.z < z; i++) paso(DT, leerEntrada());
    for (let i = 0; i < Math.round(luego / DT); i++) paso(DT, leerEntrada());
    DBG.auto = antes; acumulado = 0;
    dibujar();
    return { t: +E.t.toFixed(2), fase: E.fase, z: +E.z.toFixed(2), giro: +E.giroS.toFixed(3), mezcla: +E.mezcla.toFixed(2), brotados: E.brotados };
  },
  avanzar(s) { for (let i = 0; i < Math.round(s / DT); i++) paso(DT, leerEntrada()); dibujar(); return { t: +E.t.toFixed(2), fase: E.fase, z: +E.z.toFixed(2) }; },
  vista(x, y, z, yaw, pitch, dist, fov = 50) { C.foco.set(x, y, z); C.yaw = yaw; C.pitch = pitch; C.dist = dist; C.fov = fov; colocar(); dibujar(); return cam.position.toArray().map((v) => +v.toFixed(2)); },
  info() { const i = renderer.info; return { llamadas: i.render.calls, tris: i.render.triangles, ...bosque.info }; },
};
