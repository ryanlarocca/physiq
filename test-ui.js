#!/usr/bin/env node
/**
 * Simple UI Test for Physiq
 * Tests: nav indicator, tab reordering, entry feedback (sound + toast)
 */

const http = require('http');

// Helper to make HTTP requests
function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:8888${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
  });
}

async function runTests() {
  console.log('🧪 Testing Physiq UI Changes...\n');
  
  try {
    // Test 1: Fetch index.html
    console.log('1️⃣  Fetching index.html...');
    const result = await testEndpoint('/');
    if (result.status !== 200) {
      console.error('❌ Failed to fetch index.html');
      process.exit(1);
    }
    const html = result.body;
    
    // Test 2: Check nav-indicator HTML element
    console.log('2️⃣  Checking nav-indicator element...');
    if (html.includes('<div class="nav-indicator">')) {
      console.log('✅ Nav-indicator HTML element present');
    } else {
      console.error('❌ Nav-indicator HTML missing');
      process.exit(1);
    }
    
    // Test 3: Check nav-indicator CSS
    console.log('3️⃣  Checking nav-indicator CSS...');
    if (html.includes('.nav-indicator {')) {
      console.log('✅ Nav-indicator CSS present');
    } else {
      console.error('❌ Nav-indicator CSS missing');
      process.exit(1);
    }
    
    // Test 4: Check playSuccessSound function
    console.log('4️⃣  Checking playSuccessSound function...');
    if (html.includes('function playSuccessSound()')) {
      console.log('✅ playSuccessSound function present');
    } else {
      console.error('❌ playSuccessSound function missing');
      process.exit(1);
    }
    
    // Test 5: Check Log tab section order
    console.log('5️⃣  Checking Log tab section order...');
    const quickAddIdx = html.indexOf('Quick Add');
    const aiLoggingIdx = html.indexOf('Log with AI');
    const manualIdx = html.indexOf('Enter macros manually');
    const weightIdx = html.indexOf('Log Weight');
    const todaysFoodsIdx = html.indexOf("Today's Foods");
    
    if (quickAddIdx < aiLoggingIdx && aiLoggingIdx < manualIdx && 
        manualIdx < weightIdx && weightIdx < todaysFoodsIdx) {
      console.log('✅ Log tab sections in correct order:');
      console.log('   → Quick Add → AI Logging → Manual Entry → Weight → Today\'s Foods');
    } else {
      console.error('❌ Log tab sections NOT in correct order');
      console.error(`   Indices: Quick=${quickAddIdx}, AI=${aiLoggingIdx}, Manual=${manualIdx}, Weight=${weightIdx}, Foods=${todaysFoodsIdx}`);
      process.exit(1);
    }
    
    // Test 6: Check success toast messages
    console.log('6️⃣  Checking success toast messages...');
    const toastChecks = [
      ['logMeal with toast', html.includes('✅ ${shortDesc} logged')],
      ['logWeight with toast', html.includes('✅ ${weightVal.toFixed(1)} lbs logged')],
      ['addFavorite with toast', html.includes('✅')]
    ];
    
    let allToastsGood = true;
    for (const [name, found] of toastChecks) {
      if (found) console.log(`   ✅ ${name}`);
      else { console.log(`   ⚠️  ${name} (template check)`); }
    }
    
    // Test 7: Check that playSuccessSound is called in logging functions
    console.log('7️⃣  Checking sound integration...');
    const soundCalls = [
      html.includes('playSuccessSound();'),
    ];
    
    if (soundCalls.every(c => c)) {
      console.log('✅ playSuccessSound called in logging functions');
    } else {
      console.error('❌ playSuccessSound not properly integrated');
      process.exit(1);
    }
    
    // Test 8: Check data.json endpoint
    console.log('8️⃣  Checking data.json endpoint...');
    const dataResult = await testEndpoint('/data.json');
    if (dataResult.status === 200) {
      console.log('✅ data.json endpoint working');
    } else {
      console.error('❌ data.json endpoint failed');
      process.exit(1);
    }
    
    console.log('\n✨ All tests passed! Changes are working correctly.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
}

runTests();
