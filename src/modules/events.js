/**
 * Events 事件系统（逻辑层）—— 完整移植
 * ---------------------------------------
 * 对应旧版 script/events.js（含战斗引擎与随机事件池调度）。
 * 逻辑层完全与 DOM 无关：
 *  - 战斗中的「战士」是普通对象（hp/maxHp/status/...），由数据模块的
 *    atHealth/specials/action 通过 Events.setStatus(fighter, ...) 等操作。
 *  - 所有可展示信息汇总成一份 snapshot 写入 zustand（useEvents），
 *    EventModal 只负责渲染 snapshot。
 */
import { create } from 'zustand';
import { _ } from '../i18n';
import { $SM, Dispatch, commit } from '../store/stateManager';
import { Engine } from '../engine/Engine';
import { Notifications } from '../engine/notifications';
import { requireModule } from '../engine/moduleLoader';
import { Pixel } from './pixel';
import { AudioEngine } from '../engine/AudioEngine';
import { AudioLibrary } from '../engine/audioLibrary';

// 事件池数据（纯数据模块，无副作用）
import { Global as PoolGlobal } from './eventsData/global';
import { Room as PoolRoom } from './eventsData/room';
import { Outside as PoolOutside } from './eventsData/outside';
import { Encounters as PoolEncounters } from './eventsData/encounters';
import { Setpieces as PoolSetpieces } from './eventsData/setpieces';
import { Executioner as PoolExecutioner } from './eventsData/executioner';

/* ------------------------- zustand：当前事件快照 ------------------------- */

export const useEvents = create(() => ({
  current: null, // 当前事件对象（事件栈栈顶）
  snap: null, // 供 EventModal 渲染的展示快照
}));

let _seq = 0;

/* ------------------------------- Events ------------------------------- */

export const Events = {
  _EVENT_TIME_RANGE: [3, 6], // 随机事件间隔（分钟）
  _EAT_COOLDOWN: 5,
  _MEDS_COOLDOWN: 7,
  _HYPO_COOLDOWN: 7,
  _SHIELD_COOLDOWN: 10,
  _STIM_COOLDOWN: 10,
  _LEAVE_COOLDOWN: 1,
  STUN_DURATION: 4000,
  ENERGISE_MULTIPLIER: 4,
  EXPLOSION_DURATION: 3000,
  ENRAGE_DURATION: 4000,
  MEDITATE_DURATION: 5000,
  BOOST_DURATION: 3000,
  BOOST_DAMAGE: 10,
  DOT_TICK: 1000,
  BLINK_INTERVAL: false,
  _autoAttackBtns: [],

  options: {},
  delayState: 'wait',
  activeScene: null,
  eventStack: [],

  // 战斗中的战士（普通对象，替代旧版 DOM）
  _playerFighter: null,
  _enemyFighter: null,
  _meditateDmg: 0,
  _enemyAttackStarted: false,
  _lastSpecial: null,
  fought: false,
  won: false,

  /* ------------------------------ 初始化 ------------------------------ */

  init(options) {
    Events.options = { ...Events.options, ...options };

    // 组建事件池
    Events.EventPool = [].concat(PoolGlobal, PoolRoom, PoolOutside);
    Events.Global = PoolGlobal;
    Events.Room = PoolRoom;
    Events.Outside = PoolOutside;
    Events.Encounters = PoolEncounters;
    Events.Setpieces = PoolSetpieces;
    Events.Executioner = PoolExecutioner;

    Events.eventStack = [];
    Events.scheduleNextEvent();

    Dispatch('stateUpdate').subscribe(Events.handleStateUpdates);

    // 检查存档里挂起的延迟动作
    Events.initDelay();
  },

  /* -------------------------- 事件栈 / 基本操作 -------------------------- */

  activeEvent() {
    if (Events.eventStack && Events.eventStack.length > 0) {
      return Events.eventStack[0];
    }
    return null;
  },

  startEvent(event, opts) {
    if (!event) return;
    if (event.audio) AudioEngine.playEventMusic(event.audio);
    Engine.event('game event', 'event');
    Engine.keyLock = true;
    Engine.tabNavigation = false;
    Events.eventStack.unshift(event);
    event._snap = null;
    // 新事件开始：清空上一场的战斗/浮字状态
    Events._floats = [];
    Events.fought = false;
    Events.won = false;
    if (opts != null && opts.width != null) event._width = opts.width;
    Events.loadScene('start');
  },

  /** 事件栈切换（nextEvent：从 Setpieces/Executioner 跳到另一场事件） */
  switchEvent(nextEvent) {
    if (!nextEvent) return;
    const prev = Events.eventStack.shift();
    if (prev && prev._onEnd) prev._onEnd();
    Events.startEvent(nextEvent);
  },

  endEvent() {
    Events._autoAttackClearAll();
    Events.clearTimeouts();
    // 事件结束：恢复被压低的主背景音乐
    AudioEngine.stopEventMusic();
    const ev = Events.eventStack.shift();
    if (ev && ev._onEnd) ev._onEnd();
    Events.activeScene = null;
    if (Events.BLINK_INTERVAL) Events.stopTitleBlink();
    Engine.keyLock = false;
    Engine.tabNavigation = true;
    if (Events.eventStack.length === 0) {
      useEvents.setState({ current: null, snap: null });
    } else {
      Events._sync();
    }
    // 战斗中死亡等场景需要聚焦回主界面
    if (typeof document !== 'undefined') document.body.focus();
  },

  _push(snap) {
    useEvents.setState({ current: Events.activeEvent(), snap });
  },

  /* ------------------------------ 场景加载 ------------------------------ */

  loadScene(name) {
    Engine.log('loading scene: ' + name);
    const event = Events.activeEvent();
    if (!event) return;
    event.activeScene = name;
    Events.activeScene = name;
    const scene = event.scenes[name];

    if (!scene) return;

    // 场景级音频覆盖事件级音频
    if (scene.audio) AudioEngine.playEventMusic(scene.audio);

    // onLoad
    if (scene.onLoad) scene.onLoad();

    // Notify
    if (scene.notification) {
      Notifications.notify(null, scene.notification);
    }

    // Scene reward
    if (scene.reward) {
      $SM.addM('stores', scene.reward);
    }

    // blink 标题
    if (scene.blink) Events.blinkTitle();
    else if (Events.BLINK_INTERVAL) Events.stopTitleBlink();

    if (scene.combat) {
      Events.startCombat(scene);
    } else {
      Events.startStory(scene);
    }
  },

  /* ------------------------------ 故事场景 ------------------------------ */

  startStory(_scene) {
    Events._sync();
  },

  /* ------------------------------ 战斗场景 ------------------------------ */

  startCombat(scene) {
    Engine.event('game event', 'combat');
    Events.fought = false;
    Events.won = false;
    Events._enemyAttackStarted = false;
    Events._meditateDmg = 0;

    const World = requireModule('world');
    const maxHp = World.getMaxHealth();

    // 玩家战士（镜像 World.health）
    Events._playerFighter = {
      hp: World.health,
      maxHp: maxHp,
      status: 'none',
      stunned: false,
      chara: '@',
      name: '@',
    };
    // 敌方战士
    Events._enemyFighter = {
      hp: scene.health,
      maxHp: scene.health,
      status: 'none',
      stunned: false,
      chara: scene.chara,
      name: scene.enemyName || scene.enemy,
      sprite: scene.enemy ? Pixel.fighterSprite(scene.enemy) : null,
    };

    Events.setupCombatTimersOrSpecial(scene);
    Events._sync();
  },

  /** 特殊定时效果（处刑者等敌人的定时 specials） */
  setupCombatTimersOrSpecial(scene) {
    Events._specialTimers = (scene.specials || []).map((s) =>
      Engine.setInterval(() => {
        const enemy = Events._enemyFighter;
        const text = s.action(enemy);
        Events._sync();
        if (text) Events._float('enemy', _(text));
      }, s.delay * 1000),
    );
  },

  /** 敌人在玩家首次攻击后开始定期反击 */
  startEnemyAttacks(delay) {
    Events._clearEnemyAttackTimer();
    const scene = Events._curScene();
    Events._enemyAttackTimer = Engine.setInterval(
      Events.enemyAttack,
      (delay == null ? scene.attackDelay : delay) * 1000,
    );
  },

  _curScene() {
    const event = Events.activeEvent();
    if (!event || !event.scenes) return {};
    return event.scenes[Events.activeScene] || event.scenes[event.activeScene] || {};
  },

  enemyAttack() {
    const scene = Events._curScene();
    const enemy = Events._enemyFighter;
    const player = Events._playerFighter;
    if (!enemy || !player || Events.won || player.hp <= 0) return;

    const stunned = enemy.stunned;
    const meditating = enemy.status === 'meditation';
    if (stunned || meditating) return;

    let toHit = scene.hit != null ? scene.hit : 0.8;
    if ($SM.hasPerk('evasive')) toHit *= 0.8;
    let dmg = -1;
    if (Events._meditateDmg > 0) {
      dmg = Events._meditateDmg;
      Events._meditateDmg = 0;
    } else if (Math.random() <= toHit) {
      dmg = scene.damage;
    }

    // 敌人攻击动画（远程用弹道，近战用突进）
    Events._setAnim('enemy', scene.ranged ? 'ranged' : 'melee');
    Events._applyAttack(enemy, player, dmg, scene);
  },

  /** 攻击结算：attacker 打 target */
  _applyAttack(attacker, target, dmg, scene) {
    this._damage(attacker, target, dmg);

    // 非数值伤害（stun）不触发 atHealth/击杀
    if (typeof dmg === 'number') {
      const atHealth = (scene && scene.atHealth) || {};
      const explosion = scene && scene.explosion;
      for (const k of Object.keys(atHealth)) {
        const hpThreshold = Number(k);
        const before = target.hp;
        // 跨过血量阈值时触发
        if (before <= hpThreshold && before + dmg > hpThreshold) {
          const txt = atHealth[k](target);
          if (txt) Events._float(target === Events._enemyFighter ? 'enemy' : 'player', _(txt));
        }
      }
      if (target === Events._enemyFighter && target.hp <= 0 && !Events.won) {
        Events.won = true;
        if (explosion) {
          Events.explode(explosion);
        } else {
          Events.winFight();
        }
      }
      // 玩家被击中致死
      if (target === Events._playerFighter && target.hp <= 0) {
        Events.checkPlayerDeath();
      }
    }
    Events._sync();
  },

  /**
   * 伤害结算。返回可显示的文本。
   * 注意 shielded/meditating/venomous 等状态处理与旧版一致。
   */
  _damage(attacker, target, dmg) {
    const maxHp = target.maxHp;
    const shielded = target.status === 'shield';
    const energised = attacker.status === 'energised';
    const venomous = attacker.status === 'venomous';
    const meditating = target.status === 'meditation';
    let msg = '';

    if (typeof dmg === 'number') {
      if (dmg < 0) {
        msg = _('miss');
        dmg = 0;
      } else {
        if (energised) dmg *= Events.ENERGISE_MULTIPLIER;

        if (meditating) {
          Events._meditateDmg += dmg;
          msg = String(dmg);
        } else {
          msg = (shielded ? '+' : '-') + dmg;
          target.hp = Math.min(maxHp, Math.max(0, target.hp + (shielded ? dmg : -dmg)));
          if (target === Events._playerFighter) {
            const World = requireModule('world');
            World.setHp(target.hp);
          }
        }

        if (venomous && !shielded) {
          Events._startDot(target, Math.floor(dmg / 2));
        }

        if (shielded) {
          target.status = 'none';
          if (target.status === 'none') {
            /* shield 一击即破 */
          }
        }
      }
    } else {
      if (dmg === 'stun') {
        msg = _('stunned');
        target.stunned = true;
        setTimeout(() => {
          target.stunned = false;
        }, Events.STUN_DURATION);
      }
    }

    if ((energised || venomous) && typeof dmg === 'number') {
      // 增益只作用于一次攻击
      attacker.status = 'none';
    }

    Events._float(target === Events._enemyFighter ? 'enemy' : 'player', msg || String(dmg));
    return msg;
  },

  _dotTimer: null,
  _startDot(target, dmg) {
    Events._clearDot();
    Events._dotTimer = setInterval(() => {
      Events.dotDamage(target, dmg);
    }, Events.DOT_TICK);
  },
  _clearDot() {
    if (Events._dotTimer) {
      clearInterval(Events._dotTimer);
      Events._dotTimer = null;
    }
  },

  dotDamage(target, dmg) {
    const hp = Math.max(0, target.hp - dmg);
    target.hp = hp;
    if (target === Events._playerFighter) {
      const World = requireModule('world');
      World.setHp(hp);
      Events._float('player', '-' + dmg);
      Events._sync();
      Events.checkPlayerDeath();
    } else if (hp <= 0 && !Events.won) {
      Events.won = true;
      Events._float('enemy', '-' + dmg);
      Events.winFight();
    }
    Events._sync();
  },

  /** 设置状态（数据模块 setStatus 直接操作普通战士对象） */
  setStatus(fighter, status) {
    if (!fighter) return;
    fighter.status = status || 'none';
    if (status === 'enraged' && fighter === Events._enemyFighter) {
      Events.startEnemyAttacks(0.5);
      setTimeout(() => {
        fighter.status = 'none';
        Events.startEnemyAttacks();
      }, Events.ENRAGE_DURATION);
    }
    if (status === 'meditation') {
      Events._meditateDmg = 0;
      setTimeout(() => {
        fighter.status = 'none';
      }, Events.MEDITATE_DURATION);
    }
    if (status === 'boost') {
      setTimeout(() => {
        fighter.status = 'none';
      }, Events.BOOST_DURATION);
    }
    Events._sync();
  },

  /* ---------------------------- 治疗 / 增益 ---------------------------- */

  canHealNow() {
    const World = requireModule('world');
    return World.health < World.getMaxHealth();
  },

  healButtons() {
    const Path = requireModule('path');
    const list = [];
    list.push({
      id: 'eat',
      text: _('eat meat'),
      cooldown: Events._EAT_COOLDOWN,
      cost: { 'cured meat': 1 },
      icon: 'res_curedmeat',
      disabled: (Path.outfit && Path.outfit['cured meat'] || 0) <= 0,
    });
    if ((Path.outfit && Path.outfit['medicine'] || 0) !== 0) {
      list.push({
        id: 'meds',
        text: _('use meds'),
        cooldown: Events._MEDS_COOLDOWN,
        cost: { medicine: 1 },
        icon: 'res_medicine',
        disabled: (Path.outfit && Path.outfit['medicine'] || 0) <= 0,
      });
    }
    if ((Path.outfit && Path.outfit['hypo'] || 0) > 0) {
      list.push({
        id: 'hypo',
        text: _('use hypo'),
        cooldown: Events._HYPO_COOLDOWN,
        cost: { hypo: 1 },
        icon: 'res_hypo',
        disabled: (Path.outfit && Path.outfit['hypo'] || 0) <= 0,
      });
    }
    if ((Path.outfit && Path.outfit['stim'] || 0) > 0) {
      list.push({
        id: 'use-stim',
        text: _('boost'),
        cooldown: Events._STIM_COOLDOWN,
        icon: 'res_stim',
        disabled: (Path.outfit && Path.outfit['stim'] || 0) <= 0,
      });
    }
    if ($SM.get('stores["kinetic armour"]', true) > 0) {
      list.push({
        id: 'shld',
        text: _('shield'),
        cooldown: Events._SHIELD_COOLDOWN,
        icon: 'upgrade_kinetic_armour',
      });
    }
    return list;
  },

  attackButtons() {
    const World = requireModule('world');
    const Path = requireModule('path');
    // 攻击按钮排序：其余类型（拳击）优先，其次近战、远程
    const meleeKeys = [];
    const rangedKeys = [];
    const otherKeys = [];
    for (const k of Object.keys(World.Weapons)) {
      const w = World.Weapons[k];
      if (typeof w.damage !== 'number' || w.damage === 0) continue; // 无伤害武器
      if (w.type === 'melee') meleeKeys.push(k);
      else if (w.type === 'ranged') rangedKeys.push(k);
      else otherKeys.push(k);
    }
    const ordered = otherKeys.concat(meleeKeys, rangedKeys);

    const list = [];
    let usable = false;
    for (const k of ordered) {
      const w = World.Weapons[k];
      if (typeof Path.outfit[k] === 'number' && Path.outfit[k] > 0) {
        // 检查弹药/消耗成本
        let canUse = true;
        if (w.cost) {
          for (const c of Object.keys(w.cost)) {
            if (typeof Path.outfit[c] !== 'number' || Path.outfit[c] < w.cost[c]) {
              canUse = false;
              break;
            }
          }
        }
        usable = true;
        let cd = w.cooldown;
        // 武术大师：拳击冷却减半（对应旧版 createAttackButton）
        if (k === 'fists' && $SM.hasPerk('unarmed master')) cd /= 2;
        list.push({
          id: 'attack_' + k.replace(/ /g, '-'),
          weapon: k,
          text: w.verb,
          icon: Pixel.resourceSprite(k) || null,
          cooldown: cd,
          cost: w.cost,
          disabled: !canUse,
        });
      }
    }
    // 无可用武器 → 赤手空拳
    if (!usable) {
      list.push({
        id: 'attack_fists',
        weapon: 'fists',
        text: World.Weapons.fists.verb,
        cooldown: World.Weapons.fists.cooldown,
        cost: undefined,
        disabled: false,
      });
    }
    return list;
  },

  /* ------------------------------ 玩家行动 ------------------------------ */

  playerAttack(weaponName) {
    if (!Events.activeEvent()) return;
    const World = requireModule('world');
    const Path = requireModule('path');
    const weapon = World.Weapons[weaponName];
    const enemy = Events._enemyFighter;
    if (!enemy || enemy.hp <= 0 || Events.won) return;

    // 记录拳击次数/天赋
    if (weapon.type === 'unarmed') {
      if (!$SM.get('character.punches')) $SM.set('character.punches', 0);
      $SM.add('character.punches', 1);
      const punches = $SM.get('character.punches');
      if (punches === 50 && !$SM.hasPerk('boxer')) $SM.addPerk('boxer');
      else if (punches === 150 && !$SM.hasPerk('martial artist')) $SM.addPerk('martial artist');
      else if (punches === 300 && !$SM.hasPerk('unarmed master')) $SM.addPerk('unarmed master');
    }

    // 消耗成本
    if (weapon.cost) {
      const mod = {};
      for (const k of Object.keys(weapon.cost)) {
        if (typeof Path.outfit[k] !== 'number' || Path.outfit[k] < weapon.cost[k]) {
          return false; // 资源不足 → 取消冷却
        }
        mod[k] = -weapon.cost[k];
      }
      for (const m of Object.keys(mod)) {
        Path.outfit[m] += mod[m];
      }
      World.updateSupplies();
    }

    // 记录武器冷却 → 驱动按钮 loading（近战/拳击自动连击与手动点击共用同一状态）
    $SM.set('cooldown.attack_' + weaponName.replace(/ /g, '-'), weapon.cooldown, true);
    commit();

    // 伤害计算
    let dmg = -1;
    if (Math.random() <= World.getHitChance()) {
      dmg = weapon.damage;
      if (typeof dmg === 'number') {
        if (weapon.type === 'unarmed' && $SM.hasPerk('boxer')) dmg *= 2;
        if (weapon.type === 'unarmed' && $SM.hasPerk('martial artist')) dmg *= 3;
        if (weapon.type === 'unarmed' && $SM.hasPerk('unarmed master')) dmg *= 2;
        if (weapon.type === 'melee' && $SM.hasPerk('barbarian')) dmg = Math.floor(dmg * 1.5);
      }
    }

    // 武器音效（赤手/近战/远程）
    const wType = weapon.type === 'unarmed' ? 'UNARMED' : weapon.type === 'melee' ? 'MELEE' : weapon.type === 'ranged' ? 'RANGED' : null;
    if (wType) AudioEngine.playSound(AudioLibrary['WEAPON_' + wType + '_' + (Math.floor(Math.random() * 3) + 1)]);

    // 处理击退等动画与结算（近战/拳击 80ms 突进，远程 260ms 等弹道飞抵后再结算）
    const animType = weapon.type === 'ranged' ? 'ranged' : 'melee';
    const hitDelay = weapon.type === 'ranged' ? 260 : 80;
    Events._setAnim('player', animType);
    setTimeout(() => {
      const scene = Events._curScene();
      Events._applyAttack(Events._playerFighter, enemy, dmg, scene);
    }, hitDelay);

    // 首次攻击后敌人开始反击
    if (!Events._enemyAttackStarted) {
      Events._enemyAttackStarted = true;
      Events.startEnemyAttacks();
    }

    // 近战/拳击自动连击
    if (weapon.type === 'melee' || weapon.type === 'unarmed') {
      Events._autoAttack(weaponName, weapon.cooldown * 1000);
    }
  },

  playerHeal(kind) {
    const World = requireModule('world');
    const Path = requireModule('path');
    let healing, cured;
    switch (kind) {
      case 'eat': healing = 'cured meat'; cured = World.meatHeal(); break;
      case 'meds': healing = 'medicine'; cured = World.medsHeal(); break;
      case 'hypo': healing = 'hypo'; cured = World.hypoHeal(); break;
      case 'shld':
        if (Events._playerFighter) {
          Events._playerFighter.status = 'shield';
          Events._sync();
        }
        return;
      case 'use-stim':
        if (Events._playerFighter) {
          Events._playerFighter.status = 'boost';
          Events.dotDamage(Events._playerFighter, Events.BOOST_DAMAGE);
          Events._sync();
        }
        return;
      default: return;
    }
    if (Path.outfit[healing] > 0) {
      Path.outfit[healing]--;
      World.updateSupplies();
      if (kind === 'eat') AudioEngine.playSound(AudioLibrary.EAT_MEAT);
      else if (kind === 'meds') AudioEngine.playSound(AudioLibrary.USE_MEDS);
      let hp = World.health + cured;
      hp = Math.min(World.getMaxHealth(), hp);
      World.setHp(hp);
      if (Events._playerFighter) {
        Events._playerFighter.hp = hp;
        Events._float('player', '+' + cured);
      }
      Events._sync();
    } else {
      return false; // 资源不足，取消冷却
    }
  },

  /* ------------------------- 自动连击（近战/拳击） ------------------------- */

  _autoAttack(weaponName, delay) {
    const k = 'atk_' + weaponName.replace(/ /g, '-');
    if (Events._autoAttackBtns.indexOf(k) < 0) Events._autoAttackBtns.push(k);
    Events._autoTimers = Events._autoTimers || {};
    clearTimeout(Events._autoTimers[k]);
    Events._autoTimers[k] = Engine.setTimeout(() => {
      Events.autoAttack(weaponName);
    }, delay);
  },

  autoAttack(weaponName) {
    const enemy = Events._enemyFighter;
    const World = requireModule('world');
    const Path = requireModule('path');
    const k = 'atk_' + weaponName.replace(/ /g, '-');
    // 战斗结束
    if (!Events.activeEvent() || Events.won || !enemy || enemy.hp <= 0) {
      Events._autoAttackStop(k);
      return;
    }
    const weapon = World.Weapons[weaponName];
    // 弹药不足
    if (weapon.cost) {
      for (const c of Object.keys(weapon.cost)) {
        if (typeof Path.outfit[c] !== 'number' || Path.outfit[c] < weapon.cost[c]) {
          Events._autoAttackStop(k);
          return;
        }
      }
    }
    // 玩家死亡
    if (!Events._playerFighter || Events._playerFighter.hp <= 0) {
      Events._autoAttackStop(k);
      return;
    }
    // 冷却检测：等待按钮冷却结束
    const cd = $SM.get('cooldown.attack_' + weaponName.replace(/ /g, '-'), true);
    if (cd > 0) {
      Events._autoTimers = Events._autoTimers || {};
      Events._autoTimers[k] = Engine.setTimeout(() => Events.autoAttack(weaponName), 120);
      return;
    }
    Events.playerAttack(weaponName);
    const cdMs = weapon.cooldown * 1000;
    Events._autoTimers = Events._autoTimers || {};
    Events._autoTimers[k] = Engine.setTimeout(() => Events.autoAttack(weaponName), cdMs);
  },

  _autoAttackStop(k) {
    Events._autoTimers = Events._autoTimers || {};
    clearTimeout(Events._autoTimers[k]);
    const i = Events._autoAttackBtns.indexOf(k);
    if (i >= 0) Events._autoAttackBtns.splice(i, 1);
  },

  _autoAttackClearAll() {
    Events._autoTimers = Events._autoTimers || {};
    for (const k of Events._autoAttackBtns) {
      clearTimeout(Events._autoTimers[k]);
    }
    Events._autoAttackBtns = [];
  },

  /* ------------------------------ 战斗收尾 ------------------------------ */

  explode(dmg) {
    Events.clearTimeouts();
    const enemy = Events._enemyFighter;
    const player = Events._playerFighter;
    if (!enemy || !player) return;
    enemy.status = 'exploding';
    Events._sync();
    setTimeout(() => {
      enemy.status = 'none';
      // 爆炸伤害（无法格挡），dotDamage 内部处理玩家死亡
      Events.dotDamage(player, dmg);
      if (player.hp > 0) {
        Events.winFight();
      }
    }, Events.EXPLOSION_DURATION);
  },

  checkPlayerDeath() {
    const player = Events._playerFighter;
    if (player && player.hp <= 0) {
      Events._autoAttackClearAll();
      Events.clearTimeouts();
      Events.endEvent();
      const World = requireModule('world');
      World.die();
      return true;
    }
    return false;
  },

  clearTimeouts() {
    Events._clearEnemyAttackTimer();
    if (Events._specialTimers) {
      Events._specialTimers.forEach(clearInterval);
      Events._specialTimers = [];
    }
    Events._clearDot();
    if (Events._enrageTimer) {
      clearTimeout(Events._enrageTimer);
      Events._enrageTimer = null;
    }
  },

  _clearEnemyAttackTimer() {
    if (Events._enemyAttackTimer) {
      clearInterval(Events._enemyAttackTimer);
      Events._enemyAttackTimer = null;
    }
  },

  endFight() {
    Events.fought = true;
    Events.clearTimeouts();
    Events._autoAttackClearAll();
  },

  winFight() {
    // 击杀后停留约 1.5s（观看攻击特效/死亡动画）再切到捡东西界面，避免突兀
    Engine.setTimeout(() => {
      if (Events.fought) return;
      Events.endFight();
      Events._autoAttackClearAll();
      Events._sync();
    }, 1500);
  },

  // 供 modal 判断胜利后展示哪种收尾
  winResultReady() {
    return Events.won && Events.fought && Events.activeEvent() != null;
  },

  /* ------------------------------ 战利品 ------------------------------ */

  /** 生成战利品行（每场战斗/场景首次进入时调用一次） */
  rollLoot(lootList) {
    const rows = [];
    if (!lootList) return rows;
    for (const k of Object.keys(lootList)) {
      const loot = lootList[k];
      if (Math.random() < loot.chance) {
        const num = Math.floor(Math.random() * (loot.max - loot.min)) + loot.min;
        rows.push({ key: k, name: _(k), numLeft: num, total: num });
      }
    }
    return rows;
  },

  takeLoot(key, howMany) {
    const event = Events.activeEvent();
    if (!event) return;
    const Path = requireModule('path');
    const World = requireModule('world');
    let row = (event._lootRows || []).find((r) => r.key === key);
    if (!row) return;
    const weight = Path.getWeight(key);
    let free = Path.getFreeSpace();

    let canFit = weight <= free;
    if (!canFit) {
      // 需要先丢弃装备腾出空间：记录目标并弹出丢弃菜单
      event._dropFor = { key, weight };
      Events.dropForRoom();
      Events._sync();
      return;
    }
    const num = Math.min(howMany, row.numLeft);
    for (let i = 0; i < num; i++) {
      if (weight > Path.getFreeSpace()) break;
      row.numLeft--;
      Path.outfit[key] = (Path.outfit[key] || 0) + 1;
      World.adjustOutpostSupply(key, -1);
    }
    World.updateSupplies();
    if (event._lootRows) {
      event._lootRows = event._lootRows.filter((r) => r.numLeft > 0);
    }
    Events._sync();
  },

  dropForRoom() {
    const event = Events.activeEvent();
    if (!event || !event._dropFor) return;
    const Path = requireModule('path');
    const need = event._dropFor;
    const rows = [];
    const weightNeeded = Math.max(0, need.weight - Path.getFreeSpace());
    for (const k of Object.keys(Path.outfit || {})) {
      if (k === need.key) continue;
      const itemWeight = Path.getWeight(k);
      if (itemWeight <= 0) continue;
      const numToDrop = Math.min(Path.outfit[k], Math.ceil(weightNeeded / itemWeight));
      if (numToDrop > 0) {
        rows.push({ key: k, name: _(k), num: numToDrop, weight: itemWeight });
      }
    }
    event._dropMenu = rows;
    Events._sync();
  },

  dropStuff(key, num) {
    const event = Events.activeEvent();
    if (!event) return;
    const Path = requireModule('path');
    const World = requireModule('world');
    Path.outfit[key] -= num;
    if (Path.outfit[key] < 0) Path.outfit[key] = 0;
    World.adjustOutpostSupply(key, num);
    World.updateSupplies();
    event._dropMenu = null;
    // 丢出空间后自动把先前放不下的物品拿下
    Events.takeLoot(event._dropFor.key, 1);
    event._dropFor = null;
    Events._sync();
  },

  /** 剩余可拿数量（供 modal 的 take-all 计算） */
  lootCanTake(key) {
    const event = Events.activeEvent();
    const Path = requireModule('path');
    const row = event && event._lootRows ? event._lootRows.find((r) => r.key === key) : null;
    if (!row) return 0;
    return Math.min(Math.floor(Path.getFreeSpace() / Path.getWeight(key)), row.numLeft);
  },

  takeAllLoot() {
    const event = Events.activeEvent();
    if (!event) return;
    const rows = (event._lootRows || []).slice();
    for (const r of rows) {
      const can = Events.lootCanTake(r.key);
      if (can > 0) Events.takeLoot(r.key, can);
    }
    Events._sync();
  },

  leaveFightOrScene() {
    const scene = Events._curScene();
    if (scene.nextScene && scene.nextScene !== 'end') {
      Events.loadScene(scene.nextScene);
    } else {
      Events.endEvent();
    }
  },

  /* ------------------------------ 标题闪烁 ------------------------------ */

  blinkTitle() {
    if (Events.BLINK_INTERVAL) return;
    const title = document.title;
    Events.BLINK_INTERVAL = setInterval(() => {
      document.title = _('*** EVENT ***');
      Engine.setTimeout(() => {
        document.title = title;
      }, 1500, true);
    }, 3000);
  },

  stopTitleBlink() {
    if (Events.BLINK_INTERVAL) {
      clearInterval(Events.BLINK_INTERVAL);
      Events.BLINK_INTERVAL = false;
    }
  },

  /* --------------------------- 按钮通用逻辑 --------------------------- */

  /** 场景按钮点击（通用：成本/奖励/跳转） */
  buttonClick(id) {
    const scene = Events._curScene();
    const info = scene.buttons && scene.buttons[id];
    if (!info) return;

    // 成本
    const cost = Events._resolveCost(info);
    if (cost) {
      const costMod = {};
      for (const store of Object.keys(cost)) {
        const num = Events.getQuantity(store);
        if (num < cost[store]) {
          return false; // 太贵 → 取消冷却
        }
        if (store === 'water') {
          const World = requireModule('world');
          World.setWater(World.water - cost[store]);
        } else if (store === 'hp') {
          const World = requireModule('world');
          World.setHp(World.health - cost[store]);
        } else {
          costMod[store] = -cost[store];
        }
      }
      if (Engine.activeModuleId === 'world') {
        const Path = requireModule('path');
        for (const k of Object.keys(costMod)) Path.outfit[k] += costMod[k];
        const World = requireModule('world');
        World.updateSupplies();
      } else {
        $SM.addM('stores', costMod);
      }
    }

    // onChoose（可选参数：textarea 文本）
    if (typeof info.onChoose === 'function') {
      const ev = Events.activeEvent();
      info.onChoose(ev && ev._textareaValue != null ? ev._textareaValue : null);
    }

    // Reward
    if (info.reward) {
      $SM.addM('stores', info.reward);
    }

    Events._sync();

    // Notification
    if (info.notification) {
      Notifications.notify(null, info.notification);
    }

    if (info.onClick) info.onClick();

    // Link
    if (info.link) {
      Events.endEvent();
      window.open(info.link);
      return;
    }

    // nextEvent（Setpieces / Executioner）
    if (info.nextEvent) {
      const eventData = (Events.Setpieces && Events.Setpieces[info.nextEvent]) ||
        (Events.Executioner && Events.Executioner[info.nextEvent]);
      Events.switchEvent(eventData);
      return;
    }

    // nextScene
    if (info.nextScene) {
      if (info.nextScene === 'end') {
        Events.endEvent();
      } else {
        Events.chooseNextScene(info.nextScene);
      }
    }
  },

  /** 概率 nextScene：{1:'x'} 取首个满足 random<i 的最低阈值 */
  chooseNextScene(nextScene) {
    if (typeof nextScene === 'string') {
      if (nextScene === 'end') Events.endEvent();
      else Events.loadScene(nextScene);
      return;
    }
    const r = Math.random();
    let lowestMatch = null;
    for (const i of Object.keys(nextScene)) {
      if (r < Number(i) && (lowestMatch === null || Number(i) < Number(lowestMatch))) {
        lowestMatch = i;
      }
    }
    if (lowestMatch !== null) {
      Events.loadScene(nextScene[lowestMatch]);
      return;
    }
    Engine.log('ERROR: no suitable scene found');
    Events.endEvent();
  },

  _resolveCost(info) {
    if (!info.cost) return null;
    const cost = { ...info.cost };
    const Path = requireModule('path');
    if (Path && Path.outfit && Path.outfit['glowstone']) {
      delete cost.torch;
    }
    return cost;
  },

  /** 按钮可用性/价格判断（返回 {disabled, cost}） */
  buttonState(info) {
    if (typeof info.available === 'function' && !info.available()) {
      return { disabled: true, cost: null };
    }
    const cost = Events._resolveCost(info);
    if (cost) {
      let disabled = false;
      for (const store of Object.keys(cost)) {
        const num = Events.getQuantity(store);
        if (num < cost[store]) {
          disabled = true;
          break;
        }
      }
      return { disabled, cost };
    }
    return { disabled: false, cost: null };
  },

  /** 资源数量查询：water/hp 走 World，world 模块里走出装，否则走库存 */
  getQuantity(store) {
    const World = requireModule('world');
    const Path = requireModule('path');
    if (store === 'water') return World.water;
    if (store === 'hp') return World.health;
    let num;
    if (Engine.activeModuleId === 'world') {
      num = Path.outfit ? Path.outfit[store] : undefined;
    } else {
      num = $SM.get('stores["' + store + '"]', true);
    }
    return isNaN(num) || num < 0 ? 0 : num;
  },

  /* --------------------------- 场景切换/结束辅助 --------------------------- */

  setTextarea(value) {
    const ev = Events.activeEvent();
    if (ev) {
      ev._textareaValue = value;
      Events._sync();
    }
  },

  /* --------------------------- 随机事件调度 --------------------------- */

  scheduleNextEvent(scale) {
    const span = Events._EVENT_TIME_RANGE[1] - Events._EVENT_TIME_RANGE[0];
    let nextEvent = Math.floor(Math.random() * span) + Events._EVENT_TIME_RANGE[0];
    if (scale > 0) nextEvent *= scale;
    Engine.log('next event scheduled in ' + nextEvent + ' minutes');
    Events._eventTimeout = Engine.setTimeout(Events.triggerEvent, nextEvent * 60 * 1000);
  },

  triggerEvent() {
    if (Events.activeEvent() === null) {
      const possibleEvents = [];
      const pool = Events.EventPool || [];
      for (const event of pool) {
        if (typeof event.isAvailable === 'function' && event.isAvailable()) {
          possibleEvents.push(event);
        }
      }
      if (possibleEvents.length === 0) {
        Events.scheduleNextEvent(0.5);
        return;
      }
      const r = Math.floor(Math.random() * possibleEvents.length);
      Events.startEvent(possibleEvents[r]);
    }
    Events.scheduleNextEvent();
  },

  /** 世界探索遭遇战 */
  triggerFight() {
    const possibleFights = [];
    const pool = Events.Encounters || [];
    for (const fight of pool) {
      if (typeof fight.isAvailable === 'function' && fight.isAvailable()) {
        possibleFights.push(fight);
      }
    }
    if (possibleFights.length === 0) return;
    const r = Math.floor(Math.random() * possibleFights.length);
    Events.startEvent(possibleFights[r]);
  },

  /* --------------------------- 延迟状态调度 --------------------------- */

  initDelay() {
    if ($SM.get(Events.delayState)) {
      Events.recallDelay(Events.delayState, Events);
    }
  },

  recallDelay(stateName, target) {
    const state = $SM.get(stateName);
    if (!state) return;
    for (const i of Object.keys(state)) {
      if (typeof state[i] === 'object') {
        Events.recallDelay(stateName + '["' + i + '"]', target && target[i]);
      } else if (typeof state[i] === 'number') {
        // 挂起的延迟动作已过期，直接清理
        $SM.remove(stateName + '["' + i + '"]');
      }
    }
  },

  saveDelay(action, stateName, delay) {
    const state = Events.delayState + '.' + stateName;
    if (delay) {
      $SM.set(state, delay);
    } else {
      delay = $SM.get(state, true);
    }
    const time = Engine.setInterval(() => {
      $SM.set(state, Math.max(0, $SM.get(state, true) - 0.5), true);
    }, 500);
    Engine.setTimeout(() => {
      window.clearInterval(time);
      $SM.remove(state);
      $SM.remove(Events.delayState);
      action();
    }, delay * 1000);
  },

  /* --------------------------- 状态更新钩子 --------------------------- */

  handleStateUpdates(e) {
    if ((e.category === 'stores' || e.category === 'income' || e.category === 'outfit') && Events.activeEvent() !== null) {
      // 事件打开时重算按钮可用性 → 刷新快照
      Events._sync();
    }
  },

  /* --------------------------- 展示快照（供 Modal） --------------------------- */

  /** 当前场景是否需要展示战斗视图 */
  _isCombatScene() {
    const scene = Events._curScene();
    return !!(scene && scene.combat);
  },

  _float(side, text) {
    if (!text) return;
    Events._floats = Events._floats || [];
    Events._floats.push({ id: ++_seq, side, text, ts: Date.now() });
    if (Events._floats.length > 8) Events._floats.shift();
  },

  /** 记录一次攻击动画（近战突进/远程弹道），id 唯一，供 EventModal 触发 CSS 动画 */
  _setAnim(side, type) {
    Events._anim = { id: ++_seq, side, type };
    Events._sync();
  },

  /** 汇总当前可渲染状态 */
  _sync() {
    const event = Events.activeEvent();
    if (!event) {
      return;
    }
    const scene = Events._curScene();
    const isFight = !!(scene && scene.combat);
    const battleOver = Events.won && Events.fought;
    // 爆炸型敌人：won=true 但尚未结算（fought=false），仍停留在战斗视图看特效
    const showFightView = isFight && !battleOver && !!Events._enemyFighter;

    // 过期浮字（1.5s）清理
    const now = Date.now();
    Events._floats = (Events._floats || []).filter((f) => now - f.ts < 1500);

    const snap = {
      title: event.title,
      mode: showFightView ? 'fight' : isFight ? 'result' : 'story',
      lines: [],
      buttons: [],
      attackButtons: [],
      healButtons: [],
      loot: null,
      dropMenu: null,
      player: null,
      enemy: null,
      floats: (Events._floats || []).slice(),
      anim: Events._anim || null,
      textarea: null,
    };

    if (showFightView) {
      // 战斗视图：首行是场景 notification（与旧版一致显示在描述区）
      if (scene.notification) snap.lines.push(_(scene.notification));
      else if (scene.text) snap.lines = snap.lines.concat(Events._textToLines(scene.text));

      const player = Events._playerFighter;
      const enemy = Events._enemyFighter;
      snap.player = player ? {
        chara: player.chara, hp: player.hp, maxHp: player.maxHp,
        status: player.status, sprite: null,
      } : null;
      snap.enemy = enemy ? {
        chara: enemy.chara, hp: enemy.hp, maxHp: enemy.maxHp,
        status: enemy.status, sprite: enemy.sprite, name: enemy.name,
      } : null;

      // 已判定胜利（爆炸倒计时等）后不再显示攻击按钮
      if (!Events.won) {
        snap.attackButtons = Events.attackButtons();
        const canHeal = Events.canHealNow();
        snap.healButtons = Events.healButtons().map((b) => ({
          ...b,
          // 满血时除护盾/兴奋剂外一律禁用（对应旧版 setHeal）
          disabled: b.id !== 'shld' && b.id !== 'use-stim' ? b.disabled || !canHeal : b.disabled,
        }));
      }
    } else if (isFight) {
      // 胜利结算：deathMessage + 战利品 + 退出按钮
      if (scene.deathMessage) snap.lines.push(_(scene.deathMessage));
      else if (scene.text) snap.lines = snap.lines.concat(Events._textToLines(scene.text));
      Events._ensureLoot(event, scene);
      snap.loot = Events._lootToSnap(event);
      snap.buttons = Events._exitButtons(scene);
    } else {
      // 故事场景
      if (scene.text) snap.lines = snap.lines.concat(Events._textToLines(scene.text));
      if (scene.textarea !== undefined) {
        snap.textarea = {
          value: event._textareaValue != null ? event._textareaValue : (typeof scene.textarea === 'string' ? scene.textarea : ''),
          readonly: !!scene.readonly,
        };
      }
      Events._ensureLoot(event, scene);
      snap.loot = Events._lootToSnap(event);
      snap.buttons = Events._exitButtons(scene);
    }

    // 丢弃菜单（战利品放不下时弹出）：story/result 通用
    if (event._dropMenu && event._dropMenu.length > 0) {
      snap.dropMenu = event._dropMenu;
    }

    useEvents.setState({ current: event, snap });
  },

  /** 首次进入场景时生成战利品行（战斗胜利/故事场景共用） */
  _ensureLoot(event, scene) {
    if (!event._lootRows && scene.loot) {
      event._lootRows = Events.rollLoot(scene.loot);
    }
  },

  /** 战利品快照：{ rows:[{key,name,numLeft,total,canTake}], canTakeAll } */
  _lootToSnap(event) {
    const rows = (event._lootRows || []).filter((r) => r.numLeft > 0);
    if (rows.length === 0) return null;
    return {
      rows: rows.map((r) => ({
        key: r.key,
        name: r.name,
        numLeft: r.numLeft,
        total: r.total,
        canTake: Events.lootCanTake(r.key),
      })),
      canTakeAll: rows.some((r) => Events.lootCanTake(r.key) > 0),
    };
  },

  _textToLines(text) {
    if (Array.isArray(text)) return text.slice();
    return [text];
  },

  /** 场景退出按钮（故事/胜利结算通用），若无可提供默认 leave */
  _exitButtons(scene) {
    const btns = [];
    if (scene.buttons) {
      for (const id of Object.keys(scene.buttons)) {
        const info = scene.buttons[id];
        const state = Events.buttonState(info);
        btns.push({
          id,
          text: info.text,
          disabled: state.disabled,
          cost: state.cost,
          cooldown: typeof info.cooldown === 'number' ? info.cooldown : 0,
        });
      }
    } else {
      // 默认离开按钮（含 1s 冷却）；Modal 点击时走 leaveFightOrScene
      btns.push({
        id: 'leaveBtn',
        text: _('leave'),
        disabled: false,
        cost: null,
        cooldown: Events._LEAVE_COOLDOWN,
        kind: 'default-leave',
      });
    }
    return btns;
  },

  /* ----- 供 modal 调用的动作（按钮 onClick 闭包在这里，不进快照） ----- */

  actions: {
    clickStory(id) {
      return Events.buttonClick(id);
    },
    attack(weaponName) {
      // 设置 $SM 冷却由按钮层（GameButton）管理；逻辑失败返回 false 取消冷却
      const World = requireModule('world');
      const weapon = World.Weapons[weaponName];
      const Path = requireModule('path');
      // 弹药不足时直接禁用返回（避免扣冷却）
      if (weapon.cost) {
        for (const c of Object.keys(weapon.cost)) {
          if (typeof Path.outfit[c] !== 'number' || Path.outfit[c] < weapon.cost[c]) {
            return false;
          }
        }
      }
      Events.playerAttack(weaponName);
    },
    heal(id) {
      return Events.playerHeal(id);
    },
    takeLoot(key, num) {
      Events.takeLoot(key, num);
    },
    takeAllLoot() {
      Events.takeAllLoot();
    },
    leave() {
      Events.leaveFightOrScene();
    },
    end() {
      Events.endEvent();
    },
    dropMenu() {
      Events.dropForRoom();
    },
    dropStuff(key, num) {
      Events.dropStuff(key, num);
    },
    cancelDrop() {
      const ev = Events.activeEvent();
      if (ev) {
        ev._dropMenu = null;
        ev._dropFor = null;
        Events._sync();
      }
    },
  },
};

export default Events;
