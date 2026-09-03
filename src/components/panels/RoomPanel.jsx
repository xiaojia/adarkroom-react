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
      text={def.name || _(key)}
      cost={cost}
      disabled={maxed}
      icon={Pixel.buildingSprite(key) || Pixel.resourceSprite(key)}
      onClick={() => onClick(key)}
    />
  );
}

export default function RoomPanel() {
  useTick();

  const fireValue = $SM.get('game.fire.value', true);
  const trialActive = !!$SM.get('game.trialActive'); // 试火期间只能看、不能添
  const chapterAnim = !!$SM.get('game.chapterAnim'); // 初章结尾动画期间锁定
  const deathMask = !!$SM.get('game.deathMask'); // 死亡结局黑屏期间锁定

  const fireDead = fireValue <= Room.FireEnum.Dead.value;
  // 点火按钮永不禁用（wood 不足时点击提示木头不足）；添柴在没柴/试火/章节动画时禁用。
  // 火到最高级（熊熊）不禁用：点了会提示「火已是最高」，但冷却仍生效，避免无限点击。
  const stokeDisabled = $SM.get('stores.wood', true) <= 0 || trialActive || chapterAnim || deathMask;

  const buildBtns = Room.getBuildButtons();
  const craftBtns = Room.getCraftButtons();
  const buyBtns = Room.getBuyButtons();

  return (
    <div id="roomPanel" className="location">
      <div id="roomBody">
        <div id="roomMain">
          <div id="roomActions">
            {fireDead ? (
              <GameButton
                id="lightButton"
                text={_('light fire')}
                icon="fx_fire"
                cost={{ wood: 5 }}
                cooldown={Room._STOKE_COOLDOWN}
                disabled={chapterAnim || deathMask}
                onClick={() => Room.lightFire()}
              />
            ) : (
              <GameButton
                id="stokeButton"
                text={_('stoke fire')}
                icon="fx_fire"
                cost={{ wood: 1 }}
                cooldown={Room._STOKE_COOLDOWN}
                disabled={stokeDisabled}
                onClick={() => Room.stokeFire()}
              />
            )}
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
        <Slot name="stores" />
      </div>
    </div>
  );
}
