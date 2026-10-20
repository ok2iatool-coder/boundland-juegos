// LA PROFUNDIDAD DE LA CALLE DEL PROLOGO (2026-10-20, pedido: «mete profundidad, hazlo algo 3D: un coche mas
// lejano, escombros detallados uno mas cerca que otros»). Tres capas que se mueven distinto al pasar la camara:
//   lejos  (parallax 0,7, a 0,6 de tamaño, el suelo algo mas arriba y todo mas claro y azulado: la niebla) coches
//          abandonados (uno volcado), una barricada de sacos y barreras de hormigon, una farola caida, escombros
//   medio  en la calle, en DOS planos (2026-10-20, pedido: «un objeto mas cercano tiene que aparecer por delante del
//          plano de los vehiculos, y uno del fondo por detras»): 'tras' (en la acera de enfrente: su pie por ENCIMA
//          de la raya por la que ruedan, algo mas pequeño y mas claro, pintado antes del convoy) y 'delante' (en la
//          acera de este lado: su pie por DEBAJO de la raya, algo mas grande y mas oscuro, pintado despues del convoy
//          y de las bestias). Nada de un plano cruza la raya del otro: la señal caida, pintada detras pero con el palo
//          por debajo de las ruedas, parecia delante del jeep
//   cerca  (parallax 1,5, a 1,3, muy oscura y desenfocada, pintada encima de todo) la esquina de un coche, una losa con
//          su ferralla, sacos terreros, un neumatico, un bidon volcado y alambre de espino que pasan por delante
// La de cerca se pinta una vez por pieza en su lienzo ya desenfocado; las otras, a mano en cada fotograma.
import { TINTA, temblar, trazar, tinta, azar, hash, mezclar } from '../dibujo/tinta.js';
import { dibujarCoche } from '../dibujo/coche.js';

const SUELO = 512;
const FL = 0.7, EL = 0.6, FC = 1.5, EC = 1.3;

// los colores de lejos: claros, azulados y con poco contraste (asi se lee la distancia en la niebla)
const NL = '#5c6a80', NL_O = '#46536a', NL_C = '#75849a', TL = '#3a4558';

export class Calle {
  constructor() {
    const r = azar(2027);
    // lejos: de -600 a 2600 (x de su capa)
    this.lejos = [];
    const tipos = ['coche', 'escombros', 'barricada', 'coche_vuelto', 'farola', 'escombros', 'coche', 'barreras', 'escombros', 'coche', 'barricada', 'escombros'];
    let x = -500;
    for (const tipo of tipos) { this.lejos.push({ tipo, x, sem: Math.floor(r() * 1000) }); x += 260 + r() * 220; }
    // medio: en la calle (x del mundo), en la acera de enfrente o en la de este lado
    this.medio = [];
    const PLANOS = [['monton', 'tras'], ['senal', 'delante'], ['monton', 'tras'], ['tapa', 'delante'], ['monton', 'delante'], ['monton', 'tras'], ['senal', 'tras'], ['tapa', 'delante'], ['monton', 'tras'], ['monton', 'delante']];
    for (let k = 0; k < 12; k++) { const [tipo, plano] = PLANOS[k % PLANOS.length]; this.medio.push({ tipo, plano, x: -220 + k * 290 + r() * 110, sem: 40 + k }); }
    // cerca: de -400 a 3200 (x de su capa)
    this.cerca = [];
    const tc = ['losa', 'sacos', 'coche', 'neumatico', 'alambre', 'bidon', 'losa', 'sacos', 'neumatico', 'coche', 'alambre', 'losa'];
    x = -300;
    for (const tipo of tc) { this.cerca.push({ tipo, x, sem: Math.floor(r() * 1000), cv: null }); x += 520 + r() * 420; }     // pasan de vez en cuando
  }

  // ---------------------------------------------------------------- lejos (en el mundo, antes del convoy)
  dibujarLejos(ctx, cam) {
    ctx.save(); ctx.translate(cam.x * (1 - FL), 0);
    const x0 = cam.x * FL - 400, x1 = cam.x * FL + cam.w + 400, y = SUELO - 24;
    // la acera de enfrente: una franja de suelo algo mas clara
    ctx.fillStyle = 'rgba(92,106,128,.35)'; ctx.fillRect(x0, y - 2, x1 - x0, 6);
    for (const q of this.lejos) {
      if (q.x < x0 || q.x > x1) continue;
      ctx.save(); ctx.translate(q.x, y); ctx.scale(EL, EL);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (q.tipo === 'coche' || q.tipo === 'coche_vuelto') {
        dibujarCoche(ctx, { semilla: q.sem, vuelto: q.tipo === 'coche_vuelto', pintura: mezclar(NL, '#6a6f7a', hash(q.sem, 2)), verde: NL_O, verdeClaro: NL_C });
        ctx.fillStyle = 'rgba(70,85,105,.35)'; ctx.fillRect(-150, -110, 300, 112);      // la niebla por delante
      } else if (q.tipo === 'barricada') {
        for (let fila = 0; fila < 3; fila++) for (let k = 0; k < 6 - fila; k++) {
          const sx = -110 + k * 40 + fila * 20, sy = -16 - fila * 26;
          ctx.beginPath(); ctx.ellipse(sx, sy, 22, 13, 0, 0, 7); ctx.fillStyle = mezclar(NL, NL_C, hash(k, fila, q.sem)); ctx.fill(); tinta(ctx, 1.6, TL);
        }
        ctx.strokeStyle = TL; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-80, -90); ctx.lineTo(-80, -180); ctx.lineTo(-20, -168); ctx.stroke();   // un mastil con su trapo
        trazar(ctx, [[-80, -180], [-20, -168], [-26, -140], [-80, -150]]); ctx.fillStyle = NL_C; ctx.fill();
      } else if (q.tipo === 'barreras') {
        for (let k = 0; k < 3; k++) { trazar(ctx, temblar([[-150 + k * 100, 0], [-60 + k * 100, 0], [-78 + k * 100, -70], [-132 + k * 100, -70]], 10, 1, q.sem + k)); ctx.fillStyle = mezclar(NL, NL_C, 0.4); ctx.fill(); tinta(ctx, 1.8, TL); }
      } else if (q.tipo === 'farola') {
        ctx.save(); ctx.rotate(-0.22); ctx.fillStyle = NL_O; ctx.fillRect(-10, -8, 300, 12); ctx.strokeStyle = TL; ctx.lineWidth = 2; ctx.strokeRect(-10, -8, 300, 12);
        trazar(ctx, [[290, -14], [330, -20], [334, 6], [290, 6]]); ctx.fillStyle = NL; ctx.fill(); tinta(ctx, 1.8, TL); ctx.restore();
      } else {
        // un monton de escombros: losas, ladrillos y varillas
        const pts = []; for (let k = 0; k <= 10; k++) { const f = k / 10; pts.push([-160 + f * 320, -Math.sin(f * Math.PI) * (60 + hash(k, q.sem) * 40)]); }
        trazar(ctx, temblar([...pts, [160, 0], [-160, 0]], 14, 3, q.sem)); ctx.fillStyle = NL_O; ctx.fill(); tinta(ctx, 1.6, TL);
        for (let k = 0; k < 7; k++) { const bx = -120 + hash(k, q.sem + 1) * 240, by = -10 - hash(k, q.sem + 2) * 60; ctx.save(); ctx.translate(bx, by); ctx.rotate(hash(k, q.sem + 3) * 3); ctx.fillStyle = NL_C; ctx.fillRect(-14, -6, 28, 12); ctx.restore(); }
        ctx.strokeStyle = TL; ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) { const bx = -90 + k * 60; ctx.beginPath(); ctx.moveTo(bx, -40); ctx.quadraticCurveTo(bx + 14, -90, bx + 30 + k * 6, -110 + k * 10); ctx.stroke(); }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- medio (en la calle: 'tras' o 'delante' del convoy)
  dibujarMedio(ctx, cam, plano = 'tras') {
    const x0 = cam.x - 300, x1 = cam.x + cam.w + 300, tras = plano === 'tras';
    // (el pie: la acera de enfrente queda 16 u por encima de la raya del convoy; la de este lado, 26 u por debajo)
    const pie = tras ? SUELO - 16 : SUELO + 26, esc = tras ? 0.84 : 1.14;
    for (const q of this.medio) {
      if (q.plano !== plano || q.x < x0 || q.x > x1) continue;
      ctx.save(); ctx.translate(q.x, pie); ctx.scale(esc, esc); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (!tras) ctx.filter = 'brightness(0.62)';         // lo de este lado, mas oscuro (contraluz)
      if (q.tipo === 'monton') {
        const pts = []; for (let k = 0; k <= 8; k++) { const f = k / 8; pts.push([-90 + f * 180, -Math.sin(f * Math.PI) * (26 + hash(k, q.sem) * 20)]); }
        trazar(ctx, temblar([...pts, [90, 2], [-90, 2]], 12, 2, q.sem)); ctx.fillStyle = '#2b2f36'; ctx.fill(); tinta(ctx, 2);
        // ladrillos (los de arriba con su luz) y las varillas retorcidas
        for (let k = 0; k < 9; k++) {
          const bx = -70 + hash(k, q.sem + 1) * 140, by = -6 - hash(k, q.sem + 2) * 30;
          ctx.save(); ctx.translate(bx, by); ctx.rotate((hash(k, q.sem + 3) - 0.5) * 2);
          ctx.fillStyle = mezclar('#4a3f38', '#2c2723', hash(k, q.sem + 4)); ctx.fillRect(-9, -4, 18, 8); ctx.strokeStyle = TINTA; ctx.lineWidth = 1.2; ctx.strokeRect(-9, -4, 18, 8);
          ctx.fillStyle = 'rgba(200,205,215,.15)'; ctx.fillRect(-9, -4, 18, 2);
          ctx.restore();
        }
        ctx.strokeStyle = '#3a3029'; ctx.lineWidth = 2.2;
        for (let k = 0; k < 3; k++) { const bx = -40 + k * 40; ctx.beginPath(); ctx.moveTo(bx, -20); ctx.bezierCurveTo(bx + 8, -46, bx - 10, -56, bx + 14 + k * 4, -70 + k * 8); ctx.stroke(); }
        ctx.fillStyle = 'rgba(200,215,230,.25)'; for (let k = 0; k < 5; k++) { const gx = -60 + hash(k, q.sem + 6) * 120; trazar(ctx, [[gx, -2], [gx + 5, -6], [gx + 8, -1]]); ctx.fill(); }   // cristales
      } else if (q.tipo === 'senal' && tras) {
        // de pie, torcida hacia atras: el poste clavado en la acera de enfrente
        ctx.save(); ctx.rotate(-0.32 + hash(q.sem, 4) * 0.2);
        ctx.fillStyle = '#2f333a'; ctx.fillRect(-4, -150, 8, 150); ctx.strokeStyle = TINTA; ctx.lineWidth = 2; ctx.strokeRect(-4, -150, 8, 150);
        ctx.save(); ctx.translate(0, -150);
        trazar(ctx, [[0, -34], [30, -4], [0, 26], [-30, -4]]); ctx.fillStyle = '#41454c'; ctx.fill(); tinta(ctx, 2.2);
        ctx.strokeStyle = 'rgba(190,185,165,.35)'; ctx.lineWidth = 2; trazar(ctx, [[0, -20], [14, -4], [0, 10], [-14, -4]]); ctx.stroke();
        ctx.restore(); ctx.restore();
      } else if (q.tipo === 'senal') {
        // tumbada en la acera de este lado: todo por encima de su pie (el palo hacia atras y arriba, sin pasar por debajo)
        ctx.save(); ctx.translate(-60, -34); ctx.rotate(-Math.PI / 2 - 0.12);
        ctx.fillStyle = '#2a2d33'; ctx.fillRect(-4, -6, 8, 120); ctx.strokeStyle = TINTA; ctx.lineWidth = 2; ctx.strokeRect(-4, -6, 8, 120);
        trazar(ctx, [[0, -40], [32, -6], [0, 28], [-32, -6]]); ctx.fillStyle = '#3b3f46'; ctx.fill(); tinta(ctx, 2.2);
        ctx.strokeStyle = 'rgba(190,185,165,.35)'; ctx.lineWidth = 2; trazar(ctx, [[0, -24], [16, -6], [0, 12], [-16, -6]]); ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.ellipse(0, 0, 34, 5, 0, 0, 7); ctx.fillStyle = '#1d2026'; ctx.fill(); tinta(ctx, 1.6);
        ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 10 - 5, -2); ctx.lineTo(k * 10 + 5, 2); ctx.stroke(); }
      }
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- cerca (en pantalla, encima de todo)
  pieza(q, s) {
    if (q.cv && q.s === s) return q.cv;
    const W = 520, H = 420, k = Math.min(1.5, s * EC), cv = document.createElement('canvas');
    cv.width = Math.ceil(W * k); cv.height = Math.ceil(H * k);
    const c = cv.getContext('2d');
    c.setTransform(k, 0, 0, k, (W / 2) * k, (H - 60) * k);        // origen: el suelo en el centro
    c.lineJoin = 'round'; c.lineCap = 'round';
    const negro = '#07080a', borde = 'rgba(150,170,200,.16)';
    if (q.tipo === 'losa') {
      trazar(c, temblar([[-200, 0], [-170, -90], [120, -120], [190, -40], [170, 20], [-190, 20]], 20, 4, q.sem)); c.fillStyle = negro; c.fill(); tinta(c, 4);
      c.strokeStyle = '#1c1714'; c.lineWidth = 6; for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(180, -60 + j * 18); c.bezierCurveTo(220, -80 + j * 12, 230, -20 + j * 10, 250 + j * 6, -110 + j * 24); c.stroke(); }
      c.strokeStyle = borde; c.lineWidth = 4; c.beginPath(); c.moveTo(-168, -88); c.lineTo(118, -118); c.stroke();
    } else if (q.tipo === 'sacos') {
      for (let fila = 0; fila < 3; fila++) for (let j = 0; j < 5 - fila; j++) {
        c.beginPath(); c.ellipse(-160 + j * 72 + fila * 36, -22 - fila * 44, 40, 24, 0, 0, 7); c.fillStyle = negro; c.fill(); tinta(c, 3);
        c.strokeStyle = borde; c.lineWidth = 3; c.beginPath(); c.ellipse(-160 + j * 72 + fila * 36, -26 - fila * 44, 30, 14, 0, Math.PI * 1.1, Math.PI * 1.8); c.stroke();
      }
    } else if (q.tipo === 'coche') {
      c.save(); c.scale(1.2, 1.2); c.translate(-60, 0);
      dibujarCoche(c, { semilla: q.sem, pintura: '#0d0e11', verde: '#0a0b0c', verdeClaro: '#14161a' });
      c.restore();
    } else if (q.tipo === 'neumatico') {
      c.beginPath(); c.ellipse(0, -50, 70, 50, 0.1, 0, 7); c.fillStyle = negro; c.fill(); tinta(c, 4);
      c.beginPath(); c.ellipse(0, -50, 32, 22, 0.1, 0, 7); c.fillStyle = '#121418'; c.fill(); tinta(c, 3);
      c.strokeStyle = borde; c.lineWidth = 4; c.beginPath(); c.ellipse(0, -50, 62, 44, 0.1, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
    } else if (q.tipo === 'bidon') {
      c.save(); c.rotate(-0.08);
      trazar(c, temblar([[-120, 0], [110, 0], [110, -78], [-120, -78]], 20, 2, q.sem)); c.fillStyle = negro; c.fill(); tinta(c, 4);
      for (const x of [-60, 0, 60]) { c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, -76); c.lineTo(x, -2); c.stroke(); }
      c.beginPath(); c.ellipse(110, -39, 14, 39, 0, 0, 7); c.fillStyle = '#121418'; c.fill(); tinta(c, 3);
      c.restore();
    } else {
      // alambre de espino: un rollo en espiral con sus pinchos y dos piquetes
      c.strokeStyle = negro; c.lineWidth = 3;
      for (let j = 0; j < 9; j++) { c.beginPath(); c.ellipse(-200 + j * 50, -60, 34, 56, 0.3, 0, 7); c.stroke(); }
      c.lineWidth = 2; for (let j = 0; j < 40; j++) { const x = -230 + j * 11, y = -60 + Math.sin(j * 1.7) * 50; c.beginPath(); c.moveTo(x - 4, y - 4); c.lineTo(x + 4, y + 4); c.moveTo(x + 4, y - 4); c.lineTo(x - 4, y + 4); c.stroke(); }
      for (const x of [-230, 220]) { c.lineWidth = 7; c.beginPath(); c.moveTo(x, 10); c.lineTo(x + 6, -130); c.stroke(); }
    }
    // desenfocada una vez aqui
    const b = document.createElement('canvas'); b.width = cv.width; b.height = cv.height;
    const bc = b.getContext('2d'); bc.filter = `blur(${(3.2 * k).toFixed(1)}px)`; bc.drawImage(cv, 0, 0);
    q.cv = b; q.s = s; q.k = k; q.W = W; q.H = H;
    return b;
  }
  // cx, cy: la camara (u); pinta en pantalla, con la transformacion de pantalla puesta
  dibujarCerca(ctx, s, cx, cy, W, H) {
    for (const q of this.cerca) {
      // (su suelo por debajo del borde de la pantalla: solo asoman, y al bajar la camara se van hacia arriba deprisa)
      const X = (q.x - cx * FC) * s, Y = (SUELO + 132 - (cy - 32) * 1.5) * s;     // (con +96 tapaban las ruedas del convoy; con +165 se quedaban bajo la franja de cine)
      if (X < -700 * s || X > W + 700 * s) continue;
      const cv = this.pieza(q, s), e = EC * s / q.k;
      ctx.drawImage(cv, X - (q.W / 2) * q.k * e, Y - (q.H - 60) * q.k * e, cv.width * e, cv.height * e);
    }
  }
}
