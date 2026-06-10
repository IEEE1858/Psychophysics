// Summary statistics for the admin analytics dashboard (issue #24).
// Ignores null/undefined/non-finite values so unanswered selections don't skew
// the result. Standard deviation is the *sample* std (n - 1 denominator), the
// convention for study data; it is 0 when there is a single observation.
function summarize(values) {
  const nums = (values || [])
    .filter((value) => value != null && value !== "" && Number.isFinite(Number(value)))
    .map(Number);

  const n = nums.length;
  if (n === 0) {
    return { n: 0, min: null, max: null, mean: null, std: null };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const value of nums) {
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }
  const mean = sum / n;

  let std = 0;
  if (n > 1) {
    let squaredError = 0;
    for (const value of nums) {
      squaredError += (value - mean) ** 2;
    }
    std = Math.sqrt(squaredError / (n - 1));
  }

  return { n, min, max, mean, std };
}

module.exports = { summarize };
