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
    // 点击即生效冷却：无论处理是否成功，都从本次点击开始冷却。
    // 这样火到最高级（添柴返回 false）时不会因「取消冷却」而被无限点击。
    // 冷却由 CooldownTicker 按真实秒数递减，按钮在冷却期间禁用。
    if (cooldown > 0 && id) {
      $SM.set('cooldown.' + id, cooldown, true);
      commit();
    }
    if (onClick) onClick();
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
