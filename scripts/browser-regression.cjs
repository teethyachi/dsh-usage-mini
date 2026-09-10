// Standalone browser regression. No DSH server or account credentials required.
// Set PLAYWRIGHT_MODULE and CHROME_PATH if Playwright/browser are not on the default path.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
 const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
 const failures = [];
 async function run(name, body) {
  const page = await browser.newPage({viewport:{width:1000,height:700}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  try {
   await page.route('http://widget.test/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-CN"><body></body></html>'}));
   await page.goto('http://widget.test/');
   await page.evaluate(()=>{
    window.requests=[]; window.localeEvents=0;
    window.addEventListener('dsh-usage-mini:locale',()=>window.localeEvents++);
    window.fetch=()=>new Promise(resolve=>window.requests.push(resolve));
    window.flush=()=>window.requests.splice(0).forEach(resolve=>resolve({status:404,ok:false}));
    window.__ModuleLoader__={load:({factory})=>window.mod=factory(()=>({}))};
   });
   await page.addScriptTag({path:path.resolve(__dirname,'../lib/client.js')});
   await page.evaluate(async()=>{window.cleanup=await window.mod.apply({get:()=>undefined});});
   await body(page,errors);
   assert.deepEqual(errors,[]); console.log('PASS '+name);
  } catch(e) {failures.push(name+': '+e.message); console.error('FAIL '+name+': '+e.message);}
  finally {await page.close();}
 }
 await run('dispose while RPC requests are pending',async p=>{
  await p.evaluate(()=>{window.cleanup();window.flush();});
  await p.waitForTimeout(100);
  assert.equal(await p.locator('#dsh-usage-mini-root').count(),0);
 });
 await run('locale observer stops after dispose',async p=>{
  await p.evaluate(()=>window.flush()); await p.waitForTimeout(50);
  await p.evaluate(()=>{window.cleanup();document.documentElement.lang='en';});
  await p.waitForTimeout(50);
  assert.equal(await p.evaluate(()=>window.localeEvents),0);
 });
 await run('collapsed bar remains inside right corner on language change',async p=>{
  await p.evaluate(()=>window.flush()); await p.waitForTimeout(50);
  await p.locator('.um-head button').first().click(); await p.waitForTimeout(450);
  assert.equal(await p.locator('#dsh-usage-mini-root.collapsed').count(),1);
  await p.evaluate(()=>document.documentElement.lang='en'); await p.waitForTimeout(100);
  const r=await p.locator('#dsh-usage-mini-root').boundingBox();
  assert.ok(r.x+r.width<=1000,'English collapsed label overflows viewport: '+JSON.stringify(r));
 });
 await run('dispose during collapse animation',async p=>{
  await p.evaluate(()=>window.flush()); await p.waitForTimeout(50);
  await p.locator('.um-head button').first().click();
  await p.evaluate(()=>window.cleanup()); await p.waitForTimeout(500);
 });
 await run('dispose during expand animation',async p=>{
  await p.evaluate(()=>window.flush()); await p.waitForTimeout(50);
  await p.locator('.um-head button').first().click(); await p.waitForTimeout(450);
  await p.locator('.um-tab-open').click();
  await p.evaluate(()=>window.cleanup()); await p.waitForTimeout(500);
 });
 await run('remount ignores old requests and restarts locale observer',async p=>{
  await p.evaluate(async()=>{
   const stale=window.requests.splice(0); const oldCleanup=window.cleanup;
   oldCleanup(); window.cleanup=await window.mod.apply({get:()=>undefined});
   oldCleanup();
   stale.forEach(resolve=>resolve({status:404,ok:false}));
  });
  await p.waitForTimeout(50);
  assert.equal(await p.locator('#dsh-usage-mini-root').count(),1);
  assert.equal(await p.locator('.um-note.err').count(),0,'stale response must not render on replacement');
  await p.evaluate(()=>{window.flush();document.documentElement.lang='en';}); await p.waitForTimeout(80);
  assert.equal(await p.evaluate(()=>window.localeEvents),1);
  assert.ok(await p.locator('.um-note.err').count()>0,'replacement requests still render');
 });
 await run('viewport shrink during collapse settles inside new bounds',async p=>{
  await p.evaluate(()=>window.flush()); await p.waitForTimeout(50);
  await p.locator('.um-head button').first().click();
  await p.setViewportSize({width:420,height:320}); await p.waitForTimeout(500);
  assert.equal(await p.locator('#dsh-usage-mini-root.collapsed').count(),1);
  const r=await p.locator('#dsh-usage-mini-root').boundingBox();
  assert.ok(r.x>=0 && r.y>=0 && r.x+r.width<=420 && r.y+r.height<=320,JSON.stringify(r));
 });
 await run('language change during expand preserves new labels and bounds',async p=>{
  await p.evaluate(()=>window.flush()); await p.waitForTimeout(50);
  await p.locator('.um-head button').first().click(); await p.waitForTimeout(450);
  await p.locator('.um-tab-open').click();
  await p.evaluate(()=>document.documentElement.lang='en'); await p.waitForTimeout(500);
  assert.equal(await p.locator('#dsh-usage-mini-root.collapsed').count(),0);
  assert.equal(await p.locator('.um-fb-input').getAttribute('placeholder'),'Any feedback?');
  const r=await p.locator('#dsh-usage-mini-root').boundingBox();
  assert.ok(r.x>=0 && r.y>=0 && r.x+r.width<=1000 && r.y+r.height<=700,JSON.stringify(r));
 });
 await browser.close();
 if(failures.length) process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
