const vscode = require("vscode");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

/**
 * Creates a temporary file with the given content and extension
 * @param {string} content - Content to write to the temp file
 * @param {string} extension - File extension (e.g., '.php')
 * @param {string} prefix - Prefix for the temp file name
 * @returns {string} Path to the created temp file
 */
function createTempFile(content, extension, prefix) {
    const tmpFile = path.join(
        os.tmpdir(),
        `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`
    );
    fs.writeFileSync(tmpFile, content);
    return tmpFile;
}

/**
 * Configuration for supported formatters
 */
const SUPPORTED_FORMATTERS = {
    pint: {
        name: "pint",
        cmd: (filePath, text) => {
            const ext = path.extname(filePath) || ".php";
            const tmpFile = createTempFile(text, ext, "pint");

            // Handle Pint's special requirements directly in cmd
            const tempDir = path.dirname(tmpFile);
            const tempFileName = path.basename(tmpFile);

            // Find project's pint.json config
            const projectRoot =
                vscode.workspace.rootPath || vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
            const args = ["--quiet"];

            if (projectRoot) {
                const pintConfigPath = path.join(projectRoot, "pint.json");
                if (fs.existsSync(pintConfigPath)) {
                    args.push("--config", pintConfigPath);
                }
            }

            args.push(tempFileName);

            // Return both args and execution options
            return {
                args,
                options: { encoding: "utf8", cwd: tempDir },
                tempFile: tmpFile,
            };
        },
        stdin: false,
        useTemp: true,
    },
    prettier: {
        name: "prettier",
        cmd: filePath => ["--stdin-filepath", filePath],
        stdin: true,
        useTemp: false,
    },
    prettierd: {
        name: "prettierd",
        cmd: () => [],
        stdin: true,
        useTemp: false,
    },
    php_cs_fixer: {
        name: "php-cs-fixer",
        cmd: (filePath, text) => {
            const ext = path.extname(filePath) || ".php";
            const tmpFile = createTempFile(text, ext, "php-cs-fixer");
            return ["fix", tmpFile, "--quiet"];
        },
        stdin: false,
        useTemp: true,
    },
    phpcbf: {
        name: "phpcbf",
        cmd: (filePath, text) => {
            const ext = path.extname(filePath) || ".php";
            const tmpFile = createTempFile(text, ext, "phpcbf");
            return ["--standard=PSR12", tmpFile, "-q"];
        },
        stdin: false,
        useTemp: true,
    },
};
/**
 * Finds the executable path for a formatter
 * @param {string} formatterName - Name of the formatter
 * @param {string[]} userPath - User's PATH directories
 * @returns {string|null} Path to the formatter executable or null if not found
 */
function findFormatterPath(formatterName, userPath) {
    // Check system PATH
    for (const dir of userPath) {
        const candidate = path.join(dir, formatterName);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    // Check vendor/bin (for PHP tools)
    const workspaceRoot =
        vscode.workspace.rootPath || vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
    if (workspaceRoot) {
        const vendorBin = path.join(workspaceRoot, "vendor", "bin", formatterName);
        if (fs.existsSync(vendorBin)) {
            return vendorBin;
        }

        // Check node_modules/.bin (for Node.js tools)
        const nodeBin = path.join(workspaceRoot, "node_modules", ".bin", formatterName);
        if (fs.existsSync(nodeBin)) {
            return nodeBin;
        }
    }

    return null;
}

/**
 * Executes a formatter using stdin
 * @param {string} formatterPath - Path to the formatter executable
 * @param {string[]} args - Command arguments
 * @param {string} content - Content to format
 * @returns {{success: boolean, result: string, error?: string}} Execution result
 */
function executeStdinFormatter(formatterPath, args, content) {
    try {
        const result = execSync(`${formatterPath} ${args.join(" ")}`, {
            input: content,
            encoding: "utf8",
        });
        return { success: true, result };
    } catch (error) {
        return {
            success: false,
            result: content,
            error: error.message,
        };
    }
}

/**
 * Executes a formatter using temporary files
 * @param {string} formatterPath - Path to the formatter executable
 * @param {string[]} args - Command arguments
 * @param {object} options - Execution options
 * @param {boolean} debugMode - Whether debug mode is enabled
 * @returns {{success: boolean, status: number, stdout?: string, stderr?: string}} Execution result
 */
function executeTempFileFormatter(formatterPath, args, options, debugMode) {
    const result = spawnSync(formatterPath, args, options);

    if (debugMode) {
        vscode.window.showInformationMessage(
            `${path.basename(formatterPath)} exit status: ${result.status}, stdout: ${result.stdout || "none"}, stderr: ${result.stderr || "none"}`
        );
    }

    return {
        success: isFormatterSuccessful(formatterPath, result.status),
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
    };
}

/**
 * Determines if a formatter execution was successful based on exit status
 * @param {string} formatterPath - Path to the formatter
 * @param {number} status - Exit status
 * @returns {boolean} Whether the execution was successful
 */
function isFormatterSuccessful(formatterPath, status) {
    const formatterName = path.basename(formatterPath);

    if (formatterName.includes("phpcbf")) {
        return status === 0 || status === 1;
    }

    if (formatterName.includes("pint")) {
        return status === 0 || status === 2; // 0 = no changes, 2 = changes made
    }

    return status === 0;
}

/**
 * Reads the formatted content from the appropriate source
 * @param {object} lastFmtDef - Last formatter definition
 * @param {string} stdinResult - Result from stdin formatter
 * @param {string} tempFilePath - Path to temp file
 * @param {string} originalFilePath - Path to original file
 * @param {boolean} debugMode - Whether debug mode is enabled
 * @returns {string|null} Formatted content or null on error
 */
function getFormattedContent(lastFmtDef, stdinResult, tempFilePath, originalFilePath, debugMode) {
    if (lastFmtDef.stdin) {
        return stdinResult;
    }

    if (lastFmtDef.useTemp && tempFilePath) {
        try {
            if (debugMode) {
                vscode.window.showInformationMessage(
                    `Reading formatted content from temp file: ${tempFilePath}`
                );
            }

            const content = fs.readFileSync(tempFilePath, "utf8");

            if (debugMode) {
                vscode.window.showInformationMessage(
                    `Read ${content.length} characters from temp file`
                );
            }

            return content;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read formatted temp file: ${error.message}`);
            return null;
        }
    }

    // Fallback: read from original file
    try {
        return fs.readFileSync(originalFilePath, "utf8");
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to read original file: ${error.message}`);
        return null;
    }
}

/**
 * Main function to run formatters on text content
 * @param {vscode.TextDocument} document - The document to format
 * @param {string} text - Content to format
 * @param {object} langConfig - Language-specific formatter configuration
 * @param {boolean} debugMode - Whether debug mode is enabled
 * @returns {Promise<string|null>} Formatted content or null on failure
 */
async function runFormattersOnText(document, text, langConfig, debugMode) {
    const userPath = process.env.PATH.split(path.delimiter);
    const filePath = document.uri.fsPath;
    const stopAfterFirst = langConfig.stop_after_first !== false;

    let formattedContent = text;
    let overallSuccess = false;
    let lastTempFilePath = null;
    let lastFormatterDef = null;

    for (const formatterName of langConfig.formatters) {
        const fmtDef = SUPPORTED_FORMATTERS[formatterName];
        if (!fmtDef) {
            if (debugMode) {
                vscode.window.showWarningMessage(`Unknown formatter: ${formatterName}`);
            }
            continue;
        }

        const formatterPath = findFormatterPath(fmtDef.name || formatterName, userPath);
        if (!formatterPath) {
            if (debugMode) {
                vscode.window.showWarningMessage(`Formatter not found: ${formatterName}`);
            }
            continue;
        }

        try {
            let args,
                options = { encoding: "utf8" };
            let tempFilePath = null;

            // Get command configuration
            const cmdResult = fmtDef.cmd(filePath, formattedContent);

            if (Array.isArray(cmdResult)) {
                // Traditional formatters return just args array
                args = cmdResult;
                if (fmtDef.useTemp) {
                    tempFilePath = args[args.length - 1];
                    lastTempFilePath = tempFilePath;
                }
            } else {
                // Modern formatters (like Pint) return an object with args, options, and tempFile
                args = cmdResult.args;
                options = cmdResult.options || options;
                tempFilePath = cmdResult.tempFile;
                if (tempFilePath) {
                    lastTempFilePath = tempFilePath;
                }
            }

            if (debugMode) {
                vscode.window.showInformationMessage(
                    `Rectify running: ${formatterPath} ${args.map(a => JSON.stringify(a)).join(" ")}`
                );
            }

            let success = false;

            if (fmtDef.stdin) {
                // Handle stdin-based formatters
                const result = executeStdinFormatter(formatterPath, args, formattedContent);
                if (result.success) {
                    formattedContent = result.result;
                    success = true;
                } else if (debugMode && result.error) {
                    vscode.window.showErrorMessage(`${formatterName} failed: ${result.error}`);
                }
            } else {
                // Handle temp file-based formatters
                const result = executeTempFileFormatter(formatterPath, args, options, debugMode);
                success = result.success;

                if (!success && debugMode) {
                    vscode.window.showErrorMessage(
                        `${formatterName} failed with status ${result.status}: ${result.stderr || result.stdout || "Unknown error"}`
                    );
                }
            }

            if (success) {
                overallSuccess = true;
                lastFormatterDef = fmtDef;

                if (debugMode) {
                    vscode.window.showInformationMessage(`${formatterName} completed successfully`);
                }

                if (stopAfterFirst) break;
            }
        } catch (error) {
            if (debugMode) {
                vscode.window.showErrorMessage(`${formatterName} crashed: ${error.message}`);
            }
            console.error(`Formatter ${formatterName} failed:`, error);
        }
    }

    if (!overallSuccess) {
        return null;
    }

    // Get the final formatted content
    const finalContent = getFormattedContent(
        lastFormatterDef,
        formattedContent,
        lastTempFilePath,
        filePath,
        debugMode
    );

    if (debugMode && finalContent) {
        const preview = String(finalContent).substring(0, 500);
        vscode.window.showInformationMessage(
            `Rectify formatted result (first 500 chars): ${preview}`
        );
    }

    return finalContent;
}

/**
 * Creates a command handler for document formatting
 * @param {Function} getDebugMode - Function that returns current debug mode state
 * @returns {Function} Command handler function
 */
function createFormatDocumentHandler(getDebugMode) {
    return async function () {
        const debugMode = getDebugMode();
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor.");
            return;
        }

        const document = editor.document;
        const languageId = document.languageId;
        const config = vscode.workspace.getConfiguration("rectify");
        const langFormatters = config.get("formatters") || {};
        const langConfig = langFormatters[languageId];

        if (!langConfig?.formatters?.length) {
            vscode.window.showErrorMessage(`No formatter configured for language: ${languageId}`);
            return;
        }

        const text = document.getText();
        const formattedContent = await runFormattersOnText(document, text, langConfig, debugMode);

        if (!formattedContent) {
            if (debugMode) {
                vscode.window.showWarningMessage("No formatters succeeded");
            }
            return;
        }

        if (formattedContent !== text) {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );
            edit.replace(document.uri, fullRange, formattedContent);
            await vscode.workspace.applyEdit(edit);
            await document.save();
        }
    };
}

/**
 * Creates a formatting edit provider
 * @param {Function} getDebugMode - Function that returns current debug mode state
 * @returns {object} VS Code formatting edit provider
 */
function createFormattingEditProvider(getDebugMode) {
    return {
        async provideDocumentFormattingEdits(document) {
            const debugMode = getDebugMode();
            const languageId = document.languageId;
            const config = vscode.workspace.getConfiguration("rectify");
            const langFormatters = config.get("formatters") || {};
            const langConfig = langFormatters[languageId];

            if (!langConfig?.formatters?.length) {
                return [];
            }

            const text = document.getText();
            const formattedContent = await runFormattersOnText(
                document,
                text,
                langConfig,
                debugMode
            );

            if (!formattedContent || formattedContent === text) {
                return [];
            }

            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );
            return [vscode.TextEdit.replace(fullRange, formattedContent)];
        },
    };
}

/**
 * VS Code extension activation function
 * @param {vscode.ExtensionContext} context - Extension context
 */
function activate(context) {
    let debugMode = false;

    // Debug toggle command
    const debugDisposable = vscode.commands.registerCommand("rectify.toggleDebug", function () {
        debugMode = !debugMode;
        vscode.window.showInformationMessage(
            `Rectify debug mode is now ${debugMode ? "ON" : "OFF"}`
        );
    });

    // Format document command
    const formatDisposable = vscode.commands.registerCommand(
        "rectify.formatDocument",
        createFormatDocumentHandler(() => debugMode)
    );

    // Register formatting edit providers
    const fileFormattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
        { scheme: "file" },
        createFormattingEditProvider(() => debugMode)
    );

    const allLanguagesFormattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
        { scheme: "file", language: "*" },
        createFormattingEditProvider(() => debugMode)
    );

    // Add all disposables to context
    context.subscriptions.push(
        debugDisposable,
        formatDisposable,
        fileFormattingProvider,
        allLanguagesFormattingProvider
    );
}

/**
 * VS Code extension deactivation function
 */
function deactivate() {
    // Cleanup if needed
}

// Export the required functions
module.exports = {
    activate,
    deactivate,
    SUPPORTED_FORMATTERS, // Export for testing
};
