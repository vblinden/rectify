# Rectify

Rectify is a VS Code extension that lets you format your files using a configurable sequence of CLI formatters per language. It supports both stdin-based and temp-file-based formatters, and is designed to minimize editor flicker and preserve unsaved changes.

## Features

- Configure multiple CLI formatters (e.g., Prettier, Pint, php-cs-fixer, phpcbf) per language.
- Runs formatters in sequence, stopping after the first success (or run them all after each other, if configured).
- Supports both stdin and temp-file-based formatters.
- Resolves formatter executables from PATH, vendor/bin, and node_modules/.bin.
- Minimizes user disruption: atomic formatting, no flicker, preserves unsaved changes.
- Debug mode for troubleshooting formatter issues.
- Command palette support: `Rectify: Format document` and `Rectify: Toggle debug mode`.

## Requirements

- You must have the desired CLI formatters installed and available in your PATH, or in your project's `vendor/bin` or `node_modules/.bin`.
- No additional VS Code dependencies are required.

## Supported Formatters

Rectify currently supports the following CLI formatters out of the box:

- **prettier** (JavaScript, TypeScript, etc.)
- **prettierd** (JavaScript, TypeScript, etc.)
- **pint** (PHP)
- **php-cs-fixer** (PHP)
- **phpcbf** (PHP)

You can add more by editing the extension source and following the same pattern.

## Extension Settings

This extension contributes the following settings:

- `rectify.formatters`: Map of languageId to formatter configuration. Example:

```json
"rectify.formatters": {
  "php": {
    "formatters": ["pint", "php-cs-fixer"],
    "stop_after_first": false
  },
  "javascript": {
    "formatters": ["prettier"],
    "stop_after_first": true
  }
}
```
- `formatters`: Array of formatter names to run in order.
- `stop_after_first`: (default: true) Stop after the first successful formatter, or run all if false.

## Usage

- Use the command palette (`Cmd+Shift+P`/`Ctrl+Shift+P`) and run `Rectify: Format document` to format the current file.
- Formatting on save is supported if you set VS Code's `editor.formatOnSave` to true.
- Toggle debug mode with `Rectify: Toggle debug mode` for troubleshooting.

## Known Issues

- Formatters must be installed and available in your PATH or project directories.
- Some formatters may not support stdin or temp files as expected; see debug output for troubleshooting.

## Release Notes

### 0.0.1
- Initial release: multi-formatter support, temp file and stdin handling, debug mode, atomic formatting.
