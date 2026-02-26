import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface ErrorDialogProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}

export function ErrorDialog({ isOpen, message, onClose }: ErrorDialogProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Dialog */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-red-50 to-orange-50 p-6 border-b border-red-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Connection Error</h3>
                  <p className="text-sm text-slate-600 mt-1">Unable to connect to backend</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <p className="text-slate-700 leading-relaxed">{message}</p>

            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm text-slate-800">To fix this issue:</h4>
              <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                <li>
                  Ensure the FastAPI backend is running:
                  <code className="block mt-1 bg-slate-800 text-green-400 px-3 py-2 rounded font-mono text-xs">
                    uvicorn actual.back.fillable_processor:app --reload --host 0.0.0.0 --port 8000
                  </code>
                </li>
                <li>Add CORS support to your FastAPI app (in fillable_processor.py):
                  <code className="block mt-1 bg-slate-800 text-green-400 px-3 py-2 rounded font-mono text-xs overflow-x-auto">
                    {`from fastapi.middleware.cors import CORSMiddleware\n\napp.add_middleware(\n  CORSMiddleware,\n  allow_origins=["*"],\n  allow_methods=["*"],\n  allow_headers=["*"]\n)`}
                  </code>
                </li>
                <li>Or enable Demo Mode in App.tsx by setting DEMO_MODE = true</li>
              </ol>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-slate-50 p-6 flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Close
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
