import PDFDocument from 'pdfkit';
import bidiFactory from 'bidi-js';
import ArabicReshaper from 'arabic-persian-reshaper';
import { toZonedTime, format } from 'date-fns-tz';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const bidi = bidiFactory();
const CAIRO_TZ = 'Africa/Cairo';
const require = createRequire(import.meta.url);

export interface ReceiptData {
  receiptNumber: string | number;
  paymentId: number;
  studentName: string;
  studentCode?: string;
  academicYear?: string | number;
  departmentName?: string;
  collegeName?: string;
  universityName?: string;
  feeType: string;
  amount: number;
  currency?: string;
  paymentDate: Date | string;
  paymentMethod?: string;
  status?: string;
  description?: string;
}

export class ReceiptService {
  /**
   * Resolve official Cairo TrueType fonts from installed @expo-google-fonts/cairo package.
   */
  private static getFontPaths(): { regular: string | null; bold: string | null } {
    try {
      const pkgDir = path.dirname(
        require.resolve('@expo-google-fonts/cairo/package.json')
      );
      const regular = path.join(pkgDir, '400Regular', 'Cairo_400Regular.ttf');
      const bold = path.join(pkgDir, '700Bold', 'Cairo_700Bold.ttf');
      return { regular, bold };
    } catch {
      return { regular: null, bold: null };
    }
  }

  /**
   * Reshape and reorder Arabic text for PDFKit rendering.
   */
  public static processArabic(text: string | null | undefined): string {
    if (!text) return '';
    try {
      // 1. Reshape Arabic letters according to their position (isolated, initial, medial, final)
      const reshaped = ArabicReshaper.ArabicShaper.convertArabic(text.toString());
      // 2. Compute BiDi embedding levels and reorder glyphs
      const embeddingLevels = bidi.getEmbeddingLevels(reshaped, 'rtl');
      return bidi.getReorderedString(reshaped, embeddingLevels);
    } catch {
      return text.toString();
    }
  }

  /**
   * Translate payment types to standard Arabic labels.
   */
  private static translateFeeType(type: string): string {
    const map: Record<string, string> = {
      TUITION: 'المصروفات الدراسية السنوية',
      REGISTRATION: 'رسوم التسجيل الأكاديمي',
      LIBRARY: 'رسوم الخدمات والمكتبة',
      OTHER: 'رسوم خدمات إضافية',
    };
    return map[type] || type;
  }

  /**
   * Translate payment status to Arabic label.
   */
  private static translateStatus(status: string): string {
    const map: Record<string, string> = {
      PAID: 'مدفوع بالكامل',
      PENDING: 'قيد الانتظار',
      OVERDUE: 'متأخر',
      CANCELLED: 'ملغي',
    };
    return map[status] || status;
  }

  /**
   * Generate a professional PDF receipt buffer with Arabic BiDi support.
   */
  public static async generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Receipt-${data.receiptNumber}`,
            Author: 'Smart University Platform',
            Subject: 'Official Payment Receipt',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        // Register Cairo TrueType fonts from @expo-google-fonts/cairo package
        const { regular: regularFontPath, bold: boldFontPath } = this.getFontPaths();
        const hasRegularFont = Boolean(regularFontPath && fs.existsSync(regularFontPath));
        const hasBoldFont = Boolean(boldFontPath && fs.existsSync(boldFontPath));

        if (hasRegularFont && hasBoldFont && regularFontPath && boldFontPath) {
          doc.registerFont('Cairo', regularFontPath);
          doc.registerFont('Cairo-Bold', boldFontPath);
          doc.font('Cairo');
        }

        const fontRegular = hasRegularFont ? 'Cairo' : 'Helvetica';
        const fontBold = hasBoldFont ? 'Cairo-Bold' : 'Helvetica-Bold';

        const universityName = data.universityName || 'جامعة التكنولوجيا التطبيقية والذكية';
        const currency = data.currency || 'ج.م';
        const formattedAmount = `${data.amount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${currency}`;

        // Format Date in Africa/Cairo timezone
        const cairoDate = toZonedTime(new Date(data.paymentDate), CAIRO_TZ);
        const formattedDate = format(cairoDate, 'yyyy/MM/dd - hh:mm a', {
          timeZone: CAIRO_TZ,
        });

        const feeTypeArabic = this.translateFeeType(data.feeType);
        const statusArabic = this.translateStatus(data.status || 'PAID');

        // ==========================================
        // 1. TOP ACCENT BAR & HEADER
        // ==========================================
        doc.rect(40, 40, 515, 6).fill('#1e3a8a'); // Dark Navy Accent

        // Header Background Card
        doc.roundedRect(40, 50, 515, 75, 4).fill('#f8fafc');

        doc
          .font(fontBold)
          .fontSize(16)
          .fillColor('#0f172a')
          .text(this.processArabic(universityName), 40, 62, {
            align: 'center',
            width: 515,
          });

        doc
          .font(fontRegular)
          .fontSize(11)
          .fillColor('#475569')
          .text(
            this.processArabic(data.collegeName || 'شؤون الطلاب والمالية'),
            40,
            84,
            { align: 'center', width: 515 }
          );

        doc
          .font(fontBold)
          .fontSize(12)
          .fillColor('#2563eb')
          .text(
            this.processArabic('إيصال سداد مالي رسمي معتمد'),
            40,
            102,
            { align: 'center', width: 515 }
          );

        // ==========================================
        // 2. RECEIPT METADATA BAR
        // ==========================================
        const metaY = 135;
        doc.roundedRect(40, metaY, 515, 38, 4).fill('#f1f5f9');

        // Receipt Number (Right)
        doc
          .font(fontBold)
          .fontSize(10)
          .fillColor('#334155')
          .text(
            this.processArabic(`رقم الإيصال: #${data.receiptNumber}`),
            300,
            metaY + 12,
            { align: 'right', width: 240 }
          );

        // Issue Date (Left)
        doc
          .font(fontRegular)
          .fontSize(9.5)
          .fillColor('#64748b')
          .text(
            this.processArabic(`تاريخ السداد: ${formattedDate}`),
            55,
            metaY + 12,
            { align: 'left', width: 240 }
          );

        // ==========================================
        // 3. STUDENT INFORMATION SECTION
        // ==========================================
        const studentY = 185;
        doc.roundedRect(40, studentY, 515, 95, 4).strokeColor('#e2e8f0').lineWidth(1).stroke();

        // Section Title
        doc
          .font(fontBold)
          .fontSize(11)
          .fillColor('#1e293b')
          .text(this.processArabic('بيانات الطالب'), 40, studentY + 10, {
            align: 'right',
            width: 495,
          });

        // Divider
        doc
          .moveTo(55, studentY + 28)
          .lineTo(540, studentY + 28)
          .strokeColor('#e2e8f0')
          .stroke();

        // Row 1: Student Name & Student Code
        doc
          .font(fontRegular)
          .fontSize(10)
          .fillColor('#475569')
          .text(
            this.processArabic(`اسم الطالب: ${data.studentName}`),
            300,
            studentY + 38,
            { align: 'right', width: 235 }
          );

        if (data.studentCode) {
          doc
            .font(fontRegular)
            .fontSize(10)
            .fillColor('#475569')
            .text(
              this.processArabic(`الرقم الجامعي: ${data.studentCode}`),
              55,
              studentY + 38,
              { align: 'left', width: 235 }
            );
        }

        // Row 2: Department & Academic Year
        if (data.departmentName) {
          doc
            .font(fontRegular)
            .fontSize(10)
            .fillColor('#475569')
            .text(
              this.processArabic(`القسم الأكاديمي: ${data.departmentName}`),
              300,
              studentY + 62,
              { align: 'right', width: 235 }
            );
        }

        if (data.academicYear) {
          doc
            .font(fontRegular)
            .fontSize(10)
            .fillColor('#475569')
            .text(
              this.processArabic(`السنة الدراسية: ${data.academicYear}`),
              55,
              studentY + 62,
              { align: 'left', width: 235 }
            );
        }

        // ==========================================
        // 4. PAYMENT DETAILS TABLE
        // ==========================================
        const tableY = 295;

        // Table Header
        doc.rect(40, tableY, 515, 26).fill('#1e3a8a');
        doc
          .font(fontBold)
          .fontSize(10)
          .fillColor('#ffffff')
          .text(this.processArabic('بند السداد والوصف'), 200, tableY + 7, {
            align: 'right',
            width: 340,
          });

        doc
          .font(fontBold)
          .fontSize(10)
          .fillColor('#ffffff')
          .text(this.processArabic('المبلغ المسدد'), 55, tableY + 7, {
            align: 'left',
            width: 140,
          });

        // Table Row 1
        const row1Y = tableY + 26;
        doc.rect(40, row1Y, 515, 45).fill('#ffffff');
        doc.rect(40, row1Y, 515, 45).strokeColor('#e2e8f0').stroke();

        doc
          .font(fontBold)
          .fontSize(10.5)
          .fillColor('#0f172a')
          .text(this.processArabic(feeTypeArabic), 180, row1Y + 8, {
            align: 'right',
            width: 360,
          });

        if (data.description) {
          doc
            .font(fontRegular)
            .fontSize(9)
            .fillColor('#64748b')
            .text(this.processArabic(data.description), 180, row1Y + 25, {
              align: 'right',
              width: 360,
            });
        }

        doc
          .font(fontBold)
          .fontSize(11)
          .fillColor('#0f172a')
          .text(this.processArabic(formattedAmount), 55, row1Y + 14, {
            align: 'left',
            width: 140,
          });

        // ==========================================
        // 5. TOTAL AMOUNT & STATUS SUMMARY
        // ==========================================
        const totalY = row1Y + 55;

        // Status Card (Right)
        doc.roundedRect(300, totalY, 255, 60, 4).fill('#f0fdf4'); // Soft Green
        doc.roundedRect(300, totalY, 255, 60, 4).strokeColor('#86efac').stroke();

        doc
          .font(fontRegular)
          .fontSize(9.5)
          .fillColor('#166534')
          .text(this.processArabic('حالة السداد:'), 315, totalY + 12, {
            align: 'right',
            width: 225,
          });

        doc
          .font(fontBold)
          .fontSize(12)
          .fillColor('#15803d')
          .text(this.processArabic(statusArabic), 315, totalY + 30, {
            align: 'right',
            width: 225,
          });

        // Total Amount Box (Left)
        doc.roundedRect(40, totalY, 250, 60, 4).fill('#f8fafc');
        doc.roundedRect(40, totalY, 250, 60, 4).strokeColor('#cbd5e1').stroke();

        doc
          .font(fontRegular)
          .fontSize(9.5)
          .fillColor('#475569')
          .text(this.processArabic('المبلغ الإجمالي المسدد:'), 55, totalY + 12, {
            align: 'left',
            width: 220,
          });

        doc
          .font(fontBold)
          .fontSize(15)
          .fillColor('#1e3a8a')
          .text(this.processArabic(formattedAmount), 55, totalY + 30, {
            align: 'left',
            width: 220,
          });

        // ==========================================
        // 6. FOOTER & AUTHENTICATION SEAL
        // ==========================================
        const footerY = 440;

        // Security Box
        doc.roundedRect(40, footerY, 515, 65, 4).fill('#f8fafc');
        doc.roundedRect(40, footerY, 515, 65, 4).strokeColor('#e2e8f0').stroke();

        doc
          .font(fontBold)
          .fontSize(9.5)
          .fillColor('#334155')
          .text(
            this.processArabic('ملاحظات وإشعار الاعتماد الإلكتروني'),
            55,
            footerY + 10,
            { align: 'right', width: 485 }
          );

        doc
          .font(fontRegular)
          .fontSize(8.5)
          .fillColor('#64748b')
          .text(
            this.processArabic(
              '• يعتبر هذا الإيصال مستنداً إلكترونياً رسمياً صادراً ومعتمداً من الإدارة المالية والشؤون الأكاديمية بالجامعة.'
            ),
            55,
            footerY + 27,
            { align: 'right', width: 485 }
          );

        doc
          .font(fontRegular)
          .fontSize(8.5)
          .fillColor('#64748b')
          .text(
            this.processArabic(
              `• تم إصدار وتوثيق هذا الإيصال عبر النظام الإلكتروني برقم مرجعي: UMS-PAY-${data.paymentId}-${data.receiptNumber}`
            ),
            55,
            footerY + 43,
            { align: 'right', width: 485 }
          );

        // Bottom Brand
        doc
          .font(fontRegular)
          .fontSize(8)
          .fillColor('#94a3b8')
          .text(
            'Smart University Management System © 2026 — Verified Electronic Document',
            40,
            520,
            { align: 'center', width: 515 }
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
