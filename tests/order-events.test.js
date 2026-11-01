import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOrderEvent,watchOrders} from '../src/api/orderEvents.js';
const event={orderId:'184',orderNumber:'TN-184',status:'SHIPPED',updatedAt:'2026-10-31T10:00:00Z'};
test('order SSE parser supplies a validated event payload, ignores heartbeats and malformed events',()=>{
 assert.deepEqual(parseOrderEvent(`event: order:status-updated\r\ndata: ${JSON.stringify(event)}\r\n`),event);
 for(const data of [': keepalive','event: other\ndata: {}','event: order:status-updated\ndata: broken',`event: order:status-updated\ndata: ${JSON.stringify({...event,orderId:'../2'})}`,`event: order:status-updated\ndata: ${JSON.stringify({...event,status:'UNKNOWN'})}`])assert.equal(parseOrderEvent(data),null);
});
test('authenticated stream decodes split events, refreshes an expired token, reconnects and stops on cleanup',async t=>{
 const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{cookie:'technest_csrf=test'}});t.after(()=>{if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else delete globalThis.document;});
 let connections=0,refreshes=0;const received=[];let streamController;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(url.endsWith('/auth/refresh')){refreshes++;return Response.json({success:true,data:{accessToken:`token-${refreshes}`,csrfToken:'test',user:{id:1}}});}
  if(url.endsWith('/auth/me'))return Response.json({success:true,data:{id:1}});
  assert.ok(url.endsWith('/orders/events'));assert.ok(options.headers.Authorization.startsWith('Bearer token-'));connections++;
  if(connections===1)return new Response('',{status:401});
  const text=`: connected\r\n\r\nevent: order:status-updated\r\ndata: ${JSON.stringify(event)}\r\n\r\n`;
  const stream=new ReadableStream({start(c){streamController=c;c.enqueue(new TextEncoder().encode(text.slice(0,13)));c.enqueue(new TextEncoder().encode(text.slice(13)));if(connections===2)c.close();}});
  options.signal.addEventListener('abort',()=>{try{streamController.close();}catch{/* already closed */}},{once:true});return new Response(stream);
 });
 const stop=watchOrders(false,e=>received.push(e));t.after(stop);
 const end=Date.now()+8000;while(received.length<2&&Date.now()<end)await new Promise(r=>setTimeout(r,30));
 assert.equal(received.length,2);assert.equal(refreshes,2);assert.ok(connections>=3);assert.deepEqual(received[0],event);stop();const previous=connections;await new Promise(r=>setTimeout(r,1100));assert.equal(connections,previous);
});
