use ratatui::Frame;
use ratatui::layout::{Constraint, Layout};
use ratatui::widgets::{Block, BorderType, Borders, Paragraph};

use crate::app::App;
use crate::widgets::textarea::wrapped_row_count;

pub fn render(app: &mut App, frame: &mut Frame) {
    let area = frame.area();

    // Computing the height of the input widget based on the number of wrapped rows it needs to display.
    let inner_width = area.width;
    let rows = wrapped_row_count(app.input.lines(), inner_width, app.input.tab_length());
    // Adds rows for the top and bottom borders of the input widget.
    let desired_input_height = (rows as u16).saturating_add(2);
    let input_height = desired_input_height.min(area.height);

    // The main area takes the remaining space after allocating the space for the current input height.
    let [main_area, input_area] = Layout::vertical([Constraint::Min(0), Constraint::Length(input_height)]).areas(area);

    // Main area that displays the submitted text.
    frame.render_widget(
        Paragraph::new(app.submitted.as_str())
            .block(Block::default().borders(Borders::ALL).border_type(BorderType::Rounded)),
        main_area,
    );

    // ratatui-textarea widget
    app.input
        .set_block(Block::default().borders(Borders::TOP | Borders::BOTTOM));
    frame.render_widget(&app.input, input_area);
}
