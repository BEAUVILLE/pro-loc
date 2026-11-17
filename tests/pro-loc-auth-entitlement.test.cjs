const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const script=scripts.find(m=>m[2].includes("async function verify()"))?.[2];
assert.ok(script,"real owner entry script exists");

function scenario({session=null,apiStatus=403,apiData={ok:false},signInError=null}={}){
  const calls={signIns:[],ownerChecks:[],signedOut:0};
  const elements={};
  const get=(id)=>{
    if(!elements[id])elements[id]={
      id,hidden:true,disabled:false,href:null,value:'',textContent:'',innerHTML:'',className:'',
      children:[],attrs:{},
      appendChild(x){this.children.push(x);return x},
      removeAttribute(k){if(k==='href')this.href=null;delete this.attrs[k]},
      setAttribute(k,v){this.attrs[k]=v}
    };
    return elements[id];
  };
  get('email').value='owner@example.test';
  const auth={
    getSession:async()=>({data:{session}}),
    signInWithOtp:async(args)=>{calls.signIns.push(args);return {error:signInError}},
    signOut:async()=>{calls.signedOut++;return {error:null}}
  };
  const doc={
    querySelector:s=>get(s.slice(1)),
    createElement:(tag)=>({...get('dynamic-'+tag+'-'+Math.random()),tagName:tag})
  };
  const sb={auth};
  const sandbox={
    document:doc,location:{origin:'https://pro-loc.digiylyfe.com',pathname:'/',href:'https://pro-loc.digiylyfe.com/'},
    supabase:{createClient:()=>sb},
    fetch:async(url,init)=>{
      calls.ownerChecks.push({url,init});
      return {status:apiStatus,ok:apiStatus>=200&&apiStatus<300,json:async()=>apiData};
    },
    URL,console,
    DIGIY_LOC_OWNER_WORLD10:{t:s=>s,locale:()=>'fr-FR'}
  };
  sandbox.window=sandbox;
  vm.runInNewContext(script,sandbox,{timeout:4000});
  const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve))};
  return {calls,doc,get,flush};
}
test('an existing DIGIY user may request sign-in without an active LOC subscription',async()=>{
  const p=scenario();
  await p.flush();
  assert.equal(p.get('login').hidden,false);
  assert.equal(p.get('restricted').hidden,true);
  assert.equal(p.get('inside').hidden,true);
  await p.get('send').onclick();
  assert.equal(p.calls.signIns.length,1);
  const request=p.calls.signIns[0];
  assert.equal(request.email,'owner@example.test');
  assert.equal(request.options.shouldCreateUser,false);
  assert.equal(request.options.emailRedirectTo,'https://pro-loc.digiylyfe.com/');
  assert.equal(p.calls.ownerChecks.length,0,'No paid-rights lookup before sending sign-in');
  assert.equal(p.get('send').disabled,false);
});
test('a registered owner without active LOC entitlement stays logged in but cannot open the tools',async()=>{
  const session={access_token:'test-jwt',user:{email:'owner@example.test'}};
  const p=scenario({session,apiStatus:403,apiData:{ok:false,error:'loc_subscription_inactive'}});
  await p.flush();
  assert.equal(p.calls.ownerChecks.length,1);
  assert.match(p.calls.ownerChecks[0].url,/digiy-loc-owner-access/);
  assert.equal(p.calls.ownerChecks[0].init.headers.Authorization,'Bearer test-jwt');
  assert.equal(p.get('restricted').hidden,false);
  assert.equal(p.get('login').hidden,true);
  assert.equal(p.get('inside').hidden,true);
  assert.equal(p.get('fiche').hidden,true);
  assert.equal(p.calls.signedOut,0);
  assert.match(p.get('status').textContent,/Compte connecté/);
});
test('owner-only tools unlock only when server confirms an active LOC entitlement',async()=>{
  const session={access_token:'test-jwt',user:{email:'owner@example.test'}};
  const result={ok:true,business:'Hôtel Test',zone:'Saly',plan:'LOC V2',paid_until:'2027-02-17T00:00:00Z',
    professional_url:'https://example.org/loc-owner'};
  const p=scenario({session,apiStatus:200,apiData:result});
  await p.flush();
  assert.equal(p.get('inside').hidden,false);
  assert.equal(p.get('restricted').hidden,true);
  assert.equal(p.get('fiche').href,result.professional_url);
  assert.equal(p.get('fiche').hidden,false);
  assert.equal(p.get('meta').children[0].textContent,'Hôtel Test');
  assert.equal(p.calls.signedOut,0);
});
test('unverified server errors keep the paid tools locked and do not revoke identity',async()=>{
  const session={access_token:'test-jwt',user:{email:'owner@example.test'}};
  const p=scenario({session,apiStatus:500,apiData:{ok:false,error:'server_error'}});
  await p.flush();
  assert.equal(p.get('restricted').hidden,false);
  assert.equal(p.get('inside').hidden,true);
  assert.equal(p.calls.signedOut,0);
});
test('expired session signs out and never displays member content',async()=>{
  const session={access_token:'old-jwt',user:{email:'owner@example.test'}};
  const p=scenario({session,apiStatus:401,apiData:{ok:false,error:'invalid_session'}});
  await p.flush();
  assert.equal(p.calls.signedOut,1);
  assert.equal(p.get('login').hidden,false);
  assert.equal(p.get('inside').hidden,true);
});
test('unknown account errors do not reveal whether an identity is registered',async()=>{
  const p=scenario({signInError:{message:'User not found'}});
  await p.flush();
  await p.get('send').onclick();
  assert.doesNotMatch(p.get('status').textContent,/User not found/i);
  assert.match(p.get('status').textContent,/Si ce compte DIGIY existe/);
});
