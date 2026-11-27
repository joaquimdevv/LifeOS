# LifeOS 1.0.0

LifeOS is a personal organization system, designed as a responsive, local-first Progressive Web App (PWA). Phase 1 establishes the navigable foundation, visual preferences, and an encrypted local vault.

## Objective and Scope

The product will integrate tasks, studies, projects, habits, notes, goals, physical activities, a calendar, and focus-tracking tools. It is designed to function without an account or remote service, storing data directly on the device and providing export/import functionality for manual data transfer between devices. Modules will be delivered in stages, beginning with the core foundation and personal routine management.

## Initial Decisions

- Frontend: Semantic HTML, CSS, and modern JavaScript (using ES Modules); no UI framework in the initial version.
- Persistence: IndexedDB, encapsulated by a repository layer. For the foundation, encryption is handled via the native Web Crypto API (PBKDF2-SHA-256 + AES-256-GCM), with no external dependencies.
- PWA: Includes a manifest and a service worker that caches the application’s versioned assets. Personal data is stored in IndexedDB, not in the HTTP cache.
- Charts: inline SVG keeps charts available offline without a runtime chart dependency; D3 remains an option if the knowledge graph later needs larger-scale layouts.
- Privacy: No accounts, synchronization, telemetry, or AI service calls by default.
- Distribution: Static files compatible with HTTPS hosting. Local development requires a simple static server, as ES Modules and service workers do not function correctly when accessed via the `file://` protocol.

Detailed decisions, the database schema, risk assessments, and testing criteria can be found in [docs/architecture.md](docs/architecture.md). 

## Planned Roadmap

### Phase 0 - Planning
- [x] Analyze project specifications
- [x] Define system architecture
- [x] Establish coding conventions
- [x] Design initial database schema
- [x] Create development documentation
-[x] Define testing strategy

### Phase 1 - Foundation
- [x] Build application structure and navigation
- [x] Implement design system
- [x] Implement theming system
- [x] Implement responsive layouts
- [x] Configure IndexedDB
- [x] Implement persistence layer
- [x] Create basic Web App Manifest
- [x] Implement basic Service Worker

### Phase 2 — Organization
- [x] Dashboard
- [x] Task Management
- [x] Calendar
- [x] Habit Tracking
- [x] Goal Management

### Phase 3 — Productivity
- [x] Study Hub
- [x] Project Management
- [x] Notes
- [x] Focus Mode

### Phase 4 — Monitoring and Insights
- [x] Fitness Hub
- [x] Analytics
- [x] Knowledge Graph

### Phase 5 — Advanced Customization
- [ ] Configurable Dashboard — implementation added; encrypted persistence and end-to-end validation pending
- [ ] Reorderable Widgets — arrow controls and drag-and-drop added; end-to-end validation pending
- [ ] Advanced Visual Preferences — expanded density and surface options added; end-to-end validation pending
- [ ] Custom Categories — management and form suggestions added for tasks, projects, goals, and habits; end-to-end validation pending
- [ ] Module-Specific Settings — default task view, analytics/fitness period, and graph size added; end-to-end validation pending

### Phase 6 — Backup and Reliability
- [x] Data Export and Import — independent encrypted backup and confirmed full restore
- [x] File Validation — format, version, limits, KDF parameters, canonical Base64, IV, duplicate IDs, and GCM authentication
- [x] Database Migrations — additive IndexedDB schema migration to version 2
- [x] Error Handling — quota/abort messages and a global fallback for unexpected errors
- [x] Regression Testing — automated backup and restore failure coverage
- [x] Storage Management and Validation — per-collection counts, persistence request, and ciphertext integrity scan

### Phase 7 — Launch and Deployment
- [x] Application resource optimization — no runtime dependencies; static SVG/SVG charts; versioned shell cache
- [x] Installation testing on Android
- [x] Installation testing on Desktop
- [ ] Installation testing on iOS
- [ ] Verification of offline functionality
- [ ] Application update testing
- [ ] HTTPS hosting configuration
- [x] Deployment and maintenance documentation — host/device execution remains pending

**Roadmap and website proposed by artificial intelligence. Text documents also reviewed and corrected by artificial intelligence.**

Phase 4 stores physical-activity entries in the encrypted `fitnessActivities` collection, derives analytics only from saved records, and draws offline-capable SVG charts without an external chart dependency. The knowledge graph reads note links from the encrypted notes collection, offers folder/tag filters, keyboard-selectable nodes, zoom/pan controls, and a list alternative; it limits the graph drawing to 80 nodes for readability. Automated module loading and an isolated browser smoke test against an in-memory vault passed: the fitness create/edit/delete flow, analytics summaries/charts, and knowledge graph rendering were exercised. The smoke test did not use the application's IndexedDB or encryption layer, so end-to-end validation with the real vault and offline installation remains pending; Phase 4 is not marked complete.

Phase 5 adds the encrypted `dashboardLayout`, `customCategories`, and `modulePreferences` settings. The dashboard can hide and reorder six widgets, category suggestions are available while editing tasks, projects, goals, and habits, and module defaults can be selected for task layout, analytics/fitness periods, and graph size. Visual preferences now include a spacious density and soft panel surface. Browser persistence, drag-and-drop behavior across touch/desktop input, and settings recovery after lock/reopen remain to be validated before marking the phase complete.

The responsive sidebar fix adds an explicit close button, an outside-tap overlay, Escape handling, and focus restoration without changing the active route. Its height follows the viewport; only the navigation area scrolls when the content exceeds the space available, keeping the bottom actions visible. The shell cache advances to `lifeos-shell-v7`.

The Accessibility Center adds globally persisted 90–200% text scaling, reinforced contrast, reduced motion, a simplified visual mode, and a skip-to-content link. Fixed CSS text sizes now use the same scale factor, and focus-visible indicators cover all focusable controls. The app shell cache advances to `lifeos-shell-v8`. WCAG 2.2 AA conformance is not claimed until broader module-by-module assistive-technology and reflow checks are complete.

Phase 6 adds portable encrypted JSON backups using a separate PBKDF2-SHA-256 key (310,000 iterations, fresh 16-byte salt) and AES-256-GCM (fresh 12-byte IV, 128-bit tag, `lifeos-backup:v1` AAD). Imports authenticate and validate the complete snapshot before showing a replacement confirmation; restore re-encrypts every record under the currently unlocked vault key and swaps records in one IndexedDB transaction. Backups are limited to 50 MB and 100,000 records. Storage diagnostics include per-collection counts and an integrity scan. IndexedDB schema migration is additive (version 2) and keeps the vault's independent record schema unchanged. The service worker cache advances to `lifeos-shell-v9`. Browser-level validation of migration, download flows, quota behavior in real IndexedDB, and offline use remains pending.

The project version is now `1.0.0` release candidate. Phase 7 release preparation adds deployment and maintenance guidance, keeps the app dependency-free, advances the shell cache to `lifeos-shell-v10`, and aligns the lock screen's password length and backup guidance with the implemented vault. The app is not yet a verified public 1.0 release: host/domain/HTTPS setup and physical-device, browser, offline, install, and update checks still need to be completed. See [docs/deployment.md](docs/deployment.md).
