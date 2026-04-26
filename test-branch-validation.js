const axios = require('axios');

// Configuración
const API_BASE = 'http://localhost:4000/api';
const BRANCH_ID = 'central-uuid'; // Reemplazar con ID real

// Simular diferentes usuarios y roles
const testUsers = [
  { email: 'root@electrotec.com', password: 'RootSecurePassword123!', role: 'root' },
  { email: 'vendedor@electrotec.com', password: 'password123', role: 'vendedor' },
  { email: 'cajero@electrotec.com', password: 'password123', role: 'cajero' }
];

async function testBranchValidation() {
  console.log('🧪 Iniciando pruebas de validación de sucursales...\n');

  for (const testUser of testUsers) {
    console.log(`👤 Probando usuario: ${testUser.email} (Rol: ${testUser.role})`);
    
    try {
      // 1️⃣ Login para obtener token
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });

      const token = loginResponse.data.access_token;
      console.log(`✅ Login exitoso`);

      // 2️⃣ Probar múltiples requests para ver comportamiento aleatorio
      console.log(`🎲 Probando 20 requests para ver validación aleatoria...`);
      
      let validationCount = 0;
      let skipCount = 0;

      for (let i = 1; i <= 20; i++) {
        try {
          const startTime = Date.now();
          
          const response = await axios.get(
            `${API_BASE}/branches/test-validation/${BRANCH_ID}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-Branch-ID': BRANCH_ID,
                'Content-Type': 'application/json'
              }
            }
          );

          const endTime = Date.now();
          const responseTime = endTime - startTime;

          // Analizar logs para contar validaciones vs skips
          console.log(`Request ${i}: ${responseTime}ms - Status: ${response.status}`);
          
          // Pequeña pausa entre requests
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          if (error.response && error.response.status === 401) {
            console.log(`❌ Request ${i}: Access denied`);
            skipCount++;
          } else {
            console.log(`🚫 Request ${i}: Error - ${error.message}`);
          }
        }
      }

      console.log(`📊 Resultados para ${testUser.role}:`);
      console.log(`   - Requests totales: 20`);
      console.log(`   - Validaciones: ${validationCount}`);
      console.log(`   - Skip: ${skipCount}`);
      console.log(`   - Tasa de validación: ${(validationCount/20*100).toFixed(1)}%\n`);

    } catch (error) {
      console.log(`❌ Error con usuario ${testUser.email}: ${error.response?.data?.message || error.message}\n`);
    }
  }
}

// Función para probar con un usuario específico
async function testSpecificUser() {
  console.log('🎯 Probando con usuario específico...');
  
  const token = 'your-jwt-token-here'; // Reemplazar con token real
  
  for (let i = 1; i <= 10; i++) {
    try {
      const response = await axios.get(
        `${API_BASE}/branches/test-validation/${BRANCH_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Branch-ID': BRANCH_ID
          }
        }
      );
      
      console.log(`✅ Request ${i}: ${response.data.message}`);
      console.log(`   Current Branch: ${response.data.currentBranch}`);
      console.log(`   Permissions: ${JSON.stringify(response.data.branchPermissions, null, 2)}`);
      console.log(`   Timestamp: ${response.data.timestamp}\n`);
      
    } catch (error) {
      console.log(`❌ Request ${i}: ${error.response?.data?.message || error.message}\n`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Ejecutar pruebas
if (require.main === module) {
  testBranchValidation()
    .then(() => console.log('🏁 Pruebas completadas'))
    .catch(error => console.error('💥 Error en pruebas:', error));
}

module.exports = { testBranchValidation, testSpecificUser };
