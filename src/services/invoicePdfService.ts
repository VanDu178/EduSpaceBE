import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

interface InvoicePdfData {
  code: string;
  amount: number;
  billingCycle: string;
  status: string;
  createdAt: Date | string;
  paidAt?: Date | string | null;
  expiredAt?: Date | string;
  user: {
    name?: string | null;
    email: string;
  };
  plan?: {
    name: string;
  } | null;
  paymentAccount?: {
    accountNo?: string | null;
    bankName?: string | null;
  } | null;
}

function getFontPath(fontName: string): string {
  const possiblePaths = [
    path.join(__dirname, '../assets/fonts', fontName),
    path.join(__dirname, 'assets/fonts', fontName),
    path.join(process.cwd(), 'src/assets/fonts', fontName),
    path.join(process.cwd(), 'dist/assets/fonts', fontName),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(process.cwd(), 'src/assets/fonts', fontName);
}

function formatDate(dateInput?: Date | string | null): string {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

/**
 * Sinh file PDF Hóa đơn điện tử chuẩn mẫu 2 cột thương hiệu TradeVerse (Tiếng Việt)
 */
export function generateInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      info: {
        Title: `HoaDon_${data.code}_TradeVerse`,
        Author: 'TradeVerse Platform',
      },
    });

    const fontRegularPath = getFontPath('Roboto-Regular.ttf');
    const fontBoldPath = getFontPath('Roboto-Bold.ttf');

    if (fs.existsSync(fontRegularPath)) {
      doc.registerFont('AppFont', fontRegularPath);
    } else {
      doc.registerFont('AppFont', 'Helvetica');
    }

    if (fs.existsSync(fontBoldPath)) {
      doc.registerFont('AppFont-Bold', fontBoldPath);
    } else {
      doc.registerFont('AppFont-Bold', 'Helvetica-Bold');
    }

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const pageWidth = 595.28; // A4 width in pt
    const pageHeight = 841.89; // A4 height in pt

    const leftColWidth = 230;
    const rightColWidth = pageWidth - leftColWidth;

    // 1. Draw Left Column Background (Light Slate)
    doc
      .rect(0, 0, leftColWidth, pageHeight)
      .fill('#F1F5F9'); // slate-100

    // --- LEFT COLUMN CONTENT ---
    const leftMargin = 32;
    let leftY = 40;

    // Logo & Brand
    doc
      .fillColor('#0284C7') // sky-600
      .font('AppFont-Bold')
      .fontSize(22)
      .text('TradeVerse', leftMargin, leftY);

    doc
      .fillColor('#64748B')
      .font('AppFont')
      .fontSize(8.5)
      .text('®', leftMargin + 122, leftY + 4);

    leftY += 45;

    // Sub-label supplier
    doc
      .fillColor('#64748B')
      .font('AppFont-Bold')
      .fontSize(8.5)
      .text('ĐƠN VỊ CUNG CẤP', leftMargin, leftY);

    leftY += 16;

    // Company Name & Address
    doc
      .fillColor('#0F172A')
      .font('AppFont-Bold')
      .fontSize(11)
      .text('Công ty TNHH Công nghệ TradeVerse', leftMargin, leftY, { width: leftColWidth - leftMargin - 15 });

    leftY += 28;

    doc
      .fillColor('#334155')
      .font('AppFont')
      .fontSize(9)
      .text('Tầng 12, Tòa nhà Financial Tower', leftMargin, leftY)
      .text('Q.1, TP. Hồ Chí Minh', leftMargin, leftY + 13)
      .text('Việt Nam', leftMargin, leftY + 26);

    leftY += 45;

    // Supplier Meta Info
    const bankAccountNo = data.paymentAccount?.accountNo || '190368888888';
    const bankName = data.paymentAccount?.bankName || 'MBBANK (NHTCP QUÂN ĐỘI)';

    const supplierMeta = [
      { label: 'Mã số DN', val: '0317892011' },
      { label: 'Mã số thuế', val: 'VN0317892011' },
      { label: 'Số tài khoản', val: bankAccountNo },
      { label: 'Mã chi nhánh', val: '026073150' },
      { label: 'Ngân hàng', val: bankName },
      { label: 'Mã SWIFT', val: 'MBBVNVX' },
      { label: 'Mã tham chiếu', val: data.code },
    ];

    supplierMeta.forEach((item) => {
      doc
        .fillColor('#64748B')
        .font('AppFont')
        .fontSize(8.5)
        .text(item.label, leftMargin, leftY);

      doc
        .fillColor('#0F172A')
        .font('AppFont-Bold')
        .fontSize(8.5)
        .text(item.val, leftMargin + 75, leftY, { width: leftColWidth - leftMargin - 85, align: 'right' });

      leftY += 18;
    });

    // --- RIGHT COLUMN CONTENT ---
    const rightMargin = leftColWidth + 35;
    let rightY = 40;

    // Header Right
    doc
      .fillColor('#0F172A')
      .font('AppFont-Bold')
      .fontSize(10)
      .text('HÓA ĐƠN DỊCH VỤ', rightMargin, rightY, { width: rightColWidth - 70, align: 'right' });

    doc
      .fillColor('#0284C7')
      .font('AppFont-Bold')
      .fontSize(18)
      .text(data.code, rightMargin, rightY + 14, { width: rightColWidth - 70, align: 'right' });

    doc
      .fillColor('#64748B')
      .font('AppFont')
      .fontSize(8)
      .text('CHỨNG TỪ THUẾ ĐIỆN TỬ', rightMargin, rightY + 36, { width: rightColWidth - 70, align: 'right' });

    rightY += 80;

    // Customer Section
    doc
      .fillColor('#64748B')
      .font('AppFont-Bold')
      .fontSize(8.5)
      .text('KHÁCH HÀNG', rightMargin, rightY);

    rightY += 16;

    doc
      .fillColor('#0F172A')
      .font('AppFont-Bold')
      .fontSize(12)
      .text(data.user.name || 'Khách hàng TradeVerse', rightMargin, rightY);

    rightY += 18;

    doc
      .fillColor('#334155')
      .font('AppFont')
      .fontSize(9)
      .text(data.user.email, rightMargin, rightY);

    rightY += 35;

    // Customer Meta Details
    const cycleLabel =
      data.billingCycle === 'annually' || data.billingCycle === 'yearly'
        ? 'Hàng năm'
        : 'Hàng tháng';

    const orderMeta = [
      { label: 'Mã đơn hàng', val: data.code },
      { label: 'Ngày tạo hóa đơn', val: formatDate(data.createdAt) },
      { label: 'Hạn thanh toán', val: formatDate(data.expiredAt) },
      { label: 'Ngày cung cấp', val: formatDate(data.createdAt) },
      { label: 'Ngày thanh toán', val: formatDate(data.paidAt) },
      { label: 'Đã thanh toán', val: (data.status === 'completed' || data.status === 'overpaid') ? formatMoney(Number(data.amount)) : '0 VNĐ' },
    ];

    orderMeta.forEach((item) => {
      doc
        .fillColor('#64748B')
        .font('AppFont')
        .fontSize(9)
        .text(item.label, rightMargin, rightY);

      doc
        .fillColor('#0F172A')
        .font('AppFont-Bold')
        .fontSize(9)
        .text(item.val, rightMargin + 120, rightY, { width: rightColWidth - 190, align: 'right' });

      rightY += 18;
    });

    rightY += 20;

    // Items Table Header
    doc
      .strokeColor('#CBD5E1')
      .lineWidth(0.5)
      .moveTo(rightMargin, rightY)
      .lineTo(pageWidth - 35, rightY)
      .stroke();

    rightY += 8;

    doc
      .fillColor('#64748B')
      .font('AppFont-Bold')
      .fontSize(8)
      .text('DỊCH VỤ / SẢN PHẨM', rightMargin, rightY)
      .text('Thuế GTGT', rightMargin + 170, rightY)
      .text('Thành tiền', rightMargin + 220, rightY, { width: 70, align: 'right' });

    rightY += 14;

    doc
      .strokeColor('#CBD5E1')
      .lineWidth(0.5)
      .moveTo(rightMargin, rightY)
      .lineTo(pageWidth - 35, rightY)
      .stroke();

    rightY += 12;

    // Item Row
    const planName = data.plan?.name || 'Gói dịch vụ TradeVerse';
    const itemDesc = `${planName} (${cycleLabel})`;

    doc
      .fillColor('#0F172A')
      .font('AppFont')
      .fontSize(9)
      .text(itemDesc, rightMargin, rightY, { width: 165 });

    doc
      .text('0 %', rightMargin + 175, rightY)
      .text(formatMoney(Number(data.amount)), rightMargin + 205, rightY, { width: 85, align: 'right' });

    rightY += 30;

    // Summary Box
    doc
      .strokeColor('#CBD5E1')
      .lineWidth(0.5)
      .moveTo(rightMargin, rightY)
      .lineTo(pageWidth - 35, rightY)
      .stroke();

    rightY += 14;

    const summaryMeta = [
      { label: 'Cộng tiền hàng', val: formatMoney(Number(data.amount)) },
      { label: 'Thuế GTGT (0%)', val: '0 VNĐ' },
      { label: 'Tổng cộng thanh toán', val: formatMoney(Number(data.amount)), bold: true },
      {
        label: 'Số tiền còn phải trả',
        val: (data.status === 'completed' || data.status === 'overpaid') ? '0 VNĐ' : formatMoney(Number(data.amount)),
        bold: true,
      },
    ];

    summaryMeta.forEach((item) => {
      doc
        .fillColor('#475569')
        .font(item.bold ? 'AppFont-Bold' : 'AppFont')
        .fontSize(item.bold ? 9.5 : 9)
        .text(item.label, rightMargin + 30, rightY);

      doc
        .fillColor('#0F172A')
        .font(item.bold ? 'AppFont-Bold' : 'AppFont')
        .fontSize(item.bold ? 9.5 : 9)
        .text(item.val, rightMargin + 170, rightY, { width: 120, align: 'right' });

      rightY += 18;
    });

    // Footer Disclaimer
    const footerY = pageHeight - 65;
    doc
      .fillColor('#94A3B8')
      .font('AppFont')
      .fontSize(7.5)
      .text(
        'Địa điểm cung cấp dịch vụ: Việt Nam. Nền tảng TradeVerse đã đăng ký hoạt động thương mại điện tử với Bộ Công Thương.',
        rightMargin,
        footerY,
        { width: rightColWidth - 70, align: 'left' }
      );

    doc.end();
  });
}

