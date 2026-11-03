# Car Maintenance Tracker <img src="Frontend/public/logo.png" width="35" height="35" alt="Car Maintenance Tracker Logo">

A full-stack application for tracking cars, their maintenance items (parts/services), and service history. Built with **NestJS** + **TypeORM** + **SQLite** on the backend and **Angular 19** on the frontend.

![NestJS](https://img.shields.io/badge/NestJS-11-red?logo=nestjs)
![Angular](https://img.shields.io/badge/Angular-19-red?logo=angular)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-3-lightblue?logo=sqlite)

---

## Features

### Backend

- **Multi-car support** — Register and manage multiple vehicles
- **Items management & automated baselines** — Track parts/services per car (oil, brake pads, tires, etc.) with required installation date that automatically registers the component's initial maintenance event
- **Upcoming maintenance calculation engine** — Calculates remaining mileage and days until maintenance, classifying items into four urgency levels: `OVERDUE`, `DUE_SOON`, `UPCOMING`, and `HEALTHY`, with a separate `NO_SCHEDULE` state for items without a configured maintenance schedule. Classification considers both mileage and time thresholds, prioritizing whichever requirement is more urgent.
- **Maintenance records** — Log every service event with date, mileage, item cost, extra costs, and notes
- **Photo upload** — Attach a photo to cars and items (stored locally in `/uploads`)
- **Search, filter & pagination** — Paginated list endpoints with search, urgency scope filtering, and multi-column sorting
- **Data Import & Export** — Export and import complete vehicle maintenance profiles (items + historical events) in standardized JSON format with atomic database transactions and automatic maintenance cycle recalculation
- **User accounts** — Register / log in with username and password (bcrypt-hashed); JWT-protected API where each user only sees their own cars, items and records
- **Validation** — Strong DTO validation with `class-validator`
- **Swagger / OpenAPI** — Interactive API docs at `/api` (on locally; off in production unless `SWAGGER_ENABLED=true`)
- **CORS enabled** — Connected to the Angular frontend

### Frontend

- **Dashboard** — Summary metrics, recent maintenance activity, and a maintenance overview with urgency filters for overdue, due soon, upcoming, healthy, and unscheduled items.
- **Quick Odometer Update Modal** — Update any vehicle's mileage directly from the dashboard to instantly trigger maintenance deadline recalculations
- **Global Search with Floating Suggestions** — Real-time search across vehicles and installed items with category indicators, car badges, custom icons, and instant navigation
- **Header Notification System** — Interactive notification bell showing real-time pending alert counts and quick links to log maintenance records
- **Cars** — List, add, edit, and view car details with linked items
- **Items** — Add and edit maintenance items per vehicle with required installation dates
- **Maintenance events** — View, add, and edit service records per item
- **Interactive sorting & pagination** — Server-side sorting headers and responsive pagination controls
- **Theme support** — Light and dark themes; follows the system setting until you pick one in the header, then remembers it. No flash of the wrong theme on load
- **Design tokens** — Every colour is a CSS variable in `Frontend/src/styles.css` (Petrol & Graphite palette; `gray` = neutral, `purple` = brand in Tailwind class names). Change the palette there, not in components
- **Motion** — Calm CSS-only page transitions, staggered fade-ins, skeleton loaders and hover effects; all disabled when the OS asks for reduced motion
- **Car details** — Odometer-style numbers, fuel-gauge service bars, warning-light status badges, licence-plate badges and a wheel spinner (original inline SVGs; fonts are bundled, no external requests)
- **Responsive design** — Adaptive layout optimized for mobile, tablet, and desktop screens
- **Data Import & Export Modal** — Seamless JSON backup and restoration with instant file pick, raw JSON textarea editor, sample template inserter, and dynamic button swapping (Import button for empty vehicles automatically replaces with Export when data exists)
- **Image lightbox & toast alerts** — Full-screen image preview and notification toasts
- **Full API integration** — Angular services connected to NestJS backend via `HttpClient`

---


## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| **Backend framework** | NestJS 11 |
| **Frontend framework** | Angular 19 (standalone components) |
| **Language** | TypeScript 5 |
| **Database** | SQLite (via TypeORM) |
| **ORM** | TypeORM |
| **API docs** | Swagger (`@nestjs/swagger`) |
| **Validation** | class-validator, class-transformer |
| **File uploads** | Multer |
| **Frontend styling** | Tailwind CSS 3, PostCSS |
| **Frontend fonts** | Inter, Fira Mono (`@fontsource/fira-mono`) |
| **Frontend testing** | Karma + Jasmine |

> The database can be swapped to PostgreSQL/MySQL by changing the TypeORM connection config in `Backend/app/src/app.module.ts`.

---

## Repository Structure

```
Car-Maintenance-Tracker/
├── Backend/
│   └── app/                          # NestJS API
│       ├── src/
│       │   ├── common/dtos/          # Shared pagination DTOs
│       │   ├── modules/
│       │   │   ├── cars/             # Cars module
│       │   │   ├── items/            # Items module & upcoming calculations
│       │   │   └── maintenance-records/
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── uploads/                  # Item photo storage (auto-created)
│       ├── data.sqlite               # SQLite DB (created on first run by migrations)
│       └── package.json
├── Frontend/                         # Angular SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/                 # Layouts, headers & services
│   │   │   ├── features/             # Feature pages (Dashboard, Cars, Items, Maintenance)
│   │   │   └── shared/               # Models & reusable components
│   │   ├── styles.css
│   │   └── main.ts
│   ├── angular.json
│   ├── Dockerfile
│   ├── default.conf              # nginx config for the frontend container
│   └── package.json
├── docker-compose.yml            # Local full-stack run (API :3000, UI :4200)
└── README.md
```

---

## Installation & Setup

### Prerequisites

- **Docker Desktop** (or Docker Engine + Docker Compose v2)
- For local development without Docker: **Node.js** v18+ and **npm** v9+

### 1. Clone the repository

```bash
git clone https://github.com/Ahmad3oda/car-maintenance-tracker.git
cd car-maintenance-tracker
```

### 2. Run with Docker Compose (recommended)

`docker-compose.yml` builds two containers from the project Dockerfiles:

| Service | Image build context | Host port | Role |
| ------- | ------------------- | --------- | ---- |
| `backend` (`nest-backend`) | `./Backend/app` | **3000** → 3000 | NestJS API, SQLite, uploads |
| `frontend` (`angular-frontend`) | `./Frontend` | **4200** → 80 | Angular app served by nginx |

The frontend image is built with `--configuration docker` so the browser calls `http://localhost:3000` (the published backend port). SQLite and photos are stored in two named Docker volumes, so they survive `docker compose down` and rebuilds. No setup is needed before the first start.

| Volume | Mounted at | Contents |
| ------ | ---------- | -------- |
| `sqlite_data` | `/app/data` | `data.sqlite` |
| `uploads_data` | `/app/uploads` | Car, item and record photos |

Create a `.env` file in the **repository root** with the JWT signing secret (Compose refuses to start without it; `.env` is git-ignored):

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
```

From the **repository root**:

```bash
docker compose up --build
```

Then open:

- App: `http://localhost:4200`
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api`
- Photos: `http://localhost:3000/uploads/<folder>/<file>` (login required)

Stop the stack (data is kept):

```bash
docker compose down
```

Stop and **delete all data** (removes both volumes):

```bash
docker compose down -v
```

Back up the database:

```bash
docker compose cp backend:/app/data/data.sqlite ./data.sqlite.bak
```

Rebuild after code changes:

```bash
docker compose up --build
```

Useful Compose commands:

```bash
docker compose logs -f          # both services
docker compose logs -f backend  # API only
docker compose ps
```

The compose file sets backend `FRONTEND_URL=http://localhost:4200` for CORS, `JWT_SECRET` from `.env`, `DB_PATH=/app/data/data.sqlite`, `UPLOAD_DIR=/app/uploads` and `SWAGGER_ENABLED=true`. Both paths are inside the volumes above; a database path outside `/app/data` would be lost when the container is recreated.

### 3. Local development without Docker

Use this when you want hot reload (`nest start --watch` / `ng serve`).

**Backend**

```bash
cd Backend/app
npm install
```

Create `.env` in `Backend/app/` by copying `.env.example`. `JWT_SECRET` is required; the other values are the local defaults:

```env
PORT=3000
FRONTEND_URL=http://localhost:4200
JWT_SECRET=<output of: openssl rand -hex 32>
```

Leave `DATA_DIR`, `DB_PATH` and `UPLOAD_DIR` unset locally so `data.sqlite` and `uploads/` stay in `Backend/app/`. The `/data/...` paths are for Railway's volume only.

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `JWT_SECRET` | **yes** | Signs login tokens. At least 32 characters; the API refuses to start without it. Keep it secret: anyone with it can log in as any user. Changing it logs everyone out. |
| `DB_PATH` / `DATA_DIR` | no | SQLite file location (default `data.sqlite` in the working directory) |
| `UPLOAD_DIR` | no | Photo folder (default `uploads`) |
| `FRONTEND_URL` | no | Allowed CORS origin(s), comma-separated. Unset allows every origin (a warning is logged in production) |
| `PORT` | no | Default `3000` |
| `AUTH_RATE_LIMIT` | no | Login/register attempts per IP per minute (default `10`); more get `429` |
| `SWAGGER_ENABLED` | no | Swagger UI at `/api` is on locally and off when `NODE_ENV=production`; set `true` to keep it |

```bash
npm run start:dev
```

API: `http://localhost:3000` — Swagger: `http://localhost:3000/api`

**Frontend**

```bash
cd Frontend
npm install
npm start
# or: ng serve
```

The dev server uses `Frontend/src/environments/environment.ts` (`apiUrl: http://localhost:3000`) and runs at `http://localhost:4200`.

**Production build (without Docker):**

```bash
cd Frontend
npm run build
```

Output: `Frontend/dist/frontend/browser/`. That production build uses `environment.prod.ts` (hosted API URL), not the Docker compose URL.

### Dockerfiles (used by Compose)

- **`Backend/app/Dockerfile`** — Node 20, compiles `sqlite3`, runs `nest build`, starts `node dist/main.js` on port 3000.
- **`Frontend/Dockerfile`** — builds Angular, then serves `dist/frontend/browser` with nginx (`Frontend/default.conf`). Pass `BUILD_CONFIGURATION` (Compose uses `docker`; omit it to use `production`).

---

## Backend

### Project Structure (`Backend/app/src/modules/`)

```
modules/
├── cars/
│   ├── dtos/                   # create, update, query DTOs
│   ├── entities/               # Car entity (cars table)
│   ├── serializers/            # API response shape
│   ├── cars.controller.ts
│   ├── cars.service.ts
│   ├── cars.repository.ts
│   └── cars.module.ts
├── items/
│   ├── dtos/                   # create, update, query, query-upcoming DTOs
│   ├── entities/               # Item entity (items table)
│   ├── serializers/            # item, upcoming-item serializers
│   ├── items.controller.ts     # CRUD + GET /items/upcoming
│   ├── items.service.ts        # Item management & urgency calculation engine
│   ├── items.repository.ts
│   └── items.module.ts
├── dashboard/                  # GET /dashboard/stats
└── maintenance-records/
    ├── dtos/
    ├── entities/               # MaintenanceRecord entity (maintenance_records table)
    ├── serializers/
    ├── maintenance-records.controller.ts
    ├── maintenance-records.service.ts
    ├── maintenance-records.repository.ts
    └── maintenance-records.module.ts
```

### Database

SQLite with TypeORM. The schema is managed by **migrations** in `Backend/app/src/database/migrations`, not `synchronize`. On every startup the API runs any pending migrations, so a new database file is created and brought up to date automatically (locally and on Railway).

**Changing the schema:**

1. Edit the entity.
2. Generate a migration from the difference and review the SQL:

   ```bash
   cd Backend/app
   npm run migration:generate -- src/database/migrations/AddCarColor
   ```

3. Commit it. It runs on the next start. `npm run migration:revert` undoes the last one.

A test fails if an entity changes without a migration. On SQLite, changing an existing column makes TypeORM rebuild the table (copy, drop, rename) inside the migration; read the generated SQL before committing.

**Databases from before migrations** (created with the old `synchronize: true`) are refused at startup with a message to delete the file. They only held test data.

#### Entity relationships

```
users (1) ──< cars (many)
cars  (1) ──< items (many)
cars  (1) ──< maintenance_records (many)
items (1) ──< maintenance_records (many)
```

Every foreign key cascades on delete: deleting a user removes their cars, deleting a car removes its items and records, and deleting an item removes its records.

#### Table: `users`

Defined in `Backend/app/src/modules/auth/entities/user.entity.ts`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | int | PK, auto-increment |
| `username` | string | as typed at registration |
| `usernameKey` | string | lower-cased username, unique (case-insensitive login) |
| `passwordHash` | string | bcrypt hash, never returned by the API |
| `createdAt` | datetime | auto |

#### Table: `cars`

Defined in `Backend/app/src/modules/cars/entities/car.entity.ts`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | int | PK, auto-increment |
| `userId` | int | FK → `users.id` (CASCADE), indexed |
| `plateNumber` | string | required, unique per user (`userId` + `plateNumber`) |
| `brand` | string | required |
| `model` | string | required |
| `year` | int | required, 1900 to next year |
| `currentKm` | int | default `0`; raised automatically by maintenance records |
| `photoPath` | string | optional, file name in `uploads/cars/` |
| `createdAt` | datetime | auto |
| `updatedAt` | datetime | auto |

#### Table: `items`

Defined in `Backend/app/src/modules/items/entities/item.entity.ts`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | int | PK, auto-increment |
| `carId` | int | FK → `cars.id` (CASCADE) |
| `name` | string | required |
| `description` | text | optional |
| `manufacturer` | string | optional |
| `photoPath` | string | optional, file name in `uploads/items/` |
| `installedDate` | datetime | required when creating; editing it also moves the installation record |
| `installedKm` | int | defaults to the car's `currentKm` |
| `expectedMaintenanceKm` | int | optional — interval in km |
| `expectedMaintenanceMonths` | int | optional — interval in months |
| `lastMaintenanceId` | int | computed — latest record (no FK constraint) |
| `lastMaintenanceDate` | datetime | computed |
| `nextMaintenanceKm` | int | computed — latest record km + interval |
| `nextMaintenanceDate` | datetime | computed — latest record date + months |
| `createdAt` | datetime | auto |
| `updatedAt` | datetime | auto |

#### Table: `maintenance_records`

Defined in `Backend/app/src/modules/maintenance-records/entities/maintenance-record.entity.ts`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | int | PK, auto-increment |
| `carId` | int | FK → `cars.id` (CASCADE); always the item's car |
| `itemId` | int | FK → `items.id` (CASCADE) |
| `maintenanceDate` | datetime | when the service happened |
| `kmCounter` | int | car odometer reading |
| `itemCost` | real | cost of the item/part |
| `extraCosts` | JSON | optional array of `{ name, cost }` |
| `notes` | text | optional; `Initial component installation` marks the automatic baseline record |
| `photoPath` | string | optional, file name in `uploads/maintenance-records/` |
| `createdAt` | datetime | auto |
| `updatedAt` | datetime | auto |

API responses for maintenance records include a computed `totalCost` field (`itemCost` + sum of `extraCosts`).

### API Endpoints

All list endpoints return a paginated envelope:

```json
{
  "data": [ /* ... */ ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 42,
    "totalPages": 5,
    "hasPreviousPage": false,
    "hasNextPage": true
  }
}
```

**Shared query params** (via `PageOptionsDto`):

| Param | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `page` | int | `1` | Page number (min 1) |
| `limit` | int | `10` | Items per page (1–1000) |
| `order` | `ASC` \| `DESC` | `DESC` | Sort direction |
| `search` | string | — | Full-text search |
| `sortBy` | string | — | Field to sort by |

#### Authentication — `/auth`

Every endpoint needs an `Authorization: Bearer <token>` header except `POST /auth/register`, `POST /auth/login` and `GET /` (public health check used by Railway). In Swagger (`/api`), log in, copy `accessToken` and paste it into **Authorize**.

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/auth/register` | Create an account; returns `{ accessToken, expiresIn, user }` |
| POST | `/auth/login` | Log in; same response. Wrong username or password both return 401 `Invalid username or password` |
| GET | `/auth/me` | The logged-in user |

- **Username:** 3–30 characters, starts with a letter, only English letters, digits and `_`. Unique ignoring case (`Ahmed` = `ahmed`); a taken name returns 409 `Username "x" is already taken`.
- **Password:** 6–72 characters (bcrypt ignores anything past 72 bytes). Stored as a bcrypt hash only.
- **Tokens** last 7 days. A missing, invalid or expired token returns 401.
- **Rate limit:** login and register allow 10 attempts per minute per IP (`AUTH_RATE_LIMIT`); more return 429.

**Per-user data:** cars belong to the user who created them; items and records belong to the user through their car. Lists, `/items/upcoming` and `/dashboard/stats` only include your own data, and another user's id returns the same 404 as an id that does not exist. Plate numbers are unique within one user's cars; different users can register the same plate.

**Photos** are served by `GET /uploads/<cars|items|maintenance-records>/<file>`, which requires login and returns a photo only to the user who owns its car (404 for anyone else). File names are random UUIDs. The frontend loads photos through `HttpClient` so the token is sent. Allowed: JPEG, PNG, WebP, GIF up to 5 MB.

#### Cars — `/cars`

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/cars` | Create a car |
| GET | `/cars` | List cars (paginated) |
| GET | `/cars/:id` | Get one car |
| PATCH | `/cars/:id` | Update a car (and odometer) |
| GET | `/cars/:id/export` | Export full vehicle maintenance bundle (items + events) |
| POST | `/cars/:id/import` | Import full vehicle maintenance bundle with transactional validation |
| DELETE | `/cars/:id` | Delete a car (cascades items & records) |

**Create body:** `plateNumber`, `brand`, `model`, `year`, `currentKm?`

#### Items — `/items`

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/items` | Create item (`multipart/form-data`, optional `photo`) |
| GET | `/items` | List items (paginated) |
| GET | `/items/upcoming` | Query upcoming/due items with remaining KM/days & urgency status |
| GET | `/items/:id` | Get one item |
| PATCH | `/items/:id` | Update item (`multipart/form-data`, optional `photo`) |
| DELETE | `/items/:id` | Delete item (cascades records) |

**Extra query params for `/items`:** `carId` — filter items by car  
**Extra query params for `GET /items/upcoming`:** `carId`, `scope` (`due_soon_or_overdue`, `overdue_only`, `due_soon_only`, `upcoming_only`, `healthy_only`, `no_schedule`, `within_1k_km`, `within_30_days`, `all`).

**Create body:** `carId`, `name`, `description?`, `serialNumber?`, `installedDate?`, `installedKm?`, `expectedMaintenanceKm?`, `expectedMaintenanceMonths?`

#### Maintenance Records — `/maintenance-records`

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/maintenance-records` | Create a maintenance record |
| GET | `/maintenance-records` | List records (paginated) |
| GET | `/maintenance-records/:id` | Get one record |
| PATCH | `/maintenance-records/:id` | Update a record |
| DELETE | `/maintenance-records/:id` | Delete a record |

**Extra query params:** `carId`, `itemId`

**Create body:** `carId`, `itemId`, `maintenanceDate`, `kmCounter`, `itemCost`, `extraCosts?` (`[{ name, cost }]`), `notes?`

#### Dashboard — `/dashboard`

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/dashboard/stats` | Car and item totals, services and spend in the last 30 / 365 days |

Service counts exclude the automatic "Initial component installation" records; their cost still counts toward spend.

### Switching to PostgreSQL / MySQL

1. Install the driver:

   ```bash
   cd Backend/app
   npm install pg          # PostgreSQL
   # or
   npm install mysql2      # MySQL
   ```

2. Update `Backend/app/src/app.module.ts`:

   ```typescript
   TypeOrmModule.forRoot({
     type: 'postgres',       // or 'mysql'
     host: 'localhost',
     port: 5432,
     username: 'postgres',
     password: 'password',
     database: 'car_maintenance',
     autoLoadEntities: true,
     migrationsRun: true,
   }),
   ```

3. The existing migrations contain SQLite SQL: delete them and generate a new baseline for the new database (`npm run migration:generate`).

Entities, services, and controllers stay the same.

---

## Frontend

### Tech & Tooling

| Tool | Version | Purpose |
| ---- | ------- | ------- |
| Angular CLI | 19.2 | Scaffolding, dev server, build |
| Angular | 19.2 | Standalone components, routing, forms |
| TypeScript | 5.7 | Strict mode enabled |
| Tailwind CSS | 3.4 | Utility-first styling |
| PostCSS + Autoprefixer | — | CSS processing |
| `@tailwindcss/typography` | 0.5 | Prose/typography utilities |
| Karma + Jasmine | — | Unit tests |
| RxJS | 7.8 | Reactive data streams |

### Configuration Files

| File | Purpose |
| ---- | ------- |
| `angular.json` | Build/serve/test targets; output to `dist/frontend` |
| `tsconfig.json` | Strict TS + Angular compiler options (`ES2022`, bundler resolution) |
| `tailwind.config.js` | Custom color palette, Inter/Montserrat fonts, dark mode via `class` |
| `postcss.config.js` | Tailwind + Autoprefixer pipeline |
| `.editorconfig` | Editor formatting defaults |

### Application Architecture

```
Frontend/src/app/
├── app.config.ts              # Router, HttpClient and interceptors
├── app.routes.ts              # Lazy routes; login/register outside, app pages behind authGuard
├── core/
│   ├── guards/                # authGuard, guestGuard
│   ├── interceptors/          # api (base URL), auth (Bearer token), error (toasts, 401 logout)
│   ├── layouts/
│   │   ├── admin-layout/      # Responsive shell (sidebar + header + router-outlet)
│   │   ├── header/            # Global search, theme toggle, notification bell, profile menu
│   │   └── sidebar/           # Dashboard, Cars and Maintenance log navigation
│   └── services/
│       ├── auth.service.ts        # Login, register, session storage and expiry
│       ├── car.service.ts         # Vehicle CRUD, odometer updater, import/export
│       ├── item.service.ts        # Part/component CRUD and upcoming items
│       ├── maintenance.service.ts # Service record CRUD and extra costs
│       ├── dashboard.service.ts   # Stats, recent events and bell alert counts
│       ├── photo.service.ts       # Loads login-protected photos as blob URLs
│       ├── theme.service.ts       # Dark/light mode state and persistence
│       └── notification.service.ts# Toast messages
├── features/
│   ├── auth/                  # Login and register pages, shared username/password rules
│   ├── dashboard/             # Stats cards, expense chart, upcoming table, odometer modal
│   ├── cars/
│   │   ├── car-list/          # Paginated vehicle cards
│   │   ├── car-form/          # Add / edit vehicle with photo upload
│   │   └── car-details/       # Vehicle summary, items table, import/export
│   ├── items/
│   │   └── item-form/         # Add / edit item with photo upload
│   └── maintenance/
│       ├── all-events/        # Maintenance log with car, period and search filters
│       ├── event-list/        # Service history per item
│       └── event-form/        # Add / edit maintenance record with extra costs
└── shared/
    ├── models/                # API DTOs and page metadata
    ├── pipes/                 # authImage, truncate
    └── components/            # data table, pagination, modals (image, import, odometer),
                               # toast, stat card, urgency badge, gauges, skeletons, icons
```

All components are **standalone** (no NgModules). Styling uses Tailwind utility classes and responsive breakpoints.

### Routes

| Path | Component | Description |
| ---- | --------- | ----------- |
| `/dashboard` | DashboardComponent | Home — stats overview, upcoming maintenance table & recent events |
| `/cars` | CarListComponent | List all cars |
| `/cars/add` | CarFormComponent | Register a new car |
| `/cars/:id` | CarDetailsComponent | Car details and installed items table |
| `/cars/:id/edit` | CarFormComponent | Edit car details |
| `/cars/:id/items/add` | ItemFormComponent | Add item to car |
| `/cars/:carId/items/:itemId/edit` | ItemFormComponent | Edit item details |
| `/cars/:carId/items/:itemId/events` | EventListComponent | Maintenance history table |
| `/cars/:carId/items/:itemId/events/add` | EventFormComponent | Log new service event |
| `/cars/:carId/items/:itemId/events/:eventId/edit` | EventFormComponent | Edit service record |

All routes render inside `AdminLayoutComponent` (sidebar + header). Unknown paths redirect to `/dashboard`.

### Shared Models (`shared/models/models.ts`)

These TypeScript interfaces mirror the backend schema:

| Interface | Key fields |
| --------- | ---------- |
| `Car` | `id`, `plateNumber`, `brand`, `model`, `year`, `currentKm`, `photoPath?` |
| `Item` | `id`, `carId`, `name`, `manufacturer?`, `description?`, `installedKm?`, `expectedMaintenanceKm?`, `expectedMaintenanceMonths?`, `nextMaintenanceKm?`, `photoPath?` |
| `UpcomingItemDto` | `id`, `carId`, `name`, `nextMaintenanceKm`, `nextMaintenanceDate`, `remainingKm`, `remainingDays`, `status`, `car` |
| `MaintenanceEvent` | `id`, `carId`, `itemId`, `maintenanceDate`, `kmCounter`, `itemCost`, `extraCosts[]`, `totalCost`, `notes?` |
| `ExtraCost` | `name`, `cost` |
| `DashboardStats` | `totalCars`, `totalItems`, `itemsReplacedLastMonth`, `itemsReplacedLastYear`, `costSpentLastMonth`, `costSpentLastYear` |

### NPM Scripts

| Command | Description |
| ------- | ----------- |
| `npm start` | Dev server at `http://localhost:4200` |
| `npm run build` | Production build → `dist/frontend/` |
| `npm run watch` | Dev build with file watching |
| `npm test` | Run Karma unit tests |

---

## Roadmap

- [x] Wire Angular services to the NestJS API (`HttpClient`)
- [x] Server-side pagination & multi-column interactive sorting
- [x] Full mobile & multi-device responsiveness overhaul
- [x] Dark / Light mode toggle with local storage persistence
- [x] Maintenance reminders engine & predictive urgency alerts (overdue, due soon, upcoming, healthy)
- [x] Quick odometer update modal with real-time schedule recalculation
- [x] Header notification bell with real-time pending badges and quick service actions
- [x] Full car maintenance import & export system (JSON format with nested items & events)
- [x] JWT authentication & per-user data
- [ ] Cost analytics charts & reports
- [ ] Export records as CSV/PDF
- [x] Docker support
- [ ] Cloud storage for photos (S3 / Cloudinary)
- [x] Environment-based Backend API URL configuration for deployed frontend
