const SSN_LIKE_KEYS = new Set(['ssn', 'tin']);
const EIN_KEYS = new Set(['ein']);

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function formatPattern(digits: string, parts: number[]): string {
  let cursor = 0;
  const out: string[] = [];

  for (const part of parts) {
    if (cursor >= digits.length) break;
    const chunk = digits.slice(cursor, cursor + part);
    if (!chunk) break;
    out.push(chunk);
    cursor += part;
  }

  return out.join('-');
}

export function formatInputValueByKey(fieldKey: string, rawValue: string): string {
  if (typeof rawValue !== 'string') {
    return rawValue as unknown as string;
  }

  if (SSN_LIKE_KEYS.has(fieldKey)) {
    const digits = digitsOnly(rawValue).slice(0, 9);
    return formatPattern(digits, [3, 2, 4]);
  }

  if (EIN_KEYS.has(fieldKey)) {
    const digits = digitsOnly(rawValue).slice(0, 9);
    return formatPattern(digits, [2, 7]);
  }

  return rawValue;
}
