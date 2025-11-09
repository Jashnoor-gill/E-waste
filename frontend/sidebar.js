// Sidebar toggle functionality
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburgerMenu');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');
  
  if (hamburger && sidebar && mainContent) {
    hamburger.addEventListener('mouseenter', () => {
      sidebar.classList.add('visible');
      mainContent.classList.add('sidebar-open');
    });
    
    sidebar.addEventListener('mouseleave', () => {
      sidebar.classList.remove('visible');
      mainContent.classList.remove('sidebar-open');
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
