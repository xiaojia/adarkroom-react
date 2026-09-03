/**
 * SceneBackdrop — 按当前 tab（模块）切换的抽象模糊背景层
 * -------------------------------------------------------
 * 固定铺满视口，位于所有内容之下。每个场景是一个 .scene 子层，
 * 通过 opacity 过渡实现渐隐渐出的背景切换。
 * 背景全部为抽象、模糊的氛围色场（不作具体内容），由 wasteland.css
 * 中的 --scene-* SVG 数据 URI 控制。
 */
import { useEngine } from '../engine/Engine';

const SCENES = ['room', 'village', 'equip', 'desert', 'fabricator', 'ship', 'space'];

/** 把模块 id 映射到背景场景 id */
function sceneFor(moduleId) {
  switch (moduleId) {
    case 'outside':
      return 'village'; // 喧嚣小镇
    case 'path':
      return 'equip'; // 漫漫尘途 = 装备室
    case 'world':
      return 'desert'; // 出发后 = 沙漠
    case 'fabricator':
      return 'fabricator';
    case 'ship':
      return 'ship';
    case 'space':
      return 'space';
    case 'room':
    default:
      return 'room'; // 生火间 = 火炉间
  }
}

export default function SceneBackdrop() {
  const activeModule = useEngine((s) => s.activeModule);
  const current = sceneFor(activeModule);

  return (
    <div id="scene-backdrop" aria-hidden="true">
      {SCENES.map((s) => (
        <div key={s} className={`scene${s === current ? ' active' : ''}`} data-scene={s} />
      ))}
    </div>
  );
}
