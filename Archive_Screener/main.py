from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
import time
import requests 
import traceback

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# CONFIG TELEGRAM BOT 
# ==========================================
TELEGRAM_TOKEN = "8985082403:AAFqevnibAIRSI_MSXSPqAnv2rKrnLkSNX0"
TELEGRAM_CHAT_ID = "8517490034"

SENT_SIGNALS_CACHE = set()

def send_telegram_notif(pair, interval, strategy, trade_type, entry, tp, sl, win_prob):
    global SENT_SIGNALS_CACHE
    signal_id = f"{pair}_{interval}_{strategy}_{trade_type}_{entry}"
    
    if signal_id not in SENT_SIGNALS_CACHE:
        icon = "🟢" if trade_type == "BUY" else "🔴"
        msg = (
            f"🚨 *TRADERHUB VIP SIGNAL* 🚨\n\n"
            f"💎 *Pair:* {pair}\n"
            f"⏱ *TF:* {interval}\n"
            f"🧠 *Strategi:* {strategy.upper()}\n"
            f"🎯 *Win Prob:* {win_prob}%\n"
            f"{icon} *Action:* {trade_type}\n\n"
            f"📍 *ENTRY:* {entry}\n"
            f"✅ *TP:* {tp}\n"
            f"🛑 *SL:* {sl}\n\n"
            f"_RR 1:1.5 | Cepat Eksekusi!_"
        )
        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        payload = {"chat_id": TELEGRAM_CHAT_ID, "text": msg, "parse_mode": "Markdown"}
        try:
            # Tambahin timeout 5 detik biar API ga nyangkut/loading terus
            requests.post(url, json=payload, timeout=5)
            SENT_SIGNALS_CACHE.add(signal_id)
            print(f"Notif Telegram Terkirim: {trade_type} {pair} ({strategy.upper()})")
        except Exception as e:
            print(f"Gagal kirim Telegram (Timeout/Error): {e}")

# ==========================================

MARKET_DATA_CACHE = {}
CACHE_TTL = 30 

def get_cached_market_data(ticker: str, period: str, interval: str):
    cache_key = f"{ticker}_{period}_{interval}"
    current_time = time.time()
    if cache_key in MARKET_DATA_CACHE:
        cached_time, cached_data = MARKET_DATA_CACHE[cache_key]
        if current_time - cached_time < CACHE_TTL:
            return cached_data.copy()
            
    data = yf.download(ticker, period=period, interval=interval)
    MARKET_DATA_CACHE[cache_key] = (current_time, data)
    return data.copy()

# FUNGSI BACKTEST DIOPTIMASI PAKAI NUMPY (SUPER CEPAT)
def run_backtest_simulation(highs, lows, start_idx, entry, sl, tp, trade_type):
    is_entered = False
    for j in range(start_idx + 1, len(highs)):
        future_high = highs[j]
        future_low = lows[j]
        
        if trade_type == "BUY":
            if not is_entered and future_low <= entry: is_entered = True
            if is_entered:
                if future_low <= sl: return "LOSS"
                elif future_high >= tp: return "WIN"
        elif trade_type == "SELL":
            if not is_entered and future_high >= entry: is_entered = True
            if is_entered:
                if future_high >= sl: return "LOSS"
                elif future_low <= tp: return "WIN"
    return "PENDING"

@app.get("/market-data/{pair}")
def get_market_data(pair: str, interval: str = "15m", period: str = "1mo", strategy: str = "fvg"):
    try:
        yf_ticker = "GC=F" if pair == "XAUUSD" else pair
        data = get_cached_market_data(yf_ticker, period="1mo", interval=interval)
        
        if data.empty: return {"error": f"Data {yf_ticker} lagi kosong diblokir Yahoo, tunggu semenit."}

        if isinstance(data.columns, pd.MultiIndex):
            data.columns = [col[0] for col in data.columns]
        data = data.dropna()

        data['EMA_20'] = data['Close'].ewm(span=20, adjust=False).mean()
        data['EMA_50'] = data['Close'].ewm(span=50, adjust=False).mean()
        data['EMA_200'] = data['Close'].ewm(span=200, adjust=False).mean()
        
        high_low = data['High'] - data['Low']
        high_close = np.abs(data['High'] - data['Close'].shift())
        low_close = np.abs(data['Low'] - data['Close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        data['ATR'] = np.max(ranges, axis=1).rolling(14).mean()

        # Penting: Drop NaN SETELAH kalkulasi ATR, mencegah crash di frontend
        data = data.dropna()
        if len(data) < 200:
            return {"error": "Data riwayat terlalu pendek buat dianalisa."}

        # --- KONVERSI KE NUMPY ARRAYS (Trik Biar Loading Instant) ---
        opens = data['Open'].values
        highs = data['High'].values
        lows = data['Low'].values
        closes = data['Close'].values
        ema_20_arr = data['EMA_20'].values
        ema_50_arr = data['EMA_50'].values
        ema_200_arr = data['EMA_200'].values
        atr_arr = data['ATR'].values
        timestamps = [int(idx.timestamp()) for idx in data.index]

        candles = [{"time": timestamps[i], "open": float(opens[i]), "high": float(highs[i]), "low": float(lows[i]), "close": float(closes[i])} for i in range(len(data))]

        all_strategies = ["fvg", "ob", "liq", "bos", "pd"]
        stats = {s: {"wins": 0, "losses": 0, "last_idx": 0} for s in all_strategies}
        
        markers = []
        latest_signal_info = None
        lookback = 15 

        for i in range(200, len(data)):
            c1_open, c1_high, c1_low, c1_close = opens[i-2], highs[i-2], lows[i-2], closes[i-2]
            c2_open, c2_high, c2_low, c2_close = opens[i-1], highs[i-1], lows[i-1], closes[i-1]
            c3_open, c3_high, c3_low, c3_close = opens[i], highs[i], lows[i], closes[i]
            
            ema_20, ema_50, ema_200, atr = ema_20_arr[i], ema_50_arr[i], ema_200_arr[i], atr_arr[i]
            
            bullish_trend = (c3_close > ema_20) and (ema_20 > ema_50) and (ema_50 > ema_200)
            bearish_trend = (c3_close < ema_20) and (ema_20 < ema_50) and (ema_50 < ema_200)

            # Slicing super ringan ala NumPy
            major_high = np.max(highs[i-lookback-1 : i-1])
            major_low = np.min(lows[i-lookback-1 : i-1])
            c1_body, c2_body, c3_body = abs(c1_open - c1_close), abs(c2_open - c2_close), abs(c3_open - c3_close)

            for current_strat in all_strategies:
                if i - stats[current_strat]["last_idx"] < 5: 
                    continue 
                
                signal_found = False
                trade_type, entry, sl = "", 0.0, 0.0
                
                if current_strat == "fvg":
                    if (c3_low - c1_high) > (atr * 0.4) and c2_close > c2_open and bullish_trend:
                        trade_type, entry, sl = "BUY", c3_low, c1_high - (atr * 0.2)
                        signal_found = True
                    elif (c1_low - c3_high) > (atr * 0.4) and c2_close < c2_open and bearish_trend:
                        trade_type, entry, sl = "SELL", c3_high, c1_low + (atr * 0.2)
                        signal_found = True

                elif current_strat == "ob":
                    if c1_close < c1_open and c2_close > c2_open and c2_body > (c1_body * 3) and bullish_trend:
                        trade_type, entry, sl = "BUY", c1_high, c1_low - (atr * 0.1)
                        signal_found = True
                    elif c1_close > c1_open and c2_close < c2_open and c2_body > (c1_body * 3) and bearish_trend:
                        trade_type, entry, sl = "SELL", c1_low, c1_high + (atr * 0.1)
                        signal_found = True

                elif current_strat == "liq":
                    if c2_low < major_low and c2_close > major_low and (min(c2_open, c2_close) - c2_low) > (c2_body * 3) and bullish_trend:
                        trade_type, entry, sl = "BUY", c3_open, c2_low - (atr * 0.2)
                        signal_found = True
                    elif c2_high > major_high and c2_close < major_high and (c2_high - max(c2_open, c2_close)) > (c2_body * 3) and bearish_trend:
                        trade_type, entry, sl = "SELL", c3_open, c2_high + (atr * 0.2)
                        signal_found = True

                elif current_strat == "bos":
                    if c2_close > major_high and c2_body > (atr * 1.2) and bullish_trend:
                        trade_type, entry, sl = "BUY", major_high, major_high - atr
                        signal_found = True
                    elif c2_close < major_low and c2_body > (atr * 1.2) and bearish_trend:
                        trade_type, entry, sl = "SELL", major_low, major_low + atr
                        signal_found = True

                elif current_strat == "pd":
                    midline = (major_high + major_low) / 2
                    if c2_low < midline and c3_close > c3_open and c3_body > (atr * 0.5) and abs(c2_low - ema_50) < (atr * 0.5) and bullish_trend:
                        trade_type, entry, sl = "BUY", c3_close, c2_low - (atr * 0.2)
                        signal_found = True
                    elif c2_high > midline and c3_close < c3_open and c3_body > (atr * 0.5) and abs(c2_high - ema_50) < (atr * 0.5) and bearish_trend:
                        trade_type, entry, sl = "SELL", c3_close, c2_high + (atr * 0.2)
                        signal_found = True

                if signal_found:
                    stats[current_strat]["last_idx"] = i
                    risk = abs(entry - sl) if abs(entry - sl) != 0 else (atr * 0.5)
                    
                    if trade_type == "BUY":
                        tp, color, position, shape = entry + (risk * 1.5), "#10b981", "belowBar", "arrowUp"
                    else:
                        tp, color, position, shape = entry - (risk * 1.5), "#ef4444", "aboveBar", "arrowDown"

                    result = run_backtest_simulation(highs, lows, i, entry, sl, tp, trade_type)
                    if result == "WIN": stats[current_strat]["wins"] += 1
                    elif result == "LOSS": stats[current_strat]["losses"] += 1
                    
                    t_trades = stats[current_strat]["wins"] + stats[current_strat]["losses"]
                    current_win_prob = round((stats[current_strat]["wins"] / t_trades) * 100, 1) if t_trades > 0 else 0.0

                    if current_strat == strategy:
                        markers.append({"time": timestamps[i], "position": position, "color": color, "shape": shape, "text": f"{trade_type}"})
                        candles_ago = (len(data) - 1) - i
                        
                        if candles_ago <= 3 and result == "PENDING":
                            latest_signal_info = {
                                "type": trade_type, "entry": round(entry, 2), "tp": round(tp, 2), "sl": round(sl, 2), "age": candles_ago
                            }

                    candles_ago_tele = (len(data) - 1) - i
                    if candles_ago_tele <= 3 and result == "PENDING":
                        send_telegram_notif(
                            pair=pair, interval=interval, strategy=current_strat, 
                            trade_type=trade_type, entry=round(entry, 2), tp=round(tp, 2), sl=round(sl, 2), win_prob=current_win_prob
                        )

        total_ui_trades = stats[strategy]["wins"] + stats[strategy]["losses"]
        ui_win_prob = round((stats[strategy]["wins"] / total_ui_trades) * 100, 1) if total_ui_trades > 0 else 0.0

        final_candles = candles[-300:]
        start_time = final_candles[0]['time']
        valid_markers = [m for m in markers if m['time'] >= start_time]

        return {
            "candles": final_candles,
            "markers": valid_markers,
            "latestSignal": latest_signal_info, 
            "winProbability": ui_win_prob,
            "totalTradesTested": total_ui_trades
        }

    except Exception as e:
        print(f"Error fatal di backend: {str(e)}")
        traceback.print_exc() 
        return {"error": f"Sistem Error: {str(e)}"}