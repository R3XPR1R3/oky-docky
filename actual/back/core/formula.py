"""Safe expression evaluator used by programmable form variables."""
from __future__ import annotations

import ast
import math
from typing import Any, Dict, Set


class FormulaError(ValueError):
    pass


def _number(value: Any) -> float:
    if isinstance(value, bool): return float(value)
    if isinstance(value, (int, float)): return float(value)
    raw = str(value or "").strip().replace("$", "").replace(",", "")
    try: return float(raw)
    except ValueError: return 0.0


def _truthy(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() not in {"", "0", "false", "no", "off"}
    return bool(value)


def _format(value: Any) -> Any:
    if not isinstance(value, float) or not math.isfinite(value): return value
    rounded = round(value, 8)
    return str(int(rounded)) if rounded == int(rounded) else str(rounded)


def _call(name: str, args: list[Any]) -> Any:
    numbers = [_number(value) for value in args]
    if name == "percent" and len(numbers) == 2: return numbers[0] * numbers[1] / 100
    if name == "sum": return sum(numbers)
    if name == "avg": return sum(numbers) / len(numbers) if numbers else 0
    if name == "min": return min(numbers) if numbers else 0
    if name == "max": return max(numbers) if numbers else 0
    if name == "round" and 1 <= len(numbers) <= 2: return round(numbers[0], int(numbers[1]) if len(numbers) == 2 else 0)
    if name == "abs" and len(numbers) == 1: return abs(numbers[0])
    if name == "floor" and len(numbers) == 1: return math.floor(numbers[0])
    if name == "ceil" and len(numbers) == 1: return math.ceil(numbers[0])
    if name == "clamp" and len(numbers) == 3: return min(max(numbers[0], numbers[1]), numbers[2])
    if name == "ifelse" and len(args) == 3: return args[1] if _truthy(args[0]) else args[2]
    raise FormulaError(f"Unknown function or wrong arguments: {name}")


_FUNCTIONS = {"percent", "sum", "avg", "min", "max", "round", "abs", "floor", "ceil", "clamp", "ifelse"}
_CONSTANTS = {"true": True, "false": False}
_ALLOWED_NODES = (
    ast.Expression, ast.Constant, ast.Name, ast.Load, ast.UnaryOp, ast.UAdd, ast.USub, ast.Not,
    ast.BinOp, ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow,
    ast.Compare, ast.Eq, ast.NotEq, ast.Gt, ast.GtE, ast.Lt, ast.LtE,
    ast.BoolOp, ast.And, ast.Or, ast.Call,
)


def _parse(expression: str) -> ast.Expression:
    if not isinstance(expression, str) or not expression.strip(): raise FormulaError("Formula cannot be empty")
    if len(expression) > 500: raise FormulaError("Formula is too long")
    try: tree = ast.parse(expression.replace("^", "**"), mode="eval")
    except SyntaxError as exc: raise FormulaError(f"Invalid formula: {exc.msg}") from exc
    if sum(1 for _ in ast.walk(tree)) > 100: raise FormulaError("Formula is too complex")
    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED_NODES):
            raise FormulaError(f"Unsupported formula element: {type(node).__name__}")
        if isinstance(node, ast.Call) and (
            not isinstance(node.func, ast.Name) or node.func.id not in _FUNCTIONS or node.keywords
        ):
            raise FormulaError("Only documented formula functions are allowed")
    return tree


def _eval(node: ast.AST, values: Dict[str, Any]) -> Any:
    if isinstance(node, ast.Expression): return _eval(node.body, values)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float, str, bool)): return node.value
    if isinstance(node, ast.Name): return _CONSTANTS.get(node.id, values.get(node.id, 0))
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub, ast.Not)):
        value = _eval(node.operand, values)
        if isinstance(node.op, ast.Not): return not _truthy(value)
        return _number(value) if isinstance(node.op, ast.UAdd) else -_number(value)
    if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow)):
        left, right = _number(_eval(node.left, values)), _number(_eval(node.right, values))
        if isinstance(node.op, ast.Add): return left + right
        if isinstance(node.op, ast.Sub): return left - right
        if isinstance(node.op, ast.Mult): return left * right
        if isinstance(node.op, ast.Div): return 0 if right == 0 else left / right
        if isinstance(node.op, ast.Mod): return 0 if right == 0 else left % right
        return left ** right
    if isinstance(node, ast.Compare):
        left = _eval(node.left, values)
        for operator, comparator in zip(node.ops, node.comparators):
            right = _eval(comparator, values)
            if isinstance(operator, (ast.Eq, ast.NotEq)):
                ok = str(left) == str(right)
                if isinstance(operator, ast.NotEq): ok = not ok
            else:
                a, b = _number(left), _number(right)
                ok = ((isinstance(operator, ast.Gt) and a > b) or (isinstance(operator, ast.GtE) and a >= b)
                      or (isinstance(operator, ast.Lt) and a < b) or (isinstance(operator, ast.LtE) and a <= b))
            if not ok: return False
            left = right
        return True
    if isinstance(node, ast.BoolOp) and isinstance(node.op, (ast.And, ast.Or)):
        results = [_truthy(_eval(value, values)) for value in node.values]
        return all(results) if isinstance(node.op, ast.And) else any(results)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in _FUNCTIONS and not node.keywords:
        return _call(node.func.id, [_eval(arg, values) for arg in node.args])
    raise FormulaError(f"Unsupported formula element: {type(node).__name__}")


def evaluate_formula(expression: str, values: Dict[str, Any]) -> Any:
    return _format(_eval(_parse(expression), values))


def formula_dependencies(expression: str) -> Set[str]:
    tree = _parse(expression)
    return {node.id for node in ast.walk(tree) if isinstance(node, ast.Name) and node.id not in _FUNCTIONS | _CONSTANTS.keys()}
