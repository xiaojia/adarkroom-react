/**
 * Preloader — 启动加载屏
 * -----------------------
 * 游戏开始前挡住界面的全屏加载层，复用 index.html 里的 .boot-splash 类名与样式。
 *
 * 逻辑：
 *   - 挂载即预加载 assets（最重要的背景图），用真实进度更新进度条。
 *   - 与此同时，游戏模块懒加载/引擎初始化在 main 里异步并行进行（ready 承诺）。
 *   - 两者都完成后：先把游戏 App 挂到启动屏之下，再让启动屏淡出（CSS .done），
 *     淡出结束后移除启动屏，露出游戏 —— 全程无白屏、无闪烁。
 *
 * props：
 *   - assets:    需要预加载并驱动进度条的图片 url 列表
 *   - ready:     一个 Promise，游戏模块/引擎初始化完成后 resolve（与图片并行等待）
 *   - minMs:     最短展示时长（毫秒），避免加载太快时一闪而过（默认 500）
 *   - renderApp: () => ReactNode，就绪后要挂载的游戏根节点
 */
import { useEffect, useState } from 'react';
import { preloadAssets } from '../engine/preload';

export default function Preloader({ assets, ready, minMs = 500, renderApp }) {
  const [progress, setProgress] = useState(0);
  const [assetsDone, setAssetsDone] = useState(false);
  const [modulesDone, setModulesDone] = useState(!ready);
  const [minDone, setMinDone] = useState(false);
  const [gone, setGone] = useState(false); // 淡出完成后是否移除启动屏

  // 移除 index.html 的静态 HTML 启动屏，换成 React 渲染的、带真实进度的版本
  useEffect(() => {
    const splash = document.getElementById('boot-splash');
    if (splash) splash.remove();
  }, []);

  // 预加载关键背景图（带进度回调）
  useEffect(() => {
    let alive = true;
    preloadAssets(assets, (p) => {
      if (alive) setProgress(p);
    }).then(() => {
      if (alive) setAssetsDone(true);
    });
    return () => {
      alive = false;
    };
  }, [assets]);

  // 游戏模块就绪信号
  useEffect(() => {
    if (!ready) {
      setModulesDone(true);
      return;
    }
    let alive = true;
    ready.then(() => {
      if (alive) setModulesDone(true);
    });
    return () => {
      alive = false;
    };
  }, [ready]);

  // 最短展示时长（避免加载太快时一闪而过）
  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), minMs);
    return () => clearTimeout(t);
  }, [minMs]);

  const done = assetsDone && modulesDone && minDone;

  // 就绪后稍候片刻，等 CSS 淡出（.done opacity 0）完成再移除整个启动屏
  useEffect(() => {
    if (!done || gone) return;
    const t = setTimeout(() => setGone(true), 380);
    return () => clearTimeout(t);
  }, [done, gone]);

  const app = done ? renderApp() : null;
  const pct = Math.round(progress * 100);

  return (
    <>
      {app}
      {!gone && (
        <div className={`boot-splash${done ? ' done' : ''}`}>
          <div className="bs-inner">
            <div className="bs-title">A DARK ROOM</div>
            <div className="bs-sub">{done ? '欢迎回来' : '正在加载… ' + pct + '%'}</div>
            <div className="bs-bar">
              <div className="bs-fill" style={{ width: pct + '%' }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
