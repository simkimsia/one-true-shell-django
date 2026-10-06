from django.core.management.base import BaseCommand

from shell.versions import report


class Command(BaseCommand):
    help = "Print this implementation's version, the spec version it targets, and its stack versions."

    def handle(self, *args, **options):
        r = report()
        self.stdout.write(f"{r['implementation']} {r['version']}")
        self.stdout.write(f"spec {r['spec']}")
        for name, version in r["stack"].items():
            self.stdout.write(f"{name} {version}")
