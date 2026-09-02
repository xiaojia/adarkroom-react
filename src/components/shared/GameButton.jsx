/**
 * GameButton — 通用游戏按钮
 * ------------------------
 * 对应旧版 Button.js 的功能：
 *  - cooldown 冷却（存 $SM['cooldown.<id>']，由 CooldownTicker 每秒递减）
 *  - cost 成本提示（hover 显示 tooltip）
 *  - disabled 禁用态
 *  - 像素图标
 */
import { $SM, useTick, commit } from '../../store/stateManager';
import { _ } from '../../i18n';
import PixelIcon from './PixelIcon';
import { Pixel } from '../../modules/pixel';

export function GameButton({
  id,
  text,
  cost,
  cooldown,
  onClick,
  disabled,
  width,
  icon,
  ttPos = 'bottom right',
  children,
}) {
  useTick();
  const remaining = id ? $SM.get('cooldown.' + id, true) : 0;
  const onCd = cooldown > 0 && remaining > 0;
  const isDisabled = disabled || onCd;

  const pct = onCd ? Math.max(0, Math.min(1, remaining / cooldown)) : 0;

  const handleClick = () => {
    if (isDisabled) return;
    let started = false;
    if (cooldown > 0 && id) {
      $SM.set('cooldown.' + id, cooldown, true);
      commit();
      started = true;
    }
    // 若处理器返回 false（如资源不足），取消本次冷却（对应旧版 Button.clearCooldown）
    const res = onClick ? onClick() : undefined;
    if (started && res === false && id) {
      $SM.remove('cooldown.' + id, true);
      commit();
    }
  };

  return (
    <div
      id={id}
      className={'button' + (isDisabled ? ' disabled' : '')}
      style={width ? { width } : undefined}
      onClick={handleClick}
    >
      {onCd && <div className="cooldown" style={{ width: pct * 100 + '%' }} />}
      {icon && <PixelIcon name={icon} pixel={2} />}
      <span>{text || children}</span>
      {cost && !isDisabled && (
        <div className={'tooltip ' + ttPos}>
          {Object.keys(cost).map((k) => (
            <div className="storeRow" key={k}>
              <div className="row_key">
                <PixelIcon name={Pixel.resourceSprite(k)} pixel={2} />
                {_(k)}
              </div>
              <div className="row_val">{cost[k]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GameButton;
