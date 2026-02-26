import { motion } from 'motion/react';
import { FileText, Download, CheckCircle, ArrowRight, Sparkles, Mail, Share2 } from 'lucide-react';
import { Button } from './ui/button';

interface SuccessPageProps {
  pdfUrl: string;
  templateTitle: string;
  onStartOver: () => void;
}

export function SuccessPage({ pdfUrl, templateTitle, onStartOver }: SuccessPageProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${templateTitle.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen">
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
              Oky-Docky
            </span>
          </div>
        </div>
      </motion.header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 mb-6 relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
              className="absolute inset-0 rounded-full bg-green-500 opacity-20 animate-ping"
            />
            <CheckCircle className="w-16 h-16 text-green-600 relative z-10" />
          </div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-6xl font-bold mb-4"
          >
            All Done!
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-slate-600 max-w-2xl mx-auto"
          >
            Your {templateTitle} is ready! Download it now.
          </motion.p>
        </motion.div>

        {/* Document Preview Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden mb-8"
        >
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-8 py-6 border-b border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <FileText className="w-8 h-8 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-800">{templateTitle}</h2>
                <p className="text-slate-600 mt-1">Ready to download and use</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-full">
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">Verified</span>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <div className="text-sm text-slate-500">Format</div>
                <div className="text-lg font-semibold">PDF</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-slate-500">Status</div>
                <div className="text-lg font-semibold text-green-600">Ready</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                onClick={handleDownload}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-6 rounded-xl text-base shadow-lg shadow-indigo-500/30 hover:shadow-xl transition-all"
              >
                <Download className="w-5 h-5 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Additional Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="grid md:grid-cols-2 gap-6 mb-8"
        >
          <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200 text-center hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-2">Fill Another Form</h3>
            <p className="text-sm text-slate-600 mb-4">Need a different document?</p>
            <Button variant="outline" size="sm" className="w-full" onClick={onStartOver}>
              Start New
            </Button>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200 text-center hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Save to Dashboard</h3>
            <p className="text-sm text-slate-600 mb-4">Access anytime you need</p>
            <Button variant="outline" size="sm" className="w-full">
              Save
            </Button>
          </div>
        </motion.div>

        {/* What's Next Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white"
        >
          <h2 className="text-2xl font-bold mb-4">What's Next?</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>Download and print your form, or submit it electronically</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>Keep a copy for your records</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>Review with a tax professional if needed</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
