const axios = require('axios');

async function testApi() {
    try {
        const res = await axios.get('http://127.0.0.1:5005/api/looks');
        console.log('Status Code:', res.status);
        console.log('Data Length:', res.data.length);
        if (res.data.length > 0) {
            console.log('First Look Status:', res.data[0].status);
        }
    } catch (err) {
        console.error('API Error:', err.message);
    }
}

testApi();
