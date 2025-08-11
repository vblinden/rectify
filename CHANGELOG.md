# Changelog

All notable changes to this project will be documented in this file.

## [1.0.2] - 2025-01-27

### Fixed

- **Duplicate Formatter Entries**: Fixed issue where Rectify appeared twice in the "Format document with..." menu
  - Removed duplicate document formatting edit provider registration
  - Consolidated formatter registration to use single provider for all file types
  - Maintains full functionality while eliminating duplicate menu entries

## [1.0.0] - 2025-08-08

### Added

- Support for Cursor by broadening VS Code engine compatibility

### Changed

- Pin VS Code type definitions to `@types/vscode@1.83.0`
 - Set `engines.vscode` to `^1.83.0` to match the bundled `@types/vscode`

## [0.0.4] - 2025-07-29

### Fixed

- **Pint Formatter Issues**: Fixed critical issues with Laravel Pint formatter that was not executing properly
  - Fixed temp file path detection logic that was preventing Pint from formatting files
  - Resolved issue where Pint would process entire project instead of single file
  - Added proper working directory handling for Pint execution
  - Fixed project configuration file detection for `pint.json`

### Added

- **Enhanced Pint Support**: Improved Laravel Pint integration with proper configuration handling
  - Added `--quiet` flag to Pint for cleaner output
  - Automatic detection and use of project's `pint.json` configuration file
  - Proper isolation to format only the current file, not the entire project

### Changed

- **Code Architecture Improvements**: Major refactoring for better maintainability and robustness
  - Moved special formatter handling into individual `cmd` functions for better separation of concerns
  - Removed legacy `requiresSpecialHandling` flags in favor of self-contained formatter definitions
  - Added comprehensive error handling and debug logging throughout the codebase
  - Improved formatter discovery logic with better path resolution
  - Enhanced documentation with JSDoc comments for all functions
  - Split complex functions into smaller, focused utility functions
  - Added proper TypeScript-style parameter validation and error handling

- **Better Debug Experience**: Enhanced debugging capabilities
  - More granular debug messages for each step of the formatting process
  - Clear success/failure reporting for individual formatters
  - Command and argument logging for troubleshooting
  - Temp file path tracking and validation

### Technical

- Added `.prettierrc` configuration file with 4-space indentation
- Improved resource management and temp file handling
- Better VS Code API integration with proper disposable management
- Enhanced formatter execution with stdin and temp file support
- More robust configuration loading and validation

## [0.0.3] - 2025-06-10

### Added

- Add logo to the extension.

## [0.0.2] - 2025-06-10

### Changed

- Improved extension activation: Rectify now declares activation events and language contributions for better default formatter support in VS Code. You can now set Rectify as the default formatter without running the command first.

## [0.0.1] - 2025-06-08

### Added

- First release.
