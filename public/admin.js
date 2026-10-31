const $ = (selector) => document.querySelector(selector);
async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body && typeof body !== "string") { body = JSON.stringify(body); headers["Content-Type"] = "application/json"; }
  const response = await fetch(url, { ...options, headers, body, credentials: "same-origin", cache: "no-store" });
  const text = await response.text().catch(() => "");
  let data = {};
  try { data = JSON.parse(text); } catch {}
  if (!response.ok) {
    throw new Error(data.error || (response.status ? `Request failed (${response.status}): ${text.slice(0, 80).trim() || response.statusText}` : "Request failed. Check network or server connection."));
  }
  return data;
}
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
let toastTimeout;
function notify(message) {
  const el = $("#adminToast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => el.classList.remove("show"), 2300);
}
function showDashboard() { $("#adminLoginPanel").classList.add("hidden"); $("#adminDashboard").classList.remove("hidden"); loadMembers(); }
function showLogin() { $("#adminDashboard").classList.add("hidden"); $("#adminLoginPanel").classList.remove("hidden"); }
async function loadMembers() {
  try {
    const members = await api("/api/admin/members");
    $("#memberTotal").textContent = members.length;
    $("#memberList").innerHTML = members.length ? members.map((member) => `
      <div class="member-row">
        <div class="member-main"><span class="member-avatar">${esc(member.name.trim().charAt(0).toUpperCase())}</span><div><b>${esc(member.name)}</b><small>Added ${new Date(member.created_at).toLocaleDateString()}</small></div></div>
        <span class="member-set-count">${Number(member.set_count)} sets</span>
        <button class="remove-member" data-remove="${member.id}" data-name="${esc(member.name)}">Remove</button>
      </div>`).join("") : '<div class="member-empty"><span>✳</span><b>No members yet</b><small>Add your first member above. The directory starts empty.</small></div>';
    $("#memberList").querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", async () => {
      const name = button.dataset.name;
      if (!confirm(`Remove ${name}? Their learning sets, saved clues and progress will be permanently deleted.`)) return;
      button.disabled = true;
      try { await api(`/api/admin/members/${button.dataset.remove}`, { method: "DELETE" }); notify(`${name} was removed.`); await loadMembers(); }
      catch (error) { button.disabled = false; notify(error.message); }
    }));
  } catch (error) {
    if (/Administrator sign-in/i.test(error.message)) showLogin();
    else notify(error.message);
  }
}

$("#adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#adminLoginButton"); button.disabled = true; button.textContent = "Checking…";
  $("#adminLoginMessage").textContent = "";
  try { await api("/api/admin/login", { method: "POST", body: { password: $("#adminPassword").value } }); $("#adminPassword").value = ""; showDashboard(); }
  catch (error) { $("#adminLoginMessage").textContent = error.message; }
  finally { button.disabled = false; button.textContent = "Unlock dashboard →"; }
});

$("#addMemberForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#addMemberButton"); button.disabled = true; button.textContent = "Adding…";
  $("#addMemberMessage").textContent = "";
  try {
    const result = await api("/api/admin/members", { method: "POST", body: {
      name: $("#newMemberName").value.trim(), password: $("#newMemberPassword").value
    } });
    $("#addMemberForm").reset();
    $("#addMemberMessage").style.color = "#367a50";
    $("#addMemberMessage").textContent = `${result.name} was added. Share the sign-in name and password with them privately.`;
    await loadMembers();
  } catch (error) { $("#addMemberMessage").style.color = "#b64d48"; $("#addMemberMessage").textContent = error.message; }
  finally { button.disabled = false; button.textContent = "＋ Add member"; }
});

$("#adminLogout").addEventListener("click", async () => {
  try { await api("/api/admin/logout", { method: "POST", body: {} }); } catch {}
  showLogin(); notify("Administrator signed out.");
});

api("/api/admin/members").then(showDashboard).catch(() => showLogin());
