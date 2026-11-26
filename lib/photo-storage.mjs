import { createHash } from 'node:crypto';

const bucket = 'santa-product-photos';
const base = () => process.env.SUPABASE_URL.replace(/\/$/, '') + '/storage/v1';
function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + key }) };
}

function objectName(link) {
  const url = new URL(link);
  if (!['https:', 'http:'].includes(url.protocol)) throw Error('Некорректная ссылка');
  if (['l.kaspi.kz', 'ozon.kz', 'www.ozon.kz', 'global.wildberries.ru'].includes(url.hostname)) url.search = '';
  url.hash = '';
  return createHash('sha256').update(url.href).digest('hex');
}

export function photoUrl(link) {
  return base() + '/object/public/' + bucket + '/' + objectName(link);
}

export async function cachedPhoto(link) {
  const address = photoUrl(link);
  const response = await fetch(address, { method: 'HEAD', cache: 'no-store' });
  return response.ok && response.headers.get('content-type')?.startsWith('image/') ? address : null;
}

export async function storePhoto(link, data) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(data);
  if (!match) throw Error('Некорректное фото');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 2000000) throw Error('Некорректный размер фото');
  const response = await fetch(base() + '/object/' + bucket + '/' + objectName(link), {
    method: 'POST', headers: { ...headers(), 'content-type': match[1], 'x-upsert': 'true' }, body: bytes
  });
  if (!response.ok) throw Error('Не удалось сохранить фото товара');
  return photoUrl(link);
}

export async function ensureBucket() {
  const address = base() + '/bucket';
  if ((await fetch(address + '/' + bucket, { headers: headers() })).ok) return;
  const result = await fetch(address, { method: 'POST', headers: { ...headers(), 'content-type': 'application/json' },
    body: JSON.stringify({ id: bucket, name: bucket, public: true, file_size_limit: 2000000, allowed_mime_types: ['image/jpeg', 'image/webp', 'image/png'] }) });
  if (!result.ok) throw Error('Не удалось создать хранилище фото');
}
