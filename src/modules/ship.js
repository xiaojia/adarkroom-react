/**
 * Ship 模块（逻辑层）
 * -------------------
 * 移植自旧版 script/ship.js。只包含游戏规则与状态变更，不操作任何 DOM。
 * UI 展示由 components/panels/ShipPanel.jsx 负责（从状态派生渲染）。
 *
 * 发现坠毁的飞船（world.goHome）后被初始化，用于加固船壳/升级引擎/升空。
 * 升空后进入 Space 模块（太空小游戏）。
 *
 * 依赖：Space（升空后进入）、Fabricator（飞船回收后解锁）、Events（升空确认弹窗）。
 * 通过 requireModule 获取。
 */
import { _ } from '../i18n';
import { $SM, Dispatch } from '../store/stateManager';
import { Engine } from '../engine/Engine';
import { Notifications } from '../engine/notifications';
import { requireModule } from '../engine/moduleLoader';
import { AudioEngine } from '../engine/AudioEngine';
import { AudioLibrary } from '../engine/audioLibrary';

export const Ship = {
  LIFTOFF_COOLDOWN: 120,
  ALLOY_PER_HULL: 1,
  ALLOY_PER_THRUSTER: 1,
  BASE_HULL: 0,
  BASE_THRUSTERS: 1,

  name: _('Ship'),
  options: {},

  init(options) {
    Ship.options = { ...Ship.options, ...options };

    if (!$SM.get('features.location.spaceShip')) {
      $SM.set('features.location.spaceShip', true);
      $SM.setM('game.spaceShip', {
        hull: Ship.BASE_HULL,
        thrusters: Ship.BASE_THRUSTERS,
      });
    }

    Dispatch('stateUpdate').subscribe(Ship.handleStateUpdates);
    Engine.event('progress', 'ship');
  },

  onArrival() {
    if (!$SM.get('game.spaceShip.seenShip')) {
      Notifications.notify(Ship, _('somewhere above the debris cloud, the wanderer fleet hovers. been on this rock too long.'));
      $SM.set('game.spaceShip.seenShip', true);
    }
  },

  getTitle() {
    return _('An Old Starship');
  },

  getMaxHull() {
    return $SM.get('game.spaceShip.hull');
  },

  reinforceHull() {
    if ($SM.get('stores["alien alloy"]', true) < Ship.ALLOY_PER_HULL) {
      Notifications.notify(Ship, _('not enough alien alloy'));
      return false;
    }
    $SM.add('stores["alien alloy"]', -Ship.ALLOY_PER_HULL);
    $SM.add('game.spaceShip.hull', 1);
    AudioEngine.playSound(AudioLibrary.REINFORCE_HULL);
    return true;
  },

  upgradeEngine() {
    if ($SM.get('stores["alien alloy"]', true) < Ship.ALLOY_PER_THRUSTER) {
      Notifications.notify(Ship, _('not enough alien alloy'));
      return false;
    }
    $SM.add('stores["alien alloy"]', -Ship.ALLOY_PER_THRUSTER);
    $SM.add('game.spaceShip.thrusters', 1);
    AudioEngine.playSound(AudioLibrary.UPGRADE_ENGINE);
    return true;
  },

  liftOff() {
    Engine.event('progress', 'lift off');
    AudioEngine.playSound(AudioLibrary.LIFT_OFF);
    Engine.travelTo('space');
  },

  checkLiftOff() {
    if ($SM.get('game.spaceShip.hull') <= 0) return false;
    if (!$SM.get('game.spaceShip.seenWarning')) {
      const Events = requireModule('events');
      Events.startEvent({
        title: _('Ready to Leave?'),
        scenes: {
          start: {
            text: [_('time to get out of this place. won\u2019t be coming back.')],
            buttons: {
              fly: {
                text: _('lift off'),
                onChoose: () => {
                  $SM.set('game.spaceShip.seenWarning', true);
                  Ship.liftOff();
                },
                nextScene: 'end',
              },
              wait: {
                text: _('linger'),
                nextScene: 'end',
              },
            },
          },
        },
      });
    } else {
      Ship.liftOff();
    }
  },

  /** 返回供 React 渲染的状态快照 */
  getShipState() {
    return {
      hull: $SM.get('game.spaceShip.hull', true),
      thrusters: $SM.get('game.spaceShip.thrusters', true),
      alloy: $SM.get('stores["alien alloy"]', true),
      canLiftoff: $SM.get('game.spaceShip.hull', true) > 0,
    };
  },

  handleStateUpdates() {},
};
