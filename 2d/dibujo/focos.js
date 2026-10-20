// Focos colgados con fisica de verdad (solo dibujo y luz: no tocan la simulacion del juego).
// Cada lampara que cuelga del techo es un PENDULO: pivote en el techo, largo del cable y gravedad real a
// escala del mundo (9,8 m/s2 x 64 u/m = 627 u/s2), asi que un cable de 2 m tarda unos 3 s en ir y volver.
//   - fluorescente: dos cables paralelos (paralelogramo): el tubo se traslada por el arco casi sin girar;
//   - lampara de la casa: un cordon y pantalla conica: gira entera y el cono de luz barre la sala;
//   - farol de laton: una cadena: gira entero, luz en todas direcciones.
// Los mueve: el 18 al chocar con ellos (pasa su velocidad), el tajo, la estocada y el Sunikel (golpe con
// chispas y el tubo que parpadea), los proyectiles, y las sacudidas cercanas (caidas fuertes, tornillos que
// caen, el escarabajo al aterrizar o chocar). Rozamiento del aire bajo: siguen meciendose un buen rato.
// La luz que pinta `luz.js` sale de la posicion y el angulo del pendulo, y con ella sus sombras y su haz.
import { T, J } from '../sim/constantes.js';
import { MACIZO } from '../sim/mapa.js';
import { TINTA, GROSOR, caja, linea, trazar, tinta, hash } from './tinta.js';
import { dibujarAsset } from './decorado.js';
import { cadena } from '../assets/pintura.js';

const G = 9.8 * 64;            // gravedad real en u/s2
const AIRE = 0.18;             // amortiguamiento (1/s): una lampara pesada se mece mucho rato
const TOPE = 1.25;             // el cable no deja subir mas (choca con el techo)

const techoDe = (E, i, j) => { for (let jj = j; jj >= 0; jj--) if (E.m.t[jj * E.m.w + i] === MACIZO) return (jj + 1) * T; return 0; };

export class Focos {
  constructor(E, luces) {
    this.E = E; this.lista = [];
    for (const L of luces) {
      const mk = L.marca;
      if (!mk) continue;
      const tipo = mk.tipo === 'asset' ? mk.id : mk.tipo;
      if (tipo !== 'fluorescente' && tipo !== 'lampara_casa' && tipo !== 'farol_laton') continue;
      const x = mk.i * T + T / 2, y = (mk.j + 1) * T, yt = techoDe(E, mk.i, mk.j);
      // largo del cable: del techo al cuerpo de la lampara
      const largo = tipo === 'fluorescente' ? Math.max(16, y - 8 - yt) : tipo === 'lampara_casa' ? Math.max(20, y - 12 - yt) : 60;
      const f = {
        tipo, L, mk, px: x, py: yt, largo, x, y,
        th: (hash(mk.i, mk.j, 5) - 0.5) * 0.04, w: 0,      // un leve vaiven de partida, como en un sitio con corrientes
        golpe: 0, cd: 0, toca: false,
        luzDy: L.y - yt,                                   // la bombilla, medida desde el pivote
      };
      // el parpadeo del golpe se suma al de la lampara
      const fuerza0 = L.fuerza;
      L.fuerza = (t) => {
        let v = fuerza0(t);
        if (f.golpe > 0) v *= hash(Math.floor(t * 34), mk.i, 9) < f.golpe * 0.55 ? 0.06 : 1;
        return v;
      };
      L.foco = f;
      this.lista.push(f);
    }
  }

  // empujon horizontal en u/s aplicado a la lampara (se convierte en velocidad angular)
  empujar(f, vx) {
    f.w += (vx * Math.cos(f.th)) / f.largo;
    // una lampara no sale disparada: la bombilla no pasa de 5 m/s
    const tope = 320 / f.largo;
    if (Math.abs(f.w) > tope) f.w = Math.sign(f.w) * tope;
  }

  emitir(e) {
    const SACUDE = { gigante_cae: [600, 1.4], jefe_aterriza: [700, 1.1], jefe_choca: [600, 1.2], tornillo_golpe: [220, 0.5], derrumbe: [400, 0.25], muere: [180, 0.3], choque: [160, 0.3] };
    let s = SACUDE[e.t];
    if (e.t === 'aterriza' && e.fuerte) s = [220, 0.35];
    if (!s || e.x === undefined) return;
    for (const f of this.lista) {
      const d = Math.hypot(f.x - e.x, f.y - (e.y ?? f.y));
      if (d > s[0]) continue;
      // la sacudida llega al techo: el pivote se mueve y la lampara se queda atras
      this.empujar(f, (Math.random() - 0.5) * 2 * 160 * s[1] * (1 - d / s[0]));
    }
  }

  actualizar(dt, t, cam, ev) {
    const E = this.E, p = E.p;
    const pc = p.x + p.w / 2;
    // lo que golpea ahora: el tajo activo, la estocada o el Sunikel
    let golpe = null;
    if (p.sunikel > 0 || p.estocada > 0) golpe = { x: p.x - 20, y: p.y, w: p.w + 40, h: p.h, vx: p.vx, fuerte: true };
    else if (p.ataque > J.ataqueT - J.ataqueActivo) {
      const A = J.alcance + 8;
      if (p.ataqueDir === 'arriba') golpe = { x: p.x - 20, y: p.y - A, w: p.w + 40, h: A, vx: p.cara * 120, fuerte: false };
      else if (p.ataqueDir === 'abajo') golpe = { x: p.x - 18, y: p.y + p.h - 6, w: p.w + 36, h: A, vx: p.cara * 120, fuerte: false };
      else golpe = { x: p.cara > 0 ? p.x + p.w - 6 : p.x - A + 6, y: p.y, w: A, h: p.h, vx: p.cara * 520, fuerte: !!p.remata };
    }
    for (const f of this.lista) {
      f.golpe = Math.max(0, f.golpe - dt * 0.8);
      f.cd = Math.max(0, f.cd - dt);
      if (f.px < cam.x - 500 || f.px > cam.x + cam.w + 500) continue;
      // cuerpo de la lampara (lo que se puede tocar)
      const cuerpo = f.tipo === 'fluorescente' ? { x: f.x - 44, y: f.y - 14, w: 88, h: 14 } : f.tipo === 'lampara_casa' ? { x: f.x - 18, y: f.y - 20, w: 36, h: 22 } : { x: f.x - 16, y: f.y - 30, w: 32, h: 44 };
      const solapa = (a) => a.x < cuerpo.x + cuerpo.w && a.x + a.w > cuerpo.x && a.y < cuerpo.y + cuerpo.h && a.y + a.h > cuerpo.y;
      // el 18 la empuja al pasar: le pasa parte de su velocidad (la lampara pesa menos que el)
      if (solapa(p)) {
        const vLamp = f.w * f.largo * Math.cos(f.th);
        const dv = p.vx - vLamp;
        if (!f.toca && Math.abs(dv) > 60) ev.push({ t: 'foco_toca', x: f.x, y: f.y });
        this.empujar(f, dv * 0.22);
        f.toca = true;
      } else f.toca = false;
      // el golpe: empujon fuerte, chispas y parpadeo
      if (golpe && f.cd <= 0 && solapa(golpe)) {
        // la daga la empuja a 1,7 m/s (el golpe fuerte a 2,7); hacia donde va el tajo
        this.empujar(f, Math.sign(golpe.vx || f.x - pc) * (golpe.fuerte ? 170 : 110));
        f.golpe = golpe.fuerte ? 1 : 0.7; f.cd = 0.25;
        ev.push({ t: 'foco_golpe', x: f.x, y: f.y - 6, fuerte: golpe.fuerte, tipo: f.tipo });
      }
      // proyectiles (escupitajos y devueltos) que la cruzan
      for (const q of E.proyectiles) if (solapa(q) && f.cd <= 0) { this.empujar(f, q.vx * 0.5); f.golpe = 0.5; f.cd = 0.3; ev.push({ t: 'foco_golpe', x: f.x, y: f.y - 6, fuerte: false, tipo: f.tipo }); }
      // pendulo: dos subpasos, gravedad real y aire; tope contra el techo
      const n = 2, h = dt / n;
      for (let k = 0; k < n; k++) {
        f.w += (-(G / f.largo) * Math.sin(f.th) - AIRE * f.w) * h;
        f.th += f.w * h;
      }
      if (Math.abs(f.th) > TOPE) {
        f.th = Math.sign(f.th) * TOPE; f.w = -f.w * 0.35;
        if (f.cd <= 0) { ev.push({ t: 'foco_tope', x: f.px + Math.sin(f.th) * f.largo, y: f.py }); f.cd = 0.2; }
      }
      // posicion: el fluorescente se traslada (paralelogramo), los de un solo cable giran
      f.x = f.px + Math.sin(f.th) * f.largo;
      f.y = f.py + Math.cos(f.th) * f.largo + (f.tipo === 'fluorescente' ? 8 : f.tipo === 'lampara_casa' ? 12 : 0);
      // en el lienzo, rotate(a) lleva (0, d) a (-d sen a, d cos a): para que el cuerpo caiga donde dice el
      // pendulo (px + d sen th) el giro de dibujo y de la luz es -th (con +th iba al lado contrario de su luz)
      f.giro = f.tipo === 'fluorescente' ? f.th * 0.18 : -f.th;
      // la luz va con la bombilla; quieta del todo, vuelve a su sitio exacto (asi la sombra se reaprovecha)
      const L = f.L;
      const quieto = Math.abs(f.th) < 0.0015 && Math.abs(f.w) < 0.004;
      if (quieto) { L.x = f.px; L.y = f.py + f.luzDy; L.ang = 0; L.mueve = false; }
      else {
        L.x = f.px + Math.sin(f.th) * f.luzDy;
        L.y = f.py + Math.cos(f.th) * f.luzDy;
        if (f.tipo === 'fluorescente') { L.x = f.x; L.y = f.y - 6; }
        L.ang = f.giro; L.mueve = true;
      }
    }
  }

  // EL FOCO COMO TAL (2026-10-20, pedido: «el foco de luz desprende demasiada luz, no se ve bien el foco»): despues de
  // toda la luz se vuelve a pintar el cuerpo de cada fluorescente, oscuro y recortado contra su propio resplandor
  // (la campana de chapa con su canto de luz, los soportes, y el tubo como una raya nitida y no como una mancha)
  dibujarCuerpos(c, cam, t) {
    for (const f of this.lista) {
      if (f.tipo !== 'fluorescente' || f.px < cam.x - 200 || f.px > cam.x + cam.w + 200 || f.y < cam.y - 60 || f.y > cam.y + cam.h + 60) continue;
      const fz = f.L.fuerza(t), calida = !!f.mk.calida;
      c.save(); c.translate(f.x, f.y); c.rotate(f.giro || 0);
      // la campana: chapa oscura en trapecio, con los soportes de los cables
      c.beginPath(); c.moveTo(-40, -15); c.lineTo(40, -15); c.lineTo(48, -4); c.lineTo(-48, -4); c.closePath();
      c.fillStyle = '#1c2026'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#08090b'; c.stroke();
      c.fillStyle = '#2b3139'; c.fillRect(-30, -19, 6, 5); c.fillRect(24, -19, 6, 5);
      // el canto de arriba lo lame la luz que rebota
      c.strokeStyle = 'rgba(210,220,235,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-39, -14.4); c.lineTo(39, -14.4); c.stroke();
      // el borde de abajo de la campana, y dentro el tubo: una raya clara y nitida con sus casquillos
      c.fillStyle = '#0e1013'; c.fillRect(-48, -5, 96, 2);
      c.fillStyle = '#3a4048'; c.fillRect(-42, -5, 5, 4); c.fillRect(37, -5, 5, 4);
      c.fillStyle = calida ? `rgba(255,236,205,${(0.55 + fz * 0.45).toFixed(3)})` : `rgba(235,245,255,${(0.55 + fz * 0.45).toFixed(3)})`;
      c.fillRect(-37, -3.2, 74, 2.6);
      c.restore();
    }
  }

  dibujar(c, cam, t) {
    for (const f of this.lista) {
      if (f.px < cam.x - 200 || f.px > cam.x + cam.w + 200) continue;
      if (f.tipo === 'fluorescente') {
        // dos cables paralelos del techo a los extremos del tubo (el tubo apenas gira)
        const ca = Math.cos(f.giro), sa = Math.sin(f.giro);
        for (const s of [-1, 1]) {
          const ex = f.x + s * 26 * ca + 12 * sa, ey = f.y + s * 26 * sa - 12 * ca;
          linea(c, f.px + s * 28, f.py, ex, ey, 1.3);
        }
        c.save(); c.translate(f.x, f.y); c.rotate(f.giro);
        caja(c, -44, -14, 88, 10, '#3b4552', f.mk.i);
        const fz = f.L.fuerza(t);
        c.fillStyle = `rgba(235,245,255,${0.35 + fz * 0.6})`; c.fillRect(-38, -6, 76, 3);
        c.restore();
      } else if (f.tipo === 'lampara_casa') {
        c.save(); c.translate(f.px, f.py); c.rotate(f.giro);
        linea(c, 0, 0, 0, f.largo - 18 + 12, 1.2);
        const y = f.largo + 12;
        trazar(c, [[-18, y - 2], [-8, y - 20], [8, y - 20], [18, y - 2]]);
        c.fillStyle = '#5a4a36'; c.fill(); tinta(c);
        // la bombilla asoma bajo la pantalla
        const fz = f.L.fuerza(t);
        c.fillStyle = `rgba(255,236,200,${0.5 + fz * 0.5})`; c.beginPath(); c.arc(0, y - 1, 4, 0, Math.PI); c.fill();
        c.restore();
      } else {
        // farol de laton: todo el asset gira alrededor del gancho del techo
        c.save(); c.translate(f.px, f.py); c.rotate(f.giro);
        dibujarAsset(c, 'farol_laton', 0, 0, 'techo', 0, { escala: f.mk.escala });
        c.restore();
      }
    }
  }
}
