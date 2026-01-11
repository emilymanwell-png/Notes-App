# Notes App - Deployment & Sharing Guide

## 🎯 How to Make YouTube Videos Work for Everyone

YouTube videos require the app to be served over HTTP/HTTPS (not from local files).

---

## ✅ BEST OPTION: Deploy to GitHub Pages (FREE & EASY)

### Step 1: Create GitHub Repository
1. Go to https://github.com and sign in
2. Click "New Repository"
3. Name it: `notes-app`
4. Make it Public
5. Click "Create Repository"

### Step 2: Upload Your Files
```bash
# In PowerShell, navigate to your Notes-App folder:
cd "C:\Users\emily\Documents\Notes-App"

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Add your GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/notes-app.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repository on GitHub
2. Click "Settings"
3. Click "Pages" in the left sidebar
4. Under "Source", select "main" branch
5. Click "Save"
6. Wait 1-2 minutes

### Step 4: Access Your App
Your app will be live at:
```
https://YOUR_USERNAME.github.io/notes-app/index.html
```

**🎉 YouTube videos will work perfectly for EVERYONE!**

---

## 🔄 Alternative Options

### Option 1: Netlify Drop (Easiest - No Git Required)
1. Go to https://app.netlify.com/drop
2. Drag your entire Notes-App folder
3. Get instant URL like: `https://random-name.netlify.app`
4. Share with anyone!

### Option 2: Vercel (Fast & Free)
1. Install Vercel CLI: `npm install -g vercel`
2. Run: `vercel` in your Notes-App folder
3. Follow prompts
4. Get URL instantly

### Option 3: Each User Runs Local Server
Share the `START_NOTES_APP.bat` file with users and they can:
1. Double-click `START_NOTES_APP.bat`
2. App opens at `http://localhost:8000`
3. Works perfectly on their machine

---

## 🔧 Current Smart Fallback

I've updated the app with smart fallback:
- ✅ If hosted on web server → YouTube embeds work perfectly
- ⚠️ If opened from file system → Shows "Watch on YouTube" button
- 👥 Users can still click to watch videos in new tab

---

## 📝 Sharing with Others

### If you deploy online (GitHub Pages/Netlify):
- Just share the URL
- Everything works automatically
- No setup needed by users

### If sharing the HTML file:
- Users must run `START_NOTES_APP.bat` 
- Or videos will show "Watch on YouTube" button
- Still functional, just opens videos in new tab

---

## 🎬 Recommended: Deploy to GitHub Pages

This is the best solution because:
- ✅ 100% free
- ✅ Works for unlimited users
- ✅ No setup required by users
- ✅ YouTube embeds work perfectly
- ✅ Automatic HTTPS
- ✅ Fast global CDN

Need help with deployment? Let me know!

---

## 🤖 Running the GPT4All Local AI Bridge (for AI features)

This app can talk to a local GPT4All (or compatible) binary via a small Node bridge in `server.js`.

Steps to run locally so the app can call the model from the browser:

1. Install or place your GPT4All binary somewhere on your machine and download a model file (e.g. `model.ggml.bin`).

2. Open PowerShell in the project folder (`C:\Users\emily\Documents\Notes-App`).

3. Start the AI bridge (example using PowerShell environment variables):

```powershell
# Point to the gpt4all executable (or the CLI wrapper you installed)
$env:GPT4ALL_CMD = 'C:\path\to\gpt4all.exe'  # or just 'gpt4all' if it's on PATH

# Point to the model file
$env:GPT4ALL_MODEL = 'C:\path\to\model.ggml.bin'

# Optional: customize args, e.g. '--model {model} --prompt {prompt}' is default
$env:GPT4ALL_ARGS = '--model {model} --prompt {prompt}'

# Start the Node bridge
npm start
```

The bridge listens on port `3000` by default and exposes a POST `/api/ai` endpoint that accepts JSON `{ "prompt": "..." }` and returns `{ "text": "..." }`.

4. In a separate terminal, serve the app itself (so browser pages are on `http://localhost:8000`):

```powershell
.\start-server.ps1
```

5. Open `http://localhost:8000/index.html` and in the AI panel type a prompt and press Enter. The UI will POST to `http://127.0.0.1:3000/api/ai` by default.

Notes & troubleshooting:
- If you put the model somewhere else, set `GPT4ALL_MODEL` accordingly.
- If your GPT4All CLI has a different name, set `GPT4ALL_CMD`.
- The bridge logs diagnostic messages when it starts; check the terminal running `npm start` if responses fail.
- If you prefer a single-port deployment, you can serve static files from the Node process and proxy `/api/ai` on the same origin.

