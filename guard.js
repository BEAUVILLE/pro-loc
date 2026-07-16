// DIGIY PRO LOC — garde strict PIN 8 h
// La vérification du PIN reste dans pin.html. Ce fichier accepte uniquement
// une session LOC structurée, fraîche et non expirée.
(function(){
  "use strict";

  const MODULE="LOC";
  const MODULE_ALIASES=new Set(["LOC","LOC_PRO","LOCATION","JE_LOUE","LOCATION_PRO"]);
  const TTL=8*60*60*1000;
  const CLOCK_SKEW=5*60*1000;
  const LOGIN=window.DIGIY_LOGIN_URL||"./pin.html";
  const SESSION_KEYS=[
    "DIGIY_LOC_PRO_SESSION_V1",
    "DIGIY_LOC_SESSION",
    "DIGIY_LOC_PIN_SESSION",
    "DIGIY_SESSION_LOC",
    "digiy_loc_session",
    "digiy_loc_guard_session",
    "digiy_guard_loc_session",
    "digiy_session_loc"
  ];
  const LEGACY_KEYS=["DIGIY_ACCESS","DIGIY_PIN_SESSION","digiy_guard_session","DIGIY_SESSION","digiy_session"];
  const SENSITIVE_URL_KEYS=[
    "phone","tel","owner_phone","owner","owner_id","business_phone","whatsapp",
    "slug","loc_slug","loc_phone","loc_tel","access","auth","unlocked","pin_ok",
    "pin","pin4","code","session","token","session_token","redirect","return"
  ];

  let currentSession=null;
  let client=null;
  const state={status:"loading",access_ok:false,module:MODULE,phone:"",slug:""};

  try{document.documentElement.style.visibility="hidden"}catch(_){}

  const now=()=>Date.now();
  const parse=raw=>{try{return JSON.parse(raw||"null")}catch(_){return null}};
  const toMs=value=>{
    if(value==null||value==="")return 0;
    if(typeof value==="number"&&Number.isFinite(value))return value<100000000000?value*1000:value;
    const text=String(value).trim();
    if(/^\d+$/.test(text)){const n=Number(text);return n<100000000000?n*1000:n}
    const t=Date.parse(text);return Number.isFinite(t)?t:0;
  };
  const normalizePhone=value=>{
    const digits=String(value||"").replace(/\D/g,"");
    return digits.length===9?"221"+digits:digits;
  };
  const normalizeSlug=value=>String(value||"").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g,"-").replace(/[^a-z0-9-_]/g,"")
    .replace(/-+/g,"-").replace(/^[-_]+|[-_]+$/g,"");
  const normalizeModule=value=>String(value||"").trim().toUpperCase().replace(/[\s-]+/g,"_");
  const accessTrue=obj=>!!(obj&&(obj.access===true||obj.access_ok===true||obj.ok===true||obj.verified===true||obj.pin_session_ok===true));

  function cleanSensitiveUrl(){
    try{
      const url=new URL(location.href);let changed=false;
      SENSITIVE_URL_KEYS.forEach(key=>{if(url.searchParams.has(key)){url.searchParams.delete(key);changed=true}});
      if(changed)history.replaceState({},document.title,url.pathname+(url.searchParams.toString()?"?"+url.searchParams.toString():"")+url.hash);
    }catch(_){}
  }

  function validateSession(input){
    if(!input||typeof input!=="object")return null;
    const candidates=[input,input.session,input.state,input.data,input.payload].filter(v=>v&&typeof v==="object");
    for(const raw of candidates){
      const module=normalizeModule(raw.module||raw.module_code||raw.p_module||"");
      const phone=normalizePhone(raw.phone||raw.owner_phone||raw.user_phone||raw.p_phone||"");
      const slug=normalizeSlug(raw.slug||raw.loc_slug||raw.owner_slug||"");
      const validated=toMs(raw.validated_at||raw.validatedAt||raw.ts||raw.timestamp||0);
      const expires=toMs(raw.expires_at||raw.expiresAt||raw.access_until||0);
      const time=now();
      if(!MODULE_ALIASES.has(module))continue;
      if(phone.length<9)continue;
      if(!accessTrue(raw))continue;
      if(!validated||!expires)continue;
      if(validated>time+CLOCK_SKEW)continue;
      if(time-validated>TTL)continue;
      if(expires<=time)continue;
      if(expires>validated+TTL+CLOCK_SKEW)continue;
      return {
        module:MODULE,
        public_name:"Je loue",
        phone,slug,
        role:String(raw.role||"owner"),
        access:true,access_ok:true,pin_session_ok:true,verified:true,
        validated_at:validated,expires_at:expires,
        source:String(raw.source||"pin.html")
      };
    }
    return null;
  }

  const read=(storage,key)=>{try{return storage.getItem(key)||""}catch(_){return ""}};
  const write=(storage,key,value)=>{try{storage.setItem(key,value)}catch(_){}};
  const remove=(storage,key)=>{try{storage.removeItem(key)}catch(_){}};

  function storedSession(){
    for(const key of SESSION_KEYS){
      const inSession=validateSession(parse(read(sessionStorage,key)));
      if(inSession)return inSession;
      const inLocal=validateSession(parse(read(localStorage,key)));
      if(inLocal)return inLocal;
    }
    return null;
  }

  function saveSession(session){
    const clean=validateSession(session);if(!clean)return null;
    const raw=JSON.stringify(clean);
    SESSION_KEYS.forEach(key=>{write(sessionStorage,key,raw);write(localStorage,key,raw)});
    if(clean.slug){write(sessionStorage,"digiy_loc_slug",clean.slug);write(localStorage,"digiy_loc_slug",clean.slug);write(localStorage,"digiy_loc_last_slug",clean.slug)}
    write(sessionStorage,"digiy_loc_phone",clean.phone);
    remove(localStorage,"digiy_loc_phone");
    currentSession=clean;
    window.DIGIY_LOC_SESSION=clean;
    window.DIGIY_ACCESS={module:MODULE,phone:clean.phone,slug:clean.slug,access:true,access_ok:true,validated_at:clean.validated_at,expires_at:clean.expires_at};
    Object.assign(state,{status:"ready",access_ok:true,module:MODULE,phone:clean.phone,slug:clean.slug});
    return clean;
  }

  function clearSession(){
    currentSession=null;
    [...SESSION_KEYS,...LEGACY_KEYS].forEach(key=>{remove(sessionStorage,key);remove(localStorage,key)});
    ["digiy_loc_phone","digiy_loc_last_phone","DIGIY_LOC_PHONE","DIGIY_LOC_HUB_PHONE","digiy_phone","DIGIY_PHONE"].forEach(key=>{remove(sessionStorage,key);remove(localStorage,key)});
    try{delete window.DIGIY_LOC_SESSION;delete window.DIGIY_ACCESS}catch(_){}
    Object.assign(state,{status:"locked",access_ok:false,module:MODULE,phone:"",slug:""});
  }

  function showPage(){
    try{
      document.documentElement.style.visibility="visible";
      document.documentElement.style.opacity="1";
      if(document.body){document.body.style.visibility="visible";document.body.style.opacity="1";document.body.removeAttribute("aria-hidden")}
    }catch(_){}
  }

  function goPin(){
    clearSession();cleanSensitiveUrl();
    try{location.replace(new URL(LOGIN,location.href).href)}catch(_){location.href="./pin.html"}
  }

  function boot(){
    cleanSensitiveUrl();
    const session=storedSession();
    if(!session){goPin();return {ok:false,session:null,source:"locked"}}
    const saved=saveSession(session);
    showPage();
    try{document.documentElement.dataset.digiyGuard="ready"}catch(_){}
    return {ok:true,session:saved,source:"pin_session"};
  }

  const bootPromise=Promise.resolve(boot());
  const ready=()=>bootPromise;
  async function requireSession(options={}){
    const result=await bootPromise;
    if(result.ok&&result.session)return result.session;
    if(options.redirect!==false)goPin();
    return null;
  }
  function getSession(){
    if(currentSession){const valid=validateSession(currentSession);if(valid)return valid}
    const session=storedSession();return session?saveSession(session):null;
  }
  function logout(to=LOGIN){clearSession();try{location.replace(new URL(to,location.href).href)}catch(_){location.href=to}}

  function getSb(){
    if(client)return client;
    if(!window.supabase?.createClient||!window.DIGIY_SUPABASE_URL||!(window.DIGIY_SUPABASE_ANON_KEY||window.DIGIY_SUPABASE_ANON))return null;
    client=window.supabase.createClient(
      window.DIGIY_SUPABASE_URL,
      window.DIGIY_SUPABASE_ANON_KEY||window.DIGIY_SUPABASE_ANON,
      {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
    );
    return client;
  }

  window.DIGIY_GUARD={
    VERSION:"loc-guard-strict-pin8h-20260716",
    module:MODULE,
    publicName:"Je loue",
    state,
    ready,requireSession,getSession,logout,clearSession,cleanSensitiveUrl,getSb,
    checkAccess:async()=>!!getSession(),
    resolvePhoneBySlug:async()=>getSession()?.phone||"",
    resolveSlugByPhone:async()=>getSession()?.slug||"",
    verifyPin:async()=>({ok:false,message:"Utilise la porte pin.html."}),
    loginWithPin:async()=>({ok:false,message:"Utilise la porte pin.html."})
  };

  console.info("[DIGIY LOC] verrou strict PIN 8 h actif");
})();
