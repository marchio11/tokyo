// Impacchetta i file di dist/ dentro un unico Worker Cloudflare (worker/index.js)
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

const root = 'dist'
const files = {}
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else files['/' + relative(root, p).split('\\').join('/')] = {
      type: TYPES[extname(p)] ?? 'application/octet-stream',
      data: readFileSync(p).toString('base64'),
    }
  }
}
walk(root)

const code = `const FILES = ${JSON.stringify(files)};
const cache = new Map();
function body(f) {
  let b = cache.get(f);
  if (!b) { b = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0)); cache.set(f, b); }
  return b;
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const f = FILES[path] ?? FILES['/index.html'];
    const immutable = path.startsWith('/assets/');
    return new Response(body(f), {
      headers: {
        'content-type': f.type,
        'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        'x-content-type-options': 'nosniff',
      },
    });
  },
};
`
mkdirSync('worker', { recursive: true })
writeFileSync('worker/index.js', code)
console.log(`worker/index.js: ${Object.keys(files).length} file, ${(code.length / 1024).toFixed(0)} KB`)
