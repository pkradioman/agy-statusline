# Gemini Context Persistence & Project Decisions

This file serves as the source of truth for the architectural decisions, rules, and guidelines of this repository.

## Project Structure

- **`statusline.js`**: Core prompt rendering engine, written in cross-platform JS.
- **`package.json`**: Package configuration defining the global executable command `agy-statusline` for linking.
- **`setup.js`**: An installer and diagnostic doctor utility.
- **`agy_statusline_stdin.json`**: Anonymized input mock payload.

## Core Architectural Decisions

### 1. Zero Runtime Dependencies & Engine Target
- Target Engine: **Bun** (recommended) or Node.js.
- Standard Library Only: The statusline must not use any `npm` package dependencies to minimize startup latency and ensure it is lightweight and portable.
- Startup Time Target: **< 15ms** (with Bun target of **~3ms**) to avoid trigger timeouts in CLI managers.

### 2. Output Design Rules
- Format: `? for shortcuts • {progress_bar} {used_pct}% of {limit} • in {input}k | out {output}k {padding} {cwd} • {model_name}`
- Separators: Standard block elements are separated by grey bullets (`•`), while internal token counts (`in` and `out`) are separated by a grey pipe (`|`).
- Dynamic Color Warnings: Based strictly on **total input tokens**:
  - **Cyan**: Normal ($<160\text{k}$ tokens)
  - **Orange**: Warning ($\ge 160\text{k}$ tokens)
  - **Red**: Alert ($\ge 200\text{k}$ tokens)

### 3. Progress Bar Math
- Dimension: Exactly **20 characters** long.
- Scale: Each character (`■` or `□`) represents exactly **5%** usage.
- Rounding: Must use **ceiling rounding** (`Math.ceil`) to ensure any usage $>0\%$ displays at least 1 filled block.

### 4. Setup & Diagnostics Command
- `setup.js` acts as the one-click installer and also implements `setup.js doctor` for cross-platform system verification.
- Writes to `settings.json` must be performed using UTF-8 without BOM to prevent CLI parsing failures.

## Anonymization Guideline
- All paths, repositories, configuration targets, and mock datasets must be sanitized of personal credentials, local Windows usernames, and email addresses. Use generic tokens like `C:\Users\<username>\` and `user@example.com`.
