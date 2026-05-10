use ratatui::crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseEvent, MouseEventKind};

use crate::app::App;

pub fn update(app: &mut App, key_event: KeyEvent) {
    let shift = key_event.modifiers.contains(KeyModifiers::SHIFT);
    match key_event.code {
        KeyCode::Esc => app.quit(),
        KeyCode::Enter if shift => app.submit_input(),
        KeyCode::PageUp | KeyCode::PageDown => {}
        _ => {
            app.input.input(key_event);
        }
    }
}

pub fn update_mouse(app: &mut App, mouse: MouseEvent) {
    match mouse.kind {
        MouseEventKind::ScrollUp | MouseEventKind::ScrollDown => {}
        _ => {
            app.input.input(mouse);
        }
    }
}

pub fn update_paste(app: &mut App, text: String) {
    app.input.insert_str(&text);
}
