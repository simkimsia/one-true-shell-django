import json

from django.http import Http404, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from . import schema
from .models import Record


def _titles(entity):
    ent = schema.get(entity)
    return {r.rid: r.data.get(ent["title_field"], r.rid) for r in Record.objects.filter(entity=entity)}


def _client_schema():
    """What shell.js needs: entity definitions plus id/title options for every ref target."""
    ents = schema.entities()
    targets = {f["to"] for e in ents.values() for f in e["fields"].values() if f["type"] == "ref"}
    return {
        "entities": {
            k: {key: e[key] for key in ("key", "label", "plural", "fields", "title_field")} for k, e in ents.items()
        },
        "refs": {t: [{"id": i, "title": title} for i, title in _titles(t).items()] for t in targets},
    }


def _display(ent, data, ref_titles):
    """Secondary columns for a list row: every non-title field, refs shown by title."""
    cells = []
    for name, field in ent["fields"].items():
        if name == ent["title_field"]:
            continue
        value = data.get(name, "")
        if field["type"] == "ref":
            value = ref_titles.get(field["to"], {}).get(value, value)
        cells.append(value)
    return cells


def _shell(request, template, entity=None, **ctx):
    ents = schema.entities()
    counts = {k: Record.objects.filter(entity=k).count() for k in ents}
    return render(
        request,
        template,
        {
            "entities": [dict(e, count=counts[k]) for k, e in ents.items()],
            "current": ents.get(entity) if entity else None,
            "client_schema": _client_schema(),
            **ctx,
        },
    )


def _entity_or_404(entity):
    ent = schema.get(entity)
    if ent is None:
        raise Http404(f"No entity {entity!r}")
    return ent


def home(request):
    return _shell(request, "shell/home.html")


def entity_list(request, entity):
    ent = _entity_or_404(entity)
    ref_titles = {
        f["to"]: _titles(f["to"]) for f in ent["fields"].values() if f["type"] == "ref"
    }
    rows = [
        {
            "id": r.rid,
            "title": r.data.get(ent["title_field"], r.rid),
            "cells": _display(ent, r.data, ref_titles),
        }
        for r in Record.objects.filter(entity=entity)
    ]
    return _shell(request, "shell/list.html", entity, rows=rows)


def record(request, entity, rid):
    ent = _entity_or_404(entity)
    try:
        rec = Record.objects.get(entity=entity, rid=rid)
    except Record.DoesNotExist:
        raise Http404(f"No {entity}/{rid}")
    fields = []
    for name, field in ent["fields"].items():
        options = None
        if field["type"] == "enum":
            options = [{"id": v, "title": v} for v in field["values"]]
        elif field["type"] == "ref":
            options = [{"id": i, "title": t} for i, t in _titles(field["to"]).items()]
        fields.append({"name": name, "type": field["type"], "value": rec.data.get(name, ""), "options": options})
    return _shell(
        request,
        "shell/record.html",
        entity,
        record={"id": rid, "title": rec.data.get(ent["title_field"], rid)},
        fields=fields,
    )


def _payload(request):
    try:
        data = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


@require_POST
def api_create(request, entity):
    ent = _entity_or_404(entity)
    data = _payload(request)
    if data is None:
        return JsonResponse({"error": "body must be a JSON object"}, status=400)
    rid = str(data.pop("id", "") or "").strip()
    if not rid or not rid.replace("-", "").replace("_", "").isalnum() or len(rid) > 64:
        return JsonResponse({"error": "id must be 1-64 letters, digits, - or _"}, status=400)
    if Record.objects.filter(entity=entity, rid=rid).exists():
        return JsonResponse({"error": f"{entity}/{rid} already exists"}, status=409)
    clean, errors = schema.validate(ent, data)
    if errors:
        return JsonResponse({"errors": errors}, status=400)
    rec = Record.objects.create(entity=entity, rid=rid, data=clean)
    return JsonResponse(rec.as_dict(), status=201)


@require_POST
def api_update(request, entity, rid):
    ent = _entity_or_404(entity)
    data = _payload(request)
    if data is None:
        return JsonResponse({"error": "body must be a JSON object"}, status=400)
    data.pop("id", None)
    try:
        rec = Record.objects.get(entity=entity, rid=rid)
    except Record.DoesNotExist:
        return JsonResponse({"error": f"no {entity}/{rid}"}, status=404)
    clean, errors = schema.validate(ent, data, partial=True)
    if errors:
        return JsonResponse({"errors": errors}, status=400)
    rec.data = {**rec.data, **clean}
    rec.save(update_fields=["data"])
    return JsonResponse(rec.as_dict())
