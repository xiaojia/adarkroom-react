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

// 常驻 DOM 的 8 张图：[dark0..dark3, light0..light3]
const IMAGES = ['dark', 'light'].flatMap((m) => [0, 1, 2, 3].map((i) => `/bg/outside/${m}${i}.jpeg`));
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

export default function OutsideScene() {
  useTick();
  const lightsOff = useEngine((s) => s.options.lightsOff);
  const activeModule = useEngine((s) => s.activeModule);

  const huts = Number($SM.get('game.buildings["hut"]', true)) || 0;

  /** 稳定的雨滴池，只在挂载时生成一次 */
  const rain = useMemo(buildRain, []);

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
    <div className={`outside-scene ${scene}`}>
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
    </div>
  );
}
