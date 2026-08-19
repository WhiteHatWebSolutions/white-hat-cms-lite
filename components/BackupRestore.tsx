"use client";

import { useState } from "react";

export function BackupRestore() {
  const [file, setFile] = useState<File>();
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  async function restore() {
    if (!file) { setMessage("Choose a backup file."); return; }
    if (confirmation !== "RESTORE") { setMessage("Type RESTORE to confirm."); return; }
    setMessage("Restoring backup...");
    try {
      const backup = JSON.parse(await file.text()) as unknown;
      const response = await fetch("/api/admin/restore", { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation, backup }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The backup could not be restored.");
      setMessage("Backup restored. Reload the administrative desk.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The backup could not be restored."); }
  }
  return <section className="admin-panel"><p className="admin-kicker">Disaster recovery</p><h2>Restore a backup</h2><p>This replaces CMS database records. Stored R2 image objects are not changed. Current encrypted connection secrets are retained when the backup contains redacted values.</p><div className="settings-grid-2"><label>Backup JSON<input type="file" accept="application/json,.json" onChange={(event) => setFile(event.target.files?.[0])} /></label><label>Confirmation<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type RESTORE" /></label></div><div className="form-actions"><span>{message}</span><button className="btn btn-secondary" type="button" onClick={() => void restore()}>Restore backup</button></div></section>;
}
