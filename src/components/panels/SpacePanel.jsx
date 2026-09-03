/**
 * SpacePanel — 太空飞船小游戏（展示层）
 * --------------------------------------
 * 纯展示：订阅 useSpace 高频状态（飞船坐标/小行星/hull）渲染每帧画面。
 * 键盘方向键移动由全局 keyDown/keyUp 路由到 Space（see Engine.keyDown）。
 *
 * 视觉（参考旧版 script/space.js）：
 *  - 面板尺寸随屏幕高度自适应（由 ResizeObserver 测量写回 Space.setPanelSize）
 *  - 背景默认透明；飞行中随 altitude 增大，整屏慢慢浮现黑色背景 + 星空点
 */
import { memo, useEffect, useMemo, useRef } from 'react';
import { useSpace, Space } from '../../modules/space';
import { _ } from '../../i18n';
import { Pixel } from '../../modules/pixel';

const NUM_STARS = 200;
const STAR_STRIP = 3000;

/** 生成一层的星空点坐标（两条相同条带用于无缝无限滚动） */
function makeStars() {
  const list = [];
  for (let i = 0; i < NUM_STARS; i++) {
    list.push({
      top: Math.floor(Math.random() * STAR_STRIP),
      left: Math.floor(Math.random() * STAR_STRIP),
    });
  }
  return list;
}

/** 一条 3000x3000 的星空点条带 */
function StarStrip({ stars }) {
  return (
    <div className="starStrip">
      {stars.map((s, i) => (
        <div className="star" key={i} style={{ top: s.top + 'px', left: s.left + 'px' }}>.</div>
      ))}
    </div>
  );
}

/** 星空层（前景/背景各两条条带，无缝向下滚动） */
const StarLayer = memo(function StarLayer({ speed, back }) {
  const stars = useMemo(makeStars, []);
  return (
    <div className={back ? 'starLayer back' : 'starLayer'} style={{ animationDuration: speed + 's' }}>
      <StarStrip stars={stars} />
      <StarStrip stars={stars} />
    </div>
  );
});

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
  const fieldRef = useRef(null);

  // 测量游戏场实际尺寸，写回逻辑层用于移动/生成自适应
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const measure = () => Space.setPanelSize(el.clientWidth, el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 黑色背景 + 星空随飞行距离慢慢淡入
  const fade = Math.min(altitude / 60, 1);
  // 深空背景足够暗时，把舱体/高度文字切为白色避免看不清
  const deepSpace = fade > 0.6;

  return (
    <div id="spacePanel" className={'location' + (deepSpace ? ' space-dark' : '')}>
      <div
        id="spaceBackdrop"
        style={{ opacity: fade }}
        aria-hidden="true"
      >
        <StarLayer speed={60} />
        <StarLayer speed={120} back />
      </div>

      <div id="hullRemaining" className="storeRow">
        <div className="row_key">{_('hull: ')}</div>
        <div className="row_val">{hull}/{maxHull}</div>
      </div>
      <div id="altitudeDisplay">{_('altitude: {0}', Math.floor(altitude))}</div>

      <div id="spaceField" ref={fieldRef}>
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
