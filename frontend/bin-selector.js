// Smart Bin Selection Component
import { EWASTE_CATEGORIES } from './rewards.js';

// Render bin selection grid with capacity and categories
export function renderBinGrid(bins, onSelectBin) {
  const container = document.createElement('div');
  container.className = 'bin-grid';
  
  bins.forEach(bin => {
    const binCard = createBinCard(bin);
    binCard.addEventListener('click', () => {
      if (bin.status !== 'full') {
        // Deselect all other bins
        container.querySelectorAll('.bin-card').forEach(c => c.classList.remove('selected'));
        binCard.classList.add('selected');
        onSelectBin(bin);
      }
    });
    container.appendChild(binCard);
  });
  
  return container;
}

// Create individual bin card
function createBinCard(bin) {
  const card = document.createElement('div');
  card.className = `bin-card ${bin.status === 'full' ? 'full' : ''}`;
  
  const capacityPercent = bin.currentWeight && bin.capacity 
    ? Math.min((bin.currentWeight / bin.capacity) * 100, 100)
    : bin.level || 0;
  
  const statusClass = capacityPercent >= 90 ? 'full' : capacityPercent >= 70 ? 'warning' : 'available';
  
  card.innerHTML = `
    <div class="bin-header">
      <div class="bin-location">📍 ${bin.location}</div>
      <span class="bin-status-badge ${bin.status}">${bin.status}</span>
    </div>
    
    <div class="bin-capacity">
      <div class="capacity-label">
        Capacity: ${bin.currentWeight || 0}kg / ${bin.capacity || 100}kg
      </div>
      <div class="capacity-bar">
        <div class="capacity-fill ${statusClass}" style="width: ${capacityPercent}%"></div>
      </div>
    </div>
    
    ${bin.qrCode ? `<div style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">
      🔲 QR: ${bin.qrCode}
    </div>` : ''}
    
    <div class="bin-categories">
      ${(bin.acceptedCategories || []).slice(0, 5).map(cat => `
        <span class="category-tag">
          ${EWASTE_CATEGORIES[cat]?.icon || '📦'} ${EWASTE_CATEGORIES[cat]?.name || cat}
        </span>
      `).join('')}
      ${bin.acceptedCategories && bin.acceptedCategories.length > 5 ? 
        `<span class="category-tag">+${bin.acceptedCategories.length - 5} more</span>` : ''}
    </div>
  `;
  
  return card;
}

// Render category selector
export function renderCategorySelector(selectedCategory, onSelectCategory) {
  const container = document.createElement('div');
  container.className = 'category-selector';
  
  Object.entries(EWASTE_CATEGORIES).forEach(([key, category]) => {
    const option = document.createElement('div');
    option.className = `category-option ${selectedCategory === key ? 'selected' : ''}`;
    option.innerHTML = `
      <span class="icon">${category.icon}</span>
      <span class="name">${category.name}</span>
    `;
    option.addEventListener('click', () => {
      container.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      onSelectCategory(key);
    });
    container.appendChild(option);
  });
  
  return container;
}

// Calculate bin availability score
export function getBinAvailabilityScore(bin) {
  if (bin.status === 'full') return 0;
  if (bin.status === 'collecting') return 0.3;
  
  const capacityPercent = bin.currentWeight && bin.capacity 
    ? (bin.currentWeight / bin.capacity) * 100
    : bin.level || 0;
  
  return Math.max(0, 1 - (capacityPercent / 100));
}

// Sort bins by availability and proximity (future: add geolocation)
export function sortBinsByAvailability(bins) {
  return bins.sort((a, b) => {
    const scoreA = getBinAvailabilityScore(a);
    const scoreB = getBinAvailabilityScore(b);
    return scoreB - scoreA;
  });
}
