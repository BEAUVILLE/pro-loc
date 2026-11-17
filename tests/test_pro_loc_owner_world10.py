"""DIGIY LOC · test the exact owner routes from the working professional fiches."""
import re
import subprocess
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PAGE=(ROOT/"index.html").read_text(encoding="utf-8")
JS=(ROOT/"world10-owner.js").read_text(encoding="utf-8")

class OwnerRoutes(unittest.TestCase):
    def test_visible_ten_languages(self):
        self.assertEqual(PAGE.count('id="locWorld10Picker"'),1)
        values=re.findall(r'<option value="([a-z]{2})">',PAGE)
        self.assertEqual(values,["fr","en","es","pt","de","it","nl","ar","wo","zh"])
        self.assertIn("world10-owner.js?v=20261117-owner-site-required",PAGE)
        for language in values:
            self.assertIn('"'+language+'":{',JS)
        self.assertIn('lang==="ar"?"rtl":"ltr"',JS)

    def test_exact_saly_and_sarlat_owner_links(self):
        self.assertIn('href="https://pro-espace.digiylyfe.com/?site=saly-chez-baptiste"',PAGE)
        self.assertIn('href="https://pro-espace.digiylyfe.com/?site=sarlat-chez-baptiste"',PAGE)
        self.assertIn('ownerUrl("saly-chez-baptiste")',JS)
        self.assertIn('ownerUrl("sarlat-chez-baptiste")',JS)
        self.assertIn('url.searchParams.set("site",slug)',JS)
        self.assertIn('url.searchParams.set("lang",lang)',JS)
        self.assertNotIn('searchParams.set("module","loc")',JS)
        self.assertNotIn('href="https://pro-espace.digiylyfe.com/?module=loc"',PAGE)
        self.assertIn('id="customOwnerLink"',PAGE)

    def test_other_properties_require_a_safe_site_slug(self):
        self.assertIn('^[a-z0-9][a-z0-9-]{0,79}$',JS)
        self.assertIn('customLink.hidden=!externalSite',JS)
        self.assertIn('if(externalSite)customLink.href=ownerUrl(site)',JS)
        self.assertNotIn('location.replace(',JS)
        self.assertNotIn('window.location=',JS)

    def test_no_second_magic_link_or_paid_gate(self):
        for code in (PAGE,JS):
            for fragment in ('signInWithOtp','supabase.createClient',
                             '/functions/v1/digiy-loc-magic-link',
                             '/functions/v1/digiy-loc-owner-access',
                             'shouldCreateUser:true','fetch('):
                self.assertNotIn(fragment,code)
        self.assertNotIn('RECEVOIR MON MAGIC LINK',PAGE)
        self.assertNotIn('await sb.auth.getSession()',PAGE)
        self.assertIn('data-i18n="saly"',PAGE)
        self.assertIn('data-i18n="sarlat"',PAGE)

    def test_js_syntax(self):
        result=subprocess.run(["node","--check",str(ROOT/"world10-owner.js")],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)


if __name__=="__main__":
    unittest.main()
