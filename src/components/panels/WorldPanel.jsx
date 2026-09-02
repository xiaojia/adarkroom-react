/**
 * WorldPanel — 世界探索面板（展示层）
 * ------------------------------------
 * 纯展示：从 World 逻辑层查询函数派生 UI。
 * 地图以 flex 行+列渲染（px-tile），四周提供方向按钮。
 */
import { useRef } from 'react';
import { _ } from '../../i18n';
import { useTick } from '../../store/stateManager';
import { World } from '../../modules/world';
import { Path } from '../../modules/path';
import { Pixel } from '../../modules/pixel';
import GameButton from '../shared/GameButton';

function MapTile({ t }) {
  let cls = 'px-tile';
  let inner = '';
  if (t.isPlayer) {
    cls += ' px-player';
    inner = '<div class="px-tile-player"></div>';
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
              <span className="supplyItem" key={it.key}>{_('{0}:{1}', it.name, it.num)}</span>
            ))}
          </div>
        </div>
        <div id="shortRow">
          <div className="row_val" id="backpackSpace">
            {_('free {0}/{1}', Math.floor(Path.getFreeSpace()), Path.getCapacity())}
          </div>
          <div className="row_val" id="healthCounter">
            {_('hp: {0}/{1}', st.health, st.maxHealth)}
          </div>
        </div>
      </div>

      <div id="mapControls">
        <GameButton id="mapNorth" text={_('north')} width="60px" onClick={() => World.moveNorth()} />
      </div>

      <div id="mapRow">
        <GameButton id="mapWest" text={_('west')} width="60px" onClick={() => World.moveWest()} />
        <div id="map" ref={mapRef} onClick={handleMapClick}>
          {st.map.map((row, j) => (
            <div className="px-row" key={j}>
              {row.map((t, i) => (
                <MapTile key={i} t={t} />
              ))}
            </div>
          ))}
        </div>
        <GameButton id="mapEast" text={_('east')} width="60px" onClick={() => World.moveEast()} />
      </div>

      <div id="mapControls">
        <GameButton id="mapSouth" text={_('south')} width="60px" onClick={() => World.moveSouth()} />
      </div>
    </div>
  );
}
