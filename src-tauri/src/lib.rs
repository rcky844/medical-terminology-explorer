#[tauri::command]
fn fetch_text(url: String) -> Result<String, String> {
    reqwest::blocking::get(&url)
        .map_err(|e| e.to_string())?
        .text()
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![fetch_text])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
