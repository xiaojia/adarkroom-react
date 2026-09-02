/**
 * PathPanel — 出装面板（展示层）
 * -----------------------------
 * 纯展示：从 Path 逻辑层查询函数派生 UI。
 * 出装行（携带数量 +/-）、装备切换、embark 按钮。
 */
import { _ } from '../../i18n';
import { $SM, useTick } from '../../store/stateManager';
import { Path } from '../../modules/path';
import { Pixel } from '../../modules/pixel';
import GameButton from '../shared/GameButton';
import PixelIcon from '../shared/PixelIcon';

function OutfitRow({ r }) {
  return (
    <div className="outfitRow">
      <div className="row_key">
        <PixelIcon name={Pixel.resourceSprite(r.key)} pixel={2} />
        {r.name}
      </div>
      <div className="row_val">
        <span>{r.num}</span>
        <span className={'dnManyBtn' + (r.canDnMany ? '' : ' disabled')} onClick={() => r.canDnMany && Path.decreaseSupply(r.key, 10)}>--</span>
        <span className={'dnBtn' + (r.canDn ? '' : ' disabled')} onClick={() => r.canDn && Path.decreaseSupply(r.key, 1)}>-</span>
        <span className={'upBtn' + (r.canUp ? '' : ' disabled')} onClick={() => r.canUp && Path.increaseSupply(r.key, 1)}>+</span>
        <span className={'upManyBtn' + (r.canUpMany ? '' : ' disabled')} onClick={() => r.canUpMany && Path.increaseSupply(r.key, 10)}>++</span>
      </div>
      <div className="tooltip bottom right">
        <div className="storeRow">
          <div className="row_key">{_('weight')}</div>
          <div className="row_val">{r.weight}</div>
        </div>
        <div className="storeRow">
          <div className="row_key">{_('available')}</div>
          <div className="row_val">{r.numAvailable - r.num}</div>
        </div>
      </div>
    </div>
  );
}

export default function PathPanel() {
  useTick();
  const st = Path.getOutfitState();

  return (
    <div id="pathPanel" className="location">
      <div id="outfitting">
        <div className="outfitRow">
          <div className="row_key">{_('armour')}</div>
          <div className="row_val">{st.armour}</div>
        </div>
        <div className="outfitRow">
          <div className="row_key">{_('water')}</div>
          <div className="row_val">{st.maxWater}</div>
        </div>
        {st.rows.map((r) => (
          <OutfitRow key={r.key} r={r} />
        ))}
      </div>
      <div id="bagspace">{_('free {0}/{1}', st.free, st.capacity)}</div>

      {st.equipRows.length > 0 && (
        <div id="equipList" data-title={_('equipment')}>
          {st.equipRows.map((r) => (
            <div className="outfitRow equipRow" key={r.key}>
              <div className="row_key">
                <PixelIcon name={Pixel.buildingSprite(r.key) || Pixel.resourceSprite(r.key)} pixel={2} />
                {r.name}
              </div>
              <div className="row_val">
                <span className="equipStatus" title={r.equipped ? _('equipped') : _('unequipped')}>
                  <PixelIcon name={r.equipped ? 'icon_check' : 'icon_cross'} pixel={2} />
                </span>
                <div className="equipBtn" onClick={() => Path.toggleEquip(r.key)}>
                  {r.equipped ? _('unequip') : _('equip')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <GameButton
        id="embarkButton"
        text={_('embark')}
        width="80px"
        disabled={!st.canEmbark}
        onClick={() => Path.embark()}
      />
    </div>
  );
}
