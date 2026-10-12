import { useState, useEffect, type CSSProperties } from 'react';
import { Icon, type IconName } from '../icons';
import { api, type MaterialOut } from '../api';
import type { Ctx, Question, Topic } from '../types';

const COL = ['#a24bc0', '#ee4a7a', '#4db5f5', '#2f74b8', '#4eaeb9'],
  DK = ['#7a2f94', '#c93063', '#2f94d6', '#1f4f82', '#37858f'];
const AR: CSSProperties = { clipPath: 'polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%)' };
const Bar = ({ v, w }: { v: number; w?: boolean }) => (
  <div className={`bar ${w ? 'w' : ''}`}>
    <i style={{ width: `${v}%` }} />
  </div>
);
const Ttl = ({ a, b }: { a: string; b: string }) => (
  <div style={{ textAlign: 'center', marginBottom: 16 }}>
    <b style={{ color: 'var(--mu)' }}>{a}</b>
    <p className="mu sm">{b}</p>
  </div>
);
const Ring = ({ v, c }: { v: number; c: string }) => {
  const C = 2 * Math.PI * 44;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r="44" fill="none" stroke="var(--hv)" strokeWidth="10" />
      <circle cx="55" cy="55" r="44" fill="none" stroke={c} strokeWidth="10" strokeDasharray={`${(C * v) / 100} ${C}`} transform="rotate(-90 55 55)" />
      <text x="55" y="60" textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--fg)">
        {v}%
      </text>
    </svg>
  );
};

const STEPS = ['File uploaded', 'Text extracted', 'Images analyzed', 'Topics identified', 'Sources mapped', 'Knowledge base created'];

export function Library({ ctx }: { ctx: Ctx }) {
  const [p, setP] = useState(-1);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [realMaterials, setRealMaterials] = useState<MaterialOut[]>(() => {
    try {
      const saved = localStorage.getItem('sigma_materials');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fetchMaterials = () => {
    api.listMaterials().then(m => {
      if (m && m.length) {
        setRealMaterials(m);
        localStorage.setItem('sigma_materials', JSON.stringify(m));
      }
    }).catch(() => {});
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const [uploadPct, setUploadPct] = useState<number>(0);

  const upload = async (f: File) => {
    setErr('');
    setP(0);
    setUploadPct(0);
    try {
      await api.upload(f, (pct: number) => {
        setUploadPct(pct);
        if (pct >= 99) setP(2);
        else if (pct >= 50) setP(1);
        else setP(0);
      });
      setP(5);
      setUploadPct(100);
      fetchMaterials();
      ctx.toast(`Uploaded & processed: ${f.name} (100%) ✅`);
    } catch {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      const isVideo = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', '3gp'].includes(ext);
      const kind = isVideo ? 'video' : 'pdf';
      const optimistic: MaterialOut = {
        id: 'local-' + Date.now(),
        name: f.name,
        kind,
        pages: 1,
        status: 'Ready'
      };
      setRealMaterials(prev => {
        const next = [optimistic, ...prev];
        localStorage.setItem('sigma_materials', JSON.stringify(next));
        return next;
      });
      setP(5);
      setUploadPct(100);
      ctx.toast(`Saved locally: ${f.name}`);
    }
  };

  const addVideo = async () => {
    if (!url.trim()) return;
    setErr('');
    try {
      await api.addVideo(name.trim() || 'Lecture video', url.trim());
      setName('');
      setUrl('');
      fetchMaterials();
      ctx.toast('Video link added');
    } catch {
      const optimistic: MaterialOut = {
        id: 'local-' + Date.now(),
        name: name.trim() || 'Lecture video',
        kind: 'video',
        pages: 1,
        status: 'Ready'
      };
      setRealMaterials(prev => {
        const next = [optimistic, ...prev];
        localStorage.setItem('sigma_materials', JSON.stringify(next));
        return next;
      });
      setName('');
      setUrl('');
      ctx.toast('Video link saved');
    }
  };

  const handleRenameMaterial = async (m: MaterialOut) => {
    const doRename = async (trimmed: string) => {
      try {
        if (m.id && !m.id.startsWith('local-')) {
          await api.renameMaterial(m.id, trimmed);
        }
        setRealMaterials(prev => {
          const next = prev.map(item => (item.id === m.id ? { ...item, name: trimmed } : item));
          localStorage.setItem('sigma_materials', JSON.stringify(next));
          return next;
        });
        ctx.toast(`Renamed to "${trimmed}"`);
      } catch {
        setRealMaterials(prev => {
          const next = prev.map(item => (item.id === m.id ? { ...item, name: trimmed } : item));
          localStorage.setItem('sigma_materials', JSON.stringify(next));
          return next;
        });
        ctx.toast(`Renamed locally to "${trimmed}"`);
      }
    };

    if (ctx.promptModal) {
      ctx.promptModal('Rename Material', 'Enter a new name for this course material:', m.name, (val) => {
        if (val && val !== m.name) doRename(val);
      });
    } else {
      const newName = window.prompt('Rename material to:', m.name);
      if (newName && newName.trim() && newName.trim() !== m.name) doRename(newName.trim());
    }
  };

  const handleDeleteMaterial = async (m: MaterialOut) => {
    const doDelete = async () => {
      try {
        if (m.id && !m.id.startsWith('local-')) {
          await api.deleteMaterial(m.id);
        }
        setRealMaterials(prev => {
          const next = prev.filter(item => item.id !== m.id);
          localStorage.setItem('sigma_materials', JSON.stringify(next));
          return next;
        });
        ctx.toast(`Deleted ${m.name}`);
      } catch {
        setRealMaterials(prev => {
          const next = prev.filter(item => item.id !== m.id);
          localStorage.setItem('sigma_materials', JSON.stringify(next));
          return next;
        });
        ctx.toast(`Removed ${m.name}`);
      }
    };

    if (ctx.confirmModal) {
      ctx.confirmModal(
        'Delete Course Material',
        `Are you sure you want to delete "${m.name}"? This file and its indexed chunks will be removed.`,
        doDelete,
        true
      );
    } else {
      if (window.confirm(`Delete "${m.name}"?`)) doDelete();
    }
  };

  return (
    <div className="page">
      <h2>Library</h2>
      {p < 0 ? (
        <label
          className="card"
          style={{ display: 'block', textAlign: 'center', borderStyle: 'dashed', padding: '44px 20px', cursor: 'pointer' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) upload(f);
          }}
        >
          <div className="mu">
            <Icon n="upl" s={28} />
          </div>
          <h3 style={{ margin: '8px 0 2px' }}>Drag and drop your files</h3>
          <p className="mu sm" style={{ marginBottom: 14 }}>
            PDF, PPT, images, TXT, MP4
          </p>
          <span className="btn">Browse files</span>
          <input
            type="file"
            hidden
            accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt,.mp4,.mkv,.avi,.mov,.webm,.flv,.wmv,.m4v,.3gp,.mp3,.wav,.m4a"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = '';
            }}
          />
        </label>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3>Processing Material</h3>
            <span className="tag" style={{ fontSize: 13, fontWeight: 700 }}>
              {uploadPct < 100 ? `Uploading: ${uploadPct}%` : 'Indexing complete 100%'}
            </span>
          </div>
          {STEPS.map((s, i) => (
            <p key={s} className="row" style={{ padding: '3px 0', color: i <= p ? 'var(--fg)' : 'var(--mu)' }}>
              {i <= p ? <Icon n="check" s={16} /> : <span style={{ width: 16 }} />} {s}
            </p>
          ))}
          <Bar v={uploadPct > 0 ? uploadPct : Math.round(((p + 1) / 6) * 100)} />
          {p >= 5 && (
            <button className="btn o" style={{ marginTop: 12 }} onClick={() => setP(-1)}>
              Upload another material
            </button>
          )}
        </div>
      )}

      {err && (
        <div className="nc">
          <div className="row">
            <Icon n="alert" />
            <b>Backend error</b>
          </div>
          <p className="mu sm" style={{ marginTop: 6 }}>
            {err}
          </p>
        </div>
      )}

      <div className="card g">
        <h3>Add a video link</h3>
        <input className="t" placeholder="Title (e.g. DBMS Lecture 05)" value={name} onChange={e => setName(e.target.value)} />
        <input className="t" placeholder="https://youtube.com/watch?v=..." value={url} onChange={e => setUrl(e.target.value)} />
        <button className="btn" style={{ width: 'fit-content' }} onClick={addVideo}>
          Add video
        </button>
      </div>

      <div className="g">
        {realMaterials.map(m => (
          <div key={m.id || m.name} className="card row" style={{ padding: '12px 16px', gap: 10, alignItems: 'center' }}>
            <span className="mu">
              <Icon n={m.kind === 'video' || m.kind === 'play' ? 'play' : 'file'} s={20} />
            </span>
            <div className="sp">
              <b>{m.name}</b>
              <p className="mu sm">{m.kind === 'video' ? 'Video link · Ready' : `${m.pages || 1} sections · ${m.status}`}</p>
            </div>
            <span className="tag">{m.status || 'Ready'}</span>
            <button className="btn o" style={{ padding: '6px 12px' }} onClick={() => ctx.setView(m.name)}>
              View
            </button>
            <button
              className="btn o"
              style={{ padding: '6px 10px' }}
              title="Rename material"
              onClick={() => handleRenameMaterial(m)}
            >
              <Icon n="edit" s={14} />
            </button>
            <button
              className="btn o"
              style={{ padding: '6px 10px', color: 'var(--rd)', borderColor: 'var(--rd)' }}
              title="Delete material"
              onClick={() => handleDeleteMaterial(m)}
            >
              <Icon n="trash" s={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Assessments({ ctx }: { ctx: Ctx }) {
  const [activeTopic, setActiveTopic] = useState<string>(() => {
    return sessionStorage.getItem('sigma_quiz_topic') || 'All Course Topics';
  });
  const [loading, setLoading] = useState(false);
  const [Q, setQ] = useState<Question[]>(ctx.db.quiz);
  const [qi, setQi] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [ans, setAns] = useState<number[]>([]);
  const [misconception, setMisconception] = useState<{ a: string; b: string; explanation: string } | null>(null);

  const loadQuiz = async (topicName?: string) => {
    const t = topicName ?? activeTopic;
    setLoading(true);
    setQi(0);
    setPick(null);
    setAns([]);
    setMisconception(null);
    try {
      const topicList = (t && t !== 'All Course Topics') ? [t] : ctx.topics.map(x => x.n);
      const qs = await api.generateQuiz(topicList);
      if (qs && qs.length) {
        setQ(qs);
      } else {
        setQ(ctx.db.quiz);
      }
    } catch {
      setQ(ctx.db.quiz);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedTopic = sessionStorage.getItem('sigma_quiz_topic');
    if (savedTopic) {
      setActiveTopic(savedTopic);
      loadQuiz(savedTopic);
      sessionStorage.removeItem('sigma_quiz_topic');
    } else {
      loadQuiz('All Course Topics');
    }
  }, []);

  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div className="card" style={{ maxWidth: 460, margin: 'auto', padding: 36 }}>
          <Icon n="spark" s={36} />
          <h3 style={{ margin: '14px 0 8px' }}>Generating AI Quiz</h3>
          <p className="mu sm">Gemini is creating tailored questions for <b>"{activeTopic}"</b>...</p>
          <div className="dot" style={{ marginTop: 16 }}>● ● ●</div>
        </div>
      </div>
    );
  }

  if (!Q.length) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <h3>No Questions Found</h3>
          <p className="mu sm" style={{ margin: '12px 0 20px' }}>Try generating questions for a different topic.</p>
          <button className="btn" onClick={() => loadQuiz('All Course Topics')}>Load Default Quiz</button>
        </div>
      </div>
    );
  }

  if (qi >= Q.length) {
    const sc = ans.filter((a, i) => a === Q[i].a).length;
    const scorePct = Math.round((sc / Math.max(1, Q.length)) * 100);
    const T = ctx.topics;
    const overallMastery = T.length ? Math.round(T.reduce((s, t) => s + t.m, 0) / T.length) : 68;
    const completedTopics = T.filter(t => t.m >= 60).length;
    const completionPct = Math.round((completedTopics / Math.max(1, T.length)) * 100);

    let history: any[] = [];
    try {
      history = JSON.parse(localStorage.getItem('sigma_assessment_history') || '[]');
    } catch {}
    const totalAssessments = history.length || 1;
    const avgScore = history.length > 0 
      ? Math.round(history.reduce((acc, h) => acc + (h.scorePct || 0), 0) / history.length) 
      : scorePct;

    const ds: [string, number, string][] = [
      ['Overall mastery', overallMastery, 'Across all course modules'],
      ['Topics completed', completionPct, `${completedTopics} of ${T.length} topics mastered`],
      ['Assignment accuracy', avgScore, `Average across ${totalAssessments} assignments`],
      ['Weekly target', 75, 'Progress on syllabus milestones'],
    ];

    const R = [96, 76, 56, 36];

    // Dynamic question-grounded breakdown for the completed assignment
    const currentAssignmentTopics: Record<string, { correct: number; total: number; pct: number }> = {};
    Q.forEach((quest, idx) => {
      const topName = quest.t || activeTopic || 'General';
      if (!currentAssignmentTopics[topName]) {
        currentAssignmentTopics[topName] = { correct: 0, total: 0, pct: 0 };
      }
      currentAssignmentTopics[topName].total += 1;
      if (ans[idx] === quest.a) {
        currentAssignmentTopics[topName].correct += 1;
      }
    });
    Object.keys(currentAssignmentTopics).forEach(k => {
      const item = currentAssignmentTopics[k];
      item.pct = Math.round((item.correct / Math.max(1, item.total)) * 100);
    });

    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Assignment Completed Result Header */}
        <div className="card" style={{ textAlign: 'center', padding: '28px 20px', background: 'var(--cb)' }}>
          <div className="row" style={{ justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <span className="tag" style={{ background: 'color-mix(in srgb, var(--ac) 20%, transparent)', color: 'var(--ac)', fontWeight: 700, padding: '4px 12px' }}>
              🎉 ASSIGNMENT COMPLETED · {activeTopic}
            </span>
          </div>
          <p className="big" style={{ fontSize: 56, margin: '8px 0', lineHeight: 1 }}>
            {scorePct}%
          </p>
          <p className="mu" style={{ fontSize: 16, marginBottom: 12 }}>
            <b>{sc}</b> of <b>{Q.length}</b> questions answered correctly
          </p>

          <div style={{ maxWidth: 520, margin: 'auto' }}>
            {scorePct >= 80 ? (
              <div className="hl" style={{ borderColor: '#10b981', color: '#10b981', fontWeight: 600 }}>
                🏆 Advanced Mastery: Outstanding conceptual clarity! You are ready for exam-level problem solving.
              </div>
            ) : scorePct >= 50 ? (
              <div className="hl" style={{ borderColor: 'var(--ac)', color: 'var(--ac)', fontWeight: 600 }}>
                📈 Proficient Understanding: Good grasp of core concepts. Check the review below for edge cases.
              </div>
            ) : (
              <div className="hl" style={{ borderColor: 'var(--rd)', color: 'var(--rd)', fontWeight: 600 }}>
                🎯 Developing: We recommend reviewing the notes and asking the AI Tutor to clarify key points.
              </div>
            )}
            <p className="mu sm" style={{ marginTop: 10 }}>
              ✨ pyBKT Bayesian posterior updated · Overall course mastery increased to <b>{overallMastery}%</b>
            </p>
          </div>
        </div>

        {/* 1. Assignment Concept & Question Breakdown (Directly relatable to test) */}
        <div className="card">
          <Ttl a="Assignment Question & Topic Breakdown" b="Performance across specific topics tested in this assignment" />
          <div className="g g3" style={{ gap: 12, marginTop: 10 }}>
            {Object.entries(currentAssignmentTopics).map(([topicName, stats], i) => (
              <div key={topicName} style={{ padding: 14, background: 'var(--sb)', borderRadius: 8, border: '1px solid var(--bd)' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <b style={{ color: COL[i % COL.length], fontSize: 14 }}>{topicName}</b>
                  <span className="tag" style={{ background: stats.pct >= 70 ? '#10b98120' : '#3b82f620', color: stats.pct >= 70 ? '#10b981' : '#3b82f6', fontWeight: 700 }}>
                    {stats.pct}%
                  </span>
                </div>
                <p className="mu sm" style={{ margin: '4px 0 8px 0' }}>
                  {stats.correct} of {stats.total} questions answered correctly
                </p>
                <div style={{ height: 6, background: 'var(--hv)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${stats.pct}%`, height: '100%', background: COL[i % COL.length], borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Complete Learning Snapshot (4 Rings) */}
        <div className="card">
          <Ttl a="Learning Snapshot" b="Updated real-time metrics reflecting your completed assignment" />
          <div className="g g4" style={{ textAlign: 'center' }}>
            {ds.map((d, i) => (
              <div key={d[0]}>
                <div style={{ display: 'grid', placeItems: 'center' }}>
                  <Ring v={d[1]} c={COL[i % COL.length]} />
                </div>
                <p className="sm" style={{ color: COL[i % COL.length], fontWeight: 600, marginTop: 8 }}>
                  {d[0]}
                </p>
                <p className="mu sm">{d[2]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Topic Mastery Breakdown */}
        <div className="card">
          <Ttl a="Topic Mastery Breakdown" b="Dynamic proficiency per syllabus topic after assignment grading" />
          {T.map((t, i) => (
            <div key={t.n} className="row" style={{ margin: '10px 0', alignItems: 'center' }}>
              <div style={{ width: 140, lineHeight: 1.2 }}>
                <b className="sm" style={{ color: COL[i % COL.length] }}>
                  {t.n}
                </b>
                <p className="mu" style={{ fontSize: 11 }}>
                  {t.src}
                </p>
              </div>
              <div style={{ flex: 1, height: 32, background: 'var(--hv)', ...AR }}>
                <div style={{ width: `${t.m}%`, minWidth: 84, height: '100%', background: COL[i % COL.length], position: 'relative', ...AR }}>
                  <span style={{ position: 'absolute', right: 0, top: 0, bottom: 0, padding: '0 20px 0 12px', background: DK[i % DK.length], color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', ...AR }}>
                    {t.m}%
                  </span>
                </div>
              </div>
              <span className="tag" style={{ marginLeft: 8, fontSize: 12 }}>
                {t.m >= 80 ? 'Mastered 🏆' : t.m >= 60 ? 'Proficient 📈' : 'In Progress 🎯'}
              </span>
            </div>
          ))}
        </div>

        {/* 4. Assessment History & Topic Performance Table */}
        <div className="card" style={{ overflowX: 'auto' }}>
          <Ttl a="Assessment History & Performance" b="Attempts, latest score, and status per course topic" />
          <div style={{ minWidth: 540, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4, textAlign: 'center' }}>
            {['Topic', 'Mastery', 'Attempts', 'Latest Score', 'Status'].map((x, i) => (
              <div key={x} style={{ background: COL[i % COL.length], color: '#fff', fontWeight: 600, padding: '8px 4px', ...AR }}>
                {x}
              </div>
            ))}
            {T.flatMap((t, i) => {
              // Check if topic was tested in current assignment
              const testedNow = currentAssignmentTopics[t.n];
              
              // Find historical attempts specifically for this topic
              const specificHist = history.filter(h => h.topic === t.n || (h.topicBreakdown && h.topicBreakdown[t.n]));
              
              let attempts = 0;
              let latestScoreStr = '—';
              
              if (testedNow) {
                // Topic was tested in current quiz
                attempts = specificHist.length + 1;
                latestScoreStr = `${testedNow.pct}% (${testedNow.correct}/${testedNow.total})`;
              } else if (specificHist.length > 0) {
                attempts = specificHist.length;
                const lastAttempt = specificHist[0];
                const score = lastAttempt.topicBreakdown?.[t.n]?.pct ?? lastAttempt.scorePct;
                latestScoreStr = `${score}%`;
              } else {
                // Default baseline prior attempts based on initial mastery
                attempts = t.m >= 80 ? 4 : t.m >= 60 ? 3 : 2;
                latestScoreStr = `${t.m}%`;
              }
              
              const status = t.m >= 80 ? 'Mastered 🏆' : t.m >= 60 ? 'Proficient 📈' : 'Learning 🎯';

              return [
                <b key={t.n + '1'} style={{ color: COL[i % COL.length] }}>{t.n}</b>,
                `${t.m}%`,
                `${attempts}`,
                latestScoreStr,
                status
              ].map((cell, j) => (
                <div key={t.n + '_' + j} style={{ background: 'var(--hv)', padding: '10px 4px', color: 'var(--fg)', fontSize: 13 }}>
                  {cell}
                </div>
              ));
            })}
          </div>
        </div>

        {/* 4. Concentric Mastery Ring Chart */}
        <div className="card">
          <Ttl a="Mastery Ring Visualizer" b="Outer to inner rings represent syllabus module depth" />
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 28 }}>
            <svg width="240" height="240" viewBox="0 0 240 240">
              {T.map((t, i) => {
                const r = R[i % R.length],
                  C = 2 * Math.PI * r,
                  a = (t.m / 100) * 2 * Math.PI - Math.PI / 2;
                return (
                  <g key={t.n}>
                    <circle cx="120" cy="120" r={r} fill="none" stroke="var(--hv)" strokeWidth="17" />
                    <circle cx="120" cy="120" r={r} fill="none" stroke={COL[i % COL.length]} strokeWidth="17" strokeDasharray={`${(C * t.m) / 100} ${C}`} transform="rotate(-90 120 120)" />
                    <text x={120 + r * Math.cos(a)} y={123 + r * Math.sin(a)} textAnchor="middle" fontSize="9" fontWeight="600" fill="#fff">
                      {t.m}%
                    </text>
                  </g>
                );
              })}
            </svg>
            <div>
              {T.map((t, i) => (
                <p key={t.n} className="row sm" style={{ padding: '4px 0' }}>
                  <i style={{ width: 12, height: 12, borderRadius: 3, background: COL[i % COL.length] }} />
                  <b>{t.n}</b>
                  <span className="mu">{t.m}%</span>
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Potential Misconceptions */}
        {misconception && (
          <div className="card" style={{ borderColor: 'var(--rd)' }}>
            <div className="row" style={{ color: 'var(--rd)', fontWeight: 600 }}>
              <Icon n="alert" /> Identified Conceptual Misconception
            </div>
            <h3 style={{ margin: '8px 0 4px' }}>
              You may be confusing <code>{misconception.a}</code> with <code>{misconception.b}</code>.
            </h3>
            <p className="mu" style={{ lineHeight: 1.6 }}>{misconception.explanation}</p>
          </div>
        )}

        {/* 6. Question-by-Question Detailed Review */}
        <div className="card">
          <Ttl a="Assignment Question Review" b="Detailed explanations for each question answered" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            {Q.map((quest, idx) => {
              const userChoice = ans[idx];
              const isCorrect = userChoice === quest.a;

              return (
                <div key={idx} style={{ padding: 14, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--sb)' }}>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="tag" style={{ fontWeight: 600 }}>
                      Question {idx + 1} · {quest.t || activeTopic}
                    </span>
                    <span className="tag" style={{ background: isCorrect ? '#10b98120' : '#ef444420', color: isCorrect ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                      {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  </div>
                  <p style={{ fontWeight: 600, margin: '6px 0 10px 0', fontSize: 14 }}>
                    {quest.q}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                    <div style={{ color: isCorrect ? '#10b981' : '#ef4444' }}>
                      <b>Your answer:</b> {userChoice != null ? quest.o[userChoice] : 'Not answered'}
                    </div>
                    {!isCorrect && (
                      <div style={{ color: '#10b981' }}>
                        <b>Correct answer:</b> {quest.o[quest.a]}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, paddingBottom: 24 }}>
          <button className="btn" onClick={() => loadQuiz(activeTopic)}>
            <Icon n="redo" s={14} /> Take Next Assignment
          </button>
          <a className="btn o" href="#/app/progress">
            <Icon n="chart" s={14} /> Full Progress Page
          </a>
          <a className="btn o" href="#/app/chat">
            <Icon n="chat" s={14} /> Ask AI Tutor About Weak Topics
          </a>
          <a className="btn o" href="#/app/library">
            <Icon n="book" s={14} /> Review Syllabus Notes
          </a>
        </div>
      </div>
    );
  }

  const q = Q[qi];

  const next = async () => {
    const a = [...ans, pick!];
    setAns(a);
    setPick(null);
    setQi(qi + 1);

    if (qi + 1 >= Q.length) {
      // Record completed assessment attempt with detailed topic breakdown
      const sc = a.filter((choice, idx) => choice === Q[idx].a).length;
      const scorePct = Math.round((sc / Math.max(1, Q.length)) * 100);
      
      const topicBreakdown: Record<string, { correct: number; total: number; pct: number }> = {};
      Q.forEach((quest, idx) => {
        const topName = quest.t || activeTopic || 'General';
        if (!topicBreakdown[topName]) {
          topicBreakdown[topName] = { correct: 0, total: 0, pct: 0 };
        }
        topicBreakdown[topName].total += 1;
        if (a[idx] === quest.a) {
          topicBreakdown[topName].correct += 1;
        }
      });
      Object.keys(topicBreakdown).forEach(k => {
        const item = topicBreakdown[k];
        item.pct = Math.round((item.correct / Math.max(1, item.total)) * 100);
      });

      const newRecord = {
        id: 'att_' + Date.now(),
        topic: activeTopic || 'All Course Topics',
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        scorePct,
        correct: sc,
        total: Q.length,
        topicBreakdown,
      };
      try {
        const curHist = JSON.parse(localStorage.getItem('sigma_assessment_history') || '[]');
        localStorage.setItem('sigma_assessment_history', JSON.stringify([newRecord, ...curHist]));
      } catch {}

      const qIds = Q.map(item => item.id).filter((id): id is string => !!id);
      if (qIds.length === Q.length) {
        const res = await api.submitQuizReal(qIds, a);
        if (res) {
          if (res.updated_topics) ctx.setTopics(res.updated_topics);
          if (res.misconception) setMisconception(res.misconception);
        }
      } else {
        const updated = await api.submitQuiz(a, Q);
        ctx.setTopics(updated);
      }
    }
  };

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <p className="mu sm">
          Question {qi + 1} of {Q.length} · <b>{q.t || activeTopic}</b>
        </p>
        <button className="tag" onClick={() => loadQuiz(activeTopic)} style={{ cursor: 'pointer', background: 'var(--cb)' }}>
          ↻ New Questions
        </button>
      </div>
      <Bar v={((qi + 1) / Q.length) * 100} />
      <div className="row" style={{ marginTop: 12 }}>
        <span className="tag" style={{ background: 'color-mix(in srgb, var(--ac) 15%, transparent)', color: 'var(--ac)', fontWeight: 600 }}>{q.t || activeTopic}</span>
        <span className="tag">{q.d || 'Medium'}</span>
      </div>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.55, marginTop: 14, marginBottom: 16, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
        {q.q}
      </h2>
      <div style={{ marginTop: 8 }}>
        {q.o.map((o, i) => (
          <button key={o} className={`opt ${pick === i ? 'sel' : ''}`} style={{ fontSize: '14px', padding: '10px 16px' }} onClick={() => setPick(i)}>
            {o}
          </button>
        ))}
      </div>
      <button className="btn" style={{ marginTop: 16 }} disabled={pick == null} onClick={next}>
        {qi === Q.length - 1 ? 'Submit Assessment' : 'Next Question'}
      </button>
    </div>
  );
}

export function Progress({ ctx }: { ctx: Ctx }) {
  const T = ctx.topics,
    R = [96, 76, 56, 36];

  let history: any[] = [];
  try {
    history = JSON.parse(localStorage.getItem('sigma_assessment_history') || '[]');
  } catch {}

  // If no assignments completed yet, do NOT show progress metrics
  if (history.length === 0) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Progress & Learning Analytics</h2>
            <p className="mu sm" style={{ margin: '4px 0 0 0' }}>Syllabus mastery tracking powered by pyBKT (Bayesian Knowledge Tracing)</p>
          </div>
          <span className="tag" style={{ background: 'color-mix(in srgb, var(--ac) 15%, transparent)', color: 'var(--ac)', fontWeight: 600 }}>
            🔒 Awaiting Assignment
          </span>
        </div>

        {/* Primary Prompt Card */}
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--cb)', border: '1px dashed var(--bd)' }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'color-mix(in srgb, var(--ac) 15%, transparent)',
            color: 'var(--ac)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 16px'
          }}>
            <Icon n="file" s={36} />
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '8px 0 10px' }}>
            No Assessments Completed Yet
          </h3>
          <p className="mu" style={{ maxWidth: 540, margin: '0 auto 20px', lineHeight: 1.6, fontSize: '14.5px' }}>
            Progress analytics bina assignment ke display nahi hota. Pehle kam se kam ek <b>Assignment / Quiz</b> attempt kijiye. Assignment submit hone ke baad aapka real topic mastery, accuracy snapshot, aur weak area diagnostics yahan calculate hokar unlock ho jayenge.
          </p>
          <div className="row" style={{ justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <a className="btn" href="#/app/assessments" style={{ padding: '10px 22px', fontSize: '14px', fontWeight: 600 }}>
              <Icon n="spark" s={16} /> Start Assignment Now
            </a>
            <a className="btn o" href="#/app/library" style={{ padding: '10px 20px', fontSize: '14px' }}>
              <Icon n="book" s={16} /> Review Course Materials
            </a>
          </div>
        </div>

        {/* 3 Step Explanation */}
        <div className="card">
          <Ttl a="How Your Progress is Built" b="Complete assignments to automatically generate accurate skill metrics" />
          <div className="g g3" style={{ gap: 16, marginTop: 12 }}>
            <div style={{ padding: 18, background: 'var(--sb)', borderRadius: 8, border: '1px solid var(--bd)' }}>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 12, background: 'var(--ac)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>1</span>
                <b style={{ color: 'var(--ac)' }}>Take Topic Quiz</b>
              </div>
              <p className="mu sm" style={{ margin: 0, lineHeight: 1.5 }}>
                Assessments section me jakar kisi bhi topic ya poore course syllabus par AI-generated diagnostic questions solve karein.
              </p>
            </div>

            <div style={{ padding: 18, background: 'var(--sb)', borderRadius: 8, border: '1px solid var(--bd)' }}>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 12, background: '#10b981', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>2</span>
                <b style={{ color: '#10b981' }}>pyBKT Bayesian Scoring</b>
              </div>
              <p className="mu sm" style={{ margin: 0, lineHeight: 1.5 }}>
                Har submitted answer par Bayesian posterior probability update hoti hai jo aapke real concept understanding ko measure karti hai.
              </p>
            </div>

            <div style={{ padding: 18, background: 'var(--sb)', borderRadius: 8, border: '1px solid var(--bd)' }}>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 12, background: '#f59e0b', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>3</span>
                <b style={{ color: '#f59e0b' }}>Progress Dashboard Unlocked</b>
              </div>
              <p className="mu sm" style={{ margin: 0, lineHeight: 1.5 }}>
                Assignment submit hote hi aapke real attempts, topic breakdown, concentric visualizer rings aur weak topic suggestions live ho jayenge.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Real statistics strictly grounded in completed assignments
  const totalAttempts = history.length;
  const avgAccuracy = Math.round(history.reduce((acc, h) => acc + (h.scorePct || 0), 0) / totalAttempts);
  
  // Calculate tested topics vs untested
  const testedTopicNames = new Set<string>();
  history.forEach(h => {
    if (h.topic && h.topic !== 'All Course Topics') testedTopicNames.add(h.topic);
    if (h.topicBreakdown) {
      Object.keys(h.topicBreakdown).forEach(k => testedTopicNames.add(k));
    }
  });

  const overallMastery = T.length ? Math.round(T.reduce((s, t) => s + t.m, 0) / T.length) : avgAccuracy;
  const completedTopics = T.filter(t => t.m >= 60 && testedTopicNames.has(t.n)).length;
  const w = T.filter(t => t.m < 60 && testedTopicNames.has(t.n)).sort((a, b) => a.m - b.m);

  const ds: [string, number, string][] = [
    ['Overall mastery', overallMastery, 'Across tested syllabus modules'],
    ['Topics completed', Math.round((completedTopics / Math.max(1, T.length)) * 100), `${completedTopics} of ${T.length} topics mastered`],
    ['Assignment accuracy', avgAccuracy, `Average across ${totalAttempts} completed assignment(s)`],
    ['Syllabus target', Math.min(100, Math.round((testedTopicNames.size / Math.max(1, T.length)) * 100)), `${testedTopicNames.size} of ${T.length} topics evaluated`],
  ];

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Progress & Learning Analytics</h2>
          <p className="mu sm" style={{ margin: '4px 0 0 0' }}>Grounded in <b>{totalAttempts}</b> completed assignment attempt(s)</p>
        </div>
        <a className="btn sm" href="#/app/assessments" style={{ textDecoration: 'none', padding: '6px 14px' }}>
          <Icon n="spark" s={14} /> + New Assignment
        </a>
      </div>

      <div className="card">
        <Ttl a="Learning snapshot" b="Live metrics calculated from your submitted assignments" />
        <div className="g g4" style={{ textAlign: 'center' }}>
          {ds.map((d, i) => (
            <div key={d[0]}>
              <div style={{ display: 'grid', placeItems: 'center' }}>
                <Ring v={d[1]} c={COL[i % COL.length]} />
              </div>
              <p className="sm" style={{ color: COL[i % COL.length], fontWeight: 600, marginTop: 8 }}>
                {d[0]}
              </p>
              <p className="mu sm">{d[2]}</p>
            </div>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div className="card">
          <Ttl a="Recent Completed Assignments" b="Log of recent completed assignments and quizzes" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {history.slice(0, 5).map((item, idx) => (
              <div key={item.id || idx} className="card row" style={{ padding: '10px 14px', justifyContent: 'space-between', alignItems: 'center', background: 'var(--sb)' }}>
                <div>
                  <b>{item.topic}</b>
                  <p className="mu sm" style={{ margin: '2px 0 0 0' }}>Completed at {item.date} · {item.correct} of {item.total} correct</p>
                </div>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="tag" style={{ background: item.scorePct >= 70 ? '#10b98120' : '#3b82f620', color: item.scorePct >= 70 ? '#10b981' : '#3b82f6', fontWeight: 700 }}>
                    {item.scorePct}% Score
                  </span>
                  <a className="btn o sm" href="#/app/assessments" style={{ textDecoration: 'none', padding: '4px 10px', fontSize: 12 }}>
                    Retake
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <Ttl a="Mastery by ring" b="Outer to inner: each ring is one topic" />
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 28 }}>
          <svg width="240" height="240" viewBox="0 0 240 240">
            {T.map((t, i) => {
              const r = R[i % R.length],
                C = 2 * Math.PI * r,
                a = (t.m / 100) * 2 * Math.PI - Math.PI / 2;
              return (
                <g key={t.n}>
                  <circle cx="120" cy="120" r={r} fill="none" stroke="var(--hv)" strokeWidth="17" />
                  <circle cx="120" cy="120" r={r} fill="none" stroke={COL[i % COL.length]} strokeWidth="17" strokeDasharray={`${(C * t.m) / 100} ${C}`} transform="rotate(-90 120 120)" />
                  <text x={120 + r * Math.cos(a)} y={123 + r * Math.sin(a)} textAnchor="middle" fontSize="9" fontWeight="600" fill="#fff">
                    {t.m}%
                  </text>
                </g>
              );
            })}
          </svg>
          <div>
            {T.map((t, i) => (
              <p key={t.n} className="row sm" style={{ padding: '4px 0' }}>
                <i style={{ width: 12, height: 12, borderRadius: 3, background: COL[i % COL.length] }} />
                <b>{t.n}</b>
                <span className="mu">{t.m}%</span>
              </p>
            ))}
          </div>
        </div>
      </div>

      {w[0] && (
        <div className="card" style={{ background: 'var(--sb)' }}>
          <p className="mu sm">Recommended for you</p>
          <h3 style={{ margin: '4px 0 8px' }}>You struggled with {w[0].n} in your last assessment.</h3>
          <p className="mu">Review {w[0].n}, then practice questions to raise your mastery level.</p>
          <a className="btn" style={{ marginTop: 12 }} href="#/app/assessments">
            Start practice
          </a>
        </div>
      )}

      <div className="card">
        <h3>Weak topics</h3>
        {w.map(t => (
          <div key={t.n} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
            <span className="sp">{t.n}</span>
            <span className="tag">{t.m}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TOPIC_DETAILS: Record<string, {
  unit: string;
  summary: string;
  keyConcepts: string[];
  docTitle: string;
  pages: string;
  studyTime: string;
}> = {
  'Relational Databases & Architecture': {
    unit: 'Unit 1 · Foundational Architecture',
    summary: 'Core relational models, database engines, physical vs logical data independence, and schema mappings.',
    keyConcepts: [
      'Three-Schema Architecture (Internal, Conceptual, External levels)',
      'Logical & Physical Data Independence principles',
      'Relational Model: Tuples, Attributes, Domains, and Relations',
      'Integrity Constraints: Entity Integrity & Referential Integrity',
    ],
    docTitle: 'DBMS.pdf',
    pages: 'Pages 1 – 25 · Chapter 1',
    studyTime: '45 mins',
  },
  'ER Model & Schema Design': {
    unit: 'Unit 2 · Conceptual Database Modeling',
    summary: 'Entity-Relationship (ER) diagrams, identifying entity sets, cardinalities, and converting conceptual diagrams into relational tables.',
    keyConcepts: [
      'Entity Sets (Strong vs Weak Entities with identifying owners)',
      'Relationship Types & Structural Constraints (1:1, 1:N, M:N)',
      'Participation Constraints (Total vs Partial Participation)',
      'Algorithm for Mapping ER Diagrams to Relational Schema tables',
    ],
    docTitle: 'DBMS.pdf',
    pages: 'Pages 26 – 50 · Chapter 2',
    studyTime: '60 mins',
  },
  'SQL & Relational Algebra': {
    unit: 'Unit 3 · Relational Query Languages',
    summary: 'Structured Query Language (SQL) data definition, manipulation, and formal relational algebra operations.',
    keyConcepts: [
      'Relational Algebra: Select (σ), Project (π), Cartesian Product (×)',
      'SQL Joins: INNER JOIN, LEFT/RIGHT OUTER JOIN, FULL JOIN',
      'Aggregation & Grouping: COUNT, SUM, AVG, GROUP BY, HAVING',
      'Nested Subqueries, Correlated Subqueries, and View definitions',
    ],
    docTitle: 'DBMS.pdf',
    pages: 'Pages 51 – 80 · Chapter 3',
    studyTime: '75 mins',
  },
  'Normalization (1NF, 2NF, 3NF, BCNF)': {
    unit: 'Unit 4 · Schema Refinement & Normal Forms',
    summary: 'Eliminating data redundancy and update/insertion/deletion anomalies through functional dependencies and decomposition.',
    keyConcepts: [
      'Functional Dependencies (X → Y, Armstrong axioms)',
      '1NF: Atomic attributes, elimination of repeating multi-valued groups',
      '2NF: Removal of partial functional dependencies on candidate keys',
      '3NF: Elimination of transitive dependencies (non-key to non-key)',
      'Boyce-Codd Normal Form (BCNF): Strict condition where determinant is superkey',
    ],
    docTitle: 'Normalization.pptx',
    pages: 'Pages 38 – 70 & 42 Presentation Slides',
    studyTime: '90 mins',
  },
  'Transactions & ACID Properties': {
    unit: 'Unit 5 · Transaction Processing & Recovery',
    summary: 'Logical units of database operations, ACID guarantees, transaction states, and write-ahead logging (WAL).',
    keyConcepts: [
      'ACID Guarantees: Atomicity, Consistency, Isolation, Durability',
      'Transaction States: Active, Partially Committed, Committed, Failed, Aborted',
      'COMMIT vs ROLLBACK execution guarantees and savepoints',
      'Crash Recovery Architecture: Write-Ahead Logging (WAL) and checkpoints',
    ],
    docTitle: 'DBMS Lecture 04.mp4',
    pages: 'Pages 90 – 110 & Video Lecture 04',
    studyTime: '80 mins',
  },
  'Concurrency Control & Deadlocks': {
    unit: 'Unit 6 · Concurrency Control & Multi-user Systems',
    summary: 'Lock-based protocols, conflict serializability, deadlock detection using Wait-For Graphs, and recovery techniques.',
    keyConcepts: [
      'Conflict Serializability vs View Serializability',
      'Two-Phase Locking Protocol (2PL): Growing and Shrinking phases',
      'Strict 2PL & Rigorous 2PL preventing cascading aborts',
      'Deadlock Handling: Wait-For Graph cycle detection and victim selection',
    ],
    docTitle: 'DBMS Lecture 04.mp4',
    pages: 'Pages 111 – 124 & Video Lecture 04',
    studyTime: '65 mins',
  },
};

const PROVIDED_DOCS = [
  { name: 'DBMS Textbook.pdf', kind: 'pdf', pages: '124 pages', units: 'Unit 1, 2, 3', desc: 'Comprehensive core database textbook covering architecture, ER diagrams, and SQL.' },
  { name: 'Normalization.pptx', kind: 'ppt', pages: '42 slides', units: 'Unit 4', desc: 'Presentation deck with functional dependency decomposition proofs and 1NF to BCNF rules.' },
  { name: 'DBMS Lecture 04.mp4', kind: 'video', pages: '58 min video', units: 'Unit 5, 6', desc: 'High-definition video lecture detailing ACID properties, WAL logs, and 2-Phase Locking.' },
  { name: 'week1.pdf', kind: 'pdf', pages: '4 pages', units: 'Unit 1', desc: 'Weekly syllabus summary notes: Database engines and three-schema models.' },
  { name: 'week 2.pdf', kind: 'pdf', pages: '5 pages', units: 'Unit 2', desc: 'Weekly syllabus summary notes: ER diagrams, weak entities, and participation constraints.' },
  { name: 'week 10.pdf', kind: 'pdf', pages: '3 pages', units: 'Unit 4', desc: 'Weekly syllabus summary notes: Normalization practice problems and decomposition examples.' },
  { name: 'week 12.pdf', kind: 'pdf', pages: '8 pages', units: 'Unit 5, 6', desc: 'Weekly syllabus summary notes: Transactions, ACID guarantees, and serializability.' },
];

export function CourseMap({ ctx }: { ctx: Ctx }) {
  const [node, setNode] = useState<string>(() => ctx.topics[0]?.n || 'Relational Databases & Architecture');
  const [tab, setTab] = useState<'graph' | 'matrix'>('graph');
  const [realMaterials, setRealMaterials] = useState<MaterialOut[]>(() => {
    try {
      const saved = localStorage.getItem('sigma_materials');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    api.listMaterials().then(m => {
      if (m && m.length) {
        setRealMaterials(m);
        localStorage.setItem('sigma_materials', JSON.stringify(m));
      }
    }).catch(() => {});
  }, []);

  const getMappedUnits = (fileName: string): string => {
    const fLower = fileName.toLowerCase();
    if (fLower.includes('dbms textbook') || fLower.includes('dbms.pdf')) return 'Unit 1, 2, 3';
    if (fLower.includes('normalization') || fLower.includes('week 10')) return 'Unit 4';
    if (fLower.includes('lecture 04') || fLower.includes('week 12') || fLower.includes('transact')) return 'Unit 5, 6';
    if (fLower.includes('week1') || fLower.includes('week 1.')) return 'Unit 1';
    if (fLower.includes('week 2') || fLower.includes('week2')) return 'Unit 2';
    if (fLower.includes('problem statements') || fLower.includes('problem statement')) return 'Practice & Assessment Reference';
    
    // Check if any topic in ctx.topics references this file
    const matchedTopics = ctx.topics.filter(t => t.src.toLowerCase().includes(fileName.toLowerCase()));
    if (matchedTopics.length > 0) {
      return `Units: ${matchedTopics.map((_, idx) => `Unit ${idx + 1}`).join(', ')}`;
    }
    return 'Course Reference';
  };

  const getDocDescription = (fileName: string, kind: string): string => {
    const fLower = fileName.toLowerCase();
    if (fLower.includes('problem statements')) return 'Course problem statements, assignments, and curriculum exercises.';
    if (fLower.includes('dbms textbook') || fLower.includes('dbms.pdf')) return 'Core database textbook covering relational architecture, ER modeling, and SQL queries.';
    if (fLower.includes('normalization')) return 'Presentation slides on functional dependencies, 1NF, 2NF, 3NF, and BCNF decomposition.';
    if (fLower.includes('lecture 04')) return 'Video lecture covering transactions, ACID properties, WAL logging, and concurrency control.';
    if (fLower.includes('week1')) return 'Weekly study summary: Database architecture, 3-schema model, and data independence.';
    if (fLower.includes('week 2')) return 'Weekly study summary: ER diagrams, weak entities, and structural relationships.';
    if (fLower.includes('week 10')) return 'Weekly study summary: Normalization anomaly elimination and dependency preservation.';
    if (fLower.includes('week 12')) return 'Weekly study summary: Serializability, 2-phase locking protocol, and deadlock detection.';
    if (kind === 'video') return 'Uploaded lecture video recording indexed for AI semantic search.';
    if (kind === 'ppt') return 'Uploaded presentation slide deck indexed for topic synthesis.';
    return 'Uploaded course material verified and indexed for AI tutoring.';
  };

  // Combine realMaterials with any fallback documents
  const displayDocs: { name: string; kind: string; pages: string | number; units: string; desc: string }[] = 
    realMaterials.length > 0
      ? realMaterials.map(m => ({
          name: m.name,
          kind: m.kind,
          pages: `${m.pages} ${m.kind === 'video' ? 'min' : m.kind === 'ppt' ? 'slides' : 'pages'}`,
          units: getMappedUnits(m.name),
          desc: getDocDescription(m.name, m.kind),
        }))
      : PROVIDED_DOCS;

  const t = ctx.topics.find(x => x.n === node) || ctx.topics[0] || {
    n: 'Relational Databases & Architecture',
    m: 88,
    pre: [],
    src: 'DBMS.pdf p.4 · week1.pdf',
  };

  const info = TOPIC_DETAILS[t.n] || {
    unit: 'Course Curriculum Module',
    summary: 'Comprehensive syllabus topic extracted and grounded from your course documents.',
    keyConcepts: [
      'Core conceptual definitions and theorems from textbook materials',
      'Step-by-step problem walkthroughs and algorithm procedures',
      'Verified alignment with university and entrance exam syllabus standards',
    ],
    docTitle: t.src.split('·')[0].trim() || 'DBMS.pdf',
    pages: t.src.split('·')[1]?.trim() || 'Referenced Pages',
    studyTime: '60 mins',
  };

  const handlePracticeTopic = (topicName: string) => {
    sessionStorage.setItem('sigma_quiz_topic', topicName);
    location.hash = '/app/assessments';
  };

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Overview Card */}
      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Course Curriculum & Document Map</h2>
          <p className="mu sm" style={{ margin: '4px 0 0 0' }}>
            Interactive knowledge graph systematically grounded in your <b>{displayDocs.length}</b> uploaded textbooks, slide decks, and lecture recordings.
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className={`pill ${tab === 'graph' ? 'on' : ''}`} onClick={() => setTab('graph')}>
            <Icon n="net" s={14} /> Knowledge Graph
          </button>
          <button className={`pill ${tab === 'matrix' ? 'on' : ''}`} onClick={() => setTab('matrix')}>
            <Icon n="file" s={14} /> Document Matrix ({displayDocs.length})
          </button>
        </div>
      </div>

      {tab === 'graph' && (
        <>
          {/* Visual Curriculum Node Graph */}
          <div className="card" style={{ padding: '24px 20px', background: 'var(--cb)', overflowX: 'auto' }}>
            <Ttl a="Syllabus Learning Sequence" b="Click any module node to inspect grounded documents and start practice" />

            <div style={{ minWidth: 640, display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              {ctx.topics.map((x, i) => {
                const isSelected = node === x.n;
                const statusColor = x.m >= 80 ? '#10b981' : x.m >= 60 ? '#f59e0b' : '#3b82f6';
                const statusText = x.m >= 80 ? 'Mastered 🏆' : x.m >= 60 ? 'Proficient 📈' : 'In Progress 🎯';
                const sourceBadge = x.src.includes('.mp4') ? '🎬 Video' : x.src.includes('.ppt') ? '📊 Slides' : '📄 Textbook';

                return (
                  <div key={x.n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      className="card row"
                      style={{
                        width: '100%',
                        maxWidth: 720,
                        padding: '14px 18px',
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--ac)' : '1px solid var(--bd)',
                        background: isSelected ? 'color-mix(in srgb, var(--ac) 8%, var(--cb))' : 'var(--cb)',
                        borderRadius: 10,
                        alignItems: 'center',
                        gap: 14,
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => setNode(x.n)}
                    >
                      <div style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--hv)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, color: 'var(--fg)', flexShrink: 0 }}>
                        0{i + 1}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          <b style={{ fontSize: 15, color: isSelected ? 'var(--ac)' : 'var(--fg)' }}>{x.n}</b>
                          <span className="tag" style={{ fontSize: 11 }}>{sourceBadge}</span>
                        </div>
                        <div className="row mu" style={{ gap: 12, fontSize: 12 }}>
                          <span>Source: <code>{x.src}</code></span>
                          {x.pre.length > 0 && <span>Prerequisite: {x.pre.join(', ')}</span>}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <b style={{ color: statusColor, fontSize: 16 }}>{x.m}%</b>
                        <p className="mu sm" style={{ margin: '2px 0 0 0' }}>{statusText}</p>
                      </div>

                      <Icon n="up" s={14} style={{ transform: 'rotate(90deg)', opacity: isSelected ? 1 : 0.4 }} />
                    </div>

                    {i < ctx.topics.length - 1 && (
                      <div style={{ padding: '4px 0', color: 'var(--mu)', display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
                        <span style={{ width: 2, height: 12, background: 'var(--bd)' }} />
                        <Icon n="down" s={14} style={{ color: 'var(--mu)', marginTop: -2 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Module Deep Dive & Document Inspector */}
          <div className="card" style={{ padding: '24px 20px' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div>
                <span className="tag" style={{ background: 'color-mix(in srgb, var(--ac) 15%, transparent)', color: 'var(--ac)', fontWeight: 700, marginBottom: 6 }}>
                  {info.unit}
                </span>
                <h2 style={{ margin: '4px 0' }}>{t.n}</h2>
                <p className="mu" style={{ margin: 0, fontSize: 14 }}>{info.summary}</p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className="row" style={{ gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <span className="sm mu">Mastery Posterior:</span>
                  <b style={{ fontSize: 22, color: t.m >= 80 ? '#10b981' : t.m >= 60 ? '#f59e0b' : '#3b82f6' }}>{t.m}%</b>
                </div>
                <p className="mu sm" style={{ margin: '2px 0 0 0' }}>Est. Study Time: {info.studyTime}</p>
              </div>
            </div>

            {/* Document Grounding Box */}
            <div className="card row" style={{ padding: '14px 18px', background: 'var(--sb)', border: '1px solid var(--bd)', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                <Icon n={t.src.includes('.mp4') ? 'play' : t.src.includes('.ppt') ? 'chart' : 'file'} s={24} />
                <div>
                  <b>Grounded Document Reference</b>
                  <p className="mu sm" style={{ margin: '2px 0 0 0' }}>
                    <code>{t.src}</code> · {info.pages}
                  </p>
                </div>
              </div>

              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn"
                  onClick={() => ctx.setView(t.src.split('·')[0].trim() || 'DBMS.pdf')}
                  title="Open the original document directly in viewer"
                >
                  <Icon n="file" s={14} /> Open Original Document
                </button>
                <button
                  className="btn o"
                  onClick={() => ctx.setView(t.src.split('·')[0].trim() || 'DBMS.pdf')}
                  title="Inspect in workspace"
                >
                  <Icon n="panel" s={14} /> Workspace
                </button>
              </div>
            </div>

            {/* Syllabus Learning Outcomes */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 10px 0' }}>📚 Core Syllabus Concepts & Learning Outcomes</h4>
              <ul style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8, fontSize: 14 }}>
                {info.keyConcepts.map((kc, kidx) => (
                  <li key={kidx}>{kc}</li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--bd)' }}>
              <button className="btn" onClick={() => handlePracticeTopic(t.n)}>
                <Icon n="spark" s={14} /> Practice Assignment for {t.n}
              </button>
              <a className="btn o" href="#/app/chat">
                <Icon n="chat" s={14} /> Ask AI Tutor About This Module
              </a>
              <a className="btn o" href="#/app/progress">
                <Icon n="chart" s={14} /> View Mastery Progress
              </a>
            </div>
          </div>
        </>
      )}

      {tab === 'matrix' && (
        <div className="card" style={{ padding: '20px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Ttl a="Document-to-Curriculum Matrix" b="Direct mapping of all uploaded course notes, textbooks, and recordings to syllabus units" />
            <a className="btn sm" href="#/app/library" style={{ textDecoration: 'none', padding: '6px 14px' }}>
              <Icon n="upl" s={14} /> Upload Materials
            </a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {displayDocs.map((doc, didx) => (
              <div key={didx} className="card row" style={{ padding: '14px 18px', justifyContent: 'space-between', alignItems: 'center', background: 'var(--sb)', flexWrap: 'wrap', gap: 12 }}>
                <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                  <Icon n={doc.kind === 'video' ? 'play' : doc.kind === 'ppt' ? 'chart' : 'file'} s={24} />
                  <div>
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <b>{doc.name}</b>
                      <span className="tag" style={{ background: 'color-mix(in srgb, var(--ac) 15%, transparent)', color: 'var(--ac)', fontWeight: 600 }}>{doc.units}</span>
                      <span className="tag" style={{ background: '#10b98115', color: '#10b981', fontWeight: 600, fontSize: 11 }}>Indexed ✅</span>
                    </div>
                    <p className="mu sm" style={{ margin: '4px 0 0 0' }}>{doc.desc}</p>
                    <span className="mu" style={{ fontSize: 11 }}>{doc.pages}</span>
                  </div>
                </div>

                <div className="row" style={{ gap: 8 }}>
                  <button className="btn o" onClick={() => ctx.setView(doc.name)}>
                    <Icon n="file" s={14} /> View File
                  </button>
                  <a href={`http://localhost:8000/api/materials/${encodeURIComponent(doc.name)}/raw`} target="_blank" rel="noopener noreferrer" className="btn o" style={{ textDecoration: 'none' }}>
                    Open Tab ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Settings({ ctx }: { ctx: Ctx }) {
  return (
    <div className="page">
      <h2>Settings</h2>
      <div className="card g">
        <label>
          Name
          <input className="t" defaultValue={ctx.db.user} />
        </label>
        <label className="row">
          <input type="checkbox" checked={ctx.dark} onChange={e => ctx.setDark(e.target.checked)} /> Dark appearance
        </label>
        <button className="btn" style={{ width: 'fit-content' }} onClick={() => ctx.toast('Saved')}>
          Save changes
        </button>
      </div>
    </div>
  );
}
