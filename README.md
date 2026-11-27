# LifeOS

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
- [ ] Fitness Hub — implementation added; end-to-end validation pending
- [ ] Analytics — implementation added; end-to-end validation pending
- [ ] Knowledge Graph — implementation added; end-to-end validation pending

### Phase 5 — Advanced Customization
- [ ] Configurable Dashboard
- [ ] Reorderable Widgets
- [ ] Advanced Visual Preferences
- [ ] Custom Categories
- [ ] Module-Specific Settings

### Phase 6 — Backup and Reliability
- [ ] Data Export and Import
- [ ] File Validation
- [ ] Database Migrations
- [ ] Error Handling
- [ ] Regression Testing
- [ ] Storage Management and Validation

### Phase 7 — Launch and Deployment
- [ ] Application resource optimization
- [ ] Installation testing on Android
- [ ] Installation testing on Desktop
- [ ] Installation testing on iOS
- [ ] Verification of offline functionality
- [ ] Application update testing
- [ ] HTTPS hosting configuration
- [ ] Deployment and maintenance documentation

**Roadmap and website proposed by artificial intelligence. Text documents also reviewed and corrected by artificial intelligence.**

Phase 4 stores physical-activity entries in the encrypted `fitnessActivities` collection, derives analytics only from saved records, and draws offline-capable SVG charts without an external chart dependency. The knowledge graph reads note links from the encrypted notes collection, offers folder/tag filters, keyboard-selectable nodes, zoom/pan controls, and a list alternative; it limits the graph drawing to 80 nodes for readability. Automated module loading and an isolated browser smoke test against an in-memory vault passed: the fitness create/edit/delete flow, analytics summaries/charts, and knowledge graph rendering were exercised. The smoke test did not use the application's IndexedDB or encryption layer, so end-to-end validation with the real vault and offline installation remains pending; Phase 4 is not marked complete.
