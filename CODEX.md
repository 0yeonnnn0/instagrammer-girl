# Codex Runtime Guide

This repository supports running the content pipeline through Codex CLI.

When Codex is the selected provider, follow these rules:

1. Read [CLAUDE.md](./CLAUDE.md) first and treat it as the product workflow specification.
2. Execute the requested pipeline end-to-end inside this repository instead of returning only a plan.
3. Use repository scripts and outputs as the source of truth:
   - Research/copy artifacts: `workspace/`
   - Rendered assets: `output/`
   - Runtime scripts: `scripts/`
4. Keep the content strategy constraints from `CLAUDE.md`:
   - Reels and card news must use different topics.
   - Korean is primary, English is secondary where the template supports it.
   - Use the configured template/account/accent/tone values from the prompt or account settings.
5. If the instruction includes upload, upload only after generation artifacts are complete and valid.
6. Do not invent alternate file layouts or skip repository validation steps unless the request explicitly says so.

Operational expectation:

- For card news, produce `workspace/research.md`, `workspace/slides.json`, rendered PNGs, and caption output.
- For reels, produce `workspace/research.md`, `workspace/reels.json`, rendered PNGs/MP4, and caption output.
- Prefer existing scripts over ad-hoc implementations.
