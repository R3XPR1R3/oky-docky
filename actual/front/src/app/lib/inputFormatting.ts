/**
 * Input mask formatting engine.
 *
 * Mask characters:
 *   D = digit (0-9)
 *   L = letter (a-z, A-Z)
 *   A = alphanumeric
 *   * = any character
 *   anything else = literal separator
 *
 * Examples:
 *   "DDD-DD-DDDD"      → SSN
 *   "DD-DDDDDDD"       → EIN
 *   "DDDDD"            → ZIP
 *   "LL"               → State code
 *   "(DDD) DDD-DDDD"   → Phone
 */

const MASK_CHARS: Record<string, RegExp> = {
  D: /\d/,
  L: /[a-zA-Z]/,
  A: /[a-zA-Z0-9]/,
  '*': /./,
};

function isMaskChar(ch: string): boolean {
  return ch in MASK_CHARS;
}

/**
 * Format raw input according to a mask pattern.
 * Extracts meaningful characters and inserts literal separators.
 */
export function formatWithMask(raw: string, mask: string): string {
  if (!mask) return raw;

  // Extract input characters (digits and letters) from raw
  const inputChars: string[] = [];
  for (const ch of raw) {
    if (/[a-zA-Z0-9]/.test(ch)) {
      inputChars.push(ch);
    }
  }

  const result: string[] = [];
  let inputIdx = 0;

  for (const maskCh of mask) {
    if (inputIdx >= inputChars.length) break;

    if (isMaskChar(maskCh)) {
      const pattern = MASK_CHARS[maskCh];
      if (pattern.test(inputChars[inputIdx])) {
        result.push(maskCh === 'L' ? inputChars[inputIdx].toUpperCase() : inputChars[inputIdx]);
        inputIdx++;
      } else {
        break;
      }
    } else {
      // Literal separator — insert automatically
      result.push(maskCh);
    }
  }

  return result.join('');
}

/**
 * Get the maximum length for a mask pattern.
 */
export function maskMaxLength(mask: string): number | undefined {
  return mask ? mask.length : undefined;
}

/**
 * Format input value — uses mask from schema if provided.
 */
export function formatInputValue(fieldKey: string, rawValue: string, inputMask?: string): string {
  if (typeof rawValue !== 'string') return rawValue as unknown as string;
  if (inputMask) return formatWithMask(rawValue, inputMask);
  return rawValue;
}

// Backward-compatible alias
export function formatInputValueByKey(fieldKey: string, rawValue: string): string {
  return formatInputValue(fieldKey, rawValue);
}
