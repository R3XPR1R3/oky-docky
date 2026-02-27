import { motion } from 'motion/react';
import { FileText, ArrowLeft, ArrowRight, MessageCircle, Download, CheckCircle, MousePointerClick } from 'lucide-react';
import { Button } from './ui/button';

interface HowItWorksProps {
  onBack: () => void;
  onGetStarted: () => void;
}

/* Memphis-style accent shapes (decorative, positioned absolutely) */
function MemphisShapes({ variant }: { variant: 1 | 2 | 3 }) {
  const shapes: Record<number, JSX.Element> = {
    1: (
      <>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="absolute -top-6 -right-6 w-20 h-20 rounded-full border-4 border-dashed border-pink-300 opacity-60" />
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="absolute bottom-4 -left-4 w-12 h-12 bg-yellow-300 rounded-lg rotate-12 opacity-50" />
        <motion.div className="absolute top-1/2 -right-3 w-6 h-6 bg-teal-400 rounded-full opacity-40" />
      </>
    ),
    2: (
      <>
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} className="absolute -top-4 -left-4 w-16 h-16 border-4 border-dashed border-teal-300 opacity-50" style={{ borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%' }} />
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute -bottom-3 right-8 w-8 h-8 bg-pink-400 rounded-full opacity-40" />
        <motion.div className="absolute top-8 -right-5 w-10 h-4 bg-yellow-400 rounded-full rotate-45 opacity-50" />
      </>
    ),
    3: (
      <>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full border-4 border-dashed border-yellow-300 opacity-50" />
        <motion.div animate={{ x: [0, 8, 0] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-2 -left-3 w-8 h-8 bg-teal-300 rounded-lg rotate-45 opacity-50" />
        <motion.div className="absolute bottom-1/3 -left-4 w-5 h-5 bg-pink-300 rounded-full opacity-40" />
      </>
    ),
  };
  return shapes[variant] || null;
}

export function HowItWorks({ onBack, onGetStarted }: HowItWorksProps) {
  const steps = [
    {
      number: '01',
      title: 'Pick Your Form',
      description: 'Browse our library of IRS forms — W-9, W-4, 1099-NEC, and more. Each form is optimized with smart fields that know what information you need.',
      icon: MousePointerClick,
      color: 'from-indigo-500 to-blue-500',
      accent: 'bg-indigo-100 text-indigo-600',
      memphis: 1 as const,
      illustration: (
        <div className="relative w-full h-48 flex items-center justify-center">
          {/* Stacked document cards */}
          <motion.div
            initial={{ rotate: -8, x: -20 }}
            whileInView={{ rotate: -8, x: -20 }}
            className="absolute w-36 h-44 bg-white rounded-xl shadow-lg border border-slate-200 p-4"
          >
            <div className="w-full h-3 bg-slate-200 rounded mb-2" />
            <div className="w-3/4 h-3 bg-slate-100 rounded mb-4" />
            <div className="space-y-2">
              <div className="w-full h-2 bg-slate-100 rounded" />
              <div className="w-full h-2 bg-slate-100 rounded" />
              <div className="w-2/3 h-2 bg-slate-100 rounded" />
            </div>
          </motion.div>
          <motion.div
            initial={{ rotate: 4, x: 20, y: 10 }}
            whileInView={{ rotate: 4, x: 20, y: 10 }}
            className="absolute w-36 h-44 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-xl border-2 border-indigo-200 p-4"
          >
            <div className="w-full h-3 bg-indigo-200 rounded mb-2" />
            <div className="w-3/4 h-3 bg-indigo-100 rounded mb-4" />
            <div className="space-y-2">
              <div className="w-full h-2 bg-indigo-100 rounded" />
              <div className="w-full h-2 bg-indigo-100 rounded" />
              <div className="w-2/3 h-2 bg-indigo-100 rounded" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center"
            >
              <CheckCircle className="w-5 h-5 text-white" />
            </motion.div>
          </motion.div>
        </div>
      ),
    },
    {
      number: '02',
      title: 'Answer Simple Questions',
      description: 'No tax jargon, no confusion. We ask you one question at a time in plain English. Smart logic shows only the questions relevant to your situation.',
      icon: MessageCircle,
      color: 'from-purple-500 to-pink-500',
      accent: 'bg-purple-100 text-purple-600',
      memphis: 2 as const,
      illustration: (
        <div className="relative w-full h-48 flex items-center justify-center">
          {/* Chat bubbles animation */}
          <div className="space-y-3 w-56">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
              className="flex items-start gap-2"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0" />
              <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-2 text-sm text-slate-700">What's your full name?</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              viewport={{ once: true }}
              className="flex justify-end"
            >
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl rounded-tr-none px-4 py-2 text-sm text-white">Jane Doe</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 }}
              viewport={{ once: true }}
              className="flex items-start gap-2"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0" />
              <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-2 text-sm text-slate-700">Are you filing as...?</div>
            </motion.div>
          </div>
        </div>
      ),
    },
    {
      number: '03',
      title: 'Download & File',
      description: 'Your completed form is generated instantly as a ready-to-file PDF. Download it, print it, or submit it electronically — you\'re done!',
      icon: Download,
      color: 'from-teal-500 to-green-500',
      accent: 'bg-teal-100 text-teal-600',
      memphis: 3 as const,
      illustration: (
        <div className="relative w-full h-48 flex items-center justify-center">
          {/* Download animation */}
          <motion.div className="relative">
            <div className="w-40 h-48 bg-white rounded-xl shadow-xl border-2 border-green-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-green-600" />
                <span className="text-xs font-bold text-green-700">Form W-9</span>
              </div>
              <div className="space-y-2">
                <div className="w-full h-2 bg-green-100 rounded" />
                <div className="w-full h-2 bg-green-100 rounded" />
                <div className="w-3/4 h-2 bg-green-100 rounded" />
              </div>
              <div className="mt-3 flex items-center gap-1">
                <div className="w-6 h-6 rounded border border-green-300 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <span className="text-xs text-green-600 font-medium">Verified</span>
              </div>
            </div>
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-teal-500 to-green-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> Ready!
            </motion.div>
          </motion.div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-white/20 backdrop-blur-sm bg-white/40 sticky top-0 z-30"
      >
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Oky-Docky
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero */}
      <div className="container mx-auto px-4 pt-16 pb-8 max-w-4xl text-center">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Three Steps.{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Zero Stress.
            </span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            We turned confusing IRS paperwork into a friendly conversation. Here's how it works.
          </p>
        </motion.div>
      </div>

      {/* Steps */}
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="space-y-24">
          {steps.map((step, index) => {
            const isReversed = index % 2 !== 0;
            return (
              <motion.div
                key={step.number}
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className={`flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12`}
              >
                {/* Illustration */}
                <div className="flex-1 relative">
                  <MemphisShapes variant={step.memphis} />
                  <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-8 border border-slate-200 shadow-lg relative overflow-hidden">
                    {step.illustration}
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 space-y-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${step.accent}`}>
                    <step.icon className="w-4 h-4" />
                    Step {step.number}
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-slate-800">{step.title}</h2>
                  <p className="text-lg text-slate-600 leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        className="container mx-auto px-4 py-24 max-w-3xl text-center"
      >
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 text-white relative overflow-hidden">
          <h2 className="text-3xl font-bold mb-4">Ready to try it?</h2>
          <p className="text-lg mb-8 opacity-90">Fill your first form in under 5 minutes. Free.</p>
          <Button
            size="lg"
            onClick={onGetStarted}
            className="bg-white text-indigo-600 hover:bg-slate-50 px-8 py-6 text-lg rounded-xl shadow-lg"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
