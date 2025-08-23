module.exports = {
  apps: [
    {
      name: 'gbox-web-ui',
      script: 'npm',
      args: 'start',
      cwd: '/home/user/webapp/packages/web-ui',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        GBOX_API_URL: 'http://localhost:8080'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        GBOX_API_URL: 'http://localhost:8080'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};