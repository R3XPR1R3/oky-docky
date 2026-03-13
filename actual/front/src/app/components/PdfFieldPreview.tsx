import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

interface FieldRect {
  name: string;
  page: number;
  rect: [number, number, number, number];
  page_width: number;
  page_height: number;
}

/** A manually placed overlay field (from mapping with type=text_overlay) */
interface OverlayField {
  schemaKey: string;
  page: number;
  rect: [number, number, number, number];
  page_width: number;
  page_height: number;
}

interface PdfFieldPreviewProps {
  templateId: string;
  mapping?: Record<string, any>;
  onFieldClick?: (pdfFieldName: string) => void;
  onMappingRemove?: (schemaKey: string) => void;
  /** Called when a new text_overlay field is drawn on the PDF */
  onOverlayAdd?: (schemaKey: string, overlayMapping: Record<string, any>) => void;
  /** Called when an overlay is moved/resized */
  onOverlayUpdate?: (schemaKey: string, overlayMapping: Record<string, any>) => void;
}

function buildReverseMapping(mapping: Record<string, any>): Record<string, string> {
  const reverse: Record<string, string> = {};
  for (const [schemaKey, value] of Object.entries(mapping)) {
    if (typeof value === 'string') {
      reverse[value] = schemaKey;
    } else if (typeof value === 'object' && value !== null) {
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

/** Extract text_overlay entries from mapping into visual overlay fields */
function extractOverlayFields(mapping: Record<string, any>, pageInfos: Map<number, { width: number; height: number }>): OverlayField[] {
  const result: OverlayField[] = [];
  for (const [schemaKey, value] of Object.entries(mapping)) {
    if (typeof value === 'object' && value !== null && value.type === 'text_overlay') {
      const page = value.page ?? 0;
      const info = pageInfos.get(page);
      result.push({
        schemaKey,
        page,
        rect: value.rect || [50, 50, 250, 70],
        page_width: info?.width ?? 612,
        page_height: info?.height ?? 792,
      });
    }
  }
  return result;
}

export default function PdfFieldPreview({
  templateId,
  mapping = {},
  onFieldClick,
  onMappingRemove,
  onOverlayAdd,
  onOverlayUpdate,
}: PdfFieldPreviewProps) {
  const [fieldRects, setFieldRects] = useState<FieldRect[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const [showLabels, setShowLabels] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drawing, setDrawing] = useState<{ pageIdx: number; startX: number; startY: number; curX: number; curY: number } | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [pendingRect, setPendingRect] = useState<{ pageIdx: number; rect: [number, number, number, number] } | null>(null);
  const [overlayDrag, setOverlayDrag] = useState<{
    schemaKey: string;
    pageIdx: number;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    initialRect: [number, number, number, number];
  } | null>(null);

  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const pageInfosRef = useRef<Map<number, { width: number; height: number }>>(new Map());

  const reverseMapping = useMemo(() => buildReverseMapping(mapping), [mapping]);
  const overlayFields = useMemo(
    () => extractOverlayFields(mapping, pageInfosRef.current),
    [mapping],
  );

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

    const pdfUrl = `/api/templates/${templateId}/pdf-file`;
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
    });

    console.info('[PdfFieldPreview] Loading PDF', {
      templateId,
      pdfUrl,
      workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc,
    });

    loadingTask.promise.then((pdf) => {
        pdfDocRef.current = pdf;
        setPageCount(pdf.numPages);
        setLoading(false);
      })
      .catch((e) => {
        console.error('[PdfFieldPreview] PDF load failed', {
          templateId,
          pdfUrl,
          error: e,
        });
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
        // Store page info for PDF coord conversions
        const mediaBox = page.getViewport({ scale: 1 });
        pageInfosRef.current.set(i - 1, { width: mediaBox.width, height: mediaBox.height });
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

  // Convert canvas pixel coords to PDF coords
  const canvasToPdf = useCallback((pageIdx: number, cx: number, cy: number): [number, number] => {
    const canvas = canvasRefs.current.get(pageIdx);
    const info = pageInfosRef.current.get(pageIdx);
    if (!canvas || !info) return [cx, cy];
    const sx = info.width / canvas.width;
    const sy = info.height / canvas.height;
    // PDF y is bottom-up
    return [cx * sx, info.height - cy * sy];
  }, []);

  // Drawing handlers
  const handleMouseDown = useCallback((pageIdx: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrawing({ pageIdx, startX: x, startY: y, curX: x, curY: y });
  }, [drawMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (overlayDrag) {
      const canvas = canvasRefs.current.get(overlayDrag.pageIdx);
      const info = pageInfosRef.current.get(overlayDrag.pageIdx);
      if (!canvas || !info) return;

      const parentRect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - parentRect.left;
      const y = e.clientY - parentRect.top;
      const dxPx = x - overlayDrag.startX;
      const dyPx = y - overlayDrag.startY;
      const dxPdf = dxPx * (info.width / canvas.width);
      const dyPdf = -dyPx * (info.height / canvas.height);

      const minWidth = 20;
      const minHeight = 8;
      const nextRect: [number, number, number, number] = overlayDrag.mode === 'move'
        ? [
          overlayDrag.initialRect[0] + dxPdf,
          overlayDrag.initialRect[1] + dyPdf,
          overlayDrag.initialRect[2] + dxPdf,
          overlayDrag.initialRect[3] + dyPdf,
        ]
        : [
          overlayDrag.initialRect[0],
          overlayDrag.initialRect[1],
          Math.max(overlayDrag.initialRect[0] + minWidth, overlayDrag.initialRect[2] + dxPdf),
          Math.max(overlayDrag.initialRect[1] + minHeight, overlayDrag.initialRect[3] + dyPdf),
        ];

      onOverlayUpdate?.(overlayDrag.schemaKey, {
        ...(mapping[overlayDrag.schemaKey] || {}),
        type: 'text_overlay',
        page: overlayDrag.pageIdx,
        rect: nextRect.map((v) => Math.round(v * 10) / 10),
      });
      return;
    }

    if (!drawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrawing((d) => d ? { ...d, curX: x, curY: y } : null);
  }, [drawing, mapping, onOverlayUpdate, overlayDrag]);

  const handleMouseUp = useCallback(() => {
    if (overlayDrag) {
      setOverlayDrag(null);
      return;
    }
    if (!drawing) return;
    const { pageIdx, startX, startY, curX, curY } = drawing;
    const w = Math.abs(curX - startX);
    const h = Math.abs(curY - startY);
    if (w < 10 || h < 5) {
      setDrawing(null);
      return;
    }
    // Convert to PDF coordinates
    const [px1, py1] = canvasToPdf(pageIdx, Math.min(startX, curX), Math.min(startY, curY));
    const [px2, py2] = canvasToPdf(pageIdx, Math.max(startX, curX), Math.max(startY, curY));
    // PDF rect: [x1, y_bottom, x2, y_top] — y1 < y2
    const pdfRect: [number, number, number, number] = [
      Math.round(px1 * 10) / 10,
      Math.round(Math.min(py1, py2) * 10) / 10,
      Math.round(px2 * 10) / 10,
      Math.round(Math.max(py1, py2) * 10) / 10,
    ];
    setPendingRect({ pageIdx, rect: pdfRect });
    setDrawing(null);
    setNewFieldName('');
  }, [drawing, canvasToPdf, overlayDrag]);

  const confirmNewField = useCallback(() => {
    if (!pendingRect || !newFieldName.trim()) return;
    const key = newFieldName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const overlayMapping = {
      type: 'text_overlay',
      page: pendingRect.pageIdx,
      rect: pendingRect.rect,
      font_size: null,
      font: 'Helvetica',
      align: 'L',
    };
    onOverlayAdd?.(key, overlayMapping);
    setPendingRect(null);
    setNewFieldName('');
  }, [pendingRect, newFieldName, onOverlayAdd]);

  // Stats
  const mappedCount = fieldRects.filter((f) => reverseMapping[f.name]).length;
  const unmappedCount = fieldRects.length - mappedCount;
  const overlayCount = overlayFields.length;

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

  // Overlay fields by page
  const overlaysByPage = useMemo(() => {
    return overlayFields.reduce<Record<number, OverlayField[]>>((acc, f) => {
      (acc[f.page] ??= []).push(f);
      return acc;
    }, {});
  }, [overlayFields]);

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

        {/* Draw mode toggle */}
        <button
          className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
            drawMode
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700'
          }`}
          onClick={() => { setDrawMode(!drawMode); setPendingRect(null); setDrawing(null); }}
        >
          {drawMode ? '✎ Drawing...' : '+ Place Field'}
        </button>

        {overlayCount > 0 && (
          <span className="text-xs text-blue-600 font-medium">
            {overlayCount} overlay{overlayCount !== 1 ? 's' : ''}
          </span>
        )}

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

      {drawMode && (
        <div className="mb-3 px-2 py-2 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-700">
          Draw a rectangle on the PDF where you want to place a new text field. The text will be stamped at that position when the form is filled.
        </div>
      )}

      {!loading && fieldRects.length === 0 && (
        <div className="mb-3 px-2 py-2 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-700">
          This PDF has no built-in AcroForm fields. Use <strong>+ Place Field</strong> to create overlay fields and map them to schema keys.
        </div>
      )}

      {loading && (
        <div className="text-center text-slate-400 py-8">Loading PDF...</div>
      )}

      {/* New field name dialog */}
      {pendingRect && (
        <div className="mb-3 px-3 py-3 bg-blue-50 rounded-xl border-2 border-blue-300 flex items-center gap-3">
          <span className="text-sm text-blue-700 font-medium whitespace-nowrap">Field key:</span>
          <input
            type="text"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmNewField(); if (e.key === 'Escape') setPendingRect(null); }}
            placeholder="e.g. full_name, address_line1"
            className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded-lg font-mono focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <button
            onClick={confirmNewField}
            disabled={!newFieldName.trim()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create
          </button>
          <button
            onClick={() => setPendingRect(null)}
            className="px-3 py-1.5 text-sm bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Pages */}
      <div className="overflow-auto max-h-[75vh] rounded-xl border border-slate-200 bg-slate-50 p-3">
        {Array.from({ length: pageCount }, (_, pageIdx) => (
          <div key={pageIdx} className="mb-6 last:mb-0">
            <div className="text-xs text-slate-400 mb-1 px-1 font-medium">
              Page {pageIdx + 1}
            </div>
            <div
              className={`relative inline-block ${drawMode ? 'cursor-crosshair' : ''}`}
              onMouseDown={(e) => handleMouseDown(pageIdx, e)}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <canvas
                ref={setCanvasRef(pageIdx)}
                className="block rounded-lg shadow-md"
              />

              {/* Drawing rectangle preview */}
              {drawing && drawing.pageIdx === pageIdx && (
                <div
                  className="absolute border-2 border-blue-500 bg-blue-400/20 pointer-events-none"
                  style={{
                    left: `${Math.min(drawing.startX, drawing.curX)}px`,
                    top: `${Math.min(drawing.startY, drawing.curY)}px`,
                    width: `${Math.abs(drawing.curX - drawing.startX)}px`,
                    height: `${Math.abs(drawing.curY - drawing.startY)}px`,
                  }}
                />
              )}

              {/* Pending rect highlight */}
              {pendingRect && pendingRect.pageIdx === pageIdx && (() => {
                const canvas = canvasRefs.current.get(pageIdx);
                const info = pageInfosRef.current.get(pageIdx);
                if (!canvas || !info) return null;
                const sx = canvas.width / info.width;
                const sy = canvas.height / info.height;
                const [x1, y1, x2, y2] = pendingRect.rect;
                const left = Math.min(x1, x2) * sx;
                const top = canvas.height - Math.max(y1, y2) * sy;
                const width = Math.abs(x2 - x1) * sx;
                const height = Math.abs(y2 - y1) * sy;
                return (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-400/25 pointer-events-none animate-pulse"
                    style={{ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }}
                  />
                );
              })()}

              {/* Overlay fields (text_overlay from mapping) */}
              {showLabels && (overlaysByPage[pageIdx] || []).map((overlay, i) => {
                const canvas = canvasRefs.current.get(pageIdx);
                const info = pageInfosRef.current.get(pageIdx);
                if (!canvas || !info) return null;
                const sx = canvas.width / info.width;
                const sy = canvas.height / info.height;
                const [x1, y1, x2, y2] = overlay.rect;
                const left = Math.min(x1, x2) * sx;
                const top = canvas.height - Math.max(y1, y2) * sy;
                const width = Math.abs(x2 - x1) * sx;
                const height = Math.abs(y2 - y1) * sy;

                return (
                  <div
                    key={`overlay-${overlay.schemaKey}-${i}`}
                    className="absolute group"
                    style={{ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }}
                    onMouseEnter={() => setHoveredField(`overlay:${overlay.schemaKey}`)}
                    onMouseLeave={() => setHoveredField(null)}
                  >
                    <div
                      className="absolute inset-0 border-2 border-blue-500 bg-blue-400/15 hover:bg-blue-400/30 cursor-pointer transition-all border-dashed"
                      onClick={() => {
                        navigator.clipboard.writeText(overlay.schemaKey);
                      }}
                      onMouseDown={(e) => {
                        if (drawMode) return;
                        e.stopPropagation();
                        const parent = e.currentTarget.parentElement;
                        if (!parent) return;
                        const parentRect = parent.getBoundingClientRect();
                        setOverlayDrag({
                          schemaKey: overlay.schemaKey,
                          pageIdx,
                          mode: 'move',
                          startX: e.clientX - parentRect.left,
                          startY: e.clientY - parentRect.top,
                          initialRect: [...overlay.rect],
                        });
                      }}
                      title={`Text overlay: ${overlay.schemaKey}`}
                    />
                    <div
                      className="absolute w-3 h-3 bg-blue-600 border border-white rounded-sm cursor-nwse-resize"
                      style={{ right: '-6px', bottom: '-6px' }}
                      onMouseDown={(e) => {
                        if (drawMode) return;
                        e.stopPropagation();
                        const parent = e.currentTarget.parentElement;
                        if (!parent) return;
                        const parentRect = parent.getBoundingClientRect();
                        setOverlayDrag({
                          schemaKey: overlay.schemaKey,
                          pageIdx,
                          mode: 'resize',
                          startX: e.clientX - parentRect.left,
                          startY: e.clientY - parentRect.top,
                          initialRect: [...overlay.rect],
                        });
                      }}
                      title="Resize overlay"
                    />
                    <div
                      className="absolute left-0 whitespace-nowrap pointer-events-none text-[9px] leading-tight font-mono px-1 py-0.5 rounded-sm shadow-sm bg-blue-600 text-white"
                      style={{ bottom: '100%', marginBottom: '1px' }}
                    >
                      <span className="font-semibold">{overlay.schemaKey}</span>
                      <span className="opacity-60 ml-1">(overlay)</span>
                    </div>
                    {hoveredField === `overlay:${overlay.schemaKey}` && (
                      <div
                        className="absolute z-10 bg-white rounded-lg shadow-xl border border-slate-200 p-2 min-w-[180px]"
                        style={{ top: '100%', left: 0, marginTop: '4px' }}
                      >
                        <div className="text-[10px] font-mono text-blue-600 mb-1">{overlay.schemaKey}</div>
                        <div className="text-[10px] text-slate-400 mb-1">
                          Page {overlay.page + 1} | Rect: [{overlay.rect.map(v => Math.round(v)).join(', ')}]
                        </div>
                        {onMappingRemove && (
                          <button
                            className="text-[11px] text-red-500 hover:text-red-700 hover:underline pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMappingRemove(overlay.schemaKey);
                            }}
                          >
                            Remove overlay
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* AcroForm field overlays */}
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
                      <div
                        className={`absolute inset-0 border-2 cursor-pointer transition-all ${
                          isMapped
                            ? 'border-green-500 bg-green-400/15 hover:bg-green-400/30'
                            : 'border-orange-400/70 bg-orange-400/10 hover:bg-orange-400/25'
                        }`}
                        onClick={() => onFieldClick?.(field.name)}
                        title={isMapped ? `${field.name} → ${schemaKey}` : `${field.name} (unmapped)`}
                      />
                      <div
                        className={`absolute left-0 whitespace-nowrap pointer-events-none text-[9px] leading-tight font-mono px-1 py-0.5 rounded-sm shadow-sm ${
                          isMapped ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'
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
