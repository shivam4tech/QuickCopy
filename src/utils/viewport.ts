/**
 * Size of the viewport the capture overlay / crop math should use.
 *
 * When a page element is fullscreen (e.g. YouTube's player), the browser
 * shrinks the layout viewport the overlay is drawn against and
 * window.innerWidth/innerHeight no longer describe the visible area. The
 * visual viewport keeps the true on-screen size, which is what
 * captureVisibleTab returns and what mouse coordinates are relative to.
 */
export function getCaptureViewportSize(): { width: number; height: number } {
  const inFullscreen = typeof document !== 'undefined' && !!document.fullscreenElement;
  if (inFullscreen && typeof window !== 'undefined' && window.visualViewport) {
    const { width, height } = window.visualViewport;
    if (width > 0 && height > 0) return { width, height };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}