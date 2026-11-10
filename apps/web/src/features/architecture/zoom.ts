export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));

/** Padding the scroll frame keeps around the drawing (p-2 on both sides). */
const PAD = 16;

/**
 * Zoom that shows the whole diagram in the frame. With `readable`, it stays between 70% and 110%
 * so labels can be read on first load (long diagrams then scroll); without it, everything fits.
 */
export function fitZoom(
  frame: { width: number; height: number },
  diagram: { width: number; height: number },
  readable = false,
): number | null {
  if (frame.width <= 0 || diagram.width <= 0) return null;
  const byWidth = (frame.width - PAD) / diagram.width;
  if (readable) return clampZoom(Math.max(0.7, Math.min(1.1, byWidth)));
  const byHeight = frame.height > 0 ? (frame.height - PAD) / diagram.height : byWidth;
  return clampZoom(Math.min(byWidth, byHeight, 1.5));
}
