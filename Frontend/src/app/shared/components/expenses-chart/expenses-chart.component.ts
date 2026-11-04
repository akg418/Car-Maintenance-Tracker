import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { CarDto, MaintenanceRecordDto } from '../../models/api.models';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { WheelSpinnerComponent } from '../wheel-spinner/wheel-spinner.component';

export type ChartPeriod = 'lifetime' | 'day' | 'week' | 'month' | 'year';

export interface ChartPoint {
  label: string;
  subLabel?: string;
  cost: number;
  count: number;
  /** Rendered position in container pixels (y is animated). */
  x: number;
  y: number;
  rawDate?: Date;
}

interface Stats {
  total: number;
  avg: number;
  high: number;
  max: number;
}

interface Delta {
  pct: number;
  up: boolean;
  isNew: boolean;
}

const MORPH_MS = 650;
const STAGGER_MS = 35;
const STATS_MS = 900;
// Spring for the tooltip/crosshair glide; damping ratio ~0.83 gives a slight overshoot.
const SPRING_K = 420;
const SPRING_C = 34;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

let instanceSeq = 0;

@Component({
  selector: 'app-expenses-chart',
  standalone: true,
  imports: [WheelSpinnerComponent, CommonModule, FormsModule, EmptyStateComponent],
  templateUrl: './expenses-chart.component.html',
  styleUrl: './expenses-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpensesChartComponent implements OnInit, AfterViewInit, OnDestroy {
  private maintenanceService = inject(MaintenanceService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  @Input() carsList: CarDto[] = [];

  @ViewChild('plot', { static: true }) plotRef!: ElementRef<HTMLDivElement>;
  @ViewChild('tooltip', { static: true }) tooltipRef!: ElementRef<HTMLDivElement>;
  @ViewChild('tipArrow', { static: true }) tipArrowRef!: ElementRef<HTMLDivElement>;
  @ViewChild('tipCard', { static: true }) tipCardRef!: ElementRef<HTMLDivElement>;
  @ViewChild('pillTrack', { static: true }) pillTrackRef!: ElementRef<HTMLDivElement>;
  @ViewChildren('pill') pillRefs!: QueryList<ElementRef<HTMLButtonElement>>;

  readonly uid = `xc${++instanceSeq}`;
  readonly periods: { key: ChartPeriod; label: string }[] = [
    { key: 'lifetime', label: 'Lifetime' },
    { key: 'day', label: 'Last 24H' },
    { key: 'week', label: 'Last Week' },
    { key: 'month', label: 'Last Month' },
    { key: 'year', label: 'Last Year' },
  ];

  selectedCarId: number | null = null;
  selectedPeriod: ChartPeriod = 'year';
  loading = false;
  records: MaintenanceRecordDto[] = [];

  // Geometry in real pixels: the SVG viewBox equals the container size, so
  // SVG coordinates and the HTML tooltip share one coordinate space.
  width = 800;
  height = 230;
  readonly padLeft = 44;
  readonly padRight = 20;
  readonly padTop = 28;
  readonly padBottom = 34;
  get bottomY() {
    return this.height - this.padBottom;
  }
  get midY() {
    return (this.padTop + this.bottomY) / 2;
  }

  chartPoints: ChartPoint[] = [];
  linePath = '';
  areaPath = '';
  /** Bumped when the series shape changes, to restart the draw-in animations. */
  drawKey = 0;

  maxCost = 100;
  private stats: Stats = { total: 0, avg: 0, high: 0, max: 100 };
  display: Stats = { total: 0, avg: 0, high: 0, max: 100 };
  private statsFrom: Stats = { ...this.display };

  activeIndex: number | null = null;
  /** Last hovered point; keeps tooltip content while it fades out. */
  tipIndex: number | null = null;
  tipDelta: Delta | null = null;
  cursorX = 0;
  cursorY = 0;
  private velX = 0;
  private velY = 0;
  private snapCursor = true;

  pill = { left: 0, width: 0, ready: false };

  private targetYs: number[] = [];
  private fromYs: number[] = [];
  private morphStart = 0;
  private rafId = 0;
  private lastFrame = 0;
  private destroyed = false;
  private reduceMotion = false;
  private resizeObserver?: ResizeObserver;
  private cleanups: (() => void)[] = [];

  get tipPoint(): ChartPoint | null {
    return this.tipIndex === null ? null : (this.chartPoints[this.tipIndex] ?? null);
  }

  ngOnInit() {
    this.reduceMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.loadData();
  }

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => {
      const plot = this.plotRef.nativeElement;
      const onMove = (e: PointerEvent) => this.onPointer(e);
      const onLeave = () => this.setActive(null);
      plot.addEventListener('pointermove', onMove);
      plot.addEventListener('pointerdown', onMove);
      plot.addEventListener('pointerleave', onLeave);
      this.cleanups.push(() => {
        plot.removeEventListener('pointermove', onMove);
        plot.removeEventListener('pointerdown', onMove);
        plot.removeEventListener('pointerleave', onLeave);
      });

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.measure();
          this.positionPill();
          this.cdr.detectChanges();
          this.layoutTooltip();
        });
        this.resizeObserver.observe(plot);
        this.resizeObserver.observe(this.pillTrackRef.nativeElement);
      }
    });
    this.measure();
    requestAnimationFrame(() => {
      this.positionPill();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.cleanups.forEach((fn) => fn());
  }

  // ---------------------------------------------------------------- data

  loadData() {
    this.loading = true;
    const { startDate, endDate } = this.calculatePeriodDates(this.selectedPeriod);

    this.maintenanceService
      .getAllEvents({
        limit: 1000,
        page: 1,
        carId: this.selectedCarId || undefined,
        startDate,
        endDate,
        sortBy: 'maintenanceDate',
        order: 'ASC',
      })
      .subscribe({
        next: (page) => {
          this.records = page.data || [];
          this.processChartData();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  calculatePeriodDates(period: ChartPeriod): { startDate?: string; endDate?: string } {
    if (period === 'lifetime') return {};

    const now = new Date();
    const startDate = new Date();
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    switch (period) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }

  onPeriodChange(period: ChartPeriod) {
    if (this.selectedPeriod !== period) {
      this.selectedPeriod = period;
      this.setActive(null);
      this.loadData();
      requestAnimationFrame(() => {
        this.positionPill();
        this.cdr.detectChanges();
      });
    }
  }

  onCarFilterChange(carIdVal: any) {
    this.selectedCarId = carIdVal ? Number(carIdVal) : null;
    this.setActive(null);
    this.loadData();
  }

  processChartData() {
    let total = 0;
    let high = 0;
    const costs = this.records.map((r) => {
      const c = this.getRecordCost(r);
      total += c;
      if (c > high) high = c;
      return { date: new Date(r.maintenanceDate), cost: c };
    });

    const buckets = this.generateTimeBuckets(this.selectedPeriod, costs);
    this.maxCost = this.niceCeil(Math.max(100, ...buckets.map((b) => b.cost)));
    this.stats = {
      total,
      avg: this.records.length > 0 ? total / this.records.length : 0,
      high,
      max: this.maxCost,
    };
    this.applyData(buckets);
  }

  /** Swap in a new series, morphing from the current curve when the shape matches. */
  private applyData(buckets: ChartPoint[]) {
    const prev = this.chartPoints;
    const sameShape =
      prev.length === buckets.length && prev.every((p, i) => p.label === buckets[i].label);

    this.chartPoints = buckets;
    this.relayout();
    this.fromYs = sameShape ? prev.map((p) => p.y) : buckets.map(() => this.bottomY);
    if (!sameShape) {
      this.drawKey++;
      this.activeIndex = null;
      this.tipIndex = null;
    }
    buckets.forEach((b, i) => (b.y = this.fromYs[i]));

    this.statsFrom = { ...this.display };
    this.morphStart = performance.now();
    this.rebuildPaths();
    this.ensureLoop();
  }

  /** Round up to 1/2/2.5/5 × 10ⁿ so the axis labels are tidy. */
  private niceCeil(v: number): number {
    const p = 10 ** Math.floor(Math.log10(v));
    const step = [1, 2, 2.5, 5, 10].find((s) => s * p >= v) ?? 10;
    return step * p;
  }

  // ------------------------------------------------------------- layout

  private measure() {
    const r = this.plotRef.nativeElement.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (Math.abs(r.width - this.width) < 0.5 && Math.abs(r.height - this.height) < 0.5) return;
    this.width = r.width;
    this.height = r.height;
    this.relayout();
    // Snap to the new geometry rather than animating a resize.
    if (!this.morphStart) this.chartPoints.forEach((p, i) => (p.y = this.targetYs[i]));
    if (this.tipPoint) {
      this.cursorX = this.tipPoint.x;
      this.cursorY = this.tipPoint.y;
    }
    this.rebuildPaths();
  }

  private relayout() {
    const n = this.chartPoints.length;
    const availW = this.width - this.padLeft - this.padRight;
    const availH = this.bottomY - this.padTop;
    this.targetYs = this.chartPoints.map((p, i) => {
      p.x = n > 1 ? this.padLeft + (i / (n - 1)) * availW : this.padLeft + availW / 2;
      return this.bottomY - (p.cost / this.maxCost) * availH;
    });
  }

  private rebuildPaths() {
    const pts = this.chartPoints;
    const bottom = this.bottomY;
    if (pts.length === 0) {
      this.linePath = this.areaPath = '';
      return;
    }
    if (pts.length === 1) {
      const y = pts[0].y.toFixed(1);
      const x0 = this.padLeft;
      const x1 = this.width - this.padRight;
      this.linePath = `M ${x0} ${y} L ${x1} ${y}`;
      this.areaPath = `${this.linePath} L ${x1} ${bottom} L ${x0} ${bottom} Z`;
      return;
    }
    this.linePath = this.buildSmoothPath(pts);
    this.areaPath = `${this.linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${bottom} L ${pts[0].x.toFixed(1)} ${bottom} Z`;
  }

  /** Catmull-Rom → cubic Bézier, with control points clamped so the curve never dips below 0. */
  private buildSmoothPath(points: ChartPoint[]): string {
    const lo = this.padTop - 12;
    const hi = this.bottomY;
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = clamp(p1.y + (p2.y - p0.y) / 6, lo, hi);
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = clamp(p2.y - (p3.y - p1.y) / 6, lo, hi);
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  private positionPill() {
    const idx = this.periods.findIndex((p) => p.key === this.selectedPeriod);
    const btn = this.pillRefs?.get(idx)?.nativeElement;
    if (!btn) return;
    this.pill = { left: btn.offsetLeft, width: btn.offsetWidth, ready: true };
  }

  // -------------------------------------------------------- interaction

  private onPointer(e: PointerEvent) {
    if (this.chartPoints.length === 0) return;
    const x = e.clientX - this.plotRef.nativeElement.getBoundingClientRect().left;
    let best = 0;
    let bestD = Infinity;
    this.chartPoints.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    this.setActive(best);
  }

  onKeydown(e: KeyboardEvent) {
    const n = this.chartPoints.length;
    if (!n) return;
    const cur = this.activeIndex;
    if (e.key === 'ArrowRight') this.setActive(cur === null ? 0 : Math.min(n - 1, cur + 1));
    else if (e.key === 'ArrowLeft') this.setActive(cur === null ? n - 1 : Math.max(0, cur - 1));
    else if (e.key === 'Home') this.setActive(0);
    else if (e.key === 'End') this.setActive(n - 1);
    else if (e.key === 'Escape') this.setActive(null);
    else return;
    e.preventDefault();
  }

  setActive(i: number | null) {
    if (i === this.activeIndex) return;
    const wasActive = this.activeIndex !== null;
    this.activeIndex = i;
    if (i !== null) {
      this.tipIndex = i;
      this.tipDelta = this.computeDelta(i);
      if (!wasActive || this.reduceMotion) this.snapCursor = true;
    }
    this.ensureLoop();
  }

  private computeDelta(i: number): Delta | null {
    if (i === 0) return null;
    const cur = this.chartPoints[i].cost;
    const prev = this.chartPoints[i - 1].cost;
    if (prev === 0) return cur > 0 ? { pct: 0, up: true, isNew: true } : null;
    const pct = ((cur - prev) / prev) * 100;
    return { pct: Math.abs(pct), up: pct >= 0, isNew: false };
  }

  // ---------------------------------------------------------- animation

  private ensureLoop() {
    if (this.rafId || this.destroyed) return;
    this.zone.runOutsideAngular(() => (this.rafId = requestAnimationFrame(this.frame)));
  }

  private frame = (now: number) => {
    this.rafId = 0;
    if (this.destroyed) return;
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 1 / 60;
    this.lastFrame = now;

    const morphing = this.stepMorph(now);
    const springing = this.stepSpring(dt);
    this.cdr.detectChanges();
    this.layoutTooltip();

    if (morphing || springing) this.rafId = requestAnimationFrame(this.frame);
    else this.lastFrame = 0;
  };

  private stepMorph(now: number): boolean {
    if (!this.morphStart) return false;
    const elapsed = now - this.morphStart;
    let done = true;

    this.chartPoints.forEach((p, i) => {
      const t = this.reduceMotion ? 1 : clamp((elapsed - i * STAGGER_MS) / MORPH_MS, 0, 1);
      if (t < 1) done = false;
      const from = this.fromYs[i] ?? this.bottomY;
      const to = this.targetYs[i] ?? this.bottomY;
      p.y = Math.min(this.bottomY, from + (to - from) * easeOutBack(t));
    });

    const s = this.reduceMotion ? 1 : clamp(elapsed / STATS_MS, 0, 1);
    if (s < 1) done = false;
    const e = easeOutExpo(s);
    (Object.keys(this.stats) as (keyof Stats)[]).forEach((k) => {
      this.display[k] = this.statsFrom[k] + (this.stats[k] - this.statsFrom[k]) * e;
    });

    this.rebuildPaths();
    if (done) this.morphStart = 0;
    return !done;
  }

  private stepSpring(dt: number): boolean {
    const pt = this.tipPoint;
    if (!pt) return false;
    if (this.snapCursor) {
      this.snapCursor = false;
      this.cursorX = pt.x;
      this.cursorY = pt.y;
      this.velX = this.velY = 0;
      return false;
    }
    const ax = SPRING_K * (pt.x - this.cursorX) - SPRING_C * this.velX;
    const ay = SPRING_K * (pt.y - this.cursorY) - SPRING_C * this.velY;
    this.velX += ax * dt;
    this.velY += ay * dt;
    this.cursorX += this.velX * dt;
    this.cursorY += this.velY * dt;

    const settled =
      Math.abs(pt.x - this.cursorX) < 0.2 &&
      Math.abs(pt.y - this.cursorY) < 0.2 &&
      Math.abs(this.velX) < 2 &&
      Math.abs(this.velY) < 2;
    if (settled) {
      this.cursorX = pt.x;
      this.cursorY = pt.y;
      this.velX = this.velY = 0;
    }
    return !settled;
  }

  /** Place the tooltip on the (spring-smoothed) cursor, clamped inside the chart, arrow on the point. */
  private layoutTooltip() {
    const tip = this.tooltipRef.nativeElement;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    if (!w || !this.tipPoint) return;

    const gap = 14;
    const below = this.cursorY - h - gap < -6;
    const left = clamp(this.cursorX - w / 2, 0, Math.max(0, this.width - w));
    const top = below ? this.cursorY + gap : this.cursorY - h - gap;
    const arrowX = clamp(this.cursorX - left, 14, w - 14);

    tip.style.transform = `translate3d(${left.toFixed(2)}px, ${top.toFixed(2)}px, 0)`;
    const arrow = this.tipArrowRef.nativeElement.style;
    arrow.left = `${arrowX - 5}px`;
    arrow.top = below ? '-5px' : '';
    arrow.bottom = below ? '' : '-5px';
    this.tipCardRef.nativeElement.style.transformOrigin = `${arrowX}px ${below ? '0%' : '100%'}`;
  }

  // ------------------------------------------------------------ buckets

  private generateTimeBuckets(
    period: ChartPeriod,
    costs: { date: Date; cost: number }[],
  ): ChartPoint[] {
    const now = new Date();

    if (period === 'day') {
      // 6 time blocks across the day (every 4 hours)
      const points: ChartPoint[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 4 * 60 * 60 * 1000);
        const label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        points.push({ label, cost: 0, count: 0, x: 0, y: 0, rawDate: d });
      }
      this.assignToClosest(points, costs);
      return points;
    }

    if (period === 'week') {
      // 7 days of the week
      const points: ChartPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const label = d.toLocaleDateString([], { weekday: 'short' });
        const subLabel = d.toLocaleDateString([], { day: '2-digit', month: 'short' });
        points.push({ label, subLabel, cost: 0, count: 0, x: 0, y: 0, rawDate: d });
      }
      costs.forEach((c) => {
        const idx = points.findIndex((p) => p.rawDate!.toDateString() === c.date.toDateString());
        if (idx !== -1) {
          points[idx].cost += c.cost;
          points[idx].count += 1;
        }
      });
      return points;
    }

    if (period === 'month') {
      // 6 intervals across the month (~5 days each)
      const points: ChartPoint[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i * 6);
        const label = d.toLocaleDateString([], { day: '2-digit', month: 'short' });
        points.push({ label, cost: 0, count: 0, x: 0, y: 0, rawDate: d });
      }
      this.assignToClosest(points, costs);
      return points;
    }

    if (period === 'year') {
      // 12 months
      const points: ChartPoint[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString([], { month: 'short' });
        points.push({ label, cost: 0, count: 0, x: 0, y: 0, rawDate: d });
      }
      costs.forEach((c) => {
        const idx = points.findIndex(
          (p) =>
            p.rawDate!.getMonth() === c.date.getMonth() &&
            p.rawDate!.getFullYear() === c.date.getFullYear(),
        );
        if (idx !== -1) {
          points[idx].cost += c.cost;
          points[idx].count += 1;
        }
      });
      return points;
    }

    // Lifetime: group by month (records arrive sorted by date ASC)
    const groupMap = new Map<string, { label: string; cost: number; count: number }>();
    costs.forEach((c) => {
      const key = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, '0')}`;
      const label = c.date.toLocaleDateString([], { month: 'short', year: '2-digit' });
      const existing = groupMap.get(key) || { label, cost: 0, count: 0 };
      existing.cost += c.cost;
      existing.count += 1;
      groupMap.set(key, existing);
    });

    const points: ChartPoint[] = [];
    groupMap.forEach((val) => {
      points.push({ label: val.label, cost: val.cost, count: val.count, x: 0, y: 0 });
    });
    return points;
  }

  private assignToClosest(points: ChartPoint[], costs: { date: Date; cost: number }[]) {
    costs.forEach((c) => {
      let closestIdx = 0;
      let minDiff = Infinity;
      points.forEach((p, idx) => {
        const diff = Math.abs(c.date.getTime() - p.rawDate!.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      points[closestIdx].cost += c.cost;
      points[closestIdx].count += 1;
    });
  }

  private getRecordCost(record: MaintenanceRecordDto): number {
    if (record.totalCost !== undefined && record.totalCost !== null) {
      return Number(record.totalCost);
    }
    let total = Number(record.itemCost || 0);
    if (record.extraCosts && Array.isArray(record.extraCosts)) {
      total += record.extraCosts.reduce((sum, cost) => sum + Number(cost.cost || 0), 0);
    }
    return total;
  }
}
