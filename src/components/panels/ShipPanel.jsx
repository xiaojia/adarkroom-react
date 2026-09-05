/**
 * ShipPanel — 星舰面板（展示层）
 * ------------------------------
 * 纯展示：从状态 + Ship 逻辑层查询函数派生 UI。
 * 外壳/引擎以「图纸」同款木纹面板展示（带标签、图标行）。
 */
import { _ } from '../../i18n';
import { useTick } from '../../store/stateManager';
import { Ship } from '../../modules/ship';
import { Pixel } from '../../modules/pixel';
import GameButton from '../shared/GameButton';
import Panel from '../shared/Panel';

const SHIP_STAT_ICON = {
  hull: 'res_hull',
  engine: 'res_engine',
};

export default function ShipPanel() {
  useTick();
  const st = Ship.getShipState();

  return (
    <div id="shipPanel" className="location">
      <Panel id="shipStats" title={_('Ship')}>
        <div className="blueprintRow">
          <div className="row_key">
            <span className="px-icon">
              <span dangerouslySetInnerHTML={{ __html: Pixel.svg(SHIP_STAT_ICON.hull, { pixel: 2 }) }} />
            </span>
            {_('hull:')}
          </div>
          <div className="row_val">{st.hull}</div>
        </div>
        <div className="blueprintRow">
          <div className="row_key">
            <span className="px-icon">
              <span dangerouslySetInnerHTML={{ __html: Pixel.svg(SHIP_STAT_ICON.engine, { pixel: 2 }) }} />
            </span>
            {_('engine:')}
          </div>
          <div className="row_val">{st.thrusters}</div>
        </div>
      </Panel>
      <GameButton
        id="reinforceButton"
        text={_('reinforce hull')}
        width="100px"
        cost={{ 'alien alloy': Ship.ALLOY_PER_HULL }}
        onClick={() => Ship.reinforceHull()}
      />
      <GameButton
        id="engineButton"
        text={_('upgrade engine')}
        width="100px"
        cost={{ 'alien alloy': Ship.ALLOY_PER_THRUSTER }}
        onClick={() => Ship.upgradeEngine()}
      />
      <GameButton
        id="liftoffButton"
        text={_('lift off')}
        width="100px"
        cooldown={Ship.LIFTOFF_COOLDOWN}
        disabled={!st.canLiftoff}
        onClick={() => Ship.checkLiftOff()}
      />
    </div>
  );
}
