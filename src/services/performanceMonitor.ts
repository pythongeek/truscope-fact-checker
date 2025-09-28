interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  tier?: string;
  cacheHit?: boolean;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 1000;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log to Vercel Analytics if available
    if (typeof window !== 'undefined' && (window as any).va) {
      (window as any).va('track', 'FactCheck', {
        operation: metric.operation,
        duration: metric.duration,
        success: metric.success
      });
    }
  }

  getMetrics(operation?: string): PerformanceMetric[] {
    return operation
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics;
  }

  getAveragePerformance(): Record<string, { avgDuration: number; successRate: number }> {
    const grouped = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = [];
      }
      acc[metric.operation].push(metric);
      return acc;
    }, {} as Record<string, PerformanceMetric[]>);

    return Object.entries(grouped).reduce((acc, [operation, metrics]) => {
      const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
      const successCount = metrics.filter(m => m.success).length;

      acc[operation] = {
        avgDuration: Math.round(totalDuration / metrics.length),
        successRate: Math.round((successCount / metrics.length) * 100)
      };

      return acc;
    }, {} as Record<string, { avgDuration: number; successRate: number }>);
  }

  getCacheHitRate(): number {
    const cacheMetrics = this.metrics.filter(m => m.cacheHit !== undefined);
    if (cacheMetrics.length === 0) return 0;

    const hits = cacheMetrics.filter(m => m.cacheHit).length;
    return Math.round((hits / cacheMetrics.length) * 100);
  }

  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      summary: this.getAveragePerformance(),
      cacheHitRate: this.getCacheHitRate(),
      timestamp: new Date().toISOString()
    }, null, 2);
  }
}