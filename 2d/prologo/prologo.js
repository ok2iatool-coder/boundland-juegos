// EL PROLOGO DE BOUNDLAND (2026-10-19): la animacion de antes de despertar. Pedido del usuario: arriba, en la calle,
// pasan coches militares y tanques; detras, monstruos; luego uno muy gordo, mucho mas grande que el jefe final, que
// no se ve bien (misterio, algo raro); la camara baja poco a poco, el suelo tiembla, aparece una piedra incrustada,
// cae sobre el cristal, el cristal se rompe y sale el personaje.
//
// Como esta hecho: la calle es la del nivel 7 DE VERDAD (el escenario: su fondo pintado por el hilo de la ciudad,
// sus farolas, su penumbra y su primer plano), cargada sin tocar la partida guardada y sin el 18. Encima van el
// convoy (vehiculos.js), las bestias (bestias.js) y, en el fondo, el gigante (gigante.js). Al bajar, un corte de la
// tierra (subsuelo.js) tapa la pantalla entera; con la pantalla tapada se cambia el nivel por el laboratorio sin que
// se note, y se sigue bajando hasta el techo de la sala de estasis. Ahi empalma con la intro que ya existia
// (main.js: la piedra que cae, golpea la tapa, el cristal se agrieta y estalla): este prologo le marca el reloj
// (`introT`), hace la ultima pisada que suelta la piedra y le devuelve la camara al juego cuando la piedra cae.
//
// Linea de tiempo (s): 0 negro y viento; 1-7 BOUNDLAND; 3-16 el convoy de izquierda a derecha (jeep con foco, camion,
// tanque, blindado, camion y el tanque de cola con la torre al reves); el convoy NO para nunca (2026-10-20, pedido:
// «el tanque nunca se queda parado disparando, solo sigue avanzando con el convoy»): 11-17 las bestias le dan
// alcance, el tanque de cola dispara hacia atras sin frenar y una sale por los aires, UNA salta encima del tanque y
// se va con el y las demas siguen corriendo y lo adelantan; 17-19 rafagas lejos y se van; 19,5 silencio, niebla, farolas que
// fallan; 21-33 el gigante (pisadas que hacen temblar todo, el ojo a los 30); 33,5-45,5 la camara baja por la
// tierra; 46 la sala de estasis con la piedra en el techo; 47 la ultima pisada, la piedra se suelta y rompe el frasco.
// Esc o Intro lo saltan. `__dbg.prologo.ir(s)` pone el prologo en un instante (para las fotos).
import { DIBUJAR, MEDIDAS } from './vehiculos.js';
import { dibujarBestia, TIPOS } from './bestias.js';
import { Gigante, F as FG } from './gigante.js';
import { Calle } from './calle.js';
import { Subsuelo, HONDO } from './subsuelo.js';
import { SonidoPrologo } from './sonido.js';
import { cartela, LETRA } from '../hud.js';
import { rgba, hash } from '../dibujo/tinta.js';
import { COLOR } from '../dibujo/paletas.js';
import { edificiosCiudad } from '../dibujo/ciudad_pintada.js';

const SUELO = 512;                     // la calle del nivel 7 (y del mundo)
const REPOSO = 150;                    // lo que se ve de la losa, arriba, cuando la camara llega a la sala
const CAMY = 32;                       // la camara del nivel 7 con la calle (la que pinta el hilo de la ciudad)
const EB = 0.9;                         // las bestias, en el carril de detras
const VEL = 380;                       // el convoy, u/s (unos 21 km/h: cargado y de noche), sin parar nunca
export const TL = {
  convoy: 3.2, bestias: 11.4, disparo: 13.55, impacto: 13.7, salto: 14.35,
  rafagas: [16.6, 17.3, 18.1], calma: 19.5, gigante: 21.0, ojo: [30.0, 30.9, 32.4, 33.1],
  baja: [33.5, 45.5], intro0: 46.0, ultima: 47.0, suelta: 47.45,
};
// EL ASALTO AL TANQUE (2026-10-20; pedido despues: «UN SOLO monstruo salta sobre el tanque, los demas siguen
// corriendo»): la que va delante salta a la torre del tanque de cola (girada hacia atras; desde su origen, en el
// suelo bajo su centro) y se queda agarrada; las otras siguen a la carrera y lo adelantan por el carril de detras.
const SITIO = { dx: -60, dy: -160 };
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const tramo = (T, a, b) => ease((T - a) / (b - a));
const lin = (T, a, b) => Math.max(0, Math.min(1, (T - a) / (b - a)));

// el orden del convoy: tipo, separacion con el anterior (centro a centro), torre
const CONVOY = [
  { tipo: 'jeep', sep: 0 },
  { tipo: 'camion', sep: 525 },
  { tipo: 'tanque', sep: 725, num: '47' },
  { tipo: 'blindado', sep: 628 },
  { tipo: 'camion', sep: 633 },
  { tipo: 'tanque', sep: 625, num: '51', cola: true, torreta: Math.PI },
];

export class Prologo {
  constructor(son) {
    this.son = son; this.snd = new SonidoPrologo(son);
    // fase: 'preparando' (en negro: main.js carga y dibuja el laboratorio), 'calle' (el escenario), 'lab' (la sala)
    this.t = 0; this.fase = 'preparando'; this.negros = 0; this.mudo = false;
    this.gig = new Gigante(); this.sub = new Subsuelo(); this.calle = new Calle();
    this.vehiculos = []; this.bestias = []; this.humo = []; this.fuego = []; this.marcas = [];
    this.hecho = new Set(); this.zv = CAMY; this.ancla = null; this.lab = null;
    this.grieta = 0; this.temblor = 0; this.flash = 0;
  }
  get escenario() { return this.fase === 'calle'; }

  // ---------------------------------------------------------------- arranque (con el nivel 7 ya cargado)
  empezar(E, camW) {
    this.E7 = E; this.w = camW; this.fase = 'calle';
    this.nivel = { zonaLab: true, sub: E.nivel.sub, titulo: E.nivel.titulo };
    let x = this.camX(TL.convoy) - 160 - VEL * TL.convoy;            // el jeep asoma por la izquierda en TL.convoy
    this.cascotes = [];
    CONVOY.forEach((c, k) => {
      x -= c.sep;
      this.vehiculos.push({ tipo: c.tipo, x, vel: VEL, dist: 0, sem: k * 7 + 3, torreta: c.torreta || 0, cola: !!c.cola, num: c.num, retro: 0, focoAng: -1.4 });
    });
    // donde va a caer el frasco en pantalla al llegar abajo (la camara de la intro lo deja ahi)
    this.piedraX = camW / 2 - 120;
  }

  // la camara en la calle: entra despacio, acompaña al convoy hacia la derecha y se queda
  camX(T) { return 120 + 470 * tramo(T, 3.6, 19.5) + 60 * tramo(T, 19.5, 33.5); }
  // la camara bajando: su y en el mundo del nivel 7 (despues del cambio, + delta en el del laboratorio)
  // (acaba con 150 u de la losa en pantalla: la piedra encajada arriba y debajo la sala con la luz del frasco; al
  // soltarse la piedra la camara la lleva el juego, que baja hasta el frasco: el barrido sigue a la piedra)
  camZ(T) {
    const fin = HONDO + SUELO - REPOSO;
    return CAMY + (fin - CAMY) * tramo(T, TL.baja[0], TL.baja[1]);
  }

  // ---------------------------------------------------------------- un paso (60 Hz)
  // g: { fx, cam, w, zona } del juego; devuelve 'laboratorio' cuando toca cambiar de nivel
  paso(dt, g) {
    const T0 = this.t, T = (this.t += dt);
    this.golpe = null;
    const una = (k) => (this.hecho.has(k) ? false : (this.hecho.add(k), true));
    const snd = this.mudo ? null : this.snd;
    const cx = g.cam.x + g.w / 2, pan = (x) => Math.max(-1, Math.min(1, (x - cx) / (g.w * 0.7)));
    // ---- el convoy
    let suma = 0, sx = 0, tanque = 0;
    for (const v of this.vehiculos) {
      const vel = VEL;
      v.vel = vel; v.x += vel * dt; v.dist += vel * dt;
      v.retro = Math.max(0, v.retro - dt * 2.2);
      v.golpe = Math.max(0, (v.golpe || 0) - dt * 4);
      // el foco del jeep barre la niebla
      if (v.tipo === 'jeep') v.focoAng = -1.55 + Math.sin(T * 0.9) * 0.75;
      const p = Math.max(0, 1 - Math.abs(v.x - cx) / 1500) * (v.vel > 1 ? 1 : 0.55);
      suma += p; sx += p * pan(v.x); if (v.tipo === 'tanque') tanque = Math.max(tanque, p);
      // humo del escape
      if (v.vel > 1 || v.cola) {
        const ex = v.x - MEDIDAS[v.tipo].largo * 0.42, ey = SUELO - (v.tipo === 'camion' ? 214 : v.tipo === 'tanque' ? 106 : 60);
        if (Math.random() < 0.5) this.humo.push({ x: ex, y: ey, vx: -40 - Math.random() * 30, vy: -30 - Math.random() * 25, r: 10 + Math.random() * 10, t: 0, vida: 2.4 + Math.random(), a: 0.16, osc: true });
      }
    }
    if (snd) snd.motorEn(Math.min(1, suma * 0.75), suma > 0 ? sx / suma : 0, tanque, dt);
    // ---- el tanque de cola dispara hacia atras
    const cola = this.vehiculos.find((v) => v.cola);
    if (T >= TL.disparo && una('disparo')) {
      cola.retro = 1; this.flash = 1;
      // el proyectil cae en la manada (la que va detras de la que saltara), sin pasar de la izquierda de la pantalla
      const tras = this.bestias.filter((b) => !b.lider).sort((a, b) => b.x - a.x)[0];
      this.blanco = Math.max(g.cam.x + 60, tras ? tras.x + 40 : g.cam.x + g.w * 0.18);
      this.boca = cola._boca ? [cola.x + cola._boca[0], SUELO + cola._boca[1]] : [cola.x - 380, SUELO - 140];
      g.fx.sacudir(0.35);
      if (snd) snd.canonazo(pan(cola.x));
    }
    if (T >= TL.impacto && una('impacto')) {
      const x = this.blanco;
      this.fuego.push({ x, y: SUELO - 30, t: 0 });
      this.marcas.push({ x, w: 150 });
      g.fx.chispa(x, SUELO - 30, 46, 'rgba(255,236,200,', 620, 0.9, 900, 3);
      g.fx.esquirlas(x, SUELO - 20, 26, 'rgba(110,110,116,');
      g.fx.polvo(x, SUELO, 24, g.zona.polvo, 160, 150);
      g.fx.sacudir(0.6);
      for (let k = 0; k < 26; k++) this.humo.push({ x: x + (Math.random() - 0.5) * 80, y: SUELO - 30 - Math.random() * 40, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 70, r: 20 + Math.random() * 30, t: 0, vida: 4 + Math.random() * 3, a: 0.42, osc: true });
      // la bestia que estaba mas cerca sale por los aires
      let cerca = null;
      for (const b of this.bestias) if (!b.vuela && !b.lider && (!cerca || Math.abs(b.x - x) < Math.abs(cerca.x - x))) cerca = b;
      if (cerca) cerca.vuela = { y: 0, vy: 820 + Math.random() * 200, ang: 0, va: -7, vx: cerca.vel * 0.3 };
      if (snd) snd.explosion(pan(x));
    }
    this.flash = Math.max(0, this.flash - dt * 7);
    // ---- las bestias
    if (T >= TL.bestias && una('bestias')) {
      // (la de delante, la que saltara, es la grande; las demas en fila, cada una 120 u mas atras)
      [1, 0, 3, 2, 0, 2].forEach((tipo, k) => this.bestias.push({ tipo, k: [1.05, 1, 0.95, 1.1, 0.92, 1][k], x: cola.x - 760 - k * 125 - hash(k, 3) * 50, pie: SUELO - 10, vel: VEL, dist: hash(k, 7) * 400, sem: 11 + k * 5, n: k, lider: k === 0, sprint: 640 + hash(k, 5) * 120 }));
    }
    for (const b of this.bestias) {
      // ---- la carrera: hasta el salto cada una persigue un hueco detras del tanque que se va cerrando (la de delante
      // hasta tenerlo a tiro); despues las demas aprietan y lo adelantan
      if (!b.vuela && !b.quieta && !b.salta && !b.monta && cola) {
        if (b.lider && T >= TL.salto) {
          // (primero un amago: se agacha 0,16 s sin dejar de correr, y luego el brinco)
          b.salta = { t: 0, pre: 0.16, dur: 0.58, x0: b.x, y0: b.pie };
          if (snd) snd.chillido(pan(b.x), 1.3);
        } else if (T < TL.salto) {
          const k = tramo(T, TL.bestias + 0.4, TL.salto), hueco = b.lider ? 560 - 290 * k : 600 + b.n * 120 - 200 * k;
          b.vel = Math.max(VEL * 0.7, Math.min(980, VEL + (cola.x - hueco - b.x) * 1.7));
        } else b.vel += (b.sprint - b.vel) * Math.min(1, dt * 2.2);
      }
      if (b.salta && b.salta.pre) {
        const q = b.salta; q.t += dt; b.x += b.vel * dt; b.dist += b.vel * dt * 0.4;
        if (q.t >= q.pre) { q.pre = 0; q.t = 0; q.x0 = b.x; g.fx.polvo(b.x, SUELO - 10, 6, g.zona.polvo, 40, 24); }
        continue;
      }
      if (b.salta) {
        const q = b.salta; q.t += dt;
        const k = Math.min(1, q.t / q.dur), tx = cola.x + SITIO.dx, ty = SUELO - 3 + SITIO.dy;
        const alto = 50 + Math.max(0, q.y0 - ty) * 0.2;            // un brinco, no un vuelo (con 90 subia por encima del cuadro)
        b.x = q.x0 + (tx - q.x0) * k; b.pie = q.y0 + (ty - q.y0) * k - alto * 4 * k * (1 - k);
        q.k = k; q.ang = (k - 0.45) * 0.9; b.dist += b.vel * dt * 0.2;
        // el jefe de carro la ve venir y se mete
        if (q.t > 0.18 && !cola.escondido) { cola.escondido = true; if (snd) snd.escotilla(pan(cola.x)); }
        if (k >= 1) {
          b.salta = null; b.monta = SITIO; cola.golpe = 1;
          g.fx.sacudir(0.14);
          g.fx.chispa(b.x, b.pie, 10, 'rgba(235,230,210,', 170, 0.35, 700, 1.4);
          g.fx.polvo(b.x, b.pie, 3, g.zona.polvo, 40, 20);
          if (snd) snd.golpeChapa(pan(b.x));
        }
        continue;
      }
      if (b.monta) {
        // agarrada a la chapa: va con el tanque, mueve las zarpas, ruge de vez en cuando
        b.x = cola.x + b.monta.dx; b.pie = SUELO - 3 + b.monta.dy + Math.sin(cola.dist * 0.03 + cola.sem) * 1.1 + (cola.golpe || 0) * 4;
        b.dist += 26 * dt;
        if (snd && Math.random() < dt * 0.5) snd.chillido(pan(b.x), 0.9 + hash(b.sem) * 0.4);
        continue;
      }
      if (b.vuela && !b.quieta) {
        const q = b.vuela; q.vy -= 2200 * dt; q.y += q.vy * dt; q.ang += q.va * dt; b.x += q.vx * dt;
        // cae de lado y se queda tumbada, el vientre en el suelo
        if (q.y <= 0 && q.vy < 0) { b.quieta = true; q.y = -0.36 * TIPOS[b.tipo].alto * (b.k || 1); q.ang = 0.1; g.fx.polvo(b.x, SUELO, 10, g.zona.polvo, 80, 50); }
        continue;
      }
      if (b.quieta) continue;
      b.x += b.vel * dt; b.dist += b.vel * dt;
      if (Math.abs(b.x - cx) < g.w && Math.random() < dt * 5) g.fx.polvo(b.x - 40 * (b.k || 1), SUELO - 10, 1, g.zona.polvo, 12, 8);
      if (snd && Math.abs(b.x - cx) < 1100 && Math.random() < dt * 0.9) snd.chillido(pan(b.x), 0.8 + hash(b.sem) * 0.5);
      if (snd && Math.abs(b.x - cx) < 900 && Math.random() < dt * 0.4) snd.grunido(pan(b.x));
    }
    // ---- rafagas lejanas, a la derecha
    TL.rafagas.forEach((r, k) => { if (T >= r && una('rafaga' + k) && snd) snd.rafaga(0.9, 7 + k); });
    if (T >= TL.calma && una('calma') && snd) snd.pararMotor();
    // ---- el gigante: anda, pisa, mira
    const tg0 = T0 - TL.gigante, tg = T - TL.gigante;
    // (con el ancho de pantalla de ahora: el ojo se abre en el hueco de cielo entre los dos edificios de la calle, al 30 %)
    if (T >= TL.gigante - 1 && una('gigante0')) this.gig.centrarOjo(0.3 * g.w, 9.0, this.camX(TL.gigante + 9.0));
    if (T >= TL.gigante - 0.5 && una('acorde') && snd) snd.arrancarAcorde();
    if (T >= 23.4 && una('gemido1') && snd) snd.gemido(5);
    if (T >= 38.5 && una('gemido2') && snd) snd.gemido(6);
    if (T >= TL.ojo[0] && una('ojo') && snd) snd.ojo();
    if (T >= 44 && una('acordeFin') && snd) snd.pararAcorde(5);
    if (tg > 0 && T < 44.6) {
      for (const p of this.gig.pisadas(tg0, tg)) {
        const lejos = 1 - lin(T, 36, 46) * 0.55, k = (p.lejos ? 0.7 : 1) * lejos;
        this.pisar(k, g, snd);
      }
    }
    const o = TL.ojo;
    this.gig.ojo = T < o[0] ? 0 : T < o[1] ? ease((T - o[0]) / (o[1] - o[0])) : T < o[2] ? 1 : T < o[3] ? 1 - ease((T - o[2]) / (o[3] - o[2])) : 0;
    this.gig.mira = T < o[1] ? 0.7 : T < o[1] + 0.6 ? 0.7 * (1 - ease((T - o[1]) / 0.6)) : 0;
    // ---- la ultima pisada: la que suelta la piedra
    if (T >= TL.ultima && una('ultima')) this.pisar(1.25, g, snd, true);
    // ---- particulas propias
    for (const h of this.humo) { h.t += dt; h.x += h.vx * dt; h.y += h.vy * dt; h.vx *= 0.99; h.r += dt * 26; }
    this.humo = this.humo.filter((h) => h.t < h.vida);
    // ---- los cascotes de las fachadas: caen, rebotan en la acera de enfrente y se quedan
    for (const q of this.cascotes) {
      if (q.quieto) continue;
      q.t += dt; q.vy += 1500 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.ang += q.va * dt;
      if (q.y > q.suelo) {
        q.y = q.suelo;
        if (q.vy > 160 && Math.random() < 0.5) g.fx.polvo(q.x, q.suelo, 2, g.zona.polvo, 14, 10);
        q.vy *= -0.32; q.vx *= 0.55; q.va *= 0.5;
        if (Math.abs(q.vy) < 60) { q.quieto = true; q.ang = Math.round(q.ang / Math.PI) * Math.PI + (hash(q.sem, 5) - 0.5) * 0.4; }
      }
    }
    if (this.cascotes.length > 160) this.cascotes.splice(0, this.cascotes.length - 160);
    for (const f of this.fuego) f.t += dt;
    this.fuego = this.fuego.filter((f) => f.t < 5);
    this.temblor = Math.max(0, this.temblor - dt * 1.4);
    // ---- la bajada
    this.zv = this.camZ(T);
    if (this.snd) this.snd.sordo = tramo(T, 34.5, 38.5);
    // al empezar a bajar se fija el corte a la pantalla (la camara ya no se mueve de lado) y donde caera el frasco
    if (T >= TL.baja[0] && !this.ancla) { this.ancla = { x: g.cam.x }; this.w = g.w; this.piedraX = g.w / 2 - 120; }
    this.grieta = Math.max(this.grieta, Math.min(1, (this.zv - SUELO + 420) / HONDO));
    this.sub.actualizar(dt);
    if (this.fase === 'calle' && this.zv >= 800) return 'laboratorio';
    return null;
  }

  // CADA PISOTON SE NOTA (2026-10-20, pedido: «haz que cada pisoton del gigante se note»; antes solo un temblor fino
  // de 2 u y un golpe a 36 Hz que en altavoces pequenos no se oia): la camara BAJA de golpe y rebota (el empujon con
  // muelle de la camara) con temblor encima, las farolas parpadean, cae polvo de lo alto con algun cristalito, la
  // gravilla y el polvo de la calle saltan de punta a punta de la pantalla, en el pie del gigante se abre una onda de
  // polvo, y suena con cuerpo y chasquido (sonido.js, pisada)
  pisar(k, g, snd, ultima = false) {
    this.golpe = ultima ? 'gigante_cae' : 'derrumbe';
    g.fx.cam.golpe({ empujon: (ultima ? 16 : 10) * k, dir: { x: 0, y: 1 }, trauma: (ultima ? 0.62 : 0.44) * k });
    this.temblor = Math.min(1, this.temblor + 0.7 * k);
    this.grieta = Math.min(1, this.grieta + 0.06 * k);
    this.tPisada = this.t; this.kPisada = Math.min(1, k);
    if (this.fase === 'calle' && this.zv < SUELO) {
      const x0 = g.cam.x, w = g.w;
      // polvo y gravilla que caen de lo alto de la pantalla (de las cornisas), y algun cristal de las ventanas
      for (let q = 0; q < Math.round(8 + 10 * k); q++) g.fx.chispa(x0 + Math.random() * w, g.cam.y + 10 + Math.random() * 60, 2, 'rgba(205,210,220,', 30, 1.8, 260, 1.5);
      for (let q = 0; q < Math.round(2 + 3 * k); q++) g.fx.chispa(x0 + Math.random() * w, g.cam.y + 40 + Math.random() * 160, 1, 'rgba(230,238,248,', 40, 1.2, 900, 1.8);
      // el suelo salta: gravilla y una franja de polvo a ras de la calle
      for (let q = 0; q < 8; q++) {
        const x = x0 + ((q + Math.random()) / 8) * w;
        g.fx.polvo(x, SUELO, Math.round(3 + 3 * k), g.zona.polvo, 90, 30 + 50 * k);
        if (Math.random() < 0.4 + 0.5 * k) g.fx.esquirlas(x, SUELO - 3, Math.ceil(2 * k), 'rgba(108,108,116,');
      }
    }
    if (this.fase === 'calle' && this.zv < SUELO) this.soltarCascotes(k, g);
    this.gig.onda(this.t - TL.gigante, k);
    this.sub.golpe(k, this.t);
    if (snd) snd.pisada(Math.min(1.2, k));
  }

  // CADA PISADA ARRANCA TROZOS DE LOS EDIFICIOS (2026-10-20, pedido: «cada pisoton que da el monstruo, saltan
  // piezas de los edificios»): de las fachadas pintadas que se ven (ciudad_pintada.js, edificiosCiudad) salen con una
  // bocanada de polvo trozos de hormigon, ladrillos, cristales y alguna chapa, que caen girando, rebotan en la acera
  // de enfrente (por detras del convoy) y se quedan. Si en la pantalla no hay fachada, caen de lo alto, desde fuera
  // del cuadro: nada aparece de golpe en mitad del cielo.
  soltarCascotes(k, g) {
    const x0 = g.cam.x, x1 = g.cam.x + g.w, y0 = g.cam.y, h = g.cam.h || 576;
    const casas = edificiosCiudad(this.E7).filter((c) => c.x1 > x0 + 20 && c.x0 < x1 - 20 && c.y1 > y0 + 40);
    const n = Math.round(5 + 9 * Math.min(1.2, k));
    for (let i = 0; i < n; i++) {
      const sem = Math.floor(this.t * 97) * 31 + i;
      let x, y, sale = 1;
      const c = casas.length ? casas[Math.floor(Math.random() * casas.length)] : null;
      if (c && Math.random() < 0.8) {
        x = Math.max(c.x0, x0 + 10) + Math.random() * (Math.min(c.x1, x1 - 10) - Math.max(c.x0, x0 + 10));
        y = Math.max(c.y0 + 10, y0 + 12) + Math.random() * Math.max(10, Math.min(c.y1 - 60, y0 + h * 0.55) - Math.max(c.y0 + 10, y0 + 12));
        if (Math.random() < 0.35) g.fx.polvo(x, y, 3, g.zona.polvo, 18, 6);         // la bocanada donde se suelta
      } else { x = x0 + Math.random() * g.w; y = y0 - 30 - Math.random() * 120; sale = 0.3; }
      const tipo = Math.random() < 0.45 ? 'hormigon' : Math.random() < 0.55 ? 'ladrillo' : Math.random() < 0.7 ? 'cristal' : 'chapa';
      const tam = tipo === 'cristal' ? 4 + Math.random() * 7 : tipo === 'chapa' ? 10 + Math.random() * 14 : 5 + Math.random() * (10 + 10 * k);
      this.cascotes.push({ x, y, vx: (Math.random() - 0.5) * 140 * sale, vy: -Math.random() * 120 * sale, ang: Math.random() * 6.28, va: (Math.random() - 0.5) * 14, tipo, tam, sem, t: 0, suelo: SUELO - 14 - Math.random() * 8 });
    }
  }
  dibujarCascotes(ctx) {
    ctx.save(); ctx.lineJoin = 'round';
    for (const q of this.cascotes) {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.ang);
      const r = q.tam, k = (j) => 0.6 + 0.4 * hash(q.sem, j);
      if (q.tipo === 'cristal') {
        ctx.beginPath(); ctx.moveTo(-r, r * 0.3); ctx.lineTo(r * k(1) * 0.4, -r); ctx.lineTo(r, r * 0.2 * k(2)); ctx.closePath();
        ctx.fillStyle = 'rgba(190,215,235,.32)'; ctx.fill(); ctx.strokeStyle = 'rgba(225,240,255,.6)'; ctx.lineWidth = 0.8; ctx.stroke();
      } else if (q.tipo === 'chapa') {
        ctx.beginPath(); ctx.moveTo(-r, -r * 0.2); ctx.quadraticCurveTo(0, -r * 0.5 * k(3), r, -r * 0.1); ctx.lineTo(r * 0.9, r * 0.12); ctx.quadraticCurveTo(0, -r * 0.2, -r, r * 0.1); ctx.closePath();
        ctx.fillStyle = '#3d3f43'; ctx.fill(); ctx.strokeStyle = '#0b0b0c'; ctx.lineWidth = 1.4; ctx.stroke();
      } else {
        const n = 5, pts = [];
        for (let j = 0; j < n; j++) { const a = (j / n) * 6.28, rr = r * k(j + 4) * (q.tipo === 'ladrillo' ? (j % 2 ? 0.55 : 1) : 1); pts.push([Math.cos(a) * rr, Math.sin(a) * rr * (q.tipo === 'ladrillo' ? 0.5 : 0.8)]); }
        ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
        ctx.fillStyle = q.tipo === 'ladrillo' ? '#4a3a31' : '#575a60'; ctx.fill(); ctx.strokeStyle = '#0b0b0c'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.strokeStyle = 'rgba(205,212,225,.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pts[3][0], pts[3][1]); ctx.lineTo(pts[4][0], pts[4][1]); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- el cambio de nivel, con la pantalla tapada
  // camLab: la camara que pone la intro (para saber el ancla); techo: la y del techo sobre el frasco
  alLab(E, cam, intro, techo, camW) {
    const delta = techo - HONDO - SUELO;
    this.fase = 'lab'; this.E = E;
    this.lab = { techo, delta };
    // el frasco cae donde el corte puso la piedra: la x de la camara sale de ahi
    cam.x = E.inicio.x - this.piedraX;
    cam.y = this.zv + delta;
    this.ancla = { x: cam.x };
    this.w = camW;
    intro.conPrologo = true;
    intro.t = this.introT();
  }
  introT() { return this.t - TL.intro0; }
  // la camara mientras el prologo la lleva (false: la lleva el juego)
  camara(cam) {
    if (this.fase === 'calle') { cam.x = this.camX(this.t); cam.y = this.zv; return true; }
    if (this.fase !== 'lab') return false;
    if (this.t < TL.suelta) { cam.y = this.zv + this.lab.delta; return true; }
    return false;
  }
  // la piedra del techo tiembla con las pisadas (main.js, piedraEn)
  get piedraTiembla() { return this.temblor * 0.12 * Math.sin(this.t * 41); }
  // el factor de las farolas: fallan con el silencio y se apagan cuando el gigante abre el ojo
  lamparas(T = this.t) {
    const n = (k) => hash(Math.floor(T * 14), k);
    let f = 1;
    if (T > 19.4 && T < 21.6) f = n(3) < 0.3 ? 0.25 : 0.9;
    const o = TL.ojo;
    if (T > o[0] - 0.4 && T < o[3] + 0.6) {
      const k = T < o[0] + 0.4 ? lin(T, o[0] - 0.4, o[0] + 0.4) : T > o[3] ? 1 - lin(T, o[3], o[3] + 0.6) : 1;
      f = Math.min(f, 1 - 0.9 * k * (n(5) < 0.85 ? 1 : 0.7));
    }
    if (T > 33.2) f *= n(7) < 0.15 ? 0.4 : 1;
    // cada pisada: un parpadeo que se apaga en un momento
    if (this.tPisada !== undefined) { const e = T - this.tPisada; if (e >= 0 && e < 0.5) f *= 1 - 0.6 * this.kPisada * Math.exp(-e * 9) * (n(11) < 0.6 ? 1 : 0.4); }
    return f;
  }
  envolver(luces) {
    for (const L of luces) {
      if (L._prologo) continue;
      const f0 = L.fuerza; L._prologo = true; L.fuerza = (t) => f0(t) * (this.escenario ? this.lamparas() : 1);
    }
  }

  // ---------------------------------------------------------------- dibujo
  // el gigante, en el fondo, tras la capa de la ciudad gotica (f 0,12) y antes del paso elevado
  trasCapa(c, f, camF, s) {
    const tg = this.t - TL.gigante;
    if (f > 0.1 && f < FG && tg > -1 && tg < 40) this.gig.dibujar(c, Math.max(0, tg), camF, s);
  }
  // lo que brilla del gigante, encima del fondo ya gradado y recortado por lo que tiene delante
  sobreFondo(c, camF, s, t, capas) {
    const tg = this.t - TL.gigante;
    if (tg < 0 || tg > 40) return;
    if (this.gigDelante) this.gig.dibujar(c, tg, camF, s);      // (depuracion: el gigante sin nada delante)
    const W = c.canvas.width, H = c.canvas.height;
    const m = this.mascara || (this.mascara = document.createElement('canvas'));
    if (m.width !== W || m.height !== H) { m.width = W; m.height = H; }
    const mc = m.getContext('2d');
    mc.setTransform(1, 0, 0, 1, 0, 0); mc.clearRect(0, 0, W, H);
    for (const q of capas) if (q.f > FG) mc.drawImage(q.bmp, -camF.x * q.f * s, -Math.max(0, camF.y) * q.fy * s, q.w * s, q.h * s);
    this.gig.emisivos(c, tg, camF, s, t, m);
  }

  // en el mundo, antes del terreno: humo, el convoy, las bestias y la marca de la explosion
  dibujarMundo(ctx, t, s, cam) {
    const x0 = cam.x - 700, x1 = cam.x + cam.w + 700;
    // la profundidad de la calle: lo de lejos y los cascotes de la calle, detras de todo lo demas
    if (this.fase === 'calle') { this.calle.dibujarLejos(ctx, cam); this.calle.dibujarMedio(ctx, cam, 'tras'); this.dibujarCascotes(ctx); }
    for (const m of this.marcas) { ctx.fillStyle = 'rgba(8,8,10,.55)'; ctx.beginPath(); ctx.ellipse(m.x, SUELO - 1, m.w, 6, 0, 0, 7); ctx.fill(); }
    for (const h of this.humo) {
      const a = h.a * Math.sin(Math.min(1, h.t / h.vida) * Math.PI);
      const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
      g.addColorStop(0, `rgba(38,40,46,${a})`); g.addColorStop(1, 'rgba(38,40,46,0)');
      ctx.fillStyle = g; ctx.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
    }
    // las bestias corren por el carril de detras (un poco mas pequeñas y mas arriba: mas lejos), el convoy por delante
    const bestia = (b) => {
      ctx.save(); ctx.translate(b.x, b.pie);
      if (b.salta) { ctx.translate(0, -40); ctx.rotate(b.salta.ang || 0); ctx.translate(0, 40); }      // en el aire: el morro arriba y luego abajo
      ctx.scale(EB, EB); dibujarBestia(ctx, b, t, s); ctx.restore();
    };
    for (const b of this.bestias) if (b.x > x0 && b.x < x1 && !b.salta && !b.monta) bestia(b);
    for (const v of this.vehiculos) {
      if (v.x < x0 || v.x > x1) continue;
      ctx.save(); ctx.translate(v.x, SUELO - 3 + (v.golpe || 0) * 4);
      DIBUJAR[v.tipo](ctx, v, t);
      ctx.restore();
    }
    // las que saltan al tanque y las que van encima, delante de el
    for (const b of this.bestias) if (b.x > x0 && b.x < x1 && (b.salta || b.monta)) bestia(b);
    // lo que hay tirado en la acera de este lado: por delante de todo lo que va por la calle
    if (this.fase === 'calle') this.calle.dibujarMedio(ctx, cam, 'delante');
  }

  // las luces para el mapa de luz (main.js, penumbra)
  luces(cam) {
    const L = [], x0 = cam.x - 500, x1 = cam.x + cam.w + 500;
    for (const v of this.vehiculos) {
      if (v.x < x0 || v.x > x1) continue;
      for (const [fx, fy] of MEDIDAS[v.tipo].faros) L.push({ x: v.x + fx, y: SUELO + fy, r: 420, color: '#f1e7c9', f: 0.9, cono: true, ang: -Math.PI / 2 + 0.1 });
      L.push({ x: v.x, y: SUELO - 150, r: 330, color: '#9db6d6', f: 0.22 });
      if (v.tipo === 'jeep') { const [fx, fy] = MEDIDAS.jeep.foco; L.push({ x: v.x + fx, y: SUELO + fy, r: 900, color: '#f4ecd6', f: 1, cono: true, ang: v.focoAng - Math.PI / 2 }); }
    }
    for (const b of this.bestias) if (b.x > x0 && b.x < x1 && !b.quieta) L.push({ x: b.x, y: b.pie - 80, r: 120, color: COLOR.podre, f: 0.45 });
    if (this.flash > 0 && this.boca) L.push({ x: this.boca[0], y: this.boca[1], r: 600, color: '#fff1d6', f: 2 * this.flash });
    for (const f of this.fuego) { const k = Math.max(0, 1 - f.t / 0.9); L.push({ x: f.x, y: f.y - 40, r: 760, color: '#fff0d0', f: 2.2 * k + 0.25 * Math.max(0, 1 - f.t / 5) }); }
    // los fogonazos de las rafagas, fuera de la pantalla por la derecha
    TL.rafagas.forEach((r) => { if (this.t > r && this.t < r + 0.8 && hash(Math.floor(this.t * 20), 9) < 0.5) L.push({ x: cam.x + cam.w + 120, y: SUELO - 120, r: 700, color: '#fff1d6', f: 0.7 }); });
    return L;
  }

  // lo que emite en el mundo (sumado, despues de la penumbra: el resplandor del juego lo recoge)
  dibujarLuces(ctx, s, cx, cy, t) {
    ctx.save(); ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s); ctx.globalCompositeOperation = 'lighter';
    const brillo = (x, y, r, color, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(color, a)); g.addColorStop(0.3, rgba(color, a * 0.3)); g.addColorStop(1, rgba(color, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
    const haz = (x, y, ang, largo, abre, color, a) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      const g = ctx.createLinearGradient(0, 0, largo, 0); g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(largo, -largo * abre); ctx.lineTo(largo, largo * abre); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    for (const v of this.vehiculos) {
      if (v.x < cx - 600 || v.x > cx + 2200) continue;
      for (const [fx, fy] of MEDIDAS[v.tipo].faros) { const x = v.x + fx, y = SUELO - 3 + fy; haz(x, y, 0.06, 460, 0.16, '#f1e7c9', 0.13); brillo(x, y, 26, '#fff6e0', 0.9); }
      if (v.tipo === 'jeep') { const [fx, fy] = MEDIDAS.jeep.foco, x = v.x + fx + Math.cos(v.focoAng) * 14, y = SUELO - 3 + fy + Math.sin(v.focoAng) * 14; haz(x, y, v.focoAng, 1500, 0.09, '#f4ecd6', 0.16); brillo(x, y, 34, '#fffaf0', 1); }
    }
    for (const b of this.bestias) for (const [x, y] of b._bolas || []) brillo(b.x + x * EB, b.pie + y * EB - 2, 12, COLOR.podre, 0.7);
    for (const b of this.bestias) for (const [x, y] of b._pust || []) brillo(b.x + x * EB, b.pie + y * EB, 7, COLOR.podre, 0.45);
    if (this.flash > 0 && this.boca) {
      const [x, y] = this.boca;
      brillo(x, y, 120 * this.flash + 40, '#fff6e2', 0.9 * this.flash);
      ctx.fillStyle = `rgba(255,250,235,${this.flash})`;
      ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = Math.PI + (k - 4.5) * 0.18, r = k % 2 ? 30 : 90 * this.flash + 20; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6); } ctx.fill();
      // la estela del proyectil
      if (this.blanco !== undefined) { ctx.strokeStyle = `rgba(255,248,230,${this.flash})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(this.blanco, SUELO - 30); ctx.stroke(); }
    }
    for (const f of this.fuego) {
      const k = f.t / 0.9;
      if (k < 1) { brillo(f.x, f.y - 40 * k, 60 + 200 * k, '#fff3dc', 1 - k); brillo(f.x, f.y - 20, 50 + 80 * k, '#ffffff', 0.8 * (1 - k)); }
      else brillo(f.x, SUELO - 10, 60, '#ffe3b8', 0.25 * Math.max(0, 1 - (f.t - 0.9) / 4) * (0.7 + 0.3 * Math.sin(t * 13)));
    }
    ctx.restore();
  }

  // encima de todo, en pantalla: la niebla de la calle, el corte de la tierra, las franjas de cine, el titulo
  dibujarEncima(ctx, W, H, u, s, cx, cy, t, leng) {
    const T = this.t;
    // el corte de la tierra y el cuerpo del gigante se pintan con la pantalla aun en negro (despues daban tirones)
    if (T < 2) { this.sub.preparar(W / s, s); this.gig.preparar(Math.min(s, 1.4)); for (const q of this.calle.cerca) this.calle.pieza(q, s); }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    // ---- la niebla de la calle: espesa al llegar el silencio y con el gigante
    if (this.fase === 'calle') {
      const k = 0.1 + 0.16 * tramo(T, 19, 24) - 0.1 * tramo(T, 33, 36);
      for (let i = 0; i < 7; i++) {
        const x = ((hash(i, 1) * 1.4 - 0.2) * W + (T * (8 + hash(i, 2) * 14) - cx * 0.4) * s * 0.3) % (W * 1.6) - W * 0.3;
        const y = H * (0.45 + hash(i, 3) * 0.45) - (cy - CAMY) * s * 0.6, r = (260 + hash(i, 4) * 300) * s;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba('#8b9eb8', k)); g.addColorStop(1, rgba('#8b9eb8', 0));
        ctx.fillStyle = g; ctx.save(); ctx.translate(x, y); ctx.scale(2.2, 0.6); ctx.translate(-x, -y); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
      }
    }
    // ---- lo que pasa por delante de la camara en la calle (grande, oscuro, desenfocado)
    if (this.fase === 'calle') this.calle.dibujarCerca(ctx, s, cx, cy, W, H);
    // ---- el corte de la tierra
    if (this.ancla && (this.fase === 'lab' || T > TL.baja[0])) {
      this.sub.preparar(this.w, s);
      const a = this.fase === 'lab' ? 1 : tramo(T, TL.baja[0] - 0.2, TL.baja[0] + 1.2);
      const oy = this.fase === 'lab' ? this.lab.techo - HONDO : SUELO;
      ctx.globalAlpha = a;
      this.sub.dibujar(ctx, W, H, s, this.ancla.x - cx, oy - cy, { piedraX: this.piedraX, grieta: this.grieta, luz: tramo(T, 40, 45), t, suelta: this.fase === 'lab' && this.introT() > 1.4, tiembla: this.piedraTiembla });
      ctx.globalAlpha = 1;
      // bajo tierra, vineta mas cerrada
      const kv = tramo(T, 34, 37) * (1 - tramo(T, 44.5, 46.5));
      if (kv > 0) { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.9); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.6 * kv})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    }
    // ---- franjas de cine (se recogen al llegar a la sala: arriba esta la piedra y abajo el frasco)
    const fr = 40 * u * (1 - tramo(T, 44, 45.5));
    if (fr > 0.5) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, fr); ctx.fillRect(0, H - fr, W, fr); }
    // ---- el titulo
    const kc = T < 1.2 ? 0 : T < 2.6 ? (T - 1.2) / 1.4 : T < 6.2 ? 1 : Math.max(0, 1 - (T - 6.2) / 1.2);
    if (kc > 0) cartela(ctx, W, H, u, this.nivel, leng, kc);
    // ---- como saltarlo
    const ks = T < 1 ? T : T < 6 ? 1 : Math.max(0, 1 - (T - 6));
    if (ks > 0) {
      ctx.globalAlpha = 0.45 * ks; ctx.fillStyle = '#efe8da'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.font = `${14 * u}px ${LETRA}`; ctx.fillText(leng === 'es' ? 'Esc  saltar' : 'Esc  skip', W - 24 * u, H - fr - 14 * u);
      ctx.globalAlpha = 1;
    }
    // ---- del negro
    const kn = 1 - lin(T, 0.3, 3.2);
    if (kn > 0) { ctx.fillStyle = `rgba(0,0,0,${kn})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  parar() { this.snd.parar(); }
}
