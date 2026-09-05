/**
 * StoresPanel — 库存列表（共享展示组件）
 * -------------------------------------
 * 对应旧版 #storesContainer > #stores + #weapons。
 * 任何模块面板需要展示库存时，只需在自己的布局里渲染
 *   <Slot name="stores" />
 * 本组件在应用启动时注册到 'stores' 插槽（见 src/main.jsx）。
 *
 * 展示规则（与旧版一致）：
 *  - upgrade 类型的物品不显示
 *  - weapon 类型的物品显示在「武器」区块
 *  - 其余显示在「库存」区块
 *  - 每个资源行 hover 显示各收入源的净增减 tooltip
 *  - 数值后括号内为所有收入源的合计净增减
 */
import { useEffect } from 'react';
import { _ } from '../../i18n';
import { $SM, useTick } from '../../store/stateManager';
import { Engine } from '../../engine/Engine';
import { requireModule } from '../../engine/moduleLoader';
import PixelIcon from './PixelIcon';
import Panel from './Panel';
import { Pixel } from '../../modules/pixel';
import { weaponRank } from '../../engine/storeCategories';

/* 库存分组排序（按用户语义分三组）：
   1) 消耗类 —— 原材料 / 制造原料，被拿去合成或交易；
   2) 人员消耗 —— 村民/建造者口粮；
   3) 直接使用 —— 探索/治疗/工具/能源等一次性消耗品。
   熏肉（cured meat）置顶（compareStores 中特判）。
   未列出的库存 key 会排到最后（保持字母序），不会丢失。 */
const STORE_GROUPS = [
  ['wood', 'fur', 'cloth', 'leather', 'scales', 'teeth', 'coal', 'iron', 'steel', 'sulphur', 'alien alloy'],
  ['meat'],
  ['torch', 'charm', 'medicine', 'bullets', 'energy cell', 'hypo', 'stim', 'glowstone', 'water'],
];

const STORE_RANK = {};
STORE_GROUPS.forEach((group, gi) => {
  group.forEach((k, ki) => {
    STORE_RANK[k] = gi * 100 + ki;
  });
});
/** 排序：熏肉置顶 → 按分组序（组内按字母序）；未归类的排在最后按字母序 */
function compareStores(a, b) {
  if (a === 'cured meat') return -1;
  if (b === 'cured meat') return 1;
  const ra = STORE_RANK[a] ?? 1000;
  const rb = STORE_RANK[b] ?? 1000;
  if (ra !== rb) return ra - rb;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 判断某资源的类型：weapon / upgrade / good / tool / building / null */
function getResourceType(k) {
  const Room = requireModule('room');
  const Fabricator = requireModule('fabricator');
  if (Room && Room.Craftables[k]) return Room.Craftables[k].type;
  if (Room && Room.TradeGoods[k]) return Room.TradeGoods[k].type;
  if (Room && Room.MiscItems[k]) return Room.MiscItems[k].type;
  if (Fabricator && Fabricator.Craftables && Fabricator.Craftables[k]) return Fabricator.Craftables[k].type;
  return null;
}

/** 某资源各收入源：[{source, msg}] */
function getIncomeRows(storeName) {
  const income = $SM.get('income');
  const rows = [];
  if (!income) return rows;
  for (const src in income) {
    const inc = income[src];
    if (!inc || !inc.stores) continue;
    for (const s in inc.stores) {
      if (s === storeName && inc.stores[s] !== 0) {
        rows.push({ source: _(src), msg: Engine.getIncomeMsg(inc.stores[s], inc.delay) });
      }
    }
  }
  return rows;
}

/** 某资源合计净增减 */
function getNetIncome(storeName) {
  let net = 0;
  const income = $SM.get('income');
  if (!income) return 0;
  for (const src in income) {
    const inc = income[src];
    if (!inc || !inc.stores) continue;
    net += inc.stores[storeName] || 0;
  }
  return net;
}

function StoreRow({ k }) {
  const num = $SM.get('stores["' + k + '"]', true);
  if (typeof num !== 'number' || isNaN(num)) return null;

  // 外星合金：破旧星舰出现后即使为 0 也显示
  const showAlloy = k === 'alien alloy' && $SM.get('features.location.spaceShip');
  if (num <= 0 && !showAlloy) return null;

  const incomeRows = getIncomeRows(k);
  const net = getNetIncome(k);
  const netVal = Math.round(net * 10) / 10;

  // 罗盘：悬停提示指向飞船的方向（世界地图生成时按飞船方位计算 World.dir）
  const compassMsg = k === 'compass' ? (() => {
    const World = requireModule('world');
    return World && World.dir ? _('the compass points ' + World.dir) : null;
  })() : null;

  return (
    <div className="storeRow">
      <div className="row_key">
        <PixelIcon name={Pixel.resourceSprite(k)} pixel={2} />
        {_(k)}
      </div>
      <div className="row_val">
        {Math.floor(num)}
        {netVal !== 0 && (
          <span className="incomeDiff">{' (' + (netVal > 0 ? '+' : '') + netVal + ')'}</span>
        )}
      </div>
      {(incomeRows.length > 0 || compassMsg) && (
        <div className="tooltip bottom right">
          {incomeRows.map((r, i) => (
            <div className="storeRow" key={i}>
              <div className="row_key">{r.source}</div>
              <div className="row_val">{r.msg}</div>
            </div>
          ))}
          {compassMsg && (
            <div className="storeRow">
              <div className="row_key">{_('compass')}</div>
              <div className="row_val">{compassMsg}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StoresPanel() {
  const version = useTick();
  const stores = $SM.get('stores');

  // 小偷触发检测（与旧版一致：库存超 5000 且到达过世界）
  useEffect(() => {
    if (typeof $SM.get('game.thieves') === 'undefined' && $SM.get('features.location.world')) {
      for (const k in $SM.get('stores') || {}) {
        if ($SM.get('stores["' + k + '"]', true) > 5000) {
          $SM.startThieves();
          break;
        }
      }
    }
  }, [version]);

  if (!stores) return null;

  const storeRows = [];
  const weaponRows = [];
  const keys = Object.keys(stores).sort(compareStores);
  for (const k of keys) {
    const type = getResourceType(k);
    // upgrade 类型默认不显示（一次性建造升级件），但罗盘是买到手的推进类物品，玩家需要看到它
    if (type === 'upgrade' && k !== 'compass') continue;
    if (type === 'weapon') weaponRows.push(k);
    else storeRows.push(k);
  }
  // 武器区块：近战 → 远程 → 其他武器
  weaponRows.sort((a, b) => {
    const ra = weaponRank(a);
    const rb = weaponRank(b);
    if (ra !== rb) return ra - rb;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  return (
    <div id="storesContainer">
      <Panel id="stores" title={_('stores')}>
        {storeRows.map((k) => (
          <StoreRow key={k} k={k} />
        ))}
      </Panel>
      {weaponRows.length > 0 && (
        <Panel id="weapons" title={_('weapons')}>
          {weaponRows.map((k) => (
            <StoreRow key={k} k={k} />
          ))}
        </Panel>
      )}
    </div>
  );
}
