import { useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { FileText, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { useTranslation } from '../i18n/I18nContext';

interface AdInterstitialProps {
  onComplete: () => void;
  templateTitle: string;
}

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT?.trim() || 'ca-pub-8314082563234213';
const ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT?.trim() || '';
const ADSENSE_SCRIPT_ID = 'adsense-script';
const hasAdsenseConfig = /^ca-pub-\d+$/.test(ADSENSE_CLIENT) && /^\d+$/.test(ADSENSE_SLOT);

function ensureAdsenseScript() {
  if (!hasAdsenseConfig || typeof document === 'undefined') return;
  if (document.getElementById(ADSENSE_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
  document.head.appendChild(script);
}

export function AdInterstitial({
  onComplete,
  templateTitle,
}: AdInterstitialProps) {
  const adRef = useRef<HTMLModElement>(null);
  const adPushedRef = useRef(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!hasAdsenseConfig) onComplete();
  }, [onComplete]);

  // Load and push an ad only when real AdSense IDs are configured.
  useEffect(() => {
    if (!hasAdsenseConfig || adPushedRef.current) return;

    ensureAdsenseScript();

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      adPushedRef.current = true;
    } catch {
      // AdSense can be unavailable in dev, before domain approval, or when blocked by an extension.
      // The document flow still remains usable after the timer finishes.
    }
  }, []);

  const handleContinue = useCallback(() => {
    onComplete();
  }, [onComplete]);

  if (!hasAdsenseConfig) return null;

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
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              {t('ad.sponsored')}
            </span>
          </div>

          <div className="min-h-[280px] flex items-center justify-center p-4">
            <ins
              ref={adRef}
              className="adsbygoogle"
              style={{ display: 'block', width: '100%', minHeight: '250px' }}
              data-ad-client={ADSENSE_CLIENT}
              data-ad-slot={ADSENSE_SLOT}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </div>
        </motion.div>

        {/* The ad is optional; access to the completed PDF is never timed or gated. */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center"
        >
          <Button
            size="lg"
            onClick={handleContinue}
            className="px-8 py-6 rounded-xl text-base bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl"
          >
            {t('ad.continue')} <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
