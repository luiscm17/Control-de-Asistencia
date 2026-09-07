# 🏭 Factory Operations Suite

> **Sheets as UI, queryable DB behind it.** Zero infra — Google Sheets + Apps Script.

Monorepo of isolated factory domains. Each project under `apps-script/<project>/` is a standalone Apps Script deployment with its own database. Add a new domain without touching the existing ones.

## Projects

### 📋 Attendance Control
Consolidates daily attendance from N factory sections into a single `Registro` table. Validates every mark (`A`/`AT`/`BM`/`F`) and gives HR a filterable, auditable history — no more opening N sheets.

### 🧵 Yarn Production — Shift Report
Daily production by shift (DAY/AFTERNOON/NIGHT) across 9 textile processes. A reusable date-driven form feeds `datos_produccion` with calculated totals and explicit per-shift save.

### ⚙️ Spinning Settings — Assignments & Weighings
Plans output per spinning machine and logs actual weighings. Up to 10 assignments and 80 weighings per day go to `db_asignaciones` / `db_descargas` with net weight calculation and per-operator traceability.

---

**Why this stack?** The plant already runs on Sheets. This keeps the UX they know and adds a real DB behind it — validation, history, and permissions without external servers.

**Extensible.** New domains (quality, maintenance, logistics…) plug in as `apps-script/<new-project>/` with their PRD under `docs/<new-project>/`.

## Structure

```
apps-script/<project>/  # isolated GAS deployment
docs/<project>/         # PRDs and fixtures
openspec/               # specs and archived changes
```

> Technical details for contributors and agents: `AGENTS.md`.
