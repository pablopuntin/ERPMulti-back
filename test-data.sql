-- Verificar si hay datos de prueba
SELECT COUNT(*) as total_orders FROM orders WHERE status IN ('approved', 'completed');
SELECT COUNT(*) as total_order_items FROM order_items WHERE approvedQuantity > 0;
SELECT COUNT(*) as total_products FROM product_variants;
SELECT COUNT(*) as total_categories FROM categories;
SELECT COUNT(*) as total_brands FROM brands;

-- Verificar datos específicos
SELECT o.id, o.remitoNumber, o.status, o.createdAt, o.total 
FROM orders o 
WHERE o.status IN ('approved', 'completed') 
LIMIT 5;

SELECT oi.id, oi.approvedQuantity, oi.price, oi.subtotal, oi.orderId,
       pv.name as variant_name, pv.sku
FROM order_items oi
LEFT JOIN product_variants pv ON oi.variantId = pv.id
WHERE oi.approvedQuantity > 0
LIMIT 5;
