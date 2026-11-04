import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveApiOrigin} from '../src/api/apiOrigin.js';
test('production same-origin API path supports socket origin',()=>{
 assert.equal(resolveApiOrigin('/api/v1','https://store.example.test'),'https://store.example.test');
 assert.equal(resolveApiOrigin('https://api.example.test/api/v1','https://store.example.test'),'https://api.example.test');
 assert.equal(resolveApiOrigin('http://localhost:3000/api/v1','http://localhost:5173'),'http://localhost:3000');
});
