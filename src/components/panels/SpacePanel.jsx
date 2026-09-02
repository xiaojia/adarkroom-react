/**
 * SpacePanel — 太空飞船小游戏（展示层）
 * --------------------------------------
 * 纯展示：订阅 useSpace 高频状态（飞船坐标/小行星/hull）渲染每帧画面。
 * 键盘方向键移动由全局 keyDown/keyUp 路由到 Space（see Engine.keyDown）。
 */
import { useSpace, Space } from '../../modules/space';
import { _ } from '../../i18n';
import { Pixel } from '../../modules/pixel';

function ShipSprite() {
  return (
    <span
      className="space-ship-sprite"
      dangerouslySetInnerHTML={{ __html: Pixel.svg('space_ship', { pixel: 4 }) }}
    />
  );
}

export default function SpacePanel() {
  const { shipX, shipY, hull, maxHull, altitude, asteroids, done, crash } = useSpace();

  return (
    <div id="spacePanel" className="location">
      <div id="hullRemaining" className="storeRow">
        <div className="row_key">{_('hull: ')}</div>
        <div className="row_val">{hull}/{maxHull}</div>
      </div>
      <div id="altitudeDisplay">{_('altitude: {0}', Math.floor(altitude))}</div>

      <div id="spaceField">
        {/* 背景星空（纯 CSS 表现层） */}
        <div className="starfield" />
        {asteroids.map((a) => (
          <div
            key={a.id}
            className="asteroid"
            style={{ left: a.x + 'px', top: a.top + 'px' }}
          >
            <span dangerouslySetInnerHTML={{ __html: Pixel.svg(a.sprite, { pixel: 3 }) }} />
          </div>
        ))}
        <div id="ship" style={{ left: shipX + 'px', top: shipY + 'px' }}>
          <ShipSprite />
        </div>
      </div>

      {done && (
        <div id="spaceEnd" className="endGame">
          {crash
            ? _('the ship crashes, sparking its way through the atmosphere.')
            : _('you fly through the debris cloud and into the endless black.')}
          <div className="restart" onClick={() => Space.onArrival()}>{_('fly again.')}</div>
        </div>
      )}
    </div>
  );
}
