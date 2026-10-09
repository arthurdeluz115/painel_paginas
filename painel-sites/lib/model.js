import { randomBytes } from 'node:crypto';
import { badRequest } from './http.js';

const list = (v) =>
  (Array.isArray(v) ? v : String(v ?? '').split(/[\n,;]+/))
    .map((x) => String(x).trim())
    .filter(Boolean);

export function normalizeUrl(u) {
  u = String(u || '').trim();
  if (!u) throw badRequest('Informe a URL do site');
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    return new URL(u).toString();
  } catch {
    throw badRequest('URL inválida: ' + u);
  }
}

function slugId(name, url) {
  const base =
    (name || new URL(url).hostname)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'site';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

function parseExtra(v) {
  const rows = Array.isArray(v)
    ? v
    : String(v || '')
        .split('\n')
        .map((line) => {
          const i = line.indexOf(':');
          return i > 0 ? { label: line.slice(0, i), value: line.slice(i + 1) } : { label: 'Info', value: line };
        });
  return rows
    .map((r) => ({ label: String(r.label || '').trim().slice(0, 60), value: String(r.value || '').trim().slice(0, 500) }))
    .filter((r) => r.value)
    .slice(0, 30);
}

/** Cria (existing = null) ou atualiza um site a partir do corpo da requisição. */
export function applySiteInput(body = {}, existing = null) {
  const s = existing ? { ...existing } : { createdAt: new Date().toISOString() };
  if (!existing || body.url !== undefined) s.url = normalizeUrl(body.url);
  if (!existing || body.name !== undefined) s.name = String(body.name || '').trim().slice(0, 120) || new URL(s.url).hostname;
  if (body.client !== undefined) s.client = String(body.client).trim().slice(0, 120);
  if (body.tags !== undefined) s.tags = list(body.tags).slice(0, 20);
  if (body.notes !== undefined) s.notes = String(body.notes).slice(0, 5000);
  if (body.ua !== undefined) s.ua = body.ua === 'desktop' ? 'desktop' : 'mobile';
  if (body.expectedMeta !== undefined) s.expectedMeta = list(body.expectedMeta).map((x) => x.replace(/\D/g, '')).filter(Boolean);
  if (body.expectedVturb !== undefined) s.expectedVturb = list(body.expectedVturb).map((x) => x.toLowerCase().replace(/^vid[-_]/, ''));
  if (body.extra !== undefined) s.extra = parseExtra(body.extra);
  if (!existing) s.id = slugId(s.name, s.url);
  s.ua ||= 'mobile';
  s.updatedAt = new Date().toISOString();
  return s;
}

/** Alertas calculados na leitura, comparando o que foi detectado com o que foi cadastrado. */
export function computeAlerts(site, scan, psi) {
  const a = [];
  const add = (level, msg) => a.push({ level, msg });
  if (!scan) {
    add('info', 'Aguardando a primeira verificação');
    return a;
  }
  if (!scan.ok) add('error', `Fora do ar: ${scan.error || 'HTTP ' + scan.status}`);

  const meta = scan.trackers?.metaPixel || [];
  const expMeta = site.expectedMeta || [];
  expMeta.forEach((id) => !meta.includes(id) && add('error', `Pixel da Meta ${id} não encontrado na página`));
  if (expMeta.length) meta.forEach((id) => !expMeta.includes(id) && add('warn', `Pixel da Meta não cadastrado: ${id}`));
  if (!meta.length && !expMeta.length && scan.ok) {
    add('warn', scan.trackers?.gtm?.length ? 'Pixel da Meta não está no HTML (pode estar dentro do GTM)' : 'Nenhum Pixel da Meta detectado');
  }

  const players = scan.vturb?.players || [];
  const expV = site.expectedVturb || [];
  expV.forEach((id) => !players.includes(id) && add('error', `Player VTurb ${id} não encontrado`));
  if (expV.length) players.forEach((id) => !expV.includes(id) && add('warn', `Player VTurb não cadastrado: ${id}`));

  const m = psi?.mobile?.score;
  if (typeof m === 'number' && m < 50) add('warn', `Nota de desempenho mobile baixa (${m})`);
  if (scan.stale) add('info', 'Rastreadores exibidos são da última verificação bem-sucedida');
  return a;
}
