"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Target, Activity, LayoutDashboard, FileText, Save, History, DollarSign, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // --- STATE DASHBOARD ---
  const [allTrades, setAllTrades] = useState<any[]>([]);
  const [totalPnl, setTotalPnl] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [totalTrades, setTotalTrades] = useState(0);
  const [tradeStats, setTradeStats] = useState({ wins: 0, losses: 0 }); // Nyimpen angka murni W/L
  const [winLossData, setWinLossData] = useState([{ name: 'Win', value: 0, color: '#10b981' }, { name: 'Loss', value: 0, color: '#ef4444' }]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // --- STATE KALENDER & BULANAN ---
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth()); 
  
  const monthsNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // --- STATE JURNAL ---
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const [tanggal, setTanggal] = useState(getTodayDate());
  const [pair, setPair] = useState('XAUUSD');
  const [arah, setArah] = useState('BUY');
  const [lot, setLot] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [closePrice, setClosePrice] = useState('');
  const [pnl, setPnl] = useState(0);
  const [status, setStatus] = useState('-');
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = async () => {
    setIsLoadingData(true);
    const { data, error } = await supabase.from('jurnal_trading').select('*').order('tanggal', { ascending: true });
    
    if (data && data.length > 0) {
      setAllTrades(data);
      let tPnl = 0, wins = 0, losses = 0;
      
      data.forEach(trade => {
        tPnl += Number(trade.pnl);
        if (trade.pnl > 0) wins++; else if (trade.pnl < 0) losses++;
      });

      setTotalPnl(tPnl); 
      setTotalTrades(data.length);
      setTradeStats({ wins, losses });
      setWinRate(wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0);
      setWinLossData([{ name: 'Win', value: wins, color: '#10b981' }, { name: 'Loss', value: losses, color: '#ef4444' }]);
    } else {
      setAllTrades([]);
      setTotalPnl(0); setTotalTrades(0); setWinRate(0); setTradeStats({ wins: 0, losses: 0 });
      setWinLossData([{ name: 'Win', value: 0, color: '#10b981' }, { name: 'Loss', value: 0, color: '#ef4444' }]);
    }
    setIsLoadingData(false);
  };

  useEffect(() => { if (activeTab === 'dashboard') fetchDashboardData(); }, [activeTab]);

  // Kalkulasi PnL
  useEffect(() => {
    if (lot && entryPrice && closePrice) {
      let calcPnl = arah === 'BUY' 
        ? (Number(closePrice) - Number(entryPrice)) * Number(lot) * 100 
        : (Number(entryPrice) - Number(closePrice)) * Number(lot) * 100;
      setPnl(calcPnl); 
      setStatus(calcPnl > 0 ? 'WIN' : calcPnl < 0 ? 'LOSS' : 'BEP');
    } else { 
      setPnl(0); setStatus('-'); 
    }
  }, [arah, lot, entryPrice, closePrice]);

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setLoading(true);
    const { error } = await supabase.from('jurnal_trading').insert([{ 
      tanggal, pair, arah, lot: Number(lot), entry_price: Number(entryPrice), close_price: Number(closePrice), pnl, status 
    }]);
    
    setLoading(false);
    if (!error) { 
      alert("🔥 Jurnal berhasil disimpan!"); 
      setEntryPrice(''); setClosePrice(''); setLot('');
      setActiveTab('dashboard'); 
    } else {
      alert("❌ Gagal menyimpan ke database!");
    }
  };

  // Logika Kalender
  const pnlByDateMap: Record<string, number> = {};
  allTrades.forEach(trade => {
    const dStr = trade.tanggal.split('T')[0];
    pnlByDateMap[dStr] = (pnlByDateMap[dStr] || 0) + Number(trade.pnl);
  });

  let monthlyTotalPnl = 0;
  allTrades.forEach(trade => {
    const tDate = new Date(trade.tanggal);
    if (tDate.getFullYear() === selectedYear && tDate.getMonth() === selectedMonth) {
      monthlyTotalPnl += Number(trade.pnl);
    }
  });

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    let firstDayIndex = date.getDay();
    firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    for (let i = 0; i < firstDayIndex; i++) days.push({ dayNum: null, dateStr: null });
    while (date.getMonth() === month) {
      const yearStr = date.getFullYear();
      const monthStr = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(date.getDate()).padStart(2, '0');
      days.push({ dayNum: date.getDate(), dateStr: `${yearStr}-${monthStr}-${dayStr}` });
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const currentMonthDays = getDaysInMonth(selectedYear, selectedMonth);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 text-slate-800 font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-72 bg-slate-900 text-white flex flex-col shadow-2xl relative z-10">
        <div className="p-8 flex items-center border-b border-slate-800">
          <Activity className="w-8 h-8 text-amber-500 mr-3"/>
          <h1 className="text-3xl font-black tracking-wider text-amber-500">TRADER<span className="text-white">HUB</span></h1>
        </div>
        <nav className="flex-1 p-6 flex flex-col space-y-4">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center w-full px-5 py-4 rounded-2xl font-bold transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-amber-500 text-slate-900 shadow-[0_0_20px_rgba(245,158,11,0.4)] scale-105' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}>
            <LayoutDashboard className="w-5 h-5 mr-4"/> Dashboard PnL
          </button>
          <button onClick={() => setActiveTab('jurnal')} className={`flex items-center w-full px-5 py-4 rounded-2xl font-bold transition-all duration-300 ${activeTab === 'jurnal' ? 'bg-amber-500 text-slate-900 shadow-[0_0_20px_rgba(245,158,11,0.4)] scale-105' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}>
            <FileText className="w-5 h-5 mr-4"/> Input Eksekusi
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto w-full">
        
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-6xl mx-auto">
            
            <header className="mb-8">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Kinerja Algoritma</h2>
              <p className="text-slate-500 font-medium mt-1">Ringkasan statistik All-Time dan kalender performa bulanan.</p>
            </header>

            {isLoadingData ? (
               <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div></div>
            ) : (
              <>
                {/* --- BAGIAN 1: ALL-TIME STATS (SEJAJAR DI ATAS) --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
                  
                  <div className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-center relative h-36">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Total Net PnL</h3>
                    <p className={`text-4xl font-black tracking-tight ${totalPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      ${totalPnl.toFixed(2)}
                    </p>
                    <div className={`absolute top-6 right-6 w-12 h-12 rounded-full flex items-center justify-center shadow-inner ${totalPnl >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      <DollarSign className="w-6 h-6"/>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-center relative h-36">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Akurasi</h3>
                    <p className="text-4xl font-black tracking-tight text-blue-600">{winRate.toFixed(1)}%</p>
                    <div className="absolute top-6 right-6 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shadow-inner">
                      <Target className="w-6 h-6"/>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-center relative h-36">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Total Trade</h3>
                    <p className="text-4xl font-black tracking-tight text-slate-800">{totalTrades}</p>
                    <div className="absolute top-6 right-6 w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-700 shadow-inner">
                      <History className="w-6 h-6"/>
                    </div>
                  </div>

                  {/* PIE CHART RASIO FULL BULET (DENGAN LABEL DI TENGAH) */}
                  <div className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center relative h-36">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest absolute top-4 left-5">Rasio Win/Loss</h3>
                    <div className="w-24 h-24 mt-2 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          {/* innerRadius={0} bikin chart jadi full lingkaran */}
                          <Pie data={winLossData} dataKey="value" cx="50%" cy="50%" innerRadius={0} outerRadius={42} stroke="none">
                            {winLossData.map((e, i) => <Cell fill={e.color} key={i}/>)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Teks label nempel melayang di atas pie chart */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.1)] border border-slate-100 flex items-center font-black text-xs space-x-1">
                          <span className="text-emerald-500">{tradeStats.wins}W</span>
                          <span className="text-slate-300">-</span>
                          <span className="text-red-500">{tradeStats.losses}L</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* --- BAGIAN 2: KALENDER SPREADSHEET (DIPISAH TEGAS) --- */}
                <div className="pt-8 border-t-2 border-slate-200/60 border-dashed">
                  
                  {/* Header Kalender & Controller */}
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <Calendar className="w-7 h-7"/>
                      </div>
                      <div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">{monthsNames[selectedMonth]} {selectedYear}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detail PnL Harian</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                      <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                        <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><ChevronLeft className="w-5 h-5"/></button>
                        <span className="px-6 font-black text-lg text-slate-800">{selectedYear}</span>
                        <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><ChevronRight className="w-5 h-5"/></button>
                      </div>
                      <div className="bg-slate-900 px-6 py-3 rounded-2xl shadow-md flex items-center space-x-3 w-full sm:w-auto justify-center">
                        <span className="text-xs font-black text-slate-400 uppercase">Total Bulan Ini:</span>
                        <span className={`text-xl font-black ${monthlyTotalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {monthlyTotalPnl > 0 ? '+' : ''}${monthlyTotalPnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Menu Pilih Bulan */}
                  <div className="bg-white p-3 rounded-3xl shadow-sm border border-slate-200 mb-6 overflow-x-auto flex space-x-2 scrollbar-none">
                    {monthsNames.map((mName, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedMonth(idx)}
                        className={`px-6 py-3 rounded-2xl font-black text-sm transition-all duration-300 whitespace-nowrap ${selectedMonth === idx ? 'bg-amber-500 text-slate-900 shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                      >
                        {mName}
                      </button>
                    ))}
                  </div>

                  {/* Grid Kalender */}
                  <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
                    <div className="grid grid-cols-7 gap-2 md:gap-4 mb-4 text-center">
                      {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d, i) => (
                        <span key={i} className="text-xs font-black text-slate-400 uppercase tracking-widest">{d}</span>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2 md:gap-4">
                      {currentMonthDays.map((item, idx) => {
                        if (!item.dayNum) return <div key={idx} className="h-24 md:h-32 bg-slate-50/40 rounded-2xl border border-transparent"></div>;
                        
                        const dayPnl = pnlByDateMap[item.dateStr!];
                        const hasTraded = dayPnl !== undefined;

                        return (
                          <div 
                            key={idx} 
                            className={`h-24 md:h-32 p-3 md:p-4 rounded-2xl border flex flex-col justify-between transition-all duration-300 ${
                              !hasTraded 
                                ? 'bg-slate-50 border-slate-100 text-slate-400' 
                                : dayPnl > 0 
                                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 shadow-sm hover:-translate-y-1 hover:shadow-md' 
                                  : 'bg-red-50/80 border-red-200 text-red-900 shadow-sm hover:-translate-y-1 hover:shadow-md'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-black text-sm md:text-lg">{item.dayNum}</span>
                              {hasTraded && <span className={`w-2.5 h-2.5 rounded-full shadow-sm mt-1 ${dayPnl > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></span>}
                            </div>
                            
                            <div>
                              {hasTraded ? (
                                <div>
                                  <span className="text-[10px] font-black opacity-50 uppercase block mb-0.5">PnL</span>
                                  <span className={`text-sm md:text-xl font-black tracking-tight ${dayPnl > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {dayPnl > 0 ? '+' : ''}${dayPnl.toFixed(0)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-300 font-medium">-</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </>
            )}
          </div>
        )}

        {/* JURNAL TAB */}
        {activeTab === 'jurnal' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-4xl mx-auto">
            <header className="mb-10">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Input Parameter Eksekusi</h2>
              <p className="text-slate-500 font-medium mt-2">Catat setiap posisi yang tertutup dari MT5 ke database.</p>
            </header>
            
            <form onSubmit={handleSimpan} className="bg-white p-8 md:p-10 rounded-[2rem] shadow-sm border border-slate-200 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Tanggal Eksekusi</label>
                  <input type="date" required value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Instrumen (Pair)</label>
                  <input type="text" required value={pair} onChange={(e) => setPair(e.target.value.toUpperCase())} placeholder="Misal: XAUUSD" className="w-full p-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Arah Posisi</label>
                  <select value={arah} onChange={(e) => setArah(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all appearance-none cursor-pointer">
                    <option value="BUY">🟢 Posisi BUY (Long)</option>
                    <option value="SELL">🔴 Posisi SELL (Short)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Volume (Lot)</label>
                  <input type="number" step="0.01" required value={lot} onChange={(e) => setLot(e.target.value)} placeholder="0.10" className="w-full p-4 bg-slate-50 border-none rounded-2xl font-mono text-lg font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Harga Entry</label>
                  <input type="number" step="0.01" required value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="2000.50" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-mono text-lg font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Harga Close (Exit)</label>
                  <input type="number" step="0.01" required value={closePrice} onChange={(e) => setClosePrice(e.target.value)} placeholder="2010.50" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-mono text-lg font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all shadow-sm" />
                </div>
              </div>

              <div className={`p-8 rounded-3xl border-2 transition-all duration-500 flex flex-col md:flex-row justify-between items-center gap-4 ${pnl > 0 ? 'bg-emerald-50 border-emerald-200' : pnl < 0 ? 'bg-red-50 border-red-200' : 'bg-slate-100 border-slate-200'}`}>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Estimasi Net Profit/Loss</p>
                  <p className={`text-5xl font-black tracking-tight ${pnl > 0 ? 'text-emerald-600' : pnl < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {pnl > 0 ? '+' : ''}${pnl.toFixed(2)}
                  </p>
                </div>
                <div className={`px-8 py-3 rounded-2xl font-black text-2xl tracking-widest ${pnl > 0 ? 'bg-emerald-200 text-emerald-800 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : pnl < 0 ? 'bg-red-200 text-red-800 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-slate-200 text-slate-500'}`}>
                  {status}
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full flex items-center justify-center p-5 bg-slate-900 text-white rounded-2xl font-black text-lg tracking-wider hover:bg-amber-500 hover:text-slate-900 transition-all duration-300 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] disabled:opacity-50">
                {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div> : <Save className="w-6 h-6 mr-3"/>}
                {loading ? 'MENYIMPAN DATA...' : 'SIMPAN KE DATABASE'}
              </button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}