import { readFileSync } from 'fs';
const auth = JSON.parse(readFileSync('/Users/john/.vercel/auth.json', 'utf8'));
const token = auth.token;

const url = `https://api.vercel.com/v6/deployments?teamId=team_oRhJ07CryEAd3h7A8mNcM6pu&limit=5`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const data = await res.json();
if (data.deployments) {
  data.deployments.forEach(d => {
    console.log(`UID: ${d.uid}`);
    console.log(`  URL: ${d.url}`);
    console.log(`  State: ${d.state}`);
    console.log(`  Created: ${d.createdAt}`);
    console.log(`  Building cache: ${d.buildingAt}`);
    console.log('');
  });
} else {
  console.log(JSON.stringify(data).substring(0, 300));
}
