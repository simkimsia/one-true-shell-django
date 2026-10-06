import json

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from shell import schema
from shell.models import Record


class Command(BaseCommand):
    help = "Replace all records with schema/seed.json."

    @transaction.atomic
    def handle(self, *args, **options):
        with open(settings.SCHEMA_DIR / "seed.json") as f:
            seed = json.load(f)
        Record.objects.all().delete()
        for entity in schema.entities():
            for row in seed.get(entity, []):
                row = dict(row)
                Record.objects.create(entity=entity, rid=row.pop("id"), data=row)
