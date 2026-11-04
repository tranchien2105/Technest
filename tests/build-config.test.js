import assert from 'node:assert/strict';
import test from 'node:test';
import {frontendBuildEnvironment} from '../scripts/build-frontend.mjs';

test('frontend builds use production React despite shared backend development env',()=>{
  const original={NODE_ENV:'development',VITE_API_BASE_URL:'/api/v1'};
  assert.deepEqual(frontendBuildEnvironment(original),{NODE_ENV:'production',VITE_API_BASE_URL:'/api/v1'});
  assert.equal(original.NODE_ENV,'development');
  assert.equal(frontendBuildEnvironment({}).NODE_ENV,'production');
});


 test('build guard rejects development React diagnostics',async()=>{
  const {assertProductionRuntime}=await import('../scripts/check-production-build.mjs');
  assert.throws(()=>assertProductionRuntime('function runWithFiberInDEV(){}'),/Development React/);
  assert.doesNotThrow(()=>assertProductionRuntime('function renderProductionApp(){}'));
 });
