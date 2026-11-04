#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn fetch_text(url: String) -> Result<String, String> {
    reqwest::blocking::get(&url)
        .map_err(|e| e.to_string())?
        .text()
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![fetch_text])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
