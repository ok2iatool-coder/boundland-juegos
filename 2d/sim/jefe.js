// El Escarabajo de la Bata (GDD nivel 2): escarabajo purpura con espada de cristal y la bata rota de
// capa. Con la daga no se le hace nada; a punto de caer despierta el zorro, y con las zarpas y el
// Sunikel se le vence. Al final no muere: levanta una garra, dibuja un circulo y se queda quieto.
import { T, J } from './constantes.js';
import { moverX, moverY, cx, cy } from './fisica.js';

export function crearJefe(xc, pie, x0, x1) {
  return {
    tipo: 'jefe', x: xc - 42, y: pie - 96, w: 84, h: 96, vx: 0, vy: 0, cara: -1,
    vida: 30, vidaMax: 30, vivo: true, despierto: false, estado: 'espera', t: 0, golpe: 0,
    ataque: null, x0, x1, pie, cuenta: 0, ultimo: '', aguante: 10, aguanteMax: 10,
  };
}

const ELEGIR = (j, dx, fase) => {
  const d = Math.abs(dx);
  const op = [];
  if (d < 190) op.push('tajo', 'tajo');
  if (d > 140) op.push('salto');
  if (d > 220) op.push('carga');
  op.push('salto');
  if (fase === 2) op.push('cristales');
  let a = op[(j.cuenta * 7 + Math.floor(d)) % op.length];
  if (a === j.ultimo && op.length > 1) a = op[(j.cuenta * 7 + Math.floor(d) + 1) % op.length];
  j.cuenta++; j.ultimo = a;
  return a;
};

export function actualizarJefe(E, j, dt, ev) {
  if (!j.vivo) return;
  const p = E.p;
  j.t += dt;
  j.golpe = Math.max(0, j.golpe - dt);
  const fase = E.hab.zorro ? 2 : 1;
  const prisa = fase === 2 ? 1.25 : 1;
  const dx = cx(p) - cx(j);
  j.hits = [];      // zonas que hacen dano este paso
  if (j.estado === 'vencido') { j.vx = 0; grav(E, j, dt); return; }
  if (!j.despierto) { grav(E, j, dt); return; }

  const tt = j.t * prisa;
  switch (j.estado) {
    case 'aturdido': {
      // postura rota: se queda doblado, sin atacar
      j.vx *= Math.exp(-6 * dt);
      if (j.t > J.aturdeJefeT) fin(j);
      break;
    }
    case 'espera': {
      j.cara = Math.sign(dx) || j.cara;
      j.vx = Math.abs(dx) > 120 ? j.cara * 95 * prisa : 0;
      if (tt > (fase === 2 ? 0.55 : 0.85)) { j.estado = ELEGIR(j, dx, fase); j.t = 0; ev.push({ t: 'jefe_' + j.estado + '_prepara', x: cx(j), y: j.y }); }
      break;
    }
    case 'tajo': {
      j.vx = 0;
      if (tt < 0.55) { /* alza la espada */ }
      else if (tt < 0.75) {
        if (!j.dio) { j.dio = true; ev.push({ t: 'jefe_tajo', x: cx(j), y: cy(j), cara: j.cara }); }
        j.vx = j.cara * 160;
        j.hits.push({ x: j.cara > 0 ? j.x + j.w - 10 : j.x - 150, y: j.y + 10, w: 160, h: 86 });
      } else if (tt > 1.25) { fin(j); }
      break;
    }
    case 'salto': {
      if (tt < 0.4) j.vx = 0;
      else if (!j.vuela && !j.cayo) {
        j.vuela = true;
        const destino = Math.max(j.x0 + 60, Math.min(j.x1 - 60, cx(p)));
        const tVuelo = 0.8;
        j.vx = (destino - cx(j)) / tVuelo; j.vy = -2100 * tVuelo / 2;
        ev.push({ t: 'jefe_salta', x: cx(j), y: j.y + j.h });
      }
      if (j.vuela && j.enSuelo && j.vy >= 0 && tt > 0.5) {
        j.vuela = false; j.cayo = true; j.vx = 0; j.t = 0;
        ev.push({ t: 'jefe_aterriza', x: cx(j), y: j.y + j.h });
        for (const d of [-1, 1]) E.ondas.push({ x: cx(j) - 14, y: j.y + j.h - 26, w: 28, h: 26, vx: d * 380, vida: 1.6 });
      }
      if (j.cayo && tt > 0.6) fin(j);
      break;
    }
    case 'carga': {
      if (tt < 0.5) { j.vx = 0; j.cara = Math.sign(dx) || j.cara; }
      else if (tt < 1.6 && !j.choco) {
        if (!j.dio) { j.dio = true; ev.push({ t: 'jefe_carga', x: cx(j), y: cy(j) }); }
        j.vx = j.cara * 540 * prisa;
        if ((j.cara > 0 && j.x + j.w >= j.x1 - 4) || (j.cara < 0 && j.x <= j.x0 + 4)) { j.choco = true; j.t = 0; ev.push({ t: 'jefe_choca', x: cx(j), y: cy(j) }); }
      } else {
        j.vx = 0;
        if (tt > (j.choco ? 1.0 : 0.6)) fin(j);
      }
      break;
    }
    case 'cristales': {
      j.vx = 0;
      if (tt > 0.45 && !j.dio) {
        j.dio = true;
        ev.push({ t: 'jefe_clava', x: cx(j), y: j.y + j.h });
        const d = Math.sign(dx) || j.cara;
        for (let k = 0; k < 7; k++) {
          const x = cx(j) + d * (90 + k * 66);
          if (x < j.x0 + 10 || x > j.x1 - 10) break;
          E.cristales.push({ x: x - 18, y: j.pie - 70, w: 36, h: 70, aviso: 0.35 + k * 0.1, vida: 0.32 });
        }
      }
      if (tt > 1.6) fin(j);
      break;
    }
  }
  moverX(j, E.mundo, (j.vx + (j.retro || 0)) * dt);
  j.retro = (j.retro || 0) * Math.exp(-11 * dt);
  j.x = Math.max(j.x0, Math.min(j.x1 - j.w, j.x));
  grav(E, j, dt);
}

function fin(j) {
  j.estado = 'espera'; j.t = 0; j.dio = false; j.choco = false; j.cayo = false; j.vuela = false;
}

function grav(E, j, dt) {
  j.vy = Math.min(j.vy + 2100 * dt, 900);
  const b = moverY(j, E.mundo, j.vy * dt);
  j.enSuelo = b > 0;
  if (b) j.vy = 0;
}

// Golpe del 18 al jefe. Devuelve el dano hecho (0 en la fase 1: el cristal no se raya)
export function golpearJefe(E, j, dano, dirX, ev, postura = 1) {
  if (!j.vivo || j.estado === 'vencido' || !j.despierto) return 0;
  // `cara`: hacia donde iba el golpe (el 18 sale despedido al reves); `en`: el dibujo le hace vibrar
  if (!E.hab.zorro) { ev.push({ t: 'jefe_rebota', x: cx(j) - dirX * 30, y: cy(j), cara: dirX, en: j }); return 0; }
  if (j.estado === 'aturdido') dano += 1;
  j.vida -= dano; j.golpe = 0.15;
  // con las zarpas si le mueven: cede un poco hacia atras (cae solo, en unos 15 u)
  j.retro = dirX * 160;
  if (j.estado !== 'aturdido' && j.vida > 0) { j.aguante -= postura; if (j.aguante <= 0) aturdirJefe(j, ev); }
  ev.push({ t: 'golpe', x: cx(j), y: cy(j), dir: dirX, tipo: 'jefe' });
  if (j.vida <= 0) {
    j.vida = 0; j.estado = 'vencido'; j.t = 0; j.vx = 0;
    ev.push({ t: 'jefe_vencido', x: cx(j), y: cy(j) });
  }
  return dano;
}
export { T };

// postura rota (golpes o un desvio): doblado `aturdeJefeT` s, sin atacar y con un punto mas de dano
export function aturdirJefe(j, ev) {
  fin(j); j.estado = 'aturdido'; j.t = 0; j.vx = 0; j.hits = []; j.aguante = j.aguanteMax;
  ev.push({ t: 'aturdido', x: cx(j), y: j.y - 8, jefe: true });
}
