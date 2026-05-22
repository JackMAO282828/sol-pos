module.exports = {
  apps: [
    {
      name: 'sollll-api',
      cwd: __dirname,
      script: 'apps/backend/dist/server.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '150M',
      node_args: '--max-old-space-size=128',
      env: {
        NODE_ENV: 'production',
        PORT: '4000'
      }
    }
  ]
};
