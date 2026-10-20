// La INTERFAZ del trozo, en DOM encima del lienzo: reloj, vales y mochila arriba a la derecha; el objetivo arriba a la
// izquierda; avisos arriba en el centro; la accion posible abajo («E · Hablar con Ramiro», con barra al recoger); la
// CONVERSACION abajo (el 18 contesta con sus cuatro gestos: cada opcion lleva su tecla 1-4, o E si es dar o coger); y
// los PANELES en el centro (mochila, banco de trabajo, tienda, tablon, obra, baul, diario). Los paneles se pintan
// desde el estado de la partida y sus botones mandan una accion `tipo:dato` a quien los abrio.
import { OBJETOS, RECETAS, OBRA_POZO } from './sim/datos.js';
import * as P from './sim/partida.js';
import { GESTOS } from './sim/dialogos.js';

const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; font: 14px/1.45 Bahnschrift, "Segoe UI", system-ui, sans-serif; color: #f2ecdc; z-index: 5; }
#hud .caja { background: rgba(22,24,18,.72); border: 1px solid rgba(255,255,255,.13); border-radius: 8px; backdrop-filter: blur(3px); }
#hud .estado { position: absolute; right: 16px; top: 14px; padding: 8px 12px; text-align: right; min-width: 150px; }
#hud .estado .hora { font-size: 17px; letter-spacing: .06em; }
#hud .estado .fila { opacity: .9; }
#hud .estado b { color: #e7c873; font-weight: 600; }
#hud .objetivo { position: absolute; left: 18px; top: 74px; max-width: 360px; padding: 8px 12px; }
#hud .objetivo .t { font-size: 11px; letter-spacing: .25em; opacity: .65; }
#hud .objetivo .o { margin-top: 2px; }
#hud .objetivo .o + .o { opacity: .8; font-size: 13px; }
#hud .avisos { position: absolute; left: 50%; top: 16px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; }
#hud .aviso { padding: 5px 12px; border-radius: 16px; background: rgba(22,24,18,.78); border: 1px solid rgba(255,255,255,.12); animation: hudEntra .25s ease-out; white-space: nowrap; }
#hud .aviso.diario { background: rgba(58,48,28,.9); border-color: rgba(231,200,115,.5); white-space: normal; max-width: 520px; text-align: center; }
#hud .aviso.vales { color: #e7c873; } #hud .aviso.aviso { color: #f0a58a; } #hud .aviso.receta { color: #b9d58c; }
#hud .aviso.sale { opacity: 0; transition: opacity .5s; }
@keyframes hudEntra { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
#hud .accion { position: absolute; left: 50%; bottom: 120px; transform: translateX(-50%); padding: 7px 14px; display: none; text-align: center; }
#hud .accion .barra { height: 4px; margin-top: 6px; background: rgba(255,255,255,.15); border-radius: 2px; overflow: hidden; }
#hud .accion .barra i { display: block; height: 100%; width: 0; background: #e7c873; }
#hud kbd { display: inline-block; min-width: 18px; padding: 0 6px; margin-right: 6px; border: 1px solid rgba(231,200,115,.75); border-radius: 4px; color: #e7c873; font: 600 12px/20px inherit; text-align: center; }
#hud .dialogo { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(720px, calc(100vw - 32px)); padding: 14px 18px 12px; display: none; pointer-events: auto; }
#hud .dialogo .quien { font-size: 12px; letter-spacing: .22em; color: #e7c873; }
#hud .dialogo .quien span { color: #f2ecdc; opacity: .6; letter-spacing: .08em; margin-left: 8px; }
#hud .dialogo .texto { font-size: 16px; margin: 6px 0 10px; }
#hud .dialogo .ops { display: flex; flex-wrap: wrap; gap: 6px; }
#hud .op { pointer-events: auto; cursor: pointer; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); border-radius: 6px; color: inherit; font: inherit; padding: 5px 10px; text-align: left; }
#hud .op:hover { background: rgba(231,200,115,.16); }
#hud .op small { opacity: .6; margin-right: 6px; }
#hud .panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(640px, calc(100vw - 32px)); max-height: min(78vh, 720px); overflow: auto; padding: 16px 18px; display: none; pointer-events: auto; background: rgba(22,24,18,.9); }
#hud .panel h2 { margin: 0 0 2px; font-size: 13px; letter-spacing: .3em; font-weight: 600; color: #e7c873; }
#hud .panel .sub { opacity: .65; font-size: 12px; margin-bottom: 10px; }
#hud .panel table { width: 100%; border-collapse: collapse; }
#hud .panel td, #hud .panel th { padding: 5px 6px; border-bottom: 1px solid rgba(255,255,255,.07); text-align: left; font-weight: normal; }
#hud .panel th { font-size: 11px; letter-spacing: .15em; opacity: .55; }
#hud .panel td.n { text-align: right; font-variant-numeric: tabular-nums; }
#hud .panel button { pointer-events: auto; cursor: pointer; background: rgba(231,200,115,.14); border: 1px solid rgba(231,200,115,.45); color: #f2ecdc; border-radius: 5px; font: inherit; font-size: 12px; padding: 3px 9px; margin-left: 4px; }
#hud .panel button:disabled { opacity: .35; cursor: default; }
#hud .panel button:hover:not(:disabled) { background: rgba(231,200,115,.3); }
#hud .panel .pie { margin-top: 10px; opacity: .6; font-size: 12px; }
#hud .sube { color: #f0a58a; } #hud .baja { color: #b9d58c; }
#hud .panel .receta { display: flex; justify-content: space-between; align-items: center; padding: 7px 4px; border-bottom: 1px solid rgba(255,255,255,.07); }
#hud .panel .receta .pide { opacity: .75; font-size: 12px; }
#hud .panel .falta { color: #f0a58a; }
#hud .panel .barraObra { height: 6px; background: rgba(255,255,255,.12); border-radius: 3px; overflow: hidden; margin: 3px 0 8px; }
#hud .panel .barraObra i { display: block; height: 100%; background: #e7c873; }
#hud .panel .diario p { margin: 4px 0; }
#hud .panel .diario small { opacity: .55; margin-right: 6px; }
#hud .fundido { position: absolute; inset: 0; background: #0d0f0c; opacity: 0; transition: opacity .8s; }
body.hud-ocupado #ayuda { display: none; }
`;

const nombre = (id) => OBJETOS[id].nombre;
const fmt = (v) => (Math.round(v * 10) / 10).toLocaleString('es-ES');

export function crearHud() {
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  const raiz = document.createElement('div');
  raiz.id = 'hud';
  raiz.innerHTML = `
    <div class="fundido"></div>
    <div class="estado caja"><div class="hora"></div><div class="fila vales"></div><div class="fila carga"></div></div>
    <div class="objetivo caja"><div class="t">AHORA</div><div class="lista"></div></div>
    <div class="avisos"></div>
    <div class="accion caja"><div class="txt"></div><div class="barra"><i></i></div></div>
    <div class="dialogo caja"><div class="quien"></div><div class="texto"></div><div class="ops"></div></div>
    <div class="panel caja"></div>`;
  document.body.appendChild(raiz);
  const $ = (s) => raiz.querySelector(s);
  const H = { dialogoAbierto: false, panelAbierto: null, alElegir: null, alAccion: null };

  let ultimoEstado = '';
  H.estado = (p, noche) => {
    const s = `${P.reloj(p)}|${p.vales}|${P.carga(p)}|${P.capacidad(p)}|${noche}`;
    if (s === ultimoEstado) return;
    ultimoEstado = s;
    $('.hora').textContent = `${noche ? '☾' : '☀'}  ${P.reloj(p)}`;
    $('.vales').innerHTML = `<b>${fmt(p.vales)}</b> vales`;
    $('.carga').textContent = `mochila ${P.carga(p)} / ${P.capacidad(p)}`;
  };
  let ultimoObj = '';
  H.objetivo = (lineas) => {
    const s = lineas.join('|');
    if (s === ultimoObj) return;
    ultimoObj = s;
    $('.objetivo .lista').innerHTML = lineas.map((l) => `<div class="o">${l}</div>`).join('');
    $('.objetivo').style.display = lineas.length ? '' : 'none';
  };
  H.aviso = (texto, tipo = 'info') => {
    const d = document.createElement('div');
    d.className = 'aviso ' + tipo;
    d.textContent = texto;
    const cont = $('.avisos');
    cont.appendChild(d);
    while (cont.children.length > 5) cont.firstChild.remove();
    setTimeout(() => d.classList.add('sale'), tipo === 'diario' ? 5200 : 2600);
    setTimeout(() => d.remove(), tipo === 'diario' ? 5800 : 3200);
  };
  let ultimaAccion = '';
  H.accion = (html, progreso = null) => {
    const a = $('.accion');
    const s = html || '';
    if (s !== ultimaAccion) { ultimaAccion = s; $('.accion .txt').innerHTML = s; a.style.display = s ? 'block' : 'none'; }
    $('.accion .barra').style.display = progreso === null ? 'none' : 'block';
    if (progreso !== null) $('.accion .barra i').style.width = `${Math.round(progreso * 100)}%`;
  };

  // ---------------- la conversacion ----------------
  H.dialogo = (n, persona) => {
    const d = $('.dialogo');
    H.dialogoAbierto = !!n;
    d.style.display = n ? 'block' : 'none';
    if (!n) return;
    $('.dialogo .quien').innerHTML = `${persona.nombre.toUpperCase()}<span>${persona.oficio}</span>`;
    $('.dialogo .texto').textContent = n.texto;
    $('.dialogo .ops').innerHTML = n.opciones.map((o) => `<button class="op" data-i="${o.i}"><kbd>${o.g ? o.g : 'E'}</kbd>${o.g ? `<small>${GESTOS[o.g]}</small>` : ''}${o.g ? '«' + o.t + '»' : o.t}</button>`).join('');
  };
  $('.dialogo .ops').addEventListener('click', (e) => {
    const b = e.target.closest('.op');
    if (b && H.alElegir) H.alElegir(Number(b.dataset.i));
  });

  // ---------------- paneles ----------------
  H.panel = (html) => {
    const d = $('.panel');
    d.style.display = html ? 'block' : 'none';
    if (html) d.innerHTML = html;
    if (!html) H.panelAbierto = null;
  };
  $('.panel').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-a]');
    if (b && !b.disabled && H.alAccion) H.alAccion(b.dataset.a);
  });
  H.ocupado = () => H.dialogoAbierto || !!H.panelAbierto;
  // con una conversacion o un panel abiertos, la ayuda de teclas se aparta (quedaba debajo del dialogo)
  const marcar = () => document.body.classList.toggle('hud-ocupado', H.ocupado());
  for (const k of ['dialogo', 'panel']) { const f = H[k]; H[k] = (...a) => { f(...a); marcar(); }; }
  H.fundido = (v) => { $('.fundido').style.opacity = v; };
  return H;
}

// ================= el contenido de cada panel =================
const btn = (a, txt, ok = true) => `<button data-a="${a}" ${ok ? '' : 'disabled'}>${txt}</button>`;
const tendencia = (p, id) => {
  const k = P.precio(p, id) / OBJETOS[id].base;
  return k > 1.15 ? '<span class="sube">▲</span>' : k < 0.87 ? '<span class="baja">▼</span>' : '<span style="opacity:.4">·</span>';
};

export function panelMochila(p) {
  const filas = Object.entries(p.mochila).filter(([, n]) => n > 0).map(([id, n]) => `<tr><td>${nombre(id)}</td><td class="n">${n}</td></tr>`).join('');
  const recetas = RECETAS.filter((r) => p.recetas.includes(r.id)).map((r) => nombre(r.da)).join(', ');
  return `<h2>MOCHILA</h2><div class="sub">${P.carga(p)} de ${P.capacidad(p)} · ${fmt(p.vales)} vales${p.equipo.mochila ? ' · con mochila de tela' : ''}</div>
    <table><tr><th>LLEVAS</th><th class="n"></th></tr>${filas || '<tr><td style="opacity:.6">Nada todavía</td><td></td></tr>'}</table>
    <div class="pie">Sabes hacer: ${recetas || '—'}</div><div class="pie"><kbd>I</kbd> o <kbd>Esc</kbd> para cerrar · <kbd>J</kbd> diario</div>`;
}

export function panelMesa(p, mesa, trabajando = null) {
  const titulo = mesa === 'carpinteria' ? 'CARPINTERÍA' : 'BANCO DE TRABAJO';
  const lista = RECETAS.filter((r) => r.mesa === mesa).map((r) => {
    const sabe = p.recetas.includes(r.id);
    const pide = Object.entries(r.pide).map(([id, n]) => `<span class="${P.enMochila(p, id) < n ? 'falta' : ''}">${n} ${nombre(id).toLowerCase()} (${P.enMochila(p, id)})</span>`).join(' + ');
    const v = P.puedeFabricar(p, r.id, mesa);
    const da = `${r.n > 1 ? r.n + ' × ' : ''}${nombre(r.da)}`;
    if (!sabe) return `<div class="receta" style="opacity:.45"><div>${da}<div class="pide">no sabes hacerlo todavía</div></div></div>`;
    return `<div class="receta"><div>${da}<div class="pide">${pide} · ${r.seg} s</div></div>${trabajando === r.id ? '<span>haciendo…</span>' : btn('fabricar:' + r.id, 'Hacer', v.ok && !trabajando)}</div>`;
  }).join('');
  const otra = mesa === 'carpinteria' ? 'En el banco de trabajo: cuerda, herramientas, vendas, mochila, antorchas.' : 'En la carpintería (la sierra, junto a la herrería): tablones y cubos.';
  return `<h2>${titulo}</h2><div class="sub">Lo que se hace aquí con lo que llevas en la mochila</div>${lista}<div class="pie">${otra}</div><div class="pie"><kbd>Esc</kbd> para cerrar</div>`;
}

export function panelTienda(p) {
  const bienes = P.BIENES.map((id) => {
    const tengo = P.enMochila(p, id), alm = p.ciudad.almacen[id];
    return `<tr><td>${nombre(id)} ${tendencia(p, id)}</td><td class="n">${fmt(P.precioVenta(p, id))}</td><td class="n">${fmt(P.precioCompra(p, id))}</td><td class="n">${tengo}</td>
      <td>${btn('comprar:' + id, 'Comprar', alm >= 3 && p.vales >= P.precioVenta(p, id))}${btn('vender:' + id, 'Vender', tengo > 0)}${btn('vender5:' + id, '×5', tengo >= 5)}</td></tr>`;
  }).join('');
  const equipo = ['hacha', 'pico', 'cubo', 'mochila', 'antorcha'].map((id) => {
    const tengo = id === 'mochila' ? (p.equipo.mochila ? 1 : 0) : P.enMochila(p, id);
    return `<tr><td>${nombre(id)}</td><td class="n">${fmt(P.precioVenta(p, id))}</td><td class="n">${id === 'mochila' ? '—' : fmt(P.precioCompra(p, id))}</td><td class="n">${tengo}</td>
      <td>${btn('comprar:' + id, 'Comprar', p.vales >= P.precioVenta(p, id) && !(id === 'mochila' && p.equipo.mochila))}${id === 'mochila' ? '' : btn('vender:' + id, 'Vender', tengo > 0)}</td></tr>`;
  }).join('');
  return `<h2>EL PUESTO DE TOBÍAS</h2><div class="sub">Tienes ${fmt(p.vales)} vales · a Tobías le quedan ${fmt(p.ciudad.comercio)} en la caja. Los precios siguen al almacén de la Base: ▲ falta, ▼ sobra.</div>
    <table><tr><th>BIEN</th><th class="n">VENDE A</th><th class="n">COMPRA A</th><th class="n">TIENES</th><th></th></tr>${bienes}
    <tr><th colspan="5">HERRAMIENTAS Y EQUIPO (PRECIO FIJO)</th></tr>${equipo}</table>
    <div class="pie">Hacerlas tú sale más barato: Nieves enseña. <kbd>Esc</kbd> para cerrar</div>`;
}

export function panelTablon(p) {
  const abiertos = P.encargosAbiertos(p);
  const filas = abiertos.map((e) => {
    const quien = e.quien === 'amparo' ? 'Amparo' : 'Intendencia';
    const horas = Math.max(0, Math.round((e.hasta - p.t) / 60));
    const tengo = P.enMochila(p, e.item);
    const acc = !e.aceptado ? btn('aceptar:' + e.id, 'Aceptar', p.litera) : btn('entregar:' + e.id, `Entregar (${Math.min(tengo, e.cant - e.entregado)})`, tengo > 0);
    return `<tr><td>${e.cant} ${nombre(e.item).toLowerCase()}<br><small style="opacity:.6">${quien} · quedan ${horas} h</small></td><td class="n">${e.entregado}/${e.cant}</td><td class="n">${fmt(e.pago)} c/u</td><td>${acc}</td></tr>`;
  }).join('');
  return `<h2>TABLÓN DE ENCARGOS</h2><div class="sub">Lo que falta en la Base y lo que se paga por ello (un 30 % más que el precio del día en que se puso). Lo paga quien lo pide.</div>
    <table><tr><th>SE NECESITA</th><th class="n">ENTREGADO</th><th class="n">PAGO</th><th></th></tr>${filas || '<tr><td colspan="4" style="opacity:.6">Hoy no hay encargos. Mañana, más.</td></tr>'}</table>
    ${p.litera ? '' : '<div class="pie falta">Para aceptar encargos hay que estar registrado en la Intendencia.</div>'}<div class="pie"><kbd>Esc</kbd> para cerrar</div>`;
}

export function panelObra(p) {
  const o = p.obra;
  if (o.terminada !== null) return `<h2>SEGUNDO POZO</h2><div class="sub">Terminado. Da ${OBRA_POZO.agua} cubos de agua por hora más a la Base.</div><div class="pie"><kbd>Esc</kbd> para cerrar</div>`;
  if (o.empezada !== null) return `<h2>SEGUNDO POZO</h2><div class="sub">Tiene todo lo que pedía: lo están levantando. Estará en unas horas.</div><div class="pie"><kbd>Esc</kbd> para cerrar</div>`;
  const falta = P.obraPide(p);
  const filas = Object.entries(OBRA_POZO.pide).map(([id, n]) => {
    const puesto = o.puesto[id], tengo = P.enMochila(p, id);
    return `<tr><td>${nombre(id)}<div class="barraObra"><i style="width:${Math.round(puesto / n * 100)}%"></i></div></td><td class="n">${puesto}/${n}</td><td class="n">tienes ${tengo}</td><td>${btn('aportar:' + id, 'Aportar', tengo > 0 && falta[id] > 0)}</td></tr>`;
  }).join('');
  const v = Math.round(o.vales);
  return `<h2>SEGUNDO POZO · LA OBRA</h2><div class="sub">Cavar, revestirlo de piedra y montar el torno. Cuando tenga todo, se levanta en ${OBRA_POZO.horasObra} horas y da agua para ${OBRA_POZO.llegan} familias más.</div>
    <table>${filas}<tr><td>Vales para los jornales<div class="barraObra"><i style="width:${Math.round(v / OBRA_POZO.vales * 100)}%"></i></div></td><td class="n">${v}/${OBRA_POZO.vales}</td><td class="n">tienes ${fmt(p.vales)}</td><td>${btn('aportar:vales10', '10', p.vales >= 1 && v < OBRA_POZO.vales)}${btn('aportar:vales50', '50', p.vales >= 1 && v < OBRA_POZO.vales)}</td></tr></table>
    <div class="pie">La Intendencia pone cada mañana la mitad de lo que le sobra. Con todo el material puesto, pone lo que falte si puede.</div><div class="pie"><kbd>Esc</kbd> para cerrar</div>`;
}

export function panelBaul(p) {
  const ids = [...new Set([...Object.keys(p.mochila), ...Object.keys(p.baul)])].filter((id) => !OBJETOS[id].unica);
  const filas = ids.map((id) => `<tr><td>${nombre(id)}</td><td class="n">${P.enMochila(p, id)}</td><td>${btn('guardar:' + id, 'Guardar →', P.enMochila(p, id) > 0)}${btn('guardarTodo:' + id, 'todo', P.enMochila(p, id) > 1)}</td><td>${btn('sacar:' + id, '← Sacar', (p.baul[id] || 0) > 0)}${btn('sacarTodo:' + id, 'todo', (p.baul[id] || 0) > 1)}</td><td class="n">${p.baul[id] || 0}</td></tr>`).join('');
  return `<h2>BAÚL DE LA LITERA</h2><div class="sub">Lo que no quieres cargar. Mochila ${P.carga(p)} / ${P.capacidad(p)}.</div>
    <table><tr><th>COSA</th><th class="n">MOCHILA</th><th></th><th></th><th class="n">BAÚL</th></tr>${filas || '<tr><td colspan="5" style="opacity:.6">Vacío</td></tr>'}</table><div class="pie"><kbd>Esc</kbd> para cerrar</div>`;
}

export function panelDiario(p) {
  const entradas = [...p.diario].reverse().map((d) => `<p><small>Día ${Math.floor(d.t / 1440) + 1} · ${String(Math.floor((d.t % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(d.t % 60)).padStart(2, '0')}</small>${d.texto}</p>`).join('');
  const c = p.ciudad;
  return `<h2>DIARIO</h2><div class="sub">La Base: ${c.poblacion} personas · agua ${Math.round(c.almacen.agua)} cubos (${Math.round(P.precio(p, 'agua') * 10) / 10} v) · la Intendencia tiene ${Math.round(c.intendencia)} v</div>
    <div class="diario">${entradas || '<p style="opacity:.6">Todavía nada.</p>'}</div>
    <div class="pie">${btn('nueva', 'Empezar de nuevo')} <kbd>J</kbd> o <kbd>Esc</kbd> para cerrar</div>`;
}
