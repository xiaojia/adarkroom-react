/**
 * Space 模块（逻辑层）
 * ---------------------
 * 移植自旧版 script/space.js（太空决土小游戏）。
 * 只包含游戏规则与状态变更，不操作任何 DOM。
 * UI 展示由 components/panels/SpacePanel.jsx 负责（从 useSpace 状态派生渲染）。
 *
 * 玩法：飞船升空，躲避小行星，altitude 超过 60 即通关（endGame）。
 * 飞船被小行星击中 hull 归零则坠毁回到 Ship（crash）。
 *
 * 逻辑层用高频 useSpace store 保存每帧渲染数据（飞船坐标/hull/小行星列表），
 * 由游戏主循环（setInterval 33ms）驱动，面板组件订阅该 store 渲染。
 */
import { create } from 'zustand';
import { _ } from '../i18n';
import { $SM, Dispatch } from '../store/stateManager';
import { Engine } from '../engine/Engine';
import { Notifications } from '../engine/notifications';
import { requireModule } from '../engine/moduleLoader';
import { Pixel } from './pixel';

export const useSpace = create(() => ({
  shipX: 350,
  shipY: 500,
  hull: 0,
  maxHull: 0,
  altitude: 0,
  asteroids: [], // [{id,x,top,height,sprite}]
  started: false,
  done: false,
  crash: false,
}));

export const Space = {
  SHIP_SPEED: 3,
  BASE_ASTEROID_DELAY: 500,
  BASE_ASTEROID_SPEED: 1500,
  FTB_SPEED: 60000,
  STAR_WIDTH: 3000,
  STAR_HEIGHT: 3000,
  NUM_STARS: 200,
  STAR_SPEED: 60000,
  FRAME_DELAY: 33,
  ASTEROID_SPRITES: ['space_ast_a', 'space_ast_b', 'space_ast_c', 'space_ast_d', 'space_ast_e'],

  name: _('Space'),
  options: {},

  // 内部计时器/标志（非渲染数据）
  _up: false,
  _down: false,
  _left: false,
  _right: false,
  _lastMove: null,
  _asteroidId: 0,
  _altTimer: null,
  _moveTimer: null,
  _astTimer: null,

  init(options) {
    Space.options = { ...Space.options, ...options };
    Dispatch('stateUpdate').subscribe(Space.handleStateUpdates);
  },

  onArrival() {
    const Ship = requireModule('ship');
    const maxHull = (Ship && Ship.getMaxHull) ? Ship.getMaxHull() : 0;

    Space._up = Space._down = Space._left = Space._right = false;
    Space._lastMove = null;
    Space._asteroidId = 0;

    useSpace.setState({
      shipX: 350,
      shipY: 500,
      hull: maxHull,
      maxHull,
      altitude: 0,
      asteroids: [],
      started: true,
      done: false,
      crash: false,
    });

    Space.startAscent();
  },

  getTitle(altitude) {
    if (altitude == null) altitude = useSpace.getState().altitude;
    if (altitude < 10) return _('Troposphere');
    if (altitude < 20) return _('Stratosphere');
    if (altitude < 30) return _('Mesosphere');
    if (altitude < 45) return _('Thermosphere');
    if (altitude < 60) return _('Exosphere');
    return _('Space');
  },

  getSpeed() {
    return Space.SHIP_SPEED + $SM.get('game.spaceShip.thrusters');
  },

  startAscent() {
    Space._altTimer = setInterval(() => {
      const s = useSpace.getState();
      if (s.done) return;
      const altitude = s.altitude + 1;
      useSpace.setState({ altitude });
      if (altitude > 60) {
        clearInterval(Space._altTimer);
        Space.endGame();
      }
    }, 1000);

    Space._moveTimer = setInterval(Space.moveShip, Space.FRAME_DELAY);

    // 首波小行星
    Space.createAsteroid(true);
    Space.scheduleAsteroid();
  },

  scheduleAsteroid() {
    clearTimeout(Space._astTimer);
    const alt = useSpace.getState().altitude;
    Space._astTimer = setTimeout(() => {
      Space.createAsteroid(true);
      Space.scheduleAsteroid();
    }, 1000 - (alt * 10));
  },

  createAsteroid(noNext) {
    const s = useSpace.getState();
    if (s.done) return;
    const r = Math.random();
    let sprite;
    if (r < 0.2) sprite = 'space_ast_a';
    else if (r < 0.4) sprite = 'space_ast_b';
    else if (r < 0.6) sprite = 'space_ast_c';
    else if (r < 0.8) sprite = 'space_ast_d';
    else sprite = 'space_ast_e';

    const def = Pixel.sprites[sprite];
    const grid = def ? def.grid : [];
    const height = grid.length * (Pixel.scale || 3);

    const asteroid = {
      id: Space._asteroidId++,
      sprite,
      x: Math.floor(Math.random() * 660),
      top: -height,
      height,
      speed: Space.BASE_ASTEROID_SPEED - Math.floor(Math.random() * (Space.BASE_ASTEROID_SPEED * 0.65)),
    };

    const asteroids = [...s.asteroids, asteroid];
    useSpace.setState({ asteroids });

    if (!noNext) {
      // 更高处数量递增
      const alt = s.altitude;
      const newOnes = [];
      if (alt > 10) newOnes.push(1);
      if (alt > 20) newOnes.push(1, 1);
      if (alt > 40) newOnes.push(1, 1);
      newOnes.forEach(() => Space.createAsteroid(true));
    }
  },

  moveShip() {
    const s = useSpace.getState();
    if (s.done) return;

    let x = s.shipX;
    let y = s.shipY;
    let dx = 0;
    let dy = 0;

    if (Space._up) dy -= Space.getSpeed();
    else if (Space._down) dy += Space.getSpeed();
    if (Space._left) dx -= Space.getSpeed();
    else if (Space._right) dx += Space.getSpeed();

    if (dx !== 0 && dy !== 0) {
      dx = dx / Math.sqrt(2);
      dy = dy / Math.sqrt(2);
    }

    if (Space._lastMove != null) {
      const dt = Date.now() - Space._lastMove;
      dx *= dt / Space.FRAME_DELAY;
      dy *= dt / Space.FRAME_DELAY;
    }

    x += dx;
    y += dy;
    if (x < 18) x = 18;
    else if (x > 682) x = 682;
    if (y < 21) y = 21;
    else if (y > 979) y = 979;

    Space._lastMove = Date.now();

    // 小行星下落 + 碰撞检测
    const movedAsteroids = [];
    let hull = s.hull;
    let crashed = false;
    for (const a of s.asteroids) {
      // 每帧下落量 = 面板高度 / (速度时间 / 帧间隔)
      a.top += Math.max(8, 1040 / (a.speed / Space.FRAME_DELAY));
      const aY = a.top;
      const xMin = a.x;
      const xMax = a.x + asteroidWidth(a);
      if (xMin <= x && xMax >= x && aY <= y && aY + a.height >= y) {
        // 碰撞
        hull--;
        if (hull === 0) crashed = true;
        continue; // 移除该小行星
      }
      if (aY < 1040) movedAsteroids.push(a);
    }

    useSpace.setState({ shipX: x, shipY: y, hull, asteroids: movedAsteroids });

    if (crashed) {
      Space.crash();
    }
  },

  crash() {
    const s = useSpace.getState();
    if (s.done) return;
    Space.cleanup();
    useSpace.setState({ done: true, crash: true, started: false });
    Engine.keyLock = false;
    const Ship = requireModule('ship');
    Engine.travelTo('ship');
    Notifications.notify(Ship, _('the ship crashes, sparking its way through the atmosphere.'));
    Engine.event('progress', 'crash');
  },

  endGame() {
    const s = useSpace.getState();
    if (s.done) return;
    Space.cleanup();
    useSpace.setState({ done: true, crash: false });
    Engine.event('progress', 'win');
    Engine.GAME_OVER = true;
    Notifications.notify(Space, _('you fly through the debris cloud and into the endless black.'));
  },

  cleanup() {
    clearInterval(Space._altTimer);
    clearInterval(Space._moveTimer);
    clearTimeout(Space._astTimer);
  },

  keyDown(event) {
    switch (event.which) {
      case 38: case 87: Space._up = true; break;
      case 40: case 83: Space._down = true; break;
      case 37: case 65: Space._left = true; break;
      case 39: case 68: Space._right = true; break;
    }
  },

  keyUp(event) {
    switch (event.which) {
      case 38: case 87: Space._up = false; break;
      case 40: case 83: Space._down = false; break;
      case 37: case 65: Space._left = false; break;
      case 39: case 68: Space._right = false; break;
    }
  },

  handleStateUpdates() {},
};

function asteroidWidth(a) {
  const def = Pixel.sprites[a.sprite];
  if (!def) return 40;
  let w = 0;
  for (const row of def.grid) if (row.length > w) w = row.length;
  return w * (Pixel.scale || 3);
}

export default Space;
