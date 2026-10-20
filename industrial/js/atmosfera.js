// LA ATMOSFERA: la niebla (propia: se espesa con la distancia y a ras de suelo, y su color es el del cielo que
// tiene detras: calida y clara hacia el horizonte donde esta el sol, gris arriba), el cielo de nubes a contraluz,
// los rayos que atraviesan las estructuras, las bandas de bruma que se mueven, el polvo en suspension y el humo.
import * as THREE from 'three';
import { RUIDO, PAL } from './base.js';

const c3 = (h) => { const c = new THREE.Color(h); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };
// donde esta el sol en la vista (u desde el centro de la camara) y la camara (z)
export const SOL = { x: 1.8, y: 0.2 };
export const CAM_Z = 60;

// ---------------------------------------------------------------- la niebla
// Sustituye a la de three (los trozos fog_*): la distancia la da la profundidad (en ortografica, la z), la altura
// la del mundo, y el color sale de la posicion EN LA VISTA (el sol no se mueve con lo que pasa por delante).
// (medido contra la imagen: el plano medio queda en silueta oscura con sus ventanas, el lejano lavado de bruma)
export const NIEBLA = { inicio: CAM_Z + 6, k: 0.0034, baja: 0.26, bajaAlto: 1.4 };
export function prepararNiebla() {
  THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
varying float vFogDepth; varying vec3 vFogPos; varying vec2 vFogVista;
#endif`;
  THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
vFogDepth = - mvPosition.z; vFogVista = mvPosition.xy;
{ vec4 fp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  fp = instanceMatrix * fp;
  #endif
  vFogPos = (modelMatrix * fp).xyz; }
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
varying float vFogDepth; varying vec3 vFogPos; varying vec2 vFogVista;
#endif`;
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
{
  float d = max(0.0, vFogDepth - ${NIEBLA.inicio.toFixed(2)});
  // curva que deja casi limpio el plano medio y lava lo lejano (como en la imagen)
  float f = 1.0 - exp(-pow(d * ${NIEBLA.k.toFixed(5)}, 1.5));
  float bajo = exp(-max(0.0, vFogPos.y) / ${NIEBLA.bajaAlto.toFixed(2)}) * smoothstep(40.0, 180.0, d) * ${NIEBLA.baja.toFixed(2)};
  f = clamp(f + bajo * (1.0 - f), 0.0, 1.0);
  float hx = exp(-pow((vFogVista.x - ${SOL.x.toFixed(2)}) / 7.0, 2.0));
  float hy = smoothstep(-2.5, 7.5, vFogVista.y - ${SOL.y.toFixed(2)});
  vec3 fc = mix(${c3(PAL.bruma)}, ${c3(PAL.horizonte)}, hx * (1.0 - hy * 0.8));
  fc = mix(fc, ${c3('#4f4741')}, hy * 0.7);
  // por debajo del horizonte la bruma se apaga a un beige gris (lo mas claro es la linea del horizonte)
  fc = mix(fc, ${c3('#7d6f60')}, smoothstep(-0.5, -4.5, vFogVista.y - ${SOL.y.toFixed(2)}) * 0.75);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fc * 1.0, f);
}
#endif`;
}

// ---------------------------------------------------------------- el cielo
export function cielo(ancho, alto, tiempo) {
  const mat = new THREE.ShaderMaterial({
    fog: false, depthWrite: false,
    uniforms: { uTiempo: tiempo, uTam: { value: new THREE.Vector2(ancho, alto) }, uSol: { value: new THREE.Vector2(SOL.x, SOL.y) } },
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${RUIDO}
      uniform float uTiempo; uniform vec2 uTam, uSol; varying vec2 vP;
      void main() {
        vec2 p = vP; float y = p.y - uSol.y;
        // degradado de la imagen: gris pizarra arriba, gris calido en medio, una banda crema muy clara en el horizonte
        // (detras de la ciudad) y beige gris por debajo
        vec3 alto = ${c3('#4a4541')}, medio = ${c3('#806f60')}, horiz = ${c3('#ecc694')}, bajo = ${c3('#b39a7c')};
        vec3 col = y > 0.0 ? mix(horiz, medio, smoothstep(0.2, 2.6, y)) : mix(horiz, bajo, smoothstep(-0.2, -2.5, y));
        col = mix(col, alto, smoothstep(2.2, 6.0, y));
        // el sol detras de la ciudad: un resplandor ancho y aplastado (sin nucleo: el bloom no lo hace estallar)
        vec2 s = (p - uSol) * vec2(0.42, 1.0);
        float r = length(s);
        col += ${c3('#ffd9a6')} * 0.42 * exp(-r * 0.55);
        col += ${c3('#fff1da')} * 0.18 * exp(-r * 1.4);
        // la banda caliente del horizonte detras de la ciudad (la de la imagen), mas fuerte cerca del sol
        col += ${c3('#ffb46a')} * 0.42 * exp(-pow((y + 0.2) / 1.6, 2.0)) * exp(-pow((p.x - uSol.x) / 13.0, 2.0));
        // nubes: masas alargadas que se deshilachan, oscuras de vientre, con huecos claros y el canto de abajo y
        // el de arriba encendidos cerca del sol; se mueven despacio
        float t = uTiempo * 0.005;
        vec3 q = vec3(p.x * 0.085 + t, p.y * 0.36, 1.7);
        float w = r_fbm(q * 1.9 + 4.0);
        float n1 = r_fbm(q + vec3(w * 0.9, w * 0.25, 0.0));
        float n2 = r_fbm(vec3(p.x * 0.16 - t * 1.4, p.y * 0.62 + 3.0, 5.3));
        float cerca = exp(-r * 0.3);
        float masa = smoothstep(0.4, 0.62, n1) * smoothstep(0.6, 2.6, y);
        vec3 vientre = mix(${c3('#3a3632')}, ${c3('#9a8775')}, cerca * 0.85);
        col = mix(col, vientre, masa * mix(0.92, 0.55, cerca));
        float jirones = smoothstep(0.5, 0.72, n2) * smoothstep(0.1, 1.2, y) * (1.0 - smoothstep(3.5, 6.0, y));
        col = mix(col, mix(${c3('#5d534b')}, ${c3('#c9ae8c')}, cerca), jirones * 0.55);
        float borde = smoothstep(0.36, 0.42, n1) - smoothstep(0.42, 0.5, n1);
        col += ${c3('#ffcf92')} * borde * cerca * 0.5 * smoothstep(0.3, 2.0, y);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), mat);
  m.renderOrder = -10;
  return m;
}

// ---------------------------------------------------------------- rayos de luz
// Planos que suman luz, del sol hacia abajo y hacia delante, con el borde blando y un ruido que respira
export function rayos(n, sem, ancho, tiempo, o = {}) {
  const grupo = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTiempo: tiempo, uFuerza: { value: o.fuerza ?? 0.11 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${RUIDO}
      uniform float uTiempo, uFuerza; varying vec2 vUv;
      void main() {
        float lado = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
        float largo = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        float n = r_fbm(vec3(vUv.x * 3.0, vUv.y * 1.2 - uTiempo * 0.03, uTiempo * 0.02));
        float a = lado * largo * (0.55 + 0.6 * n) * uFuerza;
        gl_FragColor = vec4(${c3('#ffe2b8')} * a, 1.0);
      }`,
  });
  let s = sem;
  const az = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < n; k++) {
    const w = 0.8 + az() * 2.6, h = o.alto ?? 16, x = (az() - 0.5) * ancho;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    // de arriba (el sol, detras) hacia abajo y hacia la camara: se abren en abanico desde SOL
    m.position.set(SOL.x + x * 0.4, SOL.y - h * 0.32, 0);
    m.rotation.z = Math.atan2(x, h) * 0.9;
    grupo.add(m);
  }
  return grupo;
}

// ---------------------------------------------------------------- el resplandor del horizonte
// Una mancha ancha y aplastada que SUMA luz calida alrededor del sol: lava de oro lo lejano que tiene detras
export function resplandor(ancho, alto, fuerza) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; void main() { vec2 p = (vUv - 0.5) * 2.0; float a = exp(-p.x * p.x * 3.2 - p.y * p.y * 9.0); gl_FragColor = vec4(${c3('#ffae62')} * a * ${fuerza.toFixed(3)}, 1.0); }` }));
  m.position.set(SOL.x, SOL.y, 0);
  return m;
}

// ---------------------------------------------------------------- bandas de bruma
// Un plano ancho con niebla que se mueve: densa abajo (a ras de suelo de su capa) y que se deshace hacia arriba
export function bruma(ancho, alto, color, densidad, tiempo, vel = 0.02, sem = 1) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTiempo: tiempo, uColor: { value: new THREE.Color(color) }, uDens: { value: densidad }, uVel: { value: vel }, uSem: { value: sem } },
    vertexShader: `varying vec2 vUv; varying vec2 vP; void main() { vUv = uv; vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${RUIDO}
      uniform float uTiempo, uDens, uVel, uSem; uniform vec3 uColor; varying vec2 vUv; varying vec2 vP;
      void main() {
        float n = r_fbm(vec3(vP.x * 0.12 + uTiempo * uVel, vP.y * 0.35, uSem + uTiempo * 0.01));
        float alto = pow(1.0 - vUv.y, 1.6);
        float bordes = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        float a = uDens * alto * bordes * smoothstep(0.25, 0.75, n * 0.7 + alto * 0.5);
        gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), mat);
}

// ---------------------------------------------------------------- polvo
// Motas que flotan y derivan; brillan mas cerca de las luces (la ventana, la farola) y a contraluz
export function polvo(n, caja, luces, tiempo) {
  const pos = new Float32Array(n * 3), sem = new Float32Array(n);
  for (let k = 0; k < n; k++) { pos[k * 3] = caja.x0 + Math.random() * (caja.x1 - caja.x0); pos[k * 3 + 1] = caja.y0 + Math.random() * (caja.y1 - caja.y0); pos[k * 3 + 2] = caja.z0 + Math.random() * (caja.z1 - caja.z0); sem[k] = Math.random(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSem', new THREE.BufferAttribute(sem, 1));
  const L = luces.slice(0, 3).map((l) => ({ p: l.p.clone(), col: l.col.clone(), r: l.r })); while (L.length < 3) L.push({ p: new THREE.Vector3(1e4, 1e4, 0), col: new THREE.Color(0), r: 1 });
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uTiempo: tiempo, uEscala: { value: 1 },
      uLuz: { value: L.map((l) => l.p) }, uLuzCol: { value: L.map((l) => l.col) }, uLuzR: { value: L.map((l) => l.r) },
      uAlto: { value: caja.y1 - caja.y0 }, uY0: { value: caja.y0 },
    },
    vertexShader: `
      attribute float aSem; uniform float uTiempo, uEscala, uAlto, uY0; uniform vec3 uLuz[3]; uniform vec3 uLuzCol[3]; uniform float uLuzR[3];
      varying vec3 vCol; varying float vA;
      void main() {
        vec3 p = position; float t = uTiempo * (0.08 + aSem * 0.12);
        p.x += sin(t * 2.0 + aSem * 40.0) * 0.6 + t * 1.4 * (0.5 + aSem);
        p.y += sin(t * 1.3 + aSem * 17.0) * 0.4 + t * 0.15;
        p.y = uY0 + mod(p.y - uY0, uAlto);
        vec3 c = vec3(0.30, 0.27, 0.23) * 0.5;
        vec3 w = (modelMatrix * vec4(p, 1.0)).xyz;
        for (int i = 0; i < 3; i++) { float d = distance(w, uLuz[i]); c += uLuzCol[i] * exp(-d * d / (uLuzR[i] * uLuzR[i])) * 1.4; }
        vCol = c; vA = 0.25 + 0.75 * fract(aSem * 7.31);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.2 + aSem * 2.6) * uEscala;
      }`,
    fragmentShader: `varying vec3 vCol; varying float vA;
      void main() { float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r) * vA; gl_FragColor = vec4(vCol * a, 1.0); }`,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false;
  return p;
}

// ---------------------------------------------------------------- humo de chimenea
// Bocanadas que salen, suben, crecen, se las lleva el viento hacia la izquierda y se deshacen; cada una es una
// mancha de ruido con el lado del sol mas claro
export function humo(x, y, n, tiempo, o = {}) {
  const g = new THREE.PlaneGeometry(1, 1);
  const sem = new Float32Array(n); for (let k = 0; k < n; k++) sem[k] = k / n + Math.random() * 0.02;
  g.setAttribute('aSem', new THREE.InstancedBufferAttribute(sem, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTiempo: tiempo, uVida: { value: o.vida ?? 26 }, uSube: { value: o.sube ?? 5.5 }, uViento: { value: o.viento ?? -3.2 }, uTam: { value: o.tam ?? 1.2 }, uCol: { value: new THREE.Color(o.color ?? '#8d857c') }, uLuz: { value: new THREE.Color(o.luz ?? '#e9d6bb') } },
    vertexShader: `
      attribute float aSem; uniform float uTiempo, uVida, uSube, uViento, uTam; varying vec2 vUv; varying float vEdad; varying float vSem;
      void main() {
        float edad = fract(uTiempo / uVida + aSem); vEdad = edad; vSem = aSem; vUv = uv;
        float e = pow(edad, 0.8);
        vec3 c = vec3(uViento * e * e * uVida * 0.12 + sin(aSem * 40.0 + edad * 3.0) * 0.3, uSube * e * uVida * 0.1, 0.0);
        float tam = uTam * (0.9 + e * 4.2);
        float ang = aSem * 6.28 + edad * 0.8;
        vec2 v = position.xy * tam; v = vec2(v.x * cos(ang) - v.y * sin(ang), v.x * sin(ang) + v.y * cos(ang));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(c + vec3(v, 0.0), 1.0);
      }`,
    fragmentShader: `${RUIDO}
      uniform vec3 uCol, uLuz; varying vec2 vUv; varying float vEdad; varying float vSem;
      void main() {
        vec2 p = vUv - 0.5; float r = length(p);
        float n = r_fbm(vec3(p * 3.0 + vSem * 13.0, vEdad * 1.5));
        float a = smoothstep(0.5, 0.05, r + (n - 0.5) * 0.45) * smoothstep(0.0, 0.05, vEdad) * (1.0 - smoothstep(0.45, 1.0, vEdad)) * 0.3;
        vec3 col = mix(uCol, uLuz, smoothstep(-0.3, 0.4, p.x + p.y * 0.6) * 0.6 + n * 0.2);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.InstancedMesh(g, mat, n);
  const M = new THREE.Matrix4(); for (let k = 0; k < n; k++) m.setMatrixAt(k, M.identity());
  m.position.set(x, y, 0); m.frustumCulled = false;
  return m;
}
