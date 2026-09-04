/**
 * 启动屏预加载：背景图资源清单 + 带进度的预加载器。
 * 地图瓦片是 DOM 像素画（不涉及图片请求），这里只预加载各场景的背景图。
 */

// 首屏最关键：房间（生火间）的火势背景图 —— 进度条以这批为准，加载完即可进入游戏
export const BG_CRITICAL = ['drak', 'light'].flatMap((m) => [0, 1, 2, 3].map((i) => `/bg/room/${m}${i}.png`));

// 其余场景背景图：进入游戏后在后台静默预加载，避免切换场景时再卡顿
export const BG_LAZY = [
  ...['dark', 'light'].flatMap((m) => [0, 1, 2, 3].map((i) => `/bg/outside/${m}${i}.jpeg`)),
  '/bg/path/dark0.png', '/bg/path/light0.png',
  '/bg/ship/dark0.png', '/bg/ship/light0.png',
  '/bg/fabricator/dark0.png', '/bg/fabricator/light0.png',
];

/**
 * 预加载一组图片，按加载进度回调 onProgress(0~1)，返回 Promise<{src, ok}[]>。
 * 每张图无论成功/失败都计入完成数，保证进度条不会因单个资源缺失而卡住。
 */
export function preloadAssets(urls, onProgress) {
  return new Promise((resolve) => {
    const total = urls.length;
    if (!total) {
      if (onProgress) onProgress(1);
      resolve([]);
      return;
    }
    const results = new Array(total).fill(null);
    let done = 0;
    const tick = () => {
      done += 1;
      if (onProgress) onProgress(done / total);
      if (done >= total) resolve(results);
    };
    urls.forEach((src, idx) => {
      const img = new Image();
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        results[idx] = { src, ok };
        tick();
      };
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.src = src;
      // 命中缓存时某些浏览器不会异步触发 onload，直接读 complete/naturalWidth
      if (img.complete) {
        if (img.naturalWidth > 0) finish(true);
        else finish(false);
      }
    });
  });
}
