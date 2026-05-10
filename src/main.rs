pub mod app;
pub mod event;
pub mod tui;
pub mod ui;
pub mod update;
pub mod widgets;

use app::App;
use color_eyre::Result;
use event::{Event, EventHandler};
use ratatui::Terminal;
use ratatui::backend::CrosstermBackend;
use tui::Tui;
use update::{update, update_mouse, update_paste};

fn main() -> Result<()> {
    let mut app = App::new();

    let backend = CrosstermBackend::new(std::io::stderr());
    let terminal = Terminal::new(backend)?;
    let events = EventHandler::new(250);
    let mut tui = Tui::new(terminal, events);
    tui.enter()?;

    while !app.should_quit {
        tui.draw(&mut app)?;

        match tui.events.next()? {
            Event::Tick => {}
            Event::Key(key_event) => update(&mut app, key_event),
            Event::Mouse(mouse_event) => update_mouse(&mut app, mouse_event),
            Event::Paste(text) => update_paste(&mut app, text),
            Event::Resize(_, _) => {}
        };
    }

    tui.exit()?;
    Ok(())
}
