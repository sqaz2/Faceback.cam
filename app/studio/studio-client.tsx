"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Eye,
  Link2,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Profile = {
  id?: number;
  handle: string;
  displayName: string;
  brand: string;
  bio: string;
  story: string;
  location: string;
  websiteUrl: string;
  accent: string;
};

type Work = {
  id: number;
  title: string;
  url: string;
  provider: string;
  category: string;
  note: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
};

type WorkDraft = Omit<Work, "id" | "sortOrder">;

const EMPTY_WORK: WorkDraft = {
  title: "",
  url: "",
  provider: "Website",
  category: "Project",
  note: "",
  description: "",
  imageUrl: "",
};

export default function StudioClient({
  user,
  signOutHref,
}: {
  user: { displayName: string; email: string };
  signOutHref: string;
}) {
  const [profile, setProfile] = useState<Profile>({
    handle: "",
    displayName: user.displayName,
    brand: "",
    bio: "",
    story: "",
    location: "",
    websiteUrl: "",
    accent: "signal",
  });
  const [works, setWorks] = useState<Work[]>([]);
  const [draft, setDraft] = useState<WorkDraft>(EMPTY_WORK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const publicHref = useMemo(
    () => (profile.handle ? `/@${profile.handle.replace(/^@/, "")}` : ""),
    [profile.handle],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/profile")
      .then(async (response) => {
        const data = (await response.json()) as { profile?: Profile | null; works?: Work[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load your studio");
        if (!active) return;
        if (data.profile) setProfile(data.profile);
        setWorks(data.works ?? []);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load your studio");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateDraft<K extends keyof WorkDraft>(key: K, value: WorkDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = (await response.json()) as { profile?: Profile; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save profile");
      if (data.profile) setProfile(data.profile);
      setStatus("Creator page saved and published.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function previewLink() {
    if (!draft.url.trim()) {
      setError("Paste a link first.");
      return;
    }
    setPreviewing(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/link-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: draft.url }),
      });
      const data = (await response.json()) as { preview?: Partial<WorkDraft>; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to read that link");
      setDraft((current) => ({ ...current, ...data.preview, url: current.url }));
      setStatus("Link recognized. Check the details, then add it.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to read that link");
    } finally {
      setPreviewing(false);
    }
  }

  async function addWork(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/work", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await response.json()) as { work?: Work; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to add work");
      if (data.work) setWorks((current) => [...current, data.work as Work]);
      setDraft(EMPTY_WORK);
      setStatus("Work added to your public inventory.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add work");
    } finally {
      setSaving(false);
    }
  }

  async function removeWork(id: number) {
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/work", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to remove work");
      setWorks((current) => current.filter((item) => item.id !== id));
      setStatus("Work removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to remove work");
    }
  }

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <Link className="wordmark" href="/">
          FACEBACK<span>.CAM</span>
        </Link>
        <div className="studio-top-actions">
          {publicHref && (
            <Link href={publicHref} target="_blank">
              <Eye size={17} /> View page
            </Link>
          )}
          <a href={signOutHref} target="_top">Sign out</a>
        </div>
      </header>

      <div className="studio-layout">
        <aside className="studio-sidebar">
          <Link href="/"><ArrowLeft size={17} /> Movement home</Link>
          <div>
            <span className="studio-kicker">CREATOR STUDIO</span>
            <strong>{profile.displayName || user.displayName}</strong>
            <small>{user.email}</small>
          </div>
          <nav aria-label="Studio sections">
            <a href="#identity">01 · Identity</a>
            <a href="#inventory">02 · Work inventory</a>
            <a href="#publish">03 · Public page</a>
          </nav>
        </aside>

        <div className="studio-main">
          <section className="studio-intro">
            <p className="eyebrow">Build your creator home</p>
            <h1>Paste the work. Tell the story. Publish.</h1>
            <p>Your page stays public. Editing stays yours.</p>
          </section>

          {(status || error) && (
            <div className={`studio-message ${error ? "studio-error" : "studio-success"}`} role="status">
              {error ? null : <Check size={18} />}
              {error || status}
            </div>
          )}

          {loading ? (
            <div className="studio-loading"><LoaderCircle className="spin" size={24} /> Loading your studio…</div>
          ) : (
            <>
              <form className="studio-panel" id="identity" onSubmit={saveProfile}>
                <div className="panel-heading">
                  <span>01</span>
                  <div>
                    <h2>Creator identity</h2>
                    <p>This becomes the top of your public FACEBACK page.</p>
                  </div>
                </div>
                <div className="studio-grid two-col">
                  <label>
                    <span>Public handle</span>
                    <div className="handle-input"><b>@</b><input required value={profile.handle} onChange={(event) => updateProfile("handle", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="yourname" /></div>
                  </label>
                  <label>
                    <span>Creator name</span>
                    <input required value={profile.displayName} onChange={(event) => updateProfile("displayName", event.target.value)} placeholder="How people know you" />
                  </label>
                  <label>
                    <span>Brand or project</span>
                    <input value={profile.brand} onChange={(event) => updateProfile("brand", event.target.value)} placeholder="Optional" />
                  </label>
                  <label>
                    <span>Location</span>
                    <input value={profile.location} onChange={(event) => updateProfile("location", event.target.value)} placeholder="City, country or Online" />
                  </label>
                  <label className="wide-field">
                    <span>Creator bio</span>
                    <textarea maxLength={420} value={profile.bio} onChange={(event) => updateProfile("bio", event.target.value)} placeholder="What do you create, and what connects the work?" rows={4} />
                  </label>
                  <label className="wide-field">
                    <span>Why I face back</span>
                    <textarea maxLength={1400} value={profile.story} onChange={(event) => updateProfile("story", event.target.value)} placeholder="Optional: what has AI made possible, and what logic are you challenging?" rows={5} />
                  </label>
                  <label className="wide-field">
                    <span>Main website</span>
                    <input type="url" value={profile.websiteUrl} onChange={(event) => updateProfile("websiteUrl", event.target.value)} placeholder="https://" />
                  </label>
                </div>
                <button className="studio-save" disabled={saving} type="submit">
                  {saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
                  Save and publish identity
                </button>
              </form>

              <section className="studio-panel" id="inventory">
                <div className="panel-heading">
                  <span>02</span>
                  <div>
                    <h2>Work inventory</h2>
                    <p>Paste a public media or project link. FACEBACK builds the card.</p>
                  </div>
                </div>

                <form className="work-importer" onSubmit={addWork}>
                  <label className="wide-field">
                    <span>Media or project link</span>
                    <div className="link-import-row">
                      <input type="url" required value={draft.url} onChange={(event) => updateDraft("url", event.target.value)} placeholder="Paste a Suno, YouTube, Spotify, SoundCloud or website link" />
                      <button type="button" onClick={previewLink} disabled={previewing}>
                        {previewing ? <LoaderCircle className="spin" size={18} /> : <Link2 size={18} />}
                        Read link
                      </button>
                    </div>
                  </label>

                  {(draft.title || draft.imageUrl) && (
                    <div className="import-preview">
                      <div className="import-preview-art" style={draft.imageUrl ? { backgroundImage: `url(${draft.imageUrl})` } : undefined}>
                        {!draft.imageUrl && <Link2 size={24} />}
                      </div>
                      <div>
                        <span>{draft.provider} · {draft.category}</span>
                        <strong>{draft.title || "Untitled work"}</strong>
                      </div>
                    </div>
                  )}

                  <div className="studio-grid two-col">
                    <label>
                      <span>Title</span>
                      <input required value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="Work title" />
                    </label>
                    <label>
                      <span>Category</span>
                      <select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)}>
                        <option>Music</option>
                        <option>Video</option>
                        <option>Visual</option>
                        <option>Writing</option>
                        <option>Game / Web</option>
                        <option>Project</option>
                      </select>
                    </label>
                    <label className="wide-field">
                      <span>Short note</span>
                      <input value={draft.note} onChange={(event) => updateDraft("note", event.target.value)} placeholder="The inspiring one, original version, made in 2019…" />
                    </label>
                    <label className="wide-field">
                      <span>Behind the work</span>
                      <textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder="Optional: your idea, process, tools or decisions" rows={4} />
                    </label>
                  </div>
                  <button className="studio-save studio-add" disabled={saving || !profile.id} type="submit">
                    <Plus size={18} /> Add to my inventory
                  </button>
                  {!profile.id && <small className="form-hint">Save your creator identity before adding work.</small>}
                </form>

                <div className="studio-work-list">
                  {works.length === 0 ? (
                    <div className="empty-inventory">
                      <Link2 size={24} />
                      <strong>Your inventory is waiting.</strong>
                      <span>Paste your first work above.</span>
                    </div>
                  ) : (
                    works.map((work, index) => (
                      <article key={work.id}>
                        <span className="work-number">{String(index + 1).padStart(2, "0")}</span>
                        <div className="studio-work-art" style={work.imageUrl ? { backgroundImage: `url(${work.imageUrl})` } : undefined} />
                        <div>
                          <small>{work.provider} · {work.category}</small>
                          <strong>{work.title}</strong>
                          <span>{work.note}</span>
                        </div>
                        <a href={work.url} target="_blank" rel="noreferrer" aria-label={`Open ${work.title}`}><ArrowUpRight size={18} /></a>
                        <AlertDialog>
                          <AlertDialogTrigger className="remove-work" aria-label={`Remove ${work.title}`}><Trash2 size={17} /></AlertDialogTrigger>
                          <AlertDialogContent className="border-[#c9c1b6] bg-[#f2eee6] text-[#0b0b0b]">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove “{work.title}”?</AlertDialogTitle>
                              <AlertDialogDescription className="text-[#665f56]">This removes it from your FACEBACK page. The original media stays on its platform.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep it</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => removeWork(work.id)}>Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <section className="studio-panel publish-panel" id="publish">
                <div className="panel-heading">
                  <span>03</span>
                  <div>
                    <h2>Your public page</h2>
                    <p>Share one address everywhere you already have an audience.</p>
                  </div>
                </div>
                {publicHref ? (
                  <div className="public-address">
                    <span>faceback.cam/@{profile.handle.replace(/^@/, "")}</span>
                    <Link href={publicHref} target="_blank">Open page <ArrowUpRight size={18} /></Link>
                  </div>
                ) : (
                  <p className="publish-empty">Save a handle to publish your address.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
