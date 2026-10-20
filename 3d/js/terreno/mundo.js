// EL MAPA DE TERRENO (?mapa=terreno): solo el suelo, sin nada encima. 600 x 600 m de explanadas a distintas cotas
// (la explanada del centro, tres bancales al norte, la meseta del este, la llanura baja del sur) unidas por cuestas,
// taludes con sus rampas y un escarpe; lomas al oeste, una rambla seca, tres cerros testigo y una laguna seca. El
// relieve sale de relieve.js (puro, medido en test_terreno.mjs). Arriba a la izquierda, el nombre del sitio en que se
// esta. Misma interfaz que los otros mapas; `limitar` no deja subir paredes de mas de 35 grados.
import * as THREE from 'three';
import * as R from './relieve.js';
import { CHOQUES_ROCAS, ROCAS } from './sitios.js';
import './edicion.js';                                   // lo editado a mano, leido de disco ANTES de construir nada
import { crearSuelo } from './suelo.js';
import { crearRocas } from './rocas.js';
import { crearParedes, crearLaguna } from './paredes.js';
import { crearHierba } from './hierba.js';
import { crearCielo, BRUMA } from './cielo.js';
import { crearPlano } from './plano.js';
import { crearEditor } from './editor.js';
import { crearModelos } from './modelos.js';
import { TONO } from './tono.js';

export const LADO = R.LADO;

export function crearMundo(scene) {
  const t0 = performance.now();
  const grupo = new THREE.Group();
  grupo.name = 'terreno';
  scene.add(grupo);

  // la luz de media tarde (la de los otros mapas) y la bruma del valle
  const DIR_SOL = new THREE.Vector3(-0.5, 0.68, 0.53).normalize();
  scene.background = BRUMA.clone();
  scene.fog = new THREE.FogExp2(BRUMA, 0.0034);
  const cielo = new THREE.HemisphereLight(0xf3efd6, 0x55603a, 1.55);
  const sol = new THREE.DirectionalLight(0xffe3b2, 2.7);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { near: 1, far: 260, left: -32, right: 32, top: 32, bottom: -32 });
  sol.shadow.bias = -0.0006;
  sol.shadow.normalBias = 0.05;
  scene.add(cielo, sol, sol.target);
  const _ejeU = new THREE.Vector3().crossVectors(DIR_SOL, new THREE.Vector3(0, 1, 0)).normalize();
  const _ejeV = new THREE.Vector3().crossVectors(_ejeU, DIR_SOL).normalize();
  const _foco = new THREE.Vector3();

  const boveda = crearCielo(scene, DIR_SOL);
  const suelo = crearSuelo(grupo, TONO);
  const rocas = crearRocas(grupo, TONO);
  const paredes = crearParedes(grupo, TONO);
  const laguna = crearLaguna(grupo, TONO, R.LAGUNA);
  // si lo editado toca el fondo de la laguna, su lamina de barro (que va a la cota de siempre) se quita
  for (let z = R.LAGUNA.z - R.LAGUNA.rz; z <= R.LAGUNA.z + R.LAGUNA.rz && laguna.visible; z += 1.6) {
    for (let x = R.LAGUNA.x - R.LAGUNA.rx; x <= R.LAGUNA.x + R.LAGUNA.rx; x += 1.6) if (Math.abs(R.deltaEn(x, z)) > 0.08) { laguna.visible = false; break; }
  }
  const hierba = crearHierba({ grupo });
  // las cajas de choque de lo que se pone encima (la lista que leen el 18, su capa y la camara)
  const cajas = [];
  // los modelos .glb que pone el editor (se cargan en segundo plano; al llegar, la hierba de debajo se rehace)
  let plano = null;
  const modelos = crearModelos({ grupo, cajas, alCambiar: (x0, z0, x1, z1) => { hierba.tirarZona(x0, z0, x1, z1); if (plano) plano.rehacer(); } });
  const msCarga = Math.round(performance.now() - t0);

  // el nombre del sitio (arriba a la izquierda, debajo del titulo)
  const etiqueta = document.createElement('div');
  etiqueta.style.cssText = 'position:fixed;left:18px;top:62px;font:13px/1.4 Bahnschrift,"Segoe UI",sans-serif;letter-spacing:.16em;color:#f2ecdc;text-shadow:0 1px 6px rgba(0,0,0,.5);opacity:.9;pointer-events:none;transition:opacity .4s';
  document.body.appendChild(etiqueta);
  let cadaZona = 0, zonaAhora = '';

  const enlaces = { heroe: null, camara: null, cam: null, canvas: null };
  // ---------------- el mapa: clic = el 18 aparece alli ----------------
  // si el clic cae en una pared o un talud, al sitio llano mas cercano (en espiral, hasta 16 m)
  let ultimoT = 0;
  function ir(x, z) {
    if (editor && editor.activo) { editor.irA(x, z); return; }   // editando, el mapa lleva la camara del editor
    const H = enlaces.heroe;
    if (!H || !H.listo) return;
    let p = { x, z };
    if (R.normalY(x, z) < 0.85) {
      let mejor = null;
      for (let rad = 1.5; rad <= 16 && !mejor; rad += 1.5) {
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2, q = { x: x + Math.cos(a) * rad, z: z + Math.sin(a) * rad };
          if (R.radioBorde(q.x, q.z) < 280 && R.normalY(q.x, q.z) > 0.9) { mejor = q; break; }
        }
      }
      if (mejor) p = mejor;
    }
    R.limitar(p);
    H.pos.set(p.x, R.altura(p.x, p.z), p.z);
    H.vel.set(0, 0); H.vy = 0; H.suelo = true;
    if (enlaces.camara) enlaces.camara.lista = false;             // la camara salta con el (si no, cruzaria el mapa)
    hierba.actualizar(ultimoT, H.pos, H, 0, true);                // la hierba de alrededor, ya hecha al llegar
    // (la capa del 18 se recoloca sola: tela.js reinicia si la pelvis salta mas de 1 m)
  }
  let editor = null;
  plano = crearPlano({ alIr: ir });
  // ---------------- el editor (tecla E): el terreno a mano ----------------
  editor = crearEditor({ scene, suelo, rocas, paredes, hierba, plano, laguna, modelos });
  editor.alIr18((x, z) => { editor.salir(); ir(x, z); });
  function tecla(e, abajo) {
    if (abajo && e.code === 'KeyM' && !e.ctrlKey) { plano.abierto ? plano.cerrar() : plano.abrir(); return true; }
    if (plano.abierto) {
      if (abajo && e.code === 'Escape') { plano.cerrar(); return true; }
      return abajo && /^(Key[WASDE]|Arrow|Space|Digit)/.test(e.code);
    }
    return editor.tecla(e, abajo);
  }
  function actualizar(t, foco, heroe = null, dt = 0) {
    ultimoT = t;
    // editando: todo (sol, sombra, hierba, cielo) sigue al punto que mira la camara del editor, no al 18
    if (editor.activo) foco = editor.paso(dt);
    // el color del suelo editado que queda por pintar (poco a poco, para no parar la imagen)
    if (suelo.pendiente) suelo.pintarPendiente(editor.activo ? 7 : 3);
    if (plano.abierto) plano.actualizar(editor.activo ? foco : heroe ? heroe.pos : foco, editor.activo ? editor.S.yaw + Math.PI : heroe ? heroe.giro : 0);
    // el sol y su sombra siguen al 18, ajustados a la rejilla de texeles
    const texel = (sol.shadow.camera.right - sol.shadow.camera.left) / sol.shadow.mapSize.x;
    const u = _ejeU.dot(foco), w = _ejeV.dot(foco);
    _foco.copy(foco).addScaledVector(_ejeU, Math.round(u / texel) * texel - u).addScaledVector(_ejeV, Math.round(w / texel) * texel - w);
    sol.position.copy(_foco).addScaledVector(DIR_SOL, 120);
    sol.target.position.copy(_foco);
    boveda.actualizar(t, foco);
    hierba.actualizar(t, foco, heroe, dt);
    cadaZona -= dt;
    if (cadaZona <= 0) {
      cadaZona = 0.4;
      const z = R.zona(foco.x, foco.z);
      if (z !== zonaAhora) { zonaAhora = z; etiqueta.textContent = z.toUpperCase(); }
    }
  }
  // los bordes: el cuadrado redondeado del mapa y las paredes que no se suben (desde donde esta el 18 ahora)
  function limitar(p) {
    R.limitar(p);
    if (enlaces.heroe && enlaces.heroe.listo) R.pasoPermitido(enlaces.heroe.pos, p);
  }
  // una linea recta de la salida al norte (la usa la auditoria)
  const puntoCamino = (tt) => ({ x: R.SALIDA.x, z: R.SALIDA.z - tt * 80, tx: 0, tz: -1 });

  return {
    LADO, borde: 1e4, limitar, altura: R.altura, actualizar, puntoCamino, sol, hierba,
    choques: { circulos: CHOQUES_ROCAS, cajas },              // las mismas listas que cambia el editor
    salida: R.SALIDA,
    titulo: 'EL TERRENO', lejos: 2600,
    conectar(e) { Object.assign(enlaces, e); editor.conectar({ heroe: e.heroe, C: e.camara, cam: e.cam, canvas: e.canvas }); },
    tecla, bloqueado: () => plano.abierto || editor.activo, plano, ir, editor, modelos,
    raton: (tipo, e) => editor.raton(tipo, e),
    ayuda: `<div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> correr &nbsp; <kbd>Mayús</kbd> andar &nbsp; <kbd>Espacio</kbd> saltar &nbsp; <kbd>1</kbd>-<kbd>4</kbd> gestos</div>
      <div><kbd>M</kbd> mapa: clic en un sitio y el 18 aparece allí &nbsp; ▲ en el mapa = rampa</div>
      <div><kbd>E</kbd> editor del terreno: subir, bajar, allanar, suavizar, pintar, rocas y modelos 3D</div>
      <div>ratón: cámara (clic para fijarlo, <kbd>Esc</kbd> para soltar) · rueda: acercar · <kbd>H</kbd> ocultar</div>`,
    zona: R.zona,
    get info() { return { msCarga, rocas: ROCAS.length, ...suelo.info(), ...rocas.info(), ...paredes.info(), ...modelos.info(), ...hierba.info(), zona: zonaAhora }; },
  };
}
