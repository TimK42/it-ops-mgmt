const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function resetDOM() {
  var dom = new JSDOM(
    '<!DOCTYPE html><html><body><main class="main" id="main-content"><div id="app"></div><div id="page-content"></div><div id="detail-modal"></div><div id="page-title"></div></main></body></html>',
    {
      url: 'http://localhost:3199',
      pretendToBeVisual: true,
      runScripts: 'dangerously',
    },
  );
  Object.defineProperty(dom.window, 'matchMedia', { writable: true, value: function() { return { matches: false, addListener: function(){}, removeListener: function(){}, addEventListener: function(){}, removeEventListener: function(){} }; } });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.localStorage = dom.window.localStorage;
  global.HTMLElement = dom.window.HTMLElement;
  global.HTMLInputElement = dom.window.HTMLInputElement;
  global.self = dom.window;
  global.history = dom.window.history;
  return dom;
}

console.log("=== Test 1: After resetDOM, page-content exists when called");
resetDOM();
console.log("page-content:", document.getElementById('page-content') ? "EXISTS" : "NULL");

console.log("\n=== Test 2: Simulate timing issue");
resetDOM();
document.getElementById('app').innerHTML = '<span>Login form</span>';
console.log("After app.innerHTML replace:", document.getElementById('page-content') ? "EXISTS" : "NULL");

console.log("\n=== Test 3: Changing global.document to null");
resetDOM();
try {
  global.document = null;
  document.getElementById('page-content').innerHTML = '';
  console.log("ERROR: Should have thrown");
} catch(e) {
  console.log("Expected error when document is null:", e.message);
}
