import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface FieldRect {
  name: string;
  page: number;
  rect: [number, number, number, number]; // [x1,y1,x2,y2] in PDF coords
  page_width: number;
  page_height: number;
}

interface PdfFieldPreviewProps {
  templateId: string;
  /** Highlight fields whose name is in this set */
  highlightFields?: Set<string>;
  /** Called when user clicks a field label */
  onFieldClick?: (fieldName: string) => void;
}

export default function PdfFieldPreview({
  templateId,
  highlightFields,
  onFieldClick,
}: PdfFieldPreviewProps) {
  const [fieldRects, setFieldRects] = useState<FieldRect[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const [showLabels, setShowLabels] = useState(true);

  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Load field rects from backend
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

  // Load and render PDF
  useEffect(() => {
    if (!templateId) return;

    const url = `/api/templates/${templateId}/pdf-file`;

    pdfjsLib
      .getDocument(url)
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

  // Render pages to canvas whenever pdf or scale changes
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

  // Group fields by page
  const fieldsByPage = fieldRects.reduce<Record<number, FieldRect[]>>(
    (acc, f) => {
      (acc[f.page] ??= []).push(f);
      return acc;
    },
    {},
  );

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
      <div className="flex items-center gap-3 mb-3 px-2">
        <span className="text-sm font-medium text-slate-300">
          PDF Field Preview
        </span>
        <div className="flex items-center gap-1">
          <button
            className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-white"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          >
            −
          </button>
          <span className="text-xs text-slate-400 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-white"
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
          >
            +
          </button>
        </div>
        <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            className="rounded"
          />
          Show field IDs
        </label>
        <span className="text-xs text-slate-500">
          {fieldRects.length} fields
        </span>
      </div>

      {loading && (
        <div className="text-center text-slate-400 py-8">Loading PDF...</div>
      )}

      {/* Pages */}
      <div className="overflow-auto max-h-[70vh] rounded-lg border border-slate-700 bg-slate-900 p-2">
        {Array.from({ length: pageCount }, (_, pageIdx) => (
          <div key={pageIdx} className="mb-4 last:mb-0">
            <div className="text-xs text-slate-500 mb-1 px-1">
              Page {pageIdx + 1}
            </div>
            <div className="relative inline-block">
              <canvas
                ref={setCanvasRef(pageIdx)}
                className="block rounded shadow-lg"
              />
              {/* Field overlays */}
              {showLabels &&
                (fieldsByPage[pageIdx] || []).map((field, i) => {
                  const page = pdfDocRef.current
                    ? undefined
                    : undefined;
                  // PDF coords: origin at bottom-left; canvas: origin at top-left
                  const canvas = canvasRefs.current.get(pageIdx);
                  if (!canvas) return null;

                  const canvasW = canvas.width;
                  const canvasH = canvas.height;
                  const pdfW = field.page_width;
                  const pdfH = field.page_height;
                  const sx = canvasW / pdfW;
                  const sy = canvasH / pdfH;

                  const [x1, y1, x2, y2] = field.rect;
                  // Flip Y axis (PDF bottom-left → canvas top-left)
                  const left = Math.min(x1, x2) * sx;
                  const top = canvasH - Math.max(y1, y2) * sy;
                  const width = Math.abs(x2 - x1) * sx;
                  const height = Math.abs(y2 - y1) * sy;

                  const isHighlighted = highlightFields?.has(field.name);

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
                    >
                      {/* Field highlight rectangle */}
                      <div
                        className={`absolute inset-0 border cursor-pointer transition-colors ${
                          isHighlighted
                            ? 'border-green-400 bg-green-400/20'
                            : 'border-indigo-400/60 bg-indigo-400/10 hover:bg-indigo-400/25'
                        }`}
                        onClick={() => onFieldClick?.(field.name)}
                        title={field.name}
                      />
                      {/* Field ID label */}
                      <div
                        className={`absolute left-0 whitespace-nowrap pointer-events-none text-[9px] leading-tight font-mono px-0.5 rounded-sm ${
                          isHighlighted
                            ? 'bg-green-600 text-white'
                            : 'bg-indigo-600/90 text-white'
                        }`}
                        style={{ bottom: '100%', marginBottom: '1px' }}
                      >
                        {field.name}
                      </div>
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
