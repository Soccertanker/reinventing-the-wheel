import { describe, expect, it } from 'vitest';
import { choose, content, ending, locked, newSave, node, reincarnate, shownChoices, type StorySave } from './story';

/** Explores every possible playthrough (the story is a DAG); returns endings reachable. */
function reachableEndings(endingsFound: number): Set<string> {
  const found = new Set<string>();
  const fakeEndings = content.endings.slice(0, endingsFound).map((e) => e.id);
  const walk = (s: StorySave, depth: number) => {
    if (depth > 50) throw new Error('cycle?');
    if (ending(s.at)) {
      found.add(s.at);
      return;
    }
    shownChoices(s).forEach((ch, i) => {
      if (!locked(s, ch)) walk(choose(s, i), depth + 1);
    });
  };
  walk({ ...newSave(), endings: fakeEndings }, 0);
  return found;
}

describe('story', () => {
  it('every ending is reachable (once enough endings are found for the secret one)', () => {
    const all = reachableEndings(content.endings.length);
    expect([...all].sort()).toEqual(content.endings.map((e) => e.id).sort());
  });

  it('the secret ending needs other endings first', () => {
    expect(reachableEndings(0).has('end_enlightened')).toBe(false);
  });

  it('choices add traits; locked choices explain why', () => {
    let s = choose(newSave(), 0); // spin
    expect(s.traits.spin).toBe(1);
    expect(node(s.at)?.id).toBe('potter');
    s = { ...s, at: 'office' };
    const fidget = shownChoices(s).find((c) => c.to === 'end_fidget');
    expect(fidget && locked({ ...s, traits: {} }, fidget)).toMatch(/Spin/);
  });

  it('reaching an ending records it; reincarnating keeps endings but resets the life', () => {
    let s = newSave();
    s = choose(s, 2); // roll away
    s = choose(s, 1); // sink
    expect(s.at).toBe('end_atlantis');
    expect(s.endings).toEqual(['end_atlantis']);
    s = reincarnate(s);
    expect(s.at).toBe(content.start);
    expect(s.endings).toEqual(['end_atlantis']);
    expect(s.lives).toBe(2);
    expect(s.traits).toEqual({});
  });
});
