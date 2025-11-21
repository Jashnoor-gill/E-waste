// Dashboard Charts and Visualizations
import { EWASTE_CATEGORIES } from './rewards.js';

// Create deposits over time chart
export function createDepositsChart(canvasId, events) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  // Group deposits by date
  const depositsByDate = {};
  events.filter(e => e.type === 'deposit').forEach(e => {
    const date = new Date(e.timestamp).toLocaleDateString();
    depositsByDate[date] = (depositsByDate[date] || 0) + (e.amount || 0);
  });
  
  const dates = Object.keys(depositsByDate).sort();
  const amounts = dates.map(date => depositsByDate[date]);
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'E-Waste Deposited (kg)',
        data: amounts,
        borderColor: '#43a047',
        backgroundColor: 'rgba(67, 160, 71, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Weight (kg)'
          }
        }
      }
    }
  });
}

// Create category breakdown pie chart
export function createCategoryChart(canvasId, categoryBreakdown) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  const categories = Object.keys(categoryBreakdown);
  const amounts = Object.values(categoryBreakdown);
  
  const colors = [
    '#43a047', '#66bb6a', '#81c784', '#a5d6a7',
    '#388e3c', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b'
  ];
  
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories.map(cat => EWASTE_CATEGORIES[cat]?.name || cat),
      datasets: [{
        data: amounts,
        backgroundColor: colors.slice(0, categories.length),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value}kg (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// Create impact comparison chart
// Impact chart removed: site now shows CO2 as a stat card only.

// Create progress ring (circular progress bar)
export function createProgressRing(percentage, size = 120) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  return `
    <div class="progress-ring">
      <svg width="${size}" height="${size}">
        <circle class="bg" cx="${size/2}" cy="${size/2}" r="${radius}"/>
        <circle class="progress" cx="${size/2}" cy="${size/2}" r="${radius}"
                style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}"/>
      </svg>
      <div class="progress-ring-text">
        ${percentage}%
      </div>
    </div>
  `;
}

// Collections over time chart for Collector
export function createCollectionsChart(canvasId, events) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const collectionsByDate = {};
  events.filter(e => e.type === 'collection').forEach(e => {
    const date = new Date(e.timestamp).toLocaleDateString();
    collectionsByDate[date] = (collectionsByDate[date] || 0) + (e.amount || 0);
  });

  const dates = Object.keys(collectionsByDate).sort();
  const amounts = dates.map(date => collectionsByDate[date]);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [{
        label: 'Collections (kg)',
        data: amounts,
        backgroundColor: 'rgba(25, 118, 210, 0.8)',
        borderColor: '#1976d2',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, title: { display: true, text: 'kg' } } }
    }
  });
}
