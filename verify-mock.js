// Quick verification that mock data is accessible
import { mockBins, mockUsers, mockEvents, mockStats } from './backend/mockData.js';

console.log('✅ Mock Data Verification\n');
console.log('📦 Bins:', mockBins.length, 'items');
mockBins.forEach(b => console.log(`   - ${b.location} (${b.level}% full)`));

console.log('\n👥 Users:', mockUsers.length, 'items');
mockUsers.forEach(u => console.log(`   - ${u.name} (${u.points} points, Level ${u.level})`));

console.log('\n📋 Events:', mockEvents.length, 'items');
mockEvents.forEach(e => console.log(`   - ${e.type}: ${e.amount}kg`));

console.log('\n📊 Stats:');
console.log(`   - Total E-waste: ${mockStats.totalEwaste} kg`);
console.log(`   - CO₂ Saved: ${mockStats.co2Saved} kg`);
console.log(`   - Water Saved: ${mockStats.waterSaved} L`);
console.log(`   - Energy Saved: ${mockStats.energySaved} kWh`);

console.log('\n✅ All mock data loaded successfully!');
