import dotenv from 'dotenv'
import express from 'express'
import session from 'express-session'
import FileStoreFactory from 'session-file-store'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import ffmpegPath from 'ffmpeg-static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env.local') })
const app = express()
const FileStore = FileStoreFactory(session)
const port = Number(process.env.PORT || 3000)
const production = process.env.NODE_ENV === 'production'
const dataDir = path.join(__dirname, 'data')
const uploadsDir = path.join(__dirname, 'uploads')
const postsFile = path.join(dataDir, 'posts.json')
const deletedSeedsFile = path.join(dataDir, 'deleted-seeds.json')
const seedPostIds = new Set([1, 2, 3, 4])

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
  console.error('Faltan ADMIN_USERNAME, ADMIN_PASSWORD o SESSION_SECRET en el entorno.')
  process.exit(1)
}
if (production && (!process.env.APP_ORIGIN || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  console.error('En producción configurá APP_ORIGIN y un SESSION_SECRET aleatorio de al menos 32 caracteres.')
  process.exit(1)
}

await mkdir(dataDir, { recursive: true })
await mkdir(uploadsDir, { recursive: true })
app.disable('x-powered-by')
if (production && process.env.TRUST_PROXY === '1') app.set('trust proxy', 1)
app.use('/uploads', express.static(uploadsDir, { index: false, dotfiles: 'deny', maxAge: '7d', immutable: true }))
app.use(session({
  name: 'juno.sid',
  secret: process.env.SESSION_SECRET,
  store: new FileStore({ path: path.join(dataDir, 'sessions'), ttl: 60 * 60 * 8, retries: 0, logFn: () => {} }),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: production, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000, path: '/' },
}))

const allowedOrigins = new Set([
  process.env.APP_ORIGIN,
  ...(production ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:45553']),
].filter(Boolean))
const checkOrigin = (req, res, next) => {
  if (!allowedOrigins.has(req.get('origin'))) return res.status(403).json({ error: 'Solicitud no permitida.' })
  next()
}
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiados intentos. Esperá unos minutos y probá otra vez.' } })
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadsDir),
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
})
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => callback(null, file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')),
})
const isAdmin = (req, res, next) => req.session?.admin === true ? next() : res.status(401).json({ error: 'Iniciá sesión para continuar.' })
const sameSecret = (provided, expected) => {
  const a = Buffer.from(String(provided ?? ''))
  const b = Buffer.from(String(expected))
  return a.length === b.length && timingSafeEqual(a, b)
}
const readPosts = async () => {
  try { return JSON.parse(await readFile(postsFile, 'utf8')) } catch (error) { if (error.code === 'ENOENT') return []; throw error }
}
const readDeletedSeedIds = async () => {
  try { return JSON.parse(await readFile(deletedSeedsFile, 'utf8')) } catch (error) { if (error.code === 'ENOENT') return []; throw error }
}
const compressVideo = file => new Promise((resolve, reject) => {
  const temporaryPath = `${file.path}.compressed.mp4`
  const finalPath = path.join(uploadsDir, `${path.parse(file.filename).name}.mp4`)
  const backupPath = `${file.path}.original`
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', file.path,
    '-map', '0:v:0', '-map', '0:a?',
    '-vf', "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p",
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '28', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-map_metadata', '-1', temporaryPath,
  ]
  const child = spawn(ffmpegPath, args, { windowsHide: true })
  let details = ''
  child.stderr.on('data', chunk => { details = (details + chunk.toString()).slice(-3000) })
  child.once('error', error => reject(error))
  child.once('close', async code => {
    if (code !== 0) {
      await unlink(temporaryPath).catch(() => {})
      return reject(new Error(details || `FFmpeg terminó con código ${code}`))
    }
    try {
      const converted = await stat(temporaryPath)
      if (!converted.size) throw new Error('FFmpeg generó un archivo vacío')
      await rename(file.path, backupPath)
      try { await rename(temporaryPath, finalPath) } catch (error) { await rename(backupPath, file.path); throw error }
      await unlink(backupPath).catch(() => {})
      file.path = finalPath
      file.filename = path.basename(finalPath)
      file.mimetype = 'video/mp4'
      file.size = converted.size
      resolve(file)
    } catch (error) {
      await unlink(temporaryPath).catch(() => {})
      reject(error)
    }
  })
})

app.get('/api/auth/status', (req, res) => res.json({ authenticated: req.session?.admin === true }))
app.get('/api/posts', async (_req, res, next) => {
  try { res.json((await readPosts()).map(post => post.media?.length > 1 ? { ...post, type: 'Carrusel' } : post)) } catch (error) { next(error) }
})
app.get('/api/deleted-seeds', async (_req, res, next) => {
  try { res.json(await readDeletedSeedIds()) } catch (error) { next(error) }
})
app.post('/api/auth/login', checkOrigin, loginLimit, express.json({ limit: '8kb' }), (req, res, next) => {
  if (!sameSecret(req.body?.username, process.env.ADMIN_USERNAME) || !sameSecret(req.body?.password, process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' })
  }
  req.session.regenerate(error => {
    if (error) return next(error)
    req.session.admin = true
    req.session.save(saveError => saveError ? next(saveError) : res.json({ authenticated: true }))
  })
})
app.post('/api/auth/logout', checkOrigin, isAdmin, (req, res, next) => req.session.destroy(error => {
  if (error) return next(error)
  res.clearCookie('juno.sid', { httpOnly: true, secure: production, sameSite: 'strict', path: '/' })
  res.status(204).end()
}))
app.post('/api/admin/posts', checkOrigin, isAdmin, upload.fields([{ name: 'media', maxCount: 10 }, { name: 'cover', maxCount: 1 }]), async (req, res, next) => {
  try {
    const files = req.files?.media || []
    const coverFile = req.files?.cover?.[0]
    const uploadedFiles = Object.values(req.files || {}).flat()
    const title = String(req.body?.title || '').trim().slice(0, 120)
    if (uploadedFiles.some(file => file.size === 0)) {
      await Promise.all(uploadedFiles.map(file => unlink(file.path).catch(() => {})))
      return res.status(400).json({ error: 'Uno de los archivos está vacío. Volvé a elegirlo.' })
    }
    if (coverFile && !coverFile.mimetype.startsWith('image/')) {
      await Promise.all(uploadedFiles.map(file => unlink(file.path).catch(() => {})))
      return res.status(400).json({ error: 'La portada tiene que ser una imagen.' })
    }
    if (!title || !files.length) {
      await Promise.all(uploadedFiles.map(file => unlink(file.path).catch(() => {})))
      return res.status(400).json({ error: 'Agregá un título y al menos un archivo.' })
    }
    try {
      for (const file of files) if (file.mimetype.startsWith('video/')) await compressVideo(file)
    } catch (error) {
      console.error('No se pudo comprimir el video:', error.message)
      await Promise.all(uploadedFiles.map(file => unlink(file.path).catch(() => {})))
      return res.status(422).json({ error: 'No pudimos procesar ese video. Probá con un archivo MP4, MOV o WebM válido.' })
    }
    const type = files.length > 1 ? 'Carrusel' : files[0].mimetype.startsWith('video/') ? 'Video' : 'Foto'
    const post = {
      id: randomUUID(), type, title,
      ...(coverFile ? { cover: `/uploads/${coverFile.filename}` } : {}),
      caption: String(req.body?.caption || '').trim().slice(0, 1200),
      location: String(req.body?.location || '').trim().slice(0, 120).toUpperCase(),
      date: new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date()).replaceAll('/', '.'),
      media: files.map(file => ({ src: `/uploads/${file.filename}`, video: file.mimetype.startsWith('video/'), name: path.basename(file.originalname) })),
    }
    const posts = await readPosts()
    posts.unshift(post)
    await writeFile(postsFile, JSON.stringify(posts, null, 2), 'utf8')
    res.status(201).json(post)
  } catch (error) { next(error) }
})
app.delete('/api/admin/posts/:id', checkOrigin, isAdmin, async (req, res, next) => {
  try {
    const posts = await readPosts()
    const post = posts.find(item => item.id === req.params.id)
    if (!post) {
      const seedId = Number(req.params.id)
      if (!seedPostIds.has(seedId)) return res.status(404).json({ error: 'No encontramos esa publicación.' })
      const deletedIds = await readDeletedSeedIds()
      if (!deletedIds.includes(seedId)) await writeFile(deletedSeedsFile, JSON.stringify([...deletedIds, seedId]), 'utf8')
      return res.status(204).end()
    }
    await writeFile(postsFile, JSON.stringify(posts.filter(item => item.id !== post.id), null, 2), 'utf8')
    const storedFiles = [...(post.media || []).map(media => media.src), post.cover].filter(Boolean)
    await Promise.all(storedFiles.map(src => {
      if (typeof src !== 'string' || !src.startsWith('/uploads/')) return Promise.resolve()
      return unlink(path.join(uploadsDir, path.basename(src))).catch(error => { if (error.code !== 'ENOENT') throw error })
    }))
    res.status(204).end()
  } catch (error) { next(error) }
})

if (production) {
  const distDir = path.join(__dirname, 'dist')
  app.use(express.static(distDir))
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
}
app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Cada archivo puede pesar hasta 50 MB.' : 'No se pudieron recibir los archivos.' })
  console.error(error)
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' })
})

app.listen(port, () => console.log(`Juno Studio escuchando en http://localhost:${port}`))
