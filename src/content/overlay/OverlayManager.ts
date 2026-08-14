import type { OverlayState, Region } from '@type/index';
import { OVERLAY_ID, OVERLAY_Z_INDEX, REGION_SELECTION_MIN_SIZE } from '@shared/constants';
import { eventBus } from '@utils/eventBus';
import { logger } from '@utils/logger';
import { getCaptureViewportSize } from '@utils/viewport';

export class OverlayManager {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private state: OverlayState = 'idle';
  private isSelecting = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private topOffset = 0;
  private animationId: number | null = null;
  private lastDpr = 1;
  private onComplete: ((region: Region) => void) | null = null;
  private onCancel: (() => void) | null = null;
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleMouseMoveBound: (e: MouseEvent) => void;
  private handleMouseUpBound: (e: MouseEvent) => void;
  private handleMouseLeaveBound: () => void;
  private handleResizeBound: () => void;
  private handleFullscreenChangeBound: () => void;

  constructor() {
    this.handleKeyDownBound = this.handleKeyDown.bind(this);
    this.handleMouseMoveBound = this.handleMouseMove.bind(this);
    this.handleMouseUpBound = this.handleMouseUp.bind(this);
    this.handleMouseLeaveBound = this.handleMouseLeave.bind(this);
    this.handleResizeBound = this.handleResize.bind(this);
    this.handleFullscreenChangeBound = this.handleFullscreenChange.bind(this);
  }

  show(options?: { onComplete?: (region: Region) => void; onCancel?: () => void; topOffset?: number }): void {
    if (this.state !== 'idle') return;

    this.onComplete = options?.onComplete ?? null;
    this.onCancel = options?.onCancel ?? null;
    this.topOffset = options?.topOffset ?? 0;
    this.isSelecting = false;

    this.createCanvas();
    this.raiseToTop();
    this.canvas!.style.display = 'block';
    this.state = 'selecting';

    document.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('resize', this.handleResizeBound);
    document.addEventListener('fullscreenchange', this.handleFullscreenChangeBound);

    this.startRenderLoop();

    eventBus.emit('overlay:shown', undefined);
    eventBus.emit('overlay:stateChange', 'selecting');
    logger.debug('Overlay shown');
  }

  startSelection(clientX: number, clientY: number): void {
    if (this.state === 'idle') {
      this.createCanvas();
      this.raiseToTop();
      this.canvas!.style.display = 'block';
      this.state = 'selecting';
      document.addEventListener('keydown', this.handleKeyDownBound);
      window.addEventListener('resize', this.handleResizeBound);
      document.addEventListener('fullscreenchange', this.handleFullscreenChangeBound);
    }

    this.isSelecting = true;
    this.startX = clientX;
    this.startY = clientY;
    this.currentX = clientX;
    this.currentY = clientY;

    document.addEventListener('mousemove', this.handleMouseMoveBound);
    document.addEventListener('mouseup', this.handleMouseUpBound);
    document.addEventListener('mouseleave', this.handleMouseLeaveBound);
    this.canvas!.addEventListener('mouseleave', this.handleMouseLeaveBound);

    if (this.animationId === null) {
      this.startRenderLoop();
    }

    logger.debug('Selection started', { x: clientX, y: clientY });
  }

  hide(): void {
    if (this.state === 'idle') return;

    this.isSelecting = false;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.removeEventListeners();

    if (this.canvas) {
      this.canvas.style.display = 'none';
    }

    this.state = 'idle';
    this.onComplete = null;
    this.onCancel = null;

    eventBus.emit('overlay:hidden', undefined);
    eventBus.emit('overlay:stateChange', 'idle');
    logger.debug('Overlay hidden');
  }

  isVisible(): boolean {
    return this.state !== 'idle';
  }

  getState(): OverlayState {
    return this.state;
  }

  setState(state: OverlayState): void {
    this.state = state;
    eventBus.emit('overlay:stateChange', state);
  }

  getElement(): HTMLCanvasElement | null {
    return this.canvas;
  }

  destroy(): void {
    this.hide();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    logger.debug('Overlay destroyed');
  }

  private createCanvas(): void {
    if (this.canvas) return;

    this.canvas = document.createElement('canvas');
    this.canvas.id = OVERLAY_ID;
    this.canvas.style.cssText = `
      position: fixed;
      top: ${this.topOffset}px;
      left: 0;
      z-index: ${OVERLAY_Z_INDEX};
      display: none;
      cursor: crosshair;
    `;

    this.ctx = this.canvas.getContext('2d')!;
    this.resizeCanvas();
    this.raiseToTop();
  }

  /**
   * In element fullscreen (YouTube player, etc.) the fullscreen element is
   * promoted to the browser's top layer and becomes the containing block for
   * its fixed-position descendants, so the canvas must live INSIDE that
   * element to stay on top and aligned with clientX/clientY coordinates —
   * hosting it in the fullscreen element (whose box equals the screen) keeps
   * the drag box tracking the cursor exactly. Falls back to the document root.
   */
  private raiseToTop(): void {
    if (!this.canvas) return;
    const host = document.fullscreenElement ?? document.documentElement;
    host.appendChild(this.canvas);
  }

  /**
   * Size the canvas to the viewport. CSS size is set in explicit pixels (not
   * percentages) and the backing store tracks devicePixelRatio, which browser
   * zoom mutates while window.innerWidth does not — so the overlay re-scales
   * with the page zoom and the drag box stays glued to the content.
   */
  private resizeCanvas(): void {
    if (!this.canvas || !this.ctx) return;
    const { width, height } = getCaptureViewportSize();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${Math.max(0, height - this.topOffset)}px`;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(Math.max(0, height - this.topOffset) * dpr);
    this.lastDpr = dpr;
  }

  private handleResize(): void {
    this.resizeCanvas();
  }

  private handleFullscreenChange(): void {
    if (this.state === 'idle') return;
    // Re-parent into (or out of) the fullscreen element and re-measure the
    // viewport — clientY is relative to the screen in fullscreen, so the box
    // would drift if we kept the window-sized canvas.
    this.raiseToTop();
    this.resizeCanvas();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.cancelSelection();
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isSelecting) return;
    this.currentX = e.clientX;
    this.currentY = e.clientY;
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.isSelecting) return;
    if (e.button !== 0) return;

    this.currentX = e.clientX;
    this.currentY = e.clientY;
    this.completeSelection();
  }

  private handleMouseLeave(): void {
    if (this.isSelecting) {
      this.cancelSelection();
    }
  }

  private completeSelection(): void {
    if (!this.isSelecting) return;

    const region = this.normalizeRegion();
    this.isSelecting = false;

    this.removeSelectionListeners();

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (region.width < REGION_SELECTION_MIN_SIZE || region.height < REGION_SELECTION_MIN_SIZE) {
      this.cancelSelection();
      return;
    }

    this.state = 'capturing';
    eventBus.emit('overlay:stateChange', 'capturing');

    // Hide the overlay BEFORE the capture round-trip screenshots the page —
    // otherwise the dim mask and selection box are baked into the crop and
    // every OCR pass reads a darkened image.
    const complete = this.onComplete;
    this.hide();
    complete?.(region);
  }

  private cancelSelection(): void {
    this.isSelecting = false;
    this.removeSelectionListeners();

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.ctx?.clearRect(0, 0, this.canvas!.width, this.canvas!.height);

    // Hide first (state → idle) so onCancel can immediately re-show the
    // overlay without hitting the "already active" guard. Capture the
    // callback before hiding — hide() clears it.
    const onCancel = this.onCancel;
    this.hide();

    onCancel?.();
  }

  private removeSelectionListeners(): void {
    document.removeEventListener('mousemove', this.handleMouseMoveBound);
    document.removeEventListener('mouseup', this.handleMouseUpBound);
    document.removeEventListener('mouseleave', this.handleMouseLeaveBound);
    this.canvas?.removeEventListener('mouseleave', this.handleMouseLeaveBound);
  }

  private removeEventListeners(): void {
    document.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('resize', this.handleResizeBound);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChangeBound);
    this.removeSelectionListeners();
  }

  private normalizeRegion(): Region {
    const x = Math.min(this.startX, this.currentX);
    const y = Math.min(this.startY, this.currentY);
    const w = Math.abs(this.currentX - this.startX);
    const h = Math.abs(this.currentY - this.startY);
    return { x, y, width: w, height: h };
  }

  private startRenderLoop(): void {
    const draw = () => {
      this.render();
      this.animationId = requestAnimationFrame(draw);
    };
    this.animationId = requestAnimationFrame(draw);
  }

  private render(): void {
    const c = this.canvas!;
    const ctx = this.ctx!;
    const dpr = window.devicePixelRatio || 1;
    // Browser zoom changes devicePixelRatio without always firing window
    // resize — re-measure here (render runs every frame) so the backing store
    // tracks the zoom and the drag box never drifts from the content.
    if (dpr !== this.lastDpr) {
      this.resizeCanvas();
      this.lastDpr = dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = c.width / dpr;
    const h = c.height / dpr;

    ctx.clearRect(0, 0, w, h);

    if (!this.isSelecting) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const region = this.normalizeRegion();

    // The canvas top edge sits topOffset px below the viewport top (PDF
    // window: below its toolbar), but region coordinates are viewport-relative
    // (clientX/clientY). Without shifting the drawn box up by topOffset it
    // appears shifted downwards by exactly the toolbar height.
    const drawY = region.y - this.topOffset;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, w, h);

    ctx.clearRect(region.x, drawY, region.width, region.height);

    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(region.x, drawY, region.width, region.height);

    ctx.fillStyle = 'rgba(88, 166, 255, 0.08)';
    ctx.fillRect(region.x, drawY, region.width, region.height);
  }
}
