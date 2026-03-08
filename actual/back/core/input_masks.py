"""
Input mask validation engine.

Mask characters:
  D  = digit (0-9)
  L  = letter (a-z, A-Z)
  A  = alphanumeric (digit or letter)
  *  = any character
  Any other character = literal (must match exactly)

Examples:
  "DDD-DD-DDDD"       → SSN  (123-45-6789)
  "DD-DDDDDDD"        → EIN  (12-3456789)
  "DDDDD"             → ZIP  (73102)
  "LL"                → State (TX)
  "(DDD) DDD-DDDD"   → Phone ((405) 555-1234)
"""
from __future__ import annotations

import re
from typing import Optional


_MASK_CHARS = {
    "D": r"\d",
    "L": r"[a-zA-Z]",
    "A": r"[a-zA-Z0-9]",
    "*": r".",
}


def mask_to_regex(mask: str) -> str:
    """Convert a mask pattern to a regex pattern."""
    pattern = "^"
    for ch in mask:
        if ch in _MASK_CHARS:
            pattern += _MASK_CHARS[ch]
        else:
            pattern += re.escape(ch)
    pattern += "$"
    return pattern


def validate_mask(value: str, mask: str) -> bool:
    """Check if value matches the given mask pattern."""
    if not mask:
        return True
    regex = mask_to_regex(mask)
    return bool(re.match(regex, value))


def format_with_mask(raw: str, mask: str) -> str:
    """
    Auto-format raw input according to mask.
    Extracts meaningful characters from raw and inserts literals from mask.
    """
    if not mask:
        return raw

    # Determine what chars are "input" positions vs literals
    raw_chars = list(raw)
    # Strip out any literal characters that match the mask to get pure input
    input_chars = []
    for ch in raw_chars:
        if ch.isdigit() or ch.isalpha():
            input_chars.append(ch)

    result = []
    input_idx = 0
    for mask_ch in mask:
        if input_idx >= len(input_chars):
            break
        if mask_ch in _MASK_CHARS:
            result.append(input_chars[input_idx])
            input_idx += 1
        else:
            result.append(mask_ch)

    return "".join(result)


def mask_max_length(mask: str) -> Optional[int]:
    """Return the maximum length of a formatted value for the given mask."""
    return len(mask) if mask else None
