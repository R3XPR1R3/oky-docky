import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Pen, RotateCcw, Type } from 'lucide-react';
import { Button } from './ui/button';
import { useTranslation } from '../i18n/I18nContext';

interface SignaturePadProps {
  value: string;
  onChange: (value: string) => void;
}

type Mode = 'draw' | 'type';

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const { t } = useTranslation();
  const initialIsImage = value.startsWith('data:image');
  const [mode, setMode] = useState<Mode>(value && !initialIsImage ? 'type' : 'draw');
  const [typedName, setTypedName] = useState(initialIsImage ? '' : value);
  const [drawnValue, setDrawnValue] = useState(initialIsImage ? value : '');
  const [hasDrawn, setHasDrawn] = useState(initialIsImage);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const configureCanvas = useCallback((imageValue = drawnValue) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#312e81';
    ctx.fillStyle = '#312e81';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (imageValue.startsWith('data:image')) {
      const image = new Image();
      image.onload = () => {
        const current = canvasRef.current;
        const currentCtx = current?.getContext('2d');
        if (!current || !currentCtx) return;
        const currentRect = current.getBoundingClientRect();
        currentCtx.drawImage(image, 0, 0, currentRect.width, currentRect.height);
      };
      image.src = imageValue;
    }
  }, [drawnValue]);

  useEffect(() => {
    if (mode !== 'draw') return;
    configureCanvas();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => configureCanvas());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [mode, configureCanvas]);

  useEffect(() => {
    if (value.startsWith('data:image') && value !== drawnValue) {
      setDrawnValue(value);
      setHasDrawn(true);
      if (mode === 'draw') configureCanvas(value);
    } else if (value && !value.startsWith('data:image') && value !== typedName) {
      setTypedName(value);
    }
  }, [value, drawnValue, typedName, mode, configureCanvas]);

  const getPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const startDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx) return;
    drawingRef.current = true;
    lastPointRef.current = point;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
    setHasDrawn(true);
  }, [getPoint]);

  const draw = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const point = getPoint(event);
    const previous = lastPointRef.current;
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx || !previous) return;
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  }, [getPoint]);

  const stopDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const dataUrl = event.currentTarget.toDataURL('image/png');
    setDrawnValue(dataUrl);
    onChange(dataUrl);
  }, [onChange]);

  const clearCanvas = useCallback(() => {
    setDrawnValue('');
    setHasDrawn(false);
    configureCanvas('');
    onChange('');
  }, [configureCanvas, onChange]);

  const handleTypedChange = (text: string) => {
    setTypedName(text);
    onChange(text);
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    onChange(nextMode === 'draw' ? drawnValue : typedName);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
        <button type="button" onClick={() => switchMode('draw')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${mode === 'draw' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:text-slate-700'}`}>
          <Pen className="h-4 w-4" />
          {t('signature.draw')}
        </button>
        <button type="button" onClick={() => switchMode('type')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${mode === 'type' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:text-slate-700'}`}>
          <Type className="h-4 w-4" />
          {t('signature.type')}
        </button>
      </div>

      {mode === 'draw' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-white to-indigo-50/40 shadow-inner focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
            <canvas
              ref={canvasRef}
              aria-label={t('signature.draw')}
              className="block h-44 w-full cursor-crosshair touch-none outline-none"
              tabIndex={0}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
            />
            <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-indigo-200" />
            <div className="pointer-events-none absolute bottom-3 left-5 select-none text-xs font-medium text-indigo-300">
              {t('signature.drawHint')}
            </div>
            {hasDrawn && (
              <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                <Check className="h-3.5 w-3.5" /> Saved
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Use a mouse, touchpad, or touchscreen. Only your ink is added to the PDF.</p>
            <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} disabled={!hasDrawn} className="shrink-0 text-slate-500 hover:text-red-600">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {t('signature.clear')}
            </Button>
          </div>
        </motion.div>
      )}

      {mode === 'type' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <input type="text" value={typedName} onChange={(event) => handleTypedChange(event.target.value)} placeholder={t('signature.typeNamePlaceholder')} className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base outline-none transition-colors focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
          {typedName && (
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 p-6 text-center">
              <p className="mb-2 text-xs text-slate-400">{t('signature.preview')}</p>
              <p className="text-3xl text-indigo-950" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', 'Apple Chancery', cursive" }}>{typedName}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
