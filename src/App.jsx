import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, Camera, Check, ChevronLeft, ChevronRight, Clapperboard, GripVertical, Images, Menu, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'

const projectCategories = [
  { value: 'branding', label: 'Branding' },
  { value: 'diseno-web', label: 'Diseño web' },
  { value: 'audiovisual', label: 'Audiovisual' },
  { value: 'social-media', label: 'Social media' },
  { value: 'diseno', label: 'Diseño' },
]
const categoryLabel = value => projectCategories.find(category => category.value === value)?.label || ''
const dateForInput = value => {
  const match = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(String(value || ''))
  if (match) return `20${match[3]}-${match[2]}-${match[1]}`
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : ''
}
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
  const [posts, setPosts] = useState([])
  const [mediaRatios, setMediaRatios] = useState({})
  const [filter, setFilter] = useState('Todo')
  const [categoryFilter, setCategoryFilter] = useState('Todo')
  const [query, setQuery] = useState('')
  const [admin, setAdmin] = useState(false)
  const [reorderMode, setReorderMode] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [editingActive, setEditingActive] = useState(false)
  const [activeEdit, setActiveEdit] = useState({ title: '', caption: '', date: '', category: '', cover: null, removeCover: false })
  const [savingActiveEdit, setSavingActiveEdit] = useState(false)
  const [form, setForm] = useState({title:'',caption:'',location:'',type:'Foto',category:'',media:[],cover:null})
  const [notice, setNotice] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadStage, setUploadStage] = useState('')
  useEffect(() => {
    Promise.all([fetch('/api/posts'), fetch('/api/feed-order')]).then(async ([postsResponse, orderResponse]) => {
      const saved = postsResponse.ok ? await postsResponse.json() : []
      const order = orderResponse.ok ? await orderResponse.json() : []
      const rank = new Map(order.map((id, index) => [String(id), index]))
      setPosts(saved.sort((a, b) => (rank.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER) - (rank.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER)))
    }).catch(() => {})
    fetch('/api/auth/status').then(response => response.json()).then(status => setAdmin(status.authenticated)).catch(() => {})
  }, [])
  const activeCategories = useMemo(() => projectCategories.filter(category => posts.some(post => post.category === category.value)), [posts])
  useEffect(() => { if (categoryFilter !== 'Todo' && !activeCategories.some(category => category.value === categoryFilter)) setCategoryFilter('Todo') }, [categoryFilter, activeCategories])
  const visible = useMemo(() => reorderMode ? posts : posts.filter(p => (filter === 'Todo' || p.type === filter) && (categoryFilter === 'Todo' || p.category === categoryFilter) && `${p.title} ${p.caption} ${p.location}`.toLowerCase().includes(query.toLowerCase())), [posts, filter, categoryFilter, query, reorderMode])
  const change = (key, value) => setForm(f => ({...f,[key]:value}))
  const rememberRatio = (src, width, height) => {
    if (!src || !width || !height) return
    const ratio = `${width} / ${height}`
    setMediaRatios(current => current[src] === ratio ? current : { ...current, [src]: ratio })
  }
  const filesChanged = async e => {
    const files = [...e.target.files]
    const loaded = files.map(file => ({file, video:file.type.startsWith('video/'), name:file.name}))
    change('media', [...form.media, ...loaded]); if (loaded.some(m=>m.video)) change('type','Video'); else if (form.media.length + loaded.length > 1) change('type','Carrusel'); e.target.value = ''
  }
  const publish = async e => {
    e.preventDefault()
    if (!form.title.trim() || !form.media.length || !form.category) return
    if (form.media.some(item => item.file.size === 0) || form.cover?.size === 0) {
      setNotice('Hay un archivo vacío. Volvé a elegirlo.')
      setTimeout(() => setNotice(''), 3000)
      return
    }
    const body = new FormData()
    body.set('title', form.title)
    body.set('caption', form.caption)
    body.set('location', form.location)
    body.set('category', form.category)
    form.media.forEach(item => body.append('media', item.file))
    if (form.cover) body.append('cover', form.cover)
    const hasVideo = form.media.some(item => item.video)
    setUploading(true)
    setUploadPercent(0)
    setUploadStage('sending')
    try {
      const result = await new Promise((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open('POST', '/api/admin/posts')
        request.upload.addEventListener('progress', event => {
          if (event.lengthComputable) setUploadPercent(Math.round((event.loaded / event.total) * 100))
        })
        request.upload.addEventListener('load', () => setUploadStage(hasVideo ? 'processing' : 'saving'))
        request.addEventListener('load', () => {
          let payload = {}
          try { payload = JSON.parse(request.responseText || '{}') } catch {}
          if (request.status < 200 || request.status >= 300) return reject(new Error(payload?.error || 'No se pudo publicar'))
          resolve(payload)
        })
        request.addEventListener('error', () => reject(new Error('No se pudo conectar con el servidor')))
        request.send(body)
      })
      setPosts(current => [result, ...current])
      setForm({ title: '', caption: '', location: '', type: 'Foto', category: '', media: [], cover: null })
      setFormOpen(false)
      setNotice('Publicado con éxito')
    } catch (error) {
      setNotice(error.message || 'No se pudo conectar con el servidor')
    } finally {
      setUploading(false)
      setUploadStage('')
      setTimeout(() => setNotice(''), 3500)
    }
  }
  const deletePost = async (event, post) => { event.stopPropagation(); if (!window.confirm(`¿Borrar “${post.title}”? Esta acción no se puede deshacer.`)) return; try { const response = await fetch(`/api/admin/posts/${encodeURIComponent(post.id)}`, {method:'DELETE'}); if (!response.ok) { const result=await response.json(); throw new Error(result.error || 'No se pudo borrar la publicación') }; setPosts(current=>current.filter(item=>item.id!==post.id)); if (active?.id===post.id) closeDetail(); setNotice('Publicación eliminada') } catch(error) { setNotice(error.message || 'No se pudo conectar con el servidor') }; setTimeout(()=>setNotice(''),3000) }
  const toggleReorder = () => {
    if (!reorderMode) { setFilter('Todo'); setCategoryFilter('Todo'); setQuery('') }
    setReorderMode(value => !value)
    setDraggingId(null)
  }
  const movePost = async (fromId, toId) => {
    const fromIndex = posts.findIndex(post => String(post.id) === String(fromId))
    const toIndex = posts.findIndex(post => String(post.id) === String(toId))
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return
    const next = [...posts]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setPosts(next)
    try {
      const response = await fetch('/api/admin/feed-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: next.map(post => post.id) }) })
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'No se pudo guardar el orden') }
    } catch (error) {
      setPosts(posts)
      setNotice(error.message || 'No se pudo guardar el orden')
      setTimeout(() => setNotice(''), 3000)
    }
  }
  const logout = async () => { await fetch('/api/auth/logout', {method:'POST'}); setAdmin(false); setFormOpen(false); setReorderMode(false) }
  const [slide,setSlide] = useState(0)
  const closeDetail = () => { setActive(null); setSlide(0); setEditingActive(false) }
  const startActiveEdit = () => {
    const fallbackCategory = active.type === 'Video' ? 'audiovisual' : active.type === 'Carrusel' ? 'social-media' : 'branding'
    const category = projectCategories.some(item => item.value === active.category) ? active.category : fallbackCategory
    setActiveEdit({ title: active.title || '', caption: active.caption || '', date: dateForInput(active.date), category, cover: null, removeCover: false })
    setEditingActive(true)
  }
  const changeActiveEdit = (key, value) => setActiveEdit(current => ({ ...current, [key]: value }))
  const saveActiveEdit = async event => {
    event.preventDefault()
    if (!active || savingActiveEdit) return
    const body = new FormData()
    body.set('title', activeEdit.title)
    body.set('caption', activeEdit.caption)
    body.set('date', activeEdit.date)
    body.set('category', activeEdit.category)
    body.set('removeCover', String(activeEdit.removeCover))
    if (activeEdit.cover) body.set('cover', activeEdit.cover)
    setSavingActiveEdit(true)
    try {
      const response = await fetch(`/api/admin/posts/${encodeURIComponent(active.id)}`, { method: 'PATCH', body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudieron guardar los cambios.')
      setPosts(current => current.map(post => post.id === result.id ? result : post))
      setActive(result)
      setEditingActive(false)
      setNotice('Cambios guardados')
    } catch (error) {
      setNotice(error.message || 'No se pudieron guardar los cambios.')
    } finally {
      setSavingActiveEdit(false)
      setTimeout(() => setNotice(''), 3500)
    }
  }
  return <>
    <header className="topbar"><a className="wordmark" href="#inicio"><img src="/juno-logo.png" alt="Juno Studio"/></a><nav><a href="#trabajo">TRABAJO</a><a href="#sobre">EL ESTUDIO</a><a href="https://junostudio.art/#contacto">CONTACTO <ArrowUpRight size={13}/></a></nav><div className="top-actions">{admin&&<button className="admin-toggle" onClick={logout}>CERRAR SESIÓN</button>}<button className="menu-btn" aria-label="Abrir menú"><Menu/></button></div></header>
    <main id="inicio"><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> BRANDING · AUDIOVISUAL · DISEÑO DIGITAL</div><h1>Ideas que<br/>hacen <em>marca.</em></h1><p>Acompañamos marcas a verse, sonar<br/>y sentirse como ellas mismas.</p><a className="discover" href="#trabajo">DESCUBRIR EL TRABAJO <ArrowDown size={14}/></a></div><div className="hero-visual hero-empty" aria-hidden="true"></div><div className="hero-index">PORTAFOLIO INDEPENDIENTE <span>BUENOS AIRES · 2024</span></div></section>
    <section className="work" id="trabajo"><div className="section-top"><div><div className="eyebrow"><span className="eyebrow-line"/> SELECCIÓN PERSONAL</div><h2>Proyectos <em>destacados</em></h2></div><div className="section-meta"><div className="work-meta">{String(visible.length).padStart(2,'0')} PUBLICACIONES</div>{admin&&<button className={'reorder-toggle '+(reorderMode?'active':'')} onClick={toggleReorder}><GripVertical size={14}/>{reorderMode?'LISTO':'ORDENAR FEED'}</button>}</div></div>
      {!reorderMode ? <><div className="toolbar"><div className="filters">{['Todo','Foto','Video','Carrusel'].map(f=><button key={f} onClick={()=>setFilter(f)} className={filter===f?'selected':''}>{f}</button>)}</div><label className="search"><Search size={15}/><input placeholder="Buscar historias" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>{activeCategories.length>0&&<div className="category-toolbar"><span>CATEGORÍAS</span><div className="filters"><button className={categoryFilter==='Todo'?'selected':''} onClick={()=>setCategoryFilter('Todo')}>Todas</button>{activeCategories.map(category=><button key={category.value} className={categoryFilter===category.value?'selected':''} onClick={()=>setCategoryFilter(category.value)}>{category.label}</button>)}</div></div>}</> : <div className="reorder-hint"><GripVertical size={15}/> Arrastrá las publicaciones para cambiar el orden. En celular, usá las flechas.</div>}
      <div className="grid">{visible.map((post,i)=><article key={post.id} className={'post-card '+(reorderMode?'reorder-card ':'')+(draggingId===post.id?'is-dragging':'')} onClick={()=>{if(!reorderMode){setActive(post);setSlide(0)}}} onDragOver={event=>{if(reorderMode)event.preventDefault()}} onDrop={event=>{if(!reorderMode)return;event.preventDefault();const fromId=event.dataTransfer.getData('text/plain');setDraggingId(null);movePost(fromId,post.id)}}><div className="post-image" style={{aspectRatio:mediaRatios[post.cover||post.media[0]?.src||post.media[0]]||'1 / 1'}}>{post.cover?<img src={post.cover} loading="lazy" onLoad={e=>rememberRatio(post.cover,e.currentTarget.naturalWidth,e.currentTarget.naturalHeight)}/>:post.media[0]?.video?<video className="post-thumb-video" src={post.media[0].src||post.media[0]} muted playsInline preload="metadata" onLoadedMetadata={e=>rememberRatio(post.media[0].src||post.media[0],e.currentTarget.videoWidth,e.currentTarget.videoHeight)}/>:<img src={typeof post.media[0]==='string'?post.media[0]:post.media[0]?.src} loading="lazy" onLoad={e=>rememberRatio(post.media[0]?.src||post.media[0],e.currentTarget.naturalWidth,e.currentTarget.naturalHeight)}/> }<div className="image-overlay"/><span className="post-kind">{post.type==='Video'?<Clapperboard size={13}/>:post.type==='Carrusel'?<Images size={13}/>:<Camera size={13}/>} {post.type.toUpperCase()}</span>{post.type==='Carrusel'&&<span className="multiple">{post.media.length} <Images size={13}/></span>}{admin&&<button className="delete-post" aria-label={`Borrar ${post.title}`} title="Borrar publicación" onClick={event=>deletePost(event,post)}><Trash2 size={16}/></button>}{admin&&reorderMode&&<div className="drag-controls"><button type="button" className="drag-handle" draggable onClick={event=>event.stopPropagation()} onDragStart={event=>{event.dataTransfer.setData('text/plain',String(post.id));event.dataTransfer.effectAllowed='move';setDraggingId(post.id)}} onDragEnd={()=>setDraggingId(null)} aria-label={`Arrastrar ${post.title}`} title="Arrastrar para ordenar"><GripVertical size={17}/></button><div><button type="button" disabled={i===0} onClick={event=>{event.stopPropagation();movePost(post.id,visible[i-1]?.id)}} aria-label="Mover hacia arriba"><ArrowUp size={14}/></button><button type="button" disabled={i===visible.length-1} onClick={event=>{event.stopPropagation();movePost(post.id,visible[i+1]?.id)}} aria-label="Mover hacia abajo"><ArrowDown size={14}/></button></div></div>}{!reorderMode&&<button className="open-post" aria-label="Abrir publicación"><ArrowUpRight/></button>}</div><div className="post-info"><div><h3>{post.title}</h3><p>{post.caption}</p></div><span className="post-date">{post.date}</span>{categoryLabel(post.category)&&<span className="post-category">{categoryLabel(post.category)}</span>}<div className="post-location">{post.location}</div></div></article>)}</div>
      {visible.length===0&&<div className="empty">{posts.length===0?'Todavía no hay publicaciones.':query?'No encontramos publicaciones con esa búsqueda.':'No hay publicaciones para este filtro.'}</div>}
      <div className="work-footer"><span>UNA MIRADA PERSONAL SOBRE EL MUNDO.</span><span>DESLIZÁ PARA EXPLORAR <ArrowDown size={13}/></span></div>
    </section><section className="about" id="sobre"><div className="about-mark">J.</div><div><div className="eyebrow"><span className="eyebrow-line"/> EL ESTUDIO</div><h2>Ideas que<br/>se vuelven <em>marca.</em></h2></div><div className="about-copy"><p>Somos un estudio creativo que combina estrategia, identidad y contenido para que cada marca encuentre su propia forma de hacerse ver.</p><a href="mailto:contacto@junostudio.art">HABLEMOS DE TU MARCA <ArrowUpRight size={14}/></a></div></section>
    <footer><a className="wordmark" href="#inicio"><img src="/juno-logo.png" alt="Juno Studio"/></a><span>ESTUDIO CREATIVO · ARGENTINA</span><div><a href="mailto:contacto@junostudio.art">CONTACTO</a><a href="#inicio">VOLVER ARRIBA ↑</a></div><small>© 2024 JUNO STUDIO</small></footer></main>
    {admin&&<button className="add-post" onClick={()=>setFormOpen(true)}><Plus size={17}/> NUEVA PUBLICACIÓN</button>}
    {notice&&<div className="toast"><Check size={16}/>{notice}</div>}
    {active&&<div className="modal-backdrop" onClick={closeDetail}><div className="detail-modal" onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={closeDetail}><X/></button><div className="detail-image" style={{aspectRatio:mediaRatios[active.media[slide]?.src||active.media[slide]]||'1 / 1'}}>{active.media[slide]?.video?<video src={active.media[slide].src||active.media[slide]} poster={active.cover||undefined} controls controlsList="nodownload" disablePictureInPicture playsInline preload="auto" onContextMenu={e=>e.preventDefault()} onLoadedMetadata={e=>rememberRatio(active.media[slide].src||active.media[slide],e.currentTarget.videoWidth,e.currentTarget.videoHeight)} onError={()=>{setNotice('No se pudo reproducir el archivo.');setTimeout(()=>setNotice(''),4500)}}/>:<img src={typeof active.media[slide]==='string'?active.media[slide]:active.media[slide]?.src} onLoad={e=>rememberRatio(active.media[slide]?.src||active.media[slide],e.currentTarget.naturalWidth,e.currentTarget.naturalHeight)}/>}{active.media.length>1&&<><button className="slide prev" onClick={()=>setSlide((slide-1+active.media.length)%active.media.length)}><ChevronLeft/></button><button className="slide next" onClick={()=>setSlide((slide+1)%active.media.length)}><ChevronRight/></button><div className="slide-count">{slide+1} / {active.media.length}</div></>}</div><div className="detail-copy">{editingActive?<form className="detail-edit-form" onSubmit={saveActiveEdit}><div className="eyebrow">EDITAR PUBLICACIÓN</div><label className="field-label">TÍTULO<input required maxLength="120" value={activeEdit.title} onChange={e=>changeActiveEdit('title',e.target.value)}/></label><label className="field-label">DESCRIPCIÓN<textarea maxLength="1200" rows="4" value={activeEdit.caption} onChange={e=>changeActiveEdit('caption',e.target.value)}/></label><label className="field-label">FECHA DEL TRABAJO<input required type="date" value={activeEdit.date} onChange={e=>changeActiveEdit('date',e.target.value)}/></label><label className="field-label">CATEGORÍA<select required value={activeEdit.category} onChange={e=>changeActiveEdit('category',e.target.value)}>{projectCategories.map(category=><option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label className="cover-picker"><span>PORTADA</span>{active.cover&&<small>Portada actual: <a href={active.cover} target="_blank" rel="noreferrer">ver imagen</a></small>}<input type="file" accept="image/*" onChange={e=>changeActiveEdit('cover',e.target.files[0]||null)}/>{activeEdit.cover&&<small>Nueva portada: {activeEdit.cover.name}</small>}{active.cover&&<span className="remove-cover-option"><input type="checkbox" checked={activeEdit.removeCover} onChange={e=>changeActiveEdit('removeCover',e.target.checked)}/> Quitar portada actual</span>}</label><div className="detail-edit-actions"><button className="publish" type="submit" disabled={savingActiveEdit}>{savingActiveEdit?'GUARDANDO…':<>GUARDAR CAMBIOS <Save size={15}/></>}</button><button className="edit-cancel" type="button" onClick={()=>setEditingActive(false)} disabled={savingActiveEdit}>Cancelar</button></div></form>:<><div className="eyebrow">{active.type.toUpperCase()} · {active.location}</div><h2>{active.title}</h2><p>{active.caption}</p><span>{active.date}</span>{admin&&<button type="button" className="edit-post-button" onClick={startActiveEdit}><Pencil size={14}/> EDITAR PUBLICACIÓN</button>}</>}</div></div></div>}

    {formOpen&&<div className="modal-backdrop" onClick={()=>setFormOpen(false)}><form className="upload-modal" onSubmit={publish} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setFormOpen(false)}><X/></button><div className="eyebrow"><span className="eyebrow-line"/> PANEL DE ADMINISTRACIÓN</div><h2>Nueva <em>historia.</em></h2><label className="field-label">TÍTULO<input required value={form.title} onChange={e=>change('title',e.target.value)} placeholder="Ej. Luz de invierno"/></label><label className="field-label">PIE DE PUBLICACIÓN<textarea value={form.caption} onChange={e=>change('caption',e.target.value)} placeholder="Contá algo sobre esta historia..." rows="3"/></label><label className="field-label">LUGAR<input value={form.location} onChange={e=>change('location',e.target.value)} placeholder="Buenos Aires, Argentina"/></label><label className="field-label">CATEGORÍA<select required value={form.category} onChange={e=>change('category',e.target.value)}><option value="">Elegí un área</option>{projectCategories.map(category=><option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label className="file-drop"><input type="file" accept="image/*,video/*" multiple onChange={filesChanged}/><span className="file-icon"><Plus/></span><strong>Elegí fotos o videos</strong><small>Podés seleccionar varios archivos. Sin límite fijo por archivo; el alojamiento puede aplicar sus propios límites. Los videos se optimizan al publicar.</small></label><label className="cover-picker"><span>PORTADA OPCIONAL</span><input type="file" accept="image/*" onChange={e=>change("cover",e.target.files[0]||null)}/><small>Se usa como miniatura del post, sin sumarse al carrusel.</small></label>{form.cover&&<div className="cover-selected">Portada: {form.cover.name}<button type="button" onClick={()=>change("cover",null)}>Quitar</button></div>}{form.media.length>0&&<div className="selected-files">{form.media.map((m,i)=><span key={i}>{m.name} <button type="button" onClick={()=>change('media',form.media.filter((_,ix)=>ix!==i))}><X size={12}/></button></span>)}</div>}{uploading&&<div className="upload-progress" role="status" aria-live="polite"><div className="upload-progress-label"><span>{uploadStage==='sending'?'Subiendo archivos':uploadStage==='processing'?'Optimizando video':'Guardando publicación'}</span><strong>{uploadStage==='processing'?'...':uploadPercent+'%'}</strong></div><div className="upload-progress-track"><div className={'upload-progress-fill '+(uploadStage==='processing'?'processing':'')} style={{width:(uploadStage==='processing'?100:uploadPercent)+'%'}}/></div><small>{uploadStage==='processing'?'La carga terminó; estamos preparando el video para la web.':'No cierres esta ventana hasta que termine la publicación.'}</small></div>}<button className="publish" type="submit" disabled={uploading}>{uploading ? "PUBLICANDO..." : "PUBLICAR HISTORIA"} <ArrowUpRight size={15}/></button><small className="storage-note">Los archivos se guardan en el servidor del sitio.</small></form></div>}
  </>
}

function App() { return window.location.pathname === '/login' ? <LoginPage/> : <Portfolio/> }
export default App
