// ApexHorizon — Client-side Monte Carlo Financial Architecture Engine
// 100% privacy-absolute. No network calls for user data.

const $ = id => document.getElementById(id);

let chartInstance = null;

function gaussianRandom(mean = 0, std = 1) {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * std + mean;
}

function runSimulation() {
  const currentAge = +$('currentAge').value;
  const retireAge = +$('retireAge').value;
  const portfolio = +$('portfolio').value;
  const contribution = +$('contribution').value;
  const returnRate = +$('returnRate').value / 100;
  const volatility = +$('volatility').value / 100;
  const inflation = +$('inflation').value / 100;
  const swr = +$('swr').value / 100;
  const sims = Math.min(5000, Math.max(100, +$('sims').value));

  if (retireAge <= currentAge) {
    alert('Retirement age must be greater than current age.');
    return;
  }

  const yearsToRetire = retireAge - currentAge;
  const retirementYears = 40; // model to age 100-ish
  const totalYears = yearsToRetire + retirementYears;

  const paths = [];
  const terminalWealth = [];

  for (let s = 0; s < sims; s++) {
    let wealth = portfolio;
    const path = [wealth];

    // Accumulation phase
    for (let y = 0; y < yearsToRetire; y++) {
      const realReturn = gaussianRandom(returnRate, volatility);
      wealth = wealth * (1 + realReturn) + contribution;
      path.push(Math.max(0, wealth));
    }

    // Decumulation phase
    const startWithdrawal = wealth * swr;
    for (let y = 0; y < retirementYears; y++) {
      const realReturn = gaussianRandom(returnRate, volatility);
      const withdrawal = startWithdrawal * Math.pow(1 + inflation, y);
      wealth = wealth * (1 + realReturn) - withdrawal;
      path.push(Math.max(0, wealth));
    }

    paths.push(path);
    terminalWealth.push(wealth);
  }

  // Analysis
  terminalWealth.sort((a, b) => a - b);
  const successCount = terminalWealth.filter(w => w > 0).length;
  const successRate = (successCount / sims * 100).toFixed(1);
  const median = terminalWealth[Math.floor(sims * 0.5)];
  const p10 = terminalWealth[Math.floor(sims * 0.1)];
  const p90 = terminalWealth[Math.floor(sims * 0.9)];

  $('successRate').textContent = successRate + '%';
  $('medianWealth').textContent = formatMoney(median);
  $('p10').textContent = formatMoney(p10);
  $('p90').textContent = formatMoney(p90);

  // Prepare chart data — sample of paths + median band
  const labels = Array.from({ length: totalYears + 1 }, (_, i) => currentAge + i);
  const medianPath = [];
  const p10Path = [];
  const p90Path = [];

  for (let t = 0; t <= totalYears; t++) {
    const values = paths.map(p => p[t] || 0).sort((a, b) => a - b);
    medianPath.push(values[Math.floor(sims * 0.5)]);
    p10Path.push(values[Math.floor(sims * 0.1)]);
    p90Path.push(values[Math.floor(sims * 0.9)]);
  }

  // Sample 15 paths for visualization
  const samplePaths = [];
  const step = Math.max(1, Math.floor(sims / 15));
  for (let i = 0; i < sims; i += step) {
    samplePaths.push(paths[i]);
  }

  renderChart(labels, samplePaths, medianPath, p10Path, p90Path, yearsToRetire);

  // Insights
  const insights = generateInsights(successRate, median, p10, yearsToRetire, contribution, portfolio);
  $('insights').innerHTML = insights;

  $('results').hidden = false;
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatMoney(n) {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(n).toLocaleString();
}

function generateInsights(success, median, p10, years, contrib, portfolio) {
  let html = `<strong>Horizon Analysis</strong><br>`;
  if (+success > 85) {
    html += `Your architecture shows strong resilience (${success}% success). Sequence-of-returns risk is manageable under these parameters.`;
  } else if (+success > 60) {
    html += `Moderate confidence (${success}%). Consider increasing annual contribution by 15-20% or extending work years to improve tail outcomes.`;
  } else {
    html += `Elevated risk profile (${success}% success). The 10th percentile outcome is fragile. Prioritize higher savings rate or lower withdrawal assumptions.`;
  }
  html += `<br><br>Median terminal wealth: ${formatMoney(median)}. Lower tail (p10): ${formatMoney(p10)}.`;
  html += `<br>All modeling is real (inflation-adjusted) returns. Volatility captures sequence risk.`;
  return html;
}

function renderChart(labels, samplePaths, median, p10, p90, retireYearIndex) {
  const ctx = $('chart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  const datasets = samplePaths.map((path, i) => ({
    label: `Path ${i+1}`,
    data: path,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    pointRadius: 0,
    fill: false,
    tension: 0.1
  }));

  datasets.push({
    label: 'Median',
    data: median,
    borderColor: '#3b82f6',
    borderWidth: 2.5,
    pointRadius: 0,
    fill: false,
    tension: 0.15
  });

  datasets.push({
    label: '10th–90th Band',
    data: p90,
    borderColor: 'transparent',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    fill: '-1',
    pointRadius: 0,
    tension: 0.15
  });

  datasets.push({
    label: 'p10',
    data: p10,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    pointRadius: 0,
    fill: false
  });

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => formatMoney(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Age', color: '#8b95a5' },
          ticks: { color: '#8b95a5', maxTicksLimit: 12 },
          grid: { color: 'rgba(42,49,64,0.5)' }
        },
        y: {
          title: { display: true, text: 'Portfolio Value (real $)', color: '#8b95a5' },
          ticks: {
            color: '#8b95a5',
            callback: v => formatMoney(v)
          },
          grid: { color: 'rgba(42,49,64,0.5)' }
        }
      }
    }
  });
}

$('run').addEventListener('click', runSimulation);
$('reset').addEventListener('click', () => {
  $('results').hidden = true;
  if (chartInstance) chartInstance.destroy();
});

// Persist inputs
['currentAge','retireAge','portfolio','contribution','returnRate','volatility','inflation','swr','sims'].forEach(id => {
  const el = $(id);
  const saved = localStorage.getItem('apex_' + id);
  if (saved) el.value = saved;
  el.addEventListener('change', () => localStorage.setItem('apex_' + id, el.value));
});

console.log('ApexHorizon engine ready. Sovereign mode active.');