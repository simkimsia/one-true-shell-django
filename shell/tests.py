import json
import re
from io import StringIO

from django.conf import settings
from django.core.management import call_command
from django.test import SimpleTestCase

import shell
from shell import versions

REPO = settings.BASE_DIR


class VersionConstantsTests(SimpleTestCase):
    def test_version_is_exposed(self):
        """__version__ reports this implementation's version."""
        self.assertRegex(shell.__version__, r"^\d+\.\d+\.\d+$")

    def test_shell_spec_matches_everywhere_it_is_declared(self):
        """__shell_spec__ is the spec version this repo targets.

        Bumping it means re-copying schema/ from the contract tag and updating
        SPEC_REF in the conformance workflow and `spec:` in README.md.
        """
        self.assertEqual(shell.__shell_spec__, "0.2")
        workflow = (REPO / ".github/workflows/conformance.yml").read_text()
        self.assertRegex(workflow, rf"SPEC_REF: v{re.escape(shell.__shell_spec__)}\.\d+")
        self.assertIn(f"spec: {shell.__shell_spec__}\n", (REPO / "README.md").read_text())

    def test_stack_versions_match_pins(self):
        """The running stack is what requirements.txt pins, so the README and IMPLEMENTATIONS.md stay true."""
        pins = dict(line.split("==") for line in (REPO / "requirements.txt").read_text().split())
        stack = versions.stack()
        self.assertEqual(stack["django"], pins["Django"])
        self.assertEqual(stack["pyyaml"], pins["PyYAML"])
        self.assertTrue(stack["python"] and stack["sqlite"])


class VersionSurfacesTests(SimpleTestCase):
    def test_api_version(self):
        body = json.loads(self.client.get("/api/version").content)
        self.assertEqual(body["implementation"], "one-true-shell-django")
        self.assertEqual(body["version"], shell.__version__)
        self.assertEqual(body["spec"], shell.__shell_spec__)
        self.assertEqual(set(body["stack"]), {"python", "django", "sqlite", "pyyaml"})

    def test_api_version_is_read_only(self):
        self.assertEqual(self.client.post("/api/version").status_code, 405)

    def test_shell_version_command(self):
        out = StringIO()
        call_command("shell_version", stdout=out)
        lines = out.getvalue().splitlines()
        self.assertEqual(lines[0], f"one-true-shell-django {shell.__version__}")
        self.assertEqual(lines[1], f"spec {shell.__shell_spec__}")
        self.assertIn(f"django {versions.stack()['django']}", lines)
