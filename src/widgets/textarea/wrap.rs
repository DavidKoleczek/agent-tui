//! Visual row counter for `ratatui_textarea::TextArea` content.
//!
//! Mirrors the `WrapMode::WordOrGlyph` algorithm in `ratatui-textarea/src/wrap.rs`
//! so the host application can decide the input area's height before handing it to the layout.

use unicode_segmentation::UnicodeSegmentation;
use unicode_width::UnicodeWidthChar;

/// Count the visual rows the supplied logical lines occupy when rendered with `WrapMode::WordOrGlyph` at the given inner width.
///
/// `inner_width` is the width of the textarea's drawable area, i.e. the outer `Rect` width minus any block borders or padding.
/// It is clamped to at least 1 to match the upstream wrap helper.
///
/// `tab_len` should be the textarea's configured tab length, retrievable via [`ratatui_textarea::TextArea::tab_length`].
pub fn wrapped_row_count(lines: &[String], inner_width: u16, tab_len: u8) -> usize {
    let width = (inner_width as usize).max(1);
    if lines.is_empty() {
        return 1;
    }
    lines.iter().map(|line| count_line_rows(line, width, tab_len)).sum()
}

fn count_line_rows(line: &str, width: usize, tab_len: u8) -> usize {
    let chunks: Vec<(usize, usize)> = UnicodeSegmentation::split_word_bound_indices(line)
        .map(|(start, text)| (start, start + text.len()))
        .collect();

    if chunks.is_empty() {
        return 1;
    }

    let mut rows = 0usize;
    let mut i = 0usize;
    let mut seg_start = chunks[0].0;
    let mut seg_end = seg_start;
    let mut seg_width = 0usize;

    while i < chunks.len() {
        let (chunk_start, chunk_end) = chunks[i];
        if seg_end == seg_start {
            seg_start = chunk_start;
        }

        let chunk_width = display_width_from(&line[chunk_start..chunk_end], seg_width, tab_len);
        if seg_width + chunk_width <= width {
            seg_end = chunk_end;
            seg_width += chunk_width;
            i += 1;
            continue;
        }

        if seg_end > seg_start {
            // Close the current row and retry the same chunk on a fresh row.
            rows += 1;
            seg_start = seg_end;
            seg_width = 0;
            continue;
        }

        // Single chunk wider than the row: fall back to grapheme splitting.
        rows += grapheme_split_rows(line, chunk_start, chunk_end, width, tab_len);
        i += 1;
        seg_start = chunk_end;
        seg_end = chunk_end;
        seg_width = 0;
    }

    if seg_end > seg_start {
        rows += 1;
    }

    rows.max(1)
}

fn grapheme_split_rows(line: &str, start: usize, end: usize, width: usize, tab_len: u8) -> usize {
    let mut rows = 0usize;
    let mut segment_start = start;
    while segment_start < end {
        let mut segment_end = segment_start;
        let mut segment_width = 0usize;

        for (offset, grapheme) in UnicodeSegmentation::grapheme_indices(&line[segment_start..end], true) {
            let grapheme_start = segment_start + offset;
            let grapheme_end = grapheme_start + grapheme.len();
            let next_width = display_width_to(grapheme, segment_width, tab_len);
            let grapheme_width = next_width.saturating_sub(segment_width);

            if segment_end != segment_start && segment_width + grapheme_width > width {
                break;
            }

            segment_end = grapheme_end;
            segment_width = next_width;
            if segment_width > width {
                break;
            }
        }

        if segment_end == segment_start {
            // The first grapheme was already wider than the row; consume one
            // codepoint to guarantee forward progress.
            if let Some(ch) = line[segment_start..end].chars().next() {
                segment_end = segment_start + ch.len_utf8();
            } else {
                break;
            }
        }

        rows += 1;
        segment_start = segment_end;
    }
    rows
}

fn display_width_from(text: &str, start_width: usize, tab_len: u8) -> usize {
    display_width_to(text, start_width, tab_len).saturating_sub(start_width)
}

fn display_width_to(text: &str, mut width: usize, tab_len: u8) -> usize {
    for c in text.chars() {
        if c == '\t' {
            if tab_len > 0 {
                let tab = tab_len as usize;
                let pad = tab - (width % tab);
                width += pad;
            }
        } else {
            width += c.width().unwrap_or(0);
        }
    }
    width
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: &[&str]) -> Vec<String> {
        v.iter().map(|x| (*x).to_string()).collect()
    }

    #[test]
    fn empty_input_counts_as_one_row() {
        assert_eq!(wrapped_row_count(&s(&[""]), 80, 4), 1);
    }

    #[test]
    fn empty_slice_counts_as_one_row() {
        assert_eq!(wrapped_row_count(&[], 80, 4), 1);
    }

    #[test]
    fn short_line_fits_in_one_row() {
        assert_eq!(wrapped_row_count(&s(&["hello"]), 80, 4), 1);
    }

    #[test]
    fn multiple_logical_lines_sum() {
        assert_eq!(wrapped_row_count(&s(&["a", "b", "c"]), 80, 4), 3);
    }

    #[test]
    fn wraps_at_word_boundary() {
        // "hello world hello" at width 11 fits "hello world" then " hello".
        assert_eq!(wrapped_row_count(&s(&["hello world hello"]), 11, 4), 2);
    }

    #[test]
    fn long_unbroken_word_falls_back_to_glyph() {
        // WordOrGlyph splits "helloworld" at width 4 into "hell"/"owor"/"ld".
        assert_eq!(wrapped_row_count(&s(&["helloworld"]), 4, 4), 3);
    }

    #[test]
    fn wide_chars_count_correctly() {
        // "ab" + "犬" fills width 4, "猫" wraps to row 2.
        assert_eq!(wrapped_row_count(&s(&["ab犬猫"]), 4, 4), 2);
    }

    #[test]
    fn tab_advances_to_next_stop() {
        // "\t" pads to width 4 with tab_len=4, exceeding width 2; "X" follows.
        assert_eq!(wrapped_row_count(&s(&["\tX"]), 2, 4), 2);
    }

    #[test]
    fn zero_width_clamps_to_one() {
        // Width 0 should be treated as 1 (matches upstream effective_wrap_width).
        assert_eq!(wrapped_row_count(&s(&["abc"]), 0, 4), 3);
    }

    #[test]
    fn combining_grapheme_stays_intact() {
        // "e" + combining acute should occupy one cell, "x" wraps to row 2 at width 1.
        assert_eq!(wrapped_row_count(&s(&["e\u{301}x"]), 1, 4), 2);
    }
}
