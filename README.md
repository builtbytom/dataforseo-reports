# DataForSEO Reports - Netlify Edition

A clean, cost-efficient SEO report generator that runs entirely on Netlify.

## 🚀 One-Click Deploy to Netlify

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 2: Deploy to Netlify
1. Go to [Netlify](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Choose GitHub and select your repo
4. Click "Deploy site"

### Step 3: Add Your DataForSEO Credentials
1. In Netlify, go to Site settings → Environment variables
2. Add these variables:
   - `DATAFORSEO_LOGIN` = your-email@example.com
   - `DATAFORSEO_PASSWORD` = your-api-password
3. Get these from: https://app.dataforseo.com/api-access

### Step 4: Done!
Your site will be live at: `https://your-site-name.netlify.app`

## 💰 Cost-Efficient Features

- **Quick Overview** (1 credit): Just traffic and basic metrics
- **Standard Report** (2 credits): Adds backlink data
- **Detailed Analysis** (3 credits): Includes keyword research

Unlike the Google Sheets extension that pulls everything, this only calls what you need!

## 📊 What You Get

- Professional reports your clients will love
- Shareable links (bookmark any report)
- PDF export (just print the page)
- Mobile-friendly design
- No local setup required!

## 🔒 Security

- API credentials stored securely in Netlify
- Never exposed to browsers
- Each deployment gets unique URLs

## 🎨 Customization

Want to add your logo or change colors? Edit:
- `index.html` - Add your branding
- `style.css` - Change colors/fonts
- `app.js` - Modify report features

## 📱 Client Access

Share reports with URLs like:
```
https://your-site.netlify.app/#report-data
```

Clients see a clean report - no login needed!