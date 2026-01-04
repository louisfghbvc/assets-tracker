use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct PriceInfo {
    pub symbol: String,
    pub price: f64,
}

#[tauri::command]
async fn fetch_prices(symbols: Vec<String>) -> Result<Vec<PriceInfo>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for symbol in symbols {
        // Yahoo Finance symbol mapping
        let yahoo_symbol = if !symbol.contains('.')
            && symbol.len() <= 5
            && symbol.chars().all(|c| c.is_ascii_uppercase())
        {
            // Likely US Stock or Crypto. Yahoo needs BTC-USD for Crypto usually.
            // We'll try common suffixes or mapping in a real app.
            symbol.clone()
        } else {
            symbol.clone()
        };

        let url = format!(
            "https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1m&range=1d",
            yahoo_symbol
        );

        match client.get(&url).send().await {
            Ok(resp) => {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    println!("Fetched JSON for {}: {:?}", symbol, json);
                    if let Some(price) =
                        json["chart"]["result"][0]["meta"]["regularMarketPrice"].as_f64()
                    {
                        println!("Parsed price for {}: {}", symbol, price);
                        results.push(PriceInfo { symbol, price });
                        continue;
                    } else {
                        println!("Failed to find regularMarketPrice for {}", symbol);
                    }
                }
            }
            Err(e) => {
                println!("Error fetching {}: {}", symbol, e);
            }
        }

        // Fallback for Crypto if not found (e.g. BTC -> BTC-USD)
        if !symbol.contains('.') {
            let alt_symbol = format!("{}-USD", symbol);
            let alt_url = format!(
                "https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1m&range=1d",
                alt_symbol
            );
            if let Ok(resp) = client.get(&alt_url).send().await {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(price) =
                        json["chart"]["result"][0]["meta"]["regularMarketPrice"].as_f64()
                    {
                        results.push(PriceInfo { symbol, price });
                        continue;
                    }
                }
            }
        }

        // Final fallback if all fails (stay at existing price) or return a default
        // results.push(PriceInfo { symbol, price: 0.0 });
    }

    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![fetch_prices])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
