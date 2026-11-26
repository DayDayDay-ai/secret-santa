const pageHosts = new Set([
  'kaspi.kz', 'www.kaspi.kz', 'l.kaspi.kz',
  'ozon.kz', 'www.ozon.kz', 'ozon.ru', 'www.ozon.ru', 'ozon.com', 'www.ozon.com', 'am.ozon.com',
  'wildberries.ru', 'www.wildberries.ru', 'global.wildberries.ru', 'www.wildberries.kz',
]);
const imageHost = host => /^(?:resources\.cdn-kaspi\.kz|[a-z0-9-]+\.(?:ozone\.ru|ozonusercontent\.com)|basket-\d+\.wbbasket\.ru|basket-\d+\.wbcontent\.net)$/.test(host);

function structuredProductImages(html) {
  const images = [];
  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if ([value['@type']].flat().includes('Product')) {
      for (const image of [value.image].flat()) {
        const url = typeof image === 'string' ? image : image?.contentUrl ?? image?.url;
        if (typeof url === 'string') images.push(url);
      }
    }
    visit(value['@graph']);
    visit(value.mainEntity);
  }
  for (const [, json] of html.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(json)); } catch { continue; }
  }
  return images;
}

function tagAttributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map(([, key, quoted, single]) => [key.toLowerCase(), quoted ?? single])
  );
}

export function productImageCandidates(html, page) {
  const candidates = structuredProductImages(html);
  const wildberries = page.hostname.endsWith('wildberries.ru') || page.hostname.endsWith('wildberries.kz');
  const article = wildberries ? page.pathname.match(/\/catalog\/(\d+)\/detail\.aspx$/)?.[1] : null;
  const ozon = /(?:^|\.)ozon\.(?:kz|ru|com)$/.test(page.hostname);
  const gallery = [];
  for (const [tag] of html.matchAll(/<img\s[^>]+>/gi)) {
    const attrs = tagAttributes(tag);
    const source = attrs['data-src'] || attrs.src;
    if (!source) continue;
    if (article && attrs.alt === 'Product image 1' && source.includes('/' + article + '/images/')) {
      if (source.includes('/images/big/')) gallery.unshift(source);
      else gallery.push(source);
    } else if (ozon && / #1$/.test(attrs.alt ?? '')) {
      gallery.push(source);
    }
  }
  candidates.unshift(...gallery);
  for (const [tag] of html.matchAll(/<meta\s[^>]+>/gi)) {
    const attrs = tagAttributes(tag);
    if (['og:image', 'og:image:secure_url', 'twitter:image'].includes(attrs.property ?? attrs.name) && attrs.content) {
      candidates.push(attrs.content);
    }
  }
  const images = new Set();
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate.replaceAll('&amp;', '&'), page);
      if (url.protocol === 'https:' && !url.port && !url.username && !url.password && imageHost(url.hostname)) images.add(url.href);
    } catch { continue; }
  }
  return [...images];
}

function isStoreUrl(url) {
  return url.protocol === 'https:' && !url.port && !url.username && !url.password && pageHosts.has(url.hostname)
    && /^(?:\/shop\/(?:p\/)?[^/]+\/?|\/product\/[^/]+\/?|\/catalog\/\d+\/detail\.aspx)$/.test(url.pathname);
}

function browserResourceAllowed(url) {
  return url.protocol === 'https:' && !url.port && !url.username && !url.password
    && (pageHosts.has(url.hostname) || imageHost(url.hostname)
      || /^(?:[\w-]+\.)*(?:kaspi\.kz|ozonusercontent\.com|ozonstatic\.ru|wildberries\.ru|wbbasket\.ru|wbstatic\.net|geobasket\.net)$/.test(url.hostname));
}

async function browserProductPhoto(url, report) {
  let browser;
  try {
    const {chromium} = await import('playwright-core');
    const executablePath = process.env.PRODUCT_CHROME_PATH;
    const packaged = executablePath ? null : (await import('@sparticuz/chromium')).default;
    browser = await chromium.launch({
      executablePath: executablePath || await packaged.executablePath(),
      args: packaged?.args ?? [],
      headless: true,
      timeout: 7000,
    });
    const context = await browser.newContext({serviceWorkers:'block', acceptDownloads:false});
    await context.route('**/*', route => {
      const request = route.request();
      const resource = new URL(request.url());
      const allowed = request.method() === 'GET' && browserResourceAllowed(resource)
        && !['font','media'].includes(request.resourceType());
      return allowed ? route.continue() : route.abort();
    });
    if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => socket.close());
    const page = await context.newPage();
    const imageResponses = new Map();
    page.on('response', response => {
      if (response.ok() && imageHost(new URL(response.url()).hostname)) imageResponses.set(response.url(), response);
    });
    const navigation = await page.goto(url.href, {waitUntil:'domcontentloaded', timeout:8500}).catch(error => {
      report('navigation', error.message.match(/net::[A-Z_]+/)?.[0] ?? error.name);
    });
    if (navigation) report('navigation', navigation.status());
    await page.waitForFunction(() => document.querySelector(
      'img[alt="Product image 1"], img[alt$=" #1"], [data-widget="webGallery"] img'
    ) || [...document.querySelectorAll('script[type="application/ld+json"]')]
      .some(script => /"@type"\s*:\s*"Product"/.test(script.textContent)), undefined, {timeout:12000}).catch(() => {});
    const finalUrl = new URL(page.url());
    if (!isStoreUrl(finalUrl)) { report('card', 'unavailable'); return null; }
    const candidates = productImageCandidates(await page.content(), finalUrl);
    report('gallery', candidates.length);
    const deadline = Date.now() + 4500;
    for (const candidate of candidates) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      let response;
      try {
        response = imageResponses.get(candidate) ?? await context.request.get(candidate, {
          timeout:remaining, maxRedirects:0,
        });
        const headers = response.headers();
        const media = headers['content-type']?.split(';')[0];
        if (!response.ok() || !/^image\/(jpeg|png|webp)$/.test(media ?? '')
          || Number(headers['content-length']) > 2_000_000) continue;
        const bytes = await response.body();
        if (bytes.length && bytes.length <= 2_000_000) {
          report('image', bytes.length);
          return 'data:' + media + ';base64,' + bytes.toString('base64');
        }
      } catch {
        continue;
      } finally {
        if (response?.dispose) await response.dispose().catch(() => {});
      }
    }
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
  return null;
}

export async function productPhoto(link, report = () => {}) {
  if (typeof link !== 'string' || link.length > 2000) return null;
  let url;
  try { url = new URL(link); } catch { return null; }
  if (!isStoreUrl(url)) return null;
  url.searchParams.delete('sessionId');
  url.hash = '';
  return browserProductPhoto(url, report);
}
