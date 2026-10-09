import { Redis } from '@upstash/redis';

let client;
function r() {
  if (client) return client;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Banco não configurado: conecte o Upstash Redis ao projeto na Vercel (aba Storage) e faça um novo deploy.');
  }
  client = new Redis({ url, token });
  return client;
}

const K = {
  index: 'sites:index',
  site: (id) => `site:${id}`,
  scan: (id) => `scan:${id}`,
  psi: (id) => `psi:${id}`,
  log: (id) => `log:${id}`,
  feed: 'feed',
};

export async function listSiteIds() {
  return (await r().smembers(K.index)) || [];
}

export const getSite = (id) => r().get(K.site(id));
export const getScan = (id) => r().get(K.scan(id));
export const getPsi = (id) => r().get(K.psi(id));
export const saveScan = (id, v) => r().set(K.scan(id), v);
export const savePsi = (id, v) => r().set(K.psi(id), v);

export async function saveSite(site) {
  await r().set(K.site(site.id), site);
  await r().sadd(K.index, site.id);
}

export async function removeSite(id) {
  await r().del(K.site(id), K.scan(id), K.psi(id), K.log(id));
  await r().srem(K.index, id);
}

export async function addEvents(id, events) {
  if (!events?.length) return;
  const p = r().pipeline();
  for (const e of events) {
    p.lpush(K.log(id), e);
    p.lpush(K.feed, e);
  }
  p.ltrim(K.log(id), 0, 99);
  p.ltrim(K.feed, 0, 299);
  await p.exec();
}

export const getLog = (id, n = 60) => r().lrange(K.log(id), 0, n - 1);
export const getFeed = (n = 80) => r().lrange(K.feed, 0, n - 1);

/** Retorna [{ site, scan, psi }] de todos os sites em poucas chamadas. */
export async function getAllSites() {
  const ids = await listSiteIds();
  if (!ids.length) return [];
  const keys = ids.flatMap((id) => [K.site(id), K.scan(id), K.psi(id)]);
  const vals = await r().mget(...keys);
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    const site = vals[i * 3];
    if (!site) continue;
    out.push({ site, scan: vals[i * 3 + 1] || null, psi: vals[i * 3 + 2] || null });
  }
  return out;
}
