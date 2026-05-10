use ratatui_textarea::{TextArea, WrapMode};

pub struct App {
    pub should_quit: bool,
    pub input: TextArea<'static>,
    /// Most recently submitted input value, rendered in the main content area.
    pub submitted: String,
}

impl App {
    pub fn new() -> Self {
        let mut input = TextArea::default();
        input.set_wrap_mode(WrapMode::WordOrGlyph);
        Self {
            should_quit: false,
            input,
            submitted: String::new(),
        }
    }

    pub fn quit(&mut self) {
        self.should_quit = true;
    }

    /// Pressing Enter to submit will clear the input box and render the submitted value in the main content area.
    pub fn submit_input(&mut self) {
        self.submitted = self.input.lines().join("\n");
        self.input.clear();
    }
}

impl Default for App {
    fn default() -> Self {
        Self::new()
    }
}
