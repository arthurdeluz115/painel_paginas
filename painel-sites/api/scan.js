// Verificação manual de um site ("Verificar agora" / "Medir desempenho"). Liberado para quem pode ver o painel.
import { handle, requireView } from '../lib/http.js';
import * as db from '../lib/db.js';
import { computeAlerts } from '../lib/model.js';
import { scanAndStore, psiAndStore } from '../lib/runner.js';

export default handle(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!requireView(req, res)) return;
  const { id, pagespeed } = req.body || {};
  const site = await db.getSite(id);
  if (!site) return res.status(404).json({ error: 'Site não encontrado' });

  const [scan, psi] = await Promise.all([
    scanAndStore(site),
    pagespeed ? psiAndStore(site) : db.getPsi(id),
  ]);
  const log = await db.getLog(id);
  res.json({ site: { ...site, scan, psi, alerts: computeAlerts(site, scan, psi) }, log });
});
