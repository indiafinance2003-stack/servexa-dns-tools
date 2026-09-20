'use client';

import { useState } from 'react';

export interface ApplyJobSummary {
  code: string;
  title: string;
  location: string | null;
  workMode: string;
}

const inputClass = 'w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none';
const labelClass = 'block text-sm font-medium text-slate-700';

const initialValues: Record<string, string> = {
  fullName: '', email: '', phone: '', whatsapp: '',
  currentLocation: '', preferredLocation: '',
  totalExperience: '', relevantExperience: '',
  currentCompany: '', highestQualification: '',
  skills: '', currentCtc: '', expectedCtc: '',
  noticePeriod: '', preferredWorkMode: 'onsite',
  shiftPreference: '', relocationPreference: '',
  linkedinUrl: '',
};

const SUCCESS_MESSAGE = 'Thank you for applying. We have received your application and will contact you if your profile is shortlisted or if we need additional information.';

export function TalentApplyForm({ job }: { job: ApplyJobSummary }) {
  const [values, setValues] = useState(initialValues);
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [duplicate, setDuplicate] = useState(false);

  function update(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) { setStatus('error'); return; }
    setStatus('submitting');
    const data = new FormData();
    data.set('jobId', job.code);
    for (const [key, value] of Object.entries(values)) {
      if (value !== '') data.set(key, value);
    }
    data.set('consent', 'true');
    if (file) data.set('resume', file);
    try {
      const response = await fetch('/api/talent/apply', { method: 'POST', body: data });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !payload || typeof payload !== 'object' || !('success' in payload)) {
        setStatus('error');
        return;
      }
      const body = payload as { success: true; data: { duplicate?: boolean } };
      setDuplicate(Boolean(body.data?.duplicate));
      setStatus('success');
    } catch { setStatus('error'); }
  }

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-line bg-white p-6" role="status">
        <h2 className="text-lg font-semibold text-ink">Application received</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{SUCCESS_MESSAGE}</p>
        {duplicate && <p className="mt-3 text-sm text-slate-600">We found an existing application.</p>}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-xl border border-line bg-white p-6">
      {status === 'error' && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          Something went wrong. Please check your details and try again.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="fullName">Full name *</label>
          <input id="fullName" name="fullName" required className={inputClass} value={values.fullName} onChange={(e) => update('fullName', e.target.value)} autoComplete="name" />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">Email *</label>
          <input id="email" name="email" type="email" required className={inputClass} value={values.email} onChange={(e) => update('email', e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">Mobile number *</label>
          <input id="phone" name="phone" required className={inputClass} value={values.phone} onChange={(e) => update('phone', e.target.value)} autoComplete="tel" />
        </div>
        <div>
          <label className={labelClass} htmlFor="whatsapp">WhatsApp number</label>
          <input id="whatsapp" name="whatsapp" className={inputClass} value={values.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="currentLocation">Current location</label>
          <input id="currentLocation" name="currentLocation" className={inputClass} value={values.currentLocation} onChange={(e) => update('currentLocation', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="preferredLocation">Preferred location</label>
          <input id="preferredLocation" name="preferredLocation" className={inputClass} value={values.preferredLocation} onChange={(e) => update('preferredLocation', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="totalExperience">Total experience (years)</label>
          <input id="totalExperience" name="totalExperience" type="number" className={inputClass} value={values.totalExperience} onChange={(e) => update('totalExperience', e.target.value)} placeholder="e.g. 3" />
        </div>

        <div>
          <label className={labelClass} htmlFor="relevantExperience">Relevant experience (years)</label>
          <input id="relevantExperience" name="relevantExperience" type="number" className={inputClass} value={values.relevantExperience} onChange={(e) => update('relevantExperience', e.target.value)} placeholder="e.g. 2" />
        </div>
        <div>
          <label className={labelClass} htmlFor="currentCompany">Current company</label>
          <input id="currentCompany" name="currentCompany" className={inputClass} value={values.currentCompany} onChange={(e) => update('currentCompany', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="highestQualification">Highest qualification</label>
          <input id="highestQualification" name="highestQualification" className={inputClass} value={values.highestQualification} onChange={(e) => update('highestQualification', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="skills">Key skills (comma separated)</label>
          <input id="skills" name="skills" className={inputClass} value={values.skills} onChange={(e) => update('skills', e.target.value)} placeholder="e.g. Linux, Python, AWS" />
        </div>
        <div>
          <label className={labelClass} htmlFor="currentCtc">Current CTC (INR/month)</label>
          <input id="currentCtc" name="currentCtc" type="number" className={inputClass} value={values.currentCtc} onChange={(e) => update('currentCtc', e.target.value)} placeholder="e.g. 35000" />
        </div>
        <div>
          <label className={labelClass} htmlFor="expectedCtc">Expected CTC (INR/month)</label>
          <input id="expectedCtc" name="expectedCtc" type="number" className={inputClass} value={values.expectedCtc} onChange={(e) => update('expectedCtc', e.target.value)} placeholder="e.g. 45000" />
        </div>
        <div>
          <label className={labelClass} htmlFor="noticePeriod">Notice period (days)</label>
          <input id="noticePeriod" name="noticePeriod" type="number" className={inputClass} value={values.noticePeriod} onChange={(e) => update('noticePeriod', e.target.value)} placeholder="e.g. 30" />
        </div>
        <div>
          <label className={labelClass} htmlFor="preferredWorkMode">Work mode</label>
          <select id="preferredWorkMode" name="preferredWorkMode" className={inputClass} value={values.preferredWorkMode} onChange={(e) => update('preferredWorkMode', e.target.value)}>
            <option value="onsite">On-site</option>
            <option value="hybrid">Hybrid</option>
            <option value="remote">Remote</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="shiftPreference">Shift preference</label>
          <input id="shiftPreference" name="shiftPreference" className={inputClass} value={values.shiftPreference} onChange={(e) => update('shiftPreference', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="relocationPreference">Relocation preference</label>
          <input id="relocationPreference" name="relocationPreference" className={inputClass} value={values.relocationPreference} onChange={(e) => update('relocationPreference', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="linkedinUrl">LinkedIn profile</label>
          <input id="linkedinUrl" name="linkedinUrl" type="url" className={inputClass} value={values.linkedinUrl} onChange={(e) => update('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/..." />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="resume">Resume (PDF, DOC or DOCX) *</label>
          <input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-accent file:text-white file:text-sm hover:file:bg-accent/80 w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 cursor-pointer text-sm font-medium text-slate-700">
            <input type="checkbox" id="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-accent" />
            <span>I consent to Ravelyth storing my personal data for recruitment purposes and contacting me about relevant opportunities.</span>
          </label>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={status === 'submitting' || !consent || !file} className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition disabled:opacity-50 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
            {status === 'submitting' ? 'Submitting...' : 'Apply now'}
          </button>
        </div>
      </div>
    </form>
  );
}
