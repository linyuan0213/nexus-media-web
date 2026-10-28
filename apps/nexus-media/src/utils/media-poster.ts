/**
 * 媒体图片统一解析：展示变换（内容画像）→ 图片代理。
 *
 * 仅用于媒体卡片/海报展示。消息通知模糊在后端 message transformer 完成，
 * 不要在这里复用 message 变换，避免两个开关互相影响。
 */
import {
  getContentProfileImageUrl,
  getContentProfilePosterPosition,
} from '#/plugin-framework/loader';

import { getImgUrl } from './image';

export function resolveMediaPoster(
  src?: null | string,
  contentProfile?: null | string,
): string {
  return getImgUrl(getContentProfileImageUrl(contentProfile, src));
}

export function resolveMediaPosterPosition(
  contentProfile?: null | string,
  fallback = '50% 50%',
): string {
  return getContentProfilePosterPosition(contentProfile) || fallback;
}
