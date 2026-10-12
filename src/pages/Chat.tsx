import {useEffect,useRef,useState} from 'react';
import {Icon} from '../icons';
import logo from '../assets/logo.png';
import {api} from '../api';
import type {Ctx,Msg} from '../types';
import {MarkdownRenderer} from '../components/MarkdownRenderer';

const MULTILINGUAL_SUGGESTIONS = [
  // --- English ---
  'What is 1NF, 2NF, 3NF and BCNF normalization in DBMS?',
  'What is a transaction and ACID properties in DBMS?',
  'Explain Deadlock conditions and prevention in OS',
  'Difference between SQL and NoSQL databases',
  'Difference between Process and Thread in OS',
  'Difference between Primary Key and Foreign Key',
  'Explain TCP/IP model vs OSI 7-layer model',
  'Explain Binary Search Tree and AVL Tree with rotations',
  'What is Quantum Computing and Qubits?',
  'Explain Normalization with a real-life table example',
  'Explain React Hooks: useState, useEffect and useMemo',
  'How does Database Indexing speed up queries?',
  'How does DNS resolution work step by step?',
  'What is REST API and HTTP status codes?',
  'Write Python code for Merge Sort and Quick Sort',
  'Explain Object-Oriented Programming (OOP) 4 pillars',
  'What is Machine Learning vs Deep Learning?',
  'What is Virtual Memory and Paging in Operating Systems?',
  'Explain CAP Theorem in distributed databases',
  'Difference between TCP and UDP with real-life examples',
  'What is B-Tree and B+ Tree indexing?',
  'What is SQL Injection and how to prevent it?',
  'Explain Dynamic Programming with Fibonacci example',
  'Explain CPU Scheduling algorithms (FCFS, SJF, Round Robin)',
  'What is Docker and Containerization?',
  'Explain Dijkstra shortest path algorithm step by step',

  // --- Hinglish ---
  '2NF normalization kya hota hai example ke sath samjhao',
  'ACID properties kya hoti hain database mein?',
  'Deadlock kya hai aur ise kaise solve karte hain OS mein?',
  'SQL aur NoSQL databases mein kya antar hai?',
  'Process aur Thread mein main difference kya hai?',
  'Primary Key aur Foreign Key mein kya difference hota hai?',
  'TCP/IP model aur OSI model mein kya difference hai?',
  'React hooks jaise useState aur useEffect kaise kaam karte hain?',
  'Database indexing kaise fast banati hai queries ko?',
  'Python mein list aur tuple mein kya fark hai?',
  'OOPs ke 4 main pillars (Inheritance, Polymorphism) samjhao',
  'Machine Learning aur Artificial Intelligence mein kya fark hai?',
  'Virtual memory aur Paging Operating System mein kya hota hai?',
  'SQL queries kaise likhte hain JOIN aur GROUP BY ke sath?',
  'Binary search algorithm ka code Python mein kaise likhein?',
  'REST API kya hoti hai aur GET, POST methods kaise use hote hain?',
  'Docker kya hota hai aur developers iska use kyu karte hain?',
  'CPU scheduling algorithms FCFS aur Round Robin detail mein samjhao',
  'SQL Injection kya hota hai aur website ko kaise secure karein?',
  'Dijkstra algorithm kaise kaam karta hai shortest path ke liye?',

  // --- Hindi (Devanagari) ---
  '2NF सामान्यीकरण (Normalization) क्या है और कैसे काम करता है?',
  'डेटाबेस में ACID प्रॉपर्टीज (Properties) क्या हैं?',
  'ऑपरेटिंग सिस्टम में डेडलॉक (Deadlock) क्या है और समाधान क्या है?',
  'SQL और NoSQL डेटाबेस में क्या अंतर है?',
  'प्रोसेस (Process) और थ्रेड (Thread) में मुख्य अंतर क्या है?',
  'प्राइमरी की (Primary Key) और फॉरेन की (Foreign Key) क्या है?',
  'कंप्यूटर नेटवर्क में OSI मॉडल की 7 लेयर्स समझाइए',
  'पायथन (Python) में लिस्ट और टपल में क्या अंतर है?',
  'ऑब्जेक्ट ओरिएंटेड प्रोग्रामिंग (OOPs) के मुख्य सिद्धांत क्या हैं?',
  'मशीन लर्निंग (ML) और आर्टिफिशियल इंटेलिजेंस (AI) क्या है?',
  'वर्चुअल मेमोरी (Virtual Memory) और पेजिंग (Paging) क्या है?',
  'REST API क्या है और यह कैसे काम करती है?',
  'बाइनरी सर्च (Binary Search) एल्गोरिदम कैसे काम करता है?',
  'डेटाबेस इंडेक्सिंग (Indexing) के क्या फायदे हैं?',
  'डॉकर (Docker) और कंटेनराइजेशन क्या है?',
  'कंप्यूटर नेटवर्किंग में TCP और UDP में क्या अंतर है?'
];

function getTypingSuggestions(q: string, preferredLang: string): string[] {
  const query = q.trim().toLowerCase();
  if (!query || query.length < 2) return [];
  const words = query.split(/\s+/).filter(Boolean);

  // 1. Direct multi-word match
  const matched = MULTILINGUAL_SUGGESTIONS.filter(item => {
    const lower = item.toLowerCase();
    return words.every(w => lower.includes(w));
  });

  // 2. Partial match if needed
  if (matched.length < 4) {
    const partial = MULTILINGUAL_SUGGESTIONS.filter(item => {
      const lower = item.toLowerCase();
      return !matched.includes(item) && words.some(w => lower.includes(w));
    });
    matched.push(...partial);
  }

  // 3. Dynamic smart generator for Hindi / Hinglish / English prefixes
  const dynamic: string[] = [];
  const isHindiDevanagari = /[\u0900-\u097F]/.test(query);

  if (isHindiDevanagari) {
    if (query.includes('क्या') || query.startsWith('क्या')) {
      dynamic.push(`${q.trim()} और इसके मुख्य उदाहरण क्या हैं?`);
    } else if (query.includes('कैसे') || query.startsWith('कैसे')) {
      dynamic.push(`${q.trim()} स्टेप बाय स्टेप समझाइए`);
    } else if (query.includes('अंतर') || query.includes('फर्क')) {
      dynamic.push(`${q.trim()} विस्तार से समझाइए`);
    } else {
      dynamic.push(`${q.trim()} क्या है और कैसे काम करता है?`);
    }
  } else {
    // English / Hinglish
    const isHinglish = query.includes('kya') || query.includes('kaise') || query.includes('samjhao') || query.includes('batao') || query.includes('mein') || query.includes('hai');
    if (isHinglish) {
      if (query.startsWith('kya') || query.includes('kya')) {
        dynamic.push(`${q.trim()} example ke sath samjhao`);
      } else if (query.startsWith('kaise') || query.includes('kaise')) {
        dynamic.push(`${q.trim()} step by step samjhao`);
      } else if (query.includes('difference') || query.includes('fark') || query.includes('antar')) {
        dynamic.push(`${q.trim()} detail mein explain karo`);
      } else {
        dynamic.push(`${q.trim()} kya hota hai detail mein`);
      }
    } else {
      // English
      if (query.startsWith('wha') && !matched.some(m => m.toLowerCase().startsWith('what'))) {
        dynamic.push(`What is ${q.slice(4).trim() || 'the concept'} in detail?`);
      } else if ((query.startsWith('exp') || query.startsWith('explain')) && !matched.some(m => m.toLowerCase().startsWith('explain'))) {
        dynamic.push(`Explain ${q.slice(7).trim() || 'the topic'} with practical examples`);
      } else if (query.startsWith('diff') && !matched.some(m => m.toLowerCase().startsWith('difference'))) {
        dynamic.push(`Difference between ${q.slice(10).trim() || 'key concepts'}`);
      } else if (query.startsWith('how') && !matched.some(m => m.toLowerCase().startsWith('how'))) {
        dynamic.push(`How does ${q.slice(3).trim() || 'it work'} step by step?`);
      }
    }
  }

  // Combine and sort prioritising preferred language
  const combined = Array.from(new Set([...dynamic, ...matched]));
  return combined.slice(0, 6);
}

export function ChatPage({ctx}:{ctx:Ctx}){
  const {db,chats,setChats,cur,setCur,lang,setView,toast}=ctx;
  const [text,setText]=useState('');const ref=useRef<HTMLDivElement>(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [showScrollTop,setShowScrollTop]=useState(false);
  const [copiedIdx,setCopiedIdx]=useState<number|null>(null);
  const [feedbackMap,setFeedbackMap]=useState<Record<number, 'like'|'dislike'>>({});
  const [selectedSugIdx, setSelectedSugIdx]=useState<number>(-1);
  const [showSugDropdown, setShowSugDropdown]=useState<boolean>(true);
  const menuRef=useRef<HTMLDivElement>(null);
  const compRef=useRef<HTMLDivElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const msgs:Msg[]=cur==null?[]:chats[cur].msgs;
  const typingSuggestions: string[] = [];

  useEffect(()=>{
    const handleOutside=(e:MouseEvent)=>{
      if(menuRef.current&&!menuRef.current.contains(e.target as Node))setMenuOpen(false);
      if(compRef.current&&!compRef.current.contains(e.target as Node))setShowSugDropdown(false);
    };
    document.addEventListener('mousedown',handleOutside);
    return ()=>document.removeEventListener('mousedown',handleOutside);
  },[]);

  const [uploadProgress, setUploadProgress] = useState<{ name: string; pct: number } | null>(null);

  const handleMediaUpload = async (f: File) => {
    try {
      setUploadProgress({ name: f.name, pct: 0 });
      toast(`Uploading ${f.name} (0%)...`);
      
      const m = await api.upload(f, (pct: number) => {
        setUploadProgress({ name: f.name, pct });
        if (pct < 100) {
          toast(`Uploading ${f.name}: ${pct}%`);
        } else {
          toast(`Processing & indexing ${f.name}...`);
        }
      });
      
      setUploadProgress(null);
      toast(`Uploaded & indexed successfully: ${m.name} (${m.kind.toUpperCase()}) ✅`);
    } catch (err: any) {
      setUploadProgress(null);
      toast(`Upload failed: ${err.message || 'Unknown error'}`);
    }
  };
  const patch=(ci:number,mi:number,p:Partial<Msg>)=>setChats(cs=>cs.map((c,i)=>i!==ci?c:{...c,msgs:c.msgs.map((m,j)=>j===mi?{...m,...p}:m)}));
  const stream=(ci:number,mi:number,n:number)=>{
    let w=0;
    const step=Math.max(3,Math.ceil(n/24));
    const t=setInterval(()=>{
      w+=step;
      const isDone=w>=n;
      patch(ci,mi,{w:Math.min(w,n),done:isDone});
      if(isDone)clearInterval(t);
    },16);
  };
function extractSmartTitle(query: string, snippet?: string): string {
  let cleaned = query
    .replace(/^(what is|what are|explain|can you explain|difference between|tell me about|how does|why does|kya hai|kya hota hai|btao|batao|samjhao|hello|hi|hey|please)\s+/i, '')
    .trim()
    .replace(/[?!.:,]+$/, '');

  if (snippet && cleaned.length < 5) {
    const sClean = snippet.replace(/^(#+\s*|\*\*|__)/, '').split(/[\n.]/)[0];
    if (sClean && sClean.length > 4) {
      cleaned = sClean.slice(0, 36);
    }
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (!words.length) return query.slice(0, 24);
  const titleWords = words.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return titleWords.join(' ');
}

  const send=async(t0?:string)=>{
    const t=(t0??text).trim();if(!t)return;setText('');setShowSugDropdown(false);setSelectedSugIdx(-1);
    let ci=cur;const len=cur==null?0:chats[cur].msgs.length;
    const initialTitle = extractSmartTitle(t);
    if(ci==null){setChats(cs=>[{t:initialTitle,g:'Today',msgs:[]},...cs]);ci=0;setCur(0)}
    const id=ci,mi=len+1;
    setChats(cs=>cs.map((c,i)=>i===id?{...c,msgs:[...c.msgs,{u:t},{load:true}]}:c));
    setTimeout(() => {
      const targetEl = document.getElementById(`msg-${id}-${mi - 1}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);

    // Prepare conversation history so Sigma AI remembers prior context
    const existingMsgs = ci != null ? chats[ci]?.msgs || [] : [];
    const conversationHistory = existingMsgs
      .filter(m => !m.load)
      .slice(-10)
      .map(m => {
        const textContent = m.u 
          ? m.u 
          : (m.text || (m.k && db.ans[m.k] ? db.ans[m.k][lang] : ''));
        return {
          role: m.u ? 'user' : 'assistant',
          text: (textContent || '').trim(),
        };
      })
      .filter(m => m.text.length > 0);

    const r = await api.ask(t, lang, conversationHistory);
    const full = r.text ?? (r.key ? db.ans[r.key][lang] : '');
    patch(id, mi, { load: false, k: r.key ?? null, text: r.text, file: r.file, loc: r.loc, covered: r.covered, done: !r.covered, w: 0, confidence: r.confidence, verified: r.verified, citations: r.citations });
    
    // Automatically set and analyze chat title based on query + answer context
    const analyzedTitle = r.title || extractSmartTitle(t, full);
    if (analyzedTitle) {
      setChats(cs => cs.map((c, i) => i === id ? { ...c, t: analyzedTitle } : c));
    }

    // Smooth scroll positioning: Scroll so the user question sits nicely near top-half, leaving comfortable reading room
    setTimeout(() => {
      const targetEl = document.getElementById(`msg-${id}-${mi - 1}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (ref.current) {
        ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
      }
    }, 120);

    if (r.covered) stream(id, mi, full.split(' ').length);
  };

  const handleCopy = (txt: string, idx: number) => {
    navigator.clipboard?.writeText(txt).catch(()=>{});
    setCopiedIdx(idx);
    toast('Copied to clipboard!');
    setTimeout(()=>setCopiedIdx(null), 1500);
  };

  const handleFeedback = (idx: number, type: 'like' | 'dislike') => {
    setFeedbackMap(prev => ({...prev, [idx]: type}));
    toast(type === 'like' ? 'Thanks for the positive feedback! 👍' : 'Feedback noted! We will improve.');
  };

  const handleRegenerate = (msgIdx: number) => {
    const userQ = msgs[msgIdx - 1]?.u;
    if (userQ) {
      toast('Regenerating answer with Gemini...');
      send(userQ);
    } else {
      toast('No previous question to regenerate');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (typingSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSugIdx(prev => (prev < typingSuggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSugIdx(prev => (prev > 0 ? prev - 1 : typingSuggestions.length - 1));
        return;
      }
      if (e.key === 'Escape') {
        setShowSugDropdown(false);
        setSelectedSugIdx(-1);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (selectedSugIdx >= 0 && typingSuggestions[selectedSugIdx]) {
        send(typingSuggestions[selectedSugIdx]);
      } else {
        send();
      }
    }
  };

  const composer=(
    <div className="comp" ref={compRef}>
      <textarea
        rows={1}
        value={text}
        onChange={e=>{setText(e.target.value);setShowSugDropdown(true);setSelectedSugIdx(-1)}}
        onFocus={()=>setShowSugDropdown(true)}
        placeholder="Ask anything or chat with Sigma AI..."
        onKeyDown={handleKeyDown}
      />
      <div className="crow">
        <div ref={menuRef} style={{position:'relative'}}>
          <button className={`ib ${menuOpen?'on':''}`} onClick={()=>setMenuOpen(v=>!v)} aria-label="Add Context"><Icon n="plus" s={20}/></button>
          {menuOpen&&(
            <div className="ctx-menu">
              <div className="ctx-title">
                <span>Add Context & Upload</span>
                <span className="ctx-title-badge">Multi-Modal AI</span>
              </div>

              <button className="ctx-item" onClick={()=>{setMenuOpen(false);if(fileRef.current){fileRef.current.setAttribute('accept','.pdf');fileRef.current.click()}}}>
                <div className="ctx-icon-box" style={{ background: '#3b82f618', color: '#2563eb' }}>
                  <Icon n="file" s={18}/>
                </div>
                <div className="ctx-item-text">
                  <b>PDF Document</b>
                  <span>Textbooks, notes, syllabi (.pdf)</span>
                </div>
                <span className="ctx-item-badge">PDF</span>
              </button>

              <button className="ctx-item" onClick={()=>{setMenuOpen(false);if(fileRef.current){fileRef.current.setAttribute('accept','.mp4,.mkv,.avi,.mov,.webm,.flv,.wmv,.m4v,.3gp,.mp3,.wav,.m4a');fileRef.current.click()}}}>
                <div className="ctx-icon-box" style={{ background: '#ef444418', color: '#dc2626' }}>
                  <Icon n="play" s={18}/>
                </div>
                <div className="ctx-item-text">
                  <b>Video / Audio Lecture</b>
                  <span>Recordings & clips (.mp4, .mkv, .mov)</span>
                </div>
                <span className="ctx-item-badge">VIDEO</span>
              </button>

              <button className="ctx-item" onClick={()=>{setMenuOpen(false);if(fileRef.current){fileRef.current.setAttribute('accept','.png,.jpg,.jpeg,.webp');fileRef.current.click()}}}>
                <div className="ctx-icon-box" style={{ background: '#10b98118', color: '#059669' }}>
                  <Icon n="media" s={18}/>
                </div>
                <div className="ctx-item-text">
                  <b>Image / Diagram</b>
                  <span>Whiteboard photos & formulas (.png, .jpg)</span>
                </div>
                <span className="ctx-item-badge">IMAGE</span>
              </button>

              <button className="ctx-item" onClick={()=>{setMenuOpen(false);if(fileRef.current){fileRef.current.setAttribute('accept','.ppt,.pptx');fileRef.current.click()}}}>
                <div className="ctx-icon-box" style={{ background: '#f59e0b18', color: '#d97706' }}>
                  <Icon n="chart" s={18}/>
                </div>
                <div className="ctx-item-text">
                  <b>Presentation Slides</b>
                  <span>PowerPoint lecture decks (.ppt, .pptx)</span>
                </div>
                <span className="ctx-item-badge">PPTX</span>
              </button>

              <div className="ctx-divider" />

              <button className="ctx-item" onClick={()=>{setMenuOpen(false);location.hash='/app/library'}}>
                <div className="ctx-icon-box" style={{ background: 'color-mix(in srgb, var(--ac) 18%, transparent)', color: 'var(--ac)' }}>
                  <Icon n="browser" s={18}/>
                </div>
                <div className="ctx-item-text">
                  <b>Course Library</b>
                  <span>Browse & manage all uploaded materials</span>
                </div>
                <span className="ctx-item-badge" style={{ color: 'var(--ac)' }}>OPEN →</span>
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt,.mp4,.mkv,.avi,.mov,.webm,.flv,.wmv,.m4v,.3gp,.mp3,.wav,.m4a"
          onChange={e=>{const f=e.target.files?.[0];if(f)handleMediaUpload(f);e.target.value=''}}
        />
        <span className="sp"/>
        <button className="ib" aria-label="Voice input"><Icon n="mic" s={20}/></button>
        <button className="snd" onClick={()=>send()} aria-label="Send"><Icon n="up"/></button>
      </div>

      {uploadProgress && (
        <div style={{ marginTop: 8, padding: '6px 12px', background: 'var(--sb)', borderRadius: 10, border: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
            <span>📤 Uploading {uploadProgress.name}</span>
            <span>{uploadProgress.pct}%</span>
          </div>
          <div className="bar" style={{ marginTop: 4, height: 4 }}>
            <i style={{ width: `${uploadProgress.pct}%`, background: 'var(--fg)', transition: 'width 0.15s ease' }}/>
          </div>
        </div>
      )}

      {typingSuggestions.length > 0 && (
        <div className="yt-suggestions-box">
          {typingSuggestions.map((sug, idx) => (
            <div
              key={idx}
              className={`yt-sug-item ${selectedSugIdx === idx ? 'selected' : ''}`}
              onMouseEnter={() => setSelectedSugIdx(idx)}
              onClick={() => send(sug)}
            >
              <span className="yt-sug-icon">
                <Icon n="search" s={16}/>
              </span>
              <span className="yt-sug-text">{sug}</span>
              <span
                className="yt-sug-arrow"
                title="Fill in search"
                onClick={(e) => {
                  e.stopPropagation();
                  setText(sug);
                  setShowSugDropdown(false);
                }}
              >
                ↗
              </span>
            </div>
          ))}
        </div>
      )}
    </div>);
  const view=(m:Msg,i:number)=>{
    const msgId = `msg-${cur ?? 0}-${i}`;
    if(m.u)return <div key={i} id={msgId} className="um"><div className="ub">{m.u}</div></div>;
    if(m.load)return <div key={i} id={msgId} className="am mu">Sigma AI is thinking <span className="dot">● ● ●</span></div>;
    if(m.covered===false&&!m.text&&m.k==null)return (
      <div key={i} id={msgId} className="am"><p>I couldn't find this in your uploaded course material.</p>
        <div className="nc"><div className="row"><Icon n="alert"/><b>Not covered in course materials</b></div>
          <p className="mu sm" style={{margin:'6px 0 12px'}}>Upload relevant material or ask another question.</p>
          <a className="btn o" href="#/app/library"><Icon n="upl" s={16}/> Upload material</a></div></div>);
    const a=m.k?db.ans[m.k]:null,full=m.text??a?.[lang]??'',w=full.split(' '),n=m.done?w.length:m.w??0,file=m.file??a?.f,loc=m.loc??a?.p;
    return (
      <div key={i} id={msgId} className="am">
        <MarkdownRenderer content={m.done ? full : w.slice(0, n).join(' ')} />
        {m.done&&<>
          {m.citations && m.citations.length > 0 && (
            <div className="citations-block">
              <div className="cit-title">Sources & Citations</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {m.citations.map((c, idx) => (
                  <button
                    key={idx}
                    className="pill"
                    style={{ margin: 0, cursor: 'pointer' }}
                    onClick={() => setView(c)}
                    title={`Open ${c} in Workspace`}
                  >
                    <Icon n={c.toLowerCase().includes('video') || c.includes(':') ? 'play' : 'file'} s={13}/>
                    <span>{c}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="acts" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              className={`ib ${copiedIdx === i ? 'on' : ''}`}
              style={{ color: copiedIdx === i ? 'var(--ac)' : undefined }}
              aria-label="Copy"
              title="Copy answer"
              onClick={() => handleCopy(full, i)}
            >
              <Icon n={copiedIdx === i ? "check" : "copy"} s={16}/>
            </button>
            <button
              className={`ib ${feedbackMap[i] === 'like' ? 'on' : ''}`}
              style={{ color: feedbackMap[i] === 'like' ? '#10b981' : undefined }}
              aria-label="Good answer"
              title="Helpful answer"
              onClick={() => handleFeedback(i, 'like')}
            >
              <Icon n="like" s={16}/>
            </button>
            <button
              className={`ib ${feedbackMap[i] === 'dislike' ? 'on' : ''}`}
              style={{ transform: 'scaleY(-1)', color: feedbackMap[i] === 'dislike' ? 'var(--rd)' : undefined }}
              aria-label="Bad answer"
              title="Needs improvement"
              onClick={() => handleFeedback(i, 'dislike')}
            >
              <Icon n="like" s={16}/>
            </button>
            <button
              className="ib"
              aria-label="Regenerate"
              title="Regenerate answer with Gemini"
              onClick={() => handleRegenerate(i)}
            >
              <Icon n="redo" s={16}/>
            </button>
          </div></>}
      </div>);
  };
  return msgs.length
    ?<div className="chat">
        <div className="scr" ref={ref} onScroll={e=>setShowScrollTop(e.currentTarget.scrollTop > 120)}>
          <div className="thread">{msgs.map(view)}</div>
        </div>
        {showScrollTop && (
          <button
            className="scroll-top-btn"
            onClick={()=>ref.current?.scrollTo({top: 0, behavior: 'smooth'})}
            title="Return to top"
            aria-label="Return to top"
          >
            <Icon n="up" s={18}/>
          </button>
        )}
        <div className="cbar">{composer}<p className="foot">Sigma answers from your uploaded material. Check important info.</p></div>
      </div>
    :<div className="chat hero-chat"><div className="hero2"><img src={logo} width={80} height={80} alt="" style={{margin:'0 auto'}}/><h2>What are you studying today?</h2>{composer}</div></div>;
}
