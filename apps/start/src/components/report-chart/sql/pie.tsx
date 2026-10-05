import {
  ChartTooltipContainer,
  ChartTooltipItem,
} from '@/components/charts/chart-tooltip';
import { useNumber } from '@/hooks/use-numer-formatter';
import { cn } from '@/utils/cn';
import { round } from '@/utils/math';
import { getChartColor } from '@/utils/theme';
import { truncate } from '@/utils/truncate';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { AXIS_FONT_PROPS } from '../common/axis';
import { useReportChartContext } from '../context';
import type { SqlPieSlice } from './transform';

const LABEL_OFFSET = 25;
const LABEL_MAX_LENGTH = 20;
const RADIAN = Math.PI / 180;

interface PieSliceDatum extends SqlPieSlice {
  color: string;
  percent: number;
}

function SqlPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: PieSliceDatum }[];
}) {
  const number = useNumber();
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <ChartTooltipContainer>
      {payload.map(({ payload: slice }) =>
        slice ? (
          <ChartTooltipItem color={slice.color} key={slice.name}>
            <div className="truncate font-medium">{slice.name}</div>
            <div className="flex justify-between gap-8 font-medium font-mono">
              <span>{number.format(slice.value)}</span>
              <span className="text-muted-foreground">
                {round(slice.percent * 100, 1)}%
              </span>
            </div>
          </ChartTooltipItem>
        ) : null,
      )}
    </ChartTooltipContainer>
  );
}

function renderLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  fill,
  payload,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  fill: string;
  payload: PieSliceDatum;
}) {
  const radius = LABEL_OFFSET + outerRadius;
  const percentRadius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const percentX = cx + percentRadius * Math.cos(-midAngle * RADIAN);
  const percentY = cy + percentRadius * Math.sin(-midAngle * RADIAN);

  return (
    <>
      <text
        dominantBaseline="central"
        fill="white"
        pointerEvents="none"
        textAnchor="middle"
        x={percentX}
        y={percentY}
        {...AXIS_FONT_PROPS}
        fontSize={12}
        fontWeight={700}
      >
        {round(payload.percent * 100, 1)}%
      </text>
      <text
        dominantBaseline="central"
        fill={fill}
        textAnchor={x > cx ? 'start' : 'end'}
        x={x}
        y={y}
        {...AXIS_FONT_PROPS}
        fontSize={10}
        fontWeight={700}
      >
        {truncate(payload.name, LABEL_MAX_LENGTH)}
      </text>
    </>
  );
}

export function SqlPieChart({ slices }: { slices: SqlPieSlice[] }) {
  const { isEditMode } = useReportChartContext();
  let total = 0;
  for (const slice of slices) {
    total += slice.value;
  }
  const data: PieSliceDatum[] = slices.map((slice, index) => ({
    ...slice,
    color: getChartColor(index),
    percent: total === 0 ? 0 : slice.value / total,
  }));

  return (
    <div className={cn('h-full w-full max-sm:-mx-3', isEditMode && 'card p-4')}>
      <ResponsiveContainer>
        <PieChart>
          <Tooltip content={<SqlPieTooltip />} />
          <Pie
            data={data}
            dataKey="value"
            innerRadius="30%"
            isAnimationActive={false}
            label={renderLabel}
            nameKey="name"
            outerRadius="80%"
          >
            {data.map((slice) => (
              <Cell
                className="stroke-background"
                fill={slice.color}
                key={slice.name}
                strokeWidth={4}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
