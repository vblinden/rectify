const vscode = require('vscode');

async function runFormattersOnText(document, text, langConfig, debugMode) {
	const SUPPORTED_FORMATTERS = module.exports.SUPPORTED_FORMATTERS || global.SUPPORTED_FORMATTERS || {
		pint: {
			name: 'pint',
			cmd: (filePath, text) => {
				const os = require('os');
				const fs = require('fs');
				const path = require('path');
				const ext = path.extname(filePath) || '.php';
				const tmpFile = path.join(os.tmpdir(), `pint-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
				fs.writeFileSync(tmpFile, text);
				return ['--quiet', '--no-interaction', tmpFile];
			},
			stdin: false,
			useTemp: true,
		},
		prettier: {
			name: 'prettier',
			cmd: (filePath) => ["--stdin-filepath", filePath],
			stdin: true,
		},
		prettierd: {
			name: 'prettierd',
			cmd: () => [],
			stdin: true,
		},
		php_cs_fixer: {
			name: 'php-cs-fixer',
			cmd: (filePath, text) => {
				const os = require('os');
				const fs = require('fs');
				const path = require('path');
				const ext = path.extname(filePath) || '.php';
				const tmpFile = path.join(os.tmpdir(), `php-cs-fixer-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
				fs.writeFileSync(tmpFile, text);
				return ['fix', tmpFile, '--quiet'];
			},
			stdin: false,
			useTemp: true,
		},
		phpcbf: {
			name: 'phpcbf',
			cmd: (filePath, text) => {
				const os = require('os');
				const fs = require('fs');
				const path = require('path');
				const ext = path.extname(filePath) || '.php';
				const tmpFile = path.join(os.tmpdir(), `phpcbf-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
				fs.writeFileSync(tmpFile, text);
				return ['--standard=PSR12', tmpFile, '-q'];
			},
			stdin: false,
			useTemp: true,
		},
	};
	const path = require('path');
	const fs = require('fs');
	const userPath = process.env.PATH.split(path.delimiter);
	const filePath = document.uri.fsPath;
	let formatted = text;
	let success = false;
	let lastTempFilePath = null;
	let lastTempFilePathForRead = null;
	let called = false;
	const stopAfterFirst = langConfig.stop_after_first !== false;
	for (const formatter of langConfig.formatters) {
		let args = undefined;
		const fmtDef = SUPPORTED_FORMATTERS[formatter];
		if (!fmtDef) continue;
		let formatterPath = fmtDef.name || formatter;
		let found = false;
		for (const p of userPath) {
			const candidate = path.join(p, formatterPath);
			if (fs.existsSync(candidate)) {
				formatterPath = candidate;
				found = true;
				break;
			}
		}
		if (!found) {
			const vendorBin = path.join(vscode.workspace.rootPath || '', 'vendor', 'bin', formatterPath);
			if (fs.existsSync(vendorBin)) {
				formatterPath = vendorBin;
				found = true;
			}
		}
		if (!found) {
			const nodeBin = path.join(vscode.workspace.rootPath || '', 'node_modules', '.bin', formatterPath);
			if (fs.existsSync(nodeBin)) {
				formatterPath = nodeBin;
				found = true;
			}
		}
		if (!found) continue;
		try {
			const { execSync, spawnSync } = require('child_process');
			if (fmtDef.useTemp) {
				args = fmtDef.cmd(filePath, formatted);
				const tempFileCandidate = args.find(arg => typeof arg === 'string' && arg.startsWith('/'));
				lastTempFilePath = tempFileCandidate;
			} else {
				args = fmtDef.cmd(filePath);
			}
			if (fmtDef.stdin) {
				called = true;
				formatted = execSync(formatterPath + ' ' + args.join(' '), { input: formatted, encoding: 'utf8' });
				success = true;
				if (fmtDef.useTemp) lastTempFilePathForRead = lastTempFilePath;
			} else {
				called = true;
				const result = spawnSync(formatterPath, args, { encoding: 'utf8' });
				if (formatterPath.includes('phpcbf')) {
					if (result.status === 0 || result.status === 1) {
						success = true;
						if (fmtDef.useTemp) lastTempFilePathForRead = lastTempFilePath;
					}
				} else if (result.status === 0) {
					success = true;
					if (fmtDef.useTemp) lastTempFilePathForRead = lastTempFilePath;
				}
				if (fmtDef.useTemp) lastTempFilePathForRead = lastTempFilePath;
			}
			if (success && stopAfterFirst) break;
		} catch (e) {
			if (called && debugMode) {
				let errorMsg = `Formatter ${formatterPath} failed.`;
				if (e.stdout || e.stderr) {
					const out = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
					errorMsg += ` Output: ${out.substring(0, 500)}`;
				}
				vscode.window.showErrorMessage(errorMsg);
				console.error(`Formatter ${formatterPath} failed:`, e.message, e.stdout?.toString(), e.stderr?.toString());
			}
		}
		if (debugMode && fmtDef.useTemp && lastTempFilePathForRead) {
			vscode.window.showInformationMessage(`Temp file for ${formatter}: ${lastTempFilePathForRead}`);
		}
		if (debugMode) {
			vscode.window.showInformationMessage(`Formatter: ${formatter}, Path: ${formatterPath}, Args: ${args ? args.join(' ') : ''}`);
		}
	}
	if (!success) return null;
	// Use the correct output depending on formatter type
	let formattedFileContent;
	const lastFormatter = langConfig.formatters.findLast(f => SUPPORTED_FORMATTERS[f]);
	const lastFmtDef = lastFormatter ? SUPPORTED_FORMATTERS[lastFormatter] : null;
	if (lastFmtDef && lastFmtDef.stdin) {
		formattedFileContent = formatted;
	} else if (lastFmtDef && lastFmtDef.useTemp && lastTempFilePathForRead) {
		try {
			formattedFileContent = require('fs').readFileSync(lastTempFilePathForRead, 'utf8');
			try { require('fs').unlinkSync(lastTempFilePathForRead); } catch {}
		} catch {
			vscode.window.showErrorMessage('Failed to read formatted temp file.');
			return null;
		}
	} else {
		try {
			formattedFileContent = fs.readFileSync(filePath, 'utf8');
		} catch {
			vscode.window.showErrorMessage('Failed to read formatted file.');
			return null;
		}
	}
	return formattedFileContent;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	let debugMode = false;

	const debugDisposable = vscode.commands.registerCommand('rectify.toggleDebug', function () {
		debugMode = !debugMode;
		vscode.window.showInformationMessage(`Multiformat debug mode is now ${debugMode ? 'ON' : 'OFF'}`);
	});
	context.subscriptions.push(debugDisposable);

	const formatDisposable = vscode.commands.registerCommand('rectify.formatDocument', async function () {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor.');
			return;
		}
		const document = editor.document;
		const languageId = document.languageId;
		const config = vscode.workspace.getConfiguration('rectify');
		const langFormatters = config.get('formatters') || {};
		const langConfig = langFormatters[languageId];
		if (!langConfig || !langConfig.formatters || langConfig.formatters.length === 0) {
			vscode.window.showErrorMessage(`No formatter configured for language: ${languageId}`);
			return;
		}
		let text = document.getText();
		const formattedFileContent = await runFormattersOnText(document, text, langConfig, debugMode);
		if (!formattedFileContent) return;
		const edit = new vscode.WorkspaceEdit();
		const fullRange = new vscode.Range(
			document.positionAt(0),
			document.positionAt(text.length)
		);
		edit.replace(document.uri, fullRange, formattedFileContent);
		await vscode.workspace.applyEdit(edit);
		await document.save();
	});

	context.subscriptions.push(formatDisposable);

	// Register as a document formatting edit provider
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider({ scheme: 'file' }, {
			async provideDocumentFormattingEdits(document) {
				const languageId = document.languageId;
				const config = vscode.workspace.getConfiguration('rectify');
				const langFormatters = config.get('formatters') || {};
				const langConfig = langFormatters[languageId];
				if (!langConfig || !langConfig.formatters || langConfig.formatters.length === 0) {
					return [];
				}
				let text = document.getText();
				const formattedFileContent = await runFormattersOnText(document, text, langConfig, debugMode);
				if (!formattedFileContent || formattedFileContent === text) return [];
				const fullRange = new vscode.Range(
					document.positionAt(0),
					document.positionAt(text.length)
				);
				return [vscode.TextEdit.replace(fullRange, formattedFileContent)];
			}
		})
	);

	// Register as a document formatting edit provider for all languages
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider(
			{ scheme: 'file', language: '*' },
			{
				async provideDocumentFormattingEdits(document) {
					const languageId = document.languageId;
					const config = vscode.workspace.getConfiguration('rectify');
					const langFormatters = config.get('formatters') || {};
					const langConfig = langFormatters[languageId];
					if (!langConfig || !langConfig.formatters || langConfig.formatters.length === 0) {
						return [];
					}
					let text = document.getText();
					const formattedFileContent = await runFormattersOnText(document, text, langConfig, debugMode);
					if (!formattedFileContent || formattedFileContent === text) return [];
					const fullRange = new vscode.Range(
						document.positionAt(0),
						document.positionAt(text.length)
					);
					return [vscode.TextEdit.replace(fullRange, formattedFileContent)];
				}
			}
		)
	);
}

function deactivate() {
    //
}

module.exports = {
	activate,
	deactivate
}
