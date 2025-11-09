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
    if (menu && !document.querySelector('#sidebar .sidebar-menu a[href*="dashboard.html"]')) {
      const li = document.createElement('li');
      li.innerHTML = `<a href="dashboard.html?autostart=1"><span class="icon">📊</span> Dashboard</a>`;
      // Insert at top (after Home) for visibility
      const first = menu.firstElementChild;
      if (first) menu.insertBefore(li, first.nextSibling);
      else menu.appendChild(li);
    }
  } catch (e) {
    // non-fatal
    console.error('Failed to ensure Dashboard link in sidebar', e);
  }
});
