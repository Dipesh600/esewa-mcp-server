const { execSync } = require('child_process');
try {
  console.log('=== SMITHERY BUILD DIAGNOSTICS ===');
  console.log('node:', execSync('node -v').toString().trim());
  console.log('npm :', execSync('npm -v').toString().trim());
  console.log('\n--- repo files (root) ---');
  console.log(execSync('ls -la').toString());
  console.log('\n--- package.json ---');
  try { console.log(execSync('cat package.json').toString()); } catch (e) { console.log('cannot read package.json'); }
  console.log('\n--- smithery.yaml ---');
  try { console.log(execSync('cat smithery.yaml').toString()); } catch (e) { console.log('cannot read smithery.yaml'); }
  console.log('\n--- entrypoint check ---');
  try { console.log('server.mjs exists?', execSync('[ -f server.mjs ] && echo yes || echo no').toString().trim()); } catch (e) {}
  try { console.log('server.js exists?', execSync('[ -f server.js ] && echo yes || echo no').toString().trim()); } catch (e) {}
  console.log('\n--- env keys present (names only, no values) ---');
  try { console.log(Object.keys(process.env).join(', ')); } catch (e) { console.log('cannot read env'); }
  console.log('PORT env:', process.env.PORT || '(not set)');
  console.log('=== END DIAGNOSTICS ===');
} catch (err) {
  console.error('diagnostics error:', err && err.message);
  process.exit(1);
}
