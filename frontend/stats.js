import { getStats } from './api.js';
import { renderBarChart } from './chart.js';
getStats().then(stats => {
  if (!stats) {
    document.getElementById('stats').innerHTML = 'No stats found.';
    return;
  }
  document.getElementById('stats').innerHTML = `
    <ul>
      <li>Total E-Waste Collected: <b>${stats.totalEwaste || 0} kg</b></li>
      <li>Bins in Network: <b>${stats.totalBins || 0}</b></li>
      <li>Registered Users: <b>${stats.totalUsers || 0}</b></li>
      <li>CO₂ Saved: <b>${stats.co2Saved || 0} kg</b></li>
    </ul>
  `;
  // Render chart
  const ctx = document.getElementById('statsChart').getContext('2d');
  renderBarChart(ctx,
    ['E-Waste', 'Bins', 'Users', 'CO₂ Saved'],
    [stats.totalEwaste || 0, stats.totalBins || 0, stats.totalUsers || 0, stats.co2Saved || 0],
    'Impact Stats'
  );
});