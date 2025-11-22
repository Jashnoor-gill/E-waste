// Import rewards and utilities
import { getUserStats, calculateImpact, getEarnedBadges, BADGES, EWASTE_CATEGORIES } from './rewards.js';
import { renderBinGrid, renderCategorySelector, sortBinsByAvailability } from './bin-selector.js';
import { createDepositsChart, createCategoryChart, createCollectionsChart } from './dashboard-charts.js';
import { getBins, getEvents, getStats, postEvent, getUsers, createBin, updateBin, updateStats, updateUser, deleteUser, deleteBin } from './api.js';

const dashboardContent = document.getElementById('dashboardContent');

// Enhanced Bin User Dashboard with all new features
async function renderBinUserDashboard() {
  try {
  // Determine current user id (stored after login)
  let currentUserId = null;
  try { const su = localStorage.getItem('ew_user'); if (su) { const u = JSON.parse(su); currentUserId = u.id || u._id || u._id; } } catch(e) {}
  // Fetch bins and events but tolerate backend failures so the UI still renders locally
  let bins = [];
  let events = [];
  try {
        [bins, events] = await Promise.all([getBins(), getEvents()]);
  } catch (fetchErr) {
    console.warn('Failed to fetch bins/events for Bin User dashboard:', fetchErr);
    // leave bins/events as empty arrays so the page still renders
    bins = [];
    events = [];
  }
  // Prefer filtering events by current user when possible
  const userEvents = events.filter(e => e.type === 'deposit' && (!currentUserId || (e.user && ((e.user._id && String(e.user._id) === String(currentUserId)) || (e.user.id && String(e.user.id) === String(currentUserId)) || String(e.user) === String(currentUserId)))));
  
  // Calculate user statistics
  const userStats = getUserStats(userEvents);
  const impact = calculateImpact(userStats.totalWeight);
  const earnedBadges = getEarnedBadges(userStats);
  
  // Progress to next level
  const progressPercent = Math.min(((userStats.totalPoints % 100) / 100) * 100, 100);
  
  dashboardContent.innerHTML = `
    <h2>🌱 Bin User Dashboard</h2>
    
    <!-- Stats Cards Grid -->
    <div class="dashboard-grid">
      <div class="stat-card slide-in-up">
        <h3>Total Deposited</h3>
        <div class="value">${userStats.totalWeight.toFixed(1)} <span style="font-size:1.5rem">kg</span></div>
        <div class="label">${userStats.totalDeposits} deposits made</div>
      </div>
      
      <div class="stat-card slide-in-up" style="animation-delay: 0.1s">
        <h3>Points & Level</h3>
        <div class="value">Level ${userStats.level}</div>
        <div class="label">${userStats.totalPoints} points earned</div>
        <div class="progress-bar" style="margin-top:0.5rem">
          <div class="progress-bar-fill" style="width:${progressPercent}%"></div>
        </div>
      </div>
      
      <div class="stat-card slide-in-up" style="animation-delay: 0.2s">
        <h3>CO₂ Saved</h3>
        <div class="value">${impact.co2Saved} <span style="font-size:1.5rem">kg</span></div>
        <div class="label">Carbon emissions prevented</div>
      </div>
    </div>
    
    <!-- Rewards & Badges Section -->
    <div class="rewards-section slide-in-up" style="animation-delay: 0.3s">
      <h3>🏆 Your Badges (${earnedBadges.length}/${Object.keys(BADGES).length})</h3>
      <div class="badges-container">
        ${Object.entries(BADGES).map(([key, badge]) => {
          const earned = earnedBadges.find(b => b.key === key);
          return `
            <div class="badge ${earned ? '' : 'locked'}" title="${badge.description}">
              <div class="badge-icon">${earned ? badge.icon : '🔒'}</div>
              <div class="badge-name">${badge.name}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    
    <!-- Impact Metrics (only CO2 retained) -->
    
    <!-- Deposit Button -->
    <button id="openDepositModal" class="btn" style="font-size:1.1rem; padding:1rem 2rem; margin:2rem 0">
      📦 Deposit E-Waste
    </button>
    
    <!-- Charts Section -->
    <div class="chart-container slide-in-up" style="animation-delay: 0.5s">
      <h3>📊 Deposits Over Time</h3>
      <div style="height:250px; position:relative">
        <canvas id="depositsChart"></canvas>
      </div>
    </div>
    
    <div class="dashboard-grid" style="margin-top:1.5rem">
      <div class="chart-container slide-in-up" style="animation-delay: 0.6s">
        <h3>📈 Category Breakdown</h3>
        <div style="height:200px; position:relative">
          <canvas id="categoryChart"></canvas>
        </div>
      </div>
      
      <!-- Impact comparison removed: site shows CO2 saved in the stat cards -->
    </div>
    
    <!-- Recent History -->
    <div class="chart-container slide-in-up" style="animation-delay: 0.8s">
      <h3>📝 Recent Deposits</h3>
      <div id="recentHistory"></div>
    </div>
  `;
  
  // Render recent history
  const recentHistory = document.getElementById('recentHistory');
  if (userEvents.length === 0) {
    recentHistory.innerHTML = '<p style="color:#666">No deposits yet. Start recycling to make an impact!</p>';
  } else {
    recentHistory.innerHTML = `
      <div style="max-height:300px; overflow-y:auto">
        ${userEvents.slice(0, 10).map(e => `
          <div class="card" style="margin:0.5rem 0; padding:1rem">
            <div style="display:flex; justify-content:space-between; align-items:center">
              <div>
                <strong>${EWASTE_CATEGORIES[e.category || 'other']?.icon || '📦'} 
                ${EWASTE_CATEGORIES[e.category || 'other']?.name || 'E-Waste'}</strong>
                <br>
                <span style="color:#666; font-size:0.9rem">
                  ${e.amount}kg at ${e.bin?.location || 'Unknown location'}
                </span>
              </div>
              <div style="text-align:right">
                <span style="font-weight:600; color:#43a047">+${(e.amount * 10).toFixed(0)} points</span>
                <br>
                <span style="color:#999; font-size:0.85rem">
                  ${new Date(e.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Setup modal for deposits
  setupDepositModal(bins);
  
  // Create charts after DOM is ready
  setTimeout(() => {
    if (userEvents.length > 0) {
      createDepositsChart('depositsChart', userEvents);
      if (Object.keys(userStats.categoryBreakdown).length > 0) {
        createCategoryChart('categoryChart', userStats.categoryBreakdown);
      }
      // impact chart removed: only CO2 shown as a stat card
    }
  }, 100);
  } catch (err) {
    console.error('Failed to load Bin User dashboard:', err);
    dashboardContent.innerHTML = `
      <div class="card" style="padding:1rem; border-left:4px solid #f44336">
        <h3>Unable to load Bin User panel</h3>
        <p>Please make sure the backend API is running and reachable, then try again.</p>
      </div>`;
  }
}

// Setup enhanced deposit modal with category selection and bin grid
function setupDepositModal(bins) {
  const depositModal = document.getElementById('depositModal');
  const openDepositModalBtn = document.getElementById('openDepositModal');

  // Guard: if modal or open button are missing, skip wiring the modal to avoid runtime errors
  if (!depositModal || !openDepositModalBtn) {
    console.warn('Deposit modal or trigger not found; skipping modal setup');
    return;
  }
  
  let selectedBin = null;
  let selectedCategory = 'other';
  
  openDepositModalBtn.onclick = () => {
    // Update modal content with enhanced UI
    const modalContent = depositModal.querySelector('.modal-content');
    modalContent.innerHTML = `
      <button class="modal-close" id="closeDepositModalNew">×</button>
      <h3>📦 Deposit E-Waste</h3>
      
      <div style="margin:1rem 0">
        <h4>1. Select E-Waste Category:</h4>
        <div id="categorySelector"></div>
      </div>
      
      <div style="margin:1.5rem 0">
        <h4>2. Choose a Bin:</h4>
        <div id="binGridContainer"></div>
      </div>
      
      <div style="margin:1.5rem 0">
        <h4>3. Enter Amount:</h4>
        <input type="number" id="amountInputModalNew" min="0.1" step="0.1" 
               placeholder="Weight in kg" required 
               style="width:100%; padding:0.75rem; font-size:1rem; border:2px solid #e0e0e0; border-radius:8px">
      </div>
      
      <div style="background:#e8f5e9; padding:1rem; border-radius:8px; margin:1rem 0">
        <strong>💡 Estimated Points:</strong> <span id="estimatedPoints">0</span> points
      </div>
      
      <button type="button" id="submitDepositBtn" class="btn" style="width:100%; padding:1rem; font-size:1.1rem">
        ✅ Confirm Deposit
      </button>
    `;
    
    // Render category selector
    const categoryContainer = document.getElementById('categorySelector');
    const categorySelector = renderCategorySelector(selectedCategory, (category) => {
      selectedCategory = category;
      updateEstimatedPoints();
    });
    categoryContainer.appendChild(categorySelector);
    
    // Render bin grid
    const binGridContainer = document.getElementById('binGridContainer');
    const sortedBins = sortBinsByAvailability([...bins]);
    const binGrid = renderBinGrid(sortedBins, (bin) => {
      selectedBin = bin;
    });
    binGridContainer.appendChild(binGrid);
    
    // Update estimated points on amount change
    const amountInput = document.getElementById('amountInputModalNew');
    const updateEstimatedPoints = () => {
      const amount = parseFloat(amountInput.value) || 0;
      const points = Math.floor(amount * 10);
      document.getElementById('estimatedPoints').textContent = points;
    };
    amountInput.addEventListener('input', updateEstimatedPoints);
    
    // Handle close
    document.getElementById('closeDepositModalNew').onclick = () => {
      depositModal.style.display = 'none';
    };
    
    // Handle submit
    document.getElementById('submitDepositBtn').onclick = async () => {
      const amount = parseFloat(amountInput.value);
      
      if (!selectedBin) {
        alert('Please select a bin.');
        return;
      }
      if (!amount || amount <= 0) {
        alert('Please enter a valid amount.');
        return;
      }
      
      const points = Math.floor(amount * 10);
      
      try {
        await postEvent({
          type: 'deposit',
          amount: amount,
          bin: selectedBin._id,
          category: selectedCategory,
          pointsEarned: points
        });
        
        alert(`✅ Deposit recorded!\n\n+${points} points earned`);
        depositModal.style.display = 'none';
        renderBinUserDashboard();
      } catch (error) {
        alert('Error recording deposit. Please try again.');
        console.error(error);
      }
    };
    
    depositModal.style.display = 'flex';
  };
  
  depositModal.onclick = (e) => { 
    if (e.target === depositModal) depositModal.style.display = 'none'; 
  };
}

// Helper to render Collector dashboard
async function renderCollectorDashboard() {
  try {
  let bins = await getBins();
  dashboardContent.innerHTML = `
    <h2>🚚 Collector Dashboard</h2>
    <div class="dashboard-grid">
      <div class="stat-card">
        <h3>Quick Actions</h3>
        <button id="openCollectModal" class="btn" style="width:100%; margin-top:.5rem">Mark Bin as Collected</button>
        <button id="checkFillBtn" class="btn" style="width:100%; margin-top:.5rem">Check Fill Level</button>
      </div>
      <div class="stat-card">
        <h3>Filter Bins</h3>
        <label>Status:
          <select id="binStatusFilter">
            <option value="all">All</option>
            <option value="Full">Full</option>
            <option value="Medium">Medium</option>
            <option value="Empty">Empty</option>
            <option value="Offline">Offline</option>
          </select>
        </label>
      </div>
    </div>

    <div class="chart-container" style="margin-top:1rem">
      <h3>Collections Over Time</h3>
      <div style="height:220px; position:relative"><canvas id="collectionsChart"></canvas></div>
    </div>

    <div class="chart-container" style="margin-top:1rem">
      <h3>Bins</h3>
      <div id="collectorBins" class="bin-grid"></div>
    </div>

    <div id="pcb" class="chart-container" style="margin-top:1rem">
      <h3>PCB Recycling Workflow</h3>
      <button id="startPcbBtn" class="btn">Start PCB Recycle</button>
      <div id="pcbStatus" style="margin-top:.5rem">No active workflow.</div>
    </div>`;

  const events = await getEvents();
  const collections = events.filter(e => e.type === 'collection');
  createCollectionsChart('collectionsChart', collections);

  const binsContainer = document.getElementById('collectorBins');
    const renderBins = (status = 'all') => {
    const shown = bins.filter(b => status === 'all' ? true : (b.status === status));
    binsContainer.innerHTML = shown.map(b => {
      const statusSafe = (b.status || 'Unknown');
      const levelPct = (b.level ?? Math.round(((b.currentWeight || 0) / (b.capacity || 1)) * 100));
      return `
      <div class="bin-card">
        <div class="bin-header">
          <div class="bin-title">${b.location}</div>
          <span class="bin-status ${statusSafe.toLowerCase()}">${statusSafe}</span>
        </div>
        <div class="capacity-bar"><div class="capacity-fill" style="width:${levelPct}%"></div></div>
        <div class="bin-meta">Level: ${levelPct}%</div>
        <button class="btn" data-binid="${b._id}" data-action="collect">Collect</button>
      </div>`;
    }).join('');

    // Attach collect buttons
    binsContainer.querySelectorAll('button[data-action="collect"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const binId = btn.getAttribute('data-binid');
        // Pre-fill and open modal for quick collect
        const select = document.getElementById('collectBinSelectModal');
        if (select) select.value = binId;
        const modal = document.getElementById('collectModal');
        if (modal) modal.style.display = 'flex';
      });
    });
  };
  renderBins();
  document.getElementById('binStatusFilter').addEventListener('change', (e) => renderBins(e.target.value));
  // Wire check fill button to refresh bin data from backend and re-render
  const checkBtn = document.getElementById('checkFillBtn');
  if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
      try {
        checkBtn.disabled = true;
        checkBtn.textContent = 'Checking...';
        bins = await getBins();
        const status = document.getElementById('binStatusFilter')?.value || 'all';
        renderBins(status);
      } catch (err) {
        console.error('Failed to refresh bins:', err);
        alert('Unable to check fill levels. See console for details.');
      } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check Fill Level';
      }
    });
  }
  
  const collectModal = document.getElementById('collectModal');
  const openCollectModalBtn = document.getElementById('openCollectModal');
  const closeCollectModalBtn = document.getElementById('closeCollectModal');
  const collectBinSelectModal = document.getElementById('collectBinSelectModal');
  const collectFormModal = document.getElementById('collectFormModal');
  const collectAmountInputModal = document.getElementById('collectAmountInputModal');

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
    await postEvent({ type: 'collection', bin: binId, amount: Number(amount) });
    alert('Collection recorded!');
    collectModal.style.display = 'none';
    renderCollectorDashboard();
  };
  
  document.getElementById('startPcbBtn').onclick = () => {
    document.getElementById('pcbStatus').innerText = 'PCB recycling in progress... (demo)';
    setTimeout(() => {
      document.getElementById('pcbStatus').innerText = 'PCB recycling completed! (demo)';
    }, 2000);
  };
  } catch (err) {
    console.warn('Failed to load Collector dashboard, falling back to static data:', err);
    // Fallback static data so the collector panel remains usable offline
    const now = Date.now();
    bins = [
      { _id: 'bin-1', location: 'Community Center', status: 'Available', level: 0, capacity: 50, currentWeight: 0 },
      { _id: 'bin-2', location: 'Market Street', status: 'Medium', level: 45, capacity: 40, currentWeight: 18 },
      { _id: 'bin-3', location: 'Campus North', status: 'Full', level: 98, capacity: 60, currentWeight: 59 }
    ];
    // Continue rendering using the same code path by not rethrowing
  }
}

// Helper to render Admin dashboard
async function renderAdminDashboard() {
  dashboardContent.innerHTML = `
    <h2>🛠️ Admin Panel</h2>
    <div class="dashboard-grid">
      <div class="stat-card">
        <h3>Create Bin</h3>
        <form id="createBinForm">
          <input placeholder="Location" name="location" required style="width:100%; margin:.25rem 0">
          <input placeholder="Capacity (kg)" name="capacity" type="number" step="0.1" min="0" required style="width:100%; margin:.25rem 0">
          <input placeholder="Accepted Categories (csv)" name="acceptedCategories" style="width:100%; margin:.25rem 0">
          <button class="btn" type="submit" style="width:100%">Create</button>
        </form>
      </div>
      <div class="stat-card">
        <h3>Update Stats</h3>
        <form id="updateStatsForm">
          <input placeholder="Total E-waste (kg)" name="totalEwaste" type="number" step="0.1" min="0" style="width:100%; margin:.25rem 0">
          <input placeholder="CO2 Saved (kg)" name="co2Saved" type="number" step="0.1" min="0" style="width:100%; margin:.25rem 0">
          <button class="btn" type="submit" style="width:100%">Save</button>
        </form>
      </div>
    </div>

    <div class="chart-container" style="margin-top:1rem">
      <h3>Users</h3>
      <div id="adminUsers"></div>
    </div>

    <div class="chart-container" style="margin-top:1rem">
      <h3>Bins</h3>
      <div id="adminBins" class="bin-grid"></div>
    </div>

    <div class="chart-container" style="margin-top:1rem">
      <h3>System Analytics</h3>
      <div id="analytics"></div>
    </div>`;

  // Connected devices & token management (admin only UI hooks)
  const devicesContainerHtml = `
    <div class="chart-container" style="margin-top:1rem">
      <h3>Connected Devices</h3>
      <div id="adminDevices">Loading devices...</div>
    </div>
    <div class="chart-container" style="margin-top:1rem">
      <h3>Device Tokens</h3>
      <div id="adminDeviceTokens">Loading tokens...</div>
      <div style="margin-top:.5rem">
        <input id="newDeviceTokenInput" placeholder="New token" style="width:60%; margin-right:.5rem" />
        <button id="addDeviceTokenBtn" class="btn">Add Token</button>
      </div>
    </div>`;
  dashboardContent.insertAdjacentHTML('beforeend', devicesContainerHtml);

  // Load devices and tokens if admin token provided via prompt (simple flow)
  const adminToken = localStorage.getItem('ADMIN_TOKEN') || null;
  const adminDevicesEl = document.getElementById('adminDevices');
  const adminDeviceTokensEl = document.getElementById('adminDeviceTokens');
  if (!adminToken) {
    adminDevicesEl.innerHTML = '<i>Provide admin token to view connected devices.</i>';
    adminDeviceTokensEl.innerHTML = '<i>Provide admin token to manage tokens.</i>';
  } else {
    try {
      const [devices, tokens] = await Promise.all([getDevices(adminToken), getDeviceTokens(adminToken)]);
      adminDevicesEl.innerHTML = (Array.isArray(devices) && devices.length) ? devices.map(d=>`<div class="card" style="margin:.25rem 0; padding:.5rem; display:flex; justify-content:space-between"><div>${d.name}</div><div style="font-size:.8rem;color:#666">${d.socketId}</div></div>`).join('') : '<i>No devices connected</i>';
      adminDeviceTokensEl.innerHTML = (Array.isArray(tokens) && tokens.length) ? tokens.map(t=>`<div style="display:flex; gap:.5rem; align-items:center; margin:.25rem 0"><div style="flex:1; word-break:break-all">${t}</div><button class="btn" data-token="${t}" data-action="removeToken">Remove</button></div>`).join('') : '<i>No persisted tokens</i>';

      // wire remove token buttons
      adminDeviceTokensEl.querySelectorAll('button[data-action="removeToken"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const token = btn.getAttribute('data-token');
          if (!confirm('Remove token?')) return;
          try { await removeDeviceToken(adminToken, token); alert('Removed'); renderAdminDashboard(); } catch (err) { alert('Failed: '+err.message); }
        });
      });
    } catch (err) {
      adminDevicesEl.innerHTML = `<div class="card" style="padding:.5rem; color:#c62828">Failed to load devices: ${err.message}</div>`;
      adminDeviceTokensEl.innerHTML = `<div class="card" style="padding:.5rem; color:#c62828">Failed to load tokens: ${err.message}</div>`;
    }
  }

  document.getElementById('addDeviceTokenBtn').addEventListener('click', async () => {
    const token = document.getElementById('newDeviceTokenInput').value.trim();
    if (!token) return alert('Enter token');
    const at = localStorage.getItem('ADMIN_TOKEN');
    if (!at) {
      if (!confirm('No admin token set. Save ADMIN_TOKEN in localStorage now?')) return;
      localStorage.setItem('ADMIN_TOKEN', token);
      return alert('ADMIN_TOKEN saved to localStorage. Reload and try again.');
    }
    try { await addDeviceToken(at, token); alert('Token added'); renderAdminDashboard(); } catch (err) { alert('Failed: '+err.message); }
  });

  const [users, bins, stats] = await Promise.all([getUsers(), getBins(), getStats()]);
  document.getElementById('analytics').innerHTML = `<b>Total E-Waste:</b> ${stats?.totalEwaste || 0} kg<br><b>CO₂ Saved:</b> ${stats?.co2Saved || 0} kg`;

  // Users list
  const adminUsers = document.getElementById('adminUsers');
  adminUsers.innerHTML = users.map(u => `
    <div class="card" style="margin:.25rem 0; padding:.5rem; display:flex; justify-content:space-between; align-items:center">
      <div><b>${u.name || u.email || 'User'}</b> — <span style="color:#666">${u.role || 'user'}</span></div>
      <div>
        <select data-uid="${u._id}" class="roleSelect">
          <option value="user" ${u.role==='user'?'selected':''}>user</option>
          <option value="collector" ${u.role==='collector'?'selected':''}>collector</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
        </select>
        <button class="btn" data-uid="${u._id}" data-action="deleteUser">Delete</button>
      </div>
    </div>
  `).join('');

  // Bins list
  const adminBins = document.getElementById('adminBins');
  adminBins.innerHTML = bins.map(b => {
    const levelPct = (b.level ?? Math.round(((b.currentWeight || 0) / (b.capacity || 1)) * 100));
    const categories = Array.isArray(b.acceptedCategories) ? b.acceptedCategories.join(', ') : (b.acceptedCategories || '');
    const statusSafe = (b.status || 'Unknown');
    return `
    <div class="bin-card" data-bid="${b._id}">
      <div class="bin-header">
        <div class="bin-title">${b.location}</div>
        <span class="bin-status ${statusSafe.toLowerCase()}">${statusSafe}</span>
      </div>
      <div class="capacity-bar"><div class="capacity-fill" style="width:${levelPct}%"></div></div>
      <div class="bin-meta">Level: ${levelPct}% — Capacity: ${b.capacity || '-'}kg</div>
      <div class="bin-meta">Categories: ${categories || '-'}</div>
      <div style="display:flex; gap:.5rem; margin-top:.5rem">
        <button class="btn" data-bid="${b._id}" data-action="editBin">Edit</button>
        <button class="btn" data-bid="${b._id}" data-action="deleteBin">Delete</button>
      </div>
      <div class="card" style="margin-top:.5rem; padding:.5rem; display:none" data-bid="${b._id}" data-role="editForm">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:.5rem">
          <input name="location" placeholder="Location" value="${b.location || ''}" style="width:100%" />
          <input name="status" placeholder="Status (Empty/Medium/Full/Offline)" value="${statusSafe}" style="width:100%" />
          <input name="capacity" type="number" step="0.1" min="0" placeholder="Capacity (kg)" value="${b.capacity || ''}" style="width:100%" />
          <input name="level" type="number" step="1" min="0" max="100" placeholder="Level %" value="${isNaN(levelPct)?'':levelPct}" style="width:100%" />
          <input name="acceptedCategories" placeholder="Accepted Categories (csv)" value="${categories}" style="grid-column:1/-1; width:100%" />
        </div>
        <div style="display:flex; gap:.5rem; margin-top:.5rem">
          <button class="btn" data-bid="${b._id}" data-action="saveBin">Save</button>
          <button class="btn" data-bid="${b._id}" data-action="cancelEdit">Cancel</button>
        </div>
      </div>
    </div>`;
  }).join('');

  // Wire forms and actions
  document.getElementById('createBinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      location: form.location.value,
      capacity: Number(form.capacity.value),
      acceptedCategories: (form.acceptedCategories.value || '').split(',').map(s => s.trim()).filter(Boolean)
    };
    try {
      await createBin(payload);
      alert('Bin created');
      renderAdminDashboard();
    } catch (err) { alert(err.message); }
  });

  document.getElementById('updateStatsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {};
    if (form.totalEwaste.value) payload.totalEwaste = Number(form.totalEwaste.value);
    if (form.co2Saved.value) payload.co2Saved = Number(form.co2Saved.value);
    try {
      await updateStats(payload);
      alert('Stats updated');
      renderAdminDashboard();
    } catch (err) { alert(err.message); }
  });

  adminUsers.querySelectorAll('.roleSelect').forEach(sel => {
    sel.addEventListener('change', async () => {
      const userId = sel.getAttribute('data-uid');
      try { await updateUser(userId, { role: sel.value }); alert('Role updated'); }
      catch (err) { alert(err.message); }
    });
  });

  adminUsers.querySelectorAll('button[data-action="deleteUser"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.getAttribute('data-uid');
      if (!confirm('Delete this user?')) return;
      try { await deleteUser(userId); alert('User deleted'); renderAdminDashboard(); }
      catch (err) { alert(err.message); }
    });
  });

  adminBins.querySelectorAll('button[data-action="deleteBin"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const binId = btn.getAttribute('data-bid');
      if (!confirm('Delete this bin?')) return;
      try { await deleteBin(binId); alert('Bin deleted'); renderAdminDashboard(); }
      catch (err) { alert(err.message); }
    });
  });

  // Inline edit handlers
  adminBins.querySelectorAll('button[data-action="editBin"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bid = btn.getAttribute('data-bid');
      const form = adminBins.querySelector(`div[data-role="editForm"][data-bid="${bid}"]`);
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
  });

  adminBins.querySelectorAll('button[data-action="cancelEdit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bid = btn.getAttribute('data-bid');
      const form = adminBins.querySelector(`div[data-role="editForm"][data-bid="${bid}"]`);
      if (form) form.style.display = 'none';
    });
  });

  adminBins.querySelectorAll('button[data-action="saveBin"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bid = btn.getAttribute('data-bid');
      const form = adminBins.querySelector(`div[data-role="editForm"][data-bid="${bid}"]`);
      if (!form) return;
      const payload = {};
      const loc = form.querySelector('input[name="location"]').value.trim();
      const status = form.querySelector('input[name="status"]').value.trim();
      const capacityStr = form.querySelector('input[name="capacity"]').value;
      const levelStr = form.querySelector('input[name="level"]').value;
      const catsStr = form.querySelector('input[name="acceptedCategories"]').value;
      if (loc) payload.location = loc;
      if (status) payload.status = status;
      if (capacityStr !== '') payload.capacity = Number(capacityStr);
      if (levelStr !== '') payload.level = Math.max(0, Math.min(100, Number(levelStr)));
      if (catsStr !== undefined) payload.acceptedCategories = catsStr.split(',').map(s => s.trim()).filter(Boolean);
      try {
        await updateBin(bid, payload);
        alert('Bin updated');
        renderAdminDashboard();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

// Tab handlers with preventDefault to avoid anchor navigation
// Guard each lookup because some pages (e.g. bin-user.html) are separate
const _get = (id) => document.getElementById(id);
const _bind = (id, fn, storageKey) => {
  const el = _get(id);
  if (!el) return;
  el.addEventListener('click', (e) => { e.preventDefault(); fn(); if (storageKey) localStorage.setItem('lastDashboardPanel', storageKey); });
};

_bind('binUserTab', renderBinUserDashboard, 'bin-user');
_bind('collectorTab', renderCollectorDashboard, 'collector');
_bind('adminTab', renderAdminDashboard, 'admin');

// Export the main panel renderers so separate pages can call them.
export { renderBinUserDashboard, renderCollectorDashboard, renderAdminDashboard };
