#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// 0. Handle doctor CLI parameter
if (process.argv.includes('doctor') || process.argv.includes('--doctor')) {
    runDoctor();
    process.exit(0);
}

console.log('🚀 Setting up Antigravity statusline...');

// 1. Run bun link to register agy-statusline globally (if in local repository dev environment)
let isLocalDev = fs.existsSync(path.join(__dirname, '.git'));
if (isLocalDev) {
    try {
        console.log('🔗 Running "bun link" to register the binary globally...');
        execSync('bun link', { stdio: 'inherit' });
        console.log('✅ Registered "agy-statusline" successfully.');
    } catch (error) {
        console.warn('⚠️  Failed to run "bun link". Proceeding with settings configuration anyway...');
    }
} else {
    console.log('📦 Running from global package installation, skipping "bun link".');
}

// 2. Locate settings.json
const homeDir = os.homedir();
const settingsPath = path.join(homeDir, '.gemini', 'antigravity-cli', 'settings.json');

if (!fs.existsSync(settingsPath)) {
    console.error(`❌ Antigravity settings file not found at: ${settingsPath}`);
    process.exit(1);
}

// 3. Read and update settings.json
try {
    const rawSettings = fs.readFileSync(settingsPath, 'utf8').trim();
    // Strip UTF-8 BOM if present
    const cleanSettings = rawSettings.replace(/^\uFEFF/, '');
    const settings = JSON.parse(cleanSettings);

    // Initialize statusLine block if it doesn't exist
    if (!settings.statusLine) {
        settings.statusLine = {};
    }

    settings.statusLine.type = 'command';
    settings.statusLine.command = 'agy-statusline';
    settings.statusLine.enabled = true;

    // Convert back to string and write to file (default write has no BOM)
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`✅ Successfully updated settings at: ${settingsPath}`);
    console.log('🎉 Setup complete! Restart your shell or CLI to see changes.');
} catch (error) {
    console.error(`❌ Failed to update settings.json: ${error.message}`);
    process.exit(1);
}

function runDoctor() {
    console.log('🩺 Running Antigravity Statusline Doctor...');
    let health = true;

    // 1. Check Runtime
    console.log(`\n1. Checking JavaScript Runtime...`);
    console.log(`   Running under: ${process.release ? process.release.name : 'Bun'} (${process.version})`);

    // 2. Check settings.json location and contents
    console.log(`\n2. Checking settings.json...`);
    const sPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'settings.json');
    if (!fs.existsSync(sPath)) {
        console.error(`   ❌ settings.json NOT found at: ${sPath}`);
        health = false;
    } else {
        console.log(`   Found settings.json at: ${sPath}`);
        try {
            const rawBytes = fs.readFileSync(sPath);
            // Check for UTF-8 BOM (0xEF, 0xBB, 0xBF)
            if (rawBytes.length >= 3 && rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF) {
                console.error(`   ❌ WARNING: settings.json contains a UTF-8 BOM (Byte Order Mark). This will cause the CLI to crash or reset!`);
                health = false;
            } else {
                console.log(`   ✅ UTF-8 BOM Check: Passed (No BOM found)`);
            }

            const settings = JSON.parse(rawBytes.toString('utf8').trim());
            if (settings.statusLine) {
                console.log(`   ✅ statusLine block exists`);
                console.log(`      Enabled: ${settings.statusLine.enabled}`);
                console.log(`      Type: ${settings.statusLine.type}`);
                console.log(`      Command: ${settings.statusLine.command}`);

                if (settings.statusLine.command !== 'agy-statusline') {
                    console.error(`   ❌ WARNING: statusLine.command is set to "${settings.statusLine.command}" instead of "agy-statusline"`);
                    health = false;
                }
            } else {
                console.error(`   ❌ statusLine configuration is missing in settings.json`);
                health = false;
            }
        } catch (e) {
            console.error(`   ❌ Failed to parse settings.json: ${e.message}`);
            health = false;
        }
    }

    // 3. Check global executable in PATH
    console.log(`\n3. Checking PATH for agy-statusline command...`);
    const pathDirs = (process.env.PATH || '').split(path.delimiter);
    let binaryFound = false;
    const isWindows = process.platform === 'win32';
    const binaryNames = isWindows ? ['agy-statusline.exe', 'agy-statusline.cmd', 'agy-statusline.ps1', 'agy-statusline'] : ['agy-statusline'];

    for (const dir of pathDirs) {
        for (const binName of binaryNames) {
            const fullPath = path.join(dir, binName);
            if (fs.existsSync(fullPath)) {
                console.log(`   ✅ Found executable shim at: ${fullPath}`);
                binaryFound = true;
                break;
            }
        }
        if (binaryFound) break;
    }

    if (!binaryFound) {
        console.error(`   ❌ "agy-statusline" was NOT found in your system PATH.`);
        console.error(`      Make sure your global Bun/NPM binary folder is in your PATH environment variable.`);
        health = false;
    }

    // 4. Try running the statusline script with a mock input
    console.log(`\n4. Simulating Statusline Run...`);
    const mockPayloadPath = path.join(__dirname, 'agy_statusline_stdin.json');
    if (!fs.existsSync(mockPayloadPath)) {
        console.error(`   ❌ Mock input payload NOT found at: ${mockPayloadPath}`);
        health = false;
    } else {
        try {
            const mockInput = fs.readFileSync(mockPayloadPath, 'utf8');
            const runtime = process.release ? 'node' : 'bun';
            const scriptPath = path.join(__dirname, 'statusline.js');
            const output = execSync(`${runtime} "${scriptPath}"`, { input: mockInput, encoding: 'utf8' });
            console.log(`   ✅ Test Run Successful! Output:`);
            console.log(`      ${output}`);
        } catch (e) {
            console.error(`   ❌ Test Run Failed: ${e.message}`);
            health = false;
        }
    }

    console.log('\n---');
    if (health) {
        console.log('🎉 Statusline Health: EXCELLENT (All checks passed)');
    } else {
        console.error('❌ Statusline Health: PROBLEMS DETECTED (See details above)');
    }
}
