// Militares mutados (la Podredumbre los mueve), esporas, tallos escupidores y hormigas
// entomorficas. Las hormigas NO mueren: a los dos golpes huyen (GDD: no son el enemigo).
// Combate: todo ataque se AVISA antes (el soldado alza el brazo con un destello, el tallo se hincha, la
// espora se infla) y cada enemigo tiene AGUANTE: los golpes lo gastan y al romperse queda aturdido.
import { T, J } from './constantes.js';
import { moverX, moverY, solida, vista, cx, cy } from './fisica.js';
import { celda, PLAT } from './mapa.js';

export function crearEnemigo(tipo, xc, pie) {
  const base = { tipo, vx: 0, vy: 0, cara: -1, t: 0, estado: 'patrulla', golpe: 0, vivo: true, x0: xc };
  switch (tipo) {
    case 'soldado': return { ...base, w: 26, h: 56, x: xc - 13, y: pie - 56, vida: 4, vidaMax: 4, dano: 1, aguante: 3, aguanteMax: 3 };
    case 'hormiga': return { ...base, w: 28, h: 44, x: xc - 14, y: pie - 44, vida: 2, vidaMax: 2, dano: 1, aguante: 99, aguanteMax: 99 };
    case 'espora': return { ...base, w: 22, h: 22, x: xc - 11, y: pie - 40, vida: 1, vidaMax: 1, dano: 1, cy0: pie - 29, fase: xc * 0.013, aguante: 1, aguanteMax: 1, recarga: 0 };
    case 'tallo': return { ...base, w: 30, h: 50, x: xc - 15, y: pie - 50, vida: 2, vidaMax: 2, dano: 1, recarga: 1, apunta: 0, aguante: 2, aguanteMax: 2 };
  }
  throw new Error('enemigo desconocido ' + tipo);
}

// la zona que hace dano cuando el enemigo GOLPEA (y que un tajo del 18 puede parar)
export function cajaAtaque(en) {
  if (!en.vivo) return null;
  if (en.tipo === 'soldado' && en.estado === 'golpea') return { x: en.cara > 0 ? en.x + en.w - 4 : en.x - 54, y: en.y + 8, w: 58, h: en.h - 16 };
  if (en.tipo === 'soldado' && en.estado === 'embiste' && en.t < 0.3) return { x: en.x - 4, y: en.y, w: en.w + 8, h: en.h };
  if (en.tipo === 'espora' && en.estado === 'lanza') return { x: en.x - 2, y: en.y - 2, w: en.w + 4, h: en.h + 4 };
  return null;
}

// lo que un tajo del 18 puede PARAR: el golpe en curso y tambien el final del aviso (los ultimos 0,12 s
// del brazo alzado), para que la ventana sea de unos 0,22 s y no de un fotograma
export function cajaChoque(en) {
  const g = cajaAtaque(en);
  if (g) return g;
  if (en.vivo && en.tipo === 'soldado' && en.estado === 'prepara' && en.t > 0.3) return { x: en.cara > 0 ? en.x + en.w - 4 : en.x - 54, y: en.y + 8, w: 58, h: en.h - 16 };
  if (en.vivo && en.tipo === 'soldado' && en.estado === 'aviso' && en.t > 0.33) return { x: en.x - 4, y: en.y, w: en.w + 8, h: en.h };
  return null;
}

export function aturdir(en, ev, t = J.aturdeT) {
  en.estado = 'aturdido'; en.t = 0; en.tAturde = t; en.vx = 0; en.apunta = 0;
  en.aguante = en.aguanteMax;
  ev.push({ t: 'aturdido', x: cx(en), y: en.y - 6 });
}

const delante = (E, en, d) => {
  // hay suelo delante y no hay pared?
  const x = d > 0 ? en.x + en.w + 2 : en.x - 2;
  const pie = en.y + en.h;
  const sueloDelante = solida(E.m, Math.floor(x / T), Math.floor((pie + 4) / T)) || celda(E.m, Math.floor(x / T), Math.floor((pie + 4) / T)) === PLAT;
  const pared = solida(E.m, Math.floor(x / T), Math.floor((pie - 10) / T));
  return sueloDelante && !pared;
};

function gravedad(E, en, dt) {
  en.vy = Math.min(en.vy + 2100 * dt, 820);
  const b = moverY(en, E.mundo, en.vy * dt);
  if (b) en.vy = 0;
}

export function actualizarEnemigos(E, dt, ev) {
  const p = E.p;
  for (const en of E.enemigos) {
    if (!en.vivo) continue;
    en.t += dt;
    en.golpe = Math.max(0, en.golpe - dt);
    const dx = cx(p) - cx(en), dy = cy(p) - cy(en);
    const ve = Math.abs(dx) < 300 && Math.abs(dy) < 120 && !p.muerto && vista(E.mundo, cx(en), en.y + 10, cx(p), p.y + 10);
    // aturdido: se tambalea en su sitio y no ataca
    if (en.estado === 'aturdido') {
      en.vx *= Math.exp(-6 * dt);
      if (en.tipo === 'espora') { moverX(en, E.mundo, en.vx * dt); en.vy = Math.sin(en.t * 9) * 20; moverY(en, E.mundo, en.vy * dt); }
      else if (en.tipo !== 'tallo') { moverX(en, E.mundo, en.vx * dt); gravedad(E, en, dt); }
      if (en.t > en.tAturde) { en.estado = en.tipo === 'soldado' ? 'recupera' : 'patrulla'; en.t = 0; }
      continue;
    }
    if (en.tipo === 'soldado') {
      if (en.golpe > 0 && en.estado !== 'golpea') { en.vx *= Math.exp(-6 * dt); }
      else if (en.estado === 'patrulla') {
        en.vx = en.cara * 55;
        if (!delante(E, en, en.cara)) en.cara *= -1;
        // de cerca, zarpazo; de lejos, embestida (las dos con aviso)
        if (ve && Math.abs(dx) < 86 && Math.abs(dy) < 50) { en.estado = 'prepara'; en.t = 0; en.cara = Math.sign(dx) || en.cara; ev.push({ t: 'aviso_golpe', x: cx(en) + en.cara * 14, y: en.y + 4 }); }
        else if (ve && Math.abs(dx) < 250 && (Math.sign(dx) === en.cara || Math.abs(dx) < 90)) { en.estado = 'aviso'; en.t = 0; en.cara = Math.sign(dx) || en.cara; ev.push({ t: 'soldado_aviso', x: cx(en), y: en.y }); }
      } else if (en.estado === 'prepara') {
        en.vx = 0;
        if (en.t > 0.42) { en.estado = 'golpea'; en.t = 0; ev.push({ t: 'zarpazo', x: cx(en) + en.cara * 30, y: cy(en), cara: en.cara }); }
      } else if (en.estado === 'golpea') {
        en.vx = en.cara * 120;
        if (en.t > 0.14) { en.estado = 'recupera'; en.t = 0; }
      } else if (en.estado === 'aviso') {
        en.vx = 0;
        if (en.t > 0.45) { en.estado = 'embiste'; en.t = 0; }
      } else if (en.estado === 'embiste') {
        en.vx = delante(E, en, en.cara) ? en.cara * 430 : 0;
        if (en.t > 0.42) { en.estado = 'recupera'; en.t = 0; }
      } else if (en.estado === 'recupera') {
        en.vx = 0;
        if (en.t > 0.6) { en.estado = 'patrulla'; en.t = 0; }
      }
      if (moverX(en, E.mundo, en.vx * dt)) { en.cara *= -1; if (en.estado === 'embiste') { en.estado = 'recupera'; en.t = 0; } }
      gravedad(E, en, dt);
    } else if (en.tipo === 'hormiga') {
      if (en.estado === 'huye') {
        // el golpe que la espanta la lanza por el aire (golpearEnemigo); al caer, sale corriendo
        const vuela = en.t < 0.3;
        en.vx = vuela ? en.vx * Math.exp(-2.5 * dt) : en.cara * 260;
        if (en.t > 2.2) { en.vivo = false; continue; }
        if (moverX(en, E.mundo, en.vx * dt) || (!vuela && !delante(E, en, en.cara))) {
          if (en.t > 0.6) { en.vivo = false; ev.push({ t: 'hormiga_se_va', x: cx(en), y: cy(en) }); continue; }
          en.cara *= -1;
        }
        gravedad(E, en, dt);
        continue;
      }
      if (en.golpe > 0) en.vx *= Math.exp(-6 * dt);
      else if (ve && Math.abs(dx) < 220) { en.cara = Math.sign(dx) || 1; en.vx = delante(E, en, en.cara) ? en.cara * 210 : 0; en.estado = 'corre'; }
      else {
        en.estado = 'patrulla';
        en.vx = en.cara * 80;
        if (!delante(E, en, en.cara)) en.cara *= -1;
      }
      if (moverX(en, E.mundo, en.vx * dt)) en.cara *= -1;
      gravedad(E, en, dt);
    } else if (en.tipo === 'espora') {
      // flota; si el 18 se acerca, se INFLA (aviso) y se lanza contra el; luego descansa
      en.recarga = Math.max(0, en.recarga - dt);
      if (en.golpe > 0) {
        moverX(en, E.mundo, en.vx * dt); moverY(en, E.mundo, en.vy * dt);
        en.vx *= Math.exp(-5 * dt); en.vy *= Math.exp(-5 * dt);
      } else if (en.estado === 'hincha') {
        en.vx *= Math.exp(-8 * dt); en.vy *= Math.exp(-8 * dt);
        if (en.t > 0.5) {
          const n = Math.hypot(dx, dy) || 1;
          en.estado = 'lanza'; en.t = 0; en.vx = (dx / n) * 330; en.vy = (dy / n) * 330;
          ev.push({ t: 'espora_lanza', x: cx(en), y: cy(en) });
        }
      } else if (en.estado === 'lanza') {
        const bx = moverX(en, E.mundo, en.vx * dt), by = moverY(en, E.mundo, en.vy * dt);
        if (en.t > 0.45 || bx || by) { en.estado = 'patrulla'; en.t = 0; en.recarga = 1.2; en.vx *= 0.2; en.vy *= 0.2; }
      } else if (ve && Math.hypot(dx, dy) < 150 && en.recarga <= 0) {
        en.estado = 'hincha'; en.t = 0;
        ev.push({ t: 'espora_hincha', x: cx(en), y: cy(en) });
      } else if (ve && Math.hypot(dx, dy) < 280) {
        const n = Math.hypot(dx, dy) || 1;
        en.vx += (dx / n) * 160 * dt; en.vy += (dy / n) * 160 * dt;
        const v = Math.hypot(en.vx, en.vy);
        if (v > 70) { en.vx *= 70 / v; en.vy *= 70 / v; }
        moverX(en, E.mundo, en.vx * dt); moverY(en, E.mundo, en.vy * dt);
      } else {
        en.vx *= Math.exp(-2 * dt); en.vy = (en.cy0 + Math.sin(en.t * 1.7 + en.fase) * 8 - cy(en)) * 2;
        moverX(en, E.mundo, en.vx * dt); moverY(en, E.mundo, en.vy * dt);
      }
    } else if (en.tipo === 'tallo') {
      en.recarga -= dt;
      en.cara = Math.sign(dx) || -1;
      // se hincha antes de escupir (aviso); el proyectil se puede devolver con un tajo
      if (en.apunta > 0) {
        en.apunta -= dt;
        if (en.apunta <= 0) {
          const n = Math.hypot(dx, dy) || 1;
          E.proyectiles.push({ x: cx(en) - 7, y: en.y + 6, w: 14, h: 14, vx: (dx / n) * 190, vy: (dy / n) * 190, vida: 4, dano: 1 });
          ev.push({ t: 'escupe', x: cx(en), y: en.y + 8 });
        }
      } else if (en.recarga <= 0 && Math.hypot(dx, dy) < 460 && vista(E.mundo, cx(en), en.y + 8, cx(p), cy(p))) {
        en.recarga = 1.7; en.apunta = 0.35;
        ev.push({ t: 'tallo_aviso', x: cx(en), y: en.y + 8 });
      }
    }
  }
}

// postura: cuanto aguante gasta el golpe (el remate 2, la estocada 3, el proyectil devuelto 2)
export function golpearEnemigo(E, en, dano, dirX, ev, dirY = 0, empuje = 1, postura = 1) {
  if (!en.vivo || en.estado === 'huye') return false;
  if (en.estado === 'aturdido') dano += 1;          // aturdido recibe un punto mas
  en.vida -= dano;
  // la hormiga se queda sin moverse un rato al recibir (antes volvia a cargar a las 0,18 s: medido, la
  // hormiga acababa MAS CERCA del 18 medio segundo despues del golpe) y da un saltito hacia atras
  en.golpe = en.tipo === 'hormiga' ? J.hormigaAturde : 0.18;
  en.golpe0 = en.golpe;
  const aturdido = en.estado === 'aturdido';
  en.vx = dirX * (en.tipo === 'soldado' ? 260 : en.tipo === 'hormiga' ? 270 : 320) * empuje * (aturdido ? 0.5 : 1);
  // el remate los levanta del suelo (el tallo esta clavado)
  if (empuje > 1 && en.tipo !== 'tallo' && en.tipo !== 'espora') en.vy = -260;
  else if (en.tipo === 'hormiga') en.vy = -150;
  if (en.tipo === 'espora') en.vy = dirY * 200 * empuje;
  // un golpe interrumpe la preparacion de su ataque
  if (en.estado === 'prepara' || en.estado === 'hincha') { en.estado = en.tipo === 'soldado' ? 'recupera' : 'patrulla'; en.t = 0; }
  if (en.tipo === 'tallo') en.apunta = 0;
  ev.push({ t: 'golpe', x: cx(en), y: cy(en), dir: dirX, tipo: en.tipo });
  if (en.vida <= 0) {
    if (en.tipo === 'hormiga') {
      // espantada: sale despedida por el aire, cae y huye (no muere)
      en.estado = 'huye'; en.t = 0; en.cara = dirX || 1; en.vida = 0;
      en.vx = en.cara * 360 * empuje; en.vy = -340;
      ev.push({ t: 'hormiga_huye', x: cx(en), y: cy(en), dir: en.cara, en });
      return true;
    }
    en.vivo = false;
    // `en`: el dibujo se queda con el cuerpo, que cae con el empujon del golpe (efectos.js, restos)
    ev.push({ t: 'muere', x: cx(en), y: cy(en), tipo: en.tipo, dir: dirX, en });
    return true;
  }
  if (!aturdido && en.tipo !== 'hormiga') {
    en.aguante -= postura;
    if (en.aguante <= 0) aturdir(en, ev);
  }
  return true;
}
