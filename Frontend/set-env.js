const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/environments/environment.prod.ts');
const apiUrl = process.env.API_URL || process.env.BACKEND_URL;

if (apiUrl) {
  const cleanUrl = apiUrl.trim().replace(/\/+$/, '');
  const content = `export const environment = {
  production: true,
  apiUrl: '${cleanUrl}',
};
`;
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log(`[set-env] Injected API_URL into environment.prod.ts: ${cleanUrl}`);
} else {
  console.log('[set-env] No API_URL or BACKEND_URL provided. Keeping existing environment.prod.ts');
}

