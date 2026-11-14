# Verification — 2026-11-14

## Executed numerical checks

14 Node tests pass. Coverage includes direct-DFT parity for FFT sizes 8/16/32/64, known sine-wave power and peak, DC removal, Nyquist scaling, missing-segment exclusion, half-open band boundaries, unavailable bands, short windows, CSV units and missing samples, classic EDF calibration, signed decoding, unknown record counts and rejected unsupported formats.

An independent SciPy 1.15.3 / NumPy 2.2.6 comparison passed on 12 finite deterministic signals across 100/128/256/512 Hz and target segment durations of 1/2/4 s. Every frequency bin and density value was compared (rtol 1e-9, atol 1e-10). The maximum absolute density error was approximately 5.68e-13 µV²/Hz. The full machine-readable results and engine SHA-256 are in `scipy-comparison.json`.

The system NumPy installation initially failed due to an architecture mismatch. A separate temporary venv with pinned wheels was used; no system packages were modified. This parity check covers finite synthetic inputs, not missing-data policy or physical EEG validity. Missing data policy has separate deterministic tests.

## Browser checks

Chrome desktop 1500×1080 and mobile 390×844 passed: expected demo peak, channel selection, window navigation, pinned spectral reference, missing-data flags, escaped user notes, JSON exports, CSV import, rejected malformed EDF without losing the current recording, methods dialog, and document-width checks. Screenshots inspected. Trace/channel areas intentionally scroll horizontally on mobile. Network capture showed only same-origin GET requests during the workflows, with no recording upload or external request.

## Scope and limitations

All fixtures are synthetic. No measured dataset, physiological/clinical validation, device connection, or human study. Classic EDF parsing is tested against synthetic byte fixtures; no independent third-party EDF reader comparison was executed. EDF+ is explicitly unsupported. No source localization, brain-state inference, significance test, artifact correction, ICA, reference transforms, or resampling. Missing segments are excluded and may bias the PSD.

Figma creation and library discovery succeeded, but the Starter MCP tool limit blocked the composed design. The website was implemented and browser-tested; the Figma screen remains unfinished. No plan or permission changes were made.
