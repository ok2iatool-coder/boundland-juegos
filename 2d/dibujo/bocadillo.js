// EL BOCADILLO de lo que dice un personaje (de momento solo el 18 al despertar: «¿Que ha sucedido? ¿Donde estoy?").
// Papel claro con la tinta del juego, temblado a mano, y una cola que baja hasta la cabeza de quien habla. El texto
// se escribe letra a letra (quien llama dice cuantas se ven) con la letra de las notas.
// Coordenadas de pantalla: (x, y) es la punta de la cola; el globo queda encima y a la derecha.
import { LETRA } from '../hud.js';

export function bocadillo(c, x, y, lineas, visibles, u, alfa = 1, crece = 1) {
  if (alfa <= 0) return;
  c.save();
  c.globalAlpha = alfa;
  c.font = `${16 * u}px ${LETRA}`;
  c.textBaseline = 'middle'; c.textAlign = 'left';
  // el globo se hace a la medida de las lineas enteras (asi no crece mientras se escribe)
  const anchos = lineas.map((l) => c.measureText(l).width);
  const pad = 12 * u, alto = 21 * u, w = Math.max(...anchos) + pad * 2, h = lineas.length * alto + pad * 1.4;
  const bx = x + 10 * u, by = y - 16 * u - h;
  // aparece con un saltito desde la cola
  c.translate(x, y); c.scale(crece, crece); c.translate(-x, -y);
  const cuerpo = (dx, dy) => {
    const r = 9 * u;
    c.beginPath();
    c.moveTo(bx + r + dx, by + dy);
    c.lineTo(bx + w - r + dx, by + 1 * u + dy); c.quadraticCurveTo(bx + w + dx, by + dy, bx + w + dx, by + r + dy);
    c.lineTo(bx + w - 1 * u + dx, by + h - r + dy); c.quadraticCurveTo(bx + w + dx, by + h + dy, bx + w - r + dx, by + h + dy);
    // la cola: sale del borde de abajo, cerca de la esquina izquierda, y baja hasta la cabeza
    c.lineTo(bx + 30 * u + dx, by + h + dy); c.lineTo(x + dx, y + dy); c.lineTo(bx + 16 * u + dx, by + h - 0.5 * u + dy);
    c.lineTo(bx + r + dx, by + h + dy); c.quadraticCurveTo(bx + dx, by + h + dy, bx + dx, by + h - r + dy);
    c.lineTo(bx + 1 * u + dx, by + r + dy); c.quadraticCurveTo(bx + dx, by + dy, bx + r + dx, by + dy);
    c.closePath();
  };
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 14 * u; c.shadowOffsetY = 3 * u;
  cuerpo(0, 0); c.fillStyle = '#ebe4d4'; c.fill();
  c.shadowColor = 'transparent';
  c.lineJoin = 'round';
  c.strokeStyle = '#17161b'; c.lineWidth = 2.2 * u; c.stroke();
  cuerpo(0.8 * u, -0.6 * u); c.strokeStyle = 'rgba(23,22,27,.35)'; c.lineWidth = 1 * u; c.stroke();     // el segundo trazo, a mano
  // el texto
  c.fillStyle = '#2b2620';
  let quedan = visibles;
  lineas.forEach((l, i) => {
    if (quedan <= 0) return;
    const parte = l.slice(0, Math.max(0, Math.floor(quedan)));
    c.fillText(parte, bx + pad, by + pad * 0.7 + alto * (i + 0.5));
    quedan -= l.length;
  });
  c.restore();
}
