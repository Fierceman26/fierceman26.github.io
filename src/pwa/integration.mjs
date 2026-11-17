import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATIC_EXT = new Set([
  '.css',
  '.js',
  '.mjs',
  '.woff',
  '.woff2',
  '.png',
  '.svg',
  '.webmanifest',
  '.ico',
  '.webp',
]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function toUrlPath(root, file) {
  return `/${relative(root, file).split(sep).join('/')}`;
}

function isShellAsset(urlPath) {
  if (urlPath === '/sw.js') return false;
  if (urlPath.startsWith('/_astro/')) return STATIC_EXT.has(extname(urlPath).toLowerCase());
  if (urlPath === '/manifest.webmanifest') return true;
  if (urlPath === '/favicon.svg' || urlPath === '/apple-touch-icon.png') return true;
  if (urlPath.startsWith('/icons/')) return STATIC_EXT.has(extname(urlPath).toLowerCase());
  return false;
}

export function journalPwa() {
  return {
    name: 'journal-pwa',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = await walk(root);
        const assets = files.map((file) => toUrlPath(root, file)).filter(isShellAsset).sort();
        const template = await readFile(fileURLToPath(new URL('./sw.js', import.meta.url)), 'utf8');
        const buildId = new Date().toISOString();
        const source = template
          .replace('__BUILD_ID__', buildId)
          .replace('__PRECACHE_ASSETS__', JSON.stringify(assets));
        if (source.includes('__BUILD_ID__') || source.includes('__PRECACHE_ASSETS__')) {
          throw new Error('service worker template placeholders were not replaced');
        }
        await writeFile(join(root, 'sw.js'), source);
        logger.info(`service worker ${buildId} precaches ${assets.length} shell files`);
      },
    },
  };
}
