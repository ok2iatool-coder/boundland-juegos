// EL MACROEDIFICIO de El Panal sur, en el CIRCULO ROJO de la captura del usuario (plano (-310, -70), junto al extremo
// oeste de la fila de Bloques, con el lado largo paralelo a ellos).
//
// Tercera version (21-10, «haz un solo macroedificio bonito, que no se parezca al de kowloon ni al anterior, algo mas
// geometrico futurista»): diseno propio en la obra escuela/obras/macro_panal (diario 74). Una lamina de 88 x 40 x 150 m
// envuelta en un EXOESQUELETO de triangulos equilateros blanco sobre vidrio oscuro, atravesada por un VACIO HEXAGONAL
// de 35 x 30 m a 82 m de altura (sus bordes son lineas del propio diagrid) con un jardin colgado dentro, columnas en V
// sobre un vestibulo de vidrio retranqueado, una fila de diagrid abierto por encima de la cubierta (la corona) y una
// aguja con anillos: 183 m. El hexagono es el de El Panal a escala de ciudad.
// Antes fueron la "Sentinel Tower" de Meshy (web/modelo/sentinel/, sin cargar) y el Bloque Monstruo de Kowloon crecido
// (escuela/obras/macro_panal/v1_kowloon/): no gustaron.
//
// web/modelo/macro/macro_panal.glb: 58.700 triangulos, sin LOD (no le hace falta). Los materiales pasan a toon con los
// escalones del terreno; el VIDRIO a Phong con brillo, para que el sol le arranque reflejos. Debajo no hay cimientos de
// El Panal (`reservado`, que mira cimientos.js) ni hierba; choca como una caja de su huella.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as R from './relieve.js';
import { TONO } from './tono.js';
import { OBRA } from './sitios.js';

const YC = R.GEO.YC ?? 2400;
// el modelo esta centrado en su huella; giro PI: la fachada principal (y = -20 de Blender) mira al norte, a la ciudad
export const MACRO = { plano: [-310, -70], giro: Math.PI, ancho: 88, fondo: 40, alto: 183, margen: 8 };
MACRO.x = MACRO.plano[0];
MACRO.z = YC - MACRO.plano[1];

// lo que queda debajo y alrededor (cimientos.js no pone ahi modulos de El Panal)
export function reservado(x, z) {
  const c = Math.cos(MACRO.giro), s = Math.sin(MACRO.giro), dx = x - MACRO.x, dz = z - MACRO.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) < MACRO.ancho / 2 + MACRO.margen && Math.abs(lz) < MACRO.fondo / 2 + MACRO.margen;
}

const URL_M = new URL('../../modelo/macro/', import.meta.url);

// ---------------- el VIDRIO realista (21-10, «hazlo mas realista, los cristales, ventanas») ----------------
// Un MeshStandardMaterial casi negro y muy liso (el sol le saca su brillo, con las sombras del diagrid) al que se le
// suma, como luz propia:
//   - las HABITACIONES de detras (interior mapping): cada hueco entre montantes (4,33 m) y cada planta (3,75 m) es una
//     caja de 6 m de fondo; el rayo de la camara entra por el vidrio y se pinta lo que toca (pared del fondo con algun
//     mueble, paredes de los lados, suelo de madera, techo con plafon), mas oscuro cuanto mas al fondo. Cada habitacion
//     tiene su color, su persiana (algunas bajadas) y de noche esta encendida o no;
//   - el ANTEPECHO: los 90 cm de abajo de cada planta son vidrio opaco (como un muro cortina de verdad);
//   - el REFLEJO del cielo de la hora (los mismos colores que la boveda, cielo.js) con FRESNEL: poco de frente y mucho al
//     mirarlo de lado (vidrio con capa: F0 = 0,1).
// Las caras del modelo estan en los ejes (three: x a lo largo, y arriba, z de fondo): frente z = 20, trasera z = -20,
// costados x = +-44; u a lo largo de cada cara empieza en su esquina, como los montantes de construir.py.
const CAM_OBJ = { value: new THREE.Vector3() };
const NOCHE = { value: 0 };
function vidrioRealista(nombre, grupo) {
  const m = new THREE.MeshStandardMaterial({ name: nombre, color: 0x05080a, roughness: 0.06, metalness: 0.0, side: THREE.DoubleSide });
  m.userData.uNoche = NOCHE;
  m.onBeforeCompile = (sh) => {
    const b = grupo.parent && grupo.parent.getObjectByName('boveda');
    const cb = b && b.material.uniforms;
    Object.assign(sh.uniforms, {
      uCamObj: CAM_OBJ, uNoche: NOCHE,
      uCenit: cb ? cb.uCenit : { value: new THREE.Color(0x9fb0a6) }, uHorizonte: cb ? cb.uHorizonte : { value: new THREE.Color(0xc7c6a6) },
      uSueloC: cb ? cb.uSuelo : { value: new THREE.Color(0xa9a98a) },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos; varying vec3 vObjNor;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position; vObjNor = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObjPos; varying vec3 vObjNor;
        uniform vec3 uCamObj, uCenit, uHorizonte, uSueloC; uniform float uNoche;
        float hashH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        vec3 cieloR(vec3 r) {
          vec3 c = mix(uHorizonte, uCenit, pow(smoothstep(-0.02, 0.7, r.y), 0.75));
          return mix(c, uSueloC * 0.55, smoothstep(-0.01, -0.25, r.y));
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 Vd = normalize(vObjPos - uCamObj);
          vec3 Nn = normalize(vObjNor);
          if (dot(Vd, Nn) > 0.0) Nn = -Nn;
          float cosT = clamp(dot(-Vd, Nn), 0.0, 1.0);
          float Fr = 0.1 + 0.9 * pow(1.0 - cosT, 5.0);
          vec3 refl = cieloR(reflect(Vd, Nn));
          vec3 interior = vec3(0.0);
          if (abs(Nn.y) < 0.2 && max(abs(Nn.x), abs(Nn.z)) > 0.95) {
            // el marco de la cara: u a lo largo desde su esquina, w hacia dentro
            vec3 eu; float u0;
            if (abs(Nn.x) > 0.5) { eu = vec3(0.0, 0.0, Nn.x > 0.0 ? -1.0 : 1.0); u0 = 20.0; }
            else { eu = vec3(Nn.z > 0.0 ? 1.0 : -1.0, 0.0, 0.0); u0 = 44.0; }
            vec3 ew = -Nn;
            float u = dot(vObjPos, eu) + u0, v = vObjPos.y;
            vec3 d = vec3(dot(Vd, eu), Vd.y, max(dot(Vd, ew), 1e-4));
            const float S = 4.330127, P = 3.75, D = 6.0;
            float cu = floor(u / S), cv = floor(v / P);
            float lu = u - cu * S, lv = v - cv * P;
            float id = hashH(vec3(cu, cv, Nn.x * 3.0 + Nn.z * 7.0));
            float encendida = step(0.42, fract(id * 13.7));
            vec3 luz = mix(vec3(0.24, 0.25, 0.26), vec3(1.0, 0.8, 0.56) * (0.08 + 1.15 * encendida), uNoche);
            if (lv < 0.9) {
              interior = vec3(0.035, 0.042, 0.048);                        // el antepecho
            } else {
              float tu = d.x > 0.0 ? (S - lu) / d.x : lu / max(-d.x, 1e-4);
              float tv = d.y > 0.0 ? (P - lv) / d.y : (lv - 0.0) / max(-d.y, 1e-4);
              float tw = D / d.z;
              float t = min(tu, min(tv, tw));
              vec3 h = vec3(lu, lv, 0.0) + d * t;
              vec3 pared = mix(vec3(0.82, 0.77, 0.68), vec3(0.64, 0.69, 0.74), step(0.5, fract(id * 7.1)));
              pared = mix(pared, vec3(0.74, 0.62, 0.52), step(0.82, fract(id * 3.9)));
              vec3 col;
              if (t == tw) {
                col = pared;
                // un mueble al fondo (mesa, estanteria o sofa) y un cuadro
                float mx = S * (0.2 + 0.6 * fract(id * 3.3));
                if (h.y < 1.0 + 0.9 * fract(id * 5.1) && abs(h.x - mx) < 0.7 + 0.5 * fract(id * 9.2)) col = vec3(0.16, 0.12, 0.1);
                if (abs(h.y - 2.0) < 0.35 && abs(h.x - (S - mx)) < 0.45) col = vec3(0.3, 0.38, 0.5);
              } else if (t == tu) {
                col = pared * 0.8;
              } else if (d.y < 0.0) {
                col = vec3(0.36, 0.27, 0.19) * (0.75 + 0.5 * fract(id * 5.7));   // el suelo
              } else {
                col = vec3(0.86);                                              // el techo, con su plafon
                if (abs(h.x - S * 0.5) < 0.55 && abs(h.z - D * 0.45) < 1.1) col = vec3(1.0) * (1.0 + 2.5 * encendida * uNoche);
              }
              col *= mix(1.0, 0.5, h.z / D);                                  // el fondo, mas oscuro
              col *= luz;
              // persiana: algunas bajadas desde arriba, con sus lamas
              float baja = fract(id * 29.3) < 0.38 ? fract(id * 41.1) * 0.75 : 0.0;
              if ((P - lv) / (P - 0.9) < baja) {
                float lama = 0.85 + 0.15 * step(0.5, fract(lv * 11.0));
                col = vec3(0.74, 0.71, 0.65) * lama * mix(0.3, 0.12 + 0.9 * encendida, uNoche);
              }
              interior = col;
            }
          }
          // el vidrio deja pasar con un tinte verdoso; lo reflejado depende del angulo (de noche refleja menos)
          totalEmissiveRadiance += interior * vec3(0.62, 0.72, 0.72) * (1.0 - Fr) + refl * Fr * mix(0.95, 0.35, uNoche);
        }`);
  };
  m.customProgramCacheKey = () => 'vidrioMacro';
  return m;
}

export function crearMacro(grupo, cajas) {
  const raiz = new THREE.Group();
  raiz.name = 'macroedificio';
  // la cota: lo mas bajo de su huella (la plaza se entierra un poco donde el suelo sube)
  let y = Infinity;
  for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]]) {
    y = Math.min(y, R.altura(MACRO.x + (a * MACRO.ancho) / 2, MACRO.z + (b * MACRO.fondo) / 2));
  }
  raiz.position.set(MACRO.x, y - 0.1, MACRO.z);
  raiz.rotation.y = MACRO.giro;
  grupo.add(raiz);
  let tris = 0, listo = false;

  const nuevo = new Map();
  const convertir = (m) => {
    if (nuevo.has(m.name)) return nuevo.get(m.name);
    let t;
    if (/vidrio/i.test(m.name)) {
      t = vidrioRealista(m.name, grupo);
    } else if (/exoesqueleto/i.test(m.name)) {
      // el exoesqueleto, en material fisico (luz y sombra de verdad, un brillo satinado): con el toon salia plano
      t = new THREE.MeshStandardMaterial({ name: m.name, color: 0xe6e4de, roughness: 0.42, metalness: 0.08 });
    } else {
      t = new THREE.MeshToonMaterial({ name: m.name, color: m.color.clone(), gradientMap: TONO });
      if (m.emissive && m.emissive.getHex()) { t.emissive.copy(m.emissive); t.emissiveIntensity = 0.9; }
    }
    nuevo.set(m.name, t);
    return t;
  };
  (async () => {
    try {
      const gl = await new GLTFLoader().loadAsync(new URL('macro_panal.glb', URL_M).href);
      gl.scene.traverse((o) => {
        if (!o.isMesh) return;
        const viejo = o.material;
        o.material = Array.isArray(viejo) ? viejo.map(convertir) : convertir(viejo);
        o.castShadow = o.receiveShadow = true;
        // el vidrio necesita la camara en los ejes del modelo (para el rayo de cada habitacion)
        o.onBeforeRender = (_r, _s, camara) => { CAM_OBJ.value.copy(camara.position); o.worldToLocal(CAM_OBJ.value); };
        tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
      });
      raiz.add(gl.scene);
      listo = true;
    } catch (e) {
      console.warn('macroedificio: falta web/modelo/macro/macro_panal.glb (obra escuela/obras/macro_panal)', e);
    }
  })();

  // ---- los ROTULOS DE NEON (22-10, «letras neon con el nombre de alguna empresa, y en algun lado "centro comercial";
  // blanco o azul»): web/modelo/macro/rotulos.glb (rotulos.py de la obra, en sus mismos ejes): ALVEO en blanco arriba de la
  // fachada principal y CENTRO COMERCIAL en azul sobre el vestibulo. El tubo y la cara de cada letra van SIN luz de la
  // escena (MeshBasic: el neon da su propia luz, de dia y de noche) y el tubo lleva un HALO: la misma malla hinchada por
  // sus normales, aditiva, que de noche se enciende mas (NOCHE la pone horas.js por el vidrio).
  let rotulos = 0;
  (async () => {
    try {
      const gl = await new GLTFLoader().loadAsync(new URL('rotulos.glb', URL_M).href);
      const halos = [];
      gl.scene.traverse((o) => {
        if (!o.isMesh) return;
        const lista = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => {
          const azul = /azul/i.test(m.name);
          if (/neon/i.test(m.name)) return new THREE.MeshBasicMaterial({ name: m.name, color: azul ? 0x6cc4ff : 0xffffff });
          if (/caja/i.test(m.name)) return new THREE.MeshBasicMaterial({ name: m.name, color: azul ? 0x1d4f8a : 0xb9c4cc });
          return new THREE.MeshToonMaterial({ name: m.name, color: m.color.clone(), gradientMap: TONO });
        });
        o.material = Array.isArray(o.material) ? lista : lista[0];
        // el halo: solo los grupos del tubo
        const grupos = o.geometry.groups.length ? o.geometry.groups : [{ start: 0, count: Infinity, materialIndex: 0 }];
        grupos.forEach((g) => {
          const m = lista[g.materialIndex];
          if (!/neon/i.test(m.name)) return;
          const halo = new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
          halo.onBeforeCompile = (sh) => {
            sh.uniforms.uNoche = NOCHE;
            sh.vertexShader = 'uniform float uNoche;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normal * (0.22 + 0.25 * uNoche);');
            sh.fragmentShader = 'uniform float uNoche;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.a *= 0.5 + 1.6 * uNoche;');
          };
          const geo = o.geometry.clone();
          geo.clearGroups();
          geo.setDrawRange(g.start, g.count);
          const h = new THREE.Mesh(geo, halo);
          h.position.copy(o.position); h.quaternion.copy(o.quaternion); h.scale.copy(o.scale);
          h.renderOrder = 2;
          halos.push([o.parent, h]);
        });
        rotulos++;
      });
      for (const [p, h] of halos) p.add(h);
      raiz.add(gl.scene);
    } catch (e) {
      console.warn('macroedificio: falta web/modelo/macro/rotulos.glb (rotulos.py de la obra macro_panal)', e);
    }
  })();

  // choca: la huella del edificio (la plaza de alrededor se pisa)
  cajas.push({ x: MACRO.x, z: MACRO.z, hx: MACRO.ancho / 2, hz: MACRO.fondo / 2, ang: -MACRO.giro });
  // ni hierba debajo
  const antes = OBRA.ocupado;
  OBRA.ocupado = (x, z) => (antes && antes(x, z)) || reservado(x, z);

  return { raiz, info: () => ({ macro: { listo, tris, rotulos, plano: MACRO.plano, cota: +raiz.position.y.toFixed(2) } }) };
}
