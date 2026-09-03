/**
 * HeaderBar — 顶部模块导航 + 右下角菜单（展示层）
 * -----------------------------------------------
 * 模块按钮从 ModuleRegistry.available() 派生（带 isAvailable 过滤）。
 * 菜单功能直接调用 Engine 逻辑层方法。
 */
import { _ } from '../i18n';
import { SUPPORTED_LANGS } from '../i18n';
import { useEngine, ModuleRegistry, Engine } from '../engine/Engine';
import { useTick, $SM } from '../store/stateManager';
import { Room } from '../modules/room';
import { Outside } from '../modules/outside';
import { Path } from '../modules/path';
import { Ship } from '../modules/ship';
import { Fabricator } from '../modules/fabricator';

/** 各模块在头部显示的标题（与原版 Header.addLocation 文案一致） */
function moduleTitle(id) {
  switch (id) {
    case 'room':
      return Room.getTitle();
    case 'outside':
      return Outside.getTitle();
    case 'path':
      return Path.getTitle();
    case 'ship':
      return Ship.getTitle();
    case 'fabricator':
      return Fabricator.getTitle();
    default:
      return _('Module');
  }
}

export default function HeaderBar() {
  useTick();
  const activeId = useEngine((s) => s.activeModule);
  const view = useEngine((s) => s.view);
  const options = useEngine((s) => s.options);

  // 熄灯按钮：默认熄灯(夜)，但按钮仅在第一次火势到达最高(roaring)后解锁展示
  const lightsOffUnlocked = !!$SM.get('game.lightsOffUnlocked');

  const mods = ModuleRegistry.available();
  const curLang = String(location.search.match(/[?|&]lang=([^&;]+?)(&|#|;|$)/)?.[1] || localStorage.lang || 'en').toLowerCase();

  return (
    <>
      {view === 'locations' && (
        <div id="header">
          {mods.map((m) => (
            <div
              key={m.id}
              id={'location_' + m.id}
              className={'headerButton' + (activeId === m.id ? ' selected' : '')}
              onClick={() => mods.length > 1 && Engine.travelTo(m.id)}
            >
              {moduleTitle(m.id)}
            </div>
          ))}
        </div>
      )}

      <div className="menu">
        {lightsOffUnlocked && (
          <span
            className="lightsOff menuBtn"
            onClick={() => Engine.turnLightsOff()}
          >
            {options.lightsOff ? _('lights on.') : _('lights off.')}
          </span>
        )}
        <span className="menuBtn" onClick={() => Engine.toggleDoubleTime()}>
          {options.doubleTime ? _('classic.') : _('hyper.')}
        </span>
        <span className="menuBtn" onClick={() => Engine.confirmDelete()}>
          {_('restart.')}
        </span>
        <span className="menuBtn" onClick={() => Engine.share()}>
          {_('share.')}
        </span>
        <span className="menuBtn" onClick={() => Engine.exportImport()}>
          {_('save.')}
        </span>
        <span className="customSelect menuBtn">
          <span className="customSelectOptions">
            <ul>
              <li>{_('language.')}</li>
              {SUPPORTED_LANGS.map((l) => (
                <li
                  key={l.code}
                  data-language={l.code}
                  className={curLang === l.code ? 'selected' : ''}
                  onClick={() => Engine.switchLanguage(l.code)}
                >
                  {l.name}
                </li>
              ))}
            </ul>
          </span>
        </span>
      </div>
    </>
  );
}
