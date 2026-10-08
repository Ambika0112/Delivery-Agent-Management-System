const table = document.getElementById("agentTable");
const emptyState = document.getElementById("emptyState");
const modal = document.getElementById("modal");
const form = document.getElementById("agentForm");
const modalTitle = document.getElementById("modalTitle");
const message = document.getElementById("message");

const fields = {
  id: document.getElementById("agentId"),
  full_name: document.getElementById("full_name"),
  phone: document.getElementById("phone"),
  email: document.getElementById("email"),
  service_area: document.getElementById("service_area"),
  status: document.getElementById("status"),
};

function showMessage(text) {
  message.textContent = text;
  message.classList.remove("hidden");
  setTimeout(() => message.classList.add("hidden"), 3000);
}

async function loadAgents() {
  try {
    const response = await fetch("/api/agents");
    const agents = await response.json();

    table.innerHTML = "";
    emptyState.classList.toggle("hidden", agents.length !== 0);

    agents.forEach((agent) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${escapeHtml(agent.full_name)}</td>
        <td>${escapeHtml(agent.phone)}</td>
        <td>${escapeHtml(agent.email)}</td>
        <td>${escapeHtml(agent.service_area)}</td>
        <td>
          <span class="status ${agent.status.toLowerCase()}">
            ${agent.status}
          </span>
        </td>
        <td>
          <div class="actions">
            <button onclick="editAgent(${agent.id})">Edit</button>
            <button class="delete" onclick="deleteAgent(${agent.id})">Delete</button>
          </div>
        </td>
      `;

      table.appendChild(row);
    });
  } catch (error) {
    showMessage("Could not load agents.");
  }
}

function openAddModal() {
  form.reset();
  fields.id.value = "";
  fields.status.value = "ACTIVE";
  modalTitle.textContent = "Add Agent";
  modal.classList.remove("hidden");
}

async function editAgent(id) {
  try {
    const response = await fetch(`/api/agents/${id}`);
    const agent = await response.json();

    if (!response.ok) {
      showMessage(agent.message || "Could not load agent.");
      return;
    }

    fields.id.value = agent.id;
    fields.full_name.value = agent.full_name;
    fields.phone.value = agent.phone;
    fields.email.value = agent.email;
    fields.service_area.value = agent.service_area;
    fields.status.value = agent.status;

    modalTitle.textContent = "Edit Agent";
    modal.classList.remove("hidden");
  } catch (error) {
    showMessage("Could not load agent.");
  }
}

async function deleteAgent(id) {
  if (!confirm("Delete this agent?")) return;

  try {
    const response = await fetch(`/api/agents/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      showMessage(data.message || "Could not delete agent.");
      return;
    }

    await loadAgents();
  } catch (error) {
    showMessage("Could not delete agent.");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = fields.id.value;

  const data = {
    full_name: fields.full_name.value,
    phone: fields.phone.value,
    email: fields.email.value,
    service_area: fields.service_area.value,
    status: fields.status.value,
  };

  try {
    const response = await fetch(
      id ? `/api/agents/${id}` : "/api/agents",
      {
        method: id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    const result = response.status === 204 ? null : await response.json();

    if (!response.ok) {
      showMessage(result?.message || "Could not save agent.");
      return;
    }

    closeModal();
    await loadAgents();
  } catch (error) {
    showMessage("Could not save agent.");
  }
});

function closeModal() {
  modal.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.getElementById("addButton").addEventListener("click", openAddModal);
document.getElementById("closeButton").addEventListener("click", closeModal);
document.getElementById("cancelButton").addEventListener("click", closeModal);

loadAgents();
