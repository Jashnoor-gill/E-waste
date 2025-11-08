/* runtime frontend config
   Deploy instructions:
   - Create this file during your Netlify build or place it in the `frontend/` folder before deploy.
   - Set window.BACKEND_URL to your Render backend origin, e.g.
       window.BACKEND_URL = 'https://your-backend.onrender.com';
*/

// Example default (no-op). Overwrite this file in deploy with the Render backend URL.
window.BACKEND_URL = window.BACKEND_URL || '';
