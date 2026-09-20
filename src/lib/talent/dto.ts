export interface TalentApplicationDTO {
  id: string;
  applicationId: string;
  candidateId: string;
  candidateCode: string;
  jobId: string;
  jobCode: string;
  jobTitle: string;
  source: string;
  status: string;
  recruiterNotes: string | null;
  screeningNotes: string | null;
  clientSubmissionDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TalentCandidateDTO {
  id: string;
  candidateId: string;
  fullName: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  currentLocation: string | null;
  preferredLocation: string | null;
  totalExperience: number | null;
  relevantExperience: number | null;
  currentCompany: string | null;
  currentCtc: number | null;
  expectedCtc: number | null;
  noticePeriod: string | null;
  highestQualification: string | null;
  skills: string[];
  linkedinUrl: string | null;
  preferredWorkMode: string | null;
  shiftPreference: string | null;
  relocationPreference: string | null;
  source: string;
  consentStatus: string;
  internalNotes: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
