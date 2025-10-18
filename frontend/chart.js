// Simple chart rendering using Chart.js CDN
export function renderBarChart(ctx, labels, data, label) {
  if (window.Chart) {
    new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label,
          data,
          backgroundColor: '#43a047',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true }
        }
      }
    });
  }
}
