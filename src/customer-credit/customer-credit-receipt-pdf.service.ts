import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { CustomerCreditReceipt } from './entities/customer-credit-receipt.entity';

@Injectable()
export class CustomerCreditReceiptPdfService {
  async generate(receipt: CustomerCreditReceipt): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const pageWidth = doc.page.width;
      const left = 40;
      const right = pageWidth - 40;
      const contentWidth = right - left;
      const createdAt = receipt.createdAt
        ? new Date(receipt.createdAt).toLocaleString('es-AR')
        : new Date().toLocaleString('es-AR');
      const customerName =
        receipt.customer?.fullName || 'Cliente sin identificar';
      const createdBy =
        [receipt.createdByUser?.firstname, receipt.createdByUser?.lastname]
          .filter(Boolean)
          .join(' ') ||
        receipt.createdByUserId ||
        'Sin usuario';
      const totalPendingAfter = Number(
        (receipt.items || []).reduce(
          (sum, item) => sum + Number(item.balanceAfter || 0),
          0
        )
      );

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .text('RECIBO CUENTA CORRIENTE', left, 46, {
          width: contentWidth,
          align: 'left'
        });

      doc.font('Helvetica').fontSize(10);
      doc.text(`Recibo: ${receipt.id}`, left, 74, {
        width: contentWidth,
        align: 'left'
      });
      doc.text(`Fecha: ${createdAt}`, left, 90, {
        width: contentWidth,
        align: 'left'
      });
      doc.text(`Cliente: ${customerName}`, left, 106, {
        width: contentWidth,
        align: 'left'
      });
      doc.text(`Registrado por: ${createdBy}`, left, 122, {
        width: contentWidth,
        align: 'left'
      });
      doc.text(`Método: ${receipt.method || 'cash'}`, left, 138, {
        width: contentWidth,
        align: 'left'
      });
      doc.text(
        `Modo de aplicación: ${receipt.mode === 'by_documents' ? 'Por remitos' : 'Automático por importe'}`,
        left,
        154,
        { width: contentWidth, align: 'left' }
      );

      const drawBox = (x: number, y: number, width: number, height: number) => {
        doc.lineWidth(1).roundedRect(x, y, width, height, 6).stroke();
      };

      drawBox(left, 176, contentWidth, 58);
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(
          `Total recibido: $${Number(receipt.appliedAmount || 0).toLocaleString('es-AR')}`,
          left + 12,
          192
        );
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(
          `Importe declarado: $${Number(receipt.requestedAmount || 0).toLocaleString('es-AR')}`,
          left + 12,
          210
        );
      doc.text(
        `Saldo total pendiente luego del cobro: $${totalPendingAfter.toLocaleString('es-AR')}`,
        left + 280,
        210,
        {
          width: contentWidth - 292,
          align: 'left'
        }
      );

      doc.y = 252;
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Aplicación por remito', left, doc.y);
      doc.moveDown(0.6);

      const headerY = doc.y;
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('REMITO', left + 2, headerY, { width: 130, align: 'left' });
      doc.text('COBRADO', left + 150, headerY, { width: 95, align: 'right' });
      doc.text('SALDO ANTES', left + 260, headerY, {
        width: 95,
        align: 'right'
      });
      doc.text('SALDO DESPUÉS', left + 370, headerY, {
        width: 120,
        align: 'right'
      });
      doc
        .moveTo(left, headerY + 14)
        .lineTo(right, headerY + 14)
        .stroke();
      doc.moveDown(1.2);

      doc.font('Helvetica').fontSize(10);
      if (!(receipt.items || []).length) {
        doc.text('No hay remitos asociados al recibo.', left, doc.y, {
          width: contentWidth,
          align: 'left'
        });
      } else {
        (receipt.items || []).forEach((item) => {
          const rowY = doc.y;
          doc.text(
            item.order?.remitoNumber || item.orderId || item.creditDocumentId,
            left + 2,
            rowY,
            { width: 130, align: 'left' }
          );
          doc.text(
            `$${Number(item.amountApplied || 0).toLocaleString('es-AR')}`,
            left + 150,
            rowY,
            { width: 95, align: 'right' }
          );
          doc.text(
            `$${Number(item.balanceBefore || 0).toLocaleString('es-AR')}`,
            left + 260,
            rowY,
            { width: 95, align: 'right' }
          );
          doc.text(
            `$${Number(item.balanceAfter || 0).toLocaleString('es-AR')}`,
            left + 370,
            rowY,
            { width: 120, align: 'right' }
          );
          doc
            .moveTo(left, rowY + 14)
            .lineTo(right, rowY + 14)
            .strokeColor('#d1d5db')
            .stroke()
            .strokeColor('#111827');
          doc.y = rowY + 20;
        });
      }

      if (receipt.notes) {
        doc.moveDown(0.8);
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .text('Observaciones', left, doc.y);
        doc.moveDown(0.4);
        doc.font('Helvetica').fontSize(10).text(receipt.notes, left, doc.y, {
          width: contentWidth,
          align: 'left'
        });
      }

      doc
        .font('Helvetica')
        .fontSize(8)
        .text(
          `Recibo ${receipt.id} · Cliente ${customerName} · Emitido ${createdAt}`,
          left,
          doc.page.height - 48,
          { width: contentWidth, align: 'center' }
        );

      doc.end();
    });
  }
}
