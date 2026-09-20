'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ClientOption {
  id: string;
  companyName: string;
}

const EMPLOYMENT_TYPES = ['full_time', 'contract', 'contract_to_hire', 'internship', 'part_time'] as const;
const WORK_MODES = ['onsite', 'hybrid', 'remote'] as const;

const input = 'w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none';
const label = 'block text-sm font-medium text-slate-700';

const empty = {
  title: '',
  clientId: '',
  description: '',
  employmentType: 'full_time',
  location: '',
  workMode: 'onsite',
  experienceMin: '',
  experienceMax: '',
  salaryMin: '',
  salaryMax: '',
  salaryPublic: false,
  openings: '1',
  requiredSkills: '',
  preferredSkills: '',
  qualification: '',
  shift: '',
  noticePeriodRequirement: '',
};

export function OwnerJobCreateForm() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/owner/talent/clients?limit=200')
      .then((res) => res.json())
      .then((json) => {
        if (json?.success) setClients(json.data.clients ?? []);
      })
      .catch(() => undefined);
  }, []);

  async function submit(): Promise<void> {
    setError(null);
    if (form.title.trim().length < 3) {
      setError('Enter the job title.');
      return;
    }
    if (form.description.trim().length < 30) {
      setError('Add a job description of at least 30 characters.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/owner/talent/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          clientId: form.clientId || undefined,
          description: form.description,
          employmentType: form.employmentType,
          location: form.location || undefined,
          workMode: form.workMode,
          experienceMin: form.experienceMin || undefined,
          experienceMax: form.experienceMax || undefined,
          salaryMin: form.salaryMin || undefined,
          salaryMax: form.salaryMax || undefined,
          salaryPublic: form.salaryPublic,
          openings: form.openings || '1',
          requiredSkills: form.requiredSkills || undefined,
          preferredSkills: form.preferredSkills || undefined,
          qualification: form.qualification || undefined,
          shift: form.shift || undefined,
          noticePeriodRequirement: form.noticePeriodRequirement || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Could not create the job');
        return;
      }
      router.push('/owner/talent/jobs/' + json.data.job.id);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-white p-6">
      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="job-title">Job title *</label>
          <input id="job-title" maxLength={160} className={input + ' mt-2'} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="job-client">Client</label>
          <select id="job-client" className={input + ' mt-2'} value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            <option value="">No client assigned</option>
            {clients.map((client) => (<option key={client.id} value={client.id}>{client.companyName}</option>))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={label} htmlFor="job-description">Description *</label>
          <textarea id="job-description" rows={8} maxLength={20000} className={input + ' mt-2'} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <p className="mt-1 text-xs text-slate-500">The description is shown on the public job page once the job is published.</p>
        </div>
        <div>
          <label className={label} htmlFor="job-employment">Employment type</label>
          <select id="job-employment" className={input + ' mt-2'} value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
            {EMPLOYMENT_TYPES.map((value) => (<option key={value} value={value}>{value.replace(/_/g, ' ')}</option>))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="job-workmode">Work mode</label>
          <select id="job-workmode" className={input + ' mt-2'} value={form.workMode} onChange={(e) => setForm({ ...form, workMode: e.target.value })}>
            {WORK_MODES.map((value) => (<option key={value} value={value}>{value}</option>))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="job-location">Location</label>
          <input id="job-location" maxLength={160} className={input + ' mt-2'} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="job-exp-min">Minimum experience (years)</label>
          <input id="job-exp-min" type="number" min={0} max={60} className={input + ' mt-2'} value={form.experienceMin} onChange={(e) => setForm({ ...form, experienceMin: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="job-exp-max">Maximum experience (years)</label>
          <input id="job-exp-max" type="number" min={0} max={60} className={input + ' mt-2'} value={form.experienceMax} onChange={(e) => setForm({ ...form, experienceMax: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="job-openings">Openings *</label>
          <input id="job-openings" type="number" min={1} max={999} className={input + ' mt-2'} value={form.openings} onChange={(e) => setForm({ ...form, openings: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="job-salary-min">Annual salary from (INR)</label>
          <input id="job-salary-min" type="number" min={0} className={input + ' mt-2'} value={form.salaryMin} onChange={(e) => setForm({ ...form, salaryMin: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="job-salary-max">Annual salary to (INR)</label>
          <input id="job-salary-max" type="number" min={0} className={input + ' mt-2'} value={form.salaryMax} onChange={(e) => setForm({ ...form, salaryMax: e.target.value })} />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={form.salaryPublic} onChange={(e) => setForm({ ...form, salaryPublic: e.target.checked })} className="h-4 w-4 rounded border-line text-accent" />
            Show salary publicly
          </label>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={label} htmlFor="job-required-skills">Required skills (comma separated)</label>
          <input id="job-required-skills" maxLength={600} className={input + ' mt-2'} placeholder="e.g. Linux, Networking, MySQL" value={form.requiredSkills} onChange={(e) => setForm({ ...form, requiredSkills: e.target.value })} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={label} htmlFor="job-preferred-skills">Preferred skills (comma separated)</label>
          <input id="job-preferred-skills" maxLength={600} className={input + ' mt-2'} value={form.preferredSkills} onChange={(e) => setForm({ ...form, preferredSkills: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="job-qualification">Qualification</label>
          <input id="job-qualification" maxLength={200} className={input + ' mt-2'} value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="job-shift">Shift</label>
          <input id="job-shift" maxLength={120} className={input + ' mt-2'} value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="job-notice">Notice period requirement</label>
          <input id="job-notice" maxLength={120} className={input + ' mt-2'} value={form.noticePeriodRequirement} onChange={(e) => setForm({ ...form, noticePeriodRequirement: e.target.value })} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => void submit()} disabled={saving} className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50">
          {saving ? 'Creating...' : 'Create draft job'}
        </button>
        <button type="button" onClick={() => setForm(empty)} className="inline-flex items-center rounded-md border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-50">
          Reset
        </button>
      </div>
    </div>
  );
}
