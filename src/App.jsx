import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUpRight, Camera, Check, ChevronLeft, ChevronRight, Clapperboard, Images, Menu, Plus, Search, Trash2, X } from 'lucide-react'

const initialPosts = [
  { id: 1, type: 'Carrusel', title: 'La pausa también es parte del viaje', caption: 'Costa atlántica, 2024. Unos días para mirar sin apuro.', location: 'MAR DEL PLATA, ARGENTINA', date: '12.06.24', media: ['https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1400&q=85','https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=85'] },
  { id: 2, type: 'Video', title: 'Ritmo de ciudad', caption: 'Buenos Aires se mueve distinto cuando cae el sol.', location: 'BUENOS AIRES, ARGENTINA', date: '04.05.24', media: [{src:'https://videos.pexels.com/video-files/3129671/3129671-hd_1920_1080_25fps.mp4',video:true}], cover: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1000&q=85' },
  { id: 3, type: 'Foto', title: 'Luz de invierno', caption: 'Pequeñas escenas, grandes silencios.', location: 'BARILOCHE, ARGENTINA', date: '19.08.24', media: ['https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1400&q=85'] },
  { id: 4, type: 'Carrusel', title: 'Entre montañas', caption: 'Un recorrido en cuatro momentos por el sur.', location: 'PATAGONIA, ARGENTINA', date: '02.03.24', media: ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=85','https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=85','https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=85'] },
]
function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo iniciar sesión.')
      window.location.assign('/')
    } catch (err) { setError(err.message || 'No se pudo conectar con el servidor.') } finally { setBusy(false) }
  }
  return <main className="login-page"><a href="/" className="login-back">← VOLVER AL SITIO</a><div className="login-box"><img className="login-logo" src="/juno-logo.png" alt="Juno Studio"/><div className="eyebrow"><span className="eyebrow-line"/> ACCESO PRIVADO</div><h1>Hola de <em>nuevo.</em></h1><p>Ingresá con tu cuenta para gestionar las publicaciones.</p><form onSubmit={submit}><label className="field-label">USUARIO<input autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)}/></label><label className="field-label">CONTRASEÑA<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="login-error" role="alert">{error}</div>}<button className="publish" disabled={busy}>{busy?'INGRESANDO…':'INICIAR SESIÓN'} <ArrowUpRight size={15}/></button></form><small>Panel reservado al equipo de Juno Studio.</small></div></main>
}

function Portfolio() {
  const [posts, setPosts] = useState(initialPosts)
  const [filter, setFilter] = useState('Todo')
  const [query, setQuery] = useState('')
  const [admin, setAdmin] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [form, setForm] = useState({title:'',caption:'',location:'',type:'Foto',media:[],cover:null})
  const [notice, setNotice] = useState('')
  const [uploading, setUploading] = useState(false)
  useEffect(() => {
    Promise.all([fetch('/api/posts'), fetch('/api/deleted-seeds')]).then(async ([postsResponse, hiddenResponse]) => {
      const saved = postsResponse.ok ? await postsResponse.json() : []
      const hidden = hiddenResponse.ok ? await hiddenResponse.json() : []
      setPosts([...saved, ...initialPosts.filter(post => !hidden.includes(post.id))])
    }).catch(() => {})
    fetch('/api/auth/status').then(response => response.json()).then(status => setAdmin(status.authenticated)).catch(() => {})
  }, [])
  const visible = useMemo(() => posts.filter(p => (filter === 'Todo' || p.type === filter) && `${p.title} ${p.caption} ${p.location}`.toLowerCase().includes(query.toLowerCase())), [posts, filter, query])
  const change = (key, value) => setForm(f => ({...f,[key]:value}))
  const filesChanged = async e => {
    const files = [...e.target.files]
    const loaded = files.map(file => ({file, video:file.type.startsWith('video/'), name:file.name}))
    change('media', [...form.media, ...loaded]); if (loaded.some(m=>m.video)) change('type','Video'); else if (form.media.length + loaded.length > 1) change('type','Carrusel')
  }
  const publish = async e => {
    e.preventDefault()
    if (!form.title.trim() || !form.media.length) return
    if (form.media.some(item => item.file.size === 0) || form.cover?.size === 0) {
      setNotice('Hay un archivo vac?o. Volv? a elegirlo.')
      setTimeout(() => setNotice(''), 3000)
      return
    }
    const body = new FormData()
    body.set('title', form.title)
    body.set('caption', form.caption)
    body.set('location', form.location)
    form.media.forEach(item => body.append('media', item.file))
    if (form.cover) body.append('cover', form.cover)
    setUploading(true)
    try {
      const response = await fetch('/api/admin/posts', { method: 'POST', body })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'No se pudo publicar')
      setPosts(current => [result, ...current])
      setForm({ title: '', caption: '', location: '', type: 'Foto', media: [], cover: null })
      setFormOpen(false)
      setNotice('Publicado con ?xito')
    } catch (error) {
      setNotice(error.message || 'No se pudo conectar con el servidor')
    } finally {
      setUploading(false)
      setTimeout(() => setNotice(''), 3500)
    }
  }
  const deletePost = async (event, post) => { event.stopPropagation(); if (!window.confirm(`¿Borrar “${post.title}”? Esta acción no se puede deshacer.`)) return; try { const response = await fetch(`/api/admin/posts/${encodeURIComponent(post.id)}`, {method:'DELETE'}); if (!response.ok) { const result=await response.json(); throw new Error(result.error || 'No se pudo borrar la publicación') }; setPosts(current=>current.filter(item=>item.id!==post.id)); if (active?.id===post.id) closeDetail(); setNotice('Publicación eliminada') } catch(error) { setNotice(error.message || 'No se pudo conectar con el servidor') }; setTimeout(()=>setNotice(''),3000) }
  const logout = async () => { await fetch('/api/auth/logout', {method:'POST'}); setAdmin(false); setFormOpen(false) }
  const [slide,setSlide] = useState(0)
  const closeDetail = () => { setActive(null); setSlide(0) }
  return <>
    <header className="topbar"><a className="wordmark" href="#inicio"><img src="/juno-logo.png" alt="Juno Studio"/></a><nav><a href="#trabajo">TRABAJO</a><a href="#sobre">EL ESTUDIO</a><a href="https://junostudio.art/#contacto">CONTACTO <ArrowUpRight size={13}/></a></nav><div className="top-actions">{admin&&<button className="admin-toggle" onClick={logout}>CERRAR SESIÓN</button>}<button className="menu-btn" aria-label="Abrir menú"><Menu/></button></div></header>
    <main id="inicio"><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> BRANDING · AUDIOVISUAL · DISEÑO DIGITAL</div><h1>Ideas que<br/>hacen <em>marca.</em></h1><p>Acompañamos marcas a verse, sonar<br/>y sentirse como ellas mismas.</p><a className="discover" href="#trabajo">DESCUBRIR EL TRABAJO <ArrowDown size={14}/></a></div><div className="hero-visual hero-empty" aria-hidden="true"></div><div className="hero-index">PORTAFOLIO INDEPENDIENTE <span>BUENOS AIRES · 2024</span></div></section>
    <section className="work" id="trabajo"><div className="section-top"><div><div className="eyebrow"><span className="eyebrow-line"/> SELECCIÓN PERSONAL</div><h2>Proyectos <em>destacados</em></h2></div><div className="work-meta">{String(visible.length).padStart(2,'0')} PUBLICACIONES</div></div>
      <div className="toolbar"><div className="filters">{['Todo','Foto','Video','Carrusel'].map(f=><button key={f} onClick={()=>setFilter(f)} className={filter===f?'selected':''}>{f}</button>)}</div><label className="search"><Search size={15}/><input placeholder="Buscar historias" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
      <div className="grid">{visible.map((post,i)=><article key={post.id} className="post-card" onClick={()=>{setActive(post);setSlide(0)}}><div className="post-image">{post.cover?<img src={post.cover} loading="lazy"/>:post.media[0]?.video?<video className="post-thumb-video" src={post.media[0].src||post.media[0]} muted playsInline preload="metadata"/>:<img src={typeof post.media[0]==='string'?post.media[0]:post.media[0]?.src} loading="lazy"/>}<div className="image-overlay"/><span className="post-kind">{post.type==='Video'?<Clapperboard size={13}/>:post.type==='Carrusel'?<Images size={13}/>:<Camera size={13}/>} {post.type.toUpperCase()}</span>{post.type==='Carrusel'&&<span className="multiple">{post.media.length} <Images size={13}/></span>}{admin&&<button className="delete-post" aria-label={`Borrar ${post.title}`} title="Borrar publicación" onClick={event=>deletePost(event,post)}><Trash2 size={16}/></button>}<button className="open-post" aria-label="Abrir publicación"><ArrowUpRight/></button></div><div className="post-info"><div><h3>{post.title}</h3><p>{post.caption}</p></div><span className="post-date">{post.date}</span><div className="post-location">{post.location}</div></div></article>)}</div>
      {visible.length===0&&<div className="empty">No encontramos publicaciones con esa búsqueda.</div>}
      <div className="work-footer"><span>UNA MIRADA PERSONAL SOBRE EL MUNDO.</span><span>DESLIZÁ PARA EXPLORAR <ArrowDown size={13}/></span></div>
    </section><section className="about" id="sobre"><div className="about-mark">J.</div><div><div className="eyebrow"><span className="eyebrow-line"/> EL ESTUDIO</div><h2>Ideas que<br/>se vuelven <em>marca.</em></h2></div><div className="about-copy"><p>Somos un estudio creativo que combina estrategia, identidad y contenido para que cada marca encuentre su propia forma de hacerse ver.</p><a href="mailto:contacto@junostudio.art">HABLEMOS DE TU MARCA <ArrowUpRight size={14}/></a></div></section>
    <footer><a className="wordmark" href="#inicio"><img src="/juno-logo.png" alt="Juno Studio"/></a><span>ESTUDIO CREATIVO ? ARGENTINA</span><div><a href="mailto:contacto@junostudio.art">CONTACTO</a><a href="#inicio">VOLVER ARRIBA ↑</a></div><small>© 2024 JUNO STUDIO</small></footer></main>
    {admin&&<button className="add-post" onClick={()=>setFormOpen(true)}><Plus size={17}/> NUEVA PUBLICACIÓN</button>}
    {notice&&<div className="toast"><Check size={16}/>{notice}</div>}
    {active&&<div className="modal-backdrop" onClick={closeDetail}><div className="detail-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={closeDetail}><X/></button><div className="detail-image">{active.media[slide]?.video?<video src={active.media[slide].src||active.media[slide]} poster={active.cover||undefined} controls playsInline preload="auto" onError={()=>{setNotice('No se pudo reproducir: el archivo puede estar vacío o usar un códec incompatible.');setTimeout(()=>setNotice(''),4500)}}/>:<img src={typeof active.media[slide]==='string'?active.media[slide]:active.media[slide]?.src}/ >}{active.media.length>1&&<><button className="slide prev" onClick={()=>setSlide((slide-1+active.media.length)%active.media.length)}><ChevronLeft/></button><button className="slide next" onClick={()=>setSlide((slide+1)%active.media.length)}><ChevronRight/></button><div className="slide-count">{slide+1} / {active.media.length}</div></>}</div><div className="detail-copy"><div className="eyebrow">{active.type.toUpperCase()} · {active.location}</div><h2>{active.title}</h2><p>{active.caption}</p><span>{active.date}</span></div></div></div>}
    {formOpen&&<div className="modal-backdrop" onClick={()=>setFormOpen(false)}><form className="upload-modal" onSubmit={publish} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setFormOpen(false)}><X/></button><div className="eyebrow"><span className="eyebrow-line"/> PANEL DE ADMINISTRACIÓN</div><h2>Nueva <em>historia.</em></h2><label className="field-label">TÍTULO<input required value={form.title} onChange={e=>change('title',e.target.value)} placeholder="Ej. Luz de invierno"/></label><label className="field-label">PIE DE PUBLICACIÓN<textarea value={form.caption} onChange={e=>change('caption',e.target.value)} placeholder="Contá algo sobre esta historia..." rows="3"/></label><label className="field-label">LUGAR<input value={form.location} onChange={e=>change('location',e.target.value)} placeholder="Buenos Aires, Argentina"/></label><label className="file-drop"><input type="file" accept="image/*,video/*" multiple onChange={filesChanged}/><span className="file-icon"><Plus/></span><strong>Elegí fotos o videos</strong><small>Podés seleccionar varios archivos. Videos: hasta 50 MB. Se optimizan al publicar.</small></label><label className="cover-picker"><span>PORTADA OPCIONAL</span><input type="file" accept="image/*" onChange={e=>change("cover",e.target.files[0]||null)}/><small>Se usa como miniatura del post, sin sumarse al carrusel.</small></label>{form.cover&&<div className="cover-selected">Portada: {form.cover.name}<button type="button" onClick={()=>change("cover",null)}>Quitar</button></div>}{form.media.length>0&&<div className="selected-files">{form.media.map((m,i)=><span key={i}>{m.name} <button type="button" onClick={()=>change('media',form.media.filter((_,ix)=>ix!==i))}><X size={12}/></button></span>)}</div>}<button className="publish" type="submit" disabled={uploading}>{uploading ? "SUBIENDO Y OPTIMIZANDO?" : "PUBLICAR HISTORIA"} <ArrowUpRight size={15}/></button><small className="storage-note">Los archivos se guardan en el servidor del sitio.</small></form></div>}
  </>
}

function App() { return window.location.pathname === '/login' ? <LoginPage/> : <Portfolio/> }
export default App
