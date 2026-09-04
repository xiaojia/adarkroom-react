/**
 * Outside 模块（逻辑层）
 * ---------------------
 * 移植自旧版 script/outside.js。只包含游戏规则与状态变更，不操作任何 DOM。
 * UI 展示由 components/panels/OutsidePanel.jsx 负责（从状态派生渲染）。
 */
import { _ } from '../i18n';
import { $SM, Dispatch } from '../store/stateManager';
import { Engine } from '../engine/Engine';
import { Notifications } from '../engine/notifications';
import { AudioEngine } from '../engine/AudioEngine';
import { AudioLibrary } from '../engine/audioLibrary';

export const Outside = {
  name: _('Outside'),

  _STORES_OFFSET: 5,
  _GATHER_DELAY: 60,
  _TRAPS_DELAY: 90,
  _POP_DELAY: [0.5, 3],

  _INCOME: {
    gatherer: {
      name: _('gatherer'),
      delay: 10,
      stores: { wood: 1 },
    },
    hunter: {
      name: _('hunter'),
      delay: 10,
      stores: { fur: 0.5, meat: 0.5 },
    },
    trapper: {
      name: _('trapper'),
      delay: 10,
      stores: { meat: -1, bait: 1 },
    },
    tanner: {
      name: _('tanner'),
      delay: 10,
      stores: { fur: -5, leather: 1 },
    },
    charcutier: {
      name: _('charcutier'),
      delay: 10,
      stores: { meat: -5, wood: -5, 'cured meat': 1 },
    },
    'iron miner': {
      name: _('iron miner'),
      delay: 10,
      stores: { 'cured meat': -1, iron: 1 },
    },
    'coal miner': {
      name: _('coal miner'),
      delay: 10,
      stores: { 'cured meat': -1, coal: 1 },
    },
    'sulphur miner': {
      name: _('sulphur miner'),
      delay: 10,
      stores: { 'cured meat': -1, sulphur: 1 },
    },
    steelworker: {
      name: _('steelworker'),
      delay: 10,
      stores: { iron: -1, coal: -1, steel: 1 },
    },
    armourer: {
      name: _('armourer'),
      delay: 10,
      stores: { steel: -1, sulphur: -1, bullets: 1 },
    },
  },

  TrapDrops: [
    { rollUnder: 0.5, name: 'fur', message: _('scraps of fur') },
    { rollUnder: 0.75, name: 'meat', message: _('bits of meat') },
    { rollUnder: 0.85, name: 'scales', message: _('strange scales') },
    { rollUnder: 0.93, name: 'teeth', message: _('scattered teeth') },
    { rollUnder: 0.995, name: 'cloth', message: _('tattered cloth') },
    { rollUnder: 1.0, name: 'charm', message: _('a crudely made charm') },
  ],

  _popTimeout: null,
  _bound: false,

  init(options) {
    if (Engine.options.debug) {
      Outside._GATHER_DELAY = 0;
      Outside._TRAPS_DELAY = 0;
    }

    // subscribe to stateUpdates（只绑一次，避免章节解锁 + 引擎重复 init 造成多次订阅）
    if (!Outside._bound) {
      Dispatch('stateUpdate').subscribe(Outside.handleStateUpdates);
      Outside._bound = true;
    }

    if (typeof $SM.get('features.location.outside') === 'undefined') {
      $SM.set('features.location.outside', true);
      if (!$SM.get('game.buildings')) $SM.set('game.buildings', {});
      if (!$SM.get('game.population')) $SM.set('game.population', 0);
      if (!$SM.get('game.workers')) $SM.set('game.workers', {});
    }

    if (Outside.getMaxPopulation() > 0) {
      Outside.schedulePopIncrease();
    }
  },

  getMaxPopulation() {
    return $SM.get('game.buildings["hut"]', true) * 4;
  },

  increasePopulation() {
    const space = Outside.getMaxPopulation() - $SM.get('game.population');
    if (space > 0) {
      let num = Math.floor(Math.random() * (space / 2) + space / 2);
      if (num === 0) num = 1;
      if (num === 1) {
        Notifications.notify(null, _('a stranger arrives in the night'));
      } else if (num < 5) {
        Notifications.notify(null, _('a weathered family takes up in one of the huts.'));
      } else if (num < 10) {
        Notifications.notify(null, _('a small group arrives, all dust and bones.'));
      } else if (num < 30) {
        Notifications.notify(null, _('a convoy lurches in, equal parts worry and hope.'));
      } else {
        Notifications.notify(null, _("the town's booming. word does get around."));
      }
      Engine.log('population increased by ' + num);
      $SM.add('game.population', num);
    }
    Outside.schedulePopIncrease();
  },

  killVillagers(num) {
    $SM.add('game.population', num * -1);
    if ($SM.get('game.population') < 0) {
      $SM.set('game.population', 0);
    }
    const remaining = Outside.getNumGatherers();
    if (remaining < 0) {
      let gap = -remaining;
      for (const k in $SM.get('game.workers')) {
        const numWorkers = $SM.get('game.workers["' + k + '"]');
        if (numWorkers < gap) {
          gap -= numWorkers;
          $SM.set('game.workers["' + k + '"]', 0);
        } else {
          $SM.add('game.workers["' + k + '"]', gap * -1);
          break;
        }
      }
    }
  },

  schedulePopIncrease() {
    const nextIncrease = Math.floor(Math.random() * (Outside._POP_DELAY[1] - Outside._POP_DELAY[0])) + Outside._POP_DELAY[0];
    Engine.log('next population increase scheduled in ' + nextIncrease + ' minutes');
    clearTimeout(Outside._popTimeout);
    Outside._popTimeout = Engine.setTimeout(Outside.increasePopulation, nextIncrease * 60 * 1000);
  },

  getNumGatherers() {
    let num = $SM.get('game.population');
    for (const k in $SM.get('game.workers')) {
      num -= $SM.get('game.workers["' + k + '"]');
    }
    return num;
  },

  /* ------------------------- 工人增减 ------------------------- */

  increaseWorker(worker, increaseAmt) {
    if (Outside.getNumGatherers() > 0) {
      increaseAmt = Math.min(Outside.getNumGatherers(), increaseAmt || 1);
      Engine.log('increasing ' + worker + ' by ' + increaseAmt);
      $SM.add('game.workers["' + worker + '"]', increaseAmt);
    }
  },

  decreaseWorker(worker, decreaseAmt) {
    if ($SM.get('game.workers["' + worker + '"]') > 0) {
      decreaseAmt = Math.min($SM.get('game.workers["' + worker + '"]') || 0, decreaseAmt || 1);
      Engine.log('decreasing ' + worker + ' by ' + decreaseAmt);
      $SM.add('game.workers["' + worker + '"]', decreaseAmt * -1);
    }
  },

  /* ------------------------- 村庄建筑 ------------------------- */

  checkWorker(name) {
    const jobMap = {
      lodge: ['hunter', 'trapper'],
      tannery: ['tanner'],
      smokehouse: ['charcutier'],
      'iron mine': ['iron miner'],
      'coal mine': ['coal miner'],
      'sulphur mine': ['sulphur miner'],
      steelworks: ['steelworker'],
      armoury: ['armourer'],
    };

    const jobs = jobMap[name];
    let added = false;
    if (typeof jobs === 'object') {
      for (let i = 0, len = jobs.length; i < len; i++) {
        const job = jobs[i];
        if (typeof $SM.get('game.buildings["' + name + '"]') === 'number' &&
          typeof $SM.get('game.workers["' + job + '"]') !== 'number') {
          Engine.log('adding ' + job + ' to the workers list');
          $SM.set('game.workers["' + job + '"]', 0);
          added = true;
        }
      }
    }
    return added;
  },

  updateVillageIncome() {
    for (const worker in Outside._INCOME) {
      const income = Outside._INCOME[worker];
      let num = worker === 'gatherer' ? Outside.getNumGatherers() : $SM.get('game.workers["' + worker + '"]');
      if (typeof num === 'number') {
        if (num < 0) num = 0;
        const stores = {};
        const curIncome = $SM.getIncome(worker);
        for (const store in income.stores) {
          stores[store] = income.stores[store] * num;
        }
        const needsUpdate = Object.keys(stores).some((s) => curIncome[s] !== stores[s]);
        if (needsUpdate) {
          $SM.setIncome(worker, {
            delay: income.delay,
            stores,
          });
        }
      }
    }
  },

  /** 村庄数据变更后刷新（React 端由面板从状态派生渲染，无 DOM 操作） */
  updateVillage() {
    Outside.updateVillageIncome();
    $SM.fireUpdate('game');
  },

  setTitle() {
    // React 端由 Header 组件根据状态派生标题
  },

  onArrival() {
    Outside.setTitle();
    if (!$SM.get('game.outside.seenForest')) {
      Notifications.notify(Outside, _('the sky is grey and the wind blows relentlessly'));
      $SM.set('game.outside.seenForest', true);
    }
    Outside.updateTrapButton();
  },

  gatherWood() {
    AudioEngine.playSound(AudioLibrary.GATHER_WOOD);
    Notifications.notify(Outside, _('dry brush and dead branches litter the forest floor'));
    const gatherAmt = $SM.get('game.buildings["cart"]', true) > 0 ? 50 : 10;
    $SM.add('stores.wood', gatherAmt);
  },

  checkTraps() {
    AudioEngine.playSound(AudioLibrary.CHECK_TRAPS);
    const drops = {};
    const msg = [];
    const numTraps = $SM.get('game.buildings["trap"]', true);
    const numBait = $SM.get('stores.bait', true);
    const numDrops = numTraps + (numBait < numTraps ? numBait : numTraps);
    for (let i = 0; i < numDrops; i++) {
      const roll = Math.random();
      for (const j in Outside.TrapDrops) {
        const drop = Outside.TrapDrops[j];
        if (roll < drop.rollUnder) {
          let num = drops[drop.name];
          if (typeof num === 'undefined') {
            num = 0;
            msg.push(drop.message);
          }
          drops[drop.name] = num + 1;
          break;
        }
      }
    }
    let s = _('the traps contain ');
    for (let i = 0, len = msg.length; i < len; i++) {
      if (len > 1 && i > 0 && i < len - 1) {
        s += ', ';
      } else if (len > 1 && i === len - 1) {
        s += _(' and ');
      }
      s += msg[i];
    }

    const baitUsed = numBait < numTraps ? numBait : numTraps;
    drops['bait'] = -baitUsed;

    Notifications.notify(Outside, s);
    $SM.addM('stores', drops);
  },

  handleStateUpdates(e) {
    if (e.category === 'stores') {
      // 库存变化（陷阱检查后）重新评估陷阱按钮
      Outside.updateTrapButton();
    } else if (e.stateName.indexOf('game.workers') === 0 || e.stateName.indexOf('game.population') === 0) {
      Outside.updateVillageIncome();
    }
  },

  /* ------------------- 供 React 渲染的查询函数 ------------------- */

  /** 返回工人列表：[{key, name, count, canUp, canDn, income: [{store, msg}]}] */
  getWorkers() {
    const workers = [];
    const population = $SM.get('game.population', true);
    if (population === 0) return workers;
    const numGatherers = Outside.getNumGatherers();
    workers.push({
      key: 'gatherer',
      name: _('gatherer'),
      count: numGatherers,
      canUp: numGatherers > 0,
      canDn: false,
      income: Outside.workerIncome('gatherer', numGatherers),
    });
    const order = Object.keys(Outside._INCOME);
    for (const k of order) {
      if (k === 'gatherer') continue;
      if (typeof $SM.get('game.workers["' + k + '"]') === 'undefined') continue;
      const count = $SM.get('game.workers["' + k + '"]', true);
      workers.push({
        key: k,
        name: Outside._INCOME[k].name,
        count,
        canUp: numGatherers > 0,
        canDn: count > 0,
        income: Outside.workerIncome(k, count),
      });
    }
    return workers;
  },

  workerIncome(key, num) {
    const income = Outside._INCOME[key];
    const rows = [];
    for (const s in income.stores) {
      const val = income.stores[s] * num;
      rows.push({
        store: s,
        msg: Engine.getIncomeMsg(val, income.delay),
      });
    }
    return rows;
  },

  /** 返回村庄建筑列表：[{key, name, count, icon}]（trap 拆分为 trap + baited trap） */
  getVillageBuildings() {
    const out = [];
    const buildings = $SM.get('game.buildings') || {};
    for (const k in buildings) {
      if (k === 'trap') {
        const numTraps = buildings[k];
        const numBait = $SM.get('stores.bait', true);
        const traps = Math.max(numTraps - numBait, 0);
        const baited = Math.min(numTraps, numBait);
        if (traps > 0) out.push({ key: k, name: _(k), count: traps });
        if (baited > 0) out.push({ key: 'baited trap', name: _('baited trap'), count: baited });
      } else {
        out.push({ key: k, name: _(k), count: buildings[k] });
      }
    }
    return out;
  },

  getTitle() {
    const numHuts = $SM.get('game.buildings["hut"]', true);
    if (numHuts === 0) return _('A Silent Forest');
    if (numHuts === 1) return _('A Lonely Hut');
    if (numHuts <= 4) return _('A Tiny Village');
    if (numHuts <= 8) return _('A Modest Village');
    if (numHuts <= 14) return _('A Large Village');
    return _('A Raucous Village');
  },

  trapButtonVisible() {
    return $SM.get('game.buildings["trap"]', true) > 0;
  },

  updateTrapButton() {
    // React 端由 OutsidePanel 根据 trapButtonVisible() 派生渲染
  },
};
