export function errorHandler(err, req, res, next) {
  req.log.error(
    {
      err
    },
    'Unhandled application error'
  );

  res.status(500).json({
    error: 'Internal Server Error'
  });
}