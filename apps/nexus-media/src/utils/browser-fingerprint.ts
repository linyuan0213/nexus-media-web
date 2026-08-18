/**
 * 浏览器指纹采集 — 读取用户真实浏览器环境，注入 nexus-chrome 指纹画像。
 * 字段对齐 nexus-chrome FingerprintFields（渲染类 canvas/audio 无法注入）。
 */
export interface BrowserFingerprint {
  ua?: string;
  ua_full_version?: string;
  ua_brand_version?: string;
  languages?: string[];
  platform?: string;
  cores?: number;
  memory?: number;
  webgl_vendor?: string;
  webgl_renderer?: string;
  screen_width?: number;
  screen_height?: number;
  screen_color_depth?: number;
  uad_platform?: string;
  uad_platform_version?: string;
  uad_arch?: string;
  uad_model?: string;
  touch_points?: number;
}

/**
 * 自动化/无头浏览器检测。
 * 此类浏览器采集的指纹不应写入站点画像（会污染用户真实浏览器指纹），直接跳过提交。
 */
export function isAutomatedBrowser(): boolean {
  try {
    if (navigator.webdriver) return true;
  } catch {
    // 忽略检测异常
  }
  const ua = navigator.userAgent || '';
  return /HeadlessChrome|PhantomJS|Selenium|Puppeteer|Playwright/i.test(ua);
}

interface UadBrand {
  brand: string;
  version: string;
}

async function collectUserAgentData(): Promise<Partial<BrowserFingerprint>> {
  const out: Partial<BrowserFingerprint> = {};
  const uad = (navigator as Navigator & { userAgentData?: unknown })
    .userAgentData as
    | undefined
    | {
        brands?: UadBrand[];
        getHighEntropyValues?: (
          keys: string[],
        ) => Promise<Record<string, unknown>>;
        platform?: string;
      };

  // 从 UA 解析 Chrome 版本号作为品牌版本回退（brands 不可用时）
  const uaChromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? '';

  if (uad) {
    out.uad_platform = uad.platform ?? '';
    const chromeBrand = uad.brands?.find((b) => b.brand === 'Google Chrome');
    if (chromeBrand) {
      out.ua_brand_version = chromeBrand.version;
    }
    if (uad.getHighEntropyValues) {
      try {
        const high = await uad.getHighEntropyValues([
          'fullVersionList',
          'platformVersion',
          'architecture',
          'model',
        ]);
        const fullList = (high.fullVersionList as UadBrand[] | undefined) ?? [];
        const chromeFull = fullList.find((b) => b.brand === 'Google Chrome');
        out.ua_full_version = chromeFull?.version;
        out.uad_platform_version = String(high.platformVersion ?? '');
        out.uad_arch = String(high.architecture ?? '');
        out.uad_model = String(high.model ?? '');
      } catch {
        // 高熵值获取失败时忽略，仍提交已采集的字段
      }
    }
  }

  // 回退：userAgentData 不可用时从 navigator 推导关键字段
  if (!out.ua_brand_version && uaChromeVersion) {
    out.ua_brand_version = uaChromeVersion;
  }
  if (!out.ua_full_version && uaChromeVersion) {
    out.ua_full_version = `${uaChromeVersion}.0.0.0`;
  }
  if (!out.uad_platform) {
    // MacIntel/Win32/Linux x86_64 → macOS/Windows/Linux
    const p = navigator.platform || '';
    if (/Mac/i.test(p)) out.uad_platform = 'macOS';
    else if (/Win/i.test(p)) out.uad_platform = 'Windows';
    else if (/Linux/i.test(p)) out.uad_platform = 'Linux';
    else out.uad_platform = '';
  }
  if (!out.uad_arch) {
    // x86 架构回退（Apple Silicon 的 userAgentData 会返回 arm，此处仅兜底）
    out.uad_arch = 'x86';
  }
  return out;
}

function collectWebGL(): Pick<
  BrowserFingerprint,
  'webgl_renderer' | 'webgl_vendor'
> {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) return {};
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return {};
    return {
      webgl_vendor: String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) ?? ''),
      webgl_renderer: String(
        gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '',
      ),
    };
  } catch {
    return {};
  }
}

export async function collectBrowserFingerprint(): Promise<BrowserFingerprint> {
  const [uad, webgl] = await Promise.all([
    collectUserAgentData(),
    Promise.resolve(collectWebGL()),
  ]);
  // deviceMemory 不可用时按内核数推断（2/4/8/16 档）
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  const inferredMemory =
    deviceMemory ??
    (navigator.hardwareConcurrency >= 8
      ? 16
      : navigator.hardwareConcurrency >= 4
        ? 8
        : 4);
  return {
    ua: navigator.userAgent,
    ...uad,
    languages: [...navigator.languages],
    platform: navigator.platform,
    cores: navigator.hardwareConcurrency,
    memory: inferredMemory,
    ...webgl,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    screen_color_depth: window.screen.colorDepth,
    touch_points: navigator.maxTouchPoints,
  };
}
