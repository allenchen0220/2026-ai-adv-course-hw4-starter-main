const app = require('./app');

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  if (!process.env.JWT_SECRET) {
    console.error('Fatal: JWT_SECRET is not set');
    process.exit(1);
  }
  if (process.env.ECPAY_ENV === 'production') {
    const missing = ['ECPAY_MERCHANT_ID', 'ECPAY_HASH_KEY', 'ECPAY_HASH_IV'].filter(key => !process.env[key]);
    if (missing.length > 0) {
      console.error(`Fatal: ${missing.join(', ')} must be set when ECPAY_ENV=production`);
      process.exit(1);
    }
  }
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    console.error('Fatal: ADMIN_PASSWORD must be set in production');
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
