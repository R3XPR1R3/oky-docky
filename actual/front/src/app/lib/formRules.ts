import type {
  ConditionExpected,
  ConditionOperator,
  ConditionPrimitive,
  ConditionSet,
  SchemaField,
  SchemaTransform,
} from '../App';
import { evaluateFormula } from './formula';

function isOperator(value: ConditionExpected): value is ConditionOperator {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === ''
    || (Array.isArray(value) && value.length === 0);
}

function asBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return ['true', 'yes', '1', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function asNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[$,%\s]/g, '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameValue(actual: unknown, expected: ConditionPrimitive) {
  if (typeof expected === 'boolean') return asBoolean(actual) === expected;
  if (expected === null) return actual === null || actual === undefined;
  return String(actual) === String(expected);
}

export function matchesExpected(actual: unknown, expected: ConditionExpected) {
  if (Array.isArray(expected)) return expected.some((value) => sameValue(actual, value));
  if (!isOperator(expected)) return sameValue(actual, expected);

  if ('equals' in expected && !sameValue(actual, expected.equals ?? null)) return false;
  if ('not_equals' in expected && sameValue(actual, expected.not_equals ?? null)) return false;
  if (expected.in && !expected.in.some((value) => sameValue(actual, value))) return false;
  if (expected.not_in && expected.not_in.some((value) => sameValue(actual, value))) return false;
  if (expected.empty !== undefined && isEmpty(actual) !== expected.empty) return false;
  if (expected.truthy !== undefined && asBoolean(actual) !== expected.truthy) return false;

  const numeric = asNumber(actual);
  if (expected.gt !== undefined && !(numeric > expected.gt)) return false;
  if (expected.gte !== undefined && !(numeric >= expected.gte)) return false;
  if (expected.lt !== undefined && !(numeric < expected.lt)) return false;
  if (expected.lte !== undefined && !(numeric <= expected.lte)) return false;
  return true;
}

export function matchesConditions(conditions: ConditionSet | undefined, answers: Record<string, any>) {
  if (!conditions) return true;
  return Object.entries(conditions).every(([key, expected]) => matchesExpected(answers[key], expected));
}

function matchesAny(groups: ConditionSet[] | undefined, answers: Record<string, any>) {
  return !!groups?.length && groups.some((conditions) => matchesConditions(conditions, answers));
}

export function isFieldVisible(field: SchemaField, answers: Record<string, any>) {
  if (field.hidden) return false;
  if (field.visible_when_any?.length) return matchesAny(field.visible_when_any, answers);
  return matchesConditions(field.visible_when, answers);
}

export function isFieldReadOnly(field: SchemaField, answers: Record<string, any>) {
  if (field.readOnly) return true;
  if (field.read_only_when_any?.length) return matchesAny(field.read_only_when_any, answers);
  return !!field.read_only_when && matchesConditions(field.read_only_when, answers);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(8)));
}

function compute(rule: SchemaTransform, data: Record<string, any>) {
  const keys = rule.inputs || (rule.input ? [rule.input] : []);
  const values = keys.map((key) => asNumber(data[key]));
  const operation = rule.operation || 'sum';
  if (operation === 'sum' || operation === 'add') return formatNumber(values.reduce((sum, value) => sum + value, 0));
  if (operation === 'subtract') return formatNumber(values.slice(1).reduce((result, value) => result - value, values[0] || 0));
  if (operation === 'multiply') {
    if (rule.factor !== undefined) return formatNumber((values[0] || 0) * asNumber(rule.factor));
    return formatNumber(values.reduce((result, value) => result * value, values.length ? 1 : 0));
  }
  if (operation === 'divide') {
    const divisor = values[1] ?? asNumber(rule.divisor ?? 1);
    return formatNumber(divisor === 0 ? 0 : (values[0] || 0) / divisor);
  }
  if (operation === 'percent') return formatNumber((values[0] || 0) * (values[1] ?? asNumber(rule.percent)) / 100);
  if (operation === 'min') return formatNumber(values.length ? Math.min(...values) : 0);
  if (operation === 'max') return formatNumber(values.length ? Math.max(...values) : 0);
  if (operation === 'avg') return formatNumber(values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
  if (operation === 'round') return formatNumber(Number((values[0] || 0).toFixed(rule.precision || 0)));
  if (operation === 'abs') return formatNumber(Math.abs(values[0] || 0));
  if (operation === 'negate') return formatNumber(-(values[0] || 0));
  if (operation === 'pow') return formatNumber((values[0] || 0) ** (values[1] ?? asNumber(rule.exp ?? 1)));
  if (operation === 'mod') {
    const divisor = values[1] ?? asNumber(rule.mod ?? 1);
    return formatNumber(divisor === 0 ? 0 : (values[0] || 0) % divisor);
  }
  return '0';
}

function today(format = 'MM/DD/YYYY') {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return format.replace('MM', mm).replace('DD', dd).replace('YYYY', String(now.getFullYear()));
}

export function applyTransforms(values: Record<string, any>, transforms: SchemaTransform[] = []) {
  const result = { ...values };
  for (const rule of transforms) {
    const active = matchesConditions(rule.when, result)
      && (!rule.unless || !matchesConditions(rule.unless, result));
    if (rule.type === 'derive') {
      Object.assign(result, active ? (rule.set || {}) : (rule.else_set || {}));
    } else if (rule.type === 'compute') {
      if (active && rule.output) result[rule.output] = compute(rule, result);
    } else if (rule.type === 'formula') {
      if (!active) continue;
      for (const [output, expression] of Object.entries(rule.outputs || {})) {
        if (output && expression) result[output] = evaluateFormula(expression, result);
      }
    } else if (rule.type === 'copy') {
      if (!active || !rule.from || !rule.to) continue;
      const source = result[rule.from];
      if (!isEmpty(source) && (!rule.if_empty || isEmpty(result[rule.to]))) result[rule.to] = source;
    } else if (rule.type === 'concat') {
      if (!active || !rule.output) continue;
      let parts = (rule.inputs || []).map((key) => String(result[key] ?? '').trim());
      if (rule.skip_empty !== false) parts = parts.filter(Boolean);
      result[rule.output] = parts.join(rule.separator ?? ' ');
    } else if (rule.type === 'auto_date') {
      if (active && rule.field && isEmpty(result[rule.field])) result[rule.field] = today(rule.format);
    } else if (rule.type === 'set_value' && rule.field) {
      if (active) result[rule.field] = rule.value;
      else if ('else_value' in rule) result[rule.field] = rule.else_value;
    }
  }
  return result;
}
