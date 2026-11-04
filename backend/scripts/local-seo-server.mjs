// Isolated compiled storefront audit. No queues/workers and no database writes.
import process from 'node:process';
import {URL} from 'node:url';
import console from 'node:console';
import {createRedis} from '../dist/config/redis.js';
import {createApp} from '../dist/app.js';
import {loadEnv} from '../dist/config/env.js';
import {createDatabase} from '../dist/config/database.js';
import {createLogger} from '../dist/config/logger.js';
import {createCatalogService} from '../dist/modules/catalog/catalog.service.js';
import {createSeoRepository} from '../dist/modules/seo/seo.repository.js';
import {createSeoService} from '../dist/modules/seo/seo.service.js';
import {createAuthRepository} from '../dist/modules/auth/auth.repository.js';
import {createAuthService} from '../dist/modules/auth/auth.service.js';
import {createInventoryService} from '../dist/modules/inventory/inventory.service.js';
import {createFlashSalesService} from '../dist/modules/flash-sales/flash-sales.service.js';
const env=loadEnv();
if(env.NODE_ENV==='production') throw new Error('Development environment required');
const connection=new URL(env.DATABASE_URL);
connection.searchParams.set('options',`${connection.searchParams.get('options') || ''} -c default_transaction_read_only=on`.trim());
const {pool,db}=createDatabase(connection.href);
if((await pool.query('select current_database() name')).rows[0].name!=='technest_dev') throw new Error('Expected development database');
const redis=createRedis(env.REDIS_URL);
redis.on('error',()=>{});await redis.connect();
const developmentPolicy=process.env.LOCAL_SEO_POLICY==='development';
const port=developmentPolicy?4174:4173;
const catalog=createCatalogService(db);
const auth=createAuthService(createAuthRepository(db),env.AUTH_JWT_SECRET);
const service=createSeoService(createSeoRepository(pool),catalog,{
 ...(developmentPolicy?{environment:'development',indexingEnabled:false}:{environment:'production',siteUrl:'https://seo-validation.example.test',indexingEnabled:true}),
});
const app=createApp({logger:createLogger('warn'),corsOrigin:`http://127.0.0.1:${port}`,
 health:{postgres:()=>pool.query('SELECT 1'),redis:()=>redis.ping()},
 auth:{service:auth,env,redis},catalog,seo:{service,distDirectory:'/tmp/technest-local-seo-dist'},admin:{db,auth},
 inventory:{service:createInventoryService(db),auth},flashSales:createFlashSalesService(db),
});
const server=app.listen(port,'127.0.0.1',()=>console.log(`LOCAL_SEO_READY http://127.0.0.1:${port}; compiled app; ${developmentPolicy?'development noindex':'production SEO policy; reserved .test origin'}; read-only DB`));
for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>server.close(()=>Promise.all([pool.end(),redis.close()]).then(()=>process.exit())));
