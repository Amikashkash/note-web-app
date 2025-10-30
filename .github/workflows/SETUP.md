# GitHub Actions Auto-Deploy Setup Guide

This guide will help you set up automatic deployment to Firebase when you push to GitHub.

## Step 1: Generate Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/project/notes-4-me/settings/serviceaccounts/adminsdk)
2. Click "Generate new private key"
3. Save the JSON file securely (it contains sensitive credentials)
4. Copy the entire content of the JSON file

## Step 2: Add Service Account to GitHub Secrets

1. Go to your GitHub repository: https://github.com/[YOUR-USERNAME]/notes-app
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FIREBASE_SERVICE_ACCOUNT`
5. Value: Paste the entire JSON content from Step 1
6. Click **Add secret**

## Step 3: Generate Firebase CI Token (for Firestore rules)

1. Open a terminal/command prompt
2. Run: `firebase login:ci`
3. A browser window will open - log in with your Google account
4. Copy the token from the terminal

## Step 4: Add Firebase Token to GitHub Secrets

1. Go back to GitHub: **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `FIREBASE_TOKEN`
4. Value: Paste the token from Step 3
5. Click **Add secret**

## Step 5: Push the Workflow File

```bash
git add .github/workflows/firebase-deploy.yml
git commit -m "Add GitHub Actions auto-deploy workflow"
git push
```

## Step 6: Verify Deployment

1. Go to your GitHub repository
2. Click **Actions** tab
3. You should see the workflow running
4. Wait for it to complete (green checkmark)
5. Check https://notes-4-me.web.app to verify the deployment

## How It Works

- **Trigger**: Automatically runs when you push to `main` branch
- **Build**: Installs dependencies and builds the project
- **Deploy Hosting**: Deploys to Firebase Hosting
- **Deploy Firestore**: Updates Firestore rules and indexes

## Manual Trigger

You can also manually trigger deployment:
1. Go to **Actions** tab
2. Click **Deploy to Firebase Hosting**
3. Click **Run workflow**
4. Select branch and click **Run workflow**

## Troubleshooting

### Build Fails
- Check the Actions log for error messages
- Make sure all dependencies are in package.json
- Verify the build works locally: `npm run build`

### Deploy Fails
- Check that secrets are set correctly
- Verify Firebase project ID is correct in firebase-deploy.yml
- Make sure service account has proper permissions

### Firestore Deploy Fails
- Check FIREBASE_TOKEN is valid
- Try regenerating the token: `firebase login:ci`

## Security Notes

⚠️ **Never commit the service account JSON or Firebase token to Git!**
- These are sensitive credentials
- Keep them only in GitHub Secrets
- Rotate them periodically for security
