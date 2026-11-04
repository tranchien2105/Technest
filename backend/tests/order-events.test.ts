import { describe,it,expect } from 'vitest';
import express from 'express';
import { createCustomerOrdersRouter } from '../src/modules/orders/orders.routes.js';
import { createOrderEventHub } from '../src/modules/orders/order-events.js';
import type { AuthService } from '../src/modules/auth/auth.service.js';
import type { OrdersService } from '../src/modules/orders/orders.service.js';
describe('Live order event stream',()=>{
 it('keeps subscriptions after request completion, isolates users and cleans up on disconnect',async()=>{
  const hub=createOrderEventHub();const subscribe=hub.subscribe.bind(hub);let subscribers=0;
  hub.subscribe=listener=>{subscribers++;const stop=subscribe(listener);return()=>{subscribers--;stop();};};
  const auth={authenticate:async(token:string)=>({id:Number(token),role:'CUSTOMER',status:'ACTIVE',email:'events@example.test'})} as unknown as AuthService;
  const app=express();app.use('/orders',createCustomerOrdersRouter({} as OrdersService,auth,hub));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const address=server.address() as {port:number};
  const abortFirst=new AbortController(),abortSecond=new AbortController(),timeout=setTimeout(()=>{abortFirst.abort();abortSecond.abort();},5000);
  try {
   const first=await fetch(`http://127.0.0.1:${address.port}/orders/events`,{headers:{Authorization:'Bearer 1'},signal:abortFirst.signal});const reader=first.body!.getReader();await reader.read();
   const second=await fetch(`http://127.0.0.1:${address.port}/orders/events`,{headers:{Authorization:'Bearer 2'},signal:abortSecond.signal});const other=second.body!.getReader();await other.read();
   expect(subscribers).toBe(2);
   const event={orderId:'184',orderNumber:'TN-184',status:'SHIPPED',updatedAt:new Date().toISOString()};hub.publish('1',event);
   expect(new TextDecoder().decode((await reader.read()).value)).toContain('TN-184');
   hub.publish('2',{...event,orderId:'185',orderNumber:'TN-185'});const received=new TextDecoder().decode((await other.read()).value);expect(received).toContain('TN-185');expect(received).not.toContain('TN-184');
   abortFirst.abort();abortSecond.abort();const closed=new Promise<void>(r=>server.close(()=>r()));server.closeAllConnections();await closed;await new Promise(r=>setTimeout(r,50));expect(subscribers).toBe(0);
  } finally { clearTimeout(timeout);abortFirst.abort();abortSecond.abort();server.closeAllConnections();if(server.listening)await new Promise<void>(r=>server.close(()=>r())); }
 });
});
