from typing import Dict, Any, List

def _is_child(parent_id: str, child_id: str) -> bool:
    return child_id.startswith(parent_id + ".")

def normalize_schema_rects(schema: Dict[str, Any]) -> Dict[str, Any]:
    fields: List[Dict[str, Any]] = schema.get("fields", [])
    by_id = {f["id"]: f for f in fields}

    # 1) Найдём контейнеры у которых есть rects
    containers = [f for f in fields if f.get("rects")]

    # сортируем длинные id первее (более глубокие контейнеры должны раздать rects раньше)
    containers.sort(key=lambda f: len(f["id"]), reverse=True)

    for container in containers:
        cid = container["id"]
        rects = container.get("rects") or []
        if not rects:
            continue

        # 2) дети-кандидаты: у кого rects пустые и они внутри контейнера
        children = [
            f for f in fields
            if f["id"] != cid
            and _is_child(cid, f["id"])
            and not (f.get("rects") or [])
            and f.get("kind") in ("text", "button")  # важное
        ]

        # стабильно по id (обычно f1_01..f1_14 по алфавиту)
        children.sort(key=lambda f: f["id"])

        # 3) если rects по количеству совпадают с детьми — раздаём 1:1
        if len(children) == len(rects):
            for child, r in zip(children, rects):
                child["rects"] = [r]
        else:
            # мягкий режим: если rects больше/меньше — не ломаем,
            # можно потом допилить эвристику
            continue

    return schema
# Example usage: you can call normalize_schema_rects with a schema dictionary by importing this module. in to your code.    
