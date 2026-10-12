import raw from './data/mock.json';
import type { Mock, Topic, Lang, Question } from './types';

const rawBase = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';
const BASE = rawBase.replace(/\/+$/, '');
const COURSE = 'dbms';

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('sigma_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init?.headers) Object.assign(headers, init.headers);
  const r = await fetch(BASE + path, { ...init, headers: { ...headers, ...((init?.headers as Record<string,string>) || {}) } });
  if (!r.ok) {
    const errBody = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(errBody.detail || String(r.status));
  }
  return r.json() as Promise<T>;
}

export interface AskResult {
  covered: boolean;
  text?: string;
  key?: string | null;
  file?: string;
  loc?: string;
  confidence?: number;
  verified?: boolean;
  citations?: string[];
  title?: string;
}

export interface MaterialOut {
  id: string;
  kind: string;
  name: string;
  pages: number;
  status: string;
  video_url?: string;
}

export interface SubmitQuizResult {
  score_pct: number;
  correct: number;
  total: number;
  topic_performance: { topic: string; pct: number }[];
  misconception?: { a: string; b: string; explanation: string };
  updated_topics: Topic[];
}

const db = structuredClone(raw) as unknown as Mock;
const wait = <T,>(v:T, ms = 0) => new Promise<T>(r => setTimeout(() => r(v), ms));

export const api = {
  getMock: () => wait(db),

  listMaterials: async (): Promise<MaterialOut[]> => {
    try {
      return await j<MaterialOut[]>(`/api/materials?course_id=${COURSE}`);
    } catch {
      return db.materials.map(m => ({ id: m[0], kind: m[2], name: m[0], pages: parseInt(m[1]) || 10, status: 'ready' }));
    }
  },

  getTopics: async (): Promise<Topic[]> => {
    try {
      const rows = await j<{ id: string; name: string; mastery: number; prerequisites: string[] }[]>(`/api/courses/${COURSE}/topics`);
      return rows.map(r => {
        const match = db.topics.find(t => t.n === r.name);
        return { n: r.name, m: r.mastery, pre: r.prerequisites || [], src: match?.src || 'DBMS.pdf' };
      });
    } catch {
      return db.topics;
    }
  },

  getProgress: async () => {
    try {
      return await j<{ overall_mastery: number; topics: { topic: string; mastery: number }[]; weak_topics: { topic: string; mastery: number }[] }>(`/api/courses/${COURSE}/progress`);
    } catch {
      return {
        overall_mastery: 68,
        topics: db.topics.map(t => ({ topic: t.n, mastery: t.m })),
        weak_topics: db.topics.filter(t => t.m < 60).map(t => ({ topic: t.n, mastery: t.m })),
      };
    }
  },

  ask: async (text: string, lang: Lang, history?: { role: string; text: string }[]): Promise<AskResult> => {
    const userStr = localStorage.getItem('sigma_user');
    const userId = userStr ? JSON.parse(userStr).id : undefined;
    try {
      const r = await j<{ text: string; covered: boolean; title?: string; source_file?: string; source_loc?: string; confidence?: number; verified?: boolean; citations?: string[] }>('/api/chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: COURSE, text, lang, user_id: userId, history }),
      });
      return { covered: r.covered, text: r.text, title: r.title, file: r.source_file ?? undefined, loc: r.source_loc ?? undefined, confidence: r.confidence, verified: r.verified, citations: r.citations };
    } catch (e) {
      console.error('API Chat Error:', e);
      return {
        covered: true,
        text: `Sorry, unable to connect to Gemini API. Please make sure the backend server is running.`,
        confidence: 0,
        verified: false,
        citations: []
      };
    }
  },

  analyzeTitle: async (query: string, context: string = ''): Promise<string> => {
    try {
      const r = await j<{ title: string }>('/api/chat/analyze-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context }),
      });
      return r.title;
    } catch {
      return '';
    }
  },

  upload: (file: File, onProgress?: (pct: number) => void): Promise<MaterialOut> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const f = new FormData();
      f.append('course_id', COURSE);
      f.append('file', file);
      const userStr = localStorage.getItem('sigma_user');
      if (userStr) {
        try {
          const userId = JSON.parse(userStr).id;
          if (userId) f.append('user_id', userId);
        } catch {}
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve({ id: 'm_' + Date.now(), kind: 'video', name: file.name, pages: 1, status: 'ready' });
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.detail || `Upload failed (${xhr.status})`));
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));

      const token = localStorage.getItem('sigma_token');
      xhr.open('POST', BASE + '/api/materials/upload');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(f);
    });
  },

  addVideo: (name: string, url: string) =>
    j<MaterialOut>('/api/materials/video-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: COURSE, name, url }),
    }),

  generateQuiz: async (topics?: string[]): Promise<Question[]> => {
    try {
      const tList = topics && topics.length ? topics : ['Normalization', 'Transactions'];
      const res = await j<{ id: string; topic: string; difficulty: string; text: string; options: string[] }[]>('/api/assessments/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: COURSE, topics: tList, difficulty: 'Medium' }),
      });
      return res.map(q => ({
        t: q.topic,
        d: q.difficulty,
        q: q.text,
        o: q.options,
        a: 0,
        id: q.id,
      })) as Question[];
    } catch {
      return db.quiz;
    }
  },

  generateAssessment: async (topics: string[] = ['Normalization', 'Transactions'], difficulty: string = 'Medium', count: number = 3) => {
    try {
      return await j<any[]>('/api/assessments/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: COURSE, topics, difficulty, num_questions: count }),
      });
    } catch {
      return [
        {
          id: 'q1',
          topic: 'DBMS Normalization',
          text: 'What is the primary objective of 2NF (Second Normal Form)?',
          options: [
            'Remove transitive dependencies',
            'Eliminate partial functional dependencies',
            'Enforce foreign key constraints',
            'Increase disk storage'
          ],
          answer_index: 1,
          explanation: '2NF eliminates partial dependencies where non-prime attributes depend on parts of candidate keys.'
        }
      ];
    }
  },

  submitQuizReal: async (questionIds: string[], answers: number[]): Promise<SubmitQuizResult | null> => {
    try {
      const res = await j<any>('/api/assessments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: COURSE, question_ids: questionIds, answers }),
      });
      if (res && res.updated_topics) {
        res.updated_topics = res.updated_topics.map((t: any) => {
          const match = db.topics.find(dt => dt.n === (t.name || t.n));
          return {
            n: t.name || t.n,
            m: Math.round(t.mastery ?? t.m ?? 65),
            pre: t.prerequisites || t.pre || [],
            src: t.src || match?.src || 'DBMS.pdf',
          };
        });
      }
      return res as SubmitQuizResult;
    } catch {
      return null;
    }
  },

  submitQuiz: (answers: number[], questions?: Question[]) => {
    const qList = questions && questions.length ? questions : db.quiz;
    const topicScores: Record<string, { correct: number; total: number }> = {};
    qList.forEach((q, idx) => {
      const topicName = q.t || 'Normalization';
      if (!topicScores[topicName]) topicScores[topicName] = { correct: 0, total: 0 };
      topicScores[topicName].total += 1;
      if (answers[idx] === q.a) topicScores[topicName].correct += 1;
    });

    db.topics.forEach(t => {
      if (topicScores[t.n]) {
        const perf = (topicScores[t.n].correct / topicScores[t.n].total) * 100;
        t.m = Math.min(100, Math.max(15, Math.round(t.m * 0.4 + perf * 0.6)));
      }
    });
    return wait<Topic[]>(db.topics.map(t => ({ ...t })));
  },

  deleteMaterial: async (id: string) => {
    try {
      return await j<{ status: string }>(`/api/materials/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      return { status: 'deleted' };
    }
  },

  renameMaterial: async (id: string, name: string) => {
    try {
      return await j<{ status: string; id: string; name: string }>(`/api/materials/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
    } catch {
      return { status: 'updated', id, name };
    }
  },
};

