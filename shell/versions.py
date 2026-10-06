"""Versions this implementation reports: its own, the spec it targets, and its stack."""

import platform
import sqlite3

import django
import yaml

from . import __shell_spec__, __version__

NAME = "one-true-shell-django"


def stack():
    """Versions of the running stack, read at runtime rather than from requirements.txt."""
    return {
        "python": platform.python_version(),
        "django": django.get_version(),
        "sqlite": sqlite3.sqlite_version,
        "pyyaml": yaml.__version__,
    }


def report():
    return {"implementation": NAME, "version": __version__, "spec": __shell_spec__, "stack": stack()}
