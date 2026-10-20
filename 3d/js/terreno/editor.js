// EL EDITOR DEL TERRENO (?mapa=terreno, tecla E o el boton EDITAR): el usuario modela el suelo a mano.
//   1 Subir · 2 Bajar · 3 Allanar (a la cota donde empieza el trazo) · 4 Suavizar · 5 Pintar (el suelo: hierba,
//   hierba alta, seca, flores, tierra, roca, grava, barro; "Como era" lo devuelve) · 6 Poner rocas · 7 Quitar rocas
//   8 Modelos 3D: la biblioteca de .glb (Importar o arrastrar a la ventana); clic en uno y clic en el suelo lo pone;
//     sin ninguno en la mano, clic elige uno puesto y arrastrar lo mueve; R gira 15 grados, [ ] escala, Supr borra,
//     Ctrl+D lo duplica al lado (para encadenar tramos de muro), Esc suelta
// Camara libre que orbita un punto del suelo: boton derecho gira, rueda acerca, rueda pulsada (o Mayus + derecho)
// arrastra, WASD mueve (Mayus, deprisa). Deshacer y rehacer por trazos (Ctrl+Z / Ctrl+Y) y GUARDAR (Ctrl+S) a disco
// (edicion.js). El suelo cambia al momento en forma; su color (lo caro) se pinta poco a poco detras; la hierba, las
// paredes del escarpe, la distancia a las rocas y el mapa se rehacen al soltar el boton.
import * as THREE from 'three';
import * as R from './relieve.js';
import { ROCAS, activarRoca, nuevaRoca, asentar, recalcularDistRoca } from './sitios.js';
import * as E from './edicion.js';
import { nuevoModelo, foto, aplicarFoto, plantilla, yaCargado } from './modelos.js';

const HERRAMIENTAS = [
  { id: 'subir', nombre: 'Subir', tecla: '1', color: 0xffc35a },
  { id: 'bajar', nombre: 'Bajar', tecla: '2', color: 0x6fb6ff },
  { id: 'allanar', nombre: 'Allanar', tecla: '3', color: 0xffffff },
  { id: 'suavizar', nombre: 'Suavizar', tecla: '4', color: 0x9be37a },
  { id: 'pintar', nombre: 'Pintar', tecla: '5', color: 0xf2ecdc },
  { id: 'rocas', nombre: 'Poner rocas', tecla: '6', color: 0xc9c2b2 },
  { id: 'quitar', nombre: 'Quitar rocas', tecla: '7', color: 0xff6b5a },
  { id: 'modelos', nombre: 'Modelos 3D', tecla: '8', color: 0xffd36a },
];
const f = R.N + 1;
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export function crearEditor({ scene, suelo, rocas, paredes, hierba, plano, laguna, modelos }) {
  const S = {
    activo: false, herramienta: 'subir', radio: 12, fuerza: 1, material: 1, roca: 1.0, invertir: false,
    biblioteca: [], armado: null, giroM: 0, escalaM: 1, solidoM: true, sel: null, mover: null,
    obj: new THREE.Vector3(), yaw: 0, pitch: 0.75, dist: 60, teclas: new Set(),
    raton: null, golpe: null, trazo: null, sucio: false, mensaje: '',
  };
  const historia = [], rehechos = [];
  const enlaces = { heroe: null, C: null, cam: null, canvas: null };
  let cerca = 0.05, densidad = 0;

  // ---------------- el anillo del pincel (siempre encima: depthTest apagado) ----------------
  const SEG = 72;
  const anillo = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 3), 3)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }));
  const anilloIn = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 3), 3)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthTest: false }));
  const punto = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.9 }));
  for (const o of [anillo, anilloIn, punto]) { o.renderOrder = 10; o.visible = false; o.frustumCulled = false; scene.add(o); }
  function ponerAnillo(l, cx, cz, r) {
    const p = l.geometry.attributes.position;
    for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      p.setXYZ(k, x, R.altura(x, z) + 0.12 + 0.002 * S.dist, z);
    }
    p.needsUpdate = true;
  }
  function dibujarPincel() {
    const g = S.golpe;
    const ver = S.activo && g && S.raton && S.raton.dentro;
    anillo.visible = anilloIn.visible = punto.visible = !!ver;
    if (!ver) return;
    if (S.herramienta === 'modelos') {
      anillo.visible = anilloIn.visible = false;
      punto.visible = !S.armado;
      punto.material.color.setHex(0xffd36a);
      punto.position.set(g.x, R.altura(g.x, g.z) + 0.1, g.z);
      punto.scale.setScalar(0.06 + 0.004 * S.dist);
      return;
    }
    const h = HERRAMIENTAS.find((t) => t.id === S.herramienta);
    const color = S.herramienta === 'pintar' && R.MATERIALES[S.material].color != null ? R.MATERIALES[S.material].color : h.color;
    anillo.material.color.setHex(color);
    anilloIn.material.color.setHex(color);
    punto.material.color.setHex(color);
    const r = S.herramienta === 'rocas' ? S.roca : S.radio;
    ponerAnillo(anillo, g.x, g.z, r);
    anilloIn.visible = S.herramienta !== 'rocas';
    if (anilloIn.visible) ponerAnillo(anilloIn, g.x, g.z, r * 0.5);
    punto.position.set(g.x, R.altura(g.x, g.z) + 0.1, g.z);
    punto.scale.setScalar(0.06 + 0.004 * S.dist);
  }

  // ---------------- donde toca el raton el suelo: marchar por el rayo y biseccion ----------------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function tocar() {
    const cam = enlaces.cam, cv = enlaces.canvas;
    if (!S.raton || !cam) return null;
    const rc = cv.getBoundingClientRect();
    ndc.set(((S.raton.x - rc.left) / rc.width) * 2 - 1, -((S.raton.y - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const o = ray.ray.origin, d = ray.ray.direction;
    const sobre = (t) => o.y + d.y * t - R.altura(o.x + d.x * t, o.z + d.z * t);
    let t0 = 0, t = 0.5;
    for (let n = 0; n < 1500 && t < 2600; n++) {
      if (sobre(t) < 0) {
        let a = t0, b = t;
        for (let k = 0; k < 22; k++) { const m = (a + b) / 2; if (sobre(m) > 0) a = m; else b = m; }
        const x = o.x + d.x * b, z = o.z + d.z * b;
        if (Math.abs(x) > R.EXT - 0.5 || Math.abs(z) > R.EXT - 0.5) return null;
        return { x, z, y: R.altura(x, z) };
      }
      t0 = t;
      t += Math.max(0.25, t * 0.006);
    }
    return null;
  }

  // ---------------- los trazos ----------------
  // trazo: lo que habia antes de cada vertice / celda tocados, las rocas puestas o quitadas, y el recuadro tocado
  function empezar() {
    S.trazo = { alt: new Map(), pint: new Map(), rocas: [], caja: [1e9, 1e9, -1e9, -1e9], herr: S.herramienta, cota: S.golpe.y, ultima: null, acum: 0 };
    // un clic suelto ya hace algo (si no, entre bajar y subir el boton no daba tiempo a ningun paso del pincel)
    if (S.herramienta === 'rocas') ponerRoca(S.golpe.x, S.golpe.z);
    else aplicarPincel(1 / 30);
  }
  const ampliar = (c, x0, z0, x1, z1) => { c[0] = Math.min(c[0], x0); c[1] = Math.min(c[1], z0); c[2] = Math.max(c[2], x1); c[3] = Math.max(c[3], z1); };
  const caer = (w) => { const q = 1 - w * w; return q <= 0 ? 0 : q * q; };    // 1 en el centro, 0 en el borde
  // Subir y Bajar: metros por segundo en el centro del pincel. Crece con el tamano (con 5 m/s fijos una montana
  // de verdad no salia nunca): a fuerza 100 % y 12 m de radio, 16 m/s; con 100 m y fuerza 200 %, 172 m/s
  const velSubir = (r, fz) => fz * (6 + 0.8 * r);
  const TOPE = [-80, 400];                                                     // cotas a las que se puede llevar el suelo
  function aplicarPincel(dt) {
    const g = S.golpe, T = S.trazo;
    if (!g || !T) return;
    if (T.herr === 'rocas') {
      // al arrastrar, una roca cada vez que el raton se ha movido dos de sus anchos
      if (T.ultima && Math.hypot(g.x - T.ultima.x, g.z - T.ultima.z) > S.roca * 2.2) ponerRoca(g.x, g.z, true);
      return;
    }
    // de donde se aplico la ultima vez hasta aqui, un toque cada tercio del radio: con el raton deprisa el trazo
    // salia a manchas sueltas (el pincel va a 30 por segundo)
    const a = T.prev || g, L = Math.hypot(g.x - a.x, g.z - a.z);
    const n = Math.min(40, Math.max(1, Math.ceil(L / Math.max(0.5, S.radio * 0.3))));
    for (let s = 1; s <= n; s++) { const t = s / n; sello({ x: a.x + (g.x - a.x) * t, z: a.z + (g.z - a.z) * t }, dt / n); }
    T.prev = { x: g.x, z: g.z };
  }
  function sello(g, dt) {
    const T = S.trazo, r = S.radio, fz = S.fuerza;
    if (T.herr === 'quitar') {
      for (const o of ROCAS) {
        if (o.quitada || Math.hypot(o.x - g.x, o.z - g.z) > r) continue;
        activarRoca(o, false);
        rocas.colocarSinCerrar(o);
        T.rocas.push({ o, antes: true, despues: false });
        ampliar(T.caja, o.x - o.r, o.z - o.r, o.x + o.r, o.z + o.r);
      }
      rocas.cerrar();
      return;
    }
    const i0 = Math.max(0, Math.floor((g.x - r + R.EXT) / R.PASO)), i1 = Math.min(R.N, Math.ceil((g.x + r + R.EXT) / R.PASO));
    const j0 = Math.max(0, Math.floor((g.z - r + R.EXT) / R.PASO)), j1 = Math.min(R.N, Math.ceil((g.z + r + R.EXT) / R.PASO));
    ampliar(T.caja, g.x - r, g.z - r, g.x + r, g.z + r);
    if (T.herr === 'pintar') {
      // las celdas cuyo centro cae dentro (el borde, mellado: no un circulo de compas)
      for (let j = j0; j < Math.min(R.N, j1); j++) for (let i = i0; i < Math.min(R.N, i1); i++) {
        const x = -R.EXT + (i + 0.5) * R.PASO, z = -R.EXT + (j + 0.5) * R.PASO, d = Math.hypot(x - g.x, z - g.z);
        if (d > r * (0.78 + 0.22 * R.hash(i, j, 3))) continue;
        const c = j * R.N + i;
        if (PINTURA_ES(c, S.material)) continue;
        if (!T.pint.has(c)) T.pint.set(c, R.PINTURA[c]);
        R.PINTURA[c] = S.material;
      }
      suelo.rehacer(i0 - 1, j0 - 1, i1, j1, true);
      return;
    }
    // las alturas: los vertices dentro del circulo, con caida suave hacia el borde
    const copia = T.herr === 'suavizar' ? R.H.slice(Math.max(0, (j0 - 1) * f), Math.min(f * f, (j1 + 2) * f)) : null, base = Math.max(0, (j0 - 1) * f);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = -R.EXT + i * R.PASO, z = -R.EXT + j * R.PASO, d = Math.hypot(x - g.x, z - g.z);
      if (d >= r) continue;
      const w = caer(d / r), k = j * f + i;
      if (!T.alt.has(k)) T.alt.set(k, R.H[k]);
      let h = R.H[k];
      if (T.herr === 'subir' || T.herr === 'bajar') h += (T.herr === 'subir' !== S.invertir ? 1 : -1) * velSubir(r, fz) * w * dt;
      else if (T.herr === 'allanar') h += (T.cota - h) * Math.min(1, 7 * fz * w * dt);
      else if (T.herr === 'suavizar' && i > 0 && j > 0 && i < R.N && j < R.N) {
        const q = k - base;
        const media = (copia[q - 1] + copia[q + 1] + copia[q - f] + copia[q + f] + copia[q - f - 1] + copia[q - f + 1] + copia[q + f - 1] + copia[q + f + 1]) / 8;
        h += (media - h) * Math.min(1, 9 * fz * w * dt);
      }
      R.H[k] = Math.max(TOPE[0], Math.min(TOPE[1], h));
    }
    R.recalcularCurva(i0, j0, i1, j1);
    // la forma ya; el color, detras (y un poco mas alla: la pendiente y la curvatura miran a los vecinos)
    suelo.rehacer(i0 - 2, j0 - 2, i1 + 1, j1 + 1, true);
    // las rocas de debajo suben o bajan con el suelo
    for (const o of ROCAS) {
      if (o.quitada || Math.abs(o.x - g.x) > r + o.r || Math.abs(o.z - g.z) > r + o.r) continue;
      asentar(o);
      rocas.colocarSinCerrar(o);
    }
    rocas.cerrar();
  }
  const PINTURA_ES = (c, m) => R.PINTURA[c] === m;
  function ponerRoca(x, z, arrastrando = false) {
    const T = S.trazo, r = S.roca * (0.75 + Math.random() * 0.5);
    // con el clic sale siempre; arrastrando, no encima de otra igual de grande
    if (arrastrando && ROCAS.some((o) => !o.quitada && o.r > r * 0.5 && Math.hypot(o.x - x, o.z - z) < (o.r + r) * 0.6)) { T.ultima = { x, z }; return; }
    const o = nuevaRoca({ x, z, r });
    rocas.meter(o);
    T.rocas.push({ o, antes: false, despues: true });
    T.ultima = { x, z };
    ampliar(T.caja, x - r, z - r, x + r, z + r);
  }
  function terminar() {
    const T = S.trazo;
    S.trazo = null;
    if (!T) return;
    const cambios = T.alt.size + T.pint.size + T.rocas.length;
    if (!cambios) return;
    // lo de despues de cada cosa tocada, para rehacer
    const ent = { herr: T.herr, caja: T.caja, rocas: T.rocas };
    ent.alt = { k: Int32Array.from(T.alt.keys()), antes: Float32Array.from(T.alt.values()) };
    ent.alt.despues = Float32Array.from(ent.alt.k, (k) => R.H[k]);
    ent.pint = { c: Int32Array.from(T.pint.keys()), antes: Uint8Array.from(T.pint.values()) };
    ent.pint.despues = Uint8Array.from(ent.pint.c, (c) => R.PINTURA[c]);
    historia.push(ent);
    if (historia.length > 80) historia.shift();
    rehechos.length = 0;
    rematar(ent.caja, ent.alt.k.length > 0, ent.rocas.length > 0);
    marcarSucio();
  }
  // lo que se rehace al soltar (o al deshacer): hierba, paredes, distancia a las rocas, la laguna y el mapa
  function rematar(c, alturas, conRocas) {
    if (!(c[2] >= c[0])) return;
    const x0 = c[0] - 3, z0 = c[1] - 3, x1 = c[2] + 3, z1 = c[3] + 3;
    if (conRocas) recalcularDistRoca(x0 - 2, z0 - 2, x1 + 2, z1 + 2);
    const ci = (x) => Math.floor((x + R.EXT) / R.PASO);
    suelo.rehacer(ci(x0) - 1, ci(z0) - 1, ci(x1) + 1, ci(z1) + 1, true);
    hierba.tirarZona(x0, z0, x1, z1);
    if (alturas) {
      paredes.rehacer(x0, z0, x1, z1);
      modelos.asentar(x0, z0, x1, z1);                       // los modelos, a la cota nueva
      // la lamina de barro cuarteado de la laguna va a su cota: si se toca el fondo, fuera (el suelo ya es barro)
      const L = R.LAGUNA;
      if (laguna && x1 > L.x - 40 && x0 < L.x + 40 && z1 > L.z - 40 && z0 < L.z + 40) {
        let peor = 0;
        for (let z = L.z - L.rz; z <= L.z + L.rz; z += 1.6) for (let x = L.x - L.rx; x <= L.x + L.rx; x += 1.6) peor = Math.max(peor, Math.abs(R.deltaEn(x, z)));
        laguna.visible = peor < 0.08;
      }
    }
    plano.rehacer();
  }
  function deshacer(atras = true) {
    const de = atras ? historia : rehechos, a = atras ? rehechos : historia;
    const ent = de.pop();
    if (!ent) { aviso(atras ? 'Nada que deshacer' : 'Nada que rehacer'); return; }
    a.push(ent);
    if (ent.modelos) {
      for (const { m, antes, despues } of ent.modelos) aplicarFoto(m, atras ? antes : despues);
      modelos.sincronizar();
      for (const { m } of ent.modelos) if (!m.quitado) modelos.colocar(m);
      if (S.sel && S.sel.quitado) S.sel = null;
      marcarSucio();
      aviso(`${atras ? 'Deshecho' : 'Rehecho'}: modelos`);
      return;
    }
    const alt = atras ? ent.alt.antes : ent.alt.despues, pin = atras ? ent.pint.antes : ent.pint.despues;
    ent.alt.k.forEach((k, n) => { R.H[k] = alt[n]; });
    ent.pint.c.forEach((c, n) => { R.PINTURA[c] = pin[n]; });
    const c = ent.caja, ci = (x) => Math.floor((x + R.EXT) / R.PASO);
    if (ent.alt.k.length) R.recalcularCurva(ci(c[0]) - 1, ci(c[1]) - 1, ci(c[2]) + 2, ci(c[3]) + 2);
    for (const { o, antes, despues } of ent.rocas) { activarRoca(o, atras ? antes : despues); rocas.colocarSinCerrar(o); }
    for (const o of ROCAS) {
      if (o.quitada || o.x < c[0] - 4 || o.x > c[2] + 4 || o.z < c[1] - 4 || o.z > c[3] + 4) continue;
      asentar(o);
      rocas.colocarSinCerrar(o);
    }
    rocas.cerrar();
    suelo.rehacer(ci(c[0]) - 3, ci(c[1]) - 3, ci(c[2]) + 3, ci(c[3]) + 3, true);
    rematar(c, ent.alt.k.length > 0, ent.rocas.length > 0);
    marcarSucio();
    aviso(`${atras ? 'Deshecho' : 'Rehecho'}: ${nombreHerr(ent.herr)}`);
  }
  const nombreHerr = (id) => HERRAMIENTAS.find((t) => t.id === id).nombre.toLowerCase();
  // todo lo editado fuera (el terreno de relieve.js). No se guarda hasta que se pulse Guardar
  function borrarTodo() {
    if (!confirm('¿Borrar TODO lo editado y volver al terreno original? (No se guarda hasta que pulses Guardar.)')) return;
    E.aplicar({});
    modelos.sincronizar();
    S.sel = null;
    for (const o of ROCAS) rocas.colocarSinCerrar(o);
    rocas.cerrar();
    suelo.rehacer(0, 0, R.N - 1, R.N - 1, true);
    rematar([-R.EXT, -R.EXT, R.EXT, R.EXT], true, true);
    if (laguna) laguna.visible = true;
    historia.length = rehechos.length = 0;
    marcarSucio();
    aviso('Borrado todo lo editado');
  }
  async function guardar() {
    aviso('Guardando…');
    try {
      const r = await E.guardar();
      S.sucio = false;
      aviso(`Guardado: ${r.vertices} vértices, ${r.celdasPintadas} celdas pintadas, ${r.nuevas} rocas puestas, ${r.quitadas} quitadas, ${r.modelos} modelos`);
    } catch (e) {
      aviso('No se pudo guardar: ' + e.message, true);
    }
    pintarPanel();
  }
  function marcarSucio() { S.sucio = true; pintarPanel(); }
  addEventListener('beforeunload', (e) => { if (S.sucio) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------- los modelos 3D (herramienta 8) ----------------
  const mb = (b) => (b / 1048576).toFixed(b < 10485760 ? 1 : 0).replace('.', ',') + ' MB';
  const metros = (v) => v.toFixed(v < 10 ? 1 : 0).replace('.', ',');
  const medidas = (P, esc) => `${metros(P.tam.x * esc)} × ${metros(P.tam.y * esc)} × ${metros(P.tam.z * esc)} m`;
  const vuelta = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  async function cargarBiblioteca() {
    try { S.biblioteca = await (await fetch('/__modelos', { cache: 'no-store' })).json(); } catch { S.biblioteca = []; }
    pintarPanel();
  }
  // coger un modelo de la biblioteca (el siguiente clic en el suelo lo pone); otra vez el mismo, soltarlo
  function armar(archivo) {
    S.armado = S.armado === archivo ? null : archivo;
    S.sel = null;
    if (S.armado) {
      aviso(`Cargando ${archivo}…`);
      plantilla(archivo).then((P) => {
        if (S.armado !== archivo) return;
        if (P.error) aviso(`${archivo}: no se puede abrir (${P.error})`, true);
        else aviso(`${archivo}: ${medidas(P, S.escalaM)}, ${P.tris.toLocaleString('es')} triángulos. Clic en el suelo para ponerlo; R gira, [ ] escala, Esc lo suelta`);
        pintarPanel();
      });
    }
    pintarPanel();
  }
  async function importar(archivos) {
    entrar();
    S.herramienta = 'modelos';
    let ultimo = null;
    for (const f of archivos) {
      if (!/\.glb$/i.test(f.name)) { aviso(`${f.name}: solo se pueden importar .glb`, true); continue; }
      aviso(`Subiendo ${f.name} (${mb(f.size)})…`);
      try {
        const r = await fetch('/__modelo/' + encodeURIComponent(f.name), { method: 'PUT', body: f });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        modelos.recargar(j.archivo);           // si ya estaba (mismo nombre), las instancias puestas se rehacen con el nuevo
        ultimo = j.archivo;
      } catch (err) { aviso(`No se pudo subir ${f.name}: ${err.message}`, true); }
    }
    await cargarBiblioteca();
    if (ultimo) { S.armado = null; armar(ultimo); }
  }
  function registrarModelos(lista) {
    historia.push({ herr: 'modelos', modelos: lista });
    if (historia.length > 80) historia.shift();
    rehechos.length = 0;
    marcarSucio();
  }
  function clicModelo() {
    const g = S.golpe = tocar();
    if (S.armado) {
      if (!g) return;
      const P = yaCargado(S.armado);
      if (!P) { aviso('Aún se está cargando…'); return; }
      if (P.error) { aviso(`${S.armado}: no se puede abrir (${P.error})`, true); return; }
      const m = nuevoModelo({ archivo: S.armado, x: g.x, z: g.z, giro: S.giroM, escala: S.escalaM, solido: S.solidoM });
      modelos.sincronizar();
      registrarModelos([{ m, antes: { ...foto(m), vivo: false }, despues: foto(m) }]);
      S.sel = m;
      aviso(`Puesto ${m.archivo}. Clic para poner otro; Esc lo suelta`);
      pintarPanel();
      return;
    }
    // sin nada en la mano: elegir el que hay bajo el raton (y arrastrarlo si se mueve)
    const m = modelos.elegir(ray.ray);
    S.sel = m;
    if (m && g) S.mover = { m, dx: m.x - g.x, dz: m.z - g.z, antes: foto(m), movido: false };
    if (m) { const P = yaCargado(m.archivo); aviso(`${m.archivo}: ${medidas(P, m.escala)}. Arrastra para moverlo; R gira, [ ] escala, Ctrl+D duplica al lado, Supr lo borra`); }
    pintarPanel();
  }
  function soltarModelo() {
    const M = S.mover;
    S.mover = null;
    if (!M || !M.movido) return;
    modelos.colocar(M.m);                      // ahora si: la hierba de debajo y el mapa
    registrarModelos([{ m: M.m, antes: M.antes, despues: foto(M.m) }]);
  }
  // un cambio al elegido (girar, escalar, borrar...) que se puede deshacer
  function cambiarSel(fn, texto) {
    const m = S.sel;
    if (!m) return false;
    const antes = foto(m);
    fn(m);
    modelos.sincronizar();
    if (!m.quitado) modelos.colocar(m);
    registrarModelos([{ m, antes, despues: foto(m) }]);
    if (m.quitado) S.sel = null;
    if (texto) aviso(texto);
    pintarPanel();
    return true;
  }
  function girarModelo(signo) {
    const d = (signo * Math.PI) / 12;
    if (S.sel) cambiarSel((m) => { m.giro = vuelta(m.giro + d); });
    else { S.giroM = vuelta(S.giroM + d); pintarPanel(); }
  }
  function escalarModelo(k) {
    if (S.sel) cambiarSel((m) => { m.escala = Math.max(0.01, Math.min(100, m.escala * k)); });
    else { S.escalaM = Math.max(0.01, Math.min(100, S.escalaM * k)); pintarPanel(); }
  }
  // otro igual pegado a este, por su lado mas largo (encadenar tramos de muro, vallas...)
  function duplicar() {
    const m = S.sel, P = m && yaCargado(m.archivo);
    if (!P || P.error) return;
    const lx = P.tam.x * m.escala, lz = P.tam.z * m.escala;
    const [ox, oz] = lx >= lz ? [Math.cos(m.giro) * lx, -Math.sin(m.giro) * lx] : [Math.sin(m.giro) * lz, Math.cos(m.giro) * lz];
    const n = nuevoModelo({ archivo: m.archivo, x: m.x + ox, z: m.z + oz, y: m.y, giro: m.giro, escala: m.escala, solido: m.solido });
    modelos.sincronizar();
    registrarModelos([{ m: n, antes: { ...foto(n), vivo: false }, despues: foto(n) }]);
    S.sel = n;
    aviso('Duplicado al lado (Ctrl+D otra vez para seguir la fila)');
    pintarPanel();
  }
  // soltar un .glb en la ventana lo importa
  addEventListener('dragover', (e) => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    document.body.classList.add('arrastrando');
  });
  addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('arrastrando'); });
  addEventListener('drop', (e) => {
    document.body.classList.remove('arrastrando');
    const fs = e.dataTransfer ? [...e.dataTransfer.files] : [];
    if (!fs.length) return;
    e.preventDefault();
    importar(fs);
  });

  // ---------------- el panel ----------------
  const css = document.createElement('style');
  css.textContent = `
#editor-boton { position: fixed; right: 112px; top: 14px; z-index: 6; font: 600 12px/1 Bahnschrift, "Segoe UI", sans-serif; letter-spacing: .18em; color: #f2ecdc;
  background: rgba(22,24,18,.6); border: 1px solid rgba(255,255,255,.18); border-radius: 18px; padding: 9px 14px; cursor: pointer; backdrop-filter: blur(3px); }
#editor-boton:hover { background: rgba(22,24,18,.8); }
#editor-boton kbd { border: 1px solid rgba(242,236,220,.5); border-radius: 4px; padding: 1px 5px; margin-left: 6px; font: inherit; }
body.editando #editor-boton, body.editando #ayuda { display: none; }
#editor { position: fixed; right: 14px; top: 58px; z-index: 6; width: 268px; max-height: calc(100vh - 72px); overflow: auto; display: none;
  background: rgba(22,24,18,.86); border: 1px solid rgba(255,255,255,.14); border-radius: 10px; padding: 12px 12px 10px; color: #f2ecdc;
  font: 13px/1.35 Bahnschrift, "Segoe UI", sans-serif; backdrop-filter: blur(3px); user-select: none; }
body.editando #editor { display: block; }
#editor .cab { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
#editor .cab b { letter-spacing: .22em; font-size: 13px; }
#editor button { font: inherit; color: inherit; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16); border-radius: 6px; padding: 6px 7px; cursor: pointer; }
#editor button:hover { background: rgba(255,255,255,.14); }
#editor button:disabled { opacity: .35; cursor: default; }
#editor .herr { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-bottom: 10px; }
#editor .herr button { text-align: left; display: flex; gap: 7px; align-items: center; }
#editor .herr button i { font-style: normal; font-size: 11px; opacity: .6; border: 1px solid rgba(255,255,255,.3); border-radius: 3px; padding: 0 4px; }
#editor .herr button.si { background: rgba(255,223,138,.22); border-color: #ffdf8a; }
#editor .fila { display: grid; grid-template-columns: 62px 1fr 46px; align-items: center; gap: 8px; margin: 6px 0; }
#editor .fila span:last-child { text-align: right; opacity: .85; font-variant-numeric: tabular-nums; }
#editor input[type=range] { width: 100%; accent-color: #ffdf8a; }
#editor .mats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin: 8px 0 4px; }
#editor .mats button { padding: 4px 5px; font-size: 11.5px; display: flex; gap: 6px; align-items: center; }
#editor .mats button b { width: 12px; height: 12px; border-radius: 3px; flex: none; border: 1px solid rgba(0,0,0,.4); }
#editor .mats button.si { border-color: #ffdf8a; background: rgba(255,223,138,.18); }
#editor .botones { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 10px; }
#editor .guardar { grid-column: span 2; font-weight: 600; letter-spacing: .08em; }
#editor .guardar.sucio { background: rgba(255,195,90,.25); border-color: #ffc35a; }
#editor .estado { margin-top: 8px; min-height: 34px; font-size: 12px; opacity: .85; }
#editor .estado.error { color: #ff9b8a; opacity: 1; }
#editor .donde { font-size: 12px; opacity: .7; margin-top: 2px; font-variant-numeric: tabular-nums; }
#editor .ayuda { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.12); font-size: 11.5px; opacity: .7; line-height: 1.5; }
#editor kbd { border: 1px solid rgba(242,236,220,.4); border-radius: 3px; padding: 0 4px; font: inherit; font-size: 11px; }
#editor .mods .lib { display: grid; gap: 4px; max-height: 190px; overflow: auto; margin: 4px 0 6px; }
#editor .mods .lib button { text-align: left; display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
#editor .mods .lib button small { opacity: .6; flex: none; }
#editor .mods .lib button.si { border-color: #ffd36a; background: rgba(255,211,106,.2); }
#editor .mods .vacia { font-size: 12px; opacity: .65; margin: 4px 0 6px; }
#editor .mods .imp { display: flex; align-items: center; gap: 8px; font-size: 11.5px; opacity: .9; }
#editor .mods .imp span { opacity: .7; }
#editor .mods .ficha { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.12); }
#editor .mods .ficha .titulo { font-size: 12px; opacity: .9; margin-bottom: 2px; word-break: break-all; }
#editor .mods label { display: flex; gap: 7px; align-items: center; font-size: 12px; margin: 6px 0; cursor: pointer; }
#editor .mods .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 6px; }
#editor .mods .teclas-mod { margin-top: 8px; font-size: 11.5px; opacity: .7; line-height: 1.55; }
body.arrastrando::after { content: 'Suelta el .glb para añadirlo'; position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(12,14,10,.55); color: #ffd36a; font: 600 20px Bahnschrift, sans-serif; letter-spacing: .12em; pointer-events: none; z-index: 9; }
`;
  document.head.appendChild(css);
  const boton = document.createElement('button');
  boton.id = 'editor-boton';
  boton.innerHTML = 'EDITAR<kbd>E</kbd>';
  document.body.appendChild(boton);
  const panel = document.createElement('div');
  panel.id = 'editor';
  panel.innerHTML = `
    <div class="cab"><b>EDITOR</b><button data-a="salir">Salir · E</button></div>
    <div class="herr">${HERRAMIENTAS.map((t) => `<button data-h="${t.id}"><i>${t.tecla}</i>${t.nombre}</button>`).join('')}</div>
    <div class="fila" data-para="radio"><span>Tamaño</span><input type="range" min="1" max="100" step="0.5" data-v="radio"><span></span></div>
    <div class="fila" data-para="fuerza"><span>Fuerza</span><input type="range" min="0.05" max="2" step="0.05" data-v="fuerza"><span></span></div>
    <div class="fila" data-para="roca"><span>Roca</span><input type="range" min="0.2" max="4" step="0.1" data-v="roca"><span></span></div>
    <div class="mats">${R.MATERIALES.map((M) => `<button data-m="${M.id}"><b style="background:${M.color == null ? 'repeating-linear-gradient(45deg,#777 0 3px,#bbb 3px 6px)' : hex(M.color)}"></b>${M.nombre}</button>`).join('')}</div>
    <div class="mods">
      <div class="lib"></div>
      <div class="imp"><button data-a="importar">Importar .glb…</button><span>o arrástralo a la ventana</span></div>
      <input type="file" accept=".glb" multiple hidden>
      <div class="ficha">
        <div class="titulo"></div>
        <div class="fila"><span>Giro</span><input type="range" min="0" max="360" step="1" data-mp="giro"><span></span></div>
        <div class="fila"><span>Escala</span><input type="range" min="-5" max="5" step="0.01" data-mp="escala"><span></span></div>
        <div class="fila" data-solo-sel><span>Altura</span><input type="range" min="-20" max="40" step="0.05" data-mp="y"><span></span></div>
        <label><input type="checkbox" data-mp="solido"> Sólido: choca y no deja hierba debajo</label>
        <div class="dos" data-solo-sel><button data-a="duplicar">Duplicar al lado</button><button data-a="borrarModelo">Borrar</button></div>
      </div>
      <div class="teclas-mod"><kbd>clic</kbd> pone el de la mano, o elige uno puesto · <kbd>arrastrar</kbd> lo mueve · <kbd>R</kbd> / <kbd>Mayús</kbd>+<kbd>R</kbd> gira 15° · <kbd>[</kbd> <kbd>]</kbd> escala · <kbd>Ctrl+D</kbd> duplica al lado · <kbd>Supr</kbd> borra · <kbd>Esc</kbd> suelta</div>
    </div>
    <div class="donde"></div>
    <div class="botones">
      <button data-a="deshacer">↶ Deshacer</button><button data-a="rehacer">↷ Rehacer</button>
      <button class="guardar" data-a="guardar">GUARDAR · Ctrl+S</button>
      <button data-a="18">Poner al 18 aquí</button><button data-a="borrar">Borrar todo</button>
    </div>
    <div class="estado"></div>
    <div class="ayuda"><kbd>clic izq.</kbd> usar (<kbd>Ctrl</kbd>+clic: Subir baja y Bajar sube) · <kbd>clic der.</kbd> arrastrar: girar · <kbd>rueda</kbd> acercar ·
      <kbd>rueda pulsada</kbd> o <kbd>Mayús</kbd>+<kbd>der.</kbd>: mover · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> mover ·
      <kbd>[</kbd> <kbd>]</kbd> tamaño · <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd> · <kbd>M</kbd> mapa (clic = ir allí)</div>`;
  document.body.appendChild(panel);
  const $ = (s) => panel.querySelector(s);
  let textoAviso = '', errorAviso = false;
  function aviso(t, error = false) { textoAviso = t; errorAviso = error; pintarPanel(); }
  function pintarPanel() {
    panel.querySelectorAll('[data-h]').forEach((b) => b.classList.toggle('si', b.dataset.h === S.herramienta));
    panel.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('si', Number(b.dataset.m) === S.material));
    for (const k of ['radio', 'fuerza', 'roca']) {
      const fila = panel.querySelector(`[data-para=${k}]`), inp = fila.querySelector('input');
      if (document.activeElement !== inp) inp.value = S[k];
      fila.lastElementChild.textContent = k === 'fuerza' ? Math.round(S.fuerza * 100) + ' %' : S[k].toFixed(1) + ' m';
    }
    const h = S.herramienta;
    panel.querySelector('[data-para=radio]').style.display = h === 'rocas' || h === 'modelos' ? 'none' : '';
    panel.querySelector('[data-para=fuerza]').style.display = ['subir', 'bajar', 'allanar', 'suavizar'].includes(h) ? '' : 'none';
    panel.querySelector('[data-para=roca]').style.display = h === 'rocas' ? '' : 'none';
    $('.mats').style.display = h === 'pintar' ? '' : 'none';
    pintarModelos();
    $('[data-a=deshacer]').disabled = !historia.length;
    $('[data-a=rehacer]').disabled = !rehechos.length;
    const g = $('.guardar');
    g.classList.toggle('sucio', S.sucio);
    g.textContent = S.sucio ? 'GUARDAR · Ctrl+S  (sin guardar)' : 'Guardado · Ctrl+S';
    const est = $('.estado');
    est.textContent = textoAviso;
    est.classList.toggle('error', errorAviso);
  }
  const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function pintarModelos() {
    const vis = S.herramienta === 'modelos';
    $('.mods').style.display = vis ? '' : 'none';
    if (!vis) return;
    const lib = $('.mods .lib'), clave = JSON.stringify([S.biblioteca, S.armado]);
    if (lib.dataset.clave !== clave) {
      lib.dataset.clave = clave;
      lib.innerHTML = S.biblioteca.length
        ? S.biblioteca.map((b) => `<button data-lib="${escHtml(b.archivo)}" class="${b.archivo === S.armado ? 'si' : ''}"><span>${escHtml(b.archivo.replace(/\.glb$/i, ''))}</span><small>${mb(b.bytes)}</small></button>`).join('')
        : '<div class="vacia">Aún no hay modelos en la biblioteca: importa un .glb.</div>';
    }
    const m = S.sel, ficha = $('.mods .ficha');
    ficha.style.display = m || S.armado ? '' : 'none';
    if (!m && !S.armado) return;
    const archivo = m ? m.archivo : S.armado, P = yaCargado(archivo);
    const giro = m ? m.giro : S.giroM, escala = m ? m.escala : S.escalaM, solido = m ? m.solido : S.solidoM;
    $('.mods .titulo').textContent = (m ? 'Elegido: ' : 'En la mano: ') + archivo.replace(/\.glb$/i, '') + (P && !P.error ? ' · ' + medidas(P, escala) : '');
    const pon = (k, v, txt) => { const inp = ficha.querySelector(`[data-mp=${k}]`); if (document.activeElement !== inp) inp.value = v; inp.parentElement.lastElementChild.textContent = txt; };
    pon('giro', Math.round((giro * 180) / Math.PI), Math.round((giro * 180) / Math.PI) + '°');
    pon('escala', Math.log2(escala), '×' + escala.toFixed(escala < 1 ? 2 : 1).replace('.', ','));
    if (m) pon('y', m.y, (m.y >= 0 ? '+' : '') + m.y.toFixed(1).replace('.', ',') + ' m');
    ficha.querySelectorAll('[data-solo-sel]').forEach((el) => { el.style.display = m ? '' : 'none'; });
    ficha.querySelector('[data-mp=solido]').checked = solido;
  }
  const archivoEnt = panel.querySelector('input[type=file]');
  archivoEnt.addEventListener('change', () => { const fs = [...archivoEnt.files]; archivoEnt.value = ''; if (fs.length) importar(fs); });
  // los deslizadores del modelo: al moverlos cambia en vivo; al soltarlos queda un paso para deshacer
  panel.addEventListener('input', (e) => {
    const k = e.target.dataset.mp;
    if (!k || k === 'solido') return;
    const v = Number(e.target.value), val = k === 'giro' ? (v * Math.PI) / 180 : k === 'escala' ? Math.pow(2, v) : v;
    if (S.sel) {
      if (!S.fotoDesliz) S.fotoDesliz = foto(S.sel);
      S.sel[k] = val;
      modelos.colocar(S.sel, false);
    } else if (S.armado && k !== 'y') S[k === 'giro' ? 'giroM' : 'escalaM'] = val;
    pintarPanel();
  });
  panel.addEventListener('change', (e) => {
    const k = e.target.dataset.mp;
    if (!k) return;
    if (k === 'solido') {
      const v = e.target.checked;
      if (S.sel) cambiarSel((m) => { m.solido = v; }); else S.solidoM = v;
      pintarPanel();
      return;
    }
    if (S.sel && S.fotoDesliz) {
      const antes = S.fotoDesliz;
      S.fotoDesliz = null;
      modelos.colocar(S.sel);
      registrarModelos([{ m: S.sel, antes, despues: foto(S.sel) }]);
    }
  });
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.h) S.herramienta = b.dataset.h;
    if (b.dataset.m) S.material = Number(b.dataset.m);
    if (b.dataset.lib) armar(b.dataset.lib);
    const a = b.dataset.a;
    if (a === 'importar') archivoEnt.click();
    if (a === 'duplicar') duplicar();
    if (a === 'borrarModelo') cambiarSel((m) => { m.quitado = true; }, 'Borrado (Ctrl+Z lo devuelve)');
    if (a === 'salir') salir();
    if (a === 'deshacer') deshacer(true);
    if (a === 'rehacer') deshacer(false);
    if (a === 'guardar') guardar();
    if (a === 'borrar') borrarTodo();
    if (a === '18') poner18();
    b.blur();
    pintarPanel();
  });
  panel.addEventListener('input', (e) => {
    const k = e.target.dataset.v;
    if (k) { S[k] = Number(e.target.value); pintarPanel(); }
  });
  // que las teclas del panel (flechas en un deslizador) no muevan la camara
  panel.addEventListener('keydown', (e) => e.stopPropagation());
  boton.addEventListener('click', () => { entrar(); boton.blur(); });

  // ---------------- entrar y salir ----------------
  function entrar() {
    if (S.activo) return;
    const { heroe, C, cam } = enlaces;
    S.activo = true;
    document.body.classList.add('editando');
    if (document.pointerLockElement) document.exitPointerLock();
    S.obj.copy(heroe ? heroe.pos : new THREE.Vector3());
    if (C) S.yaw = C.yaw;
    S.pitch = 0.8;
    S.dist = 45;
    if (cam) { cerca = cam.near; cam.near = 0.3; cam.updateProjectionMatrix(); }
    if (scene.fog) densidad = scene.fog.density;
    S.teclas.clear();
    cargarBiblioteca();
    aviso(S.sucio ? 'Hay cambios sin guardar' : 'Clic izquierdo en el suelo para usar la herramienta');
  }
  function salir() {
    if (!S.activo) return;
    if (S.trazo) terminar();
    S.activo = false;
    document.body.classList.remove('editando');
    const { C, cam } = enlaces;
    if (cam) { cam.near = cerca; cam.updateProjectionMatrix(); }
    if (scene.fog) scene.fog.density = densidad;
    if (C) C.lista = false;
    S.teclas.clear();
    S.golpe = null;
    S.mover = null;
    modelos.mostrarFantasma(null);
    modelos.marcar(null);
    dibujarPincel();
  }
  let irAl18 = null;
  function poner18() { if (irAl18) irAl18(S.obj.x, S.obj.z); }

  // ---------------- teclado y raton (los llama mundo.js) ----------------
  function tecla(e, abajo) {
    if (!S.activo) {
      if (abajo && e.code === 'KeyE' && !e.ctrlKey) { entrar(); return true; }
      return false;
    }
    const c = e.code;
    if (!abajo) { S.teclas.delete(c); return /^(Key[WASD]|Arrow|Shift)/.test(c); }
    if (e.ctrlKey || e.metaKey) {
      if (c === 'KeyZ') { deshacer(!e.shiftKey); return true; }
      if (c === 'KeyY') { deshacer(false); return true; }
      if (c === 'KeyS') { guardar(); return true; }
      if (c === 'KeyD' && S.herramienta === 'modelos') { duplicar(); return true; }
      return false;
    }
    if (S.herramienta === 'modelos') {
      if (c === 'Escape' && (S.armado || S.sel)) { if (S.armado) S.armado = null; else S.sel = null; aviso(''); return true; }
      if (c === 'KeyR') { girarModelo(e.shiftKey ? -1 : 1); return true; }
      if (['BracketLeft', 'BracketRight', 'Minus', 'Equal', 'NumpadSubtract', 'NumpadAdd'].includes(c)) { escalarModelo(['BracketRight', 'Equal', 'NumpadAdd'].includes(c) ? 1.1 : 1 / 1.1); return true; }
      if ((c === 'Delete' || c === 'Backspace') && S.sel) { cambiarSel((m) => { m.quitado = true; }, 'Borrado (Ctrl+Z lo devuelve)'); return true; }
    }
    if (c === 'KeyE' || c === 'Escape') { salir(); return true; }
    const h = HERRAMIENTAS.find((t) => 'Digit' + t.tecla === c || 'Numpad' + t.tecla === c);
    if (h) { S.herramienta = h.id; pintarPanel(); return true; }
    if (c === 'BracketLeft' || c === 'BracketRight' || c === 'Minus' || c === 'Equal' || c === 'NumpadSubtract' || c === 'NumpadAdd') {
      const mas = c === 'BracketRight' || c === 'Equal' || c === 'NumpadAdd';
      if (S.herramienta === 'rocas') S.roca = Math.max(0.2, Math.min(4, +(S.roca * (mas ? 1.2 : 1 / 1.2)).toFixed(1)));
      else S.radio = Math.max(1, Math.min(100, +(S.radio * (mas ? 1.2 : 1 / 1.2)).toFixed(1)));
      pintarPanel();
      return true;
    }
    if (/^(Key[WASDQ]|Arrow|Shift|Space|Digit)/.test(c)) { S.teclas.add(c); return true; }
    return c !== 'KeyH' && c !== 'KeyM';
  }
  let arrastre = null;
  function raton(tipo, e) {
    if (!S.activo) return false;
    const cv = enlaces.canvas;
    if (tipo === 'menu') return true;
    if (tipo === 'rueda') {
      // (por lo que mide el giro: una muesca son 100; un panel tactil manda muchos pequenos)
      const muescas = Math.max(-5, Math.min(5, e.deltaY / (e.deltaMode === 1 ? 3 : 100)));
      S.dist = Math.max(4, Math.min(700, S.dist * Math.pow(1.12, muescas)));
      return true;
    }
    if (tipo === 'abajo') {
      S.raton = { x: e.clientX, y: e.clientY, dentro: true };
      if (cv && e.pointerId != null) try { cv.setPointerCapture(e.pointerId); } catch { /* */ }
      if (e.button === 0 && S.herramienta === 'modelos') clicModelo();
      else if (e.button === 0) {
        S.invertir = e.ctrlKey || e.metaKey;                     // Ctrl + clic: Subir baja y Bajar sube
        S.golpe = tocar();
        if (S.golpe) { empezar(); cadencia = 0; }
      } else {
        arrastre = { x: e.clientX, y: e.clientY, mover: e.button === 1 || e.shiftKey };
      }
      return true;
    }
    if (tipo === 'mueve') {
      S.raton = { x: e.clientX, y: e.clientY, dentro: !cv || e.target === cv };
      if (arrastre) {
        const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
        arrastre.x = e.clientX; arrastre.y = e.clientY;
        if (arrastre.mover) {
          // arrastrar el suelo: el punto se mueve al reves que el raton, a la escala de la distancia
          const k = S.dist * 0.0016, sy = Math.sin(S.yaw), cy = Math.cos(S.yaw);
          S.obj.x -= (dx * cy + dy * sy) * k;
          S.obj.z -= (-dx * sy + dy * cy) * k;
        } else {
          S.yaw -= dx * 0.005;
          S.pitch = Math.max(0.12, Math.min(1.52, S.pitch + dy * 0.004));
        }
      }
      return true;
    }
    if (tipo === 'arriba') {
      if (e.button === 0) { if (S.mover) soltarModelo(); else terminar(); }
      else arrastre = null;
      return true;
    }
    return false;
  }

  // ---------------- cada fotograma (desde mundo.actualizar) ----------------
  let cadencia = 0;
  const _v = new THREE.Vector3();
  function paso(dt) {
    // mover el punto con WASD (relativo a donde mira la camara)
    const t = (...c) => c.some((k) => S.teclas.has(k));
    const ax = (t('KeyD', 'ArrowRight') ? 1 : 0) - (t('KeyA', 'ArrowLeft') ? 1 : 0), az = (t('KeyS', 'ArrowDown') ? 1 : 0) - (t('KeyW', 'ArrowUp') ? 1 : 0);
    if (ax || az) {
      const v = (8 + S.dist * 1.1) * (t('ShiftLeft', 'ShiftRight') ? 3 : 1) * dt, sy = Math.sin(S.yaw), cy = Math.cos(S.yaw);
      S.obj.x += (ax * cy + az * sy) * v;
      S.obj.z += (-ax * sy + az * cy) * v;
    }
    S.obj.x = Math.max(-R.EXT, Math.min(R.EXT, S.obj.x));
    S.obj.z = Math.max(-R.EXT, Math.min(R.EXT, S.obj.z));
    const y = R.altura(S.obj.x, S.obj.z);
    S.obj.y += (y - S.obj.y) * Math.min(1, 8 * dt);
    // la camara
    const cam = enlaces.cam;
    if (cam) {
      const cp = Math.cos(S.pitch);
      cam.position.set(S.obj.x + Math.sin(S.yaw) * cp * S.dist, S.obj.y + Math.sin(S.pitch) * S.dist, S.obj.z + Math.cos(S.yaw) * cp * S.dist);
      const suelo = R.altura(cam.position.x, cam.position.z) + 1;
      if (cam.position.y < suelo) cam.position.y = suelo;
      cam.lookAt(S.obj);
      cam.updateMatrixWorld();
      // la bruma, mas fina cuanto mas lejos esta la camara (desde arriba se ve el mapa entero)
      if (scene.fog) scene.fog.density = densidad * Math.max(0.12, Math.min(1, 70 / S.dist));
    }
    // el pincel: donde toca el raton y, con el boton pulsado, aplicarlo (a 30 por segundo como mucho)
    S.golpe = tocar() || (S.trazo ? S.golpe : null);
    cadencia += dt;
    // (con mas de 50 m de radio un paso cuesta 10-15 ms: a 15 por segundo, que lo que sube por segundo es lo mismo)
    if (S.trazo && cadencia >= (S.radio > 50 ? 1 / 15 : 1 / 30)) { aplicarPincel(Math.min(0.12, cadencia)); cadencia = 0; }
    if (S.herramienta === 'modelos') {
      // arrastrando el elegido: sigue al raton por el suelo
      const M = S.mover;
      if (M && S.golpe) {
        const x = Math.max(-R.EXT + 1, Math.min(R.EXT - 1, S.golpe.x + M.dx)), z = Math.max(-R.EXT + 1, Math.min(R.EXT - 1, S.golpe.z + M.dz));
        if (Math.abs(x - M.m.x) > 0.01 || Math.abs(z - M.m.z) > 0.01) { M.m.x = x; M.m.z = z; modelos.colocar(M.m, false); M.movido = true; }
      }
      modelos.mostrarFantasma(S.armado && S.golpe && S.raton && S.raton.dentro ? { archivo: S.armado, x: S.golpe.x, z: S.golpe.z, giro: S.giroM, escala: S.escalaM } : null);
      modelos.marcar(S.sel);
    } else { modelos.mostrarFantasma(null); modelos.marcar(null); }
    dibujarPincel();
    const d = $('.donde');
    d.textContent = S.golpe ? `${R.zona(S.golpe.x, S.golpe.z)} · ${S.golpe.y.toFixed(1)} m · (${Math.round(S.golpe.x)}, ${Math.round(S.golpe.z)})` + (S.trazo && S.trazo.herr === 'allanar' ? ` → ${S.trazo.cota.toFixed(1)} m` : '') : ' ';
    return _v.copy(S.obj);
  }

  pintarPanel();
  if (E.cargado) aviso(`Cargado lo editado: ${E.cargado.vertices} vértices, ${E.cargado.celdas} celdas pintadas, ${E.cargado.nuevas} rocas puestas, ${E.cargado.quitadas} quitadas, ${E.cargado.modelos} modelos`);
  return {
    get activo() { return S.activo; }, S, historia,
    conectar(e) { Object.assign(enlaces, e); },
    alIr18(fn) { irAl18 = fn; },
    entrar, salir, tecla, raton, paso, guardar, deshacer, borrarTodo,
    irA(x, z) { S.obj.x = x; S.obj.z = z; S.obj.y = R.altura(x, z); },
    importar, armar, cargarBiblioteca, duplicar, girarModelo, escalarModelo,
    elegir(m) { S.sel = m; pintarPanel(); },
    // para probar desde el panel: poner un modelo de la biblioteca en (x, z)
    async ponerModelo(archivo, x, z, op = {}) {
      await plantilla(archivo);
      const m = nuevoModelo({ archivo, x, z, ...op });
      modelos.sincronizar();
      registrarModelos([{ m, antes: { ...foto(m), vivo: false }, despues: foto(m) }]);
      await plantilla(archivo);
      return m;
    },
    // para probar desde el panel: un trazo entero en (x, z) durante `seg` segundos
    trazo(herr, x, z, seg = 0.5, opciones = {}) {
      Object.assign(S, { invertir: false }, opciones, { herramienta: herr });
      S.golpe = { x, z, y: R.altura(x, z) };
      empezar();
      for (let t = 0; t < seg; t += 1 / 30) { S.golpe = { x, z, y: R.altura(x, z) }; aplicarPincel(1 / 30); }
      terminar();
      while (suelo.pintarPendiente(50) > 0);
    },
  };
}
