/**
 * World 模块（逻辑层）
 * -------------------
 * 移植自旧版 script/world.js。只包含地图探索规则与状态变更，不操作任何 DOM。
 * UI 展示由 components/panels/WorldPanel.jsx 负责（从状态派生渲染）。
 *
 * 探索在临时状态 World.state 中进行（深拷贝 game.world），
 * 回到村庄（goHome）时才把变更提交回 $SM。
 *
 * 依赖：Path（出装/补给）、Room（装备）、Ship/Fabricator（发现即解锁）、Events（战斗/地标）。
 * 通过 requireModule 获取。
 */
import { _ } from '../i18n';
import { $SM, Dispatch } from '../store/stateManager';
import { Engine } from '../engine/Engine';
import { Notifications } from '../engine/notifications';
import { requireModule } from '../engine/moduleLoader';
import { Pixel } from './pixel';
import { suppliesRank } from '../engine/storeCategories';
import { AudioEngine } from '../engine/AudioEngine';
import { AudioLibrary } from '../engine/audioLibrary';

export const World = {
  RADIUS: 30,
  VILLAGE_POS: [30, 30],
  TILE: {
    VILLAGE: 'A',
    IRON_MINE: 'I',
    COAL_MINE: 'C',
    SULPHUR_MINE: 'S',
    FOREST: ';',
    FIELD: ',',
    BARRENS: '.',
    ROAD: '#',
    HOUSE: 'H',
    CAVE: 'V',
    TOWN: 'O',
    CITY: 'Y',
    OUTPOST: 'P',
    SHIP: 'W',
    BOREHOLE: 'B',
    BATTLEFIELD: 'F',
    SWAMP: 'M',
    CACHE: 'U',
    EXECUTIONER: 'X',
  },
  TILE_PROBS: {},
  LANDMARKS: {},
  STICKINESS: 0.5,
  LIGHT_RADIUS: 2,
  BASE_WATER: 10,
  MOVES_PER_FOOD: 2,
  MOVES_PER_WATER: 1,
  DEATH_COOLDOWN: 120,
  FIGHT_CHANCE: 0.2,
  BASE_HEALTH: 10,
  BASE_HIT_CHANCE: 0.8,
  MEAT_HEAL: 8,
  MEDS_HEAL: 20,
  HYPO_HEAL: 30,
  FIGHT_DELAY: 3,
  NORTH: [0, -1],
  SOUTH: [0, 1],
  WEST: [-1, 0],
  EAST: [1, 0],

  Weapons: {
    fists: { verb: _('punch'), type: 'unarmed', damage: 1, cooldown: 2 },
    'bone spear': { verb: _('stab'), type: 'melee', damage: 2, cooldown: 2 },
    'iron sword': { verb: _('swing'), type: 'melee', damage: 4, cooldown: 2 },
    'steel sword': { verb: _('slash'), type: 'melee', damage: 6, cooldown: 2 },
    bayonet: { verb: _('thrust'), type: 'melee', damage: 8, cooldown: 2 },
    rifle: { verb: _('shoot'), type: 'ranged', damage: 5, cooldown: 1, cost: { bullets: 1 } },
    'laser rifle': { verb: _('blast'), type: 'ranged', damage: 8, cooldown: 1, cost: { 'energy cell': 1 } },
    grenade: { verb: _('lob'), type: 'ranged', damage: 15, cooldown: 5, cost: { grenade: 1 } },
    bolas: { verb: _('tangle'), type: 'ranged', damage: 'stun', cooldown: 15, cost: { bolas: 1 } },
    'plasma rifle': { verb: _('disintegrate'), type: 'ranged', damage: 12, cooldown: 1, cost: { 'energy cell': 1 } },
    'energy blade': { verb: _('slice'), type: 'melee', damage: 10, cooldown: 2 },
    disruptor: { verb: _('stun'), type: 'ranged', damage: 'stun', cooldown: 15 },
  },

  name: _('World'),
  options: {},

  // 探索期临时状态
  state: null,
  curPos: null,
  water: 0,
  health: 0,
  foodMove: 0,
  waterMove: 0,
  fightMove: 0,
  starvation: false,
  thirst: false,
  danger: false,
  dead: false,
  dir: 'north',
  outpostSupplies: {},

  init(options) {
    World.options = { ...World.options, ...options };

    // 地形概率（和为 1）
    World.TILE_PROBS[World.TILE.FOREST] = 0.15;
    World.TILE_PROBS[World.TILE.FIELD] = 0.35;
    World.TILE_PROBS[World.TILE.BARRENS] = 0.5;

    // 地标定义
    World.LANDMARKS[World.TILE.OUTPOST] = { num: 0, minRadius: 0, maxRadius: 0, scene: 'outpost', label: _('An\u00a0Outpost') };
    World.LANDMARKS[World.TILE.IRON_MINE] = { num: 1, minRadius: 5, maxRadius: 5, scene: 'ironmine', label: _('Iron\u00a0Mine') };
    World.LANDMARKS[World.TILE.COAL_MINE] = { num: 1, minRadius: 10, maxRadius: 10, scene: 'coalmine', label: _('Coal\u00a0Mine') };
    World.LANDMARKS[World.TILE.SULPHUR_MINE] = { num: 1, minRadius: 20, maxRadius: 20, scene: 'sulphurmine', label: _('Sulphur\u00a0Mine') };
    World.LANDMARKS[World.TILE.HOUSE] = { num: 10, minRadius: 0, maxRadius: World.RADIUS * 1.5, scene: 'house', label: _('An\u00a0Old\u00a0House') };
    World.LANDMARKS[World.TILE.CAVE] = { num: 5, minRadius: 3, maxRadius: 10, scene: 'cave', label: _('A\u00a0Damp\u00a0Cave') };
    World.LANDMARKS[World.TILE.TOWN] = { num: 10, minRadius: 10, maxRadius: 20, scene: 'town', label: _('An\u00a0Abandoned\u00a0Town') };
    World.LANDMARKS[World.TILE.CITY] = { num: 20, minRadius: 20, maxRadius: World.RADIUS * 1.5, scene: 'city', label: _('A\u00a0Ruined\u00a0City') };
    World.LANDMARKS[World.TILE.SHIP] = { num: 1, minRadius: 28, maxRadius: 28, scene: 'ship', label: _('A\u00a0Crashed\u00a0Starship') };
    World.LANDMARKS[World.TILE.BOREHOLE] = { num: 10, minRadius: 15, maxRadius: World.RADIUS * 1.5, scene: 'borehole', label: _('A\u00a0Borehole') };
    World.LANDMARKS[World.TILE.BATTLEFIELD] = { num: 5, minRadius: 18, maxRadius: World.RADIUS * 1.5, scene: 'battlefield', label: _('A\u00a0Battlefield') };
    World.LANDMARKS[World.TILE.SWAMP] = { num: 1, minRadius: 15, maxRadius: World.RADIUS * 1.5, scene: 'swamp', label: _('A\u00a0Murky\u00a0Swamp') };
    World.LANDMARKS[World.TILE.EXECUTIONER] = { num: 1, minRadius: 28, maxRadius: 28, scene: 'executioner', label: _('A\u00a0Ravaged\u00a0Battleship') };

    if ($SM.get('previous.stores')) {
      World.LANDMARKS[World.TILE.CACHE] = { num: 1, minRadius: 10, maxRadius: World.RADIUS * 1.5, scene: 'cache', label: _('A\u00a0Destroyed\u00a0Village') };
    }

    if (typeof $SM.get('features.location.world') === 'undefined') {
      $SM.set('features.location.world', true);
      $SM.set('features.executioner', true);
      const map = World.generateMap();
      const mask = World.newMask();
      $SM.setM('game.world', { map, mask });
    } else if (!$SM.get('features.executioner')) {
      let map = $SM.get('game.world.map');
      const landmark = World.LANDMARKS[World.TILE.EXECUTIONER];
      for (let l = 0; l < landmark.num; l++) {
        World.placeLandmark(landmark.minRadius, landmark.maxRadius, World.TILE.EXECUTIONER, map);
      }
      $SM.set('game.world.map', map);
      $SM.set('features.executioner', true);
    }

    Dispatch('stateUpdate').subscribe(World.handleStateUpdates);
  },

  clearDungeon() {
    Engine.event('progress', 'dungeon cleared');
    World.state.map[World.curPos[0]][World.curPos[1]] = World.TILE.OUTPOST;
    World.drawRoad();
  },

  markVisited(x, y) {
    if (World.state && World.state.map && World.state.map[x]) {
      World.state.map[x][y] = World.state.map[x][y] + '!';
      $SM.fireUpdate('world');
    }
  },

  /** 出装/补给变更后刷新界面（事件/战斗消耗后调用） */
  updateSupplies() {
    $SM.fireUpdate('world');
    $SM.fireUpdate('outfit');
  },

  drawRoad() {
    const findClosestRoad = (startPos) => {
      let searchX, searchY;
      let x = 0, y = 0;
      let dx = 1, dy = -1;
      const maxI = Math.pow(World.getDistance(startPos, World.VILLAGE_POS) + 2, 2);
      for (let i = 0; i < maxI; i++) {
        searchX = startPos[0] + x;
        searchY = startPos[1] + y;
        if (0 < searchX && searchX < World.RADIUS * 2 && 0 < searchY && searchY < World.RADIUS * 2) {
          const tile = World.state.map[searchX][searchY];
          if (tile === World.TILE.ROAD ||
            (tile === World.TILE.OUTPOST && !(x === 0 && y === 0)) ||
            tile === World.TILE.VILLAGE) {
            return [searchX, searchY];
          }
        }
        if (x === 0 || y === 0) {
          const dtmp = dx;
          dx = -dy;
          dy = dtmp;
        }
        if (x === 0 && y <= 0) x++;
        else {
          x += dx;
          y += dy;
        }
      }
      return World.VILLAGE_POS;
    };

    const closestRoad = findClosestRoad(World.curPos);
    const xDist = World.curPos[0] - closestRoad[0];
    const yDist = World.curPos[1] - closestRoad[1];
    const xDir = Math.abs(xDist) / xDist;
    const yDir = Math.abs(yDist) / yDist;
    let xIntersect, yIntersect;
    if (Math.abs(xDist) > Math.abs(yDist)) {
      xIntersect = closestRoad[0];
      yIntersect = closestRoad[1] + yDist;
    } else {
      xIntersect = closestRoad[0] + xDist;
      yIntersect = closestRoad[1];
    }

    for (let x = 0; x < Math.abs(xDist); x++) {
      if (World.isTerrain(World.state.map[closestRoad[0] + xDir * x][yIntersect])) {
        World.state.map[closestRoad[0] + xDir * x][yIntersect] = World.TILE.ROAD;
      }
    }
    for (let y = 0; y < Math.abs(yDist); y++) {
      if (World.isTerrain(World.state.map[xIntersect][closestRoad[1] + yDir * y])) {
        World.state.map[xIntersect][closestRoad[1] + yDir * y] = World.TILE.ROAD;
      }
    }
  },

  setWater(w) {
    World.water = w;
    if (World.water > World.getMaxWater()) World.water = World.getMaxWater();
    $SM.fireUpdate('world');
  },

  setHp(hp) {
    if (typeof hp === 'number' && !isNaN(hp)) {
      World.health = hp;
      if (World.health > World.getMaxHealth()) World.health = World.getMaxHealth();
      $SM.fireUpdate('world');
    }
  },

  moveNorth() {
    if (World.curPos[1] > 0) World.move(World.NORTH);
  },
  moveSouth() {
    if (World.curPos[1] < World.RADIUS * 2) World.move(World.SOUTH);
  },
  moveWest() {
    if (World.curPos[0] > 0) World.move(World.WEST);
  },
  moveEast() {
    if (World.curPos[0] < World.RADIUS * 2) World.move(World.EAST);
  },

  move(direction) {
    const oldTile = World.state.map[World.curPos[0]][World.curPos[1]];
    World.curPos[0] += direction[0];
    World.curPos[1] += direction[1];
    World.narrateMove(oldTile, World.state.map[World.curPos[0]][World.curPos[1]]);
    World.lightMap(World.curPos[0], World.curPos[1], World.state.mask);
    AudioEngine.playSound(AudioLibrary['FOOTSTEPS_' + (Math.floor(Math.random() * 6) + 1)]);
    $SM.fireUpdate('world');
    World.doSpace();
    if (World.checkDanger()) {
      if (World.danger) {
        Notifications.notify(World, _('dangerous to be this far from the village without proper protection'));
      } else {
        Notifications.notify(World, _('safer here'));
      }
    }
  },

  keyDown(event) {
    switch (event.which) {
      case 38:
      case 87: World.moveNorth(); break;
      case 40:
      case 83: World.moveSouth(); break;
      case 37:
      case 65: World.moveWest(); break;
      case 39:
      case 68: World.moveEast(); break;
      default: return;
    }
    // 阻止方向键默认滚页，避免「移动角色 + 页面滚动」双触发
    if (event.preventDefault) event.preventDefault();
  },

  checkDanger() {
    World.danger = typeof World.danger === 'undefined' ? false : World.danger;
    if (!World.danger) {
      if ($SM.get('stores["i armour"]', true) === 0 && World.getDistance() >= 8) {
        World.danger = true;
        return true;
      }
      if ($SM.get('stores["s armour"]', true) === 0 && World.getDistance() >= 18) {
        World.danger = true;
        return true;
      }
    } else {
      if (World.getDistance() < 8) {
        World.danger = false;
        return true;
      }
      if (World.getDistance() < 18 && $SM.get('stores["i armour"]', true) > 0) {
        World.danger = false;
        return true;
      }
    }
    return false;
  },

  useSupplies() {
    const Path = requireModule('path');
    World.foodMove++;
    World.waterMove++;

    // 食物
    let movesPerFood = World.MOVES_PER_FOOD;
    movesPerFood *= $SM.hasPerk('slow metabolism') ? 2 : 1;
    if (World.foodMove >= movesPerFood) {
      World.foodMove = 0;
      let num = Path.outfit['cured meat'];
      num--;
      if (num === 0) {
        Notifications.notify(World, _('the meat has run out'));
      } else if (num < 0) {
        num = 0;
        if (!World.starvation) {
          Notifications.notify(World, _('starvation sets in'));
          World.starvation = true;
        } else {
          $SM.set('character.starved', $SM.get('character.starved', true));
          $SM.add('character.starved', 1);
          if ($SM.get('character.starved') >= 10 && !$SM.hasPerk('slow metabolism')) {
            $SM.addPerk('slow metabolism');
          }
          World.die();
          return false;
        }
      } else {
        World.starvation = false;
        World.setHp(World.health + World.meatHeal());
      }
      Path.outfit['cured meat'] = num;
    }

    // 水
    let movesPerWater = World.MOVES_PER_WATER;
    movesPerWater *= $SM.hasPerk('desert rat') ? 2 : 1;
    if (World.waterMove >= movesPerWater) {
      World.waterMove = 0;
      let water = World.water;
      water--;
      if (water === 0) {
        Notifications.notify(World, _('there is no more water'));
      } else if (water < 0) {
        water = 0;
        if (!World.thirst) {
          Notifications.notify(World, _('the thirst becomes unbearable'));
          World.thirst = true;
        } else {
          $SM.set('character.dehydrated', $SM.get('character.dehydrated', true));
          $SM.add('character.dehydrated', 1);
          if ($SM.get('character.dehydrated') >= 10 && !$SM.hasPerk('desert rat')) {
            $SM.addPerk('desert rat');
          }
          World.die();
          return false;
        }
      } else {
        World.thirst = false;
      }
      World.setWater(water);
    }
    return true;
  },

  meatHeal() {
    return World.MEAT_HEAL * ($SM.hasPerk('gastronome') ? 2 : 1);
  },
  medsHeal() {
    return World.MEDS_HEAL;
  },
  hypoHeal() {
    return World.HYPO_HEAL;
  },

  checkFight() {
    World.fightMove = typeof World.fightMove === 'number' ? World.fightMove : 0;
    World.fightMove++;
    if (World.fightMove > World.FIGHT_DELAY) {
      let chance = World.FIGHT_CHANCE;
      chance *= $SM.hasPerk('stealthy') ? 0.5 : 1;
      if (Math.random() < chance) {
        World.fightMove = 0;
        const Events = requireModule('events');
        if (Events && Events.triggerFight) Events.triggerFight();
      }
    }
  },

  doSpace() {
    const Events = requireModule('events');
    const curTile = World.state.map[World.curPos[0]][World.curPos[1]];
    if (curTile === World.TILE.VILLAGE) {
      World.goHome();
    } else if (curTile === World.TILE.EXECUTIONER) {
      const scene = World.state.executioner ? 'executioner-antechamber' : 'executioner-intro';
      if (Events && Events.Executioner) Events.startEvent(Events.Executioner[scene]);
    } else if (typeof World.LANDMARKS[curTile] !== 'undefined') {
      if (Events && Events.Setpieces) Events.startEvent(Events.Setpieces[World.LANDMARKS[curTile].scene]);
    } else {
      if (World.useSupplies()) {
        World.checkFight();
      }
    }
  },

  getDistance(from, to) {
    from = from || World.curPos;
    to = to || World.VILLAGE_POS;
    return Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]);
  },

  getTerrain() {
    return World.state.map[World.curPos[0]][World.curPos[1]];
  },

  narrateMove(oldTile, newTile) {
    let msg = null;
    switch (oldTile) {
      case World.TILE.FOREST:
        if (newTile === World.TILE.FIELD) msg = _('the trees yield to dry grass. the yellowed brush rustles in the wind.');
        else if (newTile === World.TILE.BARRENS) msg = _('the trees are gone. parched earth and blowing dust are poor replacements.');
        break;
      case World.TILE.FIELD:
        if (newTile === World.TILE.FOREST) msg = _('trees loom on the horizon. grasses gradually yield to a forest floor of dry branches and fallen leaves.');
        else if (newTile === World.TILE.BARRENS) msg = _('the grasses thin. soon, only dust remains.');
        break;
      case World.TILE.BARRENS:
        if (newTile === World.TILE.FIELD) msg = _('the barrens break at a sea of dying grass, swaying in the arid breeze.');
        else if (newTile === World.TILE.FOREST) msg = _('a wall of gnarled trees rises from the dust. their branches twist into a skeletal canopy overhead.');
        break;
    }
    if (msg != null) Notifications.notify(World, msg);
  },

  newMask() {
    const mask = new Array(World.RADIUS * 2 + 1);
    for (let i = 0; i <= World.RADIUS * 2; i++) mask[i] = new Array(World.RADIUS * 2 + 1);
    World.lightMap(World.RADIUS, World.RADIUS, mask);
    return mask;
  },

  lightMap(x, y, mask) {
    let r = World.LIGHT_RADIUS;
    r *= $SM.hasPerk('scout') ? 2 : 1;
    World.uncoverMap(x, y, r, mask);
    return mask;
  },

  uncoverMap(x, y, r, mask) {
    mask[x][y] = true;
    for (let i = -r; i <= r; i++) {
      for (let j = -r + Math.abs(i); j <= r - Math.abs(i); j++) {
        if (y + j >= 0 && y + j <= World.RADIUS * 2 &&
          x + i <= World.RADIUS * 2 && x + i >= 0) {
          mask[x + i][y + j] = true;
        }
      }
    }
  },

  applyMap() {
    const x = Math.floor(Math.random() * (World.RADIUS * 2) + 1);
    const y = Math.floor(Math.random() * (World.RADIUS * 2) + 1);
    World.uncoverMap(x, y, 5, $SM.get('game.world.mask'));
    $SM.fireUpdate('world');
  },

  generateMap() {
    const map = new Array(World.RADIUS * 2 + 1);
    for (let i = 0; i <= World.RADIUS * 2; i++) map[i] = new Array(World.RADIUS * 2 + 1);
    map[World.RADIUS][World.RADIUS] = World.TILE.VILLAGE;
    for (let r = 1; r <= World.RADIUS; r++) {
      for (let t = 0; t < r * 8; t++) {
        let x, y;
        if (t < 2 * r) {
          x = World.RADIUS - r + t;
          y = World.RADIUS - r;
        } else if (t < 4 * r) {
          x = World.RADIUS + r;
          y = World.RADIUS - 3 * r + t;
        } else if (t < 6 * r) {
          x = World.RADIUS + 5 * r - t;
          y = World.RADIUS + r;
        } else {
          x = World.RADIUS - r;
          y = World.RADIUS + 7 * r - t;
        }
        map[x][y] = World.chooseTile(x, y, map);
      }
    }

    for (const k in World.LANDMARKS) {
      const landmark = World.LANDMARKS[k];
      for (let i = 0; i < landmark.num; i++) {
        const pos = World.placeLandmark(landmark.minRadius, landmark.maxRadius, k, map);
        if (k === World.TILE.SHIP) {
          const dx = pos[0] - World.RADIUS;
          const dy = pos[1] - World.RADIUS;
          const horz = dx < 0 ? 'west' : 'east';
          const vert = dy < 0 ? 'north' : 'south';
          if (Math.abs(dx) / 2 > Math.abs(dy)) World.dir = horz;
          else if (Math.abs(dy) / 2 > Math.abs(dx)) World.dir = vert;
          else World.dir = vert + horz;
        }
      }
    }
    return map;
  },

  placeLandmark(minRadius, maxRadius, landmark, map) {
    let x = World.RADIUS, y = World.RADIUS;
    while (!World.isTerrain(map[x][y])) {
      const r = Math.floor(Math.random() * (maxRadius - minRadius)) + minRadius;
      let xDist = Math.floor(Math.random() * r);
      let yDist = r - xDist;
      if (Math.random() < 0.5) xDist = -xDist;
      if (Math.random() < 0.5) yDist = -yDist;
      x = World.RADIUS + xDist;
      if (x < 0) x = 0;
      if (x > World.RADIUS * 2) x = World.RADIUS * 2;
      y = World.RADIUS + yDist;
      if (y < 0) y = 0;
      if (y > World.RADIUS * 2) y = World.RADIUS * 2;
    }
    map[x][y] = landmark;
    return [x, y];
  },

  isTerrain(tile) {
    return tile === World.TILE.FOREST || tile === World.TILE.FIELD || tile === World.TILE.BARRENS;
  },

  chooseTile(x, y, map) {
    const adjacent = [
      y > 0 ? map[x][y - 1] : null,
      y < World.RADIUS * 2 ? map[x][y + 1] : null,
      x < World.RADIUS * 2 ? map[x + 1][y] : null,
      x > 0 ? map[x - 1][y] : null,
    ];
    const chances = {};
    let nonSticky = 1;
    for (const i in adjacent) {
      if (adjacent[i] === World.TILE.VILLAGE) {
        return World.TILE.FOREST;
      } else if (typeof adjacent[i] === 'string') {
        let cur = chances[adjacent[i]];
        cur = typeof cur === 'number' ? cur : 0;
        chances[adjacent[i]] = cur + World.STICKINESS;
        nonSticky -= World.STICKINESS;
      }
    }
    for (const t in World.TILE) {
      const tile = World.TILE[t];
      if (World.isTerrain(tile)) {
        let cur = chances[tile];
        cur = typeof cur === 'number' ? cur : 0;
        cur += World.TILE_PROBS[tile] * nonSticky;
        chances[tile] = cur;
      }
    }
    const list = [];
    for (const t in chances) list.push(chances[t] + '' + t);
    list.sort((a, b) => {
      const n1 = parseFloat(a.substring(0, a.length - 1));
      const n2 = parseFloat(b.substring(0, b.length - 1));
      return n2 - n1;
    });
    let c = 0;
    const r = Math.random();
    for (const i in list) {
      const prob = list[i];
      c += parseFloat(prob.substring(0, prob.length - 1));
      if (r < c) return prob.charAt(prob.length - 1);
    }
    return World.TILE.BARRENS;
  },

  die() {
    if (!World.dead) {
      World.dead = true;
      AudioEngine.playSound(AudioLibrary.DEATH);
      Engine.log('player death');
      Engine.event('game event', 'death');
      Engine.keyLock = true;
      Notifications.notify(World, _('the world fades'));
      World.state = null;
      const Path = requireModule('path');
      Path.outfit = {};
      // 死亡惩罚：出发（embark）按钮进入冷却（对应旧版 Button.cooldown($('#embarkButton'))）
      $SM.set('cooldown.embarkButton', World.DEATH_COOLDOWN);
      // 死亡后默认回到「漫漫尘途」：可看到出发按钮的冷却倒计时
      Engine.travelTo('path');
      Engine.keyLock = false;
    }
  },

  goHome() {
    const Path = requireModule('path');
    const Ship = requireModule('ship');
    const Fabricator = requireModule('fabricator');
    const Room = requireModule('room');

    $SM.setM('game.world', World.state);
    // 安全返回：清除出发冷却（对应旧版 Button.clearCooldown）
    $SM.remove('cooldown.embarkButton');
    if (World.state.sulphurmine && $SM.get('game.buildings["sulphur mine"]', true) === 0) {
      $SM.add('game.buildings["sulphur mine"]', 1);
      Engine.event('progress', 'sulphur mine');
    }
    if (World.state.ironmine && $SM.get('game.buildings["iron mine"]', true) === 0) {
      $SM.add('game.buildings["iron mine"]', 1);
      Engine.event('progress', 'iron mine');
    }
    if (World.state.coalmine && $SM.get('game.buildings["coal mine"]', true) === 0) {
      $SM.add('game.buildings["coal mine"]', 1);
      Engine.event('progress', 'coal mine');
    }
    if (World.state.ship && !$SM.get('features.location.spaceShip')) {
      if (Ship && Ship.init) Ship.init();
      Engine.event('progress', 'ship');
    }
    if (World.state.executioner && !$SM.get('features.location.fabricator')) {
      if (Fabricator && Fabricator.init) Fabricator.init();
      Notifications.notify(null, _('builder knows the strange device when she sees it. takes it for herself real quick. doesn\u2019t ask where it came from.'));
      Engine.event('progress', 'fabricator');
    }
    World.redeemBlueprints();
    World.state = null;

    for (const k in Path.outfit) {
      $SM.add('stores["' + k + '"]', Path.outfit[k]);
      if (World.leaveItAtHome(k)) {
        Path.outfit[k] = 0;
      }
    }

    Engine.travelTo('path');
    if (Path.onArrival) Path.onArrival();
  },

  leaveItAtHome(thing) {
    return thing !== 'cured meat' && thing !== 'bullets' && thing !== 'energy cell' && thing !== 'charm' && thing !== 'medicine' &&
      typeof World.Weapons[thing] === 'undefined' && typeof requireModule('room').Craftables[thing] === 'undefined';
  },

  getMaxHealth() {
    if ($SM.get('stores["kinetic armour"]', true) > 0) return World.BASE_HEALTH + 50;
    if ($SM.get('stores["s armour"]', true) > 0) return World.BASE_HEALTH + 35;
    if ($SM.get('stores["i armour"]', true) > 0) return World.BASE_HEALTH + 15;
    if ($SM.get('stores["l armour"]', true) > 0) return World.BASE_HEALTH + 5;
    return World.BASE_HEALTH;
  },

  getHitChance() {
    return $SM.hasPerk('precise') ? World.BASE_HIT_CHANCE + 0.1 : World.BASE_HIT_CHANCE;
  },

  getMaxWater() {
    const Room = requireModule('room');
    if (Room.isEquipped('fluid recycler')) return World.BASE_WATER + 100;
    if (Room.isEquipped('water tank')) return World.BASE_WATER + 50;
    if (Room.isEquipped('cask')) return World.BASE_WATER + 20;
    if (Room.isEquipped('waterskin')) return World.BASE_WATER + 10;
    return World.BASE_WATER;
  },

  useOutpost() {
    Notifications.notify(null, _('water replenished'));
    World.setWater(World.getMaxWater());
  },

  getOutpostSupply(x, y) {
    x = typeof x === 'number' ? x : World.curPos[0];
    y = typeof y === 'number' ? y : World.curPos[1];
    const key = x + ',' + y;
    if (typeof World.outpostSupplies[key] === 'undefined') {
      World.outpostSupplies[key] = {
        'cured meat': Math.floor(Math.random() * 5) + 5,
      };
    }
    return World.outpostSupplies[key];
  },

  adjustOutpostSupply(item, delta) {
    if (!World.curPos) return; // 未进入野外地图（房间/故事阶段）时无哨站补给可调整
    const key = World.curPos[0] + ',' + World.curPos[1];
    const supplies = World.outpostSupplies[key];
    if (typeof supplies !== 'undefined' && typeof supplies[item] === 'number') {
      supplies[item] += delta;
      if (supplies[item] < 0) supplies[item] = 0;
    }
  },

  redeemBlueprints() {
    const Path = requireModule('path');
    let redeemed = false;
    const redeem = (blueprint, item) => {
      if (Path.outfit[blueprint]) {
        $SM.set('character.blueprints["' + item + '"]', true);
        delete Path.outfit[blueprint];
        redeemed = true;
      }
    };
    redeem('hypo blueprint', 'hypo');
    redeem('kinetic armour blueprint', 'kinetic armour');
    redeem('disruptor blueprint', 'disruptor');
    redeem('plasma rifle blueprint', 'plasma rifle');
    redeem('stim blueprint', 'stim');
    redeem('glowstone blueprint', 'glowstone');
    if (redeemed) {
      Notifications.notify(null, _('blueprints feed into the fabricator data port. possibilities grow.'));
    }
  },

  onArrival() {
    Engine.keyLock = false;
    // 深拷贝 game.world 进入探索临时状态
    World.state = JSON.parse(JSON.stringify($SM.get('game.world')));
    World.setWater(World.getMaxWater());
    World.setHp(World.getMaxHealth());
    World.foodMove = 0;
    World.waterMove = 0;
    World.fightMove = 0;
    World.starvation = false;
    World.thirst = false;
    World.outpostSupplies = {};
    World.curPos = World.copyPos(World.VILLAGE_POS);
    World.dead = false;
    World.setTitle();
  },

  setTitle() {
    document.title = _('A Barren World');
  },

  getTitle() {
    return _('A Barren World');
  },

  copyPos(pos) {
    return [pos[0], pos[1]];
  },

  handleStateUpdates() {},

  /* ---------------- 将探索态导出为 React 可渲染快照 ---------------- */

  /** 出装补给清单：{water, items:[{key,name,num}]} */
  getBagState() {
    const Path = requireModule('path');
    const items = [];
    if (World.water > 0) {
      items.push({ key: 'water', name: _('water'), num: World.water });
    }
    if (Path.outfit) {
      for (const k in Path.outfit) {
        const num = Path.outfit[k];
        if (typeof num === 'number' && num > 0) {
          items.push({ key: k, name: _(k), num });
        }
      }
    }
    // 排序：水 → 熏肉 → 其余（近战/远程/消耗品/其他，内部按字母序）
    items.sort((a, b) => {
      const ra = a.key === 'water' ? 0 : a.key === 'cured meat' ? 1 : 2 + suppliesRank(a.key);
      const rb = b.key === 'water' ? 0 : b.key === 'cured meat' ? 1 : 2 + suppliesRank(b.key);
      if (ra !== rb) return ra - rb;
      return a.key < b.key ? -1 : 1;
    });
    return {
      water: World.water,
      items,
      title: requireModule('room').isEquipped('rucksack') ? _('rucksack') : _('pockets'),
    };
  },

  /** 地图快照：按行返回 [{char, visible, visited, isPlayer, landmark, label}] */
  getMapGrid() {
    const grid = [];
    if (!World.state) return grid;
    const mask = World.state.mask;
    const map = World.state.map;
    for (let j = 0; j <= World.RADIUS * 2; j++) {
      const row = [];
      for (let i = 0; i <= World.RADIUS * 2; i++) {
        const isPlayer = World.curPos && World.curPos[0] === i && World.curPos[1] === j;
        const visible = !!(mask && mask[i] && mask[i][j]);
        let char = visible ? map[i][j] : null;
        let landmark = null;
        let label = null;
        if (visible && char) {
          const base = char.length > 1 ? char[0] : char;
          const visited = char.length > 1;
          if (base === World.TILE.VILLAGE) {
            landmark = 'lm_village';
            label = _('The\u00a0Village');
          } else if (typeof World.LANDMARKS[base] !== 'undefined') {
            landmark = Pixel.TILE_ICONS[base];
            label = World.LANDMARKS[base].label;
            if (visited || base === World.TILE.OUTPOST) char = base;
          }
        }
        row.push({ char, base: char ? (char.length > 1 ? char[0] : char) : null, visible, visited: visible && char && char.length > 1, isPlayer, landmark, label });
      }
      grid.push(row);
    }
    return grid;
  },

  /** 供面板查询的完整世界状态快照 */
  getWorldState() {
    return {
      water: World.water,
      maxWater: World.getMaxWater(),
      health: World.health,
      maxHealth: World.getMaxHealth(),
      dir: World.dir,
      map: World.getMapGrid(),
      bag: World.getBagState(),
    };
  },
};
