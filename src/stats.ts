/**
 * Robust statistics used to make findings self-calibrating.
 *
 * Any threshold expressed as an absolute quantity — "engagement below 0.4%",
 * "a shot gaining more than 20 views a day" — is really a guess tuned to one
 * profile at one moment. Point the dashboard at an account ten times the size,
 * or at a brand new one, and the same number becomes either permanently true or
 * permanently false. Neither is a finding.
 *
 * So magnitudes are never compared against constants. They are compared against
 * the profile's own distribution, using median and median-absolute-deviation
 * rather than mean and standard deviation, because a single boosted day would
 * drag a mean far enough to hide everything around it.
 *
 * The one kind of constant that is legitimate here is a *sample count* — four
 * Saturdays is four Saturdays whatever the traffic — so those stay fixed and
 * are named as such at each call site.
 */

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Median absolute deviation, scaled so it is comparable to a standard
 * deviation for normally distributed data. Resistant to outliers, which daily
 * analytics is full of.
 */
export function mad(values: number[]): number {
  if (values.length === 0) return 0;
  const m = median(values);
  return 1.4826 * median(values.map((v) => Math.abs(v - m)));
}

/**
 * How unusual a value is against a sample, in robust standard deviations.
 * Returns null when the sample is too small or has no spread to judge against —
 * the caller should then stay silent rather than guess.
 */
export function robustZ(value: number, sample: number[], minSample = 5): number | null {
  if (sample.length < minSample) return null;
  const spread = mad(sample);
  if (spread <= 0) {
    // A perfectly flat history: only a change from it is notable, and only
    // relative to its own level.
    const m = median(sample);
    if (m === 0) return null;
    return (value - m) / Math.abs(m);
  }
  return (value - median(sample)) / spread;
}

/** Where a value sits in a sample, 0–1. */
export function percentileOf(value: number, sample: number[]): number {
  if (sample.length === 0) return 0.5;
  const below = sample.filter((v) => v < value).length;
  return below / sample.length;
}

/** Ratio expressed against a baseline, guarding division by zero. */
export function ratio(value: number, baseline: number): number | null {
  if (!isFinite(baseline) || baseline === 0) return null;
  return value / baseline;
}

/**
 * Rolling windows of an array of daily values, used to build the historical
 * distribution a current window is judged against.
 */
export function rollingSums(values: number[], windowSize: number): number[] {
  if (windowSize <= 0 || values.length < windowSize) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= windowSize) sum -= values[i - windowSize];
    if (i >= windowSize - 1) out.push(sum);
  }
  return out;
}
