import { waitUntil } from '@vercel/functions';
import { handle, requireView, requireAdmin } from '../../lib/http.js';
import * as db from '../../lib/db.js';
import { applySiteInput, computeAlerts } from '../../lib/model.js';
import { scanAndStore, psiAndStore } from '../../lib/runner.js';

export default handle(async (req, res) => {
  if (!requireView(req, res)) return;
  const { id } = req.query;
  const site = await db.getSite(id);
  if (!site) return res.status(404).json({ error: 'Site não encontrado' });

  if (req.method === 'GET') {
    const [scan, psi, log] = await Promise.all([db.getScan(id), db.getPsi(id), db.getLog(id)]);
    return res.json({ site: { ...site, scan, psi, alerts: computeAlerts(site, scan, psi) }, log });
  }

  if (req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const updated = applySiteInput(req.body || {}, site);
    await db.saveSite(updated);
    let scan = await db.getScan(id);
    if (updated.url !== site.url || updated.ua !== site.ua) {
      scan = await scanAndStore(updated);
      waitUntil(psiAndStore(updated).catch((e) => console.error('pagespeed', e)));
    }
    const psi = await db.getPsi(id);
    return res.json({ site: { ...updated, scan, psi, alerts: computeAlerts(updated, scan, psi) } });
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    await db.removeSite(id);
    return res.json({ ok: true });
  }

  res.setHeader('allow', 'GET, PUT, DELETE');
  res.status(405).json({ error: 'Método não permitido' });
});
