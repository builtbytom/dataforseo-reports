#!/bin/bash

echo "🚀 DataForSEO Reports - Deploy to GitHub & Netlify"
echo "================================================"
echo ""

# Check if git is already initialized
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit - DataForSEO Reports"
    echo "✅ Git repository created"
else
    echo "✅ Git already initialized"
fi

echo ""
echo "📋 Next steps:"
echo ""
echo "1. Create a new repository on GitHub:"
echo "   👉 https://github.com/new"
echo "   Name it: dataforseo-reports (or whatever you prefer)"
echo ""
echo "2. Run these commands:"
echo ""
echo "   git remote add origin https://github.com/builtbytom/dataforseo-reports.git"
echo "   git push -u origin main"
echo ""
echo "3. Go to Netlify:"
echo "   👉 https://app.netlify.com"
echo "   - Click 'Add new site' → 'Import an existing project'"
echo "   - Choose GitHub and select your repo"
echo "   - Deploy!"
echo ""
echo "4. Add environment variables in Netlify:"
echo "   Site settings → Environment variables"
echo "   DATAFORSEO_LOGIN = your-email"
echo "   DATAFORSEO_PASSWORD = your-password"
echo ""
echo "That's it! Your site will be live in minutes 🎉"