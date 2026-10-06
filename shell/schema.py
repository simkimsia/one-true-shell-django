"""Entity definitions, loaded once from schema/entities.yaml."""

from functools import lru_cache

import yaml
from django.conf import settings


@lru_cache
def entities():
    with open(settings.SCHEMA_DIR / "entities.yaml") as f:
        raw = yaml.safe_load(f)["entities"]
    for key, ent in raw.items():
        ent["key"] = key
        ent["title_field"] = next(n for n, f in ent["fields"].items() if f.get("title"))
    return raw


def get(entity):
    return entities().get(entity)


def validate(ent, data, partial=False):
    """Return (clean, errors) for a create (partial=False) or update payload."""
    from .models import Record

    clean, errors = {}, {}
    for name, value in data.items():
        field = ent["fields"].get(name)
        if field is None:
            errors[name] = "unknown field"
            continue
        value = "" if value is None else str(value).strip()
        if field.get("required") and not value:
            errors[name] = "required"
        elif value and field["type"] == "enum" and value not in field["values"]:
            errors[name] = f"must be one of {', '.join(field['values'])}"
        elif value and field["type"] == "ref" and not Record.objects.filter(entity=field["to"], rid=value).exists():
            errors[name] = f"no {field['to']} with id {value}"
        else:
            clean[name] = value
    if not partial:
        for name, field in ent["fields"].items():
            if field.get("required") and not clean.get(name) and name not in errors:
                errors[name] = "required"
    return clean, errors
