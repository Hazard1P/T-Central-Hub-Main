import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayPalSdkSrc, createPayPalSdkLoader } from '../lib/paypalSdk.js';
function environment() {
 const scripts=[], window={};
 const document={createElement:()=>({setAttribute(k,v){this[k]=v},remove(){this.removed=true}}),body:{appendChild:s=>scripts.push(s)}};
 const load=createPayPalSdkLoader({document,window,timeoutMs:1000});
 const complete=i=>{const sdk={Buttons(){}};window[scripts[i]['data-namespace']]=sdk;scripts[i].onload();return sdk};
 return {load,scripts,window,complete};
}
const options={clientId:'test-id',currency:'CAD',mode:'donation'};
test('PayPal uses capture or recurring SDK parameters on the official HTTPS host',()=>{
 const one=new URL(buildPayPalSdkSrc(options)),monthly=new URL(buildPayPalSdkSrc({...options,mode:'subscription'}));
 assert.equal(one.origin,'https://www.paypal.com');assert.equal(one.searchParams.get('intent'),'capture');assert.equal(monthly.searchParams.get('intent'),'subscription');assert.equal(monthly.searchParams.get('vault'),'true');
});
test('amount changes while the SDK loads share the pending promise instead of hiding the buttons',async()=>{
 const e=environment(),first=e.load(options),second=e.load(options);assert.equal(first,second);assert.equal(e.scripts.length,1);
 let resolved=false;second.then(()=>resolved=true);await Promise.resolve();assert.equal(resolved,false);
 const sdk=e.complete(0);assert.equal(await first,sdk);assert.equal(await e.load(options),sdk);
});
test('monthly and one-time loads keep separate SDK namespaces regardless of completion order',async()=>{
 const e=environment(),one=e.load(options),two=e.load({...options,mode:'subscription'});
 assert.notEqual(e.scripts[0]['data-namespace'],e.scripts[1]['data-namespace']);
 const monthly=e.complete(1),donation=e.complete(0);assert.equal(await two,monthly);assert.equal(await one,donation);
});
test('failed SDK loads can retry with a fresh script',async()=>{
 const e=environment(),first=e.load(options);e.scripts[0].onerror();await assert.rejects(first,/Retry checkout/);assert(e.scripts[0].removed);
 const retry=e.load(options);assert.equal(e.scripts.length,2);const sdk=e.complete(1);assert.equal(await retry,sdk);
});
