import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('       STARTING END-TO-END AUTOMATED TESTS          ');
  console.log('====================================================\n');

  // TEST 1: Check starter HTML template
  console.log('[TEST 1] Verifying public/cyber-styling.html endpoint...');
  try {
    const htmlRes = await fetch(`${BASE_URL}/cyber-styling.html`);
    if (htmlRes.ok) {
      const text = await htmlRes.text();
      console.log(`  -> Status: ${htmlRes.status} OK`);
      console.log(`  -> File size: ${Buffer.byteLength(text, 'utf-8')} bytes`);
      console.log(`  -> Contains starter headline: ${text.includes('Reimagine This Webpage With Generative AI')}`);
    } else {
      console.error(`  -> Failed with status ${htmlRes.status}`);
    }
  } catch (err) {
    console.error('  -> Error connecting to dev server:', err.message);
  }

  // TEST 2: Test /api/cyber-style/my-theme for Team 'astra'
  console.log('\n[TEST 2] Testing /api/cyber-style/my-theme for Team astra (DUM-LDAD)...');
  try {
    const res = await fetch(`${BASE_URL}/api/cyber-style/my-theme?code=DUM-LDAD&reg_no=URK25CS9001`);
    console.log(`  -> Status: ${res.status}`);
    const json = await res.json();
    console.log('  -> Response:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('  -> Error:', err.message);
  }

  // TEST 3: Test persistence across multiple calls for Team 'astra'
  console.log('\n[TEST 3] Testing Persistence (Re-querying Team astra)...');
  try {
    const res1 = await fetch(`${BASE_URL}/api/cyber-style/my-theme?code=DUM-LDAD&reg_no=URK25CS9001`);
    const json1 = await res1.json();
    const res2 = await fetch(`${BASE_URL}/api/cyber-style/my-theme?code=DUM-LDAD&reg_no=URK25CS9001`);
    const json2 = await res2.json();

    const identical = json1.theme?.theme_id === json2.theme?.theme_id;
    console.log(`  -> Call 1 Theme: ${json1.theme?.title}`);
    console.log(`  -> Call 2 Theme: ${json2.theme?.title}`);
    console.log(`  -> Theme remains identical on reload: ${identical ? 'YES (PERSISTENT)' : 'NO (FAILED)'}`);
  } catch (err) {
    console.error('  -> Error:', err.message);
  }

  // TEST 4: Test /api/cyber-style/my-theme with invalid code
  console.log('\n[TEST 4] Testing security / validation with invalid team code...');
  try {
    const res = await fetch(`${BASE_URL}/api/cyber-style/my-theme?code=INVALID&reg_no=URK25CS9001`);
    console.log(`  -> Status: ${res.status} (Expected: 404 or 403)`);
    const json = await res.json();
    console.log('  -> Response:', json);
  } catch (err) {
    console.error('  -> Error:', err.message);
  }

  // TEST 5: Test /api/cyber-style/assignments unauthorized access
  console.log('\n[TEST 5] Testing Admin route security (Unauthorized GET)...');
  try {
    const res = await fetch(`${BASE_URL}/api/cyber-style/assignments`);
    console.log(`  -> Status: ${res.status} (Expected: 401 Unauthorized)`);
    const json = await res.json();
    console.log('  -> Error response:', json);
  } catch (err) {
    console.error('  -> Error:', err.message);
  }

  console.log('\n====================================================');
  console.log('              TEST RUN FINISHED                     ');
  console.log('====================================================\n');
}

runTests().catch(console.error);
