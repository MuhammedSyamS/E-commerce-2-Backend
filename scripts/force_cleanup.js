const { exec } = require('child_process');

console.log('🔍 Checking for processes on port 5005...');

const checkCmd = process.platform === 'win32'
    ? 'netstat -ano | findstr :5005'
    : 'lsof -i :5005 -t';

exec(checkCmd, (err, stdout, stderr) => {
    if (!stdout) {
        console.log('✅ Port 5005 is already free.');
        return;
    }

    const lines = stdout.trim().split('\n');
    const pids = new Set();

    lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = process.platform === 'win32' ? parts[parts.length - 1] : parts[0];
        if (pid && !isNaN(pid)) {
            pids.add(pid);
        }
    });

    if (pids.size === 0) {
        console.log('✅ No valid PIDs found. Port might be clearing.');
        return;
    }

    console.log(`⚠️ Found ${pids.size} process(es) holding port 5005: ${Array.from(pids).join(', ')}`);

    pids.forEach(pid => {
        const killCmd = process.platform === 'win32' ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
        exec(killCmd, (kErr, kStdout, kStderr) => {
            if (kErr) {
                console.error(`❌ Failed to kill PID ${pid}:`, kErr.message);
            } else {
                console.log(`✅ Successfully killed PID ${pid}.`);
            }
        });
    });
});
