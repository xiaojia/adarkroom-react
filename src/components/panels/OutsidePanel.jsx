/**
 * OutsidePanel — 村庄/森林面板（展示层）
 * -------------------------------------
 * 纯展示：从状态 + Outside 逻辑层查询函数派生 UI。
 */
import { _ } from '../../i18n';
import { $SM, useTick } from '../../store/stateManager';
import { Outside } from '../../modules/outside';
import { Slot } from '../../engine/uiRegistry';
import { Pixel } from '../../modules/pixel';
import GameButton from '../shared/GameButton';
import PixelIcon from '../shared/PixelIcon';

function WorkerRow({ worker }) {
  const { key, name, count, canUp, canDn, income } = worker;
  return (
    <div className="workerRow">
      <div className="row_key">
        <PixelIcon name="worker" pixel={2} />
        {name}
      </div>
      <div className="row_val">
        <span>{count}</span>
        {key !== 'gatherer' ? (
          <>
            <span className={'workerBtn' + (canUp ? '' : ' disabled')} onClick={() => canUp && Outside.increaseWorker(key, 10)}>+10</span>
            <span className={'workerBtn' + (canUp ? '' : ' disabled')} onClick={() => canUp && Outside.increaseWorker(key, 1)}>+1</span>
            <span className={'workerBtn' + (canDn ? '' : ' disabled')} onClick={() => canDn && Outside.decreaseWorker(key, 1)}>-1</span>
            <span className={'workerBtn' + (canDn ? '' : ' disabled')} onClick={() => canDn && Outside.decreaseWorker(key, 10)}>-10</span>
          </>
        ) : null}
      </div>
      {income.length > 0 && (
        <div className="tooltip bottom right">
          {income.map((r, i) => (
            <div className="storeRow" key={i}>
              <div className="row_key">
                <PixelIcon name={Pixel.resourceSprite(r.store)} pixel={2} />
                {_(r.store)}
              </div>
              <div className="row_val">{r.msg}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OutsidePanel() {
  useTick();

  const population = $SM.get('game.population', true);
  const maxPop = Outside.getMaxPopulation();
  const buildings = Outside.getVillageBuildings();
  const workers = Outside.getWorkers();
  const hasHuts = $SM.get('game.buildings["hut"]', true) > 0;

  return (
    <div id="outsidePanel" className="location">
      <div id="outsideBody">
        <div id="outsideMain">
          <div id="outsideActions">
            <GameButton
              id="gatherButton"
              text={_('gather wood')}
              icon="res_wood"
              cooldown={Outside._GATHER_DELAY}
              onClick={() => Outside.gatherWood()}
            />
            {Outside.trapButtonVisible() && (
              <GameButton
                id="trapsButton"
                text={_('check traps')}
                icon="bld_trap"
                cooldown={Outside._TRAPS_DELAY}
                onClick={() => Outside.checkTraps()}
              />
            )}
          </div>

          {workers.length > 0 && (
            <div id="workers">
              {workers.map((w) => (
                <WorkerRow key={w.key} worker={w} />
              ))}
            </div>
          )}
        </div>

        <div id="outsideRight">
          <div id="village" data-title={hasHuts ? _('village') : _('forest')}>
            <div className="storeRow">
              <div className="row_key">{_('pop ') + population + '/' + maxPop}</div>
            </div>
            {buildings.map((b) => (
              <div className="storeRow" key={b.key}>
                <div className="row_key">
                  <PixelIcon name={Pixel.buildingSprite(b.key)} pixel={2} />
                  {b.name}
                </div>
                <div className="row_val">{b.count}</div>
              </div>
            ))}
          </div>

          <Slot name="stores" />
        </div>
      </div>
    </div>
  );
}
