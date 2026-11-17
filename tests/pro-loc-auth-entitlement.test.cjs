const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../world10-owner.js'),'utf8');
test('no duplicate login or subscription gate intercepts owner entry',()=>{
  for(const code of [html,js]){
    for(const marker of ['digiy-loc-magic-link','digiy-loc-owner-access','signInWithOtp','supabase.createClient','fetch(']){
      assert.ok(!code.includes(marker),marker);
    }
  }
  assert.ok(!html.includes('id="send"'));
  assert.ok(html.includes('id="ownerLink"'));
  assert.ok(html.includes('id="sarlatLink"'));
});
test('no unscoped route to an owner portal: exact property slugs are mandatory',()=>{
 assert.ok(html.includes('https://pro-espace.digiylyfe.com/?site=saly-chez-baptiste'));
 assert.ok(html.includes('https://pro-espace.digiylyfe.com/?site=sarlat-chez-baptiste'));
 assert.ok(!html.includes('?module=loc'));
 assert.ok(js.includes('url.searchParams.set("site",slug)'));
 assert.ok(!js.includes('searchParams.set("module","loc")'));
});
