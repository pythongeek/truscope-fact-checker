// Simple verification script to test APIs
const testEndpoints = [
  '/api/health',
  '/api/blob/health'  // If you have health check endpoints
];

const verifyDeployment = async () => {
  console.log('🔍 Verifying deployment...');

  for (const endpoint of testEndpoints) {
    try {
      const response = await fetch(`${process.env.VERCEL_URL}${endpoint}`);
      console.log(`✅ ${endpoint}: ${response.status}`);
    } catch (error) {
      console.log(`❌ ${endpoint}: Failed - ${error.message}`);
    }
  }

  console.log('✅ Deployment verification complete');
};

verifyDeployment();