"""One LOC entry, one canonical owner software; no duplicate Magic Link."""
import re
import subprocess
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PAGE=(ROOT/"index.html").read_text(encoding="utf-8")
JS=(ROOT/"world10-owner.js").read_text(encoding="utf-8")


class OwnerGate(unittest.TestCase):
    def test_visible_ten_languages(self):
        self.assertEqual(PAGE.count('id="locWorld10Picker"'),1)
        options=re.findall(r'<option value="([a-z]{2})">',PAGE)
        self.assertEqual(options,["fr","en","es","pt","de","it","nl","ar","wo","zh"])
        self.assertIn("world10-owner.js?v=20261117-canonical-owner",PAGE)
        for code in options:
            self.assertIn('"'+code+'":{',JS)
        self.assertIn('lang==="ar"?"rtl":"ltr"',JS)

    def test_single_canonical_proprietor_portal(self):
        self.assertIn('https://pro-espace.digiylyfe.com/?module=loc',PAGE)
        self.assertIn('https://pro-espace.digiylyfe.com/',JS)
        self.assertIn('u.searchParams.set("module","loc")',JS)
        self.assertIn('u.searchParams.set("lang",lang)',JS)
        self.assertIn('if(site)u.searchParams.set("site",site)',JS)
        self.assertIn('ownerLink.href=u.href',JS)
        self.assertIn('^[a-z0-9][a-z0-9-]{0,79}$',JS)
        self.assertNotIn('window.location.replace',JS)
        self.assertNotIn('location.replace(',JS)

    def test_no_second_auth_or_paid_gate_at_front_door(self):
        for code in (PAGE,JS):
            for fragment in ['signInWithOtp','supabase.createClient',
                             '/functions/v1/digiy-loc-magic-link',
                             '/functions/v1/digiy-loc-owner-access',
                             'await sb.auth.getSession()',
                             'shouldCreateUser:true']:
                self.assertNotIn(fragment,code)
        self.assertNotIn('RECEVOIR MON MAGIC LINK',PAGE)
        self.assertIn('data-i18n="open"',PAGE)
        self.assertIn('La connexion et les droits d’accès sont vérifiés dans l’espace propriétaire.',PAGE)

    def test_no_data_mutations_or_unauthorized_redirects(self):
        self.assertNotIn('fetch(',JS)
        self.assertNotIn('document.cookie',JS)
        self.assertNotIn('eval(',JS)
        self.assertIn('new URL("https://pro-espace.digiylyfe.com/")',JS)
        self.assertIn('u.searchParams.set("site",site)',JS)
        self.assertNotIn('window.open(',JS)

    def test_js_syntax(self):
        result=subprocess.run(["node","--check",str(ROOT/"world10-owner.js")],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)


if __name__=="__main__":
    unittest.main()
