/**
 * EventModal — 事件弹窗（展示层）
 * -------------------------------
 * 只渲染 events.js 的 _sync() 汇总出的 snapshot（useEvents.snap），
 * 所有按钮行为通过 Events.actions 分发回逻辑层。
 *
 * snap 结构：
 *  - mode: 'fight' | 'result' | 'story'
 *  - lines / textarea / buttons / attackButtons / healButtons
 *  - player / enemy（战斗双方 {hp,maxHp,status,chara,sprite,name}）
 *  - loot { rows:[{key,name,numLeft,total,canTake}], canTakeAll }
 *  - dropMenu（放不下战利品时弹出的丢弃列表）
 *  - floats（伤害/状态浮字）
 */
import { useEvents, Events } from '../modules/events';
import GameButton from './shared/GameButton';
import PixelIcon from './shared/PixelIcon';
import { Pixel } from '../modules/pixel';
import { _ } from '../i18n';
import { useEffect, useRef } from 'react';

function Lines({ lines }) {
  if (!lines || lines.length === 0) return null;
  return (
    <div id="descriptionText">
      {lines.map((s, i) => (
        <div key={i}>{s}</div>
      ))}
    </div>
  );
}

/** 战斗双方：精灵/字符 + 血条 + 状态标签 */
function Fighter({ f, side }) {
  if (!f) return null;
  const pct = f.maxHp > 0 ? Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100)) : 0;
  const status = f.status && f.status !== 'none' ? f.status : null;
  const cls = ['fighter', side, status].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className="hp">
        <div className="hpBar">
          <div className="hpFill" style={{ width: pct + '%' }} />
        </div>
        <span className="hpText">
          {f.hp}/{f.maxHp}
        </span>
      </div>
      <div className="fig">
        {side === 'player' && <PixelIcon name="player" pixel={3} />}
        {side === 'enemy' && f.sprite && <PixelIcon name={f.sprite} pixel={3} />}
        {side === 'enemy' && !f.sprite && <span className="chara">{f.chara || '?'}</span>}
        {side === 'player' && <span className="chara">{f.chara || '@'}</span>}
      </div>
      <div className="label">{side === 'enemy' && f.name ? f.name : _('wanderer')}</div>
    </div>
  );
}

function Floats({ floats }) {
  if (!floats || floats.length === 0) return null;
  return (
    <div className="floatLayer">
      {floats.map((f) => (
        <div key={f.id} className={'floatText ' + f.side}>
          {f.text}
        </div>
      ))}
    </div>
  );
}

function Loot({ loot }) {
  if (!loot) return null;
  return (
    <div id="lootButtons">
      {loot.rows.map((r) => (
        <div className="lootRow" key={r.key}>
          <div className="row_key">
            <PixelIcon name={Pixel.resourceSprite(r.key)} pixel={2} />
            {r.name}
          </div>
          <div className="row_val">
            {r.numLeft}
            {r.total > 0 && <span className="lootTotal">/{r.total}</span>}
          </div>
          <GameButton
            id={'take_' + r.key.replace(/ /g, '-')}
            text={_('take')}
            width="64px"
            onClick={() => Events.actions.takeLoot(r.key, 1)}
          />
        </div>
      ))}
      {loot.canTakeAll && (
        <div className="lootRow takeAllRow">
          <GameButton id="takeAllBtn" text={_('take all')} onClick={() => Events.actions.takeAllLoot()} />
        </div>
      )}
    </div>
  );
}

function DropMenu({ rows }) {
  return (
    <div id="dropMenu">
      {rows.map((r) => (
        <div key={r.key} onClick={() => Events.actions.dropStuff(r.key, r.num)}>
          {_('drop {0} {1}', r.num, r.name)}
        </div>
      ))}
      <div className="dropCancel" onClick={() => Events.actions.cancelDrop()}>
        {_('cancel')}
      </div>
    </div>
  );
}

function Textarea({ ta }) {
  const ref = useRef(null);
  useEffect(() => {
    // 默认把光标放进输入框；只读（导出代码）时自动全选，方便直接复制
    if (!ref.current) return;
    ref.current.focus();
    if (ta.readonly) ref.current.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!ta) return null;
  return (
    <textarea
      ref={ref}
      readOnly={!!ta.readonly}
      value={ta.value}
      onChange={(e) => Events.setTextarea(e.target.value)}
    />
  );
}

export default function EventModal() {
  const current = useEvents((s) => s.current);
  const snap = useEvents((s) => s.snap);
  if (!current || !snap) return null;

  return (
    <div id="eventOverlay">
      <div className={'eventPanel event-' + snap.mode}>
        <div className="eventTitle">{snap.title}</div>
        <div id="description">
          {snap.mode === 'fight' && (
            <>
              <Lines lines={snap.lines} />
              <div className="arena">
                <Floats floats={snap.floats} />
                <Fighter f={snap.player} side="player" />
                <Fighter f={snap.enemy} side="enemy" />
              </div>
              <div className="fightControls">
                {snap.attackButtons.length > 0 && (
                  <div id="attackButtons">
                    {snap.attackButtons.map((b) => (
                      <GameButton
                        key={b.id}
                        id={b.id}
                        text={b.text}
                        icon={b.icon}
                        cooldown={b.cooldown}
                        cost={b.cost}
                        disabled={b.disabled}
                        onClick={() => Events.actions.attack(b.weapon)}
                      />
                    ))}
                  </div>
                )}
                {snap.healButtons.length > 0 && (
                  <div id="healButtons">
                    {snap.healButtons.map((b) => (
                      <GameButton
                        key={b.id}
                        id={b.id}
                        text={b.text}
                        icon={b.icon}
                        cooldown={b.cooldown}
                        cost={b.cost}
                        disabled={b.disabled}
                        onClick={() => Events.actions.heal(b.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {snap.mode === 'result' && (
            <>
              <Lines lines={snap.lines} />
              <Loot loot={snap.loot} />
            </>
          )}

          {snap.mode === 'story' && (
            <>
              <Lines lines={snap.lines} />
              {snap.textarea && <Textarea ta={snap.textarea} />}
              <Loot loot={snap.loot} />
            </>
          )}

          {snap.dropMenu && <DropMenu rows={snap.dropMenu} />}
        </div>

        {snap.buttons.length > 0 && (
          <div id="buttons">
            {snap.buttons.map((b) => (
              <GameButton
                key={b.id}
                id={b.id}
                text={b.text}
                cost={b.cost}
                cooldown={b.cooldown}
                disabled={b.disabled}
                onClick={() =>
                  b.kind === 'default-leave'
                    ? Events.actions.leave()
                    : Events.actions.clickStory(b.id)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
