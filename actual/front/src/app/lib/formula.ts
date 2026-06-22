export class FormulaError extends Error {}

type Token = { kind: 'number' | 'string' | 'name' | 'op' | 'eof'; value: string };
const FUNCTIONS = new Set(['percent', 'sum', 'avg', 'min', 'max', 'round', 'abs', 'floor', 'ceil', 'clamp', 'ifelse']);

function tokenize(source: string): Token[] {
  if (!source.trim()) throw new FormulaError('Formula cannot be empty');
  if (source.length > 500) throw new FormulaError('Formula is too long');
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    const number = source.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/)?.[0];
    if (number) { tokens.push({ kind: 'number', value: number }); i += number.length; continue; }
    const name = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
    if (name) { tokens.push({ kind: 'name', value: name }); i += name.length; continue; }
    if (ch === '"' || ch === "'") {
      const quote = ch; let value = ''; i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < source.length) { value += source[i + 1]; i += 2; }
        else { value += source[i]; i += 1; }
      }
      if (source[i] !== quote) throw new FormulaError('Unclosed string');
      i += 1; tokens.push({ kind: 'string', value }); continue;
    }
    const two = source.slice(i, i + 2);
    if (['==', '!=', '>=', '<=', '**'].includes(two)) { tokens.push({ kind: 'op', value: two }); i += 2; continue; }
    if ('+-*/%^(),><'.includes(ch)) { tokens.push({ kind: 'op', value: ch }); i += 1; continue; }
    throw new FormulaError(`Unexpected character: ${ch}`);
  }
  if (tokens.length > 100) throw new FormulaError('Formula is too complex');
  return [...tokens, { kind: 'eof', value: '' }];
}

function number(value: unknown): number {
  if (typeof value === 'boolean') return Number(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function truthy(value: unknown): boolean {
  if (typeof value === 'string') return !['', '0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
  return Boolean(value);
}

function call(name: string, args: unknown[]): unknown {
  const nums = args.map(number);
  if (name === 'percent' && nums.length === 2) return nums[0] * nums[1] / 100;
  if (name === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (name === 'avg') return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  if (name === 'min') return nums.length ? Math.min(...nums) : 0;
  if (name === 'max') return nums.length ? Math.max(...nums) : 0;
  if (name === 'round' && nums.length >= 1 && nums.length <= 2) {
    const places = nums[1] || 0; const scale = 10 ** places;
    return Math.round(nums[0] * scale) / scale;
  }
  if (name === 'abs' && nums.length === 1) return Math.abs(nums[0]);
  if (name === 'floor' && nums.length === 1) return Math.floor(nums[0]);
  if (name === 'ceil' && nums.length === 1) return Math.ceil(nums[0]);
  if (name === 'clamp' && nums.length === 3) return Math.min(Math.max(nums[0], nums[1]), nums[2]);
  if (name === 'ifelse' && args.length === 3) return truthy(args[0]) ? args[1] : args[2];
  throw new FormulaError(`Unknown function or wrong arguments: ${name}`);
}

class Parser {
  private index = 0;
  constructor(private tokens: Token[], private values: Record<string, unknown>) {}
  private current() { return this.tokens[this.index]; }
  private take(value?: string) {
    const token = this.current();
    if (value !== undefined && token.value !== value) throw new FormulaError(`Expected ${value || 'expression'}`);
    this.index += 1; return token;
  }
  private match(...values: string[]) { if (values.includes(this.current().value)) { this.index += 1; return true; } return false; }
  parse(): unknown { const result = this.or(); if (this.current().kind !== 'eof') throw new FormulaError(`Unexpected token: ${this.current().value}`); return result; }
  private or(): unknown { let value = this.and(); while (this.match('or')) { const right = this.and(); value = truthy(value) || truthy(right); } return value; }
  private and(): unknown { let value = this.compare(); while (this.match('and')) { const right = this.compare(); value = truthy(value) && truthy(right); } return value; }
  private compare(): unknown {
    let left = this.add();
    while (['==', '!=', '>', '>=', '<', '<='].includes(this.current().value)) {
      const op = this.take().value; const right = this.add();
      if (op === '==') left = String(left) === String(right);
      else if (op === '!=') left = String(left) !== String(right);
      else if (op === '>') left = number(left) > number(right);
      else if (op === '>=') left = number(left) >= number(right);
      else if (op === '<') left = number(left) < number(right);
      else left = number(left) <= number(right);
    }
    return left;
  }
  private add(): unknown { let value = this.multiply(); while (['+', '-'].includes(this.current().value)) { const op = this.take().value; const rhs = number(this.multiply()); value = op === '+' ? number(value) + rhs : number(value) - rhs; } return value; }
  private multiply(): unknown { let value = this.power(); while (['*', '/', '%'].includes(this.current().value)) { const op = this.take().value; const rhs = number(this.power()); value = op === '*' ? number(value) * rhs : rhs === 0 ? 0 : op === '/' ? number(value) / rhs : number(value) % rhs; } return value; }
  private power(): unknown { let value = this.unary(); if (this.match('^', '**')) value = number(value) ** number(this.power()); return value; }
  private unary(): unknown { if (this.match('-')) return -number(this.unary()); if (this.match('+')) return number(this.unary()); if (this.match('not')) return !truthy(this.unary()); return this.primary(); }
  private primary(): unknown {
    const token = this.current();
    if (token.kind === 'number') { this.take(); return Number(token.value); }
    if (token.kind === 'string') { this.take(); return token.value; }
    if (this.match('(')) { const value = this.or(); this.take(')'); return value; }
    if (token.kind === 'name') {
      const name = this.take().value;
      if (this.match('(')) {
        if (!FUNCTIONS.has(name)) throw new FormulaError(`Unknown function: ${name}`);
        const args: unknown[] = [];
        if (!this.match(')')) { do { args.push(this.or()); } while (this.match(',')); this.take(')'); }
        return call(name, args);
      }
      if (name === 'true') return true;
      if (name === 'false') return false;
      return this.values[name] ?? 0;
    }
    throw new FormulaError(`Expected expression, found ${token.value || 'end'}`);
  }
}

export function evaluateFormula(expression: string, values: Record<string, unknown>): unknown {
  const result = new Parser(tokenize(expression), values).parse();
  if (typeof result !== 'number') return result;
  const rounded = Number(result.toFixed(8));
  return String(rounded);
}

export function formulaDependencies(expression: string): string[] {
  const tokens = tokenize(expression);
  return [...new Set(tokens.flatMap((token, index) => {
    if (token.kind !== 'name' || ['true', 'false', 'and', 'or', 'not'].includes(token.value)) return [];
    if (tokens[index + 1]?.value === '(' && FUNCTIONS.has(token.value)) return [];
    return [token.value];
  }))];
}

export function renameFormulaIdentifier(expression: string, oldName: string, newName: string): string {
  return expression.replace(new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'g'), newName);
}
