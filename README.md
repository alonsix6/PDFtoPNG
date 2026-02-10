# SlideForge

HTML Slide to PNG Renderer — A production-grade internal tool for converting HTML slide projects into pixel-perfect PNG images using Playwright.

## Architecture

```
┌─────────────────────┐         REST API          ┌──────────────────────────┐
│   Frontend (React)  │ ◄──────────────────────► │   Backend (Node.js)       │
│   Deployed: Netlify  │                           │   Deployed: Railway       │
│                     │  POST /api/render          │                          │
│   • ZIP upload      │  GET  /api/jobs/:id        │   • ZIP extraction       │
│   • Resolution pick │  GET  /api/jobs/:id/download│   • Static file server   │
│   • Job tracking    │                           │   • Playwright rendering  │
│   • PNG download    │                           │   • PNG capture & ZIP     │
└─────────────────────┘                           └──────────────────────────┘
```

## Prerequisites

- Node.js 20 LTS
- npm 10+

## Local Development

### Backend

```bash
cd backend
npm install
npx playwright install chromium
cp .env.example .env
npm run dev
```

The backend starts on `http://localhost:3001`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend starts on `http://localhost:5173` with API requests proxied to the backend.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated CORS origins |
| `MAX_FILE_SIZE_MB` | `50` | Max upload size in MB |
| `JOB_TTL_MINUTES` | `30` | Time before completed jobs are cleaned up |
| `MAX_CONCURRENT_JOBS` | `3` | Maximum parallel rendering jobs |
| `JOB_TIMEOUT_MINUTES` | `5` | Timeout per rendering job |
| `LOG_LEVEL` | `info` | Pino log level |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3001` | Backend API base URL |

## API Reference

### `POST /api/render`

Upload a ZIP file containing HTML slides for rendering.

**Request:** `multipart/form-data`
- `zipFile` — ZIP file (max 50MB)
- `resolution` — `"hd"` (1920x1080) or `"4k"` (3840x2160)

**Response:** `202`
```json
{ "jobId": "abc123def456", "status": "pending" }
```

### `GET /api/jobs/:jobId`

Check the status of a rendering job.

**Response:** `200`
```json
{
  "jobId": "abc123def456",
  "status": "processing",
  "progress": { "current": 3, "total": 12 },
  "error": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "completedAt": null
}
```

### `GET /api/jobs/:jobId/download`

Download the rendered PNG ZIP. Only available when `status === "completed"`.

**Response:** `application/zip` stream

### `GET /api/health`

Health check endpoint.

## Slide Modes

SlideForge detects two rendering modes:

- **Mode A:** Single `index.html` with multiple `<section class="slide">` elements. Each section is isolated and captured individually.
- **Mode B:** Multiple HTML files (e.g., `slide-01.html`, `slide-02.html`). Each file is captured as a separate slide.

## Docker (Railway Deployment)

```bash
cd backend
docker build -t slideforge .
docker run -p 3001:3001 slideforge
```

## Project Structure

```
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js
│       ├── config.js
│       ├── middleware/
│       │   ├── cors.js
│       │   ├── upload.js
│       │   └── errorHandler.js
│       ├── routes/
│       │   └── jobs.js
│       ├── services/
│       │   ├── jobManager.js
│       │   ├── zipExtractor.js
│       │   ├── slideDetector.js
│       │   └── staticServer.js
│       ├── renderer/
│       │   ├── browser.js
│       │   ├── captureSlides.js
│       │   └── waitStrategies.js
│       └── utils/
│           ├── logger.js
│           ├── cleanup.js
│           └── portFinder.js
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── .env.example
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── api/
│       │   └── client.js
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── UploadZone.jsx
│       │   ├── ResolutionPicker.jsx
│       │   ├── JobProgress.jsx
│       │   ├── DownloadResult.jsx
│       │   ├── ErrorDisplay.jsx
│       │   └── ui/
│       │       ├── Button.jsx
│       │       ├── Card.jsx
│       │       ├── Badge.jsx
│       │       └── Spinner.jsx
│       └── hooks/
│           ├── useUpload.js
│           └── useJobPolling.js
└── README.md
```
