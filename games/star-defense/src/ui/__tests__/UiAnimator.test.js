import { UiAnimator, EASE } from '../UiAnimator.js';

describe('UiAnimator', () => {
  test('play 触发 onUpdate, 进度从 0 到 1', () => {
    const cb = vi.fn();
    const anim = new UiAnimator();
    anim.play({ duration: 0.1, ease: EASE.linear, onUpdate: cb });
    // Node rAF polyfill 基于 setTimeout，首帧进度与完成时机受事件负载影响：
    // 只断言契约本身 —— 首帧 < 1（未瞬间完成）、末帧恰好 1（动画收敛）
    return new Promise(r => setTimeout(r, 1000)).then(() => {
      expect(cb).toHaveBeenCalled();
      expect(cb.mock.calls[0][0]).toBeGreaterThanOrEqual(0);
      expect(cb.mock.calls[0][0]).toBeLessThan(1);
      // onUpdate 以 (ease(t), t) 两参调用，末帧 ease 值恰为 1
      const lastCall = cb.mock.calls[cb.mock.calls.length - 1];
      expect(lastCall[0]).toBe(1);
    });
  });

  test('支持 delay', () => {
    const cb = jest.fn();
    const anim = new UiAnimator();
    anim.play({ duration: 0.05, delay: 0.05, ease: EASE.linear, onUpdate: cb });
    return new Promise(r => setTimeout(() => {
      expect(cb).not.toHaveBeenCalled();
      r();
    }, 30));
  });

  test('stop 可中断动画', () => {
    const cb = jest.fn();
    const anim = new UiAnimator();
    const id = anim.play({ duration: 1, ease: EASE.linear, onUpdate: cb });
    anim.stop(id);
    expect(anim.activeCount).toBe(0);
  });
});
