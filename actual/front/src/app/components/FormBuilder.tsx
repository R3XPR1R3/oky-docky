import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  ChevronRight, Copy, Download, Upload, Eye, EyeOff, GripVertical,
  Settings2, X, Code2, EyeOff as EyeOffIcon, Hash, AlertTriangle,
  FilePlus2, GitBranch, FileImage, Search, Globe2
} from 'lucide-react';
import PdfFieldPreview from './PdfFieldPreview';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
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
import type { ConditionExpected, ConditionSet, SchemaField, Schema, SchemaTransform, FieldStyle, TemplateMeta } from '../App';
import { QuestionFlow } from './QuestionFlow';
import { formulaDependencies, renameFormulaIdentifier } from '../lib/formula';

interface FormBuilderProps {
  onBack: () => void;
}

const TRANSFORM_TYPE_COLORS: Record<string, string> = {
  derive: 'bg-orange-100 text-orange-700',
  compute: 'bg-cyan-100 text-cyan-700',
  formula: 'bg-purple-100 text-purple-700',
  copy: 'bg-emerald-100 text-emerald-700',
  concat: 'bg-violet-100 text-violet-700',
  auto_date: 'bg-rose-100 text-rose-700',
  set_value: 'bg-blue-100 text-blue-700',
};

function createEmptyTransform(): SchemaTransform {
  return { type: 'formula', outputs: { result: '' } };
}

function transformSummary(t: SchemaTransform): string {
  switch (t.type) {
    case 'derive': {
      const keys = Object.keys(t.when || {});
      const setKeys = Object.keys(t.set || {});
      return `when ${keys.join(', ')} → set ${setKeys.join(', ')}`;
    }
    case 'compute':
      return `${t.operation || 'multiply'}(${t.input || t.inputs?.join(', ') || '?'}) → ${t.output || '?'}`;
    case 'formula':
      return Object.entries(t.outputs || {}).map(([name, expression]) => `${name} = ${expression || '?'}`).join('; ') || 'no variables';
    case 'copy':
      return `copy ${t.from || '?'} → ${t.to || '?'}${t.if_empty ? ' (if empty)' : ''}`;
    case 'concat':
      return `join ${t.inputs?.join(', ') || '?'} → ${t.output || '?'}`;
    case 'auto_date':
      return `auto_date → ${t.field || '?'} (${t.format || 'MM/DD/YYYY'})`;
    case 'set_value':
      return `set ${t.field || '?'} = ${JSON.stringify(t.value)}`;
    default:
      return JSON.stringify(t);
  }
}

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700',
  date: 'bg-violet-100 text-violet-700',
  radio: 'bg-blue-100 text-blue-700',
  checkbox: 'bg-green-100 text-green-700',
  signature: 'bg-amber-100 text-amber-700',
  text_input: 'bg-sky-100 text-sky-700',
  checkbox_input: 'bg-teal-100 text-teal-700',
  signature_area: 'bg-pink-100 text-pink-700',
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

function acceptedConditionValues(expected: ConditionExpected): string[] | null {
  if (Array.isArray(expected)) return expected.map(String);
  if (expected && typeof expected === 'object') {
    if (expected.in) return expected.in.map(String);
    if ('equals' in expected) return [String(expected.equals)];
    return null;
  }
  return [String(expected)];
}

function validateBuilderSchema(fields: SchemaField[], transforms: SchemaTransform[]): string[] {
  const issues: string[] = [];
  const keyIndexes = new Map<string, number>();

  fields.forEach((field, index) => {
    const name = field.label || field.key || `Field ${index + 1}`;
    if (!field.key.trim()) issues.push(`${name}: key is required`);
    else if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(field.key)) issues.push(`${name}: key must start with a letter and contain only letters, numbers, and underscores`);
    else if (keyIndexes.has(field.key)) issues.push(`${name}: duplicate key "${field.key}"`);
    else keyIndexes.set(field.key, index);
    if (!field.hidden && !field.label.trim()) issues.push(`Field ${index + 1}: question label is required`);

    if (field.type === 'radio') {
      const options = field.options || [];
      if (options.length < 2) issues.push(`${name}: a choice field needs at least two options`);
      if (options.some((option) => !option.value.trim() || !option.label.trim())) issues.push(`${name}: every option needs a value and label`);
      const values = options.map((option) => option.value).filter(Boolean);
      if (new Set(values).size !== values.length) issues.push(`${name}: option values must be unique`);
    }
  });

  fields.forEach((field, index) => {
    const conditionGroups = [
      field.visible_when,
      ...(field.visible_when_any || []),
      field.read_only_when,
      ...(field.read_only_when_any || []),
    ].filter(Boolean) as ConditionSet[];
    for (const conditions of conditionGroups) {
      for (const [dependency, expected] of Object.entries(conditions)) {
        const dependencyIndex = keyIndexes.get(dependency);
        if (dependencyIndex === undefined) issues.push(`${field.label || field.key}: condition references missing field "${dependency}"`);
        else if (dependencyIndex >= index) issues.push(`${field.label || field.key}: conditions may only reference an earlier question`);
        const allowedValues = acceptedConditionValues(expected);
        if (allowedValues?.length === 0) issues.push(`${field.label || field.key}: condition for "${dependency}" has no accepted values`);
        const source = dependencyIndex === undefined ? undefined : fields[dependencyIndex];
        if (allowedValues && source?.options?.length) {
          const validValues = new Set(source.options.map((option) => option.value));
          const unknown = allowedValues.filter((value) => !validValues.has(value));
          if (unknown.length) issues.push(`${field.label || field.key}: unknown values for "${dependency}": ${unknown.join(', ')}`);
        }
      }
    }
  });

  const knownKeys = new Set(fields.map((field) => field.key).filter(Boolean));
  transforms.forEach((transform, index) => {
    const label = `Transform ${index + 1}`;
    for (const key of [...Object.keys(transform.when || {}), ...Object.keys(transform.unless || {})]) {
      if (!knownKeys.has(key)) issues.push(`${label}: condition references missing field "${key}"`);
    }
    const sourceKeys = [transform.input, transform.from, ...(transform.inputs || [])].filter(Boolean) as string[];
    sourceKeys.forEach((key) => {
      if (!knownKeys.has(key)) issues.push(`${label}: source field "${key}" does not exist`);
    });
    if (transform.type === 'formula') {
      const outputs = Object.entries(transform.outputs || {});
      if (!outputs.length) issues.push(`${label}: add at least one variable`);
      outputs.forEach(([name, expression]) => {
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) issues.push(`${label}: variable "${name || '?'}" needs a valid key`);
        try {
          formulaDependencies(expression).forEach((dependency) => {
            if (!knownKeys.has(dependency)) issues.push(`${label}: formula for "${name}" references unknown or later variable "${dependency}"`);
          });
        } catch (error) {
          issues.push(`${label}: formula for "${name}" is invalid (${error instanceof Error ? error.message : 'syntax error'})`);
        }
        if (name) knownKeys.add(name);
      });
    }
    if (transform.type === 'compute' && !transform.output) issues.push(`${label}: output field is required`);
    if (transform.type === 'copy' && (!transform.from || !transform.to)) issues.push(`${label}: source and target fields are required`);
    if (transform.type === 'concat' && (!(transform.inputs || []).length || !transform.output)) issues.push(`${label}: input and output fields are required`);
    if ((transform.type === 'auto_date' || transform.type === 'set_value') && !transform.field) issues.push(`${label}: target field is required`);

    if (transform.output) knownKeys.add(transform.output);
    if (transform.to) knownKeys.add(transform.to);
    if (transform.field) knownKeys.add(transform.field);
    Object.keys(transform.set || {}).forEach((key) => knownKeys.add(key));
  });

  return [...new Set(issues)];
}

export function FormBuilder({ onBack }: FormBuilderProps) {
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [jsonImport, setJsonImport] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [transforms, setTransforms] = useState<SchemaTransform[]>([]);
  const [expandedTransform, setExpandedTransform] = useState<number | null>(null);
  const [showTransforms, setShowTransforms] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templateMeta, setTemplateMeta] = useState<TemplateMeta | null>(null);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    id: '', title: '', description: '', category: 'tax', tags: '',
    country: 'US', estimated_time: '5 min',
  });
  const [newPdfFile, setNewPdfFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [mapping, setMapping] = useState<Record<string, any>>({});
  const validationIssues = useMemo(() => validateBuilderSchema(fields, transforms), [fields, transforms]);
  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) => [
      template.id, template.title, template.description, template.category,
      ...(template.tags || []), ...(template.seo_keywords || []),
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [templates, templateSearch]);

  // --- Load templates list ---
  const loadTemplateList = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadTemplateSchema = useCallback(async (templateId: string) => {
    try {
      const res = await fetch(`/api/admin/templates/${templateId}/bundle`);
      if (res.ok) {
        const data = await res.json();
        const schema = data.schema;
        if (schema?.fields) {
          setFields(schema.fields);
          setTransforms(schema.transforms || []);
          setMapping(data.mapping || {});
          setTemplateMeta(data.template || null);
          setSelectedTemplate(templateId);
          setShowLoadTemplate(false);
          setShowPdfPreview(true);
          toast.success(`Loaded ${schema.fields.length} fields from ${templateId}`);
        }
      }
    } catch { toast.error('Failed to load template'); }
  }, []);

  const openTemplateInBuilder = useCallback(async (templateId: string) => {
    await loadTemplateSchema(templateId);
    setShowPdfPreview(true);
  }, [loadTemplateSchema]);

  const saveToTemplate = useCallback(async () => {
    if (!selectedTemplate) {
      toast.error('Load a template first before saving');
      return;
    }
    if (validationIssues.length) {
      toast.error(`Fix ${validationIssues.length} form issue${validationIssues.length === 1 ? '' : 's'} before saving`);
      return;
    }
    try {
      const res = await fetch(`/api/admin/templates/${selectedTemplate}/bundle`);
      if (!res.ok) throw new Error('Failed to fetch current bundle');
      const bundle = await res.json();

      const updatedSchema = { ...bundle.schema, fields, transforms: transforms.length > 0 ? transforms : undefined };
      const updatedMapping = Object.keys(mapping).length > 0 ? mapping : bundle.mapping;
      const saveRes = await fetch(`/api/admin/templates/${selectedTemplate}/bundle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: templateMeta || bundle.template, schema: updatedSchema, mapping: updatedMapping }),
      });
      if (saveRes.ok) {
        toast.success(`Saved to ${selectedTemplate}`);
      } else {
        const error = await saveRes.json().catch(() => null);
        const detail = error?.detail;
        const message = typeof detail === 'string' ? detail : detail?.message;
        toast.error(message || 'Failed to save');
      }
    } catch { toast.error('Failed to save template'); }
  }, [selectedTemplate, fields, transforms, mapping, validationIssues, templateMeta]);

  const createTemplate = useCallback(async () => {
    if (!newTemplate.id.trim() || !newTemplate.title.trim()) {
      toast.error('Template ID and title are required');
      return;
    }
    setCreating(true);
    try {
      let pdf_base64 = '';
      let pdf_filename = '';
      if (newPdfFile) {
        pdf_base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || '');
          };
          reader.onerror = reject;
          reader.readAsDataURL(newPdfFile);
        });
        pdf_filename = newPdfFile.name;
      }
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTemplate,
          tags: newTemplate.tags ? newTemplate.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          pdf_base64,
          pdf_filename,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Template "${newTemplate.title}" created!`);
        setShowCreateTemplate(false);
        setNewTemplate({ id: '', title: '', description: '', category: 'tax', tags: '', country: 'US', estimated_time: '5 min' });
        setNewPdfFile(null);
        // Auto-load the new template for editing and open PDF preview.
        setFields([]);
        setTransforms([]);
        setSelectedTemplate(data.template_id);
        setMapping({});
        await openTemplateInBuilder(data.template_id);
        if (data.pdf_fields?.length > 0) {
          toast.info(`Detected ${data.pdf_fields.length} PDF fields`);
        } else {
          toast.info('No AcroForm fields found — use "+ Place Field" to add overlay fields.');
        }
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(err.detail || 'Failed to create template');
      }
    } catch { toast.error('Failed to create template'); }
    finally { setCreating(false); }
  }, [newTemplate, newPdfFile, openTemplateInBuilder]);

  const syncToRepo = useCallback(async () => {
    try {
      toast.info('Syncing templates to repo...');
      const res = await fetch('/api/admin/templates/sync-to-repo', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'nothing_to_sync') {
          toast.info('No changes to sync');
        } else if (data.status === 'committed_not_pushed') {
          toast.warning(`Committed but push failed: ${data.message}`);
        } else {
          toast.success(`Synced ${data.files?.length || 0} files to ${data.branch || 'repo'}`);
        }
      } else {
        toast.error(data.detail || 'Sync failed');
      }
    } catch { toast.error('Failed to sync to repo'); }
  }, []);

  // --- Field CRUD ---

  const addField = useCallback(() => {
    const newField = createEmptyField();
    setFields((prev) => [...prev, newField]);
    setExpandedIndex(fields.length);
  }, [fields.length]);

  const removeField = useCallback((index: number) => {
    const removedKey = fields[index]?.key;
    setFields((prev) => prev.filter((_, i) => i !== index).map((field) => {
      if (!removedKey || !field.visible_when?.[removedKey]) return field;
      const visibleWhen = { ...field.visible_when };
      delete visibleWhen[removedKey];
      return { ...field, visible_when: Object.keys(visibleWhen).length ? visibleWhen : undefined };
    }));
    if (removedKey) {
      setMapping((prev) => {
        const next = { ...prev };
        delete next[removedKey];
        return next;
      });
    }
    if (expandedIndex === index) setExpandedIndex(null);
    else if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
  }, [expandedIndex, fields]);

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

  const renameFieldKey = useCallback((index: number, nextKey: string) => {
    const previousKey = fields[index]?.key;
    if (!previousKey || previousKey === nextKey) {
      updateField(index, { key: nextKey });
      return;
    }

    const renameRecordKey = <T,>(record: Record<string, T> | undefined) => {
      if (!record || !(previousKey in record)) return record;
      const next = { ...record };
      next[nextKey] = next[previousKey];
      delete next[previousKey];
      return next;
    };

    setFields((prev) => prev.map((field, fieldIndex) => ({
      ...field,
      key: fieldIndex === index ? nextKey : field.key,
      visible_when: renameRecordKey(field.visible_when),
      visible_when_any: field.visible_when_any?.map((conditions) => renameRecordKey(conditions) || {}),
      read_only_when: renameRecordKey(field.read_only_when),
      read_only_when_any: field.read_only_when_any?.map((conditions) => renameRecordKey(conditions) || {}),
    })));
    setMapping((prev) => {
      if (!(previousKey in prev)) return prev;
      const next = { ...prev, [nextKey]: prev[previousKey] };
      delete next[previousKey];
      return next;
    });
    setTransforms((prev) => prev.map((transform) => ({
      ...transform,
      input: transform.input === previousKey ? nextKey : transform.input,
      inputs: transform.inputs?.map((key) => key === previousKey ? nextKey : key),
      from: transform.from === previousKey ? nextKey : transform.from,
      to: transform.to === previousKey ? nextKey : transform.to,
      field: transform.field === previousKey ? nextKey : transform.field,
      output: transform.output === previousKey ? nextKey : transform.output,
      outputs: transform.outputs && Object.fromEntries(Object.entries(transform.outputs).map(([name, expression]) => [
        name === previousKey ? nextKey : name,
        renameFormulaIdentifier(expression, previousKey, nextKey),
      ])),
      when: renameRecordKey(transform.when),
      unless: renameRecordKey(transform.unless),
      set: renameRecordKey(transform.set),
    })));
  }, [fields, updateField]);

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
      const current = acceptedConditionValues(vw[depKey] ?? []) || [];
      if (current.includes(val)) {
        vw[depKey] = current.filter((v) => v !== val);
      } else {
        vw[depKey] = [...current, val];
      }
      return { ...f, visible_when: vw };
    }));
  }, []);

  // --- JSON Export / Import ---

  const schemaJson = JSON.stringify(
    transforms.length > 0 ? { fields, transforms } : { fields },
    null, 2
  );

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
        setTransforms(parsed.transforms || []);
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

  // --- Field usage tracker ---
  const fieldUsage = useMemo(() => {
    const usage: Record<string, { conditions: string[]; transforms: string[]; isHidden: boolean }> = {};

    for (const f of fields) {
      if (!f.key) continue;
      if (!usage[f.key]) usage[f.key] = { conditions: [], transforms: [], isHidden: !!f.hidden };

      // Check where this field is used in other fields' visible_when
      for (const other of fields) {
        if (other === f || !other.key) continue;
        if (other.visible_when && f.key in other.visible_when) {
          usage[f.key].conditions.push(other.key);
        }
        if (other.visible_when_any) {
          for (const cond of other.visible_when_any) {
            if (f.key in cond) {
              usage[f.key].conditions.push(other.key);
            }
          }
        }
      }

      // Check where this field is used in transforms
      for (let ti = 0; ti < transforms.length; ti++) {
        const tr = transforms[ti];
        const label = `transform #${ti + 1}`;
        if (tr.when && f.key in tr.when) usage[f.key].transforms.push(label);
        if (tr.input === f.key) usage[f.key].transforms.push(label);
        if (tr.inputs?.includes(f.key)) usage[f.key].transforms.push(label);
        if (tr.from === f.key) usage[f.key].transforms.push(label);
        if (tr.output === f.key) usage[f.key].transforms.push(label + ' (output)');
        if (tr.to === f.key) usage[f.key].transforms.push(label + ' (target)');
        if (tr.field === f.key) usage[f.key].transforms.push(label + ' (target)');
        if (tr.set && f.key in tr.set) usage[f.key].transforms.push(label + ' (set)');
      }
    }

    return usage;
  }, [fields, transforms]);

  // Check for duplicate keys
  const duplicateKeys = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of fields) {
      if (f.key) counts[f.key] = (counts[f.key] || 0) + 1;
    }
    return new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([k]) => k));
  }, [fields]);

  const [showUsagePanel, setShowUsagePanel] = useState(false);

  // Keep hidden defaults available; QuestionFlow excludes hidden fields from the UI.
  const previewSchema: Schema = {
    fields: fields.filter((f) => f.key && (f.label || f.hidden)),
    ...(transforms.length > 0 ? { transforms } : {}),
  };

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
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  Form Builder
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                {fields.length} field{fields.length !== 1 ? 's' : ''}
              </Badge>
              {fields.some((f) => f.hidden) && (
                <Badge variant="outline" className="text-sm gap-1">
                  <EyeOffIcon className="w-3 h-3" />
                  {fields.filter((f) => f.hidden).length} hidden
                </Badge>
              )}
              {duplicateKeys.size > 0 && (
                <Badge variant="destructive" className="text-sm gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {duplicateKeys.size} duplicate key{duplicateKeys.size !== 1 ? 's' : ''}
                </Badge>
              )}
              {validationIssues.length > 0 && (
                <Badge variant="destructive" className="text-sm gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {validationIssues.length} issue{validationIssues.length !== 1 ? 's' : ''}
                </Badge>
              )}
              <Button
                variant={showUsagePanel ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowUsagePanel(!showUsagePanel)}
                className="gap-2"
              >
                <Hash className="w-4 h-4" />
                Usage
              </Button>
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
            templateId={selectedTemplate}
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
            <Button variant="outline" size="sm" onClick={() => { setTemplateSearch(''); loadTemplateList(); setShowLoadTemplate(true); }} className="gap-2">
              <FileText className="w-4 h-4" /> Load Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCreateTemplate(true)} className="gap-2">
              <FilePlus2 className="w-4 h-4" /> New Template
            </Button>
            <Button variant="outline" size="sm" onClick={saveToTemplate} className="gap-2" disabled={!selectedTemplate || fields.length === 0 || validationIssues.length > 0}>
              <Download className="w-4 h-4" /> Save{selectedTemplate ? ` → ${selectedTemplate}` : ''}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-2">
              <Upload className="w-4 h-4" /> Import JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyJson} className="gap-2" disabled={fields.length === 0}>
              <Copy className="w-4 h-4" /> Copy JSON
            </Button>
            <Button variant="outline" size="sm" onClick={syncToRepo} className="gap-2 text-emerald-700 hover:text-emerald-800 hover:border-emerald-400">
              <GitBranch className="w-4 h-4" /> Sync to Repo
            </Button>
            <Button
              variant={showPdfPreview ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPdfPreview(!showPdfPreview)}
              className="gap-2"
              disabled={!selectedTemplate}
            >
              <FileImage className="w-4 h-4" /> {showPdfPreview ? 'Hide' : 'Show'} PDF
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

          {validationIssues.length > 0 && (
            <div className="mb-6 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" /> Fix before saving
              </div>
              <ul className="space-y-1 text-sm text-amber-800">
                {validationIssues.slice(0, 8).map((issue) => <li key={issue}>- {issue}</li>)}
                {validationIssues.length > 8 && <li>- and {validationIssues.length - 8} more</li>}
              </ul>
            </div>
          )}

          {templateMeta && selectedTemplate && (
            <details className="mb-6 rounded-2xl border-2 border-indigo-100 bg-white shadow-sm" open>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold text-slate-800">
                <Globe2 className="h-5 w-5 text-indigo-600" /> Search & SEO
                <Badge className={templateMeta.published === false ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}>
                  {templateMeta.published === false ? 'Draft / noindex' : 'Published'}
                </Badge>
              </summary>
              <Separator />
              <div className="space-y-5 p-5">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div>
                    <Label className="font-medium">Publish and allow indexing</Label>
                    <p className="text-xs text-slate-500">Draft templates are excluded from public pages and sitemap.xml.</p>
                  </div>
                  <Switch
                    checked={templateMeta.published !== false}
                    onCheckedChange={(published) => setTemplateMeta((current) => current ? { ...current, published } : current)}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between"><Label>Search result title</Label><span className="text-xs text-slate-400">{templateMeta.seo_title?.length || 0}/60</span></div>
                  <Input
                    value={templateMeta.seo_title || ''}
                    onChange={(event) => setTemplateMeta({ ...templateMeta, seo_title: event.target.value })}
                    placeholder={`${templateMeta.title} - Free Online Form | Oky-Docky`}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between"><Label>Meta description</Label><span className="text-xs text-slate-400">{templateMeta.seo_description?.length || 0}/160</span></div>
                  <Textarea
                    value={templateMeta.seo_description || ''}
                    onChange={(event) => setTemplateMeta({ ...templateMeta, seo_description: event.target.value })}
                    placeholder="Explain exactly what the visitor can complete and download."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Page heading</Label>
                  <Input
                    value={templateMeta.seo_heading || ''}
                    onChange={(event) => setTemplateMeta({ ...templateMeta, seo_heading: event.target.value })}
                    placeholder={`Fill out ${templateMeta.title} online`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Indexable page introduction</Label>
                  <Textarea
                    value={templateMeta.seo_intro || ''}
                    onChange={(event) => setTemplateMeta({ ...templateMeta, seo_intro: event.target.value })}
                    placeholder="Write a useful, original explanation: who needs the form, what information is required, and what the generated PDF contains."
                    className="min-h-28"
                  />
                  <p className="text-xs text-slate-500">This becomes visible HTML for Google, Bing, Yahoo, and visitors. Avoid copying official instructions verbatim.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Target search phrases</Label>
                  <Input
                    value={(templateMeta.seo_keywords || []).join(', ')}
                    onChange={(event) => setTemplateMeta({ ...templateMeta, seo_keywords: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })}
                    placeholder="W-9 form online, free W-9 filler, complete W-9 PDF"
                  />
                  <p className="text-xs text-slate-500">Used by internal search and editorial planning. Search engines primarily rank the actual page content, not the keywords tag.</p>
                </div>
                <details className="rounded-xl border border-slate-200 p-4">
                  <summary className="cursor-pointer font-semibold text-slate-700">Page sections</summary>
                  <div className="mt-4 space-y-4">
                    {(templateMeta.seo_sections || []).map((section, sectionIndex) => (
                      <div key={sectionIndex} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex gap-2">
                          <Input
                            value={section.heading}
                            onChange={(event) => setTemplateMeta({ ...templateMeta, seo_sections: (templateMeta.seo_sections || []).map((item, index) => index === sectionIndex ? { ...item, heading: event.target.value } : item) })}
                            placeholder="What is this form?"
                          />
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setTemplateMeta({ ...templateMeta, seo_sections: (templateMeta.seo_sections || []).filter((_, index) => index !== sectionIndex) })}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <Textarea
                          value={section.body}
                          onChange={(event) => setTemplateMeta({ ...templateMeta, seo_sections: (templateMeta.seo_sections || []).map((item, index) => index === sectionIndex ? { ...item, body: event.target.value } : item) })}
                          placeholder="Original, useful explanation for visitors."
                          className="mt-2 min-h-24"
                        />
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setTemplateMeta({ ...templateMeta, seo_sections: [...(templateMeta.seo_sections || []), { heading: '', body: '' }] })}><Plus className="mr-1 h-3 w-3" /> Add section</Button>
                  </div>
                </details>
                <details className="rounded-xl border border-slate-200 p-4">
                  <summary className="cursor-pointer font-semibold text-slate-700">Frequently asked questions</summary>
                  <div className="mt-4 space-y-4">
                    {(templateMeta.seo_faq || []).map((item, faqIndex) => (
                      <div key={faqIndex} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex gap-2">
                          <Input
                            value={item.question}
                            onChange={(event) => setTemplateMeta({ ...templateMeta, seo_faq: (templateMeta.seo_faq || []).map((faq, index) => index === faqIndex ? { ...faq, question: event.target.value } : faq) })}
                            placeholder="Who needs to complete this form?"
                          />
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setTemplateMeta({ ...templateMeta, seo_faq: (templateMeta.seo_faq || []).filter((_, index) => index !== faqIndex) })}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <Textarea
                          value={item.answer}
                          onChange={(event) => setTemplateMeta({ ...templateMeta, seo_faq: (templateMeta.seo_faq || []).map((faq, index) => index === faqIndex ? { ...faq, answer: event.target.value } : faq) })}
                          placeholder="Clear answer written for a person, not a search engine."
                          className="mt-2"
                        />
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setTemplateMeta({ ...templateMeta, seo_faq: [...(templateMeta.seo_faq || []), { question: '', answer: '' }] })}><Plus className="mr-1 h-3 w-3" /> Add FAQ</Button>
                  </div>
                </details>
                <details className="rounded-xl border border-slate-200 p-4">
                  <summary className="cursor-pointer font-semibold text-slate-700">Social sharing preview</summary>
                  <div className="mt-4 space-y-3">
                    <div><Label>Open Graph title</Label><Input value={templateMeta.og_title || ''} onChange={(event) => setTemplateMeta({ ...templateMeta, og_title: event.target.value })} placeholder="Defaults to search title" className="mt-1" /></div>
                    <div><Label>Open Graph description</Label><Textarea value={templateMeta.og_description || ''} onChange={(event) => setTemplateMeta({ ...templateMeta, og_description: event.target.value })} placeholder="Defaults to meta description" className="mt-1" /></div>
                    <div><Label>Share image URL</Label><Input value={templateMeta.og_image || ''} onChange={(event) => setTemplateMeta({ ...templateMeta, og_image: event.target.value })} placeholder="https://barckhat.com/oky-docky/images/w4-share.png" className="mt-1" /><p className="mt-1 text-xs text-slate-500">Use an absolute HTTPS image, ideally 1200 × 630.</p></div>
                  </div>
                </details>
                <details className="rounded-xl border border-slate-200 p-4">
                  <summary className="cursor-pointer font-semibold text-slate-700">Official source and revision</summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div><Label>Source authority</Label><Input value={templateMeta.source_authority || ''} onChange={(event) => setTemplateMeta({ ...templateMeta, source_authority: event.target.value })} placeholder="Internal Revenue Service" className="mt-1" /></div>
                    <div><Label>Form revision</Label><Input value={templateMeta.form_revision || ''} onChange={(event) => setTemplateMeta({ ...templateMeta, form_revision: event.target.value })} placeholder="2026" className="mt-1" /></div>
                    <div className="sm:col-span-2"><Label>Official source URL</Label><Input value={templateMeta.source_url || ''} onChange={(event) => setTemplateMeta({ ...templateMeta, source_url: event.target.value })} placeholder="https://www.irs.gov/..." className="mt-1" /></div>
                  </div>
                </details>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="truncate text-xs text-emerald-700">barckhat.com/oky-docky/{selectedTemplate}</div>
                  <div className="mt-1 text-lg text-blue-700">{templateMeta.seo_title || `${templateMeta.title} - Free Online Form | Oky-Docky`}</div>
                  <div className="mt-1 text-sm text-slate-600">{templateMeta.seo_description || templateMeta.description}</div>
                </div>
              </div>
            </details>
          )}

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

          {/* Load Template Modal */}
          <AnimatePresence>
            {showLoadTemplate && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                onClick={() => setShowLoadTemplate(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl max-h-[85vh] flex flex-col"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Load Template</h3>
                    <Button variant="ghost" size="icon" onClick={() => setShowLoadTemplate(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      autoFocus
                      value={templateSearch}
                      onChange={(event) => setTemplateSearch(event.target.value)}
                      placeholder="Search by title, ID, category, tag, or keyword..."
                      className="pl-9"
                    />
                  </div>
                  <div className="grid gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {templates.length === 0 ? (
                      <p className="text-sm text-slate-500 py-4 text-center">No templates found</p>
                    ) : filteredTemplates.length === 0 ? (
                      <p className="col-span-full text-sm text-slate-500 py-8 text-center">No templates match “{templateSearch}”</p>
                    ) : (
                      filteredTemplates.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => loadTemplateSchema(t.id)}
                          className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                        >
                          <div className="font-medium">{t.title || t.id}</div>
                          <div className="mt-1 font-mono text-xs text-indigo-600">{t.id}</div>
                          {t.description && <div className="text-sm text-slate-500 mt-1">{t.description}</div>}
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Create Template Modal */}
          <AnimatePresence>
            {showCreateTemplate && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                onClick={() => setShowCreateTemplate(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Create New Template</h3>
                    <Button variant="ghost" size="icon" onClick={() => setShowCreateTemplate(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Template ID *</Label>
                      <Input
                        value={newTemplate.id}
                        onChange={(e) => setNewTemplate(p => ({ ...p, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                        placeholder="my-form-2026"
                        className="mt-1"
                      />
                      <p className="text-xs text-slate-400 mt-1">Letters, digits, hyphens, underscores only</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Title *</Label>
                      <Input
                        value={newTemplate.title}
                        onChange={(e) => setNewTemplate(p => ({ ...p, title: e.target.value }))}
                        placeholder="Form W-4"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Description</Label>
                      <Input
                        value={newTemplate.description}
                        onChange={(e) => setNewTemplate(p => ({ ...p, description: e.target.value }))}
                        placeholder="Employee's Withholding Certificate"
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium">Category</Label>
                        <Input
                          value={newTemplate.category}
                          onChange={(e) => setNewTemplate(p => ({ ...p, category: e.target.value }))}
                          placeholder="tax"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Country</Label>
                        <Input
                          value={newTemplate.country}
                          onChange={(e) => setNewTemplate(p => ({ ...p, country: e.target.value.toUpperCase().slice(0, 2) }))}
                          placeholder="US"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium">Tags</Label>
                        <Input
                          value={newTemplate.tags}
                          onChange={(e) => setNewTemplate(p => ({ ...p, tags: e.target.value }))}
                          placeholder="tax, irs, personal"
                          className="mt-1"
                        />
                        <p className="text-xs text-slate-400 mt-1">Comma-separated</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Est. Time</Label>
                        <Input
                          value={newTemplate.estimated_time}
                          onChange={(e) => setNewTemplate(p => ({ ...p, estimated_time: e.target.value }))}
                          placeholder="5 min"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">PDF File</Label>
                      <div className="mt-1">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => setNewPdfFile(e.target.files?.[0] || null)}
                          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Upload any PDF (fillable or flat). You can map existing AcroForm fields or place your own overlay fields.</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => setShowCreateTemplate(false)}>Cancel</Button>
                    <Button
                      onClick={createTemplate}
                      disabled={creating || !newTemplate.id.trim() || !newTemplate.title.trim()}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                    >
                      {creating ? 'Creating...' : 'Create Template'}
                    </Button>
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

          {/* PDF Field Preview — shown above fields/empty state */}
          {showPdfPreview && selectedTemplate && (
            <div className="mb-8">
              <Separator className="mb-6" />
              <PdfFieldPreview
                templateId={selectedTemplate}
                mapping={mapping}
                onFieldClick={(pdfFieldName) => {
                  const existingKey = Object.entries(mapping).find(([, v]) =>
                    typeof v === 'string' ? v === pdfFieldName : v?.field === pdfFieldName
                  )?.[0];

                  if (existingKey) {
                    navigator.clipboard.writeText(existingKey);
                    toast.info(`Already mapped: ${pdfFieldName} → ${existingKey} (copied key)`);
                  } else {
                    const suggestedKey = pdfFieldName
                      .replace(/\[\d+\]/g, '')
                      .replace(/[^a-zA-Z0-9]/g, '_')
                      .replace(/_+/g, '_')
                      .replace(/^_|_$/g, '')
                      .toLowerCase();

                    setMapping((prev) => ({ ...prev, [suggestedKey]: pdfFieldName }));
                    if (!fields.some((f) => f.key === suggestedKey)) {
                      setFields((prev) => [...prev, {
                        key: suggestedKey,
                        type: 'text',
                        required: false,
                        label: suggestedKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                        placeholder: '',
                        helpText: '',
                      }]);
                    }
                    toast.success(`Mapped: ${suggestedKey} → ${pdfFieldName}`);
                  }
                }}
                onMappingRemove={(schemaKey) => {
                  setMapping((prev) => {
                    const next = { ...prev };
                    delete next[schemaKey];
                    return next;
                  });
                  toast.info(`Removed PDF mapping for "${schemaKey}"; the question was kept`);
                }}
                onOverlayAdd={(schemaKey, overlayMapping, fieldType) => {
                  setMapping((prev) => ({ ...prev, [schemaKey]: overlayMapping }));
                  if (!fields.some((f) => f.key === schemaKey)) {
                    setFields((prev) => [...prev, {
                      key: schemaKey,
                      type: fieldType,
                      required: false,
                      label: fieldType === 'signature'
                        ? 'Please sign here'
                        : schemaKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                      placeholder: '',
                      helpText: '',
                    }]);
                  }
                  toast.success(`Created overlay field: ${schemaKey}`);
                }}
                onOverlayUpdate={(schemaKey, overlayMapping) => {
                  setMapping((prev) => ({ ...prev, [schemaKey]: overlayMapping }));
                }}
              />
            </div>
          )}

          {/* Empty State */}
          {fields.length === 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Start building your form</h2>
              <p className="text-slate-600 mb-6">Add fields to create a step-by-step Q&A flow</p>
              <div className="flex justify-center gap-3">
                <Button onClick={addField} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white gap-2">
                  <Plus className="w-4 h-4" /> Add First Field
                </Button>
                <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
                  <Upload className="w-4 h-4" /> Import JSON
                </Button>
                <Button variant="outline" onClick={() => setShowCreateTemplate(true)} className="gap-2">
                  <FilePlus2 className="w-4 h-4" /> New Template
                </Button>
              </div>
            </motion.div>
          )}

          {/* Field Usage Panel */}
          <AnimatePresence>
            {showUsagePanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-8"
              >
                <div className="bg-white rounded-xl border-2 border-slate-200 p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
                    <Hash className="w-4 h-4" /> Field Usage Map
                  </h3>
                  {Object.keys(fieldUsage).length === 0 ? (
                    <p className="text-sm text-slate-400">No fields with keys defined yet.</p>
                  ) : (
                    <div className="grid gap-2">
                      {Object.entries(fieldUsage).map(([key, info]) => {
                        const totalRefs = info.conditions.length + info.transforms.length;
                        const isDupe = duplicateKeys.has(key);
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                              isDupe ? 'bg-red-50 border border-red-200' :
                              info.isHidden ? 'bg-amber-50 border border-amber-200' :
                              totalRefs > 0 ? 'bg-slate-50 border border-slate-200' :
                              'bg-slate-50/50 border border-dashed border-slate-200'
                            }`}
                          >
                            <code className="font-mono text-blue-600 font-medium min-w-[120px]">{key}</code>
                            {info.isHidden && (
                              <Badge variant="outline" className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-300">
                                <EyeOffIcon className="w-3 h-3" /> hidden
                              </Badge>
                            )}
                            {isDupe && (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertTriangle className="w-3 h-3" /> duplicate
                              </Badge>
                            )}
                            {info.conditions.length > 0 && (
                              <span className="text-xs text-slate-500">
                                conditions: <span className="font-mono">{info.conditions.join(', ')}</span>
                              </span>
                            )}
                            {info.transforms.length > 0 && (
                              <span className="text-xs text-cyan-600">
                                transforms: <span className="font-mono">{info.transforms.join(', ')}</span>
                              </span>
                            )}
                            {totalRefs === 0 && !info.isHidden && (
                              <span className="text-xs text-slate-400 italic">unused in conditions/transforms</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                    {field.hidden && (
                      <Badge variant="outline" className="text-xs gap-1 bg-amber-50 text-amber-700 border-amber-300">
                        <EyeOffIcon className="w-3 h-3" /> hidden
                      </Badge>
                    )}
                    {field.required && (
                      <Badge variant="destructive" className="text-xs">req</Badge>
                    )}
                    {duplicateKeys.has(field.key) && (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertTriangle className="w-3 h-3" /> dupe
                      </Badge>
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
                                  // Clear style/fieldId when switching away from document types
                                  if (!['text_input', 'checkbox_input', 'signature_area'].includes(v)) {
                                    updates.style = undefined;
                                    updates.fieldId = undefined;
                                  }
                                  updateField(index, updates);
                                }}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Text Input</SelectItem>
                                  <SelectItem value="date">Date</SelectItem>
                                  <SelectItem value="radio">Radio / Choice</SelectItem>
                                  <SelectItem value="checkbox">Checkbox</SelectItem>
                                  <SelectItem value="signature">Signature</SelectItem>
                                  <SelectItem value="text_input">Document Text Field</SelectItem>
                                  <SelectItem value="checkbox_input">Document Checkbox</SelectItem>
                                  <SelectItem value="signature_area">Signature Area</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-500">Key (ID)</Label>
                               <Input
                                 value={field.key}
                                 onChange={(e) => renameFieldKey(index, e.target.value)}
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
                                   const generatedKey = generateKey(e.target.value);
                                   updateField(index, updates);
                                   renameFieldKey(index, generatedKey);
                                   return;
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
                            <div className="flex items-center gap-4 pb-1">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={!!field.required}
                                  onCheckedChange={(v) => updateField(index, { required: v })}
                                />
                                <Label className="text-sm">Required</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={!!field.hidden}
                                  onCheckedChange={(v) => updateField(index, { hidden: v || undefined })}
                                />
                                <Label className="text-sm text-amber-700">Hidden</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={!!field.readOnly}
                                  onCheckedChange={(v) => updateField(index, { readOnly: v || undefined })}
                                />
                                <Label className="text-sm text-indigo-700">Read-only</Label>
                              </div>
                            </div>
                          </div>

                          {/* Default Value (especially useful for hidden fields) */}
                          {field.hidden && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-amber-600">
                                Default Value <span className="text-slate-400">(this field is hidden from the user)</span>
                              </Label>
                              <Input
                                value={field.defaultValue != null ? String(field.defaultValue) : ''}
                                onChange={(e) => updateField(index, { defaultValue: e.target.value || undefined })}
                                placeholder="Value to use in transforms/mapping"
                                className="border-amber-300 focus:border-amber-500"
                              />
                            </div>
                          )}

                          {/* Row 4: Help Text */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">Help text</Label>
                            <Input
                              value={field.helpText || ''}
                              onChange={(e) => updateField(index, { helpText: e.target.value || undefined })}
                              placeholder="Additional instructions shown below the question"
                            />
                          </div>

                          {/* Field ID for document mapping */}
                          {(field.type === 'text_input' || field.type === 'checkbox_input' || field.type === 'signature_area') && (
                            <>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-500">
                                  Field ID <span className="text-slate-400">(ID in the document)</span>
                                </Label>
                                <Input
                                  value={field.fieldId || ''}
                                  onChange={(e) => updateField(index, { fieldId: e.target.value || undefined })}
                                  placeholder="e.g. field_name_1"
                                  className="font-mono text-sm"
                                />
                              </div>

                              {/* Style controls */}
                              <div className="space-y-2">
                                <Label className="text-xs font-medium text-slate-500">Styling</Label>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-slate-400">Width</Label>
                                    <Input
                                      value={field.style?.width || ''}
                                      onChange={(e) => updateField(index, { style: { ...field.style, width: e.target.value || undefined } })}
                                      placeholder="e.g. 300px, 100%"
                                      className="text-sm h-8"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-slate-400">Height</Label>
                                    <Input
                                      value={field.style?.height || ''}
                                      onChange={(e) => updateField(index, { style: { ...field.style, height: e.target.value || undefined } })}
                                      placeholder={field.type === 'signature_area' ? 'e.g. 200px' : 'e.g. 40px'}
                                      className="text-sm h-8"
                                    />
                                  </div>
                                </div>
                                {field.type !== 'checkbox_input' && (
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-[11px] text-slate-400">Font Size</Label>
                                      <Input
                                        value={field.style?.fontSize || ''}
                                        onChange={(e) => updateField(index, { style: { ...field.style, fontSize: e.target.value || undefined } })}
                                        placeholder="e.g. 14px, 1rem"
                                        className="text-sm h-8"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px] text-slate-400">Font Family</Label>
                                      <Input
                                        value={field.style?.fontFamily || ''}
                                        onChange={(e) => updateField(index, { style: { ...field.style, fontFamily: e.target.value || undefined } })}
                                        placeholder="e.g. Arial, monospace"
                                        className="text-sm h-8"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                          {/* Row 5: Input Mask + Max Length (text only) */}
                          {field.type === 'text' && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-500">
                                  Input Mask
                                  <span className="ml-1 text-slate-400">(D=digit, L=letter, A=any)</span>
                                </Label>
                                <Input
                                  value={field.inputMask || ''}
                                  onChange={(e) => {
                                    const mask = e.target.value || undefined;
                                    const updates: Partial<SchemaField> = { inputMask: mask };
                                    if (mask) updates.maxLength = mask.length;
                                    updateField(index, updates);
                                  }}
                                  placeholder="e.g. DDD-DD-DDDD"
                                  className="font-mono text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-500">Max Length</Label>
                                <Input
                                  type="number"
                                  value={field.maxLength ?? ''}
                                  onChange={(e) => updateField(index, { maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                                  placeholder="auto"
                                  className="text-sm"
                                />
                              </div>
                            </div>
                          )}

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

                            {field.visible_when && Object.entries(field.visible_when).map(([depKey, expected]) => {
                              const depField = fields.find((f) => f.key === depKey);
                              if (!depField) return null;
                              const values = acceptedConditionValues(expected) || [];

                              return (
                                <div key={depKey} className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">
                                      Show when <span className="font-mono text-blue-600">{depField.label || depKey}</span> =
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

                            <div className="space-y-1.5 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                              <Label className="text-xs font-medium text-indigo-700">Lock when (optional JSON condition or OR groups)</Label>
                              <Input
                                value={field.read_only_when_any
                                  ? JSON.stringify(field.read_only_when_any)
                                  : field.read_only_when
                                    ? JSON.stringify(field.read_only_when)
                                    : ''}
                                onChange={(e) => {
                                  if (!e.target.value.trim()) {
                                    updateField(index, { read_only_when: undefined, read_only_when_any: undefined });
                                    return;
                                  }
                                  try {
                                    const parsed = JSON.parse(e.target.value);
                                    updateField(index, Array.isArray(parsed)
                                      ? { read_only_when: undefined, read_only_when_any: parsed }
                                      : { read_only_when: parsed, read_only_when_any: undefined });
                                  } catch { /* keep the last valid condition while typing */ }
                                }}
                                placeholder='{"auto_calculate": ["yes"]} or [{"income": {"lt": 75000}}, ...]'
                                className="font-mono text-sm"
                              />
                              <p className="text-xs text-slate-500">Use this with a transform that sets the field value automatically.</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* Transforms Section */}
          {fields.length > 0 && (
            <div className="mt-8">
              <div
                className="flex items-center justify-between cursor-pointer px-2 py-3"
                onClick={() => setShowTransforms(!showTransforms)}
              >
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${showTransforms ? 'rotate-90' : ''}`} />
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                    Variables & Logic
                  </h3>
                  <Badge variant="secondary" className="text-xs">{transforms.length}</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTransforms((prev) => [...prev, createEmptyTransform()]);
                    setExpandedTransform(transforms.length);
                    setShowTransforms(true);
                  }}
                >
                  <Plus className="w-3 h-3" /> Add Rule
                </Button>
              </div>

              <AnimatePresence>
                {showTransforms && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-3"
                  >
                    {transforms.length === 0 && (
                      <p className="text-sm text-slate-400 py-4 text-center">
                        Add a formula rule to turn one answer into multiple calculated PDF fields.
                      </p>
                    )}

                    {transforms.map((tr, ti) => {
                      const isExpTr = expandedTransform === ti;
                      return (
                        <div key={ti} className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
                          {/* Collapsed header */}
                          <div
                            className="flex items-center gap-3 px-5 py-3 cursor-pointer select-none"
                            onClick={() => setExpandedTransform(isExpTr ? null : ti)}
                          >
                            <span className="text-sm font-mono text-slate-400 w-6">{ti + 1}</span>
                            <Badge className={`${TRANSFORM_TYPE_COLORS[tr.type] || 'bg-slate-100 text-slate-700'} text-xs`}>
                              {tr.type}
                            </Badge>
                            <span className="text-sm text-slate-600 truncate flex-1">
                              {transformSummary(tr)}
                            </span>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTransforms((prev) => prev.filter((_, i) => i !== ti));
                                if (expandedTransform === ti) setExpandedTransform(null);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpTr ? 'rotate-90' : ''}`} />
                          </div>

                          {/* Expanded editor */}
                          <AnimatePresence>
                            {isExpTr && (
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                className="overflow-hidden"
                              >
                                <Separator />
                                <div className="p-5 space-y-4 bg-slate-50/50">
                                  {/* Transform type */}
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-500">Transform Type</Label>
                                    <Select
                                      value={tr.type}
                                      onValueChange={(v) => {
                                        setTransforms((prev) => prev.map((t, i) => {
                                          if (i !== ti) return t;
                                          const base: SchemaTransform = { type: v as SchemaTransform['type'] };
                                          if (v === 'derive') return { ...base, when: {}, set: {} };
                                          if (v === 'formula') return { ...base, outputs: { result: '' } };
                                           if (v === 'compute') return { ...base, operation: 'multiply', input: '', factor: 1, output: '' };
                                           if (v === 'copy') return { ...base, from: '', to: '', if_empty: false };
                                           if (v === 'concat') return { ...base, inputs: [], output: '', separator: ' ', skip_empty: true };
                                           if (v === 'auto_date') return { ...base, field: '', format: 'MM/DD/YYYY' };
                                          if (v === 'set_value') return { ...base, field: '', value: '' };
                                          return base;
                                        }));
                                      }}
                                    >
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="derive">Derive (conditional set)</SelectItem>
                                        <SelectItem value="formula">Formula variables</SelectItem>
                                        <SelectItem value="compute">Compute (math)</SelectItem>
                                         <SelectItem value="copy">Copy (field to field)</SelectItem>
                                         <SelectItem value="concat">Join text fields</SelectItem>
                                         <SelectItem value="auto_date">Auto Date</SelectItem>
                                        <SelectItem value="set_value">Set Value</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Type-specific editors */}
                                  {tr.type === 'derive' && (
                                    <>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-500">When (JSON condition)</Label>
                                        <Input
                                          value={JSON.stringify(tr.when || {})}
                                          onChange={(e) => {
                                            try {
                                              const parsed = JSON.parse(e.target.value);
                                              setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, when: parsed } : t));
                                            } catch { /* ignore bad json while typing */ }
                                          }}
                                          placeholder='{"field_key": "value"}'
                                          className="font-mono text-sm"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-500">Set (JSON fields to set)</Label>
                                        <Input
                                          value={JSON.stringify(tr.set || {})}
                                          onChange={(e) => {
                                            try {
                                              const parsed = JSON.parse(e.target.value);
                                              setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, set: parsed } : t));
                                            } catch { /* ignore */ }
                                          }}
                                          placeholder='{"derived_field": true}'
                                          className="font-mono text-sm"
                                        />
                                      </div>
                                    </>
                                  )}

                                  {tr.type === 'formula' && (
                                    <div className="space-y-4">
                                      <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900">
                                        Variables run from top to bottom. Use question keys and earlier variables, for example
                                        <code className="mx-1 rounded bg-white px-1.5 py-0.5">amount / 2</code>,
                                        <code className="mx-1 rounded bg-white px-1.5 py-0.5">percent(amount, 20)</code>, or
                                        <code className="mx-1 rounded bg-white px-1.5 py-0.5">ifelse(age &gt;= 65, base + extra, base)</code>.
                                      </div>
                                      <div className="grid grid-cols-[1fr_2fr_1.3fr_36px] gap-2 px-1 text-xs font-medium text-slate-500">
                                        <span>Variable</span><span>Formula</span><span>PDF field(s)</span><span />
                                      </div>
                                      {Object.entries(tr.outputs || {}).map(([name, expression], variableIndex) => (
                                        <div key={`${name}-${variableIndex}`} className="grid grid-cols-[1fr_2fr_1.3fr_36px] gap-2 items-center">
                                          <Input
                                            value={name}
                                            onChange={(event) => {
                                              const nextName = event.target.value;
                                              setTransforms((prev) => prev.map((item, index) => {
                                                if (index !== ti) return item;
                                                const entries = Object.entries(item.outputs || {});
                                                entries[variableIndex] = [nextName, entries[variableIndex]?.[1] || ''];
                                                return { ...item, outputs: Object.fromEntries(entries) };
                                              }));
                                              if (name && nextName && name !== nextName) setMapping((prev) => {
                                                if (!(name in prev)) return prev;
                                                const next = { ...prev, [nextName]: prev[name] };
                                                delete next[name]; return next;
                                              });
                                            }}
                                            placeholder="line_total"
                                            className="font-mono text-sm"
                                          />
                                          <Input
                                            value={expression}
                                            onChange={(event) => setTransforms((prev) => prev.map((item, index) => {
                                              if (index !== ti) return item;
                                              const entries = Object.entries(item.outputs || {});
                                              entries[variableIndex] = [entries[variableIndex]?.[0] || '', event.target.value];
                                              return { ...item, outputs: Object.fromEntries(entries) };
                                            }))}
                                            placeholder="amount - percent(amount, 20)"
                                            className="font-mono text-sm"
                                          />
                                          <Input
                                            value={Array.isArray(mapping[name]) ? mapping[name].join(', ') : typeof mapping[name] === 'string' ? mapping[name] : ''}
                                            onChange={(event) => {
                                              const targets = event.target.value.split(',').map((value) => value.trim()).filter(Boolean);
                                              setMapping((prev) => {
                                                const next = { ...prev };
                                                if (!targets.length) delete next[name];
                                                else next[name] = targets.length === 1 ? targets[0] : targets;
                                                return next;
                                              });
                                            }}
                                            placeholder="PDF field name"
                                            className="font-mono text-sm"
                                          />
                                          <Button
                                            variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                                            onClick={() => {
                                              setTransforms((prev) => prev.map((item, index) => {
                                                if (index !== ti) return item;
                                                const entries = Object.entries(item.outputs || {}).filter((_, row) => row !== variableIndex);
                                                return { ...item, outputs: Object.fromEntries(entries) };
                                              }));
                                              setMapping((prev) => { const next = { ...prev }; delete next[name]; return next; });
                                            }}
                                          ><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                      ))}
                                      <Button
                                        type="button" variant="outline" size="sm" className="gap-1"
                                        onClick={() => setTransforms((prev) => prev.map((item, index) => index === ti
                                          ? { ...item, outputs: { ...(item.outputs || {}), [`variable_${Object.keys(item.outputs || {}).length + 1}`]: '' } }
                                          : item))}
                                      ><Plus className="h-3 w-3" /> Add variable</Button>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-500">Run only when (optional JSON condition)</Label>
                                        <Input
                                          value={tr.when ? JSON.stringify(tr.when) : ''}
                                          onChange={(event) => {
                                            if (!event.target.value.trim()) {
                                              setTransforms((prev) => prev.map((item, index) => index === ti ? { ...item, when: undefined } : item));
                                              return;
                                            }
                                            try {
                                              const parsed = JSON.parse(event.target.value);
                                              setTransforms((prev) => prev.map((item, index) => index === ti ? { ...item, when: parsed } : item));
                                            } catch { /* keep last valid JSON while typing */ }
                                          }}
                                          placeholder='{"filing_status": "single"}'
                                          className="font-mono text-sm"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {tr.type === 'compute' && (
                                    <>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-slate-500">Operation</Label>
                                          <Select
                                            value={tr.operation || 'multiply'}
                                            onValueChange={(v) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, operation: v } : t))}
                                          >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="multiply">Multiply</SelectItem>
                                              <SelectItem value="sum">Sum</SelectItem>
                                              <SelectItem value="subtract">Subtract</SelectItem>
                                              <SelectItem value="divide">Divide</SelectItem>
                                              <SelectItem value="percent">Percent</SelectItem>
                                              <SelectItem value="min">Minimum</SelectItem>
                                              <SelectItem value="max">Maximum</SelectItem>
                                              <SelectItem value="avg">Average</SelectItem>
                                              <SelectItem value="round">Round</SelectItem>
                                              <SelectItem value="abs">Absolute value</SelectItem>
                                              <SelectItem value="negate">Negate</SelectItem>
                                              <SelectItem value="pow">Power</SelectItem>
                                              <SelectItem value="mod">Modulo</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-slate-500">Output Field</Label>
                                          <Input
                                            value={tr.output || ''}
                                            onChange={(e) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, output: e.target.value } : t))}
                                            placeholder="output_field_key"
                                            className="font-mono text-sm"
                                          />
                                        </div>
                                      </div>
                                      {tr.operation === 'multiply' ? (
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-1.5">
                                            <Label className="text-xs font-medium text-slate-500">Input Field</Label>
                                            <Input
                                              value={tr.input || ''}
                                              onChange={(e) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, input: e.target.value } : t))}
                                              placeholder="source_field_key"
                                              className="font-mono text-sm"
                                            />
                                          </div>
                                          <div className="space-y-1.5">
                                            <Label className="text-xs font-medium text-slate-500">Factor</Label>
                                            <Input
                                              type="number"
                                              value={tr.factor ?? ''}
                                              onChange={(e) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, factor: e.target.value ? parseFloat(e.target.value) : undefined } : t))}
                                              placeholder="1"
                                            />
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-slate-500">Input Fields (comma-separated)</Label>
                                          <Input
                                            value={(tr.inputs || []).join(', ')}
                                            onChange={(e) => {
                                              const inputs = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                                              setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, inputs } : t));
                                            }}
                                            placeholder="field_a, field_b"
                                            className="font-mono text-sm"
                                          />
                                        </div>
                                      )}
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-500">When (optional JSON condition)</Label>
                                        <Input
                                          value={tr.when ? JSON.stringify(tr.when) : ''}
                                          onChange={(e) => {
                                            if (!e.target.value.trim()) {
                                              setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, when: undefined } : t));
                                              return;
                                            }
                                            try {
                                              const parsed = JSON.parse(e.target.value);
                                              setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, when: parsed } : t));
                                            } catch { /* keep the last valid condition while typing */ }
                                          }}
                                          placeholder='{"filing_status": ["single"], "income": {"lt": 75000}}'
                                          className="font-mono text-sm"
                                        />
                                      </div>
                                    </>
                                  )}

                                  {tr.type === 'copy' && (
                                    <>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-slate-500">From Field</Label>
                                          <Input
                                            value={tr.from || ''}
                                            onChange={(e) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, from: e.target.value } : t))}
                                            placeholder="source_field"
                                            className="font-mono text-sm"
                                          />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-slate-500">To Field</Label>
                                          <Input
                                            value={tr.to || ''}
                                            onChange={(e) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, to: e.target.value } : t))}
                                            placeholder="target_field"
                                            className="font-mono text-sm"
                                          />
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-end">
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-slate-500">When (optional JSON condition)</Label>
                                          <Input
                                            value={tr.when ? JSON.stringify(tr.when) : ''}
                                            onChange={(e) => {
                                              if (!e.target.value) {
                                                setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, when: undefined } : t));
                                                return;
                                              }
                                              try {
                                                const parsed = JSON.parse(e.target.value);
                                                setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, when: parsed } : t));
                                              } catch { /* ignore */ }
                                            }}
                                            placeholder='{"field": "value"}'
                                            className="font-mono text-sm"
                                          />
                                        </div>
                                        <div className="flex items-center gap-2 pb-1">
                                          <Switch
                                            checked={!!tr.if_empty}
                                            onCheckedChange={(v) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, if_empty: v } : t))}
                                          />
                                          <Label className="text-sm">Only if target is empty</Label>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {tr.type === 'concat' && (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-slate-500">Input Fields (comma-separated)</Label>
                                          <Input
                                            value={(tr.inputs || []).join(', ')}
                                            onChange={(e) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, inputs: e.target.value.split(',').map((value) => value.trim()).filter(Boolean) } : t))}
                                            placeholder="first_name, last_name"
                                            className="font-mono text-sm"
                                          />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-slate-500">Output Field</Label>
                                          <Input
                                            value={tr.output || ''}
                                            onChange={(e) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, output: e.target.value } : t))}
                                            placeholder="full_name"
                                            className="font-mono text-sm"
                                          />
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-slate-500">Separator</Label>
                                          <Input
                                            value={tr.separator ?? ' '}
                                            onChange={(e) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, separator: e.target.value } : t))}
                                            placeholder="space, comma, etc."
                                          />
                                        </div>
                                        <div className="flex items-center gap-2 pb-1">
                                          <Switch
                                            checked={tr.skip_empty !== false}
                                            onCheckedChange={(value) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, skip_empty: value } : t))}
                                          />
                                          <Label className="text-sm">Skip empty values</Label>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {tr.type === 'auto_date' && (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-500">Target Field</Label>
                                        <Input
                                          value={tr.field || ''}
                                          onChange={(e) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, field: e.target.value } : t))}
                                          placeholder="date_signed"
                                          className="font-mono text-sm"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-500">Format</Label>
                                        <Input
                                          value={tr.format || 'MM/DD/YYYY'}
                                          onChange={(e) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, format: e.target.value } : t))}
                                          placeholder="MM/DD/YYYY"
                                          className="font-mono text-sm"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {tr.type === 'set_value' && (
                                    <>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-slate-500">Target Field</Label>
                                          <Input
                                            value={tr.field || ''}
                                            onChange={(e) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, field: e.target.value } : t))}
                                            placeholder="field_key"
                                            className="font-mono text-sm"
                                          />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-slate-500">Value</Label>
                                          <Input
                                            value={typeof tr.value === 'string' ? tr.value : JSON.stringify(tr.value ?? '')}
                                            onChange={(e) => setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, value: e.target.value } : t))}
                                            placeholder="value"
                                            className="font-mono text-sm"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-500">When (optional JSON condition)</Label>
                                        <Input
                                          value={tr.when ? JSON.stringify(tr.when) : ''}
                                          onChange={(e) => {
                                            if (!e.target.value) {
                                              setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, when: undefined } : t));
                                              return;
                                            }
                                            try {
                                              const parsed = JSON.parse(e.target.value);
                                              setTransforms((prev) => prev.map((t, i) => i === ti ? { ...t, when: parsed } : t));
                                            } catch { /* ignore */ }
                                          }}
                                          placeholder='{"field": "value"} or leave empty for unconditional'
                                          className="font-mono text-sm"
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

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
                className="w-full py-6 border-dashed border-2 text-slate-500 hover:text-blue-600 hover:border-indigo-400 gap-2"
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
