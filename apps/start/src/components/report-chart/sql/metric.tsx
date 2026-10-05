import { useNumber } from '@/hooks/use-numer-formatter';
import { cn } from '@/utils/cn';

import { useReportChartContext } from '../context';
import { MetricCardNumber } from '../metric/metric-card';
import type { SqlMetricValue } from './transform';

export function SqlMetric({ metric }: { metric: SqlMetricValue }) {
  const { isEditMode } = useReportChartContext();
  const number = useNumber();

  return (
    <div className={cn('p-4', isEditMode && 'card h-auto')}>
      <MetricCardNumber
        label={metric.name}
        value={
          <span title={number.format(metric.value)}>
            {number.short(metric.value)}
          </span>
        }
      />
    </div>
  );
}
