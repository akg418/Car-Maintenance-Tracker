// Dev-server proxy: the app calls /backend/*, which is forwarded to the NestJS API.
// Override the API port with BACKEND_PORT (default 3000), e.g. `BACKEND_PORT=3001 npm start`.
// /backend is used as the prefix because API routes (/cars, /events) clash with app routes,
// and /api is taken by Swagger.
module.exports = {
  '/backend': {
    target: `http://localhost:${process.env.BACKEND_PORT || 3000}`,
    changeOrigin: true,
    pathRewrite: { '^/backend': '' },
  },
};
