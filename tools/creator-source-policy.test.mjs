import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creatorOnly } from './refresh-creator-data.mjs';
const route = { id:'a',character:'anna',season:3,author:'RyzingSol',damage:44,notation:'CH db+2 ► TOM.2',conditions:['Counter Hit'],sourceUrl:'https://www.youtube.com/watch?v=IKaAPbrhZxo',videoTimestampSeconds:265 };
test('only the two requested creator video sources can enter the published data',()=>{
  const result = creatorOnly([route,{...route,id:'b',author:'Community'},{...route,id:'c',sourceUrl:'https://example.com/video'},{...route,id:'d',videoTimestampSeconds:null}], [{id:'anna'}]);
  assert.deepEqual(result.map(c=>c.id),['a']);
  assert.throws(()=>creatorOnly([{...route,damage:null}],[{id:'anna'}]),/Invalid/);
});
