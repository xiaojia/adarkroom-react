/**
 * 应用启动入口
 * ------------
 * 顺序：
 * 1. 先初始化 i18n（语言包加载后再导入模块，确保顶层 _() 常量翻译正确）
 * 2. 动态导入游戏模块与面板组件
 * 3. 注入延迟模块引用（bindModule / bindLazyModules / bindNotifications / bindEvents）
 * 4. 注册 UI 插槽（库存列表等共享展示组件）
 * 5. 注册各模块到 ModuleRegistry
 * 6. 启动引擎 → 渲染 React 根组件
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/game.css';
import './styles/wasteland.css';

async function boot() {
  // --- 1. i18n ---
  const { initI18n, detectLang } = await import('./i18n/index');
  const { _ } = await import('./i18n');
  const lang = detectLang();
  await initI18n(lang);

  // --- 2. 游戏模块（延迟导入，避免顶层 _() 在翻译前求值） ---
  const { Engine, ModuleRegistry, bindLazyModules, bindNotifications, bindEvents } = await import('./engine/Engine');
  const { Notifications } = await import('./engine/notifications');
  const { registerSlot } = await import('./engine/uiRegistry');
  const { bindModule } = await import('./engine/moduleLoader');
  const { Room } = await import('./modules/room');
  const { Outside } = await import('./modules/outside');
  const { Path } = await import('./modules/path');
  const { World } = await import('./modules/world');
  const { Fabricator } = await import('./modules/fabricator');
  const { Ship } = await import('./modules/ship');
  const { Space } = await import('./modules/space');
  const { Events, useEvents } = await import('./modules/events');
  const { default: StoresPanel } = await import('./components/shared/StoresPanel');
  const { default: RoomPanel } = await import('./components/panels/RoomPanel');
  const { default: OutsidePanel } = await import('./components/panels/OutsidePanel');
  const { default: PathPanel } = await import('./components/panels/PathPanel');
  const { default: WorldPanel } = await import('./components/panels/WorldPanel');
  const { default: FabricatorPanel } = await import('./components/panels/FabricatorPanel');
  const { default: ShipPanel } = await import('./components/panels/ShipPanel');
  const { default: SpacePanel } = await import('./components/panels/SpacePanel');
  const { default: App } = await import('./App.jsx');

  // --- 3. 注入延迟模块（解决循环依赖） ---
  Room.id = 'room';
  Outside.id = 'outside';
  Path.id = 'path';
  World.id = 'world';
  Fabricator.id = 'fabricator';
  Ship.id = 'ship';
  Space.id = 'space';
  Events.id = 'events';
  bindModule('room', Room);
  bindModule('outside', Outside);
  bindModule('path', Path);
  bindModule('world', World);
  bindModule('fabricator', Fabricator);
  bindModule('ship', Ship);
  bindModule('space', Space);
  bindModule('events', Events);
  bindLazyModules({ World, Ship, Space });
  bindNotifications(Notifications);
  bindEvents({ Events, useEvents });

  // --- 4. 注册 UI 插槽：库存列表，任何面板用 <Slot name="stores"/> 即可复用 ---
  registerSlot('stores', 'stores', StoresPanel);

  // --- 5. 注册游戏模块 ---
  ModuleRegistry.register({
    id: 'room',
    name: _('A Dark Room'),
    Component: RoomPanel,
    init: Room.init,
    onArrival: Room.onArrival,
    isAvailable: () => true,
  });
  ModuleRegistry.register({
    id: 'outside',
    name: _('A Silent Forest'),
    Component: OutsidePanel,
    init: Outside.init,
    onArrival: Outside.onArrival,
    isAvailable: (st) => typeof st.stores?.wood !== 'undefined',
  });
  ModuleRegistry.register({
    id: 'path',
    name: _('A Dusty Path'),
    Component: PathPanel,
    init: Path.init,
    onArrival: Path.onArrival,
    isAvailable: (st) => (st.stores?.compass || 0) > 0,
  });
  ModuleRegistry.register({
    id: 'world',
    name: _('A Barren World'),
    Component: WorldPanel,
    init: World.init,
    onArrival: World.onArrival,
    keyDown: World.keyDown,
    // 荒芜世界不是头部 tab：仅通过 Path.embark（出装出发）进入，属独立全屏界面。
    // 世界地图在 Path.init() 里初始化（获得罗盘后），因此不在此自动 init。
    fullscreen: true,
    isAvailable: () => false,
  });
  ModuleRegistry.register({
    id: 'fabricator',
    name: _('A Whirring Fabricator'),
    before: 'ship',
    Component: FabricatorPanel,
    init: Fabricator.init,
    onArrival: Fabricator.onArrival,
    isAvailable: (st) => !!st.features?.location?.fabricator,
  });
  ModuleRegistry.register({
    id: 'ship',
    name: _('An Old Starship'),
    Component: ShipPanel,
    init: Ship.init,
    onArrival: Ship.onArrival,
    isAvailable: (st) => !!st.features?.location?.spaceShip,
  });
  ModuleRegistry.register({
    id: 'space',
    name: _('Deep Space'),
    Component: SpacePanel,
    init: Space.init,
    onArrival: Space.onArrival,
    keyDown: Space.keyDown,
    keyUp: Space.keyUp,
    // 仅通过 Ship.liftOff() 进入，全屏独立界面，不在头部显示
    fullscreen: true,
    isAvailable: () => false,
  });

  // 事件系统初始化（后续 todo 会挂载随机事件池）
  Events.init();

  // --- 6. 启动引擎（读档 / 模块初始化 / 进入房间） ---
  Engine.init();

  // 开发期调试钩子：在浏览器控制台驱动事件系统做端到端验证
  if (import.meta.env.DEV) {
    const sm = await import('./store/stateManager');
    window.__game = { Engine, Events, useEvents, World, Path, Notifications, $SM: sm.$SM };
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot();
