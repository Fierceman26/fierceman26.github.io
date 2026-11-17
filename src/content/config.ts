import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 文章 collection ——
// frontmatter 字段含义：
//   title:       文章标题（serif 大字渲染）
//   description: 摘要，列表页和首页 featured 卡片用
//   pubDate:     发布日期（必填）
//   updatedDate: 修订日期（可选）
//   tags:        标签数组（["ADS", "SIPro"]）
//   category:    一级分类（首页类目过滤用）
//   featured:    是否置顶为首页 hero 文章
//   draft:       true 时构建不出现在列表
//   cover:       封面图（杂志风用得不多，可选）
const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    category: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    cover: z.string().optional(),
  }),
});

export const collections = { posts };
