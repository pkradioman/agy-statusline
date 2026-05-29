#!/usr/bin/env bun
const fs = require('fs');
const path = require('path');

let timeout;

if (require.main === module) {
    let inputData = '';
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
        inputData += chunk;
    });

    process.stdin.on('end', () => {
        renderStatusline(inputData, 'end_event');
    });

    // To prevent hanging if stdin is not closed or redirected, set a safety timeout.
    timeout = setTimeout(() => {
        renderStatusline(inputData, 'timeout');
        process.exit(0);
    }, 150);
}

function renderStatusline(jsonStr, triggerSource) {
    clearTimeout(timeout);
    
    // Default values
    let used_pct = 0;
    let size = 0;
    let model_name = 'Antigravity';
    let current_dir = process.cwd();
    let terminal_width = 80;
    let input_tokens = 0;
    let output_tokens = 0;
    let errorLog = '';

    // Read from environment fallback if stdin is empty
    if (process.env.ANTIGRAVITY_SOURCE_METADATA) {
        try {
            let envMeta = process.env.ANTIGRAVITY_SOURCE_METADATA.replace(/^\uFEFF/, '');
            const meta = JSON.parse(envMeta);
            if (meta.model && (meta.model.display_name || meta.model.id)) {
                model_name = meta.model.display_name || meta.model.id;
            }
            if (meta.workspace && meta.workspace.current_dir) {
                current_dir = meta.workspace.current_dir;
            }
        } catch (e) {
            errorLog += `[Env Parse Err: ${e.message}] `;
        }
    }

    if (jsonStr) {
        try {
            jsonStr = jsonStr.replace(/^\uFEFF/, '').trim();
            if (jsonStr) {
                const data = JSON.parse(jsonStr);
                
                if (data.model) {
                    model_name = data.model.display_name || data.model.id || model_name;
                }
                if (data.workspace && data.workspace.current_dir) {
                    current_dir = data.workspace.current_dir;
                } else if (data.cwd) {
                    current_dir = data.cwd;
                }
                if (data.terminal_width !== undefined) {
                    terminal_width = Number(data.terminal_width) || 80;
                }
                
                if (data.context_window) {
                    let cw = data.context_window;
                    used_pct = cw.used_percentage !== undefined ? Math.round(cw.used_percentage) : 0;
                    size = cw.context_window_size !== undefined ? cw.context_window_size : 0;
                    input_tokens = cw.total_input_tokens !== undefined ? cw.total_input_tokens : 0;
                    output_tokens = cw.total_output_tokens !== undefined ? cw.total_output_tokens : 0;
                }
                
                // Save to file for debugging
                const userProfile = process.env.USERPROFILE || process.env.HOME || '';
                const targetDir = path.join(userProfile, 'temp');
                if (fs.existsSync(targetDir)) {
                    fs.writeFileSync(path.join(targetDir, 'agy_statusline_stdin.txt'), jsonStr, 'utf8');
                }
            }
        } catch (e) {
            errorLog += `[Stdin Parse Err: ${e.message}. Content: ${JSON.stringify(jsonStr)}] `;
        }
    }
    
    // Format size
    let formatted_size = String(size);
    if (size >= 1048576) {
        formatted_size = `${Math.floor(size / 1048576)}M`;
    } else if (size >= 1024) {
        formatted_size = `${Math.floor(size / 1024)}k`;
    }

    // ANSI color codes
    const RESET = '\x1b[0m';
    const BOLD = '\x1b[1m';
    const GREY = '\x1b[90m';
    const CYAN = '\x1b[36m';
    const BLUE = '\x1b[34m';
    const GREEN = '\x1b[32m';
    const RED = '\x1b[31m';
    const ORANGE = '\x1b[38;5;208m';

    // Determine color of context info
    let CONTEXT_COLOR = CYAN;
    if (input_tokens >= 200000) {
        CONTEXT_COLOR = RED;
    } else if (input_tokens >= 160000) {
        CONTEXT_COLOR = ORANGE;
    }

    const formatK = (n) => {
        return `${Math.round(n / 1000)}k`;
    };

    let filled = Math.min(20, Math.max(0, Math.ceil(used_pct / 5)));
    let empty = 20 - filled;
    let bar = `[${'■'.repeat(filled)}${'□'.repeat(empty)}]`;

    // Form left and right parts with color codes
    let left_str = `${GREY}? for shortcuts${RESET}${GREY} • ${RESET}${CONTEXT_COLOR}${bar} ${used_pct}% of ${formatted_size}${RESET}${GREY} • ${RESET}${CONTEXT_COLOR}in ${formatK(input_tokens)}${RESET}${GREY} | ${RESET}${CONTEXT_COLOR}out ${formatK(output_tokens)}${RESET}`;
    let right_str = `${GREEN}${current_dir}${RESET}${GREY} • ${RESET}${BOLD}${model_name}${RESET}`;

    // Strip ANSI codes to calculate actual printed length
    const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
    let plain_left = stripAnsi(left_str);
    let plain_right = stripAnsi(right_str);

    let left_len = plain_left.length;
    let right_len = plain_right.length;

    // Calculate padding size using clean lengths
    let padding_size = terminal_width - left_len - right_len;
    
    let status = '';
    if (padding_size > 0) {
        let padding = ' '.repeat(padding_size);
        status = `${left_str}${padding}${right_str}`;
    } else {
        status = `${left_str}${GREY} • ${RESET}${right_str}`;
    }

    process.stdout.write(status);

    // Write debug log
    const userProfile = process.env.USERPROFILE || process.env.HOME || '';
    const logFile = path.join(userProfile, 'temp', 'statusline_debug.log');
    const logEntry = `${new Date().toISOString()} - Executed via ${triggerSource}. Model: ${model_name}. Cwd: ${current_dir}. Errs: ${errorLog}\n`;
    try {
        fs.appendFileSync(logFile, logEntry, 'utf8');
    } catch(e) {}
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderStatusline,
    };
}
