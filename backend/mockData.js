// Mock data for when MongoDB is unavailable
export const mockBins = [
  {
    _id: '1',
    location: 'Main Campus - Building A',
    status: 'Medium',
    level: 45,
    capacity: 100,
    currentWeight: 45,
    acceptedCategories: ['phones', 'laptops', 'tablets'],
    qrCode: 'BIN001'
  },
  {
    _id: '2',
    location: 'Library - Ground Floor',
    status: 'Empty',
    level: 15,
    capacity: 100,
    currentWeight: 15,
    acceptedCategories: ['phones', 'batteries', 'accessories'],
    qrCode: 'BIN002'
  },
  {
    _id: '3',
    location: 'Student Center',
    status: 'Full',
    level: 90,
    capacity: 100,
    currentWeight: 90,
    acceptedCategories: ['phones', 'laptops', 'tablets', 'monitors'],
    qrCode: 'BIN003'
  }
];

export const mockUsers = [
  {
    _id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
    points: 250,
    level: 3,
    badges: ['first_deposit', 'eco_warrior'],
    totalDeposits: 15,
    totalWeight: 25.5
  },
  {
    _id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'collector',
    points: 500,
    level: 5,
    badges: ['first_deposit', 'eco_warrior', 'recycling_hero'],
    totalDeposits: 30,
    totalWeight: 50
  }
];

export const mockEvents = [
  {
    _id: '1',
    type: 'deposit',
    amount: 2.5,
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    bin: mockBins[0],
    user: mockUsers[0],
    category: 'phones',
    pointsEarned: 25
  },
  {
    _id: '2',
    type: 'deposit',
    amount: 5.0,
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    bin: mockBins[1],
    user: mockUsers[0],
    category: 'laptops',
    pointsEarned: 50
  },
  {
    _id: '3',
    type: 'collection',
    amount: 45,
    timestamp: new Date(Date.now() - 259200000).toISOString(),
    bin: mockBins[2],
    user: mockUsers[1]
  }
];

export const mockStats = {
  totalEwaste: 125.5,
  co2Saved: 75.3,
  waterSaved: 1500,
  energySaved: 250
};
