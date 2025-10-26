import { getMockEnabled, setMockEnabled } from './api.js';

function renderToggle() {
  const btn = document.createElement('button');
  btn.id = 'mockToggleBtn';
  btn.style.position = 'fixed';
  btn.style.top = '12px';
  btn.style.right = '12px';
  btn.style.zIndex = '1100';
  btn.style.padding = '6px 10px';
  btn.style.borderRadius = '16px';
  btn.style.border = 'none';
  btn.style.background = '#1a4d2e';
  btn.style.color = '#fff';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = '0 2px 8px rgba(0,0,0,.2)';
  const update = () => { btn.textContent = getMockEnabled() ? 'Mock: On' : 'Mock: Off'; };
  update();
  btn.addEventListener('click', () => {
    const newVal = !getMockEnabled();
    setMockEnabled(newVal);
    update();
    // Reload to ensure all data reloads with the new mode
    setTimeout(() => window.location.reload(), 150);
  });
  document.body.appendChild(btn);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderToggle);
} else {
  renderToggle();
}
