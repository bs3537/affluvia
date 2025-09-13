// Quick test for the optimization impact endpoint
console.log(`
Test the optimization impact endpoint by running this in the browser console:

await fetch('/api/report/optimization-impact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ variables: null })
}).then(r => {
  console.log('Response status:', r.status);
  console.log('Response OK:', r.ok);
  return r.text();
}).then(text => {
  console.log('Raw response:', text);
  try {
    const json = JSON.parse(text);
    console.log('Parsed JSON:', json);
    return json;
  } catch(e) {
    console.log('Failed to parse as JSON');
    return text;
  }
});
`);