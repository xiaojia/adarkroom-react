/**
 * RoomScene — 生火间场景（8 张火势背景图常驻 DOM + 黑遮罩动画）
 * --------------------------------------------------------------
 * 为方便后续操作，8 张图（熄灯/夜 drak0-3、开灯/昼 light0-3）全部渲染在
 * DOM 里（同时天然完成预加载），只通过 opacity + z-index 控制当前展示哪一张：
 *   - top：当前显示的图，始终保持 .top（z-index 最高，animation 已停在最后一帧）。
 *   - prev：切换瞬间的临时垫底（上一步的 top），动画结束后清除，避免切换露底。
 *     移除的是 prev、保留 top —— 显示中的图片永远没有 class 切换隐患。
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
const FADE_MS = 1500; // 新图渐显时长，与 CSS animation 时长一致

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

  /* —— 首次点火开场：遮罩闪开 0.3s → 合拢 → 5s 渐隐露出 dark1 ——
     已点过火（含旧存档）直接跳过开场动画。 */
  const [introDone, setIntroDone] = useState(firstLit);
  const [spark, setSpark] = useState(false);
  const prevFirstLit = useRef(firstLit);
  useEffect(() => {
    const was = prevFirstLit.current;
    prevFirstLit.current = firstLit;
    if (!was && firstLit) {
      // 开场要露出的是 dark1
      setIntroDone(false);
      setSpark(true);
      const t1 = setTimeout(() => setSpark(false), SPARK_MS);
      const t2 = setTimeout(() => setIntroDone(true), INTRO_MS);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [firstLit]);

  // 开场期间强制 dark1，之后按实际火势；这是「要显示的图」，据此做 prev/top 交叉淡出
  const target = firstLit && !introDone ? 1 : targetIdx;

  /* —— 8 张常驻图：当前显示图永远为 .top（不降级）——
     top ：当前显示的图，始终保持 .top（z-index 最高，animation 已停在最后一帧）。
     prev：切换瞬间的临时垫底（上一步的 top），动画结束后清除，避免切换露底。
           移除的是 prev，保留 top —— 显示中的图片永远没有 class 切换隐患。 —— */
  const [top, setTop] = useState(target);
  const [prev, setPrev] = useState(null);
  const lastTarget = useRef(target);
  const fadeTimer = useRef(null);

  useEffect(() => {
    if (target === lastTarget.current) return;
    lastTarget.current = target;
    clearTimeout(fadeTimer.current);
    setPrev(top); // 上一个显示图临时垫底（保持 opaque）
    setTop(target); // 新图成为 .top，渐显压住 prev
    fadeTimer.current = setTimeout(() => {
      setPrev(null); // 动画完成 → 移除 prev，只保留 top
    }, FADE_MS);
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [target, top]);

  // revealed=true 时遮罩最终透明；初章黑屏(chapterMask)或死亡黑屏(deathMask)时摘掉
  const revealed = firstLit && !chapterMask && !deathMask;

  return (
    <div className={`room-scene${revealed ? ' revealed' : ''}${spark ? ' spark' : ''}`}>
      {IMAGES.map((src, i) => {
        let cls = 'room-img';
        if (i === prev) cls += ' prev';
        if (i === top) cls += ' top';
        return <img key={src} className={cls} src={src} alt="" draggable="false" />;
      })}
      <div className="room-mask" />
    </div>
  );
}
