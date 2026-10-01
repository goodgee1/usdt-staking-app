const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'vault_usdt_wallet_earn_key_2026';

// ---------------- IN-MEMORY DATABASE ----------------
let globalConfig = {
  earnApy: 12.5, // Annual Yield
};

const users = [];
const deposits = [];
const withdrawals = [];

// Seed default Admin Account on startup
(async () => {
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  users.push({
    id: 1,
    email: 'admin@vault.com',
    password: adminPasswordHash,
    role: 'admin',
    depositAddress: '0x0000000000000000000000000000000000000000',
    availableBalance: 0,
    earnBalance: 0,
    createdAt: new Date().toISOString()
  });
  console.log('⚡ Admin seeded: admin@vault.com / admin123');
})();

// Middleware: Authenticate Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
};

// Middleware: Require Admin
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// ---------------- AUTH ROUTES ----------------

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const existingUser = users.find(u => u.email === email.toLowerCase().trim());
    if (existingUser) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const randomWallet = ethers.Wallet.createRandom();

    const newUser = {
      id: users.length + 1,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'user',
      depositAddress: randomWallet.address,
      availableBalance: 0,
      earnBalance: 0,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: 'Account created',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        depositAddress: newUser.depositAddress,
        availableBalance: newUser.availableBalance,
        earnBalance: newUser.earnBalance
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email.toLowerCase().trim());
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        depositAddress: user.depositAddress,
        availableBalance: user.availableBalance,
        earnBalance: user.earnBalance
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login error' });
  }
});

// ---------------- USER WALLET & EARN ROUTES ----------------

// Get Wallet Dashboard Data
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      depositAddress: user.depositAddress,
      availableBalance: user.availableBalance,
      earnBalance: user.earnBalance
    },
    config: globalConfig,
    deposits: deposits.filter(d => d.userId === user.id),
    withdrawals: withdrawals.filter(w => w.userId === user.id)
  });
});

// User Submits Deposit Notification
app.post('/api/user/notify-deposit', authenticateToken, (req, res) => {
  const { amount, txHash } = req.body;
  const depVal = parseFloat(amount);

  if (isNaN(depVal) || depVal <= 0) return res.status(400).json({ message: 'Invalid deposit amount' });

  const user = users.find(u => u.id === req.user.id);
  const newDeposit = {
    id: `DEP-${Date.now()}`,
    userId: user.id,
    userEmail: user.email,
    amount: depVal,
    txHash: txHash || 'Direct On-Chain Check',
    status: 'pending', // 'pending', 'completed', 'rejected'
    createdAt: new Date().toISOString()
  };

  deposits.push(newDeposit);
  res.json({ message: 'Deposit notification sent. Pending Admin completion.', deposit: newDeposit });
});

// User Requests Withdrawal
app.post('/api/user/request-withdraw', authenticateToken, (req, res) => {
  const { amount, toAddress } = req.body;
  const wVal = parseFloat(amount);

  if (isNaN(wVal) || wVal <= 0) return res.status(400).json({ message: 'Invalid withdrawal amount' });
  if (!toAddress) return res.status(400).json({ message: 'Destination address required' });

  const user = users.find(u => u.id === req.user.id);
  if (user.availableBalance < wVal) return res.status(400).json({ message: 'Insufficient available wallet balance' });

  // Reserve/Lock user balance during pending status
  user.availableBalance -= wVal;

  const newWithdrawal = {
    id: `WTH-${Date.now()}`,
    userId: user.id,
    userEmail: user.email,
    amount: wVal,
    toAddress,
    status: 'pending', // 'pending', 'completed', 'rejected'
    createdAt: new Date().toISOString()
  };

  withdrawals.push(newWithdrawal);
  res.json({ message: 'Withdrawal request submitted. Pending Admin processing.', withdrawal: newWithdrawal });
});

// Transfer Available Balance -> Earn Pool
app.post('/api/user/earn/deposit', authenticateToken, (req, res) => {
  const { amount } = req.body;
  const earnVal = parseFloat(amount);

  if (isNaN(earnVal) || earnVal <= 0) return res.status(400).json({ message: 'Invalid amount' });

  const user = users.find(u => u.id === req.user.id);
  if (user.availableBalance < earnVal) return res.status(400).json({ message: 'Insufficient available balance' });

  user.availableBalance -= earnVal;
  user.earnBalance += earnVal;

  res.json({ message: `Transferred ${earnVal} USDT to Earn Pool`, availableBalance: user.availableBalance, earnBalance: user.earnBalance });
});

// Transfer Earn Pool -> Available Balance (Unstake)
app.post('/api/user/earn/withdraw', authenticateToken, (req, res) => {
  const { amount } = req.body;
  const redeemVal = parseFloat(amount);

  if (isNaN(redeemVal) || redeemVal <= 0) return res.status(400).json({ message: 'Invalid amount' });

  const user = users.find(u => u.id === req.user.id);
  if (user.earnBalance < redeemVal) return res.status(400).json({ message: 'Insufficient Earn pool balance' });

  user.earnBalance -= redeemVal;
  user.availableBalance += redeemVal;

  res.json({ message: `Redeemed ${redeemVal} USDT to Available Wallet`, availableBalance: user.availableBalance, earnBalance: user.earnBalance });
});

// ---------------- ADMIN MANAGEMENT ROUTES ----------------

// Get Overview of All Users, Deposits, and Withdrawals
app.get('/api/admin/overview', authenticateToken, requireAdmin, (req, res) => {
  res.json({
    users: users.map(u => ({ id: u.id, email: u.email, availableBalance: u.availableBalance, earnBalance: u.earnBalance, depositAddress: u.depositAddress })),
    deposits,
    withdrawals,
    config: globalConfig
  });
});

// ADMIN: Complete Deposit (Credits User Wallet)
app.post('/api/admin/complete-deposit', authenticateToken, requireAdmin, (req, res) => {
  const { depositId, action } = req.body; // action: 'complete' or 'reject'

  const dep = deposits.find(d => d.id === depositId);
  if (!dep) return res.status(404).json({ message: 'Deposit record not found' });
  if (dep.status !== 'pending') return res.status(400).json({ message: 'Deposit already processed' });

  const user = users.find(u => u.id === dep.userId);

  if (action === 'complete') {
    dep.status = 'completed';
    if (user) user.availableBalance += dep.amount;
    res.json({ message: `Deposit completed! Credited ${dep.amount} USDT to ${dep.userEmail}` });
  } else {
    dep.status = 'rejected';
    res.json({ message: `Deposit ${depositId} rejected.` });
  }
});

// ADMIN: Complete Withdrawal (Finalizes Deduction / Refunds on Reject)
app.post('/api/admin/complete-withdrawal', authenticateToken, requireAdmin, (req, res) => {
  const { withdrawalId, action } = req.body; // action: 'complete' or 'reject'

  const wth = withdrawals.find(w => w.id === withdrawalId);
  if (!wth) return res.status(404).json({ message: 'Withdrawal record not found' });
  if (wth.status !== 'pending') return res.status(400).json({ message: 'Withdrawal already processed' });

  const user = users.find(u => u.id === wth.userId);

  if (action === 'complete') {
    wth.status = 'completed';
    res.json({ message: `Withdrawal of ${wth.amount} USDT completed and processed on-chain.` });
  } else {
    wth.status = 'rejected';
    // Refund locked funds back to user's wallet balance
    if (user) user.availableBalance += wth.amount;
    res.json({ message: `Withdrawal rejected. ${wth.amount} USDT refunded to ${wth.userEmail}` });
  }
});

// ADMIN: Update APY Configuration
app.post('/api/admin/update-config', authenticateToken, requireAdmin, (req, res) => {
  const { earnApy } = req.body;
  if (earnApy !== undefined) globalConfig.earnApy = parseFloat(earnApy);
  res.json({ message: 'Earn APY updated successfully', config: globalConfig });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Wallet & Earn Backend running on port ${PORT}`));