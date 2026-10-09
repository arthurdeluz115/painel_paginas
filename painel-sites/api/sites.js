import { waitUntil } from '@vercel/functions';
import { handle, requireView, requireAdmin } from '../lib/http.js';
import * as db from '../lib/db.js';
import { applySiteInput, computeAlerts } from '../lib/model.js';
import { scanAndStore, psiAndStore } from '../lib/runner.js';

export default handle(async (req, res) => {
  if (req.method === 'GET') {
    const role = requireView(req, res);
    if (!role) return;
    const [all, feed] = await Promise.all([db.getAllSites(), db.getFeed(80)]);
    const sites = all.map(({ site, scan, psi }) => ({ ...site, scan, psi, alerts: computeAlerts(site, scan, psi) }));
    return res.json({ role, sites, feed });
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const site = applySiteInput(req.body || {});
    await db.saveSite(site);
    const scan = await scanAndStore(site);
    // Desempenho demora ~30s: roda depois da resposta.
    waitUntil(psiAndStore(site).catch((e) => console.error('pagespeed', e)));
    return res.status(201).json({ site: { ...site, scan, psi: null, alerts: computeAlerts(site, scan, null) } });
  }

  res.setHeader('allow', 'GET, POST');
  res.status(405).json({ error: 'Método não permitido' });
});
