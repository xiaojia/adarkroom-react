/**
 * Path 模块（逻辑层）
 * -------------------
 * 移植自旧版 script/path.js。只包含游戏规则与状态变更，不操作任何 DOM。
 * UI 展示由 components/panels/PathPanel.jsx 负责（从状态派生渲染）。
 *
 * 依赖：Room（装备/库存）、World（地图/承载量）、Fabricator（造物台制造物）。
 * 通过 requireModule 获取，由 main.jsx 启动时注入。
 */
import { _ } from '../i18n';
import { $SM, Dispatch } from '../store/stateManager';
import { Engine } from '../engine/Engine';
import { Notifications } from '../engine/notifications';
import { requireModule } from '../engine/moduleLoader';

export const Path = {
  DEFAULT_BAG_SPACE: 10,
  _STORES_OFFSET: 5,
  // 不在列表中的物品均重 1
  Weight: {
    'bone spear': 2,
    'iron sword': 3,
    'steel sword': 5,
    'rifle': 5,
    'bullets': 0.1,
    'energy cell': 0.2,
    'laser rifle': 5,
    'plasma rifle': 5,
    'bolas': 0.5,
  },

  name: _('Path'),
  options: {},

  /** 供面板查询的当前出装快照（从 $SM 派生，与旧版 PATH.outfit 保持同步） */
  outfit: {},

  init(options) {
    Path.options = { ...Path.options, ...options };
    const World = requireModule('world');
    World.init();

    Path.outfit = $SM.get('outfit');
    Dispatch('stateUpdate').subscribe(Path.handleStateUpdates);
  },

  openPath() {
    Path.init();
    Engine.event('progress', 'path');
    const World = requireModule('world');
    Notifications.notify(RoomRef(), _('the compass points ' + World.dir));
  },

  getWeight(thing) {
    let w = Path.Weight[thing];
    if (typeof w !== 'number') w = 1;
    return w;
  },

  getCapacity() {
    const Room = requireModule('room');
    if (Room.isEquipped('cargo drone')) {
      return Path.DEFAULT_BAG_SPACE + 100;
    } else if (Room.isEquipped('convoy')) {
      return Path.DEFAULT_BAG_SPACE + 60;
    } else if (Room.isEquipped('wagon')) {
      return Path.DEFAULT_BAG_SPACE + 30;
    } else if (Room.isEquipped('rucksack')) {
      return Path.DEFAULT_BAG_SPACE + 10;
    }
    return Path.DEFAULT_BAG_SPACE;
  },

  getFreeSpace() {
    let num = 0;
    if (Path.outfit) {
      for (const k in Path.outfit) {
        let n = Path.outfit[k];
        if (isNaN(n)) Path.outfit[k] = n = 0;
        num += n * Path.getWeight(k);
      }
    }
    return Path.getCapacity() - num;
  },

  /** 返回携带物清单：橱窗里所有可携带物品 + 其名称/类型 */
  getCarryable() {
    const Room = requireModule('room');
    const Fabricator = requireModule('fabricator');
    const carryable = {
      'cured meat': { name: _('cured meat'), type: 'tool' },
      'bullets': { name: _('bullets'), type: 'tool' },
      'grenade': { name: _('grenade'), type: 'weapon' },
      'bolas': { name: _('bolas'), type: 'weapon' },
      'laser rifle': { name: _('laser rifle'), type: 'weapon' },
      'energy cell': { name: _('energy cell'), type: 'tool' },
      'bayonet': { name: _('bayonet'), type: 'weapon' },
      'charm': { name: _('charm'), type: 'tool' },
      'alien alloy': { name: _('alien alloy'), type: 'tool' },
      'medicine': { name: _('medicine'), type: 'tool' },
    };
    for (const k in (Room && Room.Craftables) || {}) {
      carryable[k] = { name: Room.Craftables[k].name, type: Room.Craftables[k].type };
    }
    for (const k in (Fabricator && Fabricator.Craftables) || {}) {
      carryable[k] = { name: Fabricator.Craftables[k].name, type: Fabricator.Craftables[k].type };
    }
    return carryable;
  },

  /** 供 React 渲染的完整出装状态 */
  getOutfitState() {
    const Room = requireModule('room');
    const World = requireModule('world');
    if (!Path.outfit) Path.outfit = {};

    const carryable = Path.getCarryable();
    const capacity = Path.getCapacity();
    const space = Path.getFreeSpace();

    // 护甲行（反映真正装备的护甲，而非拥有）
    let armour = _('none');
    if ($SM.get('stores["kinetic armour"]', true) > 0 && Room.isEquipped('kinetic armour')) armour = _('kinetic armour');
    else if ($SM.get('stores["s armour"]', true) > 0 && Room.isEquipped('s armour')) armour = _('steel');
    else if ($SM.get('stores["i armour"]', true) > 0 && Room.isEquipped('i armour')) armour = _('iron');
    else if ($SM.get('stores["l armour"]', true) > 0 && Room.isEquipped('l armour')) armour = _('leather');

    const rows = [];
    let total = 0;
    for (const k in carryable) {
      const store = carryable[k];
      const have = $SM.get('stores["' + k + '"]', true);
      let num = Path.outfit[k];
      num = typeof num === 'number' ? num : 0;
      if (have < num) num = have;
      const numAvailable = $SM.get('stores["' + k + '"]', true);
      if ((store.type === 'tool' || store.type === 'weapon') && have > 0) {
        total += num * Path.getWeight(k);
        rows.push({
          key: k,
          name: store.name,
          num,
          numAvailable,
          weight: Path.getWeight(k),
          canUp: !(num >= numAvailable || space < Path.getWeight(k)) && have > 0,
          canUpMany: !(num >= numAvailable || space < Path.getWeight(k) * 10),
          canDn: num > 0,
          canDnMany: num > 0,
        });
      }
    }
    rows.sort((a, b) => (a.key < b.key ? -1 : 1));

    // 装备切换行
    const equipRows = [];
    for (const ek of Room.EquippableItems) {
      if ($SM.get('stores["' + ek + '"]', true) > 0 && Room.isEquippableBestInGroup(ek)) {
        equipRows.push({
          key: ek,
          name: _(ek),
          equipped: Room.isEquipped(ek),
        });
      }
    }

    return {
      armour,
      maxWater: World.getMaxWater(),
      capacity,
      free: Math.floor(space),
      bagSpace: Math.floor(capacity - total),
      rows,
      equipRows,
      canEmbark: (Path.outfit['cured meat'] || 0) > 0,
    };
  },

  increaseSupply(key, amt) {
    if (!Path.outfit) Path.outfit = {};
    let cur = Path.outfit[key];
    cur = typeof cur === 'number' ? cur : 0;
    if (Path.getFreeSpace() >= Path.getWeight(key) && cur < $SM.get('stores["' + key + '"]', true)) {
      const maxExtraByWeight = Math.floor(Path.getFreeSpace() / Path.getWeight(key));
      const maxExtraByStore = $SM.get('stores["' + key + '"]', true) - cur;
      const maxExtraByBtn = amt;
      Path.outfit[key] = cur + Math.min(maxExtraByBtn, Math.min(maxExtraByWeight, maxExtraByStore));
      $SM.set('outfit[' + key + ']', Path.outfit[key]);
    }
  },

  decreaseSupply(key, amt) {
    if (!Path.outfit) Path.outfit = {};
    let cur = Path.outfit[key];
    cur = typeof cur === 'number' ? cur : 0;
    if (cur > 0) {
      Path.outfit[key] = Math.max(0, cur - amt);
      $SM.set('outfit[' + key + ']', Path.outfit[key]);
    }
  },

  toggleEquip(thing) {
    const Room = requireModule('room');
    if (Room.isEquipped(thing)) {
      Room.unequip(thing);
      Notifications.notify(RoomRef(), _('{0} {1}', _(thing), _('unequipped')));
    } else {
      Room.equip(thing);
      Notifications.notify(RoomRef(), _('{0} {1}', _(thing), _('equipped')));
    }
  },

  onArrival() {
    Path.setTitle();
    $SM.set('outfit', Path.outfit);
  },

  setTitle() {
    document.title = _('A Dusty Path');
  },

  getTitle() {
    return _('A Dusty Path');
  },

  embark() {
    const World = requireModule('world');
    // 把携带的物品从基地库存中扣除（与旧版一致），Path.outfit 保留键值供旅途消耗
    for (const k in Path.outfit) {
      $SM.add('stores["' + k + '"]', -Path.outfit[k]);
    }
    $SM.remove('outfit');
    World.onArrival();
    Engine.travelTo('world');
  },

  handleStateUpdates(e) {
    if (e.category === 'character' && e.stateName.indexOf('character.perks') === 0) {
      // React 端由面板派生渲染，无需手动更新
    }
  },
};

// 通知 target：旧版传 Room 模块对象，React 版规范化为 id 字符串
function RoomRef() {
  return 'room';
}

export default Path;
