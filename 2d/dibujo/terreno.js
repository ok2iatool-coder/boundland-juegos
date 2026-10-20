// El terreno: los contornos de lo macizo como lazos, temblados a mano, rellenos con la masa de la zona,
// su textura, luz de borde arriba y la linea de tinta. Se pinta una vez por trozos de 512 u y se guarda.
import { T } from '../sim/constantes.js';
import { MACIZO, PLAT, PINCHO, CUERDA, REJA } from '../sim/mapa.js';
import { TINTA, GROSOR, temblar, trazar, hash, azar, rayado, rgba, mezclar } from './tinta.js';
import { ZONAS, COLOR } from './paletas.js';
import { dibujarDecoradoFijo } from './decorado.js';
import { texturaMetal } from '../assets/pintura.js';
import { piezasDelLinde } from '../linde/nivel.js';

const TROZO = 512;

function lazos(m) {
  const S = (i, j) => {
    // marco macizo: todo lazo cierra. Por arriba queda lejos: la camara puede subir 4 casillas sobre un cielo abierto
    if (i < -2 || j < -12 || i > m.w + 1 || j > m.h + 1) return true;
    const ii = Math.max(0, Math.min(m.w - 1, i)), jj = Math.max(0, Math.min(m.h - 1, j));
    return m.t[jj * m.w + ii] === MACIZO;
  };
  // aristas dirigidas con lo macizo a la derecha
  const salen = new Map();
  const pon = (x0, y0, x1, y1) => {
    const k = x0 + ',' + y0;
    if (!salen.has(k)) salen.set(k, []);
    salen.get(k).push([x1, y1]);
  };
  for (let j = -13; j <= m.h + 2; j++) for (let i = -3; i <= m.w + 2; i++) {
    if (!S(i, j)) continue;
    if (!S(i, j - 1)) pon(i, j, i + 1, j);
    if (!S(i + 1, j)) pon(i + 1, j, i + 1, j + 1);
    if (!S(i, j + 1)) pon(i + 1, j + 1, i, j + 1);
    if (!S(i - 1, j)) pon(i, j + 1, i, j);
  }
  const res = [];
  for (const [k0, lista] of salen) {
    while (lista.length) {
      const [sx, sy] = k0.split(',').map(Number);
      const pts = [[sx, sy]];
      let [x, y] = lista.pop();
      let px = sx, py = sy;
      let guard = 0;
      while (!(x === sx && y === sy) && guard++ < 200000) {
        pts.push([x, y]);
        const l = salen.get(x + ',' + y);
        if (!l || !l.length) break;
        // en un cruce, girar a la derecha (mantiene los lazos simples)
        let elegido = 0;
        if (l.length > 1) {
          const dx = x - px, dy = y - py;
          const der = [-dy, dx];
          elegido = l.findIndex((q) => q[0] - x === der[0] && q[1] - y === der[1]);
          if (elegido < 0) elegido = 0;
        }
        const [nx, ny] = l.splice(elegido, 1)[0];
        px = x; py = y; x = nx; y = ny;
      }
      // quita puntos en linea
      const s = [];
      for (let q = 0; q < pts.length; q++) {
        const a = pts[(q - 1 + pts.length) % pts.length], b = pts[q], c = pts[(q + 1) % pts.length];
        const cruz = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        const punto = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]);
        if (cruz !== 0 || punto <= 0) s.push([b[0] * T, b[1] * T]);
      }
      if (s.length >= 3) res.push(s);
    }
  }
  return res;
}

export class Terreno {
  constructor(E) {
    this.E = E;
    this.z = ZONAS[E.nivel.zona];
    this.trozos = new Map();
    this.escala = 0;
    const m = E.m;
    const rug = this.z.rugoso;
    const crudos = lazos(m);
    this.lazos = crudos.map((l, k) => temblar(l, 15, rug, 11 + k));
    this.estilo = estiloDe(this.z, E.nivel.zona);
    // en el Linde, las plataformas que son ramas, de la aldea o la pasarela de hierro las pinta su pieza (dibujo/linde.js)
    this.sinTabla = E.nivel.zona === 'linde' ? piezasDelLinde(E.nivel).sinTabla : null;
    this.deco = decoracionDeBorde(crudos, this.estilo, E.nivel.semilla ?? E.id, m);
    // EL MUSGO (los grumos de los bordes): se pinta en vivo y no en los trozos, para que se aplaste al pisarlo y
    // vuelva a hincharse (pedido 2026-10-20). En la ciudad son cascotes y siguen en los trozos.
    this.vivo = E.nivel.zona !== 'ciudad';
    // LAS PLATAFORMAS QUE CUELGAN (2026-10-20, pedido: «tienen que estar sujetas con las cuerdas, la plataforma se
    // tambalea de un lado a otro»): en el laboratorio, las que no tienen suelo debajo (antes llevaban dos rayas
    // cortas que no llegaban a nada) cuelgan de dos cuerdas hasta el techo, o hasta la plataforma de encima, y se
    // mecen como un columpio. Se pintan en vivo (dibujarColgadas) y no en los trozos. La colision no se mueve: se
    // desplazan unas unidades y el 18 se pinta con la que pisa (desplazamiento).
    this.colgadas = E.nivel.zona === 'lab' || E.nivel.zona === 'laboratorio' ? plataformasColgadas(E) : [];
    if (this.colgadas.length) {
      this.sinTabla = new Set(this.sinTabla || []);
      for (const q of this.colgadas) for (let i = q.a; i <= q.b; i++) this.sinTabla.add(i + ',' + q.j);
      // lo que esta de pie encima (los frascos de las baldas): va con su plataforma (decorado.js)
      for (const mk of E.marcas) { const q = this.colgadas.find((o) => o.j === mk.j + 1 && mk.i >= o.a && mk.i <= o.b); if (q) mk.colgada = q; }
    }
    this.desp = { x: 0, y: 0 }; this.pvy = 0; this.pvx = 0; this.encima = null;
    this.cubos = new Map(); this.activos = new Set();
    if (this.vivo) for (const g of this.deco.grumos) {
      g.pr = 0; g.espera = 0;
      const k = Math.floor(g.x / CUBO);
      if (!this.cubos.has(k)) this.cubos.set(k, []);
      this.cubos.get(k).push(g);
    }
    this.camino = new Path2D();
    // lo macizo se extiende fuera del mapa: un rectangulo grande y los lazos (que rodean el aire) como huecos
    this.camino.rect(-40 * T, -40 * T, (m.w + 80) * T, (m.h + 80) * T);
    this.tinta = new Path2D();
    for (const l of this.lazos) {
      this.tinta.moveTo(l[0][0], l[0][1]);
      for (let q = 1; q < l.length; q++) this.tinta.lineTo(l[q][0], l[q][1]);
      this.tinta.closePath();
      this.camino.moveTo(l[0][0], l[0][1]);
      for (let q = 1; q < l.length; q++) this.camino.lineTo(l[q][0], l[q][1]);
      this.camino.closePath();
    }
    // bordes de arriba (suelo que se pisa): para la luz de borde y la hierba. En el Linde no los de las piezas macizas
    // pintadas encima (el autobus, el arbol colosal, la roca del conducto): la hierba asomaba sobre el techo del
    // autobus como pinchos
    const tapadas = E.nivel.zona === 'linde' ? new Set(E.marcas.filter((q) => q.solido).map((q) => q.i + ',' + q.j)) : null;
    this.arriba = [];
    for (let j = 0; j < m.h; j++) {
      let i0 = -1;
      for (let i = 0; i <= m.w; i++) {
        const top = i < m.w && m.t[j * m.w + i] === MACIZO && (j === 0 || m.t[(j - 1) * m.w + i] !== MACIZO) && !(tapadas && tapadas.has(i + ',' + j));
        if (top && i0 < 0) i0 = i;
        if (!top && i0 >= 0) { this.arriba.push([i0 * T, j * T, i * T]); i0 = -1; }
      }
    }
  }

  trozo(ix, iy, s) {
    if (s !== this.escala) { this.trozos.clear(); this.escala = s; }
    const k = ix + ',' + iy;
    let c = this.trozos.get(k);
    if (c === undefined) {
      c = this.pintar(ix, iy, s);
      this.trozos.set(k, c);
    }
    return c;
  }

  dibujar(ctx, cam, s) {
    const x0 = Math.floor(cam.x / TROZO), x1 = Math.floor((cam.x + cam.w) / TROZO);
    const y0 = Math.floor(cam.y / TROZO), y1 = Math.floor((cam.y + cam.h) / TROZO);
    for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) {
      const c = this.trozo(ix, iy, s);
      if (c) ctx.drawImage(c, ix * TROZO, iy * TROZO, TROZO + 0.5 / s, TROZO + 0.5 / s);
    }
  }

  // Lo que pisa el 18 (p: su caja; golpe 0-1 al aterrizar): los grumos bajo sus pies se aplastan y, cuando los
  // deja, esperan un poco y vuelven a hincharse. Se llama en cada paso (tambien sin p, para que se recuperen).
  pisar(dt, p, golpe = 0) {
    if (!this.vivo) return;
    for (const g of this.activos) {
      if (g.espera > 0) { g.espera -= dt; continue; }
      g.pr = Math.max(0, g.pr - dt / MUSGO_VUELVE);
      if (g.pr === 0) this.activos.delete(g);
    }
    if (!p || (!p.enSuelo && !golpe)) return;
    const pieY = p.y + p.h, mas = golpe ? 8 + golpe * 16 : 0;
    const x0 = p.x + 3 - mas, x1 = p.x + p.w - 3 + mas, cx = (x0 + x1) / 2, mitad = (x1 - x0) / 2 + 1;
    for (let k = Math.floor((x0 - 14) / CUBO); k <= Math.floor((x1 + 14) / CUBO); k++) {
      for (const g of this.cubos.get(k) || []) {
        if (g.x + g.r * 0.6 < x0 || g.x - g.r * 0.6 > x1) continue;
        // los del suelo que pisa (por la altura de su suelo, no la de la bola: los de encima de otros se escapaban)
        if (Math.abs((g.base ?? g.y + g.r) - pieY) > 10) continue;
        // al aterrizar se aplasta mas en medio que en los bordes de la pisada
        const f = golpe ? Math.min(1, 0.55 + golpe * 0.45) * (1 - 0.45 * Math.min(1, Math.abs(g.x - cx) / mitad)) : 1;
        if (f > g.pr) g.pr = f;
        g.espera = golpe ? 0.6 : 0.35;
        this.activos.add(g);
      }
    }
  }

  // ---- las plataformas colgadas: un pendulo cada una (con el viento del laboratorio), un muelle vertical en las
  // cuerdas y lo que les hace el 18: al caer encima se hunden y se van hacia donde iba, al andar el empujon de sus
  // pies las mueve al reves, y al saltar las empuja abajo
  colgadaBajo(p) {
    if (!p || !p.enSuelo || !this.colgadas.length) return null;
    const pie = p.y + p.h, cx = p.x + p.w / 2;
    return this.colgadas.find((q) => Math.abs(pie - q.y) < 3 && cx > q.x0 - p.w / 2 && cx < q.x1 + p.w / 2) || null;
  }
  mecer(dt, p, t) {
    if (!this.colgadas.length) return;
    const bajo = this.colgadaBajo(p);
    if (bajo) {
      if (this.encima !== bajo) { bajo.w += (this.pvx * 0.045) / bajo.L; bajo.vy += Math.min(300, Math.max(80, this.pvy * 0.3)); }   // cae encima
      else bajo.w -= ((p.vx - this.pvx) * 0.07) / bajo.L;                                                                    // anda o frena
    } else if (this.encima && p && p.vy < -100) { this.encima.vy += 130; this.encima.w -= (p.vx * 0.04) / this.encima.L; }  // salta
    this.encima = bajo; this.pvy = p ? p.vy : 0; this.pvx = p ? p.vx : 0;
    for (const q of this.colgadas) {                  // de arriba abajo: la de debajo cuelga de la de arriba
      const w0 = Math.sqrt(2400 / q.L), aire = (3.2 * Math.sin(t * 0.63 + q.fase) + 1.6 * Math.sin(t * 1.37 + q.fase * 2)) / q.L;
      q.w += (-w0 * w0 * (q.th - aire) - 2 * 0.07 * w0 * q.w) * dt; q.th += q.w * dt;
      q.vy += (-170 * q.dy - 10 * q.vy) * dt; q.dy += q.vy * dt;
      // lo que se mueven sus anclajes (las cuerdas que cuelgan de otra plataforma), a medias entre las dos
      const ax = (q.cuerdas[0].de ? q.cuerdas[0].de.dx : 0) + (q.cuerdas[1].de ? q.cuerdas[1].de.dx : 0);
      const ay = (q.cuerdas[0].de ? q.cuerdas[0].de.dyT : 0) + (q.cuerdas[1].de ? q.cuerdas[1].de.dyT : 0);
      q.dx = q.L * Math.sin(q.th) + ax / 2;
      q.dyT = q.L * (1 - Math.cos(q.th)) + q.dy + ay / 2;
    }
    // el 18 va con la que pisa; al dejarla vuelve a su sitio en un momento
    const ox = bajo ? bajo.dx : 0, oy = bajo ? bajo.dyT : 0, k = bajo ? 1 : Math.min(1, dt * 14);
    this.desp.x += (ox - this.desp.x) * k; this.desp.y += (oy - this.desp.y) * k;
  }
  desplazamiento() { return this.desp; }

  dibujarColgadas(ctx, cam, t) {
    if (!this.colgadas.length) return;
    const z = this.z, st = this.estilo;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const vis = this.colgadas.filter((q) => !(q.x1 < cam.x - 60 || q.x0 > cam.x + cam.w + 60 || q.y < cam.y - 40 || q.techo > cam.y + cam.h + 40));
    // primero TODAS las cuerdas y luego las tablas: la cuerda que sube al techo pasa por detras de la tabla de encima
    for (const pasada of ['cuerdas', 'tablas']) for (const q of vis) {
      const dx = q.dx || 0, dy = q.dyT || 0;
      if (pasada === 'cuerdas') {
      // las cuerdas: del techo (o de la plataforma de encima) a una argolla en cada punta
      for (const c of q.cuerdas) {
        const an = c.de, ax = c.x + (an ? an.dx || 0 : 0), ay = c.y + (an ? an.dyT || 0 : 0), bx = c.x + dx, by = q.y + dy - 3;
        if (!an) { ctx.fillStyle = mezclar(z.masaClara, '#000000', 0.2); ctx.fillRect(ax - 7, ay - 1, 14, 5); ctx.lineWidth = 1.4; ctx.strokeStyle = TINTA; ctx.strokeRect(ax - 7, ay - 1, 14, 5); }   // la placa del anclaje
        ctx.beginPath(); ctx.moveTo(ax, ay + 3); ctx.lineTo(bx, by);
        ctx.lineWidth = 3.2; ctx.strokeStyle = TINTA; ctx.stroke();
        ctx.lineWidth = 1.3; ctx.strokeStyle = '#8c7f66'; ctx.stroke();
        // el trenzado: rayitas a lo largo
        const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
        ctx.beginPath();
        for (let d = 6; d < L - 4; d += 7) { const x = ax + ux * d, y = ay + uy * d; ctx.moveTo(x - 1.2, y - 0.8); ctx.lineTo(x + 1.2, y + 0.8); }
        ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(30,26,20,.6)'; ctx.stroke();
        // la argolla y el nudo
        ctx.beginPath(); ctx.ellipse(bx, by + 1, 3, 2.4, 0, 0, 7); ctx.lineWidth = 1.6; ctx.strokeStyle = TINTA; ctx.stroke();
      }
      continue;
      }
      // la tabla (como las de los trozos, movida)
      ctx.save(); ctx.translate(dx, dy);
      const pts = temblar([[q.x0 - 2, q.y], [q.x1 + 2, q.y], [q.x1 + 2, q.y + 8], [q.x0 - 2, q.y + 8]], 12, 0.7, q.a * 31 + q.j);
      trazar(ctx, pts); ctx.fillStyle = '#3b4754'; ctx.fill();
      ctx.lineWidth = GROSOR; ctx.strokeStyle = TINTA; ctx.stroke();
      ctx.strokeStyle = rgba(z.borde, 0.5); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(q.x0 + 2, q.y + 2.5); ctx.lineTo(q.x1 - 2, q.y + 2.5); ctx.stroke();
      // remaches de las argollas
      ctx.fillStyle = rgba(st.borde, 0.5);
      for (const c of q.cuerdas) { ctx.beginPath(); ctx.arc(c.x, q.y + 4, 1.4, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
  }

  // el musgo de lo que se ve, aplastado segun lo pisado: la base se queda donde estaba, se ensancha y baja
  dibujarMusgo(ctx, cam, t) {
    if (!this.vivo) return;
    const st = this.estilo, vis = [];
    for (let k = Math.floor((cam.x - 24) / CUBO); k <= Math.floor((cam.x + cam.w + 24) / CUBO); k++) {
      for (const g of this.cubos.get(k) || []) if (g.y > cam.y - 30 && g.y < cam.y + cam.h + 30) vis.push(g);
    }
    if (!vis.length) return;
    for (const g of vis) {
      const k = g.pr * g.pr * (3 - 2 * g.pr);
      // aplastado: se ensancha, baja de alto y su parte de abajo va bajando hasta el suelo (los que estaban encima de
      // otros no se quedan flotando como bolitas sobre el musgo ya aplastado)
      const abajo = g.y + g.r, suelo = g.base !== undefined ? g.base + 1.5 : abajo;
      g.k = k; g.rx = g.r * (1 + 0.28 * k); g.ry = g.r * (1 - 0.64 * k); g.cy = abajo + (suelo - abajo) * k - g.ry;
    }
    const elipses = (f) => { ctx.beginPath(); for (const g of vis) f(g); };
    const elipse = (x, y, rx, ry) => { ctx.moveTo(x + rx, y); ctx.ellipse(x, y, rx, ry, 0, 0, 7); };
    ctx.save();
    // tres pasadas: el contorno de la union, el relleno y las luces (asi solo se entinta el borde de fuera)
    elipses((g) => elipse(g.x, g.cy, g.rx, g.ry));
    ctx.lineWidth = 4.2; ctx.strokeStyle = st.tinta; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = st.grumo; ctx.fill();
    for (let b = 0; b < 3; b++) {
      elipses((g) => { if (Math.min(2, Math.floor(g.tono * 3)) === b) elipse(g.x - g.rx * 0.2, g.cy - g.ry * 0.25, g.rx * 0.62, g.ry * 0.62); });
      ctx.fillStyle = mezclar(st.grumo, st.grumoClaro, 0.3 + ((b + 0.5) / 3) * 0.5); ctx.fill();
    }
    elipses((g) => elipse(g.x - g.rx * 0.32, g.cy - g.ry * 0.42, g.rx * 0.24, g.ry * 0.24));
    ctx.fillStyle = rgba(st.borde, 0.16); ctx.fill();
    // el pelo del musgo: hebras finas por arriba que se tumban al aplastarlo, y en algun grumo la capsula en su
    // tallito (el esporofito), que se dobla
    if (st.musgo) {
      elipses((g) => {
        if (g.r < 3.5) return;
        const n = g.r > 7 ? 5 : 3, L = g.r * 0.45 * (1 - 0.7 * g.k), aire = Math.sin(t * 1.3 + g.x * 0.05) * 0.1;
        for (let j = 0; j < n; j++) {
          const a = -Math.PI / 2 + (j - (n - 1) / 2) * (0.5 + 0.7 * g.k) + aire + (g.tono - 0.5) * 0.4;
          const sx = g.x + Math.cos(a) * g.rx * 0.88, sy = g.cy + Math.sin(a) * g.ry * 0.88;
          ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + Math.cos(a + 0.4) * L * 0.6, sy + Math.sin(a + 0.4) * L * 0.6, sx + Math.cos(a + 0.2) * L, sy + Math.sin(a + 0.2) * L);
        }
      });
      ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.strokeStyle = st.tinta; ctx.stroke();
      const capsulas = vis.filter((g) => g.tono > 0.8 && g.r > 5);
      ctx.beginPath();
      for (const g of capsulas) {
        const a = -Math.PI / 2 + (g.tono - 0.9) * 3 + Math.sin(t * 1.1 + g.x) * 0.08 + g.k * 1.1, L = g.r * 1.1 * (1 - 0.5 * g.k);
        const sx = g.x + g.rx * 0.15, sy = g.cy - g.ry * 0.9;
        ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * L, sy + Math.sin(a) * L);
      }
      ctx.lineWidth = 0.9; ctx.strokeStyle = mezclar(st.grumoClaro, st.borde, 0.3); ctx.stroke();
      elipses(() => {});
      for (const g of capsulas) {
        const a = -Math.PI / 2 + (g.tono - 0.9) * 3 + Math.sin(t * 1.1 + g.x) * 0.08 + g.k * 1.1, L = g.r * 1.1 * (1 - 0.5 * g.k);
        elipse(g.x + g.rx * 0.15 + Math.cos(a) * L, g.cy - g.ry * 0.9 + Math.sin(a) * L, 1.6, 1.1);
      }
      ctx.fillStyle = st.grumoClaro; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = st.tinta; ctx.stroke();
    }
    // burbujitas de textura
    elipses((g) => { if (g.r >= 6) elipse(g.x + g.rx * 0.3, g.cy + g.ry * 0.2, g.r * 0.16, g.r * 0.16 * (1 - 0.5 * g.k)); });
    ctx.fillStyle = rgba(st.tinta, 0.45); ctx.fill();
    ctx.restore();
  }

  pintar(ix, iy, s) {
    const E = this.E, m = E.m, z = this.z;
    const X0 = ix * TROZO, Y0 = iy * TROZO;
    if (X0 > m.ancho + TROZO || Y0 > m.alto + TROZO || X0 < -TROZO * 2 || Y0 < -TROZO * 2) return null;
    const px = Math.ceil(TROZO * s);
    const cv = document.createElement('canvas');
    cv.width = px; cv.height = px;
    const c = cv.getContext('2d');
    c.setTransform(s, 0, 0, s, -X0 * s, -Y0 * s);
    // decorado fijo (detras del terreno)
    for (const mk of E.marcas) {
      const x = mk.i * T + T / 2, y = (mk.j + 1) * T;
      if (x < X0 - 600 || x > X0 + TROZO + 600 || y < Y0 - 700 || y > Y0 + TROZO + 700) continue;
      c.save(); dibujarDecoradoFijo(c, mk, E, z); c.restore();
    }
    // cuerdas, plataformas, cristal, rejas
    const i0 = Math.max(0, Math.floor(X0 / T) - 2), i1 = Math.min(m.w - 1, Math.floor((X0 + TROZO) / T) + 2);
    const j0 = Math.max(0, Math.floor(Y0 / T) - 2), j1 = Math.min(m.h - 1, Math.floor((Y0 + TROZO) / T) + 2);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const v = m.t[j * m.w + i];
      if (v === CUERDA) cuerda(c, m, i, j, z);
    }
    plataformas(c, m, i0, i1, j0, j1, z, E.nivel.zona, this.sinTabla);
    // la masa
    c.save();
    c.fillStyle = z.masa;
    c.fill(this.camino, 'evenodd');
    c.clip(this.camino, 'evenodd');
    if (z.textura === 'pintada') pintada(c, z, X0, Y0, s, this.E.nivel.semilla ?? this.E.id);
    else textura(c, z, X0, Y0, E.nivel.zona);
    // por dentro, cerca del borde, la masa se aclara y se ven las piedras apiladas; el centro queda oscuro
    const st = this.estilo;
    c.save(); c.filter = `blur(${Math.max(2, 7 * s)}px)`;
    c.lineWidth = 54; c.strokeStyle = rgba(st.piedra, 0.32); c.stroke(this.tinta);
    c.restore();
    // en la ciudad no hay piedras apiladas: el firme de la calle (asfalto sobre la base de hormigon)
    const ciudad = E.nivel.zona === 'ciudad';
    if (ciudad) asfalto(c, this.arriba, X0, Y0, z);
    else piedras(c, this.deco.piedras, X0, Y0, st);
    c.lineWidth = 1.1; c.strokeStyle = rgba(st.tinta, 0.8); c.lineCap = 'round';
    for (const g of this.deco.grietas) {
      if (!dentroTrozo(g[0][0], g[0][1], X0, Y0, 60)) continue;
      c.beginPath(); c.moveTo(g[0][0], g[0][1]); for (let k = 1; k < g.length; k++) c.lineTo(g[k][0], g[k][1]); c.stroke();
    }
    // luz de borde: una franja clara bajo cada suelo
    for (const [xa, y, xb] of this.arriba) {
      if (xb < X0 - 40 || xa > X0 + TROZO + 40 || y < Y0 - 40 || y > Y0 + TROZO + 40) continue;
      const g = c.createLinearGradient(0, y, 0, y + 22);
      g.addColorStop(0, rgba(z.borde, 0.32)); g.addColorStop(1, rgba(z.borde, 0));
      c.fillStyle = g; c.fillRect(xa - 4, y - 2, xb - xa + 8, 24);
    }
    c.restore();
    // tinta del color de la zona (oscura, no negra) y algo mas gruesa
    c.lineWidth = GROSOR * 1.45; c.strokeStyle = st.tinta; c.lineJoin = 'round';
    c.stroke(this.tinta);
    // en la ciudad, del techo cuelgan varillas y no hebras, y sobre el suelo hay cascotes y no musgo
    if (ciudad) { varillas(c, this.deco.colgantes, X0, Y0, st); cascotes(c, this.deco.grumos, X0, Y0, st); }
    else colgantes(c, this.deco.colgantes, X0, Y0, st);       // (los grumos, en vivo: dibujarMusgo)
    if (!ciudad) menudos(c, this.deco.menudos, X0, Y0, st);
    // filo de luz sobre la tinta en los suelos
    c.strokeStyle = rgba(z.borde, 0.55); c.lineWidth = 1.2;
    for (const [xa, y, xb] of this.arriba) {
      if (xb < X0 - 40 || xa > X0 + TROZO + 40 || y < Y0 - 40 || y > Y0 + TROZO + 40) continue;
      c.beginPath();
      for (let x = xa + 4; x < xb - 4; x += 10) {
        const yy = y + 2.6 + (hash(Math.round(x), 9) - 0.5) * 0.8;
        if (x === xa + 4) c.moveTo(x, yy); else c.lineTo(x, yy);
      }
      c.stroke();
      if (E.nivel.zona === 'plaza' || E.nivel.zona === 'linde') hierbas(c, xa, y, xb, z);
    }
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const v = m.t[j * m.w + i];
      if (v === PINCHO) cristales(c, i, j, z, E.nivel.zona);
      else if (v === REJA) reja(c, i, j);
    }
    return cv;
  }
}

function textura(c, z, X0, Y0, zona) {
  const r = azar(X0 * 7 + Y0 * 13 + 5);
  if (zona === 'linde') { tierra(c, z, X0, Y0, r); return; }
  if (zona === 'ciudad') { hormigon(c, z, X0, Y0, r); return; }
  if (zona === 'lab' || zona === 'hospital') {
    // juntas de paneles y remaches / azulejo
    const paso = zona === 'hospital' ? 32 : 64;
    c.strokeStyle = rgba(z.borde, zona === 'hospital' ? 0.07 : 0.09); c.lineWidth = 1;
    c.beginPath();
    for (let y = Math.floor(Y0 / paso) * paso; y < Y0 + TROZO; y += paso) { c.moveTo(X0, y + 0.5); c.lineTo(X0 + TROZO, y + 0.5); }
    for (let x = Math.floor(X0 / (paso * 1.5)) * paso * 1.5; x < X0 + TROZO; x += paso * 1.5) for (let y = Math.floor(Y0 / paso) * paso; y < Y0 + TROZO; y += paso) {
      const o = ((y / paso) % 2) * paso * 0.75;
      c.moveTo(x + o, y); c.lineTo(x + o, y + paso);
    }
    c.stroke();
    if (zona === 'lab') {
      c.fillStyle = rgba(z.borde, 0.12);
      for (let x = Math.floor(X0 / 96) * 96; x < X0 + TROZO; x += 96) for (let y = Math.floor(Y0 / 64) * 64; y < Y0 + TROZO; y += 64) {
        c.beginPath(); c.arc(x + 6, y + 6, 1.4, 0, 7); c.arc(x + 90, y + 6, 1.4, 0, 7); c.fill();
      }
    }
  } else {
    // hormigon / yeso: manchas y grietas
    for (let k = 0; k < 26; k++) {
      const x = X0 + r() * TROZO, y = Y0 + r() * TROZO, rr = 10 + r() * 40;
      const g = c.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, rgba(r() < 0.5 ? '#000000' : z.masaClara, 0.18)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      let x = X0 + r() * TROZO, y = Y0 + r() * TROZO;
      c.beginPath(); c.moveTo(x, y);
      for (let q = 0; q < 5; q++) { x += (r() - 0.5) * 30; y += r() * 18; c.lineTo(x, y); }
      c.stroke();
    }
    if (zona !== 'casa') {
      // varillas que asoman
      c.strokeStyle = rgba(COLOR.oxido, 0.35); c.lineWidth = 1.6;
      for (let k = 0; k < 3; k++) { const x = X0 + r() * TROZO, y = Y0 + r() * TROZO; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 30, y + 20 + r() * 20); c.stroke(); }
    }
  }
  rayado(c, X0, Y0, TROZO, TROZO, 11, 'rgba(0,0,0,.13)', -0.95, X0 + Y0);
}

function hierbas(c, xa, y, xb, z) {
  c.strokeStyle = TINTA; c.lineWidth = 1.3;
  for (let x = xa + 6; x < xb - 4; x += 5) {
    const h = hash(Math.round(x), 41);
    if (h < 0.45) continue;
    const alto = 3 + h * 9;
    c.beginPath(); c.moveTo(x, y + 1); c.quadraticCurveTo(x + (h - 0.7) * 6, y - alto * 0.6, x + (h - 0.6) * 9, y - alto); c.stroke();
  }
}

// Las plataformas que cuelgan: los tramos de '=' sin suelo debajo (la misma regla que plataforma(): si hay suelo a
// menos de 6 casillas y no es muy ancha lleva patas), fuera de la gravedad cero. Cada cuerda sube hasta el techo o
// hasta la plataforma de encima (y entonces cuelga de ella). Ordenadas de arriba abajo.
function plataformasColgadas(E) {
  const m = E.m, tramos = [];
  for (let j = 1; j < m.h; j++) {
    let a = -1;
    for (let i = 0; i <= m.w; i++) {
      const es = i < m.w && m.t[j * m.w + i] === PLAT;
      if (es && a < 0) a = i;
      if (!es && a >= 0) { tramos.push({ a, b: i - 1, j }); a = -1; }
    }
  }
  const gz = (x, y) => E.zonas.some((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
  const lista = [];
  for (const q of tramos) {
    let suelo = false;
    for (let jj = q.j + 1; jj < Math.min(m.h, q.j + 7); jj++) if (m.t[jj * m.w + q.a] === MACIZO) { suelo = true; break; }
    if (suelo && q.b - q.a < 10) continue;
    const x0 = q.a * T, x1 = (q.b + 1) * T, y = q.j * T;
    if (gz((x0 + x1) / 2, y)) continue;
    lista.push({ ...q, x0, x1, y, th: 0, w: 0, dy: 0, vy: 0, dx: 0, dyT: 0, fase: hash(q.a, q.j, 5) * 6.28, cuerdas: [] });
  }
  lista.sort((p, q) => p.j - q.j);
  for (const q of lista) {
    let techo = q.y - 900;
    for (const x of [q.x0 + 12, q.x1 - 12]) {
      const i = Math.floor(x / T);
      let y = -200, de = null;
      for (let jj = q.j - 1; jj >= 0; jj--) {
        const v = m.t[jj * m.w + i];
        // (siempre hasta el TECHO de roca, 2026-10-20, pedido: «las cuerdas tienen que estar pegadas al techo»: antes
        // se ataban a la plataforma de encima y al subir se veian cuerdas que acababan en otra tabla)
        if (v === MACIZO) { y = (jj + 1) * T; break; }
      }
      q.cuerdas.push({ x, y, de });             // de: la plataforma de la que cuelga esa cuerda (o el techo)
      techo = Math.max(techo, y);
    }
    q.techo = Math.min(...q.cuerdas.map((c) => c.y));
    q.L = Math.max(120, q.y - (q.cuerdas[0].y + q.cuerdas[1].y) / 2);
  }
  return lista;
}

function plataformas(c, m, i0, i1, j0, j1, z, zona, sinTabla) {
  for (let j = j0; j <= j1; j++) {
    let a = -1;
    for (let i = i0; i <= i1 + 1; i++) {
      const es = i <= i1 && m.t[j * m.w + i] === PLAT && !(sinTabla && sinTabla.has(i + ',' + j));
      if (es && a < 0) a = i;
      if (!es && a >= 0) { plataforma(c, m, a, i - 1, j, z, zona); a = -1; }
    }
  }
}

function plataforma(c, m, a, b, j, z, zona) {
  const x0 = a * T, x1 = (b + 1) * T, y = j * T;
  // hasta donde llegan las patas (suelo debajo a menos de 6 casillas)
  let suelo = -1;
  for (let jj = j + 1; jj < Math.min(m.h, j + 7); jj++) if (m.t[jj * m.w + a] === MACIZO) { suelo = jj * T; break; }
  const madera = zona === 'casa' || zona === 'ciudad' || zona === 'plaza' || zona === 'linde';
  const tapa = madera ? '#4a3a2a' : '#3b4754';
  if (suelo > 0 && b - a < 10) {
    for (const x of [x0 + 6, x1 - 10]) {
      c.beginPath(); c.rect(x, y + 6, 4, suelo - y - 6); c.fillStyle = z.masaClara; c.fill();
      c.lineWidth = GROSOR * 0.8; c.strokeStyle = TINTA; c.stroke();
    }
    if (!madera) { c.beginPath(); c.moveTo(x0 + 8, suelo - 14); c.lineTo(x1 - 8, suelo - 14); c.lineWidth = GROSOR * 0.7; c.stroke(); }
  } else {
    // mensulas en la pared o cables que la cuelgan
    c.lineWidth = 1.4; c.strokeStyle = TINTA;
    for (const x of [x0 + 10, x1 - 10]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + (x < (x0 + x1) / 2 ? -6 : 6), y - 60); c.stroke(); }
  }
  const pts = temblar([[x0 - 2, y], [x1 + 2, y], [x1 + 2, y + 8], [x0 - 2, y + 8]], 12, 0.7, a * 31 + j);
  trazar(c, pts);
  c.fillStyle = tapa; c.fill();
  c.lineWidth = GROSOR; c.strokeStyle = TINTA; c.stroke();
  c.strokeStyle = rgba(z.borde, 0.5); c.lineWidth = 1;
  c.beginPath(); c.moveTo(x0 + 2, y + 2.5); c.lineTo(x1 - 2, y + 2.5); c.stroke();
}

function cuerda(c, m, i, j, z) {
  const arriba = j === 0 || m.t[(j - 1) * m.w + i] !== CUERDA;
  const x = i * T + T / 2;
  c.strokeStyle = TINTA; c.lineWidth = 3.4;
  c.beginPath(); c.moveTo(x, j * T - (arriba ? 6 : 0)); c.lineTo(x + Math.sin(j) * 0.8, (j + 1) * T); c.stroke();
  c.strokeStyle = mezclar(z.borde, '#000000', 0.45); c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(x, j * T); c.lineTo(x + Math.sin(j) * 0.8, (j + 1) * T); c.stroke();
  // nudos
  c.fillStyle = TINTA;
  if (j % 3 === 0) { c.beginPath(); c.ellipse(x, j * T + 16, 3, 4, 0, 0, 7); c.fill(); }
  if (arriba) { c.beginPath(); c.arc(x, j * T - 6, 4, 0, 7); c.fill(); }
}

function cristales(c, i, j, z, zona) {
  if (zona === 'linde') { zarzas(c, i, j); return; }
  const r = azar(i * 977 + j * 131);
  const yb = (j + 1) * T;
  const n = 4;
  for (let k = 0; k < n; k++) {
    const x = i * T + 3 + r() * (T - 6);
    const h = 10 + r() * 16, w = 4 + r() * 5, inc = (r() - 0.5) * 8;
    c.beginPath();
    c.moveTo(x - w / 2, yb); c.lineTo(x + inc, yb - h); c.lineTo(x + w / 2, yb);
    c.closePath();
    c.fillStyle = zona === 'lab' ? 'rgba(170,205,215,.55)' : 'rgba(150,170,160,.6)';
    c.fill();
    c.lineWidth = 1.5; c.strokeStyle = TINTA; c.stroke();
    c.strokeStyle = 'rgba(240,250,255,.6)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(x - w / 4, yb - 2); c.lineTo(x + inc * 0.8, yb - h + 3); c.stroke();
  }
  c.fillStyle = TINTA; c.fillRect(i * T, yb - 3, T, 3);
}

function reja(c, i, j) {
  const x = i * T, y = j * T;
  c.fillStyle = 'rgba(20,24,30,.55)'; c.fillRect(x + 2, y, T - 4, T);
  c.strokeStyle = TINTA; c.lineWidth = 2.4;
  for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x + 5 + k * 7, y); c.lineTo(x + 5 + k * 7, y + T); c.stroke(); }
  c.strokeStyle = 'rgba(160,200,240,.35)'; c.lineWidth = 1;
  for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x + 6 + k * 7, y); c.lineTo(x + 6 + k * 7, y + T); c.stroke(); }
  c.strokeStyle = TINTA; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x + 2, y + 4); c.lineTo(x + T - 2, y + 4); c.moveTo(x + 2, y + T - 4); c.lineTo(x + T - 2, y + T - 4); c.stroke();
}


// Roca y hierro pintados (la textura de los assets) a la escala de la pantalla, oscurecidos para que la
// masa siga siendo masa; vetas horizontales de estratos y algun remache de las placas del laboratorio.
function pintada(c, z, X0, Y0, s, semilla) {
  const k = Math.min(3, s);
  const B = 256;
  const tex = texturaMetal(B, B, k, { base: z.masaTex, oxido: 0.35, semilla: semilla * 31 });
  for (let y = Math.floor(Y0 / B) * B; y < Y0 + TROZO; y += B) for (let x = Math.floor(X0 / B) * B; x < X0 + TROZO; x += B) {
    // cada baldosa volteada segun su sitio, para que no se note la repeticion
    const fx = hash(x, y, 3) < 0.5 ? -1 : 1, fy = hash(x, y, 4) < 0.5 ? -1 : 1;
    c.save(); c.translate(x + B / 2, y + B / 2); c.scale(fx, fy); c.drawImage(tex, -B / 2, -B / 2, B + 0.5, B + 0.5); c.restore();
  }
  c.fillStyle = 'rgba(8,10,14,.5)'; c.fillRect(X0, Y0, TROZO, TROZO);
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.2;
  for (let y = Math.floor(Y0 / 40) * 40; y < Y0 + TROZO; y += 40) {
    c.beginPath();
    for (let x = X0; x <= X0 + TROZO; x += 16) c.lineTo(x, y + Math.sin(x * 0.02 + y) * 4 + (hash(x, y) - 0.5) * 3);
    c.stroke();
  }
}


// ---------------------------------------------------------------- estilo de borde (a lo Silksong)
// El terreno no acaba en una linea: el suelo lleva grumos que asoman por encima, del techo cuelgan
// hebras y gotas, y cerca de cada borde se ven piedras apiladas. Todo del color de la zona.
// (el laboratorio era gris azulado y no se leia ni musgo ni polvo: «lo esponjoso»; desde el 2026-10-20, musgo)
const GRUMO = { lab: '#3f4d3a', laboratorio: '#4b5940', ciudad: '#5c5b45', casa: '#5c4b38', plaza: '#3f6966', hospital: '#4b4341', linde: '#4f5526' };
const MUSGO = new Set(['lab', 'laboratorio', 'linde', 'plaza']);     // donde lleva pelo y capsulas (en casa y hospital es polvo)
const CUBO = 64;                // el indice del musgo, por columnas de 64 u
const MUSGO_VUELVE = 2.2;       // segundos en volver a hincharse del todo
function estiloDe(z, zona) {
  return {
    piedra: mezclar(z.masaClara, z.borde, 0.16),
    piedraOsc: mezclar(z.masa, '#000000', 0.2),
    grumo: GRUMO[zona] || mezclar(z.masaClara, z.borde, 0.3),
    grumoClaro: mezclar(GRUMO[zona] || z.masaClara, z.borde, 0.3),
    tinta: mezclar(z.masa, '#000000', 0.62),
    borde: z.borde,
    // cuanto cuelga del techo y cuanto asoma del suelo: en la casa y el hospital, polvo y no estalactitas
    colg: { casa: 0.3, hospital: 0.5, ciudad: 0.6, plaza: 0.6, linde: 0.7 }[zona] ?? 1,
    mata: { casa: 0.6, hospital: 0.75 }[zona] ?? 1,
    musgo: MUSGO.has(zona),
  };
}

function decoracionDeBorde(crudos, st, semilla, m) {
  const piedras = [], grumos = [], colgantes = [], menudos = [], grietas = [];
  // las cajas macizas de decorado (marcas con `solido`) llevan su propio dibujo: sin musgo ni hebras
  const cajas = new Set(m.marcas.filter((q) => q.solido).map((q) => q.i + ',' + q.j));
  const enCaja = (x, y) => cajas.has(Math.floor(x / T) + ',' + Math.floor(y / T));
  const r = azar(semilla * 977 + 13);
  for (const l of crudos) {
    for (let k = 0; k < l.length; k++) {
      const a = l[k], b = l[(k + 1) % l.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L < 1) continue;
      const tx = dx / L, ty = dy / L;
      const nx = -ty, ny = tx;                    // hacia dentro de lo macizo
      const suelo = ny > 0.5, techo = ny < -0.5;
      // fuera del mapa (el marco que cierra los bordes) no se decora
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (mx < 1 || mx > m.ancho - 1 || my < 1 || my > m.alto - 1) continue;
      if (enCaja(mx + nx * 4, my + ny * 4)) continue;
      // piedras apiladas: tres hileras que se achican hacia dentro
      for (let fila = 0; fila < 3; fila++) {
        const paso = 15 - fila * 2, prof = 9 + fila * 15;
        for (let d = (fila % 2) * paso * 0.5; d < L; d += paso + r() * 5) {
          if (r() < 0.12 + fila * 0.15) continue;
          const rx = (8.5 - fila * 1.6) * (0.7 + r() * 0.55), ry = rx * (0.55 + r() * 0.3);
          piedras.push({ x: a[0] + tx * d + nx * (prof + r() * 4), y: a[1] + ty * d + ny * (prof + r() * 4), rx, ry, rot: Math.atan2(ty, tx) + (r() - 0.5) * 0.5, fila, tono: r() });
        }
      }
      // grumos: matas irregulares en los suelos (hueco, mata, hueco) y alguna suelta en las paredes
      if (suelo) {
        let d = r() * 20;
        while (d < L - 4) {
          const largo = Math.min(L - d, 26 + r() * 80), alto = (4 + r() * 7) * st.mata;
          for (let u = 0; u < largo; u += 4 + r() * 5) {
            const env = Math.sin(Math.PI * (u / largo));
            const rr = 3 + env * alto * (0.6 + r() * 0.5);
            const fuera = rr * 0.2 + env * alto * 0.35 + r() * 2;
            // base: la altura del suelo bajo el grumo (al pisarlo baja hasta ahi; los de encima de otros tambien)
            const base = a[1] + ty * (d + u);
            grumos.push({ x: a[0] + tx * (d + u) - nx * fuera, y: a[1] + ty * (d + u) - ny * fuera, r: rr, tono: r(), base });
            if (env > 0.6 && r() < 0.3) grumos.push({ x: a[0] + tx * (d + u + 3) - nx * (fuera + rr * 0.8), y: a[1] + ty * (d + u + 3) - ny * (fuera + rr * 0.8), r: rr * 0.55, tono: r(), base: a[1] + ty * (d + u + 3) });
          }
          d += largo + r() * r() * 45;
        }
      } else if (!techo) {
        for (let d = r() * 30; d < L - 4; d += 30 + r() * 60) {
          const n = 1 + Math.floor(r() * 3);
          for (let q = 0; q < n; q++) grumos.push({ x: a[0] + tx * (d + q * 5) - nx * 2, y: a[1] + ty * (d + q * 5) - ny * 2, r: 2.5 + r() * 4, tono: r() });
        }
      }
      // guijarros y astillas sobre el suelo
      if (suelo) for (let d = r() * 10; d < L - 2; d += 6 + r() * 16) {
        const tipo = r();
        menudos.push({ x: a[0] + tx * d, y: a[1] + ty * d - 1, tipo: tipo < 0.7 ? 0 : 1, r: 1.4 + r() * 2.6, rot: (r() - 0.5) * 1.2, tono: r() });
      }
      // grietas que entran en la roca desde el borde
      if (L > 40 && r() < 0.5) for (let d = 20 + r() * 40; d < L - 10; d += 70 + r() * 120) {
        const pts = [[a[0] + tx * d, a[1] + ty * d]];
        let x = pts[0][0], y = pts[0][1];
        const n = 2 + Math.floor(r() * 3);
        for (let q = 0; q < n; q++) { const paso = 7 + r() * 9; x += nx * paso + tx * (r() - 0.5) * 10; y += ny * paso + ty * (r() - 0.5) * 10; pts.push([x, y]); }
        grietas.push(pts);
      }
      // colgantes del techo
      if (techo) {
        for (let d = 6; d < L - 6; d += 10 + r() * 22) {
          if (r() < 0.35) continue;
          const largo = (10 + r() * r() * 90) * st.colg, ancho = (4 + r() * 7) * Math.sqrt(st.colg);
          colgantes.push({ x: a[0] + tx * d, y: a[1] + ty * d - 2, largo, ancho, curva: (r() - 0.5) * 10, tono: r() });
        }
      }
    }
  }
  return { piedras, grumos, colgantes, menudos, grietas };
}

const dentroTrozo = (x, y, X0, Y0, m) => x > X0 - m && x < X0 + TROZO + m && y > Y0 - m && y < Y0 + TROZO + m;

function piedras(c, lista, X0, Y0, st) {
  for (const p of lista) {
    if (!dentroTrozo(p.x, p.y, X0, Y0, 20)) continue;
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
    c.beginPath(); c.ellipse(0, 0, p.rx, p.ry, 0, 0, 7);
    c.fillStyle = mezclar(st.piedra, st.piedraOsc, p.fila * 0.3 + p.tono * 0.25); c.fill();
    c.lineWidth = 1.3; c.strokeStyle = st.tinta; c.stroke();
    c.beginPath(); c.ellipse(-p.rx * 0.15, -p.ry * 0.25, p.rx * 0.7, p.ry * 0.5, 0, Math.PI * 1.05, Math.PI * 1.75);
    c.lineWidth = 1; c.strokeStyle = rgba(st.borde, 0.35 - p.fila * 0.1); c.stroke();
    c.restore();
  }
}

function grumos(c, lista, X0, Y0, st) {
  const vis = lista.filter((g) => dentroTrozo(g.x, g.y, X0, Y0, 24));
  if (!vis.length) return;
  // tres pasadas: el contorno de la union, el relleno y las luces (asi solo se entinta el borde de fuera)
  c.beginPath();
  for (const g of vis) { c.moveTo(g.x + g.r, g.y); c.arc(g.x, g.y, g.r, 0, 7); }
  c.lineWidth = 4.2; c.strokeStyle = st.tinta; c.stroke();
  c.fillStyle = st.grumo; c.fill();
  for (const g of vis) {
    c.fillStyle = mezclar(st.grumo, st.grumoClaro, 0.3 + g.tono * 0.5);
    c.beginPath(); c.arc(g.x - g.r * 0.2, g.y - g.r * 0.25, g.r * 0.62, 0, 7); c.fill();
    c.fillStyle = rgba(st.borde, 0.16);
    c.beginPath(); c.arc(g.x - g.r * 0.32, g.y - g.r * 0.42, g.r * 0.24, 0, 7); c.fill();
  }
  // burbujitas de textura
  c.fillStyle = rgba(st.tinta, 0.45);
  for (const g of vis) { if (g.r < 6) continue; c.beginPath(); c.arc(g.x + g.r * 0.3, g.y + g.r * 0.2, g.r * 0.16, 0, 7); c.fill(); }
}

function colgantes(c, lista, X0, Y0, st) {
  const vis = lista.filter((h) => dentroTrozo(h.x, h.y, X0, Y0, 100));
  if (!vis.length) return;
  const forma = (h) => {
    const w = h.ancho, L = h.largo;
    c.moveTo(h.x - w / 2, h.y);
    c.quadraticCurveTo(h.x - w * 0.4 + h.curva * 0.3, h.y + L * 0.5, h.x + h.curva, h.y + L);
    c.quadraticCurveTo(h.x + w * 0.4 + h.curva * 0.3, h.y + L * 0.5, h.x + w / 2, h.y);
    c.closePath();
  };
  c.beginPath(); for (const h of vis) forma(h);
  c.lineWidth = 3.6; c.strokeStyle = st.tinta; c.lineJoin = 'round'; c.stroke();
  c.fillStyle = mezclar(st.grumo, st.piedraOsc, 0.25); c.fill();
  for (const h of vis) {
    c.fillStyle = rgba(st.borde, 0.18 + h.tono * 0.1);
    c.fillRect(h.x - h.ancho * 0.25, h.y + 2, h.ancho * 0.18, h.largo * 0.6);
    if (h.largo > 50) { c.fillStyle = rgba(st.grumoClaro, 0.6); c.beginPath(); c.arc(h.x + h.curva, h.y + h.largo - 2, h.ancho * 0.22, 0, 7); c.fill(); }
  }
}

function menudos(c, lista, X0, Y0, st) {
  for (const q of lista) {
    if (!dentroTrozo(q.x, q.y, X0, Y0, 10)) continue;
    c.save(); c.translate(q.x, q.y); c.rotate(q.rot);
    if (q.tipo === 0) {
      c.beginPath(); c.ellipse(0, -q.r * 0.55, q.r, q.r * 0.6, 0, 0, 7);
      c.fillStyle = mezclar(st.piedra, st.borde, 0.15 + q.tono * 0.25); c.fill();
      c.lineWidth = 0.9; c.strokeStyle = st.tinta; c.stroke();
    } else {
      c.fillStyle = mezclar(st.grumo, st.tinta, 0.4); c.fillRect(-q.r * 2, -1.2, q.r * 4, 1.6);
    }
    c.restore();
  }
}

// ---------------------------------------------------------------- la ciudad (niveles 7 y 8)
// Hormigon de encofrado: tablas horizontales con su junta, coqueras, manchas de agua, grietas y, donde salto un
// trozo, la varilla de dentro (oxido PARDO: el naranja es de la Podredumbre). Todo en grises calidos de la zona.
function hormigon(c, z, X0, Y0, r) {
  for (let k = 0; k < 22; k++) {
    const x = X0 + r() * TROZO, y = Y0 + r() * TROZO, rr = 14 + r() * 50;
    const g = c.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, rgba(r() < 0.55 ? '#000000' : z.masaClara, 0.2)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  // las tablas del encofrado (cada 24 u) y las juntas de hormigonado (cada 96 u), algo torcidas
  c.lineWidth = 1;
  for (let y = Math.floor(Y0 / 24) * 24; y < Y0 + TROZO; y += 24) {
    const junta = y % 96 === 0;
    c.strokeStyle = junta ? 'rgba(0,0,0,.32)' : rgba(z.borde, 0.05);
    c.lineWidth = junta ? 1.6 : 1;
    c.beginPath(); c.moveTo(X0, y + (hash(y, 3) - 0.5) * 2); c.lineTo(X0 + TROZO, y + (hash(y, 4) - 0.5) * 2); c.stroke();
  }
  // coqueras y arido
  for (let k = 0; k < 90; k++) { c.fillStyle = r() < 0.6 ? 'rgba(0,0,0,.28)' : rgba(z.borde, 0.08); c.fillRect(X0 + r() * TROZO, Y0 + r() * TROZO, 1 + r() * 2.2, 1 + r() * 1.6); }
  // chorretones de agua bajo las juntas
  for (let k = 0; k < 5; k++) { const x = X0 + r() * TROZO, y = Math.floor((Y0 + r() * TROZO) / 96) * 96 + 2; c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(x, y, 3 + r() * 5, 20 + r() * 50); }
  // grietas
  c.strokeStyle = 'rgba(0,0,0,.42)'; c.lineWidth = 1;
  for (let k = 0; k < 5; k++) {
    let x = X0 + r() * TROZO, y = Y0 + r() * TROZO;
    c.beginPath(); c.moveTo(x, y);
    for (let q = 0; q < 5; q++) { x += (r() - 0.5) * 26; y += 6 + r() * 14; c.lineTo(x, y); }
    c.stroke();
  }
  // desconchones con la varilla al aire
  for (let k = 0; k < 2; k++) {
    if (r() < 0.4) continue;
    const x = X0 + r() * TROZO, y = Y0 + r() * TROZO, w = 18 + r() * 26, h = 8 + r() * 12;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.4, y - h * 0.5); c.lineTo(x + w, y - h * 0.2); c.lineTo(x + w * 0.8, y + h * 0.5); c.lineTo(x + w * 0.2, y + h * 0.4); c.closePath();
    c.fillStyle = 'rgba(0,0,0,.4)'; c.fill();
    c.strokeStyle = rgba('#5a4636', 0.75); c.lineWidth = 1.6;
    for (let q = 0; q < 2; q++) { c.beginPath(); c.moveTo(x + 2, y + q * 4 - 1); c.lineTo(x + w - 2, y + q * 4 - 2); c.stroke(); }
  }
  rayado(c, X0, Y0, TROZO, TROZO, 11, 'rgba(0,0,0,.08)', -0.95, X0 + Y0);
}
// el firme de cada suelo de la calle: la capa de asfalto (oscura, con grava clara y grietas), la base de hormigon
// algo mas clara debajo, juntas cada tanto y algun bache
function asfalto(c, arriba, X0, Y0, z) {
  for (const [xa, y, xb] of arriba) {
    if (xb < X0 - 40 || xa > X0 + TROZO + 40 || y < Y0 - 40 || y > Y0 + TROZO + 40) continue;
    c.fillStyle = '#1b1a19'; c.fillRect(xa - 4, y - 2, xb - xa + 8, 12);
    c.fillStyle = rgba(z.masaClara, 0.55); c.fillRect(xa - 4, y + 10, xb - xa + 8, 7);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(xa - 4, y + 17, xb - xa + 8, 2);
    // grava del asfalto
    for (let x = Math.max(xa, X0 - 10); x < Math.min(xb, X0 + TROZO + 10); x += 3) {
      const h = hash(Math.round(x), 51);
      if (h < 0.55) continue;
      c.fillStyle = h > 0.85 ? rgba(z.borde, 0.28) : 'rgba(255,255,255,.07)';
      c.fillRect(x, y + 1 + hash(Math.round(x), 52) * 7, 1.4, 1.2);
    }
    // juntas y baches
    for (let x = Math.ceil(xa / 160) * 160 + 40; x < xb - 10; x += 160) {
      if (x < X0 - 40 || x > X0 + TROZO + 40) continue;
      const h = hash(x, 53);
      c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (h - 0.5) * 6, y + 9); c.stroke();
      if (h > 0.6) { c.fillStyle = '#0d0c0c'; c.beginPath(); c.ellipse(x + 50, y + 1.5, 14 + h * 10, 2.4, 0, 0, Math.PI); c.fill(); }
    }
  }
}
// del techo de un cajon o de una losa cuelgan varillas dobladas y algun trozo de hormigon todavia agarrado
function varillas(c, lista, X0, Y0, st) {
  const vis = lista.filter((h) => dentroTrozo(h.x, h.y, X0, Y0, 100));
  if (!vis.length) return;
  c.lineCap = 'round';
  for (const h of vis) {
    const n = 1 + Math.floor(h.tono * 3), L = Math.min(70, h.largo * 0.75);
    for (let q = 0; q < n; q++) {
      const x = h.x + (q - (n - 1) / 2) * 5, dob = h.curva * (0.6 + q * 0.3);
      c.beginPath(); c.moveTo(x, h.y); c.quadraticCurveTo(x + dob * 0.2, h.y + L * 0.6, x + dob, h.y + L * (0.7 + q * 0.12));
      c.strokeStyle = st.tinta; c.lineWidth = 3; c.stroke();
      c.strokeStyle = '#4a3a2e'; c.lineWidth = 1.6; c.stroke();
    }
    if (h.tono > 0.7 && h.largo > 40) {
      const x = h.x + h.curva * 0.4, y = h.y + L * 0.45, w = 9 + h.ancho;
      c.beginPath(); c.moveTo(x - w / 2, y - 3); c.lineTo(x + w / 2, y - 5); c.lineTo(x + w * 0.4, y + 6); c.lineTo(x - w * 0.3, y + 5); c.closePath();
      c.fillStyle = mezclar(st.piedra, st.piedraOsc, 0.4); c.fill(); c.lineWidth = 1.4; c.strokeStyle = st.tinta; c.stroke();
    }
  }
}
// cascotes de hormigon sueltos por el suelo (de los grumos del borde solo una parte: la calle esta barrida a medias)
function cascotes(c, lista, X0, Y0, st) {
  for (const gq of lista) {
    if (!dentroTrozo(gq.x, gq.y, X0, Y0, 20) || hash(Math.round(gq.x), Math.round(gq.y)) > 0.16) continue;
    const r = Math.max(2.5, gq.r * 0.75), x = gq.x, y = gq.y + gq.r * 0.4;
    c.beginPath(); c.moveTo(x - r, y + 2); c.lineTo(x - r * 0.7, y - r * 0.8); c.lineTo(x + r * 0.2, y - r * (0.9 + gq.tono * 0.4)); c.lineTo(x + r, y - r * 0.3); c.lineTo(x + r * 0.9, y + 2); c.closePath();
    c.fillStyle = mezclar(st.piedra, st.borde, 0.12 + gq.tono * 0.2); c.fill();
    c.lineWidth = 1.3; c.strokeStyle = st.tinta; c.stroke();
    c.fillStyle = rgba(st.borde, 0.35); c.fillRect(x - r * 0.6, y - r * 0.85, r * 0.9, 1.2);
  }
}

// ---------------------------------------------------------------- el bosque (el Linde)
// Tierra oscura por manchas y RAICES que la cruzan (en vez de las varillas de la ciudad)
function tierra(c, z, X0, Y0, r) {
  for (let k = 0; k < 24; k++) {
    const x = X0 + r() * TROZO, y = Y0 + r() * TROZO, rr = 12 + r() * 46;
    const g = c.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, rgba(r() < 0.55 ? '#000000' : '#4a3f26', 0.22)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  // raices: curvas que bajan, gruesas con su canto claro, y alguna rama fina
  c.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    let x = X0 + r() * TROZO, y = Y0 + r() * TROZO * 0.6;
    const pts = [[x, y]];
    for (let q = 0; q < 5; q++) { x += (r() - 0.5) * 50; y += 14 + r() * 24; pts.push([x, y]); }
    const w = 2.5 + r() * 4;
    for (const [lw, col] of [[w + 2, 'rgba(10,8,4,.55)'], [w, 'rgba(70,56,34,.55)'], [w * 0.35, 'rgba(160,130,80,.25)']]) {
      c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let q = 1; q < pts.length; q++) c.quadraticCurveTo(pts[q - 1][0], pts[q - 1][1], (pts[q - 1][0] + pts[q][0]) / 2, (pts[q - 1][1] + pts[q][1]) / 2);
      c.stroke();
    }
    if (r() < 0.6) { const [a, b] = pts[2]; c.strokeStyle = 'rgba(30,24,14,.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo(a + 14, b + 6, a + 22 + r() * 14, b + 18); c.stroke(); }
  }
  rayado(c, X0, Y0, TROZO, TROZO, 11, 'rgba(0,0,0,.13)', -0.95, X0 + Y0);
}

// ZARZAS (el '^' del bosque): mata negra con tallos leñosos en arco y PINCHOS GRANDES Y CLAROS, que hacen dano.
// La primera version eran tallos finos con pinchos negros de 3-6 px: sobre el fondo oscuro parecian hierba y el
// jugador perdia vida sin saber por que. Lo que avisa del peligro es la silueta de ganchos claros.
function zarzas(c, i, j) {
  const r = azar(i * 977 + j * 131), yb = (j + 1) * T, x0t = i * T;
  c.lineCap = 'round'; c.lineJoin = 'round';
  // la mata oscura del pie, con el borde de arriba en dientes
  c.fillStyle = TINTA; c.beginPath(); c.moveTo(x0t - 2, yb);
  for (let q = 0; q <= 6; q++) c.lineTo(x0t - 2 + (q * (T + 4)) / 6, yb - (q % 2 ? 13 + r() * 6 : 6 + r() * 4));
  c.lineTo(x0t + T + 2, yb); c.closePath(); c.fill();
  const tallos = [];
  for (let k = 0; k < 3; k++) {
    const x0 = x0t - 4 + r() * (T + 8), h = 15 + r() * 12, x1 = x0 + (r() - 0.5) * 34, cx = (x0 + x1) / 2 + (r() - 0.5) * 14;
    const camino = () => { c.beginPath(); c.moveTo(x0, yb); c.quadraticCurveTo(cx, yb - h * 2, x1, yb - 2); };
    camino(); c.strokeStyle = TINTA; c.lineWidth = 5.5; c.stroke();
    camino(); c.strokeStyle = '#34331b'; c.lineWidth = 2.2; c.stroke();
    tallos.push([x0, cx, x1, h]);
  }
  // los pinchos: ganchos claros que salen del tallo hacia fuera, ladeados
  for (const [x0, cx, x1, h] of tallos) for (let q = 1; q < 6; q++) {
    const t = q / 6 + (r() - 0.5) * 0.06, u = 1 - t, ya = yb - h * 2;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * yb + 2 * u * t * ya + t * t * (yb - 2);
    const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (ya - yb) + 2 * t * (yb - 2 - ya), L = Math.hypot(dx, dy) || 1;
    const tx = dx / L, ty = dy / L; let nx = -ty, ny = tx; if (ny > 0) { nx = -nx; ny = -ny; }
    if (r() < 0.3) { nx = -nx; ny = -ny; }                   // alguno hacia dentro del arco
    const l = 6.5 + r() * 4, w = 2.3, s = r() < 0.5 ? 1 : -1, pxx = x + nx * l + tx * s * l * 0.4, pyy = y + ny * l + ty * s * l * 0.4;
    c.beginPath(); c.moveTo(x - tx * w, y - ty * w); c.quadraticCurveTo(x + nx * l * 0.55 - tx * s * 1.5, y + ny * l * 0.55 - ty * s * 1.5, pxx, pyy); c.lineTo(x + tx * w, y + ty * w); c.closePath();
    c.fillStyle = '#e2d5ae'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = TINTA; c.stroke();
  }
  c.fillStyle = TINTA; c.fillRect(x0t, yb - 3, T, 3);
}
