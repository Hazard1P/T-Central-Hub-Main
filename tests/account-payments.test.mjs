import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyToMinor, minorToMoney, paymentOwner, paymentSelection, verifiedCapture, verifyOrderPayment } from '../lib/accountPayments.js';
import { reconcileAccountPaymentEvent } from '../lib/server/paymentWebhook.js';
const intent = { id:'intent-1',provider_id:'ORDER-1',account_provider:'google',account_id:'123',amount_minor:1500,currency:'CAD',product:{} };
const order = () => ({id:'ORDER-1',purchase_units:[{custom_id:'tc:intent-1',amount:{value:'15.00',currency_code:'CAD'},payments:{captures:[{id:'CAP-1',status:'COMPLETED',amount:{value:'15.00',currency_code:'CAD'},create_time:'2026-10-20T12:00:00Z'}]}}]});
test('money uses exact minor units and formats large totals without currency mixing or rounding',()=>{
 assert.equal(moneyToMinor('10.01','CAD'),1001); assert.equal(moneyToMinor('100','JPY'),100);
 assert.equal(minorToMoney('900719925474099321','CAD'),'9007199254740993.21');
 for(const [value,currency] of [['1.005','CAD'],['1.1','JPY'],['0','CAD'],['1e3','CAD'],['1','BTC']])assert.throws(()=>moneyToMinor(value,currency));
});
test('owner and selection derive from authenticated providers and reject undefined VIP offers',()=>{
 assert.notEqual(paymentOwner({authenticated:true,provider:'google',accountId:'123'}).key,paymentOwner({authenticated:true,provider:'steam',accountId:'123'}).key);
 assert.throws(()=>paymentOwner({authenticated:false,provider:'steam',accountId:'123'}));
 assert.throws(()=>paymentSelection({amount:'10',purchaseType:'vip_purchase'},'CAD'),/not available/);
 assert.throws(()=>paymentSelection({amount:'10',currency:'USD'},'CAD'),/currency/);
 assert.equal(paymentSelection({amount:'10',focus:'hardware',accountId:'attacker'},'CAD').focus,'hardware');
});
test('verified payment matches the server snapshot, opaque binding, order, currency and capture',()=>{
 assert.equal(verifiedCapture(order(),intent).amountMinor,1500);
 for(const mutate of [o=>o.id='OTHER',o=>o.purchase_units[0].custom_id='google:123',o=>o.purchase_units[0].amount.value='1.00',o=>o.purchase_units[0].payments.captures[0].amount.currency_code='USD']){
  const o=order();mutate(o);assert.throws(()=>verifiedCapture(o,intent));
 }
 const pending=order();pending.purchase_units[0].payments.captures[0].status='PENDING';assert.equal(verifiedCapture(pending,intent),null);
 const old=order();old.purchase_units[0].custom_id='123';assert.throws(()=>verifyOrderPayment(old,intent));
 assert.doesNotThrow(()=>verifyOrderPayment(old,{...intent,account_provider:'steam',product:{legacy:true}}));
});
test('webhook captures are verified against provider order data and refunds identify a known charge',async()=>{
 const calls=[];const store={find:async()=>intent,record:async(i,c)=>calls.push(['record',i.id,c.id]),charge:async()=>({transaction_id:'CAP-1'}),adjust:async(...args)=>calls.push(['adjust',...args]),event:async(...args)=>calls.push(['event',...args])};
 await reconcileAccountPaymentEvent({id:'EV-1',event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{id:'CAP-1',supplementary_data:{related_ids:{order_id:'ORDER-1'}}}},{store,getOrder:async()=>order()});
 assert.deepEqual(calls[0],['record','intent-1','CAP-1']);
 await reconcileAccountPaymentEvent({id:'EV-2',event_type:'PAYMENT.CAPTURE.REFUNDED',resource:{id:'REF-1',amount:{value:'5.00',currency_code:'CAD'},links:[{rel:'up',href:'https://api-m.paypal.com/v2/payments/captures/CAP-1'}]}},{store});
 assert(calls.some(c=>c[0]==='adjust'&&c[1]==='CAP-1'&&c[2]==='REF-1'&&c[4]===500));
 await assert.rejects(reconcileAccountPaymentEvent({id:'EV-3',event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{id:'OTHER',supplementary_data:{related_ids:{order_id:'ORDER-1'}}}},{store,getOrder:async()=>order()}),/does not match/);
});
test('an unknown paid event is retained for reconciliation without granting account credit',async()=>{
 let recorded=false, outcome;
 const store={find:async()=>null,record:async()=>{recorded=true},event:async(id,type,ref,state)=>{outcome=state}};
 const result=await reconcileAccountPaymentEvent({id:'EV-UNKNOWN',event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{id:'CAP-X',custom_id:'victim',supplementary_data:{related_ids:{order_id:'UNKNOWN'}}}},{store});
 assert.equal(recorded,false);assert.equal(outcome,'unmatched');assert.equal(result.handled,false);
});

test('checkout accepts the trusted public origin behind an internal Next hostname and rejects foreign origins',async()=>{
 const { isSameOriginPaymentRequest } = await import('../lib/paymentRequest.js');
 const prior={APP_URL:process.env.APP_URL,NEXT_PUBLIC_APP_URL:process.env.NEXT_PUBLIC_APP_URL};
 delete process.env.APP_URL;delete process.env.NEXT_PUBLIC_APP_URL;
 try{
  const request=(origin,site)=>new Request('http://localhost:3700/api/donations/paypal/create-order',{headers:{host:'127.0.0.1:3700','x-forwarded-proto':'http',origin,...(site?{'sec-fetch-site':site}:{})}});
  assert.equal(isSameOriginPaymentRequest(request('http://127.0.0.1:3700')),true);
  assert.equal(isSameOriginPaymentRequest(request('https://other.example')),false);
  assert.equal(isSameOriginPaymentRequest(request('http://127.0.0.1:3700','cross-site')),false);
 }finally{for(const[k,v]of Object.entries(prior)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
});
