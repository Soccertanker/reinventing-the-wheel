import { equipmentCost, experimentSeconds, funding, studentCost, verdict, type LabParams, type LabState } from '../../core/mechanics/lab';
import { bar, h, setDisabled, setRange, setText } from '../dom';
import { fmt, fmtRate } from '../format';
import type { MountView } from './types';
import { wheelSvg } from './wheelArt';

const money = (n: number) => `$${fmt(n)}`;

export const mountLab: MountView = (root, era, api) => {
  const c = era.config as LabParams;
  const made = h('span');
  const grants = h('span');
  const art = wheelSvg();
  const score = h('div', { class: 'score' });
  const verdictEl = h('div', { class: 'muted' });
  const progress = bar();
  const run = h('button', { class: 'big', onclick: () => (api.tap(), api.act({ type: 'run' })) }, 'Run experiment');
  const useBest = h('button', { onclick: () => api.act({ type: 'useBest' }) });
  const knobs = c.knobs.map((k, i) => {
    const input = h('input', {
      type: 'range',
      min: 0,
      max: 100,
      step: 1,
      oninput: (e) => api.act({ type: 'knob', index: i, value: Number((e.target as HTMLInputElement).value) }),
    });
    const val = h('span', { class: 'muted' });
    const el = h('label', { class: 'knob' }, h('span', {}, k.name, ' ', val), input, h('span', { class: 'ends' }, h('small', {}, k.low), h('small', {}, k.high)));
    return { input, val, el };
  });
  const hire = h('button', { onclick: () => api.act({ type: 'hireStudent' }) });
  const equip = h('button', { onclick: () => api.act({ type: 'buyEquipment' }) });
  const stats = h('p', { class: 'muted' });

  root.append(
    h('p', { class: 'count' }, made, ' prototypes passed QA'),
    h('p', { class: 'muted' }, 'Grant money: ', grants),
    h(
      'div',
      { class: 'panel lab' },
      h('div', { class: 'lab-result' }, art.el, h('div', {}, score, verdictEl)),
      ...knobs.map((k) => k.el),
      progress.el,
      h('div', { class: 'row' }, run, useBest),
    ),
    h('h3', {}, 'Department'),
    h('div', { class: 'row' }, hire, equip),
    stats,
  );

  return {
    update(st) {
      const s = st as LabState;
      setText(made, fmt(s.made));
      setText(grants, money(s.grants));
      knobs.forEach((k, i) => {
        setRange(k.input, s.knobs[i] ?? 50);
        setText(k.val, String(Math.round(s.knobs[i] ?? 50)));
      });
      if (s.last) {
        setText(score, `${s.last.score.toFixed(1)}% round`);
        setText(verdictEl, `${verdict(c, s.last.score)} ${s.last.passed ? '✓ passed' : '✗ rejected'} (by ${s.last.by})`);
        art.draw(Math.max(0, (100 - s.last.score) / 60), s.experiments);
      } else {
        setText(score, 'No experiments yet');
        setText(verdictEl, `Tune the knobs and run an experiment. QA passes at ${c.passScore}% round.`);
        art.draw(1, 1);
      }
      const total = experimentSeconds(c, s);
      progress.set(s.manual ? 1 - s.manual.remaining / total : 0);
      setDisabled(run, !!s.manual);
      setText(run, s.manual ? `Experimenting... ${Math.max(0, s.manual.remaining).toFixed(1)}s` : `Run experiment (${total.toFixed(1)}s)`);
      setText(useBest, s.best ? `Use best settings (${s.best.score.toFixed(1)}%)` : 'Use best settings');
      setDisabled(useBest, !s.best);
      const hc = studentCost(c, s);
      setText(hire, `Hire grad student (${money(hc)})`);
      setDisabled(hire, s.grants < hc);
      const ec = equipmentCost(c, s);
      setText(equip, `${c.equipment.name} lv${s.equipment + 1} (${money(ec)})`);
      setDisabled(equip, s.grants < ec);
      setText(
        stats,
        `${s.students} grad student${s.students === 1 ? '' : 's'} (they tweak your best result and keep improvements) · ` +
          `${s.papers} papers (funding ×${fmtRate(funding(c, s))}) · ${fmt(s.experiments)} experiments`,
      );
    },
  };
};
