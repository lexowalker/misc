# The Federal Courts Atlas — reproducible data pipeline.
#   make setup   create .venv and install Python + Node deps
#   make data    rebuild every dataset from public sources into data/ and public/data/
#   make test    run pipeline unit tests
# Downloads are cached under data/raw/ (git-ignored); delete it to force a true from-scratch fetch.

PY ?= .venv/bin/python
export PYTHONPATH := $(CURDIR)

.PHONY: setup data test docs boundaries population fcms ussc idb judges courthouses cases web clean-processed

setup:
	python3 -m venv .venv
	$(PY) -m pip install -q -r requirements.txt
	npm install

# Order matters only where a lane reads another lane's output (noted per target).
data: boundaries population fcms ussc idb judges courthouses cases web docs

boundaries:            ## county->district assignment + district/state/county topology
	$(PY) -m pipeline.boundaries.build

population:            ## Census county population -> districts (needs boundaries)
	$(PY) -m pipeline.population.build

fcms:                  ## Federal Court Management Statistics
	$(PY) -m pipeline.fcms.build

ussc:                  ## U.S. Sentencing Commission datafiles
	$(PY) -m pipeline.ussc.build

idb:                   ## FJC Integrated Database (civil + criminal)
	$(PY) -m pipeline.idb.build

judges:                ## FJC Biographical Directory of Article III judges
	$(PY) -m pipeline.judges.build

courthouses:           ## places of holding court + geocoding (needs boundaries)
	$(PY) -m pipeline.courthouses.build

cases:                 ## CourtListener recent cases per district
	$(PY) -m pipeline.cases.build

web:                   ## assemble public/data/ for the site (needs all of the above)
	$(PY) -m pipeline.web.build

docs:                  ## SOURCES.md + DATA_GAPS.md from per-lane fragments
	$(PY) -m pipeline.build_docs

test:
	$(PY) -m pytest -q tests/pipeline
