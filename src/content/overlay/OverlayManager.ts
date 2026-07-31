import type { OverlayState, Region } from '@type/index';
import { OVERLAY_ID, OVERLAY_Z_INDEX, REGION_SELECTION_MIN_SIZE } from '@shared/constants';
import { eventBus } from '@utils/eventBus';
import { logger } from '@utils/logger';

export class OverlayManager {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private state: OverlayState = 'idle';
  private isSelecting = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private animationId: number | null = null;
  private onComplete: ((region: Region) => void) | null = null;
  private onCancel: (() => void) | null = null;
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleMouseMoveBound: (e: MouseEvent) => void;
  private handleMouseUpBound: (e: MouseEvent) => void;
  private handleMouseLeaveBound: () => void;
  private handleResizeBound: () => void;

  constructor() {
    this.handleKeyDownBound = this.handleKeyDown.bind(this);
    this.handleMouseMoveBound = this.handleMouseMove.bind(this);
    this.handleMouseUpBound = this.handleMouseUp.bind(this);
    this.handleMouseLeaveBound = this.handleMouseLeave.bind(this);
    this.handleResizeBound = this.handleResize.bind(this);
  }

  show(options?: { onComplete?: (region: Region) => void; onCancel?: () => void }): void {
    if (this.state !== 'idle') return;

    this.onComplete = options?.onComplete ?? null;
    this.onCancel = options?.onCancel ?? null;
    this.isSelecting = false;

    this.createCanvas();
    this.canvas!.style.display = 'block';
    this.state = 'selecting';

    document.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('resize', this.handleResizeBound);

    this.startRenderLoop();

    eventBus.emit('overlay:shown', undefined);
    eventBus.emit('overlay:stateChange', 'selecting');
    logger.debug('Overlay shown');
  }

  startSelection(clientX: number, clientY: number): void {
    if (this.state === 'idle') {
      this.createCanvas();
      this.canvas!.style.display = 'block';
      this.state = 'selecting';
      document.addEventListener('keydown', this.handleKeyDownBound);
      window.addEventListener('resize', this.handleResizeBound);
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
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: ${OVERLAY_Z_INDEX};
      display: none;
      cursor: crosshair;
    `;

    this.ctx = this.canvas.getContext('2d')!;
    this.resizeCanvas();
    document.body.appendChild(this.canvas);
  }

  private resizeCanvas(): void {
    if (!this.canvas || !this.ctx) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private handleResize(): void {
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

    this.onComplete?.(region);
    this.hide();
  }

  private cancelSelection(): void {
    this.isSelecting = false;
    this.removeSelectionListeners();

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.ctx?.clearRect(0, 0, this.canvas!.width, this.canvas!.height);

    this.onCancel?.();
    this.hide();
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
    const w = c.width;
    const h = c.height;

    ctx.clearRect(0, 0, w, h);

    if (!this.isSelecting) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const region = this.normalizeRegion();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, w, h);

    ctx.clearRect(region.x, region.y, region.width, region.height);

    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(region.x, region.y, region.width, region.height);

    ctx.fillStyle = 'rgba(88, 166, 255, 0.08)';
    ctx.fillRect(region.x, region.y, region.width, region.height);

    const label = `${region.width} × ${region.height}`;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const textMetrics = ctx.measureText(label);
    const padX = 8;
    const padY = 4;
    const labelX = region.x;
    const labelY = region.y + region.height + 4;

    ctx.fillStyle = '#161b22';
    ctx.fillRect(labelX - padX, labelY - padY, textMetrics.width + padX * 2, 20);

    ctx.fillStyle = '#8b949e';
    ctx.fillText(label, labelX, labelY);
  }
}
