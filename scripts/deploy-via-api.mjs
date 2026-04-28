// Deploy directly to Vercel via API using the current git commit
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const auth = JSON.parse(readFileSync('/Users/john/.vercel/auth.json', 'utf8'));
const TOKEN = auth.token;
const TEAM_ID = 'team_oRhJ07CryEAd3h7A8mNcM6pu';
const PROJECT_ID = 'prj_AXAnydfdk0uPXFwBM2iOEK4hYa1A';

// Get current commit SHA from git
const commitSHA = execSync('git rev-parse HEAD', { cwd: process.cwd() }).toString().trim();
console.log('Commit SHA:', commitSHA);

// Create deployment using git source (without projectId when using gitSource)
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
if (data.error) {
  console.error('Deployment error:', JSON.stringify(data.error, null, 2));
  // Try alternative endpoint for production
  if (data.error.code === 'forbidden') {
    console.log('\nTrying with projectId in URL...');
    const res2 = await fetch(`https://api.vercel.com/v13/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    const data2 = await res2.json();
    console.log('Alternative result:', JSON.stringify(data2, null, 2));
    if (data2.url) {
      console.log('\nDeployment URL:', `https://${data2.url}`);
    }
} else if (data.url) {
  console.log('Deployment created successfully!');
  console.log('Deployment URL:', `https://${data.url}`);
} else {
  console.log('Deployment response:', JSON.stringify(data, null, 2));
}
