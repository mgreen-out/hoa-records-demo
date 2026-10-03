#!/bin/bash
# Serve the FAKE demo database with Datasette on http://localhost:8001
cd "$(dirname "$0")"
[ -f ../data/extracted.db ] || python3 ../data/generate_fake_data.py
uvx datasette ../data/extracted.db --port 8001 --cors \
  --setting max_returned_rows 20000 --setting sql_time_limit_ms 5000
