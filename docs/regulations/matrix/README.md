# Regulation Requirement Matrix

## Purpose

This directory contains the machine-readable comparison matrix for privacy regulation requirements researched by Rift-CMP.

The matrix is a research and specification artifact, not legal advice.

## Files

- `requirements.csv` — tabular representation for inspection, analysis, and spreadsheet workflows.
- `requirements.json` — structured representation for programmatic processing.
- `../schemas/requirement.schema.json` — schema for individual requirement records.

## Design Principles

The matrix must support requirements that vary by:

- regulation
- jurisdiction
- effective date
- legal version
- policy interpretation version
- applicability trigger
- covered actor
- entity type
- processing purpose
- data category
- processing context
- legal basis
- consent conditions
- withdrawal requirements
- opt-out rights
- sensitive/special data
- children or age conditions
- exceptions
- sector conditions
- international transfers
- vendor/controller/processor relationships
- sale, sharing, and targeted advertising
- enforcement requirements

## No Boolean-Only Legal Model

Do not interpret a requirement using only:

```text
consent_required = true