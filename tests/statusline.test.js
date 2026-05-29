const test = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, '..', 'statusline.js');

test('renders correct layout with standard inputs and spacing padding', () => {
    const mockInput = {
        cwd: "C:\\Users\\username\\workspace",
        model: {
            display_name: "Gemini 3.5 Flash"
        },
        workspace: {
            current_dir: "C:\\Users\\username\\workspace"
        },
        terminal_width: 150, // Large terminal width to cover padding branch (lines 144-145)
        context_window: {
            total_input_tokens: 50000,
            total_output_tokens: 2000,
            context_window_size: 100000,
            used_percentage: 50
        }
    };
    
    const output = execSync(`node "${scriptPath}"`, {
        input: JSON.stringify(mockInput),
        encoding: 'utf8'
    });
    
    // Check 20-step progress bar (50% = 10 filled, 10 empty)
    assert.match(output, /■{10}□{10}/);
    // Check input/output tokens in k scale
    assert.match(output, /in 50k/);
    assert.match(output, /out 2k/);
    // Check model name
    assert.match(output, /Gemini 3.5 Flash/);
    // Check that padding spaces are present
    assert.match(output, /\s{10,}/, 'Output should have spacing padding');
});

test('dynamic context coloring thresholds', () => {
    // 1. Cyan threshold (<160k input tokens)
    const cyanInput = {
        context_window: { total_input_tokens: 150000, total_output_tokens: 0, used_percentage: 10 }
    };
    const cyanOutput = execSync(`node "${scriptPath}"`, { input: JSON.stringify(cyanInput), encoding: 'utf8' });
    assert.ok(cyanOutput.includes('\x1b[36m'), 'Output should contain cyan color code');
    
    // 2. Orange threshold (>=160k input tokens)
    const orangeInput = {
        context_window: { total_input_tokens: 170000, total_output_tokens: 0, used_percentage: 10 }
    };
    const orangeOutput = execSync(`node "${scriptPath}"`, { input: JSON.stringify(orangeInput), encoding: 'utf8' });
    assert.ok(orangeOutput.includes('\x1b[38;5;208m'), 'Output should contain orange color code');
    
    // 3. Red threshold (>=200k input tokens)
    const redInput = {
        context_window: { total_input_tokens: 220000, total_output_tokens: 0, used_percentage: 10 }
    };
    const redOutput = execSync(`node "${scriptPath}"`, { input: JSON.stringify(redInput), encoding: 'utf8' });
    assert.ok(redOutput.includes('\x1b[31m'), 'Output should contain red color code');
});

test('math rounding & ceiling calculations', () => {
    // 1% used should round up to 1 block in progress bar (ceiling rounding)
    const ceilInput = {
        context_window: { used_percentage: 1, total_input_tokens: 0, total_output_tokens: 0 }
    };
    const ceilOutput = execSync(`node "${scriptPath}"`, { input: JSON.stringify(ceilInput), encoding: 'utf8' });
    assert.match(ceilOutput, /■{1}□{19}/);
    
    // 0% used should be 0 filled blocks
    const zeroInput = {
        context_window: { used_percentage: 0, total_input_tokens: 0, total_output_tokens: 0 }
    };
    const zeroOutput = execSync(`node "${scriptPath}"`, { input: JSON.stringify(zeroInput), encoding: 'utf8' });
    assert.match(zeroOutput, /□{20}/);
});

test('large context window size format (M/MB)', () => {
    const largeInput = {
        cwd: "C:\\Users\\username\\workspace",
        context_window: {
            context_window_size: 2097152, // 2MB
            used_percentage: 10
        }
    };
    const output = execSync(`node "${scriptPath}"`, { input: JSON.stringify(largeInput), encoding: 'utf8' });
    assert.match(output, /of 2M/, 'Output should format context size in millions (M)');
});

test('fallback to environment variable when stdin is empty', () => {
    const envMeta = {
        model: { display_name: "Env Model" },
        workspace: { current_dir: "C:\\env-dir" }
    };
    const output = execSync(`node "${scriptPath}"`, {
        env: {
            ...process.env,
            ANTIGRAVITY_SOURCE_METADATA: JSON.stringify(envMeta)
        },
        encoding: 'utf8'
    });
    assert.match(output, /Env Model/, 'Output should display model name from env variable');
    assert.match(output, /env-dir/, 'Output should display current dir from env variable');
});

test('handles invalid JSON gracefully without crashing', () => {
    const output = execSync(`node "${scriptPath}"`, {
        input: "{ invalid json }",
        encoding: 'utf8'
    });
    // Should fallback to default layout and not crash with exit code 1
    assert.match(output, /Antigravity/, 'Should render default model name on parse error');
});
