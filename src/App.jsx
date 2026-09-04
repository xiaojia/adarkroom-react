/**
 * App — 根组件（布局层）
 * -----------------------
 * 纯布局：通知栏（左） + 主区域（右，头部+内容）。
 * 内容面板根据当前激活模块渲染（ModuleRegistry）。
 * 事件弹窗、保存提示、冷却计时器挂载在根层。
 */
import { useEffect, useState } from 'react';
import { _ } from './i18n';
import { useEngine, ModuleRegistry, Engine, useSaveNotify } from './engine/Engine';
import { $SM } from './store/stateManager';
import HeaderBar from './components/HeaderBar';
import NotificationBar from './components/NotificationBar';
import EventModal from './components/EventModal';
import SceneBackdrop from './components/SceneBackdrop';

/** 冷却计时器：按真实流逝时间递减 $SM 中所有 cooldown.<id>
 *  基于 Date.now() 时间差计算递减量，而非固定步长，
 *  这样浏览器切到后台导致 setInterval 被节流时，恢复后仍能按真实时长补齐，
 *  冷却进度与后台机制数据保持一致（remaining 单位为秒）。 */
function CooldownTicker() {
  useEffect(() => {
    let last = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000; // 自上次 tick 的真实秒数
      last = now;
      const cd = $SM.get('cooldown');
      if (!cd) return;
      let changed = false;
      for (const k in cd) {
        cd[k] = (cd[k] || 0) - dt;
        if (cd[k] <= 0) delete cd[k];
        changed = true;
      }
      if (changed) $SM.fireUpdate('cooldown', true);
    }, 500);
    return () => clearInterval(iv);
  }, []);
  return null;
}

function SaveNotify() {
  const last = useSaveNotify((s) => s.last);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!last) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(t);
  }, [last]);
  return <div id="saveNotify" style={{ opacity: visible ? 1 : 0 }}>{_('saved.')}</div>;
}

function App() {
  const activeModule = useEngine((s) => s.activeModule);
  const lightsOff = useEngine((s) => s.options.lightsOff);
  const menuCollapsed = useEngine((s) => s.menuCollapsed);

  // 关灯模式：body.noMask 切换主题
  useEffect(() => {
    document.body.classList.toggle('noMask', !!lightsOff);
  }, [lightsOff]);

  // 收起菜单：body.menu-collapsed 让背景由模糊变清晰
  useEffect(() => {
    document.body.classList.toggle('menu-collapsed', !!menuCollapsed);
  }, [menuCollapsed]);

  // 浏览器标签标题跟随模块（翻译文案）
  useEffect(() => {
    const titles = {
      room: _('A Dark Room'),
      outside: _('A Silent Forest'),
      path: _('A Dusty Path'),
      world: _('A Barren World'),
      ship: _('An Old Starship'),
      space: _('Deep Space'),
      fabricator: _('A Whirring Fabricator'),
    };
    document.title = titles[activeModule] || _('A Dark Room');
  }, [activeModule]);

  // 键盘导航
  useEffect(() => {
    const kd = (e) => Engine.keyDown(e);
    const ku = (e) => Engine.keyUp(e);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);

  const mod = activeModule ? ModuleRegistry.get(activeModule) : null;
  const Panel = mod && mod.Component ? mod.Component : null;

  return (
    <div id="game">
      <SceneBackdrop />
      <div id="layout">
        <NotificationBar />
        <div id="main">
          <HeaderBar />
          <div id="content" className={menuCollapsed ? 'collapsed' : ''}>
            {Panel && <Panel />}
          </div>
        </div>
      </div>
      <CooldownTicker />
      <EventModal />
      <SaveNotify />
    </div>
  );
}

export default App;
