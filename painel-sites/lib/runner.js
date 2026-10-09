import { scanSite, diffScans } from './scanner.js';
import { psiForSite } from './pagespeed.js';
import * as db from './db.js';

const DETECTION_FIELDS = ['title', 'trackers', 'vturb', 'checkouts', 'platforms', 'scripts', 'externalScripts'];

/** Verifica o HTML, guarda o resultado e registra o que mudou. */
export async function scanAndStore(site) {
  const prev = await db.getScan(site.id);
  const next = await scanSite(site);
  // Se o site caiu, mantém os rastreadores da última verificação boa para não gerar alarmes falsos.
  if (!next.ok && prev) {
    for (const f of DETECTION_FIELDS) if (prev[f] !== undefined) next[f] = prev[f];
    next.stale = true;
  }
  await db.saveScan(site.id, next);
  await db.addEvents(site.id, diffScans(site, prev, next));
  return next;
}

/** Mede desempenho (mobile + desktop) e registra quedas/subidas grandes de nota. */
export async function psiAndStore(site) {
  const prev = await db.getPsi(site.id);
  const next = await psiForSite(site);
  for (const s of ['mobile', 'desktop']) {
    if (next[s]?.error && prev?.[s]?.score != null) next[s] = { ...prev[s], error: next[s].error, stale: true };
  }
  await db.savePsi(site.id, next);
  const a = prev?.mobile?.score;
  const b = next.mobile?.score;
  if (typeof a === 'number' && typeof b === 'number' && !next.mobile.stale && Math.abs(b - a) >= 15) {
    await db.addEvents(site.id, [
      { siteId: site.id, siteName: site.name, at: next.checkedAt, type: 'perf', msg: `Nota mobile ${b > a ? 'subiu' : 'caiu'} de ${a} para ${b}` },
    ]);
  }
  return next;
}

/** Executa fn em paralelo com limite de concorrência. */
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await fn(items[idx]);
      } catch (e) {
        console.error(e);
        results[idx] = { error: e.message };
      }
    }
  });
  await Promise.all(workers);
  return results;
}
