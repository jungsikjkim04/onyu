import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const indexPath = path.join(root, 'index.html');
let html = readFileSync(indexPath, 'utf8');
const sourceOrigin = 'https://onyu-pet-farewell.sikbb.chatgpt.site';
const configuredOrigin = process.env.RENDER_EXTERNAL_URL || sourceOrigin;
const origin = new URL(configuredOrigin);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('RENDER_EXTERNAL_URL must be an HTTPS origin without credentials, path, query or fragment.');
}

const localReferences = [];
for (const name of readdirSync(root)) {
  if (!/\.(html|css)$/.test(name)) continue;
  const text = readFileSync(path.join(root, name), 'utf8');
  const matches = name.endsWith('.html')
    ? text.matchAll(/(?:src|href|poster|data-src)=["']([^"']+)["']/g)
    : text.matchAll(/url\(["']?([^"')]+)["']?\)/g);
  for (const match of matches) {
    const ref = match[1];
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(ref)) continue;
    const target = path.resolve(root, ref.split(/[?#]/)[0]);
    if (!target.startsWith(root) || !existsSync(target)) throw new Error(`Missing or invalid asset in ${name}: ${ref}`);
    localReferences.push(ref);
  }
}

for (const [pattern, replacement] of [
  [/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${origin.origin}">`],
  [/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${origin.origin}/assets/hero.webp">`],
  [/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${origin.origin}">`],
]) {
  if (!pattern.test(html)) throw new Error('Required site metadata is missing.');
  html = html.replace(pattern, replacement);
}
writeFileSync(indexPath, html);
console.log(`Validated ${localReferences.length} local asset references. Site prepared for ${origin.origin}`);
