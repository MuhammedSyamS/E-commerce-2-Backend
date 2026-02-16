
const http = require('http');

http.get('http://127.0.0.1:5005/api/products', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Data Length: ${data.length}`);
        try {
            const json = JSON.parse(data);
            console.log(`Products Found: ${json.length}`);
        } catch (e) {
            console.log('Data is not JSON');
            console.log(data.substring(0, 100));
        }
        process.exit(0);
    });
}).on('error', (err) => {
    console.error('Error: ' + err.message);
    process.exit(1);
});
