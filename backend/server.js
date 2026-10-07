require("dotenv").config();

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { createClient } = require("redis");

const app = express();
const PORT = process.env.PORT || 4000;

const db = new sqlite3.Database("./agents.db");

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redis.on("error", (error) => console.error("Redis error:", error.message));

app.use(express.json());

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      service_area TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

function validateAgent(data) {
  const fields = ["full_name", "phone", "email", "service_area", "status"];

  for (const field of fields) {
    if (!data[field] || String(data[field]).trim() === "") {
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

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

async function clearCaches(id) {
  await redis.del("agents:all");
  if (id) await redis.del(`agent:${id}`);
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/agents", async (req, res) => {
  try {
    const error = validateAgent(req.body);
    if (error) return res.status(400).json({ message: error });

    const { full_name, phone, email, service_area, status } = req.body;

    const result = await run(
      `INSERT INTO agents
       (full_name, phone, email, service_area, status)
       VALUES (?, ?, ?, ?, ?)`,
      [full_name.trim(), phone.trim(), email.trim(), service_area.trim(), status]
    );

    const agent = await get("SELECT * FROM agents WHERE id = ?", [result.id]);
    await clearCaches();

    res.status(201).json(agent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create agent" });
  }
});

app.get("/api/agents", async (req, res) => {
  try {
    const cached = await redis.get("agents:all");
    if (cached) return res.json(JSON.parse(cached));

    const agents = await all("SELECT * FROM agents ORDER BY id DESC");
    await redis.setEx("agents:all", 60, JSON.stringify(agents));

    res.json(agents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch agents" });
  }
});

app.get("/api/agents/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const cached = await redis.get(`agent:${id}`);
    if (cached) return res.json(JSON.parse(cached));

    const agent = await get("SELECT * FROM agents WHERE id = ?", [id]);

    if (!agent) return res.status(404).json({ message: "Agent not found" });

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
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const error = validateAgent(req.body);
    if (error) return res.status(400).json({ message: error });

    const { full_name, phone, email, service_area, status } = req.body;

    const result = await run(
      `UPDATE agents
       SET full_name = ?, phone = ?, email = ?, service_area = ?,
           status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [full_name.trim(), phone.trim(), email.trim(), service_area.trim(), status, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: "Agent not found" });
    }

    await clearCaches(id);
    const agent = await get("SELECT * FROM agents WHERE id = ?", [id]);
    res.json(agent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update agent" });
  }
});

app.delete("/api/agents/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const result = await run("DELETE FROM agents WHERE id = ?", [id]);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Agent not found" });
    }

    await clearCaches(id);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete agent" });
  }
});

async function start() {
  try {
    await redis.connect();
    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Could not start backend:", error.message);
    process.exit(1);
  }
}

start();
