# Copilot Instructions

These instructions define how Copilot Chat and coding-agent mode should operate in this repository.

## Scope and Source of Truth

- Treat `AGENTS.md` and `CLAUDE.md` as canonical project guidance.
- This file consolidates those docs plus relevant `.claude/skills` constraints.
- If instructions conflict, prioritize:
  1. Explicit user request.
  2. `AGENTS.md`.
  3. `CLAUDE.md`.
  4. This file.

## Project Overview

Fiber photometry analysis pipeline for GRAB-DA devaluation experiments.

- Inputs: H5 neural recordings + MED-PC behavioral files.
- Deterministic pipeline: `fiber.regenerate_results`.
- Figures generated from scripts in `fiber/figures/`.

Architecture:

```text
fiber/config.py (parameters)
        |
manifests/manifest.json -> fiber.regenerate_results -> results/ (Parquet, NPZ)
                                                           |
                                                   fiber/figures/ -> results/figures/
```

## Repository Layout

- `fiber/`
  - `fiber/config.py`: pipeline config (`PipelineConfig`, `Comparison`, `COMPARISONS`, `get_paths()`)
  - `fiber/core/`: processing/analysis logic
  - `fiber/io/`: dataset + manifest loaders
  - `fiber/plotting/`: plotting helpers
  - `fiber/qc/`: QC scripts
  - `fiber/figures/`: figure scripts
- `manifests/`
  - `manifest.json`: canonical dataset/session registry
  - `figure_manifest.json`: figure provenance registry
  - `experiments_spec.json`, `findings.json`, `findings_spec.json`
- `results/`: Parquet/NPZ outputs
- `results/figures/`: PNG outputs
- `docs/`, `notebooks/`: docs and exploration
- `tests/`: pytest suite

## Environment and Commands

Assume conda env `lumos`.

Setup:

```bash
./setup.sh
conda activate lumos
pip install -e .
```

Quality checks:

```bash
conda run -n lumos ruff check .
conda run -n lumos pytest tests/
```

Pipeline:

```bash
conda run -n lumos python -m fiber.regenerate_results
```

Common figure commands:

```bash
conda run -n lumos python -m fiber.figures.psth_overlay
conda run -n lumos python -m fiber.figures.coverage_table
conda run -n lumos python -m fiber.figures.rat_paired
conda run -n lumos python -m fiber.figures.time_series_stats
conda run -n lumos python -m fiber.figures.deval_date_matched_cluster_perm
conda run -n lumos python -m fiber.figures.deval_matched_baseline
conda run -n lumos python -m fiber.figures.deval_matched_time_series
conda run -n lumos python -m fiber.figures.fr5_rat_diagnostics
conda run -n lumos python -m fiber.figures.fr5_time_trends
conda run -n lumos python -m fiber.figures.mode_robustness
```

QC validation:

```bash
conda run -n lumos python -m fiber.figures.raw_vs_z
```

## Collaboration and Git Safety (Multi-Agent Repo)

Before editing:

- Inspect local state (`git status`, `git diff`) and work in explicit scope.
- Touch only files required for the task.
- Preserve other contributors' changes.

Never do destructive cleanup unless the user explicitly asks:

- `git reset --hard`
- `git checkout -- <path>`
- `git restore .` for discarding changes
- `git clean -fd` / `git clean -fdx`
- `git push --force`

If unexpected concurrent edits create conflict risk, stop and ask the user.

## Manifest and Data Discipline

Manifest-backed analysis is mandatory.

- `manifests/manifest.json` is the authoritative session index.
- Do not add directory-globbing discovery as a substitute for manifest updates.
- Keep IDs/keys stable and unique.
- Use repo-relative paths only (no absolute paths).
- Use explicit missing markers consistent with existing schema.
- Do not silently change schema/contracts.

When creating new figures/artifacts:

- Save figures to `results/figures/` as PNG.
- Save tabular outputs to `results/` as Parquet.
- Append/update `manifests/figure_manifest.json` with script, inputs, outputs.

## Coding Standards

- Python 3.10+.
- Follow `ruff` config in `pyproject.toml` (line length 120).
- Prefer clear names and small composable functions.
- Use `pathlib` and repo-relative paths.

Type safety:

- Add/maintain precise type hints for new/changed code.
- Prefer modern hints (`X | None`) and concrete collection types.
- Never silence typing with `# type: ignore` or broad `Any` casts.

Defensive coding policy:

- Validate contracts at boundaries (CLI/file loader/API input).
- Keep one explicit happy path in core logic.
- Fail fast when invariants break.
- Do not add speculative fallbacks that hide errors.
- Avoid broad `try/except`; catch narrow exception types only when adding actionable context or explicit recovery.

## Scientific and Statistical Rigor

For analysis, interpretation, and scientific outputs:

- Use real project data unless user explicitly asks for synthetic data.
- Keep analysis deterministic (set seeds, avoid nondeterministic steps).
- State metric meaning, units, directionality, and biological interpretation.
- Reference exact data source/subset for claims (file/table/module + cohort/group/timepoint).
- Quantify uncertainty (CI/SEM/IQR/effect size as appropriate).
- Flag anomalies explicitly; do not silently proceed through contradictory results.
- Calibrate claims to evidence strength (avoid overclaiming).

Statistical defaults (unless project-specific method overrides):

- Two-group: Welch's t-test; use nonparametric fallback when assumptions fail.
- Multiple comparisons: Holm-Bonferroni.
- Report test statistic, df where relevant, p-value, effect size, and per-group N.

## Figure and Data Presentation Rules

Every figure should show meaningful structure, not summary-only bars.

- Include at least two of: distribution/shape, uncertainty, structure/relationships.
- Prefer raw points + distribution summaries over bar-only plots.
- Include axis labels, units, sample sizes, and colorbar labels where relevant.
- Keep legends/colorbars from obscuring data.

Prismatica usage (when used in this repo):

- Use `with pz.context("S1"):` (or `pz.use("S1")`) as default styling.
- Prefer `pz.legend(...)` / `pz.legend_outside(..., side="auto")`.
- Prefer `pz.colorbar(..., side="auto")` for continuous mappables.
- Avoid over-styling if defaults already satisfy requirements.

## Notebook Editing Rules

When editing `.ipynb`:

- Use `nbformat`, not ad-hoc JSON text edits.
- Target cells by id/tag/sentinel text before index.
- Validate notebook before writing.
- Preserve intended metadata/outputs unless user asks to change output policy.

## Domain Conventions

- TTL channel is press-aligned event channel.
- Under FR5, only every 5th press is reinforced.
- Event subsets:
  - `"press"`: all presses
  - `"reinforced_press"`: reward-paired presses
- QC must be outcome-independent (never filter by effect direction).

H5 structure reference:

- `d1`: raw photometry signal
- `d2`: TTL/event channel
- `events/ttl/event_times_s`
- `medpc/Y/times_mapped_s`
- `medpc/K/times_mapped_s`
- `acquisition/sampling_rate_hz`, `acquisition/duration_s`

## Testing and Validation Expectations

For code changes:

- Run the smallest relevant validation first, then broader checks as needed.
- Minimum expected checks when feasible:
  - `conda run -n lumos ruff check .`
  - `conda run -n lumos pytest tests/`
- If checks are skipped, state exactly what was not run and why.

## Commit/PR Guidance

- Commit messages: short, imperative, scoped.
  - Examples: `Add ...`, `Fix ...`, `Refactor ...`
- Avoid mixing unrelated changes.
- Never mention AI tooling in commit messages.
- PRs should summarize intent, key files changed, and representative output paths.

## Done Checklist

- Work is manifest-consistent and reproducible.
- No destructive git actions used.
- No unrelated files modified.
- Results/figures saved to canonical locations and manifest updated if needed.
- Lint/tests run (or explicitly documented as not run).
- Scientific claims are interpretable and appropriately calibrated.
