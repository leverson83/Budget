# Assistant Guidelines

This file contains guidelines that the AI assistant should follow with every instruction.

## Guidelines

- **Guideline Acknowledgement**: Before making any changes, the assistant must read this file and indicate in the chat that it has been read, so the user knows it has been checked before proceeding.
- **Income Formatting**: All income should be displayed with exactly 2 decimal places (e.g., $500 = $500.00 or 1250 = $1,250.00) unless specified otherwise
- **Frequency Terminology**: All references that would say "biweek" or biweekly should say "fortnight" or fortnightly"
- **Server Management**: Do not start the backend or frontend servers automatically. Ask the user to start them when needed for testing or debugging.

## Import/Export Functionality (Critical Feature)

**Overview**

The import/export system is a core feature that allows users to back up, transfer, and restore all their budget data—including accounts, income, expenses, tags, settings, expense-tag relationships, and manual adjustments—across versions and installations. It is essential for data portability, disaster recovery, and version management.

**How Export Works**
- User triggers export from the UI.
- Frontend calls `/api/export` (optionally with version ID).
- Backend gathers all relevant data for that version (accounts, income, expenses, tags, settings, expense-tag relationships, manual adjustments) and returns a JSON file.
- Frontend prompts the user to download the file.

**How Import Works**
- User selects a previously exported JSON file in the UI.
- Frontend validates and sends the data to `/api/import`.
- Backend creates a new version, remaps all IDs, and imports all data types in a transaction.
- On success, the backend returns a summary; on failure, it rolls back.
- Frontend displays a summary and refreshes the UI.

**Data Integrity and Mapping**
- All relationships are remapped to new IDs to preserve referential integrity.
- The process is atomic (transactional) to prevent partial imports.
- Both frontend and backend validate the import file structure and content.

**What Must Never Be Broken**
- All data types (accounts, income, expenses, tags, settings, expense-tag relationships, manual adjustments) must be fully and accurately exported and imported.
- ID mapping must be correct so that all relationships are preserved.
- No data loss or corruption is acceptable.
- The import/export format must remain backward compatible unless a migration path is provided.
- Any changes to data models or relationships must be reflected in the import/export logic.
- All new fields or entities must be included in both export and import.
- The process must be robust against partial failures (transactional/atomic).
- User must always be able to restore a full version from an export file.

**Reference**
- Frontend: `src/components/ImportExportDialog.tsx`, `src/components/VersionManager.tsx`
- Backend: `/api/export` and `/api/import` in `backend/server.js`
- Test: `backend/test-import-export.js`, `backend/debug-import-export.js`

## Notes

- These guidelines will be referenced for every interaction
- Guidelines can be updated at any time
- The assistant will follow these guidelines consistently 