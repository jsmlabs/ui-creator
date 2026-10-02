import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface Options {
  initial: number;
  min: number;
  max: number;
  direction: "left" | "right";
}

export function useResizablePanel({ initial, min, max, direction }: Options) {
  const [size, setSize] = useState(initial);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startSize = useRef(initial);

  const beginResize = useCallback((event: ReactPointerEvent) => {
    dragging.current = true;
    startX.current = event.clientX;
    startSize.current = size;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.dataset.resizing = "true";
  }, [size]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      const delta = event.clientX - startX.current;
      const next = direction === "left"
        ? startSize.current + delta
        : startSize.current - delta;
      setSize(Math.min(max, Math.max(min, next)));
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      delete document.body.dataset.resizing;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      delete document.body.dataset.resizing;
    };
  }, [direction, max, min]);

  return { size, beginResize };
}
