"""DIGIY PRO LOC actual owner Magic Link door · WORLD10 regression audit."""
import json
import re
import subprocess
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PAGE=(ROOT/"index.html").read_text(encoding="utf-8")
I18N=(ROOT/"world10-owner.js").read_text(encoding="utf-8")
class ProLocOwnerWorld10(unittest.TestCase):
    def test_visible_10_language_picker_before_any_javascript(self):
        self.assertEqual(PAGE.count('id="locWorld10Picker"'),1)
        found=re.findall(r'<option value="([a-z]{2})">',PAGE)
        self.assertEqual(found,['fr','en','es','pt','de','it','nl','ar','wo','zh'])
        self.assertIn('<script src="./world10-owner.js?v=20261117-loc-door"></script>',PAGE)
        self.assertLess(PAGE.index('locWorld10Picker'),PAGE.index('world10-owner.js'))
        self.assertIn('const langs=["fr","en","es","pt","de","it","nl","ar","wo","zh"]',I18N)
        m=re.search(r'const rows=(\[.*\]);\nconst dict=',I18N)
        self.assertIsNotNone(m)
        rows=json.loads(m.group(1))
        self.assertGreaterEqual(len(rows),20)
        self.assertEqual(len({r[0] for r in rows}),len(rows))
        for row in rows:
            self.assertEqual(len(row),10,row[0])
            self.assertTrue(all(x.strip() for x in row),row[0])

    def test_magic_link_owner_rights_and_data_never_replaced(self):
        self.assertIn("ACCESS=U+'/functions/v1/digiy-loc-owner-access'",PAGE)
        self.assertIn("MAGIC=U+'/functions/v1/digiy-loc-magic-link'",PAGE)
        self.assertIn("await sb.auth.getSession()",PAGE)
        self.assertIn("Authorization':'Bearer '+session.access_token",PAGE)
        self.assertIn("body:JSON.stringify({email:em})",PAGE)
        self.assertIn("if(!r.ok||!j.ok)throw Error",PAGE)
        self.assertIn("$('#fiche').href=j.professional_url",PAGE)
        self.assertIn('parent.closest("input,textarea,script,style,#meta,#locWorld10Picker")',I18N)
        self.assertNotIn(".rpc(",I18N)
        self.assertNotIn("fetch(",I18N)
        self.assertNotIn("supabase.createClient",I18N)
        self.assertNotIn("innerHTML=",I18N)

    def test_owner_period_is_localized_without_changing_paid_until(self):
        self.assertIn("DIGIY_LOC_OWNER_WORLD10?.t?.('Période active jusqu’au ')",PAGE)
        self.assertIn("DIGIY_LOC_OWNER_WORLD10?.locale?.()",PAGE)
        self.assertIn("new Date(j.paid_until)",PAGE)
        self.assertIn('document.documentElement.dir=lang==="ar"?"rtl":"ltr"',I18N)

    def test_javascript_syntax(self):
        proc=subprocess.run(['node','--check',str(ROOT/"world10-owner.js")],capture_output=True,text=True)
        self.assertEqual(proc.returncode,0,proc.stderr)
        for attrs,js in re.findall(r'<script\b([^>]*)>([\s\S]*?)</script>',PAGE):
            if "src=" in attrs or not js.strip():continue
            proc=subprocess.run(['node','--check','-'],input=js,capture_output=True,text=True)
            self.assertEqual(proc.returncode,0,proc.stderr)

if __name__=="__main__":unittest.main()
