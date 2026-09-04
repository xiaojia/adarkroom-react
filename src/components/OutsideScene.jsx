/**
 * OutsideScene — 静谧森林（森林全景）背景
 * --------------------------------------------------------------
 * 与生火间 RoomScene 同样的「8 张图常驻 DOM + 无缝切换」做法：
 *   熄灯/夜 → dark0-3；开灯/昼 → light0-3；只通过 opacity + z-index 切换。
 *   图片下标由木屋数量决定（共 20 间）：
 *   0 房→0；1~9 房→1；10~19 房→2；20 房→3。
 *
 * 切换模型：当前显示图永远为 .top（不降级）；prev 只在切换瞬间临时垫底、
 *   动画结束后清除。移除的是 prev、保留 top，显示中的图片没有 class 切换隐患。
 *
 * 层级：本组件渲染在 #scene-backdrop 最底层、生火间（room）之下——
 *   静谧森林是窗外远景，生火间窗户透明，可直接透过窗户看到它。
 * 渲染时机：初章期间就已渲染（完成预加载），静谧森林 tab 由 room.openForest
 *   在初章结束时才解锁展示。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEngine } from '../engine/Engine';
import { $SM, useTick } from '../store/stateManager';

// 木屋数量 -> 森林图下标 0-3（共 20 间）
function levelForHuts(huts) {
  if (huts >= 20) return 3;
  if (huts >= 10) return 2;
  if (huts >= 1) return 1;
  return 0;
}

// 资源部署基准路径（vite base: './' 时为 './'，与 public/ 下资源相对位置一致）
const BASE = import.meta.env.BASE_URL;
// 常驻 DOM 的 8 张图：[dark0..dark3, light0..light3]
const IMAGES = ['dark', 'light'].flatMap((m) => [0, 1, 2, 3].map((i) => `${BASE}bg/outside/${m}${i}.jpeg`));
// 熄灯(夜)→dark0-3；开灯(昼)→light0-3（下标偏移 4）
const IMG_IDX = (mode, level) => (mode === 'dark' ? level : 4 + level);

const ZOOM = 1.01; // 背景放大 101%，留出极小平移余量
const MAX_OFF = (ZOOM - 1) / 2; // 每边可平移 0.5% 视口，正好对应鼠标到边缘时的极限
const FADE_MS = 1500; // 新图渐显时长，与 CSS animation 时长一致

// 淅淅小雨：生成一批随机雨滴（细长、稀疏、淡、轻微倾斜），负延迟让雨开场就铺满全屏。
const RAIN_COUNT = 70;
function buildRain() {
  return new Array(RAIN_COUNT).fill(0).map(() => {
    const dur = 1.4 + Math.random() * 1.6; // 1.4~3.0s 落一次
    return {
      left: Math.random() * 100, // 横向位置 %
      len: 8 + Math.random() * 10, // 雨丝长度 8~18px
      dur,
      delay: -Math.random() * dur, // 负延迟：开场即随机分布在屏幕各处
      op: 0.22 + Math.random() * 0.3, // 淡（淅淅小雨）
      tilt: (Math.random() * 2 - 1) * 7, // 轻微斜 -7~7deg
    };
  });
}

// 萤火虫：夜里远景右侧的一群光点，缓慢漂浮 + 规律明灭。位置按图片内相对比例换算成屏幕坐标
// （复刻生火间 RoomScene 的 cover 裁剪定位法），后续只需改 FLY_X / FLY_Y 调整整体发光区域。
const FIREFLY_COUNT = 12;
const FLY_X = 0.72; // 右侧远处（图片内相对宽 0~1，后续可调）
const FLY_Y = 0.5; // 纵向（0~1，自顶向下）
function buildFireflies() {
  return new Array(FIREFLY_COUNT).fill(0).map(() => ({
    fx: (Math.random() * 2 - 1) * 0.15, // 相对图片宽度的横向散布（±5%）
    fy: (Math.random() * 2 - 1) * 0.09, // 纵向散布（±9%）
    size: 2 + Math.random() * 2, // 2~4px（远景，小）
    dur: 1.6 + Math.random() * 3.4, // 明灭周期 1.6~3.4s
    bdelay: Math.random() * 4, // 明灭相位（错开）
    dx: (Math.random() * 2 - 1) * 10, // 漂移位移
    dy: (Math.random() * 2 - 1) * 12,
    ddur: 3 + Math.random() * 3, // 漂移周期 3~6s
    ddelay: Math.random() * 3,
    op: 0.6 + Math.random() * 0.35, // 亮度
  }));
}

export default function OutsideScene() {
  useTick();
  const lightsOff = useEngine((s) => s.options.lightsOff);
  const activeModule = useEngine((s) => s.activeModule);

  const huts = Number($SM.get('game.buildings["hut"]', true)) || 0;

  /** 稳定的雨滴池 / 萤火虫池，只在挂载时生成一次 */
  const rain = useMemo(buildRain, []);
  const fireflies = useMemo(buildFireflies, []);

  /* —— 萤火虫渐显逻辑：入夜时先隐藏，5s 后再缓缓亮起；切白天时直接跟着场景渐隐 —— */
  const [firefliesOn, setFirefliesOn] = useState(false);
  useEffect(() => {
    let t;
    if (lightsOff) {
      setFirefliesOn(false); // 刚入夜：先不显示
      t = setTimeout(() => setFirefliesOn(true), 5000); // 5s 后渐渐亮起
    } else {
      setFirefliesOn(false); // 切白天：立即渐隐
    }
    return () => clearTimeout(t);
  }, [lightsOff]);

  /* —— 测量：森林图是 object-fit: cover，会按屏幕尺寸裁剪。用一张图探测原始尺寸 +
     ResizeObserver 量场景尺寸，按 cover 公式算出图片实际显示区域，把萤火虫锚在
     图片内“右侧远处”的相对位置（跨屏一致）。 —— */
  const sceneRef = useRef(null);
  const [imgGeo, setImgGeo] = useState(null); // {iw,ih}
  const [vpSize, setVpSize] = useState(null); // {w,h}
  useEffect(() => {
    let alive = true;
    const probe = new Image();
    probe.onload = () => { if (alive) setImgGeo({ iw: probe.naturalWidth, ih: probe.naturalHeight }); };
    probe.src = IMAGES[0]; // 取任一张代表整组
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

  const imgScale = imgGeo && vpSize ? Math.max(vpSize.w / imgGeo.iw, vpSize.h / imgGeo.ih) : 1;
  const dispW = imgGeo ? imgGeo.iw * imgScale : 0;
  const dispH = imgGeo ? imgGeo.ih * imgScale : 0;
  const offX = imgGeo && vpSize ? (vpSize.w - dispW) / 2 : 0;
  const offY = imgGeo && vpSize ? (vpSize.h - dispH) / 2 : 0;

  const level = levelForHuts(huts);
  const mode = lightsOff ? 'dark' : 'light';
  const targetIdx = IMG_IDX(mode, level);

  /* —— 8 张常驻图：当前显示图永远为 .top（不降级）——
     top ：当前显示的图，始终保持 .top（z-index 最高，animation 已停在最后一帧）。
     prev：切换瞬间的临时垫底（上一步的 top），动画结束后清除，避免切换露底。
           移除的是 prev，保留 top —— 显示中的图片永远没有 class 切换隐患。 —— */
  const [top, setTop] = useState(targetIdx);
  const [prev, setPrev] = useState(null);
  const lastTarget = useRef(targetIdx);
  const fadeTimer = useRef(null);

  useEffect(() => {
    if (targetIdx === lastTarget.current) return;
    lastTarget.current = targetIdx;
    clearTimeout(fadeTimer.current);
    setPrev(top); // 上一个显示图临时垫底（保持 opaque）
    setTop(targetIdx); // 新图成为 .top，渐显压住 prev
    fadeTimer.current = setTimeout(() => {
      setPrev(null); // 动画完成 → 移除 prev，只保留 top
    }, FADE_MS);
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [targetIdx, top]);

  /* —— 鼠标视差：背景跟随鼠标移动，鼠标到边缘时背景也移到该方向的极限 —— */
  const [mouse, setMouse] = useState({ x: 0, y: 0 }); // 归一化 [-1, 1]，0=中心
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    let raf = 0;
    const pending = { x: 0, y: 0 };
    const onMove = (e) => {
      pending.x = (e.clientX / window.innerWidth) * 2 - 1;
      pending.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          setMouse({ x: pending.x, y: pending.y });
        });
      }
    };
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // 固定位移 / 缩放 / 模糊全部由 CSS 场景类名（scene-room / scene-path / scene-fabricator / scene-ship）控制，
  // JS 只负责：挂类名 + 注入动态鼠标视差变量 --px/--py。
  // 视差：生火间/造物台 跟随鼠标；漫漫尘途/飞船 固定不动。
  const scene =
    activeModule === 'room' ? 'scene-room'
    : activeModule === 'path' ? 'scene-path'
    : activeModule === 'fabricator' ? 'scene-fabricator'
    : activeModule === 'ship' ? 'scene-ship'
    : '';
  const parallax = activeModule !== 'path' && activeModule !== 'ship';
  const tx = parallax ? mouse.x * MAX_OFF * viewport.w : 0; // 视差：±5% 视口宽
  const ty = parallax ? mouse.y * MAX_OFF * viewport.h : 0;

  // 过完初章后才显示森林远景——不，改：初章期间森林背景照常渲染（完成预加载），
  // 只是静谧森林 tab 由 room.openForest 在初章结束时才解锁展示。
  // 初章期间窗外被生火间黑遮罩覆盖，森林不露画面，但常驻 DOM 不会闪白。
  return (
    <div ref={sceneRef} className={`outside-scene ${scene}`}>
      {IMAGES.map((src, i) => {
        let cls = 'outside-img';
        if (i === prev) cls += ' prev';
        if (i === top) cls += ' top';
        return (
          <img
            key={src}
            className={cls}
            src={src}
            alt=""
            draggable="false"
            style={{ '--px': `${tx}px`, '--py': `${ty}px` }}
          />
        );
      })}
      {(activeModule === 'room' || activeModule === 'fabricator' || activeModule === 'ship')
        ? <div className={`outside-veil${lightsOff ? ' night' : ''}`} />
        : null}
      {/* 淅淅小雨：落在森林背景上（窗外也能看到） */}
      <div className="outside-rain">
        {rain.map((r, i) => (
          <span
            key={i}
            className="rain-drop"
            style={{
              left: r.left + '%',
              height: r.len + 'px',
              '--dur': r.dur + 's',
              '--delay': r.delay + 's',
              '--op': r.op,
              '--tilt': r.tilt + 'deg',
            }}
          />
        ))}
      </div>
      {/* 萤火虫：夜里远景右侧，缓慢漂浮 + 明灭；位置按图片 cover 裁剪换算（复刻 room 定位法）。
          容器施加与森林图相同 transform（--px/--py 视差 + --shift/--shift-y 位移 + --zoom 缩放），
          因此各场景单独调整 outside 背景位置时，萤火虫会跟着相对移动。
          渐显：入夜等 5s 再缓缓亮起（--fade 2.5s）；切白天直接渐隐（--fade 1.5s）。 */}
      {imgGeo && vpSize && (
        <div
          className={`fireflies${firefliesOn ? ' show' : ''}`}
          style={{ '--px': `${tx}px`, '--py': `${ty}px`, '--fade': firefliesOn ? '2.5s' : '1.5s' }}
        >
          {fireflies.map((f, i) => (
            <span
              key={i}
              className="firefly"
              style={{
                left: offX + FLY_X * dispW + f.fx * dispW + 'px',
                top: offY + FLY_Y * dispH + f.fy * dispH + 'px',
                '--sz': f.size + 'px',
                '--dur': f.dur + 's',
                '--bdelay': f.bdelay + 's',
                '--dx': f.dx + 'px',
                '--dy': f.dy + 'px',
                '--ddur': f.ddur + 's',
                '--ddelay': f.ddelay + 's',
                '--op': f.op,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
