(function(){
  const clean = (u)=>u.split("?")[0].split("#")[0].toLowerCase();
  const current = clean(location.pathname);

  document.querySelectorAll(".nav a").forEach(a=>{
    const href = a.getAttribute("href");
    if(!href) return;

    const target = clean(new URL(href, location.href).pathname);

    if(current.endsWith(target)){
      a.classList.add("active");
    }
  });
})();
