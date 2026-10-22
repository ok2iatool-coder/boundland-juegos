// LAS HORAS DEL DIA del mapa del mundo (21-10, «pon que aparezcan otros entornos tipo horas del dia, ambientacion, por
// ejemplo las 6 am, y que se vea completamente diferente»). Tecla T o el boton HORA de arriba: pasa a la siguiente con
// un fundido de 2,5 s; `?hora=amanecer` (o 6, 9, 13, 17, 20, 21, 1) en la URL empieza en ella.
//
// Cada hora es una TABLA de numeros (HORAS, abajo): el sol (acimut desde el norte y elevacion, color, fuerza), el cielo
// (cenit, horizonte, suelo, disco), la luz del cielo (hemisferica), la bruma (color y densidad), el tinte de lo que tiene
// la luz horneada (las sierras y las nubes del horizonte, las fotos de la muralla lejana), el agua y cuanto es de noche
// (ventanas encendidas en el macroedificio y las torres, estrellas). De noche el "sol" es la LUNA: misma luz, azul y floja,
// y su disco en el cielo.
//
// No toca los modulos: busca sus piezas en la escena por nombre (boveda, sierras, nubes, resplandor, agua, macroedificio,
// torres) y la muralla marca sus fotos con userData.foto. DIR_SOL (luz.js) se cambia EN SU SITIO: el agua y el
// resplandor la leen de ahi; para la sombra, la luz nunca baja de 7 grados (con el sol en el horizonte el mapa de sombra
// se estira kilometros).
import * as THREE from 'three';
import { DIR_SOL } from './luz.js';

const H = (o) => o;
export const HORAS = [
  H({ id: 'amanecer', hora: '06:00', nombre: 'AMANECER', alias: ['6'],
    sol: [72, 3], colorSol: 0xff9a5c, fuerzaSol: 1.6, cenit: 0x4d6197, horizonte: 0xf3a27c, sueloCielo: 0x86747a, disco: 0xffb27a,
    hemiCielo: 0x8f9ad0, hemiSuelo: 0x463b3a, fuerzaHemi: 0.95, bruma: 0xd8a693, densidad: 0.00048, tinteLejos: 0xd29a96,
    tinteNubes: 0xffa889, aguaCielo: 0xe4a48c, aguaHorizonte: 0x6b6886, luzAgua: 0.75, aureola: [0xffa060, 1.35], noche: 0.2, estrellas: 0.2,
    niebla: [1.7, 10], polvo: 0.55, luciernagas: 0 }),
  H({ id: 'manana', hora: '09:00', nombre: 'MAÑANA', alias: ['9'],
    sol: [112, 30], colorSol: 0xfff0d6, fuerzaSol: 2.6, cenit: 0x6ea6dc, horizonte: 0xd3e1e6, sueloCielo: 0xa8b2a6, disco: 0xfff7e4,
    hemiCielo: 0xe2efff, hemiSuelo: 0x55623f, fuerzaHemi: 1.5, bruma: 0xcfdcdd, densidad: 0.0002, tinteLejos: 0xe6eef4,
    tinteNubes: 0xffffff, aguaCielo: 0xcfe0ea, aguaHorizonte: 0x84a0a4, luzAgua: 1.0, aureola: [0xfff2d8, 0.8], noche: 0, estrellas: 0,
    niebla: [0.55, 6], polvo: 0.8, luciernagas: 0 }),
  H({ id: 'mediodia', hora: '13:00', nombre: 'MEDIODÍA', alias: ['13', '12'],
    sol: [185, 62], colorSol: 0xffffff, fuerzaSol: 3.0, cenit: 0x5d99d8, horizonte: 0xdbe4dc, sueloCielo: 0xb0b4a2, disco: 0xffffff,
    hemiCielo: 0xf2f6ff, hemiSuelo: 0x5c6a42, fuerzaHemi: 1.45, bruma: 0xd6ddd2, densidad: 0.00016, tinteLejos: 0xf2f6f6,
    tinteNubes: 0xffffff, aguaCielo: 0xd8e6ea, aguaHorizonte: 0x8aa69e, luzAgua: 1.05, aureola: [0xffffff, 0.6], noche: 0, estrellas: 0,
    niebla: [0.12, 4], polvo: 0.35, luciernagas: 0 }),
  // la de siempre (la luz con la que se hizo el mapa)
  H({ id: 'tarde', hora: '17:00', nombre: 'TARDE', alias: ['17', '16'],
    sol: [298, 22], colorSol: 0xffd9a0, fuerzaSol: 2.7, cenit: 0x9fb0a6, horizonte: 0xc7c6a6, sueloCielo: 0xa9a98a, disco: 0xfff1cf,
    hemiCielo: 0xf3efd6, hemiSuelo: 0x55603a, fuerzaHemi: 1.55, bruma: 0xc7c6a6, densidad: 0.00022, tinteLejos: 0xffffff,
    tinteNubes: 0xffffff, aguaCielo: 0xdad9c4, aguaHorizonte: 0x8c9a86, luzAgua: 1.0, aureola: [0xffffff, 1.0], noche: 0, estrellas: 0,
    niebla: [0.35, 6], polvo: 0.9, luciernagas: 0 }),
  H({ id: 'atardecer', hora: '20:00', nombre: 'ATARDECER', alias: ['20', '19'],
    sol: [300, 4], colorSol: 0xff7a34, fuerzaSol: 2.1, cenit: 0x56659b, horizonte: 0xf6a35a, sueloCielo: 0x7a5e52, disco: 0xff9a48,
    hemiCielo: 0xc29aa6, hemiSuelo: 0x4a3a2c, fuerzaHemi: 1.0, bruma: 0xe2a576, densidad: 0.00034, tinteLejos: 0xd59478,
    tinteNubes: 0xff9a6a, aguaCielo: 0xf0a670, aguaHorizonte: 0x6a5a6a, luzAgua: 0.8, aureola: [0xff8a3a, 1.6], noche: 0.3, estrellas: 0.05,
    niebla: [0.85, 8], polvo: 1.0, luciernagas: 0 }),
  H({ id: 'horaazul', hora: '21:30', nombre: 'HORA AZUL', alias: ['21', '22'],
    sol: [310, 9], colorSol: 0x6f84c4, fuerzaSol: 0.55, cenit: 0x13204a, horizonte: 0x4d5f97, sueloCielo: 0x1e2436, disco: 0x9fb2e6,
    hemiCielo: 0x5a6db0, hemiSuelo: 0x161a26, fuerzaHemi: 0.75, bruma: 0x3a4a78, densidad: 0.00036, tinteLejos: 0x4a5a88,
    tinteNubes: 0x56648e, aguaCielo: 0x4c5c8c, aguaHorizonte: 0x1c2440, luzAgua: 0.45, aureola: [0x7a8cd0, 0.5], noche: 0.85, estrellas: 0.45,
    niebla: [1.0, 8], polvo: 0, luciernagas: 0.5 }),
  H({ id: 'noche', hora: '01:00', nombre: 'NOCHE', alias: ['1', '0', '24', '23'],
    sol: [160, 42], colorSol: 0x9fb6ff, fuerzaSol: 0.6, cenit: 0x040817, horizonte: 0x141d36, sueloCielo: 0x070a12, disco: 0x9eabc8,
    hemiCielo: 0x2f3c66, hemiSuelo: 0x07080c, fuerzaHemi: 0.55, bruma: 0x0f1729, densidad: 0.0003, tinteLejos: 0x26314c,
    tinteNubes: 0x2c3650, aguaCielo: 0x2a3658, aguaHorizonte: 0x0c1020, luzAgua: 0.3, aureola: [0x9fb4ff, 0.25], noche: 1, estrellas: 1,
    niebla: [0.9, 7], polvo: 0, luciernagas: 1 }),
];

// del acimut (desde el norte, en el sentido del reloj) y la elevacion a una direccion del juego (+x este, -z norte)
function direccion(az, el, v = new THREE.Vector3()) {
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  return v.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
}

const COLORES = ['colorSol', 'cenit', 'horizonte', 'sueloCielo', 'disco', 'hemiCielo', 'hemiSuelo', 'bruma', 'tinteLejos', 'tinteNubes', 'aguaCielo', 'aguaHorizonte'];
const NUMEROS = ['fuerzaSol', 'fuerzaHemi', 'densidad', 'luzAgua', 'noche', 'estrellas', 'nieblaFuerza', 'nieblaCapa', 'polvo', 'luciernagas'];

function estadoDe(h) {
  const e = { dir: direccion(h.sol[0], Math.max(7, h.sol[1])), disco: null, aureolaColor: new THREE.Color(h.aureola[0]), aureolaFuerza: h.aureola[1] };
  for (const k of COLORES) e[k] = new THREE.Color(h[k]);
  for (const k of NUMEROS) e[k] = h[k];
  e.nieblaFuerza = h.niebla[0]; e.nieblaCapa = h.niebla[1];
  return e;
}

export function crearHoras({ scene, sol, cielo, neblina = null, motas = null }) {
  const pedida = new URLSearchParams(location.search).get('hora');
  let indice = Math.max(0, HORAS.findIndex((h) => h.id === pedida || h.alias.includes(pedida || '')));
  if (pedida == null) indice = HORAS.findIndex((h) => h.id === 'tarde');
  const ahora = estadoDe(HORAS[indice]);
  let desde = null, hacia = null, t = 1;

  // ---- las estrellas: puntos en la boveda que siguen al 18 (sin niebla)
  const estrellas = (() => {
    const n = 2600, p = new Float32Array(n * 3), tam = new Float32Array(n);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const y = 0.06 + 0.94 * Math.pow(r(), 0.7), a = r() * Math.PI * 2, h = Math.sqrt(1 - y * y);
      p[i * 3] = Math.cos(a) * h * 9000; p[i * 3 + 1] = y * 9000; p[i * 3 + 2] = Math.sin(a) * h * 9000;
      tam[i] = 0.8 + Math.pow(r(), 6) * 2.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color: 0xeef2ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const pts = new THREE.Points(g, m);
    pts.name = 'estrellas';
    pts.frustumCulled = false;
    pts.renderOrder = -9;
    scene.add(pts);
    return pts;
  })();

  // ---- lo que hay que tenir: se busca en la escena una vez (y otra si aun no habia cargado)
  let piezas = null;
  function buscar() {
    const p = { boveda: null, lejos: [], nubes: [], aureola: [], agua: [], fotos: [], ventanas: [] };
    scene.traverse((o) => {
      if (o.name === 'boveda' && o.material.uniforms) p.boveda = o.material.uniforms;
      if (o.parent && o.parent.name === 'sierras' && o.material) p.lejos.push(o.material);
      if (o.parent && o.parent.name === 'nubes' && o.material) p.nubes.push(o.material);
      if (o.isSprite && o.parent && o.parent.name === 'resplandor') p.aureola.push(o.material);
      if (o.material && o.material.uniforms && o.material.uniforms.uCielo && !p.agua.includes(o.material)) p.agua.push(o.material);
      if (o.material && o.material.userData && o.material.userData.foto) p.fotos.push(o.material);
      // las ventanas: el vidrio del macroedificio y de las torres de refugio
      const enCiudad = (() => { for (let q = o; q; q = q.parent) if (q.name === 'macroedificio' || q.name === 'torres') return true; return false; })();
      if (enCiudad && o.material) for (const m of [].concat(o.material)) if (/vidrio/i.test(m.name || '') && !p.ventanas.includes(m)) p.ventanas.push(m);
    });
    for (const m of p.agua) if (!m.userData.claro0) { m.userData.claro0 = m.uniforms.uClaro.value.clone(); m.userData.hondo0 = m.uniforms.uHondo.value.clone(); }
    for (const m of p.aureola) if (m.userData.op0 == null) m.userData.op0 = m.opacity;
    return p;
  }
  // se busca cada 3 s durante el primer medio minuto (lo que se carga tarde: el macroedificio, las torres); luego ya no
  let buscarOtra = 0, busquedas = 0;

  const CALIDA = new THREE.Color(0xffc27a), _lc = new THREE.Color(), _ls = new THREE.Color();
  function aplicar(e) {
    // la luz (la direccion se cambia EN SU SITIO: el agua y el resplandor la leen de DIR_SOL)
    DIR_SOL.copy(e.dir);
    sol.color.copy(e.colorSol); sol.intensity = e.fuerzaSol;
    cielo.groundColor.copy(e.hemiSuelo); cielo.intensity = e.fuerzaHemi;
    scene.fog.density = e.densidad;
    estrellas.material.opacity = e.estrellas;
    estrellas.visible = e.estrellas > 0.01;
    // la neblina (neblina.js): la luz del cielo y la del sol de la hora la alumbran; las motas (motas.js): polvo o luciernagas
    if (neblina) neblina.hora({ fuerza: e.nieblaFuerza, capa: e.nieblaCapa, luzCielo: _lc.copy(e.hemiCielo).multiplyScalar(e.fuerzaHemi * 0.6),
      luzSol: _ls.copy(e.colorSol).multiplyScalar(e.fuerzaSol * 0.3), dirSol: e.dir });
    if (motas) motas.hora({ polvo: e.polvo, luciernagas: e.luciernagas, dirSol: e.dir });
    if (!piezas) return;
    const P = piezas;
    if (P.boveda) {
      P.boveda.uCenit.value.copy(e.cenit); P.boveda.uHorizonte.value.copy(e.horizonte); P.boveda.uSuelo.value.copy(e.sueloCielo);
      P.boveda.uSol.value.copy(e.disco); P.boveda.uSolDir.value.copy(e.dir);
    }
    for (const m of P.lejos) m.color.copy(e.tinteLejos);
    for (const m of P.nubes) m.color.copy(e.tinteNubes);
    for (const m of P.fotos) m.color.copy(e.tinteLejos);
    for (const m of P.aureola) { m.color.copy(e.aureolaColor); m.opacity = Math.min(1, m.userData.op0 * e.aureolaFuerza); }
    for (const m of P.agua) {
      m.uniforms.uCielo.value.copy(e.aguaCielo); m.uniforms.uHorizonte.value.copy(e.aguaHorizonte);
      m.uniforms.uClaro.value.copy(m.userData.claro0).multiplyScalar(e.luzAgua);
      m.uniforms.uHondo.value.copy(m.userData.hondo0).multiplyScalar(e.luzAgua);
    }
    // de noche se encienden las ventanas (luz calida, mas cuanto mas de noche)
    // (el vidrio del macroedificio es una sola lamina por fachada: con la fuerza de las torres brillaba entero como un farol)
    // (el vidrio del macroedificio lleva sus habitaciones y su luz en el sombreador: solo hay que decirle cuanto es de noche)
    for (const m of P.ventanas) {
      if (m.userData.uNoche) m.userData.uNoche.value = e.noche;
      else if (m.emissive) { m.emissive.copy(CALIDA); m.emissiveIntensity = 0.5 * e.noche * e.noche; }
    }
  }

  const mezcla = (a, b, k) => {
    const e = { dir: a.dir.clone().lerp(b.dir, k).normalize(), aureolaColor: a.aureolaColor.clone().lerp(b.aureolaColor, k), aureolaFuerza: a.aureolaFuerza + (b.aureolaFuerza - a.aureolaFuerza) * k };
    for (const c of COLORES) e[c] = a[c].clone().lerp(b[c], k);
    for (const n of NUMEROS) e[n] = a[n] + (b[n] - a[n]) * k;
    return e;
  };

  // el boton de arriba (a la izquierda de EDITAR) y su rotulo
  const css = document.createElement('style');
  css.textContent = `#hora-boton { position: fixed; right: 214px; top: 14px; z-index: 6; font: 600 12px/1 Bahnschrift, "Segoe UI", sans-serif; letter-spacing: .18em; color: #f2ecdc;
    background: rgba(22,24,18,.55); border: 1px solid rgba(255,255,255,.16); border-radius: 8px; padding: 8px 12px; cursor: pointer; backdrop-filter: blur(3px); }
  #hora-boton kbd { margin-left: 8px; padding: 1px 5px; border: 1px solid rgba(255,255,255,.35); border-radius: 4px; font: 11px/14px inherit; }
  #hora-boton b { font-weight: 700; margin-right: 6px; }`;
  document.head.appendChild(css);
  const boton = document.createElement('button');
  boton.id = 'hora-boton';
  document.body.appendChild(boton);
  const rotular = () => { const h = HORAS[indice]; boton.innerHTML = `<b>${h.hora}</b>${h.nombre}<kbd>T</kbd>`; };
  rotular();

  function ir(i) {
    indice = (i + HORAS.length) % HORAS.length;
    desde = mezcla(ahora, ahora, 0); hacia = estadoDe(HORAS[indice]); t = 0;
    rotular();
  }
  const siguiente = () => ir(indice + 1);
  boton.addEventListener('click', (ev) => { ev.stopPropagation(); siguiente(); boton.blur(); });

  aplicar(ahora);
  return {
    siguiente, ir: (id) => ir(HORAS.findIndex((h) => h.id === id)),
    get hora() { return HORAS[indice]; },
    // la bruma y la luz del cielo de la hora (mundo.js las mezcla con las del norte cada fotograma)
    get bruma() { return ahora.bruma; },
    get luzCielo() { return ahora.hemiCielo; },
    get densidad() { return ahora.densidad; },
    get noche() { return ahora.noche; },
    actualizar(dt, foco) {
      if (!piezas || (busquedas < 10 && (buscarOtra -= dt) < 0)) { piezas = buscar(); buscarOtra = 3; busquedas++; aplicar(ahora); }
      if (t < 1 && hacia) {
        t = Math.min(1, t + dt / 2.5);
        const k = t * t * (3 - 2 * t);
        const e = mezcla(desde, hacia, k);
        Object.assign(ahora, e);
        aplicar(ahora);
      }
      estrellas.position.set(foco.x, 0, foco.z);
      estrellas.rotation.y += dt * 0.002;
    },
    info: () => ({ hora: HORAS[indice].id }),
  };
}
