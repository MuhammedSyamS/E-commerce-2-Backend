const http = require('http');

const endpoints = [
    '/api/products/home',
    '/api/settings',
    '/api/users/profile'
];

async function check(path) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:5005${path}`, (res) => {
            console.log(`PATH: ${path} | STATUS: ${res.statusCode}`);
            resolve(res.statusCode);
        });
        req.on('error', (err) => {
            console.log(`PATH: ${path} | ERROR: ${err.message}`);
            resolve(500);
        });
        req.end();
    });
}

async function run() {
    for (const path of endpoints) {
        await check(path);
    }
}

run();
