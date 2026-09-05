/**
 * 应用启动入口
 * ------------
 * 顺序：
 * 0. 立即渲染启动加载屏（复用 index.html 的 .boot-splash 样式），覆盖后续所有模块懒加载，避免白屏
 * 1. 模块懒加载与引擎初始化（异步），与“关键背景图预加载”并行
 * 2. i18n 初始化后最晚才导入 App（保证顶层 _() 翻译正确）
 * 3. 图片 + 模块全部就绪 → Preloader 挂载游戏并淡出
 * 4. 进入游戏后，在后台静默预加载其余场景背景图，避免切换场景再卡顿
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/game.css';
import './styles/wasteland.css';

async function boot() {
  const root = createRoot(document.getElementById('root'));

  // --- 0. 启动加载屏（轻量模块，立即展示） ---
  const { default: Preloader } = await import('./components/Preloader');
  const { BG_CRITICAL, BG_LAZY } = await import('./engine/preload');

  // App 节点在 i18n 就绪后才创建（App 内用 _()，需保证翻译已初始化）
  let appElement = null;

  // --- 1. 模块加载 + 引擎初始化（async，与背景图预加载并行）；最晚才 import App ---
  const modules = (async () => {
    // --- i18n ---
    const { initI18n, detectLang } = await import('./i18n/index');
    const { _ } = await import('./i18n');
    const lang = detectLang();
    await initI18n(lang);

    // --- 游戏模块（延迟导入，避免顶层 _() 在翻译前求值） ---
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

    // --- 注入延迟模块（解决循环依赖） ---
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

    // --- 注册 UI 插槽：库存列表，任何面板用 <Slot name="stores"/> 即可复用 ---
    registerSlot('stores', 'stores', StoresPanel);

    // --- 注册游戏模块 ---
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
      // 静谧森林解锁重构：由「有木头即可见」改为「火达 4 级（初章结束）才展示」
      isAvailable: (st) => !!st.features?.location?.outside,
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

    // --- 启动引擎（读档 / 模块初始化 / 进入房间） ---
    Engine.init();

    // 音频：首次用户手势时初始化 AudioContext（浏览器自动播放限制），并播放排队中的场景音乐
    const { AudioEngine } = await import('./engine/AudioEngine');
    const unlockAudio = () => AudioEngine.init();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    // 开发期调试钩子：在浏览器控制台驱动事件系统做端到端验证
    if (import.meta.env.DEV) {
      const sm = await import('./store/stateManager');
      window.__game = { Engine, Events, useEvents, World, Path, Notifications, $SM: sm.$SM };
    }

    appElement = <App />;
  })();

  // --- 2. 渲染：启动屏（预加载所有场景背景图 + 并行等模块就绪）→ 就绪后挂载游戏 ---
  // 全部背景图（生火间/静谧森林/漫漫尘途/飞船/造物台）都进加载屏等待，
  // 网络慢时也不会出现"加载完成但切场图片还在慢慢加载/弹图"。
  root.render(
    <StrictMode>
      <Preloader assets={[...BG_CRITICAL, ...BG_LAZY]} ready={modules} renderApp={() => appElement} />
    </StrictMode>,
  );

  await modules;
}

boot();
