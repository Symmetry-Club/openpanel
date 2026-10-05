import { useTRPC } from '@/integrations/trpc/react';
import type { RouterOutputs } from '@/trpc/client';
import { cn } from '@/utils/cn';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ServerCrashIcon } from 'lucide-react';

import type { ISqlVisualization } from '@openpanel/validation';

import { AspectContainer } from '../aspect-container';
import { ReportChartEmpty } from '../common/empty';
import { ReportChartLoading } from '../common/loading';
import { useReportChartContext } from '../context';
import { Loading as MetricLoading } from '../metric';
import { SqlCartesianChart } from './cartesian';
import { SqlMetric } from './metric';
import { SqlPieChart } from './pie';
import { SqlTable } from './table';
import { toSqlMetric, toSqlPieData, toSqlSeriesData } from './transform';

type SqlData = RouterOutputs['chart']['sql'];

const ERROR_MESSAGE_MAX_LENGTH = 1000;
const numberFormatter = new Intl.NumberFormat('en-US');

export function ReportSqlChart() {
  const { isLazyLoading, shareId, report } = useReportChartContext();
  const trpc = useTRPC();
  const sqlOptions = report.options?.type === 'sql' ? report.options : null;
  const visualization = sqlOptions?.visualization ?? 'table';
  // A shared report always runs its saved query on the server, so the SQL
  // text is only sent from the dashboard itself.
  const query = shareId ? undefined : sqlOptions?.query;

  const res = useQuery(
    trpc.chart.sql.queryOptions(
      {
        projectId: report.projectId,
        query,
        range: report.range,
        startDate: report.startDate,
        endDate: report.endDate,
        shareId,
        id: report.id,
      },
      {
        placeholderData: keepPreviousData,
        enabled: !isLazyLoading && Boolean(shareId || query),
        // A failing query fails the same way again; retrying only makes
        // the author wait several times as long for the error.
        retry: false,
      },
    ),
  );

  if (isLazyLoading || res.isLoading || (res.isFetching && !res.data)) {
    return <SqlLoading visualization={visualization} />;
  }

  if (res.isError) {
    return <SqlError message={res.error.message} />;
  }

  if (!res.data || res.data.rows.length === 0) {
    return <SqlEmpty />;
  }

  return <SqlResult data={res.data} visualization={visualization} />;
}

function SqlResult({
  data,
  visualization,
}: {
  data: SqlData;
  visualization: ISqlVisualization;
}) {
  const { isEditMode } = useReportChartContext();

  const renderVisualization = () => {
    switch (visualization) {
      case 'metric': {
        const metric = toSqlMetric(data);
        return metric ? (
          <SqlMetric metric={metric} />
        ) : (
          <SqlEmpty title="No numeric value in the first row" />
        );
      }
      case 'line':
      case 'bar': {
        const seriesData = toSqlSeriesData(data);
        if (!seriesData) {
          return (
            <SqlEmpty title="Needs an X column and at least one numeric column" />
          );
        }
        return (
          <AspectContainer>
            <SqlCartesianChart data={seriesData} type={visualization} />
          </AspectContainer>
        );
      }
      case 'pie': {
        const slices = toSqlPieData(data);
        if (slices.length === 0) {
          return (
            <SqlEmpty title="Needs a label column and a positive numeric column" />
          );
        }
        return (
          <AspectContainer>
            <SqlPieChart slices={slices} />
          </AspectContainer>
        );
      }
      default: {
        if (isEditMode) {
          return (
            <SqlTable
              className="max-h-[600px]"
              columns={data.columns}
              rows={data.rows}
            />
          );
        }
        return (
          <AspectContainer>
            <SqlTable
              className="h-full"
              columns={data.columns}
              rows={data.rows}
            />
          </AspectContainer>
        );
      }
    }
  };

  return (
    <div className="col gap-2">
      {renderVisualization()}
      {(isEditMode || data.truncated) && (
        <div className="text-muted-foreground text-xs">
          {data.truncated
            ? `Showing the first ${numberFormatter.format(data.rowCount)} rows. Add a LIMIT or aggregate to see everything.`
            : `${numberFormatter.format(data.rowCount)} rows`}
          {isEditMode && ` · ${numberFormatter.format(data.elapsedMs)} ms`}
        </div>
      )}
    </div>
  );
}

function SqlLoading({ visualization }: { visualization: ISqlVisualization }) {
  if (visualization === 'metric') {
    return <MetricLoading />;
  }
  return (
    <AspectContainer>
      <ReportChartLoading />
    </AspectContainer>
  );
}

function SqlEmpty({ title }: { title?: string }) {
  return (
    <AspectContainer>
      <ReportChartEmpty title={title}>
        {title ? undefined : 'The query returned no rows'}
      </ReportChartEmpty>
    </AspectContainer>
  );
}

function SqlError({ message }: { message: string }) {
  const { isEditMode } = useReportChartContext();
  const trimmed =
    message.length > ERROR_MESSAGE_MAX_LENGTH
      ? `${message.slice(0, ERROR_MESSAGE_MAX_LENGTH)}…`
      : message;

  return (
    <AspectContainer>
      <div
        className={cn(
          'center-center h-full w-full flex-col gap-3',
          isEditMode && 'card p-4',
        )}
      >
        <ServerCrashIcon
          className="size-10 animate-pulse text-muted-foreground"
          strokeWidth={1.2}
        />
        <div className="font-medium text-muted-foreground text-sm">
          There was an error running this query.
        </div>
        <pre className="max-h-32 w-full max-w-2xl overflow-auto whitespace-pre-wrap break-words rounded-md bg-def-100 p-3 font-mono text-muted-foreground text-xs">
          {trimmed}
        </pre>
      </div>
    </AspectContainer>
  );
}
