use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct PriceInfo {
    symbol: String,
    price: f64,
}

#[tauri::command]
async fn fetch_prices(symbols: Vec<String>) -> Result<Vec<PriceInfo>, String> {
    let mut results = Vec::new();

    for symbol in symbols {
        // Simple mock/public API logic
        // For production, you'd use a real provider (Alpha Vantage, Yahoo, etc.)
        // Here we'll simulate a fetch
        let price = match symbol.as_str() {
            "BTC" => 95000.0,
            "2330.TW" => 1045.0,
            "AAPL" => 220.5,
            _ => 100.0,
        };

        results.push(PriceInfo { symbol, price });
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
