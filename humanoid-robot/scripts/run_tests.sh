#!/usr/bin/env sh
cd "$(dirname "$0")/.." && python3 -m unittest discover -s tests -t . -v
