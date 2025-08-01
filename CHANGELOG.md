# Changelog

All notable changes to this project will be documented in this file.

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
