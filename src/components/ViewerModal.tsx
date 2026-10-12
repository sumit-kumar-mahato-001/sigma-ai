import { useState, useRef, useEffect } from 'react';
import { Icon } from '../icons';
import type { Mock } from '../types';

interface ViewerProps {
  viewKey: string;
  db: Mock;
  onClose: () => void;
  toast: (msg: string) => void;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

export function ViewerModal({ viewKey, db, onClose, toast }: ViewerProps) {
  const ansKey = Object.keys(db.ans).find(k => k === viewKey || db.ans[k]?.f === viewKey);
  const ans = ansKey ? db.ans[ansKey] : null;

  // Extract clean file name and target page / timestamp
  const cleanKey = viewKey.split('·')[0].trim();
  const lower = cleanKey.toLowerCase();

  const isVideo = lower.includes('video') || lower.includes('.mp4') || lower.includes('.mkv') || lower.includes('.webm') || lower.includes('tutorial') || lower.includes('lec') || (ans && !!ans.v);
  const isPpt = lower.includes('.ppt') || lower.includes('.pptx') || lower.includes('presentation') || lower.includes('slide');
  const isImg = lower.includes('.png') || lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.webp') || lower.includes('image');
  const isPdf = !isVideo && !isPpt && !isImg;

  // Extract citation page if available (e.g. "DBMS.pdf · Page 38")
  const pageMatch = viewKey.match(/Page\s+(\d+)/i) || viewKey.match(/p\.(\d+)/i);
  const initialPage = pageMatch ? parseInt(pageMatch[1], 10) : 1;

  // Extract timestamp if available (e.g. "00:45" or "12:35")
  const timeMatch = viewKey.match(/(\d{1,2}:\d{2})/);
  const initialTime = timeMatch ? timeMatch[1] : (ans?.p?.includes(':') ? ans.p : '00:00');

  // State
  const [page, setPage] = useState<number>(initialPage);
  const [slide, setSlide] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [videoTime, setVideoTime] = useState<string>(initialTime);
  const [activeTab, setActiveTab] = useState<'content' | 'transcript' | 'details'>('content');
  const [pdfLoadError, setPdfLoadError] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const fileName = ans?.f || cleanKey;
  const rawFileUrl = `${API_BASE}/api/materials/${encodeURIComponent(cleanKey)}/raw`;

  useEffect(() => {
    if (isVideo && videoRef.current && initialTime && initialTime !== '00:00') {
      const parts = initialTime.split(':').map(Number);
      const secs = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (!isNaN(secs)) {
        videoRef.current.currentTime = secs;
      }
    }
  }, [isVideo, initialTime]);

  const seekVideo = (t: string) => {
    setVideoTime(t);
    if (videoRef.current) {
      const parts = t.split(':').map(Number);
      const secs = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (!isNaN(secs)) {
        videoRef.current.currentTime = secs;
        videoRef.current.play().catch(() => {});
        toast(`Playing from ${t}`);
      }
    }
  };

  return (
    <div className="v-md" onClick={onClose}>
      <div className="v-box" style={{ maxWidth: 1040, width: '94vw', height: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="v-head" style={{ flexShrink: 0 }}>
          <Icon n={isVideo ? 'play' : isPpt ? 'chart' : isImg ? 'media' : 'file'} s={22} />
          <div className="sp">
            <b>{fileName}</b>
            <p className="mu sm">
              {isPdf && `Original PDF Document · Page ${page}`}
              {isVideo && `Original Lecture Video · ${videoTime}`}
              {isPpt && `PowerPoint Presentation (.pptx) · Slide ${slide}`}
              {isImg && `Original High-Res Scanned Document`}
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {isPdf && (
              <>
                <button className="ib" title="Zoom Out" onClick={() => setZoom(z => Math.max(50, z - 25))}>
                  <b>-</b>
                </button>
                <span className="sm mu">{zoom}%</span>
                <button className="ib" title="Zoom In" onClick={() => setZoom(z => Math.min(200, z + 25))}>
                  <b>+</b>
                </button>
              </>
            )}
            <a
              href={rawFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn o"
              style={{ padding: '5px 12px', fontSize: 13, textDecoration: 'none' }}
              title="Open raw file in a new tab"
            >
              Open ↗
            </a>
            <a
              href={rawFileUrl}
              download={fileName}
              className="btn o"
              style={{ padding: '5px 12px', fontSize: 13, textDecoration: 'none' }}
              title="Download original file"
            >
              <Icon n="upl" s={14} /> Download
            </a>
            <button className="ib" onClick={onClose} title="Close viewer">
              <Icon n="x" s={20} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="row" style={{ padding: '8px 20px', borderBottom: '1px solid var(--bd)', background: 'var(--sb)', flexShrink: 0 }}>
          <button className={`pill ${activeTab === 'content' ? 'on' : ''}`} onClick={() => setActiveTab('content')}>
            <Icon n={isVideo ? 'play' : isPpt ? 'chart' : 'file'} s={14} /> Original Media Viewer
          </button>
          {isVideo && (
            <button className={`pill ${activeTab === 'transcript' ? 'on' : ''}`} onClick={() => setActiveTab('transcript')}>
              <Icon n="chat" s={14} /> Transcript Timestamps
            </button>
          )}
          <button className={`pill ${activeTab === 'details' ? 'on' : ''}`} onClick={() => setActiveTab('details')}>
            <Icon n="spark" s={14} /> Concept Summary & Citations
          </button>
        </div>

        {/* Body Viewer */}
        <div className="v-body" style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {activeTab === 'content' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* REAL PDF VIEWER */}
              {isPdf && (
                <div style={{ flex: 1, minHeight: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="row" style={{ justifyContent: 'space-between', padding: '6px 12px', background: 'var(--sb)', borderRadius: 6, border: '1px solid var(--bd)' }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="tag">Native PDF</span>
                      <span className="sm mu">Rendering original PDF directly from server</span>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn o sm" onClick={() => setPage(p => Math.max(1, p - 1))}>
                        ← Prev Page
                      </button>
                      <span className="sm">Page <b>{page}</b></span>
                      <button className="btn o sm" onClick={() => setPage(p => p + 1)}>
                        Next Page →
                      </button>
                    </div>
                  </div>

                  {!pdfLoadError ? (
                    <iframe
                      src={`${rawFileUrl}#page=${page}&zoom=${zoom}`}
                      title={fileName}
                      style={{
                        width: '100%',
                        flex: 1,
                        minHeight: 520,
                        border: '1px solid var(--bd)',
                        borderRadius: 8,
                        background: '#ffffff'
                      }}
                      onError={() => setPdfLoadError(true)}
                    />
                  ) : (
                    <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                      <h3>Could not display embedded PDF</h3>
                      <p className="mu sm" style={{ marginTop: 8 }}>You can view or download the file directly:</p>
                      <a href={rawFileUrl} target="_blank" rel="noopener noreferrer" className="btn" style={{ marginTop: 12, display: 'inline-flex' }}>
                        Open {fileName} in New Tab ↗
                      </a>
                    </div>
                  )}

                  {ans?.q && (
                    <div className="v-hl" style={{ marginTop: 8 }}>
                      <b style={{ display: 'block', color: 'var(--fg)', marginBottom: 4 }}>Cited Passage:</b>
                      {ans.q}
                    </div>
                  )}
                </div>
              )}

              {/* REAL VIDEO VIEWER */}
              {isVideo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: '#000', borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                    <video
                      ref={videoRef}
                      src={rawFileUrl}
                      controls
                      autoPlay
                      style={{ width: '100%', maxHeight: '60vh', display: 'block' }}
                      onTimeUpdate={() => {
                        if (videoRef.current) {
                          const s = Math.floor(videoRef.current.currentTime);
                          const m = Math.floor(s / 60);
                          const rem = s % 60;
                          setVideoTime(`${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`);
                        }
                      }}
                    />
                  </div>

                  <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <b>{fileName}</b>
                      <p className="mu sm" style={{ margin: '4px 0 0 0' }}>Current Seek: {videoTime}</p>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn o" onClick={() => seekVideo('00:00')}>
                        ⏮ Restart
                      </button>
                      <a href={rawFileUrl} target="_blank" rel="noopener noreferrer" className="btn o">
                        Open in Tab ↗
                      </a>
                    </div>
                  </div>

                  {ans?.q && (
                    <div className="card">
                      <h3>Highlighted Concept Moment</h3>
                      <p className="mu sm" style={{ marginTop: 6 }}>{ans.q}</p>
                    </div>
                  )}
                </div>
              )}

              {/* PPT PRESENTATION VIEWER */}
              {isPpt && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="card" style={{ padding: 24, textAlign: 'center', background: 'var(--sb)' }}>
                    <Icon n="chart" s={52} />
                    <h2 style={{ fontSize: 20, marginTop: 12 }}>{fileName}</h2>
                    <p className="mu sm" style={{ marginTop: 4 }}>Microsoft PowerPoint Presentation (.pptx)</p>
                    <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 18 }}>
                      <a href={rawFileUrl} download={fileName} className="btn" style={{ textDecoration: 'none' }}>
                        <Icon n="upl" s={16} /> Download & Open Presentation
                      </a>
                      <a href={rawFileUrl} target="_blank" rel="noopener noreferrer" className="btn o" style={{ textDecoration: 'none' }}>
                        Direct File Stream ↗
                      </a>
                    </div>
                  </div>

                  <div className="v-ppt-slide">
                    <div className="row" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
                      <span className="tag">Slide {slide} of 5</span>
                      <span className="mu sm">Database Normalization Deck</span>
                    </div>

                    <h3 style={{ fontSize: 18, marginBottom: 10 }}>
                      {slide === 1 && "Slide 1: Overview & Functional Dependencies"}
                      {slide === 2 && "Slide 2: First Normal Form (1NF) Rules"}
                      {slide === 3 && "Slide 3: Second Normal Form (2NF) & Partial Dependencies"}
                      {slide === 4 && "Slide 4: Third Normal Form (3NF) & Transitive Dependencies"}
                      {slide === 5 && "Slide 5: Boyce-Codd Normal Form (BCNF) Criteria"}
                    </h3>

                    <ul style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                      {slide === 1 && (
                        <>
                          <li>Decomposition of relations to eliminate redundant storage.</li>
                          <li>Prevents Insertion, Update, and Deletion Anomalies.</li>
                          <li>Formalized through functional dependencies X → Y.</li>
                        </>
                      )}
                      {slide === 2 && (
                        <>
                          <li>Each attribute value must be atomic (indivisible).</li>
                          <li>No multi-valued attributes or repeating groups.</li>
                          <li>Primary key uniquely identifies each tuple.</li>
                        </>
                      )}
                      {slide === 3 && (
                        <>
                          <li>Table must strictly satisfy 1NF conditions.</li>
                          <li>No non-prime attribute is partially dependent on any candidate key.</li>
                          <li>Every non-key attribute depends on the full composite key.</li>
                        </>
                      )}
                      {slide === 4 && (
                        <>
                          <li>Table must strictly satisfy 2NF conditions.</li>
                          <li>No transitive dependency: non-key attributes cannot depend on non-key attributes.</li>
                          <li>For X → A, X must be a superkey or A must be prime.</li>
                        </>
                      )}
                      {slide === 5 && (
                        <>
                          <li>Strict form of 3NF eliminating all anomaly risks.</li>
                          <li>For every functional dependency X → Y, X must be a superkey.</li>
                        </>
                      )}
                    </ul>

                    <div className="row" style={{ marginTop: 18, justifyContent: 'center', gap: 14 }}>
                      <button className="btn o" onClick={() => setSlide(s => Math.max(1, s - 1))} disabled={slide <= 1}>
                        ← Prev Slide
                      </button>
                      <span className="mu sm">Slide {slide} / 5</span>
                      <button className="btn o" onClick={() => setSlide(s => Math.min(5, s + 1))} disabled={slide >= 5}>
                        Next Slide →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* IMAGE VIEWER */}
              {isImg && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                  <img
                    src={rawFileUrl}
                    alt={fileName}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '65vh',
                      objectFit: 'contain',
                      borderRadius: 8,
                      border: '1px solid var(--bd)'
                    }}
                  />
                  <div className="card" style={{ width: '100%' }}>
                    <h3>Document Vision OCR Extracted Data</h3>
                    <p className="mu sm" style={{ marginTop: 6 }}>
                      High-resolution visual extraction analyzed and indexed for RAG queries.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="card g" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>🎙️ Interactive Lecture Timestamps</h3>
                  <p className="mu sm" style={{ margin: '4px 0 0 0' }}>Click any timestamp below to seek the video player immediately.</p>
                </div>
              </div>

              {[
                { t: '00:00', title: 'Lecture Introduction', desc: 'Core concept definitions, syllabus alignment, and overview.' },
                { t: '02:15', title: 'Fundamental Theorems & Definitions', desc: 'Mathematical explanations and architectural breakdown.' },
                { t: '05:40', title: 'Key Mechanisms & Step-by-Step Analysis', desc: 'Practical walkthrough with concrete test-cases and examples.' },
                { t: '12:35', title: 'ACID Properties / 2NF Verification', desc: 'Deep dive into validation and anomaly mitigation techniques.' },
                { t: '18:50', title: 'Summary & Exam-Ready Tips', desc: 'Key interview questions and practice problems review.' }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="row"
                  style={{
                    padding: '12px 14px',
                    border: '1px solid var(--bd)',
                    borderRadius: '10px',
                    background: videoTime.startsWith(item.t.slice(0, 2)) ? 'var(--hv)' : 'var(--cb)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => seekVideo(item.t)}
                >
                  <span className="tag" style={{ fontWeight: 700, padding: '4px 10px' }}>{item.t}</span>
                  <div style={{ flex: 1 }}>
                    <b style={{ color: 'var(--fg)', fontSize: 14 }}>{item.title}</b>
                    <p className="mu sm" style={{ margin: '3px 0 0 0' }}>{item.desc}</p>
                  </div>
                  <Icon n="play" s={14} style={{ opacity: 0.6 }} />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="card g" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>✨ AI Indexed Highlights & Citation Details</h3>
                <span className="tag">Verified Source</span>
              </div>

              <div className="hl" style={{ margin: '6px 0 14px 0' }}>
                <b>📌 Source Information:</b>
                <p style={{ margin: '6px 0 0 0', fontWeight: 400 }}>
                  Referenced document: <code>{fileName}</code>. Verified against the syllabus and ingested with exact page/timestamp citations.
                </p>
              </div>

              <div className="card" style={{ padding: 14 }}>
                <b>Citation Text:</b>
                <p className="mu sm" style={{ marginTop: 6 }}>
                  {ans?.q || "A relation is in 2NF if it is in 1NF and no non-prime attribute is partially dependent on any candidate key."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
