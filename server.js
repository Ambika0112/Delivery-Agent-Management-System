const express = require("express");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { createClient } = require("redis");

loadEnvFile();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5433/delivery_agents",
});

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redis.on("error", (err) => {
  console.error("Redis error:", err.message);
});

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      email VARCHAR(150) NOT NULL,
      service_area VARCHAR(150) NOT NULL,
      status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function validateAgent(data) {
  const required = ["full_name", "phone", "email", "service_area", "status"];

  for (const field of required) {
    if (
      data[field] === undefined ||
      data[field] === null ||
      String(data[field]).trim() === ""
    ) {
      return `${field} is required`;
    }
  }

  if (!["ACTIVE", "INACTIVE"].includes(data.status)) {
    return "status must be ACTIVE or INACTIVE";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return "email must be valid";
  }

  return null;
}

async function invalidateAgentCache(id) {
  await redis.del("agents:all");
  await redis.del(`agent:${id}`);
}

app.get("/api/health", async (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/agents", async (req, res) => {
  try {
    const error = validateAgent(req.body);
    if (error) return res.status(400).json({ message: error });

    const { full_name, phone, email, service_area, status } = req.body;

    const result = await pool.query(
      `INSERT INTO agents
       (full_name, phone, email, service_area, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [full_name.trim(), phone.trim(), email.trim(), service_area.trim(), status]
    );

    await redis.del("agents:all");

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create agent" });
  }
});

app.get("/api/agents", async (req, res) => {
  try {
    const cached = await redis.get("agents:all");

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query(
      "SELECT * FROM agents ORDER BY id DESC"
    );

    await redis.setEx("agents:all", 60, JSON.stringify(result.rows));

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch agents" });
  }
});

app.get("/api/agents/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const cached = await redis.get(`agent:${id}`);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query(
      "SELECT * FROM agents WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const agent = result.rows[0];
    await redis.setEx(`agent:${id}`, 60, JSON.stringify(agent));

    res.json(agent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch agent" });
  }
});

app.put("/api/agents/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const error = validateAgent(req.body);
    if (error) return res.status(400).json({ message: error });

    const { full_name, phone, email, service_area, status } = req.body;

    const result = await pool.query(
      `UPDATE agents
       SET full_name = $1,
           phone = $2,
           email = $3,
           service_area = $4,
           status = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        full_name.trim(),
        phone.trim(),
        email.trim(),
        service_area.trim(),
        status,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Agent not found" });
    }

    await invalidateAgentCache(id);

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update agent" });
  }
});

app.delete("/api/agents/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const result = await pool.query(
      "DELETE FROM agents WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Agent not found" });
    }

    await invalidateAgentCache(id);

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete agent" });
  }
});

async function startServer() {
  try {
    await redis.connect();
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Could not start server:", error);
    process.exit(1);
  }
}

startServer();
