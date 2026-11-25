const pageHosts = new Set([
  'kaspi.kz', 'www.kaspi.kz', 'l.kaspi.kz',
  'ozon.kz', 'www.ozon.kz', 'ozon.ru', 'www.ozon.ru', 'ozon.com', 'www.ozon.com',
  'wildberries.ru', 'www.wildberries.ru', 'global.wildberries.ru', 'www.wildberries.kz',
]);
const imageHost = host => /^(?:resources\.cdn-kaspi\.kz|[a-z0-9-]+\.ozone\.ru|basket-\d+\.wbbasket\.ru|basket-\d+\.wbcontent\.net)$/.test(host);

async function download(url, allowed, type, limit, signal) {
  for (let hop = 0; hop < 5; hop++) {
    if (url.protocol !== 'https:' || url.port || url.username || url.password || !allowed(url.hostname)) return null;
    const response = await fetch(url, {redirect:'manual', signal});
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      url = new URL(location, url);
      continue;
    }
    const media = response.headers.get('content-type')?.split(';')[0];
    if (!response.ok || !type.test(media ?? '') || !response.body) {
      await response.body?.cancel();
      return null;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return {url, media, body: Buffer.concat(chunks)};
  }
  return null;
}

export async function productPhoto(link) {
  try {
    if (typeof link !== 'string' || link.length > 2000) return null;
    const signal = AbortSignal.timeout(6500);
    const page = await download(new URL(link), host => pageHosts.has(host), /^text\/html$/, 1_600_000, signal);
    if (!page) return null;
    const tags = page.body.toString().match(/<meta\s[^>]+>/gi) ?? [];
    for (const tag of tags) {
      const attributes = Object.fromEntries(
        [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
          .map(([, key, quoted, single]) => [key.toLowerCase(), quoted ?? single])
      );
      if (!['og:image', 'og:image:secure_url', 'twitter:image'].includes(attributes.property ?? attributes.name) || !attributes.content) continue;
      const url = new URL(attributes.content.replaceAll('&amp;', '&'), page.url);
      const image = await download(url, imageHost, /^image\/(jpeg|png|webp)$/, 2_000_000, signal);
      if (image) return 'data:' + image.media + ';base64,' + image.body.toString('base64');
    }
  } catch {
    return null;
  }
  return null;
}
