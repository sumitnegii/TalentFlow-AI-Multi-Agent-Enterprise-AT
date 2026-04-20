import axios from 'axios';

const getApiBaseUrl = () => {
  const normalize = (url: string) => {
    if (!url) return '';
    return url.endsWith('/api') ? url : `${url.replace(/\/$/, '')}/api`;
  };

  if (typeof window !== 'undefined') {
    if (process.env.NEXT_PUBLIC_API_URL) return normalize(process.env.NEXT_PUBLIC_API_URL);
    
    const isDev = window.location.hostname === 'localhost';
    if (isDev) return 'http://localhost:5001/api';
    
    return 'https://talentflow-ai-multi-agent-enterprise-at.onrender.com/api';
  }
  return normalize(process.env.NEXT_PUBLIC_API_URL || 'https://talentflow-ai-multi-agent-enterprise-at.onrender.com/api');
};

const API_BASE_URL = getApiBaseUrl();
export const API_HOST = API_BASE_URL.replace('/api', '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const jobApi = {
  // ── Campaigns ────────────────────────────────────────────────
  create: (data: { title: string; prompt: string; department?: string }) =>
    api.post('/job/create', data),
  getAll: () => api.get('/campaigns'),
  deleteCampaign: (id: string) => api.delete(`/campaign/${id}`),
  updateCampaignStage: (id: string, kanban_stage: string) =>
    api.patch(`/campaign/${id}/stage`, { kanban_stage }),
  getPublicJob: (id: string) => api.get(`/job/${id}/public`),
  applyToJob: (id: string, formData: FormData) =>
    api.post(`/job/${id}/apply`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  generateRecommendation: (id: string) => api.post(`/campaign/${id}/recommend`),

  // ── Results ──────────────────────────────────────────────────
  getResults: (jobId: string) => api.get(`/results/${jobId}`),

  // ── Candidates ───────────────────────────────────────────────
  uploadCandidates: (jobId: string, files: File[]) => {
    const formData = new FormData();
    formData.append('jobId', jobId);
    files.forEach(file => formData.append('resumes', file));
    return api.post('/candidate/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  processEvaluation: (jobId: string) => api.post('/process', { jobId }),

  // ── Candidate Profile ─────────────────────────────────────────
  getCandidate: (id: string) => api.get(`/candidate/${id}`),
  updateCandidateStage: (id: string, interview_stage: string) =>
    api.patch(`/candidate/${id}/stage`, { interview_stage }),
  updateCandidateNotes: (id: string, notes: string, tags?: string[]) =>
    api.patch(`/candidate/${id}/notes`, { notes, tags }),
  renameCandidate: (id: string, full_name: string) =>
    api.patch(`/candidate/${id}/rename`, { full_name }),
  deleteCandidate: (id: string) => api.delete(`/candidate/${id}`),
  getSignedResumeUrl: (id: string) => api.get(`/candidate/${id}/view-resume`),

  // ── Comments ──────────────────────────────────────────────────
  getComments: (id: string) => api.get(`/candidate/${id}/comments`),
  postComment: (id: string, body: string, author?: string) =>
    api.post(`/candidate/${id}/comments`, { body, author }),

  // ── AI Features ───────────────────────────────────────────────
  generateInterviewQuestions: (id: string) =>
    api.post(`/candidate/${id}/interview-questions`),
  generateRejectionInsight: (id: string) =>
    api.post(`/candidate/${id}/rejection-insight`),

  // ── Bulk Actions ──────────────────────────────────────────────
  bulkAction: (ids: string[], action: string, interview_stage?: string) =>
    api.post('/candidates/bulk', { ids, action, interview_stage }),

  // ── Analytics ────────────────────────────────────────────────
  getAnalytics: () => api.get('/analytics'),

  // ── Global Candidates (CRM) ──────────────────────────────────
  getAllCandidates: () => api.get('/candidates/all'),

  // ── Dashboard Alerts ─────────────────────────────────────────
  getDashboardAlerts: () => api.get('/dashboard/alerts'),

  // ── Timeline ─────────────────────────────────────────────────
  getTimeline: (id: string) => api.get(`/candidate/${id}/timeline`),

  // ── Silver Medalist ───────────────────────────────────────────
  toggleSilverMedal: (id: string) => api.patch(`/candidate/${id}/toggle-silver`),

  // ── Interview Management ──────────────────────────────────────
  addInterviewRound: (id: string, data: { type: string; title: string; interviewerName: string; scheduledAt?: string }) =>
    api.post(`/candidate/${id}/interview`, data),
  submitFeedback: (id: string, roundId: string, data: { rating: number; strengths: string; concerns: string; decision: string; interviewerName: string }) =>
    api.post(`/candidate/${id}/interview/${roundId}/feedback`, data),
};

export default api;
