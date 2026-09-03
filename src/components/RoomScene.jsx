/**
 * RoomScene — 生火间场景（8 张火势背景图 + 黑遮罩渐隐）
 * -------------------------------------------------------
 * 叠层（画布层，DOM 顺序即 z 序，后者盖住前者）：
 *   3. room-mask     首次点火前的全黑遮罩；点火时渐隐，透出底层画面
 *   2. room-img cur  当前/新背景图（新图压住旧图并渐显，实现 cross-fade）
 *   1. room-img prev 上一帧背景图（垫底，被新图覆盖）
 *
 * 背景图按 (熄灯/开灯) x 火势选择：
 *   - 熄灯（lightsOff，夜/暗）→ drak{0-3}
 *   - 开灯（lights on，昼/亮）→ light{0-3}
 *   火势 0-4（dead/smoldering/flickering/burning/roaring）
 *   → 图下标 min(fire,3)，即 roaring(4) 与 burning(3) 共用最大图 3。
 *
 * 首次点火：黑遮罩渐隐，铁定展示 dark1（入夜渐亮的电影感开场），
 * 停留 INTRO_MS 后再按 min(fire,3) 正常展示。
 */
import { useEffect, useRef, useState } from 'react';
import { useEngine } from '../engine/Engine';
import { $SM, useTick } from '../store/stateManager';

// fire 0-4 -> 图下标 0-3（roaring 与 burning 共用图 3）
const LEVEL = [0, 1, 2, 3, 3];
const IMG = (mode, i) => `/bg/room/${mode}${i}.png`;

// 全部 8 张背景图：配合黑遮罩预加载，避免首次点亮/切换时卡顿
const ALL_IMGS = ['drak', 'light'].flatMap((m) => [0, 1, 2, 3].map((i) => IMG(m, i)));

const INTRO_MS = 4200; // 首光 dark1 停留时长（遮罩渐隐后再多留一会儿再切到实际火势）

export default function RoomScene() {
  useTick();
  const lightsOff = useEngine((s) => s.options.lightsOff);

  const fireValue = $SM.get('game.fire.value', true);
  const firstLit = !!$SM.get('game.fireLit');

  const level = LEVEL[Math.max(0, Math.min(4, Number(fireValue) || 0))];
  const mode = lightsOff ? 'drak' : 'light';
  const targetSrc = IMG(mode, level);

  /* —— 预加载全部 8 张背景图 —— */
  useEffect(() => {
    ALL_IMGS.forEach((src) => {
      const im = new Image();
      im.src = src;
    });
  }, []);

  /* —— 首次点火 intro：遮罩渐隐的同时铁定展示 dark1 ——
     introDone 初始取 firstLit：已推进（已点亮）的存档直接跳过 intro，
     否则 new game 时其为 false，firstLit 一旦翻转便在当帧切到 dark1，
     从而不会闪现一帧当前火势图。 */
  const [introDone, setIntroDone] = useState(firstLit);
  const prevFirstLit = useRef(firstLit);
  useEffect(() => {
    const was = prevFirstLit.current;
    prevFirstLit.current = firstLit;
    if (!was && firstLit) {
      setIntroDone(false);
      const t = setTimeout(() => setIntroDone(true), INTRO_MS);
      return () => clearTimeout(t);
    }
  }, [firstLit]);

  const desiredSrc = firstLit && !introDone ? IMG('drak', 1) : targetSrc;

  /* —— 交叉渐显：新图（cur）压住旧图（prev）并渐显 —— */
  const [prevSrc, setPrevSrc] = useState(null);
  const [curSrc, setCurSrc] = useState(desiredSrc);
  const settledSrc = useRef(desiredSrc);
  useEffect(() => {
    if (desiredSrc === settledSrc.current) return;
    setPrevSrc(settledSrc.current);
    setCurSrc(desiredSrc);
    settledSrc.current = desiredSrc;
  }, [desiredSrc]);

  return (
    <div className={`room-scene${firstLit ? ' revealed' : ''}`}>
      {prevSrc && (
        <img className="room-img prev" src={prevSrc} alt="" draggable="false" />
      )}
      <img key={curSrc} className="room-img cur" src={curSrc} alt="" draggable="false" />
      <div className="room-mask" />
    </div>
  );
}
