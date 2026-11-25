const verifiedPhotos = [
  [['l.kaspi.kz'], /^\/shop\/2RBc6kK6KYGm18d\/?$/, 'kaspi-177318958.jpg'],
  [['kaspi.kz', 'www.kaspi.kz'], /^\/shop\/p\/[^/]+-177318958\/?$/, 'kaspi-177318958.jpg'],
  [['ozon.kz', 'www.ozon.kz', 'ozon.ru', 'www.ozon.ru', 'am.ozon.com'], /^\/product\/(?:[^/]+-)?1421232894\/?$/, 'ozon-1421232894.webp'],
  [['global.wildberries.ru', 'www.wildberries.ru', 'wildberries.ru', 'www.wildberries.kz'], /^\/catalog\/1886783946\/detail\.aspx\/?$/, 'wildberries-1886783946.webp'],
];

export function verifiedPhotoPath(link) {
  const url = new URL(link);
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
  for (const [hosts, pattern, file] of verifiedPhotos) {
    if (hosts.includes(url.hostname) && pattern.test(url.pathname)) return '/product-photos/' + file;
  }
  return null;
}
