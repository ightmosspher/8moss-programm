// 8moss-Programm: Desktop-Hülle.
// Die Datenbank (SQLite) wird über tauri-plugin-sql angesprochen.
// Das Datenbankschema liegt in src/db/migrations.ts und wird beim Start ausgeführt.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten des 8moss-Programms");
}
