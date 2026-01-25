(function(){
  "use strict";

  // ✅ Nettoyage URL → uniquement le fichier final
  function cleanPath(u){
    try{
      const p = new URL(u, location.href).pathname;
      const last = p.split("/").filter(Boolean).pop() || "";
      return last.toLowerCase();
    }catch{
      return "";
    }
  }

  // ✅ Page actuelle
  let current = cleanPath(location.href);

  // Cas spécial : dossier = index.html
  if(!current || current === ""){
    current = "index.html";
  }

  // ✅ Active le bon bouton
  document.querySelectorAll(".nav a").forEach(a=>{
    const href = a.getAttribute("href");
    if(!href) return;

    const target = cleanPath(href);

    if(target === current){
      a.classList.add("active");
    }
  });

})();
