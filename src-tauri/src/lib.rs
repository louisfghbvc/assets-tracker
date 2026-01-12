use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct PriceInfo {
    pub symbol: String,
    pub price: f64,
}

#[tauri::command]
async fn fetch_exchange_rate() -> Result<f64, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let url = "https://query2.finance.yahoo.com/v8/finance/chart/USDTWD=X?interval=1m&range=1d";

    match client.get(url).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(price) =
                    json["chart"]["result"][0]["meta"]["regularMarketPrice"].as_f64()
                {
                    println!("Exchange Rate: Parsed USD/TWD: {}", price);
                    return Ok(price);
                }
            }
            Err("Could not parse exchange rate data".to_string())
        }
        Err(e) => Err(format!("Error fetching exchange rate: {}", e)),
    }
}

#[tauri::command]
async fn fetch_prices(symbols: Vec<String>) -> Result<Vec<PriceInfo>, String> {
    let client = reqwest::Client::builder()
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

    let mut results = Vec::new();

    for symbol in symbols {
        // Add a small delay to avoid rate limiting
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        // Taiwan Stock Handling (e.g., 2330.TW)
        if symbol.ends_with(".TW") {
            let code = symbol.replace(".TW", "");
            // Try tse (Listed) first, then otc (OTC)
            let urls = vec![
                format!(
                    "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_{}.tw&json=1",
                    code
                ),
                format!(
                    "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_{}.tw&json=1",
                    code
                ),
            ];

            let mut fetched = false;
            for url in urls {
                match client.get(&url).send().await {
                    Ok(resp) => {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            if let Some(msg) = json["msgArray"].as_array().and_then(|a| a.first()) {
                                // 'z' is current price, 'y' is yesterday's close
                                let price_str = msg["z"]
                                    .as_str()
                                    .unwrap_or(msg["y"].as_str().unwrap_or("0"));
                                if let Ok(price) = price_str.parse::<f64>() {
                                    if price > 0.0 {
                                        println!("TWSE: Parsed price for {}: {}", symbol, price);
                                        results.push(PriceInfo {
                                            symbol: symbol.clone(),
                                            price,
                                        });
                                        fetched = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => println!("Error fetching TWSE {}: {}", symbol, e),
                }
            }
            if fetched {
                continue;
            }
        }

        // Global Stocks / Crypto Handling (Yahoo Finance)
        // Fix for common crypto symbols
        let yahoo_symbol = match symbol.as_str() {
            "BTC" => "BTC-USD".to_string(),
            "ETH" => "ETH-USD".to_string(),
            "SOL" => "SOL-USD".to_string(),
            s if !s.contains('.') && s.len() <= 5 && s == s.to_uppercase() => {
                // Likely a US stock or crypto, keep as is or append -USD if common crypto
                s.to_string()
            }
            s => s.to_string(),
        };

        let url = format!(
            "https://query2.finance.yahoo.com/v8/finance/chart/{}?interval=1m&range=1d",
            yahoo_symbol
        );

        match client.get(&url).send().await {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(price) =
                            json["chart"]["result"][0]["meta"]["regularMarketPrice"].as_f64()
                        {
                            println!(
                                "Yahoo: Parsed price for {} ({}): {}",
                                symbol, yahoo_symbol, price
                            );
                            results.push(PriceInfo {
                                symbol: symbol.clone(),
                                price,
                            });
                        } else {
                            println!("Yahoo: No price data for {} ({})", symbol, yahoo_symbol);
                        }
                    }
                } else {
                    println!(
                        "Yahoo: Error fetching {} ({}): {}",
                        symbol, yahoo_symbol, status
                    );
                }
            }
            Err(e) => println!("Error fetching {}: {}", symbol, e),
        }
    }

    Ok(results)
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
