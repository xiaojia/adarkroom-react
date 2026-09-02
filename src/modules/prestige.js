/**
 * Prestige（声望结算，逻辑层）
 * ---------------------------
 * 对应旧版 script/prestige.js。存放上一局结束时折算的物资，
 * 在地图「被摧毁的村庄 cache」场景通过 collectStores() 重新拿回本局。
 */
import { _ } from '../i18n';
import { $SM } from '../store/stateManager';

export const Prestige = {
  name: _('Prestige'),

  storesMap: [
    { store: 'wood', type: 'g' },
    { store: 'fur', type: 'g' },
    { store: 'meat', type: 'g' },
    { store: 'iron', type: 'g' },
    { store: 'coal', type: 'g' },
    { store: 'sulphur', type: 'g' },
    { store: 'steel', type: 'g' },
    { store: 'cured meat', type: 'g' },
    { store: 'scales', type: 'g' },
    { store: 'teeth', type: 'g' },
    { store: 'leather', type: 'g' },
    { store: 'bait', type: 'g' },
    { store: 'torch', type: 'g' },
    { store: 'cloth', type: 'g' },
    { store: 'bone spear', type: 'w' },
    { store: 'iron sword', type: 'w' },
    { store: 'steel sword', type: 'w' },
    { store: 'bayonet', type: 'w' },
    { store: 'rifle', type: 'w' },
    { store: 'laser rifle', type: 'w' },
    { store: 'bullets', type: 'a' },
    { store: 'energy cell', type: 'a' },
    { store: 'grenade', type: 'a' },
    { store: 'bolas', type: 'a' },
  ],

  /** 上一局折算后的物资数量数组（顺序与 storesMap 一致） */
  getStores(reduce) {
    const stores = [];
    for (const s of this.storesMap) {
      const n = Math.floor(
        $SM.get('stores["' + s.store + '"]', true) / (reduce ? this.randGen(s.type) : 1),
      );
      stores.push(n);
    }
    return stores;
  },

  get() {
    return {
      stores: $SM.get('previous.stores'),
      score: $SM.get('previous.score'),
    };
  },

  set(prestige) {
    $SM.set('previous.stores', prestige.stores);
    $SM.set('previous.score', prestige.score);
  },

  save() {
    $SM.set('previous.stores', this.getStores(true));
    // React 版暂无 Score 模块，score 保持原值
  },

  /** cache（被摧毁的村庄）场景调用：把上一局折算的物资拿回本局 */
  collectStores() {
    const prevStores = $SM.get('previous.stores');
    if (prevStores != null && Array.isArray(prevStores)) {
      const toAdd = {};
      for (let i = 0; i < this.storesMap.length; i++) {
        const s = this.storesMap[i];
        toAdd[s.store] = prevStores[i];
      }
      $SM.addM('stores', toAdd);
      // 拿走即清空上一局存量
      prevStores.length = 0;
    }
  },

  randGen(storeType) {
    let amount;
    switch (storeType) {
      case 'g':
        amount = Math.floor(Math.random() * 10);
        break;
      case 'w':
        amount = Math.floor(Math.floor(Math.random() * 10) / 2);
        break;
      case 'a':
        amount = Math.ceil(Math.random() * 10 * Math.ceil(Math.random() * 10));
        break;
      default:
        return 1;
    }
    if (amount !== 0) return amount;
    return 1;
  },
};

export default Prestige;
