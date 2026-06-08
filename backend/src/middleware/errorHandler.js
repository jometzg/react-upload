export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found' })
}

export function errorHandler(err, req, res, next) {
  console.error(err)

  const statusCode = err.statusCode || 500
  const message = statusCode >= 500 ? 'Internal server error' : err.message

  res.status(statusCode).json({ error: message })
}
