import type { IServiceReport } from '@openpanel/db';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { GanttChartSquareIcon, ShareIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import EditReportName from '../report/edit-report-name';
import { ReportChartType } from '@/components/report/ReportChartType';
import { ReportInterval } from '@/components/report/ReportInterval';
import { ReportLineType } from '@/components/report/ReportLineType';
import { ReportSaveButton } from '@/components/report/ReportSaveButton';
import { ReportSqlEditor } from '@/components/report/ReportSqlEditor';
import {
  changeChartType,
  changeDateRanges,
  changeEndDate,
  changeInterval,
  changeStartDate,
  ready,
  reset,
  setReport,
} from '@/components/report/reportSlice';
import { ReportSidebar } from '@/components/report/sidebar/ReportSidebar';
import { ReportChart } from '@/components/report-chart';
import { TimeWindowPicker } from '@/components/time-window-picker';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAppParams } from '@/hooks/use-app-params';
import { useTRPC } from '@/integrations/trpc/react';
import { pushModal } from '@/modals';
import { useDispatch, useSelector } from '@/redux';

interface ReportEditorProps {
  report: IServiceReport | null;
}

export default function ReportEditor({
  report: initialReport,
}: ReportEditorProps) {
  const { projectId } = useAppParams();
  const dispatch = useDispatch();
  const report = useSelector((state) => state.report);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isSql = report.chartType === 'sql';
  const sqlQuery =
    report.options?.type === 'sql' ? report.options.query : undefined;
  // The chart under a SQL report shows the last *executed* query, not every
  // keystroke in the editor. `null` means "not initialised yet".
  const [executedSql, setExecutedSql] = useState<string | null>(null);
  const isSqlRunning = useIsFetching(trpc.chart.sql.pathFilter()) > 0;

  // Set report if reportId exists
  useEffect(() => {
    setExecutedSql(null);
    if (initialReport) {
      dispatch(setReport(initialReport));
    } else {
      dispatch(ready());
    }

    return () => {
      dispatch(reset());
    };
  }, [initialReport, dispatch]);

  useEffect(() => {
    if (!isSql) {
      setExecutedSql(null);
      return;
    }
    if (executedSql === null && sqlQuery !== undefined) {
      setExecutedSql(sqlQuery);
    }
  }, [isSql, executedSql, sqlQuery]);

  const runSql = () => {
    if (sqlQuery === undefined) {
      return;
    }
    if (sqlQuery === executedSql) {
      queryClient.invalidateQueries(trpc.chart.sql.pathFilter());
      return;
    }
    setExecutedSql(sqlQuery);
  };

  const chartReport = useMemo(() => {
    if (report.options?.type !== 'sql') {
      return { ...report, projectId };
    }
    return {
      ...report,
      projectId,
      options: { ...report.options, query: executedSql ?? report.options.query },
    };
  }, [report, projectId, executedSql]);

  return (
    <Sheet>
      <div>
        <div className="flex items-center justify-between p-4">
          <EditReportName />
          {initialReport?.id && (
            <Button
              icon={ShareIcon}
              onClick={() =>
                pushModal('ShareReportModal', { reportId: initialReport.id })
              }
              variant="outline"
            >
              Share
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 pt-0 md:grid-cols-6">
          {/* A SQL report has no events, filters or breakdowns to pick. */}
          {!isSql && (
            <SheetTrigger asChild>
              <Button
                className="self-start"
                icon={GanttChartSquareIcon}
                variant="cta"
              >
                Pick events
              </Button>
            </SheetTrigger>
          )}
          <div className="col-span-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <ReportChartType
              className="min-w-0 flex-1"
              onChange={(type) => {
                dispatch(changeChartType(type));
              }}
              value={report.chartType}
            />
            <TimeWindowPicker
              className="min-w-0 flex-1"
              endDate={report.endDate}
              onChange={(value) => {
                dispatch(changeDateRanges(value));
              }}
              onEndDateChange={(date) => dispatch(changeEndDate(date))}
              onIntervalChange={(interval) =>
                dispatch(changeInterval(interval))
              }
              onStartDateChange={(date) => dispatch(changeStartDate(date))}
              startDate={report.startDate}
              value={report.range}
            />
            <ReportInterval
              chartType={report.chartType}
              className="min-w-0 flex-1"
              endDate={report.endDate}
              interval={report.interval}
              onChange={(newInterval) => dispatch(changeInterval(newInterval))}
              range={report.range}
              startDate={report.startDate}
            />
            <ReportLineType className="min-w-0 flex-1" />
          </div>
          <div className="col-start-2 row-start-1 text-right md:col-start-6">
            <ReportSaveButton />
          </div>
        </div>
        <div className="flex flex-col gap-4 p-4" id="report-editor">
          {report.ready && isSql && (
            <ReportSqlEditor
              executedQuery={executedSql}
              isRunning={isSqlRunning}
              onRun={runSql}
            />
          )}
          {report.ready && <ReportChart isEditMode report={chartReport} />}
        </div>
      </div>
      <SheetContent className="!max-w-lg" side="left">
        <ReportSidebar />
      </SheetContent>
    </Sheet>
  );
}
