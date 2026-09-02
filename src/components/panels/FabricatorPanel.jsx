/**
 * FabricatorPanel — 造物台面板（展示层）
 * --------------------------------------
 * 纯展示：从状态 + Fabricator 逻辑层查询函数派生 UI。
 * 库存列表通过插槽机制挂载（<Slot name="stores" />）。
 */
import { _ } from '../../i18n';
import { useTick } from '../../store/stateManager';
import { Fabricator } from '../../modules/fabricator';
import { Slot } from '../../engine/uiRegistry';
import { Pixel } from '../../modules/pixel';
import GameButton from '../shared/GameButton';

function FabricatorButton({ item }) {
  const { key, def, maxed, cost } = item;
  const name = def.name + (def.quantity && def.quantity > 1 ? ' (x' + def.quantity + ')' : '');
  return (
    <GameButton
      id={'fabricate_' + key}
      text={name}
      cost={cost}
      disabled={maxed}
      width="150px"
      icon={Pixel.buildingSprite(key) || Pixel.resourceSprite(key)}
      onClick={() => Fabricator.fabricate(key)}
    />
  );
}

export default function FabricatorPanel() {
  useTick();

  const fabricateBtns = Fabricator.getFabricateButtons();
  const blueprints = Fabricator.getBlueprints();

  return (
    <div id="fabricatorPanel" className="location">
      <div id="fabricatorBody">
        {fabricateBtns.length > 0 && (
          <div id="fabricateButtons" data-legend={_('fabricate:')}>
            {fabricateBtns.map((it) => (
              <FabricatorButton key={it.key} item={it} />
            ))}
          </div>
        )}
        {blueprints.length > 0 && (
          <div id="blueprints" data-legend={_('blueprints')}>
            {blueprints.map((k) => (
              <div id={'blueprint_' + k.replace(/ /g, '-')} className="blueprintRow" key={k}>
                <div className="row_key">
                  <span className="px-icon">
                    <span dangerouslySetInnerHTML={{ __html: Pixel.svg(Pixel.buildingSprite(k) || Pixel.resourceSprite(k), { pixel: 2 }) }} />
                  </span>
                  {_(k)}
                </div>
              </div>
            ))}
          </div>
        )}
        <Slot name="stores" />
      </div>
    </div>
  );
}
