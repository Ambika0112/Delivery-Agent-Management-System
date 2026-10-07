# Delivery Agent Management System

Minimal CRUD web application for managing delivery agents.

## Stack

- Next.js frontend
- Node.js + Express backend
- SQLite database
- Redis cache

SQLite is used for persistent storage because it requires no separate database server for this small assignment. The database file (`agents.db`) is created automatically when the backend starts.

## Requirements

- Node.js 18+
- Redis running on `localhost:6379`

## Run

### Backend

```bash
cd backend
npm install
npm start
```

The backend creates `agents.db` automatically.

Backend:

`http://localhost:4000`

Health check:

`http://localhost:4000/api/health`

### Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

`http://localhost:3000`

No PostgreSQL setup is required.

## Environment Variables

Backend `.env`:

```text
PORT=4000
REDIS_URL=redis://localhost:6379
```

Frontend `.env.local`:

```text
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/agents` | Create agent |
| GET | `/api/agents` | List agents |
| GET | `/api/agents/:id` | Get one agent |
| PUT | `/api/agents/:id` | Update agent |
| DELETE | `/api/agents/:id` | Delete agent |

## Redis Caching

The application caches:

- `agents:all`
- `agent:<id>`

Cache entries expire after 60 seconds.

Create, update, and delete operations invalidate the affected cache entries so that later reads get current data.

## CRUD Testing

1. Open the frontend.
2. Add an agent.
3. Confirm it appears.
4. Edit it.
5. Refresh the page and confirm the data remains.
6. Delete it.
7. Confirm it disappears.

## Agent Fields

- Agent ID
- Full name
- Phone number
- Email address
- Service area
- Status
- Created timestamp
- Updated timestamp

## HTTP Status Codes

- 201 - created
- 200 - successful read/update
- 204 - deleted
- 400 - invalid request
- 404 - missing agent
- 500 - server error
