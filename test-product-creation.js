const axios = require('axios');

// Configuración
const API_BASE = 'http://localhost:4000/api';

// Credenciales de prueba
const ROOT_CREDENTIALS = {
  email: 'root@electrotec.com',
  password: 'RootSecurePassword123!'
};

let authToken = null;
let currentBranchId = null;

// Función para hacer login
async function login() {
  try {
    console.log('🔐 Iniciando sesión como root...');
    const response = await axios.post(`${API_BASE}/auth/login`, ROOT_CREDENTIALS);
    
    authToken = response.data.access_token;
    console.log('✅ Login exitoso');
    console.log('📋 Usuario:', response.data.user);
    console.log('🎫 Token:', authToken.substring(0, 50) + '...');
    
    return authToken;
  } catch (error) {
    console.error('❌ Error en login:', error.response?.data || error.message);
    throw error;
  }
}

// Función para obtener sucursales
async function getBranches() {
  try {
    console.log('\n🏪 Obteniendo sucursales...');
    const response = await axios.get(`${API_BASE}/branches`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    console.log('✅ Sucursales encontradas:');
    response.data.forEach((branch, index) => {
      console.log(`  ${index + 1}. ${branch.name} (ID: ${branch.id})`);
      if (index === 0) currentBranchId = branch.id; // Usar la primera como default
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo sucursales:', error.response?.data || error.message);
    throw error;
  }
}

// Función para obtener categorías
async function getCategories() {
  try {
    console.log('\n📂 Obteniendo categorías...');
    const response = await axios.get(`${API_BASE}/categories`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    console.log('✅ Categorías encontradas:');
    response.data.forEach((category, index) => {
      console.log(`  ${index + 1}. ${category.name} (ID: ${category.id})`);
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo categorías:', error.response?.data || error.message);
    throw error;
  }
}

// Función para obtener marcas
async function getBrands() {
  try {
    console.log('\n🏷️ Obteniendo marcas...');
    const response = await axios.get(`${API_BASE}/brands`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    console.log('✅ Marcas encontradas:');
    response.data.forEach((brand, index) => {
      console.log(`  ${index + 1}. ${brand.name} (ID: ${brand.id})`);
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo marcas:', error.response?.data || error.message);
    throw error;
  }
}

// Test 1: Crear producto simple
async function testCreateSimpleProduct() {
  try {
    console.log('\n🧪 Test 1: Crear Producto Simple');
    console.log('=' .repeat(50));
    
    const productData = {
      name: 'Taladro Profesional Test',
      description: 'Taladro de alta potencia para trabajos profesionales',
      categoryId: 'category-uuid', // Reemplazar con ID real
      brandId: 'brand-uuid' // Reemplazar con ID real
    };
    
    console.log('📦 Enviando datos:', productData);
    
    const response = await axios.post(`${API_BASE}/products-base/create-simple`, productData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Branch-ID': currentBranchId,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Producto simple creado:');
    console.log('  ID:', response.data.id);
    console.log('  Nombre:', response.data.name);
    console.log('  Descripción:', response.data.description);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error creando producto simple:', error.response?.data || error.message);
    throw error;
  }
}

// Test 2: Agregar variante a producto existente
async function testAddVariant(productId) {
  try {
    console.log('\n🧪 Test 2: Agregar Variante a Producto Existente');
    console.log('=' .repeat(50));
    
    const variantData = {
      name: 'Variante Profesional',
      price: 3500.50,
      stock: 25,
      sku: 'TAL-PROF-001',
      minStock: 5,
      branchId: currentBranchId
    };
    
    console.log('📦 Enviando variante:', variantData);
    
    const response = await axios.post(`${API_BASE}/products-base/${productId}/add-variant`, variantData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Branch-ID': currentBranchId,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Variante agregada:');
    console.log('  Producto Base:', response.data.productBase.name);
    console.log('  Variante ID:', response.data.variant.id);
    console.log('  Variante Nombre:', response.data.variant.name);
    console.log('  Precio:', response.data.variant.price);
    console.log('  Stock:', response.data.variant.stock);
    
    if (response.data.stockLocation) {
      console.log('  Stock Location ID:', response.data.stockLocation.id);
      console.log('  Cantidad:', response.data.stockLocation.quantity);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Error agregando variante:', error.response?.data || error.message);
    throw error;
  }
}

// Test 3: Quick Create (producto + variante en uno)
async function testQuickCreate() {
  try {
    console.log('\n🧪 Test 3: Quick Create (Producto + Variante)');
    console.log('=' .repeat(50));
    
    const quickCreateData = {
      name: 'Sierra Circular Test',
      description: 'Sierra circular para cortes precisos',
      categoryId: 'category-uuid', // Reemplazar con ID real
      brandId: 'brand-uuid', // Reemplazar con ID real
      price: 2800.75,
      stock: 15,
      sku: 'SIE-CIRC-001',
      minStock: 3,
      branchId: currentBranchId
    };
    
    console.log('📦 Enviando datos quick-create:', quickCreateData);
    
    const response = await axios.post(`${API_BASE}/products-base/quick-create`, quickCreateData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Branch-ID': currentBranchId,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Quick create exitoso:');
    console.log('  Producto Base:', response.data.productBase.name);
    console.log('  Variante:', response.data.defaultVariant.name);
    console.log('  Precio:', response.data.defaultVariant.price);
    console.log('  Stock:', response.data.defaultVariant.stock);
    
    if (response.data.stockLocation) {
      console.log('  Stock en sucursal:', response.data.stockLocation.quantity);
    }
    
    console.log('  Mensaje:', response.data.message);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error en quick create:', error.response?.data || error.message);
    throw error;
  }
}

// Test 4: Obtener productos
async function testGetProducts() {
  try {
    console.log('\n🧪 Test 4: Obtener Lista de Productos');
    console.log('=' .repeat(50));
    
    const response = await axios.get(`${API_BASE}/products-base`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Branch-ID': currentBranchId
      }
    });
    
    console.log('✅ Productos encontrados:');
    response.data.forEach((product, index) => {
      console.log(`  ${index + 1}. ${product.name} (${product.brand?.name})`);
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach((variant, vIndex) => {
          console.log(`     📋 Variante ${vIndex + 1}: ${variant.name} - $${variant.price}`);
        });
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo productos:', error.response?.data || error.message);
    throw error;
  }
}

// Función principal de pruebas
async function runTests() {
  try {
    console.log('🚀 Iniciando Tests de Creación de Productos');
    console.log('⏰', new Date().toLocaleString());
    console.log('=' .repeat(60));
    
    // 1. Login
    await login();
    
    // 2. Obtener datos de referencia
    await getBranches();
    await getCategories();
    await getBrands();
    
    // 3. Ejecutar tests
    console.log('\n🎯 Ejecutando Tests de Productos...');
    
    // Test 1: Producto simple
    const simpleProduct = await testCreateSimpleProduct();
    
    // Test 2: Agregar variante
    await testAddVariant(simpleProduct.id);
    
    // Test 3: Quick create
    await testQuickCreate();
    
    // Test 4: Listar productos
    await testGetProducts();
    
    console.log('\n🎉 Todos los tests completados exitosamente!');
    console.log('⏰', new Date().toLocaleString());
    
  } catch (error) {
    console.error('\n💥 Error en los tests:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Ejecutar tests
if (require.main === module) {
  runTests();
}

module.exports = {
  login,
  getBranches,
  getCategories,
  getBrands,
  testCreateSimpleProduct,
  testAddVariant,
  testQuickCreate,
  testGetProducts,
  runTests
};
