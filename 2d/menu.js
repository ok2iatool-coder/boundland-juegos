// Pantallas fuera del juego, sin imagenes: el titulo (la sala a oscuras con una lampara por opcion: la
// elegida se enciende y el 18 va hasta su luz; dibujo/titulo.js), los niveles, los ajustes, la pausa y el
// final de esta parte.
import { NIVELES } from './sim/niveles.js';
import { SERIF, LETRA, espaciado } from './hud.js';
import { EscenaTitulo } from './dibujo/titulo.js';
import { Cursor } from './dibujo/cursor.js';

const TXT = {
  en: { seguir: 'CONTINUE', nueva: 'NEW GAME', niveles: 'LEVELS', ajustes: 'SETTINGS', volver: 'Back', general: 'Volume', musica: 'Music', efectos: 'Effects', idioma: 'Language', bloqueado: 'Not reached yet', controles: 'A D move · SPACE jump · E interact · LEFT CLICK / J strike · RIGHT CLICK / K throw · F fox · Esc pause', fin1: 'END OF PART TWO', fin2: 'The forest is waiting. So is 17.', fin3: 'Press any key', seguro: 'Start a new game? Your progress will be lost.', si: 'Yes', no: 'No' },
  es: { seguir: 'CONTINUAR', nueva: 'PARTIDA NUEVA', niveles: 'NIVELES', ajustes: 'AJUSTES', volver: 'Volver', general: 'Volumen', musica: 'Música', efectos: 'Efectos', idioma: 'Idioma', bloqueado: 'Aún no has llegado', controles: 'A D moverse · ESPACIO saltar · E usar · CLIC IZQ. / J golpear · CLIC DER. / K lanzar · F zorro · Esc pausa', fin1: 'FIN DE LA SEGUNDA PARTE', fin2: 'El bosque espera. Y el 17 también.', fin3: 'Pulsa cualquier tecla', seguro: '¿Empezar de nuevo? Se pierde lo avanzado.', si: 'Sí', no: 'No' },
};
export { TXT as TXT_MENU };

// Botones en pantalla: [{id, x, y, w, h, texto}]; el raton y el teclado eligen entre ellos
export class Menu {
  constructor(app) { this.app = app; this.pantalla = 'titulo'; this.sel = 0; this.selTitulo = 0; this.espera = null; this.botones = []; this.t = 0; this.fondo = new EscenaTitulo(); this.cursor = new Cursor(); this.W = 1; this.H = 1; }
  // al volver al titulo sigue encendida la lampara de la que se salio (ajustes, niveles...)
  abrir(p) {
    if (this.pantalla === 'titulo') this.selTitulo = this.sel;
    if (this.espera) { clearTimeout(this.espera); this.espera = null; }
    this.pantalla = p; this.sel = p === 'titulo' ? this.selTitulo : 0;
  }

  opcionesTitulo() {
    const a = this.app, L = TXT[a.ajustes.leng];
    const o = [];
    if (a.progreso.max > 1 || a.progreso.nivel !== 1) o.push({ id: 'seguir', texto: L.seguir });
    o.push({ id: 'nueva', texto: L.nueva }, { id: 'niveles', texto: L.niveles }, { id: 'ajustes', texto: L.ajustes });
    return o;
  }

  opciones() {
    const a = this.app, L = TXT[a.ajustes.leng];
    if (this.pantalla === 'titulo') return this.opcionesTitulo();
    if (this.pantalla === 'confirmar') return [{ id: 'nueva_si', texto: L.si }, { id: 'titulo', texto: L.no }];
    if (this.pantalla === 'niveles') return [...NIVELES.map((n) => ({ id: 'nivel' + n.id, nivel: n, texto: n.titulo[a.ajustes.leng], bloqueado: n.id > a.progreso.max && !a.todos })), { id: 'volver', texto: L.volver }];
    if (this.pantalla === 'ajustes') return [
      { id: 'general', texto: L.general, valor: a.ajustes.general }, { id: 'musica', texto: L.musica, valor: a.ajustes.musica },
      { id: 'efectos', texto: L.efectos, valor: a.ajustes.efectos }, { id: 'leng', texto: L.idioma, valor: a.ajustes.leng === 'es' ? 'Español' : 'English' },
      { id: 'volver', texto: L.volver }];
    if (this.pantalla === 'pausa') {
      const H = a.textos();
      return [{ id: 'reanudar', texto: H.seguir }, { id: 'reiniciar', texto: H.reiniciar }, { id: 'ajustes_p', texto: L.ajustes }, { id: 'niveles', texto: H.niveles }, { id: 'titulo', texto: H.salir }];
    }
    return [];
  }

  tecla(code) {
    const o = this.opciones();
    if (this.pantalla === 'final') { this.app.alTitulo(); return; }
    if (!o.length || this.espera) return;
    const n = o.length;
    const abajo = code === 'ArrowDown' || code === 'KeyS', arriba = code === 'ArrowUp' || code === 'KeyW';
    const der = code === 'ArrowRight' || code === 'KeyD', izq = code === 'ArrowLeft' || code === 'KeyA';
    const enFila = this.pantalla === 'titulo' || this.pantalla === 'confirmar';   // opciones de izquierda a derecha
    const mover = (k) => { if (k !== this.sel) { this.sel = k; this.app.son.ui('mover'); } };
    if (this.pantalla === 'niveles') {
      // rejilla de tarjetas y, debajo, Volver
      const NL = n - 1, C = this.columnasNiveles(NL), fila = Math.floor(this.sel / C);
      if (abajo) mover(this.sel === NL ? this.sel : this.sel + C < NL ? this.sel + C : NL);
      else if (arriba) mover(this.sel === NL ? Math.floor((NL - 1) / C) * C : fila > 0 ? this.sel - C : this.sel);
      else if (der && this.sel < NL - 1) mover(this.sel + 1);
      else if (izq && this.sel > 0 && this.sel < NL) mover(this.sel - 1);
    }
    else if (abajo || (enFila && der)) mover((this.sel + 1) % n);
    else if (arriba || (enFila && izq)) mover((this.sel - 1 + n) % n);
    else if ((der || izq) && this.pantalla === 'ajustes') this.cambiar(o[this.sel], der ? 1 : -1);
    else if (code === 'Enter' || code === 'Space' || code === 'KeyE') this.elegir(o[this.sel]);
    else if (code === 'Escape') this.atras();
  }

  atras() {
    if (this.pantalla === 'pausa') this.app.reanudar();
    else if (this.pantalla === 'ajustes' && this.app.enJuego) this.abrir('pausa');
    else if (this.pantalla === 'niveles' && this.app.enJuego) this.abrir('pausa');
    else this.abrir('titulo');
  }

  cambiar(op, d) {
    const a = this.app;
    if (!op) return;
    if (op.id === 'leng') { a.ajustes.leng = a.ajustes.leng === 'es' ? 'en' : 'es'; a.guardarAjustes(); a.son.ui('mover'); return; }
    if (op.valor === undefined || typeof op.valor !== 'number') return;
    a.ajustes[op.id] = Math.max(0, Math.min(1, Math.round((a.ajustes[op.id] + d * 0.1) * 10) / 10));
    a.son.poner(op.id, a.ajustes[op.id]); a.guardarAjustes(); a.son.ui('mover');
  }

  elegir(op) {
    const a = this.app;
    if (!op || this.espera) return;
    a.son.ui('elegir');
    // en el titulo la lampara da un fogonazo y el 18 un respingo antes de ir a donde sea
    if (this.pantalla === 'titulo') {
      this.fondo.confirmar();
      this.espera = setTimeout(() => { this.espera = null; this.hacer(op); }, 280);
      return;
    }
    this.hacer(op);
  }

  hacer(op) {
    const a = this.app;
    if (op.id === 'seguir') a.empezar(a.progreso.nivel);
    else if (op.id === 'nueva') { if (a.progreso.max > 1) this.abrir('confirmar'); else a.nuevaPartida(); }
    else if (op.id === 'nueva_si') a.nuevaPartida();
    else if (op.id === 'niveles') this.abrir('niveles');
    else if (op.id === 'ajustes' || op.id === 'ajustes_p') this.abrir('ajustes');
    else if (op.id === 'volver') this.atras();
    else if (op.id === 'titulo') a.alTitulo();
    else if (op.id === 'reanudar') a.reanudar();
    else if (op.id === 'reiniciar') a.reiniciarControl();
    else if (op.id === 'leng') this.cambiar(op, 1);
    else if (op.id.startsWith('nivel') && !op.bloqueado) a.empezar(op.nivel.id);
  }

  raton(x, y, clic) {
    this.fondo.raton(x, y, this.W, this.H);
    if (clic) this.cursor.pulsar(x, y); else this.cursor.mover(x, y);
    if (this.espera) return true;
    for (let k = 0; k < this.botones.length; k++) {
      const b = this.botones[k];
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
        if (this.sel !== b.k) { this.sel = b.k; this.app.son.ui('mover'); }
        if (clic) {
          const o = this.opciones()[b.k];
          if (this.pantalla === 'ajustes' && typeof o.valor === 'number') this.cambiar(o, x > b.x + b.w * 0.6 ? 1 : -1);
          else this.elegir(o);
        }
        return true;
      }
    }
    if (clic && this.pantalla === 'final') this.app.alTitulo();
    return false;
  }

  // ---------------------------------------------------------------- dibujo
  dibujar(c, W, H, u, t, S, fondoJuego) {
    this.pantallas(c, W, H, u, t, S, fondoJuego);
    // el cursor va encima de todo; se cierra si hay un boton debajo (se mira cada fotograma: la pantalla
    // puede cambiar con el raton quieto)
    const k = this.cursor, encima = k.visible && this.botones.some((b) => k.x > b.x && k.x < b.x + b.w && k.y > b.y && k.y < b.y + b.h);
    k.dibujar(c, u, t, encima);
  }

  pantallas(c, W, H, u, t, S, fondoJuego) {
    this.t = t; this.W = W; this.H = H;
    const a = this.app, L = TXT[a.ajustes.leng];
    this.botones = [];
    if (this.pantalla === 'pausa' || (fondoJuego && (this.pantalla === 'ajustes' || this.pantalla === 'niveles'))) {
      c.fillStyle = 'rgba(3,3,6,.78)'; c.fillRect(0, 0, W, H);
    } else if (this.pantalla === 'final') { this.final(c, W, H, u, t, L); return; }
    else {
      // la sala del titulo, con su lampara encendida (en niveles, ajustes y confirmar, la de la opcion que llevo ahi)
      const tit = this.opcionesTitulo();
      this.fondo.opciones = tit;
      if (this.pantalla === 'titulo' && this.sel >= tit.length) this.sel = 0;
      this.fondo.sel = Math.min(tit.length - 1, this.pantalla === 'titulo' ? this.sel : this.selTitulo);
      this.fondo.conRotulos = this.pantalla === 'titulo';   // los nombres del suelo solo en el titulo
      this.fondo.dibujar(c, W, H, u, t, S, this.cursor);
      // en niveles y ajustes la sala queda detras, velada
      if (this.pantalla === 'niveles' || this.pantalla === 'ajustes') { c.fillStyle = 'rgba(3,4,7,.62)'; c.fillRect(0, 0, W, H); }
    }

    const o = this.opciones();
    if (this.pantalla === 'titulo' || this.pantalla === 'confirmar') {
      this.logo(c, W, H, u, t);
      // las opciones son las lamparas: se elige con el raton en su columna de luz (los nombres van pintados
      // en el suelo, los pinta la escena)
      if (this.pantalla === 'titulo') this.fondo.columnas.forEach((b, k) => this.botones.push({ ...b, k }));
      else {
        // empezar de nuevo: una franja a oscuras sobre la sala, con Si y No
        const y = H * 0.5;
        const gr = c.createLinearGradient(0, y - 90 * u, 0, y + 90 * u);
        gr.addColorStop(0, 'rgba(3,4,7,0)'); gr.addColorStop(0.3, 'rgba(3,4,7,.82)'); gr.addColorStop(0.7, 'rgba(3,4,7,.82)'); gr.addColorStop(1, 'rgba(3,4,7,0)');
        c.fillStyle = gr; c.fillRect(0, y - 90 * u, W, 180 * u);
        c.fillStyle = '#efe8da'; c.font = `${17 * u}px ${SERIF}`; c.textAlign = 'center';
        c.fillText(L.seguro, W / 2, y - 14 * u);
        o.forEach((op, k) => this.boton(c, W / 2 + (k ? 1 : -1) * 90 * u, y + 40 * u, op.texto, k, u, t, 150 * u));
      }
      c.fillStyle = 'rgba(239,232,218,.35)'; c.font = `${11 * u}px ${SERIF}`;
      c.textAlign = 'right'; c.fillText('Milbit Studios', W - 20 * u, 24 * u);
    } else if (this.pantalla === 'niveles') {
      c.fillStyle = '#efe8da'; c.textAlign = 'center'; c.font = `${30 * u}px ${SERIF}`;
      espaciado(c, L.niveles, W / 2, H * 0.17, 6 * u);
      // tantas columnas como hagan falta para dos filas; cada fila centrada
      const NL = o.length - 1, C = this.columnasNiveles(NL), sep = 14 * u;
      const cw = Math.min(170 * u, (W - 80 * u) / C - sep), ch = 110 * u;
      o.forEach((op, k) => {
        if (k === NL) { this.boton(c, W / 2, H * 0.84, op.texto, k, u, t, 180 * u); return; }
        const fila = Math.floor(k / C), enFila = Math.min(C, NL - fila * C);
        const x0 = W / 2 - (cw * enFila + sep * (enFila - 1)) / 2;
        const x = x0 + (k % C) * (cw + sep), y = H * 0.27 + fila * (ch + 22 * u);
        this.tarjeta(c, x, y, cw, ch, op, k, u, t, L);
      });
    } else if (this.pantalla === 'ajustes') {
      c.fillStyle = '#efe8da'; c.textAlign = 'center'; c.font = `${30 * u}px ${SERIF}`;
      espaciado(c, L.ajustes, W / 2, H * 0.22, 6 * u);
      o.forEach((op, k) => {
        const y = H * 0.34 + k * 52 * u;
        if (op.id === 'volver') { this.boton(c, W / 2, y + 16 * u, op.texto, k, u, t, 180 * u); return; }
        this.deslizador(c, W / 2, y, op, k, u, t);
      });
      // los controles (antes en el titulo)
      c.fillStyle = 'rgba(239,232,218,.42)'; c.font = `${11 * u}px ${SERIF}`; c.textAlign = 'center';
      c.fillText(L.controles, W / 2, H - 26 * u);
    } else if (this.pantalla === 'pausa') {
      c.fillStyle = '#efe8da'; c.textAlign = 'center'; c.font = `${34 * u}px ${SERIF}`;
      espaciado(c, a.textos().pausa, W / 2, H * 0.3, 8 * u);
      o.forEach((op, k) => this.boton(c, W / 2, H * 0.42 + k * 46 * u, op.texto, k, u, t, 300 * u));
    }
  }

  columnasNiveles(NL) { return NL > 10 ? Math.ceil(NL / 2) : 5; }

  logo(c, W, H, u, t) {
    // BOUNDLAND: letras de chapa que flotan despacio (GDD), arriba en el centro, sobre el carril de las lamparas
    const txt = 'BOUNDLAND';
    const cx = W / 2;
    c.save();
    c.font = `${74 * u}px ${SERIF}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const sp = 12 * u;
    const ancho = [...txt].reduce((s, ch) => s + c.measureText(ch).width + sp, -sp);
    let x = cx - ancho / 2;
    const y = H * 0.215;
    const fase = (t % 8) / 8, barrido = x - 120 * u + (fase / 0.35) * (ancho + 240 * u);
    // halo frio detras del nombre, para que salga de la sala
    const hl = c.createRadialGradient(cx, y - 22 * u, 0, cx, y - 22 * u, ancho * 0.62);
    hl.addColorStop(0, 'rgba(120,150,185,.10)'); hl.addColorStop(1, 'rgba(120,150,185,0)');
    c.save(); c.translate(cx, y - 22 * u); c.scale(1, 0.38); c.translate(-cx, -(y - 22 * u)); c.fillStyle = hl; c.fillRect(cx - ancho, y - 22 * u - ancho, ancho * 2, ancho * 2); c.restore();
    [...txt].forEach((ch, k) => {
      const dy = Math.sin(t * 0.8 + k * 0.7) * 3 * u, rot = Math.sin(t * 0.6 + k) * 0.02;
      c.save(); c.translate(x, y + dy); c.rotate(rot);
      c.fillStyle = '#0b0a0c'; c.fillText(ch, 3 * u, 3 * u);
      const g = c.createLinearGradient(0, -60 * u, 0, 0);
      g.addColorStop(0, '#cfc6b4'); g.addColorStop(0.55, '#8d8576'); g.addColorStop(1, '#6b5a44');
      c.fillStyle = g; c.fillText(ch, 0, 0);
      c.strokeStyle = 'rgba(11,10,12,.9)'; c.lineWidth = 1.6 * u; c.strokeText(ch, 0, 0);
      c.fillStyle = 'rgba(138,74,42,.35)'; c.fillRect(c.measureText(ch).width * 0.2, -22 * u, 6 * u, 3 * u);
      // un barrido de luz cruza las letras cada pocos segundos
      const bl = barrido - x;
      if (bl > -80 * u && bl < c.measureText(ch).width + 80 * u) {
        const gb = c.createLinearGradient(bl - 46 * u, -50 * u, bl + 46 * u, 10 * u);
        gb.addColorStop(0, 'rgba(255,246,228,0)'); gb.addColorStop(0.5, 'rgba(255,246,228,.42)'); gb.addColorStop(1, 'rgba(255,246,228,0)');
        c.fillStyle = gb; c.fillText(ch, 0, 0);
      }
      c.restore();
      x += c.measureText(ch).width + sp;
    });
    c.strokeStyle = 'rgba(239,232,218,.6)'; c.lineWidth = 1.2 * u;
    c.beginPath(); c.moveTo(cx - ancho / 2, y + 24 * u); c.lineTo(cx + ancho / 2, y + 24 * u); c.stroke();
    c.beginPath(); c.arc(cx, y + 24 * u, 5 * u, 0.3, 6.2); c.stroke();
    c.fillStyle = 'rgba(239,232,218,.6)'; c.font = `italic ${13 * u}px ${SERIF}`; c.textAlign = 'center';
    c.fillText(this.app.ajustes.leng === 'es' ? 'Año 70. El Sujeto 18 despierta.' : 'Year 70. Subject 18 is awake.', cx, y + 50 * u);
    c.restore();
  }

  boton(c, x, y, txt, k, u, t, w) {
    const sel = this.sel === k;
    const h = 34 * u;
    this.botones.push({ x: x - w / 2, y: y - h / 2 - 6 * u, w, h, k });
    c.save();
    c.textAlign = 'center'; c.font = `${18 * u}px ${SERIF}`;
    if (sel) {
      // un lavado de luz detras del elegido
      const lw = w * 0.75, gl = c.createRadialGradient(x, y - 6 * u, 0, x, y - 6 * u, lw);
      gl.addColorStop(0, 'rgba(190,212,240,.13)'); gl.addColorStop(1, 'rgba(190,212,240,0)');
      c.save(); c.translate(x, y - 6 * u); c.scale(1, 0.16); c.translate(-x, -(y - 6 * u)); c.fillStyle = gl; c.fillRect(x - lw, y - 6 * u - lw, lw * 2, lw * 2); c.restore();
    }
    c.fillStyle = sel ? '#fff4e2' : 'rgba(239,232,218,.66)';
    if (sel) { c.shadowColor = 'rgba(255,246,228,.8)'; c.shadowBlur = 12 * u; }
    espaciado(c, txt, x, y, 3 * u);
    c.shadowBlur = 0;
    if (sel) {
      // el circulo de Varga a cada lado
      const m = c.measureText(txt).width / 2 + txt.length * 1.5 * u + 22 * u;
      c.strokeStyle = '#fff4e2'; c.lineWidth = 1.4 * u;
      for (const d of [-1, 1]) { c.beginPath(); c.arc(x + d * m, y - 6 * u, 4.5 * u, t * 2 * d, t * 2 * d + 5.6); c.stroke(); }
    }
    c.restore();
  }

  tarjeta(c, x, y, w, h, op, k, u, t, L) {
    const sel = this.sel === k;
    this.botones.push({ x, y, w, h, k });
    c.save();
    c.fillStyle = sel ? 'rgba(40,50,62,.9)' : 'rgba(18,22,28,.85)'; c.fillRect(x, y, w, h);
    c.strokeStyle = sel ? '#fff4e2' : 'rgba(239,232,218,.25)'; c.lineWidth = (sel ? 1.6 : 1) * u; c.strokeRect(x, y, w, h);
    c.fillStyle = op.bloqueado ? 'rgba(239,232,218,.25)' : sel ? '#fff4e2' : '#efe8da';
    c.font = `${28 * u}px ${SERIF}`; c.textAlign = 'center'; c.fillText(String(op.nivel.id).padStart(2, '0'), x + w / 2, y + 44 * u);
    c.font = `${11 * u}px ${SERIF}`;
    c.fillText(op.bloqueado ? L.bloqueado : op.texto, x + w / 2, y + 76 * u, w - 10 * u);
    const zona = { laboratorio: '#7f97ad', lab: '#7f97ad', linde: '#8fae7a', ciudad: '#d2c7b2', casa: '#b59c78', plaza: '#cfe6ff', hospital: '#9c918b' }[op.nivel.zona] || '#7f97ad';
    c.fillStyle = op.bloqueado ? 'rgba(255,255,255,.08)' : zona; c.fillRect(x + w / 2 - 12 * u, y + h - 16 * u, 24 * u, 2 * u);
    c.restore();
  }

  deslizador(c, x, y, op, k, u, t) {
    const sel = this.sel === k;
    const w = 420 * u;
    this.botones.push({ x: x - w / 2, y: y - 22 * u, w, h: 36 * u, k });
    c.save();
    c.fillStyle = sel ? '#fff4e2' : 'rgba(239,232,218,.65)'; c.font = `${16 * u}px ${SERIF}`; c.textAlign = 'left';
    c.fillText(op.texto, x - w / 2, y);
    if (typeof op.valor === 'number') {
      const bx = x - 20 * u, bw = w / 2 + 20 * u;
      c.strokeStyle = 'rgba(239,232,218,.4)'; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(bx, y - 5 * u); c.lineTo(bx + bw, y - 5 * u); c.stroke();
      c.strokeStyle = sel ? '#fff4e2' : '#efe8da'; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(bx, y - 5 * u); c.lineTo(bx + bw * op.valor, y - 5 * u); c.stroke();
      c.beginPath(); c.arc(bx + bw * op.valor, y - 5 * u, 6 * u, 0, 7); c.fillStyle = c.strokeStyle; c.fill();
      c.textAlign = 'right'; c.font = `${12 * u}px ${SERIF}`; c.fillText(Math.round(op.valor * 100) + ' %', x + w / 2 + 50 * u, y);
    } else { c.textAlign = 'right'; c.fillText('‹  ' + op.valor + '  ›', x + w / 2, y); }
    c.restore();
  }

  final(c, W, H, u, t, L) {
    c.fillStyle = '#050506'; c.fillRect(0, 0, W, H);
    const k = Math.min(1, this.t2 = (this.t2 || 0) + 1 / 60);
    c.save(); c.textAlign = 'center';
    c.globalAlpha = Math.min(1, k);
    // el mapa de Varga con la cruz, a lapiz
    c.strokeStyle = 'rgba(200,200,205,.5)'; c.lineWidth = 1.4 * u;
    c.strokeRect(W / 2 - 70 * u, H * 0.18, 140 * u, 110 * u);
    for (let q = 0; q < 9; q++) { const x = W / 2 - 55 * u + (q % 3) * 40 * u, y = H * 0.2 + Math.floor(q / 3) * 32 * u; c.beginPath(); c.moveTo(x, y + 18 * u); c.lineTo(x + 8 * u, y + 2 * u); c.lineTo(x + 16 * u, y + 18 * u); c.stroke(); }
    c.strokeStyle = '#a9cde6'; c.lineWidth = 2.4 * u;
    c.beginPath(); c.moveTo(W / 2 + 10 * u, H * 0.23); c.lineTo(W / 2 + 26 * u, H * 0.23 + 16 * u); c.moveTo(W / 2 + 26 * u, H * 0.23); c.lineTo(W / 2 + 10 * u, H * 0.23 + 16 * u); c.stroke();
    c.fillStyle = '#efe8da'; c.font = `${34 * u}px ${SERIF}`;
    espaciado(c, L.fin1, W / 2, H * 0.55, 6 * u);
    c.font = `${20 * u}px ${LETRA}`; c.fillStyle = 'rgba(239,232,218,.85)';
    c.fillText(L.fin2, W / 2, H * 0.63);
    c.font = `${12 * u}px ${SERIF}`; c.fillStyle = `rgba(239,232,218,${0.3 + 0.2 * Math.sin(t * 2)})`;
    c.fillText(L.fin3, W / 2, H * 0.82);
    c.restore();
  }
}
