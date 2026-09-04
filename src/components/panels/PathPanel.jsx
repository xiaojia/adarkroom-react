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
import { Slot } from '../../engine/uiRegistry';
import GameButton from '../shared/GameButton';
import PixelIcon from '../shared/PixelIcon';

/** 能力描述（key 即会被翻译的名称，desc 为 tooltip 说明） */
const PERKS = {
  'boxer': _('punches do more damage'),
  'martial artist': _('punches do even more damage.'),
  'unarmed master': _('punch twice as fast, and with even more force'),
  'barbarian': _('melee weapons deal more damage'),
  'slow metabolism': _('go twice as far without eating'),
  'desert rat': _('go twice as far without drinking'),
  'evasive': _('dodge attacks more effectively'),
  'precise': _('land blows more often'),
  'scout': _('see farther'),
  'stealthy': _('better avoid conflict in the wild'),
  'gastronome': _('restore more health when eating'),
};

function PerksPanel() {
  const perks = $SM.get('character.perks');
  if (!perks) return null;
  const keys = Object.keys(perks).filter((k) => perks[k]);
  if (keys.length === 0) return null;
  return (
    <div id="perks" data-title={_('perks')}>
      {keys.map((k) => (
        <div id={'perk_' + k.replace(/ /g, '-')} className="perkRow" key={k}>
          <div className="row_key">{_(k)}</div>
          <div className="tooltip bottom right">{PERKS[k] || _(k)}</div>
        </div>
      ))}
    </div>
  );
}

function OutfitRow({ r }) {
  return (
    <div className="outfitRow">
      <div className="row_key">
        <PixelIcon name={Pixel.resourceSprite(r.key)} pixel={2} />
        {r.name}
      </div>
      <div className="row_val">
        <span>{r.num}</span>
        <span className={'workerStepper'}>
          <span className={'workerBtn icon' + (r.canUp ? '' : ' disabled')} title="+1" onClick={() => r.canUp && Path.increaseSupply(r.key, 1)}>
            <PixelIcon name="arrow" pixel={2} />
          </span>
          <span className={'workerBtn icon down' + (r.canDn ? '' : ' disabled')} title="-1" onClick={() => r.canDn && Path.decreaseSupply(r.key, 1)}>
            <PixelIcon name="arrow" pixel={2} />
          </span>
        </span>
        <span className={'workerStepper'}>
          <span className={'workerBtn icon' + (r.canUpMany ? '' : ' disabled')} title="+10" onClick={() => r.canUpMany && Path.increaseSupply(r.key, 10)}>
            <PixelIcon name="arrow" pixel={2} />
          </span>
          <span className={'workerBtn icon down' + (r.canDnMany ? '' : ' disabled')} title="-10" onClick={() => r.canDnMany && Path.decreaseSupply(r.key, 10)}>
            <PixelIcon name="arrow" pixel={2} />
          </span>
        </span>
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
      <div id="pathBody">
        <div id="pathMain">
          <GameButton
            id="embarkButton"
            text={_('embark')}
            disabled={!st.canEmbark}
            onClick={() => Path.embark()}
          />
          <div id="outfitting">
            <div id="outfittingHeader">
              <span id="outfittingTitle">{_('supplies')}</span>
              <span id="bagspace">{_('free {0}/{1}', st.free, st.capacity)}</span>
            </div>
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
        </div>

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

        <div id="pathSidebar">
          <PerksPanel />
          <Slot name="stores" />
        </div>
      </div>
    </div>
  );
}
