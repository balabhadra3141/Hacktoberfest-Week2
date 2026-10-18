import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

export async function seed() {
  console.log('🌱 Seeding UdhaarOS demo data...');

  // Clear existing data
  await prisma.reminderHistory.deleteMany();
  await prisma.importCandidate.deleteMany();
  await prisma.ledgerTransaction.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.appSettings.deleteMany();
  await prisma.businessProfile.deleteMany();

  // Business Profile
  const business = await prisma.businessProfile.create({
    data: {
      name: 'Sharma General Store',
      phone: '+91 98765 43210',
      address: '42 Main Road, Cuttack, Odisha 753001',
      currency: 'INR',
      currencySymbol: '₹',
      defaultDueDays: 30,
      defaultCreditLimitPaise: 5000000, // ₹50,000
    },
  });

  const now = dayjs();

  // Customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: 'Ramesh Kumar',
        phone: '+91 98765 11111',
        address: 'Near Post Office, Cuttack',
        notes: 'Regular customer. Buys groceries weekly.',
        creditLimitPaise: 2000000, // ₹20,000
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Sita Devi',
        phone: '+91 98765 22222',
        address: 'Gandhi Nagar, Bhubaneswar',
        notes: 'Wholesale buyer. Monthly orders.',
        creditLimitPaise: 5000000,
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Mohit Singh',
        phone: '+91 98765 33333',
        address: 'Station Road, Cuttack',
        notes: 'New customer since August 2026.',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Priya Patel',
        phone: '+91 98765 44444',
        address: 'MG Road, Puri',
        notes: 'Restaurant owner. Bulk orders of rice and oil.',
        creditLimitPaise: 10000000, // ₹1,00,000
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Arun Mishra',
        phone: '+91 98765 55555',
        address: 'College Square, Cuttack',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Deepa Rani',
        phone: '+91 98765 66666',
        address: 'Nayapalli, Bhubaneswar',
        notes: 'Pays on time usually.',
        creditLimitPaise: 1500000,
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Vikram Sahoo',
        phone: '+91 98765 77777',
        address: 'Sahid Nagar, Bhubaneswar',
        notes: 'Construction materials buyer.',
        creditLimitPaise: 3000000,
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Lakshmi Behera',
        phone: '+91 98765 88888',
        address: 'Badambadi, Cuttack',
        notes: 'Small shop owner. Buys on credit for resale.',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Sunil Das',
        phone: '+91 98765 99999',
        address: 'Unit-4, Bhubaneswar',
        isActive: false,
        notes: 'Archived — moved to different city.',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Meena Kumari',
        phone: '+91 98765 00000',
        address: 'Rasulgarh, Bhubaneswar',
        notes: 'School canteen supplies.',
        creditLimitPaise: 2500000,
      },
    }),
  ]);

  const [ramesh, sita, mohit, priya, arun, deepa, vikram, lakshmi, sunil, meena] = customers;

  // Transactions - building realistic ledger
  const txData = [
    // Ramesh Kumar - has outstanding balance with overdue
    { customerId: ramesh.id, type: 'CREDIT', amountPaise: 350000, date: now.subtract(45, 'day'), desc: 'Monthly grocery supply - rice, dal, oil', dueDate: now.subtract(15, 'day') },
    { customerId: ramesh.id, type: 'PAYMENT', amountPaise: 200000, date: now.subtract(30, 'day'), desc: 'Partial payment' },
    { customerId: ramesh.id, type: 'CREDIT', amountPaise: 120000, date: now.subtract(20, 'day'), desc: 'Additional items - sugar, tea', dueDate: now.add(10, 'day') },
    { customerId: ramesh.id, type: 'PAYMENT', amountPaise: 50000, date: now.subtract(5, 'day'), desc: 'Cash payment' },
    // Outstanding: 3500 - 2000 + 1200 - 500 = ₹2,200

    // Sita Devi - large wholesale account, partially overdue
    { customerId: sita.id, type: 'CREDIT', amountPaise: 1500000, date: now.subtract(60, 'day'), desc: 'Wholesale order - 50kg rice, 20L oil, spices', dueDate: now.subtract(30, 'day') },
    { customerId: sita.id, type: 'PAYMENT', amountPaise: 500000, date: now.subtract(40, 'day'), desc: 'Bank transfer - first installment' },
    { customerId: sita.id, type: 'PAYMENT', amountPaise: 500000, date: now.subtract(20, 'day'), desc: 'Cash payment - second installment' },
    { customerId: sita.id, type: 'CREDIT', amountPaise: 750000, date: now.subtract(10, 'day'), desc: 'New wholesale order', dueDate: now.add(20, 'day') },
    // Outstanding: 15000 - 5000 - 5000 + 7500 = ₹12,500

    // Mohit Singh - new customer, small balance
    { customerId: mohit.id, type: 'CREDIT', amountPaise: 85000, date: now.subtract(15, 'day'), desc: 'Household supplies', dueDate: now.add(15, 'day') },
    { customerId: mohit.id, type: 'PAYMENT', amountPaise: 40000, date: now.subtract(7, 'day'), desc: 'UPI payment' },
    // Outstanding: 850 - 400 = ₹450

    // Priya Patel - restaurant, large account, good payer
    { customerId: priya.id, type: 'CREDIT', amountPaise: 2500000, date: now.subtract(35, 'day'), desc: 'Restaurant monthly supply - rice 100kg, cooking oil 50L', dueDate: now.subtract(5, 'day') },
    { customerId: priya.id, type: 'PAYMENT', amountPaise: 2500000, date: now.subtract(10, 'day'), desc: 'Full payment by cheque - CHQ#4521' },
    { customerId: priya.id, type: 'CREDIT', amountPaise: 1800000, date: now.subtract(5, 'day'), desc: 'New month restaurant order', dueDate: now.add(25, 'day') },
    // Outstanding: 0 + 18000 = ₹18,000

    // Arun Mishra - settled account
    { customerId: arun.id, type: 'CREDIT', amountPaise: 320000, date: now.subtract(50, 'day'), desc: 'General items', dueDate: now.subtract(20, 'day') },
    { customerId: arun.id, type: 'PAYMENT', amountPaise: 320000, date: now.subtract(18, 'day'), desc: 'Full payment - cash' },
    // Outstanding: 0

    // Deepa Rani - has balance, no overdue
    { customerId: deepa.id, type: 'CREDIT', amountPaise: 450000, date: now.subtract(12, 'day'), desc: 'Festival supplies - sweets ingredients', dueDate: now.add(18, 'day') },
    { customerId: deepa.id, type: 'PAYMENT', amountPaise: 200000, date: now.subtract(3, 'day'), desc: 'Advance payment' },
    // Outstanding: 4500 - 2000 = ₹2,500

    // Vikram Sahoo - overdue with adjustment
    { customerId: vikram.id, type: 'CREDIT', amountPaise: 850000, date: now.subtract(40, 'day'), desc: 'Construction supplies - cement, paint', dueDate: now.subtract(10, 'day') },
    { customerId: vikram.id, type: 'PAYMENT', amountPaise: 300000, date: now.subtract(25, 'day'), desc: 'Part payment' },
    { customerId: vikram.id, type: 'ADJUSTMENT', amountPaise: 50000, date: now.subtract(20, 'day'), desc: 'Price correction - paint rate increase', adjustmentReason: 'Supplier increased paint price after initial billing' },
    // Outstanding: 8500 - 3000 + 500 = ₹6,000

    // Lakshmi Behera - multiple small transactions
    { customerId: lakshmi.id, type: 'CREDIT', amountPaise: 180000, date: now.subtract(25, 'day'), desc: 'Biscuits and snacks for shop', dueDate: now.subtract(5, 'day') },
    { customerId: lakshmi.id, type: 'CREDIT', amountPaise: 95000, date: now.subtract(18, 'day'), desc: 'Cold drinks and water', dueDate: now.add(12, 'day') },
    { customerId: lakshmi.id, type: 'PAYMENT', amountPaise: 100000, date: now.subtract(10, 'day'), desc: 'Cash payment' },
    { customerId: lakshmi.id, type: 'CREDIT', amountPaise: 65000, date: now.subtract(3, 'day'), desc: 'Soap and detergent', dueDate: now.add(27, 'day') },
    // Outstanding: 1800 + 950 - 1000 + 650 = ₹2,400

    // Sunil Das (archived) - had balance before archiving
    { customerId: sunil.id, type: 'CREDIT', amountPaise: 200000, date: now.subtract(90, 'day'), desc: 'Final purchase before moving' },
    { customerId: sunil.id, type: 'PAYMENT', amountPaise: 200000, date: now.subtract(85, 'day'), desc: 'Settled before leaving' },

    // Meena Kumari - school canteen
    { customerId: meena.id, type: 'CREDIT', amountPaise: 420000, date: now.subtract(22, 'day'), desc: 'School canteen monthly supply', dueDate: now.subtract(2, 'day') },
    { customerId: meena.id, type: 'PAYMENT', amountPaise: 200000, date: now.subtract(8, 'day'), desc: 'Partial payment - school account' },
    { customerId: meena.id, type: 'CREDIT', amountPaise: 135000, date: now.subtract(4, 'day'), desc: 'Extra supplies for event', dueDate: now.add(26, 'day') },
    // Outstanding: 4200 - 2000 + 1350 = ₹3,550

    // Potential duplicate transaction for Lakshmi (same amount, same date)
    { customerId: lakshmi.id, type: 'CREDIT', amountPaise: 65000, date: now.subtract(3, 'day'), desc: 'Soap and detergent - duplicate entry?', dueDate: now.add(27, 'day') },
  ];

  for (const tx of txData) {
    await prisma.ledgerTransaction.create({
      data: {
        customerId: tx.customerId,
        type: tx.type,
        amountPaise: tx.amountPaise,
        date: tx.date.toDate(),
        description: tx.desc,
        dueDate: tx.dueDate ? tx.dueDate.toDate() : null,
        source: 'MANUAL',
        adjustmentReason: (tx as any).adjustmentReason || null,
      },
    });
  }

  // Sample import batch for demo
  const importBatch = await prisma.importBatch.create({
    data: {
      source: 'TEXT',
      rawInput: 'Ramesh took goods 1200 yesterday. Paid 500 today. Sita udhaar 750 on 12 Oct.',
      status: 'COMPLETED',
      modelUsed: 'demo-sample',
      totalCandidates: 3,
      importedCount: 0,
      rejectedCount: 0,
    },
  });

  console.log('✅ Demo data seeded successfully!');
  console.log(`   📋 ${customers.length} customers created`);
  console.log(`   💰 ${txData.length} transactions created`);
  console.log(`   🏪 Business profile: ${business.name}`);
  console.log('   ⚠️  This is SAMPLE DATA for demonstration purposes.');
}

// Run if called directly
const isMainModule = process.argv[1]?.includes('seed');
if (isMainModule) {
  seed()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error('Seed failed:', e);
      prisma.$disconnect();
      process.exit(1);
    });
}
