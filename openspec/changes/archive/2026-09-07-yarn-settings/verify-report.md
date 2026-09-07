```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:aaef5e4e24e16e9c14836f24b31e521ad1e1ed373c5f8162a22ed8359a3d0e17
verdict: pass
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 8/8
test_command: "node VM harness loading Config/Ingest/Persistence/Errors/Core/Menu and four test files, plus no-saved-state F4/F5 hydration preservation check"
test_exit_code: 0
test_output_hash: sha256:2850b04000eabbf2188c04dc16a64f0d989de0c01293ced2aad4cede0656dfad
build_command: "node -e new Function parser over 10 Yarn Settings source and test files"
build_exit_code: 0
build_output_hash: sha256:8d837a93d315e70f7d733d2bcb3cb0669c688284461d4b9dd74ac43650041b88
```

## Verification Report

**Change**: yarn-settings  
**Mode**: Standard / Both

### Completeness
| Metric | Value |
|---|---:|
| Tasks total | 12 |
| Tasks complete | 12 |
| Tasks incomplete | 0 |

### Build & Tests Execution
- Build: PASS — 10 Apps Script source and test files parsed; exit 0.
- Tests: PASS — 19 VM checks: 7 Ingest, 8 Persistence, 3 Core, and Menu assertions; exit 0.
- Date-change preservation: PASS — an additional VM hydration check verified that an F4/F5 selection with no saved state performs no grid write or clear.
- Coverage: Not configured.

### Spec Compliance Matrix
| Requirement | Scenarios | Runtime evidence | Result |
|---|---:|---|---|
| Settings Date, Standards, and Persistence Boundary | 2 | Ingest VM checks; no-saved-state F4/F5 hydration preservation check | COMPLIANT |
| Explicit Save Entry Points and Serialization | 1 | Core/Menu VM checks | COMPLIANT |
| Assignment Snapshot Upsert and Audit | 1 | Persistence VM checks | COMPLIANT |
| Variable Weighing Snapshot and Net Weight | 3 | Persistence VM checks | COMPLIANT |
| Save Feedback and Failure Evidence | 1 | Core VM checks | COMPLIANT |

### Correctness
| Check | Result |
|---|---|
| I8 hybrid checkbox and Yarn menu | PASS |
| F4/F5 incomplete or new selection preserves grids | PASS |
| 14/16-column turno-aware PKs | PASS |
| Lock retry, rollback, and Errors evidence | PASS |
| Isolated yarn-settings implementation | PASS |

### Design Coherence
| Decision | Result |
|---|---|
| Validate before lock; reload state under lock | PASS |
| Script-computed net weight and indexed mutation plan | PASS |
| Compensation rollback and isolated module | PASS |
| I8 checkbox plus menu hybrid | PASS |

### Manual Verification Context
Task 4.1 and apply-progress record passed manual verification on the user-provided authenticated workbook: save/re-save, 0–80 variable weighings, EC-03 deletion, audit fields, I8 auto-uncheck, formula preservation, and module isolation.

### Issues Found
**CRITICAL**
- None.

**WARNING**
- None.

### Verdict
PASS

All 12 tasks are complete. Runtime evidence covers all 5 requirements and 8 scenarios; the F4/F5 handler now returns without clearing form grids when there is no saved composite-key state.
