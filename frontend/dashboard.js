async function renderBinUserDashboard() {
  // Fetch bins for dropdown
    const bins = await getBins(); // Fetch bins for dropdown
  dashboardContent.innerHTML = `<h3>Bin User Dashboard</h3>
    <button id="openDepositModal" class="btn">Deposit E-Waste</button>
    <div id="history">Loading history...</div>
    <div id="impact">Loading impact...</div>`;
  // Fetch and show event history
  const events = await getEvents();
  const userEvents = events.filter(e => e.type === 'deposit'); // Simulate user filter
  document.getElementById('history').innerHTML =
    '<b>Deposit History:</b><ul>' +
    userEvents.map(e => `<li>${e.amount}kg at bin ${e.bin?.location || e.bin} (${new Date(e.timestamp).toLocaleString()})</li>`).join('') +
    '</ul>';
  // Fetch and show impact
  const stats = await getStats();
  document.getElementById('impact').innerHTML = `<b>Your Impact:</b> <br>Total Deposited: ${userEvents.reduce((a, e) => a + (e.amount || 0), 0)} kg<br>CO₂ Saved: ${stats?.co2Saved || 0} kg`;
  // Modal logic
  const depositModal = document.getElementById('depositModal');
  const openDepositModalBtn = document.getElementById('openDepositModal');
  const closeDepositModalBtn = document.getElementById('closeDepositModal');
  const binSelectModal = document.getElementById('binSelectModal');
  const depositFormModal = document.getElementById('depositFormModal');
  const amountInputModal = document.getElementById('amountInputModal');

  // Populate bin dropdown in modal
  binSelectModal.innerHTML = '<option value="">Choose a bin</option>' + bins.map(b => `<option value="${b._id}">${b.location} (${b.status})</option>`).join('');

  openDepositModalBtn.onclick = () => { depositModal.style.display = 'flex'; };
  closeDepositModalBtn.onclick = () => { depositModal.style.display = 'none'; };
  depositModal.onclick = (e) => { if (e.target === depositModal) depositModal.style.display = 'none'; };

  depositFormModal.onsubmit = async (e) => {
    e.preventDefault();
    const binId = binSelectModal.value;
    const amount = amountInputModal.value;
    if (!binId || !amount || Number(amount) <= 0) {
      alert('Please select a bin and enter a valid amount.');
      return;
    }
    await fetch('http://localhost:5000/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'deposit', amount: Number(amount), bin: binId })
    });
    alert('Deposit recorded!');
    depositModal.style.display = 'none';
    renderBinUserDashboard();
  };
document.getElementById('adminTab').onclick = () => {

// ...existing code...

const dashboardContent = document.getElementById('dashboardContent');

// Helper to render Collector dashboard
async function renderCollectorDashboard() {
  // Fetch bins for dropdown
  const bins = await getBins(); // Fetch bins for dropdown
  dashboardContent.innerHTML = `<h3>Collector Dashboard</h3>
    <button id="openCollectModal" class="btn">Mark Bin as Collected</button>
    <div id="collections">Loading collections...</div>
    <div id="pcb">
      <b>PCB Recycling Workflow</b><br>
      <button id="startPcbBtn">Start PCB Recycle</button>
      <div id="pcbStatus">No active workflow.</div>
    </div>`;
  // Fetch and show collection events
  const events = await getEvents();
  const collections = events.filter(e => e.type === 'collection');
  document.getElementById('collections').innerHTML =
    '<b>Collections:</b><ul>' +
    collections.map(e => `<li>${e.amount}kg from bin ${e.bin?.location || e.bin} (${new Date(e.timestamp).toLocaleString()})</li>`).join('') +
    '</ul>';
  // Modal logic
  const collectModal = document.getElementById('collectModal');
  const openCollectModalBtn = document.getElementById('openCollectModal');
  const closeCollectModalBtn = document.getElementById('closeCollectModal');
  const collectBinSelectModal = document.getElementById('collectBinSelectModal');
  const collectFormModal = document.getElementById('collectFormModal');
  const collectAmountInputModal = document.getElementById('collectAmountInputModal');

  // Populate bin dropdown in modal
  collectBinSelectModal.innerHTML = '<option value="">Choose a bin</option>' + bins.map(b => `<option value="${b._id}">${b.location} (${b.status})</option>`).join('');

  openCollectModalBtn.onclick = () => { collectModal.style.display = 'flex'; };
  closeCollectModalBtn.onclick = () => { collectModal.style.display = 'none'; };
  collectModal.onclick = (e) => { if (e.target === collectModal) collectModal.style.display = 'none'; };

  collectFormModal.onsubmit = async (e) => {
    e.preventDefault();
    const binId = collectBinSelectModal.value;
    const amount = collectAmountInputModal.value;
    if (!binId || !amount || Number(amount) <= 0) {
      alert('Please select a bin and enter a valid amount.');
      return;
    }
    await fetch('http://localhost:5000/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'collection', bin: binId, amount: Number(amount) })
    });
    alert('Collection recorded!');
    collectModal.style.display = 'none';
    renderCollectorDashboard();
  };
  // PCB workflow placeholder logic
  document.getElementById('startPcbBtn').onclick = () => {
    document.getElementById('pcbStatus').innerText = 'PCB recycling in progress... (demo)';
    setTimeout(() => {
      document.getElementById('pcbStatus').innerText = 'PCB recycling completed! (demo)';
    }, 2000);
  };
}
    alert('Deposit recorded!');
    renderBinUserDashboard();
  };
}

// Helper to render Collector dashboard
async function renderCollectorDashboard() {
  dashboardContent.innerHTML = `<h3>Collector Dashboard</h3>
    <button id="collectBtn">Mark Bin as Collected</button>
    <div id="collections">Loading collections...</div>
    <div id="pcb">PCB Workflow (placeholder)</div>`;
  // Fetch and show collection events
  const events = await getEvents();
  const collections = events.filter(e => e.type === 'collection');
  document.getElementById('collections').innerHTML =
    '<b>Collections:</b><ul>' +
    collections.map(e => `<li>${e.amount}kg from bin ${e.bin?.location || e.bin} (${new Date(e.timestamp).toLocaleString()})</li>`).join('') +
    '</ul>';
  // Collect action
  document.getElementById('collectBtn').onclick = async () => {
    const binId = prompt('Enter Bin ID to collect:');
    if (!binId) return;
    await fetch('http://localhost:5000/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'collection', bin: binId, amount: 0 })
    });
    alert('Collection recorded!');
    renderCollectorDashboard();
  };
}

// Helper to render Admin dashboard
async function renderAdminDashboard() {
  dashboardContent.innerHTML = `<h3>Admin Panel</h3>
    <div id="users">Loading users...</div>
    <div id="bins">Loading bins...</div>
    <div id="analytics">Loading analytics...</div>`;
  // Fetch and show users
  const users = await fetch('http://localhost:5000/api/users').then(r => r.json());
  document.getElementById('users').innerHTML = '<b>Users:</b><ul>' + users.map(u => `<li>${u.name} (${u.role})</li>`).join('') + '</ul>';
  // Fetch and show bins
  const bins = await getBins();
  document.getElementById('bins').innerHTML = '<b>Bins:</b>' + bins.map(b => `
    <div class="bin-status">
      <h4>${b.location}</h4>
      <p>Status: <b>${b.status}</b></p>
      <div class="progress-bar"><div class="progress-bar-fill" style="width:${b.level}%"></div></div>
      <p>Level: ${b.level}%</p>
    </div>
  `).join('');
  // Analytics
  const stats = await getStats();
  document.getElementById('analytics').innerHTML = `<b>System Analytics:</b><br>Total E-Waste: ${stats?.totalEwaste || 0} kg<br>CO₂ Saved: ${stats?.co2Saved || 0} kg`;
}

document.getElementById('binUserTab').onclick = renderBinUserDashboard;
document.getElementById('collectorTab').onclick = renderCollectorDashboard;
document.getElementById('adminTab').onclick = renderAdminDashboard;

// Default to Bin User
window.onload = () => document.getElementById('binUserTab').click();
