/**
 * ShipPanel — 星舰面板（展示层）
 * ------------------------------
 * 纯展示：从状态 + Ship 逻辑层查询函数派生 UI。
 */
import { _ } from '../../i18n';
import { useTick } from '../../store/stateManager';
import { Ship } from '../../modules/ship';
import GameButton from '../shared/GameButton';

export default function ShipPanel() {
  useTick();
  const st = Ship.getShipState();

  return (
    <div id="shipPanel" className="location">
      <div id="hullRow" className="storeRow">
        <div className="row_key">{_('hull:')}</div>
        <div className="row_val">{st.hull}</div>
      </div>
      <div id="engineRow" className="storeRow">
        <div className="row_key">{_('engine:')}</div>
        <div className="row_val">{st.thrusters}</div>
      </div>
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
