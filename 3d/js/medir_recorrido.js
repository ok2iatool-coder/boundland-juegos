// Resumen del recorrido de la capa en una linea (para comparar variantes tras recargar con ?opc=...):
// `await (await import('/js/medir_recorrido.js')).resumen()`
export async function resumen() {
  await new Promise((r) => { const f = () => (window.__dbg && __dbg.heroe && __dbg.heroe.listo ? r() : setTimeout(f, 200)); f(); });
  const t0 = performance.now();
  const r = await (await import('./recorrido_capa.js')).grabar(window.__dbg);
  const ms = performance.now() - t0;
  const t = Object.fromEntries(Object.entries(r.tramos).map(([k, v]) => [k, [v.saltos, v.giros, v.peor_cm]]));
  const tot = Object.values(r.tramos).reduce((a, v) => [a[0] + v.saltos, a[1] + v.giros], [0, 0]);
  return JSON.stringify({ tot, t, peor: r.peor, ms: Math.round(ms) });
}
