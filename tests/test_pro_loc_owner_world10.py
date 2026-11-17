"""DIGIY LOC owner: WORLD10 and strict separation of account sign-in vs paid entitlement."""
import json
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = (ROOT / "index.html").read_text(encoding="utf-8")
I18N = (ROOT / "world10-owner.js").read_text(encoding="utf-8")


class ProLocOwnerWorld10(unittest.TestCase):
    def test_languages_visible_before_javascript(self):
        self.assertEqual(PAGE.count('id="locWorld10Picker"'), 1)
        values = re.findall(r'<option value="([a-z]{2})">', PAGE)
        self.assertEqual(values, ['fr','en','es','pt','de','it','nl','ar','wo','zh'])
        self.assertIn('<script src="./world10-owner.js?v=20261117-auth-entitlement-v1"></script>', PAGE)
        self.assertLess(PAGE.index('locWorld10Picker'), PAGE.index('world10-owner.js'))
        self.assertIn('const langs=["fr","en","es","pt","de","it","nl","ar","wo","zh"]', I18N)
        m = re.search(r'const rows=(\[.*\]);\nconst dict=', I18N)
        self.assertIsNotNone(m)
        rows = json.loads(m.group(1))
        self.assertGreaterEqual(len(rows), 20)
        self.assertEqual(len(rows), len({row[0] for row in rows}))
        for row in rows:
            self.assertEqual(len(row), 10)
            self.assertTrue(all(isinstance(s, str) and s.strip() for s in row))

    def test_magic_link_auth_independent_of_loc_subscription(self):
        self.assertIn("sb.auth.signInWithOtp(", PAGE)
        self.assertIn("options:{shouldCreateUser:false", PAGE)
        self.assertIn("emailRedirectTo:location.origin+location.pathname", PAGE)
        self.assertNotIn("/functions/v1/digiy-loc-magic-link", PAGE)
        self.assertNotIn("règlement annuel", PAGE)
        self.assertNotIn("Aucun lien n’est envoyé si le droit LOC n’est pas actif.", PAGE)
        self.assertIn("Le Magic Link vérifie votre identité", PAGE)
        self.assertIn("Si ce compte DIGIY existe, vérifiez votre e-mail.", PAGE)

    def test_loc_access_strictly_gated_after_authentication(self):
        self.assertIn("ACCESS=U+'/functions/v1/digiy-loc-owner-access'", PAGE)
        self.assertIn("await sb.auth.getSession()", PAGE)
        self.assertIn("Authorization':'Bearer '+session.access_token", PAGE)
        self.assertIn("if(r.status===403)", PAGE)
        self.assertIn("if(r.status===401)", PAGE)
        self.assertIn("if(!r.ok||!j.ok)throw Error", PAGE)
        self.assertIn("showRestricted(", PAGE)
        self.assertIn('id="restricted"', PAGE)
        self.assertIn("restricted.hidden=false", PAGE)
        self.assertIn("restricted.hidden=true", PAGE)
        self.assertIn("$('#fiche').removeAttribute('href')", PAGE)
        self.assertIn("await sb.auth.signOut()", PAGE)
        self.assertIn("if(typeof j.professional_url==='string'", PAGE)
        self.assertNotIn("MAGIC=U+", PAGE)

    def test_owner_data_and_locales_remain_untouched(self):
        self.assertIn("new Date(j.paid_until)", PAGE)
        self.assertIn("DIGIY_LOC_OWNER_WORLD10?.t?.('Période active jusqu’au ')", PAGE)
        self.assertIn("DIGIY_LOC_OWNER_WORLD10?.locale?.()", PAGE)
        self.assertIn("name.textContent=String(j.business", PAGE)
        self.assertIn('parent.closest("input,textarea,script,style,#meta,#locWorld10Picker")', I18N)
        self.assertIn('document.documentElement.dir=lang==="ar"?"rtl":"ltr"', I18N)
        for unsafe in ('.rpc(', 'fetch(', 'supabase.createClient', 'innerHTML='):
            self.assertNotIn(unsafe, I18N)

    def test_javascript_syntax(self):
        p=subprocess.run(['node','--check',str(ROOT/'world10-owner.js')],capture_output=True,text=True)
        self.assertEqual(p.returncode,0,p.stderr)
        for attrs, js in re.findall(r'<script\b([^>]*)>([\s\S]*?)</script>', PAGE):
            if "src=" in attrs or not js.strip():
                continue
            p=subprocess.run(['node','--check','-'],input=js,capture_output=True,text=True)
            self.assertEqual(p.returncode,0,p.stderr)


if __name__=='__main__':
    unittest.main()
