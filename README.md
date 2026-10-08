# Delivery Agent Management System

A simple web application for creating, viewing, updating, and deleting delivery agent records.

## Technology

- Node.js
- Express
- PostgreSQL
- Redis
- HTML, CSS and JavaScript for the frontend

PostgreSQL is used for persistent storage because agent records have structured fields and need reliable CRUD operations.

Redis is used as a cache for read responses.

## Features

- Create a delivery agent
- View all agents
- View an individual agent through the API
- Update an agent
- Delete an agent
- Basic request validation
- Redis caching for agent list and individual agent details
- Cache invalidation after create, update and delete operations

## Agent Fields

- Agent ID
- Full name
- Phone number
- Email address
- Service area
- Status: ACTIVE or INACTIVE
- Created timestamp
- Updated timestamp

## Project Structure

```text
delivery-agent-management/
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── schema.sql
├── server.js
└── README.md
```

## Requirements

Install:

- Node.js
- Docker Desktop

## How to Start the Project

Open PowerShell in this project folder:

```text
C:\Users\ambik\Downloads\delivery-agent-management\delivery-agent-management
```

### 1. Start PostgreSQL and Redis

```powershell
docker compose up -d
```

This starts:

- PostgreSQL on `localhost:5433`
- Redis on `localhost:6379`

### 2. Install Node dependencies

Run this only the first time, or after dependencies change:

```powershell
npm.cmd install
```

### 3. Start the Node application

Use `npm.cmd` in PowerShell:

```powershell
npm.cmd start
```

When it starts correctly, you should see:

```text
Server running at http://localhost:3000
```

### 4. Open the project in the browser

```text
http://localhost:3000
```

The application creates the required PostgreSQL table automatically when the server starts.

## Quick Restart

If dependencies are already installed, start the project with:

```powershell
docker compose up -d
npm.cmd start
```

## API Endpoints

| Method | Endpoint            | Purpose             |
| ------ | ------------------- | ------------------- |
| POST   | `/api/agents`     | Create an agent     |
| GET    | `/api/agents`     | Get all agents      |
| GET    | `/api/agents/:id` | Get one agent       |
| PUT    | `/api/agents/:id` | Update an agent     |
| DELETE | `/api/agents/:id` | Delete an agent     |
| GET    | `/api/health`     | Check server health |

## Example Create Request

```http
POST /api/agents
Content-Type: application/json
```

```json
{
  "full_name": "Rahul Sharma",
  "phone": "9876543210",
  "email": "rahul@example.com",
  "service_area": "Whitefield",
  "status": "ACTIVE"
}
```

## Redis Caching

The following GET responses are cached:

- `GET /api/agents` uses the key `agents:all`
- `GET /api/agents/:id` uses the key `agent:<id>`

Cached responses have a 60-second expiration.

When an agent is created, the agent list cache is cleared.

When an agent is updated or deleted, both the individual agent cache and the agent list cache are cleared.

This keeps cached read responses consistent with the database.

## Testing the CRUD Flow

The main CRUD flow can be tested from the web interface:

1. Open `http://localhost:3000`.
2. Click **Add Agent** and create an agent.
3. Confirm the agent appears in the table.
4. Click **Edit** and change an agent field.
5. Confirm the updated value appears.
6. Refresh the page and confirm the data remains.
7. Click **Delete** and confirm the agent is removed.

The API can also be tested with Postman or any REST client using the endpoints above.

## Stopping the Services

```bash
docker compose down
```

To also remove the PostgreSQL data volume:

```bash
docker compose down -v
```

## Environment Variables

```text
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/delivery_agents
REDIS_URL=redis://localhost:6379
```

Do not commit real secrets or private environment values to Git.
