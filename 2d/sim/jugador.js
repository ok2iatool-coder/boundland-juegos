// El Sujeto 18: controlador puro. Recibe lo que se mantiene pulsado (inp) y lo que se acaba de pulsar
// (ed), mueve, y deja en `ev` lo que ha pasado para que el sonido y los efectos lo pinten.
import { J, T } from './constantes.js';
import { moverX, moverY, suelo, soloPlataforma, cuerdaEn, libre, cx, cy } from './fisica.js';
import { celda, MACIZO, HUNDE, TALLO, PLAT } from './mapa.js';

export function crearJugador(xc, pie) {
  return {
    x: xc - J.ancho / 2, y: pie - J.alto, w: J.ancho, h: J.alto, vx: 0, vy: 0, cara: 1,
    enSuelo: false, sobre: null, coyote: 0, buffer: 0, saltando: false, doble: true,
    trepa: false, cuerda: null, gz: false, gzEmpujes: 2, gzEspera: 0,
    tele: 0, teleCd: 0, toque: { dir: 0, t: 9 },
    ataque: 0, ataqueDir: 'lado', ataqueCd: 0, golpeados: new Set(), retroceso: 0, retrocesoDir: 0,
    ataqueBuf: 0, combo: 0, tCombo: 9, remata: false, aereos: 0, racha: 0, tRacha: 0,
    vida: J.vida, invul: 0, aturdido: 0, zorro: false, carga: 0, sunikel: 0,
    esencia: 0, cura: 0, cargaD: 0, cargadoD: false, estocada: 0,
    lleva: null, seguro: { x: xc - J.ancho / 2, y: pie - J.alto }, leyendo: false,
    pose: 'reposo', tPose: 0, muerto: false,
  };
}

const RELOJES = ['invul', 'ataque', 'ataqueCd', 'retroceso', 'aturdido', 'tele', 'teleCd', 'sunikel', 'gzEspera', 'ataqueBuf', 'estocada', 'tEmpuje', 'gzEntra', 'embate', 'tPogo'];
const duro = (v) => v === MACIZO || v === HUNDE || v === TALLO;

function ponerPose(p, pose, dt) {
  if (p.pose !== pose) { p.pose = pose; p.tPose = 0; } else p.tPose += dt;
}

export const dentroZona = (E, p) => E.zonas.some((z) => cx(p) > z.x && cx(p) < z.x + z.w && cy(p) > z.y && cy(p) < z.y + z.h);

function soltarCuerda(p, ev, salto) {
  if (!p.cuerda) return;
  p.cuerda = null;
  p.buffer = 0; p.coyote = 0;
  if (salto) { p.vy = Math.min(p.vy, 0) - J.ganchoSuelta; p.vx *= 1.1; }
  p.doble = true;
  ev.push({ t: 'suelta' });
}

// Busca el punto de enganche mas cercano a la vista y a tiro
export function anclaCerca(E, p) {
  let mejor = null, dm = J.ganchoAlcance;
  for (const a of E.anclas) {
    if (a.oculta) continue;
    const ax = a.x(), ay = a.y();
    const d = Math.hypot(ax - cx(p), ay - cy(p));
    if (d < dm && ay < cy(p) + 20 && E.vistaAncla(cx(p), cy(p), ax, ay)) { dm = d; mejor = a; }
  }
  return mejor;
}

function teletransporte(E, p, dir, ev) {
  // Recorre el camino: se para en lo duro, cruza las rejas y los enemigos, cae donde quepa.
  let mejor = null;
  const c = { x: p.x, y: p.y, w: p.w, h: p.h };
  for (let d = 4; d <= J.teleDist; d += 4) {
    c.x = p.x + dir * d;
    const i0 = Math.floor(c.x / T), i1 = Math.floor((c.x + c.w - 0.01) / T);
    const j0 = Math.floor(c.y / T), j1 = Math.floor((c.y + c.h - 0.01) / T);
    let choca = false;
    for (let j = j0; j <= j1 && !choca; j++) for (let i = i0; i <= i1; i++) if (duro(celda(E.m, i, j))) { choca = true; break; }
    if (!choca) for (const s of E.mundo.solidos) if (s.activo && !s.paso && !s.reja && c.x < s.x + s.w && c.x + c.w > s.x && c.y < s.y + s.h && c.y + c.h > s.y) { choca = true; break; }
    if (choca) break;
    if (libre(E.mundo, c)) mejor = c.x;
  }
  if (mejor === null || Math.abs(mejor - p.x) < 16) return false;
  ev.push({ t: 'tele', x0: cx(p), y: cy(p), x1: mejor + p.w / 2 });
  p.x = mejor; p.tele = J.teleT; p.teleCd = J.teleCd; p.vy = 0; p.invul = Math.max(p.invul, J.teleT + 0.05);
  return true;
}

export function actualizarJugador(p, inp, ed, E, ev, dt) {
  for (const k of RELOJES) p[k] = Math.max(0, p[k] - dt);
  p.toque.t += dt;
  p.tCombo += dt;
  if (p.racha && (p.tRacha += dt) > J.rachaT) { p.racha = 0; ev.push({ t: 'racha_fin' }); }
  const hab = E.hab;
  const mundo = E.mundo;
  for (const k of ['tSalto', 'tDoble', 'tAterriza']) p[k] = Math.max(0, (p[k] || 0) - dt);
  if (p.leyendo || p.muerto) { p.vx = 0; p.tajoPendiente = null; ponerPose(p, p.leyendo ? 'leer' : 'muerte', dt); return; }
  // el REMATE se prepara unos fotogramas: el tajo sale ahora (y con el, el embate hacia delante si hay suelo);
  // si le golpean mientras se prepara, no sale
  if (p.tajoPendiente && (p.ataque <= J.ataqueT || p.aturdido > 0)) {
    const tj = p.tajoPendiente;
    p.tajoPendiente = null;
    if (p.aturdido > 0) p.ataque = 0;
    else if (p.ataque > 0) {
      ev.push({ ...tj, x: cx(p), y: cy(p) });
      if (p.enSuelo && tj.dir === 'lado') {
        const delante = { x: p.x + p.cara * (J.embateVel * J.embateT + 4), y: p.y, w: p.w, h: p.h };
        if (suelo(delante, E.mundo) && libre(E.mundo, delante)) p.embate = J.embateT;
      }
    }
  }
  p.buffer = ed.salto ? J.buffer : Math.max(0, p.buffer - dt);
  const dir = (inp.der ? 1 : 0) - (inp.izq ? 1 : 0);
  const vel = p.zorro ? J.velZorro : J.vel;
  const eraSuelo = p.enSuelo;

  // ---- forma zorro a voluntad (F) una vez despierta
  if (ed.zorro && hab.zorro) { p.zorro = !p.zorro; ev.push({ t: p.zorro ? 'zorro' : 'humano' }); }

  // ---- teletransporte: doble toque de direccion
  if (hab.tele && (ed.izq || ed.der)) {
    const d = ed.der ? 1 : -1;
    if (p.toque.dir === d && p.toque.t < J.teleVentana && p.teleCd <= 0 && !p.cuerda && !p.trepa) {
      if (teletransporte(E, p, d, ev)) { p.cara = d; p.toque.t = 9; }
    } else { p.toque.dir = d; p.toque.t = 0; }
  }
  if (p.tele > 0) { ponerPose(p, 'dash', dt); return; }

  // ---- lanzar (coger / soltar)
  if (ed.lanzar && hab.lanzar) {
    if (p.lleva) {
      let ax = p.cara, ay = -0.35;
      if (inp.apunta) { ax = inp.apunta.x - cx(p); ay = inp.apunta.y - (p.y + 6); }
      const n = Math.hypot(ax, ay) || 1;
      const o = p.lleva;
      o.vx = (ax / n) * J.lanzarVel + p.vx * 0.3; o.vy = (ay / n) * J.lanzarVel; o.volando = true; o.llevado = false;
      o.x = cx(p) - o.w / 2; o.y = p.y - o.h;
      p.lleva = null; if (Math.abs(ax) > 1) p.cara = Math.sign(ax);
      ev.push({ t: 'lanza' });
    } else {
      let mejor = null, dm = J.cogerDist;
      for (const o of E.objetos) {
        if (o.llevado || o.volando || o.gastado) continue;
        const d = Math.hypot(o.x + o.w / 2 - cx(p), o.y + o.h / 2 - (p.y + p.h - 10));
        if (d < dm) { dm = d; mejor = o; }
      }
      if (mejor) { p.lleva = mejor; mejor.llevado = true; ev.push({ t: 'coge' }); }
    }
  }

  // ---- ataque (daga) y Sunikel (zorro, mantener)
  if (hab.daga && !p.aturdido && !p.trepa) {
    if (p.zorro && inp.ataque && p.ataqueCd <= 0) p.carga += dt;
    const suelta = p.zorro && !inp.ataque && p.carga > 0;
    if (suelta && p.carga >= J.sunikelCarga && !p.cuerda) {
      p.sunikel = J.sunikelT; p.golpeados = new Set(); p.invul = Math.max(p.invul, J.sunikelT + 0.08);
      p.carga = 0; p.ataqueCd = J.ataqueCd; ev.push({ t: 'sunikel' });
    } else {
      // pulsado antes de tiempo: se guarda y sale en cuanto se pueda
      if (!p.zorro && ed.ataque && p.ataqueCd > 0) p.ataqueBuf = J.ataqueBufLargo;
      const pide = p.zorro ? suelta : ed.ataque || p.ataqueBuf > 0;
      if (pide && p.ataqueCd <= 0 && p.carga < J.sunikelCarga) {
        p.carga = 0; p.ataqueBuf = 0;
        p.golpeados = new Set();
        p.ataqueDir = inp.arriba ? 'arriba' : inp.abajo && !p.enSuelo ? 'abajo' : 'lado';
        p.alterna = !p.alterna;                 // los tajos de lado se alternan (de arriba abajo y al reves)
        p.combo = p.tCombo < J.comboVentana ? (p.combo % 3) + 1 : 1;
        p.remata = p.combo === 3;
        p.tCombo = 0;
        // el remate de lado se prepara `remataAnticipa` (golpes() no le cuenta la caja hasta que sale) y deja
        // una espera mas larga, que no se acorta al acertar: ese es el ritmo del combo
        const prepara = p.remata && p.ataqueDir === 'lado';
        p.ataque = J.ataqueT + (prepara ? J.remataAnticipa : 0);
        p.ataqueCd = prepara ? J.remataCd : J.ataqueCd;
        // en el aire, el tajo de lado sostiene un instante (dos por salto)
        if (!p.enSuelo && p.ataqueDir === 'lado' && p.vy > J.frenoAire && p.aereos < J.aereos) { p.vy = J.frenoAire; p.aereos++; }
        const tj = { t: 'tajo', dir: p.ataqueDir, zorro: p.zorro, alterna: p.alterna, combo: p.combo, remata: p.remata, x: cx(p), y: cy(p) };
        if (prepara) { p.tajoPendiente = tj; ev.push({ t: 'remate_prepara', x: cx(p), y: cy(p), cara: p.cara, zorro: p.zorro }); }
        else { p.tajoPendiente = null; ev.push(tj); }
      }
    }
    if (!inp.ataque && p.carga >= J.sunikelCarga) p.carga = 0;
    // ESTOCADA (forma normal): el tajo sale al pulsar; si se SIGUE manteniendo, la daga se carga y al
    // soltar el 18 se lanza hacia delante, invulnerable mientras dura, y rompe la postura
    if (!p.zorro) {
      if (inp.ataque && p.estocada <= 0 && !p.cuerda && !p.lleva && p.cura <= 0) {
        p.cargaD += dt;
        if (p.cargaD >= J.estocadaCarga && !p.cargadoD) { p.cargadoD = true; ev.push({ t: 'cargado', x: cx(p), y: cy(p) }); }
      } else {
        if (p.cargadoD && !inp.ataque && !p.cuerda) {
          p.estocada = J.estocadaT; p.golpeados = new Set(); p.invul = Math.max(p.invul, J.estocadaT + 0.06);
          p.ataqueCd = J.ataqueCd; p.ataqueBuf = 0; p.ataque = 0;
          ev.push({ t: 'estocada', x: cx(p), y: cy(p), cara: p.cara });
        }
        p.cargaD = 0; p.cargadoD = false;
      }
    }
  }
  if (p.aturdido > 0 || p.trepa) { p.cargaD = 0; p.cargadoD = false; }
  if (p.carga > 0 && p.carga >= J.sunikelCarga && !p.cargado) { p.cargado = true; ev.push({ t: 'cargado' }); }
  if (p.carga === 0) p.cargado = false;

  // ---- CURAR: mantener la tecla de curar, quieto en el suelo, convierte esencia en una dosis
  const puedeCurar = inp.curar && p.enSuelo && !p.aturdido && p.ataque <= 0 && p.estocada <= 0 && p.sunikel <= 0 &&
    !p.lleva && !p.trepa && !p.cuerda && p.esencia >= J.curaCoste && p.vida < (p.vidaMax || J.vida);
  if (puedeCurar) {
    if (p.cura === 0) ev.push({ t: 'cura_empieza', x: cx(p), y: cy(p) });
    p.cura += dt;
    if (p.cura >= J.curaT) {
      p.cura = 0; p.vida = Math.min(p.vidaMax || J.vida, p.vida + 1); p.esencia -= J.curaCoste;
      ev.push({ t: 'cura_esencia', x: cx(p), y: cy(p), vida: p.vida });
    }
  } else p.cura = 0;

  // ---- colgado del gancho: pendulo
  if (p.cuerda) {
    const a = p.cuerda.a;
    if (a.oculta) { soltarCuerda(p, ev, false); }
  }
  if (p.cuerda) {
    const a = p.cuerda.a, ax = a.x(), ay = a.y();
    if (inp.arriba) p.cuerda.L = Math.max(J.ganchoMin, p.cuerda.L - J.ganchoCuerda * dt);
    // arriba del todo de una linea que cuelga de una cabeza (tornillo gigante): se sube encima
    if (inp.arriba && a.subir && p.cuerda.L <= J.ganchoMin + 1 && Math.hypot(cx(p) - ax, cy(p) - ay) < J.ganchoMin + 8) {
      const d = a.subir();
      const c = { x: d.x, y: d.y - p.h, w: p.w, h: p.h };
      if (libre(mundo, c)) {
        p.x = c.x; p.y = c.y; p.vx = 0; p.vy = 0; p.cuerda = null; p.doble = true;
        ev.push({ t: 'sube', x: cx(p), y: p.y + p.h });
        ponerPose(p, 'aterriza', dt);
        return;
      }
    }
    if (inp.abajo) p.cuerda.L = Math.min(J.ganchoMax, p.cuerda.L + J.ganchoCuerda * dt);
    const s = suelo(p, mundo) || (p.enSuelo && p.vy >= 0 ? true : null);
    const dx0 = cx(p) - ax, dy0 = cy(p) - ay, d0 = Math.hypot(dx0, dy0) || 1;
    const tensa = d0 >= p.cuerda.L - 3;
    let tirando = false;
    if (s && p.vy >= 0) {
      // en el suelo con la cuerda: se anda; si se tira de algo arrastrable, va despacio y lo arrastra
      const lejos = dir !== 0 && Math.sign(dx0) === dir;
      if (lejos && tensa && a.obj && a.obj.arrastrable && !a.obj.libre) {
        tirando = true;
        p.vx = dir * a.obj.velArrastre;
        a.obj.tirar(dir, dt, ev);
      } else p.vx = dir * vel;
      p.vy = 0;
    } else {
      p.vy = Math.min(p.vy + J.grav * dt, J.caidaMax);
      p.vx += dir * J.ganchoBombeo * dt;
      p.vx *= Math.exp(-0.25 * dt);
    }
    if (dir) p.cara = dir;
    const bx = moverX(p, mundo, p.vx * dt);
    if (bx && !tirando) p.vx = 0;
    const by = moverY(p, mundo, p.vy * dt);
    if (by) p.vy = 0;
    // la cuerda no estira: vuelve el centro a la distancia L y quita la velocidad hacia fuera
    const dx = cx(p) - ax, dy = cy(p) - ay, d = Math.hypot(dx, dy) || 1;
    if (tirando) p.cuerda.L = Math.max(J.ganchoMin, Math.min(J.ganchoMax, d));
    else if (d > p.cuerda.L) {
      const nx = dx / d, ny = dy / d, sobra = d - p.cuerda.L;
      moverX(p, mundo, -nx * sobra);
      moverY(p, mundo, -ny * sobra);
      const vr = p.vx * nx + p.vy * ny;
      if (vr > 0) { p.vx -= vr * nx; p.vy -= vr * ny; }
    }
    p.enSuelo = !!suelo(p, mundo);
    if (ed.salto) { soltarCuerda(p, ev, true); }
    else if (ed.accion) { soltarCuerda(p, ev, false); }
    ponerPose(p, tirando ? 'andar' : p.enSuelo ? (dir ? 'andar' : 'reposo') : 'trepar', dt);
    if (p.cuerda) return;
  }

  // ---- engancharse (E)
  if (ed.accion && hab.gancho && !E.interactuable) {
    const a = anclaCerca(E, p);
    if (a) {
      const d = Math.hypot(a.x() - cx(p), a.y() - cy(p));
      p.cuerda = { a, L: Math.max(J.ganchoMin, Math.min(J.ganchoMax, d)) };
      p.trepa = false; p.saltando = false;
      ev.push({ t: 'engancha', x: a.x(), y: a.y() });
      return;
    }
  }

  // ---- gravedad cero
  const eraGz = p.gz;
  p.gz = dentroZona(E, p);
  if (p.gz) {
    // al entrar (despues de un rato fuera) la capa deja de colgar: hoja `flotar_entra`
    if (!eraGz && (p.tFueraGz ?? 9) > 0.3) p.gzEntra = J.gzEntraT;
    p.tFueraGz = 0;
    p.trepa = false;
    const ay = (inp.abajo ? 1 : 0) - (inp.arriba ? 1 : 0);
    p.vx += dir * J.gzAcel * dt;
    p.vy += -J.gzSube * dt;
    const roce = Math.exp(-J.gzRoce * dt);
    p.vx *= roce; p.vy *= roce;
    if (ed.salto && p.gzEspera <= 0 && p.gzEmpujes > 0) {
      let ex = dir, ey = ay;
      if (!ex && !ey) ey = -1;
      const n = Math.hypot(ex, ey);
      p.vx = (ex / n) * J.gzEmpuje; p.vy = (ey / n) * J.gzEmpuje;
      p.gzEspera = J.gzEspera; p.gzEmpujes--;
      p.tEmpuje = J.gzEmpujeT; p.gzEntra = 0; p.pose = null;    // la hoja del empujon empieza de nuevo
      ev.push({ t: 'empuje', x: cx(p), y: cy(p), dx: ex / n, dy: ey / n });
    }
    if (dir) p.cara = dir;
    const vx0 = p.vx, vy0 = p.vy;
    const bx = moverX(p, mundo, p.vx * dt);
    const by = moverY(p, mundo, p.vy * dt);
    if (bx) p.vx = 0;
    if (by) p.vy = 0;
    // un choque de verdad (no estar apoyado): el dibujo aplasta al 18 contra la pared y suelta luz
    const vChoque = Math.max(bx ? Math.abs(vx0) : 0, by ? Math.abs(vy0) : 0);
    if (vChoque > J.gzChoqueV) {
      const deLado = bx && (!by || Math.abs(vx0) >= Math.abs(vy0));
      const nx = deLado ? -bx : 0, ny = deLado ? 0 : -by;
      ev.push({ t: 'choca_gz', x: cx(p) - nx * p.w / 2, y: cy(p) - ny * p.h / 2, nx, ny, v: vChoque });
    }
    if (bx || by) { if (p.gzEmpujes < 2) ev.push({ t: 'toca_gz' }); p.gzEmpujes = 2; if (!dir && !ay) { p.vx *= 0.5; p.vy *= 0.5; } }
    p.enSuelo = false; p.doble = true;
    // la pose: el tajo y el aturdido mandan; luego el empujon, la entrada y el bucle de flotar
    const pose = p.aturdido > 0 ? 'dano'
      : p.ataque > 0 ? (p.ataqueDir === 'arriba' ? 'ataque_arriba' : p.ataqueDir === 'abajo' ? 'ataque_abajo' : p.alterna ? 'ataque2' : 'ataque')
      : p.tEmpuje > 0 ? 'empuje' : p.gzEntra > 0 ? 'flotar_entra' : 'flotar';
    ponerPose(p, pose, dt);
    return;
  }
  p.tFueraGz = (p.tFueraGz ?? 9) + dt;
  p.tEmpuje = 0; p.gzEntra = 0;

  // ---- trepar cuerdas y la escalera de ADN
  const ci = cuerdaEn(p, E.m);
  if (!p.trepa && ci >= 0 && (inp.arriba || (inp.abajo && !p.enSuelo)) && p.ataque <= 0 && !p.lleva) {
    p.trepa = true; p.x = ci * T + T / 2 - p.w / 2; p.vx = 0; p.vy = 0; ev.push({ t: 'agarra' });
  }
  if (p.trepa) {
    if (ci < 0) p.trepa = false;
    else if (ed.salto) {
      p.trepa = false; p.vy = -J.salto * 0.85; p.vx = dir * vel; p.saltando = true; p.doble = true; ev.push({ t: 'salto' });
    } else {
      p.vy = ((inp.abajo ? 1 : 0) - (inp.arriba ? 1 : 0)) * J.trepar;
      if (dir) p.cara = dir;
      const by = moverY(p, mundo, p.vy * dt);
      // arriba del todo: se sube al borde si hay sitio
      if (cuerdaEn(p, E.m) < 0 && p.vy < 0) { p.trepa = false; p.vy = -260; }
      if (by > 0) { p.trepa = false; }
      p.enSuelo = false; p.doble = true;
      ponerPose(p, p.vy ? 'trepar' : 'trepar_quieto', dt);
      return;
    }
  }

  // ---- horizontal: arranque inmediato a media velocidad y aceleracion corta hasta la entera; frenada
  // de tres fotogramas; dar la vuelta en el suelo es casi seco (y levanta polvo). Empujones, retroceso del
  // golpe y Sunikel mandan sobre todo
  if (p.sunikel > 0) { p.vx = p.cara * J.sunikelVel; p.vy = 0; }
  else if (p.estocada > 0) { p.vx = p.cara * J.estocadaVel; p.vy = 0; }
  else if (p.cura > 0) p.vx = 0;
  else if (p.aturdido > 0) p.vx *= Math.exp(-3 * dt);
  else if (p.retroceso > 0) p.vx = p.retrocesoDir * (p.retrocesoV || J.retroceso);
  else if (p.embate > 0) p.vx = p.cara * J.embateVel;
  else {
    const meta = dir * vel * (p.carga > 0.12 ? 0.35 : p.cargaD > 0.2 ? 0.6 : 1), suelo0 = p.enSuelo;
    if (dir && p.vx * dir < Math.abs(meta) * J.arranque && p.vx * dir >= 0) p.vx = dir * Math.abs(meta) * J.arranque;
    const vuelta = dir && p.vx * dir < 0;
    if (vuelta && suelo0 && Math.abs(p.vx) > vel * 0.6 && !p.derrapa) { p.derrapa = true; ev.push({ t: 'derrape', x: cx(p), y: p.y + p.h, dir }); }
    if (!vuelta) p.derrapa = false;
    const a = !dir ? (suelo0 ? J.frena : J.frenaAire) : vuelta ? (suelo0 ? J.giro : J.acelAire * 1.4) : suelo0 ? J.acel : J.acelAire;
    const dv = meta - p.vx, paso = a * dt;
    p.vx = Math.abs(dv) <= paso ? meta : p.vx + Math.sign(dv) * paso;
  }
  if (dir && p.ataque <= 0 && !p.aturdido && p.sunikel <= 0) p.cara = dir;

  // ---- salto (coyote, memoria de pulsacion), doble salto y caida por plataforma
  if (!p.aturdido && p.buffer > 0 && p.sunikel <= 0 && p.estocada <= 0 && p.cura <= 0) {
    if (p.enSuelo && inp.abajo && soloPlataforma(p, mundo)) {
      p.atraviesa = 0.25; p.buffer = 0; p.enSuelo = false;
    } else if (p.enSuelo || p.coyote > 0) {
      p.vy = -(p.zorro ? J.saltoZorro : J.salto); p.saltando = true; p.enSuelo = false; p.coyote = 0; p.buffer = 0;
      p.tSalto = 0.09;
      ev.push({ t: 'salto' });
    } else if (p.doble && E.hab.doble !== false) {        // (la zona del laboratorio lo gana en la orilla)
      p.vy = -J.doble; p.saltando = true; p.doble = false; p.buffer = 0;
      p.tDoble = 0.33;
      ev.push({ t: 'doble', x: cx(p), y: p.y + p.h });
    }
  }
  if (p.saltando && !inp.salto && p.vy < 0) { p.vy *= J.corte; p.saltando = false; }
  if (p.vy >= 0) p.saltando = false;

  if (p.sunikel <= 0) {
    let g = p.vy > 0 ? J.gravCaida : J.grav;
    if (p.saltando && inp.salto && Math.abs(p.vy) < J.cumbreV) g *= J.cumbreG;
    p.vy = Math.min(p.vy + g * dt, J.caidaMax);
  }
  p.atraviesa = Math.max(0, (p.atraviesa || 0) - dt);
  const bx = moverX(p, mundo, p.vx * dt);
  if (bx && p.sunikel > 0) p.sunikel = 0;
  if (bx && p.estocada > 0) p.estocada = 0;
  const vyAntes = p.vy;
  let by = moverY(p, mundo, p.vy * dt, p.atraviesa > 0);
  // la cabeza roza una esquina al subir: se le aparta y sigue subiendo
  if (by < 0 && vyAntes < -200) {
    const prueba = { x: p.x, y: p.y + vyAntes * dt, w: p.w, h: p.h };
    fuera: for (let d = 1; d <= J.esquina; d++) for (const sx of [1, -1]) {
      prueba.x = p.x + sx * d;
      if (libre(mundo, prueba)) { if (!moverX(p, mundo, sx * d)) { by = moverY(p, mundo, vyAntes * dt); p.vy = vyAntes; } break fuera; }
    }
  }
  if (by > 0) {
    if (p.vy > 420) ev.push({ t: 'aterriza', x: cx(p), y: p.y + p.h, fuerte: p.vy > 760 });
    p.caidaFuerte = p.vy > 760;
    if (p.vy > 200) p.tAterriza = 0.18;
    p.vy = 0;
  }
  if (by < 0) { p.vy = 0; p.saltando = false; }

  const s = suelo(p, mundo);
  p.enSuelo = !!s && p.vy >= 0;
  p.sobre = s;
  if (p.enSuelo) {
    p.coyote = J.coyote; p.doble = true; p.aereos = 0;
    // arrastrado por lo que le lleva (escombro que flota, autobus)
    if (s.solido && s.solido.dx) moverX(p, mundo, s.solido.dx);
    if (s.solido && s.solido.dy) moverY(p, mundo, s.solido.dy);
    const firme = s.tile !== undefined ? (s.tile === MACIZO || s.tile === PLAT) : s.solido && s.solido.firme;
    if (firme && p.invul <= 0 && !E.peligroEn(p)) p.seguro = { x: p.x, y: p.y };
  } else p.coyote = Math.max(0, p.coyote - dt);
  if (!eraSuelo && p.enSuelo) p.doble = true;

  // ---- pose, a lo Hollow Knight: arranque y frenada, giro al cambiar de lado, despegue, subida, cumbre
  // y caida, aterrizaje normal o fuerte, tajos que se alternan. Lo que el cuerpo hace, no solo adonde va.
  let pose;
  const ant = p.pose, tp = p.tPose;
  if (p.aturdido > 0) pose = 'dano';
  else if (p.sunikel > 0) pose = 'dash';
  else if (p.estocada > 0) pose = 'ataque';
  else if (p.cura > 0) pose = 'leer';
  else if (p.ataque > 0) pose = p.ataqueDir === 'arriba' ? 'ataque_arriba' : p.ataqueDir === 'abajo' ? 'ataque_abajo' : p.remata ? 'remate' : p.alterna ? 'ataque2' : 'ataque';
  else if (!p.enSuelo) {
    if (p.tDoble > 0) pose = 'doble';
    else if (p.tSalto > 0) pose = 'despegue';
    else if (p.vy < -260) pose = 'subir';
    else if (p.vy < 240) pose = 'cumbre';
    else pose = 'caer';
  } else if (!eraSuelo) pose = p.caidaFuerte ? 'aterriza_fuerte' : 'aterriza';
  else if (!dir && ((ant === 'aterriza' && tp < 0.16) || (ant === 'aterriza_fuerte' && tp < 0.3))) pose = ant;
  else if (dir && p.dirAntes && dir !== p.dirAntes && (ant === 'correr' || ant === 'arranque' || ant === 'frenar')) pose = 'giro';
  else if (dir) {
    if (ant === 'correr') pose = 'correr';
    else if (ant === 'giro') pose = tp < 0.11 ? 'giro' : 'correr';
    else if (ant === 'arranque') pose = tp < 0.15 ? 'arranque' : 'correr';
    else pose = ant.startsWith('ataque') || ant.startsWith('aterriza') || ant === 'dash' ? 'correr' : 'arranque';
  } else if ((ant === 'correr' && tp > 0.2) || (ant === 'frenar' && tp < 0.22)) pose = 'frenar';
  else pose = 'reposo';
  if (dir) p.dirAntes = dir;
  // pasos: dos por ciclo de carrera
  if (pose === 'correr') { p.tPaso = (p.tPaso || 0) + dt; if (p.tPaso > 0.215) { p.tPaso = 0; ev.push({ t: 'paso', x: cx(p), y: p.y + p.h }); } }
  else p.tPaso = 0.2;
  ponerPose(p, pose, dt);
}
