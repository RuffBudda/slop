# Changelog

## [Latest] - 2024-12-19

### Added
- **Identification Field**: Added a new "Identification" field to the post creation/editing form. This field allows users to add an identifier or reference for posts.
- **File Import Feature**: Added ability to import `.txt` files for Template and Sample fields in the post form. Users can click the "📄 Import" button next to these fields to upload text files.
- **Settings Reorganization**: Settings page has been reorganized into logical sections:
  - Account & Security (Profile, Password)
  - API & Integrations (API Keys, Google Drive, LinkedIn)
  - AI Configuration (Prompts, Stability AI settings)
  - Content Management (Content Ideas sheet)
  - Analytics & Tools (Environmental Impact Calculator)
  - Administration (User Management)
- **Environmental Impact Calculator Enhancement**: Calculator now pulls data from scheduled posts count in addition to workflow statistics.

### Changed
- **Removed Preconfigured Prompts**: All preconfigured prompts (Adam Ridgway/ONE MOTO branding) have been removed and replaced with generic, customizable templates. This makes the installation a fresh start without any brand-specific configurations.
- **Database Schema**: Added `identification` column to the `posts` table via migration.

### Fixed
- **Authentication**: Improved error handling for authentication issues. The API now properly sends session cookies with `credentials: 'same-origin'`.

### Technical Details

#### Database Changes
- Migration added to automatically add `identification` column to existing `posts` table
- Column is nullable TEXT field

#### API Changes
- `POST /api/posts` now accepts `identification` field
- `PUT /api/posts/:id` now accepts `identification` field for updates
- Bulk operations updated to handle `identification` field

#### Frontend Changes
- Post edit modal updated with Identification field
- File input handlers added for Template and Sample fields
- Settings page restructured with grouped sections
- Calculator updated to use scheduled posts API

### Migration Notes
- The database migration will automatically run on server start
- Existing posts will have `NULL` for the `identification` field
- No data loss expected

### Breaking Changes
- None - all changes are backward compatible
