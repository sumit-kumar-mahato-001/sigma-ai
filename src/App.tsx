import {useEffect,useState,useRef} from 'react';
import {api} from './api';
import {Icon,type IconName} from './icons';
import logo from './assets/logo.png';
import type {Mock,Chat,Lang,Topic,Ctx} from './types';
import {ChatPage} from './pages/Chat';
import {Library,Assessments,Progress,CourseMap,Settings} from './pages/Pages';

import {ViewerModal} from './components/ViewerModal';
import {SplitWorkspace} from './components/SplitWorkspace';
import {ConfirmModal, type ModalConfig} from './components/ConfirmModal';

const NAV:[string,string,IconName][]=[['library','Library','book'],['assessments','Assessments','file'],['progress','Progress','chart'],['map','Course map','net']];
const go=(r:string)=>{location.hash=r};
const useHash=()=>{const [h,s]=useState(location.hash.slice(1)||'/');
  useEffect(()=>{const f=()=>s(location.hash.slice(1)||'/');addEventListener('hashchange',f);return()=>removeEventListener('hashchange',f)},[]);return h};
import {AuthPage} from './pages/Auth';

export default function App(){
  const route=useHash();
  const [db,setDb]=useState<Mock|null>(null),[chats,setChats]=useState<Chat[]>([]),[topics,setTopics]=useState<Topic[]>([]);
  const [cur,setCur]=useState<number|null>(null),[lang,setLang]=useState<Lang>('hn');
  const [langOpen,setLangOpen]=useState(false);
  const langRef=useRef<HTMLDivElement>(null);
  const [dark,setDark]=useState(matchMedia('(prefers-color-scheme:dark)').matches);
  const [c,setC]=useState(false),[o,setO]=useState(false),[menu,setMenu]=useState(false),[sq,setSq]=useState('');
  const [panel,setPanel]=useState(false),[view,setView]=useState<string|null>(null),[tg,setTg]=useState<string|null>(null);
  const [user, setUser] = useState<{id:string,name:string,identifier:string}|null>(() => {
    const savedUser = localStorage.getItem('sigma_user');
    if (savedUser) {
      try { return JSON.parse(savedUser); } catch {}
    }
    return { id: 'usr_student', name: 'Mukesh Kumar', identifier: 'student@sigma.ai' };
  });
  const [token, setToken] = useState<string|null>(() => localStorage.getItem('sigma_token') || 'demo_token');

  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);

  const confirmModal = (title: string, message: string, onConfirm: () => void, isDanger: boolean = false) => {
    setModalConfig({
      title,
      message,
      confirmLabel: isDanger ? 'Delete' : 'Confirm',
      isDanger,
      onConfirm: () => onConfirm(),
    });
  };

  const promptModal = (title: string, message: string, defaultValue: string, onConfirm: (val: string) => void) => {
    setModalConfig({
      title,
      message,
      defaultValue,
      hasInput: true,
      confirmLabel: 'Save',
      onConfirm: (val) => {
        if (val && val.trim()) onConfirm(val.trim());
      },
    });
  };

  const toast=(t:string)=>{setTg(t);setTimeout(()=>setTg(null),1500)};
  const ctx:Ctx={
    db: db || ({} as any),
    topics,
    setTopics,
    chats,
    setChats,
    cur,
    setCur,
    lang,
    setView,
    toast,
    dark,
    setDark,
    userId: user?.id || 'guest_user',
    confirmModal,
    promptModal,
  };

  useEffect(()=>{
    const handleOutside=(e:MouseEvent)=>{
      if(langRef.current&&!langRef.current.contains(e.target as Node))setLangOpen(false);
    };
    if(langOpen)document.addEventListener('mousedown',handleOutside);
    return ()=>document.removeEventListener('mousedown',handleOutside);
  },[langOpen]);

  useEffect(() => {
    const savedToken = localStorage.getItem('sigma_token');
    const savedUser = localStorage.getItem('sigma_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {}
    } else {
      // Default to demo student so screen never shows blank
      const demoUser = { id: 'usr_student', name: 'Mukesh Kumar', identifier: 'student@sigma.ai' };
      setToken('demo_token');
      setUser(demoUser);
    }
  }, []);

  const handleLogin = (t: string, u: {id:string,name:string,identifier:string}) => {
    setToken(t);
    setUser(u);
    localStorage.setItem('sigma_token', t);
    localStorage.setItem('sigma_user', JSON.stringify(u));
    location.hash = '/app/chat';
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('sigma_token');
    localStorage.removeItem('sigma_user');
    location.hash = '/';
  };

  useEffect(()=>{
    api.getMock().then(d=>{
      setDb(d);
      const saved = localStorage.getItem('sigma_chats');
      if (saved) {
        try { setChats(JSON.parse(saved)); } catch { setChats(d.chats); }
      } else {
        setChats(d.chats);
      }
      api.getTopics().then(tList => setTopics(tList)).catch(() => setTopics(d.topics));
    });
  },[]);

  useEffect(()=>{
    if(chats.length) {
      try { localStorage.setItem('sigma_chats', JSON.stringify(chats)); } catch {}
    }
  },[chats]);

  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light'},[dark]);
  useEffect(()=>{setO(false);setMenu(false)},[route]);

  if(route==='/'||route==='/login'||route==='/signup'||route==='/reset') {
    if (user && token) {
      // Redirect to chat if already authenticated
      location.hash = '/app/chat';
    }
    return (
      <>
        <AuthPage onLogin={handleLogin} />
        {modalConfig && <ConfirmModal config={modalConfig} onClose={() => setModalConfig(null)} />}
      </>
    );
  }

  if(!db) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <img src={logo} width={48} height={48} alt="Sigma" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>Loading Sigma AI...</div>
        </div>
      </div>
    );
  }
  const k=route.replace('/app/','')||'chat';
  const tog=()=>{setC(v=>!v);setO(v=>!v)};
  let g='';
  const hist=chats.map((ch,i)=>({ch,i})).filter(x=>x.ch.t.toLowerCase().includes(sq.toLowerCase())).map(({ch,i})=>{
    const hd=ch.g!==g;g=ch.g;
    return (
      <div key={i}>
        {hd&&<div className="lbl">{g}</div>}
        <div className={`it row ${cur===i?'on':''}`} style={{padding:'4px 6px',justifyContent:'space-between'}}>
          <button style={{textAlign:'left',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} onClick={()=>{setCur(i);go('/app/chat')}}>
            {ch.t}
          </button>
          <div className="row" style={{gap:2}}>
            <button className="ib" style={{width:24,height:24}} title="Rename chat" onClick={(e)=>{
              e.stopPropagation();
              promptModal(
                'Rename Chat',
                'Enter a new title for this conversation:',
                ch.t,
                (newTitle) => {
                  setChats(cs => cs.map((c, idx) => idx === i ? {...c, t: newTitle} : c));
                  toast('Chat renamed');
                }
              );
            }}>
              <Icon n="edit" s={13}/>
            </button>
            <button className="ib" style={{width:24,height:24}} title="Delete chat" onClick={(e)=>{
              e.stopPropagation();
              confirmModal(
                'Delete Chat',
                `Are you sure you want to permanently delete "${ch.t}"? This cannot be undone.`,
                () => {
                  setChats(cs => {
                    const updated = cs.filter((_, idx) => idx !== i);
                    try { localStorage.setItem('sigma_chats', JSON.stringify(updated)); } catch {}
                    return updated;
                  });
                  if(cur === i) setCur(null);
                  toast('Chat deleted');
                },
                true
              );
            }}>
              <Icon n="trash" s={13}/>
            </button>
          </div>
        </div>
      </div>
    );
  });
  const keys=[...new Set((cur==null?[]:chats[cur].msgs).map(m=>m.k).filter((x):x is string=>!!x))];
  const plain={color:'inherit',textDecoration:'none'} as const;
  return (<>
    <div id="app" className={`${c?'c':''} ${o?'o':''}`}>
      <div className="bdp" onClick={tog}/>
      <aside>
        <div className="row" style={{padding:'6px 8px 12px', alignItems:'center', borderBottom:'1px solid var(--bd)', marginBottom: 8}}>
          <img src={logo} width={28} height={28} alt="Sigma AI" style={{display:'block', flexShrink:0, objectFit:'contain'}}/>
          <div style={{display:'flex', alignItems:'center', gap: 6, flex: 1}}>
            <b style={{fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em'}}>Sigma AI</b>
            <span style={{fontSize: 10, padding: '1px 6px', background: 'var(--hv)', borderRadius: 99, color: 'var(--mu)', fontWeight: 600}}>PRO</span>
          </div>
          <button className="ib" onClick={tog} aria-label="Close sidebar"><Icon n="panel"/></button>
        </div>
        <button className="it" onClick={()=>{setCur(null);go('/app/chat')}}><Icon n="edit"/> New chat</button>
        <div className="it" style={{padding:'2px 10px'}}><Icon n="search"/>
          <input value={sq} onChange={e=>setSq(e.target.value)} placeholder="Search chats" style={{background:'none',border:0,outline:0,width:'100%',padding:'6px 0'}}/></div>
        {NAV.map(n=><a key={n[0]} className={`it ${k===n[0]?'on':''}`} href={`#/app/${n[0]}`} style={plain}><Icon n={n[2]}/> {n[1]}</a>)}
        <div className="lbl" style={{paddingTop:18}}>Chats</div>
        <div style={{flex:1,overflow:'auto'}}>{hist}</div>
        {menu&&<div className="pop">
          <a className="it" href="#/app/settings" style={plain}><Icon n="gear"/> Settings</a>
          <button className="it" onClick={()=>{setDark(!dark);setMenu(false)}}><Icon n="moon"/> {dark?'Light':'Dark'} mode</button>
          <button className="it" onClick={handleLogout} style={plain}><Icon n="out"/> Log out</button></div>}
        <button className="it" onClick={()=>setMenu(!menu)} style={{padding:10}}>
          <span className="ib" style={{background:'var(--fg)',color:'var(--bg)',borderRadius:'50%',width:30,height:30}}>{user?.name?.[0]?.toUpperCase() || 'S'}</span>
          <span className="sp"><b>{user?.name ?? db.user}</b><br/><span className="mu sm">{user?.identifier || 'Student'}</span></span></button>
      </aside>
      <section className="mn">
        <header style={{display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--bd)'}}>
          <button className="ib" onClick={tog} aria-label="Toggle sidebar"><Icon n="panel" s={20}/></button>
          
          <div className="row" style={{gap: 8, alignItems: 'center', marginRight: 8}}>
            <img src={logo} width={22} height={22} alt="Sigma AI" style={{display: 'block', objectFit: 'contain'}}/>
            <span style={{fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em'}}>Sigma AI</span>
          </div>

          {k==='chat'
            ?<div ref={langRef} style={{position:'relative'}}>
                <button
                  className="lang-btn"
                  onClick={()=>setLangOpen(v=>!v)}
                  aria-label="Select Language"
                  title="Switch response language"
                >
                  <Icon n="spark" s={15}/>
                  <span>{lang==='hn'?'Hinglish':lang==='hi'?'Hindi':'English'}</span>
                  <Icon n="down" s={14}/>
                </button>
                {langOpen && (
                  <div className="lang-menu">
                    <button
                      className={`lang-item ${lang==='hn'?'active':''}`}
                      onClick={()=>{setLang('hn');setLangOpen(false);toast('Switched to Hinglish')}}
                    >
                      <span>Sigma · Hinglish</span>
                      {lang==='hn'&&<Icon n="check" s={15}/>}
                    </button>
                    <button
                      className={`lang-item ${lang==='en'?'active':''}`}
                      onClick={()=>{setLang('en');setLangOpen(false);toast('Switched to English')}}
                    >
                      <span>Sigma · English</span>
                      {lang==='en'&&<Icon n="check" s={15}/>}
                    </button>
                    <button
                      className={`lang-item ${lang==='hi'?'active':''}`}
                      onClick={()=>{setLang('hi');setLangOpen(false);toast('Switched to Hindi')}}
                    >
                      <span>Sigma · Hindi</span>
                      {lang==='hi'&&<Icon n="check" s={15}/>}
                    </button>
                  </div>
                )}
              </div>
            :<b style={{padding:'0 8px'}}>{NAV.find(n=>n[0]===k)?.[1]??'Settings'}</b>}
          <span className="sp"/>
          {k==='chat'&&<button className={`ib ${panel?'on':''}`} onClick={()=>setPanel(!panel)} aria-label="Split Workspace" title="Open PDF/Video/Quiz Workspace"><Icon n="panel" s={20}/></button>}
        </header>
        <div className="body">
          {k==='library'?<Library ctx={ctx}/>:k==='assessments'?<Assessments ctx={ctx}/>:k==='progress'?<Progress ctx={ctx}/>
            :k==='map'?<CourseMap ctx={ctx}/>:k==='settings'?<Settings ctx={ctx}/>:<ChatPage ctx={ctx}/>}
        </div>
        {panel && k==='chat' && (
          <SplitWorkspace
            ctx={ctx}
            activeItem={view}
            onClose={() => setPanel(false)}
          />
        )}
      </section>
      {view && <ViewerModal viewKey={view} db={db} onClose={() => setView(null)} toast={toast} />}
    </div>
    {modalConfig && <ConfirmModal config={modalConfig} onClose={() => setModalConfig(null)} />}
    {tg&&<div className="tg">{tg}</div>}
  </>);
}
