export interface JDAnalysis {
  required_skills: string[];
  must_have_skills?: string[];
  experience_required?: string;
  weightage?: Record<string, number>;
}

export interface JobCampaign {
  _id: string;
  title: string;
  department: string;
  job_title?: string;
  generated_jd?: string;
  jd_analysis?: JDAnalysis;
  kanban_stage: 'Sourcing' | 'Screening' | 'Interview' | 'Offer' | 'Hired';
  candidateCount?: number;
  shortlisted?: number;
  hiredCount?: number;
  stageCounts?: Record<string, number>;
  status?: string;
  createdAt: string;
  updatedAt: string;
  pipeline_stages?: string[];
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface ValidatedSkills {
  top_skills: (string | { name: string })[];
  missing_skills?: string[];
  skill_gap_analysis?: string;
}

export interface MatchResults {
  strengths: string[];
  weaknesses: string[];
  suitability_index: number;
}

export interface JobCandidate {
  _id: string;
  campaignId: string;
  full_name: string;
  email: string;
  phone?: string;
  years_experience?: number;
  resume_url: string;
  fileName?: string;
  parsed_data?: {
    full_name?: string;
    email?: string;
    phone?: string;
    experience_years?: number;
    is_fresher?: boolean;
    current_title?: string;
    location?: string;
    work_summary?: string;
    confidence_score?: number;
    social_links?: {
      linkedin?: string;
      github?: string;
    };
  };
  match_score?: number;
  corrected_score?: number;
  final_score?: number;
  interview_stage: 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected';
  final_decision?: 'STRONG_YES' | 'YES' | 'MAYBE' | 'NO' | 'PENDING';
  debate_summary?: string;
  hr_note?: string;
  notes?: string;
  tags?: string[];
  validated_skills?: ValidatedSkills;
  match_results?: MatchResults;
  applied_at: string;
  updated_at: string;
  createdAt?: string;
  status?: string;
  rank?: number;
  interview_questions?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface Notification {
  _id: string;
  type: 'upload' | 'complete' | 'alert' | 'info';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
}
