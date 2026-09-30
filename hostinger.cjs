import('./server.js').catch(error => {
  console.error('No se pudo iniciar la aplicación Juno Studio:', error)
  process.exitCode = 1
})
