/**
 * RoomPanel — 房间面板（展示层）
 * ------------------------------
 * 纯展示：从状态 + Room 逻辑层查询函数派生 UI。
 * 库存列表通过插槽机制挂载（<Slot name="stores" />）。
 */
import { _ } from '../../i18n';
import { $SM, useTick } from '../../store/stateManager';
import { Room } from '../../modules/room';
import { Slot } from '../../engine/uiRegistry';
import { Pixel } from '../../modules/pixel';
import GameButton from '../shared/GameButton';
import PixelIcon from '../shared/PixelIcon';

function CraftButton({ item, onClick }) {
  const { key, def, maxed, cost } = item;
  return (
    <GameButton
      id={'build_' + key}
      text={def.name}
      cost={cost}
      disabled={maxed}
      width="80px"
      icon={Pixel.buildingSprite(key) || Pixel.resourceSprite(key)}
      onClick={() => onClick(key)}
    />
  );
}

export default function RoomPanel() {
  useTick();

  const fireValue = $SM.get('game.fire.value', true);

  const fireDead = fireValue <= Room.FireEnum.Dead.value;
  // 与原版一致：点火按钮永不禁用（wood 为 undefined 时免费点火；wood < 5 时点击提示木头不足）
  const stokeDisabled = $SM.get('stores.wood', true) <= 0;

  const buildBtns = Room.getBuildButtons();
  const craftBtns = Room.getCraftButtons();
  const buyBtns = Room.getBuyButtons();

  return (
    <div id="roomPanel" className="location">
      <div id="roomTop">
        <div id="roomActions">
          {fireDead ? (
            <GameButton
              id="lightButton"
              text={_('light fire')}
              icon="fx_fire"
              width="80px"
              cost={{ wood: 5 }}
              cooldown={Room._STOKE_COOLDOWN}
              onClick={() => Room.lightFire()}
            />
          ) : (
            <GameButton
              id="stokeButton"
              text={_('stoke fire')}
              icon="fx_fire"
              width="80px"
              cost={{ wood: 1 }}
              cooldown={Room._STOKE_COOLDOWN}
              disabled={stokeDisabled}
              onClick={() => Room.stokeFire()}
            />
          )}
        </div>
        <Slot name="stores" />
      </div>

      <div id="roomBtnColumns">
        {buildBtns.length > 0 && (
          <div className="btnColumn" data-title={_('build:')}>
            {buildBtns.map((it) => (
              <CraftButton key={it.key} item={it} onClick={Room.build} />
            ))}
          </div>
        )}
        {craftBtns.length > 0 && (
          <div className="btnColumn" data-title={_('craft:')}>
            {craftBtns.map((it) => (
              <CraftButton key={it.key} item={it} onClick={Room.build} />
            ))}
          </div>
        )}
        {buyBtns.length > 0 && (
          <div className="btnColumn" data-title={_('buy:')}>
            {buyBtns.map((it) => (
              <CraftButton key={it.key} item={it} onClick={Room.buy} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
