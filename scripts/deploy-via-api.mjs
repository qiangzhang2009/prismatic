// Deploy directly to Vercel via API using the current git commit
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const auth = JSON.parse(readFileSync('/Users/john/.vercel/auth.json', 'utf8'));
const TOKEN = auth.token;
const TEAM_ID = 'team_oRhJ07CryEAd3h7A8mNcM6pu';
const PROJECT_ID = 'prj_AXAnydfdk0uPXFwBM2iOEK4hYa1A';

// Get current commit SHA
const commitSHA = execSync('git rev-parse HEAD', { cwd: process.cwd() }).toString().trim();
console.log('Commit SHA:', commitSHA);

// Create deployment using git source
const body = JSON.stringify({
  name: 'prismatic-app',
  gitSource: {
    type: 'github',
    repo: 'johnzhangs-projects/prismatic',
    repoId: '1001369669',
    ref: commitSHA,
    sha: commitSHA,
  },
  target: 'production',
  projectId: PROJECT_ID,
});

const res = await fetch(`https://api.vercel.com/v13/deployments?teamId=${TEAM_ID}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body,
});

const data = await res.json();
console.log('Deployment created:', JSON.stringify(data, null, 2));
