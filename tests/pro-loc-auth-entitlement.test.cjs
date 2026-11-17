const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'world10-owner.js'),'utf8');
test('the duplicate paid-subscription gate cannot intercept owner sign-in anymore',()=>{
  assert.ok(!html.includes('id="send"'));
  assert.ok(!html.includes('digiy-loc-magic-link'));
  assert.ok(!html.includes('digiy-loc-owner-access'));
  assert.ok(!html.includes('sb.auth.signInWithOtp'));
  assert.ok(!html.includes('emailRedirectTo'));
  assert.ok(!html.includes('statusCode'));
  assert.ok(!js.includes('fetch('));
  assert.ok(!js.includes('signInWithOtp'));
  assert.ok(html.includes('id="ownerLink"'));
});
test('the only login destination is the already existing authenticated owner software',()=>{
  const base=[...html.matchAll(/href="(https:\/\/[^"]+)"/g)].map(m=>m[1]);
  assert.ok(base.includes('https://pro-espace.digiylyfe.com/?module=loc'));
  assert.ok(!base.some(x=>x.includes('gestion.html')));
  assert.ok(js.includes('new URL("https://pro-espace.digiylyfe.com/")'));
  assert.ok(js.includes('u.searchParams.set("site",site)'));
});
