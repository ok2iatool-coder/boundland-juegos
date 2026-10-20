// EL 3D: el conducto que cruza el muro, el muro de 40 m por su cara de dentro (muro.js) y la base pequena colgada de el a
// 35 m del suelo (pasarelas de rejilla, barandillas, una caseta, una escalera a una cubierta baja con un torno). Delante, la
// PARED DE RELLENO donde ira la ciudad: el mundo 3D no esta hecho y esta prueba no lo hace.
//
// Interfaz que pide heroe.js (copiado de boundland-bosque3d): altura(x, z), choques {circulos, cajas}, salida, borde y
// limitar(p) (aqui, que no se salga de lo que se pisa: las barandillas).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { D } from './datos.js';
import { crearObjetos } from './objetos.js';
import { crearMusgo } from './musgo.js';
import { construirMuro } from './muro.js';
import { caseta } from './casetas.js';

const C = D.CONDUCTO, MX = D.MURO_X;
const R = 0.27;                         // planta del 18 (0,24 en heroe.js) con algo de holgura contra las barandillas

// lo que se pisa: rectangulos [x0, x1, z0, z1] ya encogidos por la planta, con su altura (plana o en rampa por x)
const PISO = [
  { n: 'conducto', x0: 2.6, x1: MX + 0.1, z0: -C.ancho / 2 + R, z1: C.ancho / 2 - R, h: () => 0 },
  { n: 'rellano', x0: MX, x1: 22.2 - R, z0: -2.6 + R, z1: 2.6 - R, h: () => 0 },
  { n: 'pasarela', x0: 21.7, x1: 34.2, z0: -0.75 + R, z1: 0.75 - R, h: () => 0 },
  { n: 'plataforma', x0: 34.0, x1: 40.5 - R, z0: -3.4 + R, z1: 3.4 - R, h: () => 0 },
  { n: 'lateral', x0: MX + R, x1: 19.6 - R, z0: -14.2 + R, z1: -2.2, h: () => 0 },
  { n: 'escalera', x0: 19.6 - R - 0.05, x1: 24.6 + R, z0: -14.2 + R, z1: -12.4 - R, h: (x) => -3 * Math.min(1, Math.max(0, (x - 19.6) / 5)) },
  { n: 'cubierta', x0: 24.6, x1: 30.6 - R, z0: -16 + R, z1: -10.6 - R, h: () => -3 },
];
const CABINA = { x0: 36.8, x1: 40.0, z0: -3.1, z1: -0.6, alto: 2.3 };

function dentro(p, x, z, e = 0) { return x >= p.x0 - e && x <= p.x1 + e && z >= p.z0 - e && z <= p.z1 + e; }
function proyectar(p, x, z) { return [Math.max(p.x0, Math.min(p.x1, x)), Math.max(p.z0, Math.min(p.z1, z))]; }

export function altura(x, z) {
  let mejor = null, dm = Infinity;
  for (const p of PISO) {
    if (dentro(p, x, z, 0.001)) return p.h(x);
    const [px, pz] = proyectar(p, x, z), d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < dm) { dm = d; mejor = p; }
  }
  return mejor.h(x);
}

// textura de hormigon (paneles de 3 x 3 m con juntas, manchas, chorretones y poros), dibujada en un lienzo
function texturaHormigon() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d');
  let s = 7; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  c.fillStyle = '#8b939b'; c.fillRect(0, 0, 512, 512);
  for (let n = 0; n < 140; n++) {
    const x = r() * 512, y = r() * 512, rr = 10 + r() * 70;
    const g = c.createRadialGradient(x, y, 0, x, y, rr);
    const v = r() < 0.6 ? '40,46,52' : '170,176,182';
    g.addColorStop(0, `rgba(${v},${0.05 + r() * 0.12})`); g.addColorStop(1, `rgba(${v},0)`);
    c.fillStyle = g; c.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
  }
  for (let n = 0; n < 28; n++) {
    const x = r() * 512, y0 = [0, 256][Math.floor(r() * 2)] + 6, h = 40 + r() * 170;
    const g = c.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, `rgba(48,52,58,${0.15 + r() * 0.25})`); g.addColorStop(1, 'rgba(48,52,58,0)');
    c.fillStyle = g; c.fillRect(x, y0, 2 + r() * 8, h);
  }
  for (let n = 0; n < 1600; n++) { c.fillStyle = `rgba(40,44,50,${r() * 0.25})`; c.fillRect(r() * 512, r() * 512, 1.5, 1.5); }
  c.strokeStyle = 'rgba(28,32,37,.85)'; c.lineWidth = 3;
  c.strokeRect(1.5, 1.5, 509, 509);
  c.beginPath(); c.moveTo(0, 256); c.lineTo(512, 256); c.stroke();
  c.strokeStyle = 'rgba(200,205,210,.18)'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, 260); c.lineTo(512, 260); c.moveTo(0, 5); c.lineTo(512, 5); c.stroke();
  // pernos de los paneles con su chorreton de oxido PARDO (el naranja es solo de la Podredumbre)
  for (const [x, y] of [[40, 40], [472, 40], [40, 296], [472, 296]]) {
    const g = c.createLinearGradient(0, y, 0, y + 90);
    g.addColorStop(0, 'rgba(92,72,58,.45)'); g.addColorStop(1, 'rgba(92,72,58,0)');
    c.fillStyle = g; c.fillRect(x - 3, y, 6, 90);
    c.fillStyle = '#4b4f55'; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
// rejilla de las pasarelas: pletinas con huecos (alphaTest) para ver la bruma por debajo
function texturaRejilla() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, 128, 128);
  c.fillStyle = '#8f979f';
  for (let i = 0; i < 8; i++) { c.fillRect(i * 16, 0, 5, 128); c.fillRect(0, i * 16, 128, 3); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
// las SENALES de la base: placas de 128 px en una tira de ocho (codigos de puesto, peligro, electricidad, carga,
// franjas y camara); sin palabras, que el juego va en ingles y esto es una prueba en espanol
function texturaSenales() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128;
  const c = cv.getContext('2d');
  const placa = (i, fondo) => { c.fillStyle = fondo; c.fillRect(i * 128 + 4, 4, 120, 120); c.strokeStyle = '#1b1d20'; c.lineWidth = 5; c.strokeRect(i * 128 + 9, 9, 110, 110); };
  const texto = (i, t, tam, y = 64) => { c.fillStyle = '#16181b'; c.font = `bold ${tam}px Bahnschrift, Arial Narrow, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, i * 128 + 64, y); };
  const triangulo = (i) => { c.fillStyle = '#cdb766'; c.beginPath(); c.moveTo(i * 128 + 64, 16); c.lineTo(i * 128 + 116, 108); c.lineTo(i * 128 + 12, 108); c.closePath(); c.fill(); c.lineWidth = 7; c.strokeStyle = '#16181b'; c.stroke(); };
  placa(0, '#c3c6c2'); texto(0, 'G-1', 50);
  placa(1, '#c3c6c2'); texto(1, 'G-2', 50);
  placa(2, '#c3c6c2'); texto(2, 'P-4', 50);
  c.fillStyle = '#c3c6c2'; c.fillRect(3 * 128, 0, 128, 128); triangulo(3); texto(3, '!', 58, 76);
  c.fillStyle = '#c3c6c2'; c.fillRect(4 * 128, 0, 128, 128); triangulo(4);
  c.fillStyle = '#16181b'; c.beginPath(); c.moveTo(4 * 128 + 70, 40); c.lineTo(4 * 128 + 52, 74); c.lineTo(4 * 128 + 64, 74); c.lineTo(4 * 128 + 56, 100); c.lineTo(4 * 128 + 78, 64); c.lineTo(4 * 128 + 66, 64); c.closePath(); c.fill();
  placa(5, '#c3c6c2'); texto(5, '500', 46, 52); texto(5, 'kg/m\u00b2', 26, 88);
  c.save(); c.beginPath(); c.rect(6 * 128, 0, 128, 128); c.clip(); c.fillStyle = '#cdb766'; c.fillRect(6 * 128, 0, 128, 128); c.fillStyle = '#16181b';
  for (let k = -2; k < 6; k++) { c.beginPath(); c.moveTo(6 * 128 + k * 40, 128); c.lineTo(6 * 128 + k * 40 + 20, 128); c.lineTo(6 * 128 + k * 40 + 148, 0); c.lineTo(6 * 128 + k * 40 + 128, 0); c.closePath(); c.fill(); }
  c.restore();
  placa(7, '#c3c6c2');
  c.fillStyle = '#16181b'; c.fillRect(7 * 128 + 30, 50, 56, 30); c.fillRect(7 * 128 + 86, 56, 14, 18); c.fillRect(7 * 128 + 50, 80, 8, 24); c.fillRect(7 * 128 + 38, 100, 32, 6);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function texturaBruma() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  let s = 3; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let n = 0; n < 60; n++) {
    const x = r() * 256, y = r() * 256, rr = 20 + r() * 60;
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rr);
      g.addColorStop(0, `rgba(255,255,255,${0.12 + r() * 0.2})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(x + dx - rr, y + dy - rr, 2 * rr, 2 * rr);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// el CONDUCTO (y lo que hay dentro) no lo alumbran las luces de la escena: solo el 18 (su luz) y lo que entra por la
// salida. Asi esta completamente oscuro aunque fuera haya sol, sin depender de que la sombra lo cubra entero. Con
// `tramado`, lo que queda a menos de 1 m de la camara se deshace en puntos (si no, al pasar la camara junto a un bidon
// o unos cables tapaban media pantalla)
const PENUMBRA = [];
function materialConducto(albedo = '#7d868f', tramado = false, negro = false, colores = false) {
  const m = new THREE.ShaderMaterial({
    vertexColors: colores,
    defines: { ...(tramado ? { TRAMADO: 1 } : {}), ...(negro ? { NEGRO: 1 } : {}) },
    side: negro ? THREE.BackSide : THREE.FrontSide,
    uniforms: {
      uHeroe: { value: new THREE.Vector3() }, uHeroeI: { value: 1 }, uColHeroe: { value: new THREE.Color('#dfe6f0') },
      uSalida: { value: new THREE.Vector3(MX + 0.7, 1.0, 0) }, uSalidaI: { value: 1.25 }, uColSalida: { value: new THREE.Color('#c3d0dc') },
      uAlbedo: { value: new THREE.Color(albedo) }, uGanancia: { value: tramado ? 3.2 : 1 }, uAlcance: { value: tramado ? 3.4 : 2.6 },
    },
    vertexShader: /* glsl */`
      varying vec3 vP; varying vec3 vN; varying vec3 vC;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vP = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        vC = vec3(1.0);
        #ifdef USE_COLOR
        vC = color;
        #endif
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uHeroe, uColHeroe, uSalida, uColSalida, uAlbedo; uniform float uHeroeI, uSalidaI, uGanancia, uAlcance;
      varying vec3 vP; varying vec3 vN; varying vec3 vC;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float ruido(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      void main() {
        #include <logdepthbuf_fragment>
        #ifdef TRAMADO
        float dc = distance(vP, cameraPosition);
        float umbral = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (umbral > (dc - 0.6) / 1.0) discard;
        #endif
        #ifdef NEGRO
        gl_FragColor = vec4(0.004, 0.004, 0.005, 1.0);
        return;
        #endif
        vec3 n = normalize(vN);
        vec3 alb = uAlbedo * vC * (0.72 + 0.36 * ruido(vP * 2.7) + 0.12 * ruido(vP * 11.0));
        vec3 L = uHeroe - vP; float d = length(L);
        float ndl = max(dot(n, L / max(d, 1e-3)), 0.0);
        float aH = uGanancia * uHeroeI * (0.2 + 0.8 * ndl) / (1.0 + d * d * 3.4) * smoothstep(uAlcance, 0.3, d);
        vec3 S = uSalida - vP; float ds = length(S);
        // la luz de la salida se apaga pronto conducto adentro: a 6 m ya es un 4 % (con 2,6 m de caida, un 10 %, y desde
        // la base el fondo se veia claro)
        float aS = uSalidaI * (0.3 + 0.7 * max(dot(n, S / max(ds, 1e-3)), 0.0)) * exp(-ds / 1.8);
        // dos escalones, como el sombreado de tinta del 18 (MeshToon)
        float q = aH + aS;
        q = q < 0.02 ? q : mix(q, floor(q * 6.0 + 0.5) / 6.0, 0.2);
        vec3 col = alb * (uColHeroe * aH + uColSalida * aS) * (q / max(aH + aS, 1e-4));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  PENUMBRA.push(m);
  return m;
}

// el tramo de conducto pintado como en el 2D (plano.js): fondo casi negro y la costilla en medio con su tinta
function texturaTramo2D() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 230;
  const c = cv.getContext('2d');
  c.fillStyle = '#151b22'; c.fillRect(0, 0, 128, 230);
  let s = 5; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let n = 0; n < 40; n++) { c.fillStyle = `rgba(8,10,13,${r() * 0.18})`; c.beginPath(); c.ellipse(r() * 128, r() * 230, 6 + r() * 20, 3 + r() * 9, r() * 3, 0, 7); c.fill(); }
  c.fillStyle = '#212932'; c.fillRect(57.6, 0, 12.8, 230);
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(57.6, 0); c.lineTo(57.6, 230); c.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;          // se mezcla con la penumbra en sRGB, como el lienzo del 2D
  return t;
}
// el carton se alumbra como el 2D: el velo de penumbra con el hueco de luz alrededor del 18 (en el plano, no en 3D)
const CARTONES = [];
function materialCarton(mapa, conAlfa = false) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uMapa: { value: mapa }, uHeroe: { value: new THREE.Vector3() }, uOscuro: { value: 1 }, uVista: { value: 0 } },
    defines: conAlfa ? { ALFA: 1 } : {},
    transparent: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vP; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D uMapa; uniform vec3 uHeroe; uniform float uOscuro, uVista; varying vec3 vP; varying vec2 vUv;
      void main() {
        vec4 t = texture2D(uMapa, vUv);
        #ifdef ALFA
        if (t.a < 0.5) discard;
        #endif
        vec3 c = t.rgb;
        // el hueco de luz del 2D, que crece al despertar la vista (el 18 alumbra lo de alrededor en el 3D)
        float d = length(vP.xy - uHeroe.xy), R = (2.1 - 0.9 * uOscuro) * (1.0 + 1.7 * uVista);
        float hueco = (0.5 + 0.42 * uOscuro) * (d < 0.5 * R ? mix(1.0, 0.55, d / (0.5 * R)) : mix(0.55, 0.0, clamp((d - 0.5 * R) / (0.5 * R), 0.0, 1.0)));
        float velo = (0.56 + 0.43 * uOscuro) * (1.0 - hueco);
        c = c * (1.0 - velo) + vec3(1.0, 0.957, 0.886) * (0.07 + 0.05 * uOscuro) * max(0.0, 1.0 - d / 1.0);
        c = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  CARTONES.push(m);
  return m;
}

export function crearMundo3D(scene) {
  const gradiente = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  gradiente.minFilter = gradiente.magFilter = THREE.NearestFilter; gradiente.needsUpdate = true;
  const tHorm = texturaHormigon(), tRej = texturaRejilla(), tBruma = texturaBruma(), tSen = texturaSenales();
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradiente, ...extra });
  const M = {
    hormigon: toon('#9aa2aa', { map: tHorm }), hormigonOsc: toon('#5f6871'), acero: toon('#535b64'), aceroOsc: toon('#363c43'),
    rejilla: toon('#7d858d', { map: tRej, alphaTest: 0.5, side: THREE.DoubleSide }), madera: toon('#6c5c4b'), lona: toon('#5a646e'),
    caseta: toon('#8f979f'), cuerda: toon('#2c2925'), bidon: toon('#5b6255'),
    ventana: new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), ambar: new THREE.MeshBasicMaterial({ color: '#ffd8a8' }),
    tinta: new THREE.MeshBasicMaterial({ color: '#0b0a0c', side: THREE.BackSide }),
    negro: new THREE.MeshBasicMaterial({ color: '#07090b' }), ventanaTenue: new THREE.MeshBasicMaterial({ color: '#c4a679' }),
    focoLuz: new THREE.MeshBasicMaterial({ color: '#f1f5f9' }), ferralla: toon('#46352b'),
    // las casetas (casetas.js): chapa grecada, puerta, cristal y lo de dentro, que va sin luces de la escena y por eso
    // parece encendido (pared calida arriba, mas oscura abajo, techo claro, muebles, pantallas en ambar)
    chapa: toon('#7f878f'), puerta: toon('#4d555d'),
    vidrio: new THREE.MeshToonMaterial({ color: '#243039', gradientMap: gradiente, transparent: true, opacity: 0.42, depthWrite: false }),
    interiorPared: new THREE.MeshBasicMaterial({ color: '#8b7e6b' }), interiorBajo: new THREE.MeshBasicMaterial({ color: '#5e564b' }),
    interiorTecho: new THREE.MeshBasicMaterial({ color: '#a8997c' }), mueble: new THREE.MeshBasicMaterial({ color: '#3f3a34' }),
    pantalla: new THREE.MeshBasicMaterial({ color: '#d6b883' }), pantallaApagada: new THREE.MeshBasicMaterial({ color: '#2b2a28' }),
    plano: new THREE.MeshBasicMaterial({ color: '#b9ae93' }), senal: toon('#ffffff', { map: tSen }),
    conducto: materialConducto(),
  };
  M.conducto.shadowSide = THREE.DoubleSide;

  // ---------------------------------------------------------------- geometria por lotes (una malla por material)
  const lotes = {};
  const meter = (k, g) => (lotes[k] ||= []).push(g);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), uno = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
  function uvCaja(g, w, h, d, tile) {
    const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile); }
  }
  function caja(k, cx, cy, cz, w, h, d, o = {}) {
    m4.compose(new THREE.Vector3(cx, cy, cz), o.q || q.identity(), uno);
    const g = new THREE.BoxGeometry(w, h, d);
    if (o.tile) uvCaja(g, w, h, d, o.tile);
    meter(k, g.applyMatrix4(m4));
    const t = o.tinta ?? 0.014;
    if (t) meter('tinta', new THREE.BoxGeometry(w + 2 * t, h + 2 * t, d + 2 * t).applyMatrix4(m4));
  }
  const cajaE = (k, x0, x1, y0, y1, z0, z1, o) => caja(k, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, o);
  function barra(k, a, b, g, o = {}) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const qq = new THREE.Quaternion().setFromUnitVectors(Y, d.normalize());
    caja(k, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, g, L, g, { ...o, q: qq });
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function cilindro(k, a, b, r, n = 10, tinta = 0.012) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const qq = new THREE.Quaternion().setFromUnitVectors(Y, d.clone().normalize());
    m4.compose(a.clone().add(b).multiplyScalar(0.5), qq, uno);
    meter(k, new THREE.CylinderGeometry(r, r, L, n, 1, false).applyMatrix4(m4));
    if (tinta) meter('tinta', new THREE.CylinderGeometry(r + tinta, r + tinta, L + tinta, n, 1, false).applyMatrix4(m4));
  }
  // una SENAL de la tira de texturaSenales(): placa de w x h centrada en c y mirando a n
  function senal(cas, c, n, w, h) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (cas + 0.03 + 0.94 * uv.getX(i)) / 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().normalize()));
    g.translate(c.x, c.y, c.z);
    meter('senal', g);
  }
  const kCaseta = { cajaE: (...a) => cajaE(...a), barra: (...a) => barra(...a), cilindro: (...a) => cilindro(...a), senal };
  // un plano en x = cte (mira a +x) de hormigon, con la textura en coordenadas del mundo (paneles de 3 m)
  function planoX(k, x, y0, y1, z0, z1) {
    const g = new THREE.PlaneGeometry(z1 - z0, y1 - y0);
    g.rotateY(Math.PI / 2);
    g.translate(x, (y0 + y1) / 2, (z0 + z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, -p.getZ(i) / 3, p.getY(i) / 3);
    meter(k, g);
  }

  // ---------------------------------------------------------------- el conducto, por TRAMOS de 1 m
  // Cada tramo tiene dos versiones: su CARTON (el tramo pintado como en el 2D, en la pared del fondo) y su 3D (suelo,
  // techo, paredes con las caras hacia dentro, la costilla, el trozo de cable y los cascotes). Al cambiar a 3D todo es
  // carton (desde el lateral es identico al 2D); luego cada tramo se EXTRUYE desde su dibujo (el grupo crece en z desde la
  // pared del fondo), primero los de alrededor del 18 y despues los de delante, mientras la camara gira: la camara ve a
  // la vez tramos planos y tramos con volumen. Sin tapas: desde fuera se ve por dentro, como un corte.
  const W2 = C.ancho / 2, H = C.alto;
  const limpia = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; };
  function cara(lista, pts) {   // cuadrilatero [a, b, c, d] en sentido antihorario visto desde dentro
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3]]), 3));
    g.computeVertexNormals();
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(12), 2));
    lista.push(g);
  }
  const caja3 = (w, h, d, cx, cy, cz) => new THREE.BoxGeometry(w, h, d).translate(cx, cy, cz);
  const CASCOTES = [[3.6, -0.5, 0.22], [5.3, 0.45, 0.16], [8.2, -0.4, 0.2], [12.6, 0.5, 0.14], [15.1, -0.45, 0.18]];
  const tPintura = texturaTramo2D();
  M.carton = materialCarton(tPintura);
  const tramos = [];
  const NT = Math.ceil(MX - C.x0);
  for (let k = 0; k < NT; k++) {
    const a = C.x0 + k, b = k === NT - 1 ? MX + 0.02 : a + 1, xc = a + 0.5;
    const cuerpo = [], delante = [];
    cara(cuerpo, [[a, 0, W2], [b, 0, W2], [b, 0, -W2], [a, 0, -W2]]);            // suelo
    cara(cuerpo, [[a, H, -W2], [b, H, -W2], [b, H, W2], [a, H, W2]]);            // techo
    cara(cuerpo, [[a, 0, -W2], [b, 0, -W2], [b, H, -W2], [a, H, -W2]]);          // fondo
    cara(cuerpo, [[b, 0, W2], [a, 0, W2], [a, H, W2], [b, H, W2]]);              // delante (solo se ve desde dentro)
    if (xc < MX - 0.2) {
      cuerpo.push(caja3(0.1, 0.07, C.ancho, xc, 0.035, 0), caja3(0.1, 0.07, C.ancho, xc, H - 0.035, 0), caja3(0.1, H, 0.07, xc, H / 2, -W2 + 0.035));
      delante.push(caja3(0.1, H, 0.07, xc, H / 2, W2 - 0.035));
    }
    cuerpo.push(new THREE.CylinderGeometry(0.04, 0.04, b - a, 6).rotateZ(Math.PI / 2).translate((a + b) / 2, H - 0.22, -W2 + 0.16));
    for (const [x, z, t] of CASCOTES) if (x >= a && x < b) cuerpo.push(new THREE.BoxGeometry(t, t * 0.6, t * 1.2).rotateY(x).translate(x, t * 0.3, z));
    const grupo = new THREE.Group();
    grupo.position.z = -W2;                                   // el pivote en la pared del fondo: crece desde el dibujo
    const mc = new THREE.Mesh(mergeGeometries(cuerpo.map(limpia)).translate(0, 0, W2), M.conducto);
    mc.castShadow = true;
    grupo.add(mc);
    let md = null;
    if (delante.length) { md = new THREE.Mesh(mergeGeometries(delante.map(limpia)).translate(0, 0, W2), M.conducto); grupo.add(md); }
    const carton = new THREE.Mesh(new THREE.PlaneGeometry(b - a, H).translate((a + b) / 2, H / 2, -W2 + 0.004), M.carton);
    scene.add(grupo, carton);
    let h = Math.imul(k + 7, 2654435761) >>> 0; h = ((h ^ (h >>> 15)) >>> 0) / 4294967296;
    tramos.push({ k, xc, grupo, md, carton, pop: -1, s: 0, h });
  }
  // los objetos del conducto (objetos.js): dibujo primero y modelo despues
  const choques = { circulos: [], cajas: [] };
  const MO = { acero: materialConducto('#6a737c', true), aceroOsc: materialConducto('#454c54', true), madera: materialConducto('#7d6a55', true),
    cuerda: materialConducto('#3a3632', true), bidon: materialConducto('#66705e', true), tinta: materialConducto('#000000', true, true) };
  const objetos = crearObjetos(scene, MO, materialCarton, choques);

  // la MASA del muro alrededor del conducto: negra y sin luz. Desde la camara lateral del principio tapa todo menos el
  // corte del conducto, como la masa del 2D; sin ella se veia el cielo alrededor del conducto mientras giraba
  const masa = new THREE.Mesh(mergeGeometries([
    new THREE.BoxGeometry(34, D.TOPE_Y - H - 0.03, 60).translate(MX - 0.08 - 17, (H + 0.03 + D.TOPE_Y) / 2, W2 - 30),
    new THREE.BoxGeometry(34, 40, 60).translate(MX - 0.08 - 17, -0.03 - 20, W2 - 30),
    new THREE.BoxGeometry(34, H, 30).translate(MX - 0.08 - 17, H / 2, -W2 - 0.03 - 15),
  ].map(limpia)), new THREE.MeshBasicMaterial({ color: '#020304', fog: false }));
  // y una cortina negra en x = 17,9 por delante del corte: desde el lateral, mirando en diagonal, se veia la base de
  // fuera por encima del muro quitado (solo se ve desde dentro del muro: desde la base es su cara de atras)
  const cortina = new THREE.Mesh(new THREE.PlaneGeometry(300, 140).rotateY(-Math.PI / 2).translate(MX - 0.1, 0, W2 + 150),
    new THREE.MeshBasicMaterial({ color: '#020304', fog: false }));
  // y la cara de delante del conducto POR FUERA, negra, desde un poco por delante del 18 hasta la salida: desde el
  // lateral el corte solo deja ver el trozo del conducto donde esta el 18 (si no, en diagonal se veia la base por la
  // salida). Desde dentro es su cara de atras y no se pinta
  const frente = new THREE.Mesh(new THREE.PlaneGeometry(1, H + 0.2).translate(0.5, H / 2, W2 + 0.01),
    new THREE.MeshBasicMaterial({ color: '#020304', fog: false }));
  // y el FONDO del conducto, negro: en x = 0 empieza la sala, que solo existe en el 2D, y desde la base, mirando dentro,
  // se veia el cielo por el agujero. Mira a +x: desde el lateral del principio queda de canto y en el giro la camara
  // pasa por fuera de el
  const fondo = new THREE.Mesh(new THREE.PlaneGeometry(2 * W2 + 0.2, H + 0.2).rotateY(Math.PI / 2).translate(C.x0 + 0.01, H / 2, 0),
    new THREE.MeshBasicMaterial({ color: '#020304', fog: false }));
  scene.add(masa, cortina, frente, fondo);

  // ---------------------------------------------------------------- el muro por fuera (x = 18)
  // 40 m de muro con todos sus detalles (muro.js): paneles, contrafuertes, coronacion, garitas, focos, escalas, suelo...
  const muro = construirMuro(scene, { M, gradiente, caja, cajaE, barra, cilindro, meter, choques, W2, H, senal, caseta: (c) => caseta(kCaseta, c) });
  // la visera de hormigon sobre la salida (de ella cuelga el musgo, musgo.js)
  cajaE('hormigonOsc', MX, MX + 0.38, 2.25, 2.45, -1.5, 1.5, { tinta: 0.018 });
  // el marco de la salida y la escotilla abierta (bisagra en el lado +z)
  cajaE('aceroOsc', MX, MX + 0.12, -0.1, 0, -W2 - 0.12, W2 + 0.12, { tinta: 0.012 });
  cajaE('aceroOsc', MX, MX + 0.12, H, H + 0.12, -W2 - 0.12, W2 + 0.12, { tinta: 0.012 });
  cajaE('aceroOsc', MX, MX + 0.12, 0, H, -W2 - 0.12, -W2, { tinta: 0.012 });
  cajaE('aceroOsc', MX, MX + 0.12, 0, H, W2, W2 + 0.12, { tinta: 0.012 });
  const qEsc = new THREE.Quaternion().setFromAxisAngle(Y, -1.95);
  const bis = V(MX + 0.08, H / 2, W2 + 0.12), dEsc = V(0, 0, -C.ancho / 2).applyQuaternion(qEsc);
  caja('acero', bis.x + dEsc.x, bis.y, bis.z + dEsc.z, 0.05, H - 0.04, C.ancho, { q: qEsc, tinta: 0.012 });

  // ---------------------------------------------------------------- la base
  function plataforma(x0, x1, z0, z1, y) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.32, p.getZ(i) / 0.32);
    meter('rejilla', g);
    const e = 0.07;
    cajaE('acero', x0, x1, y - 0.14, y, z0 - e, z0, {}); cajaE('acero', x0, x1, y - 0.14, y, z1, z1 + e, {});
    cajaE('acero', x0 - e, x0, y - 0.14, y, z0, z1, {}); cajaE('acero', x1, x1 + e, y - 0.14, y, z0, z1, {});
    for (let x = x0 + 1.2; x < x1 - 0.3; x += 1.2) cajaE('aceroOsc', x - 0.04, x + 0.04, y - 0.2, y - 0.02, z0, z1, { tinta: 0.01 });
    if (z1 - z0 > 2) for (let z = z0 + 1.2; z < z1 - 0.3; z += 1.2) cajaE('aceroOsc', x0, x1, y - 0.26, y - 0.18, z - 0.04, z + 0.04, { tinta: 0.01 });
  }
  // barandilla de a a b (en planta) a la altura y: postes cada 1,2 m, pasamanos, barra media y rodapie
  function barandilla(ax, az, bx, bz, y, alto = 1.0) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 1.2));
    const qL = new THREE.Quaternion().setFromAxisAngle(Y, Math.atan2(-(bz - az), bx - ax));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      barra('acero', V(x, y, z), V(x, y + alto, z), 0.045, { tinta: 0.01 });
      cajaE('aceroOsc', x - 0.07, x + 0.07, y, y + 0.014, z - 0.07, z + 0.07, { tinta: 0.004 });               // placa del poste
      for (const [dx, dz] of [[-0.045, -0.045], [0.045, 0.045]]) cajaE('acero', x + dx - 0.012, x + dx + 0.012, y + 0.014, y + 0.03, z + dz - 0.012, z + dz + 0.012, { tinta: 0 });
    }
    for (const [h, g] of [[alto, 0.05], [alto * 0.52, 0.035]]) barra('acero', V(ax, y + h, az), V(bx, y + h, bz), g, { tinta: 0.01 });
    caja('aceroOsc', (ax + bx) / 2, y + 0.075, (az + bz) / 2, L, 0.13, 0.012, { q: qL, tinta: 0.004 });          // rodapie de chapa
  }
  // un aplique de pasarela en un poste, mirando a dentro (sz = -1 / +1: hacia -z / +z)
  function farol(x, y, z, sz) {
    cajaE('aceroOsc', x - 0.06, x + 0.06, y + 0.74, y + 0.9, z + sz * 0.02, z + sz * 0.1, { tinta: 0.006 });
    cajaE('ambar', x - 0.045, x + 0.045, y + 0.76, y + 0.84, z + sz * 0.1, z + sz * 0.105, { tinta: 0 });
    cajaE('aceroOsc', x - 0.065, x + 0.065, y + 0.9, y + 0.92, z + sz * 0.02, z + sz * 0.13, { tinta: 0 });     // visera
  }
  // torre de celosia que baja hasta perderse en la bruma
  function torre(x0, x1, z0, z1, ytop, ybot = D.SUELO_Y) {
    const pat = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    for (const [x, z] of pat) cajaE('hormigonOsc', x - 0.45, x + 0.45, ybot, ybot + 0.6, z - 0.45, z + 0.45, { tinta: 0.014 });
    for (const [x, z] of pat) barra('aceroOsc', V(x, ybot, z), V(x, ytop, z), 0.14, { tinta: 0.014 });
    for (const [x, z] of pat) cajaE('acero', x - 0.17, x + 0.17, ytop - 0.04, ytop, z - 0.17, z + 0.17, { tinta: 0.006 });   // tapa
    for (let y = ytop - 0.3; y > ybot + 3; y -= 3) {
      for (const [x, z] of pat) cajaE('aceroOsc', x - 0.13, x + 0.13, y - 0.13, y + 0.11, z - 0.13, z + 0.13, { tinta: 0.006 });   // nudo
      for (let i = 0; i < 4; i++) {
        const [ax, az] = pat[i], [bx, bz] = pat[(i + 1) % 4];
        barra('acero', V(ax, y, az), V(bx, y - 3, bz), 0.06, { tinta: 0.008 });
        barra('acero', V(bx, y, bz), V(ax, y - 3, az), 0.06, { tinta: 0.008 });
        barra('aceroOsc', V(ax, y, az), V(bx, y, bz), 0.07, { tinta: 0.008 });
      }
    }
  }

  // rellano de la salida
  plataforma(MX, 22.2, -2.6, 2.6, 0);
  barandilla(22.2, -2.6, 22.2, -0.75, 0); barandilla(22.2, 0.75, 22.2, 2.6, 0);
  barandilla(MX + 0.1, 2.6, 22.2, 2.6, 0); barandilla(19.6, -2.6, 22.2, -2.6, 0);
  for (const z of [-2.4, 2.4, 0]) barra('aceroOsc', V(21.9, -0.2, z), V(MX, -3.6, z), 0.1, { tinta: 0.01 });
  cajaE('madera', MX + 0.25, MX + 1.05, 0, 0.8, 1.4, 2.2, { tinta: 0.016 });
  cajaE('madera', MX + 0.3, MX + 0.85, 0.8, 1.32, 1.6, 2.15, { tinta: 0.014 });
  // pasarela principal, con tirantes al muro y una torre a mitad
  plataforma(22.2, 34, -0.75, 0.75, 0);
  barandilla(22.2, -0.75, 34, -0.75, 0); barandilla(22.2, 0.75, 34, 0.75, 0);
  for (const z of [-0.75, 0.75]) {
    barra('cuerda', V(MX + 1.05, D.TOPE_Y - 0.9, z * 1.6), V(27.6, 1.0, z), 0.025, { tinta: 0.006 });
    barra('cuerda', V(MX + 1.05, D.TOPE_Y - 0.9, z * 1.6), V(33.4, 1.0, z), 0.025, { tinta: 0.006 });
    cajaE('aceroOsc', MX + 1.0, MX + 1.12, D.TOPE_Y - 1.0, D.TOPE_Y - 0.82, z * 1.6 - 0.12, z * 1.6 + 0.12, { tinta: 0.008 });
  }
  torre(27.2, 28.4, -0.6, 0.6, -0.25);
  for (let i = 1; i < 10; i += 2) farol(22.2 + i * 1.18, 0, (i % 4 === 1 ? 1 : -1) * 0.75, i % 4 === 1 ? -1 : 1);
  for (const s of [-1, 1]) cilindro('aceroOsc', V(22.4, 0.82, s * 0.81), V(33.8, 0.82, s * 0.81), 0.018, 6, 0.004);   // el tubo de los apliques
  cajaE('acero', 22.3, 33.9, -0.42, -0.4, -0.3, -0.04, { tinta: 0.005 });                                           // bandeja de cables
  for (const z of [-0.3, -0.06]) cajaE('acero', 22.3, 33.9, -0.42, -0.34, z, z + 0.02, { tinta: 0 });
  for (const z of [-0.24, -0.17, -0.1]) cilindro('cuerda', V(22.3, -0.37, z), V(33.9, -0.37, z), 0.022, 6, 0);
  for (let x = 22.8; x < 33.9; x += 1.18) for (const z of [-0.31, -0.03]) barra('aceroOsc', V(x, -0.2, z), V(x, -0.42, z), 0.018, { tinta: 0 });
  senal(5, V(22.17, 0.78, -1.7), V(-1, 0, 0), 0.3, 0.3);                                                              // 500 kg/m2 a la salida del conducto
  // plataforma del final con la caseta, la farola, cajas y el mastil
  plataforma(34, 40.5, -3.4, 3.4, 0);
  barandilla(34, -3.4, 40.5, -3.4, 0); barandilla(34, 3.4, 40.5, 3.4, 0); barandilla(40.5, -3.4, 40.5, 3.4, 0);
  barandilla(34, -3.4, 34, -0.75, 0); barandilla(34, 0.75, 34, 3.4, 0);
  senal(7, V(33.97, 0.78, -2.1), V(-1, 0, 0), 0.28, 0.28);                                                            // aviso de camara
  for (const [x, z, sz] of [[35.4, 3.4, -1], [38.6, 3.4, -1], [35.4, -3.4, 1]]) farol(x, 0, z, sz);
  torre(34.6, 39.9, -2.9, 2.9, -0.27);
  const K = CABINA;
  // la caseta del puesto P-4 (casetas.js): puerta hacia la pasarela, ventana con rejas a la plataforma y otra al vacio,
  // camara en la esquina de la puerta, cuadro electrico junto a ella, rotativo en la cubierta
  caseta(kCaseta, { x0: K.x0, x1: K.x1, z0: K.z0, z1: K.z1, y0: 0, alto: K.alto, codigo: 2, rejas: true, antena: false,
    puerta: { lado: '-x', u: 1.25, mano: 'izq' },
    ventanas: [{ lado: '+z', u: 1.6, ancho: 1.8, v0: 0.95, v1: 1.75 }, { lado: '+x', u: 1.25, ancho: 1.1, v0: 1.0, v1: 1.7 }, { lado: '-x', u: 2.12, ancho: 0.36, v0: 1.1, v1: 1.7, visera: false }],
    camara: ['-x', false], cuadro: ['-x', 0.4], placaEn: ['-x', 0.46, 1.78], aire: [37.55, -2.35], canalon: '+z', rotativo: [K.x0 + 0.35, K.z1 - 0.3] });
  cilindro('aceroOsc', V(39.5, K.alto, -2.6), V(39.5, K.alto + 4.2, -2.6), 0.05, 8, 0.01);
  for (const y of [K.alto + 1.5, K.alto + 3]) barra('acero', V(39.5, y, -2.6), V(39.5, y - 0.4, -1.8), 0.03, { tinta: 0.006 });
  const punta = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), M.ambar.clone());
  punta.position.set(39.5, K.alto + 4.25, -2.6);
  scene.add(punta);
  cajaE('madera', 38.4, 39.2, 0, 0.8, 1.9, 2.7, { tinta: 0.016 });
  cajaE('madera', 39.3, 39.9, 0, 0.6, 2.3, 2.9, { tinta: 0.014 });
  cajaE('lona', 38.5, 39.1, 0.8, 1.15, 2.0, 2.6, { tinta: 0.012 });
  cilindro('aceroOsc', V(34.55, 0, 2.95), V(34.55, 2.7, 2.95), 0.05, 8, 0.01);
  barra('aceroOsc', V(34.55, 2.7, 2.95), V(35.3, 2.7, 2.95), 0.05, { tinta: 0.01 });
  cajaE('aceroOsc', 35.15, 35.55, 2.52, 2.7, 2.8, 3.1, { tinta: 0.012 });
  cajaE('ambar', 35.2, 35.5, 2.5, 2.53, 2.83, 3.07, { tinta: 0 });
  // pasarela pegada al muro hacia -z, escalera y cubierta baja con un torno que asoma sobre el vacio
  plataforma(MX, 19.6, -14.2, -2.6, 0);
  barandilla(19.6, -2.6, 19.6, -12.4, 0); barandilla(MX + 0.1, -14.2, 19.6, -14.2, 0);
  for (let z = -3.5; z > -14; z -= 3) barra('aceroOsc', V(19.4, -0.2, z), V(MX, -2.2, z), 0.08, { tinta: 0.01 });
  // la escalera: peldanos sobre dos zancas (para el 18 es una rampa: heroe.js pisa la altura de PISO)
  for (const z of [-14.2, -12.4]) {
    barra('acero', V(19.6, -0.05, z), V(24.6, -3.05, z), 0.12, { tinta: 0.012 });
    barra('acero', V(19.6, 1.0, z), V(24.6, -2.0, z), 0.05, { tinta: 0.01 });
    for (let i = 0; i <= 4; i++) { const x = 19.6 + i * 1.25; barra('acero', V(x, -3 * i / 4, z), V(x, -3 * i / 4 + 1.0, z), 0.045, { tinta: 0.01 }); }
  }
  for (let i = 0; i < 16; i++) {
    const x = 19.75 + i * 0.3125, y = -3 * (x - 19.6) / 5;
    cajaE('acero', x - 0.14, x + 0.14, y - 0.04, y, -14.15, -12.45, { tinta: 0.008 });
  }
  for (let z = -14.05; z < -12.5; z += 0.3) senal(6, V(19.6, 0.012, z + 0.15), V(0, 1, 0), 0.3, 0.3);
  senal(3, V(19.57, 0.78, -11.4), V(-1, 0, 0), 0.28, 0.28);
  plataforma(24.6, 30.6, -16, -10.6, -3);
  barandilla(24.6, -16, 30.6, -16, -3); barandilla(24.6, -10.6, 30.6, -10.6, -3); barandilla(30.6, -16, 30.6, -10.6, -3);
  barandilla(24.6, -12.4, 24.6, -10.6, -3); barandilla(24.6, -16, 24.6, -14.2, -3);
  torre(25.2, 30.0, -15.4, -11.2, -3.27);
  // el torno: bancada, dos placas que sujetan el tambor (con sus valonas y el cable enrollado), motor con aletas y su
  // reductora, mando colgado de un poste, freno, la pluma con su tornapunta y la polea, y el cable al gancho
  cajaE('aceroOsc', 28.3, 29.5, -3, -2.85, -14.3, -12.0, { tinta: 0.012 });
  for (const z of [-14.25, -12.62]) {
    cajaE('aceroOsc', 28.55, 29.25, -2.85, -1.75, z, z + 0.07, { tinta: 0.01 });
    for (const [dx, dy] of [[-0.25, -0.75], [0.25, -0.75]]) cilindro('acero', V(28.9 + dx, -2.0 + dy, z - 0.01), V(28.9 + dx, -2.0 + dy, z + 0.08), 0.03, 6, 0);
  }
  cilindro('acero', V(28.9, -2.0, -14.18), V(28.9, -2.0, -12.62), 0.26, 16, 0.012);
  for (const z of [-14.18, -12.7]) cilindro('aceroOsc', V(28.9, -2.0, z), V(28.9, -2.0, z + 0.06), 0.38, 16, 0.008);
  cilindro('cuerda', V(28.9, -2.0, -14.1), V(28.9, -2.0, -12.75), 0.3, 16, 0.006);
  for (let z = -14.05; z < -12.8; z += 0.07) cilindro('aceroOsc', V(28.9, -2.0, z), V(28.9, -2.0, z + 0.012), 0.305, 16, 0);
  cajaE('aceroOsc', 28.6, 29.2, -2.85, -1.75, -12.55, -12.25, { tinta: 0.01 });                                    // reductora
  cilindro('aceroOsc', V(28.9, -2.1, -12.25), V(28.9, -2.1, -11.8), 0.21, 14, 0.01);                                  // motor
  for (let z = -12.2; z < -11.85; z += 0.06) cilindro('acero', V(28.9, -2.1, z), V(28.9, -2.1, z + 0.02), 0.235, 14, 0);
  cajaE('acero', 28.75, 29.05, -1.89, -1.78, -12.2, -11.95, { tinta: 0.004 });                                     // caja de bornes
  barra('aceroOsc', V(28.55, -2.55, -12.3), V(28.3, -2.0, -13.0), 0.04, { tinta: 0.004 });                          // palanca del freno
  barra('aceroOsc', V(30.0, -3.0, -11.4), V(30.0, -1.9, -11.4), 0.06, { tinta: 0.006 });                            // el mando
  cajaE('acero', 29.92, 30.08, -2.15, -1.85, -11.48, -11.3, { tinta: 0.006 });
  cajaE('ambar', 29.95, 30.05, -1.96, -1.92, -11.3, -11.29, { tinta: 0 });
  senal(3, V(28.9, -2.4, -11.99), V(0, 0, 1), 0.22, 0.22);
  barra('aceroOsc', V(29.4, -2.4, -13.4), V(32.6, -0.8, -13.4), 0.12, { tinta: 0.012 });   // pluma sobre el vacio
  barra('aceroOsc', V(29.5, -2.95, -13.4), V(31.0, -1.5, -13.4), 0.07, { tinta: 0.008 });   // su tornapunta
  for (const z of [-13.58, -13.22]) cajaE('aceroOsc', 32.42, 32.78, -0.98, -0.62, z - 0.02, z + 0.02, { tinta: 0.005 });
  cilindro('acero', V(32.6, -0.8, -13.56), V(32.6, -0.8, -13.24), 0.15, 14, 0.006);                                 // polea
  cilindro('cuerda', V(28.9, -1.7, -13.4), V(32.6, -0.65, -13.4), 0.015, 5, 0);
  barra('aceroOsc', V(28.9, -1.7, -13.4), V(32.6, -0.8, -13.4), 0.04, { tinta: 0.008 });

  // ---------------------------------------------------------------- el musgo (musgo.js): por codigo, donde el muro lo deja crecer
  const musgo = crearMusgo(scene, { gradiente, materialConducto, tramos, sitios: muro.sitios,
    huecos: [...muro.huecos, [-W2 - 0.16, W2 + 0.16, -0.14, H + 0.16], [-1.52, 1.52, 2.23, 2.47]] });   // la salida y su visera

  // ---------------------------------------------------------------- mallas
  const mallas = {};
  for (const [k, gs] of Object.entries(lotes)) {
    const g = mergeGeometries(gs.map(limpia));
    const m = new THREE.Mesh(g, M[k]);
    m.castShadow = !['tinta', 'ventana', 'ambar', 'negro', 'ventanaTenue', 'focoLuz', 'vidrio', 'interiorPared', 'interiorBajo', 'interiorTecho', 'mueble', 'pantalla', 'pantallaApagada', 'plano', 'senal'].includes(k);
    m.receiveShadow = k !== 'tinta';
    mallas[k] = m;
    scene.add(m);
  }

  // la cuerda del torno que cuelga hasta la bruma, con su gancho (se mece)
  const cuerda = new THREE.Group();
  cuerda.position.set(32.6, -0.8, -13.4);
  const hilo = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 24, 5).translate(0, -12, 0), M.cuerda);
  const gancho = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 12, 4.4).translate(0, -24.2, 0), M.aceroOsc);
  cuerda.add(hilo, gancho);
  scene.add(cuerda);

  // la PARED de relleno donde ira la ciudad: aparece cuando el 18 pisa la base
  const pared = new THREE.Mesh(new THREE.PlaneGeometry(520, 6 - D.SUELO_Y).rotateY(-Math.PI / 2).translate(D.PARED_X, (6 + D.SUELO_Y) / 2, 0),
    new THREE.MeshBasicMaterial({ color: '#a3acb5', transparent: true, opacity: 0 }));
  const cantoPared = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 520).translate(D.PARED_X - 0.2, 5.8, 0),
    new THREE.MeshBasicMaterial({ color: '#2a2f35', transparent: true, opacity: 0 }));
  pared.add(cantoPared);
  pared.material.color.set('#97a1ab');
  pared.visible = false;
  scene.add(pared);

  // cielo y bruma de debajo (la base esta a 35 m del suelo: la bruma lo vela pero no lo tapa)
  const COL_NIEBLA = new THREE.Color('#717e8c');
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uArriba: { value: new THREE.Color('#38424d') }, uHorizonte: { value: COL_NIEBLA.clone() }, uLuz: { value: 0 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uArriba, uHorizonte; uniform float uLuz; varying vec3 vD;
      void main(){ float h = clamp(vD.y, 0.0, 1.0); vec3 c = mix(uHorizonte, uArriba, pow(h, 0.6)); gl_FragColor = vec4(c * uLuz, 1.0);
      #include <colorspace_fragment>
      }`,
  }));
  cielo.renderOrder = -10;
  cielo.frustumCulled = false;
  scene.add(cielo);
  const brumas = [];
  // capas finas: juntas tapaban la mitad del suelo y los 35 m de caida no se leian
  for (const [y, o, rep] of [[-7, 0.07, 6], [-15, 0.09, 4], [-24, 0.1, 3], [-31, 0.06, 2]]) {
    const t = tBruma.clone(); t.repeat.set(rep, rep); t.needsUpdate = true;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2).translate(40, y, 0),
      new THREE.MeshBasicMaterial({ color: '#7d8894', alphaMap: t, transparent: true, opacity: o, depthWrite: false }));
    b.userData.v = 0.004 / rep;
    brumas.push(b); scene.add(b);
  }
  // motas que lleva el viento (solo fuera)
  const NM = 500, mp = new Float32Array(NM * 3);
  for (let i = 0; i < NM; i++) { mp[i * 3] = Math.random() * 30; mp[i * 3 + 1] = Math.random() * 12 - 6; mp[i * 3 + 2] = Math.random() * 30 - 15; }
  const motasG = new THREE.BufferGeometry(); motasG.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motas = new THREE.Points(motasG, new THREE.PointsMaterial({ color: '#e6edf4', size: 0.035, transparent: true, opacity: 0, depthWrite: false }));
  motas.frustumCulled = false;
  scene.add(motas);

  // ---------------------------------------------------------------- luces
  const hemi = new THREE.HemisphereLight('#b7c3cf', '#2a2f35', 1.5);
  const sol = new THREE.DirectionalLight('#e6ebf0', 1.9);
  sol.position.set(70, 52, 26); sol.target.position.set(22, 0, -4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 220 });
  sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.03;
  const farola = new THREE.PointLight('#ffd9a0', 7, 8, 2);
  farola.position.set(35.35, 2.35, 2.95);
  const luzCaseta = new THREE.PointLight('#ffd2a0', 3, 5, 2);
  luzCaseta.position.set(38.4, 1.3, 0.1);
  const luzHeroe = new THREE.PointLight('#dfe8ff', 1.2, 3, 2);
  scene.add(hemi, sol, sol.target, farola, luzCaseta, luzHeroe);
  const niebla = new THREE.FogExp2(COL_NIEBLA.clone(), 0);
  scene.fog = niebla;

  // ---------------------------------------------------------------- por fotograma
  // ext = 0 dentro del conducto (oscuro) .. 1 fuera; dentroCam = la camara esta dentro del conducto
  function actualizar(t, dt, heroe, cam, E) {
    const hp = heroe.pos;
    const ext = E.exterior;
    for (const m of PENUMBRA) { m.uniforms.uHeroe.value.set(hp.x, hp.y + 0.55, hp.z); m.uniforms.uHeroeI.value = 0.42 * (1 - 0.7 * ext); }
    // la luz del 18 sobre si mismo, hacia la camara (en el oscuro es lo unico que lo alumbra)
    const hacia = new THREE.Vector3().subVectors(cam.position, hp).setY(0);
    if (hacia.lengthSq() > 1e-6) hacia.normalize().multiplyScalar(0.7);
    luzHeroe.position.set(hp.x + hacia.x, hp.y + 0.75, hp.z + hacia.z);
    luzHeroe.intensity = 1.3 * (1 - ext);
    // las costillas de la pared de delante solo se ven desde dentro (desde fuera taparian el corte)
    const dentroCam = cam.position.z < W2 - 0.02 && cam.position.x > C.x0 - 0.5;
    for (const tr of tramos) {
      tr.grupo.visible = tr.s > 0.001;
      tr.grupo.scale.z = Math.max(0.001, tr.s);
      tr.carton.visible = tr.s < 0.7;
      if (tr.md) tr.md.visible = dentroCam;
    }
    for (const m of CARTONES) { m.uniforms.uHeroe.value.set(hp.x, hp.y + 0.55, 0); m.uniforms.uOscuro.value = E.oscuro; m.uniforms.uVista.value = E.vista || 0; }
    objetos.pintar();
    const f0 = Math.min(MX, hp.x + 4.5);
    frente.visible = cam.position.z > W2 && f0 < MX - 0.05;
    frente.position.x = f0; frente.scale.x = MX - f0;
    hemi.intensity = 1.5; sol.intensity = 1.9;
    cielo.material.uniforms.uLuz.value = 1;
    niebla.density = E.niebla * 0.014;
    for (const b of brumas) { b.material.alphaMap.offset.x += b.userData.v * dt * 60; b.material.alphaMap.offset.y += b.userData.v * dt * 25; }
    // motas con el viento alrededor del 18
    motas.material.opacity = 0.55 * ext;
    if (ext > 0.01) {
      for (let i = 0; i < NM; i++) {
        let x = mp[i * 3] + dt * (0.5 + (i % 7) * 0.08), y = mp[i * 3 + 1] + Math.sin(t * 0.7 + i) * dt * 0.2, z = mp[i * 3 + 2] + dt * 0.9;
        if (x - hp.x > 14) x -= 28; if (x - hp.x < -14) x += 28; if (z - hp.z > 14) z -= 28; if (z - hp.z < -14) z += 28;
        if (y - hp.y > 6) y -= 12; if (y - hp.y < -6) y += 12;
        mp[i * 3] = x; mp[i * 3 + 1] = y; mp[i * 3 + 2] = z;
      }
      motasG.attributes.position.needsUpdate = true;
    }
    cuerda.rotation.z = Math.sin(t * 0.55) * 0.025; cuerda.rotation.x = Math.sin(t * 0.37 + 1) * 0.02;
    farola.intensity = 7 * (0.92 + 0.08 * Math.sin(t * 23) * Math.sin(t * 7.1));
    punta.material.color.setScalar(Math.sin(t * 2.4) > 0.6 ? 1 : 0.25).multiply(new THREE.Color('#ffd8a8'));
    // la pared aparece al pisar la base (E.tBase: cuando la piso, en tiempo de simulacion)
    const k = E.tBase < 0 ? 0 : Math.min(1, (t - E.tBase) / 3.2);
    pared.visible = k > 0;
    pared.material.opacity = k * k * (3 - 2 * k);
    cantoPared.material.opacity = pared.material.opacity;
  }
  function reiniciar() {
    pared.visible = false; pared.material.opacity = 0;
    for (const tr of tramos) { tr.pop = -1; tr.s = 0; }
    objetos.reiniciar();
  }
  // cada tramo se hace 3D cuando el 18 esta a menos de R por detras de el; R crece con la vista (e = 0 al cambiar,
  // 1 con la camara detras) y cada tramo lleva su retraso, para que no sea una ola recta. Devuelve los que saltan ahora
  const sobre = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
  function pasoVision(t, hx, e, activa) {
    let nuevos = 0;
    for (const tr of tramos) {
      if (tr.pop < 0 && activa && tr.xc - hx < Math.max(0.6, 0.6 + 7.5 * e - 1.4 * tr.h)) { tr.pop = t; nuevos++; }
      const k = tr.pop < 0 ? 0 : Math.min(1, (t - tr.pop) / 0.45);
      tr.s = k <= 0 ? 0 : k >= 1 ? 1 : sobre(k);
    }
    return nuevos + objetos.paso(t, hx, e, activa);
  }

  // lo que no se pisa: la caseta (y lo que dejan los objetos del conducto)
  choques.cajas.push({ x: (K.x0 + K.x1) / 2, z: (K.z0 + K.z1) / 2, hx: (K.x1 - K.x0) / 2, hz: (K.z1 - K.z0) / 2, ang: 0 });
  function limitar(p) {
    let mejor = null, dm = Infinity;
    for (const r of PISO) {
      if (dentro(r, p.x, p.z)) return;
      const [px, pz] = proyectar(r, p.x, p.z), d = (px - p.x) ** 2 + (pz - p.z) ** 2;
      if (d < dm) { dm = d; mejor = [px, pz]; }
    }
    p.x = mejor[0]; p.z = mejor[1];
  }
  const enBase = (x) => x > MX + 0.35;

  return {
    altura, choques, limitar, borde: 1e4, salida: { x: D.PASO.x, z: 0, giro: Math.PI / 2 },
    actualizar, reiniciar, pasoVision, tramos, tPintura, objetos, musgo, muro, enBase, M, mallas, luces: { hemi, sol, farola, luzHeroe }, pared, niebla, PISO,
  };
}
