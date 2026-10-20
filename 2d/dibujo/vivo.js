// Lo que esta vivo en el mapa y responde al 18 (solo dibujo: no toca la simulacion).
// - HIERBA: briznas con muelle sobre cada suelo; el viento las mece, el 18 las aparta al pasar y al caer,
//   y el tajo las CORTA (vuelan trocitos) y vuelven a crecer despacio.
// - LIANAS (cables en la casa y el hospital): cuerdas de puntos con gravedad que cuelgan del techo; se
//   balancean y el 18 las empuja.
// - POLILLAS alrededor de cada lampara encendida; huyen del 18 y vuelven.
// - GOTAS que se forman en la punta de las estalactitas, caen y salpican con un anillo en el suelo.
import { T } from '../sim/constantes.js';
import { MACIZO, HUNDE, TALLO, PLAT } from '../sim/mapa.js';
import { HUNDE_VUELVE } from '../sim/juego.js';
import { hash, rgba, mezclar } from './tinta.js';
import { piezasDelLinde } from '../linde/nivel.js';

const tapa = (v) => v === MACIZO || v === HUNDE || v === TALLO;

// La losa de un suelo que se hunde CAE (antes desaparecia y su hierba se quedaba flotando; 2026-10-20): se
// suelta, gira un poco hacia un lado y se desvanece mientras baja. La usan la losa (main.js) y su hierba (aqui).
export const LOSA_CAE = 0.5;
export function caidaLosa(h) {
  if (!h || !h.cae) return null;
  const te = HUNDE_VUELVE - h.t;
  if (te > LOSA_CAE) return null;
  const lado = (h.i * 7 + h.j * 13) % 2 ? 1 : -1, u = te / LOSA_CAE;
  return { dx: lado * 26 * te, dy: 0.5 * 1500 * te * te, giro: lado * (0.25 + 0.5 * ((h.i * 3) % 4) / 3) * u, alfa: 1 - u * u };
}
// por zona: densidad y altura de la hierba, lianas u hojas, cuantas gotas
const ESTILO = {
  laboratorio: { hierba: 0.6, alto: [5, 15], color: '#4a5a52', punta: '#7d8f86', liana: 0.16, hojas: true, gotas: 0.5, viento: 0.35 },
  lab: { hierba: 0.42, alto: [4, 11], color: '#3e4c58', punta: '#6d8094', liana: 0.1, hojas: false, gotas: 0.5, viento: 0.25 },
  // la ciudad de la referencia es asfalto: solo algun hierbajo seco en las grietas
  ciudad: { hierba: 0.22, alto: [4, 13], color: '#4f4a3c', punta: '#8d8468', liana: 0.06, hojas: false, gotas: 0.25, viento: 0.8 },
  plaza: { hierba: 0.95, alto: [8, 27], color: '#3f5a54', punta: '#7ea69b', liana: 0.12, hojas: true, gotas: 0.25, viento: 0.8 },
  casa: { hierba: 0.2, alto: [3, 8], color: '#4a3d2e', punta: '#7a6750', liana: 0.08, hojas: false, gotas: 0.15, viento: 0.15 },
  // el bosque: hierba alta de puntas doradas (en el techo del autobus de las afueras no: sinCajas)
  linde: { hierba: 0.85, alto: [9, 26], color: '#2e2d17', punta: '#c9ae55', liana: 0.12, hojas: true, gotas: 0.2, viento: 0.9, sinCajas: true },
  hospital: { hierba: 0.45, alto: [4, 14], color: '#3d3836', punta: '#6e6560', liana: 0.1, hojas: false, gotas: 0.4, viento: 0.3 },
};

export class Vivo {
  constructor(E, zona, z, terreno, luces) {
    this.E = E; this.st = ESTILO[zona] || ESTILO.lab; this.z = z; this.luces = luces;
    this.trozos = [];
    this.hierba(); this.lianas(); this.polillas(); this.gotas(terreno);
  }

  sol(i, j) { const m = this.E.m; return i < 0 || i >= m.w || j < 0 ? true : j >= m.h ? false : tapa(m.t[j * m.w + i]); }

  // ---------------------------------------------------------------- hierba
  // Cada brizna: base (x, y), altura, angulo y velocidad (un muelle), rigidez segun lo alta que es, tipo
  // (brizna fina, hoja ancha, espiga con su grano o, rara vez, una flor palida), capa (detras o delante del
  // 18) y cuanto esta PISADA (tumbada hacia un lado; se levanta sola en un par de segundos).
  hierba() {
    const m = this.E.m, st = this.st;
    this.cols = new Map();          // columna -> briznas, de izquierda a derecha
    this.rafagas = [];
    const cajas = st.sinCajas ? new Set(this.E.marcas.filter((q) => q.solido).map((q) => q.i + ',' + q.j)) : null;
    // en el Linde la hierba es del SUELO: nada en ramas, tablas ni plataformas (en las ramas, las puntas doradas se
    // leian como pinchos), ni al pie del tocon de los anillos (lo tapaba)
    const linde = this.E.nivel.zona === 'linde';
    if (cajas && linde) for (const q of piezasDelLinde(this.E.nivel).piezas) {
      if (q.pieza === 'tocon') for (let i = q.i0 - 3; i <= q.i1 + 3; i++) cajas.add(i + ',' + (q.j1 + 1));
      if (q.pieza === 'espantapajaros') for (let i = q.i0 - 7; i <= q.i0 - 1; i++) cajas.add(i + ',' + (q.j1 + 1));   // el huerto: tierra cavada
    }
    for (let j = 1; j < m.h; j++) for (let i = 0; i < m.w; i++) {
      const v = m.t[j * m.w + i];
      // (en las plataformas no: son de chapa o de tabla, y en las que cuelgan la hierba no tenia sentido; 2026-10-20)
      const suelo = this.sol(i, j) && !(linde && v === HUNDE) && v !== PLAT;
      if (!suelo || this.sol(i, j - 1) || m.t[(j - 1) * m.w + i] !== 0 || (cajas && cajas.has(i + ',' + j))) continue;
      // claros y matas
      const mata = Math.sin(i * 0.37 + j) + Math.sin(i * 0.11 + 2.3) + Math.sin(i * 0.9 + j * 3) * 0.4;
      if (mata < -0.9) continue;
      // junto a una pared crece mas alta (hay sombra y humedad)
      const rincon = this.sol(i - 1, j - 1) || this.sol(i + 1, j - 1) ? 1.5 : 1;
      const fina = v === PLAT ? 0.5 : 1;
      const lista = [];
      for (let x = i * T + 0.5; x < (i + 1) * T; x += st.viento > 0.5 ? 1.8 : 2.2) {
        const h = hash(Math.round(x * 5), j, 77);
        if (h > st.hierba * fina * (0.75 + 0.25 * Math.min(1, mata + 0.6))) continue;
        const q = hash(Math.round(x * 7), j, 80);
        const tipo = q < 0.62 ? 0 : q < 0.84 ? 1 : q < 0.985 ? 2 : 3;
        let alto = (st.alto[0] + (st.alto[1] - st.alto[0]) * Math.pow(hash(Math.round(x * 3), j, 78), 1.4) * (0.75 + 0.25 * mata)) * rincon;
        if (tipo === 2) alto *= 1.35;
        if (tipo === 1) alto *= 0.8;
        lista.push({
          x: x + (h - 0.5) * 1.5, y: j * T + 2, h: alto, h0: alto, a: (h - 0.5) * 0.3, v: 0,
          k: 260 / Math.max(4, alto) + 8, tipo, capa: hash(Math.round(x * 11), j, 81) < 0.4 ? 1 : 0,
          tono: hash(Math.round(x), j, 79), corta: 0, pis: 0, pdir: 0, inclina: (hash(Math.round(x * 13), j, 82) - 0.5) * 0.35,
          hk: v === HUNDE ? j * m.w + i : -1,      // la casilla que se hunde con ella
        });
      }
      if (lista.length) { const k = this.cols.get(i) || []; this.cols.set(i, k.concat(lista)); }
    }
  }

  // ---------------------------------------------------------------- lianas
  lianas() {
    const m = this.E.m, st = this.st;
    this.cuerdas = [];
    for (let j = 1; j < m.h; j++) for (let i = 0; i < m.w; i++) {
      if (!this.sol(i, j - 1) || this.sol(i, j) || m.t[j * m.w + i] !== 0) continue;
      if (hash(i, j, 91) > st.liana) continue;
      // cuanto aire hay debajo: la liana no llega al suelo
      let libre = 0; while (libre < 12 && !this.sol(i, j + libre)) libre++;
      if (libre < 3) continue;
      const n = Math.max(3, Math.min(libre - 1, 3 + Math.floor(hash(i, j, 92) * 7)));
      const x = i * T + T / 2 + (hash(i, j, 93) - 0.5) * 20, y = j * T;
      const pts = []; for (let k = 0; k <= n; k++) pts.push({ x, y: y + k * 11, px: x, py: y + k * 11 });
      this.cuerdas.push({ pts, seg: 11, fase: hash(i, j, 94) * 6 });
    }
  }

  // ---------------------------------------------------------------- polillas
  polillas() {
    this.bichos = [];
    for (const L of this.luces) {
      const n = L.cono ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const h = hash(Math.round(L.x), k, 31);
        this.bichos.push({ L, x: L.x + (h - 0.5) * 60, y: L.y + 20, vx: 0, vy: 0, a: h * 6.28, r: 26 + h * 40, vel: 1.4 + h * 1.6, susto: 0 });
      }
    }
  }

  // ---------------------------------------------------------------- gotas
  gotas(terreno) {
    const m = this.E.m;
    this.goteros = [];
    for (const c of (terreno && terreno.deco ? terreno.deco.colgantes : [])) {
      if (c.largo < 28 || hash(Math.round(c.x), Math.round(c.y), 51) > this.st.gotas) continue;
      const x = c.x + c.curva, y = c.y + c.largo;
      const i = Math.floor(x / T);
      let j = Math.floor(y / T) + 1, suelo = null;
      while (j < m.h) { const v = m.t[j * m.w + i]; if (tapa(v) || v === PLAT) { suelo = j * T; break; } j++; }
      if (suelo === null || suelo - y > 600) continue;
      this.goteros.push({ x, y, suelo, t: hash(Math.round(x), 52) * 4, cada: 2.5 + hash(Math.round(x), 53) * 5, gota: null });
    }
    this.anillos = [];
  }

  // ---------------------------------------------------------------- eventos
  emitir(e) {
    const p = this.E.p;
    if (e.t === 'tajo' && (e.dir === 'lado' || e.dir === 'abajo')) {
      // el tajo siega lo que tiene delante a la altura de los pies
      const x0 = p.cara > 0 ? p.x + p.w / 2 : p.x + p.w / 2 - 72, x1 = x0 + 72, pie = p.y + p.h;
      this.cada(x0, x1, (b) => {
        if (b.y < pie - 30 || b.y > pie + 34 || b.corta > 0) return;
        b.corta = 1; b.v += p.cara * 6;
        if (Math.random() < 0.5) this.trozos.push({ x: b.x, y: b.y - b.h * 0.6, vx: p.cara * (60 + Math.random() * 120), vy: -120 - Math.random() * 140, r: Math.random() * 6, vr: (Math.random() - 0.5) * 20, vida: 0.9 + Math.random() * 0.5, t: 0, color: this.st.punta });
        b.h = b.h0 * 0.3;
      });
    }
    const cx = p.x + p.w / 2, pie = p.y + p.h;
    if (e.t === 'tajo' && e.dir === 'lado') {
      // el aire del golpe dobla lo que hay un poco mas alla
      const c0 = cx + p.cara * 40;
      this.cada(c0 - 70, c0 + 70, (b) => { if (Math.abs(b.y - pie) < 40) b.v += p.cara * 7 * (1 - Math.abs(b.x - c0) / 70); });
    }
    if (e.t === 'aterriza') {
      // onda que sale de los pies; si la caida es fuerte, tumba lo que hay debajo
      const f = e.fuerte ? 1.8 : 0.9, R = e.fuerte ? 90 : 60;
      this.cada(cx - R, cx + R, (b) => {
        if (Math.abs(b.y - pie) > 20) return;
        const d = b.x - cx;
        b.v += Math.sign(d || 1) * f * 11 * (1 - Math.abs(d) / R);
        if (e.fuerte && Math.abs(d) < 26) { b.pis = Math.max(b.pis, 0.9); b.pdir = Math.sign(d || 1); }
      });
    }
    if (e.t === 'salto' || e.t === 'doble') {
      // al despegar, la hierba de debajo se suelta y rebota
      this.cada(cx - 22, cx + 22, (b) => { if (Math.abs(b.y - pie) < 12) { b.pis *= 0.3; b.v += (Math.random() - 0.5) * 6; } });
    }
  }

  cada(x0, x1, fn) {
    for (let i = Math.floor(x0 / T); i <= Math.floor(x1 / T); i++) { const l = this.cols.get(i); if (l) for (const b of l) if (b.x >= x0 && b.x <= x1) fn(b); }
  }

  // ---------------------------------------------------------------- paso (solo lo que se ve)
  actualizar(dt, t, cam, son) {
    const p = this.E.p, cx = p.x + p.w / 2, pie = p.y + p.h;
    const x0 = cam.x - 80, x1 = cam.x + cam.w + 80;
    // viento: un vaiven suave y RAFAGAS que cruzan la pantalla (en interiores, apenas una corriente)
    const fv = this.st.viento;
    if (Math.random() < dt * 0.25 * fv) {
      const dir = Math.random() < 0.7 ? 1 : -1;
      this.rafagas.push({ x: dir > 0 ? cam.x - 200 : cam.x + cam.w + 200, dir, vel: 220 + Math.random() * 160, f: 0.25 + Math.random() * 0.35, ancho: 90 + Math.random() * 120 });
    }
    for (const g of this.rafagas) g.x += g.dir * g.vel * dt;
    this.rafagas = this.rafagas.filter((g) => g.x > cam.x - 400 && g.x < cam.x + cam.w + 400);
    const viento = (x) => {
      let v = (Math.sin(t * 1.3 + x * 0.013) * 0.1 + Math.sin(t * 2.9 + x * 0.05) * 0.04 + 0.04) * fv;
      for (const g of this.rafagas) { const d = (x - g.x) / g.ancho; v += g.dir * g.f * fv * Math.exp(-d * d) * (1 + 0.3 * Math.sin(t * 9 + x * 0.1)); }
      return v;
    };
    // cuerpos que tocan la hierba: el 18 y los enemigos vivos
    const cuerpos = [{ x: p.x, w: p.w, y: p.y, h: p.h, vx: p.vx, suelo: p.enSuelo, yo: true }];
    for (const en of this.E.enemigos) if (en.vivo && en.x > x0 - 60 && en.x < x1 + 60) cuerpos.push({ x: en.x, w: en.w, y: en.y, h: en.h, vx: en.vx || 0, suelo: true });
    // hierba: muelle hacia el viento + empujones + pisadas + estela + vecinas que se arrastran
    let prev = null;
    const mt = this.E.m.t;
    this.cada(x0, x1, (b) => {
      if (b.y < cam.y - 60 || b.y > cam.y + cam.h + 80 || (b.hk >= 0 && mt[b.hk] !== HUNDE)) { prev = null; return; }
      let reposo = viento(b.x) + b.inclina;
      let k = b.k, amort = 5.5;
      for (const q of cuerpos) {
        const pieQ = q.y + q.h, cq = q.x + q.w / 2;
        if (pieQ < b.y - b.h - 4 || q.y > b.y + 4) continue;   // el cuerpo no esta a la altura de la brizna
        const d = b.x - cq, dd = Math.abs(d), media = q.w / 2 + 7;
        if (dd < media) {
          // dentro del cuerpo: la brizna se aparta hacia el lado mas cercano y se dobla con el paso
          const lado = Math.sign(d || q.vx || 1);
          const hundir = Math.min(1, 1 - Math.max(0, b.y - pieQ) / (b.h + 4));
          reposo = lado * (0.55 + 0.75 * hundir) + q.vx / 900;
          k *= 2.2; amort = 9;
          // bajo los pies: PISADA (queda tumbada un rato)
          if (q.suelo && Math.abs(pieQ - b.y) < 6 && dd < q.w / 2 - 1) { b.pis = Math.min(1, b.pis + dt * 6); b.pdir = Math.sign(q.vx || d || 1); }
          // al correr por la hierba saltan semillas
          if (q.yo && q.suelo && Math.abs(q.vx) > 250 && Math.random() < 0.006) this.trozos.push({ x: b.x, y: b.y - b.h * 0.7, vx: q.vx * 0.2 + (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 60, r: 0, vr: 6, vida: 0.7, t: 0, color: this.st.punta, semilla: true });
        } else if (dd < media + 46 && Math.abs(q.vx) > 60) {
          // estela: el aire que arrastra al moverse (mas fuerte detras que delante)
          const detras = Math.sign(d) !== Math.sign(q.vx);
          b.v += (q.vx / 370) * (detras ? 2.4 : 1.2) * (1 - (dd - media) / 46) * dt * 8;
        }
      }
      // la pisada se levanta despacio
      if (b.pis > 0) { reposo = reposo * (1 - b.pis) + b.pdir * 1.3 * b.pis; b.pis = Math.max(0, b.pis - dt * 0.55); }
      let acc = (reposo - b.a) * k - b.v * amort;
      // las vecinas tiran: el movimiento corre por la mata como una onda
      if (prev && b.x - prev.x < 5) { acc += (prev.a - b.a) * 40; prev.v += (b.a - prev.a) * 40 * dt; }
      b.v += acc * dt; b.a += b.v * dt;
      b.a = Math.max(-1.45, Math.min(1.45, b.a));
      if (b.h < b.h0) { b.h = Math.min(b.h0, b.h + dt * 0.25); if (b.h >= b.h0) b.corta = 0; }
      prev = b;
    });
    // lianas: verlet con gravedad, viento y el cuerpo del 18
    for (const c of this.cuerdas) {
      const a = c.pts[0];
      if (a.x < x0 - 100 || a.x > x1 + 100) continue;
      for (let k = 1; k < c.pts.length; k++) {
        const q = c.pts[k];
        const vx = (q.x - q.px) * 0.985, vy = (q.y - q.py) * 0.985;
        q.px = q.x; q.py = q.y;
        q.x += vx + Math.sin(t * 0.9 + c.fase + k * 0.4) * 0.02 * k;
        q.y += vy + 700 * dt * dt;
        // el 18 aparta la liana y le deja su velocidad
        if (q.x > p.x - 6 && q.x < p.x + p.w + 6 && q.y > p.y && q.y < p.y + p.h) {
          const lado = q.x < cx ? p.x - 6 : p.x + p.w + 6;
          q.x += (lado - q.x) * 0.5; q.px = q.x - p.vx * dt * 0.9;
        }
      }
      for (let it = 0; it < 4; it++) for (let k = 1; k < c.pts.length; k++) {
        const u = c.pts[k - 1], v = c.pts[k];
        const dx = v.x - u.x, dy = v.y - u.y, L = Math.hypot(dx, dy) || 1, e = (L - c.seg) / L;
        if (k === 1) { v.x -= dx * e; v.y -= dy * e; }
        else { u.x += dx * e * 0.5; u.y += dy * e * 0.5; v.x -= dx * e * 0.5; v.y -= dy * e * 0.5; }
      }
    }
    // polillas: rondan su lampara, huyen del 18
    for (const b of this.bichos) {
      const f = b.L.fuerza(t);
      b.a += dt * b.vel * (0.7 + 0.6 * Math.sin(t * 0.7 + b.r));
      let tx = b.L.x + Math.cos(b.a) * b.r, ty = b.L.y + 26 + Math.sin(b.a * 1.7) * b.r * 0.5;
      if (f < 0.2) { tx = b.L.x + Math.cos(b.a * 0.3) * 120; ty = b.L.y + 140; }    // apagada: se dispersan
      const dx = b.x - cx, dy = b.y - (p.y + 20), d = Math.hypot(dx, dy);
      if (d < 70) b.susto = 1;
      b.susto = Math.max(0, b.susto - dt * 0.7);
      if (b.susto > 0) { tx = b.x + (dx / (d || 1)) * 120; ty = b.y + (dy / (d || 1)) * 60 - 40; }
      b.vx += ((tx - b.x) * 6 - b.vx * 2.5) * dt + (Math.random() - 0.5) * 600 * dt;
      b.vy += ((ty - b.y) * 6 - b.vy * 2.5) * dt + (Math.random() - 0.5) * 600 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    // gotas
    for (const g of this.goteros) {
      if (g.x < x0 || g.x > x1) continue;
      g.t += dt;
      if (!g.gota && g.t > g.cada) { g.gota = { y: g.y, vy: 0, crece: 0 }; g.t = 0; }
      if (g.gota) {
        const q = g.gota;
        if (q.crece < 1) q.crece += dt * 1.5;
        else { q.vy += 900 * dt; q.y += q.vy * dt; }
        if (q.y >= g.suelo) {
          g.gota = null;
          this.anillos.push({ x: g.x, y: g.suelo, t: 0 });
          for (let k = 0; k < 4; k++) this.trozos.push({ x: g.x, y: g.suelo - 2, vx: (Math.random() - 0.5) * 140, vy: -80 - Math.random() * 120, r: 0, vr: 0, vida: 0.35, t: 0, color: '#cfe2f0', agua: true });
          if (son && Math.abs(g.x - cx) < 500) son.ev({ t: 'gota' }, Math.max(-1, Math.min(1, (g.x - cx) / 500)));
        }
      }
    }
    for (const a of this.anillos) a.t += dt;
    this.anillos = this.anillos.filter((a) => a.t < 0.6);
    for (const q of this.trozos) { q.t += dt; q.vy += (q.semilla ? 120 : 700) * dt; q.vx *= 0.98; q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt; }
    this.trozos = this.trozos.filter((q) => q.t < q.vida);
  }

  // ---------------------------------------------------------------- dibujo
  // detras de los actores: la hierba de atras, lianas y gotas; delante: la hierba de delante, polillas y trocitos
  dibujarDetras(c, cam, t) {
    const st = this.st, x0 = cam.x - 40, x1 = cam.x + cam.w + 40;
    this.dibujarHierba(c, cam, 0);
    for (const cu of this.cuerdas) {
      const a = cu.pts[0]; if (a.x < x0 - 60 || a.x > x1 + 60) continue;
      c.beginPath(); c.moveTo(a.x, a.y);
      for (let k = 1; k < cu.pts.length; k++) {
        const u = cu.pts[k - 1], v = cu.pts[k];
        c.quadraticCurveTo(u.x, u.y, (u.x + v.x) / 2, (u.y + v.y) / 2);
      }
      const fin = cu.pts[cu.pts.length - 1]; c.lineTo(fin.x, fin.y);
      c.lineCap = 'round';
      c.lineWidth = st.hojas ? 3.2 : 2; c.strokeStyle = '#0b0a0c'; c.stroke();
      c.lineWidth = st.hojas ? 1.6 : 0.9; c.strokeStyle = st.color; c.stroke();
      if (st.hojas) for (let k = 1; k < cu.pts.length; k += 1) {
        const v = cu.pts[k], u = cu.pts[k - 1], ang = Math.atan2(v.y - u.y, v.x - u.x) + (k % 2 ? 0.9 : -0.9);
        c.save(); c.translate(v.x, v.y); c.rotate(ang);
        c.beginPath(); c.ellipse(4, 0, 4.5, 2.2, 0, 0, 7); c.fillStyle = k % 3 ? st.color : st.punta; c.fill();
        c.lineWidth = 0.8; c.strokeStyle = '#0b0a0c'; c.stroke(); c.restore();
      } else { c.beginPath(); c.arc(fin.x, fin.y, 1.8, 0, 7); c.fillStyle = st.punta; c.fill(); }
    }
    for (const g of this.goteros) {
      if (g.x < x0 || g.x > x1 || !g.gota) continue;
      const q = g.gota, r = 1.2 + Math.min(1, q.crece) * 1.4;
      c.fillStyle = 'rgba(205,226,240,.85)';
      c.beginPath(); c.ellipse(g.x, q.y + r, r * 0.8, r * (q.crece >= 1 ? 1.6 : 1), 0, 0, 7); c.fill();
    }
    for (const a of this.anillos) {
      const k = a.t / 0.6;
      c.strokeStyle = `rgba(205,226,240,${0.5 * (1 - k)})`; c.lineWidth = 1;
      c.beginPath(); c.ellipse(a.x, a.y, 3 + k * 16, 1 + k * 3, 0, 0, 7); c.stroke();
    }
  }

  // La brizna se dobla mas cuanto mas arriba (base rigida, punta suelta). La capa 0 va detras del 18, mas
  // oscura; la 1 delante. Tipos: brizna, hoja ancha, espiga con su grano y, rara vez, una flor palida.
  dibujarHierba(c, cam, capa) {
    const st = this.st;
    const lista = [], caen = new Map(), m = this.E.m;
    this.cada(cam.x - 20, cam.x + cam.w + 20, (b) => {
      if (b.capa !== capa || b.y < cam.y - 20 || b.y > cam.y + cam.h + 40) return;
      if (b.hk >= 0 && m.t[b.hk] !== HUNDE) { const l = caen.get(b.hk); if (l) l.push(b); else caen.set(b.hk, [b]); return; }
      lista.push(b);
    });
    const base = capa ? st.color : mezclar(st.color, '#000000', 0.3), punta = capa ? st.punta : mezclar(st.punta, '#000000', 0.25);
    const forma = (b) => {
      const h = b.h * (1 - 0.35 * b.pis);
      const a1 = b.a * 0.35;
      const mx = b.x + Math.sin(a1) * h * 0.5, my = b.y - Math.cos(a1) * h * 0.5;
      return [mx, my, mx + Math.sin(b.a) * h * 0.5, my - Math.cos(b.a) * h * 0.5];
    };
    const pintar = (lista) => {
    for (const tono of [0, 1]) {
      c.beginPath();
      for (const b of lista) {
        if ((b.tono > 0.55) !== !!tono || b.tipo === 3) continue;
        const [mx, my, tx, ty] = forma(b);
        const w = b.tipo === 1 ? 2.2 + b.h * 0.06 : 0.9 + b.h * 0.04;
        c.moveTo(b.x - w, b.y); c.quadraticCurveTo(mx - w * 0.5, my, tx, ty); c.quadraticCurveTo(mx + w * 0.5, my, b.x + w, b.y);
      }
      c.fillStyle = tono ? punta : base; c.fill();
      c.lineWidth = 0.6; c.strokeStyle = 'rgba(11,10,12,.5)'; c.stroke();
    }
    for (const b of lista) {
      if (b.tipo < 2) continue;
      const [mx, my, tx, ty] = forma(b);
      c.strokeStyle = base; c.lineWidth = 0.9; c.beginPath(); c.moveTo(b.x, b.y); c.quadraticCurveTo(mx, my, tx, ty); c.stroke();
      if (b.tipo === 2) {
        c.save(); c.translate(tx, ty); c.rotate(b.a); c.fillStyle = punta;
        c.beginPath(); c.ellipse(0, -3, 1.6, 4.2, 0, 0, 7); c.fill(); c.lineWidth = 0.6; c.strokeStyle = 'rgba(11,10,12,.6)'; c.stroke(); c.restore();
      } else {
        c.fillStyle = '#d8d2c2';
        for (let k = 0; k < 5; k++) { const an = k * 1.2566 + b.a; c.beginPath(); c.arc(tx + Math.cos(an) * 1.6, ty + Math.sin(an) * 1.6, 1.1, 0, 7); c.fill(); }
        c.fillStyle = '#8a7f62'; c.beginPath(); c.arc(tx, ty, 0.9, 0, 7); c.fill();
      }
    }
    };
    pintar(lista);
    // la de las losas que se han hundido cae con ellas (con el mismo giro, alrededor del centro de la losa)
    for (const [k, l] of caen) {
      const q = caidaLosa(this.E.hunde.get(k));
      if (!q) continue;
      const ox = (k % m.w) * T + T / 2, oy = Math.floor(k / m.w) * T + 6;
      c.save(); c.globalAlpha *= q.alfa; c.translate(ox + q.dx, oy + q.dy); c.rotate(q.giro); c.translate(-ox, -oy);
      pintar(l); c.restore();
    }
  }

  dibujarDelante(c, cam, t) {
    this.dibujarHierba(c, cam, 1);
    for (const b of this.bichos) {
      if (b.x < cam.x - 20 || b.x > cam.x + cam.w + 20) continue;
      const ala = Math.abs(Math.sin(t * 34 + b.r)) * 3 + 0.6;
      c.fillStyle = 'rgba(236,228,210,.9)';
      c.beginPath(); c.ellipse(b.x - 1.6, b.y, ala, 1.6, -0.5, 0, 7); c.ellipse(b.x + 1.6, b.y, ala, 1.6, 0.5, 0, 7); c.fill();
      c.fillStyle = '#2a2622'; c.fillRect(b.x - 0.6, b.y - 1.4, 1.2, 2.8);
    }
    for (const q of this.trozos) {
      const a = 1 - q.t / q.vida;
      if (q.agua) { c.fillStyle = `rgba(205,226,240,${a})`; c.fillRect(q.x - 0.8, q.y - 0.8, 1.6, 1.6); continue; }
      c.save(); c.translate(q.x, q.y); c.rotate(q.r); c.globalAlpha = a;
      c.fillStyle = q.color; c.fillRect(-2.5, -0.8, q.semilla ? 2 : 5, 1.6); c.restore();
    }
  }
}
