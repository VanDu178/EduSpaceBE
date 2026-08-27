import { PrismaClient } from '@prisma/client';
import { SYSTEM_FEATURE_CODES, SYSTEM_FEATURE_METADATA } from '../src/constants/featureCodes';

const prisma = new PrismaClient();

async function seedVietqrBanks() {
  console.log('🔄 Fetching bank list from VietQR official API...');
  try {
    const response = await fetch('https://api.vietqr.io/v2/banks');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    if (json.code === '00' && Array.isArray(json.data)) {
      // Chỉ lọc các ngân hàng có transferSupported === 1
      const supportedBanks = json.data.filter((bank: any) => Number(bank.transferSupported) === 1);
      console.log(`ℹ️ Found ${supportedBanks.length} banks supporting VietQR transfers out of ${json.data.length} total banks.`);

      let seededCount = 0;
      for (const bank of supportedBanks) {
        await prisma.vietqrBank.upsert({
          where: { code: bank.code },
          update: {
            name: bank.name,
            shortName: bank.shortName || bank.short_name || bank.code,
            bin: bank.bin,
            logo: bank.logo,
            transferSupported: Number(bank.transferSupported) || 1,
            lookupSupported: Number(bank.lookupSupported) || 0,
          },
          create: {
            id: bank.id,
            code: bank.code,
            name: bank.name,
            shortName: bank.shortName || bank.short_name || bank.code,
            bin: bank.bin,
            logo: bank.logo,
            transferSupported: Number(bank.transferSupported) || 1,
            lookupSupported: Number(bank.lookupSupported) || 0,
            isActive: true,
          },
        });
        seededCount++;
      }
      console.log(`✅ Seeded/Updated ${seededCount} VietQR banks successfully!`);
    } else {
      console.warn('⚠️ VietQR API responded with non-success code:', json.desc);
    }
  } catch (error) {
    console.error('❌ Failed to fetch banks from VietQR API during seed:', error);
  }
}

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed System Features
  for (const code of SYSTEM_FEATURE_CODES) {
    const metadata = SYSTEM_FEATURE_METADATA[code];
    if (!metadata) continue;

    const feature = await prisma.feature.upsert({
      where: { code: metadata.code },
      update: {
        name: metadata.name,
        description: metadata.description
      },
      create: {
        code: metadata.code,
        name: metadata.name,
        description: metadata.description,
        sortOrder: 0,
        isActive: true
      }
    });

    console.log(`✅ Seeded system feature: '${feature.code}' (${feature.name})`);
  }

  // 2. Seed VietQR Banks
  await seedVietqrBanks();

  // 3. Seed Payment Methods
  const defaultPaymentMethods = [
    {
      code: 'vietqr',
      name: 'Chuyển khoản QR (VietQR)',
      description: 'Thanh toán quét mã QR qua ứng dụng ngân hàng tự động duyệt nhanh chóng.',
      icon: 'QrCodeIcon',
      sortOrder: 1,
      isActive: true,
    },
    {
      code: 'credit_card',
      name: 'Thẻ quốc tế / Ghi nợ',
      description: 'Thanh toán trực tiếp qua thẻ Visa, Mastercard, JCB.',
      icon: 'CreditCardIcon',
      sortOrder: 2,
      isActive: true,
    },
    {
      code: 'e_wallet',
      name: 'Ví điện tử',
      description: 'Thanh toán nhanh qua các ví điện tử MoMo, ZaloPay, VNPay.',
      icon: 'WalletIcon',
      sortOrder: 3,
      isActive: true,
    },
  ];

  for (const pm of defaultPaymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { code: pm.code },
      update: {
        name: pm.name,
        description: pm.description,
        icon: pm.icon,
        sortOrder: pm.sortOrder,
      },
      create: pm,
    });
    console.log(`✅ Seeded payment method: '${pm.code}' (${pm.name})`);
  }

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

