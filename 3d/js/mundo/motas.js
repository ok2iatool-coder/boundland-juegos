// LO QUE FLOTA EN EL AIRE alrededor del 18 (21-10, «mas ambientacion»), segun la hora (horas.js):
//   - de dia, POLVO y polen: motas pequenas y claras que derivan y brillan mas a contraluz (mirando hacia el sol);
//   - de noche, LUCIERNAGAS: puntos verde-amarillos que se encienden y se apagan, a medio metro o dos del suelo.
// Un solo THREE.Points de 1.400 en una caja de 50 m que sigue al 18; cada una vive en coordenadas del mundo y se
// envuelve sola al salir de la caja (asi no brincan todas a la vez), y su altura va sobre el suelo de ese sitio.
import * as THREE from 'three';

const N = 1400, MEDIO = 25;

const VERT = /* glsl */`
  attribute float aFase;
  uniform float uT, uPolvo, uLuci, uTam;
  uniform vec3 uDirSol;
  varying float vBrillo; varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // luciernaga: parpadeo lento, cada una a su ritmo (encendida un rato, apagada otro)
    float parpadeo = smoothstep(0.55, 0.9, sin(uT * (0.7 + fract(aFase * 7.3) * 0.9) + aFase * 6.28) * 0.5 + 0.5);
    // polvo: brilla a contraluz (la camara mirando hacia el sol)
    vec3 haciaCam = normalize(cameraPosition - position);
    float contraluz = pow(max(dot(-haciaCam, uDirSol), 0.0), 6.0);
    float polvo = uPolvo * (0.25 + 1.6 * contraluz) * (0.6 + 0.4 * fract(aFase * 13.1));
    float luci = uLuci * parpadeo * 1.8;
    vBrillo = polvo + luci;
    vColor = mix(vec3(1.0, 0.95, 0.82), vec3(0.75, 1.0, 0.35), clamp(uLuci * 1.5, 0.0, 1.0));
    gl_PointSize = uTam * (uLuci > 0.01 ? 16.0 : 3.2) / max(-mv.z, 0.5) * 6.0;
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */`
  varying float vBrillo; varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a * vBrillo;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

export function crearMotas({ grupo, altura }) {
  const pos = new Float32Array(N * 3), fase = new Float32Array(N), alto = new Float32Array(N);
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) { fase[i] = r(); alto[i] = 0.4 + Math.pow(r(), 1.6) * 6; pos[i * 3 + 1] = -1e4; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aFase', new THREE.BufferAttribute(fase, 1));
  const u = { uT: { value: 0 }, uPolvo: { value: 0 }, uLuci: { value: 0 }, uTam: { value: 1 }, uDirSol: { value: new THREE.Vector3(0, 1, 0) } };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m);
  pts.name = 'motas';
  pts.frustumCulled = false;
  grupo.add(pts);
  let listo = false;
  return {
    hora({ polvo, luciernagas, dirSol }) { u.uPolvo.value = polvo; u.uLuci.value = luciernagas; u.uDirSol.value.copy(dirSol); },
    actualizar(t, dt, foco) {
      u.uT.value = t;
      pts.visible = u.uPolvo.value + u.uLuci.value > 0.01;
      if (!pts.visible) return;
      // de noche las luciernagas van bajas (hasta 2,5 m); de dia el polvo, hasta 6
      const tope = u.uLuci.value > 0.5 ? 0.35 : 1;
      for (let i = 0; i < N; i++) {
        let x = pos[i * 3], z = pos[i * 3 + 2];
        const nuevo = !listo;
        if (nuevo) { x = foco.x + (r() * 2 - 1) * MEDIO; z = foco.z + (r() * 2 - 1) * MEDIO; }
        // deriva lenta, distinta en cada una
        const a = fase[i] * 6.28 + t * 0.15;
        x += Math.cos(a) * 0.25 * dt; z += Math.sin(a * 1.3) * 0.25 * dt;
        let salto = false;
        if (x - foco.x > MEDIO) { x -= 2 * MEDIO; salto = true; } else if (x - foco.x < -MEDIO) { x += 2 * MEDIO; salto = true; }
        if (z - foco.z > MEDIO) { z -= 2 * MEDIO; salto = true; } else if (z - foco.z < -MEDIO) { z += 2 * MEDIO; salto = true; }
        pos[i * 3] = x; pos[i * 3 + 2] = z;
        // la altura sobre el suelo: solo al nacer o al envolverse se mide el suelo (y si no, cada 32 fotogramas por turno)
        if (nuevo || salto || ((i + Math.floor(t * 60)) & 31) === 0) pos[i * 3 + 1] = altura(x, z) + alto[i] * tope + 0.3 * Math.sin(t * 0.7 + fase[i] * 9);
      }
      listo = true;
      g.attributes.position.needsUpdate = true;
    },
  };
}
