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

/** 成本是否可负担（cost 可能是对象，也可能是返回对象的函数） */
function isCostAffordable(cost) {
  if (!cost) return true;
  const c = typeof cost === 'function' ? cost() : cost;
  for (const k in c) {
    if (($SM.get('stores["' + k + '"]', true) || 0) < c[k]) return false;
  }
  return true;
}

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
    // 成本不足（如木头不够点火/添柴）时：不进入冷却（loading），但仍调用处理函数提示「木头不足」。
    // 成本足够时：点击即生效冷却，无论处理是否成功（如火已到最高级）都按本次点击计冷却，避免无限点击。
    const affordable = isCostAffordable(cost);
    if (cooldown > 0 && id && affordable) {
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
