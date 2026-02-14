import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

const API_URL = 'http://localhost:5000/api/pagos/reportar';

// Simulate FormData request
const testFormData = async () => {
  console.log('--- Testing FormData Request ---');
  const form = new FormData();
  form.append('deuda_id', '1'); // Assuming a valid ID, or just testing validation
  form.append('monto', '100.50');
  form.append('metodo_pago', 'YAPE');
  form.append('codigo_operacion', 'TEST-12345');

  // Create a minimal valid GIF (1x1 pixel)
  const validGif = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );
  fs.writeFileSync('test-image.gif', validGif);
  form.append('voucher', fs.createReadStream('test-image.gif'));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: form,
    });

    // Read text first to avoid JSON parse error if response is not JSON
    const text = await response.text();
    console.log('Status:', response.status);
    try {
      const data = JSON.parse(text);
      console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Response (text):', text);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (fs.existsSync('test-image.gif')) fs.unlinkSync('test-image.gif');
  }
};

// Simulate JSON request (to see if multer breaks it)
const testJSON = async () => {
  console.log('\n--- Testing JSON Request ---');
  const body = {
    deuda_id: 1,
    monto: 100.5,
    metodo_pago: 'YAPE',
    codigo_operacion: 'TEST-JSON',
    voucher_url: 'http://example.com/image.jpg',
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
};

(async () => {
  await testJSON();
  await testFormData();
})();
