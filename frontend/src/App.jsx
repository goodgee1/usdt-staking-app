import React, { useState, useEffect } from 'react';

const API_BASE = '/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState({ earnApy: 12.5 });
  const [userDeposits, setUserDeposits] = useState([]);
  const [userWithdrawals, setUserWithdrawals] = useState([]);
  
  // Tabs: 'wallet', 'earn', 'history', 'admin'
  const [activeTab, setActiveTab] = useState('wallet');

  // Auth Form
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // User Actions Form States
  const [depAmount, setDepAmount] = useState('');
  const [txHash, setTxHash] = useState('');
  const [wthAmount, setWthAmount] = useState('');
  const [wthAddress, setWthAddress] = useState('');
  const [earnAmount, setEarnAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [userMsg, setUserMsg] = useState('');

  // Admin Portal States
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminDeposits, setAdminDeposits] = useState([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState([]);
  const [newApy, setNewApy] = useState('');
  const [adminMsg, setAdminMsg] = useState('');

  const safeFetch = async (url, options = {}) => {
    const res = await fetch(url, options);
    const textData = await res.text();
    const data = textData ? JSON.parse(textData) : {};
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  };

  const loadUserData = () => {
    if (!token) return;
    safeFetch(`${API_BASE}/user/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(data => {
        setUser(data.user);
        setConfig(data.config);
        setUserDeposits(data.deposits || []);
        setUserWithdrawals(data.withdrawals || []);
      })
      .catch(() => handleLogout());
  };

  const loadAdminData = () => {
    if (!token || user?.role !== 'admin') return;
    safeFetch(`${API_BASE}/admin/overview`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(data => {
        setAdminUsers(data.users);
        setAdminDeposits(data.deposits);
        setAdminWithdrawals(data.withdrawals);
      })
      .catch(err => setAdminMsg(err.message));
  };

  useEffect(() => { loadUserData(); }, [token]);
  useEffect(() => { if (activeTab === 'admin') loadAdminData(); }, [activeTab]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const data = await safeFetch(`${API_BASE}/auth/${isLoginMode ? 'login' : 'signup'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setEmail('');
      setPassword('');
      if (data.user.role === 'admin') setActiveTab('admin');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setActiveTab('wallet');
  };

  // User Deposit Notice
  const handleNotifyDeposit = async (e) => {
    e.preventDefault();
    setUserMsg('');
    try {
      const data = await safeFetch(`${API_BASE}/user/notify-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: depAmount, txHash })
      });
      setUserMsg(data.message);
      setDepAmount(''); setTxHash('');
      loadUserData();
    } catch (err) { setUserMsg(err.message); }
  };

  // User Withdraw Request
  const handleRequestWithdraw = async (e) => {
    e.preventDefault();
    setUserMsg('');
    try {
      const data = await safeFetch(`${API_BASE}/user/request-withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: wthAmount, toAddress: wthAddress })
      });
      setUserMsg(data.message);
      setWthAmount(''); setWthAddress('');
      loadUserData();
    } catch (err) { setUserMsg(err.message); }
  };

  // Move Wallet -> Earn
  const handleDepositEarn = async (e) => {
    e.preventDefault();
    setUserMsg('');
    try {
      const data = await safeFetch(`${API_BASE}/user/earn/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: earnAmount })
      });
      setUserMsg(data.message);
      setEarnAmount('');
      loadUserData();
    } catch (err) { setUserMsg(err.message); }
  };

  // Move Earn -> Wallet (Redeem)
  const handleRedeemEarn = async (e) => {
    e.preventDefault();
    setUserMsg('');
    try {
      const data = await safeFetch(`${API_BASE}/user/earn/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: redeemAmount })
      });
      setUserMsg(data.message);
      setRedeemAmount('');
      loadUserData();
    } catch (err) { setUserMsg(err.message); }
  };

  // Admin Actions
  const handleAdminDepositAction = async (depositId, action) => {
    setAdminMsg('');
    try {
      const data = await safeFetch(`${API_BASE}/admin/complete-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ depositId, action })
      });
      setAdminMsg(data.message);
      loadAdminData();
    } catch (err) { setAdminMsg(err.message); }
  };

  const handleAdminWithdrawalAction = async (withdrawalId, action) => {
    setAdminMsg('');
    try {
      const data = await safeFetch(`${API_BASE}/admin/complete-withdrawal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ withdrawalId, action })
      });
      setAdminMsg(data.message);
      loadAdminData();
    } catch (err) { setAdminMsg(err.message); }
  };

  const handleAdminApy = async (e) => {
    e.preventDefault();
    setAdminMsg('');
    try {
      const data = await safeFetch(`${API_BASE}/admin/update-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ earnApy: newApy })
      });
      setAdminMsg(data.message);
      setNewApy('');
      setConfig(data.config);
    } catch (err) { setAdminMsg(err.message); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950">₮</div>
          <span className="text-lg font-bold text-emerald-400">VaultUSDT Wallet</span>
        </div>
        {token && user && (
          <div className="flex items-center space-x-3">
            <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 font-mono">{user.role.toUpperCase()}</span>
            <span className="text-xs text-slate-400 hidden sm:inline">{user.email}</span>
            <button onClick={handleLogout} className="text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg transition">Sign Out</button>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {!token || !user ? (
          /* AUTHENTICATION PORTAL */
          <div className="max-w-md mx-auto bg-slate-900 rounded-2xl p-6 border border-slate-800 my-12 shadow-2xl">
            <h1 className="text-2xl font-bold text-center text-emerald-400 mb-1">Vault Crypto Wallet</h1>
            <p className="text-xs text-slate-400 text-center mb-6">Deposit, Withdraw & Earn Yield</p>

            <div className="flex border-b border-slate-800 mb-6">
              <button onClick={() => setIsLoginMode(true)} className={`flex-1 pb-3 text-sm font-semibold border-b-2 ${isLoginMode ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400'}`}>Sign In</button>
              <button onClick={() => setIsLoginMode(false)} className={`flex-1 pb-3 text-sm font-semibold border-b-2 ${!isLoginMode ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400'}`}>Create Account</button>
            </div>

            {authError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl mb-4 text-xs">{authError}</div>}

            <form onSubmit={handleAuth} className="space-y-4">
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 focus:outline-none" />
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 focus:outline-none" />
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 rounded-xl transition">{isLoginMode ? 'Sign In' : 'Create Account'}</button>
            </form>
            <p className="text-[11px] text-slate-500 text-center mt-4">Admin Login: admin@vault.com / admin123</p>
          </div>
        ) : (
          /* APPLICATION DASHBOARD */
          <div className="space-y-6">
            {/* TOP NAVIGATION TABS */}
            <div className="flex border-b border-slate-800 space-x-6 text-sm">
              <button onClick={() => setActiveTab('wallet')} className={`pb-3 font-semibold border-b-2 ${activeTab === 'wallet' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400'}`}>Main Wallet</button>
              <button onClick={() => setActiveTab('earn')} className={`pb-3 font-semibold border-b-2 ${activeTab === 'earn' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-400'}`}>Earn Hub ({config.earnApy}% APY)</button>
              <button onClick={() => setActiveTab('history')} className={`pb-3 font-semibold border-b-2 ${activeTab === 'history' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400'}`}>Transaction History</button>
              {user.role === 'admin' && (
                <button onClick={() => setActiveTab('admin')} className={`pb-3 font-semibold border-b-2 ${activeTab === 'admin' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400'}`}>Admin Panel</button>
              )}
            </div>

            {/* BALANCE OVERVIEW CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400 mb-1">Available Wallet Balance</p>
                <p className="text-2xl font-bold text-emerald-400">{user.availableBalance} USDT</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400 mb-1">Earn Savings Pool</p>
                <p className="text-2xl font-bold text-teal-400">{user.earnBalance} USDT</p>
              </div>
            </div>

            {userMsg && <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-amber-400">{userMsg}</div>}

            {/* TAB 1: MAIN WALLET (DEPOSIT / WITHDRAW) */}
            {activeTab === 'wallet' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* DEPOSIT CARD */}
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-emerald-400 text-lg">Deposit USDT</h3>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Your Unique Deposit Address</p>
                    <p className="text-xs font-mono break-all text-slate-300 mt-1 select-all">{user.depositAddress}</p>
                  </div>

                  <form onSubmit={handleNotifyDeposit} className="space-y-3">
                    <input type="number" step="any" required value={depAmount} onChange={e => setDepAmount(e.target.value)} placeholder="Amount Deposited (USDT)" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                    <input type="text" value={txHash} onChange={e => setTxHash(e.target.value)} placeholder="Transaction Hash (Optional)" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                    <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 rounded-xl transition">Submit Deposit Notice</button>
                  </form>
                  <p className="text-[11px] text-slate-500">Note: Deposits require Admin completion before funds are credited.</p>
                </div>

                {/* WITHDRAW CARD */}
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-rose-400 text-lg">Withdraw USDT</h3>
                  <form onSubmit={handleRequestWithdraw} className="space-y-3">
                    <input type="number" step="any" required value={wthAmount} onChange={e => setWthAmount(e.target.value)} placeholder="Withdrawal Amount" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                    <input type="text" required value={wthAddress} onChange={e => setWthAddress(e.target.value)} placeholder="Recipient USDT Address" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                    <button type="submit" className="w-full bg-rose-500 hover:bg-rose-600 text-slate-950 font-bold py-3 rounded-xl transition">Request Withdrawal</button>
                  </form>
                  <p className="text-[11px] text-slate-500">Note: Funds are reserved immediately. Admin completes the transfer.</p>
                </div>
              </div>
            )}

            {/* TAB 2: EARN HUB */}
            {activeTab === 'earn' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-teal-400 text-lg">Deposit into Earn Pool</h3>
                  <p className="text-xs text-slate-400">Transfer funds from Available Wallet into Earn to accrue interest at {config.earnApy}% APY.</p>
                  <form onSubmit={handleDepositEarn} className="space-y-3">
                    <input type="number" step="any" required value={earnAmount} onChange={e => setEarnAmount(e.target.value)} placeholder="Amount to Earn" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                    <button type="submit" className="w-full bg-teal-500 text-slate-950 font-bold py-3 rounded-xl">Transfer to Earn Pool</button>
                  </form>
                </div>

                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-slate-200 text-lg">Redeem / Unstake to Wallet</h3>
                  <p className="text-xs text-slate-400">Move funds back from your Earn Pool into your main wallet anytime.</p>
                  <form onSubmit={handleRedeemEarn} className="space-y-3">
                    <input type="number" step="any" required value={redeemAmount} onChange={e => setRedeemAmount(e.target.value)} placeholder="Amount to Redeem" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                    <button type="submit" className="w-full bg-slate-800 text-slate-100 font-bold py-3 rounded-xl hover:bg-slate-700">Redeem to Main Wallet</button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 3: TRANSACTION HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="font-bold text-slate-200">Deposits History</h3>
                  {userDeposits.length === 0 ? <p className="text-xs text-slate-500">No deposit records.</p> : (
                    <div className="space-y-2">
                      {userDeposits.map(d => (
                        <div key={d.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-emerald-400">+{d.amount} USDT</p>
                            <p className="text-[10px] text-slate-500">{new Date(d.createdAt).toLocaleString()}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full font-semibold ${d.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : d.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>{d.status.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="font-bold text-slate-200">Withdrawals History</h3>
                  {userWithdrawals.length === 0 ? <p className="text-xs text-slate-500">No withdrawal records.</p> : (
                    <div className="space-y-2">
                      {userWithdrawals.map(w => (
                        <div key={w.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-rose-400">-{w.amount} USDT</p>
                            <p className="text-[10px] text-slate-500">To: {w.toAddress}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full font-semibold ${w.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : w.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>{w.status.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: ADMIN CONTROL PANEL */}
            {activeTab === 'admin' && user.role === 'admin' && (
              <div className="space-y-6">
                {adminMsg && <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3 rounded-xl text-xs">{adminMsg}</div>}

                {/* ADMIN CONFIG */}
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="font-bold text-blue-400">Earn Yield Configuration</h3>
                  <form onSubmit={handleAdminApy} className="flex gap-3">
                    <input type="number" step="0.1" required value={newApy} onChange={e => setNewApy(e.target.value)} placeholder={`Current APY: ${config.earnApy}%`} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white flex-1" />
                    <button type="submit" className="bg-blue-500 text-slate-950 font-bold px-6 rounded-xl">Update Rate</button>
                  </form>
                </div>

                {/* PENDING DEPOSITS QUEUE */}
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-emerald-400">Pending User Deposits (Complete to Credit Balance)</h3>
                  {adminDeposits.filter(d => d.status === 'pending').length === 0 ? <p className="text-xs text-slate-500">No pending deposits.</p> : (
                    <div className="space-y-3">
                      {adminDeposits.filter(d => d.status === 'pending').map(d => (
                        <div key={d.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-slate-200">{d.userEmail} reported deposit of {d.amount} USDT</p>
                            <p className="text-[10px] text-slate-500">TX: {d.txHash}</p>
                          </div>
                          <div className="flex space-x-2">
                            <button onClick={() => handleAdminDepositAction(d.id, 'complete')} className="bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg">Complete & Credit</button>
                            <button onClick={() => handleAdminDepositAction(d.id, 'reject')} className="bg-rose-500 text-white font-bold px-3 py-1.5 rounded-lg">Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PENDING WITHDRAWALS QUEUE */}
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-rose-400">Pending User Withdrawals (Complete to Finalize)</h3>
                  {adminWithdrawals.filter(w => w.status === 'pending').length === 0 ? <p className="text-xs text-slate-500">No pending withdrawals.</p> : (
                    <div className="space-y-3">
                      {adminWithdrawals.filter(w => w.status === 'pending').map(w => (
                        <div key={w.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-slate-200">{w.userEmail} requested {w.amount} USDT</p>
                            <p className="text-[10px] text-slate-500 font-mono">To: {w.toAddress}</p>
                          </div>
                          <div className="flex space-x-2">
                            <button onClick={() => handleAdminWithdrawalAction(w.id, 'complete')} className="bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg">Complete Transfer</button>
                            <button onClick={() => handleAdminWithdrawalAction(w.id, 'reject')} className="bg-rose-500 text-white font-bold px-3 py-1.5 rounded-lg">Reject & Refund</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}