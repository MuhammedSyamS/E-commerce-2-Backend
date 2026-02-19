const fs = require('fs');
const path = require('path');

const scanDirs = ['./controllers', './models', './routes', './utils'];
const rootDir = path.resolve(__dirname, '..');

const findings = {
    todos: [],
    consoleLogs: [],
    emptyCatch: []
};

const scanFile = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        const lineNum = index + 1;
        if (line.includes('TODO') || line.includes('FIXME')) {
            findings.todos.push({ file: path.relative(rootDir, filePath), line: lineNum, content: line.trim() });
        }
        if (line.includes('console.log') && !line.includes('//')) {
            // Basic check - might catch legitimate logs but good to review
            findings.consoleLogs.push({ file: path.relative(rootDir, filePath), line: lineNum });
        }
        if (line.match(/catch\s*\(\w+\)\s*\{\s*\}/)) {
            findings.emptyCatch.push({ file: path.relative(rootDir, filePath), line: lineNum });
        }
    });
};

const walkDir = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.js')) {
            scanFile(fullPath);
        }
    }
};

console.log("🔍 Starting Static Code Analysis...");
scanDirs.forEach(d => {
    const fullPath = path.join(rootDir, d);
    if (fs.existsSync(fullPath)) walkDir(fullPath);
});

console.log(`\nFound ${findings.todos.length} TODOs/FIXMEs`);
console.log(`Found ${findings.consoleLogs.length} console.log statements (Review for production)`);
console.log(`Found ${findings.emptyCatch.length} Empty Catch blocks (Critical)`);

if (findings.emptyCatch.length > 0) {
    console.log("\n⚠️ CRITICAL: Empty Catch Blocks Found:");
    findings.emptyCatch.forEach(f => console.log(`  - ${f.file}:${f.line}`));
}

if (findings.todos.length > 0) {
    console.log("\n📝 TODO items:");
    findings.todos.slice(0, 5).forEach(f => console.log(`  - ${f.file}:${f.line}: ${f.content}`));
    if (findings.todos.length > 5) console.log(`  ... and ${findings.todos.length - 5} more.`);
}

if (findings.consoleLogs.length > 10) {
    console.log("\nℹ️  Many console.logs found. Consider removing for production.");
} else if (findings.consoleLogs.length > 0) {
    console.log("\nℹ️  Console Logs:");
    findings.consoleLogs.forEach(f => console.log(`  - ${f.file}:${f.line}`));
}
