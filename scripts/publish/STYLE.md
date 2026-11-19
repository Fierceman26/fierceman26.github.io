# 发布规范

工具只做确定性的导入和校验。观点、译文、公式是否成立、交互实验是否值得做，都留给人和审稿的模型。脚本不声称已经审校。

## 稿件目录

目录放在仓库外。不要放进 `src/` 或 `public/`。

```text
稿件/
  meta.json
  body.mdx              # 中文是源稿。也可以叫 body.md
  body.en.mdx           # 可选。要有就必须是完整译文
  images/...            # 可选，对应正文里的 /images/...
  note.html             # 可选，由 meta.json 声明
```

正文从文件读，不从命令参数读。

## 元数据

与 `src/content/config.ts` 相同，而且必须写在 `meta.json`，不要写进正文 frontmatter。

| 字段 | 规则 |
| --- | --- |
| `slug` | 小写字母、数字、连字符。文件名就是 URL |
| `title` | 单行。页面的唯一 `h1`，正文里不要再写 `#` |
| `description` | 单行导语，列表和首页用 |
| `pubDate` | `YYYY-MM-DD`，或字符串 `today`（Asia/Shanghai）。不写带时区的时间，也不按运行机器的本地时区猜测 |
| `updatedDate` | 可选，同一日历格式 |
| `tags` | 字符串数组，可为空 |
| `category` | 空着可以，但首页栏目不收录。写了就必须是 `src/consts.ts` 里的 slug |
| `featured` | 布尔。`true` 只影响这篇，不改其他文章 |
| `draft` | 布尔。`true` 时构建不进列表 |
| `cover` | 可选，站内 `/images/...` |

当前栏目以代码为准：`hsd` 高速数字，`eoe` 电光链路，`siph` 硅光器件，`pi` 电源完整性，`gezhi` 格致。波导和耦合器归 `siph`，不归 `eoe`。

英文不是自动生成的。有 `body.en.mdx` 时，`meta.en` 必须自带 `title`、`description`、`tags`。日期、栏目、`featured`、`draft` 与中文相同。没有英文稿就不要造一份。

## 正文

沿用已有笔记，不另做一套 CSS。

- 小节用 `##` / `###`。
- 公式用 `<p class="eq">`，下标 `<sub>`，上标 `<sup>`。站点没有 KaTeX，`$$` 和 `\(...\)` 会原样失败，脚本也不补公式。
- 配图用 `<Figure src alt caption width height />`。`src` 是 `/images/...`，`alt` 必填。组件由 `astro.config.mjs` 注入，正文不要写 `import`。
- 已注册的交互块（如 `<BendLossPick />`）可以引用。不要新造组件，也不要在稿里生成“像那么回事”的实验。
- 内部链接用 `/posts/<slug>/` 或 `/en/posts/<slug>/`。
- 代码示例放进围栏。围栏里的 `import` 或 `<script>` 只是文字。

脚本对正文只做三件机械事，并写进结果的 `normalized`：去掉 BOM、换成 LF、补上文件末尾换行。替换 `{{attachment:id}}` 也算机械替换，会点名。除此之外原文保持不动。

## 图片

`png` / `jpg` / `jpeg` / `webp` / `gif`。不收 SVG。路径放在稿件目录的 `images/` 下，或与 `/images/...` 对应。已有同路径且字节相同则复用；字节不同则冲突，默认不覆盖，`--replace` 也不覆盖图片。

## HTML

两种，必须在 `meta.json` 里声明 `kind`。

- `static`：说明片段，只有文字标记（`p`、`sub`、`h2`、列表、表格、链接等），没有脚本。工具套进无脚本页面，放到 `public/notes/<slug>/<id>.html`。正文自己写链接，或写 `{{attachment:id}}`。
- `interactive`：完整交互页，只能内联脚本。工具注入固定 CSP，文件放在 `src/content/labs/<slug>/<id>.html`，不放进 `public/`。页面里用 `<LabFrame>` 嵌 `srcdoc`。`sandbox` 只有 `allow-scripts`，没有同源权限。构建只读这个文件，不执行它。

拒绝：外部脚本、`javascript:`、事件属性、iframe、SVG、表单、外链资源、`fetch` / WebSocket / `localStorage` / 访问 `parent`。说明页里的脚本不会被悄悄删掉，直接拒绝。正则挡得住的是明显写法；隔离靠沙盒，不靠“已经证明绝对安全”。

`{{attachment:id}}` 会换成链接或 `<LabFrame>`，并在 `normalized` 里写明。不要用它留公式或译文空位。

## 命令

```bash
node scripts/publish/cli.mjs --input <稿件目录> --dry-run
node scripts/publish/cli.mjs --input <稿件目录>
node scripts/publish/cli.mjs --input <稿件目录> --build
node scripts/publish/cli.mjs --input <稿件目录> --commit
node scripts/publish/cli.mjs --input <稿件目录> --push
```

`--dry-run` 不写文件，也不构建。重复执行同一稿，内容相同则 `unchanged`，不另建一篇。目标不同则拒绝，除非对文章或本篇 HTML 显式 `--replace`。

`--commit` 要求工作区干净，并且 `npm run build` 通过。然后只提交本次生成的文件到 `post/<slug>`。`--push` 只推这个分支。两者都不推 `main`，都不合并，都不开 Pull Request。开 PR 用仓库既有的 PR 流程，由人确认后再合并。合并进 `main` 后，仍由 `.github/workflows/deploy.yml` 部署。

stdout 是 JSON。失败时 `errors` 里有文件、代码和原因。`review` 那一行表示技术内容还没审。

## 不做的事

不翻译，不改写观点，不填缺失公式，不生成交互实验，不读取稿件目录以外的路径，不执行稿件里的脚本，不修改其他 slug，不定时发布。
