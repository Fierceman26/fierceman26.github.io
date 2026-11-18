import { REPOST_MARK } from './repost-mark.mjs';

// Markdown images are bare <img> nodes. Figure.astro renders its own <img>
// inside the component, so those never pass through here and are not marked twice.
function isImg(node) {
  return !!node && node.type === 'element' && node.tagName === 'img';
}

function wrapImage(img) {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: ['post-img'] },
    children: [
      img,
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['img-credit'], ariaHidden: 'true' },
        children: [{ type: 'text', value: REPOST_MARK }],
      },
    ],
  };
}

function walk(node) {
  if (!node || !Array.isArray(node.children)) return;
  node.children = node.children.map((child) => {
    if (isImg(child)) return wrapImage(child);
    walk(child);
    return child;
  });
}

export function rehypeImageMark() {
  return (tree) => {
    walk(tree);
  };
}
