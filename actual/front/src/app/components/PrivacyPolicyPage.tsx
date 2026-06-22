import { motion } from 'motion/react';
import { ArrowLeft, BarChart3, Database, FileText, Lock, Shield } from 'lucide-react';
import { Button } from './ui/button';

interface PrivacyPolicyPageProps {
  onBack: () => void;
}

const sections = [
  {
    icon: FileText,
    title: 'Information used to prepare documents',
    paragraphs: [
      'The answers you enter, including signatures and identifiers required by a selected form, remain in your browser while you complete the questionnaire. When you request a PDF, those answers are sent securely to our server solely to generate the document.',
      'A temporary PDF file is created for delivery to your browser and deleted from our server after the response is sent. Oky-Docky does not add form answers, signatures, tax identifiers, or completed PDF contents to its analytics database.',
      'You are responsible for protecting downloaded files on your device and for reviewing them before signing, filing, or sharing them.',
    ],
  },
  {
    icon: BarChart3,
    title: 'Usage and attribution analytics',
    paragraphs: [
      'We use a random session identifier stored in sessionStorage to understand aggregate usage. We may record page paths, referring domains, campaign parameters, catalog searches, designated button clicks, form starts, completions, and downloads.',
      'Search text is automatically redacted for email-like values and long numbers before storage. Do not enter sensitive personal information into the catalog search box.',
      'Our analytics database does not store IP addresses. Cloudflare, hosting infrastructure, and ordinary server access logs may still process network and device information for delivery, reliability, and security.',
    ],
  },
  {
    icon: Database,
    title: 'Service providers and advertising',
    paragraphs: [
      'We use service providers such as Cloudflare for traffic delivery and security. When advertising is displayed, Google AdSense and its partners may process cookies, device identifiers, and interaction data under their own privacy terms and applicable consent requirements.',
      'Optional partner links are clearly identified. Opening an external provider sends you to that provider, whose privacy policy governs its collection and use of information.',
      'We do not sell the contents of your form answers or completed documents.',
    ],
  },
  {
    icon: Lock,
    title: 'Retention, security, and your choices',
    paragraphs: [
      'Temporary document-generation files are deleted after delivery. Aggregate analytics events may be retained to measure performance, diagnose problems, and understand traffic sources.',
      'You can clear the Oky-Docky session identifier and attribution data by closing the browser session or clearing site data. Browser and advertising controls may provide additional cookie choices.',
      'No internet service can guarantee absolute security. Avoid using public or shared devices for sensitive documents and delete downloaded files when they are no longer needed.',
    ],
  },
  {
    icon: Shield,
    title: 'Contact and policy changes',
    paragraphs: [
      'For privacy questions or requests, contact legal@barckhat.com. We may need enough information to understand and verify a request, but you should not email tax identifiers, signatures, or completed documents.',
      'We may update this policy when the service or its providers change. The date below identifies the current published version.',
    ],
  },
];

export function PrivacyPolicyPage({ onBack }: PrivacyPolicyPageProps) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/20 bg-white/70 backdrop-blur-sm">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600"><Shield className="h-5 w-5 text-white" /></div>
          <span className="text-lg font-semibold text-slate-900">Oky-Docky Privacy Policy</span>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-14">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Barckhat LLC</p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950">Privacy Policy</h1>
          <p className="mt-3 text-sm text-slate-500">Last updated: June 22, 2026</p>
          <p className="mt-6 text-lg leading-8 text-slate-600">This policy explains how Oky-Docky handles information when you browse the site, complete a guided questionnaire, and generate a document.</p>
        </motion.div>

        <div className="mt-12 space-y-8">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <motion.section key={section.title} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-3"><Icon className="h-6 w-6 text-indigo-600" /><h2 className="text-xl font-bold text-slate-900">{section.title}</h2></div>
                <div className="mt-4 space-y-3">{section.paragraphs.map((paragraph) => <p key={paragraph} className="leading-7 text-slate-600">{paragraph}</p>)}</div>
              </motion.section>
            );
          })}
        </div>

        <p className="mt-12 border-t border-slate-200 pt-8 text-center text-sm text-slate-500">© 2026 Barckhat LLC. Oky-Docky is a product of Barckhat LLC.</p>
      </main>
    </div>
  );
}
