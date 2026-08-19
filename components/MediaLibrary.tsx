/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, type FormEvent } from "react";

type Asset = { id: number; filename: string; alt_text?: string; altText?: string; url: string; size: number };

export function MediaLibrary() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    void fetch("/api/admin/media")
      .then((response) => response.json() as Promise<{ assets?: Asset[] }>)
      .then((result) => setAssets(result.assets || []));
  }, []);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!file) return;
    setMessage("Uploading..."); const form = new FormData(); form.set("file", file); form.set("altText", altText);
    const response = await fetch("/api/admin/media", { method: "POST", body: form });
    const result = await response.json() as { asset?: Asset; error?: string };
    if (!response.ok || !result.asset) { setMessage(result.error || "Upload failed."); return; }
    setAssets((current) => [result.asset!, ...current]); setFile(null); setAltText(""); setMessage("Image uploaded.");
  }
  async function remove(id: number) { const response = await fetch(`/api/admin/media/${id}`, { method: "DELETE" }); if (response.ok) setAssets((current) => current.filter((item) => item.id !== id)); }
  async function copy(url: string) { await navigator.clipboard.writeText(`![Image description](${url})`); setMessage("Image markup copied. Paste it into a post."); }
  return <div className="settings-stack"><form className="admin-panel compact-form" onSubmit={upload}><p className="admin-kicker">Upload image</p><div className="settings-grid-2"><label>Image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(e) => setFile(e.target.files?.[0] || null)} required /></label><label>Alternative text<input value={altText} onChange={(e) => setAltText(e.target.value)} maxLength={240} required /></label></div><div className="form-actions"><span>{message}</span><button className="btn btn-primary" type="submit">Upload</button></div></form><section className="media-grid">{assets.map((asset) => <article className="media-card" key={asset.id}><img src={asset.url} alt={asset.alt_text || asset.altText || ""} /><div><strong>{asset.filename}</strong><small>{Math.round(asset.size / 1024)} KB</small></div><div className="inline-actions"><button className="btn btn-secondary" type="button" onClick={() => void copy(asset.url)}>Copy markup</button><button className="admin-text-link danger-link" type="button" onClick={() => void remove(asset.id)}>Delete</button></div></article>)}{!assets.length && <div className="empty-state"><strong>No images uploaded</strong><span>Add the first image above.</span></div>}</section></div>;
}
