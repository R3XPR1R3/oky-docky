import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, ArrowLeft, ChevronRight, Search, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { TemplateMeta } from '../App';

interface DocumentSelectionProps {
  apiUrl: string;
  onSelectDocument: (template: TemplateMeta) => void;
  onBack: () => void;
}

export function DocumentSelection({ apiUrl, onSelectDocument, onBack }: DocumentSelectionProps) {
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Derive unique categories from loaded templates
  const categories = Array.from(new Set(templates.map((t) => t.category)));

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (selectedCategory !== 'all') params.set('category', selectedCategory);

        const url = `${apiUrl}/api/templates${params.toString() ? '?' + params.toString() : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load templates');
        const data = await res.json();
        setTemplates(data.templates || []);
      } catch {
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchTemplates, 200);
    return () => clearTimeout(debounce);
  }, [apiUrl, searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-white/20 backdrop-blur-sm bg-white/40"
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
        {/* Title Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-4">Which form do you need?</h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Choose a document and we'll guide you through it step by step
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="max-w-xl mx-auto mb-8"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search forms by name, tag, or description..."
              className="pl-12 py-6 text-lg rounded-xl border-2 focus:border-indigo-500 transition-colors"
            />
          </div>
        </motion.div>

        {/* Category Filter — built dynamically */}
        {categories.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-center justify-center gap-4 mb-12 flex-wrap"
          >
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
              className={
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                  : ''
              }
            >
              All Forms
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat)}
                className={
                  selectedCategory === cat
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                    : ''
                }
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Button>
            ))}
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        )}

        {/* Empty State */}
        {!loading && templates.length === 0 && (
          <div className="text-center py-24">
            <p className="text-xl text-slate-500">No forms found</p>
            <p className="text-slate-400 mt-2">Try a different search term</p>
          </div>
        )}

        {/* Document Cards */}
        {!loading && templates.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {templates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                onHoverStart={() => setHoveredId(template.id)}
                onHoverEnd={() => setHoveredId(null)}
                onClick={() => onSelectDocument(template)}
                className="relative group cursor-pointer"
              >
                <div className="relative bg-white rounded-2xl p-8 shadow-lg border-2 border-slate-200 hover:border-indigo-400 transition-all duration-300 hover:shadow-xl">
                  {template.popular && (
                    <div className="absolute -top-3 -right-3">
                      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium shadow-lg">
                        Popular
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-indigo-600" />
                    </div>
                    <motion.div
                      animate={{ x: hoveredId === template.id ? 5 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    </motion.div>
                  </div>

                  <h3 className="text-2xl font-bold mb-2 group-hover:text-indigo-600 transition-colors">
                    {template.title}
                  </h3>
                  <p className="text-slate-600 mb-6 leading-relaxed">
                    {template.description}
                  </p>

                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    {template.estimated_time && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span>~{template.estimated_time}</span>
                      </div>
                    )}
                    {template.country && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>{template.country}</span>
                      </div>
                    )}
                    {template.category && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span>{template.category.charAt(0).toUpperCase() + template.category.slice(1)}</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {template.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <motion.div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
