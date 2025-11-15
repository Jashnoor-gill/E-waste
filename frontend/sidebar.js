// Sidebar toggle functionality
document.addEventListener('DOMContentLoaded', () => {
  // Debug helper: capture failed network/resource loads and show them in an overlay
  try {
    const dbgOverlayId = 'networkDebugOverlay';
    function ensureDbgOverlay() {
      let o = document.getElementById(dbgOverlayId);
      if (!o) {
        o = document.createElement('div');
        o.id = dbgOverlayId;
        o.style.position = 'fixed';
        o.style.right = '12px';
        o.style.bottom = '12px';
        o.style.zIndex = '99999';
        o.style.maxWidth = '360px';
        o.style.maxHeight = '40vh';
        o.style.overflow = 'auto';
        o.style.background = 'rgba(0,0,0,0.8)';
        o.style.color = '#fff';
        o.style.fontSize = '12px';
        o.style.padding = '8px';
        o.style.borderRadius = '8px';
        o.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
        o.style.display = 'none';
        const title = document.createElement('div');
        title.textContent = 'Network Errors (click to clear)';
        title.style.fontWeight = '700';
        title.style.marginBottom = '6px';
        o.appendChild(title);
        const list = document.createElement('div'); list.id = dbgOverlayId + '_list'; o.appendChild(list);
        o.addEventListener('click', () => { list.innerHTML = ''; o.style.display = 'none'; });
        document.body.appendChild(o);
      }
      return document.getElementById(dbgOverlayId + '_list');
    }

    function reportNetworkError(msg) {
      try {
        console.warn('NetworkDebug:', msg);
        const list = ensureDbgOverlay();
        const o = document.getElementById(dbgOverlayId);
        if (o) o.style.display = 'block';
        const el = document.createElement('div');
        el.style.marginBottom = '6px';
        el.textContent = msg;
        list.insertBefore(el, list.firstChild);
      } catch (e) { console.warn('reportNetworkError failed', e); }
    }

    // Patch fetch to surface non-OK responses
    if (window.fetch) {
      const _fetch = window.fetch.bind(window);
      window.fetch = async function(input, init) {
        try {
          const res = await _fetch(input, init);
          if (!res.ok) {
            const url = (typeof input === 'string') ? input : (input && input.url) ? input.url : String(input);
            reportNetworkError(`${res.status} ${res.statusText} — ${url}`);
          }
          return res;
        } catch (err) {
          reportNetworkError(`Fetch error: ${err && err.message ? err.message : err} — ${String(input)}`);
          throw err;
        }
      };
    }

    // Listen for resource loading errors (scripts, images, etc.)
    window.addEventListener('error', (ev) => {
      try {
        if (ev && ev.target && (ev.target.src || ev.target.href)) {
          const src = ev.target.src || ev.target.href;
          reportNetworkError(`Resource load failed: ${src}`);
        } else if (ev && ev.message) {
          reportNetworkError(`JS error: ${ev.message}`);
        }
      } catch (e) {}
    }, true);
  } catch (e) { /* non-fatal */ }
  const hamburger = document.getElementById('hamburgerMenu');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');
  
  if (hamburger && sidebar && mainContent) {
    // Create or reuse an overlay element that will dim the page when the sidebar is open
    let overlay = document.getElementById('sidebarOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebarOverlay';
      document.body.appendChild(overlay);
    }
    // Toggle sidebar on click (no hover). This makes the sidebar open/close only when
    // the user intentionally clicks the hamburger icon.
    const toggleSidebar = (open) => {
      const isOpen = typeof open === 'boolean' ? open : !sidebar.classList.contains('visible');
      if (isOpen) {
        sidebar.classList.add('visible');
        mainContent.classList.add('sidebar-open');
        overlay.classList.add('visible');
        document.body.classList.add('no-scroll');
        hamburger.setAttribute('aria-expanded', 'true');
      } else {
        sidebar.classList.remove('visible');
        mainContent.classList.remove('sidebar-open');
        overlay.classList.remove('visible');
        document.body.classList.remove('no-scroll');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    };

    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });

    // Close when clicking outside the sidebar (on the page)
    document.addEventListener('click', (e) => {
      if (!sidebar.classList.contains('visible')) return;
      const target = e.target;
      if (!sidebar.contains(target) && target !== hamburger && !hamburger.contains(target)) {
        toggleSidebar(false);
      }
    });

    // Close when clicking the overlay itself
    overlay.addEventListener('click', () => toggleSidebar(false));

    // Close on Escape key for accessibility
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('visible')) {
        toggleSidebar(false);
      }
    });

    // Make hamburger keyboard accessible (Enter / Space)
    hamburger.setAttribute('role', 'button');
    hamburger.setAttribute('tabindex', '0');
    hamburger.setAttribute('aria-expanded', sidebar.classList.contains('visible') ? 'true' : 'false');
    hamburger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSidebar();
      }
    });

    // Auto-close sidebar when a menu link is clicked (mobile-friendly).
    // Use event delegation so links added dynamically are handled.
    sidebar.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      if (!anchor) return;
      // If the anchor points to an in-page anchor or navigation, close the sidebar.
      // Delay slightly so navigation or other handlers can run.
      setTimeout(() => toggleSidebar(false), 50);
    });
  }
  
  // Ensure a Dashboard link exists in the sidebar that opens the full dashboard page
  // and optionally auto-starts the camera via the `autostart=1` query param.
    try {
      const menu = document.querySelector('#sidebar .sidebar-menu');
      if (menu) {
        // ensure Dashboard link (robust to different URL formats)
        if (!document.querySelector('#sidebar .sidebar-menu a[href*="dashboard"]')) {
          const li = document.createElement('li');
          li.innerHTML = `<a href="dashboard.html"><span class="icon">📊</span> Dashboard</a>`;
          const first = menu.firstElementChild;
          if (first) menu.insertBefore(li, first.nextSibling);
          else menu.appendChild(li);
        }
        // ensure Bin User link (robust: check any href containing 'bin-user')
        if (!document.querySelector('#sidebar .sidebar-menu a[href*="bin-user"]')) {
          const li2 = document.createElement('li');
          li2.innerHTML = `<a href="bin-user.html"><span class="icon">👤</span> Bin User</a>`;
          // insert after Dashboard link when possible
          const dashboardLink = document.querySelector('#sidebar .sidebar-menu a[href*="dashboard"]');
          if (dashboardLink && dashboardLink.parentElement) menu.insertBefore(li2, dashboardLink.parentElement.nextSibling);
          else menu.appendChild(li2);
        }
        // Profile link intentionally omitted per UX preference

        // Deduplicate Bin User links (keep first occurrence)
        try {
          const binAnchors = menu.querySelectorAll('a[href*="bin-user"]');
          if (binAnchors && binAnchors.length > 1) {
            for (let i = 1; i < binAnchors.length; i++) {
              const li = binAnchors[i].closest('li');
              if (li) li.remove(); else binAnchors[i].remove();
            }
          }
        } catch (e) { /* non-fatal */ }
      }
    } catch (e) {
      // non-fatal
      console.error('Failed to ensure Dashboard link in sidebar', e);
    }
  
  // Add a small user panel in the sidebar header showing username and logout
  try {
    const header = document.querySelector('#sidebar .sidebar-header');
    if (header) {
      // Add a small mock-mode toggle next to the header so it's available on every page
      try {
        const mockWrap = document.createElement('div');
        mockWrap.style.display = 'flex';
        mockWrap.style.alignItems = 'center';
        mockWrap.style.gap = '8px';
        mockWrap.style.marginLeft = '8px';
        mockWrap.id = 'sidebarMockWrap';
        mockWrap.innerHTML = `<button id="sidebarMockToggle" style="padding:6px 8px;border-radius:6px;border:1px solid #ddd;background:#e8f5e9;color:#064">Mock: On</button>`;
        header.appendChild(mockWrap);
        const mockBtn = mockWrap.querySelector('#sidebarMockToggle');
        function updateMockUI(enabled) {
          try {
            if (!mockBtn) return;
            mockBtn.textContent = enabled ? 'Mock: On' : 'Mock: Off';
            mockBtn.style.background = enabled ? '#e8f5e9' : '#fff3e0';
            mockBtn.style.borderColor = enabled ? '#c8e6c9' : '#ffecb3';
            mockBtn.style.color = enabled ? '#064' : '#a65a00';
          } catch (e) {}
        }
        // Initialize from localStorage or global getter
        try {
          let enabled = true;
          const stored = localStorage.getItem('ENABLE_MOCK');
          if (stored !== null) enabled = stored === 'true';
          else if (window.getMockEnabled) enabled = !!window.getMockEnabled();
          // set global state and update UI
          try { if (window.setMockEnabled) window.setMockEnabled(enabled); else window.ENABLE_MOCK = enabled; } catch (e) {}
          updateMockUI(enabled);
        } catch (e) { console.warn('init sidebar mock toggle failed', e); }

        mockBtn.addEventListener('click', () => {
          try {
            const cur = (window.getMockEnabled ? !!window.getMockEnabled() : (window.ENABLE_MOCK !== false));
            const next = !cur;
            try { if (window.setMockEnabled) window.setMockEnabled(next); else window.ENABLE_MOCK = next; } catch (e) {}
            try { localStorage.setItem('ENABLE_MOCK', next ? 'true' : 'false'); } catch (e) {}
            updateMockUI(next);
          } catch (e) { console.warn('sidebar mock toggle click failed', e); }
        });

        // Listen for global changes from other toggles
        try { window.addEventListener && window.addEventListener('mock-mode-changed', (ev) => updateMockUI(!!(ev && ev.detail && ev.detail.enabled))); } catch (e) {}
      } catch (e) { console.warn('failed to add sidebar mock toggle', e); }
      
      const userPanel = document.createElement('div');
      userPanel.id = 'sidebarUserPanel';
      userPanel.style.marginTop = '8px';
      userPanel.style.display = 'flex';
      userPanel.style.alignItems = 'center';
      userPanel.style.gap = '8px';
      userPanel.innerHTML = `
        <div id="sidebarAvatar" style="width:40px;height:40px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">U</div>
        <div id="sidebarUserInfo" style="color:#fff;font-size:0.95rem">
          <div id="sidebarUserName">Guest</div>
          <div style="font-size:0.8rem;color:#e0e0e0" id="sidebarUserRole"></div>
        </div>
        <div style="margin-left:auto">
          <button id="sidebarLogoutBtn" style="background:transparent;border:none;color:#fff;cursor:pointer">Logout</button>
        </div>
      `;
      header.appendChild(userPanel);

      const token = localStorage.getItem('ew_token');
      // If mock/demo mode enabled and no token present, show a demo user
      try {
        const mockEnabled = (window.getMockEnabled ? !!window.getMockEnabled() : (window.ENABLE_MOCK !== false));
        if (!token && mockEnabled) {
          document.getElementById('sidebarUserName').textContent = 'Demo User';
          document.getElementById('sidebarUserRole').textContent = 'demo';
          const av = document.getElementById('sidebarAvatar'); av.textContent = 'D';
        } else if (token) {
          fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } }).then(r => r.ok ? r.json() : null).then(user => {
            if (user) {
              const name = user.username || user.name || user.email || 'User';
              document.getElementById('sidebarUserName').textContent = name;
              document.getElementById('sidebarUserRole').textContent = user.role || '';
              // avatar initial
              const av = document.getElementById('sidebarAvatar');
              av.textContent = (user.username ? user.username[0].toUpperCase() : (user.name ? user.name[0].toUpperCase() : 'U'));
            }
          }).catch(()=>{/* ignore */});
        }
      } catch (e) { /* ignore */ }

      document.getElementById('sidebarLogoutBtn').addEventListener('click', () => {
        localStorage.removeItem('ew_token');
        localStorage.removeItem('ew_user');
        window.location.href = 'login.html';
      });
    }
  } catch (e) { /* non-fatal */ }
});
