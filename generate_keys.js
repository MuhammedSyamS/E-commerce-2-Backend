const webpush = require('web-push');
const fs = require('fs');

const vapidKeys = webpush.generateVAPIDKeys();

fs.writeFileSync('vapid_keys.json', JSON.stringify(vapidKeys, null, 2));
console.log('Keys written to vapid_keys.json');
