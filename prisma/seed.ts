import { PrismaClient } from '@prisma/client';
import { SYSTEM_FEATURE_CODES, SYSTEM_FEATURE_METADATA } from '../src/modules/features/constants';
import { DEFAULT_PAYMENT_METHODS } from '../src/modules/paymentMethods/constants';

const prisma = new PrismaClient();
// ==========================================
// SEEDING MODULE FUNCTIONS
// ==========================================

/**
 * 1. Seed System Features
 */
async function seedSystemFeatures() {
  let count = 0;

  for (const code of SYSTEM_FEATURE_CODES) {
    const metadata = SYSTEM_FEATURE_METADATA[code];
    if (!metadata) continue;

    await prisma.feature.upsert({
      where: { code: metadata.code },
      update: {
        name: metadata.name,
        description: metadata.description,
      },
      create: {
        code: metadata.code,
        name: metadata.name,
        description: metadata.description,
        sortOrder: count + 1,
        isActive: true,
      },
    });
    count++;
  }
  console.log(`Seeded/Updated ${count} system features.`);
}

/**
 * 2. Seed Payment Methods
 */
async function seedPaymentMethods() {
  let count = 0;

  for (const pm of DEFAULT_PAYMENT_METHODS) {
    await prisma.paymentMethod.upsert({
      where: { code: pm.code },
      update: {
        name: pm.name,
        description: pm.description,
        icon: pm.icon,
        sortOrder: pm.sortOrder,
        isActive: pm.isActive,
      },
      create: {
        code: pm.code,
        name: pm.name,
        description: pm.description,
        icon: pm.icon,
        sortOrder: pm.sortOrder,
        isActive: pm.isActive,
      },
    });
    count++;
  }
  console.log(`Seeded/Updated ${count} payment methods.`);
}



/**
 * 4. Seed VietQR Banks (from VietQR API)
 */
async function seedVietqrBanks() {
  console.log('\nFetching and Seeding VietQR Banks API...');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://api.vietqr.io/v2/banks', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = (await response.json()) as { code: string; data?: any[]; desc?: string };

    if (json.code === '00' && Array.isArray(json.data)) {
      const supportedBanks = json.data.filter((bank: any) => Number(bank.transferSupported) === 1);
      console.log(`Found ${supportedBanks.length} banks supporting VietQR transfers out of ${json.data.length} total banks.`);

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
      console.log(`Seeded/Updated ${seededCount} VietQR banks successfully.`);
    } else {
      console.warn('VietQR API responded with non-success code:', json.desc);
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('Failed to fetch/seed VietQR banks (Network or API error):', error?.message || error);
  }
}

/**
 * 4. Seed Fixed Video Types
 */
async function seedVideoTypes() {
  const videoTypes = [
    {
      code: 'ACADEMY',
      name: 'Học thuật',
      description: 'Các video giảng dạy, bài học kiến thức chuẩn hóa',
    },
    {
      code: 'MARKET_ANALYSIS',
      name: 'Nhận định thị trường',
      description: 'Các video phân tích xu hướng và tin tức thị trường',
    },
  ];

  let count = 0;
  for (const vt of videoTypes) {
    await prisma.videoType.upsert({
      where: { code: vt.code },
      update: {
        name: vt.name,
        description: vt.description,
      },
      create: {
        code: vt.code,
        name: vt.name,
        description: vt.description,
      },
    });
    count++;
  }
  console.log(`Seeded/Updated ${count} video types.`);
}

// ==========================================
// MAIN EXECUTION PIPELINE
// ==========================================

async function main() {
  console.log('Starting database seeding...');
  // 1. Seed System Features
  await seedSystemFeatures();

  // 2. Seed Payment Methods
  await seedPaymentMethods();

  // 3. Seed VietQR Banks
  await seedVietqrBanks();

  // 4. Seed Video Types
  await seedVideoTypes();

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

