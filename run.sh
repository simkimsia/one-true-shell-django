#!/usr/bin/env bash
# Reset data to schema/seed.json and serve on ${PORT:-8000} in the foreground (SPEC.md section 6).
set -euo pipefail
cd "$(dirname "$0")"

PYTHON="${PYTHON:-python3}"
if [ ! -x .venv/bin/python ]; then
  "$PYTHON" -m venv .venv
fi
.venv/bin/pip install -q --disable-pip-version-check -r requirements.txt

rm -f db.sqlite3
.venv/bin/python manage.py migrate -v 0
.venv/bin/python manage.py load_seed

exec .venv/bin/python manage.py runserver "0.0.0.0:${PORT:-8000}" --noreload --insecure
