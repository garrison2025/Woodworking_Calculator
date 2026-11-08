import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

// Run after python3 build.py; the rendered public contact/privacy pages
// must carry the same verified owner-supplied identity without adding
// server-side forms, third-party dependencies or index permissions.
const site=join(process.cwd(),"dist");
const contact=readFileSync(join(site,"contact","index.html"),"utf8");
const privacy=readFileSync(join(site,"privacy","index.html"),"utf8");
const home=readFileSync(join(site,"index.html"),"utf8");
test("contact page provides the owner's accessible real mailto link",()=>{
  assert.match(contact,/href="mailto:contact@woodlayout\.com">contact@woodlayout\.com<\/a>/);
  assert.match(contact,/public GitHub issue tracker/);
  assert.match(contact,/Messages through a web form/i); // ensure static-site disclosure
  assert.doesNotMatch(contact,/<form[\s>]/i);
});
test("privacy page discloses email-provider processing and no website uploads",()=>{
  assert.match(privacy,/contact@woodlayout\.com/);
  assert.match(privacy,/receiving mailbox provider/);
  assert.match(privacy,/not currently run analytics/);
  assert.match(privacy,/no measurements are uploaded/);
});
test("contact metadata, robots release gate and all tool links stay intact",()=>{
  assert.match(contact,/<title>Contact \| WoodLayout<\/title>/);
  assert.match(contact,/Email contact@woodlayout\.com/);
  assert.match(home,/href="\/contact\/"/);
  assert.match(contact,/<meta name="robots" content="noindex,nofollow,noarchive">/);
});
