import { createHash, timingSafeEqual } from 'node:crypto';

const h = (s) => createHash('sha256').update(String(s ?? '')).digest();
const eq = (a, b) => timingSafeEqual(h(a), h(b));

/**
 * Papel de quem faz a requisição, a partir do header x-key.
 * - ADMIN_PASSWORD  → 'admin' (pode cadastrar, editar e excluir)
 * - VIEWER_PASSWORD → 'viewer' (só visualiza). Se não definido, o painel é aberto para leitura.
 */
export function role(req) {
  const key = req.headers['x-key'] || '';
  const admin = process.env.ADMIN_PASSWORD;
  const viewer = process.env.VIEWER_PASSWORD;
  if (admin && key && eq(key, admin)) return 'admin';
  if (!viewer) return 'viewer';
  if (key && eq(key, viewer)) return 'viewer';
  return null;
}

export function requireView(req, res) {
  const r = role(req);
  if (!r) {
    res.status(401).json({ error: 'Senha necessária' });
    return null;
  }
  return r;
}

export function requireAdmin(req, res) {
  if (role(req) !== 'admin') {
    res.status(role(req) ? 403 : 401).json({ error: 'Apenas administradores podem fazer isso' });
    return false;
  }
  return true;
}

/** A Vercel envia "Authorization: Bearer <CRON_SECRET>" nas execuções agendadas. */
export function isCron(req) {
  const s = process.env.CRON_SECRET;
  return !!s && req.headers.authorization === `Bearer ${s}`;
}

export const handle = (fn) => async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  try {
    await fn(req, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(e.status || 500).json({ error: e.message || 'Erro interno' });
  }
};

export function badRequest(msg) {
  return Object.assign(new Error(msg), { status: 400 });
}
