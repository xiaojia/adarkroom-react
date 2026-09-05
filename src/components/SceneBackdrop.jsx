/**
 * SceneBackdrop — 按当前 tab（模块）切换的抽象模糊背景层
 * -------------------------------------------------------
 * 铺满 #game 容器（随其横向滚动），位于所有内容之下。每个场景是一个 .scene 子层，
 * 通过 opacity 过渡实现渐隐渐出的背景切换。
 * 背景全部为抽象、模糊的氛围色场（不作具体内容），由 wasteland.css
 * 中的 --scene-* SVG 数据 URI 控制。
 *
 * 静谧森林（OutsideScene）作为常驻最底层渲染：它是窗外远景，
 * 生火间（room）的窗户透明可直接透过去看到它；静谧森林 tab
 * 直接展示该层（无上层覆盖）。
 */
import { useEngine } from '../engine/Engine';
import RoomScene from './RoomScene';
import OutsideScene from './OutsideScene';
import PathScene from './PathScene';
import FabricatorScene from './FabricatorScene';
import ShipScene from './ShipScene';

const SCENES = ['room', 'path', 'village', 'equip', 'desert', 'fabricator', 'ship', 'space'];

/** 把模块 id 映射到背景场景 id */
function sceneFor(moduleId) {
  switch (moduleId) {
    case 'outside':
      return 'outside'; // 静谧森林（由常驻底层呈现）
    case 'path':
      return 'path'; // 漫漫尘途 = 独立场景（dark0/light0），镂空透出森林
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
      {/* 常驻底层：静谧森林（窗外远景，过初章后一直显示） */}
      <OutsideScene />
      {SCENES.map((s) => (
        <div key={s} className={`scene${s === current ? ' active' : ''}`} data-scene={s}>
          {s === 'room' && <RoomScene />}
          {s === 'path' && <PathScene />}
          {s === 'fabricator' && <FabricatorScene />}
          {s === 'ship' && <ShipScene />}
        </div>
      ))}
    </div>
  );
}
