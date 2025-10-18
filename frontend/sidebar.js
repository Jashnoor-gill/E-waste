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
});
