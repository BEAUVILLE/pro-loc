<script>
  window.DIGIY_SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  window.DIGIY_SUPABASE_ANON_KEY = "sb_publishable_tGHItRgeWDmGjnd0CK1DVQ_BIep4Ug3";
  window.DIGIY_SUPABASE_ANON = window.DIGIY_SUPABASE_ANON_KEY;
  window.DIGIY_MODULE = "LOC";
  window.DIGIY_LOGIN_URL = "./pin.html";
</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="./guard.js"></script>
<script>
  window.DIGIY_GUARD.ready().then(function(result){
    if(result && result.ok){
      console.log("LOC guard OK", window.DIGIY_GUARD.state);
    }
  });
</script>
