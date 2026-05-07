/**
 * One-time migration: backfill splits[].settled = true
 * for all existing settlements that have relatedExpenses.
 *
 * Run: node scripts/fixSettledSplits.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Settlement = require('../models/Settlement');
const Expense    = require('../models/Expense');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const settlements = await Settlement.find({
    $or: [
      { relatedExpenses: { $exists: true, $not: { $size: 0 } } },
      { relatedExpense:  { $exists: true, $ne: null } }
    ]
  });

  console.log(`Found ${settlements.length} settlements to process`);
  let updated = 0;

  for (const s of settlements) {
    const payerId = s.paidBy.toString();
    const payeeId = s.paidTo.toString();

    const expenseIds = [
      ...(s.relatedExpenses || []).map(e => e.toString()),
      ...(s.relatedExpense  ? [s.relatedExpense.toString()] : [])
    ];

    for (const expId of expenseIds) {
      const exp = await Expense.findById(expId);
      if (!exp) continue;
      const expPayerId = exp.paidBy?.toString();

      // If the expense was paid by the payee (paidTo), mark payer's split settled
      if (expPayerId === payeeId) {
        const result = await Expense.updateOne(
          { _id: expId, 'splits.user': payerId },
          { $set: { 'splits.$.settled': true } }
        );
        if (result.modifiedCount > 0) { updated++; console.log(`  ✅ Expense "${exp.description}" — ${payerId}'s split marked settled`); }
      }

      // If the expense was paid by the payer (paidBy), mark payee's split settled
      if (expPayerId === payerId) {
        const result = await Expense.updateOne(
          { _id: expId, 'splits.user': payeeId },
          { $set: { 'splits.$.settled': true } }
        );
        if (result.modifiedCount > 0) { updated++; console.log(`  ✅ Expense "${exp.description}" — ${payeeId}'s split marked settled`); }
      }
    }
  }

  console.log(`\nDone! Updated ${updated} splits.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
