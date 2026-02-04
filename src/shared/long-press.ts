const LONG_PRESS_DURATION = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;

export function addLongPressContextMenu(element: HTMLElement): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startPos: { x: number; y: number } | null = null;

  function cancel(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    startPos = null;
  }

  function onPointerDown(e: PointerEvent): void {
    cancel();
    if (e.button === 0 && e.pointerType === 'touch') {
      startPos = { x: e.clientX, y: e.clientY };
      timer = setTimeout(() => {
        timer = null;
        const contextEvent = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
        });
        Object.defineProperty(contextEvent, 'offsetX', { value: e.offsetX });
        Object.defineProperty(contextEvent, 'offsetY', { value: e.offsetY });
        element.dispatchEvent(contextEvent);
      }, LONG_PRESS_DURATION);
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (startPos) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;
      if (Math.abs(dx) > LONG_PRESS_MOVE_THRESHOLD || Math.abs(dy) > LONG_PRESS_MOVE_THRESHOLD) {
        cancel();
      }
    }
  }

  function onPointerEnd(): void {
    cancel();
  }

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerEnd);
  element.addEventListener('pointercancel', onPointerEnd);

  return () => {
    cancel();
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerEnd);
    element.removeEventListener('pointercancel', onPointerEnd);
  };
}
