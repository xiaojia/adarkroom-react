/**
 * 引擎层（React 版）
 * -------------------
 * 对应旧版 script/engine.js + script/header.js：
 *  - 模块注册表：各模块把「元信息 + React 面板组件 + 可用性判断」注册进来
 *  - 存档/读档（localStorage.gameState，与旧版格式完全兼容）
 *  - 模块切换 travelTo / 键盘左右导航
 *  - 菜单选项：关灯、双倍时间、重开、分享、导出导入
 *  - doubleTime 的 setTimeout/setInterval 包装
 */
import { create } from 'zustand';
import { _ } from '../i18n';
import { State, $SM, Dispatch, bindEngine, initStateManager, commit } from '../store/stateManager';

/* ----------------------------- 引擎全局状态 ----------------------------- */

export const useEngine = create(() => ({
  activeModule: null, // 当前模块 id
  view: 'locations', // 'locations' | 'world' | 'space'
  options: { debug: false, doubleTime: false, state: null },
  GAME_OVER: false,
}));

/* 保存提示（右下角 "saved."） */
export const useSaveNotify = create(() => ({ last: 0 }));
export function flashSaveNotify() {
  useSaveNotify.setState({ last: Date.now() });
}

/* ------------------------------- 模块注册表 ------------------------------- */

const modules = {}; // id -> { id, name, before?, Component, onArrival?, isAvailable? }

export const ModuleRegistry = {
  register(def) {
    modules[def.id] = def;
  },
  get(id) {
    return modules[id];
  },
  all() {
    return Object.values(modules);
  },
  /** 按注册顺序 + before 排序后返回当前可用的模块 */
  available() {
    const list = [];
    for (const m of Object.values(modules)) {
      if (m.isAvailable && !m.isAvailable(State)) continue;
      if (m.before && list.some((x) => x.id === m.before)) {
        const idx = list.findIndex((x) => x.id === m.before);
        list.splice(idx, 0, m);
      } else {
        list.push(m);
      }
    }
    return list;
  },
  ids() {
    return ModuleRegistry.available().map((m) => m.id);
  },
};

/* -------------------------------- 引擎对象 -------------------------------- */

export const Engine = {
  SITE_URL: encodeURIComponent('http://adarkroom.doublespeakgames.com'),
  VERSION: 1.3,
  MAX_STORE: 99999999999999,
  SAVE_DISPLAY: 30 * 1000,
  GAME_OVER: false,

  keyLock: false,
  tabNavigation: true,

  options: { debug: false, doubleTime: false },

  get activeModuleId() {
    return useEngine.getState().activeModule;
  },

  get doubleTime() {
    return useEngine.getState().options.doubleTime;
  },

  init(options) {
    Engine.options = { ...Engine.options, ...options };
    useEngine.setState({ options: Engine.options });

    if (Engine.options.state != null) {
      Object.assign(State, Engine.options.state);
    } else {
      Engine.loadGame();
    }

    initStateManager();

    // 绑定 $SM 需要的引擎回调
    bindEngine({
      saveGame: () => Engine.saveGame(),
      getActiveModule: () => useEngine.getState().activeModule,
      setIncomeTimeout: () => {
        clearTimeout(Engine._incomeTimeout);
        Engine._incomeTimeout = setTimeout(() => $SM.collectIncome(), 1000);
      },
    });

    // 初始化逻辑模块（设置默认状态、定时器、注册 UI 组件）
    // 与旧版一致：只有当前可用的模块才执行 init（如 Outside 需要木头出现后）
    for (const m of Object.values(modules)) {
      if (m.isAvailable && !m.isAvailable(State)) continue;
      if (m.init) m.init(Engine.options);
    }

    Engine.saveLanguage();
    Engine.travelTo('room');
  },

  /* ------------------------------- 存档 ------------------------------- */

  saveGame() {
    try {
      if (typeof Storage !== 'undefined' && localStorage) {
        localStorage.gameState = JSON.stringify(State);
        // 每 30s 才闪现一次 "saved."
        if (typeof Engine._lastNotify === 'undefined' || Date.now() - Engine._lastNotify > Engine.SAVE_DISPLAY) {
          Engine._lastNotify = Date.now();
          flashSaveNotify();
        }
      }
    } catch (e) {}
  },

  loadGame() {
    try {
      const savedState = JSON.parse(localStorage.gameState);
      if (savedState) {
        Object.assign(State, savedState);
        Engine.updateOldState();
        Engine.log('loaded save!');
        return;
      }
    } catch (e) {}
    // 新游戏
    $SM.set('version', Engine.VERSION);
    Engine.event('progress', 'new game');
  },

  updateOldState() {
    // 移植自旧版 StateManager.updateOldState（v1.0 -> 1.3 迁移）
    const { World, Ship } = requireLazyModules();
    let version = $SM.get('version');
    if (typeof version !== 'number') version = 1.0;
    if (version === 1.0) {
      $SM.remove('outside.workers.hunter', true);
      $SM.remove('income.hunter', true);
      version = 1.1;
    }
    if (version === 1.1) {
      if ($SM.get('world')) {
        World.placeLandmark(15, World.RADIUS * 1.5, World.TILE.SWAMP, $SM.get('world.map'));
      }
      version = 1.2;
    }
    if (version === 1.2) {
      $SM.remove('room.fire', true);
      $SM.remove('room.temperature', true);
      $SM.remove('room.buttons', true);
      if ($SM.get('room')) {
        $SM.set('features.location.room', true);
        $SM.set('game.builder.level', $SM.get('room.builder'));
        $SM.remove('room', true);
      }
      if ($SM.get('outside')) {
        $SM.set('features.location.outside', true);
        $SM.set('game.population', $SM.get('outside.population'));
        $SM.set('game.buildings', $SM.get('outside.buildings'));
        $SM.set('game.workers', $SM.get('outside.workers'));
        $SM.set('game.outside.seenForest', $SM.get('outside.seenForest'));
        $SM.remove('outside', true);
      }
      if ($SM.get('world')) {
        $SM.set('features.location.world', true);
        $SM.set('game.world.map', $SM.get('world.map'));
        $SM.set('game.world.mask', $SM.get('world.mask'));
        $SM.set('starved', $SM.get('character.starved', true));
        $SM.set('dehydrated', $SM.get('character.dehydrated', true));
        $SM.remove('world', true);
        $SM.remove('starved', true);
        $SM.remove('dehydrated', true);
      }
      if ($SM.get('ship')) {
        $SM.set('features.location.spaceShip', true);
        $SM.set('game.spaceShip.hull', $SM.get('ship.hull', true));
        $SM.set('game.spaceShip.thrusters', $SM.get('ship.thrusters', true));
        $SM.set('game.spaceShip.seenWarning', $SM.get('ship.seenWarning'));
        $SM.set('game.spaceShip.seenShip', $SM.get('ship.seenShip'));
        $SM.remove('ship', true);
      }
      if ($SM.get('punches')) {
        $SM.set('character.punches', $SM.get('punches'));
        $SM.remove('punches', true);
      }
      if ($SM.get('perks')) {
        $SM.set('character.perks', $SM.get('perks'));
        $SM.remove('perks', true);
      }
      if ($SM.get('thieves')) {
        $SM.set('game.thieves', $SM.get('thieves'));
        $SM.remove('thieves', true);
      }
      if ($SM.get('stolen')) {
        $SM.set('game.stolen', $SM.get('stolen'));
        $SM.remove('stolen', true);
      }
      if ($SM.get('cityCleared')) {
        $SM.set('character.cityCleared', $SM.get('cityCleared'));
        $SM.remove('cityCleared', true);
      }
      $SM.set('version', 1.3);
    }
  },

  export64() {
    Engine.saveGame();
    let string64 = Base64.encode(localStorage.gameState);
    string64 = string64.replace(/\s/g, '').replace(/\./g, '').replace(/\n/g, '');
    return string64;
  },

  import64(string64) {
    string64 = string64.replace(/\s/g, '').replace(/\./g, '').replace(/\n/g, '');
    const decodedSave = Base64.decode(string64);
    localStorage.gameState = decodedSave;
    location.reload();
  },

  event(cat, act) {
    if (typeof ga === 'function') ga('send', 'event', cat, act);
  },

  deleteSave(noReload) {
    try {
      if (typeof Storage !== 'undefined' && localStorage) {
        localStorage.clear();
      }
    } catch (e) {}
    if (!noReload) location.reload();
  },

  confirmDelete() {
    const { Events } = requireEvents();
    Events.startEvent({
      title: _('Restart?'),
      scenes: {
        start: {
          text: [_('restart the game?')],
          buttons: {
            yes: {
              text: _('yes'),
              nextScene: 'end',
              onChoose: () => Engine.deleteSave(),
            },
            no: {
              text: _('no'),
              nextScene: 'end',
            },
          },
        },
      },
    });
  },

  exportImport() {
    const { Events } = requireEvents();
    Events.startEvent({
      title: _('Export / Import'),
      scenes: {
        start: {
          text: [_('export or import save data, for backing up'), _('or migrating computers')],
          buttons: {
            export: {
              text: _('export'),
              nextScene: 'end',
              onChoose: () => Engine.export64(),
            },
            import: {
              text: _('import'),
              nextScene: { 1: 'confirm' },
            },
            cancel: {
              text: _('cancel'),
              nextScene: 'end',
            },
          },
        },
        confirm: {
          text: [_('are you sure?'), _('if the code is invalid, all data will be lost.'), _('this is irreversible.')],
          buttons: {
            yes: {
              text: _('yes'),
              nextScene: { 1: 'inputImport' },
            },
            no: {
              text: _('no'),
              nextScene: 'end',
            },
          },
        },
        inputImport: {
          text: [_('put the save code here.')],
          textarea: '',
          buttons: {
            okay: {
              text: _('import'),
              nextScene: 'end',
              onChoose: () => {
                const { Events } = requireEvents();
                const code = useEventsGetTextarea();
                if (code) Engine.import64(code);
              },
            },
            cancel: {
              text: _('cancel'),
              nextScene: 'end',
            },
          },
        },
      },
    });
  },

  share() {
    const { Events } = requireEvents();
    Events.startEvent({
      title: _('Share'),
      scenes: {
        start: {
          text: [_('bring your friends.')],
          buttons: {
            facebook: {
              text: _('facebook'),
              nextScene: 'end',
              onChoose: () => window.open('https://www.facebook.com/sharer/sharer.php?u=' + Engine.SITE_URL, 'sharer', 'width=626,height=436'),
            },
            twitter: {
              text: _('twitter'),
              nextScene: 'end',
              onChoose: () => window.open('https://twitter.com/intent/tweet?text=A%20Dark%20Room&url=' + Engine.SITE_URL, 'sharer', 'width=660,height=260'),
            },
            reddit: {
              text: _('reddit'),
              nextScene: 'end',
              onChoose: () => window.open('http://www.reddit.com/submit?url=' + Engine.SITE_URL, 'sharer', 'width=960,height=700'),
            },
            close: {
              text: _('close'),
              nextScene: 'end',
            },
          },
        },
      },
    });
  },

  isLightsOff() {
    return useEngine.getState().options.lightsOff === true;
  },

  turnLightsOff() {
    useEngine.setState((s) => ({
      options: { ...s.options, lightsOff: !s.options.lightsOff },
    }));
  },

  toggleDoubleTime() {
    useEngine.setState((s) => ({
      options: { ...s.options, doubleTime: !s.options.doubleTime },
    }));
  },

  /* ------------------------------- 模块切换 ------------------------------- */

  travelTo(moduleId) {
    const mod = ModuleRegistry.get(moduleId);
    if (!mod) return;
    if (Engine.activeModuleId === moduleId) {
      if (mod.onArrival) mod.onArrival(0);
      return;
    }
    useEngine.setState({ activeModule: moduleId, view: mod.fullscreen ? moduleId : 'locations' });
    if (mod.onArrival) mod.onArrival(1);
    // 打印该模块积压的通知
    const { Notifications } = requireNotifications();
    Notifications.printQueue(moduleId);
  },

  setView(view) {
    useEngine.setState({ view });
  },

  getIncomeMsg(num, delay) {
    return _('{0} per {1}s', (num > 0 ? '+' : '') + num, delay);
  },

  log(msg) {
    if (Engine.options.debug || Engine.options.log) console.log(msg);
  },

  /* ----------------------- 键盘 / 滑动导航（移植） ----------------------- */

  keyDown(e) {
    if (Engine.keyLock) return false;
    const mod = ModuleRegistry.get(Engine.activeModuleId);
    if (mod && mod.keyDown) mod.keyDown(e);
    return true;
  },

  keyUp(e) {
    // 键盘只转发给激活模块自身（如 Space 的移动状态），不做 tab 栏切换。
    const mod = ModuleRegistry.get(Engine.activeModuleId);
    if (mod && mod.keyUp) {
      mod.keyUp(e);
    }
    return false;
  },

  /* ----------------------------- 计时器包装 ----------------------------- */

  setTimeout(callback, timeout, skipDouble) {
    if (Engine.doubleTime && !skipDouble) timeout /= 2;
    return setTimeout(callback, timeout);
  },

  setInterval(callback, timeout, skipDouble) {
    if (Engine.doubleTime && !skipDouble) timeout /= 2;
    return setInterval(callback, timeout);
  },

  /* ------------------------------- 语言 ------------------------------- */

  switchLanguage(lang) {
    const url = new URL(location.href);
    url.searchParams.set('lang', lang);
    location.href = url.toString();
  },

  saveLanguage() {
    try {
      const m = /[?|&]lang=([^&;]+?)(&|#|;|$)/.exec(location.search);
      if (m && localStorage) localStorage.lang = decodeURIComponent(m[1].replace(/\+/g, '%20'));
    } catch (e) {}
  },
};

/* 延迟加载，避免循环依赖 */
function requireLazyModules() {
  // 由 main.jsx 在启动时注入
  return Engine._lazyModules || { World: {}, Ship: {} };
}

function requireNotifications() {
  return { Notifications: Engine._Notifications };
}

function requireEvents() {
  return Engine._Events || { Events: { startEvent: () => {} }, useEvents: null };
}

/** 读取事件输入框内容（导入存档用） */
function useEventsGetTextarea() {
  if (!Engine._Events || !Engine._Events.useEvents) return '';
  const st = Engine._Events.useEvents.getState();
  const cur = st.current;
  return (cur && (cur._textareaValue || cur.textareaValue)) || '';
}

export function bindLazyModules(mods) {
  Engine._lazyModules = mods;
}

export function bindNotifications(n) {
  Engine._Notifications = n;
}

export function bindEvents(mods) {
  Engine._Events = mods;
}

/* Base64（旧版 lib/base64.js 的极简实现，用于导出/导入） */
export const Base64 = {
  _keyStr: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
  encode(input) {
    input = unescape(encodeURIComponent(input));
    let output = '';
    let chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    let i = 0;
    while (i < input.length) {
      chr1 = input.charCodeAt(i++);
      chr2 = input.charCodeAt(i++);
      chr3 = input.charCodeAt(i++);
      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;
      if (isNaN(chr2)) enc3 = enc4 = 64;
      else if (isNaN(chr3)) enc4 = 64;
      output +=
        this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
        this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
    }
    return output;
  },
  decode(input) {
    let output = '';
    let chr1, chr2, chr3;
    let enc1, enc2, enc3, enc4;
    let i = 0;
    input = input.replace(/[^A-Za-z0-9+/=]/g, '');
    while (i < input.length) {
      enc1 = this._keyStr.indexOf(input.charAt(i++));
      enc2 = this._keyStr.indexOf(input.charAt(i++));
      enc3 = this._keyStr.indexOf(input.charAt(i++));
      enc4 = this._keyStr.indexOf(input.charAt(i++));
      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;
      output += String.fromCharCode(chr1);
      if (enc3 !== 64) output += String.fromCharCode(chr2);
      if (enc4 !== 64) output += String.fromCharCode(chr3);
    }
    return decodeURIComponent(escape(output));
  },
};
