// Boundland: bucle principal. Une la simulacion pura (sim/) con el dibujo, el sonido, los menus y los hacks.
import { crearPartida, paso, cerrarNota, resolverHack, reaparecer, finIntro, habInicial, NIVELES } from './sim/juego.js';
import { DT, VISTA, J, T } from './sim/constantes.js';
import { ZONAS } from './dibujo/paletas.js';
import { Terreno } from './dibujo/terreno.js';
import { Fondo } from './dibujo/fondos.js';
import { Efectos } from './dibujo/efectos.js';
import { dibujarDecoradoVivo, dibujarDecoradoFondo, dibujarDecoradoFrente, dibujarAsset, lucesDe, dibujarVentanas } from './dibujo/decorado.js';
import { dibujarPrimerPlano } from './dibujo/fondos.js';
import { Luz } from './dibujo/luz.js';
import { Vivo, caidaLosa } from './dibujo/vivo.js';
import { Focos } from './dibujo/focos.js';
import { PolvoLuz } from './dibujo/polvo_luz.js';
import { Haces } from './dibujo/haces.js';
import { siguiente } from './sim/pasos.js';
import { Gancho, dibujarAncla, dibujarMira } from './dibujo/gancho.js';
import { dibujarPuerta, rectoUmbral } from './dibujo/puertas.js';
import { prepararLinde, lindeListo, lindeFondo, dibujarLindeDecorado, dibujarLindeFrente, dibujarEsperaLinde, tablaPodrida } from './dibujo/linde.js';
import { lucesLinde } from './linde/luces.js';
import { EstiloHK } from './dibujo/hk.js';
import { despertar } from './dibujo/despertar.js';   // el estilo de la imagen del despertar (?estilo=hk lo apaga)
import { prepararCiudad, ciudadListo, ciudadFallo, ciudadFondo, dibujarCiudadDecorado, dibujarCiudadFrente, dibujarEsperaCiudad, lucesCiudad, capasCiudad } from './dibujo/ciudad_pintada.js';
import { Prologo } from './prologo/prologo.js';
import { Rotura, grietas as grietasRed } from './dibujo/rotura.js';   // el frasco del 18 que revienta (la intro)
import { bocadillo } from './dibujo/bocadillo.js';
const haces = new Haces();   // el haz de los focos renderizado en Blender (blender/haz/)
const gancho = new Gancho();
import { rgba as rgbaHex, hash } from './dibujo/tinta.js';
import * as A from './dibujo/actores.js';
import * as HUD from './hud.js';
import { Hack1, Hack2, Hack3 } from './hacks.js';
import { Menu } from './menu.js';
import { Sonido } from './sonido.js';
import { anclaCerca } from './sim/jugador.js';
import { caja, circulo as circuloTinta, TINTA } from './dibujo/tinta.js';
import * as ZL from './dibujo/zona_lab.js';
import { MapaCarbon } from './dibujo/mapa_carbon.js';
import { estadoZona } from './sim/zona.js';
import { SALAS as SALAS_LAB } from './sim/zona_lab.js';

const lienzo = document.getElementById('juego');
const hk = new EstiloHK();      // a lo Hollow Knight: el fondo aparte y con su bruma (dibujo/hk.js)
const ctx = lienzo.getContext('2d');
const qs = new URLSearchParams(location.search);
const leer = (k, def) => { try { return { ...def, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

// ---------------------------------------------------------------- la aplicacion
// la partida nueva empieza en la zona conectada del laboratorio (sim/zona_lab.js); ?lineal, en los niveles 1-5 de antes
const INICIO = qs.has('lineal') ? 1 : 'lab';
const app = {
  ajustes: leer('boundland-ajustes', { general: 0.8, musica: 0.8, efectos: 0.8, leng: qs.get('lang') === 'es' ? 'es' : 'en' }),
  progreso: leer('boundland-progreso', { max: 1, nivel: 1 }),
  todos: qs.has('todos'),
  son: new Sonido(),
  modo: 'menu',            // menu | juego
  enJuego: false,          // hay partida debajo (pausa)
  textos() { return HUD.TXT[this.ajustes.leng]; },
  guardarAjustes() { guardar('boundland-ajustes', this.ajustes); },
  empezar(id, sinCartela = false) { cargar(id, true); this.modo = 'juego'; this.enJuego = true; menu.abrir('titulo'); fundido = 1; if (sinCartela) titulo = 9; },
  // (la partida nueva empieza con el prologo, prologo/prologo.js; ?sinprologo, directa a la intro del frasco)
  nuevaPartida() { this.progreso = { max: 1, nivel: INICIO }; guardar('boundland-progreso', this.progreso); try { localStorage.removeItem('boundland-lab'); } catch { /* sin almacenamiento */ } if (qs.has('sinprologo')) this.empezar(INICIO); else empezarPrologo(); },
  alTitulo() { quitarPrologo(); this.modo = 'menu'; this.enJuego = false; menu.abrir('titulo'); menu.t2 = 0; app.son.ambiente('lab'); },
  reanudar() { this.modo = 'juego'; },
  reiniciarControl() { E = reaparecer(E); despuesDeCargar(false); this.modo = 'juego'; },
};
for (const b of ['general', 'musica', 'efectos']) app.son.niveles[b] = app.ajustes[b];
const menu = new Menu(app);

// ---------------------------------------------------------------- entrada
const TECLAS = {
  KeyA: 'izq', ArrowLeft: 'izq', KeyD: 'der', ArrowRight: 'der', KeyW: 'arriba', ArrowUp: 'arriba', KeyS: 'abajo', ArrowDown: 'abajo',
  Space: 'salto', KeyJ: 'ataque', KeyE: 'accion', KeyK: 'lanzar', KeyF: 'zorro', KeyQ: 'curar',
};
const pulsado = {};
let pendiente = {};
let raton = null, ratonMovido = false;
const disp = () => devicePixelRatio || 1;

addEventListener('keydown', (e) => {
  app.son.arrancar();
  if (e.repeat && app.modo !== 'juego') return;
  if (app.modo === 'menu' || (app.modo === 'pausa')) { menu.tecla(e.code); e.preventDefault(); return; }
  // en partida
  if (prologo && !e.repeat && (e.code === 'Escape' || e.code === 'Enter')) { saltarPrologo(); return; }
  if (intro && intro.t > 0.8 && (e.code === 'Escape' || e.code === 'Enter')) { intro.t = 99; return; }
  if (E && E.estado === 'nota') {
    if (!e.repeat && (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space')) cerrarNotaYa();
    e.preventDefault(); return;
  }
  if (E && E.estado === 'hack') { if (e.code === 'Escape') { resolverHack(E, false); hack = null; } return; }
  // el mapa a carboncillo de la zona conectada (M): el 18 se sienta y dibuja lo que ha visto
  if (E && E.zl && !intro && !e.repeat && (e.code === 'KeyM' || (mapa.abierto && (e.code === 'Escape' || e.code === 'KeyE')))) {
    if (mapa.abierto) mapa.abierto = false;
    else if (e.code === 'KeyM' && (E.estado === 'jugando' || E.estado === 'banco')) { mapa.abierto = true; for (const k in pulsado) pulsado[k] = false; app.son.ev({ t: 'nota' }); }
    e.preventDefault(); return;
  }
  if (e.code === 'Escape' && !intro && !cine) { app.modo = 'pausa'; menu.abrir('pausa'); for (const k in pulsado) pulsado[k] = false; return; }
  if (qs.has('debug') && /^Digit\d$/.test(e.code)) { app.empezar(Number(e.code.slice(5)) || 10); return; }
  const n = TECLAS[e.code];
  if (n) { if (!pulsado[n]) pendiente[n] = true; pulsado[n] = true; e.preventDefault(); }
});
addEventListener('keyup', (e) => { const n = TECLAS[e.code]; if (n) pulsado[n] = false; });
lienzo.addEventListener('pointerdown', (e) => {
  app.son.arrancar();
  const x = e.clientX * disp(), y = e.clientY * disp();
  if (app.modo !== 'juego') { menu.raton(x, y, true); return; }
  if (hack) { hack.puntero('baja', x, y); lienzo.setPointerCapture(e.pointerId); return; }
  if (E && E.estado === 'nota') { cerrarNotaYa(); return; }
  const n = e.button === 2 ? 'lanzar' : 'ataque';
  if (!pulsado[n]) pendiente[n] = true; pulsado[n] = true;
});
addEventListener('pointerup', (e) => {
  const x = e.clientX * disp(), y = e.clientY * disp();
  if (hack) hack.puntero('sube', x, y);
  pulsado[e.button === 2 ? 'lanzar' : 'ataque'] = false;
});
lienzo.addEventListener('pointermove', (e) => {
  const x = e.clientX * disp(), y = e.clientY * disp();
  raton = { x, y }; ratonMovido = true;
  if (hack) hack.puntero('mueve', x, y);
  else if (app.modo !== 'juego') menu.raton(x, y, false);
});
lienzo.addEventListener('contextmenu', (e) => e.preventDefault());
lienzo.addEventListener('pointerleave', () => menu.cursor.fuera());
addEventListener('blur', () => { for (const k in pulsado) pulsado[k] = false; if (app.modo === 'juego' && !hack && E && E.estado === 'jugando') { app.modo = 'pausa'; menu.abrir('pausa'); } });

// ---------------------------------------------------------------- estado de la partida
let E, terreno, fondo, zona, luces, luz, vivo, focos, polvoLuz, fx, cam = { x: 0, y: 0, w: VISTA.w, h: VISTA.h };
let rastro = [], titulo = 0, fundido = 0, saliendo = 0, muerte = 0, hack = null, intro = null, cine = null, rotura = null;
// el relevo del 18 de la intro al del juego: 0,3 s en los que el ultimo fotograma de la intro se funde con el jugador
let cierreIntro = null;
let banner = null, cartelaJefe = 0, grieta = 0, notaK = 0, pistaK = 0;
// ?limpio o __dbg.limpio(): sin interfaz; __dbg.zoom(z): acerca la camara (fotos para Steam, boundland/steam/)
let limpio = qs.has('limpio'), zoomVista = 1, primerPlano = true;
let cambio = null;   // el cambio de forma en curso: { t, hacia: 1 al zorro, -1 al 18 } (solo dibujo)
let prologo = null, prologoCambiando = false;   // la animacion de antes de despertar (prologo/prologo.js)

// entrada: el 18 llega por su puerta, montacargas o conducto (sale andando); llegada: viene andando por la
// calle desde el nivel de al lado (sim/pasos.js, paso `continuo`)
let casa3d = null, casa3dCargando = false;
function cargar(id, entrada = false, llegada = null) {
  if (!prologoCambiando) quitarPrologo();
  // ?zorro: la forma zorro (F) desde el principio, para probarla sin llegar al jefe del nivel 11
  // la zona conectada sigue en el ultimo frasco de reserva en el que se descanso (si hay partida guardada)
  const guardada = id === 'lab' && !qs.has('nuevo') ? leerZona() : null;
  E = crearPartida(id, { entrada, llegada, ...(qs.has('zorro') ? { hab: { zorro: true } } : {}), ...(guardada || {}) });
  // El Linde (6) tarda en pintarse: se empieza en un hilo aparte desde el nivel 5
  if (id === 5 || E.nivel.zona === 'linde') prepararLinde();
  // la cabana 3D de El Linde (three.js + el modelo de Meshy): se carga al acercarse, una vez
  if ((id === 5 || E.nivel.zona === 'linde') && !casa3d && !casa3dCargando) { casa3dCargando = true; import('./linde/casa3d.js').then((m) => m.crearCasa3D()).then((c) => { casa3d = c; }).catch((e) => console.error('cabana 3D', e)); }
  // la ciudad (7 y 8) tambien la pinta un hilo aparte (dibujo/ciudad_pintada.js): se empieza desde El Linde
  if (id === 6 || E.nivel.zona === 'ciudad') prepararCiudad();
  despuesDeCargar(true);
  app.progreso.nivel = id;
  if (typeof id === 'number') app.progreso.max = Math.max(app.progreso.max, id);
  guardar('boundland-progreso', app.progreso);
  if (qs.has('nivel') || qs.has('debug')) history.replaceState(null, '', '?nivel=' + id + (qs.has('debug') ? '&debug' : '') + (qs.has('todos') ? '&todos' : '') + (qs.has('zorro') ? '&zorro' : ''));
}
function despuesDeCargar(nuevo) {
  zona = ZONAS[E.nivel.zona];
  terreno = new Terreno(E);
  // los niveles pegados por la calle comparten un fondo pintado para los dos (su mundo comun)
  if (E.nivel.zona === 'ciudad') {
    fondo = ciudadFondo; fondo.E = E;           // la ciudad: su fondo (comun a los dos niveles) lo pinta un hilo aparte
  } else if (E.comun && E.comun.mismaZona) {
    const mu = E.comun;
    fondosComunes[mu.clave] = fondosComunes[mu.clave] || new Fondo({ id: mu.id, nivel: { zona: E.nivel.zona, semilla: mu.semilla }, m: { ancho: mu.ancho, alto: mu.alto }, ruedo: null }, zona);
    fondo = fondosComunes[mu.clave];
  } else if (zona.pintada) {
    fondo = lindeFondo; fondo.E = E;            // El Linde: su fondo lo pinta un hilo aparte (dibujo/linde.js)
  } else {
    if (nuevo || !fondo || fondo.E.id !== E.id) fondo = new Fondo(E, zona);
    fondo.E = E;
  }
  luces = lucesDe(E, zona);
  if (E.nivel.zona === 'linde') luces = luces.concat(lucesLinde(E));   // ventanas, farol, capsulas y claros del dosel
  despertar.ajustarLuces(luces, E.nivel.zona);       // el despertar: ventanas y farolas frias
  luz = new Luz(E, E.nivel.zona, zona);
  focos = new Focos(E, luces);
  polvoLuz = new PolvoLuz(luces, E, haces);
  vivo = new Vivo(E, E.nivel.zona, zona, terreno, luces);
  fx = new Efectos(E.nivel.zona, zona);
  fx.son = app.son;          // los restos que caen suenan al dar contra el suelo
  gancho.vuelo = gancho.vuelta = null;
  rastro = []; saliendo = 0; muerte = 0; hack = null; cine = null; banner = null; cambio = null;
  if (nuevo) titulo = 0;
  intro = E.intro ? { t: 0, roto: false } : null;
  if (intro) A.trocearHoja(S, 'intro');        // (descomprimida fuera del hilo y sin soltarse: ver actores.js)
  centrarCamara(true);
  app.son.ambiente(E.nivel.zona);
}
// Los niveles pegados por la calle: el 18 ya esta en el trozo del siguiente que este nivel lleva al lado, asi
// que se carga el siguiente con el 18 y la camara en el mismo sitio (desplazados lo que dice la costura) y
// la ultima imagen se funde encima un tercio de segundo, que tapa el cambio de fondo y de texturas.
let costura = null;
const fondosComunes = {};
function pasarSinCorte() {
  const c = E.costura, p = E.p;
  const cv = document.createElement('canvas'); cv.width = lienzo.width; cv.height = lienzo.height;
  cv.getContext('2d').drawImage(lienzo, 0, 0);
  const llegada = {};
  for (const k of ['vx', 'vy', 'cara', 'pose', 'tPose', 'enSuelo', 'doble', 'saltando', 'coyote', 'buffer', 'tSalto', 'tAterriza']) llegada[k] = p[k];
  llegada.x = p.x + c.dx; llegada.y = p.y + c.dy;
  const cx0 = cam.x + c.dx, cy0 = cam.y + c.dy, foco = camS.focoY + c.dy, adel = camS.adel;
  // de la calle a la calle, un tercio de segundo; si cambia la zona (la plaza al hospital), casi un segundo:
  // la vista se acostumbra a la penumbra al entrar
  const dur = E.comun && E.comun.mismaZona ? 0.35 : 0.9;
  cargar(c.sig, false, llegada);
  cam.x = cx0; cam.y = cy0; camS.focoY = foco; camS.adel = adel;
  costura = { cv, t: 0, dur };
}
function cerrarNotaYa() { cerrarNota(E); pendiente.accion = false; pulsado.accion = false; }

// ---------------------------------------------------------------- el prologo (prologo/prologo.js)
// La calle del nivel 7 hace de escenario: se carga sin tocar la partida guardada ni el progreso y sin el 18. Al bajar,
// con la pantalla tapada por el corte de la tierra, se cambia por el nivel de la partida nueva (el laboratorio), que
// empieza con su intro; el prologo le lleva el reloj y la camara hasta que sale el 18.
// El laboratorio se carga y se dibuja ANTES, con la pantalla en negro: su primer dibujo pinta las caches (los assets
// a textura por pixel, el terreno, la luz) y tarda ~3 s, que a mitad de la bajada eran 3 s de imagen congelada. Se
// guarda tal cual (`labListo`) y en el cambio se pone sin rehacer nada.
let labListo = null;
const MUNDO = () => ({ E, terreno, fondo, luces, luz, focos, polvoLuz, vivo, fx, zona, intro });
function ponerMundo(m) { ({ E, terreno, fondo, luces, luz, focos, polvoLuz, vivo, fx, zona, intro } = m); }
function empezarPrologo() {
  quitarPrologo();
  prologo = new Prologo(app.son);          // (fase 'preparando': dibujar() pone negro y llama a prepararPrologo)
  prepararCiudad();
  app.modo = 'juego'; app.enJuego = true; menu.abrir('titulo'); fundido = 0; titulo = 99;
}
function prepararPrologo() {
  // el laboratorio (con su intro) y su primer dibujo, en negro, en la camara de la intro, en la de la llegada y mas arriba
  prologoCambiando = true;
  cargar(INICIO, true);
  const W = lienzo.width, H = lienzo.height, u = Math.min(H / VISTA.h, W / VISTA.w), techo = piedraEn(0).techo;
  for (const y of [null, techo - 150, techo - 420]) { centrarCamara(true); if (y !== null) cam.y = y; dibujarMundo(W, H, u); }
  centrarCamara(true);
  prologoCambiando = false;
  labListo = MUNDO();
  // y el escenario: la calle
  E = crearPartida(7, {});
  despuesDeCargar(true);
  prologo.empezar(E, cam.w);
}
function quitarPrologo() { if (prologo) { prologo.parar(); prologo = null; } labListo = null; }
// Esc o Intro: a la partida, con la intro del frasco ya hecha
function saltarPrologo() {
  const enLab = prologo.fase === 'lab', lab = labListo;
  quitarPrologo();
  if (!enLab) { if (lab) { ponerMundo(lab); despuesDelLab(); } else cargar(INICIO, true); }
  if (intro) intro.t = 99;
  fundido = 1;
}
// lo que hace despuesDeCargar al entrar en un nivel, para el laboratorio ya preparado
function despuesDelLab() {
  rastro = []; saliendo = 0; muerte = 0; hack = null; cine = null; banner = null; cambio = null; titulo = 0;
  prologoCambiando = true; centrarCamara(true); prologoCambiando = false;
  app.son.ambiente(E.nivel.zona);
}
function prologoAlLab() {
  if (labListo) { ponerMundo(labListo); labListo = null; despuesDelLab(); }
  else { prologoCambiando = true; cargar(INICIO, true); prologoCambiando = false; }
  prologo.alLab(E, cam, intro, piedraEn(0).techo, cam.w);
}
const datosPrologo = () => ({ fx, cam, w: cam.w, zona });

// ---------------------------------------------------------------- la zona conectada del laboratorio
// el mapa a carboncillo (M), el rotulo de cada parte al entrar y la partida guardada en el ultimo frasco de reserva
const mapa = new MapaCarbon();
let mapaK = 0, areaC = null;
function guardarZona() {
  const z = estadoZona(E), f = E.zl.frascos.find((q) => q.id === E.zl.banco);
  guardar('boundland-lab', { hab: E.hab, hechos: [...E.hechos], notas: [...E.notasLeidas], banco: z.banco, control: f ? { x: f.x, pie: f.pie } : null, eco: z.eco, fragmentos: z.fragmentos, esencia: z.esencia, visto: Array.from(z.visto).join('') });
}
function leerZona() {
  let g = null;
  try { g = JSON.parse(localStorage.getItem('boundland-lab') || 'null'); } catch { g = null; }
  if (!g || !g.control) return null;
  return { hab: g.hab, hechos: g.hechos, notasLeidas: g.notas, control: g.control, sinIntro: true, zl: { banco: g.banco, eco: g.eco, fragmentos: g.fragmentos, esencia: g.esencia, visto: g.visto ? Uint8Array.from(g.visto, Number) : null } };
}
function eventoZona(e) {
  const x = e.x ?? E.p.x, y = e.y ?? E.p.y;
  if (e.t === 'banco') { guardarZona(); app.son.ev({ t: 'control' }); app.son.ev({ t: 'cura' }); fx.polvo(x, y - 40, 10, '#ffe3b8', 20, 40); }
  else if (e.t === 'mota') { app.son.ev({ t: 'dosis' }); fx.polvo(x, y, 6, '#ffeccc', 10, 20); }
  else if (e.t === 'eco_recoge') { app.son.ev({ t: 'cura_esencia' }); fx.polvo(x, y, 14, '#fff1dc', 24, 50); }
  else if (e.t === 'eco_deja') guardarZona();
  else if (e.t === 'fragmento') { app.son.ev({ t: 'habilidad' }); banner = { h: 'fragmento', t: 0 }; }
  else if (e.t === 'palanca') app.son.ev({ t: 'engancha' });
  else if (e.t === 'esclusa_abre') { app.son.ev({ t: 'puerta_abre', tipo: 'esclusa' }); fx.sacudir(0.15); }
  else if (e.t === 'falso') { app.son.ev({ t: 'hunde' }); app.son.ev({ t: 'derrumbe' }); fx.polvo(x, y, 12, zona.polvo, 30, 40); }
  else if (e.t === 'area') areaC = { t: 0, e };
}

// A lo Hollow Knight, cada sala se ve sola: lo que queda fuera de la sala del 18 (la roca de entre salas y lo que
// asoma de las vecinas por una pared fina) se tapa con una sombra de bordes blandos que se desliza a la sala nueva
let velo = null;
function veloSala(s, cx, cy) {
  if (!velo || velo.E !== E) return;
  ctx.save();
  ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s);
  ctx.filter = `blur(${Math.max(2, Math.round(9 * s))}px)`;
  ctx.fillStyle = 'rgba(4,5,8,.86)';
  ctx.beginPath();
  ctx.rect(cx - 600, cy - 600, cam.w + 1200, cam.h + 1200);
  ctx.rect(velo.x0 + 6, velo.y0 + 6, velo.x1 - velo.x0 - 12, velo.y1 - velo.y0 - 12);
  ctx.fill('evenodd');
  ctx.restore();
}

// ---------------------------------------------------------------- camara
// Camara que SIGUE al 18 (pedido del usuario, tras probar la de salas fijas a lo Celeste):
// - en horizontal va detras de el con suavidad y se adelanta un poco hacia donde corre;
// - en vertical, a lo Hollow Knight, se queda a la altura del ultimo suelo y no da tirones en cada salto,
//   pero sigue si trepa, cuelga, flota o se sale de una franja;
// - NUNCA deja al 18 pegado al borde: si se acerca a menos de un margen, la camara le acompana ya;
// - se para en los bordes del nivel; donde arriba hay cielo abierto puede subir hasta 4 casillas mas.
// (Las salas de `niveles.js` y tools/salas.mjs se quedan escritas por si se vuelve a la camara por salas.)
const camS = { focoY: null, adel: 0 };
const MARGEN = { x: 150, arriba: 90, abajo: 70 };
function centrarCamara(ya) {
  const p = E.p, m = E.m;
  const VH = VISTA.h / zoomVista, s = lienzo.height / VH || 1;
  cam.w = (lienzo.width || VISTA.w) / s; cam.h = VH;
  if (prologo && !prologoCambiando && prologo.camara(cam)) return;      // la lleva el prologo
  let fx0 = p.x + p.w / 2, fy0 = p.y + p.h / 2;
  if (cine && E.jefe) { fx0 = E.jefe.x + E.jefe.w / 2; fy0 = E.jefe.y + 40; }
  if (intro) fx0 = E.inicio.x + 120;
  // al acabar la intro la camara no salta del frasco al 18: su foco se desliza (tiende a cero en ~1,5 s)
  else if (camS.trasIntro && !ya) { fx0 += camS.trasIntro; camS.trasIntro *= 0.972; if (Math.abs(camS.trasIntro) < 0.5) camS.trasIntro = 0; }
  // adelanto hacia donde corre (despacio, para que girar no sacuda la camara)
  const meta = cine || intro ? 0 : Math.sign(p.vx) * Math.min(1, Math.abs(p.vx) / J.vel) * cam.w * 0.1;
  camS.adel = ya ? meta : camS.adel + (meta - camS.adel) * 0.03;
  // altura: el ultimo suelo, salvo que se salga de la franja
  const quieto = p.enSuelo || p.trepa || p.cuerda || p.gz || p.muerto || cine;
  if (ya || camS.focoY === null || quieto) camS.focoY = fy0;
  else if (fy0 < camS.focoY - cam.h * 0.25) camS.focoY = fy0 + cam.h * 0.25;
  else if (fy0 > camS.focoY + cam.h * 0.18) camS.focoY = fy0 - cam.h * 0.18;
  let tx = fx0 + camS.adel - cam.w / 2, ty = camS.focoY - cam.h * 0.56;
  // limites del nivel (con cielo abierto se puede subir algo por encima del mapa)
  let cielo = false; for (let i = 0; i < m.w && !cielo; i++) if (m.t[i] === 0) cielo = true;
  const yMin = cielo ? -(E.nivel.camaraArriba ?? 4) * T : 0, yMax = Math.max(yMin, m.alto - cam.h);
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
  if (m.ancho < cam.w) tx = (m.ancho - cam.w) / 2; else tx = lim(tx, 0, m.ancho - cam.w);
  ty = m.alto < cam.h && !cielo ? (m.alto - cam.h) / 2 : lim(ty, yMin, yMax);
  // la zona conectada, a lo Hollow Knight: la camara no se sale de la sala del 18 (no se ve la roca de entre salas)
  // y al cruzar a otra sala se desliza hasta la nueva
  const sl = E.zl && SALAS_LAB.find((q) => q.id === E.zl.sala);
  if (sl) {
    const x0 = sl.x * T, x1 = (sl.x + sl.w) * T, y0 = sl.y * T, y1 = (sl.y + sl.h) * T;
    // la sombra de fuera de la sala (veloSala) se desliza con la camara
    const m = { x0, y0, x1, y1 };
    if (ya || !velo || velo.E !== E) velo = { ...m, E };
    else for (const k of ['x0', 'y0', 'x1', 'y1']) velo[k] += (m[k] - velo[k]) * 0.14;
    tx = x1 - x0 <= cam.w ? (x0 + x1 - cam.w) / 2 : lim(tx, x0, x1 - cam.w);
    ty = y1 - y0 <= cam.h ? (y0 + y1 - cam.h) / 2 : lim(ty, y0, y1 - cam.h);
  }
  if (ya) { cam.x = tx; cam.y = ty; return; }
  cam.x += (tx - cam.x) * 0.12; cam.y += (ty - cam.y) * 0.09;
  // el 18 siempre dentro de la pantalla con margen
  if (!cine && !intro) {
    if (fx0 < cam.x + MARGEN.x) cam.x = fx0 - MARGEN.x; else if (fx0 > cam.x + cam.w - MARGEN.x) cam.x = fx0 - cam.w + MARGEN.x;
    if (p.y < cam.y + MARGEN.arriba) cam.y = p.y - MARGEN.arriba; else if (p.y + p.h > cam.y + cam.h - MARGEN.abajo) cam.y = p.y + p.h - cam.h + MARGEN.abajo;
    if (m.ancho >= cam.w) cam.x = lim(cam.x, 0, m.ancho - cam.w);
    cam.y = lim(cam.y, yMin, Math.max(yMin, m.alto - cam.h, yMin));
  }
}

// ---------------------------------------------------------------- un paso de juego
let lentoAcum = 0;
function pasoJuego(t) {
  if (prologo && prologo.fase === 'preparando') return;    // el prologo preparandose (dibujar)
  if (zona.pintada && !lindeListo()) return;    // El Linde aun pintandose: el nivel espera
  if (E.nivel.zona === 'ciudad' && !ciudadListo() && !ciudadFallo()) return;   // y la ciudad
  if (rotura) { if (rotura.E !== E) rotura = null; else rotura.paso(DT); }
  // el prologo en la calle: no hay simulacion, solo lo vivo del nivel (farolas, polvo) y lo suyo
  if (prologo && prologo.escenario) {
    if (prologo.paso(DT, datosPrologo()) === 'laboratorio') { prologoAlLab(); return; }
    vivo.actualizar(DT, t, cam, app.son); focos.actualizar(DT, t, cam, []); polvoLuz.actualizar(DT, t, cam, E);
    fx.actualizar(DT, E, cam, t);
    centrarCamara(false);
    return;
  }
  if (intro) {
    // despues del prologo, el reloj de la intro lo lleva el (hasta que sale el 18)
    if (prologo) {
      prologo.paso(DT, datosPrologo()); intro.t = prologo.introT();
      // las pisadas del gigante mecen las lamparas de la sala (y la ultima, fuerte)
      if (prologo.golpe) focos.emitir({ t: prologo.golpe, x: E.inicio.x, y: E.inicio.pie - 200 });
      focos.actualizar(DT, t, cam, []);
    } else intro.t += DT;
    // la piedra del techo (piedraIntro): se suelta, golpea la tapa del frasco al acabar el sueno, rebota y cae al suelo
    const pz = piedraEn(intro.t);
    if (intro.t > INTRO.fin) intro.suelta = intro.golpe = intro.posa = true;      // (saltada con Esc: sin golpes de golpe)
    if (!intro.suelta && intro.t > pz.t0 - 0.35) {
      intro.suelta = true; app.son.ev({ t: 'derrumbe' });
      // tras el prologo la piedra pasa rozando el fluorescente que cuelga sobre el frasco: lo deja balanceandose
      if (prologo) { focos.emitir({ t: 'jefe_choca', x: E.inicio.x, y: E.inicio.pie - 200 }); app.son.ev({ t: 'foco_golpe', tipo: 'fluorescente' }); }
    }
    if (!intro.golpe && intro.t > INTRO.dormido) {
      intro.golpe = true; fx.sacudir(0.45);
      fx.esquirlas(E.inicio.x, E.inicio.pie - PIEDRA.tapa, 9, 'rgba(110,110,116,');
      fx.polvo(E.inicio.x, E.inicio.pie - PIEDRA.tapa, 8, zona.polvo, 26, 50);
      app.son.ev({ t: 'aterriza', fuerte: true }); app.son.ev({ t: 'choque' }); app.son.ev({ t: 'cruje' });
    }
    if (!intro.posa && pz.posa) { intro.posa = true; fx.polvo(pz.x, E.inicio.pie, 5, zona.polvo, 18, 30); app.son.ev({ t: 'resto_cae', fuerza: 0.5 }); }
    // la piedra aprieta la tapa: el cristal cruje tres veces, cada vez mas, antes de reventar
    const td = intro.t - INTRO.dormido;
    if (intro.t < INTRO.fin) for (const [k, cuando] of [0.4, 0.82, 1.18].entries()) {
      if ((intro.cruje || 0) > k || td < cuando) continue;
      intro.cruje = k + 1; fx.sacudir(0.05 + k * 0.04); app.son.ev({ t: 'cruje' });
      app.son.tono(2600 - k * 300, 0.3 + k * 0.1, 'sine', 0.012 + k * 0.008, 0.6, 0, 1900 - k * 300);     // el cristal tenso
    }
    if (!intro.roto && intro.t > INTRO.rompe) {
      intro.roto = true; fx.sacudir(0.3); app.son.ev({ t: 'peligro' });
      // (saltada con Esc no estalla: el frasco ya esta roto)
      if (intro.t < INTRO.rompe + 0.5) { rotura = new Rotura(E.inicio.x, E.inicio.pie, app.son, E.m); rotura.E = E; }
    }
    if (intro.t > INTRO.fin) intro.cae18 = intro.letras = 99;
    // el musgo donde cae y se queda tumbado (de los pies hasta la cabeza, a la derecha del frasco)
    const tumbado = intro.t > INTRO.golpe18 && intro.t < INTRO.levanta + 0.6;
    terreno.pisar(DT, tumbado ? { x: E.inicio.x + 2, w: 46, y: E.inicio.pie - 50, h: 50, enSuelo: true } : null);
    terreno.mecer(DT, null, t);
    if (!intro.cae18 && intro.t > INTRO.golpe18) {
      intro.cae18 = 1; fx.sacudir(0.12);
      fx.polvo(E.inicio.x + 22, E.inicio.pie, 6, zona.polvo, 22, 26);
      app.son.ev({ t: 'aterriza', fuerte: true });
    }
    if ((intro.cae18 || 0) < 2 && intro.t > INTRO.levanta + 0.25) { intro.cae18 = 2; app.son.soplo(0.5, 700, 1.2, 0.03, 0.3, 0.1, 300, 'bandpass', true); }   // la capa al levantarse
    // las letras del bocadillo, con un pitido suave cada una (no en espacios ni signos)
    const lineas = HABLA[app.ajustes.leng] || HABLA.en, n = Math.floor(letrasHabla(intro.t, lineas));
    while ((intro.letras || 0) < n) {
      const c = (lineas[0] + lineas[1])[intro.letras || 0];
      intro.letras = (intro.letras || 0) + 1;
      if (/[a-záéíóúñ]/i.test(c)) app.son.tono(520 + Math.random() * 180, 0.045, 'triangle', 0.022, 0.15, 0.1, 470 + Math.random() * 120);
    }
    if (intro.t > INTRO.fin) {
      intro = null; finIntro(E); titulo = 0; quitarPrologo();
      cierreIntro = { t: 0 };
      camS.trasIntro = E.inicio.x + 120 - (E.p.x + INTRO.dx + E.p.w / 2);
      // el 18 se ha levantado un poco mas alla de donde estaba (si se salta con Esc, tambien)
      E.p.x += INTRO.dx; if (E.p.seguro) E.p.seguro.x += INTRO.dx;
    }
    fx.actualizar(DT, E, cam, t);
    centrarCamara(false);
    return;
  }
  if (mapa.abierto) { fx.actualizar(DT, E, cam, t); return; }      // dibujando el mapa: el mundo espera
  if (areaC) areaC.t += DT;
  const inp = { ...pulsado };
  if (raton && ratonMovido) { const s = lienzo.height / VISTA.h; inp.apunta = { x: cam.x + raton.x / s, y: cam.y + raton.y / s }; }
  // lo pulsado durante el paron o la camara lenta se GUARDA para el paso que si avanza (hasta el 2026-10-18 se
  // tiraba: el tajo pulsado justo despues de acertar no salia; tools/medir_combate.mjs). La camara del golpe
  // (fx.cam) va a tiempo real tambien en el paron: el ultimo argumento de fx.actualizar
  let ed = pendiente;
  if (cine) { ed = {}; for (const k in inp) if (k !== 'apunta') inp[k] = false; }
  if (fx.paron > 0) { fx.paron -= DT; fx.actualizar(DT * 0.2, E, cam, t, DT); return; }
  // camara lenta al matar: la simulacion avanza uno de cada tres pasos
  if (fx.lento > 0) {
    fx.lento -= DT; lentoAcum += 0.35;
    if (lentoAcum < 1) { fx.actualizar(DT * 0.35, E, cam, t, DT); centrarCamara(false); return; }
    lentoAcum -= 1;
  }
  pendiente = {};
  const ev = paso(E, inp, ed, DT);
  const pan = (x) => (x - (cam.x + cam.w / 2)) / (cam.w / 2);
  for (const e of ev) {
    fx.emitir(e, E);
    vivo.emitir(e);
    focos.emitir(e);
    polvoLuz.emitir(e, E);
    app.son.ev(e, pan(e.x ?? E.p.x));
    gancho.emitir(e, E.p, fx);
    if (e.t === 'empuje' || e.t === 'choca_gz') A.golpeGz(E.p, e);
    // al caer en el musgo: se aplasta mas ancho y suelta una nubecilla de esporas
    if (e.t === 'aterriza' && terreno.vivo) { terreno.pisar(0, E.p, e.fuerte ? 1 : 0.55); fx.polvo(e.x, e.y - 2, e.fuerte ? 5 : 3, terreno.estilo.grumoClaro, 26, 26); }
    if (e.t === 'dano') grieta = 1;
    if (e.t === 'hack') { const H = e.tipo === 1 ? Hack1 : e.tipo === 3 ? Hack3 : Hack2; hack = new H((k) => app.son.ui(k)); for (const k in pulsado) pulsado[k] = false; }
    if (e.t === 'habilidad') banner = { h: e.h, t: 0 };
    if (e.t === 'despierta_zorro') { banner = { h: 'zorro', t: 0 }; cambio = { t: 0, hacia: 1 }; }
    if (e.t === 'zorro' || e.t === 'humano') cambio = { t: 0, hacia: e.t === 'zorro' ? 1 : -1 };
    if (e.t === 'ruedo_cierra') cartelaJefe = 0.001;
    if (e.t === 'jefe_vencido') cine = { t: 0 };
    if (e.t === 'salida') { if (e.continuo) pasarSinCorte(); else saliendo = 0.001; }
    if (e.t === 'muere_18') muerte = 0.001;
    if (E.zl) eventoZona(e);
  }
  terreno.pisar(DT, E.p);                 // el musgo bajo los pies (y el que se recupera)
  terreno.mecer(DT, E.p, t);              // las plataformas que cuelgan
  vivo.actualizar(DT, t, cam, app.son);
  const evFocos = [];
  focos.actualizar(DT, t, cam, evFocos);
  for (const e of evFocos) { fx.emitir(e, E); app.son.ev(e, pan(e.x)); polvoLuz.emitir(e, E); }
  polvoLuz.actualizar(DT, t, cam, E);
  if (hack) {
    hack.actualizar(DT);
    if (hack.resultado) { const ev2 = resolverHack(E, true); for (const e of ev2) { fx.emitir(e, E); app.son.ev(e); } hack = null; }
  }
  if (cine) { cine.t += DT; if (cine.t > 8) { cine = null; E.circuloJefe = true; } }
  if (cartelaJefe) cartelaJefe += DT;
  if (banner) { banner.t += DT; if (banner.t > 4) banner = null; }
  if (cambio) { cambio.t += DT; if (!A.fotogramaCambio(S, cambio)) cambio = null; }
  grieta = Math.max(0, grieta - DT * 1.5);
  if (muerte) { muerte += DT; if (muerte > 1.8) { E = reaparecer(E); despuesDeCargar(false); fundido = 1; if (E.zl) guardarZona(); } }
  if (saliendo) {
    // la puerta ya se ha cerrado con el 18 dentro: un fundido corto y se sigue por el otro lado
    saliendo += DT;
    if (saliendo > 0.5) {
      if (E.nivel.final) { app.progreso.max = NIVELES[NIVELES.length - 1].id; guardar('boundland-progreso', app.progreso); app.modo = 'menu'; app.enJuego = false; menu.abrir('final'); menu.t2 = 0; return; }
      cargar(siguiente(E.id), true); fundido = 1;
    }
  }
  titulo += DT;
  notaK = E.estado === 'nota' ? Math.min(1, notaK + DT * 5) : Math.max(0, notaK - DT * 6);
  const p = E.p;
  A.animarGz(p, DT, t);
  A.animarGiro(p, DT);
  // estela: teletransporte, Sunikel, la voltereta del doble salto, el zorro corriendo y el empujon en gravedad
  // cero mientras va deprisa (un eco cada 2 pasos; el del empujon, palido y frio)
  const glide = p.gz && p.tEmpuje > 0.12 && Math.hypot(p.vx, p.vy) > 230;
  if ((p.tele > 0 || p.sunikel > 0 || p.tDoble > 0.1 || glide || (p.zorro && !cambio && Math.abs(p.vx) > 300)) && (Math.round(t * 60) % 2 === 0)) {
    const f = A.fotograma(S, p.pose, p.tPose, p);
    const def = A.deformacion(p);
    if (glide) def.filtro = 'brightness(1.5) saturate(0.35) sepia(0.2) hue-rotate(170deg)';
    rastro.push({ anim: f.anim, i: f.i, x: p.x + p.w / 2, pie: p.y + p.h, cara: p.cara, a: p.tDoble > 0 ? 0.7 : glide ? 0.6 : 1, def });
  }
  for (const r of rastro) r.a -= DT * 4;
  rastro = rastro.filter((r) => r.a > 0);
  if (cierreIntro && (cierreIntro.t += DT) > 0.3) { cierreIntro = null; A.soltarTrozos(S, 'intro'); }
  fx.actualizar(DT, E, cam, t);
  gancho.actualizar(DT);
  // la anomalia se oye antes de verse
  if (E.zonas.length && zona.efectos) {
    const z = E.zonas[0], px = p.x + p.w / 2;
    const d = px < z.x ? z.x - px : px > z.x + z.w ? px - z.x - z.w : 0;
    app.son.anomalia(1 - d / 1400);
  } else app.son.anomalia(0);
  centrarCamara(false);
}

// ---------------------------------------------------------------- bucle
let acum = 0, ultimo = performance.now(), t = 0, congelado = false;
function bucle(ahora) {
  const dt = Math.min(0.1, (ahora - ultimo) / 1000); ultimo = ahora;
  acum += dt;
  while (acum >= DT) {
    acum -= DT; t += DT;
    fundido = Math.max(0, fundido - DT * 1.5);
    if (app.modo === 'juego' && E && !congelado) pasoJuego(t);
  }
  try { dibujar(); } catch (err) { console.error(err); }
  requestAnimationFrame(bucle);
}

// ---------------------------------------------------------------- dibujo
function dibujar() {
  const W = Math.round(innerWidth * disp()), H = Math.round(innerHeight * disp());
  if (lienzo.width !== W || lienzo.height !== H) { lienzo.width = W; lienzo.height = H; }
  // la interfaz se mide por el lado corto: en una ventana estrecha no se sale
  const u = Math.min(H / VISTA.h, W / VISTA.w);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // en los menus el cursor lo dibuja menu.js (dibujo/cursor.js); jugando, la mira del sistema
  const cursor = app.modo === 'juego' ? 'crosshair' : 'none';
  if (lienzo.style.cursor !== cursor) lienzo.style.cursor = cursor;
  if (app.modo === 'menu') { menu.dibujar(ctx, W, H, u, t, S, false); return; }
  // el prologo preparandose: un fotograma en negro y despues (aun en negro) se carga y se dibuja el laboratorio
  if (prologo && prologo.fase === 'preparando') {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (++prologo.negros >= 2) prepararPrologo();
    return;
  }
  dibujarMundo(W, H, u);
  if (app.modo === 'pausa') menu.dibujar(ctx, W, H, u, t, S, true);
  if (fundido > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(0,0,0,${fundido})`; ctx.fillRect(0, 0, W, H); }
}

// LA INTRO DEL FRASCO (2026-10-20, pedido: «la propia piedra mediante la presion rompe el cristal, no lo hace el
// personaje; el personaje cae hacia adelante, se levanta y dice que ha sucedido, donde estoy»). Instantes de
// intro.t: la piedra da en la tapa en `dormido` y se queda encima apretando; el cristal revienta en `rompe`; el 18
// (dormido todo el rato) cae de bruces y toca el suelo en `golpe18`, se queda tumbado hasta `levanta`, esta de pie
// en `dePie`, habla desde `habla`, mira alrededor en `mira` y se le da el control en `fin`. La hoja `intro` tiene
// 60 fotogramas (tools/sprites.py) y cada tramo dura lo suyo (fotogramaIntro).
const INTRO = { dormido: 2.4 };
INTRO.rompe = INTRO.dormido + 1.4;
INTRO.tumbado = INTRO.rompe + 1.0;                   // fotogramas 26-37: se desploma y cae
INTRO.golpe18 = INTRO.rompe + 9 / 12;                // (el 35: el cuerpo contra el suelo)
INTRO.levanta = INTRO.tumbado + 0.9;                 // tumbado, quieto
INTRO.dePie = INTRO.levanta + 14 / 11;               // 38-51: alza la cabeza, de rodillas, agachado
INTRO.habla = INTRO.dePie + 0.3;                     // 52-54: de pie
INTRO.mira = INTRO.habla + 1.25;                     // 55-59: mira alrededor («¿donde estoy?»)
INTRO.fin = INTRO.mira + 2.2;
INTRO.dx = 0.15 * 64;                                // se levanta 0,15 m mas alla (IN_LADO de sprites.py, a 64 u/m)
const HABLA = { en: ['What happened?', 'Where am I?'], es: ['¿Qué ha sucedido?', '¿Dónde estoy?'] };
const LETRAS_S = 30;                                 // letras por segundo al escribirse
// el fotograma de la hoja `intro` en el instante ti
function fotogramaIntro(ti) {
  const I = INTRO;
  if (ti < I.dormido) return ((Math.floor(ti * 12) % 12) + 12) % 12;     // (tras el prologo ti empieza en negativo)
  const tramo = (t0, t1, f0, f1) => Math.min(f1, f0 + Math.floor(((ti - t0) / (t1 - t0)) * (f1 - f0 + 1)));
  if (ti < I.rompe) return tramo(I.dormido, I.rompe, 12, 25);
  if (ti < I.tumbado) return tramo(I.rompe, I.tumbado, 26, 37);
  if (ti < I.levanta) return 37;
  if (ti < I.dePie) return tramo(I.levanta, I.dePie, 38, 51);
  if (ti < I.mira) return tramo(I.dePie, I.habla, 52, 54);
  return tramo(I.mira, I.mira + 1.0, 55, 59);
}
// cuantas letras del bocadillo se ven en el instante ti (la segunda linea empieza 1,3 s despues)
function letrasHabla(ti, lineas) {
  const a = Math.max(0, Math.min(lineas[0].length, (ti - INTRO.habla) * LETRAS_S));
  const b = Math.max(0, Math.min(lineas[1].length, (ti - INTRO.habla - 1.3) * LETRAS_S));
  return a < lineas[0].length ? a : lineas[0].length + b;
}
// lo que dice el 18 al levantarse (en la interfaz; tambien con el prologo, que no la pinta)
function hablaIntro(u, s, leng) {
  if (!intro || intro.t <= INTRO.habla) return;
  const lineas = HABLA[leng] || HABLA.en, e = intro.t - INTRO.habla;
  const alfa = Math.min(1, e / 0.12) * Math.max(0, Math.min(1, (INTRO.fin - intro.t) / 0.35));
  const crece = 0.86 + 0.14 * Math.min(1, e / 0.15);
  const hx = E.inicio.x + INTRO.dx + 8, hy = E.inicio.pie - 58;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  bocadillo(ctx, (hx - cam.x) * s, (hy - cam.y) * s, lineas, letrasHabla(intro.t, lineas), u, alfa, crece);
  ctx.restore();
}
// el 18 dentro del frasco, la intro (frascoPintado y frasco18): flota un poco hasta que revienta y, cuando cae fuera
// del frasco, va DELANTE del cristal roto
function introSprite(x, pie, delante) {
  if (!intro) {
    // el relevo: el ultimo fotograma de la intro se va mientras aparece el jugador (dibujarMundo), sin salto
    if (cierreIntro && delante) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - cierreIntro.t / 0.3); A.dibujarSprite(ctx, S, 'intro', 59, x, pie, 1, lienzo.height / VISTA.h); ctx.restore(); }
    return;
  }
  const i = fotogramaIntro(intro.t);
  if ((i >= 30) !== delante) return;
  ctx.save(); A.dibujarSprite(ctx, S, 'intro', i, x, pie - (i < 27 ? 4 : 0), 1, lienzo.height / VISTA.h); ctx.restore();
}

function dibujarMundo(W, H, u) {
  if (zona.pintada && !lindeListo()) { dibujarEsperaLinde(ctx, W, H, u, app.ajustes.leng); return; }
  const ciudad = E.nivel.zona === 'ciudad';
  if (ciudad && !ciudadListo() && !ciudadFallo()) {
    if (prologo) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }   // el prologo empieza en negro
    dibujarEsperaCiudad(ctx, W, H, u, app.ajustes.leng); return;
  }
  // el prologo en la calle: sin el 18, sin enemigos ni objetos del nivel 7; sus farolas fallan cuando el lo dice
  const enEscena = !!(prologo && prologo.escenario);
  if (enEscena) prologo.envolver(luces);
  if (ciudad && ciudadListo() && !luces.conCiudad) { luces.conCiudad = true; luces.push(...despertar.ajustarLuces(lucesCiudad(E), 'ciudad')); }   // lo que la ciudad pinto encendido
  cam.h = VISTA.h / zoomVista;
  const s = H / cam.h;
  despertar.zona(E.nivel.zona);
  cam.w = W / s;
  // la camara del golpe (dibujo/sentir.js): empujon con muelle hacia donde va el golpe + sacudida por trauma
  const cx = cam.x + fx.cam.x, cy = cam.y + fx.cam.y;
  fondo.preparar(s, cam.w, cam.h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const camF = E.comun && E.comun.mismaZona ? { x: cx + E.comun.ox, y: cy + E.comun.oy } : { x: cx, y: cy };
  // A LO HOLLOW KNIGHT (dibujo/hk.js): el fondo se pinta aparte, con un velo de bruma tras cada capa y el color de
  // la zona, y no lo oscurece la penumbra; lo de delante se pinta sobre transparente y `penumbra` lo junta
  if (hk.zona(E.nivel.zona)) {
    // (el prologo mete al gigante entre las capas del fondo, y despues de gradar, lo que le brilla)
    fondo.dibujar(hk.lienzoFondo(W, H), camF, s, enEscena ? (c, f) => { hk.velo(c); prologo.trasCapa(c, f, camF, s); } : hk.velo);
    hk.gradarFondo();
    despertar.hacesBruma(hk.fondo.getContext('2d'), camF, s, t, W, H);    // el despertar: haces que bajan por la bruma
    if (enEscena) prologo.sobreFondo(hk.fondo.getContext('2d'), camF, s, t, capasCiudad());
    ctx.clearRect(0, 0, W, H);
  } else fondo.dibujar(ctx, camF, s);
  ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s);
  // brillo de las zonas de gravedad cero (detras del terreno)
  for (const z of E.zonas) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const R = Math.max(z.w, z.h) / 1.7, zx = z.x + z.w / 2, zy = z.y + z.h / 2;
    const g = ctx.createRadialGradient(zx, zy, 0, zx, zy, R);
    g.addColorStop(0, 'rgba(160,210,255,.18)'); g.addColorStop(1, 'rgba(160,210,255,0)');
    ctx.fillStyle = g; ctx.fillRect(zx - R, zy - R, R * 2, R * 2);   // todo el degradado: sin cortes rectos
    ctx.restore();
  }
  dibujarDecoradoFondo(ctx, E, t);
  // El Linde: su decorado (arboles, aldea, casas...) detras del terreno, y lo macizo pintado (el autobus) encima
  // la cabana en 3D (detras de los arboles y del terreno de su sitio)
  if (zona.pintada && casa3d) casa3d.dibujar(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, s, W, H, t);
  if (zona.pintada) dibujarLindeDecorado(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, 'fondo');
  if (ciudad) dibujarCiudadDecorado(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, 'fondo', E);
  terreno.dibujar(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, s);
  terreno.dibujarColgadas(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, t);   // las plataformas que cuelgan y se mecen
  terreno.dibujarMusgo(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, t);      // en vivo: se aplasta al pisarlo
  if (zona.pintada) dibujarLindeDecorado(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, 'sobre', E.p);   // (E.p: la carroceria del autobus se desvanece con el 18 dentro)
  if (ciudad) dibujarCiudadDecorado(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, 'sobre', E);
  for (const mk of E.marcas) {
    const x = mk.i * T;
    if (x < cx - 300 || x > cx + cam.w + 300) continue;
    dibujarDecoradoVivo(ctx, mk, E, zona, t);
  }
  // lo que se ve por las ventanas, con parallax (a lo Hollow Knight va en penumbra(): emite y queda detras)
  if (!hk.p) dibujarVentanas(ctx, E, t, { x: cx, y: cy, w: cam.w, h: cam.h, s });
  focos.dibujar(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, t);
  // las puertas de entrada y salida (el marco, el umbral oscuro y sus hojas)
  for (const pu of [E.puertaEntrada, E.puertaSalida]) if (pu) dibujarPuerta(ctx, pu, t, E, zona, 'fondo');
  vivo.dibujarDetras(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, t);
  // el frasco del 18 en el nivel 1
  if (E.id === 1 || E.nivel.frasco18) (zona.efectos ? frascoPintado : frasco18)();
  for (const f of E.flotantes) A.dibujarFlotante(ctx, f, t, E.nivel.zona);
  for (const g of E.gigantes) A.dibujarGigante(ctx, g, t);
  if (E.bus) A.dibujarBus(ctx, E.bus, t);
  for (const r of E.rejillas) A.dibujarRejilla(ctx, r, t, r.abierta);
  for (const k of E.controles) A.dibujarControl(ctx, k, t);
  if (!enEscena) {
    for (const n of E.notas) A.dibujarNota(ctx, n, t, E.notasLeidas.has(n.n));
    for (const it of E.items) A.dibujarItem(ctx, it, t, s);
    for (const d of E.dosis) if (!d.cogida) A.dibujarDosis(ctx, d, t);
  }
  if (E.zl) ZL.dibujarDetras(ctx, E, t, S, s, zona);     // frascos de reserva, motas, la luz perdida, la esclusa...
  for (const o of E.objetos) A.dibujarObjeto(ctx, o);
  // suelos que se hunden y tallos que cierran el paso
  const m = E.m;
  const j0 = Math.max(0, Math.floor(cy / T)), j1 = Math.min(m.h - 1, Math.floor((cy + cam.h) / T) + 1);
  const i0 = Math.max(0, Math.floor(cx / T)), i1 = Math.min(m.w - 1, Math.floor((cx + cam.w) / T) + 1);
  const losa = (i, j, tb) => {
    if (zona.pintada) tablaPodrida(ctx, i * T + tb, j * T, T, 12, i * 7 + j);     // el Linde: un tablon viejo (dibujo/linde.js)
    else {
      caja(ctx, i * T + tb, j * T, T, 12, zona.hunde || zona.masaClara, i * 7 + j, 0.6, 2.2);
      ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(i * T + 8 + tb, j * T + 2); ctx.lineTo(i * T + 14 + tb, j * T + 10); ctx.stroke();
    }
  };
  // las que se acaban de hundir caen (con su hierba, que pinta vivo.js con la misma caida)
  for (const h of E.hunde.values()) {
    const q = caidaLosa(h);
    if (!q || h.i < i0 - 1 || h.i > i1 + 1) continue;
    const ox = h.i * T + T / 2, oy = h.j * T + 6;
    ctx.save(); ctx.globalAlpha *= q.alfa; ctx.translate(ox + q.dx, oy + q.dy); ctx.rotate(q.giro); ctx.translate(-ox, -oy);
    losa(h.i, h.j, 0); ctx.restore();
  }
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const v = m.t[j * m.w + i];
    if (v === 5) {
      const h = E.hunde.get(j * m.w + i);
      losa(i, j, h && !h.cae ? (Math.random() - 0.5) * 2.5 : 0);
    } else if (v === 7) {
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.moveTo(i * T + 8 + k * 8, j * T);
        ctx.quadraticCurveTo(i * T + 4 + k * 9 + Math.sin(t * 1.5 + k + j) * 4, j * T + 16, i * T + 8 + k * 8, j * T + T);
        ctx.strokeStyle = TINTA; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#e2792b'; ctx.lineWidth = 3; ctx.stroke();
      }
    }
  }
  // puertas del patio: persiana de chapa que baja al empezar la pelea
  for (const q of E.puertas) {
    if (m.t[q.j * m.w + q.i] !== 1) continue;
    caja(ctx, q.i * T + 2, q.j * T, T - 4, T, '#3a3432', q.i * 3 + q.j, 0.5, 2.4);
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.2;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(q.i * T + 4, q.j * T + k * 8); ctx.lineTo(q.i * T + T - 4, q.j * T + k * 8); ctx.stroke(); }
  }
  for (const b of E.tornillos) A.dibujarTornillo(ctx, b, t);
  if (enEscena) prologo.dibujarMundo(ctx, t, s, { x: cx, y: cy, w: cam.w, h: cam.h });     // el convoy y las bestias, donde van los personajes
  if (!enEscena) for (const en of E.enemigos) A.dibujarEnemigo(ctx, en, t, s);
  for (const q of E.proyectiles) A.dibujarProyectil(ctx, q, t, s);
  if (E.jefe) { A.dibujarJefe(ctx, E.jefe, t, s, E); A.estadoJefe(ctx, E.jefe, t); circuloDelJefe(); }
  const p = E.p;
  // las anclas del mapa (anilla colgada de su cable) y el gancho: garfio, cuerda trenzada, lanzar y recoger
  for (const a of E.anclas) if (a.fija && Math.abs(a.x() - (cx + cam.w / 2)) < cam.w) dibujarAncla(ctx, a, E, t);
  if (!enEscena) gancho.dibujar(ctx, p, t);
  if (!intro && !enEscena) {
    if (p.recorte) {
      // por una escotilla o una trampilla: solo se ve la parte del 18 que esta fuera del techo o del suelo
      const rc = p.recorte;
      ctx.save(); ctx.beginPath(); ctx.rect(p.x - 80, rc.y0 ?? p.y - 200, p.w + 160, (rc.y1 ?? p.y + p.h + 200) - (rc.y0 ?? p.y - 200)); ctx.clip();
      A.dibujarSujeto(ctx, S, p, t, s, rastro, cambio);
      ctx.restore();
    } else if (p.enJaula) {
      // en la jaula del montacargas: solo se ve dentro del hueco (la jaula entra y sale por arriba o abajo)
      const pu = E.estado === 'saliendo' || E.estado === 'fin' ? E.puertaSalida : E.puertaEntrada;
      const r = rectoUmbral(pu);
      ctx.save(); ctx.beginPath(); ctx.rect(r.x - 4, r.y, r.w + 8, r.h); ctx.clip();
      A.dibujarSujeto(ctx, S, p, t, s, rastro, cambio);
      ctx.restore();
      dibujarPuerta(ctx, pu, t, E, zona, 'hojas');
    } else if (p.dentro > 0) {
      // en el umbral de una puerta: se va hacia dentro (mas pequeno, mas arriba, a oscuras) y solo se ve por
      // el hueco; las hojas de la puerta se pintan despues, por delante
      const pu = E.estado === 'saliendo' || E.estado === 'fin' ? E.puertaSalida : E.puertaEntrada;
      const r = rectoUmbral(pu);
      const fx0 = p.x + p.w / 2, fy0 = p.y + p.h, k = 1 - 0.18 * p.dentro;
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      ctx.translate(fx0, fy0 - 7 * p.dentro); ctx.scale(k, k); ctx.translate(-fx0, -fy0);
      ctx.filter = `brightness(${(1 - 0.88 * p.dentro).toFixed(3)})`;
      A.dibujarSujeto(ctx, S, p, t, s, rastro, cambio);
      ctx.restore();
      dibujarPuerta(ctx, pu, t, E, zona, 'hojas');
    } else {
      // (en una plataforma que cuelga, el 18 va con ella)
      const dz = terreno.desplazamiento();
      ctx.save(); ctx.translate(dz.x, dz.y);
      if (cierreIntro) ctx.globalAlpha = Math.min(1, cierreIntro.t / 0.3);
      A.dibujarSujeto(ctx, S, p, t, s, rastro, cambio);
      ctx.globalAlpha = 1;
      cargaYCura(p);
      ctx.restore();
    }
  }
  if (E.zl) ZL.dibujarDelante(ctx, E, t);                // el cristal del frasco en el que descansa
  vivo.dibujarDelante(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, t);
  if (zona.pintada) dibujarLindeDecorado(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, 'delante');   // el agua del Linde
  dibujarDecoradoFrente(ctx, E, t);
  if (rotura) rotura.dibujar(ctx, t, true);      // las esquirlas y gotas de delante, el vapor y el destello
  fx.dibujar(ctx, E, t, s);
  // punto de enganche a tiro
  if (E.hab.gancho && !p.cuerda && !intro) {
    const a = anclaCerca(E, p);
    if (a) {
      dibujarMira(ctx, a, t, 'E');
    }
  }
  // trayectoria de lo que lleva en la mano
  if (p.lleva) {
    let ax = p.cara, ay = -0.35;
    if (raton && ratonMovido) { ax = cam.x + raton.x / s - (p.x + p.w / 2); ay = cam.y + raton.y / s - (p.y + 6); }
    const n = Math.hypot(ax, ay) || 1;
    let x = p.x + p.w / 2, y = p.y - 14, vx = (ax / n) * J.lanzarVel, vy = (ay / n) * J.lanzarVel;
    ctx.fillStyle = 'rgba(255,248,232,.55)';
    for (let k = 0; k < 24; k++) {
      for (let q = 0; q < 3; q++) { vy += J.lanzarGrav / 60; x += vx / 60; y += vy / 60; }
      const r = 2.2 - k * 0.06; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  penumbra(s, cx, cy, W, H);
  if (enEscena) prologo.dibujarLuces(ctx, s, cx, cy, t);      // faros, el foco, el fogonazo, la explosion (los recoge el resplandor)
  if (zona.efectos) efectosLuz(s, cx, cy, W, H);
  else { resplandor(W, H, zona.oscuro > 0.4 ? 0.3 : 0.1); etalonaje(W, H); }
  motas(s, cx, cy);
  // el cuerpo de las lamparas, ENCIMA de su propia luz: sin esto el haz lo quemaba y no se veia el foco
  ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s); focos.dibujarCuerpos(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, t); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (E.zl) veloSala(s, cx, cy);          // la zona conectada: lo que no es la sala del 18, en sombra
  if (primerPlano) {
    if (zona.pintada) dibujarLindeFrente(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, s, E.m.ancho);
    else if (ciudad && ciudadListo()) dibujarCiudadFrente(ctx, { x: cx, y: cy, w: cam.w, h: cam.h }, s, E);
    else dibujarPrimerPlano(ctx, E, { x: cx, y: cy, w: cam.w, h: cam.h }, s, t);
  }
  // el prologo: la niebla, el corte de la tierra al bajar, las franjas de cine y el titulo (y sin interfaz)
  if (prologo) { prologo.dibujarEncima(ctx, W, H, u, s, cx, cy, t, app.ajustes.leng); despertar.acabado(ctx, W, H, t); hablaIntro(u, s, app.ajustes.leng); return; }
  // zoom de un instante al rematar o matar: el cuadro entero se acerca hacia el 18 (copia del lienzo,
  // para no cambiar la escala de las caches del terreno y del fondo)
  if (fx.zoom > 0.003) {
    const zf = 1 + fx.zoom, zx = (p.x + p.w / 2 - cx) * s, zy = (p.y + p.h / 2 - cy) * s;
    ctx.save(); ctx.setTransform(zf, 0, 0, zf, zx - zx * zf, zy - zy * zf); ctx.drawImage(lienzo, 0, 0); ctx.restore();
  }
  // el despertar: vineta ovalada fria centrada en el 18, sombras azuladas y grano (encima del mundo, debajo de la interfaz)
  despertar.acabado(ctx, W, H, t, [(p.x + p.w / 2 - cx) / cam.w, (p.y + p.h / 2 - cy) / cam.h]);
  // ---- interfaz
  if (limpio) return;
  if (fx.destello > 0) { ctx.fillStyle = `rgba(255,250,240,${fx.destello * 0.7})`; ctx.fillRect(0, 0, W, H); }
  if (!intro && !cine) HUD.ampolla(ctx, u, p.vida, t, grieta, p.zorro, p.vidaMax || J.vida);
  if (!intro && !cine && E.zl) HUD.fragmentos(ctx, u, E.zl.fragmentos, t);
  if (!intro && !cine && (E.hab.daga || E.zl)) HUD.esencia(ctx, u, p.esencia, p.cura, J.curaT, J.curaCoste, J.esenciaMax, t);
  const leng = app.ajustes.leng;
  if (!intro) {
    const kc = titulo < 0.8 ? titulo / 0.8 : titulo < 3.6 ? 1 : Math.max(0, 1 - (titulo - 3.6) / 1.2);
    HUD.cartela(ctx, W, H, u, E.nivel, leng, kc);
  }
  if (cartelaJefe > 0 && cartelaJefe < 4.5) {
    const k = cartelaJefe < 0.6 ? cartelaJefe / 0.6 : cartelaJefe < 3.4 ? 1 : 1 - (cartelaJefe - 3.4) / 1.1;
    HUD.cartela(ctx, W, H, u, { id: 10, sub: { en: 'In the hospital courtyard', es: 'En el patio del hospital' }, titulo: { en: 'THE LAB COAT BEETLE', es: 'EL ESCARABAJO DE LA BATA' } }, leng, k);
  }
  if (banner) HUD.habilidad(ctx, W, H, u, banner.h, leng, banner.t < 3 ? 1 : 1 - (banner.t - 3));
  // el rotulo de cada parte de la zona conectada, al entrar en ella (no encima del del nivel)
  if (areaC && titulo > 4.8) {
    const k = areaC.t < 0.6 ? areaC.t / 0.6 : areaC.t < 2.6 ? 1 : Math.max(0, 1 - (areaC.t - 2.6) / 1);
    HUD.cartela(ctx, W, H, u, { zonaLab: true, sub: { en: 'Ceniza Laboratory', es: 'Laboratorio Ceniza' }, titulo: { en: areaC.e.en.toUpperCase(), es: areaC.e.es.toUpperCase() } }, leng, k);
    if (areaC.t > 3.6) areaC = null;
  }
  // pista de controles del sitio (`pide`: solo si ya se tiene esa habilidad; la de las rejas del nivel 10 salia
  // antes de coger el teletransporte y el doble toque no hacia nada)
  const pi = (E.nivel.pistas || []).find((q) => (!q.pide || (E.hab && E.hab[q.pide])) && Math.abs((p.x + p.w / 2) / T - q.x) < 7 && (q.y === undefined || Math.abs((p.y + p.h) / T - q.y) < 4));
  pistaK = pi && !intro && titulo > 3 ? Math.min(1, pistaK + 0.05) : Math.max(0, pistaK - 0.05);
  if (pi) HUD.pista(ctx, W, H, u, pi[leng], pistaK);
  else if (pistaK > 0) pistaK = 0;
  if (E.aviso && E.estado === 'jugando' && !intro) {
    const txt = HUD.TXT[leng][E.aviso.tipo] || 'E';
    const sx = (p.x + p.w / 2 - cam.x) * s, sy = (p.y - cam.y) * s - 34 * u;
    HUD.aviso(ctx, sx + 22 * u, sy, u, 'E  ' + txt, 1);
  }
  if (cine) giro(W, H, u, leng);
  hablaIntro(u, s, leng);
  if (intro && !intro.conPrologo) { const k = Math.max(0, 1 - intro.t / 1.2); if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, W, H); } }
  if (notaK > 0 && E.notaAbierta) HUD.nota(ctx, W, H, u, E.notaAbierta, leng, notaK, t);
  if (hack) hack.dibujar(ctx, W, H, u, t, leng);
  if (E.zl) { mapaK = mapa.abierto ? Math.min(1, mapaK + 1 / 12) : Math.max(0, mapaK - 1 / 9); if (mapaK > 0) mapa.dibujar(ctx, W, H, u, E, t, leng, mapaK, S, E.notasLeidas); }
  if (muerte) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, muerte / 1.2)})`; ctx.fillRect(0, 0, W, H); }
  if (saliendo) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, saliendo / 0.45)})`; ctx.fillRect(0, 0, W, H); }
  if (costura) {
    costura.t += 1 / 60;
    const k = 1 - costura.t / costura.dur;
    if (k <= 0) costura = null;
    else { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = k * k; ctx.drawImage(costura.cv, 0, 0, W, H); ctx.restore(); }
  }
}

// el frasco del 18 en su estanteria: entero durante la intro, roto despues
function frasco18() {
  const x = E.inicio.x, pie = E.inicio.pie;
  const h = 96, w = 46;
  const roto = !intro || intro.roto;
  ctx.save();
  // (sin brillo propio: la capsula entera no da luz, la da la lampara de encima; 2026-10-20, pedido: «hay mucha luz en
  // la capsula, quitala»)
  // el 18 dentro durante la intro
  introSprite(x, pie, false);
  if (rotura) rotura.dibujar(ctx, t, false);
  caja(ctx, x - w / 2 - 6, pie - 10, w + 12, 10, '#3a4552', 18);
  if (!roto) {
    ctx.fillStyle = 'rgba(190,225,235,.12)'; ctx.fillRect(x - w / 2, pie - 10 - h, w, h);
    ctx.strokeStyle = TINTA; ctx.lineWidth = 2.4; ctx.strokeRect(x - w / 2, pie - 10 - h, w, h);
    ctx.strokeStyle = 'rgba(240,250,255,.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - w / 2 + 6, pie - h); ctx.lineTo(x - w / 2 + 6, pie - 20); ctx.stroke();
    // grietas desde donde golpeo la piedra, hasta que estalla
    grietasFrasco(x, pie);
    caja(ctx, x - w / 2 - 4, pie - 18 - h, w + 8, 10, '#4a5563', 19);
  } else {
    // restos: aro de arriba caido y esquirlas
    ctx.beginPath(); ctx.moveTo(x - w / 2, pie - 10); ctx.lineTo(x - w / 2, pie - 40); ctx.lineTo(x - w / 2 + 10, pie - 28); ctx.lineTo(x - 4, pie - 46); ctx.lineTo(x + 6, pie - 24); ctx.lineTo(x + w / 2, pie - 34); ctx.lineTo(x + w / 2, pie - 10);
    ctx.fillStyle = 'rgba(190,225,235,.12)'; ctx.fill(); ctx.strokeStyle = TINTA; ctx.lineWidth = 2; ctx.stroke();
    caja(ctx, x - w / 2 - 34, pie - 8, w + 8, 8, '#4a5563', 19);
  }
  ctx.fillStyle = '#e9e2d0'; ctx.font = 'bold 9px Georgia'; ctx.textAlign = 'center'; ctx.fillText('18', x, pie - 2);
  ctx.restore();
  introSprite(x, pie, true);
  piedraIntro();
}

// LA PIEDRA QUE ROMPE EL FRASCO (nivel 1, intro). Un trozo del techo que desmontan los insectos: primero cae un hilo
// de polvo, luego se suelta, golpea la tapa del frasco justo al acabar el sueno (INTRO.dormido) y se queda ENCIMA
// apretando: agrieta el cristal, que revienta por la presion en INTRO.rompe (el 18 sigue dormido); entonces cae
// por la izquierda con la tapa, da un botecito y rueda hasta
// pararse junto al frasco, donde se queda el resto del nivel. Solo dibujo: la simulacion no la ve.
const PIEDRA = { r: 15, g: 2000, tapa: 102, vx: 95, vy: -70, bote: 0.22, rueda: 40 };     // vx: hacia la izquierda al reventar
function techoSobre(x, y) {
  const m = E.m, i = Math.floor(x / T);
  for (let j = Math.floor(y / T); j >= 0; j--) if (m.t[j * m.w + i] === 1) return (j + 1) * T;
  return 0;
}
// donde esta la piedra en el instante ti de la intro (sin intro: ya posada)
function piedraEn(ti) {
  const P = PIEDRA, x = E.inicio.x, pie = E.inicio.pie;
  const techo = techoSobre(x, pie - P.tapa - 40), yG = pie - P.tapa - P.r;
  const tf = Math.sqrt(Math.max(0, 2 * (yG - techo - P.r) / P.g)), t0 = INTRO.dormido - tf;
  const o = { t0, x, y: techo + P.r * 0.4, ang: 0, ve: false, posa: false, techo };
  // despues del prologo la piedra se ve desde antes, encajada en el techo, y tiembla con las pisadas del gigante
  if (intro && intro.conPrologo && ti < t0) { o.ve = true; o.ang = prologo ? prologo.piedraTiembla : 0; if (ti < t0 - 0.5) return o; }
  if (ti < t0 - 1.6) return o;
  o.ve = true;
  if (ti < t0) { o.ang = ti > t0 - 0.5 ? Math.sin(ti * 47) * 0.06 : 0; return o; }      // suelta, tiembla
  if (ti < INTRO.dormido) { const s = ti - t0; o.y = techo + P.r + 0.5 * P.g * s * s; o.ang = s * 2.2; return o; }
  // se queda encima de la tapa APRETANDO: se hunde poco a poco (la tapa se abolla) y tiembla cada vez mas
  const a0 = tf * 2.2, pr = INTRO.rompe - INTRO.dormido;
  let td = ti - INTRO.dormido;
  if (td < pr) {
    const k = td / pr;
    o.x = x + Math.sin(ti * 41) * 0.5 * k; o.y = yG + 6 * k ** 1.6 + Math.sin(ti * 70) * 0.8 * k; o.ang = a0 + Math.sin(ti * 23) * 0.03 * k;
    return o;
  }
  td -= pr;
  // revienta: la tapa cede hacia la izquierda y la piedra cae por ese lado, da un bote y rueda hasta parar
  const y0 = yG + 6, d = pie - P.r - y0, t1 = (-P.vy + Math.sqrt(P.vy * P.vy + 2 * P.g * d)) / P.g;
  const vb = (P.vy + P.g * t1) * P.bote, t2 = (2 * vb) / P.g, x1 = x - P.vx * t1, x2 = x1 - P.vx * 0.55 * t2;
  const tr = P.rueda / (P.vx * 0.55) * 2;                                                 // frenando hasta parar
  if (td < t1) { o.x = x - P.vx * td; o.y = y0 + P.vy * td + 0.5 * P.g * td * td; o.ang = a0 - td * 7; return o; }
  td -= t1; o.posa = true;
  if (td < t2) { o.x = x1 - P.vx * 0.55 * td; o.y = pie - P.r - vb * td + 0.5 * P.g * td * td; o.ang = a0 - t1 * 7 - td * 5; return o; }
  td = Math.min(td - t2, tr);
  const v0 = P.vx * 0.55, rodado = v0 * td - (v0 / tr) * td * td / 2;
  o.x = x2 - rodado; o.y = pie - P.r; o.ang = a0 - t1 * 7 - t2 * 5 - rodado / P.r;
  return o;
}
function piedraIntro() {
  const P = PIEDRA, ti = intro ? intro.t : 99, o = piedraEn(ti);
  if (!o.ve) return;
  const x = E.inicio.x;
  // el hilo de polvo que avisa (y el que sigue cayendo un poco despues de soltarse)
  if (intro && ti > o.t0 - 1.6 && ti < INTRO.dormido + 0.4) {
    const fin = INTRO.dormido + 0.4, k = Math.min(1, (ti - (o.t0 - 1.6)) / 0.6) * Math.min(1, (fin - ti) / 0.4);
    ctx.save(); ctx.fillStyle = rgbaHex(zona.polvo, 0.55 * k);
    for (let q = 0; q < 14; q++) {
      const h = hash(q, 7, 13), y = o.techo + ((ti * (180 + h * 120) + q * 41) % 420);
      ctx.fillRect(x - 9 + h * 18 + Math.sin(ti * 3 + q) * 2, y, 1.6 + h, 1.6 + h);
    }
    ctx.restore();
  }
  // la piedra: canto irregular, cara de luz arriba, sombra abajo y dos grietas, a tinta
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.ang);
  const pts = []; for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr = P.r * (0.78 + hash(k, 3, 29) * 0.4); pts.push([Math.cos(a) * rr * 1.15, Math.sin(a) * rr]); }
  const borde = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); ctx.closePath(); };
  borde(); ctx.fillStyle = '#5b5e64'; ctx.fill();
  ctx.save(); borde(); ctx.clip();
  ctx.fillStyle = '#7a7d84'; ctx.beginPath(); ctx.ellipse(-3, -6, P.r * 0.9, P.r * 0.5, -0.3, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(15,16,20,.45)'; ctx.beginPath(); ctx.ellipse(4, 8, P.r * 1.1, P.r * 0.55, 0.2, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(20,20,24,.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-1, 3); ctx.lineTo(4, 1); ctx.moveTo(3, -7); ctx.lineTo(6, -3); ctx.stroke();
  ctx.restore();
  borde(); ctx.strokeStyle = TINTA; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
// las grietas del cristal: una estrella donde golpeo la piedra (la tapa) y las ramas que bajan hasta que estalla
function grietasFrasco(x, pie) {
  if (!intro || intro.roto || intro.t <= INTRO.dormido) return;
  const k = Math.min(1, (intro.t - INTRO.dormido) / (INTRO.rompe - INTRO.dormido)), y0 = pie - PIEDRA.tapa + 14;
  if (zona.efectos) { grietasRed(ctx, x, pie, k, intro.t); return; }
  // (un trazo oscuro debajo del blanco: contra el brillo del frasco el blanco solo no se veia)
  ctx.save(); ctx.beginPath();
  for (let q = 0; q < 5; q++) { const a = Math.PI * (0.15 + q * 0.17), l = 7 + q % 2 * 4; ctx.moveTo(x + 2, y0); ctx.lineTo(x + 2 + Math.cos(a) * l, y0 + Math.sin(a) * l); }
  ctx.moveTo(x + 2, y0); ctx.lineTo(x + 8 + 6 * k, y0 + 18 + 22 * k); ctx.lineTo(x + 4 + 10 * k, y0 + 30 + 34 * k);
  ctx.moveTo(x + 2, y0); ctx.lineTo(x - 6 - 8 * k, y0 + 14 + 26 * k); ctx.lineTo(x - 2 - 12 * k, y0 + 24 + 40 * k);
  ctx.moveTo(x + 6 + 4 * k, y0 + 12 + 14 * k); ctx.lineTo(x + 14 + 4 * k, y0 + 20 + 18 * k);
  ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(28,34,44,.55)'; ctx.lineWidth = 2.6; ctx.stroke();
  ctx.strokeStyle = 'rgba(245,252,255,.95)'; ctx.lineWidth = 1.1; ctx.stroke(); ctx.restore();
}

// Nivel 1: el frasco del 18 es el asset que brilla (entero en la intro, roto despues)
function frascoPintado() {
  const x = E.inicio.x, pie = E.inicio.pie;
  const roto = !intro || intro.roto;
  // LA CAPSULA ENTERA YA NO DESLUMBRA (2026-10-20, pedido: «hay mucha luz en la capsula, quitala»): fuera su resplandor
  // (el sprite 'frasco' de haces.js, que la quemaba en blanco), el relleno calido del cristal ('brilla'), su halo y el
  // polvo ambar de mas. Queda una luz baja (efectosLuz, `mas`): antes de romperse es la unica de la sala (la lampara aun
  // no alumbra) y sin ella no se ven ni el cristal, ni la base ni el cartel. Al romperse, lo del liquido (rotura.js)
  // la base del frasco: el cristal empieza en y=106 del asset; los pies del 18 van ahi
  const base = pie + 28;
  introSprite(x, pie, false);
  if (rotura) rotura.dibujar(ctx, t, false);
  dibujarAsset(ctx, 'frasco', x, base, 'suelo', 0, { n: 18, estado: roto ? 'roto' : 'entero' });
  grietasFrasco(x, pie);
  introSprite(x, pie, true);          // ya fuera del frasco: delante del cristal roto
  piedraIntro();
}

// Luz con color, suelo mojado, resplandor y etalonaje (las zonas con `efectos`)
const bloomCv = document.createElement('canvas');
function efectosLuz(s, cx, cy, W, H) {
  const m = E.m;
  ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const pozo = (x, y, r, color, a) => {
    if (x < cx - r || x > cx + cam.w + r) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgbaHex(color, a)); g.addColorStop(1, rgbaHex(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const sueloBajo = (x, y) => { const i = Math.floor(x / T); for (let j = Math.max(0, Math.floor(y / T)); j < m.h; j++) if (m.t[j * m.w + i] === 1) return j * T; return null; };
  const reflejo = (x, y, color, a, ancho) => {
    const fy = sueloBajo(x, y);
    if (fy === null || fy - y > 520) return;
    // charco: una mancha que se estira hacia abajo y dos rizos que tiemblan
    ctx.save(); ctx.translate(x, fy + 2); ctx.scale(1, 2.2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ancho * 0.6);
    g.addColorStop(0, rgbaHex(color, a)); g.addColorStop(1, rgbaHex(color, 0));
    ctx.fillStyle = g; ctx.fillRect(-ancho * 0.6, 0, ancho * 1.2, ancho * 0.6);
    ctx.restore();
    ctx.fillStyle = rgbaHex(color, a * 0.8);
    for (let k = 0; k < 2; k++) { const yy = fy + 6 + k * 10 + Math.sin(t * 2 + k) * 1.2; const w2 = ancho * (0.5 - k * 0.15); ctx.fillRect(x - w2 / 2 + Math.sin(t * 1.3 + k * 2) * 3, yy, w2, 1.2); }
  };
  for (const L of luces) {
    const f = L.fuerza(t); if (f < 0.05) continue;
    pozo(L.x, L.y + (L.cono ? 150 : 0), L.r * 0.9, L.color, (L.calida ? 0.1 : 0.08) * f);
    reflejo(L.x, L.y, L.color, 0.22 * f, L.calida ? 90 : 60);
  }
  const p = E.p;
  reflejo(p.x + p.w / 2, p.y + p.h - 4, '#fff1dc', 0.18, 26);
  if (E.id === 1 || E.nivel.frasco18) { if (!intro || intro.roto) pozo(E.inicio.x, E.inicio.pie - 50, 200, zona.calida, 0.08); reflejo(E.inicio.x, E.inicio.pie, zona.calida, 0.25, 50); }
  for (const z of E.zonas) pozo(z.x + z.w / 2, z.y + z.h * 0.45, Math.max(z.w, z.h) * 0.7, zona.fria, 0.1);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  resplandor(W, H, 0.32);
  if (despertar.activo) { despertar.etalonaje(ctx, W, H, zona); return; }      // (lo calido es solo lo que brilla)
  // etalonaje: calido en el laboratorio, frio hacia la anomalia
  const bx = E.nivel.brechaX || 0;
  const sx = (wx) => (wx - cx) * s;
  const g = ctx.createLinearGradient(sx(bx - 500), 0, sx(bx + 700), 0);
  g.addColorStop(0, rgbaHex(zona.calida, 0.22)); g.addColorStop(1, rgbaHex(zona.fria, 0.22));
  ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}

// resplandor: lo brillante, emborronado y sumado
function resplandor(W, H, a) {
  if (despertar.activo) { despertar.resplandor(ctx, lienzo, W, H, 1); return; }   // el de acabado.py: umbral 0,7, dos radios
  const bw = Math.ceil(W / 5), bh = Math.ceil(H / 5);
  if (bloomCv.width !== bw || bloomCv.height !== bh) { bloomCv.width = bw; bloomCv.height = bh; }
  const b = bloomCv.getContext('2d');
  b.filter = 'none'; b.clearRect(0, 0, bw, bh);
  b.filter = 'brightness(0.85) contrast(3.2) blur(3px)';
  b.drawImage(lienzo, 0, 0, bw, bh);
  b.filter = 'none';
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.drawImage(bloomCv, 0, 0, W, H); ctx.restore();
}

// etalonaje de las zonas sin efectos propios: arriba hacia la luz de la zona, abajo hacia su masa
function etalonaje(W, H) {
  if (despertar.activo) { despertar.etalonaje(ctx, W, H, zona); return; }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgbaHex(zona.luz, 0.22)); g.addColorStop(0.55, rgbaHex(zona.niebla, 0.12)); g.addColorStop(1, rgbaHex(zona.masa, 0.35));
  ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}

// motas que brillan y flotan despacio por todo el nivel (una por celda de 150 u, la mitad vacias)
function motas(s, cx, cy) {
  if (despertar.activo) {
    // el despertar: polvo frio, y ambar junto a lo calido (el frasco del 18, los frascos de reserva, las lamparas)
    const extra = [];
    if (E.id === 1 || E.nivel.frasco18) extra.push({ x: E.inicio.x, y: E.inicio.pie - 60, r: 160, f: 0.6, sem: 18 });
    const zl = E.zl ? ZL.luces(E, t) : [];
    despertar.motas(ctx, s, cx, cy, cam.w, cam.h, t, zl.length ? luces.concat(zl) : luces, extra);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return;
  }
  const C = 150;
  ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const col = zona.polvo;
  for (let i = Math.floor(cx / C) - 1; i <= Math.floor((cx + cam.w) / C) + 1; i++) {
    for (let j = Math.floor(cy / C) - 1; j <= Math.floor((cy + cam.h) / C) + 1; j++) {
      const h = hash(i, j, 41); if (h > 0.5) continue;
      const h2 = hash(i, j, 42), h3 = hash(i, j, 43);
      const sube = (t * (6 + h3 * 10) + h2 * C) % C;
      const x = i * C + h2 * C + Math.sin(t * (0.3 + h3 * 0.4) + h * 20) * 18;
      const y = j * C + C - sube;
      const vida = Math.sin((sube / C) * Math.PI);             // aparece y se apaga en su celda
      const a = vida * (0.35 + 0.35 * Math.sin(t * 2 + h * 40));
      if (a < 0.03) continue;
      const r = 1 + h3 * 1.6;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      g.addColorStop(0, rgbaHex(col, a * 0.5)); g.addColorStop(1, rgbaHex(col, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      ctx.fillStyle = rgbaHex(col, a); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// La daga que se carga (anillo que se cierra sobre la punta y, cargada, una estrella que late) y la cura
// (motas de luz calida que van hacia el 18 y un halo que crece hasta la dosis)
function cargaYCura(p) {
  const x = p.x + p.w / 2, y = p.y + 26;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (p.cargaD > 0.12) {
    const k = Math.min(1, p.cargaD / J.estocadaCarga), hx = x + p.cara * 16;
    if (!p.cargadoD) {
      ctx.strokeStyle = `rgba(255,250,240,${0.25 + k * 0.6})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(hx, y, 6 + (1 - k) * 26, 0, 7); ctx.stroke();
    } else {
      const r = 9 + Math.sin(t * 22) * 2.5;
      const g = ctx.createRadialGradient(hx, y, 0, hx, y, r * 2.6);
      g.addColorStop(0, 'rgba(255,250,240,.75)'); g.addColorStop(1, 'rgba(255,250,240,0)');
      ctx.fillStyle = g; ctx.fillRect(hx - r * 3, y - r * 3, r * 6, r * 6);
      ctx.fillStyle = 'rgba(255,252,245,.95)'; ctx.beginPath();
      for (let k2 = 0; k2 < 8; k2++) { const a = k2 * Math.PI / 4 + t * 3, rr = k2 % 2 ? r * 0.25 : r; ctx.lineTo(hx + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    }
  }
  if (p.cura > 0) {
    const k = Math.min(1, p.cura / J.curaT);
    const g = ctx.createRadialGradient(x, y, 0, x, y, 30 + k * 30);
    g.addColorStop(0, `rgba(255,244,226,${0.15 + k * 0.35})`); g.addColorStop(1, 'rgba(255,244,226,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 70, y - 70, 140, 140);
    ctx.fillStyle = 'rgba(255,246,228,.9)';
    for (let i = 0; i < 10; i++) {
      const f = (t * 1.6 + i * 0.137) % 1, a = i * 0.63 + t * 1.5, r = 60 * (1 - f);
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, 1.2 + f * 1.4, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

// GDD: el escarabajo levanta una garra, dibuja un circulo en el suelo despacio y deja de moverse
function circuloDelJefe() {
  const j = E.jefe;
  if (j.estado !== 'vencido') return;
  const k = cine ? Math.max(0, Math.min(1, (cine.t - 3.2) / 3)) : E.circuloJefe ? 1 : 0;
  if (k <= 0) return;
  const x = j.x + j.w / 2 + j.cara * 64, y = j.pie - 2;
  ctx.save();
  ctx.shadowColor = 'rgba(169,205,230,.9)'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.ellipse(x, y, 30, 7, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
  ctx.strokeStyle = 'rgba(200,228,245,.95)'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.restore();
}

function giro(W, H, u, leng) {
  const tt = cine.t;
  // la placa de la bata
  const k = tt < 0.8 ? 0 : tt < 1.6 ? (tt - 0.8) / 0.8 : tt < 6.6 ? 1 : Math.max(0, 1 - (tt - 6.6) / 1);
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, H * 0.72, W, 70 * u);
  ctx.fillStyle = '#efe8da'; ctx.textAlign = 'center';
  ctx.font = `${22 * u}px ${HUD.LETRA}`;
  ctx.fillText(leng === 'es' ? 'Dra. I. Varga — Ilustración' : 'Dr. I. Varga — Illustration', W / 2, H * 0.72 + 42 * u);
  ctx.restore();
}

// ---------------------------------------------------------------- luz: mapa de luz con sombras, haces y vineta
function penumbra(s, cx, cy, W, H) {
  const p = E.p, L = [];
  const mas = (x, y, r, color, f, sombra = false, cono = false, ang = 0) => L.push({ x, y, r, color, f, sombra, cono, ang });
  // las lamparas del nivel: fijas, con sus sombras calculadas una vez
  // las que se balancean (focos.js) recalculan su sombra cada fotograma; quietas, la guardada
  for (const q of luces) mas(q.x, q.y, q.r * 1.3, q.color, Math.min(1.2, q.fuerza(t) * 1.15), q.mueve ? 'viva' : 'fija', !!q.cono, q.ang || 0);
  // GDD: el 18 lleva su propia luz suave (y sus sombras: se ve el borde de cada saliente)
  // (en la zona conectada, con su luz perdida fuera, alumbra la mitad)
  const sinLuz = E.zl && E.zl.eco ? 0.55 : 1, enEscena = !!(prologo && prologo.escenario);
  if (!enEscena) mas(p.x + p.w / 2, p.y + 18, (p.zorro ? 270 : 230) * sinLuz, '#fff1dc', 0.62 * (1 - (p.dentro || 0) * 0.9) * (sinLuz < 1 ? 0.7 : 1), 'viva');
  // el prologo en la calle: faros, el foco del jeep, las bestias, el fogonazo y la explosion
  if (enEscena) for (const q of prologo.luces(cam)) mas(q.x, q.y, q.r, q.color, q.f, false, !!q.cono, q.ang || 0);
  if (E.zl) for (const q of ZL.luces(E, t)) mas(q.x, q.y, q.r, q.color, q.f);
  for (const z of E.zonas) mas(z.x + z.w / 2, z.y + z.h / 2, Math.max(z.w, z.h) / 1.2, '#9fd0ff', E.nivel.zona === 'plaza' ? 0.16 : 0.5);   // (la de la plaza es casi todo el nivel)
  if (!enEscena) for (const it of E.items) if (!it.cogido && !it.oculto) mas(it.x, it.pie - 24, it.tipo === 'tele' ? 220 : 90, '#fff4e2', 0.75);
  if (!enEscena) for (const n of E.notas) mas(n.x, n.pie - 8, 100, '#f2e6cc', 0.5);
  for (const k2 of E.controles) mas(k2.x, k2.pie - 10, k2.activo ? 140 : 80, '#a9cde6', k2.activo ? 0.7 : 0.35);
  if (!enEscena) for (const en of E.enemigos) if (en.vivo && en.tipo !== 'hormiga') mas(en.x + en.w / 2, en.y + 10, 90, '#e2792b', 0.4);
  for (const q of E.proyectiles) mas(q.x, q.y, 70, '#e2792b', 0.6);
  if (E.jefe && E.jefe.despierto) mas(E.jefe.x + E.jefe.w / 2, E.jefe.y + 30, 260, '#c9a27a', 0.55);
  if (E.id === 1 || E.nivel.frasco18) mas(E.inicio.x, E.inicio.pie - 48, 180, '#ffd8a0', intro && !intro.roto ? 0.5 : rotura ? rotura.luzFrasco() : 0.4, 'fija');
  // el liquido derramado alumbra el suelo mientras se apaga
  if (rotura) { const ch = rotura.charco(); if (ch.r > 4) mas(E.inicio.x + 6, E.inicio.pie - 4, 60 + ch.r * 1.4, '#ffc88a', ch.luz * 0.8, 'fija'); }
  for (const r of E.rejillas) if (!r.abierta) mas(r.x, r.pie - 40, 100, '#cfe0f0', 0.4);
  if (E.salida) mas(E.salida.x + 32, E.salida.y + 48, 150, '#f4ead2', 0.4);
  luz.dibujar(ctx, W, H, s, cx, cy, cam.w, cam.h, L, hk.p ? hk : null);
  // las ventanas: lo de fuera, con parallax, EMITE (no lo apaga la penumbra) y va detras de lo ya pintado
  if (hk.p) dibujarVentanas(ctx, E, t, { x: cx, y: cy, w: cam.w, h: cam.h, s }, hk.p);
  if (hk.p) hk.ponerFondo(ctx);     // el fondo, con su propia luz, debajo de lo de delante
  // vineta (el despertar pone la suya, ovalada y fria, al final: despertar.acabado)
  if (!despertar.activo) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // haces de luz con polvo suspendido (GDD: luz con intencion), cortados por lo que tapa la lampara
  ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s);
  if (haces.listo) haces.dibujar(ctx, luces, t, { x: cx, y: cy, w: cam.w, h: cam.h }, luz);
  else {
    // mientras cargan los sprites de Blender, la neblina de antes
    for (const q of luces) {
      if (!q.cono || q.x < cx - 200 || q.x > cx + cam.w + 200) continue;
      const f = q.fuerza(t); if (f < 0.05) continue;
      ctx.save(); luz.recortar(ctx, { x: q.x, y: q.y, r: q.r * 1.3, mueve: q.mueve }); ctx.globalCompositeOperation = 'lighter';
      if (q.ang) { ctx.translate(q.x, q.y); ctx.rotate(q.ang); ctx.translate(-q.x, -q.y); }   // el haz gira con la lampara
      const g2 = ctx.createLinearGradient(0, q.y, 0, q.y + q.r);
      g2.addColorStop(0, rgbaHex(q.color, (q.calida ? 0.13 : 0.08) * f)); g2.addColorStop(1, rgbaHex(q.color, 0));
      ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(q.x - 36, q.y); ctx.lineTo(q.x + 36, q.y); ctx.lineTo(q.x + 140, q.y + q.r); ctx.lineTo(q.x - 140, q.y + q.r); ctx.fill();
      ctx.restore();
    }
  }
  // la luz de las demas lamparas (farol, casa, farolas, emergencia, ventanas, rejillas), tambien de Blender
  haces.dibujarSprites(ctx, luces, t, { x: cx, y: cy, w: cam.w, h: cam.h }, luz);
  // el polvo de los focos (con fisica, iluminado con la luz de Blender) y el de los faroles
  polvoLuz.dibujar(ctx, t, { x: cx, y: cy, w: cam.w, h: cam.h }, luz);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------------------------------------------------------------- arranque
const S = await A.cargarSujeto();
app.son.ambiente('lab');
// la ciudad se empieza a pintar ya en el menu: el prologo de la partida nueva la usa de escenario (?prologo: directo a el)
if (!qs.has('nivel') || qs.has('prologo')) prepararCiudad();
if (qs.has('prologo')) empezarPrologo();
else if (qs.has('nivel')) app.empezar(qs.get('nivel') === 'lab' ? 'lab' : Number(qs.get('nivel')) || 1);
window.__dbg = {
  get E() { return E; }, get rotura() { return rotura; }, app, menu, get cam() { return cam; }, dibujar, congelar(v) { congelado = v; },
  get hack() { return hack; }, get fx() { return fx; },
  get luz() { return luz; }, get vivo() { return vivo; }, get focos() { return focos; }, get polvoLuz() { return polvoLuz; }, get luces() { return luces; }, get intro() { return intro; }, get fondo() { return fondo; }, get terreno() { return terreno; },   // (la intro del nivel 1: __dbg.intro.t para ponerla en un instante)
  centrar() { centrarCamara(true); },
  // la zona conectada: poner al 18 en una casilla (de pie sobre la fila j), abrir el mapa
  ir(i, j) { E.p.x = i * T + 16 - E.p.w / 2; E.p.y = j * T - E.p.h; E.p.vx = 0; E.p.vy = 0; centrarCamara(true); },
  mapa(v = true) { mapa.abierto = v; mapaK = v ? 1 : 0; },
  limpio(v = true) { limpio = v; },
  primerPlano(v = true) { primerPlano = v; },
  zoom(z = 1) { zoomVista = z; centrarCamara(true); },
  mirar(x, y) { cam.x = x - cam.w / 2; cam.y = y - cam.h / 2; dibujar(); },
  quitarFundido() { costura = null; },
  // el prologo: __dbg.prologo.ir(s) lo empieza de nuevo y lo avanza hasta ese instante sin sonido (para las fotos)
  prologo: {
    get p() { return prologo; },
    async ir(T) {
      while (!ciudadListo() && !ciudadFallo()) await new Promise((r) => setTimeout(r, 100));
      empezarPrologo(); prepararPrologo(); prologo.mudo = true;
      for (let k = 0, n = Math.round(T / DT); k < n && prologo; k++) pasoJuego(t += DT);
      if (prologo) prologo.mudo = false;
      dibujar();
      return prologo ? { t: +prologo.t.toFixed(2), fase: prologo.fase, cam: { x: Math.round(cam.x), y: Math.round(cam.y) }, intro: intro ? +intro.t.toFixed(2) : null } : { intro: intro ? intro.t : null };
    },
    avanzar(s) { for (let k = 0, n = Math.round(s / DT); k < n; k++) pasoJuego(t += DT); dibujar(); return prologo ? +prologo.t.toFixed(2) : null; },
  },
  pasos(n, teclas = []) { for (const q of teclas) if (!pulsado[q]) pendiente[q] = true; for (let k = 0; k < n; k++) { for (const q of teclas) pulsado[q] = true; fundido = Math.max(0, fundido - DT * 1.5); pasoJuego(t += DT); } for (const q of teclas) pulsado[q] = false; dibujar(); },
};
requestAnimationFrame(bucle);
