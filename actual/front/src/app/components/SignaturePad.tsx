import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Type, Pen, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface SignaturePadProps {
  value: string;
  onChange: (value: string) => void;
}

type Mode = 'type' | 'draw';

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const [mode, setMode] = useState<Mode>(() =>
    value && value.startsWith('data:image') ? 'draw' : 'type'
  );
  const [typedName, setTypedName] = useState(() =>
    value && !value.startsWith('data:image') ? value : ''
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasDrawnRef = useRef(false);

  // Initialize canvas when switching to draw mode
  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // set canvas resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // clear
    ctx.clearRect(0, 0, rect.width, rect.height);

    // if we have an existing drawn signature, restore it
    if (value && value.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        hasDrawnRef.current = true;
      };
      img.src = value;
    }

    // draw guide line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, rect.height - 20);
    ctx.lineTo(rect.width - 16, rect.height - 20);
    ctx.stroke();

    // set drawing style
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [mode]);

  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawingRef.current = true;
    lastPointRef.current = getPoint(e);
  }, [getPoint]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const point = getPoint(e);
    const last = lastPointRef.current;
    if (!point || !last) return;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    lastPointRef.current = point;
    hasDrawnRef.current = true;
  }, [getPoint]);

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;

    // export canvas to data URL
    const canvas = canvasRef.current;
    if (canvas && hasDrawnRef.current) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  }, [onChange]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width * 2, rect.height * 2);

    // re-draw guide line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, rect.height - 20);
    ctx.lineTo(rect.width - 16, rect.height - 20);
    ctx.stroke();

    hasDrawnRef.current = false;
    onChange('');
  }, [onChange]);

  const handleTypedChange = (text: string) => {
    setTypedName(text);
    onChange(text);
  };

  const handleModeSwitch = (newMode: Mode) => {
    setMode(newMode);
    onChange('');
    setTypedName('');
    hasDrawnRef.current = false;
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeSwitch('type')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            mode === 'type'
              ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
              : 'bg-slate-100 text-slate-500 border-2 border-transparent hover:bg-slate-200'
          }`}
        >
          <Type className="w-4 h-4" />
          Type name
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('draw')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            mode === 'draw'
              ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
              : 'bg-slate-100 text-slate-500 border-2 border-transparent hover:bg-slate-200'
          }`}
        >
          <Pen className="w-4 h-4" />
          Draw signature
        </button>
      </div>

      {/* Type mode */}
      {mode === 'type' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <input
            type="text"
            value={typedName}
            onChange={(e) => handleTypedChange(e.target.value)}
            placeholder="Type your full name"
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-base focus:border-indigo-500 focus:outline-none transition-colors"
          />
          {typedName && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
              <p className="text-xs text-slate-400 mb-2">Preview</p>
              <p
                className="text-3xl text-slate-800"
                style={{ fontFamily: "'Brush Script MT', 'Segoe Script', 'Apple Chancery', cursive" }}
              >
                {typedName}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Draw mode */}
      {mode === 'draw' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="relative bg-white border-2 border-slate-200 rounded-xl overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair touch-none"
              style={{ height: 140 }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <div className="absolute bottom-2 left-3 text-xs text-slate-300 pointer-events-none select-none">
              Sign here
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearCanvas}
              className="text-slate-500 hover:text-red-500"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
