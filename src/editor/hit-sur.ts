import type { Point } from './parts/registry.js';

export interface HitSurOptions {
  hitX: number;
  hitY: number;
  tolerance?: number;
}

export class HitSur {
  hitX: number;
  hitY: number;
  tolerance: number;
  hit: boolean = false;

  constructor(options: HitSurOptions) {
    this.hitX = options.hitX;
    this.hitY = options.hitY;
    this.tolerance = options.tolerance ?? 4;
  }

  reset(): void {
    this.hit = false;
  }

  ellipse(centerX: number, centerY: number, radius: number): boolean {
    const dx = this.hitX - centerX;
    const dy = this.hitY - centerY;
    const dist = dx * dx + dy * dy;
    if (dist <= radius * radius) {
      this.hit = true;
      return true;
    }
    return false;
  }

  rectangle(x1: number, y1: number, x2: number, y2: number): boolean {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    if (this.hitX >= minX && this.hitX <= maxX && this.hitY >= minY && this.hitY <= maxY) {
      this.hit = true;
      return true;
    }
    return false;
  }

  polygon(points: Point[]): boolean {
    if (points.length < 3) return false;

    let crossCount = 0;
    let x1 = points[points.length - 1].x;
    let y1 = points[points.length - 1].y;
    let hx1 = this.hitX >= x1;
    let hy1 = this.hitY > y1;

    for (let i = 0; i < points.length; i++) {
      const x2 = x1;
      const y2 = y1;
      const hx2 = hx1;
      const hy2 = hy1;

      x1 = points[i].x;
      y1 = points[i].y;
      hx1 = this.hitX >= x1;
      hy1 = this.hitY > y1;

      if (y1 === y2 || (!hy1 && !hy2) || (hy1 && hy2) || (hx1 && hx2)) {
        continue;
      }

      if (!hx1 && !hx2) {
        crossCount ^= 1;
        continue;
      }

      if (x2 === x1) {
        if (!hx2) crossCount ^= 1;
        continue;
      }

      if (x2 - ((y2 - this.hitY) * (x1 - x2)) / (y1 - y2) > this.hitX) {
        crossCount ^= 1;
      }
    }

    if (crossCount & 1) {
      this.hit = true;
      return true;
    }
    return false;
  }

  line(x1: number, y1: number, x2: number, y2: number): boolean {
    const tol = this.tolerance;

    if (Math.abs(x2 - x1) > Math.abs(y2 - y1)) {
      let lineY = this.hitY + tol;
      if (x1 > x2) {
        if (this.hitX >= x2 && this.hitX <= x1) {
          lineY = ((y1 - y2) * (this.hitX - x2)) / (x1 - x2) + y2;
        }
      } else {
        if (this.hitX >= x1 && this.hitX <= x2) {
          lineY = ((y2 - y1) * (this.hitX - x1)) / (x2 - x1) + y1;
        }
      }

      if (this.hitY + tol > lineY && this.hitY < lineY + tol) {
        this.hit = true;
        return true;
      }
    } else if (Math.abs(x2 - x1) < Math.abs(y2 - y1)) {
      let lineX = this.hitX + tol;
      if (y1 > y2) {
        if (this.hitY >= y2 && this.hitY <= y1) {
          lineX = ((x1 - x2) * (this.hitY - y2)) / (y1 - y2) + x2;
        }
      } else {
        if (this.hitY >= y1 && this.hitY <= y2) {
          lineX = ((x2 - x1) * (this.hitY - y1)) / (y2 - y1) + x1;
        }
      }

      if (this.hitX + tol > lineX && this.hitX < lineX + tol) {
        this.hit = true;
        return true;
      }
    }

    return false;
  }

  polyline(points: Point[]): boolean {
    for (let i = 0; i < points.length - 1; i++) {
      if (this.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y)) {
        return true;
      }
    }
    return false;
  }
}
