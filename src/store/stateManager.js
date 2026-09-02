/**
 * 游戏状态管理层
 * -------------------
 * 用 Zustand 保存一份与旧版兼容的 State 对象（键名/路径格式完全一致，
 * 例如 stores.wood、game.buildings["trap"]、game.workers["iron miner"]）。
 *
 * $SM 提供与旧版一致的 API（get/set/add/setM/addM/remove/...）。
 * 任何变更都会：
 *   1. 直接修改 State 对象
 *   2. 触发 version 递增（驱动 React 组件重渲染）
 *   3. 发布 stateUpdate 事件（驱动逻辑层订阅者）
 *   4. 写 localStorage（存档兼容旧版）
 */
import { create } from 'zustand';

export const MAX_STORE = 99999999999999;

// 原始游戏状态对象（结构与旧版存档一致）
export let State = {};

export const useGame = create(() => ({
  state: State,
  version: 0,
}));

/** 提交一次变更：通知所有订阅的 React 组件重新渲染 */
export function commit() {
  useGame.setState((s) => ({ version: s.version + 1 }));
}

/** React 组件用：订阅任意状态变更（游戏更新频率低，全量重渲染足够） */
export function useTick() {
  return useGame((s) => s.version);
}

/** 供 React 组件读取完整状态（selector 精度由调用方决定） */
export function useGameState(selector) {
  return useGame(selector);
}

/* ------------------------- 发布订阅（兼容 $.Dispatch） ------------------------- */

const topics = {};

export function Dispatch(id) {
  let topic = topics[id];
  if (!topic) {
    const callbacks = new Set();
    topic = {
      publish: (...args) => callbacks.forEach((cb) => cb(...args)),
      subscribe: (cb) => {
        callbacks.add(cb);
        return () => callbacks.delete(cb);
      },
      unsubscribe: (cb) => callbacks.delete(cb),
    };
    if (id) topics[id] = topic;
  }
  return topic;
}

/* ------------------------- 点号路径解析（替代 eval） ------------------------- */

// 'stores["alien alloy"]' -> ['stores', 'alien alloy']
// 'game.buildings.trap'   -> ['game', 'buildings', 'trap']
function parsePath(stateName) {
  return stateName.split(/[.\[\]'"]+/).filter(Boolean);
}

function resolvePath(words) {
  let obj = State;
  for (let i = 0; i < words.length - 1; i++) {
    if (obj[words[i]] === undefined) return undefined;
    obj = obj[words[i]];
  }
  return obj;
}

function createPath(words, value) {
  let obj = State;
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i];
    if (obj[w] === undefined || obj[w] === null) obj[w] = {};
    obj = obj[w];
  }
  obj[words[words.length - 1]] = value;
  return obj;
}

function getCategory(stateName) {
  const firstOB = stateName.indexOf('[');
  const firstDot = stateName.indexOf('.');
  let cutoff;
  if (firstOB === -1 || firstDot === -1) {
    cutoff = firstOB > firstDot ? firstOB : firstDot;
  } else {
    cutoff = firstOB < firstDot ? firstOB : firstDot;
  }
  if (cutoff === -1) return stateName;
  return stateName.substr(0, cutoff);
}

/* ------------------------------- $SM 对象 ------------------------------- */

export const $SM = {
  MAX_STORE,

  get(stateName, requestZero) {
    const words = parsePath(stateName);
    const parent = resolvePath(words);
    if (parent === undefined) return requestZero ? 0 : undefined;
    const val = parent[words[words.length - 1]];
    if (!val && requestZero) return 0;
    return val;
  },

  set(stateName, value, noEvent) {
    const words = parsePath(stateName);
    if (typeof value === 'number' && value > $SM.MAX_STORE) value = $SM.MAX_STORE;
    createPath(words, value);
    // stores 不能为负
    if (stateName.indexOf('stores') === 0 && $SM.get(stateName, true) < 0) {
      const parent = resolvePath(words);
      parent[words[words.length - 1]] = 0;
    }
    if (!noEvent) {
      Engine_saveGame();
      $SM.fireUpdate(stateName);
    }
  },

  setM(parentName, list, noEvent) {
    if ($SM.get(parentName) === undefined) $SM.set(parentName, {}, true);
    for (const k in list) {
      $SM.set(parentName + '["' + k + '"]', list[k], true);
    }
    if (!noEvent) {
      Engine_saveGame();
      $SM.fireUpdate(parentName);
    }
  },

  add(stateName, value, noEvent) {
    const old = $SM.get(stateName, true);
    if (old !== old) {
      $SM.set(stateName, old + value, noEvent);
    } else if (typeof old !== 'number' || typeof value !== 'number') {
      return 1;
    } else {
      $SM.set(stateName, old + value, noEvent);
    }
    return 0;
  },

  addM(parentName, list, noEvent) {
    let err = 0;
    if ($SM.get(parentName) === undefined) $SM.set(parentName, {}, true);
    for (const k in list) {
      if ($SM.add(parentName + '["' + k + '"]', list[k], true)) err++;
    }
    if (!noEvent) {
      Engine_saveGame();
      $SM.fireUpdate(parentName);
    }
    return err;
  },

  setget(stateName, value, noEvent) {
    $SM.set(stateName, value, noEvent);
    const words = parsePath(stateName);
    const parent = resolvePath(words);
    return parent[words[words.length - 1]];
  },

  remove(stateName, noEvent) {
    const words = parsePath(stateName);
    const parent = resolvePath(words);
    if (parent !== undefined) {
      delete parent[words[words.length - 1]];
    }
    if (!noEvent) {
      Engine_saveGame();
      $SM.fireUpdate(stateName);
    }
  },

  buildPath() {
    // 兼容旧接口，不再需要
    return '';
  },

  fireUpdate(stateName, save) {
    let category = $SM.getCategory(stateName);
    if (stateName === undefined) stateName = category = 'all';
    Dispatch('stateUpdate').publish({ category, stateName });
    commit();
    if (save) Engine_saveGame();
  },

  getCategory,

  /* ----------------------- 特定状态函数 ----------------------- */

  addPerk(name) {
    $SM.set('character.perks["' + name + '"]', true);
  },

  hasPerk(name) {
    return $SM.get('character.perks["' + name + '"]');
  },

  setIncome(source, options) {
    const existing = $SM.get('income["' + source + '"]');
    if (typeof existing !== 'undefined') {
      options.timeLeft = existing.timeLeft;
    }
    $SM.set('income["' + source + '"]', options);
  },

  getIncome(source) {
    const existing = $SM.get('income["' + source + '"]');
    return typeof existing !== 'undefined' ? existing : {};
  },

  collectIncome() {
    const activeModule = Engine_getActiveModule();
    let changed = false;
    if (typeof $SM.get('income') !== 'undefined' && activeModule !== 'Space') {
      for (const source in $SM.get('income')) {
        const income = $SM.get('income["' + source + '"]');
        if (typeof income.timeLeft !== 'number') income.timeLeft = 0;
        income.timeLeft--;
        if (income.timeLeft <= 0) {
          if (source === 'thieves') $SM.addStolen(income.stores);
          const cost = income.stores;
          let ok = true;
          if (source !== 'thieves') {
            for (const k in cost) {
              const have = $SM.get('stores["' + k + '"]', true);
              if (have + cost[k] < 0) {
                ok = false;
                break;
              }
            }
          }
          if (ok) {
            $SM.addM('stores', income.stores, true);
          }
          changed = true;
          if (typeof income.delay === 'number') {
            income.timeLeft = income.delay;
          }
        }
      }
    }
    if (changed) {
      $SM.fireUpdate('income', true);
    }
    Engine_setIncomeTimeout();
  },

  addStolen(stores) {
    for (const k in stores) {
      const old = $SM.get('stores["' + k + '"]', true);
      const short = old + stores[k];
      if (short < 0) {
        $SM.add('game.stolen["' + k + '"]', stores[k] * -1 + short);
      } else {
        $SM.add('game.stolen["' + k + '"]', stores[k] * -1);
      }
    }
  },

  startThieves() {
    $SM.set('game.thieves', 1);
    $SM.setIncome('thieves', {
      delay: 10,
      stores: { wood: -10, fur: -5, meat: -5 },
    });
  },

  num(name, craftable) {
    switch (craftable.type) {
      case 'good':
      case 'tool':
      case 'weapon':
      case 'upgrade':
        return $SM.get('stores["' + name + '"]', true);
      case 'building':
        return $SM.get('game.buildings["' + name + '"]', true);
    }
  },

  handleStateUpdates() {},
};

/* 与 Engine 之间的双向挂钩（避免循环依赖，由 Engine 初始化时注册） */
let Engine_saveGame = () => {};
let Engine_getActiveModule = () => 'Room';
let Engine_setIncomeTimeout = () => {};

export function bindEngine({ saveGame, getActiveModule, setIncomeTimeout }) {
  if (saveGame) Engine_saveGame = saveGame;
  if (getActiveModule) Engine_getActiveModule = getActiveModule;
  if (setIncomeTimeout) Engine_setIncomeTimeout = setIncomeTimeout;
}

/* 初始化：创建分类空对象 */
export function initStateManager() {
  const cats = [
    'features',
    'stores',
    'character',
    'income',
    'timers',
    'game',
    'playStats',
    'previous',
    'outfit',
  ];
  for (const which of cats) {
    if (!$SM.get(which)) $SM.set(which, {}, true);
  }
  Dispatch('stateUpdate').subscribe($SM.handleStateUpdates);
}
