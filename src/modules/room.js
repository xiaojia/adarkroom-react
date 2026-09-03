/**
 * Room 模块（逻辑层）
 * -------------------
 * 移植自旧版 script/room.js。只包含游戏规则与状态变更，不操作任何 DOM。
 * UI 展示由 components/panels/RoomPanel.jsx 负责（从状态派生渲染）。
 */
import { _ } from '../i18n';
import { $SM } from '../store/stateManager';
import { Engine } from '../engine/Engine';
import { Notifications } from '../engine/notifications';
import { requireModule } from '../engine/moduleLoader';

export const Room = {
  // 时间常量
  _FIRE_COOL_DELAY: 5 * 60 * 1000,
  _ROOM_WARM_DELAY: 30 * 1000,
  _BUILDER_STATE_DELAY: 0.5 * 60 * 1000,
  _STOKE_COOLDOWN: 10,
  _NEED_WOOD_DELAY: 15 * 1000,

  // 按钮可见性缓存（与旧版一致：解锁后一直可见）
  buttons: {},

  EquippableItems: ['waterskin', 'cask', 'water tank', 'fluid recycler', 'rucksack', 'wagon', 'convoy', 'cargo drone', 'l armour', 'i armour', 's armour', 'kinetic armour'],

  EquippableGroups: [
    ['waterskin', 'cask', 'water tank', 'fluid recycler'],
    ['rucksack', 'wagon', 'convoy', 'cargo drone'],
    ['l armour', 'i armour', 's armour', 'kinetic armour'],
  ],

  isEquippable(thing) {
    return Room.EquippableItems.indexOf(thing) !== -1;
  },

  isEquippableBestInGroup(thing) {
    for (const group of Room.EquippableGroups) {
      const idx = group.indexOf(thing);
      if (idx === -1) continue;
      for (let h = idx + 1; h < group.length; h++) {
        if ($SM.get('stores["' + group[h] + '"]', true) > 0) return false;
      }
      return true;
    }
    return true;
  },

  isEquipped(thing) {
    return $SM.get('game.equipped["' + thing + '"]', true) > 0;
  },

  equip(thing) {
    if (Room.isEquippable(thing) && $SM.get('stores["' + thing + '"]', true) > 0) {
      $SM.set('game.equipped["' + thing + '"]', true);
    }
  },

  unequip(thing) {
    if (!Room.isEquippable(thing)) return;
    for (const group of Room.EquippableGroups) {
      if (group.indexOf(thing) !== -1) {
        for (const g of group) {
          $SM.set('game.equipped["' + g + '"]', false);
        }
        return;
      }
    }
    $SM.set('game.equipped["' + thing + '"]', false);
  },

  migrateEquip() {
    for (const thing of Room.EquippableItems) {
      if ($SM.get('stores["' + thing + '"]', true) > 0 &&
        typeof $SM.get('game.equipped["' + thing + '"]') === 'undefined') {
        $SM.set('game.equipped["' + thing + '"]', true);
      }
    }
  },

  Craftables: {
    trap: { name: _('trap'), maximum: 10, availableMsg: _('builder says she can make traps to catch any creatures might still be alive out there'), buildMsg: _('more traps to catch more creatures'), maxMsg: _("more traps won't help now"), type: 'building', cost() { const n = $SM.get('game.buildings["trap"]', true); return { wood: 10 + n * 10 }; } },
    cart: { name: _('cart'), maximum: 1, availableMsg: _('builder says she can make a cart for carrying wood'), buildMsg: _('the rickety cart will carry more wood from the forest'), type: 'building', cost() { return { wood: 30 }; } },
    hut: { name: _('hut'), maximum: 20, availableMsg: _("builder says there are more wanderers. says they'll work, too."), buildMsg: _('builder puts up a hut, out in the forest. says word will get around.'), maxMsg: _('no more room for huts.'), type: 'building', cost() { const n = $SM.get('game.buildings["hut"]', true); return { wood: 100 + n * 50 }; } },
    lodge: { name: _('lodge'), maximum: 1, availableMsg: _('villagers could help hunt, given the means'), buildMsg: _('the hunting lodge stands in the forest, a ways out of town'), type: 'building', cost() { return { wood: 200, fur: 10, meat: 5 }; } },
    'trading post': { name: _('trading post'), maximum: 1, availableMsg: _('a trading post would make commerce easier'), buildMsg: _("now the nomads have a place to set up shop, they might stick around a while"), type: 'building', cost() { return { wood: 400, fur: 100 }; } },
    tannery: { name: _('tannery'), maximum: 1, availableMsg: _("builder says leather could be useful. says the villagers could make it."), buildMsg: _('tannery goes up quick, on the edge of the village'), type: 'building', cost() { return { wood: 500, fur: 50 }; } },
    smokehouse: { name: _('smokehouse'), maximum: 1, availableMsg: _("should cure the meat, or it'll spoil. builder says she can fix something up."), buildMsg: _('builder finishes the smokehouse. she looks hungry.'), type: 'building', cost() { return { wood: 600, meat: 50 }; } },
    workshop: { name: _('workshop'), maximum: 1, availableMsg: _("builder says she could make finer things, if she had the tools"), buildMsg: _("workshop's finally ready. builder's excited to get to it"), type: 'building', cost() { return { wood: 800, leather: 100, scales: 10 }; } },
    steelworks: { name: _('steelworks'), maximum: 1, availableMsg: _("builder says the villagers could make steel, given the tools"), buildMsg: _('a haze falls over the village as the steelworks fires up'), type: 'building', cost() { return { wood: 1500, iron: 100, coal: 100 }; } },
    armoury: { name: _('armoury'), maximum: 1, availableMsg: _("builder says it'd be useful to have a steady source of bullets"), buildMsg: _("armoury's done, welcoming back the weapons of the past."), type: 'building', cost() { return { wood: 3000, steel: 100, sulphur: 50 }; } },
    torch: { name: _('torch'), type: 'tool', buildMsg: _('a torch to keep the dark away'), cost() { return { wood: 1, cloth: 1 }; } },
    waterskin: { name: _('waterskin'), type: 'upgrade', maximum: 1, buildMsg: _("this waterskin'll hold a bit of water, at least"), cost() { return { leather: 50 }; } },
    cask: { name: _('cask'), type: 'upgrade', maximum: 1, buildMsg: _('the cask holds enough water for longer expeditions'), cost() { return { leather: 100, iron: 20 }; } },
    'water tank': { name: _('water tank'), type: 'upgrade', maximum: 1, buildMsg: _('never go thirsty again'), cost() { return { iron: 100, steel: 50 }; } },
    'bone spear': { name: _('bone spear'), type: 'weapon', buildMsg: _("this spear's not elegant, but it's pretty good at stabbing"), cost() { return { wood: 100, teeth: 5 }; } },
    rucksack: { name: _('rucksack'), type: 'upgrade', maximum: 1, buildMsg: _('carrying more means longer expeditions to the wilds'), cost() { return { leather: 200 }; } },
    wagon: { name: _('wagon'), type: 'upgrade', maximum: 1, buildMsg: _('the wagon can carry a lot of supplies'), cost() { return { wood: 500, iron: 100 }; } },
    convoy: { name: _('convoy'), type: 'upgrade', maximum: 1, buildMsg: _('the convoy can haul mostly everything'), cost() { return { wood: 1000, iron: 200, steel: 100 }; } },
    'l armour': { name: _('l armour'), type: 'upgrade', maximum: 1, buildMsg: _("leather's not strong. better than rags, though."), cost() { return { leather: 200, scales: 20 }; } },
    'i armour': { name: _('i armour'), type: 'upgrade', maximum: 1, buildMsg: _("iron's stronger than leather"), cost() { return { leather: 200, iron: 100 }; } },
    's armour': { name: _('s armour'), type: 'upgrade', maximum: 1, buildMsg: _("steel's stronger than iron"), cost() { return { leather: 200, steel: 100 }; } },
    'iron sword': { name: _('iron sword'), type: 'weapon', buildMsg: _('sword is sharp. good protection out in the wilds.'), cost() { return { wood: 200, leather: 50, iron: 20 }; } },
    'steel sword': { name: _('steel sword'), type: 'weapon', buildMsg: _('the steel is strong, and the blade true.'), cost() { return { wood: 500, leather: 100, steel: 20 }; } },
    rifle: { name: _('rifle'), type: 'weapon', buildMsg: _('black powder and bullets, like the old days.'), cost() { return { wood: 200, steel: 50, sulphur: 50 }; } },
  },

  TradeGoods: {
    scales: { type: 'good', cost() { return { fur: 150 }; } },
    teeth: { type: 'good', cost() { return { fur: 300 }; } },
    iron: { type: 'good', cost() { return { fur: 150, scales: 50 }; } },
    coal: { type: 'good', cost() { return { fur: 200, teeth: 50 }; } },
    steel: { type: 'good', cost() { return { fur: 300, scales: 50, teeth: 50 }; } },
    medicine: { type: 'good', cost() { return { scales: 50, teeth: 30 }; } },
    bullets: { type: 'good', cost() { return { scales: 10 }; } },
    'energy cell': { type: 'good', cost() { return { scales: 10, teeth: 10 }; } },
    bolas: { type: 'weapon', cost() { return { teeth: 10 }; } },
    grenade: { type: 'weapon', cost() { return { scales: 100, teeth: 50 }; } },
    bayonet: { type: 'weapon', cost() { return { scales: 500, teeth: 250 }; } },
    'alien alloy': { type: 'good', cost() { return { fur: 1500, scales: 750, teeth: 300 }; } },
    compass: { type: 'upgrade', maximum: 1, cost() { return { fur: 400, scales: 20, teeth: 10 }; } },
  },

  MiscItems: {
    'laser rifle': { type: 'weapon' },
  },

  name: _('Room'),

  TempEnum: {
    fromInt(value) {
      for (const k in this) {
        if (typeof this[k].value !== 'undefined' && this[k].value === value) return this[k];
      }
      return null;
    },
    Freezing: { value: 0, text: _('freezing') },
    Cold: { value: 1, text: _('cold') },
    Mild: { value: 2, text: _('mild') },
    Warm: { value: 3, text: _('warm') },
    Hot: { value: 4, text: _('hot') },
  },

  FireEnum: {
    fromInt(value) {
      for (const k in this) {
        if (typeof this[k].value !== 'undefined' && this[k].value === value) return this[k];
      }
      return null;
    },
    Dead: { value: 0, text: _('dead') },
    Smoldering: { value: 1, text: _('smoldering') },
    Flickering: { value: 2, text: _('flickering') },
    Burning: { value: 3, text: _('burning') },
    Roaring: { value: 4, text: _('roaring') },
  },

  changed: false,
  _fireTimer: null,
  _tempTimer: null,
  _builderTimer: null,

  init(options) {
    if (Engine.options.debug) {
      Room._ROOM_WARM_DELAY = 5000;
      Room._BUILDER_STATE_DELAY = 5000;
      Room._STOKE_COOLDOWN = 0;
      Room._NEED_WOOD_DELAY = 5000;
    }

    if (typeof $SM.get('features.location.room') === 'undefined') {
      $SM.set('features.location.room', true);
      $SM.set('game.builder.level', -1);
    }

    // 温度/火势初始化（兼容旧存档）
    $SM.set('game.temperature', $SM.get('game.temperature.value') === undefined ? Room.TempEnum.Freezing : $SM.get('game.temperature'));
    $SM.set('game.fire', $SM.get('game.fire.value') === undefined ? Room.FireEnum.Dead : $SM.get('game.fire'));

    Room.migrateEquip();

    // 定时器
    clearTimeout(Room._fireTimer);
    clearTimeout(Room._tempTimer);
    Room._fireTimer = Engine.setTimeout(Room.coolFire, Room._FIRE_COOL_DELAY);
    Room._tempTimer = Engine.setTimeout(Room.adjustTemp, Room._ROOM_WARM_DELAY);

    if ($SM.get('game.builder.level') >= 0 && $SM.get('game.builder.level') < 3) {
      Room._builderTimer = Engine.setTimeout(Room.updateBuilderState, Room._BUILDER_STATE_DELAY);
    }
    if ($SM.get('game.builder.level') === 1 && $SM.get('stores.wood', true) < 0) {
      Engine.setTimeout(Room.unlockForest, Room._NEED_WOOD_DELAY);
    }

    Notifications.notify(Room, _('the room is {0}', Room.TempEnum.fromInt($SM.get('game.temperature.value')).text));
    Notifications.notify(Room, _('the fire is {0}', Room.FireEnum.fromInt($SM.get('game.fire.value')).text));
  },

  onArrival() {
    Room.setTitle();
    if (Room.changed) {
      Notifications.notify(Room, _('the fire is {0}', Room.FireEnum.fromInt($SM.get('game.fire.value')).text));
      Notifications.notify(Room, _('the room is {0}', Room.TempEnum.fromInt($SM.get('game.temperature.value')).text));
      Room.changed = false;
    }
    if ($SM.get('game.builder.level') === 3) {
      $SM.add('game.builder.level', 1);
      $SM.setIncome('builder', { delay: 10, stores: { wood: 2 } });
      Notifications.notify(Room, _('the stranger is standing by the fire. she says she can help. says she builds things.'));
    }
  },

  setTitle() {
    // React 端由 Header 组件根据状态派生标题
  },

  getTitle() {
    return $SM.get('game.fire.value') < 2 ? _('A Dark Room') : _('A Firelit Room');
  },

  lightFire() {
    const wood = $SM.get('stores.wood');
    if (wood < 5) {
      Notifications.notify(Room, _('not enough wood to get the fire going'));
      return false;
    }
    if (wood > 4) {
      $SM.set('stores.wood', wood - 5);
    }
    $SM.set('game.fire', Room.FireEnum.Burning);
    $SM.set('game.fireLit', true); // 首次点火标记：驱动 RoomScene 的黑遮罩渐隐 + dark1 开场
    Room.onFireChange();
  },

  stokeFire() {
    const wood = $SM.get('stores.wood');
    if (wood === 0) {
      Notifications.notify(Room, _('the wood has run out'));
      return false;
    }
    if (wood > 0) {
      $SM.set('stores.wood', wood - 1);
    }
    if ($SM.get('game.fire.value') < 4) {
      $SM.set('game.fire', Room.FireEnum.fromInt($SM.get('game.fire.value') + 1));
    }
    Room.onFireChange();
  },

  onFireChange() {
    if (Engine.activeModuleId !== 'room') {
      Room.changed = true;
    }
    Notifications.notify(Room, _('the fire is {0}', Room.FireEnum.fromInt($SM.get('game.fire.value')).text), true);
    // 首次火势达到最高（roaring=4）后，解锁「熄灯/开灯」按钮并持久化
    if ($SM.get('game.fire.value') >= Room.FireEnum.Roaring.value && !$SM.get('game.lightsOffUnlocked')) {
      $SM.set('game.lightsOffUnlocked', true);
    }
    if ($SM.get('game.fire.value') > 1 && $SM.get('game.builder.level') < 0) {
      $SM.set('game.builder.level', 0);
      Notifications.notify(Room, _('the light from the fire spills from the windows, out into the dark'));
      Engine.setTimeout(Room.updateBuilderState, Room._BUILDER_STATE_DELAY);
    }
    clearTimeout(Room._fireTimer);
    Room._fireTimer = Engine.setTimeout(Room.coolFire, Room._FIRE_COOL_DELAY);
    Room.setTitle();
  },

  coolFire() {
    const wood = $SM.get('stores.wood');
    if ($SM.get('game.fire.value') <= Room.FireEnum.Flickering.value &&
      $SM.get('game.builder.level') > 3 && wood > 0) {
      Notifications.notify(Room, _('builder stokes the fire'), true);
      $SM.set('stores.wood', wood - 1);
      $SM.set('game.fire', Room.FireEnum.fromInt($SM.get('game.fire.value') + 1));
    }
    if ($SM.get('game.fire.value') > 0) {
      $SM.set('game.fire', Room.FireEnum.fromInt($SM.get('game.fire.value') - 1));
      Room._fireTimer = Engine.setTimeout(Room.coolFire, Room._FIRE_COOL_DELAY);
      Room.onFireChange();
    }
  },

  adjustTemp() {
    const old = $SM.get('game.temperature.value');
    if ($SM.get('game.temperature.value') > 0 && $SM.get('game.temperature.value') > $SM.get('game.fire.value')) {
      $SM.set('game.temperature', Room.TempEnum.fromInt($SM.get('game.temperature.value') - 1));
      Notifications.notify(Room, _('the room is {0}', Room.TempEnum.fromInt($SM.get('game.temperature.value')).text), true);
    }
    if ($SM.get('game.temperature.value') < 4 && $SM.get('game.temperature.value') < $SM.get('game.fire.value')) {
      $SM.set('game.temperature', Room.TempEnum.fromInt($SM.get('game.temperature.value') + 1));
      Notifications.notify(Room, _('the room is {0}', Room.TempEnum.fromInt($SM.get('game.temperature.value')).text), true);
    }
    if ($SM.get('game.temperature.value') !== old) {
      Room.changed = true;
    }
    clearTimeout(Room._tempTimer);
    Room._tempTimer = Engine.setTimeout(Room.adjustTemp, Room._ROOM_WARM_DELAY);
  },

  unlockForest() {
    $SM.set('stores.wood', 4);
    const Outside = requireModule('outside');
    Outside.init();
    Notifications.notify(Room, _('the wind howls outside'));
    Notifications.notify(Room, _('the wood is running out'));
    Engine.event('progress', 'outside');
  },

  updateBuilderState() {
    let lBuilder = $SM.get('game.builder.level');
    if (lBuilder === 0) {
      Notifications.notify(Room, _('a ragged stranger stumbles through the door and collapses in the corner'));
      lBuilder = $SM.setget('game.builder.level', 1);
      Engine.setTimeout(Room.unlockForest, Room._NEED_WOOD_DELAY);
    } else if (lBuilder < 3 && $SM.get('game.temperature.value') >= Room.TempEnum.Warm.value) {
      let msg = '';
      switch (lBuilder) {
        case 1:
          msg = _('the stranger shivers, and mumbles quietly. her words are unintelligible.');
          break;
        case 2:
          msg = _('the stranger in the corner stops shivering. her breathing calms.');
          break;
      }
      Notifications.notify(Room, msg);
      if (lBuilder < 3) {
        lBuilder = $SM.setget('game.builder.level', lBuilder + 1);
      }
    }
    if (lBuilder < 3) {
      clearTimeout(Room._builderTimer);
      Room._builderTimer = Engine.setTimeout(Room.updateBuilderState, Room._BUILDER_STATE_DELAY);
    }
    Engine.saveGame();
  },

  /* ----------------------------- 建造 / 购买 ----------------------------- */

  buy(thing) {
    const good = Room.TradeGoods[thing];
    if (!good) return false;
    let numThings = $SM.get('stores["' + thing + '"]', true);
    if (numThings < 0) numThings = 0;
    if (good.maximum <= numThings) return false;

    const cost = good.cost();
    for (const k in cost) {
      const have = $SM.get('stores["' + k + '"]', true);
      if (have < cost[k]) {
        Notifications.notify(Room, _('not enough ' + k));
        return false;
      }
    }
    const storeMod = {};
    for (const k in cost) storeMod[k] = $SM.get('stores["' + k + '"]', true) - cost[k];
    $SM.setM('stores', storeMod);

    Notifications.notify(Room, good.buildMsg);
    $SM.add('stores["' + thing + '"]', 1);
    if (thing === 'compass') {
      requireModule('path').openPath();
    }
    return true;
  },

  build(thing) {
    if ($SM.get('game.temperature.value') <= Room.TempEnum.Cold.value) {
      Notifications.notify(Room, _('builder just shivers'));
      return false;
    }
    const craftable = Room.Craftables[thing];
    if (!craftable) return false;

    let numThings = 0;
    switch (craftable.type) {
      case 'good':
      case 'weapon':
      case 'tool':
      case 'upgrade':
        numThings = $SM.get('stores["' + thing + '"]', true);
        break;
      case 'building':
        numThings = $SM.get('game.buildings["' + thing + '"]', true);
        break;
    }
    if (numThings < 0) numThings = 0;
    if (craftable.maximum <= numThings) return false;

    const cost = craftable.cost();
    for (const k in cost) {
      const have = $SM.get('stores["' + k + '"]', true);
      if (have < cost[k]) {
        Notifications.notify(Room, _('not enough ' + k));
        return false;
      }
    }
    const storeMod = {};
    for (const k in cost) storeMod[k] = $SM.get('stores["' + k + '"]', true) - cost[k];
    $SM.setM('stores', storeMod);

    Notifications.notify(Room, craftable.buildMsg);

    switch (craftable.type) {
      case 'good':
      case 'weapon':
      case 'upgrade':
      case 'tool':
        $SM.add('stores["' + thing + '"]', 1);
        if (craftable.type === 'upgrade' && Room.isEquippable(thing)) {
          Room.equip(thing);
        }
        break;
      case 'building':
        $SM.add('game.buildings["' + thing + '"]', 1);
        break;
    }
    return true;
  },

  needsWorkshop(type) {
    return type === 'weapon' || type === 'upgrade' || type === 'tool';
  },

  craftUnlocked(thing) {
    if (Room.buttons[thing]) return true;
    if ($SM.get('game.builder.level') < 4) return false;
    const craftable = Room.Craftables[thing];
    if (Room.needsWorkshop(craftable.type) && $SM.get('game.buildings["workshop"]', true) === 0) return false;
    const cost = craftable.cost();

    if ($SM.get('game.buildings["' + thing + '"]') > 0) {
      Room.buttons[thing] = true;
      return true;
    }
    if ($SM.get('stores.wood', true) < cost['wood'] * 0.5) return false;
    for (const c in cost) {
      if (!$SM.get('stores["' + c + '"]')) return false;
    }
    Room.buttons[thing] = true;
    if (!$SM.get('game.buildings["' + thing + '"]')) {
      Notifications.notify(Room, craftable.availableMsg);
    }
    return true;
  },

  buyUnlocked(thing) {
    if (Room.buttons[thing]) return true;
    if ($SM.get('game.buildings["trading post"]', true) > 0) {
      if (thing === 'compass' || typeof $SM.get('stores["' + thing + '"]') !== 'undefined') {
        return true;
      }
    }
    return false;
  },

  /** 返回可见的建造按钮（供 React 渲染）：[{key, def, maxed}] */
  getBuildButtons() {
    const out = [];
    for (const k in Room.Craftables) {
      const c = Room.Craftables[k];
      if (Room.needsWorkshop(c.type)) continue; // workshop 类去 craft 区
      if (Room.craftUnlocked(k)) {
        const maxed = $SM.num(k, c) + 1 > c.maximum;
        out.push({ key: k, def: c, maxed, cost: c.cost() });
      }
    }
    return out;
  },

  getCraftButtons() {
    const out = [];
    if ($SM.get('game.buildings["workshop"]', true) <= 0) return out;
    for (const k in Room.Craftables) {
      const c = Room.Craftables[k];
      if (!Room.needsWorkshop(c.type)) continue;
      if (Room.craftUnlocked(k)) {
        const maxed = $SM.num(k, c) + 1 > c.maximum;
        out.push({ key: k, def: c, maxed, cost: c.cost() });
      }
    }
    return out;
  },

  getBuyButtons() {
    const out = [];
    if ($SM.get('game.buildings["trading post"]', true) <= 0) return out;
    for (const k in Room.TradeGoods) {
      const g = Room.TradeGoods[k];
      if (Room.buyUnlocked(k)) {
        const maxed = $SM.num(k, g) + 1 > g.maximum;
        out.push({ key: k, def: g, maxed, cost: g.cost() });
      }
    }
    return out;
  },
};

