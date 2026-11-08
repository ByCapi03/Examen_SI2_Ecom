const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function testEndpoints() {
  try {
    // 1. Login
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'toyekif281@maxtanie.com', // Using an existing test user email
      password: 'Password123!',
      role: 'CLIENTE'
    });
    
    const token = loginRes.data.access_token;
    console.log('Logged in successfully. Token obtained.\n');

    const api = axios.create({
      baseURL: API_URL,
      headers: { Authorization: `Bearer ${token}` }
    });

    // 1. GET /store/products
    try {
      const res = await api.get('/store/products');
      console.log('GET /store/products');
      console.log('STATUS:', res.status);
      console.log('RESULT:', JSON.stringify(res.data[0] || [], null, 2));
      console.log('\n----------------------------------------\n');
    } catch (e) {
      console.log('GET /store/products FAILED', e.response?.status, e.response?.data);
    }

    // 2. GET /store/products/:id
    try {
      const res = await api.get('/store/products/1');
      console.log('GET /store/products/1');
      console.log('STATUS:', res.status);
      console.log('RESULT:', JSON.stringify(res.data, null, 2));
      console.log('\n----------------------------------------\n');
    } catch (e) {
      console.log('GET /store/products/1 FAILED', e.response?.status, e.response?.data);
    }

    // 3. GET /reservations/my
    let resId = null;
    try {
      const res = await api.get('/reservations/my');
      console.log('GET /reservations/my');
      console.log('STATUS:', res.status);
      console.log('RESULT:', JSON.stringify(res.data[0] || [], null, 2));
      if (res.data[0]) resId = res.data[0].id;
      console.log('\n----------------------------------------\n');
    } catch (e) {
      console.log('GET /reservations/my FAILED', e.response?.status, e.response?.data);
    }

    // 4. GET /reservations/my/:id
    if (resId) {
      try {
        const res = await api.get(`/reservations/my/${resId}`);
        console.log(`GET /reservations/my/${resId}`);
        console.log('STATUS:', res.status);
        console.log('RESULT:', JSON.stringify(res.data, null, 2));
        console.log('\n----------------------------------------\n');
      } catch (e) {
        console.log(`GET /reservations/my/${resId} FAILED`, e.response?.status, e.response?.data);
      }
    } else {
        console.log('No reservation to fetch details for.');
    }

    // 5. GET /sales/my
    let saleId = null;
    try {
      const res = await api.get('/sales/my');
      console.log('GET /sales/my');
      console.log('STATUS:', res.status);
      console.log('RESULT:', JSON.stringify(res.data[0] || [], null, 2));
      if (res.data[0]) saleId = res.data[0].id;
      console.log('\n----------------------------------------\n');
    } catch (e) {
      console.log('GET /sales/my FAILED', e.response?.status, e.response?.data);
    }

    // 6. GET /sales/my/:id
    if (saleId) {
      try {
        const res = await api.get(`/sales/my/${saleId}`);
        console.log(`GET /sales/my/${saleId}`);
        console.log('STATUS:', res.status);
        console.log('RESULT:', JSON.stringify(res.data, null, 2));
        console.log('\n----------------------------------------\n');
      } catch (e) {
        console.log(`GET /sales/my/${saleId} FAILED`, e.response?.status, e.response?.data);
      }
    } else {
        console.log('No sale to fetch details for.');
    }

  } catch (error) {
    console.error('Login failed or unexpected error:', error.response?.data || error.message);
  }
}

testEndpoints();
