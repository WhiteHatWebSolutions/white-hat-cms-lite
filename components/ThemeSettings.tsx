"use client";

import { useState, type FormEvent } from "react";
import type { SiteSettings } from "@/lib/site-settings";

type ThemeSettingsProps = {
  initialSettings: SiteSettings;
};

type ThemeValues = Omit<SiteSettings, "updatedAt">;

const COLOR_FIELDS: Array<{ key: keyof ThemeValues; label: string }> = [
  { key: "primaryColor", label: "Primary color" },
  { key: "accentColor", label: "Accent color" },
  { key: "backgroundColor", label: "Background color" },
  { key: "textColor", label: "Text color" },
];

export function ThemeSettings({ initialSettings }: ThemeSettingsProps) {
  const [values, setValues] = useState<ThemeValues>({
    siteName: initialSettings.siteName,
    tagline: initialSettings.tagline,
    description: initialSettings.description,
    primaryColor: initialSettings.primaryColor,
    accentColor: initialSettings.accentColor,
    backgroundColor: initialSettings.backgroundColor,
    textColor: initialSettings.textColor,
    customCss: initialSettings.customCss,
    logoUrl: initialSettings.logoUrl,
    faviconUrl: initialSettings.faviconUrl,
    headingFont: initialSettings.headingFont,
    bodyFont: initialSettings.bodyFont,
    layoutStyle: initialSettings.layoutStyle,
    navigation: initialSettings.navigation,
    customDomain: initialSettings.customDomain,
  });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as {
        error?: string;
        settings?: SiteSettings;
      };

      if (!response.ok || !result.settings) {
        throw new Error(result.error || "The appearance settings could not be saved.");
      }

      setState("saved");
      setMessage("Saved. Public pages now use these settings.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "The appearance settings could not be saved.",
      );
    }
  }

  function update<K extends keyof ThemeValues>(key: K, value: ThemeValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setState("idle");
    setMessage("");
  }

  async function importTheme(file: File | undefined) {
    if (!file) return;
    try {
      const themePackage = JSON.parse(await file.text()) as unknown;
      const response = await fetch("/api/admin/theme-package", { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify(themePackage) });
      const result = await response.json() as { error?: string; settings?: SiteSettings };
      if (!response.ok || !result.settings) throw new Error(result.error || "The theme could not be imported.");
      const next = Object.fromEntries(Object.entries(result.settings).filter(([key]) => key !== "updatedAt")) as ThemeValues;
      setValues(next);
      setMessage("Theme imported and applied.");
      setState("saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The theme could not be imported.");
      setState("error");
    }
  }

  return (
    <form className="theme-settings" onSubmit={handleSubmit}>
      <div className="theme-settings-main">
        <section className="admin-panel">
          <p className="admin-kicker">Publication identity</p>
          <div className="field-group">
            <label htmlFor="site-name">Publication name</label>
            <input
              id="site-name"
              value={values.siteName}
              onChange={(event) => update("siteName", event.target.value)}
              maxLength={80}
              required
            />
          </div>
          <div className="field-group">
            <label htmlFor="site-tagline">Tagline</label>
            <input
              id="site-tagline"
              value={values.tagline}
              onChange={(event) => update("tagline", event.target.value)}
              maxLength={160}
              required
            />
          </div>
          <div className="field-group">
            <label htmlFor="site-description">Public description</label>
            <textarea
              id="site-description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              rows={4}
              maxLength={320}
              required
            />
          </div>
          <div className="settings-grid-2">
            <div className="field-group">
              <label htmlFor="logo-url">Logo URL</label>
              <input id="logo-url" value={values.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} placeholder="/media/... or https://..." />
            </div>
            <div className="field-group">
              <label htmlFor="favicon-url">Favicon URL</label>
              <input id="favicon-url" value={values.faviconUrl} onChange={(event) => update("faviconUrl", event.target.value)} placeholder="/media/... or https://..." />
            </div>
          </div>
          <div className="settings-grid-3">
            <div className="field-group"><label htmlFor="heading-font">Heading font</label><select id="heading-font" value={values.headingFont} onChange={(event) => update("headingFont", event.target.value)}>{["Inter", "Arial", "Georgia", "Merriweather", "system-ui"].map((font) => <option key={font}>{font}</option>)}</select></div>
            <div className="field-group"><label htmlFor="body-font">Body font</label><select id="body-font" value={values.bodyFont} onChange={(event) => update("bodyFont", event.target.value)}>{["Inter", "Arial", "Georgia", "Merriweather", "system-ui"].map((font) => <option key={font}>{font}</option>)}</select></div>
            <div className="field-group"><label htmlFor="layout-style">Layout</label><select id="layout-style" value={values.layoutStyle} onChange={(event) => update("layoutStyle", event.target.value as ThemeValues["layoutStyle"])}><option value="editorial">Editorial</option><option value="minimal">Minimal</option><option value="wide">Wide</option></select></div>
          </div>
          <div className="field-group"><label htmlFor="custom-domain">Custom domain</label><input id="custom-domain" value={values.customDomain} onChange={(event) => update("customDomain", event.target.value)} placeholder="publication.example.com" /><small>Configure DNS with the hosting provider after saving the intended hostname.</small></div>
          <div className="field-group"><label>Navigation links</label>{values.navigation.map((item, index) => <div className="settings-grid-2" key={`${index}-${item.url}`}><input aria-label={`Navigation label ${index + 1}`} value={item.label} onChange={(event) => update("navigation", values.navigation.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry))} placeholder="Label" /><div className="inline-actions"><input aria-label={`Navigation URL ${index + 1}`} value={item.url} onChange={(event) => update("navigation", values.navigation.map((entry, entryIndex) => entryIndex === index ? { ...entry, url: event.target.value } : entry))} placeholder="/path/ or https://..." /><button type="button" onClick={() => update("navigation", values.navigation.filter((_, entryIndex) => entryIndex !== index))}>Remove</button></div></div>)}<button className="btn btn-secondary" type="button" disabled={values.navigation.length >= 8} onClick={() => update("navigation", [...values.navigation, { label: "New link", url: "/" }])}>Add navigation link</button><small>Up to eight relative or HTTPS links.</small></div>
        </section>

        <section className="admin-panel">
          <p className="admin-kicker">Advanced styling</p>
          <div className="field-group">
            <label htmlFor="custom-css">Custom CSS</label>
            <textarea
              id="custom-css"
              className="content-editor theme-code"
              value={values.customCss}
              onChange={(event) => update("customCss", event.target.value)}
              rows={11}
              maxLength={10000}
              placeholder=".publication-page { ... }"
            />
            <small>
              Optional CSS for precise public-site changes. External resource
              loading through CSS is blocked.
            </small>
          </div>
        </section>
      </div>

      <aside className="theme-settings-sidebar">
        <section className="admin-panel">
          <p className="admin-kicker">Theme colors</p>
          {COLOR_FIELDS.map((field) => (
            <div className="theme-color-field" key={field.key}>
              <label htmlFor={field.key}>{field.label}</label>
              <div>
                <input
                  id={field.key}
                  type="color"
                  value={values[field.key] as string}
                  onChange={(event) =>
                    update(field.key, event.target.value as ThemeValues[typeof field.key])
                  }
                />
                <input
                  aria-label={`${field.label} hex value`}
                  value={values[field.key] as string}
                  onChange={(event) =>
                    update(field.key, event.target.value as ThemeValues[typeof field.key])
                  }
                  pattern="#[0-9A-Fa-f]{6}"
                  maxLength={7}
                  required
                />
              </div>
            </div>
          ))}
          <div className="inline-actions"><a className="btn btn-secondary" href="/api/admin/theme-package">Export theme</a><label className="btn btn-secondary">Import theme<input type="file" accept="application/json,.json" hidden onChange={(event) => void importTheme(event.target.files?.[0])} /></label></div>
        </section>

        <section
          className="theme-preview"
          style={{
            backgroundColor: values.backgroundColor,
            color: values.textColor,
            borderColor: values.primaryColor,
          }}
        >
          <span style={{ color: values.accentColor }}>LIVE THEME PREVIEW</span>
          <strong style={{ color: values.primaryColor }}>{values.siteName}</strong>
          <p style={{ color: values.textColor }}>{values.tagline}</p>
          <i style={{ backgroundColor: values.accentColor }} />
        </section>

        <div className="theme-save-row">
          <span className={`save-message ${state === "error" ? "is-error" : ""}`}>
            {state === "saving" ? "Saving..." : message}
          </span>
          <button className="btn btn-primary" type="submit" disabled={state === "saving"}>
            {state === "saving" ? "Saving" : "Save appearance"}
          </button>
        </div>
      </aside>
    </form>
  );
}
