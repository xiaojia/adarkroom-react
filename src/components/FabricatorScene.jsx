/**
 * FabricatorScene — 造物台（工坊）场景背景（dark0/light0 两张图常驻 DOM + 无缝切换）
 * --------------------------------------------------------------
 * 与漫漫尘途 PathScene 同一机制：只有两张图，熄灯/夜 → dark0；开灯/昼 → light0。
 * 背景图为透明镂空 PNG，左侧敞开的门可透到下方常驻的静谧森林远景层（OutsideScene）。
 * 参照 RoomScene 的 prev/top 交叉淡出模型：当前显示图永远为 .top（不降级），
 * prev 仅在切换瞬间临时垫底、动画结束后清除，显示中的图片没有 class 切换隐患。
 *
 * 注意：与 path 不同，造物台图片不做水平镜像（门洞在左，按作者原图呈现）。
 */
import { useEffect, useRef, useState } from 'react';
import { useEngine } from '../engine/Engine';

// 资源部署基准路径（vite base: './' 时为 './'，与 public/ 下资源相对位置一致）
const BASE = import.meta.env.BASE_URL;
// 常驻 DOM 的 2 张图：[dark0, light0]
const IMAGES = [`${BASE}bg/fabricator/dark0.png`, `${BASE}bg/fabricator/light0.png`];
// 熄灯(夜)→dark0(下标0)；开灯(昼)→light0(下标1)
const IMG_IDX = (mode) => (mode === 'dark' ? 0 : 1);

const FADE_MS = 1500; // 新图渐显时长，与 CSS animation 时长一致

export default function FabricatorScene() {
  const lightsOff = useEngine((s) => s.options.lightsOff);

  const mode = lightsOff ? 'dark' : 'light';
  const targetIdx = IMG_IDX(mode);

  /* —— 2 张常驻图：当前显示图永远为 .top（不降级）——
     top ：当前的图，始终保持 .top（z-index 最高，animation 已停在最后一帧）。
     prev：切换瞬间的临时垫底（上一步的 top），动画结束后清除，避免切换露底。 */
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

  return (
    <div className="fabricator-scene">
      {IMAGES.map((src, i) => {
        let cls = 'fabricator-img';
        if (i === prev) cls += ' prev';
        if (i === top) cls += ' top';
        return <img key={src} className={cls} src={src} alt="" draggable="false" />;
      })}
    </div>
  );
}
