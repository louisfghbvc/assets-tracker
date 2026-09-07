use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PriceInfo {
    pub symbol: String,
    pub price: f64,
}

// In-memory cache for Yahoo cookie and crumb
static YAHOO_AUTH: Mutex<Option<(String, String)>> = Mutex::new(None);

async fn get_yahoo_auth(client: &reqwest::Client) -> Option<(String, String)> {
    if let Ok(lock) = YAHOO_AUTH.lock() {
        if let Some(ref auth) = *lock {
            return Some(auth.clone());
        }
    }

    let resp = client.get("https://fc.yahoo.com").send().await.ok()?;
    let mut cookie_parts = Vec::new();
    for val in resp.headers().get_all(reqwest::header::SET_COOKIE) {
        if let Ok(val_str) = val.to_str() {
            if let Some(first) = val_str.split(';').next() {
                cookie_parts.push(first.trim().to_string());
            }
        }
    }
    let cookie = cookie_parts.join("; ");
    if cookie.is_empty() {
        return None;
    }

    let crumb_resp = client
        .get("https://query2.finance.yahoo.com/v1/test/getcrumb")
        .header("Cookie", &cookie)
        .send()
        .await
        .ok()?;

    if !crumb_resp.status().is_success() {
        return None;
    }

    let crumb = crumb_resp.text().await.ok()?;
    if crumb.is_empty() || crumb.contains("Too Many Requests") {
        return None;
    }

    let auth = (cookie, crumb.trim().to_string());
    if let Ok(mut lock) = YAHOO_AUTH.lock() {
        *lock = Some(auth.clone());
    }

    Some(auth)
}

fn parse_twse_msg_price(msg: &serde_json::Value) -> Option<f64> {
    let parse_val = |val: &serde_json::Value| -> Option<f64> {
        if let Some(n) = val.as_f64() {
            if n > 0.0 {
                return Some(n);
            }
        }
        if let Some(s) = val.as_str() {
            let trimmed = s.trim();
            if trimmed != "-" && !trimmed.is_empty() {
                let first = trimmed.split('_').next().unwrap_or("").trim();
                if first != "-" && !first.is_empty() {
                    if let Ok(p) = first.parse::<f64>() {
                        if p > 0.0 {
                            return Some(p);
                        }
                    }
                }
            }
        }
        None
    };

    parse_val(&msg["z"])
        .or_else(|| parse_val(&msg["b"]))
        .or_else(|| parse_val(&msg["a"]))
        .or_else(|| parse_val(&msg["y"]))
}

async fn fetch_tw_prices(client: &reqwest::Client, symbols: Vec<String>) -> HashMap<String, f64> {
    let mut results = HashMap::new();
    if symbols.is_empty() {
        return results;
    }

    let symbol_codes: Vec<(String, String)> = symbols
        .into_iter()
        .filter_map(|s| {
            let sanitized = s.split_whitespace().next().unwrap_or("").to_string();
            let upper = sanitized.to_uppercase();
            let code = if let Some(c) = upper.strip_suffix(".TWO") {
                c.to_string()
            } else if let Some(c) = upper.strip_suffix(".TW") {
                c.to_string()
            } else {
                return None;
            };
            if code.is_empty() {
                None
            } else {
                Some((s, code))
            }
        })
        .collect();

    if symbol_codes.is_empty() {
        return results;
    }

    let chunks: Vec<Vec<(String, String)>> = symbol_codes
        .chunks(20)
        .map(|c| c.to_vec())
        .collect();

    let mut handles = Vec::new();
    for chunk in chunks {
        let client_clone = client.clone();
        handles.push(tokio::spawn(async move {
            let mut chunk_res = HashMap::new();
            let mut unique_codes: Vec<&str> = chunk.iter().map(|(_, code)| code.as_str()).collect();
            unique_codes.sort_unstable();
            unique_codes.dedup();
            let ex_chs: Vec<String> = unique_codes
                .iter()
                .map(|code| format!("tse_{}.tw|otc_{}.tw", code, code))
                .collect();
            let url = format!(
                "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch={}&json=1",
                ex_chs.join("|")
            );

            if let Ok(resp) = client_clone
                .get(&url)
                .header("Referer", "https://mis.twse.com.tw/stock/index.jsp")
                .send()
                .await
            {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(msg_array) = json["msgArray"].as_array() {
                        for (orig_sym, code) in &chunk {
                            for msg in msg_array {
                                let msg_code = msg["c"]
                                    .as_str()
                                    .map(|s| s.trim().to_string())
                                    .or_else(|| msg["c"].as_i64().map(|n| n.to_string()))
                                    .unwrap_or_default();
                                let msg_at = msg["@"].as_str().unwrap_or("").trim();
                                let at_code = msg_at.split('.').next().unwrap_or("");
                                let msg_ch = msg["ch"].as_str().unwrap_or("").trim();
                                let ch_code = msg_ch.split('.').next().unwrap_or("");
                                if msg_code.eq_ignore_ascii_case(code)
                                    || at_code.eq_ignore_ascii_case(code)
                                    || ch_code.eq_ignore_ascii_case(code)
                                {
                                    if let Some(price) = parse_twse_msg_price(msg) {
                                        chunk_res.insert(orig_sym.clone(), price);
                                        break;
                                    }
                                }
                            }
                        }
                        if chunk.len() == 1 && chunk_res.is_empty() {
                            for msg in msg_array {
                                if let Some(price) = parse_twse_msg_price(msg) {
                                    chunk_res.insert(chunk[0].0.clone(), price);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            (chunk, chunk_res)
        }));
    }

    let mut missing_symbols = Vec::new();
    for handle in handles {
        if let Ok((chunk, chunk_res)) = handle.await {
            for (orig_sym, code) in chunk {
                if let Some(&price) = chunk_res.get(&orig_sym) {
                    results.insert(orig_sym, price);
                } else {
                    missing_symbols.push((orig_sym, code));
                }
            }
        }
    }

    if !missing_symbols.is_empty() {
        let mut fallback_handles = Vec::new();
        for (orig_sym, code) in missing_symbols {
            let client_clone = client.clone();
            fallback_handles.push(tokio::spawn(async move {
                let tse_url = format!(
                    "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_{}.tw&json=1",
                    code
                );
                let otc_url = format!(
                    "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_{}.tw&json=1",
                    code
                );

                let (tse_resp, otc_resp) = tokio::join!(
                    client_clone
                        .get(&tse_url)
                        .header("Referer", "https://mis.twse.com.tw/stock/index.jsp")
                        .send(),
                    client_clone
                        .get(&otc_url)
                        .header("Referer", "https://mis.twse.com.tw/stock/index.jsp")
                        .send()
                );

                let parse_resp = |resp: Result<reqwest::Response, reqwest::Error>| async {
                    if let Ok(r) = resp {
                        if let Ok(json) = r.json::<serde_json::Value>().await {
                            if let Some(msg_array) = json["msgArray"].as_array() {
                                for msg in msg_array {
                                    if let Some(price) = parse_twse_msg_price(msg) {
                                        return Some(price);
                                    }
                                }
                            }
                        }
                    }
                    None
                };

                let tse_price = parse_resp(tse_resp).await;
                let price = if tse_price.is_some() {
                    tse_price
                } else {
                    parse_resp(otc_resp).await
                };

                (orig_sym, price)
            }));
        }

        for handle in fallback_handles {
            if let Ok((orig, Some(price))) = handle.await {
                results.insert(orig, price);
            }
        }
    }

    results
}

async fn fetch_us_crypto_prices(
    client: &reqwest::Client,
    symbols: Vec<String>,
) -> HashMap<String, f64> {
    let mut results = HashMap::new();
    if symbols.is_empty() {
        return results;
    }

    let items: Vec<(String, String)> = symbols
        .into_iter()
        .map(|s| {
            let sanitized = s.split_whitespace().next().unwrap_or("").to_string();
            let upper = sanitized.to_uppercase();
            let yahoo_sym = match upper.as_str() {
                "BTC" => "BTC-USD".to_string(),
                "ETH" => "ETH-USD".to_string(),
                "SOL" => "SOL-USD".to_string(),
                _ => upper,
            };
            (s, yahoo_sym)
        })
        .filter(|(_, y)| !y.is_empty())
        .collect();

    if items.is_empty() {
        return results;
    }

    let chunks: Vec<Vec<(String, String)>> = items
        .chunks(30)
        .map(|c| c.to_vec())
        .collect();

    let auth = get_yahoo_auth(client).await;
    let mut handles = Vec::new();

    for chunk in chunks {
        let client_clone = client.clone();
        let auth_clone = auth.clone();
        handles.push(tokio::spawn(async move {
            let mut chunk_res = HashMap::new();
            let mut chunk_missing = Vec::new();
            let mut unique_symbols: Vec<&str> = chunk.iter().map(|(_, y)| y.as_str()).collect();
            unique_symbols.sort_unstable();
            unique_symbols.dedup();
            let query_symbols = unique_symbols.join(",");

            let url = match &auth_clone {
                Some((_, crumb)) => format!(
                    "https://query2.finance.yahoo.com/v7/finance/quote?symbols={}&crumb={}",
                    query_symbols, crumb
                ),
                None => format!(
                    "https://query1.finance.yahoo.com/v7/finance/quote?symbols={}",
                    query_symbols
                ),
            };

            let mut req = client_clone.get(&url);
            if let Some((cookie, _)) = &auth_clone {
                req = req.header("Cookie", cookie);
            }

            let mut chunk_succeeded = false;
            if let Ok(resp) = req.send().await {
                let status = resp.status();
                if status.is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(quote_results) = json["quoteResponse"]["result"].as_array() {
                            chunk_succeeded = true;
                            let mut quote_map: HashMap<String, f64> = HashMap::new();
                            for q in quote_results {
                                let sym = q["symbol"].as_str().unwrap_or("").to_uppercase();
                                let price = q["regularMarketPrice"]
                                    .as_f64()
                                    .filter(|&p| p > 0.0)
                                    .or_else(|| q["postMarketPrice"].as_f64().filter(|&p| p > 0.0))
                                    .or_else(|| q["preMarketPrice"].as_f64().filter(|&p| p > 0.0))
                                    .or_else(|| q["previousClose"].as_f64().filter(|&p| p > 0.0));
                                if let Some(p) = price {
                                    quote_map.insert(sym, p);
                                }
                            }

                            for (orig, yahoo) in &chunk {
                                let yahoo_upper = yahoo.to_uppercase();
                                if let Some(&p) = quote_map.get(&yahoo_upper) {
                                    chunk_res.insert(orig.clone(), p);
                                } else {
                                    chunk_missing.push((orig.clone(), yahoo.clone()));
                                }
                            }
                        }
                    }
                } else if status.as_u16() == 401 || status.as_u16() == 403 || status.as_u16() == 429 {
                    if let Ok(mut lock) = YAHOO_AUTH.lock() {
                        *lock = None;
                    }
                }
            }

            if !chunk_succeeded {
                for item in chunk {
                    chunk_missing.push(item);
                }
            }

            (chunk_res, chunk_missing)
        }));
    }

    let mut missing_items = Vec::new();
    for handle in handles {
        if let Ok((chunk_res, chunk_missing)) = handle.await {
            for (k, v) in chunk_res {
                results.insert(k, v);
            }
            missing_items.extend(chunk_missing);
        }
    }

    if !missing_items.is_empty() {
        let mut fallback_handles = Vec::new();
        for (orig, yahoo) in missing_items {
            let client_clone = client.clone();
            let auth_cookie = auth.as_ref().map(|(c, _)| c.clone());
            fallback_handles.push(tokio::spawn(async move {
                let url = format!(
                    "https://query2.finance.yahoo.com/v8/finance/chart/{}?interval=1d&range=1d",
                    yahoo
                );
                let mut req = client_clone.get(&url);
                if let Some(ref cookie) = auth_cookie {
                    req = req.header("Cookie", cookie);
                }

                if let Ok(resp) = req.send().await {
                    if resp.status().is_success() {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            let meta = &json["chart"]["result"][0]["meta"];
                            let mut price = meta["regularMarketPrice"]
                                .as_f64()
                                .filter(|&p| p > 0.0)
                                .or_else(|| meta["chartPreviousClose"].as_f64().filter(|&p| p > 0.0));
                            if price.is_none() {
                                if let Some(closes) = json["chart"]["result"][0]["indicators"]["quote"][0]["close"].as_array() {
                                    for c in closes.iter().rev() {
                                        if let Some(p) = c.as_f64() {
                                            if p > 0.0 {
                                                price = Some(p);
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            if let Some(p) = price {
                                return (orig, Some(p));
                            }
                        }
                    }
                }
                (orig, None)
            }));
        }

        for handle in fallback_handles {
            if let Ok((orig, Some(price))) = handle.await {
                results.insert(orig, price);
            }
        }
    }

    results
}

#[tauri::command]
async fn fetch_exchange_rate() -> Result<f64, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    // Try open.er-api first (fast open API matching web client)
    if let Ok(resp) = client.get("https://open.er-api.com/v6/latest/USD").send().await {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let Some(rate) = json["rates"]["TWD"].as_f64().filter(|&r| r > 0.0) {
                println!("Exchange Rate: Parsed USD/TWD from open.er-api: {}", rate);
                return Ok(rate);
            }
        }
    }

    // Fallback to Yahoo Finance chart
    let url = "https://query2.finance.yahoo.com/v8/finance/chart/USDTWD=X?interval=1d&range=1d";
    let auth = get_yahoo_auth(&client).await;
    let mut req = client.get(url);
    if let Some((cookie, _)) = &auth {
        req = req.header("Cookie", cookie);
    }
    if let Ok(resp) = req.send().await {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let Some(price) = json["chart"]["result"][0]["meta"]["regularMarketPrice"]
                .as_f64()
                .filter(|&p| p > 0.0)
                .or_else(|| {
                    json["chart"]["result"][0]["meta"]["chartPreviousClose"]
                        .as_f64()
                        .filter(|&p| p > 0.0)
                })
            {
                println!("Exchange Rate: Parsed USD/TWD from Yahoo: {}", price);
                return Ok(price);
            }
        }
    }

    Ok(32.5)
}

#[tauri::command]
async fn fetch_prices(symbols: Vec<String>) -> Result<Vec<PriceInfo>, String> {
    if symbols.is_empty() {
        return Ok(Vec::new());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert("Accept", "application/json, text/plain, */*".parse().unwrap());
            headers.insert("Accept-Language", "en-US,en;q=0.9".parse().unwrap());
            headers.insert("Origin", "https://finance.yahoo.com".parse().unwrap());
            headers.insert("Referer", "https://finance.yahoo.com/".parse().unwrap());
            headers
        })
        .build()
        .map_err(|e| e.to_string())?;

    let mut results_map: HashMap<String, f64> = HashMap::new();
    let mut tw_symbols: Vec<String> = Vec::new();
    let mut us_crypto_symbols: Vec<String> = Vec::new();

    for sym in &symbols {
        let sanitized = sym.split_whitespace().next().unwrap_or("").to_string();
        let upper = sanitized.to_uppercase();
        if upper.is_empty() || upper == ".TW" || upper == ".TWO" {
            continue;
        }

        if upper == "USD" || upper == "USD-USD" || upper == "TWD" {
            results_map.insert(sym.clone(), 1.0);
        } else if upper.ends_with(".TW") || upper.ends_with(".TWO") {
            tw_symbols.push(sym.clone());
        } else {
            us_crypto_symbols.push(sym.clone());
        }
    }

    // Fetch Taiwan and US/Crypto prices concurrently
    let (tw_res, us_res) = tokio::join!(
        fetch_tw_prices(&client, tw_symbols),
        fetch_us_crypto_prices(&client, us_crypto_symbols)
    );

    for (k, v) in tw_res {
        results_map.insert(k, v);
    }
    for (k, v) in us_res {
        results_map.insert(k, v);
    }

    // Preserve original input ordering
    let mut final_results = Vec::new();
    for sym in &symbols {
        if let Some(&price) = results_map.get(sym) {
            final_results.push(PriceInfo {
                symbol: sym.clone(),
                price,
            });
        }
    }

    Ok(final_results)
}

#[derive(Serialize, Deserialize)]
pub struct CandleData {
    pub time: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: i64,
}

#[tauri::command]
async fn fetch_history(
    symbol: String,
    range: String,
    interval: String,
) -> Result<Vec<CandleData>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert("Accept", "application/json, text/plain, */*".parse().unwrap());
            headers.insert("Accept-Language", "en-US,en;q=0.9".parse().unwrap());
            headers.insert("Origin", "https://finance.yahoo.com".parse().unwrap());
            headers.insert("Referer", "https://finance.yahoo.com/".parse().unwrap());
            headers
        })
        .build()
        .map_err(|e| e.to_string())?;

    // Improved Symbol Normalization
    let mut yahoo_symbol = symbol.trim().to_uppercase();

    // Handle Crypto
    if yahoo_symbol == "BTC" || yahoo_symbol == "ETH" || yahoo_symbol == "SOL" {
        yahoo_symbol = format!("{}-USD", yahoo_symbol);
    }

    // Handle Taiwan Stocks
    if yahoo_symbol.ends_with(".TW") {
        // Already ends with .TW, but ensure it's not .TWO if it's listed on TSEC
        // Most common is .TW for TSEC and .TWO for OTC
    }

    let url = format!(
        "https://query2.finance.yahoo.com/v8/finance/chart/{}?interval={}&range={}",
        yahoo_symbol, interval, range
    );

    println!("Fetching history from: {}", url);

    match client.get(url).send().await {
        Ok(resp) => {
            let status = resp.status();
            if !status.is_success() {
                return Err(format!("Yahoo Finance returned status: {}", status));
            }

            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(error) = json["chart"]["error"]["description"].as_str() {
                    return Err(error.to_string());
                }

                let result = &json["chart"]["result"][0];
                let timestamps = result["timestamp"].as_array();
                let indicators = &result["indicators"]["quote"][0];

                let opens = indicators["open"].as_array();
                let highs = indicators["high"].as_array();
                let lows = indicators["low"].as_array();
                let closes = indicators["close"].as_array();
                let volumes = indicators["volume"].as_array();

                if let (Some(ts), Some(op), Some(hi), Some(lo), Some(cl), Some(vo)) =
                    (timestamps, opens, highs, lows, closes, volumes)
                {
                    let mut history = Vec::new();
                    for i in 0..ts.len() {
                        let open = op[i].as_f64();
                        let high = hi[i].as_f64();
                        let low = lo[i].as_f64();
                        let close = cl[i].as_f64();
                        let volume = vo[i].as_i64().unwrap_or(0);

                        // Only add if we have a valid close price
                        if let Some(c) = close {
                            if c > 0.0 {
                                history.push(CandleData {
                                    time: ts[i].as_i64().unwrap_or(0),
                                    open: open.unwrap_or(c),
                                    high: high.unwrap_or(c),
                                    low: low.unwrap_or(c),
                                    close: c,
                                    volume,
                                });
                            }
                        }
                    }
                    println!(
                        "Successfully fetched {} data points for {}",
                        history.len(),
                        yahoo_symbol
                    );
                    return Ok(history);
                }
            }
            Err("Could not parse history data response".to_string())
        }
        Err(e) => Err(format!("Network error fetching history: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            fetch_prices,
            fetch_exchange_rate,
            fetch_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_twse_msg_price_with_z() {
        let json = serde_json::json!({
            "c": "2330",
            "z": "600.0",
            "b": "599.0_598.0_",
            "y": "595.0"
        });
        assert_eq!(parse_twse_msg_price(&json), Some(600.0));
    }

    #[test]
    fn test_parse_twse_msg_price_fallback_to_b() {
        let json = serde_json::json!({
            "c": "2330",
            "z": "-",
            "b": "599.5_598.0_",
            "y": "595.0"
        });
        assert_eq!(parse_twse_msg_price(&json), Some(599.5));
    }

    #[test]
    fn test_parse_twse_msg_price_fallback_to_y() {
        let json = serde_json::json!({
            "c": "2330",
            "z": "-",
            "b": serde_json::Value::Null,
            "y": "595.0"
        });
        assert_eq!(parse_twse_msg_price(&json), Some(595.0));
    }

    #[test]
    fn test_parse_twse_msg_price_fallback_to_y_when_b_is_dash() {
        let json = serde_json::json!({
            "c": "2330",
            "z": "-",
            "b": "-",
            "y": "595.0"
        });
        assert_eq!(parse_twse_msg_price(&json), Some(595.0));
    }

    #[test]
    fn test_parse_twse_msg_price_fallback_to_y_when_b_is_dash_delimited() {
        let json = serde_json::json!({
            "c": "2330",
            "z": "-",
            "b": "-_-_-_-_-",
            "y": "595.0"
        });
        assert_eq!(parse_twse_msg_price(&json), Some(595.0));
    }

    #[test]
    fn test_parse_twse_msg_price_fallback_to_a() {
        let json = serde_json::json!({
            "c": "2330",
            "z": "-",
            "b": "-",
            "a": "600.0_601.0_",
            "y": "595.0"
        });
        assert_eq!(parse_twse_msg_price(&json), Some(600.0));
    }

    #[test]
    fn test_parse_twse_msg_price_numeric_fields() {
        let json = serde_json::json!({
            "c": 2330,
            "z": 600.0,
            "b": 599.0,
            "y": 595.0
        });
        assert_eq!(parse_twse_msg_price(&json), Some(600.0));
    }

    #[test]
    fn test_parse_twse_msg_price_numeric_b_fallback() {
        let json = serde_json::json!({
            "c": "2330",
            "z": "-",
            "b": 599.5,
            "y": 595.0
        });
        assert_eq!(parse_twse_msg_price(&json), Some(599.5));
    }

    #[test]
    fn test_parse_twse_msg_price_numeric_y_fallback() {
        let json = serde_json::json!({
            "c": "2330",
            "z": "-",
            "b": "-",
            "a": "-",
            "y": 595.0
        });
        assert_eq!(parse_twse_msg_price(&json), Some(595.0));
    }

    #[test]
    fn test_parse_twse_msg_price_invalid() {
        let json = serde_json::json!({
            "z": "-",
            "y": "0"
        });
        assert_eq!(parse_twse_msg_price(&json), None);
    }

    #[test]
    fn test_price_info_serialization() {
        let info = PriceInfo {
            symbol: "AAPL".to_string(),
            price: 180.5,
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"symbol\":\"AAPL\""));
        assert!(json.contains("\"price\":180.5"));
    }

    #[tokio::test]
    async fn test_fetch_prices_cash() {
        let res = fetch_prices(vec!["USD".to_string(), "twd".to_string(), "USD-USD".to_string()]).await.unwrap();
        assert_eq!(res.len(), 3);
        assert_eq!(res[0].price, 1.0);
        assert_eq!(res[1].price, 1.0);
        assert_eq!(res[2].price, 1.0);
    }

    #[tokio::test]
    async fn test_fetch_prices_twse_live() {
        let res = fetch_prices(vec!["2330.TW".to_string(), "6488.TWO".to_string()]).await.unwrap();
        assert_eq!(res.len(), 2);
        assert!(res[0].price > 0.0);
        assert!(res[1].price > 0.0);
    }

    #[tokio::test]
    async fn test_fetch_prices_us_crypto_live() {
        let res = fetch_prices(vec!["AAPL".to_string(), "BTC".to_string()]).await.unwrap();
        assert_eq!(res.len(), 2);
        assert!(res[0].price > 0.0);
        assert!(res[1].price > 0.0);
    }

    #[tokio::test]
    async fn test_fetch_prices_mixed_portfolio() {
        let symbols = vec![
            "USD".to_string(),
            "2330.TW".to_string(),
            "AAPL".to_string(),
            "6488.TWO".to_string(),
            "BTC".to_string(),
            "ETH".to_string(),
            "TWD".to_string(),
        ];
        let res = fetch_prices(symbols.clone()).await.unwrap();
        assert_eq!(res.len(), symbols.len());
        // Verify symbol ordering is preserved
        for (i, sym) in symbols.iter().enumerate() {
            assert_eq!(&res[i].symbol, sym);
            assert!(res[i].price > 0.0);
        }
    }

    #[tokio::test]
    async fn test_fetch_prices_edge_cases() {
        // Lowercase, duplicates, whitespace
        let symbols = vec![
            "2330.tw".to_string(),
            "AAPL".to_string(),
            "AAPL".to_string(),
            "aapl".to_string(),
            "  BTC  ".to_string(),
            "".to_string(),
            ".TW".to_string(),
        ];
        let res = fetch_prices(symbols).await.unwrap();
        // The valid symbols should be returned, empty/.TW ignored
        println!("Edge cases result: {:?}", res);
        assert!(res.iter().any(|p| p.symbol == "2330.tw" && p.price > 0.0));
        assert!(res.iter().any(|p| p.symbol == "AAPL" && p.price > 0.0));
        assert!(res.iter().any(|p| p.symbol == "aapl" && p.price > 0.0));
        assert!(res.iter().any(|p| p.symbol == "  BTC  " && p.price > 0.0));
        assert!(!res.iter().any(|p| p.symbol.is_empty()));
    }

    #[tokio::test]
    async fn test_fetch_prices_multi_chunk() {
        // Create 35 symbols across US and Taiwan to test chunking (>30 for US, >20 for TW)
        let mut symbols = Vec::new();
        // 25 Taiwan symbols (tests chunking >20)
        let tw_codes = vec![
            "2330", "2317", "2454", "2382", "2308", "2412", "2881", "2882", "2303", "2891",
            "3711", "2886", "3231", "3008", "2603", "1216", "2884", "2892", "2885", "5880",
            "6488", "3293", "8299", "6274", "5483"
        ];
        for code in &tw_codes {
            symbols.push(format!("{}.TW", code));
        }
        // 32 US/Crypto symbols (tests chunking >30)
        let us_syms = vec![
            "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "V", "JNJ",
            "WMT", "JPM", "PG", "MA", "UNH", "HD", "DIS", "BAC", "VZ", "ADBE",
            "CMCSA", "NFLX", "KO", "NKE", "INTC", "PFE", "T", "MRK", "PEP", "ABT",
            "BTC", "ETH"
        ];
        for s in &us_syms {
            symbols.push(s.to_string());
        }

        let t0 = std::time::Instant::now();
        let tw_symbols: Vec<String> = tw_codes.iter().map(|c| format!("{}.TW", c)).collect();
        let tw_res = fetch_prices(tw_symbols).await.unwrap();
        let tw_duration = t0.elapsed();
        println!("25 TW symbols fetched in {:.2}s (returned {})", tw_duration.as_secs_f64(), tw_res.len());

        let t1 = std::time::Instant::now();
        let us_symbols: Vec<String> = us_syms.iter().map(|s| s.to_string()).collect();
        let us_res = fetch_prices(us_symbols).await.unwrap();
        let us_duration = t1.elapsed();
        println!("32 US symbols fetched in {:.2}s (returned {})", us_duration.as_secs_f64(), us_res.len());

        let start = std::time::Instant::now();
        let res = fetch_prices(symbols.clone()).await.unwrap();
        let duration = start.elapsed();
        println!("Multi-chunk {} symbols fetched concurrently in {:.2}s. Total returned: {}", symbols.len(), duration.as_secs_f64(), res.len());
        assert!(res.len() >= 40);
    }
}


