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
  // 旧版 nginx 会把 /img?url=... 301 到 127.0.0.1:8080，海报会空白。
  // 如果代理 URL 里是 TMDB 图片，直接改成最终 /img/tmdb/... 路由。
  if (src.startsWith('/img?url=')) {
    try {
      const inner = decodeURIComponent(src.slice('/img?url='.length));
      const proxiedTmdb = inner.match(
        /https?:\/\/image\.tmdb\.org\/t\/p\/(\w+)(\/.+)/,
      );
      if (proxiedTmdb) return `/img/tmdb/${proxiedTmdb[1]}${proxiedTmdb[2]}`;
    } catch {
      // 保留原 URL，交给代理处理
    }
  }
  if (src.startsWith('/img/') || src.startsWith('/img?')) return src;
  const tmdbMatch = src.match(/https?:\/\/image\.tmdb\.org\/t\/p\/(\w+)(\/.+)/);
  if (tmdbMatch) return `/img/tmdb/${tmdbMatch[1]}${tmdbMatch[2]}`;
  if (src.includes('doubanio.com') || src.includes('douban.com'))
    return `/img/douban/${encodeURIComponent(src)}`;
  if (src.includes('lain.bgm.tv')) return `/img/bgm/${encodeURIComponent(src)}`;
  return `/img/library/${encodeURIComponent(src)}`;
}

/**
 * 图片加载失败时切换到默认占位图
 */
export function handleImageError(e: Event) {
  const img = e.target as HTMLImageElement;
  img.src = fallbackImage;
}

export { fallbackImage };
