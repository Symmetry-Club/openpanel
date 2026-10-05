import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { Compartment, EditorState, Prec } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import {
  BarChart3Icon,
  HashIcon,
  LineChartIcon,
  type LucideIcon,
  PieChartIcon,
  PlayIcon,
  TableIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { ISqlVisualization } from '@openpanel/validation';

import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { useDispatch, useSelector } from '@/redux';
import { changeSqlQuery, changeSqlVisualization } from './reportSlice';

const VISUALIZATIONS: {
  value: ISqlVisualization;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: 'table', label: 'Table', icon: TableIcon },
  { value: 'line', label: 'Line', icon: LineChartIcon },
  { value: 'bar', label: 'Bar', icon: BarChart3Icon },
  { value: 'metric', label: 'Number', icon: HashIcon },
  { value: 'pie', label: 'Pie', icon: PieChartIcon },
];

const EDITOR_MIN_HEIGHT = '180px';
const EDITOR_MAX_HEIGHT = '480px';

// Chrome follows the dashboard's own tokens so the editor sits in the page in
// both themes; `Prec.highest` lets it win over One Dark's background.
const sqlEditorChrome = Prec.highest(
  EditorView.theme({
    '&': {
      fontSize: '13px',
      backgroundColor: 'var(--card)',
      color: 'var(--foreground)',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      minHeight: EDITOR_MIN_HEIGHT,
      maxHeight: EDITOR_MAX_HEIGHT,
      overflow: 'auto',
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    },
    '.cm-content': {
      padding: '12px 0',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--def-100)',
      color: 'var(--muted-foreground)',
      borderRight: '1px solid var(--border)',
    },
    '.cm-activeLine, .cm-activeLineGutter': {
      backgroundColor: 'oklch(from var(--foreground) l c h / 0.04)',
    },
  }),
);

interface SqlCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
}

function SqlCodeEditor({ value, onChange, onRun }: SqlCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartmentRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  const { appTheme } = useTheme();

  onChangeRef.current = onChange;
  onRunRef.current = onRun;

  // Create the editor once; later value/theme changes are dispatched below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount only
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          // Above basicSetup, whose default keymap maps Mod-Enter to
          // "insert blank line".
          Prec.highest(
            keymap.of([
              {
                key: 'Mod-Enter',
                run: () => {
                  onRunRef.current();
                  return true;
                },
              },
            ]),
          ),
          basicSetup,
          sql({ dialect: PostgreSQL }),
          EditorState.tabSize.of(2),
          EditorView.lineWrapping,
          sqlEditorChrome,
          themeCompartmentRef.current.of(appTheme === 'dark' ? oneDark : []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.contentAttributes.of({ 'aria-label': 'Consulta SQL' }),
        ],
      }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompartmentRef.current.reconfigure(
        appTheme === 'dark' ? oneDark : [],
      ),
    });
  }, [appTheme]);

  // Sync external changes (loading a saved report, switching chart type).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      className="overflow-hidden rounded-md border focus-within:ring-1 focus-within:ring-ring"
      ref={containerRef}
    />
  );
}

interface ReportSqlEditorProps {
  /** The query the chart below is currently showing. */
  executedQuery: string | null;
  onRun: () => void;
  isRunning?: boolean;
}

export function ReportSqlEditor({
  executedQuery,
  onRun,
  isRunning,
}: ReportSqlEditorProps) {
  const dispatch = useDispatch();
  const options = useSelector((state) => state.report.options);
  const sqlOptions = options?.type === 'sql' ? options : null;

  if (!sqlOptions) {
    return null;
  }

  const hasPendingChanges =
    executedQuery !== null && executedQuery !== sqlOptions.query;
  const canRun = sqlOptions.query.trim().length > 0;
  const VisualizationIcon =
    VISUALIZATIONS.find(({ value }) => value === sqlOptions.visualization)
      ?.icon ?? TableIcon;

  return (
    <div className="card col gap-3 p-4">
      <SqlCodeEditor
        onChange={(query) => dispatch(changeSqlQuery(query))}
        onRun={() => {
          if (canRun) {
            onRun();
          }
        }}
        value={sqlOptions.query}
      />
      <div className="row flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground text-xs">
          Use <code className="font-mono">{'{{startDate}}'}</code> and{' '}
          <code className="font-mono">{'{{endDate}}'}</code> for the report's
          date range.
          {hasPendingChanges && (
            <span className="ml-2 font-medium text-foreground">
              Changes not run yet
            </span>
          )}
        </div>
        <div className="row items-center gap-2">
          <Combobox
            className="min-w-36"
            icon={VisualizationIcon}
            items={VISUALIZATIONS.map(({ value, label }) => ({
              value,
              label,
            }))}
            onChange={(value) => dispatch(changeSqlVisualization(value))}
            placeholder="Visualización"
            value={sqlOptions.visualization}
          />
          <Button
            disabled={!canRun}
            icon={PlayIcon}
            loading={isRunning}
            onClick={onRun}
            title="Run (⌘/Ctrl + Enter)"
            variant="cta"
          >
            Run
          </Button>
        </div>
      </div>
    </div>
  );
}
