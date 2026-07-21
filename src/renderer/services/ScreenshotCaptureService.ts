export type AnnotationType = 'rectangle' | 'arrow' | 'pen' | 'text' | 'highlight';

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Point[];
  text?: string;
  color: string;
  strokeWidth: number;
  order: number;
  createdAt: number;
}

export class ScreenshotCaptureService {
  /**
   * Captures the webview screenshot and returns it as a data URL.
   */
  static async captureWebview(webview: any): Promise<string> {
    if (!webview || typeof webview.capturePage !== 'function') {
      throw new Error('Webview component is not available or does not support capturePage');
    }
    const nativeImage = await webview.capturePage();
    return nativeImage.toDataURL();
  }

  /**
   * Helper to parse hex colors to rgba for highlight fill.
   */
  private static hexToRgba(hex: string, alpha: number): string {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(char => char + char).join('');
    }
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Merges the annotations overlay onto the captured screenshot.
   */
  static async mergeAnnotations(
    screenshotDataUrl: string,
    annotations: Annotation[]
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get 2D canvas context'));
            return;
          }

          // Draw the original screenshot
          ctx.drawImage(img, 0, 0);

          // Draw each annotation
          annotations.forEach((ann) => {
            const sx = ann.x * canvas.width;
            const sy = ann.y * canvas.height;
            const sw = (ann.width || 0) * canvas.width;
            const sh = (ann.height || 0) * canvas.height;

            // Draw shape/vector
            if (ann.type === 'rectangle') {
              ctx.strokeStyle = ann.color;
              ctx.lineWidth = ann.strokeWidth;
              ctx.strokeRect(sx, sy, sw, sh);

              // Draw Badge
              this.drawBadge(ctx, sx, sy, ann.order, ann.color);
            } else if (ann.type === 'highlight') {
              ctx.fillStyle = this.hexToRgba(ann.color, 0.35);
              ctx.fillRect(sx, sy, sw, sh);

              // Draw Badge
              this.drawBadge(ctx, sx, sy, ann.order, ann.color);
            } else if (ann.type === 'arrow') {
              const ex = sx + sw;
              const ey = sy + sh;

              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(ex, ey);
              ctx.strokeStyle = ann.color;
              ctx.lineWidth = ann.strokeWidth;
              ctx.stroke();

              // Arrowhead
              const angle = Math.atan2(ey - sy, ex - sx);
              const arrowLength = 16;
              ctx.beginPath();
              ctx.moveTo(ex, ey);
              ctx.lineTo(
                ex - arrowLength * Math.cos(angle - Math.PI / 6),
                ey - arrowLength * Math.sin(angle - Math.PI / 6)
              );
              ctx.lineTo(
                ex - arrowLength * Math.cos(angle + Math.PI / 6),
                ey - arrowLength * Math.sin(angle + Math.PI / 6)
              );
              ctx.closePath();
              ctx.fillStyle = ann.color;
              ctx.fill();

              // Draw Badge
              this.drawBadge(ctx, sx, sy, ann.order, ann.color);
            } else if (ann.type === 'pen') {
              if (ann.points && ann.points.length > 0) {
                ctx.beginPath();
                ctx.strokeStyle = ann.color;
                ctx.lineWidth = ann.strokeWidth;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.moveTo(ann.points[0].x * canvas.width, ann.points[0].y * canvas.height);
                for (let i = 1; i < ann.points.length; i++) {
                  ctx.lineTo(ann.points[i].x * canvas.width, ann.points[i].y * canvas.height);
                }
                ctx.stroke();

                // Draw Badge at the first point
                this.drawBadge(ctx, ann.points[0].x * canvas.width, ann.points[0].y * canvas.height, ann.order, ann.color);
              }
            } else if (ann.type === 'text') {
              const textVal = ann.text || '';
              // Badge
              this.drawBadge(ctx, sx, sy, ann.order, ann.color);

              // Text Box
              ctx.font = '14px system-ui, -apple-system, sans-serif';
              const metrics = ctx.measureText(textVal);
              const textWidth = metrics.width;
              const boxWidth = textWidth + 16;
              const boxHeight = 26;
              const boxX = sx + 18;
              const boxY = sy - 13;

              // Shadow
              ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
              ctx.shadowBlur = 4;
              ctx.shadowOffsetX = 1;
              ctx.shadowOffsetY = 2;

              // Rounded box background
              ctx.fillStyle = '#1e1e24';
              ctx.strokeStyle = ann.color;
              ctx.lineWidth = 1.5;
              
              // Draw rounded rect manually or via native method
              if (typeof (ctx as any).roundRect === 'function') {
                ctx.beginPath();
                (ctx as any).roundRect(boxX, boxY, boxWidth, boxHeight, 4);
                ctx.fill();
                ctx.stroke();
              } else {
                ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
                ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
              }

              // Reset shadow
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;

              // Draw Text
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(textVal, boxX + 8, boxY + boxHeight / 2 + 1);
            }
          });

          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(err);
      img.src = screenshotDataUrl;
    });
  }

  private static drawBadge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    order: number,
    color: string
  ) {
    ctx.save();
    
    // Circle Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    // Outer white border
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, 2 * Math.PI);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Inner filled color circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, 2 * Math.PI);
    ctx.fill();

    // Text number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(order.toString(), x, y + 0.5);

    ctx.restore();
  }
}
