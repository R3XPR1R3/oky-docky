import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface FieldRect {
  name: string;
  page: number;
  rect: [number, number, number, number];
  page_width: number;
  page_height: number;
}

interface PdfFieldPreviewProps {
  templateId: string;
  /** mapping.json data: schema_key → pdf_field or complex object */
  mapping?: Record<string, any>;
  /** Called when user clicks a PDF field to map it */
  onFieldClick?: (pdfFieldName: string) => void;
  /** Called when user wants to update mapping: schema_key → pdf_field_name */
  onMappingChange?: (schemaKey: string, pdfFieldName: string) => void;
  /** Called when user removes a mapping */
  onMappingRemove?: (schemaKey: string) => void;
}

/** Build a reverse index: pdf_field_name → schema_key */
function buildReverseMapping(mapping: Record<string, any>): Record<string, string> {
  const reverse: Record<string, string> = {};
  for (const [schemaKey, value] of Object.entries(mapping)) {
    if (typeof value === 'string') {
      reverse[value] = schemaKey;
    } else if (typeof value === 'object' && value !== null) {
      // radio_group, checkbox, math — extract field names
      if (value.field) reverse[value.field] = schemaKey;
      if (value.choices) {
        for (const c of value.choices) {
          if (c.field) reverse[c.field] = schemaKey;
        }
      }
    }
  }
  return reverse;
}

export default function PdfFieldPreview({
  templateId,
  mapping = {},
  onFieldClick,
  onMappingChange,
  onMappingRemove,
}: PdfFieldPreviewProps) {
  const [fieldRects, setFieldRects] = useState<FieldRect[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const [showLabels, setShowLabels] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [hoveredField, setHoveredField] = useState<string | null>(null);

  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const reverseMapping = useMemo(() => buildReverseMapping(mapping), [mapping]);

  // Load field rects
  useEffect(() => {
    if (!templateId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/templates/${templateId}/pdf-field-rects`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setFieldRects(data.fields))
      .catch((e) => setError(e.message));
  }, [templateId]);

  // Load PDF
  useEffect(() => {
    if (!templateId) return;

    pdfjsLib
      .getDocument(`/api/templates/${templateId}/pdf-file`)
      .promise.then((pdf) => {
        pdfDocRef.current = pdf;
        setPageCount(pdf.numPages);
        setLoading(false);
      })
      .catch((e) => {
        setError(`PDF load error: ${e.message}`);
        setLoading(false);
      });

    return () => {
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, [templateId]);

  // Render pages
  useEffect(() => {
    const pdf = pdfDocRef.current;
    if (!pdf || pageCount === 0) return;

    for (let i = 1; i <= pageCount; i++) {
      pdf.getPage(i).then((page) => {
        const viewport = page.getViewport({ scale });
        const canvas = canvasRefs.current.get(i - 1);
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        page.render({ canvasContext: ctx, viewport });
      });
    }
  }, [pageCount, scale]);

  const setCanvasRef = useCallback(
    (pageIdx: number) => (el: HTMLCanvasElement | null) => {
      if (el) canvasRefs.current.set(pageIdx, el);
      else canvasRefs.current.delete(pageIdx);
    },
    [],
  );

  // Stats
  const mappedCount = fieldRects.filter((f) => reverseMapping[f.name]).length;
  const unmappedCount = fieldRects.length - mappedCount;

  // Filtered fields by page
  const fieldsByPage = useMemo(() => {
    const filtered = fieldRects.filter((f) => {
      if (filter === 'mapped') return !!reverseMapping[f.name];
      if (filter === 'unmapped') return !reverseMapping[f.name];
      return true;
    });
    return filtered.reduce<Record<number, FieldRect[]>>((acc, f) => {
      (acc[f.page] ??= []).push(f);
      return acc;
    }, {});
  }, [fieldRects, filter, reverseMapping]);

  if (!templateId) {
    return (
      <div className="text-center text-slate-400 py-8">
        Select a template to preview PDF fields
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-400 py-8">Error: {error}</div>
    );
  }

  return (
    <div className="pdf-field-preview">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 px-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-700">
          PDF Field Map
        </span>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          >
            −
          </button>
          <span className="text-xs text-slate-500 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
          >
            +
          </button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1 text-xs">
          <button
            className={`px-2 py-1 rounded ${filter === 'all' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            onClick={() => setFilter('all')}
          >
            All ({fieldRects.length})
          </button>
          <button
            className={`px-2 py-1 rounded ${filter === 'mapped' ? 'bg-green-100 text-green-700 font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            onClick={() => setFilter('mapped')}
          >
            Mapped ({mappedCount})
          </button>
          <button
            className={`px-2 py-1 rounded ${filter === 'unmapped' ? 'bg-orange-100 text-orange-700 font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            onClick={() => setFilter('unmapped')}
          >
            Unmapped ({unmappedCount})
          </button>
        </div>

        <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            className="rounded"
          />
          Labels
        </label>
      </div>

      {loading && (
        <div className="text-center text-slate-400 py-8">Loading PDF...</div>
      )}

      {/* Pages */}
      <div className="overflow-auto max-h-[75vh] rounded-xl border border-slate-200 bg-slate-50 p-3">
        {Array.from({ length: pageCount }, (_, pageIdx) => (
          <div key={pageIdx} className="mb-6 last:mb-0">
            <div className="text-xs text-slate-400 mb-1 px-1 font-medium">
              Page {pageIdx + 1}
            </div>
            <div className="relative inline-block">
              <canvas
                ref={setCanvasRef(pageIdx)}
                className="block rounded-lg shadow-md"
              />
              {showLabels &&
                (fieldsByPage[pageIdx] || []).map((field, i) => {
                  const canvas = canvasRefs.current.get(pageIdx);
                  if (!canvas) return null;

                  const canvasW = canvas.width;
                  const canvasH = canvas.height;
                  const sx = canvasW / field.page_width;
                  const sy = canvasH / field.page_height;

                  const [x1, y1, x2, y2] = field.rect;
                  const left = Math.min(x1, x2) * sx;
                  const top = canvasH - Math.max(y1, y2) * sy;
                  const width = Math.abs(x2 - x1) * sx;
                  const height = Math.abs(y2 - y1) * sy;

                  const schemaKey = reverseMapping[field.name];
                  const isMapped = !!schemaKey;
                  const isHovered = hoveredField === field.name;

                  return (
                    <div
                      key={`${field.name}-${i}`}
                      className="absolute group"
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${width}px`,
                        height: `${height}px`,
                      }}
                      onMouseEnter={() => setHoveredField(field.name)}
                      onMouseLeave={() => setHoveredField(null)}
                    >
                      {/* Highlight rect */}
                      <div
                        className={`absolute inset-0 border-2 cursor-pointer transition-all ${
                          isMapped
                            ? 'border-green-500 bg-green-400/15 hover:bg-green-400/30'
                            : 'border-orange-400/70 bg-orange-400/10 hover:bg-orange-400/25'
                        }`}
                        onClick={() => onFieldClick?.(field.name)}
                        title={isMapped ? `${field.name} → ${schemaKey}` : `${field.name} (unmapped)`}
                      />
                      {/* Label */}
                      <div
                        className={`absolute left-0 whitespace-nowrap pointer-events-none text-[9px] leading-tight font-mono px-1 py-0.5 rounded-sm shadow-sm ${
                          isMapped
                            ? 'bg-green-600 text-white'
                            : 'bg-orange-500 text-white'
                        }`}
                        style={{ bottom: '100%', marginBottom: '1px' }}
                      >
                        {isMapped ? (
                          <>
                            <span className="opacity-70">{field.name}</span>
                            <span className="mx-0.5">→</span>
                            <span className="font-semibold">{schemaKey}</span>
                          </>
                        ) : (
                          field.name
                        )}
                      </div>
                      {/* Hover tooltip with actions */}
                      {isHovered && (
                        <div
                          className="absolute z-10 bg-white rounded-lg shadow-xl border border-slate-200 p-2 min-w-[180px]"
                          style={{ top: '100%', left: 0, marginTop: '4px' }}
                        >
                          <div className="text-[10px] font-mono text-slate-500 mb-1">{field.name}</div>
                          {isMapped ? (
                            <div className="space-y-1">
                              <div className="text-xs text-green-700 font-medium">
                                Mapped to: <span className="font-mono">{schemaKey}</span>
                              </div>
                              {onMappingRemove && (
                                <button
                                  className="text-[11px] text-red-500 hover:text-red-700 hover:underline pointer-events-auto"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMappingRemove(schemaKey);
                                  }}
                                >
                                  Remove mapping
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-orange-600">
                              Click to map this field
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
