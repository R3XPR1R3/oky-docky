import { useState } from 'react';
import { motion } from 'motion/react';
import {
  FileText, ArrowLeft, ArrowRight, CheckCircle, Zap, Building2, Send,
  Loader2, Star, Code2, Users
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

interface PricingPageProps {
  onBack: () => void;
  onGetStarted: () => void;
}

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for personal use',
    icon: Star,
    color: 'from-slate-600 to-slate-700',
    borderColor: 'border-slate-200',
    features: [
      '2 forms per month',
      'W-9, W-4 templates',
      'Instant PDF download',
      'Step-by-step Q&A',
      'Data never stored',
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    description: 'For freelancers & small business',
    icon: Zap,
    color: 'from-indigo-600 to-purple-600',
    borderColor: 'border-indigo-400',
    features: [
      'Unlimited forms',
      'All IRS templates (W-9, W-4, 1099-NEC, ...)',
      'Batch Q&A — fill multiple forms at once',
      'CSV import for bulk filling',
      'Filing instructions & checklists',
      'Priority support',
    ],
    cta: 'Start Pro Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'API access & volume pricing',
    icon: Building2,
    color: 'from-slate-800 to-slate-900',
    borderColor: 'border-slate-300',
    features: [
      'REST API with key authentication',
      'Bulk form processing via API',
      'Custom template creation',
      'Dedicated account manager',
      'SLA & uptime guarantee',
      'Auto-filing integration (coming soon)',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export function PricingPage({ onBack, onGetStarted }: PricingPageProps) {
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Please fill in name and email');
      return;
    }
    setSending(true);
    // Simulate sending (no backend endpoint for this yet)
    setTimeout(() => {
      setSending(false);
      toast.success('Thank you! We\'ll be in touch soon.');
      setFormData({ name: '', email: '', company: '', message: '' });
    }, 1000);
  };

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

      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Hero */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold mb-4">
            Simple{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Pricing
            </span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Start free, upgrade when you need more. No surprises.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-24">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-white rounded-2xl shadow-lg border-2 ${tier.borderColor} overflow-hidden ${tier.popular ? 'md:-mt-4 md:mb-4 shadow-xl' : ''}`}
            >
              {tier.popular && (
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center text-sm font-medium py-2">
                  Most Popular
                </div>
              )}
              <div className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center`}>
                    <tier.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">{tier.name}</h3>
                </div>

                <div className="mb-2">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  {tier.period && <span className="text-slate-500 ml-1">{tier.period}</span>}
                </div>
                <p className="text-slate-600 text-sm mb-6">{tier.description}</p>

                <Button
                  onClick={tier.name === 'Enterprise' ? () => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' }) : onGetStarted}
                  className={`w-full py-5 rounded-xl text-base ${tier.popular ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30' : ''}`}
                  variant={tier.popular ? 'default' : 'outline'}
                >
                  {tier.cta}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                <div className="mt-8 space-y-3">
                  {tier.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* API Highlight */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="bg-slate-900 rounded-2xl p-8 md:p-12 mb-24 text-white overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl" />
          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 mb-4">
                <Code2 className="w-3 h-3 mr-1" /> Enterprise API
              </Badge>
              <h2 className="text-3xl font-bold mb-4">Fill forms at scale</h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                Integrate Oky-Docky into your workflow with our REST API. Send data, get back filled PDFs.
                Perfect for payroll companies, accounting firms, and tax prep software.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Users className="w-4 h-4" /> Bulk processing
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Zap className="w-4 h-4" /> Sub-second response
                </div>
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl p-6 font-mono text-sm">
              <div className="text-slate-500 mb-2"># Fill a W-9 via API</div>
              <div><span className="text-green-400">POST</span> <span className="text-slate-300">/api/render/w9-2026</span></div>
              <div className="text-slate-500 mt-2">Authorization: Bearer sk_live_...</div>
              <div className="text-slate-500 mt-1">Content-Type: application/json</div>
              <div className="mt-3 text-yellow-300">{'{'}</div>
              <div className="text-slate-300 pl-4">"data": {'{'}</div>
              <div className="text-slate-300 pl-8">"legal_name": "Jane Doe",</div>
              <div className="text-slate-300 pl-8">"tin_type": "ssn",</div>
              <div className="text-slate-300 pl-8">"ssn": "123-45-6789"</div>
              <div className="text-slate-300 pl-4">{'}'}</div>
              <div className="text-yellow-300">{'}'}</div>
              <div className="mt-3 text-green-400">→ 200 OK (application/pdf)</div>
            </div>
          </div>
        </motion.div>

        {/* Contact Form */}
        <motion.div
          id="contact-form"
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">Get in Touch</h2>
            <p className="text-slate-600">
              Interested in Pro, Enterprise, or have questions? Drop us a line.
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="jane@company.com"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Company</Label>
              <Input
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Your company (optional)"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">How can we help?</Label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Tell us about your needs — volume, forms you need, integrations..."
                rows={4}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm resize-none focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
            <Button
              type="submit"
              disabled={sending}
              className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-base shadow-lg shadow-indigo-500/30"
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Send Message</>
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
