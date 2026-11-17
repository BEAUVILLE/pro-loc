/* DIGIY LOC · only one owner authentication path.
 * The standalone LOC entry is a router, not a second subscription/authentication gate.
 * Wolof labels should be reviewed with a native speaker. */
(()=>{
"use strict";
const translations={"fr":{"heading":"Votre espace propriétaire LOC.","intro":"Votre fiche professionnelle ouvre déjà le bon calendrier. Utilisez ce même accès sécurisé pour gérer vos hébergements, disponibilités, tarifs et réservations.","open":"🔐 OUVRIR MON ESPACE PROPRIÉTAIRE","security":"La connexion et les droits d’accès sont vérifiés dans l’espace propriétaire. Cette page n’envoie plus de second Magic Link et ne crée aucun compte.","back":"← RETOUR DIGIYLYFE"},"en":{"heading":"Your LOC owner workspace.","intro":"Your professional profile already opens the right calendar. Use the same secure access to manage your properties, availability, rates and bookings.","open":"🔐 OPEN MY OWNER WORKSPACE","security":"Sign-in and permissions are verified in the owner workspace. This page sends no second Magic Link and creates no accounts.","back":"← BACK TO DIGIYLYFE"},"es":{"heading":"Tu espacio propietario LOC.","intro":"Tu ficha profesional ya abre el calendario correcto. Usa el mismo acceso seguro para gestionar alojamientos, disponibilidad, tarifas y reservas.","open":"🔐 ABRIR MI ESPACIO PROPIETARIO","security":"La conexión y los permisos se verifican en el espacio propietario. Esta página no envía otro enlace ni crea cuentas.","back":"← VOLVER A DIGIYLYFE"},"pt":{"heading":"O seu espaço proprietário LOC.","intro":"A sua ficha profissional já abre o calendário correto. Utilize o mesmo acesso seguro para gerir alojamentos, disponibilidade, preços e reservas.","open":"🔐 ABRIR O MEU ESPAÇO PROPRIETÁRIO","security":"A autenticação e os direitos são verificados no espaço proprietário. Esta página não envia outro Magic Link nem cria contas.","back":"← VOLTAR À DIGIYLYFE"},"de":{"heading":"Ihr LOC-Eigentümerbereich.","intro":"Ihr Berufsprofil öffnet bereits den richtigen Kalender. Nutzen Sie denselben sicheren Zugang, um Unterkünfte, Verfügbarkeit, Preise und Buchungen zu verwalten.","open":"🔐 EIGENTÜMERBEREICH ÖFFNEN","security":"Anmeldung und Berechtigungen werden im Eigentümerbereich geprüft. Diese Seite verschickt keinen zweiten Login-Link und erstellt keine Konten.","back":"← ZURÜCK ZU DIGIYLYFE"},"it":{"heading":"Il tuo spazio proprietario LOC.","intro":"La tua scheda professionale apre già il calendario giusto. Usa lo stesso accesso sicuro per gestire alloggi, disponibilità, prezzi e prenotazioni.","open":"🔐 APRI IL MIO SPAZIO PROPRIETARIO","security":"Accesso e permessi sono verificati nello spazio proprietario. Questa pagina non invia altri Magic Link né crea account.","back":"← TORNA A DIGIYLYFE"},"nl":{"heading":"Je LOC-eigenaarsruimte.","intro":"Je professionele pagina opent al de juiste kalender. Gebruik dezelfde veilige toegang om accommodaties, beschikbaarheid, tarieven en reserveringen te beheren.","open":"🔐 MIJN EIGENAARSRUIMTE OPENEN","security":"Inloggen en toegangsrechten worden gecontroleerd in de eigenaarsruimte. Deze pagina verstuurt geen tweede inloglink en maakt geen account aan.","back":"← TERUG NAAR DIGIYLYFE"},"ar":{"heading":"مساحة مالك LOC الخاصة بك.","intro":"تفتح صفحتك المهنية التقويم الصحيح بالفعل. استخدم الدخول الآمن نفسه لإدارة أماكن الإقامة والتوفر والأسعار والحجوزات.","open":"🔐 فتح مساحة المالك","security":"يتم التحقق من تسجيل الدخول والصلاحيات داخل مساحة المالك. هذه الصفحة لا ترسل رابط دخول ثانيًا ولا تنشئ حسابات.","back":"العودة إلى DIGIYLYFE →"},"wo":{"heading":"Sa bérébu boroom LOC.","intro":"Sa fich pro dafay ubbi kalandiriye bi war. Jëfandikool benn dugg bu wóor ngir saytu say dalukaay, bés yu féex, njëg ak rezervaasiyoŋ.","open":"🔐 UBBI SAMA BÉRÉBU BOROOM","security":"Dugg ak sañ-sañ yi dañuy leen seet ci bérébu boroom. Xët wii du yonnee ñaareelu Magic Link, du sos kont bu bees.","back":"← DELLU DIGIYLYFE"},"zh":{"heading":"您的 LOC 业主工作台。","intro":"您的商家主页已经指向正确的日历。请使用同一安全入口管理房源、空房日期、价格和预订。","open":"🔐 打开我的业主工作台","security":"登录身份与权限均由业主工作台验证。此页面不再发送第二个登录链接，也不会创建账户。","back":"← 返回 DIGIYLYFE"}};
const supported=Object.keys(translations);
const params=new URLSearchParams(location.search);
let lang=params.get("lang");
if(!supported.includes(lang)){try{lang=localStorage.getItem("digiy_loc_owner_lang")}catch(_){}}
if(!supported.includes(lang))lang="fr";
const rawSite=(params.get("site")||"").trim();
const site=/^[a-z0-9][a-z0-9-]{0,79}$/.test(rawSite)?rawSite:"";
const picker=document.getElementById("locWorld10Picker");
const ownerLink=document.getElementById("ownerLink");
function render(){
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==="ar"?"rtl":"ltr";
  const value=translations[lang];
  for(const el of document.querySelectorAll("[data-i18n]")){
    const key=el.getAttribute("data-i18n");
    if(Object.prototype.hasOwnProperty.call(value,key))el.textContent=value[key];
  }
  if(picker)picker.value=lang;
  const u=new URL("https://pro-espace.digiylyfe.com/");
  u.searchParams.set("module","loc");
  u.searchParams.set("lang",lang);
  if(site)u.searchParams.set("site",site);
  if(ownerLink)ownerLink.href=u.href;
}
if(picker)picker.addEventListener("change",()=>{
  lang=supported.includes(picker.value)?picker.value:"fr";
  try{localStorage.setItem("digiy_loc_owner_lang",lang)}catch(_){}
  const u=new URL(location.href);u.searchParams.set("lang",lang);
  history.replaceState(null,"",u.pathname+u.search+u.hash);
  render();
});
render();
})();
