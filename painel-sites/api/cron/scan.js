// Executado pela Vercel a cada 30 min: relê o HTML de todos os sites e registra mudanças.
import { handle, isCron, role } from '../../lib/http.js';
import * as db from '../../lib/db.js';
import { scanAndStore, pool } from '../../lib/runner.js';

export default handle(async (req, res) => {
  if (!isCron(req) && role(req) !== 'admin') return res.status(401).json({ error: 'Não autorizado' });
  const sites = (await db.getAllSites()).map((x) => x.site);
  const results = await pool(sites, 8, scanAndStore);
  res.json({ scanned: sites.length, down: results.filter((r) => r && !r.ok).length });
});
