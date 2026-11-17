/* LOC owner door WORLD10 — UI strings only, no auth or server changes. */
(()=>{
"use strict";
const langs=["fr","en","es","pt","de","it","nl","ar","wo","zh"];
const locales=["fr-FR","en-GB","es-ES","pt-PT","de-DE","it-IT","nl-NL","ar-SA","wo-SN","zh-CN"];
const rows=[["DIGIY LOC — Accès propriétaire","DIGIY LOC — Owner access","DIGIY LOC — Acceso propietario","DIGIY LOC — Acesso proprietário","DIGIY LOC — Eigentümerzugang","DIGIY LOC — Accesso proprietario","DIGIY LOC — Eigenaarstoegang","DIGIY LOC — دخول المالك","DIGIY LOC — Duggub boroom","DIGIY LOC — 业主入口"],["ACCÈS PROPRIÉTAIRE","OWNER ACCESS","ACCESO PROPIETARIO","ACESSO PROPRIETÁRIO","EIGENTÜMERZUGANG","ACCESSO PROPRIETARIO","EIGENAARSTOEGANG","دخول المالك","DUGGUB BOROOM","业主入口"],["Cette porte est réservée aux adhérents LOC dont le","This entrance is for LOC members whose","Este acceso es para miembros LOC cuyo","Este acesso é para membros LOC cujo","Dieser Zugang ist für LOC-Mitglieder, deren","Questo accesso è riservato ai membri LOC con","Deze toegang is voor LOC-leden van wie de","هذا المدخل مخصص لأعضاء LOC الذين","Bunt bii ngir adhérant LOC yi nga xam ne","此入口仅供满足条件的 LOC 会员使用，其"],["bon à tirer est accepté","approval has been accepted","documento ha sido aprobado","documento foi aprovado","Freigabe erteilt wurde","documento è stato approvato","goedkeuring is bevestigd","تم قبول الموافقة","BAT bi ñu nangu","审核已通过"],["et le","and the","y el","e o","und deren","e il","en de","و","ak","并且"],["règlement annuel confirmé","annual payment is confirmed","pago anual está confirmado","pagamento anual está confirmado","Jahreszahlung bestätigt ist","pagamento annuale è confermato","jaarlijkse betaling is bevestigd","تم تأكيد الدفع السنوي","paiement annuel bi ñu dëggal","年度付款已确认"],["Contrôle de votre accès sécurisé…","Checking your secure access…","Comprobando tu acceso seguro…","A verificar o acesso seguro…","Sicherer Zugang wird geprüft…","Verifica dell'accesso sicuro…","Beveiligde toegang controleren…","جارٍ التحقق من الوصول الآمن…","Seet sa dugg bu wóor…","正在检查安全访问…"],["E-mail utilisé pour votre dossier LOC","Email used for your LOC account","Correo de tu expediente LOC","Email usado no seu processo LOC","E-Mail für Ihr LOC-Konto","Email del tuo account LOC","E-mail voor je LOC-dossier","البريد الإلكتروني لملف LOC","Imeel bi ci sa dosiye LOC","LOC 档案邮箱"],["✉️ RECEVOIR MON MAGIC LINK","✉️ SEND MY SIGN-IN LINK","✉️ RECIBIR MI ENLACE","✉️ RECEBER O MEU LINK","✉️ LOGIN-LINK ERHALTEN","✉️ RICEVI IL LINK DI ACCESSO","✉️ INLOG-LINK ONTVANGEN","✉️ إرسال رابط الدخول","✉️ JOT SAMA LINK DUGG","✉️ 获取登录链接"],["Aucun lien n’est envoyé si le droit LOC n’est pas actif.","No link is sent unless LOC access is active.","No se envía enlace sin acceso LOC activo.","Não é enviado link sem acesso LOC ativo.","Ohne aktiven LOC-Zugang wird kein Link gesendet.","Nessun link senza accesso LOC attivo.","Geen link zonder actieve LOC-toegang.","لن يُرسل رابط دون صلاحية LOC نشطة.","Duñu yonnee link su sa sañ-sañ LOC doxul.","LOC 权限未激活则不会发送链接。"],["OUVRIR MA FICHE PROFESSIONNELLE →","OPEN MY PROFESSIONAL PROFILE →","ABRIR MI FICHA PROFESIONAL →","ABRIR A MINHA FICHA PROFISSIONAL →","MEIN BERUFSPROFIL ÖFFNEN →","APRI IL MIO PROFILO PROFESSIONALE →","MIJN PROFESSIONELE PAGINA OPENEN →","فتح صفحتي المهنية ←","UBBI SAMA FICH PRO →","打开我的商家主页 →"],["Votre droit LOC est actif. Les commandes propriétaire sont rattachées à votre fiche professionnelle ; elles ne sont jamais ouvertes au public.","Your LOC access is active. Owner controls belong to your professional profile and are never public.","Tu acceso LOC está activo. Los controles del propietario están vinculados a tu ficha, no son públicos.","O seu acesso LOC está ativo. Os controlos pertencem à sua ficha profissional e não são públicos.","Ihr LOC-Zugang ist aktiv. Eigentümerfunktionen gehören zu Ihrem Profil und sind nicht öffentlich.","Il tuo accesso LOC è attivo. I comandi sono collegati alla tua scheda e non sono pubblici.","Je LOC-toegang is actief. Eigenaarfuncties horen bij je profiel en zijn niet openbaar.","صلاحية LOC نشطة. أدوات المالك مرتبطة بملفك المهني ولا تظهر للعامة.","Sa sañ-sañ LOC dox na. Say jumtukaay boroom bokk nañu ci sa fich pro, duñu feeñ ci ñépp.","您的 LOC 权限已激活。业主功能仅关联商家主页，不向公众开放。"],["DÉCONNEXION","SIGN OUT","CERRAR SESIÓN","TERMINAR SESSÃO","ABMELDEN","ESCI","AFMELDEN","تسجيل الخروج","GÉNN","退出登录"],["← RETOUR DIGIYLYFE","← BACK TO DIGIYLYFE","← VOLVER A DIGIYLYFE","← VOLTAR À DIGIYLYFE","← ZURÜCK ZU DIGIYLYFE","← TORNA A DIGIYLYFE","← TERUG NAAR DIGIYLYFE","العودة إلى DIGIYLYFE →","← DELLU DIGIYLYFE","← 返回 DIGIYLYFE"],["Aucune session LOC active. Recevez votre magic link après confirmation de votre règlement.","No active LOC session. Request your sign-in link after payment is confirmed.","No hay sesión LOC activa. Solicita el enlace tras confirmar el pago.","Sem sessão LOC ativa. Peça o link após confirmação do pagamento.","Keine aktive LOC-Sitzung. Link nach bestätigter Zahlung anfordern.","Nessuna sessione LOC attiva. Richiedi il link dopo la conferma del pagamento.","Geen actieve LOC-sessie. Vraag de link aan zodra je betaling bevestigd is.","لا توجد جلسة LOC نشطة. اطلب الرابط بعد تأكيد الدفع.","Amul sesiyoŋ LOC bu dox. Laajal link gannaaw dëggalu paiement.","没有有效 LOC 会话。付款确认后请申请登录链接。"],["✅ MAGIC LINK AUTHENTIFIÉ · ✅ DROIT LOC ACTIF","✅ SIGN-IN VERIFIED · ✅ LOC ACCESS ACTIVE","✅ ENLACE VERIFICADO · ✅ LOC ACTIVO","✅ LINK VERIFICADO · ✅ LOC ATIVO","✅ LOGIN VERIFIZIERT · ✅ LOC AKTIV","✅ ACCESSO VERIFICATO · ✅ LOC ATTIVO","✅ LOGIN BEVESTIGD · ✅ LOC ACTIEF","✅ تم التحقق من الرابط · ✅ LOC نشط","✅ Dugg bi dëggal na · ✅ LOC dox na","✅ 登录已验证 · ✅ LOC 权限已激活"],["Période active jusqu’au ","Active until ","Activo hasta ","Ativo até ","Aktiv bis ","Attivo fino al ","Actief tot ","صالح حتى ","Dina dox ba ","有效期至 "],["Accès LOC refusé : le BAT et le règlement annuel doivent être validés et la période doit être active.","LOC access denied: approval and annual payment must be confirmed and the period active.","Acceso LOC denegado: deben aprobarse el documento y el pago anual, y el período debe estar activo.","Acesso LOC recusado: documento e pagamento anual devem estar confirmados e o período ativo.","LOC-Zugang verweigert: Freigabe und Jahreszahlung müssen bestätigt und die Laufzeit aktiv sein.","Accesso LOC negato: approvazione e pagamento annuale confermati e periodo attivo richiesti.","LOC-toegang geweigerd: goedkeuring en jaarlijkse betaling moeten bevestigd zijn en de periode actief.","رفض دخول LOC: يجب تأكيد الموافقة والدفع السنوي وصلاحية الفترة.","Bañ nañu dugg LOC: BAT ak paiement annuel war nañu dëggal, diir bi dox.","LOC 访问被拒绝：须确认审核、年度付款，且有效期未过。"],["Indiquez un e-mail valide.","Enter a valid email.","Introduce un correo válido.","Indique um email válido.","Gültige E-Mail eingeben.","Inserisci un'email valida.","Voer een geldig e-mailadres in.","أدخل بريدًا إلكترونيًا صالحًا.","Bindal imeel bu baax.","请输入有效邮箱。"],["Vérification du droit LOC avant envoi…","Checking LOC eligibility before sending…","Comprobando acceso LOC antes de enviar…","A verificar direito LOC antes de enviar…","LOC-Berechtigung wird geprüft…","Verifica diritto LOC prima dell'invio…","LOC-toegang controleren vóór verzending…","جارٍ فحص صلاحية LOC قبل الإرسال…","Seet sa sañ-sañ LOC bala yonnee…","发送前正在验证 LOC 权限…"],["✅ Magic link envoyé. Consultez votre e-mail.","✅ Sign-in link sent. Check your email.","✅ Enlace enviado. Revisa tu correo.","✅ Link enviado. Verifique o email.","✅ Login-Link gesendet. E-Mail prüfen.","✅ Link inviato. Controlla la tua email.","✅ Inloglink verzonden. Controleer je e-mail.","✅ أُرسل الرابط. تحقق من بريدك.","✅ Yónnee nañu link bi. Seetal sa imeel.","✅ 登录链接已发送，请查收邮件。"],["Aucun accès LOC actif pour cet e-mail. Aucun lien envoyé.","No active LOC access for this email. No link sent.","No hay acceso LOC activo para este correo. No se envió enlace.","Sem acesso LOC ativo para este email. Nenhum link enviado.","Kein aktiver LOC-Zugang für diese E-Mail. Kein Link gesendet.","Nessun accesso LOC attivo per questa email. Nessun link inviato.","Geen actieve LOC-toegang voor deze e-mail. Geen link verzonden.","لا يوجد وصول LOC نشط لهذا البريد. لم يُرسل رابط.","Amul dugg LOC bu dox ngir imeel bii. Yónneewuñu link.","此邮箱没有有效 LOC 权限，未发送链接。"],["Session fermée.","Signed out.","Sesión cerrada.","Sessão terminada.","Abgemeldet.","Sessione terminata.","Afgemeld.","تم تسجيل الخروج.","Génn na.","已退出登录。"],["Envoi temporairement impossible. ","Unable to send right now. ","No se puede enviar ahora. ","Não é possível enviar agora. ","Versand vorübergehend nicht möglich. ","Invio temporaneamente non disponibile. ","Verzenden tijdelijk niet mogelijk. ","يتعذر الإرسال مؤقتًا. ","Mënuñu yonnee léegi. ","暂时无法发送。"]];
const dict=new Map(rows.map(r=>[r[0],r]));
let lang=new URLSearchParams(location.search).get("lang");
if(!langs.includes(lang)){try{lang=localStorage.getItem("digiy_loc_owner_lang")}catch(_){}}
if(!langs.includes(lang))lang="fr";
const original=new WeakMap();
const idx=()=>langs.indexOf(lang);
function t(s){
 if(dict.has(s))return dict.get(s)[idx()];
 if(s.startsWith("Envoi temporairement impossible. "))
    return dict.get("Envoi temporairement impossible. ")[idx()]+s.slice("Envoi temporairement impossible. ".length);
 return s;
}
function translateNode(node){
 const parent=node.parentElement;
 if(!parent||parent.closest("input,textarea,script,style,#meta,#locWorld10Picker"))return;
 const now=node.nodeValue;
 let o=original.get(node);
 if(!o||o.last!==now){o={fr:now,last:now};original.set(node,o)}
 const raw=o.fr,trim=raw.trim();
 if(!trim)return;
 const k=raw.indexOf(trim);
 const translated=raw.slice(0,k)+t(trim)+raw.slice(k+trim.length);
 if(translated!==now){o.last=translated;node.nodeValue=translated}
}
function translate(){
 document.documentElement.lang=lang;
 document.documentElement.dir=lang==="ar"?"rtl":"ltr";
 const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 while(w.nextNode())translateNode(w.currentNode);
 const title=document.title;
 for(const r of rows){if(r.includes(title)&&r[0].includes("DIGIY LOC —")){document.title=r[idx()];break}}
 document.getElementById("locWorld10Picker").value=lang;
}
function setLang(next){
 if(!langs.includes(next))return;
 lang=next;
 try{localStorage.setItem("digiy_loc_owner_lang",lang)}catch(_){}
 const u=new URL(location.href);
 u.searchParams.set("lang",lang);
 history.replaceState(null,"",u.pathname+u.search+u.hash);
 translate();
}
const picker=document.getElementById("locWorld10Picker");
if(picker){
 picker.addEventListener("change",()=>setLang(picker.value));
 translate();
 new MutationObserver(()=>translate()).observe(document.body,{subtree:true,childList:true,characterData:true});
}
window.DIGIY_LOC_OWNER_WORLD10={getLang:()=>lang,locale:()=>locales[idx()],t,setLang,locales:langs.slice()};
})();
