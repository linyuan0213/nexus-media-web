/**
 * 图片 URL 处理工具
 * 统一将 TMDB 等外部图片转换为本地代理 URL
 */
const fallbackImage = '/static/img/no-image.png';

/**
 * 将图片 URL 转换为本地代理 URL
 * 1. 空值返回默认占位图
 * 2. 已是本地代理路径则直接返回
 * 3. TMDB 图片转换为 /img/tmdb/{size}/{path}
 * 4. 其他外部图片走 /img?url= 重定向代理
 */
export function getImgUrl(src?: null | string): string {
  if (!src) return fallbackImage;
  if (src.startsWith('/img/')) return src;
  const tmdbMatch = src.match(/https?:\/\/image\.tmdb\.org\/t\/p\/(\w+)(\/.+)/);
  if (tmdbMatch) return `/img/tmdb/${tmdbMatch[1]}${tmdbMatch[2]}`;
  return `/img?url=${encodeURIComponent(src)}`;
}

/**
 * 图片加载失败时切换到默认占位图
 */
export function handleImageError(e: Event) {
  const img = e.target as HTMLImageElement;
  img.src = fallbackImage;
}

export { fallbackImage };
