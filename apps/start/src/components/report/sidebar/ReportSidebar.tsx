import { Button } from '@/components/ui/button';
import { SheetClose, SheetFooter } from '@/components/ui/sheet';
import { useSelector } from '@/redux';

import { ReportBreakdowns } from './ReportBreakdowns';
import { ReportGlobalFilters } from './ReportGlobalFilters';
import { ReportSeries } from './ReportSeries';
import { ReportSettings } from './ReportSettings';
import { ReportFixedEvents } from './report-fixed-events';

export function ReportSidebar() {
  const { chartType, options } = useSelector((state) => state.report);
  // SQL reports are defined entirely by their query: no events, filters or
  // breakdowns apply.
  const isSql = chartType === 'sql';
  const showBreakdown =
    chartType !== 'retention' && chartType !== 'sankey' && !isSql;
  const showFixedEvents = chartType === 'sankey';
  return (
    <>
      <div className="flex flex-col gap-8">
        {showFixedEvents && (
          <ReportFixedEvents
            numberOfEvents={
              options?.type === 'sankey' && options.mode === 'between' ? 2 : 1
            }
          />
        )}
        {!(showFixedEvents || isSql) && <ReportSeries />}
        {!isSql && <ReportGlobalFilters />}
        {showBreakdown && <ReportBreakdowns />}
        <ReportSettings />
      </div>
      <SheetFooter>
        <SheetClose asChild>
          <Button className="w-full">Done</Button>
        </SheetClose>
      </SheetFooter>
    </>
  );
}
