#!/bin/bash
# deploy-to-render.sh - Quick deployment script for Render

echo "🚀 Deploying TrophyBot to Render..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    git branch -M main
fi

# Add all files
echo "📁 Adding files to git..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "Deploy TrophyBot to Render - $(date)"

# Check if remote exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "🔗 Please add your GitHub repository as origin:"
    echo "git remote add origin https://github.com/yourusername/trophybot.git"
    echo "git push -u origin main"
    exit 1
fi

# Push to GitHub
echo "⬆️ Pushing to GitHub..."
git push origin main

echo "✅ Code pushed to GitHub!"
echo ""
echo "📋 Next steps:"
echo "1. Go to https://render.com"
echo "2. Create new Web Service"
echo "3. Connect your GitHub repository"
echo "4. Use these settings:"
echo "   - Build Command: npm install"
echo "   - Start Command: npm run start:production"
echo "   - Port: 10000"
echo "5. Add environment variables"
echo "6. Deploy!"
echo ""
echo "🔗 Your webhook URL will be: https://trophybot-webhook.onrender.com/webhook"
