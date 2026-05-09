use std::time::Duration;

use color_eyre::Result;
use crossterm::event::{self, Event, KeyCode, KeyEventKind};
use ratatui::layout::Alignment;
use ratatui::style::{Modifier, Style};
use ratatui::widgets::{Block, Borders, Paragraph};

fn main() -> Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| -> Result<()> {
        loop {
            terminal.draw(render)?;

            if event::poll(Duration::from_millis(250))?
                && let Event::Key(key) = event::read()?
                && key.kind == KeyEventKind::Press
                && matches!(key.code, KeyCode::Char('q') | KeyCode::Esc)
            {
                return Ok(());
            }
        }
    })?;
    Ok(())
}

fn render(frame: &mut ratatui::Frame) {
    let block = Block::default().title(" agent-tui ").borders(Borders::ALL);
    let paragraph = Paragraph::new("Hello, agent-tui!\n\nPress q or Esc to quit.")
        .style(Style::default().add_modifier(Modifier::BOLD))
        .alignment(Alignment::Center)
        .block(block);
    frame.render_widget(paragraph, frame.area());
}
