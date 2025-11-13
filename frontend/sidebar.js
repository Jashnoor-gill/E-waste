// Sidebar toggle functionality
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburgerMenu');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');
  
  if (hamburger && sidebar && mainContent) {
    // Toggle sidebar on click (no hover). This makes the sidebar open/close only when
    // the user intentionally clicks the hamburger icon.
    const toggleSidebar = (open) => {
      const isOpen = typeof open === 'boolean' ? open : !sidebar.classList.contains('visible');
      if (isOpen) {
        sidebar.classList.add('visible');
        mainContent.classList.add('sidebar-open');
        hamburger.setAttribute('aria-expanded', 'true');
      } else {
        sidebar.classList.remove('visible');
        mainContent.classList.remove('sidebar-open');
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
  }
  
  // Ensure a Dashboard link exists in the sidebar that opens the full dashboard page
  // and optionally auto-starts the camera via the `autostart=1` query param.
  try {
    const menu = document.querySelector('#sidebar .sidebar-menu');
    if (menu) {
      // ensure Dashboard link
      if (!document.querySelector('#sidebar .sidebar-menu a[href*="dashboard.html"]')) {
        const li = document.createElement('li');
        li.innerHTML = `<a href="dashboard.html"><span class="icon">📊</span> Dashboard</a>`;
        const first = menu.firstElementChild;
        if (first) menu.insertBefore(li, first.nextSibling);
        else menu.appendChild(li);
      }
      // ensure Bin User link (separate page)
      if (!document.querySelector('#sidebar .sidebar-menu a[href*="bin-user.html"]')) {
        const li2 = document.createElement('li');
        li2.innerHTML = `<a href="bin-user.html"><span class="icon">👤</span> Bin User</a>`;
        // insert after Dashboard link
        const dashboardLink = document.querySelector('#sidebar .sidebar-menu a[href*="dashboard.html"]');
        if (dashboardLink && dashboardLink.parentElement) menu.insertBefore(li2, dashboardLink.parentElement.nextSibling);
        else menu.appendChild(li2);
      }
      // Deduplicate Bin User links (keep first occurrence)
      try {
        const binAnchors = menu.querySelectorAll('a[href*="bin-user.html"]');
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
});
