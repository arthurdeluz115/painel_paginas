import { handle, role } from '../lib/http.js';

export default handle(async (req, res) => {
  const r = role(req);
  if (!r) return res.status(401).json({ error: 'Senha necessária' });
  res.json({ role: r, adminConfigured: !!process.env.ADMIN_PASSWORD });
});
