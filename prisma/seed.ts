import { PrismaClient } from '@prisma/client';
import { SYSTEM_FEATURE_CODES, SYSTEM_FEATURE_METADATA } from '../src/constants/featureCodes';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

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
