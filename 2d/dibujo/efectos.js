// Efectos: particulas por evento de la simulacion, el tajo de la daga, la sacudida de camara y el polvo
// que flota en el aire. Las particulas viven en coordenadas del mundo.
import { J, T } from '../sim/constantes.js';
import { TINTA, rgba, hash } from './tinta.js';
import { COLOR } from './paletas.js';
import { polvoSueloListo, vidaBocanada, dibujarBocanada } from './polvo_suelo.js';
import { sentir, Camara, golpeCuerpo, animarCuerpo } from './sentir.js';
import { moverX, moverY } from '../sim/fisica.js';
import { dibujarResto } from './actores.js';

const R = Math.random;
// el color de las chispas segun lo que se golpea: quitina ambar, cristal violeta, chapa naranja, Podredumbre
const MATERIAL = { hormiga: 'rgba(255,214,150,', jefe: 'rgba(228,208,255,', soldado: 'rgba(255,196,128,', espora: 'rgba(255,150,70,', tallo: 'rgba(255,150,70,' };

export class Efectos {
  constructor(zona, z) {
    this.zona = zona; this.z = z;
    this.p = [];          // particulas
    this.tajos = [];      // medias lunas
    this.rayos = [];      // estelas de teletransporte
    this.anillos = [];
    this.destello = 0;    // pantalla en blanco (zorro, golpe fuerte)
    this.paron = 0;       // micro-pausa al golpear (hit stop)
    this.avisos = [];     // polvo que anuncia un tornillo
    // el golpe que se siente (cifras en sentir.js): paron por fuerza, camara con empujon y sacudida por
    // trauma (this.cam; main.js le suma x, y y lee zoom), camara lenta al matar, el corte blanco que cruza al
    // enemigo, la estrella del contacto, chispas en raya, los cuerpos que caen y la racha sobre el 18
    this.cam = new Camara();
    this.lento = 0;
    this.cortes = [];
    this.estrellas = [];
    this.restos = [];     // enemigos muertos que caen con el empujon del golpe, rebotan y se deshacen
    this.racha = null;
    this.son = null;      // main.js: el sonido (los restos suenan al dar contra el suelo)
  }

  get zoom() { return this.cam.zoom; }
  // sacudidas que no son golpes (caidas, derrumbes): la cifra de antes (amplitud) pasada a trauma
  sacudir(v) { this.cam.temblar(Math.sqrt(0.7 * v)); }
  // chispas en raya: salen en abanico hacia `ang`, estiradas por su velocidad, con nucleo blanco
  rayas(x, y, n, ang, abre, color, vel = 600, vida = 0.18, tam = 1.6) {
    for (let k = 0; k < n; k++) {
      const a = ang + (R() - 0.5) * abre, v = vel * (0.45 + R() * 0.75);
      this.p.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: vida * (0.6 + R() * 0.6), t: 0, color, g: 500, tam: tam * (0.7 + R() * 0.6), tipo: 'raya' });
    }
  }

  chispa(x, y, n, color, vel = 220, vida = 0.5, g = 400, tam = 2) {
    for (let k = 0; k < n; k++) {
      const a = R() * Math.PI * 2, v = vel * (0.3 + R() * 0.7);
      this.p.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida, t: 0, color, g, tam: tam * (0.6 + R() * 0.8), tipo: 'punto' });
    }
  }
  polvo(x, y, n, color, ancho = 20, sube = 60) {
    for (let k = 0; k < n; k++) this.p.push({ x: x + (R() - 0.5) * ancho, y, vx: (R() - 0.5) * 80, vy: -R() * sube, vida: 0.6 + R() * 0.5, t: 0, color, g: -10, tam: 4 + R() * 6, tipo: 'nube' });
  }
  // una nube de polvo de Blender en el pie (x, y en el suelo); flip 1 = sale hacia -X. false si no ha cargado
  bocanada(id, x, y, flip, escala, a, color) {
    if (!polvoSueloListo()) return false;
    this.p.push({ tipo: 'bocanada', var: id, x, y, flip: flip || (R() < 0.5 ? 1 : -1), escala, a, color: color || this.z.polvo, vx: 0, vy: 0, g: 0, t: 0, vida: vidaBocanada(id) });
    return true;
  }
  esquirlas(x, y, n, color) {
    for (let k = 0; k < n; k++) {
      const a = -Math.PI * R(), v = 120 + R() * 260;
      this.p.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.8 + R() * 0.4, t: 0, color, g: 1200, tam: 3 + R() * 3, tipo: 'esquirla', giro: R() * 6, vg: (R() - 0.5) * 20 });
    }
  }

  emitir(e, E) {
    const z = this.z;
    // paron, camara, camara lenta y destello de cada golpe: la tabla de sentir.js; y el cuerpo golpeado se
    // aplasta y tiembla mientras dura el paron
    const s = sentir(e);
    if (s) {
      if (s.paron) this.paron = Math.max(this.paron, s.paron);
      if (s.lento) this.lento = Math.max(this.lento, s.lento);
      if (s.destello) this.destello = Math.max(this.destello, s.destello);
      this.cam.golpe(s);
      if (e.en && (e.t === 'impacto' || e.t === 'jefe_rebota')) golpeCuerpo(e.en, e.t === 'jefe_rebota' ? { aplasta: 0.06, paron: s.paron } : s, e);
    }
    switch (e.t) {
      // el polvo del suelo es el de Blender (polvo_suelo.js); mientras carga, las nubes de antes
      case 'paso':
        if (!this.bocanada(['paso_a', 'paso_b', 'paso_c'][Math.floor(R() * 3)], e.x - E.p.cara * 6, e.y, E.p.cara, 1.3 + R() * 0.4, 1))
          if (Math.random() < 0.6) this.polvo(e.x - E.p.cara * 6, e.y, 2, this.z.polvo, 8, 14);
        break;
      case 'salto':
        if (!this.bocanada('aterriza', e.x ?? E.p.x + 11, E.p.y + E.p.h, R() < 0.5 ? 1 : -1, 0.9, 0.85)) this.polvo(e.x ?? E.p.x + 11, E.p.y + E.p.h, 5, z.polvo, 14, 30);
        break;
      case 'doble':
        this.anillos.push({ x: e.x, y: e.y, r: 6, vr: 160, vida: 0.3, t: 0, color: 'rgba(255,248,232,' });
        this.chispa(e.x, e.y, 8, 'rgba(255,248,232,', 140, 0.35, 200, 1.6); break;
      case 'aterriza':
        if (!this.bocanada('aterriza', e.x, e.y, R() < 0.5 ? 1 : -1, e.fuerte ? 1.9 : 1.35, 1)) this.polvo(e.x, e.y, e.fuerte ? 12 : 6, z.polvo, e.fuerte ? 40 : 22, 40);
        if (e.fuerte) this.sacudir(0.12);
        break;
      // el tajo sale en el fotograma del golpe, no en el de la anticipacion; los de lado se alternan
      // (empezaba 0,035 s tarde, y como el tajo acierta en su primer fotograma y el paron lo pasaba a camara
      // lenta, la media luna salia DESPUES de la estrella del golpe: ahora sale ya, y el sprite empieza
      // tambien en el fotograma que lanza el brazo, actores.js)
      case 'tajo': this.tajos.push({ dir: e.dir, zorro: e.zorro, alterna: e.alterna, remata: e.remata, t: 0, vida: e.remata ? 0.22 : 0.15 }); break;
      case 'remate_prepara': {
        // el aviso del remate: un anillo que se cierra sobre la daga y un brillo en la punta
        const hx = e.x + (e.cara || 1) * 14, hy = E.p.y + 24;
        this.anillos.push({ x: hx, y: hy, r: 26, vr: -300, vida: 0.07, t: 0, color: e.zorro ? 'rgba(205,232,255,' : 'rgba(255,248,232,' });
        this.estrellas.push({ x: hx, y: hy, t: 0, vida: 0.1, r: 12, giro: R() * 0.8 });
        break;
      }
      case 'impacto': {
        const lado = e.dir === 'lado', d = e.cara || 1;
        // la media luna que acaba de salir se ve ENTERA durante el paron (congelada a medio barrido)
        for (const a of this.tajos) if (a.t < 0.03) a.t = 0.03;
        const ang0 = lado ? (d > 0 ? 0 : Math.PI) : e.dir === 'arriba' ? -Math.PI / 2 : Math.PI / 2;
        const mat = MATERIAL[e.tipo] || 'rgba(255,236,200,';
        this.rayas(e.x, e.y, e.mata ? 22 : e.fuerte ? 15 : 10, ang0, 1.3, mat, e.fuerte ? 820 : 640, 0.2, e.fuerte ? 2.1 : 1.6);
        this.rayas(e.x, e.y, 4, ang0, 0.5, 'rgba(255,252,244,', 1000, 0.12, 2.4);
        // el corte: cruza al enemigo en el sentido del tajo, un poco torcido cada vez
        const ang = lado ? (R() - 0.5) * 0.9 : Math.PI / 2 + (R() - 0.5) * 0.7;
        this.cortes.push({ x: e.x, y: e.y, ang, t: 0, vida: e.fuerte ? 0.2 : 0.14, largo: e.fuerte ? 110 : 70, ancho: e.fuerte ? 7 : 4.5 });
        if (e.fuerte) this.cortes.push({ x: e.x, y: e.y, ang: ang + 1.1 * (R() < 0.5 ? 1 : -1), t: -0.03, vida: 0.16, largo: 80, ancho: 3.5 });
        this.estrellas.push({ x: e.x, y: e.y, t: 0, vida: 0.12, r: e.fuerte ? 30 : 20, giro: R() * 0.8 });
        // salpicadura de tinta hacia donde va el golpe. Nace a 12-24 u del contacto: saliendo todas del punto,
        // en el paron (que las frena) eran una mancha negra justo donde el golpe tiene que brillar
        const n = e.mata ? 16 : e.fuerte ? 12 : 8;
        for (let k = 0; k < n; k++) {
          const a = (lado ? (d > 0 ? 0 : Math.PI) : e.dir === 'arriba' ? -Math.PI / 2 : Math.PI / 2) + (R() - 0.5) * 1.6, v = 140 + R() * (e.fuerte ? 420 : 300), r0 = 12 + R() * 12;
          this.p.push({ x: e.x + Math.cos(a) * r0, y: e.y + Math.sin(a) * r0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, vida: 0.45 + R() * 0.35, t: 0, color: TINTA, g: 1100, tam: 1.6 + R() * (e.fuerte ? 3.4 : 2.4), tipo: 'tinta' });
        }
        this.anillos.push({ x: e.x, y: e.y, r: 6, vr: e.fuerte ? 520 : 360, vida: e.fuerte ? 0.18 : 0.12, t: 0, color: 'rgba(255,250,240,' });
        if (e.mata) this.anillos.push({ x: e.x, y: e.y, r: 14, vr: 520, vida: 0.2, t: 0, color: 'rgba(255,250,240,' });   // (a 700 y 0,3 s, con la camara lenta, cruzaba media pantalla)
        if (e.racha >= 2) this.racha = { n: e.racha, t: 0, pop: 0 };
        break;
      }
      case 'racha_fin': if (this.racha) this.racha.fin = true; break;
      case 'pogo':
        // el rebote: anillo de canto bajo los pies y chispas que salen hacia los lados y abajo
        if (e.x !== undefined) {
          this.anillos.push({ x: e.x, y: e.y, r: 4, vr: 300, vida: 0.2, t: 0, plano: 0.35, grosor: 1.3, color: 'rgba(255,250,240,' });
          this.rayas(e.x, e.y, 6, Math.PI / 2, 2.6, 'rgba(255,248,232,', 520, 0.16, 1.5);
        }
        break;
      case 'derrape':
        if (this.bocanada('derrape', e.x, e.y, e.dir, 1.4 + R() * 0.3, 1)) break;
        for (let k = 0; k < 7; k++) this.p.push({ x: e.x, y: e.y - 2, vx: -e.dir * (60 + R() * 140), vy: -R() * 50, vida: 0.4 + R() * 0.3, t: 0, color: this.z.polvo, g: -10, tam: 3 + R() * 5, tipo: 'nube' });
        break;
      case 'sunikel':
        for (let k = 0; k < 3; k++) this.tajos.push({ dir: 'sunikel', zorro: true, t: -k * 0.05, vida: 0.2, k });
        this.sacudir(0.15); break;
      // ---- focos que se balancean (focos.js)
      case 'foco_golpe':
        this.chispa(e.x, e.y, e.fuerte ? 16 : 9, 'rgba(255,240,200,', e.fuerte ? 300 : 200, 0.45, 900, 1.5);
        if (e.tipo === 'fluorescente' && e.fuerte) this.esquirlas(e.x, e.y + 2, 4, 'rgba(220,235,250,');
        break;
      case 'foco_toca': this.chispa(e.x, e.y, 3, 'rgba(255,240,200,', 80, 0.3, 600, 1.2); break;
      case 'foco_tope': this.polvo(e.x, e.y + 2, 4, z.polvo, 12, -20); break;
      // ---- combate mejorado
      case 'choque': {
        // el tajo para el golpe enemigo: chispas de metal, estrella grande, parada larga (sentir.js)
        this.estrellas.push({ x: e.x, y: e.y, t: 0, vida: 0.2, r: 46, giro: R() * 0.8 });
        for (let k = 0; k < 2; k++) this.anillos.push({ x: e.x, y: e.y, r: 6, vr: 420 + k * 260, vida: 0.22, t: 0, color: 'rgba(255,250,240,' });
        this.chispa(e.x, e.y, 26, 'rgba(255,236,190,', 420, 0.45, 900, 2);
        this.rayas(e.x, e.y, 18, -Math.PI / 2, Math.PI * 1.6, 'rgba(255,230,170,', 900, 0.22, 2);
        break;
      }
      case 'desvio':
        this.estrellas.push({ x: e.x, y: e.y, t: 0, vida: 0.16, r: 30, giro: R() * 0.8 });
        this.anillos.push({ x: e.x, y: e.y, r: 4, vr: 380, vida: 0.18, t: 0, color: 'rgba(255,250,240,' });
        this.chispa(e.x, e.y, 14, 'rgba(255,248,232,', 300, 0.35, 500, 1.8);
        break;
      case 'aturdido':
        this.chispa(e.x, e.y, 10, 'rgba(255,248,232,', 150, 0.5, 200, 1.6);
        this.anillos.push({ x: e.x, y: e.y + 6, r: 8, vr: 160, vida: 0.3, t: 0, color: 'rgba(255,248,232,' });
        break;
      case 'estocada':
        this.rayos.push({ x0: e.x - e.cara * 20, x1: e.x + e.cara * 170, y: e.y + 4, t: 0, vida: 0.24 });
        this.polvo(e.x, E.p.y + E.p.h, 8, z.polvo, 20, 30); this.sacudir(0.12);
        break;
      case 'cargado': if (e.x !== undefined) this.anillos.push({ x: e.x + E.p.cara * 16, y: E.p.y + 26, r: 30, vr: -110, vida: 0.22, t: 0, color: 'rgba(255,250,240,' }); break;
      case 'cura_empieza': this.anillos.push({ x: e.x, y: e.y, r: 44, vr: -120, vida: 0.35, t: 0, color: 'rgba(255,244,226,' }); break;
      case 'cura_esencia':
        this.destello = Math.max(this.destello, 0.18);
        for (let k = 0; k < 2; k++) this.anillos.push({ x: e.x, y: e.y, r: 8, vr: 200 + k * 120, vida: 0.4, t: 0, color: 'rgba(255,244,226,' });
        this.chispa(e.x, e.y, 22, 'rgba(255,246,228,', 140, 0.9, -160, 1.8);
        break;
      case 'aviso_golpe': this.estrellas.push({ x: e.x, y: e.y, t: 0, vida: 0.1, r: 10, giro: R() }); break;
      case 'zarpazo': this.polvo(e.x, e.y + 20, 3, z.polvo, 16, 10); break;
      case 'tallo_aviso': case 'espora_hincha': this.anillos.push({ x: e.x, y: e.y, r: 4, vr: 90, vida: 0.3, t: 0, color: 'rgba(226,121,43,' }); break;
      case 'espora_lanza': this.chispa(e.x, e.y, 6, 'rgba(226,121,43,', 90, 0.4, 0, 1.6); break;
      case 'golpe': {
        // lo del material (las rayas del impacto van aparte): trocitos que caen
        const col = e.tipo === 'hormiga' ? 'rgba(220,190,120,' : e.tipo === 'jefe' ? 'rgba(210,180,255,' : 'rgba(255,170,90,';
        this.chispa(e.x, e.y, 7, col, 260, 0.35, 700, 2.2);
        if (!E.p.golpeados || !E.p.golpeados.size) this.anillos.push({ x: e.x, y: e.y, r: 4, vr: 300, vida: 0.15, t: 0, color: 'rgba(255,255,255,' });   // (con tajo ya lleva el del impacto)
        break;
      }
      case 'muere': {
        // el cuerpo no desaparece: sale con el empujon del golpe, cae, rebota y se deshace en Podredumbre
        // (la espora revienta). Los restos viven aqui, en el dibujo: la simulacion ya lo ha quitado
        this.chispa(e.x, e.y, e.tipo === 'espora' ? 34 : 18, 'rgba(226,121,43,', 200, 1.1, -30, 2.8);
        this.polvo(e.x, e.y + 10, 6, '#4a4038', 30, 50);
        if (e.en && e.tipo !== 'espora') {
          const en = { ...e.en, rx: null }, d = e.dir || 1;
          const tumba = e.tipo === 'tallo';
          this.restos.push({ en, tipo: e.tipo, t: 0, vx: tumba ? 0 : en.vx * 0.9 || d * 300, vy: tumba ? 0 : -340, rot: 0, vrot: tumba ? d * 3 : d * (7 + R() * 3), suelo: false, rebotes: 0, alfa: 1, d });
        } else this.anillos.push({ x: e.x, y: e.y, r: 8, vr: 420, vida: 0.25, t: 0, color: 'rgba(255,170,90,' });
        break;
      }
      case 'hormiga_huye':
        this.chispa(e.x, e.y, 10, 'rgba(220,190,120,', 200, 0.4, 600);
        this.polvo(e.x, e.y + 18, 4, z.polvo, 18, 30);
        break;
      case 'dano':
        this.esquirlas(e.x, e.y, 8, 'rgba(255,248,232,');
        break;
      case 'peligro': this.esquirlas(e.x, e.y, 6, 'rgba(180,220,230,'); break;
      case 'vuelve': this.anillos.push({ x: e.x, y: e.y, r: 40, vr: -120, vida: 0.3, t: 0, color: 'rgba(255,248,232,' }); break;
      // el polvo que se suelta del techo y el del golpe, simulados en Blender (polvo_suelo.js)
      case 'aviso_tornillo': if (!this.bocanada('cae_techo', e.x, e.y - T, 0, 1.1, 0.9)) this.avisos.push({ x: e.x, y: e.y, t: 0, vida: 0.75 }); break;
      case 'tornillo_golpe':
        this.chispa(e.x, e.y, 8, 'rgba(255,230,180,', 220, 0.3, 700, 1.6);
        if (!this.bocanada('impacto', e.x, e.y, 0, 1.5 + R() * 0.3, 1)) this.polvo(e.x, e.y, 4, z.polvo, 16, 20);
        this.sacudir(0.05); break;
      case 'derrumbe': if (R() < 0.3) this.polvo(e.x, 0, 1, z.polvo, 60, 0); this.sacudir(0.04); break;
      case 'gigante_cae': if (!this.bocanada('derrumbe', e.x, e.y, 0, 1.9, 1)) this.polvo(e.x, e.y, 26, z.polvo, 140, 90); this.sacudir(0.6); break;
      case 'trampa': this.sacudir(0.2); break;
      case 'hunde': this.esquirlas(e.x, e.y + 4, 6, 'rgba(90,100,110,'); if (!this.bocanada('impacto', e.x, e.y + 4, 0, 0.9, 0.9)) this.polvo(e.x, e.y, 5, z.polvo, 30, 10); break;
      case 'cruje': this.chispa(e.x, e.y, 4, rgba(z.polvo, 1).replace(/,1\)$/, ','), 60, 0.4, 600, 1.4); break;
      case 'tele':
        this.rayos.push({ x0: e.x0, x1: e.x1, y: e.y, t: 0, vida: 0.22 });
        this.chispa(e.x1, e.y, 14, 'rgba(200,232,255,', 160, 0.45, 0, 1.8); break;
      case 'empuje': {
        // el empujon sale de detras del 18: un disco de aire de canto (perpendicular a donde va) que se queda
        // atras, un cono de motas de luz hacia atras y un anillo pequeno en el cuerpo
        const dx = e.dx ?? 0, dy = e.dy ?? -1, bx = e.x - dx * 20, by = e.y - dy * 20;
        const ang = Math.atan2(dy, dx) + Math.PI / 2;
        this.anillos.push({ x: bx, y: by, r: 5, vr: 110, vida: 0.32, t: 0, plano: 0.3, ang, vx: -dx * 60, vy: -dy * 60, grosor: 0.6, alfa: 0.75, color: 'rgba(215,236,255,' });
        this.anillos.push({ x: bx, y: by, r: 3, vr: 70, vida: 0.42, t: 0, plano: 0.34, ang, vx: -dx * 120, vy: -dy * 120, grosor: 0.45, alfa: 0.6, color: 'rgba(160,210,255,' });
        const atras = Math.atan2(-dy, -dx);
        for (let k = 0; k < 18; k++) {
          const a = atras + (R() - 0.5) * 1.2, v = 60 + R() * 170;
          this.p.push({ x: bx + (R() - 0.5) * 8, y: by + (R() - 0.5) * 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.6 + R() * 0.6, t: 0, color: R() < 0.55 ? 'rgba(235,246,255,' : 'rgba(160,210,255,', g: 0, tam: 1.3 + R() * 1.5, tipo: 'estela' });
        }
        break;
      }
      case 'choca_gz': {
        // contra una pared sin gravedad: un anillo plano pegado a la pared y motas que resbalan por ella
        const f = Math.min(1, e.v / 400), tx = -e.ny, ty = e.nx;
        this.anillos.push({ x: e.x, y: e.y, r: 4, vr: 70 + 90 * f, vida: 0.3, t: 0, plano: 0.28, ang: Math.atan2(ty, tx), grosor: 0.6, alfa: 0.75, color: 'rgba(215,236,255,' });
        for (let k = 0; k < 6 + 10 * f; k++) {
          const s = R() < 0.5 ? -1 : 1, v = 40 + R() * 140 * f, n = 10 + R() * 40 * f;
          this.p.push({ x: e.x, y: e.y, vx: tx * s * v + e.nx * n, vy: ty * s * v + e.ny * n, vida: 0.5 + R() * 0.5, t: 0, color: R() < 0.5 ? 'rgba(235,246,255,' : 'rgba(160,210,255,', g: 0, tam: 1.2 + R() * 1.2, tipo: 'estela' });
        }
        this.sacudir(0.06 * f);
        break;
      }
      case 'engancha': this.chispa(e.x, e.y, 6, 'rgba(255,230,180,', 120, 0.3, 300, 1.6); break;
      case 'sube': this.polvo(e.x, e.y, 5, z.polvo, 16, 20); break;
      case 'despierta_zorro':
        for (let k = 0; k < 4; k++) this.anillos.push({ x: e.x, y: e.y, r: 10 + k * 20, vr: 380 + k * 80, vida: 0.8, t: 0, color: 'rgba(200,232,255,' });
        this.chispa(e.x, e.y, 60, 'rgba(220,240,255,', 360, 1.2, 0, 2.5); break;
      case 'control': for (let k = 0; k < 2; k++) this.anillos.push({ x: e.x, y: e.y - 6, r: 6, vr: 120 + k * 60, vida: 0.6, t: 0, color: 'rgba(169,205,230,' }); this.chispa(e.x, e.y - 10, 20, 'rgba(200,228,245,', 90, 1.2, -60, 1.6); break;
      case 'cura': this.chispa(e.x, e.y - 10, 10, 'rgba(255,248,232,', 70, 0.9, -80, 1.6); break;
      case 'dosis': this.chispa(e.x, e.y, 14, 'rgba(255,248,232,', 120, 0.7, -60, 1.8); break;
      case 'habilidad': this.destello = Math.max(this.destello, 0.5); this.anillos.push({ x: E.p.x + 11, y: E.p.y + 25, r: 10, vr: 400, vida: 0.6, t: 0, color: 'rgba(255,248,232,' }); this.chispa(E.p.x + 11, E.p.y + 25, 30, 'rgba(255,248,232,', 220, 1, 0, 2); break;
      case 'escupe': this.chispa(e.x, e.y, 6, 'rgba(226,121,43,', 80, 0.4, 0, 1.6); break;
      case 'tallos_caen': for (const en of E.enemigos) if (en.tipo === 'tallo') this.chispa(en.x + 15, en.y + 20, 30, 'rgba(226,121,43,', 160, 1.4, 120, 2); this.sacudir(0.25); break;
      case 'objeto_rompe': this.chispa(e.x, e.y, 10, 'rgba(220,225,230,', 220, 0.4, 600, 1.6); break;
      case 'objeto_cae': if (!this.bocanada('impacto', e.x + 10, e.y + 16, 0, 0.6, 0.85)) this.polvo(e.x + 10, e.y + 16, 3, z.polvo, 10, 10); break;
      // el autobus que se arrastra hacia la izquierda empuja la tierra por delante (hacia -X) y la levanta
      case 'bus_arrastra': if (!this.bocanada('arrastre', e.x + 10, e.y, 1, 2.0 + R() * 0.4, 1)) this.polvo(e.x + 10, e.y, 6, z.polvo, 40, 30); this.sacudir(0.06); break;
      case 'bus_libre': if (!this.bocanada('derrumbe', e.x, e.y + 120, 0, 2.0, 1)) this.polvo(e.x, e.y + 120, 30, z.polvo, 300, 60); this.sacudir(0.4); break;
      case 'rejilla_abre': this.polvo(e.x, e.y, 14, z.polvo, 40, 60); this.chispa(e.x, e.y - 40, 20, 'rgba(169,205,230,', 160, 0.8, 100, 1.8); break;
      case 'jefe_aterriza': if (!this.bocanada('derrumbe', e.x, e.y, 0, 1.4, 1, '#8c8296')) this.polvo(e.x, e.y, 22, '#8c8296', 180, 60); this.sacudir(0.45); break;
      case 'jefe_rebota': {
        // la daga contra el cristal: chispas frias que saltan hacia el 18 y la estrella; no hay corte (no entra)
        const atras = (e.cara || 1) > 0 ? Math.PI : 0;
        this.rayas(e.x, e.y, 14, atras, 1.6, 'rgba(190,245,240,', 700, 0.18, 1.7);
        this.chispa(e.x, e.y, 6, 'rgba(180,240,235,', 220, 0.3, 700, 1.8);
        this.estrellas.push({ x: e.x, y: e.y, t: 0, vida: 0.12, r: 24, giro: R() * 0.8 });
        this.anillos.push({ x: e.x, y: e.y, r: 4, vr: 260, vida: 0.15, t: 0, color: 'rgba(200,250,245,' });
        break;
      }
      case 'jefe_choca': if (!this.bocanada('impacto', e.x, e.y + 40, 0, 1.6, 1, '#8c8296')) this.polvo(e.x, e.y + 40, 16, '#8c8296', 60, 80); this.sacudir(0.4); break;
      case 'jefe_tajo': this.sacudir(0.1); break;
      case 'jefe_clava': this.sacudir(0.2); break;
      case 'cristal_sale': this.esquirlas(e.x, e.y, 5, 'rgba(180,240,235,'); break;
      case 'jefe_vencido':
        this.chispa(e.x, e.y, 40, 'rgba(210,180,255,', 260, 1.2, 200, 2.4);
        this.rayas(e.x, e.y, 30, 0, Math.PI * 2, 'rgba(228,208,255,', 1000, 0.3, 2.2);
        for (let k = 0; k < 3; k++) this.anillos.push({ x: e.x, y: e.y, r: 10, vr: 500 + k * 260, vida: 0.45, t: 0, color: 'rgba(240,228,255,' });
        break;
      case 'ruedo_cierra': this.sacudir(0.3); break;
      case 'muere_18': this.esquirlas(e.x, e.y, 20, 'rgba(255,248,232,'); break;
    }
  }

  // dt: el de los efectos (main.js lo frena en el paron y la camara lenta); real: el del reloj, para la
  // camara del golpe y el temblor de los cuerpos (que siguen vivos con la imagen parada)
  actualizar(dt, E, cam, t, real = dt) {
    const parado = this.paron > 0;
    this.destello = Math.max(0, this.destello - dt * 2.5);
    this.cam.actualizar(real, parado);
    for (const en of E.enemigos) if (en.rx) animarCuerpo(en, real, parado);
    if (E.jefe && E.jefe.rx) animarCuerpo(E.jefe, real, parado);
    this.moverRestos(dt, E);
    for (const a of this.cortes) a.t += dt;
    this.cortes = this.cortes.filter((a) => a.t < a.vida);
    for (const a of this.estrellas) a.t += dt;
    this.estrellas = this.estrellas.filter((a) => a.t < a.vida);
    if (this.racha) { this.racha.t += dt; if (this.racha.fin) { this.racha.salir = (this.racha.salir || 0) + dt; if (this.racha.salir > 0.4) this.racha = null; } }
    for (const q of this.p) {
      q.t += dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.tipo === 'nube') { q.vx *= Math.exp(-3 * dt); q.vy *= Math.exp(-2 * dt); }
      else if (q.tipo === 'raya') { const a = Math.exp(-7 * dt); q.vx *= a; q.vy *= a; }
      else if (q.tipo === 'estela') { const a = Math.exp(-2.6 * dt); q.vx *= a; q.vy *= a; }
      else if (q.tipo === 'magia' && q.by !== undefined) {
        // las motas de la zona vuelven a su deriva despues de que el 18 las aparte
        const a = 1 - Math.exp(-1.4 * dt);
        q.vx += (q.bx - q.vx) * a; q.vy += (q.by - q.vy) * a;
      }
      if (q.giro !== undefined) q.giro += q.vg * dt;
    }
    this.p = this.p.filter((q) => q.t < q.vida);
    for (const a of this.tajos) a.t += dt;
    this.tajos = this.tajos.filter((a) => a.t < a.vida);
    for (const a of this.anillos) { a.t += dt; a.r = Math.max(0, a.r + a.vr * dt); if (a.vx) { a.x += a.vx * dt; a.y += a.vy * dt; } }
    this.anillos = this.anillos.filter((a) => a.t < a.vida);
    for (const r of this.rayos) r.t += dt;
    this.rayos = this.rayos.filter((r) => r.t < r.vida);
    for (const a of this.avisos) {
      a.t += dt;
      if (R() < 0.6) this.p.push({ x: a.x + (R() - 0.5) * 10, y: a.y, vx: (R() - 0.5) * 10, vy: 120 + R() * 120, vida: 0.9, t: 0, color: rgba(this.z.polvo, 1).replace(/,1\)$/, ','), g: 200, tam: 1.6, tipo: 'punto' });
    }
    this.avisos = this.avisos.filter((a) => a.t < a.vida);
    // ambiente: polvo, ceniza o motas magicas dentro de la vista
    const n = this.zona === 'plaza' ? 3 : this.zona === 'ciudad' ? 2 : 1;
    for (let k = 0; k < n; k++) {
      if (R() > 0.5) continue;
      const x = cam.x + R() * cam.w, y = cam.y + R() * cam.h;
      if (this.zona === 'ciudad') this.p.push({ x, y: cam.y - 4, vx: 10 + R() * 20, vy: 18 + R() * 20, vida: 9, t: 0, color: 'rgba(80,76,70,', g: 0, tam: 1.4 + R(), tipo: 'ceniza' });
      else this.p.push({ x, y, vx: (R() - 0.5) * 6, vy: (R() - 0.5) * 6 - 2, vida: 4 + R() * 3, t: 0, color: rgba(this.z.polvo, 1).replace(/,1\)$/, ','), g: 0, tam: 1.1 + R() * 0.8, tipo: 'mota' });
    }
    for (const zz of E.zonas) {
      if (R() < 0.7) { const vx = (R() - 0.5) * 8, vy = -20 - R() * 30; this.p.push({ x: zz.x + R() * zz.w, y: zz.y + zz.h, vx, vy, bx: vx, by: vy, vida: 6, t: 0, color: R() < 0.5 ? 'rgba(233,245,255,' : 'rgba(143,199,255,', g: 0, tam: 1.4 + R() * 1.6, tipo: 'magia' }); }
    }
    // el 18 flotando: estela de luz mientras va deprisa, alguna mota que se suelta del bajo de la capa, y
    // aparta el aire (las motas de la zona se van con el y se abren a su paso)
    const p = E.p;
    if (p && p.gz) {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2, sp = Math.hypot(p.vx, p.vy);
      if (sp > 160 && R() < Math.min(1, sp / 320)) this.p.push({ x: cx + (R() - 0.5) * 10, y: cy + (R() - 0.5) * 22, vx: -p.vx * 0.08 + (R() - 0.5) * 14, vy: -p.vy * 0.08 + (R() - 0.5) * 14, vida: 0.7 + R() * 0.6, t: 0, color: R() < 0.5 ? 'rgba(235,246,255,' : 'rgba(160,210,255,', g: 0, tam: 1.1 + R() * 1.3, tipo: 'estela' });
      if (R() < 0.08) { const vx = (R() - 0.5) * 16, vy = (R() - 0.5) * 16 - 6; this.p.push({ x: cx - p.cara * 6 + (R() - 0.5) * 16, y: p.y + p.h - 6, vx, vy, bx: vx, by: vy, vida: 2 + R() * 1.5, t: 0, color: R() < 0.5 ? 'rgba(240,248,255,' : 'rgba(170,215,255,', g: 0, tam: 1.1 + R() * 1.1, tipo: 'magia' }); }
      for (const q of this.p) {
        if (q.tipo !== 'magia' || q.by === undefined) continue;
        const dx = q.x - cx, dy = q.y - cy, d2 = dx * dx + dy * dy;
        if (d2 > 4900) continue;
        const f = (1 - Math.sqrt(d2) / 70) * dt * 3;
        q.vx += (p.vx * 0.9 + dx * 1.5) * f; q.vy += (p.vy * 0.9 + dy * 1.5) * f;
      }
    }
    if (this.p.length > 1400) this.p.splice(0, this.p.length - 1400);
  }

  // Los enemigos muertos: el soldado sale volando con el empujon, gira, da contra el suelo (polvo, un golpe
  // sordo y algo de sacudida si cae fuerte), rebota menos cada vez y se queda tumbado; el tallo se dobla
  // por la base y se hunde. A los 1,1 s se deshace en motas de Podredumbre que suben.
  moverRestos(dt, E) {
    for (const r of this.restos) {
      r.t += dt;
      const en = r.en;
      if (r.tipo === 'tallo') {
        r.rot = Math.min(Math.PI / 2, Math.abs(r.rot) + Math.abs(r.vrot) * dt) * Math.sign(r.vrot || 1);
        r.vrot *= 1 + dt * 3;
      } else if (!r.quieto) {
        r.vy = Math.min(r.vy + 1800 * dt, 1000);
        if (moverX(en, E.mundo, r.vx * dt)) { r.vx *= -0.35; r.vrot *= -0.5; }
        const vy = r.vy, by = moverY(en, E.mundo, r.vy * dt);
        if (by < 0) r.vy = 0;
        if (by > 0) {
          if (vy > 240) {
            r.rebotes++;
            const f = Math.min(1, vy / 900);
            this.polvo(en.x + en.w / 2, en.y + en.h, 4 + Math.round(6 * f), this.z.polvo, 30, 30);
            if (r.rebotes === 1) { this.sacudir(0.12 * f); if (this.son) this.son.ev({ t: 'resto_cae', fuerza: f }); }
            r.vy = -vy * 0.32; r.vx *= 0.55; r.vrot *= 0.45;
          } else { r.vy = 0; r.vx *= Math.exp(-14 * dt); if (Math.abs(r.vx) < 8) r.quieto = true; }
        }
        r.rot += r.vrot * dt;
        // tumbado: el giro acaba de lado (sobre la espalda o la tripa, lo que este mas cerca)
        if (r.rebotes > 0) {
          const lado = Math.round(r.rot / Math.PI - 0.5) * Math.PI + Math.PI / 2;
          r.rot += (lado - r.rot) * Math.min(1, dt * 9);
          r.vrot *= Math.exp(-6 * dt);
        }
      }
      if (r.t > 1.1) {
        r.alfa = Math.max(0, 1 - (r.t - 1.1) / 0.6);
        if (R() < 0.7) this.p.push({ x: en.x + R() * en.w, y: en.y + en.h - R() * 18, vx: (R() - 0.5) * 20, vy: -30 - R() * 50, vida: 0.9 + R() * 0.6, t: 0, color: 'rgba(226,121,43,', g: -40, tam: 1.4 + R() * 1.6, tipo: 'punto' });
      }
    }
    this.restos = this.restos.filter((r) => r.alfa > 0);
  }

  dibujar(c, E, t, s) {
    const p = E.p;
    for (const r of this.restos) dibujarResto(c, r, t, s);
    // tajos: media luna blanca calida (zorro: azul palido y con zarpas)
    for (const a of this.tajos) {
      if (a.t < 0) continue;
      const k = a.t / a.vida;
      c.save();
      c.translate(p.x + p.w / 2, p.y + p.h / 2);
      if (a.dir === 'sunikel') {
        c.globalCompositeOperation = 'lighter';
        if (p.cara < 0) c.scale(-1, 1);
        c.rotate(-0.5 + a.k * 0.5);
        for (let q = 0; q < 3; q++) {
          c.beginPath(); c.moveTo(-30, -18 + q * 12); c.quadraticCurveTo(10, -26 + q * 12, 52, -6 + q * 14);
          c.lineWidth = 6 * (1 - k); c.strokeStyle = `rgba(210,235,255,${0.9 - k})`; c.lineCap = 'round'; c.stroke();
        }
        c.restore(); continue;
      }
      const rot = a.dir === 'arriba' ? -Math.PI / 2 : a.dir === 'abajo' ? Math.PI / 2 : p.cara < 0 ? Math.PI : 0;
      c.rotate(rot);
      if (a.dir !== 'lado' && p.cara < 0) c.scale(1, -1);
      // media luna: gruesa en medio y afilada en las puntas, que barre de arriba abajo, con dos ecos que
      // se quedan atras (la estela del filo); el remate es mas grande y lleva un segundo filo
      const r1 = (J.alcance + (a.zorro ? 14 : 2)) * (a.remata ? 1.22 : 1);
      const ab = a.remata ? 1.35 : 1.15;
      const sentido = a.alterna && a.dir === 'lado' ? -1 : 1;
      const barrido = (-0.5 + Math.min(1, k * 1.4)) * sentido;
      if (sentido < 0) c.scale(1, -1);
      const col = a.zorro ? '205,232,255' : '255,249,236';
      for (let e = 2; e >= 0; e--) {
        const fe = e === 0 ? 1 : 0.3 / e;
        c.save();
        c.rotate((barrido - e * 0.16 * sentido) * 0.5);
        c.beginPath();
        c.arc(0, 0, r1, -ab, ab);
        c.arc(r1 * 0.3, 0, r1 * 0.78, ab * 0.92, -ab * 0.92, true);
        c.closePath();
        const g = c.createLinearGradient(0, 0, r1, 0);
        g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.7, `rgba(${col},${0.55 * (1 - k) * fe})`); g.addColorStop(1, `rgba(${col},${(1 - k * 0.9) * fe})`);
        c.fillStyle = g; c.fill();
        if (e === 0) {
          c.lineWidth = 1.6; c.strokeStyle = `rgba(11,10,12,${0.55 - k * 0.55})`;
          c.beginPath(); c.arc(0, 0, r1, -ab, ab); c.stroke();
          // el brillo del filo: una linea fina blanca por dentro del arco
          c.globalCompositeOperation = 'lighter';
          c.lineWidth = a.remata ? 2.4 : 1.6; c.strokeStyle = `rgba(255,252,244,${0.9 * (1 - k)})`;
          c.beginPath(); c.arc(0, 0, r1 - 3, -ab * 0.8, ab * 0.8); c.stroke();
          if (a.remata) { c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, r1 + 8, -ab * 0.6, ab * 0.6); c.stroke(); }
        }
        c.restore();
      }
      c.restore();
    }
    for (const r of this.rayos) {
      const k = r.t / r.vida;
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(r.x0, 0, r.x1, 0);
      g.addColorStop(0, 'rgba(200,232,255,0)'); g.addColorStop(1, `rgba(220,240,255,${0.8 - k * 0.8})`);
      c.fillStyle = g; c.fillRect(Math.min(r.x0, r.x1), r.y - 10 + k * 6, Math.abs(r.x1 - r.x0), 20 - k * 12);
      c.restore();
    }
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const a of this.anillos) {
      const k = a.t / a.vida;
      c.beginPath();
      if (a.plano) c.ellipse(a.x, a.y, Math.max(0.1, a.r), Math.max(0.1, a.r * a.plano), a.ang || 0, 0, 7);   // de canto
      else c.arc(a.x, a.y, a.r, 0, 7);
      c.lineWidth = (3 * (1 - k) + 0.5) * (a.grosor ?? 1); c.strokeStyle = a.color + (1 - k) * (a.alfa ?? 1) + ')'; c.stroke();
    }
    c.restore();
    // el corte: una raya blanca que se abre de golpe y adelgaza, con su sombra de tinta
    for (const a of this.cortes) {
      if (a.t < 0) continue;
      const k = a.t / a.vida, L = a.largo * Math.min(1, k * 5) * 0.5, w = a.ancho * (1 - k);
      c.save(); c.translate(a.x, a.y); c.rotate(a.ang);
      c.fillStyle = `rgba(11,10,12,${0.5 * (1 - k)})`;
      c.beginPath(); c.moveTo(-L - 4, 1.5); c.lineTo(0, w / 2 + 2.5); c.lineTo(L + 4, 1.5); c.lineTo(0, -w / 2 + 0.5); c.fill();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(255,252,244,${1 - k * 0.7})`;
      c.beginPath(); c.moveTo(-L, 0); c.lineTo(0, w / 2); c.lineTo(L, 0); c.lineTo(0, -w / 2); c.fill();
      c.restore();
    }
    // la estrella del contacto: cuatro puntas que giran y se apagan en seis fotogramas
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const a of this.estrellas) {
      const k = a.t / a.vida, r = a.r * (0.6 + k * 0.6), w = a.r * 0.16 * (1 - k);
      c.save(); c.translate(a.x, a.y); c.rotate(a.giro + k * 0.6);
      c.fillStyle = `rgba(255,252,244,${1 - k})`;
      for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0, -w); c.lineTo(r * (i % 2 ? 0.6 : 1), 0); c.lineTo(0, w); c.fill(); }
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.7);
      g.addColorStop(0, `rgba(255,250,235,${0.8 * (1 - k)})`); g.addColorStop(1, 'rgba(255,250,235,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 0.7, 0, 7); c.fill();
      c.restore();
    }
    c.restore();
    for (const q of this.p) {
      const k = q.t / q.vida;
      if (q.tipo === 'bocanada') { dibujarBocanada(c, q); continue; }
      if (q.tipo === 'raya') {
        // chispa estirada por su velocidad: halo del color del material y nucleo blanco
        const v = Math.hypot(q.vx, q.vy) || 1, l = Math.min(26, v * 0.03) + q.tam, a = (1 - k) * (1 - k);
        c.save(); c.globalCompositeOperation = 'lighter'; c.translate(q.x, q.y); c.rotate(Math.atan2(q.vy, q.vx));
        c.fillStyle = q.color + a * 0.8 + ')'; c.fillRect(-l, -q.tam * 0.75, l, q.tam * 1.5);
        c.fillStyle = `rgba(255,252,244,${a})`; c.fillRect(-l * 0.6, -q.tam * 0.3, l * 0.6, q.tam * 0.6);
        c.restore();
        continue;
      }
      if (q.tipo === 'tinta') {
        // gota de tinta estirada por su velocidad
        const v = Math.hypot(q.vx, q.vy) || 1, l = Math.min(10, v * 0.018) + q.tam;
        c.save(); c.translate(q.x, q.y); c.rotate(Math.atan2(q.vy, q.vx));
        c.fillStyle = `rgba(11,10,12,${Math.min(1, (1 - k) * 2)})`;
        c.beginPath(); c.ellipse(0, 0, l / 2, q.tam / 2, 0, 0, 7); c.fill();
        c.restore();
        continue;
      }
      if (q.tipo === 'nube') {
        c.fillStyle = rgba(q.color, 0.28 * (1 - k));
        c.beginPath(); c.arc(q.x, q.y, q.tam * (1 + k * 1.5), 0, 7); c.fill();
      } else if (q.tipo === 'esquirla') {
        c.save(); c.translate(q.x, q.y); c.rotate(q.giro);
        c.fillStyle = q.color + (1 - k) + ')'; c.fillRect(-q.tam / 2, -q.tam / 4, q.tam, q.tam / 2);
        c.restore();
      } else if (q.tipo === 'ceniza') {
        c.fillStyle = q.color + Math.min(1, (1 - k) * 2) * 0.7 + ')';
        c.fillRect(q.x + Math.sin(t + q.vida * 9) * 6, q.y, q.tam, q.tam);
      } else {
        const a = q.tipo === 'mota' ? Math.sin(k * Math.PI) * 0.5 : q.tipo === 'magia' ? Math.sin(k * Math.PI) * 0.9 : (1 - k);
        if (q.tipo === 'magia' || q.tipo === 'estela' || q.color.startsWith('rgba(255,248') || q.color.startsWith('rgba(2')) c.globalCompositeOperation = 'lighter';
        c.fillStyle = q.color + a + ')';
        const x = q.tipo === 'magia' ? q.x + Math.sin(t * 1.3 + q.vida * 7 + q.y * 0.02) * 6 : q.x;
        c.fillRect(x - q.tam / 2, q.y - q.tam / 2, q.tam, q.tam);
        c.globalCompositeOperation = 'source-over';
      }
    }
    this.dibujarRacha(c, E);
  }

  // la racha de aciertos sobre el 18: la cifra salta al subir y crece un poco con la racha
  dibujarRacha(c, E) {
    const r = this.racha;
    if (!r) return;
    const p = E.p, sale = r.salir ? Math.max(0, 1 - r.salir / 0.4) : 1;
    const pop = 1 + Math.max(0, 0.6 - r.t * 5);
    const tam = Math.min(30, 17 + r.n * 0.8) * pop;
    c.save();
    // encima de la cabeza y hacia atras, para no tapar al enemigo que tiene delante
    c.translate(p.x + p.w / 2 - p.cara * 34, p.y - 22 - (1 - sale) * 14);
    c.rotate(-0.08);
    c.textAlign = 'center';
    c.globalAlpha = sale;
    c.font = `italic 700 ${tam}px Georgia, serif`;
    c.textBaseline = 'alphabetic';
    const txt = '×' + r.n;
    c.lineJoin = 'round'; c.lineWidth = 4.5; c.strokeStyle = TINTA; c.strokeText(txt, 0, 0);
    c.fillStyle = r.n >= 10 ? '#dff0ff' : '#fff8e8'; c.fillText(txt, 0, 0);
    // raya de tinta debajo que se alarga con la racha
    const ancho = Math.min(60, 10 + r.n * 4);
    c.fillStyle = TINTA; c.fillRect(-ancho / 2 - 1, 5, ancho + 2, 4);
    c.fillStyle = '#fff8e8'; c.fillRect(-ancho / 2, 6, ancho * Math.max(0, 1 - r.t / J.rachaT), 2);
    c.restore();
  }
}
