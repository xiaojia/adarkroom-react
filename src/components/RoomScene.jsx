/**
 * RoomScene — 生火间场景（8 张火势背景图常驻 DOM + 黑遮罩动画）
 * --------------------------------------------------------------
 * 为方便后续操作，8 张图（熄灯/夜 drak0-3、开灯/昼 light0-3）全部渲染在
 * DOM 里（同时天然完成预加载），只通过 opacity 控制当前展示哪一张：
 *   - 平时只有一张可见（.base，z-index:1）
 *   - 切换目标图时，给新图加 .top（z-index:2，opacity 0→1 渐显压住旧图），
 *     渐显完成后再把新图降为 .base、旧图淡出为 0 —— 新图压旧图、无缝衔接。
 * 图片下标：fire 0-4 → LEVEL 0-3（roaring(4) 与 burning(3) 共用最大图 3）。
 *
 * 黑遮罩（最上层，z-index:3）状态机（配合 game.fireLit / chapterMask / deathMask）：
 *   - 进场全黑：无 revealed，mask 全黑（8 张图已在 DOM 预加载）。
 *   - 首次点火（试火）：加 .spark —— 遮罩先瞬间闪开约 0.3s 再合拢，
 *     然后用 5 秒渐隐露出 dark1（由 CSS keyframes 一次性完成）。
 *   - 初章结尾：room.js 把 chapterMask 置 true → 去掉 revealed，
 *     遮罩 5 秒合拢黑屏；再置 false → 重新 revealed，5 秒打开露出白天场景。
 *   - 死亡结局：deathMask 置 true → 同样摘掉 revealed，5 秒黑屏后弹重启窗。
 */
import { useEffect, useRef, useState } from 'react';
import { useEngine } from '../engine/Engine';
import { $SM, useTick } from '../store/stateManager';

// fire 0-4 -> 图下标 0-3（roaring 与 burning 共用图 3）
const LEVEL = [0, 1, 2, 3, 3];
// 常驻 DOM 的 8 张图：[drak0..drak3, light0..light3]
const IMAGES = ['drak', 'light'].flatMap((m) => [0, 1, 2, 3].map((i) => `/bg/room/${m}${i}.png`));
// 熄灯(夜)→drak0-3；开灯(昼)→light0-3（下标偏移 4）
const IMG_IDX = (mode, level) => (mode === 'drak' ? level : 4 + level);

const SPARK_MS = 6000; // 首次点火开场动画（spark class）保留时长
const INTRO_MS = 5200; // 开场期间强制展示 dark1 的时长（结束后按实际火势图过渡）
const FADE_MS = 1500; // 目标图渐显时长

export default function RoomScene() {
  useTick();
  const lightsOff = useEngine((s) => s.options.lightsOff);

  const fireValue = $SM.get('game.fire.value', true);
  const firstLit = !!$SM.get('game.fireLit');
  const chapterMask = !!$SM.get('game.chapterMask');
  const deathMask = !!$SM.get('game.deathMask');

  const level = LEVEL[Math.max(0, Math.min(4, Number(fireValue) || 0))];
  const mode = lightsOff ? 'drak' : 'light';
  const targetIdx = IMG_IDX(mode, level);

  /* —— 8 张常驻图：新目标渐显压住旧图，完成后把新图转成底层 —— */
  const [top, setTop] = useState(null);
  const [base, setBase] = useState(targetIdx);
  const lastTarget = useRef(targetIdx);
  const fadeTimer = useRef(null);

  /* —— 首次点火开场：遮罩闪开 0.3s → 合拢 → 5s 渐隐露出 dark1 ——
     已点过火（含旧存档）直接跳过开场动画。 */
  const [introDone, setIntroDone] = useState(firstLit);
  const [spark, setSpark] = useState(false);
  const prevFirstLit = useRef(firstLit);
  useEffect(() => {
    const was = prevFirstLit.current;
    prevFirstLit.current = firstLit;
    if (!was && firstLit) {
      // 开场要露出的是 dark1；黑屏期间直接把底层切到 dark1（遮罩盖住，玩家无感）
      setIntroDone(false);
      setSpark(true);
      setTop(null);
      setBase(1);
      lastTarget.current = 1;
      const t1 = setTimeout(() => setSpark(false), SPARK_MS);
      const t2 = setTimeout(() => setIntroDone(true), INTRO_MS);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [firstLit]);

  // 开场期间强制 dark1，之后按实际火势
  const target = firstLit && !introDone ? 1 : targetIdx;

  useEffect(() => {
    if (target === lastTarget.current) return;
    lastTarget.current = target;
    clearTimeout(fadeTimer.current);
    setTop(target); // 新图在上面渐显
    fadeTimer.current = setTimeout(() => {
      setBase(target); // 渐显完成 → 成为新的底层
      setTop(null);
    }, FADE_MS);
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [target]);

  // revealed=true 时遮罩最终透明；初章黑屏(chapterMask)或死亡黑屏(deathMask)时摘掉
  const revealed = firstLit && !chapterMask && !deathMask;

  return (
    <div className={`room-scene${revealed ? ' revealed' : ''}${spark ? ' spark' : ''}`}>
      {IMAGES.map((src, i) => {
        let cls = 'room-img';
        if (i === base) cls += ' base';
        if (i === top) cls += ' top';
        return <img key={src} className={cls} src={src} alt="" draggable="false" />;
      })}
      <div className="room-mask" />
    </div>
  );
}
