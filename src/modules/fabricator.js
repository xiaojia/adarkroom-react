/**
 * Fabricator 模块（逻辑层）
 * -------------------------
 * 移植自旧版 script/fabricator.js。只包含游戏规则与状态变更，不操作任何 DOM。
 * UI 展示由 components/panels/FabricatorPanel.jsx 负责（从状态派生渲染）。
 *
 * 依赖：Room（装备/商店）、Ship（在发现飞船后被解锁）。
 * 通过 requireModule 获取。
 */
import { _ } from '../i18n';
import { $SM, Dispatch } from '../store/stateManager';
import { Notifications } from '../engine/notifications';
import { requireModule } from '../engine/moduleLoader';

export const Fabricator = {
  name: _('Fabricator'),

  Craftables: {
    'energy blade': {
      name: _('energy blade'),
      type: 'weapon',
      buildMsg: _('the blade hums, charged particles sparking and fizzing.'),
      cost: () => ({ 'alien alloy': 1 }),
    },
    'fluid recycler': {
      name: _('fluid recycler'),
      type: 'upgrade',
      maximum: 1,
      buildMsg: _('water out, water in. waste not, want not.'),
      cost: () => ({ 'alien alloy': 2 }),
    },
    'cargo drone': {
      name: _('cargo drone'),
      type: 'upgrade',
      maximum: 1,
      buildMsg: _('the workhorse of the wanderer fleet.'),
      cost: () => ({ 'alien alloy': 2 }),
    },
    'kinetic armour': {
      name: _('kinetic armour'),
      type: 'upgrade',
      maximum: 1,
      blueprintRequired: true,
      buildMsg: _("wanderer soldiers succeed by subverting the enemy's rage."),
      cost: () => ({ 'alien alloy': 2 }),
    },
    disruptor: {
      name: _('disruptor'),
      type: 'weapon',
      blueprintRequired: true,
      buildMsg: _("somtimes it is best not to fight."),
      cost: () => ({ 'alien alloy': 1 }),
    },
    hypo: {
      name: _('hypo'),
      type: 'tool',
      blueprintRequired: true,
      buildMsg: _('a handful of hypos. life in a vial.'),
      cost: () => ({ 'alien alloy': 1 }),
      quantity: 5,
    },
    stim: {
      name: _('stim'),
      type: 'tool',
      blueprintRequired: true,
      buildMsg: _('sometimes it is best to fight without restraint.'),
      cost: () => ({ 'alien alloy': 1 }),
    },
    'plasma rifle': {
      name: _('plasma rifle'),
      type: 'weapon',
      blueprintRequired: true,
      buildMsg: _('the peak of wanderer weapons technology, sleek and deadly.'),
      cost: () => ({ 'alien alloy': 1 }),
    },
    glowstone: {
      name: _('glow stone'),
      type: 'tool',
      blueprintRequired: true,
      buildMsg: _('a smooth, perfect sphere. its light is inextinguishable.'),
      cost: () => ({ 'alien alloy': 1 }),
    },
  },

  init() {
    if (!$SM.get('features.location.fabricator')) {
      $SM.set('features.location.fabricator', true);
    }
    Dispatch('stateUpdate').subscribe(Fabricator.handleStateUpdates);
  },

  onArrival() {
    if (!$SM.get('game.fabricator.seen')) {
      Notifications.notify(Fabricator, _('the familiar hum of wanderer machinery coming to life. finally, real tools.'));
      $SM.set('game.fabricator.seen', true);
    }
  },

  getTitle() {
    return _('A Whirring Fabricator');
  },

  canFabricate(itemKey) {
    return !Fabricator.Craftables[itemKey].blueprintRequired ||
      $SM.get('character.blueprints["' + itemKey + '"]');
  },

  fabricate(thing) {
    const craftable = Fabricator.Craftables[thing];
    if (!craftable) return false;

    const numThings = $SM.get('stores["' + thing + '"]', true);
    if (craftable.maximum <= numThings) {
      return false;
    }

    const cost = craftable.cost();
    for (const key in cost) {
      const have = $SM.get('stores["' + key + '"]', true);
      if (have < cost[key]) {
        Notifications.notify(Fabricator, _('not enough ' + key));
        return false;
      }
    }
    const storeMod = {};
    for (const key in cost) {
      storeMod[key] = $SM.get('stores["' + key + '"]', true) - cost[key];
    }
    $SM.setM('stores', storeMod);
    $SM.add('stores["' + thing + '"]', craftable.quantity ?? 1);

    // 与 Room.build 一致：可携带的升级件自动装备
    const Room = requireModule('room');
    if (craftable.type === 'upgrade' && Room && Room.isEquippable(thing)) {
      Room.equip(thing);
    }

    Notifications.notify(Fabricator, craftable.buildMsg);
    return true;
  },

  /** 返回可见的造物按钮（供 React 渲染）：[{key, def, maxed, cost}] */
  getFabricateButtons() {
    const out = [];
    for (const key in Fabricator.Craftables) {
      const c = Fabricator.Craftables[key];
      if (!Fabricator.canFabricate(key)) continue;
      const maxed = $SM.num(key, c) + 1 > c.maximum;
      out.push({ key, def: c, maxed, cost: c.cost() });
    }
    return out;
  },

  /** 返回已获得的蓝图 key 列表（供 React 渲染） */
  getBlueprints() {
    const bps = $SM.get('character.blueprints');
    if (!bps) return [];
    return Object.keys(bps).filter((k) => bps[k]);
  },

  handleStateUpdates() {},
};
