import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Remito, RemitoSourceType } from './entities/remito.entity';

@Injectable()
export class RemitoPdfService {
  async generate(remito: Remito): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const issuedDate = remito.issuedAt
        ? new Date(remito.issuedAt).toLocaleString('es-AR')
        : 'Sin fecha';
      const reprintDate = new Date().toLocaleString('es-AR');
      const customerName = remito.customerNameSnapshot || 'Cliente sin identificar';
      const sellerName = remito.sellerNameSnapshot || 'Sin vendedor';
      const branchName = remito.branchNameSnapshot || 'Sin sucursal';
      const showPrices = Number(remito.pendingPaymentAmount || 0) <= 0;
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const left = 40;
      const right = pageWidth - 40;
      const contentWidth = right - left;
      const deliveredItems = (remito.items || []).filter(
        (item) => Number(item.quantityDeliveredInDocument || 0) > 0
      );
      const pendingItems = (remito.items || []).filter(
        (item) => Number(item.pendingQuantity || 0) > 0
      );
      const title =
        remito.sourceType === RemitoSourceType.DELIVERY_EVENT
          ? 'REMITO DE ENTREGA'
          : 'REMITO';

      const drawBox = (x: number, y: number, width: number, height: number) => {
        doc.lineWidth(1).roundedRect(x, y, width, height, 6).stroke();
      };

      const drawSectionTitle = (sectionTitle: string) => {
        doc.moveDown(0.8);
        const y = doc.y;
        doc.rect(left, y, contentWidth, 18).fillAndStroke('#f3f4f6', '#111827');
        doc
          .fillColor('#111827')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(sectionTitle.toUpperCase(), left + 8, y + 5, {
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
        doc.moveTo(left, y + 14).lineTo(right, y + 14).stroke();
        doc.moveDown(1.2);
        doc.font('Helvetica').fontSize(10);
      };

      const drawItems = (
        items: Remito['items'],
        quantitySelector: (item: Remito['items'][number]) => number,
        infoSelector: (item: Remito['items'][number]) => string
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
          const unitPrice = Number(item.unitPrice || 0);
          const subtotal = quantity * unitPrice;
          const startY = doc.y;
          doc.font('Helvetica').fontSize(10);
          doc.text(String(quantity), left + 6, startY, {
            width: 55,
            align: 'left'
          });
          doc.text(item.productNameSnapshot || 'Producto', left + 70, startY, {
            width: showPrices ? 270 : contentWidth - 100,
            align: 'left'
          });
          if (showPrices) {
            doc.text(`$${unitPrice.toLocaleString('es-AR')}`, right - 130, startY, {
              width: 55,
              align: 'right'
            });
            doc.text(`$${subtotal.toLocaleString('es-AR')}`, right - 70, startY, {
              width: 64,
              align: 'right'
            });
          }
          doc
            .fillColor('#6b7280')
            .fontSize(8)
            .text(infoSelector(item), left + 70, startY + 12, {
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

      doc.font('Helvetica-Bold').fontSize(18).text('LOGO/NOMBRE', left + 18, 62);
      doc.font('Helvetica').fontSize(10).text('IMPORTACIÓN - EXPORTACIÓN', left + 55, 92);
      doc.fontSize(10).text(branchName, left + 32, 114, {
        width: 230,
        align: 'center'
      });
      doc.fontSize(8).text('Sucursal / Punto de retiro', left + 32, 128, {
        width: 230,
        align: 'center'
      });

      doc.font('Helvetica-Bold').fontSize(18).text(title, left + 334, 58, {
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
      doc.font('Helvetica-Bold').fontSize(16).text(remito.remitoNumber || remito.id, left + 320, 100, {
        width: 220,
        align: 'center'
      });
      doc.font('Helvetica').fontSize(9).text(`Fecha emisión: ${issuedDate}`, left + 310, 122, {
        width: 220,
        align: 'left'
      });
      doc.text(`Reimpresión: ${reprintDate}`, left + 310, 136, {
        width: 220,
        align: 'left'
      });

      drawBox(left + 8, 144, contentWidth - 16, 82);
      doc.font('Helvetica').fontSize(10).text(`Sr./es: ${customerName}`, left + 16, 156, {
        width: contentWidth - 32
      });
      doc.text(`Sucursal: ${branchName}`, left + 16, 174, { width: 250 });
      doc.text(`Vendedor: ${sellerName}`, left + 280, 174, { width: 220 });
      doc.text(`Contacto: ${remito.contactSnapshot || 'No informado'}`, left + 16, 192, {
        width: contentWidth - 32
      });
      doc.text(`Condición de venta: ${remito.paymentConditionSnapshot || 'No informada'}`, left + 16, 210, {
        width: 280
      });
      doc.text(`Estado del remito: ${remito.status}`, left + 320, 210, {
        width: 180
      });

      doc.y = 240;
      drawSectionTitle(
        remito.sourceType === RemitoSourceType.DELIVERY_EVENT
          ? 'Productos retirados en esta entrega'
          : 'Productos entregados'
      );
      drawTableHeader();
      drawItems(
        deliveredItems,
        (item) => Number(item.quantityDeliveredInDocument || 0),
        (item) => `${item.skuSnapshot || 'Sin SKU'}${item.notes ? ` · ${item.notes}` : ''}`
      );

      drawSectionTitle(
        remito.sourceType === RemitoSourceType.DELIVERY_EVENT
          ? 'Saldo pendiente luego de esta entrega'
          : 'Productos no entregados'
      );
      drawTableHeader();
      drawItems(
        pendingItems,
        (item) => Number(item.pendingQuantity || 0),
        (item) =>
          remito.sourceType === RemitoSourceType.DELIVERY_EVENT
            ? `${item.skuSnapshot || 'Sin SKU'} · Acumulado entregado: ${Number(item.cumulativeDeliveredQuantity || 0)}`
            : `${item.skuSnapshot || 'Sin SKU'}${item.notes ? ` · ${item.notes}` : ''}`
      );

      drawSectionTitle('Resumen');
      const summaryY = doc.y;
      drawBox(left, summaryY, contentWidth, 74);
      if (showPrices) {
        doc.font('Helvetica').fontSize(10).text(
          `Total pedido: $${Number(remito.totalOrderedAmount || 0).toLocaleString('es-AR')}`,
          left + 12,
          summaryY + 12
        );
        doc.text(
          `Total aprobado: $${Number(remito.totalApprovedAmount || 0).toLocaleString('es-AR')}`,
          left + 12,
          summaryY + 28
        );
        doc.text(
          `Total entregado documento: $${Number(remito.totalDeliveredAmount || 0).toLocaleString('es-AR')}`,
          left + 12,
          summaryY + 44
        );
        doc.text(
          `Total cobrado: $${Number(remito.totalPaidAmount || 0).toLocaleString('es-AR')}`,
          left + 280,
          summaryY + 12
        );
        doc.text(
          `Saldo pendiente: $${Number(remito.pendingPaymentAmount || 0).toLocaleString('es-AR')}`,
          left + 280,
          summaryY + 28
        );
        doc.text(
          `Entrega pendiente: $${Number(remito.pendingDeliveryAmount || 0).toLocaleString('es-AR')}`,
          left + 280,
          summaryY + 44
        );
      } else {
        doc.font('Helvetica').fontSize(10).text(
          `Productos entregados: ${deliveredItems.length}`,
          left + 12,
          summaryY + 12
        );
        doc.text(`Productos pendientes: ${pendingItems.length}`, left + 12, summaryY + 28);
        doc.text(`Estado de cobro: pendiente`, left + 12, summaryY + 44);
        doc.text(`Importes ocultos por saldo pendiente`, left + 280, summaryY + 12);
      }
      doc.y = summaryY + 84;

      if (remito.notes) {
        drawSectionTitle('Observaciones');
        drawBox(left, doc.y, contentWidth, 58);
        doc.font('Helvetica').fontSize(10).text(remito.notes, left + 10, doc.y + 10, {
          width: contentWidth - 20
        });
        doc.y += 68;
      }

      const footerY = pageHeight - 95;
      doc.moveTo(left + 20, footerY + 28).lineTo(left + 220, footerY + 28).stroke();
      doc.moveTo(right - 220, footerY + 28).lineTo(right - 20, footerY + 28).stroke();
      doc.font('Helvetica').fontSize(9).text('Aclaración / retiro', left + 52, footerY + 32, {
        width: 140,
        align: 'center'
      });
      doc.text('Recibí conforme', right - 188, footerY + 32, {
        width: 140,
        align: 'center'
      });
      doc.fontSize(7).text(
        `Remito ${remito.remitoNumber || remito.id} · Emisión ${issuedDate} · Reimpresión ${reprintDate}`,
        left + 10,
        pageHeight - 52,
        { width: contentWidth - 20, align: 'center' }
      );

      doc.end();
    });
  }
}
