// guard.js — DIGIY LOC PRO
// Doctrine : PIN une seule fois -> session locale fraîche -> navigation interne directe
// Rail d'accès/session = slug + phone
// Rail métier = owner_id / room_id / booking_id
(() => {
  "use strict";

  const CFG = {
    SUPABASE_URL:
      window.DIGIY_SUPABASE_URL ||
      "https://wesqmwjjtsefyjnluosj.supabase.co",

    SUPABASE_ANON_KEY:
      window.DIGIY_SUPABASE_ANON ||
      window.DIGIY_SUPABASE_ANON_KEY ||
      "sb_publishable_tGHItRgeWDmGjnd0CK1DVQ_BIep4Ug3",

    MODULE_CODE: "LOC",
    MODULE_CODE_LOWER: "loc",

    SESSION_MAX_AGE_MS: 8 * 60 * 60 * 1000,

    PIN_PATH: window.DIGIY_LOGIN_URL || "./pin.html",
    PAY_URL: window.DIGIY_PAY_URL || "https://commencer-a-payer.digiylyfe.com/",

    ALLOW_PREVIEW_WITHOUT_IDENTITY: false,

    STORAGE: {
      SESSION_KEYS: [
        "DIGIY_LOC_PIN_SESSION",
        "DIGIY_PIN_SESSION",
        "DIGIY_ACCESS",
        "DIGIY_SESSION_LOC",
        "digiy_loc_session"
      ],
      SLUG_KEY:      "digiy_loc_slug",
      PHONE_KEY:     "digiy_loc_phone",
      LAST_SLUG_KEY: "digiy_loc_last_slug"
    },

    RPC: {
      /* ━━━ CORRIGÉ : verify_access_pin = Rail de l'Infini
         AVANT : "digiy_verify_pin" → RPC inexistant → null → PIN invalide
         APRÈS : params { p_slug, p_pin } = doctrine canonique              ━━━ */
      VERIFY_PIN: "verify_access_pin",
      HAS_ACCESS: "digiy_has_access"
    },

    TABLES: {
      SUBSCRIPTIONS_PUBLIC: "digiy_subscriptions_public"
    },

    URL: {
      KEEP_PHONE_IN_URL: true
    }
  };

  const MODULE       = CFG.MODULE_CODE;
  const MODULE_LOWER = CFG.MODULE_CODE_LOWER;

  const qs     = new URLSearchParams(location.search);
  const slugQ  = qs.get("slug")  || "";
  const phoneQ = qs.get("phone") || "";

  function safeJsonParse(raw){ try{ return JSON.parse(raw); }catch(_){ return null; } }
  function normSlug(value){ return String(value||"").trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"").replace(/-+/g,"-").replace(/^-|-$/g,""); }
  function normPhone(value){ const raw=String(value||"").trim(); const cleaned=raw.replace(/[^\d+]/g,""); const digits=cleaned.replace(/[^\d]/g,""); if(!digits)return ""; return cleaned.startsWith("+")?`+${digits}`:digits; }
  function normPin(value){ return String(value||"").trim().replace(/\s+/g,""); }
  function upper(value){ return String(value||"").trim().toUpperCase(); }
  function nowMs(){ return Date.now(); }
  function nowIso(){ return new Date().toISOString(); }
  function isRecent(ts){ const n=Number(ts||0); if(!n)return false; return (nowMs()-n)<=CFG.SESSION_MAX_AGE_MS; }
  function hidePage(){ try{ document.documentElement.style.visibility="hidden"; }catch(_){} }
  function showPage(){ try{ document.documentElement.style.visibility=""; }catch(_){} }

  function jsonHeaders(){
    return { apikey:CFG.SUPABASE_ANON_KEY, Authorization:`Bearer ${CFG.SUPABASE_ANON_KEY}`, "Content-Type":"application/json", Accept:"application/json" };
  }
  function getHeaders(){
    return { apikey:CFG.SUPABASE_ANON_KEY, Authorization:`Bearer ${CFG.SUPABASE_ANON_KEY}`, Accept:"application/json" };
  }

  async function rpc(name, body){
    const res = await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/${name}`, { method:"POST", headers:jsonHeaders(), body:JSON.stringify(body||{}) });
    const data = await res.json().catch(()=>null);
    return { ok:res.ok, status:res.status, data };
  }

  async function tableGet(table, paramsObj){
    const params = new URLSearchParams(paramsObj||{});
    const res = await fetch(`${CFG.SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, { method:"GET", headers:getHeaders() });
    const data = await res.json().catch(()=>null);
    return { ok:res.ok, status:res.status, data };
  }

  function saveSlugOnly(slug){ const clean=normSlug(slug); if(!clean)return; try{localStorage.setItem(CFG.STORAGE.SLUG_KEY,clean);localStorage.setItem(CFG.STORAGE.LAST_SLUG_KEY,clean);sessionStorage.setItem(CFG.STORAGE.SLUG_KEY,clean);sessionStorage.setItem(CFG.STORAGE.LAST_SLUG_KEY,clean);}catch(_){} }
  function savePhoneOnly(phone){ const clean=normPhone(phone); if(!clean)return; try{localStorage.setItem(CFG.STORAGE.PHONE_KEY,clean);sessionStorage.setItem(CFG.STORAGE.PHONE_KEY,clean);}catch(_){} }

  function readSavedSlug(){ try{ return normSlug(qs.get("slug")||sessionStorage.getItem(CFG.STORAGE.SLUG_KEY)||sessionStorage.getItem(CFG.STORAGE.LAST_SLUG_KEY)||localStorage.getItem(CFG.STORAGE.SLUG_KEY)||localStorage.getItem(CFG.STORAGE.LAST_SLUG_KEY)||""); }catch(_){ return normSlug(qs.get("slug")||""); } }
  function readSavedPhone(){ try{ return normPhone(qs.get("phone")||sessionStorage.getItem(CFG.STORAGE.PHONE_KEY)||localStorage.getItem(CFG.STORAGE.PHONE_KEY)||""); }catch(_){ return normPhone(qs.get("phone")||""); } }

  function clearSessionsOnly(){ for(const key of CFG.STORAGE.SESSION_KEYS){ try{localStorage.removeItem(key);}catch(_){} try{sessionStorage.removeItem(key);}catch(_){} } }

  function clearAllLocalState(){
    clearSessionsOnly();
    try{localStorage.removeItem(CFG.STORAGE.SLUG_KEY);}catch(_){}
    try{localStorage.removeItem(CFG.STORAGE.PHONE_KEY);}catch(_){}
    try{localStorage.removeItem(CFG.STORAGE.LAST_SLUG_KEY);}catch(_){}
    try{sessionStorage.removeItem(CFG.STORAGE.SLUG_KEY);}catch(_){}
    try{sessionStorage.removeItem(CFG.STORAGE.PHONE_KEY);}catch(_){}
    try{sessionStorage.removeItem(CFG.STORAGE.LAST_SLUG_KEY);}catch(_){}
  }

  function readStoredSession(){
    for(const key of CFG.STORAGE.SESSION_KEYS){
      let parsed=null;
      try{ parsed=safeJsonParse(localStorage.getItem(key)); if(!parsed)parsed=safeJsonParse(sessionStorage.getItem(key)); }catch(_){}
      if(!parsed||typeof parsed!=="object")continue;
      const moduleName=upper(parsed.module||parsed.module_code||"");
      const slug=normSlug(parsed.slug||""); const phone=normPhone(parsed.phone||"");
      const owner_id=parsed.owner_id||null;
      const access=!!parsed.access||!!parsed.access_ok||!!parsed.ok||!!parsed.has_access;
      const verifiedAt=Number(parsed.verified_at||parsed.validated_at_ms||parsed.ts||0)||0;
      const validatedAtIso=parsed.validated_at||null;
      let ageOk=false;
      if(verifiedAt&&isRecent(verifiedAt))ageOk=true;
      if(!ageOk&&validatedAtIso){const dt=new Date(validatedAtIso).getTime();if(dt&&isRecent(dt))ageOk=true;}
      if(!slug&&!phone)continue;
      if(moduleName&&moduleName!==MODULE)continue;
      if(!ageOk)continue;
      if(!access)continue;
      return{ key,slug,phone,owner_id,module:MODULE,access:true,verified_at:verifiedAt||(validatedAtIso?new Date(validatedAtIso).getTime():0),validated_at:validatedAtIso||(verifiedAt?new Date(verifiedAt).toISOString():null) };
    }
    return null;
  }

  function saveSession(payload={}){
    const verifiedAtMs=Number(payload.verified_at||nowMs())||nowMs();
    const validatedAtIso=payload.validated_at||(verifiedAtMs?new Date(verifiedAtMs).toISOString():nowIso());
    const session={
      slug:normSlug(payload.slug||state.slug||""),phone:normPhone(payload.phone||state.phone||""),
      owner_id:payload.owner_id||state.owner_id||null,module:MODULE,
      access:!!payload.access,access_ok:!!payload.access,
      verified_at:verifiedAtMs,validated_at:validatedAtIso,ts:nowMs()
    };
    for(const key of CFG.STORAGE.SESSION_KEYS){ try{localStorage.setItem(key,JSON.stringify(session));}catch(_){} try{sessionStorage.setItem(key,JSON.stringify(session));}catch(_){} }
    saveSlugOnly(session.slug); savePhoneOnly(session.phone);
    try{window.DIGIY_ACCESS=Object.assign({},window.DIGIY_ACCESS||{},session);}catch(_){}
    return session;
  }

  function buildPinUrl(input={}){
    const url=new URL(CFG.PIN_PATH,location.href);
    const slug=normSlug(input.slug||state.slug||""); const phone=normPhone(input.phone||state.phone||"");
    if(slug)url.searchParams.set("slug",slug);
    if(phone&&CFG.URL.KEEP_PHONE_IN_URL)url.searchParams.set("phone",phone);
    url.searchParams.set("return",location.href);
    return url.toString();
  }
  function goPin(input={}){ location.replace(buildPinUrl(input)); }

  function buildPayUrl(input={}){
    const url=new URL(CFG.PAY_URL);
    const slug=normSlug(input.slug||state.slug||""); const phone=normPhone(input.phone||state.phone||"");
    url.searchParams.set("module",MODULE);
    if(slug)url.searchParams.set("slug",slug);
    if(phone)url.searchParams.set("phone",phone);
    url.searchParams.set("return",location.href);
    return url.toString();
  }
  function goPay(input={}){ location.replace(buildPayUrl(input)); }

  function ensureUrlIdentity(slug,phone){
    try{
      const s=normSlug(slug); const p=normPhone(phone);
      const url=new URL(location.href);
      const currentSlug=normSlug(url.searchParams.get("slug")||"");
      const currentPhone=normPhone(url.searchParams.get("phone")||"");
      let changed=false;
      if(s&&currentSlug!==s){url.searchParams.set("slug",s);changed=true;}
      if(CFG.URL.KEEP_PHONE_IN_URL&&p&&currentPhone!==p){url.searchParams.set("phone",p);changed=true;}
      if(changed)history.replaceState({},"",url.toString());
    }catch(_){}
  }

  async function resolveSubBySlug(slug){
    const s=normSlug(slug); if(!s)return null;
    const tries=[{select:"phone,slug,module",slug:`eq.${s}`,module:`eq.${MODULE}`,limit:"1"},{select:"phone,slug,module",slug:`eq.${s}`,module:`eq.${MODULE_LOWER}`,limit:"1"},{select:"phone,slug,module",slug:`eq.${s}`,limit:"1"}];
    for(const params of tries){ const res=await tableGet(CFG.TABLES.SUBSCRIPTIONS_PUBLIC,params); if(!res.ok||!Array.isArray(res.data)||!res.data[0])continue; return{slug:normSlug(res.data[0].slug),phone:normPhone(res.data[0].phone),module:upper(res.data[0].module||MODULE)}; }
    return null;
  }

  async function resolveSubByPhone(phone){
    const p=normPhone(phone); if(!p)return null;
    const tries=[{select:"phone,slug,module",phone:`eq.${p}`,module:`eq.${MODULE}`,limit:"1"},{select:"phone,slug,module",phone:`eq.${p}`,module:`eq.${MODULE_LOWER}`,limit:"1"},{select:"phone,slug,module",phone:`eq.${p}`,limit:"1"}];
    for(const params of tries){ const res=await tableGet(CFG.TABLES.SUBSCRIPTIONS_PUBLIC,params); if(!res.ok||!Array.isArray(res.data)||!res.data[0])continue; return{slug:normSlug(res.data[0].slug),phone:normPhone(res.data[0].phone),module:upper(res.data[0].module||MODULE)}; }
    return null;
  }

  async function checkAccess(phone){
    const p=normPhone(phone); if(!p)return false;
    const tries=[{p_phone:p,p_module:MODULE},{p_phone:p,p_module:MODULE_LOWER},{phone:p,module:MODULE},{phone:p,module:MODULE_LOWER}];
    for(const body of tries){ const res=await rpc(CFG.RPC.HAS_ACCESS,body); if(!res.ok)continue; if(res.data===true)return true; if(res.data?.ok===true)return true; if(res.data?.access===true)return true; if(res.data?.has_access===true)return true; }
    return false;
  }

  function parseVerifyPinPayload(data,fallbackPhone=""){
    const raw=Array.isArray(data)?data[0]:data; if(!raw)return null;
    if(typeof raw==="object"&&!Array.isArray(raw)){
      if(raw.ok===true)return{ok:true,phone:normPhone(raw.phone||raw.p_phone||fallbackPhone||""),module:upper(raw.module||raw.p_module||MODULE),owner_id:raw.owner_id||null};
      const vals=Object.values(raw);
      if(vals.length>=3){const okLike=vals[0]===true||vals[0]==="t"||vals[0]==="true"||vals[0]===1;if(okLike)return{ok:true,module:upper(vals[1]||MODULE),phone:normPhone(vals[2]||fallbackPhone||""),owner_id:vals[4]||null};}
    }
    if(typeof raw==="string"){
      const txt=raw.trim();
      if(txt.startsWith("(")&&txt.endsWith(")")){
        const tupleHead=txt.match(/^\(([^,]+),([^,]+),([^,]+),?(.*)\)$/);
        if(tupleHead){const okToken=String(tupleHead[1]||"").trim().replace(/^"|"$/g,"");const okLike=okToken==="t"||okToken==="true"||okToken==="1";if(okLike)return{ok:true,module:upper(String(tupleHead[2]||"").trim().replace(/^"|"$/g,"")||MODULE),phone:normPhone(String(tupleHead[3]||"").trim().replace(/^"|"$/g,"")||fallbackPhone||""),owner_id:null};}
      }
    }
    return null;
  }

  async function attemptPinLoginRPCs(slug, pin, phone){
    const s  = normSlug(slug);
    const p  = normPin(pin);
    const ph = normPhone(phone);

    if(!s||!p)return null;

    /* ━━━ CORRIGÉ : verify_access_pin attend { p_slug, p_pin }
       AVANT : { p_phone, p_module, p_pin } → params inconnus → RPC retournait null
       APRÈS : { p_slug, p_pin } = Rail de l'Infini canonique (go_pins table)  ━━━ */
    const tries=[
      { p_slug: s, p_pin: p },
      { p_phone: ph, p_pin: p }    // fallback si slug vide
    ];

    for(const body of tries){
      const res=await rpc(CFG.RPC.VERIFY_PIN,body);
      if(!res.ok)continue;
      const parsed=parseVerifyPinPayload(res.data,ph);
      if(!parsed?.ok)continue;
      return{ ok:true, slug:s, phone:normPhone(parsed.phone||ph), owner_id:parsed.owner_id||null };
    }
    return null;
  }

  const stored    = readStoredSession();
  const savedSlug = readSavedSlug();
  const savedPhone= readSavedPhone();

  const state = {
    module:    MODULE,
    slug:      normSlug(slugQ||stored?.slug||savedSlug||""),
    phone:     normPhone(phoneQ||stored?.phone||savedPhone||""),
    owner_id:  stored?.owner_id||null,
    access:    false, access_ok:false, preview:true, ready_flag:false, error:null,
    source:    stored?"session":(slugQ||phoneQ)?"query":(savedSlug||savedPhone)?"storage":"none",
    verified_at: stored?.verified_at||null,
    validated_at:stored?.validated_at||null,
    pin_url:"", pay_url:""
  };

  let pendingPromise=null;

  async function loginWithPin(slug,pin){
    const s=normSlug(slug); const p=normPin(pin);
    /* ━━━ AVANT : "Slug manquant." → banni ━━━ */
    if(!s)return{ok:false,error:"Identifiant manquant."};
    if(!p)return{ok:false,error:"PIN manquant."};

    let phone=normPhone(state.phone||readSavedPhone()||"");
    if(!phone){ const sub=await resolveSubBySlug(s); phone=normPhone(sub?.phone||""); }
    /* ━━━ AVANT : "Slug inconnu (phone non résolu)." → banni ━━━ */
    if(!phone)return{ok:false,error:"Identifiant inconnu (téléphone non résolu)."};

    const auth=await attemptPinLoginRPCs(s,p,phone);
    if(!auth?.ok)return{ok:false,error:"PIN invalide."};

    const finalPhone=normPhone(auth.phone||phone);
    const finalOwnerId=auth.owner_id||null;
    const accessOk=await checkAccess(finalPhone);
    if(!accessOk)return{ok:false,error:"Abonnement inactif."};

    const saved=saveSession({slug:s,phone:finalPhone,owner_id:finalOwnerId,access:true,verified_at:nowMs(),validated_at:nowIso()});
    state.slug=saved.slug; state.phone=saved.phone; state.owner_id=saved.owner_id;
    state.access=true; state.access_ok=true; state.preview=false; state.ready_flag=true; state.error=null;
    state.verified_at=saved.verified_at; state.validated_at=saved.validated_at;
    state.pin_url=buildPinUrl(saved); state.pay_url=buildPayUrl(saved);
    ensureUrlIdentity(saved.slug,saved.phone); showPage();
    return{ok:true,slug:saved.slug,phone:saved.phone,owner_id:saved.owner_id||null};
  }

  function logout(){
    clearAllLocalState();
    state.slug=""; state.phone=""; state.owner_id=null;
    state.access=false; state.access_ok=false; state.preview=true;
    state.ready_flag=false; state.error=null;
    state.verified_at=null; state.validated_at=null;
    showPage(); goPin({});
  }

  async function check(){
    const storedSession=readStoredSession(); const persistedSlug=readSavedSlug(); const persistedPhone=readSavedPhone();
    let slug=normSlug(slugQ||storedSession?.slug||state.slug||persistedSlug||"");
    let phone=normPhone(phoneQ||storedSession?.phone||state.phone||persistedPhone||"");
    let owner_id=storedSession?.owner_id||state.owner_id||null;
    let verifiedAt=Number(storedSession?.verified_at||state.verified_at||0)||0;
    let validatedAt=storedSession?.validated_at||state.validated_at||null;

    state.slug=slug; state.phone=phone; state.owner_id=owner_id;
    state.verified_at=verifiedAt; state.validated_at=validatedAt;
    state.pin_url=buildPinUrl({slug,phone}); state.pay_url=buildPayUrl({slug,phone}); state.error=null;

    if(slug)saveSlugOnly(slug); if(phone)savePhoneOnly(phone);
    if(slug&&!phone){const sub=await resolveSubBySlug(slug);if(sub?.phone){phone=normPhone(sub.phone);state.phone=phone;savePhoneOnly(phone);}}
    if(phone&&!slug){const sub=await resolveSubByPhone(phone);if(sub?.slug){slug=normSlug(sub.slug);state.slug=slug;saveSlugOnly(slug);}}
    state.pin_url=buildPinUrl({slug,phone}); state.pay_url=buildPayUrl({slug,phone});

    if(!slug&&!phone){
      if(CFG.ALLOW_PREVIEW_WITHOUT_IDENTITY){state.access=false;state.access_ok=false;state.preview=true;state.ready_flag=true;state.error="Identité absente.";showPage();return{...state};}
      clearSessionsOnly();state.access=false;state.access_ok=false;state.preview=true;state.ready_flag=true;state.error="Identité absente.";showPage();goPin({slug,phone});return{...state};
    }
    if(!slug){
      clearSessionsOnly();state.access=false;state.access_ok=false;state.preview=true;state.ready_flag=true;
      /* ━━━ AVANT : "Slug absent." → banni ━━━ */
      state.error="Identifiant absent.";showPage();goPin({slug,phone});return{...state};
    }

    const freshSession=!!verifiedAt&&isRecent(verifiedAt);
    if(!freshSession){
      clearSessionsOnly();if(slug)saveSlugOnly(slug);if(phone)savePhoneOnly(phone);
      state.access=false;state.access_ok=false;state.preview=true;state.ready_flag=true;
      state.error="Session PIN absente ou expirée.";showPage();goPin({slug,phone});return{...state};
    }

    state.access=true;state.access_ok=true;state.preview=false;state.ready_flag=true;state.error=null;
    const saved=saveSession({slug,phone,owner_id,access:true,verified_at:verifiedAt||nowMs(),validated_at:validatedAt||nowIso()});
    state.slug=saved.slug;state.phone=saved.phone;state.owner_id=saved.owner_id;
    state.verified_at=saved.verified_at;state.validated_at=saved.validated_at;
    state.pin_url=buildPinUrl(saved);state.pay_url=buildPayUrl(saved);
    ensureUrlIdentity(saved.slug,saved.phone);showPage();
    return{...state};
  }

  function ready(){
    hidePage();
    if(state.ready_flag){showPage();return Promise.resolve({...state});}
    if(!pendingPromise){pendingPromise=check().finally(()=>{pendingPromise=null;});}
    return pendingPromise;
  }

  window.DIGIY_GUARD = {
    state, ready,
    async refresh(){ state.ready_flag=false; state.error=null; pendingPromise=null; return ready(); },
    getSession(){ return{...state}; },
    getSlug(){ return normSlug(state.slug||""); },
    getPhone(){ return normPhone(state.phone||""); },
    getOwnerId(){ return state.owner_id||null; },
    getModule(){ return MODULE; },
    isAuthenticated(){ return !!state.access_ok; },
    saveSession(payload={}){
      const saved=saveSession(payload);
      state.slug=saved.slug;state.phone=saved.phone;state.owner_id=saved.owner_id||null;
      state.access=!!saved.access;state.access_ok=!!saved.access;state.preview=!saved.access;
      state.verified_at=saved.verified_at;state.validated_at=saved.validated_at;
      state.ready_flag=true;state.error=null;
      state.pin_url=buildPinUrl(saved);state.pay_url=buildPayUrl(saved);
      return saved;
    },
    clearSession(){ clearSessionsOnly();state.access=false;state.access_ok=false;state.preview=true;state.ready_flag=false;state.error=null; },
    clearAll(){ clearAllLocalState();state.access=false;state.access_ok=false;state.preview=true;state.ready_flag=false;state.error=null;state.slug="";state.phone="";state.owner_id=null;state.verified_at=null;state.validated_at=null; },
    loginWithPin, logout,
    buildPinUrl(input={}){ return buildPinUrl({...state,...input}); },
    goPin(input={}){ goPin({...state,...input}); },
    buildPayUrl(input={}){ return buildPayUrl({...state,...input}); },
    goPay(input={}){ goPay({...state,...input}); },
    async resolveSubBySlug(slug){ return resolveSubBySlug(slug); },
    async resolveSubByPhone(phone){ return resolveSubByPhone(phone); },
    async checkAccess(phone){ return checkAccess(phone||state.phone||""); }
  };

  ready();
})();;
