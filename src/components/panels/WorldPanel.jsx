/**
 * WorldPanel — 世界探索面板（展示层）
 * ------------------------------------
 * 纯展示：从 World 逻辑层查询函数派生 UI。
 * 地图以 flex 行+列渲染（px-tile），四周提供方向按钮。
 */
import { useEffect, useRef, useState } from 'react';
import { _ } from '../../i18n';
import { useTick } from '../../store/stateManager';
import { World } from '../../modules/world';
import { Path } from '../../modules/path';
import { Pixel } from '../../modules/pixel';
import PixelIcon from '../shared/PixelIcon';

function MapTile({ t }) {
  let cls = 'px-tile';
  let inner = '';
  if (t.isPlayer) {
    cls += ' px-player';
    inner = Pixel.svg('player', { pixel: 1 });
  } else if (t.visible) {
    if (t.landmark) {
      cls += ' px-landmark' + (t.visited ? ' px-visited' : '');
      inner = Pixel.svg(t.landmark, { pixel: 1 });
    } else if (t.base) {
      const tileCls = Pixel.tileClass(t.base) || 'px-unknown';
      cls += ' ' + tileCls;
    } else {
      cls += ' px-unknown';
    }
  } else {
    cls += ' px-unknown';
  }
  if (t.landmark) {
    inner += '<div class="tooltip bottom right">' + (t.label || '') + '</div>';
  }
  return <span className={cls} dangerouslySetInnerHTML={{ __html: inner }} />;
}

export default function WorldPanel() {
  useTick();
  const st = World.getWorldState();
  const mapRef = useRef(null);

  const rows = st.map.length;
  const cols = st.map[0] ? st.map[0].length : rows;

  // 根据视口尺寸动态计算瓦片大小，让整张地图在视口内完整显示：
  // 避免页面滚动条（键盘方向键移动角色 + 页面滚动双触发）。
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  let tile = 11.4;
  if (rows > 0 && cols > 0) {
    const availH = vp.h - 200; // 顶部面板/标题/菜单/边距预留
    const availW = vp.w - 26;
    tile = Math.max(4, Math.min(12, Math.floor(availW / cols), Math.floor(availH / rows)));
  }

  const handleMapClick = (e) => {
    const map = mapRef.current;
    if (!map || st.map.length === 0) return;
    const rect = map.getBoundingClientRect();
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
        <div id="bagspace-world" data-title={st.bag.title}>
          <div id="supplies">
            {st.bag.items.map((it) => (
              <div className="supplyItem" key={it.key}>
                <PixelIcon name={Pixel.resourceSprite(it.key)} pixel={2} />
                {_('{0}: {1}', it.name, it.num)}
              </div>
            ))}
          </div>
        </div>
        <div id="shortRow">
          <div className="row_val" id="healthCounter">
            {_('hp: {0}/{1}', st.health, st.maxHealth)}
          </div>
          <div className="row_val" id="backpackSpace">
            {_('free {0}/{1}', Math.floor(Path.getFreeSpace()), Path.getCapacity())}
          </div>
        </div>
      </div>

      <div id="mapRow">
        <div id="map" ref={mapRef} onClick={handleMapClick} style={{ '--tile': `${tile}px` }}>
          {st.map.map((row, j) => (
            <div className="px-row" key={j}>
              {row.map((t, i) => (
                <MapTile key={i} t={t} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
