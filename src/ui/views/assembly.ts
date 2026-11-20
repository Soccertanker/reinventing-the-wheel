import { machineCost, MAX_PRESSURE, speedAt, stokerCost, type AssemblyParams, type AssemblyState } from '../../core/mechanics/assembly';
import { bar, h, setDisabled, setText } from '../dom';
import { fmt, fmtRate, pct } from '../format';
import type { MountView } from './types';

export const mountAssembly: MountView = (root, era, api) => {
  const c = era.config as AssemblyParams;
  const wheels = h('span');
  const gauge = bar();
  const pressure = h('span');
  const speed = h('span');
  const shovel = h('button', { class: 'big', onclick: () => (api.tap(), api.act({ type: 'shovel' })) }, 'Shovel coal');
  const valve = h('button', { onclick: () => api.act({ type: 'valve' }) });
  const stoker = h('button', { onclick: () => api.act({ type: 'buyStoker' }) });
  const stokers = h('span');
  const booms = h('span', { class: 'muted' });

  const stages = c.stages.map((st) => {
    const count = h('span', { class: 'owned' });
    const stock = h('small');
    const buy = h('button', { onclick: () => api.act({ type: 'buyMachine', stage: st.id }) });
    const ins = Object.entries(st.inputs)
      .map(([r, q]) => `${q} ${c.resources[r] ?? r}`)
      .join(' + ');
    const out = st.output === 'wheel' ? 'wheel' : `${st.outputQty} ${c.resources[st.output] ?? st.output}`;
    const li = h('li', {}, h('div', {}, h('strong', {}, st.name), ' ', count, h('small', {}, `${ins || 'raw ore'} → ${out}`), stock), buy);
    return { st, count, stock, buy, li };
  });

  root.append(
    h('p', { class: 'count' }, wheels, ' wheels'),
    h('div', { class: 'panel' }, h('div', { class: 'row' }, h('span', {}, 'Boiler pressure '), pressure, speed), gauge.el, h('div', { class: 'row' }, shovel), h('div', { class: 'row' }, valve, stoker), h('p', { class: 'muted' }, stokers, ' · ', booms)),
    h('h3', {}, 'Production line'),
    h('ul', { class: 'shop' }, ...stages.map((x) => x.li)),
  );

  return {
    update(st) {
      const s = st as AssemblyState;
      setText(wheels, fmt(s.wheels));
      const p = s.pressure / MAX_PRESSURE;
      gauge.set(p, s.pressure > 90 ? 'danger' : s.pressure > c.valveAt ? 'warn' : '');
      setText(pressure, `${s.pressure.toFixed(0)} / ${MAX_PRESSURE}`);
      setText(speed, s.pressure <= 0 ? ' · machines idle (no steam!)' : ` · line speed ${pct(speedAt(s.pressure) / 1.5)}`);
      setText(valve, s.valve ? `Safety valve: ON (caps at ${c.valveAt})` : 'Safety valve: OFF (living dangerously)');
      valve.classList.toggle('danger', !s.valve);
      const sc = stokerCost(c, s);
      setText(stoker, `Hire ${c.stoker.name} (${fmt(sc)})`);
      setDisabled(stoker, s.wheels < sc);
      setText(stokers, `${s.stokers} stoker${s.stokers === 1 ? '' : 's'} adding ${fmtRate(s.stokers * c.stoker.pressurePerSecond)} pressure/s`);
      setText(booms, s.explosions ? `${s.explosions} boiler explosion${s.explosions === 1 ? '' : 's'}` : 'no explosions (yet)');
      for (const x of stages) {
        setText(x.count, `×${s.machines[x.st.id] ?? 0}`);
        const cost = machineCost(x.st, s);
        setText(x.buy, `+1 ${x.st.machine} (${fmt(cost)})`);
        setDisabled(x.buy, s.wheels < cost);
        if (x.st.output !== 'wheel') {
          const n = s.stock[x.st.output] ?? 0;
          setText(x.stock, `In stock: ${fmt(n)} ${c.resources[x.st.output] ?? x.st.output}`);
        } else {
          const starved = Object.keys(x.st.inputs).filter((r) => (s.stock[r] ?? 0) < (x.st.inputs[r] ?? 0));
          setText(x.stock, starved.length ? `Waiting on: ${starved.map((r) => c.resources[r] ?? r).join(', ')}` : 'Assembling!');
        }
      }
    },
  };
};
