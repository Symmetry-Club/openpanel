import {
  ChartTooltipContainer,
  ChartTooltipHeader,
  ChartTooltipItem,
} from '@/components/charts/chart-tooltip';
import { useNumber } from '@/hooks/use-numer-formatter';
import { cn } from '@/utils/cn';
import { getChartColor } from '@/utils/theme';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useYAxisProps, X_AXIS_STYLE_PROPS } from '../common/axis';
import { useReportChartContext } from '../context';
import { formatSqlValue } from './format';
import {
  SQL_X_KEY,
  type SqlColumnKind,
  type SqlSeries,
  type SqlSeriesData,
} from './transform';

const LINE_DOTS_MAX_POINTS = 8;

interface SqlTooltipProps {
  active?: boolean;
  label?: unknown;
  payload?: { dataKey?: unknown; value?: unknown }[];
  series: SqlSeries[];
  xKind: SqlColumnKind;
}

function SqlTooltip({ active, label, payload, series, xKind }: SqlTooltipProps) {
  const number = useNumber();
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <ChartTooltipContainer>
      <ChartTooltipHeader>
        <div>{formatSqlValue(label, xKind)}</div>
      </ChartTooltipHeader>
      {payload.map((item) => {
        const index = series.findIndex(({ key }) => key === item.dataKey);
        const serie = series[index];
        if (!serie) {
          return null;
        }
        return (
          <ChartTooltipItem color={getChartColor(index)} key={serie.key}>
            <div className="truncate font-medium">{serie.name}</div>
            <div className="font-medium font-mono">
              {typeof item.value === 'number'
                ? number.format(item.value)
                : 'N/A'}
            </div>
          </ChartTooltipItem>
        );
      })}
    </ChartTooltipContainer>
  );
}

function SqlLegend({ series }: { series: SqlSeries[] }) {
  return (
    <div className="-mb-2 mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
      {series.map((serie, index) => (
        <div
          className="flex items-center gap-1 font-semibold"
          key={serie.key}
          style={{ color: getChartColor(index) }}
        >
          {serie.name}
        </div>
      ))}
    </div>
  );
}

interface SqlCartesianChartProps {
  data: SqlSeriesData;
  type: 'line' | 'bar';
}

export function SqlCartesianChart({ data, type }: SqlCartesianChartProps) {
  const {
    isEditMode,
    options: { hideXAxis, hideYAxis },
  } = useReportChartContext();
  const yAxisProps = useYAxisProps({ hide: hideYAxis });
  const { series, xKind } = data;
  const ChartComponent = type === 'bar' ? BarChart : ComposedChart;

  return (
    <div className={cn('h-full w-full', isEditMode && 'card p-4')}>
      <ResponsiveContainer>
        <ChartComponent data={data.data}>
          <CartesianGrid
            className="stroke-border"
            horizontal={true}
            strokeDasharray="3 3"
            vertical={false}
          />
          <YAxis {...yAxisProps} />
          <XAxis
            {...X_AXIS_STYLE_PROPS}
            dataKey={SQL_X_KEY}
            height={hideXAxis ? 0 : X_AXIS_STYLE_PROPS.height}
            tickFormatter={(value: unknown) => formatSqlValue(value, xKind)}
          />
          {series.length > 1 && <Legend content={<SqlLegend series={series} />} />}
          <Tooltip
            content={<SqlTooltip series={series} xKind={xKind} />}
            cursor={type === 'bar' ? { className: 'fill-def-200' } : undefined}
          />
          {series.map((serie, index) => {
            const color = getChartColor(index);
            if (type === 'bar') {
              return (
                <Bar
                  dataKey={serie.key}
                  fill={color}
                  isAnimationActive={false}
                  key={serie.key}
                  name={serie.name}
                  radius={[4, 4, 0, 0]}
                />
              );
            }
            return (
              <Line
                connectNulls
                dataKey={serie.key}
                dot={data.data.length <= LINE_DOTS_MAX_POINTS}
                fill={color}
                isAnimationActive={false}
                key={serie.key}
                name={serie.name}
                stroke={color}
                strokeWidth={2}
                type="monotone"
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
