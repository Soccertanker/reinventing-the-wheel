import { describe, expect, it } from 'vitest';
import { content, duration, enqueue, newSave, nextLoop, tick, visible, type BoulderSave } from './logic';

const task = (id: string) => {
  const t = content.tasks.find((x) => x.id === id);
  if (!t) throw new Error(id);
  return t;
};

/** Plays a loop: queues tasks in order (waiting when the queue is full), returns the save at the end. */
function play(s: BoulderSave, plan: string[]): BoulderSave {
  let i = 0;
  while (!s.run.over) {
    while (i < plan.length) {
      const next = enqueue(s, plan[i] as string);
      if (next === s) break;
      s = next;
      i++;
    }
    s = tick(s, 0.5);
  }
  return s;
}

describe('boulder', () => {
  it('the boulder ends the loop at 60 seconds', () => {
    expect(tick(newSave(), 61).run.elapsed).toBe(0); // waits for your first move
    const s = tick(enqueue(newSave(), 'nap'), 61);
    expect(s.run.over?.kind).toBe('death');
    expect(s.run.elapsed).toBe(content.loopSeconds);
  });

  it('a first-loop player cannot just do everything in time', () => {
    const s = play(newSave(), ['elder', 'kid', 'borrow', 'gather', 'gather', 'sharpen', 'chisel', 'chop', 'axle', 'chop', 'cart']);
    expect(s.run.over?.kind).toBe('death');
  });

  it('knowledge and muscle memory persist, and a learned route escapes within a few loops', () => {
    let s = play(newSave(), ['elder', 'kid', 'explore', 'gather', 'sharpen']);
    expect(s.knowledge).toEqual(expect.arrayContaining(['elder', 'kid', 'shortcut']));
    const route = ['borrow', 'gather', 'gather', 'sharpen', 'chisel', 'chopShortcut', 'axle', 'chopShortcut', 'cart'];
    let loops = 1;
    do {
      s = play(nextLoop(s), route);
      loops++;
    } while (s.run.over?.kind !== 'escape' && loops < 10);
    expect(s.run.over?.kind).toBe('escape');
    expect(loops).toBeLessThanOrEqual(4);
    expect(duration(s, task('chisel'))).toBeLessThan(task('chisel').seconds);
  });

  it('the secret ending: ride the boulder', () => {
    let s = newSave();
    s = play(s, ['elder', 'nap', 'nap', 'nap', 'watch']);
    expect(s.knowledge).toContain('boulder');
    s = enqueue(nextLoop(s), 'nap');
    expect(visible(s, task('ride'))).toBe(false); // only near the end
    s = tick(s, 50.5);
    s = enqueue(s, 'ride');
    s = tick(s, 3);
    expect(s.run.over?.kind).toBe('secret');
    expect(s.endings).toContain('secret');
  });

  it('borrowing the toy only works once per loop, and needs the kid knowledge', () => {
    let s = newSave();
    expect(enqueue(s, 'borrow')).toBe(s);
    s.knowledge.push('kid');
    s = enqueue(s, 'borrow');
    expect(enqueue(s, 'borrow')).toBe(s);
  });
});
