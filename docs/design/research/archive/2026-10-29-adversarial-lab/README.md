# Adversarial lab historical archive

This archive preserves the original lab reports, fixture sources and recorded evidence before the lab was removed from the active workspace. The directory date identifies the evidence collection date; the archival working-tree HEAD is `f64eb1c392ffa0283db8a4c0a6f3ce1f0c082c52`. This HEAD does not by itself reproduce the uncommitted fixture state. The archived environment files retain each run's own HEAD, dirty paths, versions and source hashes.

- [archive.tar.gz](archive.tar.gz): 202 regular files, 6,235,063 uncompressed file bytes; original paths start with `adversarial-lab/`.
- [manifest.json](manifest.json): every original file's byte count and SHA-256, archive hash, normalized metadata, exclusions and verification results.
- [results-inventory.json](results-inventory.json): names, JSON pointers and stored green/red statuses from all 25 result JSON files, including phase 1, repeats, investigation and review snapshots. A red status means the original JSON contains `pass: false`; it is not a finding about today's framework.

The archive contains all 78 original result files (5,797,510 bytes), including logs, raw JSON, generated-code evidence and screenshots; both Ukrainian reports; `PLAN.md`, `REAL-SITES-PLAN.md`, `LAB-NOTES.md` and `README.md`; all 50 `src` files; all 9 original test runners; `run.mjs`, `serve.js`, Vite/TypeScript/package/Docker configuration; and all 7 Next control source/configuration files. Generated framework-agent instructions are retained as historical fixture context.

The compressed file is 4,476,776 bytes. Most input bytes are already compressed screenshots, including distinct phase-1 and later versions; preserving their exact bytes takes more space than preserving text reports alone.

Maintained replacements and intentionally historical cases are mapped in the [migration coverage ledger](../../2026-10-30-adversarial-migration.md). Current tests run from `examples/operations`; the original lab directory is retired.

## Reading the historical assertions

Original bytes have not been reformatted, corrected or reconciled. In particular, `REPORT.uk.md` retains earlier prose that describes produce/live failures and 36/49 passing expectations, while the later result JSON records those cases passing. `REPORT.phase1.uk.md` and `results/phase1/` preserve the earlier evidence separately. Use the specific snapshot and its environment metadata when interpreting a claim.

The original assertions include supported-API regressions, known design limits, application policy, explicit type escapes and competitor controls. They were intended to collect counterexamples; copying every assertion into passing CI would change their meaning. The archive and mechanical inventory do not choose which tests should become active CI.

- The array-length path probes deliberately cross Rivet's public `StorePath` typing through `src/probes.ts` and JavaScript runners. They are separate from the fully typed draft/produce regression.
- The original Async-after-SSR assertion describes a documented resumability limit; the page-handler/layout-guard assertion describes documented execution ordering. The latter has no equivalent Next authorization control.
- Sparse-array reconciliation also has a failing Solid control. A competitor's stored red is not a Rivet regression.
- React immutable-updater and async controls use idiomatic React APIs; they do not claim identical API semantics. The Next live-navigation control checks the page number and preserved draft.
- The fixture's synthetic SQLite service/session/tenant rules are application policy. Passing those assertions does not establish that Rivet supplies the policy or certify security. WebSocket coverage uses `ws` on the Node adapter's HTTP server.
- Investigation/review JSON and repeat runs are independent historical snapshots. Their rows must not be summed as unique product cases. Timing, input-delivery ordering and leak/performance/security certification limits remain in the original reports and notes.

## Exclusions and integrity

Excluded generated trees: `.artifacts`, `.rivet`, `dist`, `controls/next/.next`, and `controls/next/node_modules` (including its external dependency symlink). The original `.DS_Store` is excluded as OS metadata. Runtime databases and caches inside those generated trees are excluded. The manifest lists the precise excluded roots and their observed sizes/counts. No original report, result, test, fixture source or control source was excluded.

Tar members are sorted by POSIX path, use USTAR format, mode `0644`, zero UID/GID/mtime and empty owner names. Gzip uses an empty original filename, mtime zero and compression level 9. Two independently written archives were byte-identical. Every decompressed member was checked against both its manifest digest and the original working-tree bytes before removal; no audit or test suite was rerun to create this archive.

To verify the durable archive from the repository root without extracting it:

```sh
python3 - <<'PY'
from pathlib import Path
import hashlib, json, tarfile

root = Path('docs/design/research/archive/2026-10-29-adversarial-lab')
manifest = json.loads((root / 'manifest.json').read_text())
archive = root / manifest['archive']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['archiveSha256']
with tarfile.open(archive, 'r:gz') as source:
    members = source.getmembers()
    assert [m.name for m in members] == [f['path'] for f in manifest['files']]
    for member, expected in zip(members, manifest['files']):
        assert member.isfile()
        data = source.extractfile(member).read()
        assert len(data) == expected['bytes']
        assert hashlib.sha256(data).hexdigest() == expected['sha256']
        original = Path(expected['path'])
        if Path('adversarial-lab').exists():
            assert data == original.read_bytes()
assert len(members) == manifest['fileCount']
print(f"Verified {len(members)} archived files")
PY
```

To inspect original relative links and sources, extract into a separate temporary directory. Report links to framework files outside `adversarial-lab/` refer to the historical repository, not extra members of this archive.
