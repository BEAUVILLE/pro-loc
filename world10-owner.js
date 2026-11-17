/* DIGIY LOC · only one owner authentication path.
 * The standalone LOC entry is a router, not a second subscription/authentication gate.
 * Wolof labels should be reviewed with a native speaker. */
(()=>{
"use strict";
const translations={"fr":{"heading":"Votre espace propriétaire LOC.","intro":"Depuis votre fiche PRO, le bouton Propriétaire est le bon chemin. Choisissez ci-dessous la fiche voulue pour conserver son identifiant.","open":"🔐 OUVRIR MON ESPACE PROPRIÉTAIRE","security":"La connexion et les droits d’accès sont vérifiés dans l’espace propriétaire. Cette page n’envoie plus de second Magic Link et ne crée aucun compte.","back":"← RETOUR DIGIYLYFE","choose":"Choisissez votre fiche professionnelle pour ouvrir le bon calendrier. Ne passez pas par une entrée générale sans logement.","saly":"🔐 CHEZ BAPTISTE · SALY — ACCÈS PROPRIÉTAIRE","sarlat":"🔐 CHEZ BAPTISTE · SARLAT — ACCÈS PROPRIÉTAIRE","other":"Autre hébergement : passez par le bouton 🔐 Propriétaire de votre fiche PRO pour conserver son identifiant.","site":"🔐 OUVRIR CET HÉBERGEMENT"},"en":{"heading":"Your LOC owner workspace.","intro":"The Owner button on your PRO profile is the correct route. Select your property below to preserve its identifier.","open":"🔐 OPEN MY OWNER WORKSPACE","security":"Sign-in and permissions are verified in the owner workspace. This page sends no second Magic Link and creates no accounts.","back":"← BACK TO DIGIYLYFE","choose":"Choose your professional property to open the correct calendar. Do not use a generic entry with no property selected.","saly":"🔐 CHEZ BAPTISTE · SALY — OWNER ACCESS","sarlat":"🔐 CHEZ BAPTISTE · SARLAT — OWNER ACCESS","other":"Other property: use the 🔐 Owner button on your PRO profile to retain its identifier.","site":"🔐 OPEN THIS PROPERTY"},"es":{"heading":"Tu espacio propietario LOC.","intro":"El botón Propietario de tu ficha PRO es la vía correcta. Elige tu alojamiento para conservar su identificador.","open":"🔐 ABRIR MI ESPACIO PROPIETARIO","security":"La conexión y los permisos se verifican en el espacio propietario. Esta página no envía otro enlace ni crea cuentas.","back":"← VOLVER A DIGIYLYFE","choose":"Elige tu ficha profesional para abrir el calendario correcto. No uses un acceso genérico sin alojamiento.","saly":"🔐 CHEZ BAPTISTE · SALY — ACCESO PROPIETARIO","sarlat":"🔐 CHEZ BAPTISTE · SARLAT — ACCESO PROPIETARIO","other":"Otro alojamiento: usa el botón 🔐 Propietario de tu ficha PRO para conservar su identificador.","site":"🔐 ABRIR ESTE ALOJAMIENTO"},"pt":{"heading":"O seu espaço proprietário LOC.","intro":"O botão Proprietário na sua ficha PRO é o caminho correto. Escolha o alojamento para manter o identificador.","open":"🔐 ABRIR O MEU ESPAÇO PROPRIETÁRIO","security":"A autenticação e os direitos são verificados no espaço proprietário. Esta página não envia outro Magic Link nem cria contas.","back":"← VOLTAR À DIGIYLYFE","choose":"Escolha a sua ficha profissional para abrir o calendário correto. Não use um acesso genérico sem alojamento.","saly":"🔐 CHEZ BAPTISTE · SALY — ACESSO PROPRIETÁRIO","sarlat":"🔐 CHEZ BAPTISTE · SARLAT — ACESSO PROPRIETÁRIO","other":"Outro alojamento: utilize o botão 🔐 Proprietário na sua ficha PRO para manter o identificador.","site":"🔐 ABRIR ESTE ALOJAMENTO"},"de":{"heading":"Ihr LOC-Eigentümerbereich.","intro":"Die Schaltfläche Eigentümer in Ihrem PRO-Profil ist der richtige Weg. Wählen Sie Ihr Objekt, damit seine Kennung erhalten bleibt.","open":"🔐 EIGENTÜMERBEREICH ÖFFNEN","security":"Anmeldung und Berechtigungen werden im Eigentümerbereich geprüft. Diese Seite verschickt keinen zweiten Login-Link und erstellt keine Konten.","back":"← ZURÜCK ZU DIGIYLYFE","choose":"Wählen Sie Ihr Objekt für den richtigen Kalender. Kein allgemeiner Zugang ohne ausgewählte Unterkunft.","saly":"🔐 CHEZ BAPTISTE · SALY — EIGENTÜMERZUGANG","sarlat":"🔐 CHEZ BAPTISTE · SARLAT — EIGENTÜMERZUGANG","other":"Anderes Objekt: Verwenden Sie die Schaltfläche 🔐 Eigentümer in Ihrem PRO-Profil, damit die Kennung erhalten bleibt.","site":"🔐 DIESES OBJEKT ÖFFNEN"},"it":{"heading":"Il tuo spazio proprietario LOC.","intro":"Il pulsante Proprietario della tua scheda PRO è il percorso corretto. Seleziona la struttura per conservarne l'identificativo.","open":"🔐 APRI IL MIO SPAZIO PROPRIETARIO","security":"Accesso e permessi sono verificati nello spazio proprietario. Questa pagina non invia altri Magic Link né crea account.","back":"← TORNA A DIGIYLYFE","choose":"Scegli la tua scheda professionale per aprire il calendario corretto. Evita l'accesso generico senza struttura.","saly":"🔐 CHEZ BAPTISTE · SALY — ACCESSO PROPRIETARIO","sarlat":"🔐 CHEZ BAPTISTE · SARLAT — ACCESSO PROPRIETARIO","other":"Altra struttura: usa il pulsante 🔐 Proprietario sulla tua scheda PRO per mantenere l'identificativo.","site":"🔐 APRI QUESTA STRUTTURA"},"nl":{"heading":"Je LOC-eigenaarsruimte.","intro":"De knop Eigenaar op je PRO-profiel is de juiste route. Kies hieronder je accommodatie zodat de identificatie behouden blijft.","open":"🔐 MIJN EIGENAARSRUIMTE OPENEN","security":"Inloggen en toegangsrechten worden gecontroleerd in de eigenaarsruimte. Deze pagina verstuurt geen tweede inloglink en maakt geen account aan.","back":"← TERUG NAAR DIGIYLYFE","choose":"Kies je professionele accommodatie voor de juiste kalender. Gebruik geen algemene toegang zonder accommodatie.","saly":"🔐 CHEZ BAPTISTE · SALY — EIGENAARSTOEGANG","sarlat":"🔐 CHEZ BAPTISTE · SARLAT — EIGENAARSTOEGANG","other":"Andere accommodatie: gebruik de knop 🔐 Eigenaar op je PRO-profiel om de identificatie te behouden.","site":"🔐 DEZE ACCOMMODATIE OPENEN"},"ar":{"heading":"مساحة مالك LOC الخاصة بك.","intro":"زر المالك في صفحتك المهنية هو الطريق الصحيح. اختر مكان الإقامة للحفاظ على معرّفه.","open":"🔐 فتح مساحة المالك","security":"يتم التحقق من تسجيل الدخول والصلاحيات داخل مساحة المالك. هذه الصفحة لا ترسل رابط دخول ثانيًا ولا تنشئ حسابات.","back":"العودة إلى DIGIYLYFE →","choose":"اختر صفحة مكان الإقامة لفتح التقويم الصحيح. لا تستخدم مدخلاً عامًا دون تحديد العقار.","saly":"🔐 CHEZ BAPTISTE · SALY — دخول المالك","sarlat":"🔐 CHEZ BAPTISTE · SARLAT — دخول المالك","other":"لعقار آخر: استخدم زر 🔐 المالك في صفحتك المهنية للاحتفاظ بمعرّف العقار.","site":"🔐 فتح هذا العقار"},"wo":{"heading":"Sa bérébu boroom LOC.","intro":"Butonu Boroom ci sa fich PRO mooy yoon wi jub. Tànnal sa dalukaay ngir aar slug bi.","open":"🔐 UBBI SAMA BÉRÉBU BOROOM","security":"Dugg ak sañ-sañ yi dañuy leen seet ci bérébu boroom. Xët wii du yonnee ñaareelu Magic Link, du sos kont bu bees.","back":"← DELLU DIGIYLYFE","choose":"Tànnal sa fich pro ngir ubbi kalandiriye bu jub. Bul jëfandikoo dugg bu amul turu dalukaay.","saly":"🔐 CHEZ BAPTISTE · SALY — DUGGUB BOROOM","sarlat":"🔐 CHEZ BAPTISTE · SARLAT — DUGGUB BOROOM","other":"Beneen dalukaay: jëfandikool butonu 🔐 Boroom ci sa fich PRO ngir aar slug bi.","site":"🔐 UBBI DALUKAAY BII"},"zh":{"heading":"您的 LOC 业主工作台。","intro":"商家主页上的“业主”按钮才是正确入口。请在下方选择房源以保留其标识。","open":"🔐 打开我的业主工作台","security":"登录身份与权限均由业主工作台验证。此页面不再发送第二个登录链接，也不会创建账户。","back":"← 返回 DIGIYLYFE","choose":"选择商家房源以打开对应日历。不要通过没有指定房源的通用入口进入。","saly":"🔐 CHEZ BAPTISTE · SALY — 业主入口","sarlat":"🔐 CHEZ BAPTISTE · SARLAT — 业主入口","other":"其他房源：请通过商家主页上的 🔐 业主按钮进入，以保留房源标识。","site":"🔐 打开此房源"}};
const supported=Object.keys(translations);
const params=new URLSearchParams(location.search);
let lang=params.get("lang");
if(!supported.includes(lang)){try{lang=localStorage.getItem("digiy_loc_owner_lang")}catch(_){}}
if(!supported.includes(lang))lang="fr";
const rawSite=(params.get("site")||"").trim();
const site=/^[a-z0-9][a-z0-9-]{0,79}$/.test(rawSite)?rawSite:"";
const picker=document.getElementById("locWorld10Picker");
const ownerLink=document.getElementById("ownerLink");
const sarlatLink=document.getElementById("sarlatLink");
const customLink=document.getElementById("customOwnerLink");
function ownerUrl(slug){
  const url=new URL("https://pro-espace.digiylyfe.com/");
  url.searchParams.set("site",slug);
  url.searchParams.set("lang",lang);
  return url.href;
}
function render(){
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==="ar"?"rtl":"ltr";
  const value=translations[lang];
  for(const el of document.querySelectorAll("[data-i18n]")){
    const key=el.getAttribute("data-i18n");
    if(Object.prototype.hasOwnProperty.call(value,key))el.textContent=value[key];
  }
  if(picker)picker.value=lang;
  // These are the exact site-scoped routes used by the existing professional fiches.
  if(ownerLink)ownerLink.href=ownerUrl("saly-chez-baptiste");
  if(sarlatLink)sarlatLink.href=ownerUrl("sarlat-chez-baptiste");
  if(customLink){
    const externalSite=site&&site!=="saly-chez-baptiste"&&site!=="sarlat-chez-baptiste";
    customLink.hidden=!externalSite;
    if(externalSite)customLink.href=ownerUrl(site);
    else customLink.removeAttribute("href");
  }
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
