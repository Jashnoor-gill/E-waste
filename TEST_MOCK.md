# Mock Data Toggle - Testing Guide

## Quick Test Steps

### 1. **Clear Browser Storage** (First Time)
- Open DevTools (F12)
- Go to Application tab → Local Storage
- Delete the `USE_MOCK` key (if it exists)
- Refresh the page

### 2. **Verify Mock Toggle Appears**
- Look for "Mock: On" button in top-right corner
- Should show "Mock: On" by default for new users

### 3. **Check Data is Loading**
Open DevTools Console and check for:
- API calls to: `https://e-waste-backend-3qxc.onrender.com/api/bins?mock=1`
- Response should contain 3 bins (Main Campus, Library, Student Center)

### 4. **Toggle Test**
- Click the toggle button → should switch to "Mock: Off" and reload
- API calls now use: `?mock=0`
- If database is empty, backend will still return mock data (auto mode)

## Backend Mock Data Content

**Bins**: 3 sample bins
- Main Campus - Building A (45% full)
- Library - Ground Floor (15% full)
- Student Center (90% full)

**Users**: 2 sample users
- John Doe (250 points, Level 3)
- Jane Smith (500 points, Level 5)

**Events**: 3 sample events (deposits/collections)

**Stats**:
- Total E-waste: 125.5 kg
- CO₂ Saved: 75.3 kg
- Water Saved: 1500 L
- Energy Saved: 250 kWh

## Troubleshooting

### If you don't see mock data:

1. **Check Render Backend is Updated**
   - Visit: https://dashboard.render.com
   - Verify latest commit is deployed
   - Look for commit: "feat: add mock toggle UI and responsive styles..."

2. **Check Network Tab**
   - Open DevTools → Network
   - Refresh page
   - Look for `/api/bins?mock=1` request
   - Check response - should show mock bins array

3. **Check Console for Errors**
   - Any CORS errors?
   - Any fetch errors?
   - Any "Failed to fetch" messages?

4. **Manual Backend Test**
   Open in browser:
   ```
   https://e-waste-backend-3qxc.onrender.com/api/bins?mock=1
   ```
   Should return mock bins JSON

## Deploy Checklist

✅ GitHub: All changes pushed
✅ Netlify: Auto-deploys from GitHub main branch
⚠️ Render: **You need to manually redeploy or verify auto-deploy is enabled**

### To Deploy Backend on Render:
1. Go to https://dashboard.render.com
2. Select your backend service
3. Click "Manual Deploy" → "Deploy latest commit"
4. Wait for deployment to complete (~2-3 minutes)
