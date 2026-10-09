// Executado de hora em hora: mede o desempenho dos sites cuja última medição é mais antiga que PSI_INTERVAL_HOURS
// (padrão 24h), começando pelos mais desatualizados, até perto do limite de tempo da função.
import { handle, isCron, role } from '../../lib/http.js';
import * as db from '../../lib/db.js';
import { psiAndStore, pool } from '../../lib/runner.js';

export default handle(async (req, res) => {
  if (!isCron(req) && role(req) !== 'admin') return res.status(401).json({ error: 'Não autorizado' });
  const hours = Number(process.env.PSI_INTERVAL_HOURS || 24);
  const deadline = Date.now() + 180_000;
  const t = (x) => (x.psi?.checkedAt ? Date.parse(x.psi.checkedAt) : 0);

  const due = (await db.getAllSites())
    .filter((x) => Date.now() - t(x) > hours * 3600e3 * 0.95)
    .sort((a, b) => t(a) - t(b))
    .map((x) => x.site);

  let done = 0;
  await pool(due, 3, async (site) => {
    if (Date.now() > deadline) return;
    await psiAndStore(site);
    done++;
  });
  res.json({ due: due.length, done });
});
