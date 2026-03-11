import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { FileText, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { useTranslation } from '../i18n/I18nContext';

interface AdInterstitialProps {
  /** How many seconds to wait before allowing skip */
  duration?: number;
  /** Called when user can proceed (timer done or skip) */
  onComplete: () => void;
  templateTitle: string;
}

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export function AdInterstitial({
  duration = 7,
  onComplete,
  templateTitle,
}: AdInterstitialProps) {
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [canSkip, setCanSkip] = useState(false);
  const adRef = useRef<HTMLModElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          setCanSkip(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Push ad when component mounts
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded — that's fine, ad slot will be empty
    }
  }, []);

  const handleContinue = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const progress = ((duration - secondsLeft) / duration) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-white/20 backdrop-blur-sm bg-white/40"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {t('app.name')}
            </span>
          </div>
        </div>
      </motion.header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Status message */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700 text-sm font-medium mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('ad.preparing')}
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">
            {t('ad.almostReady')}
          </h2>
          <p className="text-slate-500 text-sm">
            {t('ad.subtitle', { template: templateTitle })}
          </p>
        </motion.div>

        {/* Ad container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden mb-6"
        >
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              {t('ad.sponsored')}
            </span>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500">
                {canSkip ? t('ad.ready') : `${secondsLeft}s`}
              </span>
            </div>
          </div>

          {/* Ad slot — replace data-ad-client and data-ad-slot with your AdSense values */}
          <div className="min-h-[280px] flex items-center justify-center p-4">
            <ins
              ref={adRef}
              className="adsbygoogle"
              style={{ display: 'block', width: '100%', minHeight: '250px' }}
              data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
              data-ad-slot="XXXXXXXXXX"
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </div>
        </motion.div>

        {/* Progress bar + skip button */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Continue button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleContinue}
              disabled={!canSkip}
              className={`px-8 py-6 rounded-xl text-base transition-all ${
                canSkip
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {canSkip ? (
                <>
                  {t('ad.continue')} <ArrowRight className="w-5 h-5 ml-2" />
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  {t('ad.waitSeconds', { seconds: String(secondsLeft) })}
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
