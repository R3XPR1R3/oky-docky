import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  ChevronRight, Copy, Download, Upload, Eye, EyeOff, GripVertical,
  Settings2, X, Code2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import type { SchemaField, Schema } from '../App';
import { QuestionFlow } from './QuestionFlow';

interface FormBuilderProps {
  onBack: () => void;
}

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700',
  radio: 'bg-purple-100 text-purple-700',
  checkbox: 'bg-green-100 text-green-700',
};

function generateKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function createEmptyField(): SchemaField {
  return {
    key: '',
    type: 'text',
    required: false,
    label: '',
    placeholder: '',
    helpText: '',
  };
}

export function FormBuilder({ onBack }: FormBuilderProps) {
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [jsonImport, setJsonImport] = useState('');
  const [showImport, setShowImport] = useState(false);

  // --- Field CRUD ---

  const addField = useCallback(() => {
    const newField = createEmptyField();
    setFields((prev) => [...prev, newField]);
    setExpandedIndex(fields.length);
  }, [fields.length]);

  const removeField = useCallback((index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
    else if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
  }, [expandedIndex]);

  const moveField = useCallback((index: number, direction: 'up' | 'down') => {
    setFields((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    if (expandedIndex === index) {
      setExpandedIndex(direction === 'up' ? index - 1 : index + 1);
    }
  }, [expandedIndex]);

  const updateField = useCallback((index: number, updates: Partial<SchemaField>) => {
    setFields((prev) => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  }, []);

  // --- Options (for radio fields) ---

  const addOption = useCallback((fieldIndex: number) => {
    setFields((prev) => prev.map((f, i) => {
      if (i !== fieldIndex) return f;
      const options = [...(f.options || []), { value: '', label: '' }];
      return { ...f, options };
    }));
  }, []);

  const updateOption = useCallback((fieldIndex: number, optIndex: number, key: 'value' | 'label', val: string) => {
    setFields((prev) => prev.map((f, i) => {
      if (i !== fieldIndex) return f;
      const options = (f.options || []).map((o, oi) =>
        oi === optIndex ? { ...o, [key]: val } : o
      );
      return { ...f, options };
    }));
  }, []);

  const removeOption = useCallback((fieldIndex: number, optIndex: number) => {
    setFields((prev) => prev.map((f, i) => {
      if (i !== fieldIndex) return f;
      const options = (f.options || []).filter((_, oi) => oi !== optIndex);
      return { ...f, options };
    }));
  }, []);

  // --- Conditions (visible_when) ---

  const addCondition = useCallback((fieldIndex: number, depKey: string) => {
    setFields((prev) => prev.map((f, i) => {
      if (i !== fieldIndex) return f;
      const vw = { ...(f.visible_when || {}), [depKey]: [] };
      return { ...f, visible_when: vw };
    }));
  }, []);

  const removeCondition = useCallback((fieldIndex: number, depKey: string) => {
    setFields((prev) => prev.map((f, i) => {
      if (i !== fieldIndex) return f;
      const vw = { ...(f.visible_when || {}) };
      delete vw[depKey];
      return { ...f, visible_when: Object.keys(vw).length > 0 ? vw : undefined };
    }));
  }, []);

  const toggleConditionValue = useCallback((fieldIndex: number, depKey: string, val: string) => {
    setFields((prev) => prev.map((f, i) => {
      if (i !== fieldIndex) return f;
      const vw = { ...(f.visible_when || {}) };
      const current = vw[depKey] || [];
      if (current.includes(val)) {
        vw[depKey] = current.filter((v) => v !== val);
      } else {
        vw[depKey] = [...current, val];
      }
      return { ...f, visible_when: vw };
    }));
  }, []);

  // --- JSON Export / Import ---

  const schemaJson = JSON.stringify({ fields }, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(schemaJson);
    toast.success('JSON copied to clipboard');
  };

  const handleExportJson = () => {
    const blob = new Blob([schemaJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('schema.json downloaded');
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonImport);
      if (parsed.fields && Array.isArray(parsed.fields)) {
        setFields(parsed.fields);
        setShowImport(false);
        setJsonImport('');
        toast.success(`Imported ${parsed.fields.length} fields`);
      } else {
        toast.error('Invalid schema: missing "fields" array');
      }
    } catch {
      toast.error('Invalid JSON');
    }
  };

  // --- Preceding fields for conditions ---

  const getPrecedingFields = (index: number) => fields.slice(0, index).filter((f) => f.key);

  // Preview schema
  const previewSchema: Schema = { fields: fields.filter((f) => f.key && f.label) };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-white/20 backdrop-blur-sm bg-white/40 sticky top-0 z-30"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Form Builder
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                {fields.length} field{fields.length !== 1 ? 's' : ''}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="gap-2"
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showPreview ? 'Editor' : 'Preview'}
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Preview Mode */}
      {showPreview ? (
        previewSchema.fields.length > 0 ? (
          <QuestionFlow
            templateTitle="Preview"
            schema={previewSchema}
            initialData={{}}
            onComplete={(data) => {
              toast.success('Preview complete! Data: ' + JSON.stringify(data).slice(0, 100));
              setShowPreview(false);
            }}
            onBack={() => setShowPreview(false)}
          />
        ) : (
          <div className="container mx-auto px-4 py-24 text-center">
            <p className="text-xl text-slate-500">Add some fields first to preview the form</p>
            <Button className="mt-4" onClick={() => setShowPreview(false)}>Back to Editor</Button>
          </div>
        )
      ) : (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Toolbar */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex flex-wrap items-center gap-3 mb-8"
          >
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-2">
              <Upload className="w-4 h-4" /> Import JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJson} className="gap-2" disabled={fields.length === 0}>
              <Download className="w-4 h-4" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyJson} className="gap-2" disabled={fields.length === 0}>
              <Copy className="w-4 h-4" /> Copy JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowJson(!showJson)}
              className="gap-2 ml-auto"
              disabled={fields.length === 0}
            >
              <Code2 className="w-4 h-4" /> {showJson ? 'Hide' : 'Show'} JSON
            </Button>
          </motion.div>

          {/* Import Modal */}
          <AnimatePresence>
            {showImport && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                onClick={() => setShowImport(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Import Schema JSON</h3>
                    <Button variant="ghost" size="icon" onClick={() => setShowImport(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <textarea
                    value={jsonImport}
                    onChange={(e) => setJsonImport(e.target.value)}
                    placeholder='Paste your schema.json here...'
                    className="w-full h-64 p-4 border-2 border-slate-200 rounded-xl font-mono text-sm resize-none focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
                    <Button onClick={handleImportJson} disabled={!jsonImport.trim()}>Import</Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* JSON Preview */}
          <AnimatePresence>
            {showJson && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-8"
              >
                <pre className="bg-slate-900 text-green-400 p-6 rounded-xl text-sm overflow-auto max-h-96 font-mono">
                  {schemaJson}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty State */}
          {fields.length === 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Start building your form</h2>
              <p className="text-slate-600 mb-6">Add fields to create a step-by-step Q&A flow</p>
              <div className="flex justify-center gap-3">
                <Button onClick={addField} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white gap-2">
                  <Plus className="w-4 h-4" /> Add First Field
                </Button>
                <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
                  <Upload className="w-4 h-4" /> Import JSON
                </Button>
              </div>
            </motion.div>
          )}

          {/* Field List */}
          <div className="space-y-4">
            {fields.map((field, index) => {
              const isExpanded = expandedIndex === index;
              const preceding = getPrecedingFields(index);
              const condCount = field.visible_when ? Object.keys(field.visible_when).length : 0;

              return (
                <motion.div
                  key={index}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Collapsed Header */}
                  <div
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  >
                    <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm font-mono text-slate-400 w-6">{index + 1}</span>
                    <Badge className={`${FIELD_TYPE_COLORS[field.type]} text-xs`}>
                      {field.type}
                    </Badge>
                    <span className="font-medium text-slate-800 truncate flex-1">
                      {field.label || <span className="text-slate-400 italic">untitled</span>}
                    </span>
                    {field.key && (
                      <span className="text-xs font-mono text-slate-400 hidden sm:block">{field.key}</span>
                    )}
                    {field.required && (
                      <Badge variant="destructive" className="text-xs">req</Badge>
                    )}
                    {condCount > 0 && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Eye className="w-3 h-3" /> {condCount}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); moveField(index, 'up'); }}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); moveField(index, 'down'); }}
                        disabled={index === fields.length - 1}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); removeField(index); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded Editor */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <Separator />
                        <div className="p-5 space-y-5 bg-slate-50/50">
                          {/* Row 1: Type + Key */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-500">Type</Label>
                              <Select
                                value={field.type}
                                onValueChange={(v) => {
                                  const updates: Partial<SchemaField> = { type: v as SchemaField['type'] };
                                  if (v === 'radio' && !field.options?.length) {
                                    updates.options = [{ value: '', label: '' }];
                                  }
                                  if (v !== 'radio') {
                                    updates.options = undefined;
                                  }
                                  updateField(index, updates);
                                }}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Text Input</SelectItem>
                                  <SelectItem value="radio">Radio / Choice</SelectItem>
                                  <SelectItem value="checkbox">Checkbox</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-500">Key (ID)</Label>
                              <Input
                                value={field.key}
                                onChange={(e) => updateField(index, { key: e.target.value })}
                                placeholder="auto_generated"
                                className="font-mono text-sm"
                              />
                            </div>
                          </div>

                          {/* Row 2: Label */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">Label (question text)</Label>
                            <Input
                              value={field.label}
                              onChange={(e) => {
                                const updates: Partial<SchemaField> = { label: e.target.value };
                                if (!field.key || field.key === generateKey(field.label)) {
                                  updates.key = generateKey(e.target.value);
                                }
                                updateField(index, updates);
                              }}
                              placeholder="e.g., What is your full name?"
                            />
                          </div>

                          {/* Row 3: Placeholder + Required */}
                          <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-500">Placeholder</Label>
                              <Input
                                value={field.placeholder || ''}
                                onChange={(e) => updateField(index, { placeholder: e.target.value || undefined })}
                                placeholder="e.g., John Smith"
                              />
                            </div>
                            <div className="flex items-center gap-2 pb-1">
                              <Switch
                                checked={!!field.required}
                                onCheckedChange={(v) => updateField(index, { required: v })}
                              />
                              <Label className="text-sm">Required</Label>
                            </div>
                          </div>

                          {/* Row 4: Help Text */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">Help text</Label>
                            <Input
                              value={field.helpText || ''}
                              onChange={(e) => updateField(index, { helpText: e.target.value || undefined })}
                              placeholder="Additional instructions shown below the question"
                            />
                          </div>

                          {/* Options Editor (radio only) */}
                          {field.type === 'radio' && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-slate-500">Options</Label>
                                <Button variant="outline" size="sm" onClick={() => addOption(index)} className="h-7 text-xs gap-1">
                                  <Plus className="w-3 h-3" /> Option
                                </Button>
                              </div>
                              {(field.options || []).map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                  <Input
                                    value={opt.value}
                                    onChange={(e) => updateOption(index, oi, 'value', e.target.value)}
                                    placeholder="value"
                                    className="font-mono text-sm flex-1"
                                  />
                                  <Input
                                    value={opt.label}
                                    onChange={(e) => {
                                      updateOption(index, oi, 'label', e.target.value);
                                      if (!opt.value || opt.value === generateKey(opt.label)) {
                                        updateOption(index, oi, 'value', generateKey(e.target.value));
                                      }
                                    }}
                                    placeholder="Display label"
                                    className="flex-1"
                                  />
                                  <Button
                                    variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 flex-shrink-0"
                                    onClick={() => removeOption(index, oi)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Conditions Editor (visible_when) */}
                          <div className="space-y-3">
                            <Separator />
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium text-slate-500">
                                Visibility Conditions
                              </Label>
                              {preceding.length > 0 && (
                                <Select
                                  value=""
                                  onValueChange={(depKey) => addCondition(index, depKey)}
                                >
                                  <SelectTrigger className="w-auto h-7 text-xs gap-1">
                                    <Plus className="w-3 h-3" />
                                    <SelectValue placeholder="Add condition" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {preceding
                                      .filter((pf) => !(field.visible_when && pf.key in field.visible_when))
                                      .map((pf) => (
                                        <SelectItem key={pf.key} value={pf.key}>
                                          {pf.label || pf.key}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>

                            {!field.visible_when && (
                              <p className="text-xs text-slate-400">Always visible (no conditions)</p>
                            )}

                            {field.visible_when && Object.entries(field.visible_when).map(([depKey, values]) => {
                              const depField = fields.find((f) => f.key === depKey);
                              if (!depField) return null;

                              return (
                                <div key={depKey} className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">
                                      Show when <span className="font-mono text-indigo-600">{depField.label || depKey}</span> =
                                    </span>
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6 text-red-500"
                                      onClick={() => removeCondition(index, depKey)}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>

                                  {depField.type === 'radio' && depField.options ? (
                                    <div className="flex flex-wrap gap-2">
                                      {depField.options.map((opt) => (
                                        <label
                                          key={opt.value}
                                          className={`
                                            flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors
                                            ${values.includes(opt.value) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-indigo-300'}
                                          `}
                                        >
                                          <Checkbox
                                            checked={values.includes(opt.value)}
                                            onCheckedChange={() => toggleConditionValue(index, depKey, opt.value)}
                                            className="w-3.5 h-3.5"
                                          />
                                          {opt.label || opt.value}
                                        </label>
                                      ))}
                                    </div>
                                  ) : (
                                    <Input
                                      value={values.join(', ')}
                                      onChange={(e) => {
                                        const vals = e.target.value.split(',').map((v) => v.trim()).filter(Boolean);
                                        setFields((prev) => prev.map((f, i) => {
                                          if (i !== index) return f;
                                          return { ...f, visible_when: { ...f.visible_when, [depKey]: vals } };
                                        }));
                                      }}
                                      placeholder="Comma-separated values"
                                      className="text-sm"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* Add Field Button */}
          {fields.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6"
            >
              <Button
                onClick={addField}
                variant="outline"
                className="w-full py-6 border-dashed border-2 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 gap-2"
              >
                <Plus className="w-5 h-5" /> Add Field
              </Button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
