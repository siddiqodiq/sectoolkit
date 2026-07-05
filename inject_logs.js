const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('app/api/tools', (filePath) => {
    if (!filePath.endsWith('route.ts')) return;

    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if already modified
    if (content.includes('logUserActivity')) return;

    let hasNextAuth = content.includes('getServerSession');
    let hasLogImport = content.includes('logUserActivity');

    let imports = [];
    if (!hasNextAuth) imports.push("import { getServerSession } from 'next-auth/next';\nimport { authOptions } from '@/lib/auth';");
    if (!hasLogImport) imports.push("import { logUserActivity } from '@/lib/logger';");
    
    if (imports.length > 0) {
        content = imports.join('\n') + '\n' + content;
    }

    // Determine tool name from path
    const parts = filePath.split(path.sep);
    const isStop = parts[parts.length - 2] === 'stop';
    const toolName = isStop ? parts[parts.length - 3] : parts[parts.length - 2];
    const action = isStop ? 'SCAN_STOP' : 'SCAN_START';
    
    const tryBlockRegex = /try\s*\{/;
    
    const loggingCode = "    const session = await getServerSession(authOptions);\n" +
"    if (session?.user?.id) {\n" +
"      try {\n" +
"        let reqData = {};\n" +
"        try {\n" +
"          const reqClone = req.clone();\n" +
"          reqData = await reqClone.json();\n" +
"        } catch(e) {}\n" +
"        const details = typeof reqData === 'object' ? Object.entries(reqData).filter(x => x[0] !== 'session_id' && typeof x[1] === 'string').map(x => x[0] + ': ' + x[1]).join(', ') : '';\n" +
"        await logUserActivity(session.user.id, '" + action + "', 'Tool: " + toolName + "' + (details ? ' - ' + details : ''));\n" +
"      } catch (e) {}\n" +
"    }\n";

    content = content.replace(tryBlockRegex, "try {\n" + loggingCode);
    fs.writeFileSync(filePath, content);
    console.log('Injected logging into', filePath);
});
