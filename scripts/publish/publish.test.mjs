import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { assertSafeGit, loadConventions, planGit, shanghaiDate } from './conventions.mjs';
import { publish } from './publish.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const realRepo = path.resolve(here, '../..');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-repo-'));
  fs.mkdirSync(path.join(repo, 'src/content/posts/en'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'public/images'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.github/workflows'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'src/consts.ts'),
    `export const CATEGORIES = [
  { slug: 'hsd', title: 'HSD' },
  { slug: 'eoe', title: 'EOE' },
  { slug: 'siph', title: 'SiPh' },
  { slug: 'pi', title: 'PI' },
  { slug: 'gezhi', title: 'AI随想' },
  { slug: 'llm', title: 'LLM' },
] as const;
export type CategorySlug = (typeof CATEGORIES)[number]['slug'];
`,
  );
  fs.writeFileSync(
    path.join(repo, 'astro.config.mjs'),
    `const widgets = [
  { tag: '<Figure', marker: 'x', line: 'y' },
  { tag: '<BendLossPick', marker: 'x', line: 'y' },
  { tag: '<LabFrame', marker: 'x', line: 'y' },
];
return { name: 'mdx-figure-components' };
`,
  );
  fs.writeFileSync(
    path.join(repo, '.github/workflows/deploy.yml'),
    `on:
  push:
    branches: [main]
jobs:
  build:
    steps:
      - run: npm run build
  deploy:
    steps:
      - uses: actions/deploy-pages@v4
`,
  );
  return repo;
}

function writeInput(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-in-'));
  for (const [name, content] of Object.entries(files)) {
    const abs = path.join(dir, name);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

function meta(extra = {}) {
  return {
    slug: 'pi-note',
    title: '纹波预算里少掉的一截',
    description: '把容差直接当成纹波，PDN 目标会松一截。',
    pubDate: '2026-11-19',
    tags: ['PDN'],
    category: 'pi',
    featured: false,
    draft: false,
    ...extra,
  };
}

const body = '测量先于公式。\n\n## 预算\n\n<p class="eq">Z = V<sub>ripple</sub> / I</p>\n';

function codes(result) {
  return result.errors.map((item) => item.code);
}

test('valid import keeps the source and reuses the post frontmatter', async () => {
  const repo = makeRepo();
  const input = writeInput({
    'meta.json': JSON.stringify(meta()),
    'body.mdx': body,
  });
  const result = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.wrote, ['src/content/posts/pi-note.mdx']);
  assert.equal(result.pubDate, '2026-11-19');
  const written = fs.readFileSync(path.join(repo, 'src/content/posts/pi-note.mdx'), 'utf8');
  assert.match(written, /^---\ntitle: "纹波预算里少掉的一截"\ndescription: "把容差直接当成纹波，PDN 目标会松一截。"\npubDate: 2026-11-19\ntags: \["PDN"\]\ncategory: "pi"\nfeatured: false\ndraft: false\n---\n\n/);
  assert.ok(written.endsWith(body));
  assert.equal(result.normalized.length, 0);
  assert.equal(result.git.committed, false);
  assert.equal(result.git.merged, false);
  assert.equal(result.deploy.triggered, false);
});

test('running again does not create a second article', async () => {
  const repo = makeRepo();
  const input = writeInput({ 'meta.json': JSON.stringify(meta()), 'body.mdx': body });
  await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
  const again = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
  assert.equal(again.ok, true);
  assert.deepEqual(again.wrote, []);
  assert.deepEqual(again.unchanged, ['src/content/posts/pi-note.mdx']);
  const posts = fs.readdirSync(path.join(repo, 'src/content/posts')).filter((name) => name.endsWith('.mdx'));
  assert.deepEqual(posts, ['pi-note.mdx']);
});

test('different content conflicts unless replace is explicit', async () => {
  const repo = makeRepo();
  const input = writeInput({ 'meta.json': JSON.stringify(meta()), 'body.mdx': body });
  await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
  const changed = '另一句，不是上一稿。\n\n## 预算\n\n<p class="eq">Z = V<sub>ripple</sub> / I</p>\n';
  fs.writeFileSync(path.join(input, 'body.mdx'), changed);
  const blocked = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
  assert.equal(blocked.ok, false);
  assert.ok(codes(blocked).includes('conflict'));
  assert.ok(fs.readFileSync(path.join(repo, 'src/content/posts/pi-note.mdx'), 'utf8').endsWith(body));
  const replaced = await publish({ repoRoot: repo, inputDir: input, mdx: 'off', replace: true });
  assert.equal(replaced.ok, true);
  assert.ok(fs.readFileSync(path.join(repo, 'src/content/posts/pi-note.mdx'), 'utf8').endsWith(changed));
});

test('image byte conflict is refused even with replace', async () => {
  const repo = makeRepo();
  fs.mkdirSync(path.join(repo, 'public/images/pi'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'public/images/pi/scope.png'), Buffer.from('old'));
  const figure = `${body}<Figure src="/images/pi/scope.png" alt="纹波" caption="预算。" width={640} height={480} />\n`;
  const input = writeInput({
    'meta.json': JSON.stringify(meta()),
    'body.mdx': figure,
    'images/pi/scope.png': PNG,
  });
  const result = await publish({ repoRoot: repo, inputDir: input, mdx: 'off', replace: true });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('conflict'));
  assert.equal(fs.existsSync(path.join(repo, 'src/content/posts/pi-note.mdx')), false);
  assert.equal(fs.readFileSync(path.join(repo, 'public/images/pi/scope.png'), 'utf8'), 'old');
});

test('illegal frontmatter, category, and slug are named and not written', async () => {
  const repo = makeRepo();
  const cases = [
    meta({ title: '' }),
    meta({ category: 'signal-integrity' }),
    meta({ slug: '../secret' }),
    meta({ featured: 'false' }),
    meta({ pubDate: '2026-11-19T00:00:00Z' }),
  ];
  for (const item of cases) {
    const input = writeInput({ 'meta.json': JSON.stringify(item), 'body.mdx': body });
    const result = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
    assert.equal(result.ok, false, JSON.stringify(item));
    assert.equal(fs.existsSync(path.join(repo, 'src/content/posts')), true);
    assert.equal(fs.readdirSync(path.join(repo, 'src/content/posts')).some((name) => name.endsWith('.mdx')), false);
    assert.equal(fs.existsSync(path.join(repo, 'secret.mdx')), false);
  }
  const missing = writeInput({ 'meta.json': JSON.stringify({ slug: 'pi-note' }), 'body.mdx': body });
  const result = await publish({ repoRoot: repo, inputDir: missing, mdx: 'off' });
  assert.ok(codes(result).includes('missing-field'));
  assert.equal(result.pubDate, null);
});

test('missing image, escaped image path, and symlink outside the inbox are refused', async () => {
  const repo = makeRepo();
  const missing = writeInput({
    'meta.json': JSON.stringify(meta()),
    'body.mdx': `${body}<Figure src="/images/pi/missing.png" alt="没有这张图" caption="空。" />\n`,
  });
  const missingResult = await publish({ repoRoot: repo, inputDir: missing, mdx: 'off' });
  assert.ok(codes(missingResult).includes('missing-resource'));
  assert.match(missingResult.errors.find((item) => item.code === 'missing-resource').message, /missing\.png/);

  const escaped = writeInput({
    'meta.json': JSON.stringify(meta()),
    'body.mdx': `${body}<Figure src="/images/../../etc/passwd" alt="越界" caption="不该读。" />\n`,
  });
  const escapedResult = await publish({ repoRoot: repo, inputDir: escaped, mdx: 'off' });
  assert.equal(escapedResult.ok, false);
  assert.equal(fs.existsSync(path.join(repo, 'src/content/posts/pi-note.mdx')), false);

  const linked = writeInput({
    'meta.json': JSON.stringify(meta()),
    'body.mdx': `${body}<Figure src="/images/pi/leak.png" alt="链接" caption="不该读。" />\n`,
  });
  fs.mkdirSync(path.join(linked, 'images'), { recursive: true });
  fs.symlinkSync('/etc/passwd', path.join(linked, 'images/leak.png'));
  const linkedResult = await publish({ repoRoot: repo, inputDir: linked, mdx: 'off' });
  assert.ok(codes(linkedResult).includes('path-escape'));
  assert.equal(fs.existsSync(path.join(repo, 'public/images/pi/leak.png')), false);
});

test('attachment path cannot leave the inbox', async () => {
  const repo = makeRepo();
  const input = writeInput({
    'meta.json': JSON.stringify(meta({
      attachments: [{ id: 'note', file: '../../etc/passwd', kind: 'static', label: '说明' }],
    })),
    'body.mdx': `${body}[说明](/notes/pi-note/note.html)\n`,
  });
  const result = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
  assert.ok(codes(result).includes('path-escape'));
  assert.equal(fs.existsSync(path.join(repo, 'public/notes/pi-note/note.html')), false);
});

test('inbox cannot be the content tree', async () => {
  const repo = makeRepo();
  const result = await publish({
    repoRoot: repo,
    inputDir: path.join(repo, 'src/content/posts'),
    mdx: 'off',
  });
  assert.ok(codes(result).includes('input-location'));
});

test('mdx and html safety boundaries reject unsafe input without writing', async () => {
  const repo = makeRepo();
  const samples = [
    ['import x from "y";\n\n## 标题\n\n正文。\n', 'mdx-import'],
    ['## 标题\n\n<script>alert(1)</script>\n', 'unknown-tag'],
    ['## 标题\n\n[点](javascript:alert(1))\n', 'bad-link'],
    ['# 另一个标题\n\n正文。\n', 'h1'],
    ['## 标题\n\n$$\nE = mc^2\n$$\n', 'math-unsupported'],
    ['## 标题\n\n<p class="eq"></p>\n', 'empty-equation'],
    ['## 标题\n\n<CustomWidget />\n', 'unknown-tag'],
  ];
  for (const [text, code] of samples) {
    const input = writeInput({ 'meta.json': JSON.stringify(meta()), 'body.mdx': text });
    const result = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
    assert.equal(result.ok, false, text);
    assert.ok(codes(result).includes(code), `${code} in ${codes(result)}`);
    assert.equal(fs.existsSync(path.join(repo, 'src/content/posts/pi-note.mdx')), false);
  }
});

test('a script example inside a fence is kept as text', async () => {
  const repo = makeRepo();
  const source = '## 例子\n\n```html\n<script>alert(1)</script>\n```\n\n```js\nimport x from "y";\n```\n';
  const input = writeInput({ 'meta.json': JSON.stringify(meta()), 'body.mdx': source });
  const result = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  const written = fs.readFileSync(path.join(repo, 'src/content/posts/pi-note.mdx'), 'utf8');
  assert.ok(written.includes('<script>alert(1)</script>'));
  assert.ok(written.includes('import x from "y";'));
});

test('registered components and Figure are accepted with the image copied once', async () => {
  const repo = makeRepo();
  const source = `${body}<BendLossPick />\n\n<Figure\n  src="/images/pi/scope.png"\n  alt="示波器上的纹波"\n  caption="预算只剩这一截。"\n  width={640}\n  height={480}\n/>\n`;
  const input = writeInput({
    'meta.json': JSON.stringify(meta()),
    'body.mdx': source,
    'images/pi/scope.png': PNG,
  });
  const result = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.ok(result.wrote.includes('public/images/pi/scope.png'));
  assert.ok(PNG.equals(fs.readFileSync(path.join(repo, 'public/images/pi/scope.png'))));
  const written = fs.readFileSync(path.join(repo, 'src/content/posts/pi-note.mdx'), 'utf8');
  assert.ok(written.includes('<BendLossPick />'));
  assert.ok(written.includes('src="/images/pi/scope.png"'));
  assert.equal(written.includes('<style'), false);
});

test('static and interactive html stay on different sides of the sandbox', async () => {
  const repo = makeRepo();
  const source = '## 附件\n\n[记账](/notes/pi-note/note.html)\n\n{{attachment:scan}}\n';
  const input = writeInput({
    'meta.json': JSON.stringify(meta({
      attachments: [
        { id: 'note', file: 'note.html', kind: 'static', label: '记账' },
        { id: 'scan', file: 'scan.html', kind: 'interactive', label: '扫描' },
      ],
    })),
    'body.mdx': source,
    'note.html': '<p>这一截是<strong>说明</strong>，没有控件。</p>\n',
    'scan.html': '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>扫描</p><script>document.body.dataset.ready = "yes";</script></body></html>',
  });
  const result = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  const note = fs.readFileSync(path.join(repo, 'public/notes/pi-note/note.html'), 'utf8');
  assert.match(note, /script-src 'none'/);
  assert.match(note, /说明/);
  assert.equal(note.includes('<script'), false);
  const lab = fs.readFileSync(path.join(repo, 'src/content/labs/pi-note/scan.html'), 'utf8');
  assert.match(lab, /script-src 'unsafe-inline'/);
  assert.equal(fs.existsSync(path.join(repo, 'public/lab/pi-note/scan.html')), false);
  const written = fs.readFileSync(path.join(repo, 'src/content/posts/pi-note.mdx'), 'utf8');
  assert.ok(written.includes('[记账](/notes/pi-note/note.html)'));
  assert.ok(written.includes('<LabFrame src="/lab/pi-note/scan.html" title="扫描" />'));
  assert.ok(result.normalized.some((item) => item.changes.includes('attachment-marker:scan')));
  assert.ok(result.normalized.some((item) => item.file === 'scan.html' && item.changes.includes('injected-csp')));
});

test('static html with a script is rejected instead of stripped', async () => {
  const repo = makeRepo();
  const input = writeInput({
    'meta.json': JSON.stringify(meta({
      attachments: [{ id: 'note', file: 'note.html', kind: 'static', label: '说明' }],
    })),
    'body.mdx': `${body}[说明](/notes/pi-note/note.html)\n`,
    'note.html': '<p>说明</p><script>alert(1)</script>',
  });
  const result = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
  assert.ok(codes(result).includes('static-has-script'));
  assert.equal(fs.existsSync(path.join(repo, 'public/notes/pi-note/note.html')), false);
});

test('interactive html cannot load a remote script or call the network', async () => {
  const repo = makeRepo();
  const bad = [
    '<script src="https://example.com/app.js"></script>',
    '<script>fetch("/secret")</script>',
    '<script>parent.location = "/";</script>',
  ];
  for (const html of bad) {
    const input = writeInput({
      'meta.json': JSON.stringify(meta({
        attachments: [{ id: 'scan', file: 'scan.html', kind: 'interactive', label: '扫描' }],
      })),
      'body.mdx': `${body}<LabFrame src="/lab/pi-note/scan.html" title="扫描" />\n`,
      'scan.html': html,
    });
    const result = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
    assert.equal(result.ok, false, html);
    assert.equal(fs.existsSync(path.join(repo, 'src/content/labs/pi-note/scan.html')), false);
  }
});

test('dry-run writes nothing', async () => {
  const repo = makeRepo();
  const input = writeInput({ 'meta.json': JSON.stringify(meta()), 'body.mdx': body });
  const result = await publish({ repoRoot: repo, inputDir: input, dryRun: true, build: true, mdx: 'off' });
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.deepEqual(result.wrote, []);
  assert.deepEqual(result.planned, ['src/content/posts/pi-note.mdx']);
  assert.equal(result.build.ran, false);
  assert.equal(fs.existsSync(path.join(repo, 'src/content/posts/pi-note.mdx')), false);
});

test('english is optional and is never invented', async () => {
  const repo = makeRepo();
  const onlyFile = writeInput({
    'meta.json': JSON.stringify(meta()),
    'body.mdx': body,
    'body.en.mdx': '## Translated\n\nA real sentence.\n',
  });
  const missingMeta = await publish({ repoRoot: repo, inputDir: onlyFile, mdx: 'off' });
  assert.ok(codes(missingMeta).includes('en-pair'));
  assert.equal(fs.existsSync(path.join(repo, 'src/content/posts/en/pi-note.mdx')), false);

  const paired = writeInput({
    'meta.json': JSON.stringify(meta({
      en: { title: 'The missing slice of the ripple budget', description: 'Using the tolerance as the ripple loosens the PDN target.', tags: ['PDN'] },
    })),
    'body.mdx': body,
    'body.en.mdx': '## Budget\n\n<p class="eq">Z = V<sub>ripple</sub> / I</p>\n',
  });
  const result = await publish({ repoRoot: repo, inputDir: paired, mdx: 'off' });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  const english = fs.readFileSync(path.join(repo, 'src/content/posts/en/pi-note.mdx'), 'utf8');
  assert.match(english, /title: "The missing slice of the ripple budget"/);
  assert.equal(english.includes('纹波预算'), false);
  assert.match(english, /pubDate: 2026-11-19/);
});

test('today uses Asia/Shanghai rather than the machine zone', async () => {
  const repo = makeRepo();
  const input = writeInput({
    'meta.json': JSON.stringify(meta({ pubDate: 'today' })),
    'body.mdx': body,
  });
  const late = await publish({
    repoRoot: repo,
    inputDir: input,
    now: new Date('2026-11-19T16:30:00.000Z'),
    mdx: 'off',
  });
  assert.equal(late.pubDate, '2026-11-20');
  assert.match(fs.readFileSync(path.join(repo, 'src/content/posts/pi-note.mdx'), 'utf8'), /pubDate: 2026-11-20/);
  assert.equal(shanghaiDate(new Date('2026-11-19T15:30:00.000Z')), '2026-11-19');
});

test('mechanical newline normalization is reported and does not change the words', async () => {
  const repo = makeRepo();
  const input = writeInput({
    'meta.json': JSON.stringify(meta()),
    'body.mdx': '测量先于公式。\r\n\r\n## 预算\r\n',
  });
  const result = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.ok(result.normalized.some((item) => item.file === 'body.mdx' && item.changes.includes('to-lf')));
  const written = fs.readFileSync(path.join(repo, 'src/content/posts/pi-note.mdx'), 'utf8');
  assert.ok(written.includes('测量先于公式。\n\n## 预算\n'));
  assert.equal(written.includes('\r'), false);
});

test('body frontmatter is refused instead of being stripped', async () => {
  const repo = makeRepo();
  const input = writeInput({
    'meta.json': JSON.stringify(meta()),
    'body.mdx': '---\ntitle: "另一套标题"\n---\n\n## 预算\n\n正文。\n',
  });
  const result = await publish({ repoRoot: repo, inputDir: input, mdx: 'off' });
  assert.ok(codes(result).includes('body-frontmatter'));
  assert.equal(fs.existsSync(path.join(repo, 'src/content/posts/pi-note.mdx')), false);
});

test('the shipped template cannot be published as a post', async () => {
  const repo = makeRepo();
  const result = await publish({
    repoRoot: repo,
    inputDir: path.join(realRepo, 'scripts/publish/templates'),
    mdx: 'off',
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('bad-date'));
  assert.ok(codes(result).includes('placeholder'));
  assert.equal(fs.readdirSync(path.join(repo, 'src/content/posts')).some((name) => name.endsWith('.mdx')), false);
});

test('conventions come from the current site, not a second list', () => {
  const conventions = loadConventions(realRepo);
  assert.deepEqual(conventions.categories, ['hsd', 'eoe', 'siph', 'pi', 'gezhi', 'llm']);
  for (const name of ['Figure', 'BendLossPick', 'LabFrame', 'SolverPick']) {
    assert.ok(conventions.components.includes(name), name);
  }
});

test('git planning never merges or pushes main', () => {
  assert.throws(() => assertSafeGit(['merge', 'main']), /merge/);
  assert.throws(() => assertSafeGit(['push', '-u', 'origin', 'main']), /main/);
  assert.throws(() => assertSafeGit(['push', '--force', 'origin', 'post/pi-note']), /强制/);
  const planned = planGit({
    slug: 'pi-note',
    branchNow: 'main',
    files: ['src/content/posts/pi-note.mdx'],
    push: true,
  });
  assert.equal(planned.branch, 'post/pi-note');
  assert.deepEqual(planned.commands.map((command) => command[0]), ['checkout', 'add', 'commit', 'push']);
  assert.equal(planned.commands.at(-1).at(-1), 'post/pi-note');
});

const gitEnv = {
  GIT_AUTHOR_NAME: 'Publish Test',
  GIT_AUTHOR_EMAIL: 'publish-test@example.com',
  GIT_COMMITTER_NAME: 'Publish Test',
  GIT_COMMITTER_EMAIL: 'publish-test@example.com',
};

function git(repo, args) {
  const result = spawnSync('git', args, { cwd: repo, env: { ...process.env, ...gitEnv }, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git ${args[0]}`);
  return result.stdout;
}

function gitRepo() {
  const repo = makeRepo();
  git(repo, ['init', '-b', 'main']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'init']);
  return repo;
}

test('commit refuses a dirty tree before writing', async () => {
  const repo = gitRepo();
  fs.writeFileSync(path.join(repo, 'scratch.txt'), 'unrelated\n');
  const input = writeInput({ 'meta.json': JSON.stringify(meta()), 'body.mdx': body });
  const result = await publish({
    repoRoot: repo,
    inputDir: input,
    commit: true,
    mdx: 'off',
    gitEnv,
    buildRunner: async () => ({ ok: true, log: '' }),
  });
  assert.ok(codes(result).includes('dirty-workspace'));
  assert.equal(result.git.committed, false);
  assert.equal(fs.existsSync(path.join(repo, 'src/content/posts/pi-note.mdx')), false);
  assert.equal(git(repo, ['branch', '--show-current']).trim(), 'main');
});

test('commit happens only after build and only contains generated files', async () => {
  const repo = gitRepo();
  const input = writeInput({
    'meta.json': JSON.stringify(meta()),
    'body.mdx': `${body}<Figure src="/images/pi/scope.png" alt="纹波" caption="预算。" width={32} height={32} />\n`,
    'images/pi/scope.png': PNG,
  });
  let built = 0;
  const result = await publish({
    repoRoot: repo,
    inputDir: input,
    commit: true,
    mdx: 'off',
    gitEnv,
    buildRunner: async () => {
      built += 1;
      return { ok: true, log: '' };
    },
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(built, 1);
  assert.equal(result.git.committed, true);
  assert.equal(result.git.pushed, false);
  assert.equal(result.git.merged, false);
  assert.equal(git(repo, ['branch', '--show-current']).trim(), 'post/pi-note');
  const names = git(repo, ['show', '--name-only', '--pretty=format:', 'HEAD']).split('\n').map((line) => line.trim()).filter(Boolean);
  assert.deepEqual(names.sort(), ['public/images/pi/scope.png', 'src/content/posts/pi-note.mdx']);
  assert.equal(git(repo, ['log', '--merges', '--oneline']).trim(), '');
});

test('a failed build does not commit', async () => {
  const repo = gitRepo();
  const input = writeInput({ 'meta.json': JSON.stringify(meta()), 'body.mdx': body });
  const result = await publish({
    repoRoot: repo,
    inputDir: input,
    commit: true,
    mdx: 'off',
    gitEnv,
    buildRunner: async () => ({ ok: false, log: 'missing brace' }),
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('build-failed'));
  assert.equal(result.git.committed, false);
  assert.equal(git(repo, ['branch', '--show-current']).trim(), 'main');
  assert.equal(git(repo, ['log', '--oneline']).trim().endsWith('init'), true);
  assert.equal(fs.existsSync(path.join(repo, 'src/content/posts/pi-note.mdx')), true);
});

test('cli dry-run stays off the content directory', () => {
  const repo = makeRepo();
  const input = writeInput({ 'meta.json': JSON.stringify(meta()), 'body.mdx': body });
  const result = spawnSync(process.execPath, [
    path.join(realRepo, 'scripts/publish/cli.mjs'),
    '--input', input,
    '--repo', repo,
    '--dry-run',
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout);
  assert.equal(json.ok, true);
  assert.equal(json.dryRun, true);
  assert.equal(fs.existsSync(path.join(repo, 'src/content/posts/pi-note.mdx')), false);
});

test('real repository dry-run does not touch published posts', async () => {
  const slug = 'zz-publish-fixture';
  const input = writeInput({
    'meta.json': JSON.stringify(meta({ slug, draft: true })),
    'body.mdx': body,
  });
  const target = path.join(realRepo, 'src/content/posts', `${slug}.mdx`);
  const before = spawnSync('git', ['status', '--porcelain'], { cwd: realRepo, encoding: 'utf8' }).stdout;
  try {
    const result = await publish({ repoRoot: realRepo, inputDir: input, dryRun: true });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(fs.existsSync(target), false);
    const after = spawnSync('git', ['status', '--porcelain'], { cwd: realRepo, encoding: 'utf8' }).stdout;
    assert.equal(after, before);
  } finally {
    if (fs.existsSync(target)) fs.rmSync(target);
  }
});
