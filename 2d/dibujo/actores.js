// Todo lo que se mueve. El Sujeto 18 es la unica imagen del juego (sus hojas de sprites salen de su
// modelo de Blender); lo demas, enemigos, jefe, tornillos, autobus, objetos, se dibuja a tinta.
import { dibujarTornilloBonito, dibujarGiganteBonito } from './tornillos.js';
import { dibujarGarfio } from './gancho.js';
import { dibujarAutobus } from './autobus.js';
import { dibujarCompuerta } from './compuerta.js';
import { T, J } from '../sim/constantes.js';
import { TINTA, GROSOR, caja, linea, circulo, temblar, trazar, trazarSuave, tinta, hash, azar, rgba, mezclar } from './tinta.js';
import { COLOR, ZONAS } from './paletas.js';
import { dibujarAsset } from './decorado.js';
import { dibujarCoche } from './coche.js';
import { losa, vigaH, burbuja } from './escombros.js';
import { poseCuerpo } from './sentir.js';

// ---------------------------------------------------------------- el 18
export async function cargarSujeto(base = 'img/sujeto/') {
  const datos = await (await fetch(base + 'sujeto.json')).json();
  const hojas = {};
  await Promise.all(Object.keys(datos.anims).map((n) => new Promise((ok, mal) => {
    const im = new Image();
    im.onload = () => { hojas[n] = im; ok(); };
    im.onerror = mal;
    im.src = base + n + '.webp';
  })));
  return { datos, hojas, k: 64 / datos.px_por_metro };
}

// UNA HOJA EN TROZOS YA DESCOMPRIMIDOS (2026-10-20). La hoja `intro` (3376 x 3344, 45 MB sin comprimir) se pinta al
// preparar el prologo y no vuelve a usarse hasta 47 s despues, cuando cae la piedra; para entonces Chrome ha soltado
// lo que tenia descomprimido de una imagen sin usar y la vuelve a descomprimir en el hilo principal: 231 ms de tiron
// justo al soltarse la piedra (medido con GPU y perfil de CPU). createImageBitmap descomprime fuera del hilo y lo que da
// no se suelta; en trozos de un fotograma, la tarjeta solo recibe el que se pinta. soltarTrozos los libera al acabar.
export function trocearHoja(S, anim) {
  const a = S.datos.anims[anim], im = S.hojas[anim];
  if (!a || !im || typeof createImageBitmap !== 'function' || (S.trozos && S.trozos[anim])) return;
  S.trozos = S.trozos || {};
  const [fw, fh] = a.fotograma, lista = S.trozos[anim] = [];
  // UNA descompresion de la hoja entera y de ella los recortes (recortar la <img> 60 veces la descomprimia entera en
  // cada una: 60 x 45 MB a la vez colgaron Chrome)
  createImageBitmap(im).then(async (hoja) => {
    for (let i = 0; i < a.fotogramas && S.trozos[anim] === lista; i++) {
      const b = await createImageBitmap(hoja, (i % a.cols) * fw, Math.floor(i / a.cols) * fh, fw, fh);
      if (S.trozos[anim] === lista) lista[i] = b; else b.close();
    }
    hoja.close();
  }).catch(() => {});
}
export function soltarTrozos(S, anim) {
  const l = S.trozos && S.trozos[anim];
  if (!l) return;
  delete S.trozos[anim];
  for (const b of l) if (b) b.close();
}

const POSE_ANIM = { trepar_quieto: 'trepar', reposo: 'reposo2', caer: 'caer2', giro: 'arranque' };
// si una hoja no esta (sprites viejos), la mas parecida
const RESPALDO = {
  reposo2: 'reposo', caer2: 'caer', correr: 'andar', arranque: 'andar', frenar: 'aterriza', giro: 'reposo', despegue: 'salto',
  subir: 'salto', cumbre: 'salto', doble: 'salto', aterriza_fuerte: 'aterriza', ataque2: 'ataque', dash: 'ataque', muerte: 'dano',
  empuje: 'flotar', flotar_entra: 'flotar', remate: 'ataque2',
};
// Los tajos aciertan en su PRIMER fotograma de simulacion (la caja sale al pulsar) y el paron congela la
// pose: si la hoja empezaba en su fotograma 0 (el 18 aun quieto), el golpe se veia con el 18 sin moverse.
// Estas hojas empiezan en el fotograma que ya lanza el brazo; el remate trae su preparacion (fotogramas 0-1,
// los 4 de simulacion que tarda en salir) y corta en el 2.
const ARRANCA = { ataque: 1, ataque2: 1, ataque_arriba: 1, ataque_abajo: 1 };
const REMATE_CORTA = 2;

// La forma zorro tiene sus propias hojas (tools/sprites_zorro.py, del modelo escuela/obras/zorro18):
// cada pose del 18 va a la del zorro que hace lo mismo
const ZORRO_ANIM = {
  reposo: 'zorro_reposo', reposo2: 'zorro_reposo', leer: 'zorro_reposo', andar: 'zorro_correr', correr: 'zorro_correr',
  arranque: 'zorro_correr', giro: 'zorro_correr', frenar: 'zorro_frenar', salto: 'zorro_despegue', despegue: 'zorro_despegue',
  subir: 'zorro_subir', doble: 'zorro_subir', cumbre: 'zorro_cumbre', caer: 'zorro_caer', caer2: 'zorro_caer', flotar: 'zorro_caer',
  empuje: 'zorro_dash', flotar_entra: 'zorro_caer',
  aterriza: 'zorro_aterriza', aterriza_fuerte: 'zorro_aterriza', ataque: 'zorro_ataque', ataque2: 'zorro_ataque',
  ataque_arriba: 'zorro_ataque', ataque_abajo: 'zorro_ataque', remate: 'zorro_ataque', dash: 'zorro_dash', dano: 'zorro_dano', muerte: 'zorro_dano',
  trepar: 'zorro_trepar',
};
export const tieneZorro = (S) => !!S.datos.anims.zorro_reposo;

export function fotograma(S, pose, tPose, p) {
  let anim = POSE_ANIM[pose] || pose;
  if (!S.datos.anims[anim]) anim = RESPALDO[anim] || 'reposo';
  if (!S.datos.anims[anim]) anim = 'reposo';
  if (p && p.zorro && tieneZorro(S)) {
    const z = ZORRO_ANIM[anim] || 'zorro_reposo';
    const a = S.datos.anims[S.datos.anims[z] ? z : 'zorro_reposo'];
    const nombre = S.datos.anims[z] ? z : 'zorro_reposo';
    let i;
    if (nombre === 'zorro_cumbre') i = Math.max(0, Math.min(a.fotogramas - 1, Math.floor(((p.vy + 260) / 500) * a.fotogramas)));
    else if (pose === 'trepar_quieto') i = 0;
    else if (a.bucle) i = Math.floor(tPose * a.fps) % a.fotogramas;
    else i = Math.min(a.fotogramas - 1, Math.floor(tPose * a.fps));
    return { anim: nombre, a, i };
  }
  const a = S.datos.anims[anim];
  let i;
  if (anim === 'salto') i = p && p.vy < -420 ? 2 : 3;
  else if (anim === 'cumbre' && p) i = Math.max(0, Math.min(a.fotogramas - 1, Math.floor(((p.vy + 260) / 500) * a.fotogramas)));
  else if (pose === 'trepar_quieto') i = 0;
  else if (pose === 'giro') i = 1;
  else if (anim === 'remate') {
    // la preparacion dura lo que la simulacion tarda en cortar (J.remataAnticipa) y luego va a sus fps
    const prep = J.remataAnticipa;
    i = tPose < prep ? Math.min(REMATE_CORTA - 1, Math.floor((tPose / prep) * REMATE_CORTA)) : Math.min(a.fotogramas - 1, REMATE_CORTA + Math.floor((tPose - prep) * a.fps));
  } else if (ARRANCA[anim] && pose.startsWith('ataque')) i = Math.min(a.fotogramas - 1, ARRANCA[anim] + Math.floor(tPose * a.fps));
  else if (a.bucle) i = Math.floor(tPose * a.fps) % a.fotogramas;
  else i = Math.min(a.fotogramas - 1, Math.floor(tPose * a.fps));
  return { anim, a, i };
}

export function dibujarSprite(c, S, anim, i, x, pie, cara, s, alfa = 1, brillo = true, def = null) {
  const a = S.datos.anims[anim];
  const im = S.hojas[anim];
  const [fw, fh] = a.fotograma;
  const sx = (i % a.cols) * fw, sy = Math.floor(i / a.cols) * fh;
  const k = S.k;
  c.save();
  c.translate(x, pie);
  if (def) {
    if (def.dy) c.translate(0, def.dy);
    if (def.gz) {
      // en gravedad cero no hay pies en el suelo: gira, estira y aplasta alrededor del centro del cuerpo
      c.translate(0, -26); c.rotate(def.rot || 0); c.scale(def.sx || 1, def.sy || 1); c.translate(0, 26);
    } else {
      // estirar y aplastar desde los pies; inclinar alrededor del centro del cuerpo
      if (def.rot) { c.translate(0, -26); c.rotate(def.rot); c.translate(0, 26); }
      c.scale(def.sx || 1, def.sy || 1);
    }
    if (def.filtro) c.filter = def.filtro;
  }
  if (cara < 0) c.scale(-1, 1);
  c.globalAlpha = alfa;
  if (brillo) {
    // GDD: lo mas luminoso de la pantalla, con un borde de luz blanca suave
    c.shadowColor = 'rgba(255,246,228,.85)';
    c.shadowBlur = 9 * s;
  }
  const tz = S.trozos && S.trozos[anim] && S.trozos[anim][i];
  if (tz) c.drawImage(tz, -a.pies[0] * k, -a.pies[1] * k, fw * k, fh * k);
  else c.drawImage(im, sx, sy, fw, fh, -a.pies[0] * k, -a.pies[1] * k, fw * k, fh * k);
  c.restore();
}

// Lo que el sprite no trae: estirar al despegar, aplastar al caer, alargarse en el dash, inclinarse un
// poco en el aire hacia donde va, y el destello blanco del golpe
export function deformacion(p) {
  let sx = 1, sy = 1, rot = 0, filtro = null;
  const v = p.vis;
  // el GIRO (animarGiro): `lado` va de -1 a 1 en lugar de saltar; el ancho es su seno (empieza y acaba
  // despacio), con el signo relativo a donde mira ya la simulacion. No baja del 30 % de ancho: a mitad
  // salta de un lado al otro estrecho, como visto casi de frente (llegando a cero era un papel de canto).
  // En medio se encoge algo de alto.
  const gs = v && v.lado !== undefined ? Math.sin((Math.PI / 2) * v.lado) * (p.cara < 0 ? -1 : 1) : 1;
  const g = (gs < 0 ? -1 : 1) * (0.3 + 0.7 * Math.abs(gs));
  const enGiro = 1 - Math.abs(gs);
  if (v && p.gz) {
    // gravedad cero (animarGz): girado hacia donde va, estirado o aplastado por su muelle y meciendose
    if (p.invul > J.invul - 0.09 && p.aturdido > 0) filtro = 'brightness(3.2) saturate(0)';
    return { gz: true, rot: v.rot, sx: (1 - v.est * 0.6) * g, sy: (1 + v.est) * (1 - 0.06 * enGiro), dy: Math.sin(v.t * 1.7 + v.fase) * 2.4 * v.enGz, filtro };
  }
  if (v) rot += v.rot;            // recien salido de la zona: el giro que quede se endereza enseguida
  if (p.sunikel > 0 || p.tele > 0) { sx = 1.16; sy = 0.9; }
  else if (!p.enSuelo && !p.trepa && !p.cuerda && !p.gz) {
    if (p.tSalto > 0) { sy = 1.14; sx = 0.88; }
    else if (p.vy < -200) { const e = Math.min(1, -p.vy / 720) * 0.08; sy = 1 + e; sx = 1 - e * 0.7; }
    else if (p.vy > 300) { const e = Math.min(1, p.vy / 820) * 0.06; sy = 1 + e; sx = 1 - e * 0.6; }
    rot += Math.max(-1, Math.min(1, p.vx / 380)) * 0.07;
  }
  if (p.tAterriza > 0 && p.enSuelo) {
    const a = p.tAterriza / 0.18, f = p.caidaFuerte ? 1.5 : 1;
    sy = 1 - 0.15 * a * f; sx = 1 + 0.13 * a * f;
  }
  // el pogo: sale estirado hacia arriba del rebote; el embate del remate: alargado hacia delante
  if (p.tPogo > 0) { const a = p.tPogo / 0.14; sy *= 1 + 0.2 * a; sx *= 1 - 0.15 * a; }
  if (p.embate > 0) { sx *= 1.12; sy *= 0.93; }
  if (p.invul > J.invul - 0.09 && p.aturdido > 0) filtro = 'brightness(3.2) saturate(0)';
  sx *= g; sy *= 1 - 0.05 * enGiro;
  return { sx, sy, rot, filtro };
}

// ---- GRAVEDAD CERO (2026-10-18). La hoja de perfil trae la postura y la tela que ondula; lo que depende de
// hacia donde va lo pone esto, con un muelle por cosa (giro y estiron) para que todo llegue algo tarde y se
// pase un poco, que es lo que se lee como "sin peso":
// - flotando se inclina hacia donde se mueve de lado y va a la deriva con un giro lento propio;
// - tras un EMPUJON apunta el cuerpo hacia donde sale (la cabeza delante, como al nadar) mientras va
//   deprisa, estirado, y se endereza solo al frenar;
// - un CHOQUE lo aplasta contra la pared y le hace girar hacia atras.
// main.js llama a animarGz a 60 Hz y golpeGz con los eventos; deformacion() y la estela lo leen de p.vis.
const envuelve = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const visGz = (p) => p.vis || (p.vis = { rot: 0, vrot: 0, est: 0, vest: 0, enGz: 0, dir: null, fase: Math.random() * 6.28, t: 0, lado: undefined, caraAnt: p.cara });

// ---- GIRO al cambiar de sentido (2026-10-18, el usuario: "que no sea frame cortado"). La simulacion
// cambia `cara` de golpe; el dibujo lleva `lado` de un lado al otro en `dur` s y deformacion() pinta el
// volteo (el giro de Blender se descarto: de frente el calco se emborrona). Si vuelve a cambiar a medias,
// se deshace desde donde iba. En el suelo es seco, como el giro de la carrera; en el aire algo mas lento;
// sin gravedad, lento y con un balanceo del cuerpo hacia el lado nuevo.
export function animarGiro(p, dt) {
  const v = visGz(p);
  if (v.lado === undefined || p.tele > 0 || p.sunikel > 0 || p.estocada > 0 || p.muerto || p.leyendo) {
    v.lado = p.cara; v.caraAnt = p.cara; return;
  }
  if (p.cara !== v.caraAnt) {
    if (p.gz) { v.vrot += p.cara * 2.4; v.vest -= 0.7; }
    v.caraAnt = p.cara;
  }
  const dur = p.gz ? 0.28 : p.enSuelo ? 0.11 : 0.16;
  const paso = (2 / dur) * dt;
  v.lado = p.cara > v.lado ? Math.min(p.cara, v.lado + paso) : Math.max(p.cara, v.lado - paso);
}

export function golpeGz(p, e) {
  const v = visGz(p);
  if (e.t === 'empuje') {
    v.dir = { x: e.dx, y: e.dy };
    v.vest += 2.6;                                  // el estiron se pasa y vuelve
  } else if (e.t === 'choca_gz') {
    const f = Math.min(1, e.v / 420);
    v.vest -= 5.5 * f;                              // se aplasta contra lo que toca
    // la cabeza va hacia atras: de lado contra la pared, o segun mira contra el techo y el suelo
    v.vrot += e.nx ? e.nx * 3.2 * f : (e.ny > 0 ? -p.cara : p.cara) * 2.4 * f;
    v.dir = null;
  }
}

export function animarGz(p, dt, t) {
  const v = visGz(p);
  v.t = t;
  let meta = 0, estMeta = 0, rigidez = 34, amort = 6.5;
  if (p.gz) {
    v.enGz = Math.min(1, v.enGz + dt * 3);
    meta = Math.max(-1, Math.min(1, p.vx / 320)) * 0.3 + Math.sin(t * 0.55 + v.fase) * 0.07 + Math.sin(t * 0.21 + v.fase * 2) * 0.05;
    if (v.dir) {
      const d = v.dir, rapido = (p.vx * d.x + p.vy * d.y) / J.gzEmpuje;
      const k = suave((rapido - 0.18) / 0.5);
      if (k <= 0 && p.tEmpuje <= 0) v.dir = null;
      else {
        // la cabeza delante en todas direcciones (la hoja `empuje` deja la capa y la capucha hacia los pies);
        // recto hacia abajo da la vuelta por delante
        const a = (Math.abs(d.x) < 0.01 && d.y > 0 ? (p.cara < 0 ? -Math.PI : Math.PI) : Math.atan2(d.x, -d.y)) * 0.85;
        meta += envuelve(a - meta) * k;
        estMeta = 0.1 * k;
        // recien empujado se orienta deprisa (un muelle duro); al frenar vuelve el blando y se endereza despacio
        rigidez += 130 * k; amort += 11 * k;
      }
    }
  } else {
    v.enGz = Math.max(0, v.enGz - dt * 4); v.dir = null; rigidez = 110; amort = 18;
  }
  v.vrot += (envuelve(meta - v.rot) * rigidez - v.vrot * amort) * dt;
  v.rot = envuelve(v.rot + v.vrot * dt);
  v.vest += ((estMeta - v.est) * 60 - v.vest * 7) * dt;
  v.est = Math.max(-0.22, Math.min(0.26, v.est + v.vest * dt));
}

// El cambio de forma (18 -> zorro; al volver, la misma hoja hacia atras). `cambio` lo lleva main.js:
// { t: segundos desde la tecla, hacia: 1 al zorro, -1 al 18 }. Devuelve el fotograma o null si acabo.
// El cambio de forma (18 <-> zorro), segunda version (usuario 2026-10-17: "haz otra animacion, que este
// guapo"). Todo en el lienzo, encima del sprite REAL de la accion en curso (andar, correr, saltar sigue
// animado) y con las hojas del zorro calcado. `cambio` lo lleva main.js: { t: segundos, hacia: 1 al zorro,
// -1 al 18 }; k va de 0 (18) a 1 (zorro) y al volver se recorre al reves.
//   0,00-0,40  FUEGO FATUO: llamitas de luz crema nacen a los pies y suben en espiral alrededor (por
//              delante y por detras del cuerpo); le crece un aura blanca.
//   0,30-0,78  LA COLA: una cola de zorro hecha de luz da una vuelta entera alrededor del cuerpo; lo que
//              ya ha barrido es la otra forma (recorte por sectores), el canto suelta chispas.
//   0,72-1,00  CIERRE: anillo de luz en el suelo, las llamitas suben y se deshacen, el aura se apaga.
const suave = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const campana = (x, a, b) => (x <= a || x >= b ? 0 : Math.sin(Math.PI * (x - a) / (b - a)) ** 2);
const UM = 64;                 // unidades del juego por metro (S.k * px_por_metro)
const CZ = 0.45 * UM;          // centro del cambio sobre los pies
export const CAMBIO_DUR = 1.15;
const rgbaLuz = (a) => 'rgba(255,244,222,' + Math.max(0, Math.min(1, a)) + ')';

// k del cambio 18 -> zorro (0-1; al volver al 18 va de 1 a 0), o null si no hay cambio en curso
export function cambioK(S, cambio) {
  if (!cambio || cambio.t >= CAMBIO_DUR) return null;
  const u = cambio.t / CAMBIO_DUR;
  return cambio.hacia > 0 ? u : 1 - u;
}
export const fotogramaCambio = (S, cambio) => (cambioK(S, cambio) === null ? null : { k: cambioK(S, cambio) });

// una llamita de fuego fatuo: gota de luz que apunta arriba, con nucleo blanco
function llama(c, x, y, r, a, t, i) {
  if (a <= 0.01 || r <= 0.2) return;
  const f = 1 + 0.18 * Math.sin(t * 23 + i * 1.7);
  const h = r * 2.6 * f;
  c.save();
  c.translate(x, y);
  c.rotate(0.12 * Math.sin(t * 9 + i));
  const g = c.createRadialGradient(0, -h * 0.22, 0, 0, -h * 0.22, h * 0.75);
  g.addColorStop(0, rgbaLuz(a));
  g.addColorStop(0.35, 'rgba(255,232,190,' + 0.75 * a + ')');
  g.addColorStop(1, 'rgba(255,220,170,0)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0, -h);
  c.bezierCurveTo(r * 0.9, -h * 0.45, r, r * 0.2, 0, r);
  c.bezierCurveTo(-r, r * 0.2, -r * 0.9, -h * 0.45, 0, -h);
  c.fill();
  c.restore();
}

// las llamitas: (detras = true) las que en su vuelta pasan por detras del cuerpo
function fuegoFatuo(c, x, cy, k, t, cara, detras) {
  const N = 11;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) {
    const h = hash(i, 71), nace = 0.02 + 0.22 * h;
    const vida = (k - nace) / 0.72;
    if (vida <= 0 || vida >= 1) continue;
    const ang = i * 2.399 + vida * 7.5 * (1 + 0.3 * hash(i, 5)) * cara;
    const prof = Math.sin(ang);
    if ((prof < 0) !== detras) continue;
    const sube = vida < 0.7 ? suave(vida / 0.7) : 1;
    const rx = (30 + 10 * hash(i, 9)) * (1 - 0.35 * sube) + 22 * suave((vida - 0.7) / 0.3);
    const yy = cy + CZ - 4 - sube * (CZ * 2.1) - 40 * suave((vida - 0.7) / 0.3);
    const xx = x + Math.cos(ang) * rx;
    const a = Math.sin(Math.PI * vida) ** 0.6 * (0.55 + 0.45 * (prof + 1) / 2);
    llama(c, xx, yy, (2.4 + 1.6 * hash(i, 3)) * (0.75 + 0.25 * (prof + 1) / 2), a, t, i);
  }
  c.restore();
}

// la cola de luz: un penacho con forma de cola de zorro (fino en la punta, gordo en medio, se deshace en
// el arranque) que gira alrededor del centro; `a` es el angulo de la punta, que va delante
function colaDeLuz(c, x, cy, a, fuerza, t, cara) {
  if (fuerza <= 0.01) return;
  const R = 44, LARGO = 2.5, ANCHO = 26;     // radio de la vuelta, lo que ocupa (rad), grueso maximo
  const N = 40;
  const punto = (u, lado) => {                // u: 0 punta .. 1 arranque; lado: -1 dentro .. 1 fuera
    const ang = a - cara * LARGO * u;
    const w = ANCHO * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 0.75) * (1 - 0.35 * u);
    const ola = Math.sin(u * 9 - t * 12) * 2.2 * u;
    const r = R + lado * w / 2 + ola + 3 * Math.sin(Math.PI * u);
    return [x + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.92];
  };
  c.save(); c.globalCompositeOperation = 'lighter';
  // el cuerpo de la cola: relleno con degradado de la punta (luz) al arranque (se apaga)
  const [px0, py0] = punto(0, 0), [px1, py1] = punto(1, 0);
  const g = c.createLinearGradient(px0, py0, px1, py1);
  g.addColorStop(0, rgbaLuz(0.85 * fuerza));
  g.addColorStop(0.45, 'rgba(255,232,196,' + 0.5 * fuerza + ')');
  g.addColorStop(1, 'rgba(255,226,180,0)');
  c.fillStyle = g;
  c.beginPath();
  for (let j = 0; j <= N; j++) { const [qx, qy] = punto(j / N, 1); if (j) c.lineTo(qx, qy); else c.moveTo(qx, qy); }
  for (let j = N; j >= 0; j--) { const [qx, qy] = punto(j / N, -1); c.lineTo(qx, qy); }
  c.closePath();
  c.shadowColor = 'rgba(255,236,200,' + 0.9 * fuerza + ')'; c.shadowBlur = 14;
  c.fill();
  c.shadowBlur = 0;
  // mechones: pinceladas finas de la punta hacia atras, que se abren en el arranque
  c.lineCap = 'round';
  for (let m = 0; m < 7; m++) {
    const lado = (m / 6) * 1.6 - 0.8;
    c.beginPath();
    for (let j = 0; j <= N; j++) {
      const u = j / N;
      const [qx, qy] = punto(u, lado * (0.3 + 0.7 * u) + Math.sin(u * 7 + m) * 0.08);
      if (j) c.lineTo(qx, qy); else c.moveTo(qx, qy);
    }
    c.lineWidth = 1.1; c.strokeStyle = rgbaLuz(0.55 * fuerza); c.stroke();
  }
  // la punta: un brillo
  const g2 = c.createRadialGradient(px0, py0, 0, px0, py0, 18);
  g2.addColorStop(0, rgbaLuz(fuerza)); g2.addColorStop(1, 'rgba(255,236,200,0)');
  c.fillStyle = g2; c.fillRect(px0 - 18, py0 - 18, 36, 36);
  c.restore();
}

// chispas que suelta el canto de la cola: deterministas en k (salen en su sitio y vuelan hacia fuera)
function chispasCola(c, x, cy, k, aDe) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let j = 0; j < 34; j++) {
    const kj = 0.30 + 0.48 * (j / 34);              // cuando salio
    const edad = (k - kj) / 0.22;
    if (edad <= 0 || edad >= 1) continue;
    const ang = aDe(kj) + (hash(j, 13) - 0.5) * 0.4;
    const r = 44 + 10 * (hash(j, 17) - 0.5) + edad * (18 + 22 * hash(j, 19));
    const px = x + Math.cos(ang) * r, py = cy + Math.sin(ang) * r * 0.92 - edad * edad * 14;
    const al = (1 - edad) ** 1.4, rr = 1.1 + 1.3 * hash(j, 23);
    c.fillStyle = rgbaLuz(al);
    c.beginPath(); c.arc(px, py, rr * (1 - 0.5 * edad), 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

function dibujarCambio(c, S, p, k, t, s, x, pie) {
  const cy = pie - CZ;
  const cara = p.cara < 0 ? -1 : 1;
  const forma = (zorro) => fotograma(S, p.pose, p.tPose, { ...p, zorro });
  const humano = forma(false), zorro = forma(true);
  const def = deformacion(p);
  // la cola da una vuelta entera de 0,30 a 0,78, empezando abajo y detras
  const a0 = Math.PI / 2 + cara * Math.PI * 0.15;
  const vuelta = (kk) => suave((kk - 0.30) / 0.48);
  const aDe = (kk) => a0 + cara * 2 * Math.PI * vuelta(kk);
  const barrido = vuelta(k), a = aDe(k);
  const aura = campana(k, 0.05, 0.98) * 0.9;

  // luz de fondo que respira
  c.save(); c.globalCompositeOperation = 'lighter';
  const fondo = c.createRadialGradient(x, cy, 0, x, cy, 80);
  fondo.addColorStop(0, rgbaLuz(0.32 * aura)); fondo.addColorStop(1, 'rgba(255,236,200,0)');
  c.fillStyle = fondo; c.fillRect(x - 90, cy - 90, 180, 180);
  c.restore();
  fuegoFatuo(c, x, cy, k, t, cara, true);

  // aura: la silueta blanca y difuminada detras del cuerpo
  const silueta = (f, alfa) => dibujarSprite(c, S, f.anim, f.i, x, pie, p.cara, s, alfa, false, { ...def, filtro: 'brightness(0) invert(1) blur(5px)' });
  const pinta = (f) => {
    if (aura > 0.02) silueta(f, aura);
    dibujarSprite(c, S, f.anim, f.i, x, pie, p.cara, s, 1, true, def);
  };
  // las dos formas, recortadas por el angulo de la cola: lo barrido es el zorro
  const sector = (desde, hasta) => {
    c.beginPath(); c.moveTo(x, cy);
    c.arc(x, cy, 200, desde, hasta, cara < 0);
    c.closePath();
  };
  if (barrido <= 0) pinta(humano);
  else if (barrido >= 1) pinta(zorro);
  else {
    c.save(); sector(a, a0 + cara * 2 * Math.PI); c.clip(); pinta(humano); c.restore();
    c.save(); sector(a0, a); c.clip(); pinta(zorro); c.restore();
    // brillo blanco que recorre el cuerpo justo detras del canto
    c.save(); sector(a - cara * 0.55, a); c.clip();
    c.globalCompositeOperation = 'lighter';
    dibujarSprite(c, S, zorro.anim, zorro.i, x, pie, p.cara, s, 0.75, false, { ...def, filtro: 'brightness(0) invert(1)' });
    c.restore();
  }
  colaDeLuz(c, x, cy, a, campana(k, 0.27, 0.82) * 1.15, t, cara);
  chispasCola(c, x, cy, k, aDe);
  fuegoFatuo(c, x, cy, k, t, cara, false);
  // anillo en el suelo al cerrar
  const an = (k - 0.72) / 0.28;
  if (an > 0 && an < 1) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.lineWidth = 2.2 * (1 - an); c.strokeStyle = rgbaLuz(0.8 * (1 - an));
    c.beginPath(); c.ellipse(x, pie, 8 + 62 * suave(an), 3 + 9 * suave(an), 0, 0, Math.PI * 2); c.stroke();
    c.restore();
  }
  return k < 0.5 ? humano : zorro;
}

export function dibujarSujeto(c, S, p, t, s, rastro, cambio = null) {
  let { anim, i } = fotograma(S, p.pose, p.tPose, p);
  const k = cambioK(S, cambio);
  const x = p.x + p.w / 2, pie = p.y + p.h;
  // estela (teletransporte, Sunikel, dash, zorro corriendo)
  for (const r of rastro) dibujarSprite(c, S, r.anim, r.i, r.x, r.pie, r.cara, s, r.a * 0.45, false, r.def);
  if (k !== null && tieneZorro(S)) {
    const f = dibujarCambio(c, S, p, k, t, s, x, pie);
    return { anim: f.anim, i: f.i, x, pie };
  }
  const luzZorro = p.zorro && !tieneZorro(S);       // sin hojas del zorro: el 18 con orejas y cola de luz
  if (luzZorro) zorroDetras(c, p, t, s);
  let alfa = 1;
  if (p.invul > 0 && !p.muerto && p.tele <= 0 && p.sunikel <= 0 && p.invul < J.invul - 0.09) alfa = Math.floor(t * 18) % 2 ? 0.45 : 1;
  // el giro es un volteo (animarGiro): la anchura pasa de -1 a 1 (empieza mirando al lado de antes)
  const def = deformacion(p);
  dibujarSprite(c, S, anim, i, x, pie, p.cara, s, alfa, true, def);
  if (luzZorro) zorroDelante(c, p, t, s);
  if (p.carga > 0.08) {
    const k = Math.min(1, p.carga / J.sunikelCarga);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, p.y + 26, 0, x, p.y + 26, 18 + k * 26);
    g.addColorStop(0, `rgba(190,225,255,${0.25 + k * 0.4})`); g.addColorStop(1, 'rgba(190,225,255,0)');
    c.fillStyle = g; c.fillRect(x - 50, p.y - 24, 100, 100);
    c.restore();
  }
  return { anim, i, x, pie };
}

function zorroDetras(c, p, t, s) {
  // la cola de luz: tres curvas que ondean detras
  const x = p.x + p.w / 2 - p.cara * 8, y = p.y + 34;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const ond = Math.sin(t * 7 + k) * 6 + (p.vx ? -6 : 0);
    c.beginPath(); c.moveTo(x, y);
    c.bezierCurveTo(x - p.cara * 18, y + 4 + k * 2, x - p.cara * 30, y - 10 + ond, x - p.cara * (40 + k * 4), y - 24 + ond - k * 3);
    c.lineWidth = 7 - k * 2; c.strokeStyle = `rgba(200,230,255,${0.32 - k * 0.07})`; c.lineCap = 'round'; c.stroke();
  }
  c.restore();
}
function zorroDelante(c, p, t, s) {
  // orejas de luz sobre la capucha
  const x = p.x + p.w / 2 + p.cara * 3, y = p.y + 2;
  c.save(); c.globalCompositeOperation = 'lighter';
  c.shadowColor = 'rgba(180,220,255,.9)'; c.shadowBlur = 8 * s;
  c.fillStyle = 'rgba(225,240,255,.75)';
  for (const d of [-1, 1]) {
    const ox = x + d * 6 * p.cara;
    c.beginPath(); c.moveTo(ox - 4, y + 6); c.lineTo(ox + d * 2 + Math.sin(t * 3 + d) * 1, y - 10); c.lineTo(ox + 4, y + 6); c.closePath(); c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- enemigos
// destello del golpe: BLANCO con su tinta encima los 2 primeros fotogramas de simulacion (el paron los
// alarga) y luego un brillo que baja hasta apagarse. (La silueta blanca entera, invert, se comia la forma:
// en las capturas la hormiga era una mancha.)
const BLANCO = 'grayscale(1) brightness(2.6) contrast(1.25)';
function filtroGolpe(queda, total) {
  if (total - queda < 0.034) return BLANCO;
  return `brightness(${(1 + 1.1 * (queda / total)).toFixed(2)})`;
}
// la reaccion del cuerpo (o.rx, de sentir.js) alrededor de su punto de apoyo (px, py)
function ponerPoseCuerpo(c, o, px, py) {
  const r = poseCuerpo(o);
  if (!r) return;
  c.translate(px + r.dx, py); c.rotate(r.rot); c.scale(r.sx, r.sy); c.translate(-px, -py);
}
// un enemigo muerto que cae (efectos.js, restos): su dibujo girado alrededor de su centro y apoyado en el
// suelo de su caja; blanco al principio, luego oscurecido, y al final se desvanece
export function dibujarResto(c, r, t, s) {
  const f = DIB[r.tipo], en = r.en;
  if (!f) return;
  c.save();
  if (r.tipo === 'tallo') {
    // se dobla por la base y se hunde
    const px = en.x + en.w / 2, py = en.y + en.h;
    c.translate(px, py + Math.max(0, r.t - 0.3) * 30); c.rotate(r.rot); c.translate(-px, -py);
  } else {
    const a = r.rot, medio = Math.abs(Math.cos(a)) * en.h / 2 + Math.abs(Math.sin(a)) * en.w / 2;
    const px = en.x + en.w / 2, py = en.y + en.h - medio;
    c.translate(px, py); c.rotate(a); c.translate(-px, -(en.y + en.h / 2));
  }
  c.globalAlpha = r.alfa;
  c.filter = r.t < 0.05 ? BLANCO : `brightness(${(0.5 + 0.5 * Math.max(0, 1 - r.t / 0.5)).toFixed(2)}) saturate(0.6)`;
  f(c, en, t, s);
  c.restore();
}

export function dibujarEnemigo(c, en, t, s) {
  if (!en.vivo) return;
  const f = DIB[en.tipo];
  // el golpe: destello de la criatura sola (antes era un rectangulo blanco encima de todo)
  if (f) {
    c.save();
    // el golpe (2026-10-18): BLANCO entero los 2 primeros fotogramas de simulacion (y todo el paron, que los
    // congela) y luego un brillo que se apaga; antes era un brillo de 0,18 s que en el paron no se distinguia
    if (en.golpe > 0) c.filter = filtroGolpe(en.golpe, en.golpe0 || 0.18);
    // se hincha antes de atacar (tallo que va a escupir, espora que va a lanzarse) y se tambalea aturdido
    const hincha = en.tipo === 'tallo' && en.apunta > 0 ? 1 + (1 - en.apunta / 0.35) * 0.18 : en.tipo === 'espora' && en.estado === 'hincha' ? 1 + Math.min(1, en.t / 0.5) * 0.45 + Math.sin(t * 40) * 0.04 : 1;
    const tambalea = en.estado === 'aturdido' ? Math.sin(en.t * 9) * 0.08 : 0;
    // la hormiga espantada sale despedida dando una vuelta entera hacia atras y cae de pie
    const vuelta = en.tipo === 'hormiga' && en.estado === 'huye' && en.t < 0.3 ? -(en.cara || 1) * Math.PI * 2 * suave(en.t / 0.3) : 0;
    if (hincha !== 1 || tambalea || vuelta) {
      const px = en.x + en.w / 2, py = en.tipo === 'espora' || vuelta ? en.y + en.h / 2 : en.y + en.h;
      c.translate(px, py); c.rotate(tambalea + vuelta); c.scale(hincha, hincha); c.translate(-px, -py);
    }
    // el cuerpo golpeado (sentir.js): tiembla en el paron, se aplasta a lo largo del golpe y se inclina
    ponerPoseCuerpo(c, en, en.x + en.w / 2, en.tipo === 'espora' ? en.y + en.h / 2 : en.y + en.h);
    f(c, en, t, s);
    c.restore();
  }
  avisoAtaque(c, en, t);
}

// Lo que el 18 tiene que LEER del enemigo: el destello del zarpazo que viene (crece y se afila hasta el
// golpe), las estrellas del aturdido y el aguante que queda (solo si ya se ha gastado algo)
function avisoAtaque(c, en, t) {
  const cx0 = en.x + en.w / 2;
  if (en.tipo === 'soldado' && en.estado === 'prepara') {
    const k = Math.min(1, en.t / 0.42), x = cx0 + en.cara * 16, y = en.y + 6;
    destello(c, x, y, 5 + k * 13, k, t);
  }
  if (en.tipo === 'soldado' && en.estado === 'golpea') {
    // el arco del zarpazo
    const k = en.t / 0.14;
    c.save(); c.translate(cx0, en.y + en.h * 0.45); c.scale(en.cara, 1);
    c.beginPath(); c.arc(8, 0, 46, -1.3 + k * 0.6, 0.9 + k * 0.6);
    c.lineWidth = 7 * (1 - k * 0.6); c.strokeStyle = `rgba(226,121,43,${0.85 - k * 0.6})`; c.lineCap = 'round'; c.stroke();
    c.lineWidth = 2; c.strokeStyle = `rgba(255,240,220,${0.9 - k * 0.7})`; c.stroke();
    c.restore();
  }
  if (en.estado === 'aturdido') {
    const yy = en.y - 10;
    for (let k = 0; k < 3; k++) {
      const a = en.t * 5 + k * 2.09, x = cx0 + Math.cos(a) * 14, y = yy + Math.sin(a) * 4;
      destello(c, x, y, 4.5, 0.9, t);
    }
  }
  if (en.aguanteMax < 50 && en.aguante < en.aguanteMax && en.estado !== 'aturdido') {
    // pips de aguante sobre la cabeza
    for (let k = 0; k < en.aguanteMax; k++) {
      c.fillStyle = k < en.aguante ? 'rgba(235,228,214,.85)' : 'rgba(235,228,214,.18)';
      c.fillRect(cx0 - en.aguanteMax * 4 + k * 8 + 1, en.y - 9, 6, 2.5);
    }
  }
}

// el escarabajo con la postura rota: estrellas sobre la cabeza y el aguante cuando ya ha perdido algo
export function estadoJefe(c, j, t) {
  if (!j.despierto || j.estado === 'vencido') return;
  const cx0 = j.x + j.w / 2;
  if (j.estado === 'aturdido') for (let k = 0; k < 4; k++) { const a = j.t * 4 + k * 1.57; destello(c, cx0 + Math.cos(a) * 26, j.y - 14 + Math.sin(a) * 6, 6, 0.9, t); }
  else if (j.aguante < j.aguanteMax && j.aguanteMax) {
    const w = 70;
    c.fillStyle = 'rgba(11,10,12,.6)'; c.fillRect(cx0 - w / 2 - 1, j.y - 14, w + 2, 5);
    c.fillStyle = 'rgba(235,228,214,.85)'; c.fillRect(cx0 - w / 2, j.y - 13, (w * j.aguante) / j.aguanteMax, 3);
  }
}

function destello(c, x, y, r, a, t) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r * 1.6);
  g.addColorStop(0, `rgba(255,250,240,${0.7 * a})`); g.addColorStop(1, 'rgba(255,250,240,0)');
  c.fillStyle = g; c.fillRect(x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
  c.fillStyle = `rgba(255,252,245,${a})`;
  c.beginPath();
  for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4 + t * 2, rr = k % 2 ? r * 0.28 : r; c.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); }
  c.closePath(); c.fill(); c.restore();
}

function tallos(c, x, y, n, t, fuerza, semilla, s = 1) {
  // GDD: tallos de hongo naranja enfermizo en la espalda: el unico naranja del juego
  for (let k = 0; k < n; k++) {
    const h = 18 + hash(k, semilla) * 16, ang = -1.9 + k * 0.45 + Math.sin(t * 2 + k + semilla) * 0.08;
    const x1 = x + Math.cos(ang) * h, y1 = y + Math.sin(ang) * h;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(ang + 0.5) * h * 0.5, y + Math.sin(ang + 0.5) * h * 0.5, x1, y1);
    c.lineWidth = 4.2; c.strokeStyle = TINTA; c.stroke();
    c.lineWidth = 2.2; c.strokeStyle = COLOR.podre; c.stroke();
    c.save();
    c.shadowColor = COLOR.podre; c.shadowBlur = (6 + fuerza * 10) * s;
    circulo(c, x1, y1, 3.4 + fuerza * 1.5, mezclar(COLOR.podre, '#ffd2a0', fuerza * 0.6), 1.4, k);
    c.restore();
  }
}

// Un segmento de exoesqueleto: tinta gruesa por fuera y el color por dentro, con brillo en el lomo
function segmento(c, a, b, ancho, color, brillo = true) {
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
  c.lineWidth = ancho + 2.2; c.strokeStyle = TINTA; c.stroke();
  c.lineWidth = ancho; c.strokeStyle = color; c.stroke();
  if (brillo) {
    c.lineWidth = Math.max(0.6, ancho * 0.25); c.strokeStyle = 'rgba(255,235,210,.28)';
    c.beginPath(); c.moveTo(a[0] + (b[0] - a[0]) * 0.2, a[1] + (b[1] - a[1]) * 0.2 - ancho * 0.25); c.lineTo(a[0] + (b[0] - a[0]) * 0.75, a[1] + (b[1] - a[1]) * 0.75 - ancho * 0.25); c.stroke();
  }
}
function garras(c, p, dir, largo, color = TINTA) {
  c.lineWidth = 1.1; c.strokeStyle = color;
  for (const d of [-1, 1]) {
    c.beginPath(); c.moveTo(p[0], p[1]);
    c.quadraticCurveTo(p[0] + dir * largo * 0.7, p[1] + d * largo * 0.15 - 0.8, p[0] + dir * largo, p[1] + d * largo * 0.35 + 0.6);
    c.stroke();
  }
}

// Pata de hormiga: femur, tibia con espinas y tarso con dos garras. `osc` -1..1 adelante/atras
function pataHormiga(c, hx, hy, osc, fase, color, oscuro) {
  const a = osc * 0.55, alza = Math.max(0, -Math.cos(fase)) * 4;
  const rodilla = [hx + Math.sin(a) * 9 + 4, hy + 10 - alza * 0.4];
  const pie = [hx + Math.sin(a) * 15 - 1, -alza];
  const tobillo = [pie[0] - 1.5, pie[1] - 3.2];
  segmento(c, [hx, hy], rodilla, 3.6, color);
  segmento(c, rodilla, tobillo, 2.6, color);
  segmento(c, tobillo, [pie[0] + 3.5, pie[1]], 1.7, color, false);
  c.strokeStyle = TINTA; c.lineWidth = 0.9;
  for (const u of [0.35, 0.6]) {
    const px = rodilla[0] + (tobillo[0] - rodilla[0]) * u, py = rodilla[1] + (tobillo[1] - rodilla[1]) * u;
    c.beginPath(); c.moveTo(px - 0.5, py); c.lineTo(px - 2.6, py + 0.8); c.stroke();
  }
  garras(c, [pie[0] + 3.5, pie[1]], 1, 3);
  circulo(c, rodilla[0], rodilla[1], 1.9, oscuro, 1, 14, 0.1);
}

// Pata del escarabajo: femur grueso, tibia con espolones y tarso de tres artejos con garras.
// `lado` 1 la cercana, -1 la lejana (en contrafase)
function pataEscarabajo(c, cadera, paso, lado, color) {
  const a = paso * 0.42 * lado;
  const rodilla = [cadera[0] + Math.sin(a) * 10 + 5, cadera[1] + 15];
  const tobillo = [cadera[0] + Math.sin(a) * 16 + 1, -6];
  const pie = [tobillo[0] + 7, 0];
  segmento(c, cadera, rodilla, 7, color);
  segmento(c, rodilla, tobillo, 5, color);
  c.strokeStyle = TINTA; c.lineWidth = 1.2;
  for (const u of [0.3, 0.55, 0.8]) {
    const px = rodilla[0] + (tobillo[0] - rodilla[0]) * u, py = rodilla[1] + (tobillo[1] - rodilla[1]) * u;
    c.beginPath(); c.moveTo(px - 2, py); c.lineTo(px - 5.5, py + 1.5); c.stroke();
  }
  let p = tobillo;
  for (let k = 1; k <= 3; k++) { const q = [tobillo[0] + (pie[0] - tobillo[0]) * k / 3, tobillo[1] + (pie[1] - tobillo[1]) * k / 3]; segmento(c, p, q, 3 - k * 0.5, color, false); p = q; }
  garras(c, pie, 1, 4.5);
  circulo(c, rodilla[0], rodilla[1], 3.2, mezclar(color, '#000000', 0.35), 1.3, 16, 0.2);
}

// Brazo de hormiga por puntos (hombro, codo, mano) con pinza de dos dedos
function brazoHormiga(c, pts, color, ancho) {
  segmento(c, pts[0], pts[1], ancho, color);
  segmento(c, pts[1], pts[2], ancho * 0.8, color);
  circulo(c, pts[1][0], pts[1][1], ancho * 0.6, mezclar(color, '#000000', 0.35), 0.9, 15, 0.1);
  garras(c, pts[2], 1, 2.6);
}

// Mandibula curva con tres dientes, girada `ang` desde la boca
function mandibula(c, x, y, ang, color) {
  c.save(); c.translate(x, y); c.rotate(ang);
  trazar(c, [[-1, -1.6], [4, -2.6], [7.5, -1.5], [9, 0.8], [7, 0.4], [6.3, 1.6], [4.6, 0.6], [3.6, 1.8], [2, 0.8], [-1, 1.6]]);
  c.fillStyle = color; c.fill(); tinta(c, 1.1);
  c.restore();
}

const DIB = {
  soldado(c, en, t, s) {
    // Soldado de Boltbound tomado por la Podredumbre (la imagen de referencia de la ciudad,
    // concepto/ciudad_referencia.webp): corpachon encorvado con peto y hombreras de chapa, sobreveste de tela
    // hecha jirones, cinturon con cartucheras, rodilleras y botas; casco con visera de rendija que se ENCIENDE
    // al avisar; la hoja de una bayoneta en la mano (de ahi el zarpazo) y la Podredumbre que le sale del casco
    // y del hombro en tallos con su bola. Mide algo mas que su caja (cabe en ella el cuerpo; el casco y los
    // tallos asoman por arriba).
    const x = en.x + en.w / 2, pie = en.y + en.h;
    const paso = en.estado === 'patrulla' ? Math.sin(t * 7 + en.x0) : en.estado === 'embiste' ? Math.sin(t * 18) : 0;
    const inclina = en.estado === 'embiste' ? 0.3 : en.estado === 'aviso' ? -0.1 : 0.14;
    const respira = Math.sin(t * 2.2 + en.x0) * 0.8;
    const ARM = '#3a3c35', ARM_C = '#585a50', ARM_O = '#24251f', TELA = '#2a2824', CUERO = '#1e1c19', FILO = '#8f8a7a';
    c.translate(x, pie);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 0, 18, 3, 0, 0, 7); c.fill();
    if (en.cara < 0) c.scale(-1, 1);
    if (en.golpe > 0) c.translate(-4, 0);
    c.lineCap = 'round'; c.lineJoin = 'round';
    // ---- piernas: muslo, rodillera, espinillera y bota
    for (const [d, col] of [[-1, ARM_O], [1, ARM]]) {
      const a = paso * 0.5 * d, kx = Math.sin(a) * 12 + d * 3, fx = Math.sin(a) * 20 + d * 4;
      c.beginPath(); c.moveTo(d * 4, -27); c.lineTo(kx, -13); c.lineTo(fx - 1, -3);
      c.lineWidth = 10; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 7; c.strokeStyle = col; c.stroke();
      trazar(c, [[fx - 6, 0], [fx - 5, -7], [fx + 4, -7], [fx + 9, -2], [fx + 9, 0]]); c.fillStyle = CUERO; c.fill(); tinta(c, 1.6);
      circulo(c, kx, -13, 4, d > 0 ? ARM_C : ARM, 1.4, 21, 0.2);
    }
    c.rotate(inclina);
    // ---- sobreveste de tela por detras, a jirones
    trazar(c, [[-13, -44], [-15, -27], [-12, -19], [-9, -23], [-6, -17], [-2, -22], [3, -18], [7, -24], [11, -20], [12, -32], [10, -44]]);
    c.fillStyle = TELA; c.fill(); tinta(c, 1.8);
    // ---- el brazo lejano (detras del peto)
    c.beginPath(); c.moveTo(-8, -48); c.lineTo(-12, -36); c.lineTo(-9, -27);
    c.lineWidth = 9; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 6; c.strokeStyle = ARM_O; c.stroke();
    // ---- peto de chapa: dos planchas en cel con remaches; cinturon con cartucheras
    const peto = temblar([[-12, -27], [-14, -44], [-9, -55 + respira], [7, -55 + respira], [13, -45], [11, -27]], 7, 0.6, 9);
    trazar(c, peto); c.fillStyle = ARM; c.fill();
    c.save(); trazar(c, peto); c.clip();
    c.fillStyle = ARM_C; c.fillRect(2, -56, 12, 30);                 // la plancha del lado de la luz
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-14, -36, 28, 3);
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.arc(-6, -48, 1.2, 0, 7); c.arc(7, -48, 1.2, 0, 7); c.arc(-6, -40, 1.2, 0, 7); c.arc(7, -40, 1.2, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-9, -46); c.lineTo(-2, -39); c.moveTo(4, -52); c.lineTo(9, -44); c.stroke();
    c.restore();
    tinta(c, GROSOR * 0.9);
    c.fillStyle = FILO; c.globalAlpha = 0.7; c.fillRect(9, -53 + respira, 2, 22); c.globalAlpha = 1;
    trazar(c, [[-13, -30], [12, -30], [12, -25], [-13, -25]]); c.fillStyle = CUERO; c.fill(); tinta(c, 1.4);
    for (const bx of [-9, -3, 4]) { trazar(c, [[bx, -30], [bx + 5, -30], [bx + 5, -23], [bx, -23]]); c.fillStyle = '#2f2c27'; c.fill(); tinta(c, 1.1); }
    // ---- hombrera grande del lado de aqui, en tres laminas
    for (let k = 0; k < 3; k++) {
      const y0 = -57 + k * 5 + respira;
      trazar(c, [[-4 + k, y0], [9 + k * 0.5, y0 - 2], [15 - k, y0 + 4], [13 - k, y0 + 8], [-3 + k, y0 + 7]]); c.fillStyle = k === 0 ? ARM_C : ARM; c.fill(); tinta(c, 1.5);
    }
    // ---- el brazo de aqui con la bayoneta: abajo al andar, atras al prepararse, adelante al golpear
    const ang = en.estado === 'prepara' ? -2.3 : en.estado === 'golpea' ? 0.5 : en.estado === 'aviso' ? -0.6 : 0.95 + paso * 0.12;
    c.save(); c.translate(6, -50 + respira); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(5, 10); c.lineTo(3, 20);
    c.lineWidth = 9; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 6; c.strokeStyle = ARM; c.stroke();
    circulo(c, 3, 21, 3.6, CUERO, 1.4, 22, 0.2);
    // la hoja: larga, con lomo y filo claros
    trazar(c, [[1, 22], [5, 22], [6, 46], [3.5, 52], [1, 46]]); c.fillStyle = '#6e6b62'; c.fill(); tinta(c, 1.6);
    c.fillStyle = FILO; c.fillRect(4.3, 24, 1.3, 22);
    c.restore();
    // ---- casco con visera de rendija y cubrenuca; cuello de tela
    trazar(c, [[-4, -56 + respira], [6, -57 + respira], [7, -62], [-5, -61]]); c.fillStyle = TELA; c.fill(); tinta(c, 1.4);
    const casco = [[-8, -61], [-9, -68], [-5, -74], [3, -76], [10, -72], [12, -66], [11, -61], [-8, -60]];
    trazar(c, temblar(casco, 6, 0.4, 4)); c.fillStyle = ARM_O; c.fill(); tinta(c, GROSOR * 0.9);
    c.fillStyle = ARM_C; c.beginPath(); c.ellipse(1, -72, 7, 3, -0.1, Math.PI, 0); c.fill();
    trazar(c, [[2, -67], [12, -67], [12, -63.5], [2, -64.5]]); c.fillStyle = '#0d0c0b'; c.fill(); tinta(c, 1.1);
    // la rendija se enciende de Podredumbre al avisar
    const ojo = en.estado === 'aviso' || en.estado === 'prepara' ? 1 : en.estado === 'embiste' ? 0.7 : 0.22;
    c.fillStyle = `rgba(226,121,43,${ojo})`; c.fillRect(4, -66.3, 7, 1.6);
    if (ojo > 0.5) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(8, -65.5, 0, 8, -65.5, 14); g.addColorStop(0, `rgba(255,170,90,${0.5 * ojo})`); g.addColorStop(1, 'rgba(255,170,90,0)'); c.fillStyle = g; c.fillRect(-6, -80, 28, 28); c.restore(); }
    // ---- la Podredumbre: tallos del casco y del hombro
    const ganas = en.estado === 'aviso' ? 1 : en.estado === 'embiste' ? 0.7 : 0.25;
    tallos(c, -2, -73, 4, t, ganas, en.x0 | 0, s);
    tallos(c, -8, -55, 2, t, ganas * 0.8, (en.x0 | 0) + 7, s);
  },
  hormiga(c, en, t, s) {
    // Entomorfico: hormiga bipeda con chatarra encima (GDD: laton, oxido, cristal verdoso). Cabeza,
    // torax con peto de laton, peciolo y abdomen anillado; patas articuladas con garras, antenas
    // acodadas, mandibulas dentadas, casco de tuerca y una llave inglesa.
    const x = en.x + en.w / 2, pie = en.y + en.h;
    const corre = en.estado === 'corre' || en.estado === 'huye';
    const fase = t * (corre ? 15 : 7.5) + en.x0;
    const paso = Math.sin(fase), bote = Math.abs(Math.cos(fase)) * (corre ? 2.2 : 1.1);
    const piel = COLOR.oxido, osc = mezclar(piel, '#000000', 0.45), claro = mezclar(piel, '#f2c08a', 0.4);
    c.translate(x, pie);
    c.fillStyle = 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(-2, 0, 17, 3, 0, 0, 7); c.fill();
    if (en.cara < 0) c.scale(-1, 1);
    c.globalAlpha = en.estado === 'huye' ? Math.max(0, 1 - en.t / 2.2) : 1;
    c.lineCap = 'round'; c.lineJoin = 'round';
    pataHormiga(c, 1, -20 - bote, -paso, fase + Math.PI, osc, mezclar(osc, '#000000', 0.3));
    c.save();
    c.translate(0, -bote);
    c.rotate(corre ? 0.3 : 0.08);
    // brazo lejano (detras del torax)
    brazoHormiga(c, [[5, -39], [10, -31 - paso * 2], [15, -33 - paso * 3]], osc, 2.6);
    // abdomen (gaster) anillado, con su fleje de laton y el trozo de cristal verde a la espalda
    c.save();
    c.beginPath(); c.ellipse(-14, -27, 12, 8.8, -0.45, 0, 7);
    const g = c.createLinearGradient(-20, -36, -8, -18);
    g.addColorStop(0, claro); g.addColorStop(0.45, piel); g.addColorStop(1, osc);
    c.fillStyle = g; c.fill();
    c.clip();
    c.strokeStyle = 'rgba(20,8,4,.55)'; c.lineWidth = 1.1;
    for (const k of [-5, 0, 5]) { c.beginPath(); c.ellipse(-14 + k, -27, 3, 10, -0.45, -1.2, 1.4); c.stroke(); }
    c.strokeStyle = 'rgba(255,220,180,.35)'; c.lineWidth = 1.4;
    c.beginPath(); c.ellipse(-15, -29, 8, 4.5, -0.45, 3.5, 5.2); c.stroke();
    c.fillStyle = 'rgba(40,14,6,.4)';
    for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(-20 + hash(k, 3) * 12, -31 + hash(k, 4) * 9, 0.8 + hash(k, 5), 0, 7); c.fill(); }
    c.restore();
    c.beginPath(); c.ellipse(-14, -27, 12, 8.8, -0.45, 0, 7); tinta(c, GROSOR * 0.85);
    // fleje de laton con remaches
    c.save(); c.translate(-14, -27); c.rotate(-0.45 + Math.PI / 2);
    caja(c, -9.5, -2.2, 19, 4.4, COLOR.laton, 11, 0.3, 1.3);
    c.fillStyle = TINTA; for (const k of [-6, 0, 6]) { c.beginPath(); c.arc(k, 0, 0.9, 0, 7); c.fill(); }
    c.restore();
    trazar(c, [[-20, -36], [-26, -48], [-19, -44], [-15, -51], [-13, -37]]);
    c.fillStyle = rgba(COLOR.cristalVerde, 0.82); c.fill(); tinta(c, 1.3);
    c.strokeStyle = 'rgba(235,255,245,.75)'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(-21, -39); c.lineTo(-24, -46); c.moveTo(-17, -40); c.lineTo(-16, -47); c.stroke();
    // peciolo (la cintura de avispa)
    circulo(c, -3, -31, 2.8, osc, 1.4, 12);
    // torax con peto de laton remachado y correa
    c.beginPath(); c.ellipse(3, -36, 6.5, 9, 0.35, 0, 7);
    const gt = c.createLinearGradient(-2, -45, 8, -28);
    gt.addColorStop(0, claro); gt.addColorStop(1, osc);
    c.fillStyle = gt; c.fill(); tinta(c, GROSOR * 0.85);
    c.save(); c.translate(4, -36); c.rotate(0.35);
    trazar(c, temblar([[-4.5, -6], [4.5, -6.5], [5.5, 4], [0, 7], [-5, 4]], 6, 0.3, 21));
    const gl = c.createLinearGradient(-5, -6, 5, 6);
    gl.addColorStop(0, mezclar(COLOR.laton, '#fff2c8', 0.35)); gl.addColorStop(1, mezclar(COLOR.laton, '#3a2a10', 0.35));
    c.fillStyle = gl; c.fill(); tinta(c, 1.3);
    c.fillStyle = TINTA; for (const [a, b] of [[-3, -4], [3, -4], [-3, 2], [3, 2]]) { c.beginPath(); c.arc(a, b, 0.85, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(60,40,10,.6)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-2, -1); c.lineTo(2, 1.5); c.moveTo(1, -2); c.lineTo(3.5, -0.5); c.stroke();
    c.restore();
    linea(c, -1, -44, 8, -28, 1.6, '#3b2a1c', 9, 0.3);
    // cabeza: en corazon, ojo compuesto, mandibulas dentadas, antenas acodadas y casco de tuerca
    const ab = corre ? Math.abs(Math.sin(t * 9)) : Math.abs(Math.sin(t * 2.2)) * 0.5;
    mandibula(c, 13, -44, 0.35 + ab * 0.35, osc);
    mandibula(c, 13, -45, -0.25 - ab * 0.35, piel);
    c.beginPath();
    c.moveTo(4, -52); c.bezierCurveTo(10, -56, 17, -52, 16, -46); c.bezierCurveTo(15, -41, 9, -40, 5, -42); c.bezierCurveTo(1, -45, 1, -50, 4, -52); c.closePath();
    const gc = c.createLinearGradient(4, -55, 14, -41);
    gc.addColorStop(0, claro); gc.addColorStop(1, mezclar(piel, '#000000', 0.2));
    c.fillStyle = gc; c.fill(); tinta(c, GROSOR * 0.85);
    c.beginPath(); c.ellipse(11.5, -48.5, 2.8, 3.3, 0.2, 0, 7); c.fillStyle = '#120a08'; c.fill();
    c.fillStyle = 'rgba(255,240,200,.85)'; c.beginPath(); c.arc(12.4, -49.8, 0.9, 0, 7); c.fill();
    c.fillStyle = 'rgba(170,190,160,.35)';
    for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(10.2 + (k % 3) * 1.2, -48.8 + Math.floor(k / 3) * 1.3, 0.35, 0, 7); c.fill(); }
    // antenas: escapo largo y funiculo de cuentas que se mece
    for (const [ox, sw, col] of [[-1.5, 6, osc], [0, 5, mezclar(piel, '#000000', 0.15)]]) {
      const ba = Math.sin(t * sw + ox) * 1.6;
      const p0 = [8 + ox, -52], p1 = [5 + ox, -61], p2 = [12 + ox + ba, -65], p3 = [18 + ox + ba * 1.4, -62 + ba * 0.5];
      c.beginPath(); c.moveTo(...p0); c.lineTo(...p1); c.lineWidth = 2.2; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 1.1; c.strokeStyle = col; c.stroke();
      for (let k = 0; k <= 5; k++) {
        const u = k / 5, q = [(1 - u) * (1 - u) * p1[0] + 2 * u * (1 - u) * p2[0] + u * u * p3[0], (1 - u) * (1 - u) * p1[1] + 2 * u * (1 - u) * p2[1] + u * u * p3[1]];
        circulo(c, q[0], q[1], k === 5 ? 1.5 : 1.05, col, 0.8, 30 + k, 0.1);
      }
    }
    // casco: una tuerca vieja encajada en la cabeza
    c.save(); c.translate(7.5, -54); c.rotate(-0.25);
    trazar(c, [[-5, 1], [-3.5, -2.5], [3.5, -2.5], [5, 1], [3.5, 3], [-3.5, 3]]);
    c.fillStyle = mezclar('#7d858d', COLOR.oxido, 0.35); c.fill(); tinta(c, 1.3);
    c.fillStyle = 'rgba(230,235,240,.4)'; c.fillRect(-3, -2, 5, 1);
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-3.5, -2.5); c.lineTo(-2, 3); c.moveTo(3.5, -2.5); c.lineTo(2, 3); c.stroke();
    c.restore();
    // brazo cercano con la llave inglesa
    const mano = [18, -35 + paso * 3];
    brazoHormiga(c, [[5, -39], [12, -31 + paso * 2], mano], piel, 2.9);
    c.save(); c.translate(...mano); c.rotate(-0.95 + paso * 0.12);
    caja(c, -1.6, -1.6, 15, 3.2, '#7d858d', 13, 0.2, 1.3);
    c.beginPath(); c.arc(15.5, 0, 4.2, 0.8, 5.5); c.lineWidth = 4.4; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 2.4; c.strokeStyle = '#8a929a'; c.stroke();
    c.fillStyle = 'rgba(230,235,240,.45)'; c.fillRect(1, -1, 11, 0.8);
    c.restore();
    c.restore();
    pataHormiga(c, 3, -20 - bote, paso, fase, piel, osc);
  },
  espora(c, en, t, s) {
    const x = en.x + en.w / 2, y = en.y + en.h / 2;
    const lat = 1 + Math.sin(t * 4 + en.fase) * 0.08;
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 0, x, y, 30);
    g.addColorStop(0, 'rgba(226,121,43,.45)'); g.addColorStop(1, 'rgba(226,121,43,0)');
    c.fillStyle = g; c.fillRect(x - 30, y - 30, 60, 60);
    c.restore();
    c.strokeStyle = TINTA; c.lineWidth = 1.4;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + t * 0.4;
      c.beginPath(); c.moveTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); c.quadraticCurveTo(x + Math.cos(a + 0.4) * 16, y + Math.sin(a + 0.4) * 16, x + Math.cos(a) * 19, y + Math.sin(a) * 19 + 3); c.stroke();
    }
    circulo(c, x, y, 10 * lat, COLOR.podre, GROSOR * 0.9, 3);
    c.fillStyle = 'rgba(255,220,180,.55)'; c.beginPath(); c.arc(x - 3, y - 3, 3, 0, 7); c.fill();
    c.fillStyle = COLOR.podreOsc; c.beginPath(); c.arc(x + 3, y + 2, 1.6, 0, 7); c.arc(x - 1, y + 4, 1.2, 0, 7); c.fill();
  },
  tallo(c, en, t, s) {
    const x = en.x + en.w / 2, pie = en.y + en.h;
    const sw = Math.sin(t * 1.5) * 4;
    c.beginPath(); c.moveTo(x - 10, pie); c.quadraticCurveTo(x - 4 + sw, pie - 26, x + sw, pie - 40);
    c.lineTo(x + 6 + sw, pie - 40); c.quadraticCurveTo(x + 4 + sw * 0.5, pie - 20, x + 10, pie); c.closePath();
    c.fillStyle = COLOR.podreOsc; c.fill(); tinta(c);
    c.save(); c.shadowColor = COLOR.podre; c.shadowBlur = (8 + Math.max(0, 0.5 - en.recarga) * 30) * s;
    circulo(c, x + 3 + sw, pie - 46, 11, COLOR.podre, GROSOR, 9);
    c.restore();
    c.fillStyle = TINTA; c.beginPath(); c.ellipse(x + 3 + sw + en.cara * 4, pie - 46, 4, 5 + Math.max(0, 0.4 - en.recarga) * 8, 0, 0, 7); c.fill();
  },
};

export function dibujarProyectil(c, q, t, s) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const x = q.x + q.w / 2, y = q.y + q.h / 2;
  // devuelto por el 18: blanco y con estela (ya no es de la Podredumbre)
  if (q.amigo) {
    const n = Math.hypot(q.vx, q.vy) || 1;
    c.strokeStyle = 'rgba(255,250,240,.55)'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - (q.vx / n) * 40, y - (q.vy / n) * 40); c.stroke();
  }
  const g = c.createRadialGradient(x, y, 0, x, y, 18);
  g.addColorStop(0, q.amigo ? 'rgba(255,250,240,.9)' : 'rgba(255,170,90,.8)'); g.addColorStop(1, q.amigo ? 'rgba(255,250,240,0)' : 'rgba(226,121,43,0)');
  c.fillStyle = g; c.fillRect(x - 18, y - 18, 36, 36);
  c.restore();
  circulo(c, x, y, 5, q.amigo ? '#fff4e2' : COLOR.podre, 1.6, 2);
}

// ---------------------------------------------------------------- el escarabajo de la bata
export function dibujarJefe(c, j, t, s, E) {
  const x = j.x + j.w / 2, pie = j.y + j.h;
  const tt = j.t;
  c.save();
  // con las zarpas: blanco en el golpe y luego brillo; con la daga (rebota) solo vibra (sentir.js)
  if (j.golpe > 0) c.filter = filtroGolpe(j.golpe, 0.15);
  ponerPoseCuerpo(c, j, x, pie);
  c.translate(x, pie);
  if (j.cara < 0) c.scale(-1, 1);
  const vencido = j.estado === 'vencido';
  let inclina = 0, espada = -0.6, agacha = 0;
  if (j.estado === 'tajo') { espada = tt < 0.55 ? -2.4 + Math.sin(tt * 30) * 0.03 : tt < 0.75 ? -2.4 + (tt - 0.55) / 0.2 * 3.6 : 1.2; inclina = tt < 0.55 ? -0.1 : 0.25; }
  else if (j.estado === 'salto') { agacha = j.vuela ? 0 : tt < 0.4 ? 12 : 0; espada = -1.2; }
  else if (j.estado === 'carga') { inclina = tt < 0.5 ? -0.1 : 0.45; espada = 0.4; }
  else if (j.estado === 'cristales') { espada = tt < 0.45 ? -2 : 1.5; agacha = tt > 0.45 ? 14 : 0; }
  if (vencido) { agacha = 26; inclina = 0.35; espada = 1.4; }
  c.translate(0, agacha);
  const paso = j.vx ? Math.sin(t * 10) : 0;
  // sombra
  c.save(); c.translate(0, -agacha); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(-6, 0, 40, 5, 0, 0, 7); c.fill(); c.restore();
  const morado = '#4e2a6e', moradoOsc = '#2a153e', moradoClaro = '#8a5cb4';
  // capa: la bata rota de Varga, azul palido (el color del recuerdo). Jirones en el bajo, pliegues,
  // dos agujeros y el cuello vuelto sobre los hombros
  c.save();
  const ondea = Math.sin(t * 3) * 6 + (j.estado === 'carga' && tt > 0.5 ? -26 : 0);
  const capa = [[-2, -86], [-24, -78], [-38 + ondea * 0.3, -56], [-48 + ondea * 0.6, -28], [-58 + ondea, -4],
    [-51 + ondea, -10], [-47 + ondea * 0.9, 1], [-41 + ondea * 0.8, -9], [-35 + ondea * 0.7, 3], [-30 + ondea * 0.6, -8],
    [-23 + ondea * 0.5, 0], [-19 + ondea * 0.3, -12], [-12, -6], [-12, -34], [-6, -60]];
  trazarSuave(c, temblar(capa, 9, 1.2, 4));
  const gb = c.createLinearGradient(-20, -86, -40, 0);
  gb.addColorStop(0, mezclar(COLOR.varga, '#ffffff', 0.25)); gb.addColorStop(0.6, COLOR.varga); gb.addColorStop(1, mezclar(COLOR.varga, '#24384a', 0.45));
  c.fillStyle = gb; c.fill();
  c.save(); c.clip();
  c.strokeStyle = 'rgba(50,80,105,.45)'; c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-18, -74); c.quadraticCurveTo(-30, -44, -36 + ondea * 0.6, -6);
  c.moveTo(-10, -64); c.quadraticCurveTo(-18, -36, -24 + ondea * 0.4, -4);
  c.moveTo(-28, -66); c.quadraticCurveTo(-40, -40, -50 + ondea * 0.8, -8);
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,.18)';
  c.beginPath(); c.ellipse(-20, -70, 4, 12, 0.3, 0, 7); c.fill();
  c.fillStyle = 'rgba(14,16,22,.85)';
  c.beginPath(); c.ellipse(-30 + ondea * 0.5, -36, 2.6, 4, 0.4, 0, 7); c.ellipse(-22 + ondea * 0.3, -20, 1.8, 2.8, -0.2, 0, 7); c.fill();
  c.strokeStyle = 'rgba(50,80,105,.6)'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(-40 + ondea * 0.7, -22); c.lineTo(-36 + ondea * 0.7, -16); c.lineTo(-38 + ondea * 0.7, -12); c.stroke();
  c.restore();
  tinta(c);
  c.restore();
  c.rotate(inclina);
  // pata lejana (detras)
  pataEscarabajo(c, [-6, -34], paso, -1, mezclar(morado, '#000000', 0.4));
  // abdomen anillado asomando bajo los elitros
  c.save();
  c.beginPath(); c.ellipse(-2, -38, 17, 10, -0.1, 0, 7);
  c.fillStyle = mezclar(moradoOsc, '#000000', 0.2); c.fill();
  c.clip();
  c.strokeStyle = 'rgba(190,150,230,.35)'; c.lineWidth = 1;
  for (const k of [-36, -32, -28]) { c.beginPath(); c.ellipse(-2, k, 16, 3, -0.1, 0.2, Math.PI - 0.2); c.stroke(); }
  c.restore();
  c.beginPath(); c.ellipse(-2, -38, 17, 10, -0.1, 0, 7); tinta(c);
  // elitros: el caparazon, con surcos, la costura, brillo tornasol y desconchones
  c.save();
  c.beginPath(); c.ellipse(-6, -57, 25, 29, 0.3, 0, 7);
  const g = c.createLinearGradient(-22, -90, 18, -32);
  g.addColorStop(0, moradoClaro); g.addColorStop(0.45, morado); g.addColorStop(1, moradoOsc);
  c.fillStyle = g; c.fill();
  c.clip();
  c.strokeStyle = 'rgba(20,6,30,.55)'; c.lineWidth = 1.1;
  for (const k of [-16, -9, -2, 5]) { c.beginPath(); c.ellipse(-6 + k * 0.4, -57, 25 + k, 29, 0.3, Math.PI * 0.55, Math.PI * 1.25); c.stroke(); }
  c.strokeStyle = 'rgba(120,230,215,.35)'; c.lineWidth = 2.4;
  c.beginPath(); c.ellipse(-6, -57, 24, 28, 0.3, Math.PI * 0.7, Math.PI * 1.15); c.stroke();
  c.strokeStyle = 'rgba(240,225,255,.55)'; c.lineWidth = 2.2;
  c.beginPath(); c.ellipse(-8, -70, 11, 16, -0.05, -2.5, -1.3); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(-9, -80, 2.2, 1.2, -0.2, 0, 7); c.fill();
  c.strokeStyle = 'rgba(230,210,250,.5)'; c.lineWidth = 0.8;
  c.beginPath();
  for (let k = 0; k < 6; k++) {
    const sx = -18 + hash(k, 41) * 30, sy = -80 + hash(k, 42) * 40;
    c.moveTo(sx, sy); c.lineTo(sx + 3 + hash(k, 43) * 3, sy + 1.5);
  }
  c.stroke();
  c.fillStyle = 'rgba(18,6,28,.6)';
  for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(-14 + hash(k, 44) * 26, -48 + hash(k, 45) * 14, 1 + hash(k, 46), 0, 7); c.fill(); }
  c.restore();
  c.beginPath(); c.ellipse(-6, -57, 25, 29, 0.3, 0, 7); tinta(c, GROSOR * 1.2);
  c.lineWidth = 2; c.strokeStyle = TINTA; c.beginPath(); c.moveTo(12, -82); c.quadraticCurveTo(8, -56, -6, -31); c.stroke();
  // tubo de laboratorio: sale del caparazon y le entra por la nuca (lo que le hicieron en el laboratorio)
  const tubo = () => { c.beginPath(); c.moveTo(-16, -76); c.bezierCurveTo(-12, -90, 2, -91, 12, -82); };
  tubo(); c.lineWidth = 5; c.strokeStyle = TINTA; c.stroke();
  tubo(); c.lineWidth = 3; c.strokeStyle = 'rgba(190,225,220,.8)'; c.stroke();
  tubo(); c.lineWidth = 0.8; c.strokeStyle = 'rgba(255,255,255,.7)'; c.stroke();
  circulo(c, -16, -76, 2.6, COLOR.laton, 1.3, 61, 0.1);
  caja(c, -4, -91, 4, 5, '#7d858d', 62, 0.1, 1.1);
  // ENCORVADO: torax, pecho de la bata y cabeza caen hacia delante desde el hombro (se lee
  // "cientifica convertida", no caballero erguido)
  const ENC = 0.38, HX = 6, HY = -70;
  c.save(); c.translate(HX, HY + 4); c.rotate(ENC); c.translate(-HX, -HY);
  // pronoto: el escudo del torax, con reborde
  c.beginPath();
  c.moveTo(0, -84); c.bezierCurveTo(4, -94, 18, -95, 22, -86); c.bezierCurveTo(24, -79, 18, -73, 10, -72); c.bezierCurveTo(4, -72, -1, -77, 0, -84); c.closePath();
  const gp = c.createLinearGradient(4, -95, 18, -72);
  gp.addColorStop(0, moradoClaro); gp.addColorStop(1, moradoOsc);
  c.fillStyle = gp; c.fill(); tinta(c, GROSOR);
  c.strokeStyle = 'rgba(235,215,255,.45)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(3, -86); c.bezierCurveTo(6, -92, 16, -93, 19, -87); c.stroke();
  // solapas de la bata sobre el pecho y la placa: "Dra. I. Varga — Ilustracion" (se lee al final)
  trazar(c, temblar([[2, -78], [12, -74], [9, -58], [4, -50], [1, -66]], 7, 0.5, 31));
  c.fillStyle = mezclar(COLOR.varga, '#ffffff', 0.15); c.fill(); tinta(c, 1.8);
  c.strokeStyle = 'rgba(50,80,105,.5)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(4, -74); c.lineTo(5, -56); c.stroke();
  c.save(); c.translate(7, -66); c.rotate(0.08);
  caja(c, -4, -3, 9, 6, '#e3ddcb', 3, 0.25, 1.1);
  c.strokeStyle = 'rgba(40,40,50,.55)'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(-2.6, -1); c.lineTo(3.6, -1); c.moveTo(-2.6, 1); c.lineTo(2, 1); c.stroke();
  c.fillStyle = '#9aa2aa'; c.fillRect(-1, -4.4, 2, 1.6);
  c.restore();
  // botones y el bolsillo con dos lapices (Varga era ilustradora)
  for (const [bx, by] of [[3.4, -59], [4.1, -54]]) circulo(c, bx, by, 1.1, '#e8e2d2', 0.8, 70, 0.05);
  segmento(c, [8.2, -56], [9, -62.5], 1.3, '#d9d3c0', false);
  c.fillStyle = TINTA; c.beginPath(); c.arc(9.05, -62.8, 0.7, 0, 7); c.fill();
  segmento(c, [10.2, -56], [11.6, -61.5], 1.3, '#5b7fa0', false);
  caja(c, 6.5, -57, 6, 5, mezclar(COLOR.varga, '#ffffff', 0.1), 71, 0.2, 1.1);
  // brazo corto: sujeta el borde de la bata
  segmento(c, [4, -56], [12, -48], 3.4, morado);
  segmento(c, [12, -48], [8, -40], 2.8, morado);
  garras(c, [8, -40], -1, 3.4);
  // cabeza: ojo compuesto facetado, mandibulas dentadas y palpos
  mandibula(c, 28, -84, 0.45, moradoOsc);
  mandibula(c, 28, -86, -0.35, morado);
  c.beginPath(); c.ellipse(21, -88, 11, 10, 0.15, 0, 7);
  const gh = c.createLinearGradient(14, -98, 28, -80);
  gh.addColorStop(0, moradoClaro); gh.addColorStop(1, moradoOsc);
  c.fillStyle = gh; c.fill(); tinta(c, GROSOR);
  c.save();
  c.beginPath(); c.ellipse(24, -90, 4.6, 5.2, 0.2, 0, 7);
  c.fillStyle = vencido ? 'rgba(120,150,175,.9)' : '#2a1640'; c.fill();
  c.clip();
  c.fillStyle = vencido ? 'rgba(200,225,240,.45)' : 'rgba(215,190,255,.55)';
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { c.beginPath(); c.arc(21.5 + a * 1.7 + (b % 2) * 0.8, -94 + b * 2, 0.45, 0, 7); c.fill(); }
  c.restore();
  c.beginPath(); c.ellipse(24, -90, 4.6, 5.2, 0.2, 0, 7); tinta(c, 1.2);
  c.fillStyle = vencido ? 'rgba(220,235,245,.7)' : 'rgba(245,235,255,.95)'; c.beginPath(); c.arc(25.6, -92.4, 1.2, 0, 7); c.fill();
  if (!vencido) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const go = c.createRadialGradient(24, -90, 0, 24, -90, 9); go.addColorStop(0, 'rgba(200,170,255,.35)'); go.addColorStop(1, 'rgba(200,170,255,0)');
    c.fillStyle = go; c.fillRect(14, -100, 20, 20); c.restore();
  }
  c.strokeStyle = TINTA; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(27, -81); c.quadraticCurveTo(30, -77, 28, -74); c.moveTo(25, -80); c.quadraticCurveTo(26, -75, 24, -73); c.stroke();
  // antenas largas segmentadas que se mecen
  // la lejana sale mas atras y se abre hacia atras; la cercana sube mas recta y se curva hacia delante
  for (const [ox, fase, col, abre] of [[-5, 0, mezclar(moradoOsc, '#000000', 0.2), -1], [2, 1.3, morado, 1]]) {
    const sw = Math.sin(t * 2.4 + fase) * 3 + (vencido ? 10 : 0);
    const p0 = [17 + ox, -96], p1 = [14 + ox + abre * 4 + sw * 0.3, -117 + abre * 2],
      p2 = [abre > 0 ? 18 + sw : -2 + sw, -129 + (vencido ? 18 : 0)], p3 = [abre > 0 ? 30 + sw * 1.3 : -14 + sw * 1.3, -124 + (vencido ? 26 : 0)];
    const n = 12;
    let prev = p0;
    for (let k = 1; k <= n; k++) {
      const u = k / n, v = 1 - u;
      const q = [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
        v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]];
      segmento(c, prev, q, 2.2 - u * 1.1, col, false);
      prev = q;
    }
    circulo(c, prev[0], prev[1], 1.6, col, 1, 50 + ox, 0.1);
  }
  // gafas de proteccion rotas sobre la cabeza
  c.beginPath(); c.moveTo(11, -91); c.quadraticCurveTo(20, -101, 31, -93); c.lineWidth = 3.2; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 1.8; c.strokeStyle = '#3a3530'; c.stroke();
  for (const [gx, gy, rota] of [[16.5, -98, false], [23.5, -99.5, true]]) {
    circulo(c, gx, gy, 3.6, 'rgba(175,215,220,.6)', 1.4, 80 + gx, 0.1);
    c.beginPath(); c.arc(gx, gy, 3.6, 0, 7); c.lineWidth = 1.2; c.strokeStyle = COLOR.laton; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(gx - 1.2, gy - 1.2, 0.8, 0, 7); c.fill();
    if (rota) {
      c.strokeStyle = 'rgba(245,255,255,.9)'; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(gx - 2.6, gy + 1.8); c.lineTo(gx, gy - 0.3); c.lineTo(gx + 2.8, gy - 1.2); c.moveTo(gx, gy - 0.3); c.lineTo(gx + 0.6, gy + 2.6); c.stroke();
    }
  }
  c.restore();   // fin del encorvado
  // pata cercana
  pataEscarabajo(c, [6, -34], paso, 1, morado);
  // brazo y espada de cristal: dientes de sierra en el filo, arista, reflejos y guarda de esquirlas
  // el hombro de la espada sigue al torax encorvado
  const hom = [HX + (10 - HX) * Math.cos(ENC) - (-72 - HY) * Math.sin(ENC), HY + 4 + (10 - HX) * Math.sin(ENC) + (-72 - HY) * Math.cos(ENC)];
  c.save(); c.translate(hom[0], hom[1]); c.rotate(espada);
  segmento(c, [0, 0], [11, 5], 4.6, morado);
  segmento(c, [11, 5], [20, 4], 3.8, morado);
  // manga de la bata, rota por el codo: el brazo de insecto asoma
  trazar(c, [[-3, -5], [9, -1.5], [12, 2.5], [11.5, 8], [9.5, 5.6], [8, 9], [6, 6.2], [3.5, 8.6], [-3, 6.5]]);
  c.fillStyle = COLOR.varga; c.fill(); tinta(c, 1.6);
  c.strokeStyle = 'rgba(50,80,105,.55)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(1, -2); c.lineTo(7, 4); c.moveTo(-1, 2); c.lineTo(4, 6); c.stroke();
  c.strokeStyle = TINTA; c.lineWidth = 1;
  c.beginPath(); c.moveTo(6, 4); c.lineTo(5, 7.5); c.moveTo(15, 6.5); c.lineTo(15, 10); c.stroke();
  c.translate(22, 4);
  caja(c, -4, -3, 9, 6, '#26222b', 2, 0.2, 1.4);
  c.strokeStyle = 'rgba(230,225,215,.7)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-2, -3); c.lineTo(-1, 3); c.moveTo(1.5, -3); c.lineTo(2.5, 3); c.stroke();
  garras(c, [2, -3.5], 1, 3.5);
  trazar(c, [[5, -9], [9, -2], [5, 9], [3, 0]]); c.fillStyle = 'rgba(170,225,220,.75)'; c.fill(); tinta(c, 1.3);
  const filo = [[6, -4], [92, -3], [106, 2]];
  for (let x = 92; x > 8; x -= 9) filo.push([x, 6], [x - 4.5, 3.4]);
  filo.push([6, 4]);
  c.save();
  c.shadowColor = 'rgba(170,240,230,.7)'; c.shadowBlur = 8 * s;
  trazar(c, filo);
  const ge = c.createLinearGradient(0, -4, 0, 6);
  ge.addColorStop(0, 'rgba(225,255,250,.75)'); ge.addColorStop(0.5, 'rgba(150,215,210,.55)'); ge.addColorStop(1, 'rgba(95,160,160,.6)');
  c.fillStyle = ge; c.fill();
  c.restore();
  trazar(c, filo); tinta(c, 1.8);
  c.strokeStyle = 'rgba(245,255,255,.9)'; c.lineWidth = 1; c.beginPath(); c.moveTo(8, 0); c.lineTo(100, 1.5); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 0.8; c.beginPath();
  for (const x of [22, 41, 63, 80]) { c.moveTo(x, -3.2); c.lineTo(x + 6, 2.8); }
  c.stroke();
  c.restore();
  c.restore();
  // estela del tajo
  if (j.estado === 'tajo' && tt > 0.55 && tt < 0.8) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.translate(x, pie - 60); if (j.cara < 0) c.scale(-1, 1);
    c.beginPath(); c.arc(10, 0, 110, -1.6, 1.0); c.lineWidth = 16; c.strokeStyle = 'rgba(190,240,235,.35)'; c.stroke();
    c.lineWidth = 4; c.strokeStyle = 'rgba(240,255,255,.8)'; c.stroke();
    c.restore();
  }
  // ondas y cristales
  for (const o of E.ondas) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const ox = o.x + o.w / 2, oy = o.y + o.h;
    const gg = c.createRadialGradient(ox, oy, 0, ox, oy, 30); gg.addColorStop(0, 'rgba(200,190,230,.6)'); gg.addColorStop(1, 'rgba(200,190,230,0)');
    c.fillStyle = gg; c.fillRect(ox - 30, oy - 30, 60, 30);
    c.restore();
    trazar(c, [[ox - 14, oy], [ox - 6, oy - 20], [ox + 2, oy - 10], [ox + 10, oy - 24], [ox + 14, oy]]);
    c.fillStyle = '#5c5266'; c.fill(); tinta(c, 1.6);
  }
  for (const q of E.cristales) {
    const qx = q.x + q.w / 2, qb = q.y + q.h;
    if (q.aviso > 0) {
      c.save(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(160,230,220,${0.25 + 0.3 * Math.sin(t * 30)})`; c.fillRect(q.x, qb - 4, q.w, 4); c.restore();
      continue;
    }
    const h = q.h * Math.min(1, (0.32 - q.vida) / 0.06 + 0.2);
    trazar(c, [[qx - 16, qb], [qx - 4, qb - h], [qx + 2, qb - h * 0.6], [qx + 8, qb - h * 0.9], [qx + 16, qb]]);
    c.fillStyle = 'rgba(160,220,215,.6)'; c.fill(); tinta(c, 1.8);
  }
}

// ---------------------------------------------------------------- cosas del nivel
// los tornillos que caen y los gigantes de la trampa: los pinta tornillos.js (metal, rosca, cabeza hexagonal)
export function dibujarTornillo(c, b, t) { dibujarTornilloBonito(c, b, t); }

export function dibujarGigante(c, g, t) {
  const s = g.s;
  if (s.y + s.h < -10) return;
  dibujarGiganteBonito(c, g, t);
  if (g.gancho) gancho(c, g, s);
}

// la linea de carga de los insectos, con su gancho, al costado del gigante
function gancho(c, g, s) {
  const x = s.x, y = s.y, h = s.h, yb = g.yFin + h;
  c.strokeStyle = TINTA; c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(x - 4, y + 12); c.quadraticCurveTo(x - 14, (y + yb) / 2, x - 8, yb - 22); c.stroke();
  c.strokeStyle = COLOR.laton; c.lineWidth = 1.2; c.stroke();
}

// el autobus volcado del nivel 8: lo pinta autobus.js (chasis, ruedas que giran, ventanillas, asientos)
export function dibujarBus(c, bus, t) { dibujarAutobus(c, bus, t); }

export function dibujarRejilla(c, r, t, abierta) {
  const s = r.solido;
  if (r.tipo === 1) {
    // rejilla de ventilacion del laboratorio (Hack 1: tres circulos)
    const x = s.x - 6, y = s.y, w = s.w + 12, h = s.h;
    if (abierta) { caja(c, x, y + h - 12, w, 12, '#2c333a', 3); return; }
    caja(c, x, y, w, h, '#2c333a', 4);
    for (let k = 1; k < 5; k++) linea(c, x + 4, y + (h * k) / 5, x + w - 4, y + (h * k) / 5, 2);
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(169,205,230,${0.35 + 0.2 * Math.sin(t * 2)})`; c.lineWidth = 1.4;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x + w / 2, y + 18 + k * 30, 6, 0, 7); c.stroke(); }
    c.restore();
  } else if (r.tipo === 3) dibujarRaiz(c, r, t, abierta);   // la raiz del tocon del Linde (Hack 3)
  else dibujarCompuerta(c, r, t, abierta);   // la compuerta del Hack 2: compuerta.js
}

// La raiz que cierra el tunel del Linde: cinco raices gruesas que bajan de la roca y se clavan en el suelo, en
// tinta con su corteza y su canto claro, y vetas de luz azul palido que laten (se abre con los anillos del tocon).
// Abierta, las raices se han recogido: solo quedan sus puntas colgando del techo.
function dibujarRaiz(c, r, t, abierta) {
  const s = r.solido, x = s.x + s.w / 2, y0 = s.y - 4, y1 = s.y + s.h;
  const L = abierta ? (y1 - y0) * 0.22 : y1 - y0;
  c.save(); c.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const dx = (k - 2) * 7, w = 9 - Math.abs(k - 2) * 1.5, ond = (k % 2 ? 1 : -1) * (6 + k);
    const pts = [[x + dx * 0.4, y0], [x + dx + ond, y0 + L * 0.35], [x + dx - ond * 0.6, y0 + L * 0.7], [x + dx * 1.6, y0 + L]];
    const camino = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]); };
    camino(); c.strokeStyle = TINTA; c.lineWidth = w + 3.5; c.stroke();
    camino(); c.strokeStyle = '#3a3122'; c.lineWidth = w; c.stroke();
    c.save(); c.translate(-w * 0.25, 0); camino(); c.strokeStyle = 'rgba(122,106,73,.75)'; c.lineWidth = w * 0.28; c.stroke(); c.restore();
    if (!abierta) { camino(); c.setLineDash([3, 9 + k]); c.lineDashOffset = -t * 6; c.strokeStyle = `rgba(169,205,230,${0.35 + 0.25 * Math.sin(t * 2 + k)})`; c.lineWidth = 1.4; c.stroke(); c.setLineDash([]); }
  }
  c.restore();
}

const FORMAS_LAB = ['roca_flotante', 'caja_rombo', 'frasco_estasis', 'chatarra_flotante'];
export function dibujarFlotante(c, s, t, zona) {
  if (zona === 'laboratorio' && s.forma === 'escombro') {
    // en la anomalia del nivel 1 flotan las piezas del laboratorio (assets), con su brillo frio
    const id = FORMAS_LAB[Math.floor(hash(Math.round(s.x), Math.round(s.y)) * FORMAS_LAB.length)];
    const bob = Math.sin(t * 0.9 + s.fase) * 3, giro = Math.sin(t * 0.5 + s.fase) * 0.12 + (id === 'frasco_estasis' ? 0.9 : 0);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(s.x + s.w / 2, s.y + s.h / 2, 0, s.x + s.w / 2, s.y + s.h / 2, 60);
    g.addColorStop(0, 'rgba(140,200,255,.18)'); g.addColorStop(1, 'rgba(140,200,255,0)');
    c.fillStyle = g; c.fillRect(s.x - 40, s.y - 50, s.w + 80, s.h + 100);
    c.restore();
    const esc = id === 'frasco_estasis' ? 0.5 : id === 'caja_rombo' ? 0.9 : 0.95;
    dibujarAsset(c, id, s.x + s.w / 2, s.y + s.h / 2 + bob + T / 2, 'libre', 0, { escala: esc, rot: giro });
    return;
  }
  const bob = Math.sin(t * 0.9 + s.fase) * 3, giro = Math.sin(t * 0.5 + s.fase) * 0.05;
  c.save(); c.translate(s.x + s.w / 2, s.y + s.h / 2 + bob); c.rotate(giro);
  const w = s.w, h = s.h;
  const semilla = Math.round(s.fase * 1000);   // fija: los flotantes se mueven
  if (s.forma === 'coche') {
    // el mismo turismo que en la calle, boca abajo: los bajos (planos) son donde se pisa
    const sc = w / 262;
    c.save(); c.translate(0, -h / 2 + 78 * sc);
    dibujarCoche(c, { semilla, vuelto: true, flota: true, escala: sc, verde: '#3f5a54', verdeClaro: '#7ea69b' });
    c.restore();
  } else if (s.forma === 'gota') {
    c.restore(); c.save(); c.translate(s.x + s.w / 2, s.y + s.h / 2 + bob);
    burbuja(c, w * 0.45, t, s.fase);
  } else if (s.forma === 'viga') vigaH(c, w, h * 0.8, semilla);
  else losa(c, w, h, semilla, ZONAS[zona] || ZONAS.plaza);
  c.restore();
}

export function dibujarObjeto(c, o) {
  c.save(); c.translate(o.x + o.w / 2, o.y + o.h / 2);
  c.rotate(o.volando ? (o.x * 0.08) : 0.2);
  caja(c, -9, -4, 18, 8, '#7d858d', 2, 0.4, 1.8);
  caja(c, -11, -7, 6, 14, '#8a929a', 3, 0.3, 1.8);
  c.restore();
}

export function dibujarNota(c, n, t, leida) {
  const x = n.x, y = n.pie;
  c.save(); c.translate(x, y - 6); c.rotate(-0.12 + Math.sin(t * 1.3 + x) * 0.03);
  trazar(c, temblar([[-11, -9], [11, -8], [10, 7], [-10, 8]], 6, 0.6, x | 0));
  c.fillStyle = '#e2d9c0'; c.fill(); tinta(c, 1.6);
  c.fillStyle = COLOR.varga; c.fillRect(-10, -8, 2, 15);
  c.fillStyle = 'rgba(40,40,40,.5)'; for (let k = 0; k < 4; k++) c.fillRect(-6, -5 + k * 3.4, 13 - (k % 2) * 4, 0.9);
  c.restore();
  if (!leida) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y - 8, 0, x, y - 8, 30); g.addColorStop(0, `rgba(169,205,230,${0.35 + 0.15 * Math.sin(t * 2.5)})`); g.addColorStop(1, 'rgba(169,205,230,0)');
    c.fillStyle = g; c.fillRect(x - 30, y - 38, 60, 60);
    c.restore();
  }
}

export function dibujarControl(c, k, t) {
  // circulo de tiza: el gesto que Varga le enseno
  const x = k.x, y = k.pie - 1;
  c.save();
  c.globalAlpha = k.activo ? 1 : 0.55;
  c.beginPath(); c.ellipse(x, y, 24, 5, 0, 0.2, Math.PI * 2 - 0.1);
  c.lineWidth = 2.2; c.strokeStyle = k.activo ? 'rgba(200,228,245,.95)' : 'rgba(220,220,215,.7)'; c.stroke();
  c.beginPath(); c.ellipse(x + 1, y - 0.5, 20, 3.6, 0.05, 0.5, Math.PI * 2 - 0.4); c.lineWidth = 1; c.stroke();
  if (k.activo) {
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y - 10, 0, x, y - 10, 46); g.addColorStop(0, 'rgba(169,205,230,.35)'); g.addColorStop(1, 'rgba(169,205,230,0)');
    c.fillStyle = g; c.fillRect(x - 46, y - 56, 92, 60);
    c.fillStyle = 'rgba(200,228,245,.8)';
    for (let q = 0; q < 6; q++) { const ci = (t * 0.4 + q / 6) % 1; c.globalAlpha = 1 - ci; c.fillRect(x - 18 + q * 7, y - ci * 50, 1.5, 1.5); }
  }
  c.restore();
}

export function dibujarDosis(c, d, t) {
  const y = d.y + Math.sin(t * 2 + d.x) * 3;
  c.save(); c.shadowColor = 'rgba(255,250,235,.9)'; c.shadowBlur = 12;
  caja(c, d.x - 4, y - 9, 8, 16, 'rgba(250,245,235,.85)', 3, 0.3, 1.4);
  c.fillStyle = TINTA; c.fillRect(d.x - 3, y - 12, 6, 3);
  c.restore();
}

export function dibujarItem(c, it, t, s) {
  if (it.cogido || it.oculto) return;
  const x = it.x, y = it.pie;
  if (it.tipo === 'daga') {
    c.save(); c.translate(x, y - 4); c.rotate(-0.25);
    trazar(c, [[-12, -2], [10, -2], [16, 0], [10, 2], [-12, 2]]); c.fillStyle = '#a7adb3'; c.fill(); tinta(c, 1.5);
    caja(c, -20, -3, 8, 6, '#3a2c20', 2, 0.3, 1.4);
    c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.max(0, Math.sin(t * 3))})`;
    c.beginPath(); c.arc(x + 10, y - 7, 2, 0, 7); c.fill(); c.restore();
  } else if (it.tipo === 'linea') {
    // el gancho de la linea de carga, al pie del tornillo
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,240,200,${0.25 + 0.2 * Math.sin(t * 3)})`; c.beginPath(); c.arc(x + 10, y - 20, 18, 0, 7); c.fill(); c.restore();
    // un rollo de cuerda trenzada en el suelo y el garfio encima, con las unas hacia arriba
    for (let k = 0; k < 4; k++) {
      c.beginPath(); c.ellipse(x + 8, y - 5 - k * 2.4, 11 - k * 0.8, 4, 0, 0, 7);
      c.strokeStyle = TINTA; c.lineWidth = 3.4; c.stroke(); c.strokeStyle = k % 2 ? '#8a6d48' : '#7d6040'; c.lineWidth = 1.8; c.stroke();
    }
    dibujarGarfio(c, x + 14, y - 26 + Math.sin(t * 2) * 1, -Math.PI / 2 + 0.35, 1.05, 0.8);
  } else if (it.tipo === 'tele') {
    // el corazon de la anomalia: blanco y azul brillante
    c.save(); c.globalCompositeOperation = 'lighter';
    const yy = y - 24 + Math.sin(t * 1.5) * 4;
    for (let k = 3; k > 0; k--) {
      const g = c.createRadialGradient(x, yy, 0, x, yy, 16 * k); g.addColorStop(0, `rgba(230,245,255,${0.5 / k})`); g.addColorStop(1, 'rgba(143,199,255,0)');
      c.fillStyle = g; c.fillRect(x - 50, yy - 50, 100, 100);
    }
    c.strokeStyle = 'rgba(230,245,255,.8)'; c.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(x, yy, 14 + k * 5, 5 + k * 2, t * (0.6 + k * 0.3) + k, 0, 7); c.stroke(); }
    c.restore();
  }
}
