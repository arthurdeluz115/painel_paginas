// Lê o HTML de um site e detecta pixels, players VTurb, links de checkout e plataforma.

const UA = {
  mobile:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  desktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
};

const uniq = (a) => [...new Set(a)];

// Cada padrão com grupo de captura devolve o ID; sem grupo, marca como "ativo".
export const TRACKERS = [
  {
    key: 'metaPixel',
    label: 'Pixel da Meta',
    patterns: [
      /fbq\(\s*['"]init['"]\s*,\s*['"]?(\d{8,20})/g,
      /facebook\.com\/tr\/?\?id=(\d{8,20})/g,
      /signals\/config\/(\d{8,20})/g,
    ],
  },
  { key: 'gtm', label: 'Google Tag Manager', patterns: [/\b(GTM-[A-Z0-9]{4,10})\b/g] },
  {
    key: 'ga4',
    label: 'Google Analytics 4',
    patterns: [/gtag\/js\?id=(G-[A-Z0-9]{6,14})/g, /gtag\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]{6,14})/g],
  },
  { key: 'googleAds', label: 'Google Ads', patterns: [/\b(AW-\d{6,14})\b/g] },
  { key: 'tiktok', label: 'Pixel do TikTok', patterns: [/ttq\.load\(\s*['"]([A-Z0-9]{12,30})['"]/g, /sdkid=([A-Z0-9]{12,30})/g] },
  { key: 'kwai', label: 'Pixel do Kwai', patterns: [/kwaiq\.load\(\s*['"](\d{6,25})['"]/g] },
  { key: 'pinterest', label: 'Pinterest Tag', patterns: [/pintrk\(\s*['"]load['"]\s*,\s*['"](\d{6,20})['"]/g] },
  { key: 'snapchat', label: 'Snap Pixel', patterns: [/snaptr\(\s*['"]init['"]\s*,\s*['"]([a-f0-9-]{36})['"]/g] },
  { key: 'taboola', label: 'Taboola', patterns: [/taboola\.com\/libtrc\/unip\/(\d+)\//g] },
  {
    key: 'clarity',
    label: 'Microsoft Clarity',
    patterns: [/clarity\.ms\/tag\/([a-z0-9]{6,15})/g, /["']clarity["']\s*,\s*["']script["']\s*,\s*["']([a-z0-9]{6,15})["']/g],
  },
  { key: 'hotjar', label: 'Hotjar', patterns: [/hjid\s*:\s*(\d{5,10})/g] },
  { key: 'utmify', label: 'Pixel Utmify', patterns: [/pixelId\s*=\s*["']([a-f0-9]{16,40})["']/g] },
  { key: 'utmifyUtms', label: 'Script de UTMs Utmify', patterns: [/utmify\.com\.br\/scripts\/utms/g] },
  {
    key: 'trackhunter',
    label: 'TrackHunter',
    patterns: [
      /trackhunter[^"'<>\s]*?[?&\/#](?:id|pixel|pixelId|pid|token|key|project)[=\/:]["']?([A-Za-z0-9_-]{6,64})/gi,
      /trackhunter[\s\S]{0,200}?(?:pixelId|pixel_id|projectId|token)\s*[:=]\s*["']([A-Za-z0-9_-]{6,64})["']/gi,
      /trackhunter/gi,
    ],
  },
  { key: 'linkedin', label: 'LinkedIn Insight', patterns: [/_linkedin_partner_id\s*=\s*["']?(\d{4,12})/g] },
  { key: 'twitter', label: 'Pixel do X (Twitter)', patterns: [/twq\(\s*['"]config['"]\s*,\s*['"]([a-z0-9]{4,12})['"]/gi] },
  { key: 'bing', label: 'Microsoft Ads (UET)', patterns: [/\bti\s*:\s*["']?(\d{5,12})["']?[\s\S]{0,300}?bat\.bing/g, /bat\.bing\.com\/action\/0\?ti=(\d{5,12})/g] },
  { key: 'reddit', label: 'Pixel do Reddit', patterns: [/rdt\(\s*['"]init['"]\s*,\s*['"]([a-z0-9_]{6,30})['"]/gi] },
  { key: 'outbrain', label: 'Outbrain', patterns: [/OB_ADV_ID\s*=\s*['"]([a-f0-9]{10,40})['"]/gi] },
  { key: 'redtrack', label: 'RedTrack', patterns: [/redtrack\.io|rtkcmp/gi] },
  { key: 'clickmagick', label: 'ClickMagick', patterns: [/clickmagick\.com/gi] },
  { key: 'hyros', label: 'Hyros', patterns: [/hyros\.com/gi] },
  { key: 'stape', label: 'Stape (GTM server-side)', patterns: [/stape\.io|stape\.net/gi] },
];

// Domínios comuns que não são rastreadores (CDNs, fontes, bibliotecas) — ficam fora da lista de "scripts externos".
const COMMON_HOSTS = /(^|\.)(googleapis\.com|gstatic\.com|cloudflare\.com|cdnjs\.cloudflare\.com|jsdelivr\.net|unpkg\.com|jquery\.com|bootstrapcdn\.com|fontawesome\.com|wp\.com|w\.org|polyfill\.io|recaptcha\.net)$/i;
export const TRACKER_LABELS = Object.fromEntries(TRACKERS.map((t) => [t.key, t.label]));

const CHECKOUT_RE =
  /https?:\/\/(?:[a-z0-9-]+\.)*(?:hotmart\.com|kiwify\.com\.br|kiwify\.app|eduzz\.com|monetizze\.com\.br|braip\.com|perfectpay\.com\.br|cartpanda\.com|yampi\.com\.br|ticto\.app|payt\.com\.br|greenn\.com\.br|lastlink\.com|pepper\.com\.br|appmax\.com\.br|clickbank\.net|buygoods\.com|digistore24\.com|checkoutchamp\.com)\/[^\s"'<>\\)]*/gi;

const PLATFORMS = [
  ['WordPress', /wp-content|wp-includes/],
  ['Elementor', /elementor/],
  ['Shopify', /cdn\.shopify\.com/],
  ['Nuvemshop', /nuvemshop|tiendanube/],
  ['Webflow', /webflow\.com|data-wf-page/],
  ['Framer', /framerusercontent\.com/],
  ['Atomicat', /atomicat/],
  ['GreatPages', /greatpages/],
  ['Next.js', /\/_next\/static/],
  ['Lovable', /lovable/],
];

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function externalScriptHosts(html, baseUrl) {
  let own = '';
  try { own = new URL(baseUrl).hostname.replace(/^www\./, ''); } catch {}
  const hosts = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    let h;
    try { h = new URL(decode(m[1]), baseUrl || 'https://x.invalid').hostname.replace(/^www\./, ''); } catch { continue; }
    if (!h || h === 'x.invalid' || h === own || h.endsWith('.' + own) || COMMON_HOSTS.test(h)) continue;
    hosts.push(h.toLowerCase());
  }
  return uniq(hosts).sort();
}

export function detect(html, baseUrl) {
  const trackers = {};
  for (const t of TRACKERS) {
    const ids = [];
    for (const re of t.patterns) for (const m of html.matchAll(re)) ids.push(m[1] ?? 'ativo');
    let u = uniq(ids);
    if (u.length > 1) u = u.filter((x) => x !== 'ativo'); // se achou o ID, não precisa do "ativo"
    if (u.length) trackers[t.key] = u;
  }
  const externalScripts = externalScriptHosts(html, baseUrl);

  const players = [];
  const accounts = [];
  const abTests = [];
  for (const m of html.matchAll(/converteai\.net\/([a-f0-9-]{36})\/players\/([a-f0-9]{24})/gi)) {
    accounts.push(m[1].toLowerCase());
    players.push(m[2].toLowerCase());
  }
  for (const m of html.matchAll(/converteai\.net\/([a-f0-9-]{36})\/ab-test\/([a-f0-9]{24})/gi)) {
    accounts.push(m[1].toLowerCase());
    abTests.push(m[2].toLowerCase());
  }
  for (const m of html.matchAll(/id=["']vid[-_]([a-f0-9]{24})["']/gi)) players.push(m[1].toLowerCase());
  const vturb = { players: uniq(players), accounts: uniq(accounts), abTests: uniq(abTests) };

  const checkouts = uniq(
    [...html.matchAll(CHECKOUT_RE)].map((m) => decode(m[0]).replace(/[.,;]+$/, ''))
  ).slice(0, 30);

  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim()).slice(0, 200);
  const platforms = PLATFORMS.filter(([, re]) => re.test(html)).map(([n]) => n);
  const scripts = (html.match(/<script\b/gi) || []).length;

  return { title, trackers, vturb, checkouts, platforms, scripts, externalScripts };
}

function hostingFrom(headers) {
  if (headers.get('x-vercel-id')) return 'Vercel';
  if (headers.get('x-nf-request-id')) return 'Netlify';
  if (headers.get('cf-ray')) return 'Cloudflare';
  if (headers.get('x-github-request-id')) return 'GitHub Pages';
  return headers.get('server') || null;
}

export async function scanSite(site) {
  const started = Date.now();
  const res = { checkedAt: new Date().toISOString(), ok: false };
  try {
    const r = await fetch(site.url, {
      headers: {
        'user-agent': UA[site.ua] || UA.mobile,
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    res.responseMs = Date.now() - started;
    const html = await r.text();
    res.totalMs = Date.now() - started;
    res.status = r.status;
    res.ok = r.ok;
    res.finalUrl = r.url;
    res.hosting = hostingFrom(r.headers);
    res.htmlKb = Math.round(Buffer.byteLength(html) / 1024);
    Object.assign(res, detect(html, r.url || site.url));
  } catch (e) {
    res.error = e.name === 'TimeoutError' ? 'Tempo esgotado (20s)' : e.cause?.code || e.message;
  }
  return res;
}

const listDiff = (a = [], b = []) => ({ added: b.filter((x) => !a.includes(x)), removed: a.filter((x) => !b.includes(x)) });

/** Gera eventos de histórico comparando a verificação anterior com a atual. */
export function diffScans(site, prev, next) {
  const ev = [];
  const push = (type, msg) => ev.push({ siteId: site.id, siteName: site.name, at: next.checkedAt, type, msg });

  if (!prev) {
    push('info', next.ok ? 'Primeira verificação concluída' : `Primeira verificação falhou: ${next.error || 'HTTP ' + next.status}`);
    return ev;
  }
  if (prev.ok && !next.ok) push('down', `Site fora do ar — ${next.error || 'HTTP ' + next.status}`);
  if (!prev.ok && next.ok) push('up', 'Site voltou a responder');
  if (!next.ok) return ev;

  const keys = new Set([...Object.keys(prev.trackers || {}), ...Object.keys(next.trackers || {})]);
  for (const k of keys) {
    const d = listDiff(prev.trackers?.[k], next.trackers?.[k]);
    const label = TRACKER_LABELS[k] || k;
    d.added.forEach((id) => push('added', id === 'ativo' ? `${label} adicionado` : `${label} adicionado: ${id}`));
    d.removed.forEach((id) => push('removed', id === 'ativo' ? `${label} removido` : `${label} removido: ${id}`));
  }
  const v = listDiff(prev.vturb?.players, next.vturb?.players);
  v.added.forEach((id) => push('added', `Player VTurb adicionado: ${id}`));
  v.removed.forEach((id) => push('removed', `Player VTurb removido: ${id}`));

  const c = listDiff(prev.checkouts, next.checkouts);
  c.added.forEach((u) => push('added', `Link de checkout adicionado: ${u}`));
  c.removed.forEach((u) => push('removed', `Link de checkout removido: ${u}`));

  // Só compara scripts externos se a verificação anterior já tinha esse campo (evita uma enxurrada no 1º deploy).
  if (prev.externalScripts) {
    const x = listDiff(prev.externalScripts, next.externalScripts);
    x.added.forEach((h) => push('added', `Novo script externo: ${h}`));
    x.removed.forEach((h) => push('removed', `Script externo removido: ${h}`));
  }

  if (prev.title && next.title && prev.title !== next.title) push('changed', `Título alterado: "${prev.title}" → "${next.title}"`);
  return ev;
}
