"use client";

import { useEffect, useState, type FormEvent } from "react";
type CmsRole = "owner" | "admin" | "editor" | "author" | "reviewer";
const CMS_ROLES: CmsRole[] = ["owner", "admin", "editor", "author", "reviewer"];

type UserRow = { id: number; email: string; display_name: string; role: CmsRole; status: string };

export function TeamSettings() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<CmsRole>("author");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/admin/users")
      .then((response) => response.json() as Promise<{ users?: UserRow[] }>)
      .then((result) => setUsers(result.users || []));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Saving...");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, displayName, role, status: "active" }),
    });
    const result = (await response.json()) as { users?: UserRow[]; error?: string };
    if (!response.ok) { setMessage(result.error || "Could not save user."); return; }
    setUsers(result.users || []);
    setEmail("");
    setDisplayName("");
    setMessage("User saved.");
  }

  async function disable(user: UserRow) {
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        status: user.status === "active" ? "disabled" : "active",
      }),
    });
    const result = (await response.json()) as { users?: UserRow[]; error?: string };
    if (!response.ok) { setMessage(result.error || "Could not update user."); return; }
    setUsers(result.users || []);
  }

  return (
    <div className="settings-stack">
      <form className="admin-panel compact-form" onSubmit={save}>
        <p className="admin-kicker">Add team member</p>
        <div className="settings-grid-3">
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} /></label>
          <label>Role<select value={role} onChange={(e) => setRole(e.target.value as CmsRole)}>{CMS_ROLES.filter((item) => item !== "owner").map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <div className="form-actions"><span>{message}</span><button className="btn btn-primary" type="submit">Save user</button></div>
      </form>
      <section className="admin-panel">
        <p className="admin-kicker">Team access</p>
        <div className="data-list">
          {users.map((user) => <article key={user.id}><div><strong>{user.display_name || user.email}</strong><span>{user.email} · {user.role} · {user.status}</span></div><button className="btn btn-secondary" type="button" onClick={() => void disable(user)}>{user.status === "active" ? "Disable" : "Enable"}</button></article>)}
          {!users.length && <p>No additional team members yet.</p>}
        </div>
      </section>
    </div>
  );
}
