import { getBins } from './api.js';
import socket from './socket.js';
const boxStatusGrid = document.getElementById('boxStatusGrid');

function renderBins(bins) {
  if (!bins || bins.length === 0) {
    boxStatusGrid.innerHTML = 'No bins found.';
    return;
  }
  boxStatusGrid.innerHTML = bins.map(bin => `
    <div class="bin-status">
      <h4>${bin.location}</h4>
      <p>Status: <b>${bin.status}</b></p>
      <div class="progress-bar"><div class="progress-bar-fill" style="width:${bin.level}%"></div></div>
      <p>Level: ${bin.level}%</p>
    </div>
  `).join('');
}

// Initial load
getBins().then(renderBins);

// Real-time update
socket.on('binStatusUpdate', (bin) => {
  // Re-fetch all bins for simplicity
  getBins().then(renderBins);
});
