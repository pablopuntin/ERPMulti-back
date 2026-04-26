import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Order } from './entities/order.entity';
import { OrderPaymentStatus } from './entities/order.entity';
import { OrderDeliveryEvent } from './entities/order-delivery-event.entity';

@Injectable()
export class RemitoPdfService {
  async generate(order: Order): Promise<Buffer> {
    return this.generateCumulative(order);
  }

  async generateCumulative(order: Order): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const originalDate = order.createdAt
        ? new Date(order.createdAt).toLocaleString('es-AR')
        : 'Sin fecha';
      const reprintDate = new Date().toLocaleString('es-AR');
      const customerName =
        order.customerNameSnapshot ||
        order.customer?.fullName ||
        'Cliente sin identificar';
      const sellerName =
        [order.user?.firstname, order.user?.lastname]
          .filter(Boolean)
          .join(' ') || 'Sin vendedor';
      const branchName = order.branch?.name || 'Sin sucursal';

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const left = 40;
      const right = pageWidth - 40;
      const contentWidth = right - left;
      const deliveredItems = (order.items || []).filter(
        (item) => Number(item.deliveredQuantity || 0) > 0
      );
      const pendingItems = (order.items || []).filter(
        (item) =>
          Math.max(
            Number(item.approvedQuantity || 0) -
              Number(item.deliveredQuantity || 0),
            0
          ) > 0
      );
      const showPrices = order.paymentStatus === OrderPaymentStatus.PAID;

      const drawBox = (x: number, y: number, width: number, height: number) => {
        doc.lineWidth(1).roundedRect(x, y, width, height, 6).stroke();
      };

      const drawSectionTitle = (title: string) => {
        doc.moveDown(0.8);
        const y = doc.y;
        doc.rect(left, y, contentWidth, 18).fillAndStroke('#f3f4f6', '#111827');
        doc
          .fillColor('#111827')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(title.toUpperCase(), left + 8, y + 5, {
            width: contentWidth - 16,
            align: 'left'
          });
        doc.moveDown(1.2);
        doc.fillColor('#111827').font('Helvetica').fontSize(10);
      };

      const drawTableHeader = () => {
        const y = doc.y;
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('CANT.', left + 6, y, { width: 55, align: 'left' });
        doc.text('DESCRIPCIÓN', left + 70, y, {
          width: showPrices ? 270 : contentWidth - 100,
          align: 'left'
        });
        if (showPrices) {
          doc.text('P. UNIT.', right - 130, y, { width: 55, align: 'right' });
          doc.text('SUBTOTAL', right - 70, y, { width: 64, align: 'right' });
        }
        doc
          .moveTo(left, y + 14)
          .lineTo(right, y + 14)
          .stroke();
        doc.moveDown(1.2);
        doc.font('Helvetica').fontSize(10);
      };

      const drawItems = (
        items: Order['items'],
        quantitySelector: (item: Order['items'][number]) => number
      ) => {
        if (!items.length) {
          doc
            .font('Helvetica-Oblique')
            .fontSize(10)
            .text('Sin ítems en esta sección.', left + 6, doc.y, {
              width: contentWidth - 12
            });
          doc.moveDown();
          doc.font('Helvetica').fontSize(10);
          return;
        }

        items.forEach((item) => {
          const quantity = quantitySelector(item);
          const unitPrice = Number(item.price || 0);
          const subtotal = quantity * unitPrice;
          const startY = doc.y;
          doc.font('Helvetica').fontSize(10);
          doc.text(String(quantity), left + 6, startY, {
            width: 55,
            align: 'left'
          });
          doc.text(item.variant?.name || 'Producto', left + 70, startY, {
            width: showPrices ? 270 : contentWidth - 100,
            align: 'left'
          });
          if (showPrices) {
            doc.text(
              `$${unitPrice.toLocaleString('es-AR')}`,
              right - 130,
              startY,
              { width: 55, align: 'right' }
            );
            doc.text(
              `$${subtotal.toLocaleString('es-AR')}`,
              right - 70,
              startY,
              { width: 64, align: 'right' }
            );
          }
          const infoLine = `${item.variant?.sku || 'Sin SKU'}${item.notes ? ` · ${item.notes}` : ''}`;
          doc
            .fillColor('#6b7280')
            .fontSize(8)
            .text(infoLine, left + 70, startY + 12, {
              width: 300,
              align: 'left'
            });
          doc
            .fillColor('#111827')
            .moveTo(left, startY + 28)
            .lineTo(right, startY + 28)
            .strokeColor('#d1d5db')
            .stroke()
            .strokeColor('#111827');
          doc.y = startY + 34;
        });
      };

      drawBox(left, 40, contentWidth, pageHeight - 80);
      drawBox(left + 8, 48, 280, 88);
      drawBox(left + 292, 48, contentWidth - 300, 88);

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .text('LOGO/NOMBRE', left + 18, 62);
      doc
        .font('Helvetica')
        .fontSize(10)
        .text('IMPORTACIÓN - EXPORTACIÓN', left + 55, 92);
      doc
        .fontSize(10)
        .text(branchName, left + 32, 114, { width: 230, align: 'center' });
      doc.fontSize(8).text(`Sucursal / Punto de retiro`, left + 32, 128, {
        width: 230,
        align: 'center'
      });

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .text('REMITO', left + 360, 58, { width: 160, align: 'center' });
      doc
        .font('Helvetica')
        .fontSize(8)
        .text('DOCUMENTO NO VÁLIDO COMO FACTURA', left + 338, 80, {
          width: 200,
          align: 'center'
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(order.remitoNumber || order.id, left + 320, 100, {
          width: 220,
          align: 'center'
        });
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(`Fecha original: ${originalDate}`, left + 310, 122, {
          width: 220,
          align: 'left'
        });
      doc.text(`Emisión / reimpresión: ${reprintDate}`, left + 310, 136, {
        width: 220,
        align: 'left'
      });

      drawBox(left + 8, 144, contentWidth - 16, 82);
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`Sr./es: ${customerName}`, left + 16, 156, {
          width: contentWidth - 32
        });
      doc.text(`Sucursal: ${branchName}`, left + 16, 174, { width: 250 });
      doc.text(`Vendedor: ${sellerName}`, left + 280, 174, { width: 220 });
      doc.text(
        `Contacto: ${order.customer?.phone || order.customer?.email || order.customer?.document || 'No informado'}`,
        left + 16,
        192,
        { width: contentWidth - 32 }
      );
      doc.text(
        `Condición de venta: ${Number(order.amountPaid || 0) >= Number(order.approvedTotal || order.total || 0) ? 'Contado' : 'Pendiente / CC futura'}`,
        left + 16,
        210,
        { width: 280 }
      );
      doc.text(`Estado del remito: ${order.status}`, left + 320, 210, {
        width: 180
      });

      doc.y = 240;
      drawSectionTitle('Productos entregados');
      drawTableHeader();
      drawItems(deliveredItems, (item) => Number(item.deliveredQuantity || 0));

      drawSectionTitle('Productos no entregados');
      drawTableHeader();
      drawItems(pendingItems, (item) =>
        Math.max(
          Number(item.approvedQuantity || 0) -
            Number(item.deliveredQuantity || 0),
          0
        )
      );

      drawSectionTitle('Resumen');
      const summaryY = doc.y;
      drawBox(left, summaryY, contentWidth, 74);
      if (showPrices) {
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(
            `Total pedido: $${Number(order.total || 0).toLocaleString('es-AR')}`,
            left + 12,
            summaryY + 12
          );
        doc.text(
          `Total aprobado: $${Number(order.approvedTotal || 0).toLocaleString('es-AR')}`,
          left + 12,
          summaryY + 28
        );
        doc.text(
          `Total entregado: $${Number(order.deliveredTotal || 0).toLocaleString('es-AR')}`,
          left + 12,
          summaryY + 44
        );
        doc.text(
          `Total cobrado: $${Number(order.amountPaid || 0).toLocaleString('es-AR')}`,
          left + 280,
          summaryY + 12
        );
        doc.text(
          `Saldo pendiente: $${Math.max(Number(order.approvedTotal || order.total || 0) - Number(order.amountPaid || 0), 0).toLocaleString('es-AR')}`,
          left + 280,
          summaryY + 28
        );
        doc.text(
          `Entrega pendiente: $${Math.max(Number(order.approvedTotal || 0) - Number(order.deliveredTotal || 0), 0).toLocaleString('es-AR')}`,
          left + 280,
          summaryY + 44
        );
      } else {
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(
            `Productos entregados: ${deliveredItems.length}`,
            left + 12,
            summaryY + 12
          );
        doc.text(
          `Productos pendientes: ${pendingItems.length}`,
          left + 12,
          summaryY + 28
        );
        doc.text(
          `Estado de pago: ${order.paymentStatus}`,
          left + 12,
          summaryY + 44
        );
        doc.text(
          `Entrega pendiente: ${Math.max(Number(order.approvedTotal || 0) - Number(order.deliveredTotal || 0), 0) > 0 ? 'Sí' : 'No'}`,
          left + 280,
          summaryY + 12
        );
        doc.text(
          `Importes ocultos por saldo pendiente`,
          left + 280,
          summaryY + 28
        );
      }
      doc.y = summaryY + 84;

      if (order.notes) {
        drawSectionTitle('Observaciones');
        drawBox(left, doc.y, contentWidth, 58);
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(order.notes, left + 10, doc.y + 10, {
            width: contentWidth - 20
          });
        doc.y += 68;
      }

      const footerY = pageHeight - 95;
      doc
        .moveTo(left + 20, footerY + 28)
        .lineTo(left + 220, footerY + 28)
        .stroke();
      doc
        .moveTo(right - 220, footerY + 28)
        .lineTo(right - 20, footerY + 28)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(9)
        .text('Aclaración / retiro', left + 52, footerY + 32, {
          width: 140,
          align: 'center'
        });
      doc.text('Recibí conforme', right - 188, footerY + 32, {
        width: 140,
        align: 'center'
      });
      doc
        .fontSize(7)
        .text(
          `Remito ${order.remitoNumber || order.id} · Fecha original ${originalDate} · Reimpresión ${reprintDate}`,
          left + 10,
          pageHeight - 52,
          { width: contentWidth - 20, align: 'center' }
        );

      doc.end();
    });
  }

  async generateDeliveryEvent(
    order: Order,
    deliveryEvent: OrderDeliveryEvent
  ): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const originalDate = order.createdAt
        ? new Date(order.createdAt).toLocaleString('es-AR')
        : 'Sin fecha';
      const eventDate = deliveryEvent.createdAt
        ? new Date(deliveryEvent.createdAt).toLocaleString('es-AR')
        : new Date().toLocaleString('es-AR');
      const customerName =
        order.customerNameSnapshot ||
        order.customer?.fullName ||
        'Cliente sin identificar';
      const sellerName =
        [order.user?.firstname, order.user?.lastname]
          .filter(Boolean)
          .join(' ') || 'Sin vendedor';
      const branchName = order.branch?.name || 'Sin sucursal';
      const showPrices = order.paymentStatus === OrderPaymentStatus.PAID;
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const left = 40;
      const right = pageWidth - 40;
      const contentWidth = right - left;
      const deliveredItems = (deliveryEvent.items || []).filter(
        (item) => Number(item.deliveredQuantity || 0) > 0
      );
      const pendingItems = (deliveryEvent.items || []).filter(
        (item) => Number(item.pendingQuantity || 0) > 0
      );

      const drawBox = (x: number, y: number, width: number, height: number) => {
        doc.lineWidth(1).roundedRect(x, y, width, height, 6).stroke();
      };

      const drawSectionTitle = (title: string) => {
        doc.moveDown(0.8);
        const y = doc.y;
        doc.rect(left, y, contentWidth, 18).fillAndStroke('#f3f4f6', '#111827');
        doc
          .fillColor('#111827')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(title.toUpperCase(), left + 8, y + 5, {
            width: contentWidth - 16,
            align: 'left'
          });
        doc.moveDown(1.2);
        doc.fillColor('#111827').font('Helvetica').fontSize(10);
      };

      const drawTableHeader = () => {
        const y = doc.y;
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('CANT.', left + 6, y, { width: 55, align: 'left' });
        doc.text('DESCRIPCIÓN', left + 70, y, {
          width: showPrices ? 270 : contentWidth - 100,
          align: 'left'
        });
        if (showPrices) {
          doc.text('P. UNIT.', right - 130, y, { width: 55, align: 'right' });
          doc.text('SUBTOTAL', right - 70, y, { width: 64, align: 'right' });
        }
        doc
          .moveTo(left, y + 14)
          .lineTo(right, y + 14)
          .stroke();
        doc.moveDown(1.2);
        doc.font('Helvetica').fontSize(10);
      };

      drawBox(left, 40, contentWidth, pageHeight - 80);
      drawBox(left + 8, 48, 280, 88);
      drawBox(left + 292, 48, contentWidth - 300, 88);

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .text('LOGO/NOMBRE', left + 18, 62);
      doc
        .font('Helvetica')
        .fontSize(10)
        .text('IMPORTACIÓN - EXPORTACIÓN', left + 55, 92);
      doc
        .fontSize(10)
        .text(branchName, left + 32, 114, { width: 230, align: 'center' });
      doc.fontSize(8).text('Sucursal / Punto de retiro', left + 32, 128, {
        width: 230,
        align: 'center'
      });

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .text('REMITO DE ENTREGA', left + 334, 58, {
          width: 200,
          align: 'center'
        });
      doc
        .font('Helvetica')
        .fontSize(8)
        .text('DOCUMENTO NO VÁLIDO COMO FACTURA', left + 338, 80, {
          width: 200,
          align: 'center'
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(order.remitoNumber || order.id, left + 320, 100, {
          width: 220,
          align: 'center'
        });
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(`Fecha original: ${originalDate}`, left + 310, 122, {
          width: 220,
          align: 'left'
        });
      doc.text(`Retiro puntual: ${eventDate}`, left + 310, 136, {
        width: 220,
        align: 'left'
      });

      drawBox(left + 8, 144, contentWidth - 16, 82);
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`Sr./es: ${customerName}`, left + 16, 156, {
          width: contentWidth - 32
        });
      doc.text(`Sucursal: ${branchName}`, left + 16, 174, { width: 250 });
      doc.text(`Vendedor: ${sellerName}`, left + 280, 174, { width: 220 });
      doc.text(
        `Contacto: ${order.customer?.phone || order.customer?.email || order.customer?.document || 'No informado'}`,
        left + 16,
        192,
        { width: contentWidth - 32 }
      );
      doc.text(
        `Condición de venta: ${Number(order.amountPaid || 0) >= Number(order.approvedTotal || order.total || 0) ? 'Contado' : 'Pendiente / CC futura'}`,
        left + 16,
        210,
        { width: 280 }
      );
      doc.text(`Estado del remito: ${order.status}`, left + 320, 210, {
        width: 180
      });

      doc.y = 240;
      drawSectionTitle('Productos retirados en esta entrega');
      drawTableHeader();

      if (!deliveredItems.length) {
        doc
          .font('Helvetica-Oblique')
          .fontSize(10)
          .text('Sin productos retirados en esta entrega.', left + 6, doc.y, {
            width: contentWidth - 12
          });
        doc.moveDown();
        doc.font('Helvetica').fontSize(10);
      } else {
        deliveredItems.forEach((item) => {
          const startY = doc.y;
          doc.font('Helvetica').fontSize(10);
          doc.text(
            String(Number(item.deliveredQuantity || 0)),
            left + 6,
            startY,
            { width: 55, align: 'left' }
          );
          doc.text(item.variantName || 'Producto', left + 70, startY, {
            width: showPrices ? 270 : contentWidth - 100,
            align: 'left'
          });
          if (showPrices) {
            doc.text(
              `$${Number(item.unitPrice || 0).toLocaleString('es-AR')}`,
              right - 130,
              startY,
              { width: 55, align: 'right' }
            );
            doc.text(
              `$${Number(item.subtotal || 0).toLocaleString('es-AR')}`,
              right - 70,
              startY,
              { width: 64, align: 'right' }
            );
          }
          doc
            .fillColor('#6b7280')
            .fontSize(8)
            .text(
              `${item.variantSku || 'Sin SKU'}${item.notes ? ` · ${item.notes}` : ''}`,
              left + 70,
              startY + 12,
              { width: 300, align: 'left' }
            );
          doc
            .fillColor('#111827')
            .moveTo(left, startY + 28)
            .lineTo(right, startY + 28)
            .strokeColor('#d1d5db')
            .stroke()
            .strokeColor('#111827');
          doc.y = startY + 34;
        });
      }

      drawSectionTitle('Saldo pendiente luego de esta entrega');
      drawTableHeader();

      if (!pendingItems.length) {
        doc
          .font('Helvetica-Oblique')
          .fontSize(10)
          .text(
            'Sin productos pendientes luego de esta entrega.',
            left + 6,
            doc.y,
            { width: contentWidth - 12 }
          );
        doc.moveDown();
        doc.font('Helvetica').fontSize(10);
      } else {
        pendingItems.forEach((item) => {
          const startY = doc.y;
          const subtotal =
            Number(item.pendingQuantity || 0) * Number(item.unitPrice || 0);
          doc.font('Helvetica').fontSize(10);
          doc.text(
            String(Number(item.pendingQuantity || 0)),
            left + 6,
            startY,
            { width: 55, align: 'left' }
          );
          doc.text(item.variantName || 'Producto', left + 70, startY, {
            width: showPrices ? 270 : contentWidth - 100,
            align: 'left'
          });
          if (showPrices) {
            doc.text(
              `$${Number(item.unitPrice || 0).toLocaleString('es-AR')}`,
              right - 130,
              startY,
              { width: 55, align: 'right' }
            );
            doc.text(
              `$${subtotal.toLocaleString('es-AR')}`,
              right - 70,
              startY,
              { width: 64, align: 'right' }
            );
          }
          doc
            .fillColor('#6b7280')
            .fontSize(8)
            .text(
              `${item.variantSku || 'Sin SKU'} · Acumulado entregado: ${Number(item.cumulativeDeliveredQuantity || 0)}`,
              left + 70,
              startY + 12,
              { width: 300, align: 'left' }
            );
          doc
            .fillColor('#111827')
            .moveTo(left, startY + 28)
            .lineTo(right, startY + 28)
            .strokeColor('#d1d5db')
            .stroke()
            .strokeColor('#111827');
          doc.y = startY + 34;
        });
      }

      drawSectionTitle('Resumen de esta entrega');
      const summaryY = doc.y;
      drawBox(left, summaryY, contentWidth, 74);
      if (showPrices) {
        const eventDeliveredTotal = deliveredItems.reduce(
          (sum, item) => sum + Number(item.subtotal || 0),
          0
        );
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(
            `Total retirado en esta entrega: $${eventDeliveredTotal.toLocaleString('es-AR')}`,
            left + 12,
            summaryY + 12
          );
        doc.text(
          `Total entregado acumulado: $${Number(order.deliveredTotal || 0).toLocaleString('es-AR')}`,
          left + 12,
          summaryY + 28
        );
        doc.text(
          `Pendiente de entrega: $${Math.max(Number(order.approvedTotal || 0) - Number(order.deliveredTotal || 0), 0).toLocaleString('es-AR')}`,
          left + 12,
          summaryY + 44
        );
      } else {
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(
            `Productos retirados en esta entrega: ${deliveredItems.length}`,
            left + 12,
            summaryY + 12
          );
        doc.text(
          `Productos pendientes luego de esta entrega: ${pendingItems.length}`,
          left + 12,
          summaryY + 28
        );
        doc.text(
          `Importes ocultos por saldo pendiente`,
          left + 12,
          summaryY + 44
        );
      }
      doc.text(
        `Evento de entrega: ${deliveryEvent.id}`,
        left + 280,
        summaryY + 12,
        { width: 220 }
      );
      doc.text(`Emitido: ${eventDate}`, left + 280, summaryY + 28, {
        width: 220
      });
      doc.y = summaryY + 84;

      const footerY = pageHeight - 95;
      doc
        .moveTo(left + 20, footerY + 28)
        .lineTo(left + 220, footerY + 28)
        .stroke();
      doc
        .moveTo(right - 220, footerY + 28)
        .lineTo(right - 20, footerY + 28)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(9)
        .text('Aclaración / retiro', left + 52, footerY + 32, {
          width: 140,
          align: 'center'
        });
      doc.text('Recibí conforme', right - 188, footerY + 32, {
        width: 140,
        align: 'center'
      });
      doc
        .fontSize(7)
        .text(
          `Remito ${order.remitoNumber || order.id} · Retiro puntual ${eventDate}`,
          left + 10,
          pageHeight - 52,
          { width: contentWidth - 20, align: 'center' }
        );

      doc.end();
    });
  }
}
