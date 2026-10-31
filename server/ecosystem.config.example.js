// Copy to ecosystem.config.js on the server and fill in real values.
// ecosystem.config.js is gitignored -- never commit secrets.
//
//   cp ecosystem.config.example.js ecosystem.config.js
//   nano ecosystem.config.js
//   pm2 start ecosystem.config.js && pm2 save
//
// Generate a JWT secret with:  openssl rand -hex 48
module.exports = {
  apps: [
    {
      name: 'carterthetownwear-api',
      script: 'index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DB_HOST: 'localhost',
        DB_USER: 'cttw',
        DB_PASSWORD: 'CHANGE_ME',
        DB_NAME: 'carterthetown',
        JWT_SECRET: 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',
        TRUST_PROXY_HOPS: 1, // 2 only if a provider proxy sits in front of Apache (see README)
        CORS_ORIGIN: 'https://www.carterthetownwear.com',
      },
    },
  ],
};
