/**
 * WorldPanel — 世界探索面板（展示层）
 * ------------------------------------
 * 纯展示：从 World 逻辑层查询函数派生 UI。
 * 地图以 flex 行+列渲染（px-tile），四周提供方向按钮。
 */
import { memo, useEffect, useRef, useState } from 'react';
import { _ } from '../../i18n';
import { useTick } from '../../store/stateManager';
import { World } from '../../modules/world';
import { Path } from '../../modules/path';
import { Pixel } from '../../modules/pixel';
import PixelIcon from '../shared/PixelIcon';
import Panel from '../shared/Panel';

const NOISE_PERIOD = 32; // 与 game.css 中 --terrain-noise 的 background-size 保持一致

// 记忆化：只有该格子数据真的变化（可见性/地标/玩家位置/纹理对齐）时才重渲染一次。
const MapTile = memo(function MapTile({ t, homeRot, tile, col, row }) {
  let cls = 'px-tile';
  let inner = '';
  // 让噪点纹理跨格子连续：按该格在世界坐标中的位置设置 background-position
  const T = typeof tile === 'number' && tile > 0 ? tile : 50;
  let spanStyle;
  if (t.isPlayer) {
    cls += ' px-player';
    inner = Pixel.svg('player', { pixel: 1 });
    // 指向村庄的方向箭头：从玩家中心沿朝向偏出到角色外围（不与角色重叠），并旋转指向村庄
    const rad = (homeRot || 0) * (Math.PI / 180);
    const ox = Math.sin(rad);
    const oy = -Math.cos(rad);
    const R = T * 0.46; // 外围半径：角色的外圈，避免重叠
    inner += '<span class="px-home" style="left:calc(50% + ' +
      (ox * R).toFixed(1) + 'px); top:calc(50% + ' + (oy * R).toFixed(1) +
      'px); transform:translate(-50%,-50%) rotate(' + (homeRot || 0).toFixed(1) + 'deg)"></span>';
  } else if (t.visible) {
    if (t.landmark) {
      cls += ' px-landmark' + (t.visited ? ' px-visited' : '');
      inner = Pixel.svg(t.landmark, { pixel: 1 });
      // 角标：被解放（绿旗）/ 已探访（黄点）
      if (t.liberated) inner += '<span class="tile-badge lib"></span>';
      else if (t.visited) inner += '<span class="tile-badge vis"></span>';
    } else if (t.base) {
      const tileCls = Pixel.tileClass(t.base) || 'px-unknown';
      cls += ' ' + tileCls;
      spanStyle = {
        backgroundPosition: (-((col * T) % NOISE_PERIOD)) + 'px ' + (-((row * T) % NOISE_PERIOD)) + 'px',
      };
    } else {
      cls += ' px-unknown';
    }
  } else {
    cls += ' px-unknown';
  }
  if (t.landmark) {
    inner += '<div class="tooltip bottom right">' + (t.label || '') + '</div>';
  }
  return <span className={cls} style={spanStyle} dangerouslySetInnerHTML={{ __html: inner }} />;
});

export default function WorldPanel() {
  useTick();
  const st = World.getWorldState();
  const mapRef = useRef(null);
  const mapRowRef = useRef(null);

  const rows = st.map.length;
  const cols = st.map[0] ? st.map[0].length : rows;

  // 地图「放大 + 以玩家为中心 + 卷轴」：
  // 以 #mapRow 为视口边界（overflow hidden），地图用更大瓦片渲染并整体位移，把玩家格对准视口中心。
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = mapRowRef.current;
    if (!el) return;
    const measure = () => setVp({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 放大后的瓦片边长（比默认铺满视口的 ~11px 更大，地图超出视口形成卷轴）
  const ZOOM_TILE = 40;
  const tile = rows > 0 && cols > 0 ? ZOOM_TILE : 11.4;

  // 玩家格在网格中的 [col, row]（即 st.pos = [curPos[0], curPos[1]]）
  const pcol = st.pos ? st.pos[0] : Math.floor(cols / 2);
  const prow = st.pos ? st.pos[1] : Math.floor(rows / 2);
  // 村庄位于地图中心 (RADIUS, RADIUS)；计算指向村庄的箭头旋转角（0°=朝上，顺时针）
  const dHomeX = World.RADIUS - pcol;
  const dHomeY = World.RADIUS - prow;
  const homeRot = Math.atan2(dHomeX, -dHomeY) * (180 / Math.PI);
  const pcx = pcol * tile + tile / 2; // 玩家格中心（相对地图左上角）
  const pcy = prow * tile + tile / 2;
  const mapW = cols * tile;
  const mapH = rows * tile;
  // 位移 + 边界 clamp：地图未到边界时玩家居中；到边界后地图停住，让玩家往边缘移动。
  let tx = 0;
  let ty = 0;
  if (vp.w > 0) {
    tx = mapW <= vp.w
      ? (vp.w - mapW) / 2
      : Math.max(vp.w - mapW, Math.min(0, vp.w / 2 - pcx));
  }
  if (vp.h > 0) {
    ty = mapH <= vp.h
      ? (vp.h - mapH) / 2
      : Math.max(vp.h - mapH, Math.min(0, vp.h / 2 - pcy));
  }

  const handleMapClick = (e) => {
    const row = mapRowRef.current;
    if (!row || st.map.length === 0) return;
    // 玩家固定在 #mapRow 中心，以视口中心为参照判断移动方向
    const rect = row.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clickX = e.clientX - cx;
    const clickY = e.clientY - cy;
    if (clickX > clickY && clickX < -clickY) World.moveNorth();
    if (clickX < clickY && clickX > -clickY) World.moveSouth();
    if (clickX < clickY && clickX < -clickY) World.moveWest();
    if (clickX > clickY && clickX > -clickY) World.moveEast();
  };

  return (
    <div id="worldPanel" className="location">
      <div id="worldOuter">
        <Panel id="bagspace-world" title={st.bag.title}>
          <div id="supplies">
            {st.bag.items.map((it) => (
              <div className="supplyItem" key={it.key}>
                <PixelIcon name={Pixel.resourceSprite(it.key)} pixel={2} />
                {_('{0}: {1}', it.name, it.num)}
              </div>
            ))}
          </div>
        </Panel>
        <div id="shortRow">
          <div className="row_val" id="healthCounter">
            {_('hp: {0}/{1}', st.health, st.maxHealth)}
          </div>
          <div className="row_val" id="backpackSpace">
            {_('free {0}/{1}', Math.floor(Path.getFreeSpace()), Path.getCapacity())}
          </div>
        </div>
      </div>

      <div id="mapRow" ref={mapRowRef}>
        <div id="map" ref={mapRef} onClick={handleMapClick} style={{ '--tile': `${tile}px`, transform: `translate(${tx}px, ${ty}px)` }}>
          {st.map.map((row, j) => (
            <div className="px-row" key={j}>
              {row.map((t, i) => (
                <MapTile key={i} t={t} homeRot={t.isPlayer ? homeRot : 0} tile={tile} col={i} row={j} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
