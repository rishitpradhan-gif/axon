# Axon

A browser-local EEG signal inspection workbench. Explore raw channels, select time windows, pin a spectral reference, review missing data and amplitude flags, and export reproducible analysis metadata.

Live: https://rp-axon.vercel.app

## Run

Node 22 or later; no runtime dependencies or API keys:

```sh
npm start
# http://127.0.0.1:4460
npm test
```

Download `public/axon-source.zip`, unzip, and run inside the `axon` directory. Rebuild the ZIP with `python3 scripts/package.py`.

## Inputs and limits

- **CSV:** first line is unique channel names, then simultaneous numeric samples. No timestamp column or quoted fields. Declare the sampling frequency (1–100000 Hz) and unit (uV/µV/μV, mV, V). Blanks and NaN remain missing; no interpolation. One optional final newline is ignored, additional blank rows remain missing samples. Only LF/CRLF line endings are supported.
- **Classic EDF:** version 0, 16-bit signed little-endian samples, continuous records. Each channel uses its own declared sample rate and physical/digital affine calibration. Unknown record count (-1) is inferred only from complete data records. Inverted physical gain is supported. All channels must have voltage dimensions (uV, mV, V). Up to 32 channels and four million total samples, within a 32 MiB input limit.
- **Not supported:** EDF+, discontinuous recordings, annotation channels, BDF, non-voltage EDF channels, live devices, resampling, montage/reference transformations, filtering or artifact repair. Unsupported formats are explicitly rejected.

Acquisition prefilters and original references remain as supplied. Patient identity, recording identification and date fields are not retained from EDF. Filenames, channel labels and user notes can still identify a subject; inspect exports before sharing.

## Numerical method

`public/engine.mjs` is a standalone JavaScript module usable from Node and the browser:

```js
import {parseEDF, analyzeChannel} from './public/engine.mjs';
import {readFileSync} from 'node:fs';
const b = readFileSync('recording.edf');
const data = parseEDF(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const result = analyzeChannel(data.channels[0], 0, 8, {
  segmentSeconds: 2, threshold: 150
});
console.log(result.spectrum, result.flags);
```

Welch PSD uses a radix-2 FFT, periodic Hann window, per-segment mean removal, 50% overlap, and arithmetic mean of one-sided periodograms. Density normalization divides squared FFT magnitude by `fs × sum(window²)`; interior bins are doubled, DC and Nyquist are not. Units are µV²/Hz.

Segment length is the largest power of two no larger than target duration × sample rate, selected sample count, and 8192. A target or window below eight samples yields no UI spectrum. Actual segment duration, frequency spacing, segment counts and unconsumed tail are reported. Any segment touching a missing sample is excluded in full. This can bias estimates when missingness is nonrandom; there is no imputation or confidence estimate.

Band power uses rectangular bin summation `sum(PSD × df)` on half-open bins: delta [1,4), theta [4,8), alpha [8,13), beta [13,30), gamma [30,45) Hz. A band extending above Nyquist, or containing no frequency-bin centers at the actual resolution, is unavailable. Meter lengths divide each available band by the sum of available band powers, not total recording power. Band limits are project conventions, not universal physiological categories. The peak is the maximum positive-density bin in the inclusive 1–min(45, Nyquist) Hz range. It is descriptive only.

AC RMS subtracts the selected window's finite-sample mean. Absolute amplitude excursions use a user-specified threshold (default 150 µV). EDF rail checks count samples exactly at declared digital extrema; CSV has no ADC-rail information. Near-constant samples trigger a heuristic flag. These checks neither establish artifacts nor diagnose a neurological condition.

## Display

Raw traces use min–max envelopes per display bin. Bins containing missing values are gaps. Display values are vertically clipped at the selected scale; source data is unchanged. The spectrum uses dB relative to 1 µV²/Hz with a −120 dB display floor. Analyses and exported density remain in linear units. Pinned references retain their own channel, time window, FFT settings and source identity; comparing different settings has different resolution and is not a significance test.

## Reproducibility and privacy

The synthetic demo is seeded (713), with documented oscillations, a transient, a 50 Hz burst and a missing interval. It is not a measured EEG recording. `public/example.csv` is an eight-second sample of this fixture at 256 Hz in µV.

All processing runs in browser memory; no recording upload, tracking, browser persistence or external requests. The hosting provider receives ordinary page requests. Export before closing. Analysis JSON includes engine version, file hash or demo seed, sample bounds, calibration, channel metadata, settings, spectrum, flags, pinned reference and notes. It excludes raw samples and cannot reconstruct the recording; retain the original file separately. Hashes detect differences, not authenticity. No clinical interpretation, brain-state classifier, significance test or experimental validation is claimed.

## Verification

- `npm test`: FFT vs an independent direct DFT, analytical sine power, DC/Nyquist handling, missing segments, band boundaries, short windows, CSV parsing, and calibrated EDF edge cases.
- `scripts/compare-scipy.py`: executed comparison against SciPy 1.15.3 / NumPy 2.2.6 for 12 deterministic signals, varying sample rates and segment durations. Pinned optional dependencies are in `scripts/requirements-validation.txt`. Results are in `docs/scipy-comparison.json`.
- `node tests/browser.cjs`: Chrome/Playwright browser workflow; uses separately installed test tooling, not a runtime dependency. `AXON_URL` selects the production URL.

Primary references: [EDF specification](https://www.edfplus.info/specs/edf.html), [EDF+ differences](https://www.edfplus.info/specs/edfplus.html), [SciPy Welch method](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.welch.html).

## Design status

The interface uses a light, waveform-centered workspace, lavender signal traces, a shared ruler, channel rail and pinned spectral overlays. A Figma project was created at https://www.figma.com/design/2p2ZZVMroM2WkiiWfx1g2m, but Figma's Starter MCP tool limit blocked composition. No completed Figma design is claimed. The implemented interface is independently browser-tested. See `docs/figma-status.json` for the continuation context.
