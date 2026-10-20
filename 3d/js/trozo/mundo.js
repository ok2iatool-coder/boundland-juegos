// EL PRIMER TROZO JUGABLE (?mapa=trozo): 500 x 500 m alrededor de la puerta sur de la Base de refugiados, con los
// supuestos del documento de diseno (https://claude.ai/artifact/MsbdcpFugbutbwjfwFoY6s): un jugador, en el navegador,
// el 18 contesta con gestos. Junta el plano (mapa.js), el terreno, el muro, la Base, la naturaleza, la hierba y la
// gente con la PARTIDA (sim/: economia, recetas, encargos, la obra del pozo, la mision), y pone el dia y la noche, las
// conversaciones, recoger, fabricar, comerciar, dormir y guardar en el frasco. Misma interfaz que los otros mapas mas
// los ganchos de main.js para el teclado (tecla, bloqueado, conectar).
import * as THREE from 'three';
import * as MAPA from './mapa.js';
import { altura, colorSuelo, crearTerreno } from './terreno.js';
import { crearMuro, TORRES, ALTO_TORRE } from './muro.js';
import { crearBase } from './base.js';
import { crearNaturaleza } from './naturaleza.js';
import { crearHierba } from './hierba.js';
import { crearGente } from './gente.js';
import { crearHud, panelMochila, panelMesa, panelTienda, panelTablon, panelObra, panelBaul, panelDiario } from './hud.js';
import * as P from './sim/partida.js';
import { abrir as abrirConversacion, elegir } from './sim/dialogos.js';
import { PERSONAS, RECURSOS, RECETAS, OBJETOS, MIN_JUEGO_POR_SEG, OBRA_POZO } from './sim/datos.js';

const CLAVE = 'boundland-trozo';
export const LADO = 250;
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const col = (h) => new THREE.Color(h);

// lo que se recoge: a cuanto hay que estar de cada sitio
const ALCANCE = { roca: 0.75, arbol: 1.35, tronco: 1.7, juncos: 1.5, flores: 1.3, barro: 1.9 };

export function crearMundo(scene) {
  const grupo = new THREE.Group();
  grupo.name = 'trozo';
  scene.add(grupo);
  const choques = MAPA.obstaculos();
  const t0 = performance.now();

  // ---------------- la partida (o la guardada en el frasco) ----------------
  const params = new URLSearchParams(location.search);
  let p = null, guardado = null;
  try { if (!params.has('nueva')) { const s = localStorage.getItem(CLAVE); if (s) guardado = JSON.parse(s); } } catch { guardado = null; }
  try { p = guardado ? P.deTexto(guardado.partida) : P.empezar(); } catch { p = P.empezar(); guardado = null; }

  // ---------------- la escena ----------------
  const terreno = crearTerreno(grupo);
  const muro = crearMuro(grupo, { altura, choques });
  const base = crearBase(grupo, { altura, choques });
  const nat = crearNaturaleza(grupo, { altura, choques });
  const hierba = crearHierba({ grupo, altura, color: colorSuelo });
  const gente = crearGente(grupo, { altura, choques });
  const hud = crearHud();
  muro.puerta.abrir(!!p.banderas.puertaAbierta, true);

  // ---------------- luz, cielo y niebla (cambian con la hora) ----------------
  scene.background = col(0xb9bd9c);
  scene.fog = new THREE.FogExp2(0xb9bd9c, 0.0042);
  const hemi = new THREE.HemisphereLight(0xf3efd6, 0x55603a, 1.55);
  const sol = new THREE.DirectionalLight(0xffe3b2, 2.7);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { near: 1, far: 220, left: -30, right: 30, top: 30, bottom: -30 });
  sol.shadow.bias = -0.0005;
  sol.shadow.normalBias = 0.04;
  scene.add(hemi, sol, sol.target);
  // los fuegos (hoguera, fuego de fuera, fragua) con su llama y su luz
  const fuegos = [];
  const matLlama = [0xff8a2a, 0xffc35a].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  function fuego(x, z, s, dy = 0.15) {
    const g = new THREE.Group();
    g.position.set(x, altura(x, z) + dy, z);
    const llamas = [];
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.3 * s, 1 * s, 5).translate(0, 0.5 * s, 0), matLlama[k % 2]);
      m.position.set((Math.random() - 0.5) * 0.3 * s, 0, (Math.random() - 0.5) * 0.3 * s);
      g.add(m); llamas.push(m);
    }
    const luz = new THREE.PointLight(0xff9a48, 0, 16 * s, 1.6);
    luz.position.set(0, 0.8 * s, 0);
    g.add(luz);
    grupo.add(g);
    const f = { g, llamas, luz, s };
    fuegos.push(f);
    return f;
  }
  fuego(MAPA.COSAS.hogueraDentro.x, MAPA.COSAS.hogueraDentro.z, 1.1);
  fuego(MAPA.COSAS.fuegoFuera.x, MAPA.COSAS.fuegoFuera.z, 0.9);
  const fragua = fuego(MAPA.COSAS.fragua.x - 0.2, MAPA.COSAS.fragua.z, 0.45, 0.95);
  const luzFrasco = new THREE.PointLight(0xfff1c4, 0.6, 5, 2);
  luzFrasco.position.set(MAPA.COSAS.frasco.x, altura(MAPA.COSAS.frasco.x, MAPA.COSAS.frasco.z) + 0.8, MAPA.COSAS.frasco.z);
  grupo.add(luzFrasco);
  // los focos de las torres: de noche barren la Cuenca (luz y haz)
  const focos = TORRES.map((t, i) => {
    const y = altura(t.x, t.z) + ALTO_TORRE + 1.3;
    const luz = new THREE.SpotLight(0xfff1c4, 0, 260, 0.11, 0.5, 1.2);
    luz.position.set(t.x + Math.sign(t.x) * 0.6, y, t.z + 2.4);
    grupo.add(luz, luz.target);
    const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 16, 1, 16, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true }));
    haz.position.copy(luz.position);
    grupo.add(haz);
    return { luz, haz, i };
  });
  // los colores de cada momento
  const MOMENTOS = {
    dia: { fondo: col(0xb9bd9c), cielo: col(0xf3efd6), suelo: col(0x55603a), hemi: 1.55, sol: col(0xffe3b2), solI: 2.7, niebla: 0.0042 },
    dorado: { fondo: col(0xd2ae86), cielo: col(0xf0d0a8), suelo: col(0x5a4a35), hemi: 1.2, sol: col(0xffb070), solI: 2.1, niebla: 0.005 },
    noche: { fondo: col(0x1b2131), cielo: col(0x50608a), suelo: col(0x161a14), hemi: 0.62, sol: col(0xa9bce6), solI: 0.5, niebla: 0.0062 },
  };
  const LUNA = new THREE.Vector3(-0.35, 0.75, 0.55).normalize();
  const dirLuz = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color();
  let noche = 0;
  function cielo(h) {
    // elevacion del sol: sale a las 6 por el este, a mediodia al sur (+z) y se pone a las 20 por el oeste
    const s = h >= 6 && h <= 20 ? 0.85 * Math.sin(Math.PI * (h - 6) / 14) : -0.3 * Math.sin(Math.PI * ((h < 6 ? h + 24 : h) - 20) / 10);
    noche = 1 - suave(-0.1, 0.04, s);
    const dorado = (1 - suave(0.05, 0.38, s)) * (1 - noche);
    const D = MOMENTOS.dia, G = MOMENTOS.dorado, N = MOMENTOS.noche;
    const mix = (k) => lerp(lerp(D[k], G[k], dorado), N[k], noche);
    const mixC = (k, out) => out.copy(D[k]).lerp(G[k], dorado).lerp(N[k], noche);
    mixC('fondo', scene.background); scene.fog.color.copy(scene.background); scene.fog.density = mix('niebla');
    mixC('cielo', hemi.color); mixC('suelo', hemi.groundColor); hemi.intensity = mix('hemi');
    if (s > -0.02) {
      const phi = Math.PI * Math.max(0, Math.min(1, (h - 6) / 14)), e = Math.asin(Math.max(0.06, s));
      dirLuz.set(Math.cos(phi) * Math.cos(e), Math.sin(e), Math.sin(phi) * Math.cos(e));
      mixC('sol', sol.color); sol.intensity = 2.7 * suave(-0.02, 0.18, s) * (1 - 0.25 * dorado);
    } else {
      dirLuz.copy(LUNA);
      sol.color.copy(N.sol); sol.intensity = N.solI * suave(-0.02, -0.12, s);
    }
    terreno.agua.uCielo.value.copy(scene.background).lerp(_c2.setRGB(1, 1, 1), 0.25 * (1 - noche));
    terreno.agua.uHondo.value.copy(_c.set(0x46564a)).multiplyScalar(1 - 0.6 * noche);
  }

  // ---------------- lo que se puede hacer cerca ----------------
  const C = MAPA.COSAS;
  const USOS = [
    { id: 'tablon', x: C.tablon.x, z: C.tablon.z + 0.6, r: 2.0, texto: () => 'Mirar el tablón de encargos', hacer: () => abrirPanel('tablon') },
    { id: 'obra', x: C.cartelObra.x, z: C.cartelObra.z, r: 2.2, texto: () => p.obra.terminada !== null ? 'El segundo pozo' : 'Aportar a la obra del pozo', hacer: () => abrirPanel('obra') },
    { id: 'obra2', x: C.obra.x, z: C.obra.z, r: 3.2, texto: () => p.obra.terminada !== null ? 'El segundo pozo' : 'Aportar a la obra del pozo', hacer: () => abrirPanel('obra') },
    { id: 'banco', x: C.banco.x, z: C.banco.z + 0.7, r: 1.9, texto: () => 'Usar el banco de trabajo', hacer: () => abrirPanel('mesa', 'banco') },
    { id: 'bancoFuera', x: C.bancoFuera.x, z: C.bancoFuera.z + 0.7, r: 1.9, texto: () => 'Usar el banco de trabajo', hacer: () => abrirPanel('mesa', 'banco') },
    { id: 'carpinteria', x: C.carpinteria.x, z: C.carpinteria.z - 0.7, r: 2.0, texto: () => 'Usar la carpintería', hacer: () => abrirPanel('mesa', 'carpinteria') },
    { id: 'litera', x: C.litera.x, z: C.litera.z + 1.0, r: 1.9, texto: () => (p.litera ? (P.puedeDormir(p).ok ? 'Dormir hasta las 6:00' : 'Tu litera (se duerme de 20:00 a 6:00)') : 'Una litera (hay que registrarse en la Intendencia)'), hacer: dormir },
    { id: 'baul', x: C.baul.x, z: C.baul.z + 0.8, r: 1.6, texto: () => (p.litera ? 'Abrir el baúl' : 'Un baúl (de quien tenga litera)'), hacer: () => (p.litera ? abrirPanel('baul') : hud.aviso('El baúl es de quien tiene litera', 'aviso')) },
    { id: 'frasco', x: C.frasco.x, z: C.frasco.z + 0.6, r: 1.7, texto: () => 'Guardar la partida en el frasco', hacer: guardar },
  ];
  function quePuedoHacer(pos) {
    // 1) una persona con nombre; 2) una cosa; 3) algo que se recoge; 4) el agua del arroyo
    const f = gente.cercana(pos.x, pos.z, 2.5);
    if (f) return { tipo: 'hablar', f, texto: `<kbd>E</kbd>Hablar con ${PERSONAS[f.id].nombre}` };
    let mejor = null;
    for (const u of USOS) {
      const d = Math.hypot(u.x - pos.x, u.z - pos.z);
      if (d < u.r && (!mejor || d < mejor.d)) mejor = { d, u };
    }
    if (mejor) return { tipo: 'usar', u: mejor.u, texto: `<kbd>E</kbd>${mejor.u.texto()}` };
    let rec = null;
    for (const o of MAPA.RECOGIDA) {
      const d = Math.hypot(o.x - pos.x, o.z - pos.z) - ALCANCE[o.tipo] * o.tam;
      if (d < 0.5 && (!rec || d < rec.d)) rec = { d, o };
    }
    if (rec) {
      const o = rec.o, R = RECURSOS[o.tipo], q = P.quedanEn(p, o.id, o.tipo);
      const v = P.puedeRecoger(p, o.id, o.tipo);
      const que = OBJETOS[R.da].nombre.toLowerCase();
      if (!q) return { tipo: 'nada', texto: `Aquí ya no queda ${que}` };
      return { tipo: 'recoger', sitio: o.id, recurso: o.tipo, seg: v.seg, ok: v.ok, msg: v.msg, texto: `<kbd>E</kbd>Mantén · ${R.verbo} ${que} <span style="opacity:.6">(${q})${v.conHerr ? '' : R.herramienta ? ' · más rápido con ' + OBJETOS[R.herramienta].nombre.toLowerCase() : ''}</span>` };
    }
    if (pos.z > 100 && MAPA.distArroyo(pos.x, pos.z) < MAPA.ARROYO.ancho + 1.3) {
      const v = P.puedeRecoger(p, 'arroyo', 'agua');
      return { tipo: 'recoger', sitio: 'arroyo', recurso: 'agua', seg: v.seg, ok: v.ok, msg: v.msg, texto: `<kbd>E</kbd>Mantén · Llenar el cubo de agua${v.ok ? '' : ` <span style="opacity:.6">(${v.msg.toLowerCase()})</span>`}` };
    }
    return null;
  }

  // ---------------- conversaciones ----------------
  let conv = null;
  const ui = {
    puerta: (v) => muro.puerta.abrir(v),
    abrir: (tipo, dato) => { cerrarConversacion(); abrirPanel(tipo, dato); },
  };
  function hablar(f) {
    conv = { f, quien: f.id, nodo: abrirConversacion(p, f.id) };
    f.hablando = true;
    soltarRaton();
    hud.dialogo(conv.nodo, PERSONAS[f.id]);
  }
  function cerrarConversacion() {
    if (!conv) return;
    conv.f.hablando = false;
    conv = null;
    hud.dialogo(null);
  }
  function elegirOpcion(i) {
    if (!conv) return;
    const o = conv.nodo.opciones.find((x) => x.i === i);
    if (!o) return;
    if (o.g && enlaces.gesto) enlaces.gesto(o.g);
    const quien = conv.quien;
    const sig = elegir(p, quien, conv.nodo.id, i, ui);
    if (!conv) return;                       // la opcion abrio un panel
    if (sig) { conv.nodo = sig; hud.dialogo(sig, PERSONAS[quien]); } else cerrarConversacion();
  }
  hud.alElegir = elegirOpcion;

  // ---------------- paneles ----------------
  let trabajo = null, confirmarNueva = false;
  function pintarPanel() {
    const a = hud.panelAbierto;
    if (!a) return;
    const html = a.tipo === 'mochila' ? panelMochila(p) : a.tipo === 'mesa' ? panelMesa(p, a.dato, trabajo && trabajo.receta) : a.tipo === 'tienda' ? panelTienda(p)
      : a.tipo === 'tablon' ? panelTablon(p) : a.tipo === 'obra' ? panelObra(p) : a.tipo === 'baul' ? panelBaul(p) : panelDiario(p);
    hud.panel(html);
  }
  function abrirPanel(tipo, dato = null) {
    hud.panelAbierto = { tipo, dato };
    confirmarNueva = false;
    soltarRaton();
    pintarPanel();
  }
  function cerrarPanel() { if (trabajo) return; hud.panel(null); }
  function falla(v) { if (v && v.ok === false && v.msg) hud.aviso(v.msg, 'aviso'); }
  hud.alAccion = (a) => {
    const [tipo, dato] = a.split(':');
    const n = Number(dato);
    if (tipo === 'fabricar') {
      const r = RECETAS.find((x) => x.id === dato), v = P.puedeFabricar(p, dato, hud.panelAbierto.dato);
      if (!v.ok) falla(v); else { trabajo = { receta: dato, mesa: hud.panelAbierto.dato, t: 0, total: r.seg }; if (enlaces.gesto) enlaces.gesto(4); }
    } else if (tipo === 'comprar') falla(P.comprar(p, dato, 1));
    else if (tipo === 'vender') falla(P.vender(p, dato, 1));
    else if (tipo === 'vender5') falla(P.vender(p, dato, 5));
    else if (tipo === 'aceptar') falla(P.aceptar(p, n));
    else if (tipo === 'entregar') falla(P.entregar(p, n));
    else if (tipo === 'aportar') falla(dato.startsWith('vales') ? P.aportar(p, 'vales', Number(dato.slice(5))) : P.aportar(p, dato, 99));
    else if (tipo === 'guardar') falla(P.guardar(p, dato, 1));
    else if (tipo === 'guardarTodo') falla(P.guardar(p, dato, 999));
    else if (tipo === 'sacar') falla(P.sacar(p, dato, 1));
    else if (tipo === 'sacarTodo') falla(P.sacar(p, dato, 999));
    else if (tipo === 'nueva') {
      if (!confirmarNueva) { confirmarNueva = true; hud.aviso('Pulsa otra vez «Empezar de nuevo» para borrar la partida', 'aviso'); return; }
      try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
      location.search = '?mapa=trozo&nueva';
      return;
    }
    pintarPanel();
  };

  // ---------------- dormir y guardar ----------------
  let fundido = null;
  function dormir() {
    const v = P.puedeDormir(p);
    if (!v.ok) { falla(v); return; }
    fundido = { t: 0, hecho: false };
    hud.fundido(1);
  }
  function guardar(aviso = true) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ partida: P.aTexto(p), heroe: enlaces.heroe ? { x: enlaces.heroe.pos.x, z: enlaces.heroe.pos.z, giro: enlaces.heroe.giro } : null, cuando: Date.now() }));
      if (aviso) hud.aviso('Partida guardada en el frasco', 'diario');
    } catch { hud.aviso('No se pudo guardar (el navegador no deja)', 'aviso'); }
  }

  // ---------------- teclado (lo llama main.js antes que lo suyo) ----------------
  const enlaces = { heroe: null, gesto: null };
  let eSostenida = false, recoger = null, candidato = null;
  function soltarRaton() { if (document.pointerLockElement) document.exitPointerLock(); }
  function tecla(e, abajo) {
    const k = e.code;
    if (!abajo) { if (k === 'KeyE') { eSostenida = false; recoger = null; } return false; }
    if (fundido) return true;
    if (conv) {
      if (/^Digit[1-4]$/.test(k)) { const g = Number(k.slice(5)), o = conv.nodo.opciones.find((x) => x.g === g); if (o) elegirOpcion(o.i); return true; }
      if (k === 'KeyE' || k === 'Enter' || k === 'Space') {
        const o = conv.nodo.opciones.find((x) => x.g === 0) || (conv.nodo.opciones.length === 1 ? conv.nodo.opciones[0] : null);
        if (o) elegirOpcion(o.i);
        return true;
      }
      if (k === 'Escape') { cerrarConversacion(); return true; }
      return /^(Key[WASD]|Arrow)/.test(k) ? true : false;
    }
    if (hud.panelAbierto) {
      const t = hud.panelAbierto.tipo;
      if (k === 'Escape' || k === 'KeyE' || (k === 'KeyI' && t === 'mochila') || (k === 'Tab' && t === 'mochila') || (k === 'KeyJ' && t === 'diario')) { cerrarPanel(); return true; }
      return /^(Key[WASDIJ]|Arrow|Space|Tab)/.test(k);
    }
    if (k === 'KeyI' || k === 'Tab') { abrirPanel('mochila'); return true; }
    if (k === 'KeyJ') { abrirPanel('diario'); return true; }
    if (k === 'KeyE') {
      eSostenida = true;
      const c = candidato;
      if (!c) return true;
      if (c.tipo === 'hablar') hablar(c.f);
      else if (c.tipo === 'usar') c.u.hacer();
      else if (c.tipo === 'recoger') { if (!c.ok) falla(c); else recoger = { sitio: c.sitio, recurso: c.recurso, t: 0 }; }
      return true;
    }
    return false;
  }
  const bloqueado = () => !!conv || !!hud.panelAbierto || !!fundido;

  // ---------------- el objetivo de ahora ----------------
  function objetivos() {
    const B = p.banderas, L = [];
    const m = B.mision;
    if (!m) L.push('Sube por el camino hasta la <b>puerta de la Base</b> y habla con el guardia');
    else if (m === 'piedras') L.push(`Lleva <b>10 piedras</b> a Ramiro (${Math.min(10, P.enMochila(p, 'piedra'))}/10) · rocas grises de la Cuenca, al sur`);
    else if (m === 'registro') L.push('Busca a <b>Elena</b> en la Intendencia, al fondo de la plaza');
    else if (m === 'herrera') L.push('Habla con <b>Nieves</b>, la herrera, al este de la plaza');
    else if (m === 'pozo') {
      if (B.pozoAvisar) L.push('El segundo pozo está terminado: habla con <b>Elena</b>');
      else if (p.obra.empezada !== null) L.push('El segundo pozo ya está en obra: vuelve en unas horas');
      else {
        const f = P.obraPide(p), partes = [];
        if (f.piedra > 0) partes.push(`${f.piedra} piedras`);
        if (f.tablon > 0) partes.push(`${f.tablon} tablones`);
        if (f.cuerda > 0) partes.push(`${f.cuerda} cuerdas`);
        const v = Math.max(0, Math.ceil(OBRA_POZO.vales - p.obra.vales));
        L.push(`Ayuda a levantar el <b>segundo pozo</b>: ${partes.length ? 'faltan ' + partes.join(', ') : 'ya tiene el material'}${v ? ` y ${v} vales` : ''}`);
      }
    } else if (m === 'hecha') L.push('Fin del primer trozo. La Base sigue: encargos, el puesto, la gente…');
    if (B.liaHierbas === 'pedido') L.push(`Lleva <b>3 hierbas</b> (flores blancas del arroyo) a Amparo, la curandera (${Math.min(3, P.enMochila(p, 'hierbas'))}/3)`);
    else if (B.liaHierbas === 'hecho' && !B.liaDibujo) L.push('Dile a <b>Lía</b> que su madre se pondrá bien');
    const aceptados = P.encargosAbiertos(p).filter((e) => e.aceptado);
    for (const e of aceptados.slice(0, 2)) L.push(`Encargo: ${e.cant - e.entregado} ${OBJETOS[e.item].nombre.toLowerCase()} al tablón`);
    return L;
  }

  // ---------------- el paso de cada fotograma ----------------
  const foco = new THREE.Vector3();
  const DIR_SOMBRA = new THREE.Vector3();
  let cadaNat = 0, cuentaNat = '';
  function quedan(id, tipo) { return P.quedanEn(p, id, tipo); }
  nat.poner(quedan);
  gente.colocar(p);
  base.obra.poner(p.obra);
  let ultimoTiempo = 0;
  function actualizar(t, pos, heroe = null, dt = 0) {
    foco.copy(pos);
    // el tiempo de juego no corre con una conversacion o un panel abiertos
    if (dt > 0 && !bloqueado()) P.avanzar(p, dt * MIN_JUEGO_POR_SEG);
    const h = P.hora(p);
    cielo(h);
    // la sombra sigue al 18 (ajustada a texeles)
    DIR_SOMBRA.copy(dirLuz);
    const texel = (sol.shadow.camera.right - sol.shadow.camera.left) / sol.shadow.mapSize.x;
    const u = Math.round(foco.x / texel) * texel, w = Math.round(foco.z / texel) * texel;
    sol.target.position.set(u, foco.y, w);
    sol.position.set(u, foco.y, w).addScaledVector(DIR_SOMBRA, 90);
    // fuegos (de dia, brasas) y focos (de noche barren)
    for (const f of fuegos) {
      f.llamas.forEach((m, k) => { m.scale.set(1 + 0.15 * Math.sin(t * 7 + k), (0.75 + 0.35 * Math.sin(t * 9.3 + k * 2.1) + 0.2 * Math.sin(t * 17 + k)) * (0.5 + 0.5 * noche), 1 + 0.15 * Math.cos(t * 6 + k)); m.rotation.y = t * (0.5 + k * 0.3); });
      f.luz.intensity = (f === fragua ? 6 : 14 * noche + 1.5) * f.s * (0.85 + 0.15 * Math.sin(t * 11 + f.s * 7));
    }
    for (const fo of focos) {
      const a = t * 0.17 + fo.i * 2.4;
      fo.luz.target.position.set(Math.sign(fo.luz.position.x) * 30 + 90 * Math.sin(a), 0, 110 + 60 * Math.sin(a * 0.71 + 1));
      fo.luz.intensity = 900 * noche;
      const d = fo.luz.target.position.clone().sub(fo.luz.position);
      fo.haz.scale.set(1, 1, d.length());
      fo.haz.lookAt(fo.luz.target.position);
      fo.haz.material.opacity = 0.045 * noche;
      fo.haz.visible = noche > 0.02;
    }
    luzFrasco.intensity = 0.5 + 0.4 * noche;
    terreno.agua.uTiempo.value = t;
    // la puerta, el tablon, la obra, las huertas
    muro.puerta.abrir(!!p.banderas.puertaAbierta);
    muro.puerta.actualizar(dt);
    base.papeles(Math.min(4, P.encargosAbiertos(p).length));
    base.obra.poner(p.obra);
    base.huertas.crecer(p.obra.terminada !== null ? Math.min(1, (p.t - p.obra.terminada) / (10 * 60)) : 0);
    base.actualizar(t);
    // lo recogido vuelve con el tiempo: se repasa cada poco
    cadaNat -= dt;
    if (cadaNat <= 0) {
      cadaNat = 2;
      const s = MAPA.RECOGIDA.map((o) => P.quedanEn(p, o.id, o.tipo)).join('');
      if (s !== cuentaNat) { cuentaNat = s; nat.poner(quedan); }
    }
    gente.actualizar(t, dt, p, { puertaAbierta: !!p.banderas.puertaAbierta, heroe });
    hierba.actualizar(t, foco, heroe, dt);

    // ---- lo de jugar ----
    if (fundido) {
      fundido.t += dt;
      if (fundido.t > 0.9 && !fundido.hecho) { fundido.hecho = true; P.dormir(p); gente.colocar(p); guardar(false); }
      if (fundido.t > 1.4) { hud.fundido(0); fundido = null; }
    }
    if (trabajo) {
      trabajo.t += dt;
      if (trabajo.t >= trabajo.total) { const v = P.fabricar(p, trabajo.receta, trabajo.mesa); falla(v); trabajo = null; pintarPanel(); }
    }
    candidato = !bloqueado() && heroe ? quePuedoHacer(heroe.pos) : null;
    let progreso = null;
    if (recoger && candidato && candidato.tipo === 'recoger' && candidato.sitio === recoger.sitio && eSostenida && heroe && heroe.vel.length() < 0.15) {
      const v = P.puedeRecoger(p, recoger.sitio, recoger.recurso);
      if (!v.ok) { falla(v); recoger = null; }
      else {
        recoger.t += dt;
        progreso = Math.min(1, recoger.t / v.seg);
        if (recoger.t >= v.seg) {
          recoger.t = 0;
          const r2 = P.recogerUno(p, recoger.sitio, recoger.recurso);
          if (!r2.ok) { falla(r2); recoger = null; } else { nat.poner(quedan); if (enlaces.gesto) enlaces.gesto(4); }
        }
      }
    } else if (recoger && (!candidato || candidato.sitio !== recoger.sitio)) recoger = null;
    hud.accion(candidato ? candidato.texto : '', progreso);
    // avisos de la partida
    for (const ev of p.eventos) hud.aviso(ev.texto, ev.tipo);
    p.eventos.length = 0;
    hud.estado(p, noche > 0.5);
    hud.objetivo(objetivos());
    if (hud.panelAbierto && t - ultimoTiempo > 1) { ultimoTiempo = t; if (!trabajo) pintarPanel(); }
  }

  // ---------------- la salida (o donde se guardo) ----------------
  const camino = MAPA.CAMINOS[0].pts;
  const iSalida = camino.findIndex((q) => q[1] > 74);
  let salida = { x: camino[iSalida][0], z: camino[iSalida][1], giro: Math.PI };
  if (guardado && guardado.heroe) salida = { x: guardado.heroe.x, z: guardado.heroe.z, giro: guardado.heroe.giro || 0 };
  function puntoCamino(tt) {
    const i = Math.max(0, Math.min(camino.length - 2, Math.floor(tt * (camino.length - 1))));
    const a = camino[i], b = camino[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { x: a[0], z: a[1], tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l };
  }
  const B = MAPA.BORDE;
  function limitar(q) { q.x = Math.max(B.x0, Math.min(B.x1, q.x)); q.z = Math.max(B.z0, Math.min(B.z1, q.z)); }
  if (guardado) setTimeout(() => hud.aviso('Partida cargada del frasco', 'diario'), 600);
  else setTimeout(() => hud.aviso('Una ciudad tras un muro. Sube por el camino hacia la puerta.', 'diario'), 900);
  const msCarga = Math.round(performance.now() - t0);

  return {
    LADO, borde: 1e4, limitar, altura, choques, actualizar, salida, puntoCamino, sol,
    titulo: 'LA PUERTA DE LA BASE', lejos: 700, hierba,
    ayuda: `<div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> correr &nbsp; <kbd>Mayús</kbd> andar &nbsp; <kbd>Espacio</kbd> saltar &nbsp; <kbd>E</kbd> hablar · usar · mantener para recoger</div>
      <div><kbd>1</kbd> saludar <kbd>2</kbd> mirar arriba <kbd>3</kbd> respingo <kbd>4</kbd> bajar la cabeza: así contesta el 18</div>
      <div><kbd>I</kbd> mochila &nbsp; <kbd>J</kbd> diario &nbsp; <kbd>Esc</kbd> cerrar &nbsp; ratón: cámara · <kbd>H</kbd> ocultar</div>`,
    tecla, bloqueado,
    conectar(e) { Object.assign(enlaces, e); },
    // para probar desde el panel
    get partida() { return p; }, gente, base, muro, hud, nat, ui,
    get info() { return { msCarga, ...nat.info, ...hierba.info(), personas: gente.personas.length, choques: choques.circulos.length + choques.cajas.length, hora: P.reloj(p) }; },
    hablarCon(id) { const f = gente.personas.find((x) => x.id === id); if (f) hablar(f); return conv && conv.nodo; },
    elegir: elegirOpcion,
    accion: (a) => hud.alAccion(a),
    abrirPanel, cerrarPanel, cerrarConversacion,
    saltarHoras(hh) { P.avanzar(p, hh * 60); gente.colocar(p); },
  };
}
