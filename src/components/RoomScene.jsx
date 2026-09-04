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

// 火堆（壁炉火焰）在图片内部的相对位置（0~1，按像素比例）：
// 由 drak/light 房间图实测 —— 火焰中心约在 76% 宽度、顶部约 55% 高度处。
// 位置以图片为基准，再换算成屏幕坐标，保证不同屏幕尺寸下都钉在火苗上。
const FIRE_X = 0.76;
const FIRE_Y = 0.80;

const SPARK_MS = 6000; // 首次点火开场动画（spark class）保留时长
const INTRO_MS = 5200; // 开场期间强制展示 dark1 的时长（结束后按实际火势图过渡）
const FADE_MS = 1500; // 新图渐显时长，与 CSS animation 时长一致

// 火势 0-4 → 火星数量（0 无火，4 熊熊最多）
const SPARK_COUNT = [0, 0, 1, 3, 5];

// 每次起飞都重新掷一套随机轨迹，保证同一个火星的每次运动路径都不一样，避免齐步走
let sparkSeq = 0;
function makeSpark() {
  return {
    id: ++sparkSeq,
    ox: (Math.random() * 2 - 1) * 30, // 喷口横向散布更大（±30px），避免集中一起往上喷
    drift: (Math.random() * 2 - 1) * 55, // 升空过程水平飘移更大（±55px），更像被气流裹挟的火星
    dur: 1.0 + Math.random() * 0.8, // 一次升空 1~1.8s（更快，火星“蹦”出来）
    op: 0.5 + Math.random() * 0.4, // 亮度
    scale: 1 + Math.random() * 1, // 火星大小倍率（1~2 随机）
    sway: (Math.random() * 2 - 1) * 2.4, // 左右摇摆幅度更大（负左正右）
    riseFactor: 0.7 + Math.random() * 1.5, // 升空高度倍率（0.7~1.5），火星会“突然蹿高”
  };
}

/** 单个火星：每次动画结束便随机“熄火”一阵，再换一条全新的随机轨迹重新起飞。
 *  用 key=t.id 强制重挂载 → 动画以新轨迹重放，因此即便只有 1 个火星，每次路径也不同。 */
function FireSpark({ imgScale, riseBase, dispH }) {
  const [t, setT] = useState(makeSpark);
  const [wait, setWait] = useState(() => 0.15 + Math.random() * 1.8); // 初始错峰延迟
  const next = () => {
    setWait(0.9 + Math.random() * 3.5); // 随机歇一小段，再喷下一颗
    setT(makeSpark()); // 换随机轨迹 → key 变 → 重新起飞
  };
  return (
    <span
      key={t.id}
      className="fire-spark"
      onAnimationEnd={next}
      style={{
        left: t.ox * imgScale + 'px',
        '--dx': t.drift * imgScale + 'px',
        '--rise': riseBase * t.riseFactor * (dispH / 100) + 'px',
        '--dur': t.dur + 's',
        '--delay': wait + 's',
        '--op': t.op,
        '--s': t.scale,
        '--sway': t.sway,
      }}
    />
  );
}

export default function RoomScene() {
  useTick();
  const lightsOff = useEngine((s) => s.options.lightsOff);

  const fireValue = Number($SM.get('game.fire.value', true)) || 0;
  // 已点过火：fireLit 为真，或（兼容旧存档）火已在燃烧 fire.value>0
  const firstLit = !!$SM.get('game.fireLit') || fireValue > 0;
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

  /* —— 火堆上方动态小火星：按火势等级增减，越旺越多、飞得越高 —— */
  const fireIdx = Math.max(0, Math.min(4, Number(fireValue) || 0));
  const sparksCount = SPARK_COUNT[fireIdx];
  const riseBase = 5 + level * 1.5; // 升空基准占图片显示高度的百分比（level 0-3 → 5/6.5/8/9.5）
  // 火光明暗随火势缩放：最大火(4) = 满值，小火按比例缩小（1→0.25，2→0.5，3→0.75）
  const fireLight = fireIdx / 4;

  /* —— 火花“爆燃”节拍：平时零星小火、慢而小，隔 5~20s 突然持续 ~2s 的大火花（火势窜一下）——
     通过共享的 --pace（变速）与 --size（放大缩小）驱动所有火星一起变化。 —— */
  const [pulse, setPulse] = useState({ pace: 0.8, size: 0.7, amp: 0.4 });
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    let burstTimeout;
    let calmTimeout;
    const flare = () => {
      setBurst(true);
      // 突然的大火花：变大、变快、火光更亮
      setPulse({ pace: 1.4 + Math.random() * 0.4, size: 1.6 + Math.random() * 0.4, amp: 0.85 + Math.random() * 0.15 });
      burstTimeout = setTimeout(calm, 5600 + Math.random() * 900); // 持续约 1.6~2.5s
    };
    const calm = () => {
      setBurst(false);
      // 平静：火星小、慢、零星，火光也暗一些
      setPulse({ pace: 0.75 + Math.random() * 0.2, size: 0.65 + Math.random() * 0.2, amp: 0.35 + Math.random() * 0.15 });
      calmTimeout = setTimeout(flare, 10000 + Math.random() * 15000); // 等 5~20s 再来一次
    };
    calm();
    return () => {
      clearTimeout(burstTimeout);
      clearTimeout(calmTimeout);
    };
  }, []);

  /* —— 测量：图片是 object-fit: cover，会按屏幕尺寸裁剪，直接用百分比会飘移。
     用一张房间图探测原始像素尺寸 + ResizeObserver 量场景尺寸，算出 cover 后图片的
     显示区域，把火堆锚点钉在图片内的火苗上（跨屏保持一致）。 —— */
  const sceneRef = useRef(null);
  const [imgGeo, setImgGeo] = useState(null); // {iw,ih} 图片原始尺寸
  const [vpSize, setVpSize] = useState(null); // {w,h} 房间场景容器尺寸
  useEffect(() => {
    let alive = true;
    const probe = new Image();
    probe.onload = () => { if (alive) setImgGeo({ iw: probe.naturalWidth, ih: probe.naturalHeight }); };
    probe.src = IMAGES[4]; // drak/light 同尺寸，任一张代表整组
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setVpSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // cover 剪裁后图片的显示区域（居中）
  const imgScale = imgGeo && vpSize ? Math.max(vpSize.w / imgGeo.iw, vpSize.h / imgGeo.ih) : 1;
  const dispW = imgGeo ? imgGeo.iw * imgScale : 0;
  const dispH = imgGeo ? imgGeo.ih * imgScale : 0;
  const offX = imgGeo && vpSize ? (vpSize.w - dispW) / 2 : 0;
  const offY = imgGeo && vpSize ? (vpSize.h - dispH) / 2 : 0;
  // 火堆在屏幕上的像素坐标（由图片内相对比例换算而来，随裁剪正确钉在火苗上）
  const firePX = offX + FIRE_X * dispW;
  const firePY = offY + FIRE_Y * dispH;

  // 平时按火势数量；突然爆燃时额外增加火星数量，形成“大火花”
  const showCount = Math.round(sparksCount * (burst ? 2.2 : 1));

  // 火光罩（忽明忽暗用）：以火堆为中心的一片暖光，尺寸与图片显示区域等比
  const glowW = dispW * 0.42;
  const glowH = dispH * 0.52;

  return (
    <div ref={sceneRef} className={`room-scene${revealed ? ' revealed' : ''}${spark ? ' spark' : ''}`} style={{ '--amp': pulse.amp * fireLight }}>
      {IMAGES.map((src, i) => {
        let cls = 'room-img';
        if (i === prev) cls += ' prev';
        if (i === top) cls += ' top';
        return <img key={src} className={cls} src={src} alt="" draggable="false" />;
      })}
      {revealed && fireValue > 0 && lightsOff && imgGeo && vpSize && (
        <>
          {/* 火光罩：忽明忽暗，让火堆看起来在闪；强度由 --amp 控制（平静暗、爆燃亮）。
              只在熄灯（夜）、且火还燃着时才展示火光与火星；火灭或开灯（昼）时不显示。 */}
          <div
            className="fire-flicker"
            style={{ left: firePX + 'px', top: firePY + 'px', width: glowW + 'px', height: glowH + 'px' }}
          />
          {showCount > 0 && (
            <div className="fire-sparks" style={{ left: firePX + 'px', top: firePY + 'px', '--pace': pulse.pace, '--size': pulse.size }}>
              {Array.from({ length: showCount }).map((_, i) => (
                <FireSpark key={'sp' + i} imgScale={imgScale} riseBase={riseBase} dispH={dispH} />
              ))}
            </div>
          )}
        </>
      )}
      <div className="room-mask" />
    </div>
  );
}
