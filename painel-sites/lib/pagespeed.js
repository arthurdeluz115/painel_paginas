// Métricas de carregamento via Google PageSpeed Insights (Lighthouse + dados reais do Chrome quando houver).

async function runPsi(url, strategy) {
  const u = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  u.searchParams.set('url', url);
  u.searchParams.set('strategy', strategy);
  u.searchParams.set('category', 'performance');
  if (process.env.PSI_API_KEY) u.searchParams.set('key', process.env.PSI_API_KEY);

  const r = await fetch(u, { signal: AbortSignal.timeout(100000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `PageSpeed HTTP ${r.status}`);

  const lh = j.lighthouseResult;
  const a = lh?.audits || {};
  const n = (k) => (typeof a[k]?.numericValue === 'number' ? a[k].numericValue : null);
  const le = j.loadingExperience?.metrics || {};
  const score = lh?.categories?.performance?.score;

  return {
    score: typeof score === 'number' ? Math.round(score * 100) : null,
    fcp: n('first-contentful-paint'),
    lcp: n('largest-contentful-paint'),
    tbt: n('total-blocking-time'),
    cls: n('cumulative-layout-shift'),
    si: n('speed-index'),
    ttfb: n('server-response-time'),
    weightKb: n('total-byte-weight') != null ? Math.round(n('total-byte-weight') / 1024) : null,
    field: {
      lcp: le.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
      inp: le.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
      cls: le.CUMULATIVE_LAYOUT_SHIFT_SCORE ? le.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
      category: j.loadingExperience?.overall_category || null,
    },
  };
}

export async function psiForSite(site) {
  const [mobile, desktop] = await Promise.allSettled([runPsi(site.url, 'mobile'), runPsi(site.url, 'desktop')]);
  const pick = (r) => (r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'Falhou' });
  return { checkedAt: new Date().toISOString(), mobile: pick(mobile), desktop: pick(desktop) };
}
