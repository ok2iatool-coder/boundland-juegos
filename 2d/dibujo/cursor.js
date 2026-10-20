// El cursor de los menus: una mota de luz calida (el color del 18) dentro del circulo de Varga, a tinta.
// El circulo va abierto y gira despacio; encima de un boton se cierra y se ciñe. Deja una estela corta de
// motas, el anillo sigue al punto con un poco de retraso y al hacer clic suelta una onda y unas chispas.
// El del sistema se esconde en los menus (main.js); en el juego sigue la mira de siempre.
const LUZ = '255,244,226';        // #fff4e2, el 18
const TINTA = 'rgba(11,10,12,.85)';

export class Cursor {
  constructor() {
    this.x = 0; this.y = 0; this.visible = false;
    this.rx = 0; this.ry = 0; this.r = 13; this.cierre = 0;
    this.estela = []; this.ondas = []; this.chispas = [];
    this.ultimo = 0;
  }
  mover(x, y) {
    if (!this.visible) { this.rx = x; this.ry = y; }
    this.x = x; this.y = y; this.visible = true;
  }
  fuera() { this.visible = false; this.estela = []; }
  pulsar(x, y) {
    this.mover(x, y);
    this.ondas.push({ x, y, k: 0 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5, v = 60 + Math.random() * 90;
      this.chispas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, k: 0, vida: 0.35 + Math.random() * 0.25 });
    }
  }

  dibujar(c, u, t, encima) {
    const dt = Math.min(0.1, Math.max(0, t - this.ultimo)); this.ultimo = t;
    if (!this.visible && !this.ondas.length && !this.chispas.length) return;
    // el anillo persigue al punto; se ciñe y se cierra encima de un boton
    const seg = 1 - Math.exp(-dt * 20);
    this.rx += (this.x - this.rx) * seg; this.ry += (this.y - this.ry) * seg;
    this.r += ((encima ? 9 : 13) - this.r) * (1 - Math.exp(-dt * 14));
    this.cierre += ((encima ? 1 : 0) - this.cierre) * (1 - Math.exp(-dt * 10));
    // estela: un punto por fotograma si se mueve, vive 0,3 s
    const ult = this.estela[this.estela.length - 1];
    if (this.visible && (!ult || Math.hypot(ult.x - this.x, ult.y - this.y) > 1.5 * u)) this.estela.push({ x: this.x, y: this.y, k: 0 });
    for (const e of this.estela) e.k += dt / 0.3;
    this.estela = this.estela.filter((e) => e.k < 1).slice(-16);

    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'lighter';
    this.estela.forEach((e, i) => {
      const a = (1 - e.k) * (i / this.estela.length);
      c.fillStyle = `rgba(${LUZ},${0.5 * a})`;
      c.beginPath(); c.arc(e.x, e.y, (0.6 + 1.6 * a) * u, 0, 7); c.fill();
    });
    // ondas del clic
    for (const o of this.ondas) {
      o.k += dt / 0.5;
      const r = (this.r + 26 * o.k) * u, a = Math.max(0, 1 - o.k);
      c.strokeStyle = `rgba(${LUZ},${0.55 * a})`; c.lineWidth = (2.2 * a + 0.4) * u;
      c.beginPath(); c.arc(o.x, o.y, r, 0, 7); c.stroke();
    }
    this.ondas = this.ondas.filter((o) => o.k < 1);
    for (const s of this.chispas) {
      s.k += dt; const fr = Math.exp(-dt * 6); s.vx *= fr; s.vy *= fr;
      s.x += s.vx * dt * u; s.y += s.vy * dt * u;
      const a = Math.max(0, 1 - s.k / s.vida);
      c.fillStyle = `rgba(${LUZ},${0.9 * a})`; c.fillRect(s.x - 0.8 * u, s.y - 0.8 * u, 1.6 * u, 1.6 * u);
    }
    this.chispas = this.chispas.filter((s) => s.k < s.vida);
    if (!this.visible) { c.restore(); return; }
    // halo de la mota
    const hx = this.x, hy = this.y;
    const g = c.createRadialGradient(hx, hy, 0, hx, hy, 16 * u);
    g.addColorStop(0, `rgba(${LUZ},${0.32 + 0.18 * this.cierre})`); g.addColorStop(1, `rgba(${LUZ},0)`);
    c.fillStyle = g; c.fillRect(hx - 16 * u, hy - 16 * u, 32 * u, 32 * u);
    c.globalCompositeOperation = 'source-over';
    // el circulo de Varga: abierto y girando; cerrado encima de un boton
    const R = this.r * u, hueco = 0.9 * (1 - this.cierre), giro = t * 1.1;
    for (const [lw, col] of [[3.4 * u, TINTA], [1.4 * u, `rgba(${LUZ},${0.85 + 0.15 * this.cierre})`]]) {
      c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round';
      c.beginPath(); c.arc(this.rx, this.ry, R, giro + hueco / 2, giro + Math.PI * 2 - hueco / 2); c.stroke();
    }
    // encima de un boton, cuatro muescas que apuntan al centro
    if (this.cierre > 0.05) {
      c.globalAlpha = this.cierre;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4 - giro * 0.5, x0 = this.rx + Math.cos(a) * (R + 3 * u), y0 = this.ry + Math.sin(a) * (R + 3 * u);
        const x1 = this.rx + Math.cos(a) * (R + 7 * u), y1 = this.ry + Math.sin(a) * (R + 7 * u);
        for (const [lw, col] of [[3 * u, TINTA], [1.2 * u, `rgba(${LUZ},1)`]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
      }
      c.globalAlpha = 1;
    }
    // la mota: punto exacto del raton, con su filo de tinta
    c.fillStyle = TINTA; c.beginPath(); c.arc(hx, hy, 3.4 * u, 0, 7); c.fill();
    c.fillStyle = `rgb(${LUZ})`; c.beginPath(); c.arc(hx, hy, 2.1 * u, 0, 7); c.fill();
    c.restore();
  }
}
