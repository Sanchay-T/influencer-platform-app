# TODO / Follow-ups

- Handle health cache: store reels-per-handle history to avoid re-requesting empty profiles.
- QStash worker: wrap the CLI in a job processor (payload → command) with concurrency guard.
- Monitoring: capture run summaries (keyword, runtime, reels, creators) in a datastore for dashboards.
- UI integration: surface AI rationales and US hints in the product for transparency.
- Optional: allow non-US support (toggle) by relaxing `isLikelyUS` and classifier threshold.
