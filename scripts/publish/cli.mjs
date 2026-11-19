#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publish } from './publish.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const help = `用法
  node scripts/publish/cli.mjs --input <稿件目录> [--dry-run] [--replace] [--build] [--commit] [--push]

稿件目录里放 meta.json 和 body.mdx（或 body.md）。英文对照是可选的 body.en.mdx，必须自带译文。
图片和 HTML 用目录里的路径传递，不要把正文写进命令参数。

  --dry-run   只校验，打印将写入的路径，不写文件
  --replace   同一 slug 的文章或它自己的 HTML 附件内容不同时才覆盖。图片冲突始终拒绝
  --build     写入后运行 npm run build。dry-run 不构建
  --commit    工作区必须干净。构建通过后，只把本次生成的文件提交到新分支 post/<slug>
  --push      在提交成功后推送 post/<slug>。拒绝推送 main。不开 PR，不合并
  --repo      仓库根目录，默认是本仓库
  --json      stdout 只保留 JSON，不在 stderr 打印摘要

约定：scripts/publish/STYLE.md
模板：scripts/publish/templates/
`;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--replace') out.replace = true;
    else if (arg === '--build') out.build = true;
    else if (arg === '--commit') out.commit = true;
    else if (arg === '--push') out.push = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--input' || arg === '--repo') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} 需要路径`);
      out[arg.slice(2)] = value;
      i += 1;
    } else {
      throw new Error(`无法识别的参数 ${arg}`);
    }
  }
  return out;
}

function summarize(result) {
  const build = result.build?.ran ? `build=${result.build.ok ? 'ok' : 'fail'}` : 'build=not-run';
  const git = result.git?.committed ? 'commit=yes' : 'commit=not-run';
  const head = [
    result.ok ? 'ok' : 'fail',
    `slug=${result.slug ?? '-'}`,
    `pubDate=${result.pubDate ?? '-'}`,
    `wrote=${result.wrote?.length ?? 0}`,
    `unchanged=${result.unchanged?.length ?? 0}`,
    `warnings=${result.warnings?.length ?? 0}`,
    `errors=${result.errors?.length ?? 0}`,
    `dryRun=${Boolean(result.dryRun)}`,
    build,
    git,
  ].join('  ');
  const lines = [head];
  for (const item of result.errors ?? []) lines.push(`  ${item.file}  ${item.code}  ${item.message}`);
  for (const item of result.warnings ?? []) lines.push(`  ${item.file}  ${item.code}  ${item.message}`);
  return lines.join('\n');
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const result = { ok: false, errors: [{ code: 'usage', file: '-', message }], warnings: [], wrote: [] };
  process.stderr.write(`${message}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(2);
}

if (args.help) {
  process.stdout.write(help);
  process.exit(0);
}
if (args.push) args.commit = true;

let result;
try {
  result = await publish({
    repoRoot: path.resolve(args.repo || path.join(here, '../..')),
    inputDir: args.input,
    dryRun: Boolean(args.dryRun),
    replace: Boolean(args.replace),
    build: Boolean(args.build || args.commit),
    commit: Boolean(args.commit),
    push: Boolean(args.push),
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  result = { ok: false, errors: [{ code: 'internal', file: '-', message }], warnings: [], wrote: [] };
}

if (!args.json) process.stderr.write(`${summarize(result)}\n`);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(result.ok ? 0 : result.errors?.some((item) => item.code === 'usage') ? 2 : 1);
